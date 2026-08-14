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

    def test_county_number_list_is_normalized(self):
        deviation = {
            "Header": "Vägarbete",
            "CountyNo": [14, 17],
            "Geometry": {"WGS84": "POINT (12.7 59.0)"},
        }
        item = traffic.normalize({"Id": "test"}, deviation, 0)
        self.assertEqual(item["countyCodes"], ["14", "17"])

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

    def test_item_is_assigned_to_only_one_nearest_municipality(self):
        municipalities = [
            {"name": "Åmål", "county": "Västra Götalands län", "latitude": 59.052, "longitude": 12.704},
            {"name": "Säffle", "county": "Värmlands län", "latitude": 59.132, "longitude": 12.929},
            {"name": "Bengtsfors", "county": "Västra Götalands län", "latitude": 59.029, "longitude": 12.232},
        ]
        item = {
            "id": "road-164", "category": "roadwork", "title": "Vägarbete", "road": "164",
            "location": "Väg 164", "countyCodes": ["14"], "status": "current", "severity": "info",
            "latitude": 59.04, "longitude": 12.60,
        }
        result = traffic.assign_items_to_municipalities([item], municipalities)
        self.assertEqual([name for name, rows in result.items() if rows], ["Åmål"])

    def test_county_filter_blocks_nearby_wrong_county(self):
        municipalities = [
            {"name": "Åmål", "county": "Västra Götalands län", "latitude": 59.052, "longitude": 12.704},
            {"name": "Säffle", "county": "Värmlands län", "latitude": 59.132, "longitude": 12.929},
        ]
        item = {
            "id": "varmland", "category": "roadwork", "title": "Vägarbete", "road": "E45",
            "location": "Värmlands län", "countyCodes": ["17"], "status": "current", "severity": "info",
            "latitude": 59.08, "longitude": 12.75,
        }
        result = traffic.assign_items_to_municipalities([item], municipalities)
        self.assertFalse(result["Åmål"])
        self.assertEqual(len(result["Säffle"]), 1)


if __name__ == "__main__":
    unittest.main()
