#!/usr/bin/env python3
import unittest
from datetime import datetime, timedelta
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
    def test_keeps_future_cached_departure_before_new_search(self):
        previous = {"departures": [transport.normalize(api_departure(5)["departures"][0])]}
        with patch.object(transport, "fetch") as fetch:
            departures, _, retained, _, _ = transport.find_next_departures("key", "stop", NOW, previous, {"departures": []})
        self.assertTrue(retained)
        self.assertEqual(len(departures), 1)
        fetch.assert_not_called()

    def test_searches_until_a_later_departure_is_found(self):
        responses = [{"departures": []}, {"departures": []}, api_departure(3)]
        with patch.object(transport, "fetch", side_effect=responses) as fetch:
            departures, lookup, retained, _, _ = transport.find_next_departures("key", "stop", NOW, {}, {"departures": []})
        self.assertEqual(len(departures), 1)
        self.assertFalse(retained)
        self.assertIsNotNone(lookup)
        self.assertEqual(fetch.call_count, 3)

    def test_empty_deep_search_is_throttled(self):
        with patch.object(transport, "future_query_times", return_value=["2026-08-01T23:15", "2026-08-02T00:15"]), patch.object(transport, "fetch", return_value={"departures": []}) as fetch:
            departures, _, _, next_search, _ = transport.find_next_departures("key", "stop", NOW, {}, {"departures": []})
        self.assertEqual(departures, [])
        self.assertIsNotNone(next_search)
        self.assertEqual(fetch.call_count, 2)
        retry_at = transport.parse_time(next_search, NOW.tzinfo)
        self.assertEqual(retry_at, NOW + timedelta(minutes=45))

    def test_future_search_uses_six_spread_windows(self):
        windows = transport.future_query_times(NOW)
        self.assertEqual(len(windows), 6)
        self.assertEqual(windows[0], "2026-08-01T23:15")
        self.assertEqual(windows[-1], "2026-08-02T22:15")

    def test_categorizes_train_and_bus(self):
        train = transport.normalize({"route": {"transport_mode": "TRAIN"}})
        bus = transport.normalize({"route": {"transport_mode": "BUS"}})
        self.assertEqual(train["mode"], "train")
        self.assertEqual(bus["mode"], "bus")


if __name__ == "__main__":
    unittest.main()
