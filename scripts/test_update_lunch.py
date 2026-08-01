#!/usr/bin/env python3
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

import update_lunch


class LunchUpdateTests(unittest.TestCase):
    def test_parser_accepts_weekday_with_date(self):
        page = "<h2>Vecka 31</h2><h3>Måndag 27/7</h3><p>Korvstroganoff med ris</p>"
        week, days = update_lunch.parse_weekday_menu(page)
        self.assertEqual(week, 31)
        self.assertEqual(days["monday"], ["Korvstroganoff med ris"])

    def test_parser_does_not_mix_two_weeks(self):
        page = "<h2>Vecka 31</h2><h3>Måndag</h3><p>Rätt vecka 31</p><h3>Tisdag</h3><p>Tisdagsrätt</p><h2>Vecka 32</h2><h3>Måndag</h3><p>Rätt vecka 32</p>"
        _week, days = update_lunch.parse_weekday_menu(page)
        self.assertEqual(days["monday"], ["Rätt vecka 31"])

    def test_generic_reference_is_not_a_restaurant(self):
        config = {
            "municipalities": {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES},
            "referenceSources": {"Arvika": [{"name": "Arvika Lunch", "url": "https://example.test"}]},
        }
        output = update_lunch.build_output(
            config,
            datetime(2026, 7, 27, 8, tzinfo=ZoneInfo("Europe/Stockholm")),
        )
        self.assertEqual(output["municipalities"]["Arvika"]["restaurants"], [])
        self.assertEqual(len(output["municipalities"]["Arvika"]["referenceSources"]), 1)

    def test_failed_fetch_never_exposes_unverified_dishes(self):
        municipalities = {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Åmål"] = [{
            "id": "test", "name": "Test", "url": "https://example.test",
            "address": "Åmål", "hours": "11–14", "parser": "weekday-headings",
        }]
        output = update_lunch.build_output(
            {"municipalities": municipalities},
            datetime(2026, 7, 27, 8, tzinfo=ZoneInfo("Europe/Stockholm")),
            fetcher=lambda _url: (_ for _ in ()).throw(RuntimeError("timeout")),
        )
        item = output["municipalities"]["Åmål"]["restaurants"][0]
        self.assertEqual(item["status"], "unavailable")
        self.assertEqual(item["days"], {})

    def test_duplicate_ids_are_rejected(self):
        municipalities = {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        duplicate = {"id": "same", "name": "A", "url": "https://example.test"}
        municipalities["Åmål"] = [duplicate]
        municipalities["Säffle"] = [{**duplicate, "name": "B"}]
        with self.assertRaises(ValueError):
            update_lunch.validate_config({"municipalities": municipalities})


if __name__ == "__main__":
    unittest.main()
