import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MUNICIPALITY_CONFIG = json.loads((ROOT / "data/municipalities.json").read_text(encoding="utf-8"))["municipalities"]
MUNICIPALITIES = [item["name"] for item in MUNICIPALITY_CONFIG]
PILOT_MUNICIPALITIES = {item["name"] for item in MUNICIPALITY_CONFIG if item.get("launchMode") == "pilot"}


class LeisureModuleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / "data/leisure.json").read_text(encoding="utf-8"))

    def test_all_municipalities_have_a_directory(self):
        municipalities = self.data["municipalities"]
        self.assertEqual(list(municipalities), MUNICIPALITIES)
        for name, payload in municipalities.items():
            self.assertTrue(payload["directoryUrl"].startswith("https://"), name)

    def test_activities_are_local_searchable_and_secure(self):
        total = 0
        for name, payload in self.data["municipalities"].items():
            if name not in PILOT_MUNICIPALITIES:
                self.assertGreaterEqual(len(payload["activities"]), 40, name)
            total += len(payload["activities"])
            for activity in payload["activities"]:
                self.assertTrue(activity["name"], name)
                self.assertTrue(activity["category"], activity["name"])
                self.assertTrue(activity["tags"], activity["name"])
                self.assertTrue(activity["url"].startswith("https://"), activity["name"])
        self.assertGreaterEqual(total, 600)

    def test_mosseruds_gard_is_searchable_in_arjang(self):
        names = [item["name"] for item in self.data["municipalities"]["Årjäng"]["activities"]]
        self.assertIn("Mosseruds Gård", names)

    def test_verified_direct_links_are_applied(self):
        overrides = json.loads((ROOT / "data/association-link-overrides.json").read_text(encoding="utf-8"))
        sports = json.loads((ROOT / "data/sports.json").read_text(encoding="utf-8"))
        actual = {}
        for municipality, payload in self.data["municipalities"].items():
            for activity in payload["activities"]:
                actual[f"{municipality}|{activity['name']}"] = activity["url"]
        for municipality, payload in sports["municipalities"].items():
            for club in payload["clubs"]:
                actual[f"{municipality}|{club['name']}"] = club["url"]
        self.assertGreaterEqual(len(overrides), 190)
        for key, url in overrides.items():
            self.assertTrue(url.startswith("https://"), key)
            self.assertEqual(actual.get(key), url, key)

    def test_sport_and_leisure_are_independently_optional(self):
        index = (ROOT / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "script.js").read_text(encoding="utf-8")
        self.assertIn('data-home-module="sport"', index)
        self.assertIn('data-home-module="leisure"', index)
        self.assertIn('sport: [".sport-home"]', script)
        self.assertIn('leisure: [".leisure-home"]', script)

    def test_both_hubs_have_prominent_search(self):
        sport = (ROOT / "sport.html").read_text(encoding="utf-8")
        leisure = (ROOT / "fritid.html").read_text(encoding="utf-8")
        self.assertIn('id="sport-hub-search"', sport)
        self.assertIn('id="leisure-search"', leisure)
        self.assertIn("Vad vill du träna?", sport)
        self.assertIn("Vad vill du göra?", leisure)
        hub = (ROOT / "leisure-hub.js").read_text(encoding="utf-8")
        self.assertIn('ALL_MUNICIPALITIES = "Alla kommuner"', hub)


if __name__ == "__main__":
    unittest.main()
