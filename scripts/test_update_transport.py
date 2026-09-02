#!/usr/bin/env python3
import unittest
import json
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import update_transport as transport


NOW = datetime(2026, 8, 1, 22, 15, tzinfo=transport.STOCKHOLM)


def api_departure(hours=0):
    departure = NOW + timedelta(hours=hours)
    return {
        "departures": [{
            "scheduled": departure.isoformat(),
            "route": {"transport_mode": "BUS", "designation": "1", "direction": "Centrum"},
        }]
    }


class UpdateTransportTests(unittest.TestCase):
    def setUp(self):
        transport._last_request_started = 0.0

    def test_registry_loader_keeps_municipality_without_stop(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "municipalities.json"
            path.write_text(json.dumps({"municipalities": [
                {"name": "Med hållplats", "transportStops": [{"id": "1", "name": "Centrum"}]},
                {"name": "Utan hållplats"},
            ]}), encoding="utf-8")
            with patch.object(transport, "MUNICIPALITY_FILE", path):
                areas = transport.load_stop_areas()
        self.assertEqual(areas["Utan hållplats"], [])
        self.assertEqual(areas["Med hållplats"][0]["id"], "1")

    def test_thin_current_departures_trigger_deep_search(self):
        with patch.object(transport, "fetch", return_value={"departures": []}) as fetch:
            departures, _, retained, _, _ = transport.find_next_departures(
                "key", "stop", NOW, {}, api_departure(1)
            )
        self.assertEqual(len(departures), 1)
        self.assertFalse(retained)
        self.assertEqual(fetch.call_count, len(transport.LOOKAHEAD_OFFSETS_HOURS))

    def test_new_search_is_merged_with_later_cached_departure(self):
        previous = {"departures": [transport.normalize(api_departure(5)["departures"][0])]}
        with patch.object(transport, "fetch", return_value=api_departure(1)) as fetch:
            departures, _, retained, _, _ = transport.find_next_departures("key", "stop", NOW, previous, {"departures": []})
        self.assertFalse(retained)
        self.assertEqual(len(departures), 2)
        self.assertEqual(departures[0]["scheduled"], api_departure(1)["departures"][0]["scheduled"])
        self.assertEqual(departures[1]["scheduled"], api_departure(5)["departures"][0]["scheduled"])
        self.assertEqual(fetch.call_count, len(transport.LOOKAHEAD_OFFSETS_HOURS))

    def test_cached_departure_is_fallback_after_empty_search(self):
        previous = {"departures": [transport.normalize(api_departure(5)["departures"][0])]}
        with patch.object(transport, "fetch", return_value={"departures": []}) as fetch:
            departures, _, retained, _, _ = transport.find_next_departures("key", "stop", NOW, previous, {"departures": []})
        self.assertTrue(retained)
        self.assertEqual(len(departures), 1)
        self.assertEqual(fetch.call_count, len(transport.LOOKAHEAD_OFFSETS_HOURS))

    def test_searches_all_configured_windows_for_a_later_departure(self):
        responses = [{"departures": []} for _ in transport.LOOKAHEAD_OFFSETS_HOURS]
        responses[-1] = api_departure(12)
        with patch.object(transport, "fetch", side_effect=responses) as fetch:
            departures, lookup, retained, _, _ = transport.find_next_departures("key", "stop", NOW, {}, {"departures": []})
        self.assertEqual(len(departures), 1)
        self.assertFalse(retained)
        self.assertIsNotNone(lookup)
        self.assertEqual(fetch.call_count, len(transport.LOOKAHEAD_OFFSETS_HOURS))

    def test_empty_deep_search_is_throttled(self):
        with patch.object(transport, "future_query_times", return_value=["2026-08-01T23:15", "2026-08-02T00:15"]), patch.object(transport, "fetch", return_value={"departures": []}) as fetch:
            departures, _, _, next_search, _ = transport.find_next_departures("key", "stop", NOW, {}, {"departures": []})
        self.assertEqual(departures, [])
        self.assertIsNotNone(next_search)
        self.assertEqual(fetch.call_count, 2)
        retry_at = transport.parse_time(next_search, NOW.tzinfo)
        self.assertEqual(retry_at, NOW + timedelta(minutes=45))

    def test_future_search_uses_dense_spread_windows(self):
        windows = transport.future_query_times(NOW)
        self.assertEqual(len(windows), 6)
        self.assertEqual(windows[0], "2026-08-01T23:15")
        self.assertEqual(windows[1], "2026-08-02T00:15")
        self.assertEqual(windows[-1], "2026-08-02T10:15")

    def test_current_engine_version_respects_deep_search_throttle(self):
        previous = {
            "engineVersion": transport.TRANSPORT_VERSION,
            "nextSearchAfter": (NOW + timedelta(hours=1)).isoformat(timespec="minutes"),
        }
        with patch.object(transport, "fetch") as fetch:
            departures, _, retained, _, _ = transport.find_next_departures(
                "key", "stop", NOW, previous, api_departure(1)
            )
        self.assertEqual(len(departures), 1)
        self.assertFalse(retained)
        fetch.assert_not_called()

    def test_categorizes_train_and_bus(self):
        train = transport.normalize({"route": {"transport_mode": "TRAIN"}})
        bus = transport.normalize({"route": {"transport_mode": "BUS"}})
        self.assertEqual(train["mode"], "train")
        self.assertEqual(bus["mode"], "bus")

    def test_naive_api_times_are_saved_with_stockholm_timezone(self):
        departure = transport.normalize({
            "scheduled": "2026-08-11T08:20:00",
            "realtime": "2026-08-11T08:22:00",
            "route": {"transport_mode": "BUS"},
        })
        self.assertEqual(departure["scheduled"], "2026-08-11T08:20:00+02:00")
        self.assertEqual(departure["realtime"], "2026-08-11T08:22:00+02:00")

    def test_requests_are_globally_paced(self):
        with patch.object(transport.time, "monotonic", side_effect=[10.1, 10.1]), patch.object(transport.time, "sleep") as sleep:
            transport._last_request_started = 10.0
            transport.pace_request()
        sleep.assert_called_once()
        self.assertAlmostEqual(sleep.call_args.args[0], transport.MIN_REQUEST_INTERVAL_SECONDS - 0.1)

    def test_request_pacing_spreads_twenty_one_stops_over_a_minute(self):
        self.assertGreaterEqual(transport.MIN_REQUEST_INTERVAL_SECONDS * 20, 60)

    def test_retry_after_supports_seconds(self):
        self.assertEqual(transport.retry_after_seconds("37"), 37)

    def test_retry_after_supports_http_date(self):
        now = datetime(2026, 8, 1, 20, 0, tzinfo=transport.timezone.utc)
        self.assertEqual(
            transport.retry_after_seconds("Sat, 01 Aug 2026 20:00:45 GMT", now),
            46,
        )

    def test_invalid_retry_after_falls_back_to_local_backoff(self):
        self.assertIsNone(transport.retry_after_seconds("inte ett datum"))


if __name__ == "__main__":
    unittest.main()
