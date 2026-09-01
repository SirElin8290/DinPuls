import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

import update_events


class EventUpdateTests(unittest.TestCase):
    def test_all_municipalities_have_multiple_sources(self):
        catalog = json.loads(Path(update_events.SOURCE_CATALOG).read_text(encoding="utf-8"))
        self.assertEqual(set(catalog["municipalities"]), set(update_events.LOCALITIES))
        for municipality, data in catalog["municipalities"].items():
            self.assertGreaterEqual(len(data.get("sources", [])), 5, municipality)

    def test_catalog_event_preserves_verified_source(self):
        event = update_events.catalog_event({
            "title":"Testkonsert", "startDate":"2099-08-07", "venue":"Testscenen",
            "category":"music", "sourceName":"Arrangören", "url":"https://example.com/event"
        }, "Åmål")
        self.assertTrue(event["verified"])
        self.assertEqual(event["category"], "music")

    def test_category_recognizes_common_events(self):
        self.assertEqual(update_events.category("Stor sommarkonsert")[0], "music")
        self.assertEqual(update_events.category("Familjedag för barn")[0], "family")
        self.assertEqual(update_events.category("Gudstjänst i kyrkan")[0], "church")

    def test_expired_catalog_event_is_removed(self):
        self.assertIsNone(update_events.catalog_event({"title":"Gammalt", "startDate":"2020-01-01"}, "Åmål"))

    def test_visit_varmland_time_label_uses_swedish_summer_time(self):
        start = int(datetime(2026, 9, 5, 8, 0, tzinfo=timezone.utc).timestamp())
        end = int(datetime(2026, 9, 5, 15, 0, tzinfo=timezone.utc).timestamp())
        self.assertEqual(update_events.visit_varmland_time_label(start, end), "10:00–17:00")

    def test_visit_varmland_all_day_midnight_is_not_shown_as_clock_time(self):
        start = int(datetime(2026, 8, 29, 22, 0, tzinfo=timezone.utc).timestamp())
        end = int(datetime(2026, 9, 29, 22, 0, tzinfo=timezone.utc).timestamp())
        self.assertEqual(update_events.visit_varmland_time_label(start, end), "Se källan")


if __name__ == "__main__":
    unittest.main()
