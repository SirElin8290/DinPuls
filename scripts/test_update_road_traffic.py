#!/usr/bin/env python3
import unittest
from datetime import datetime, timedelta, timezone

import update_road_traffic as traffic


class RoadTrafficTests(unittest.TestCase):
    def test_classifies_common_events(self):
        self.assertEqual(traffic.classify("Olycka på E45")[0], "accident")
        self.assertEqual(traffic.classify("Beläggningsarbete")[0], "roadwork")
        self.assertEqual(traffic.classify("Risk för halka")[0], "weather")

    def test_closed_road_is_danger(self):
        self.assertEqual(traffic.classify_severity("Vägen är avstängd"), "danger")

    def test_expired_item_is_removed(self):
        now = datetime.now(timezone.utc)
        item = {"endTime": (now - timedelta(hours=1)).isoformat()}
        self.assertFalse(traffic.is_relevant(item, now))

    def test_future_event_is_planned(self):
        now = datetime.now(timezone.utc)
        deviation = {
            "Header": "Planerat vägarbete",
            "StartTime": (now + timedelta(days=1)).isoformat(),
            "Geometry": {"WGS84": "POINT (12.7 59.0)"},
        }
        item = traffic.normalize({"Id": "test"}, deviation, 0, now)
        self.assertEqual(item["status"], "planned")

    def test_duplicate_keeps_nearest_item(self):
        municipality = {"latitude": 59.0, "longitude": 12.7}
        base = {
            "category": "roadwork", "title": "Arbete", "road": "E45", "location": "Test",
            "status": "current", "severity": "info", "latitude": 59.0,
        }
        items = [
            {**base, "longitude": 12.8},
            {**base, "longitude": 12.71},
        ]
        result = traffic.municipality_items(items, municipality)
        self.assertEqual(len(result), 1)
        self.assertLess(result[0]["distanceKm"], 2)


if __name__ == "__main__":
    unittest.main()
