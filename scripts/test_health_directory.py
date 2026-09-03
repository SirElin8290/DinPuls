import json
import unittest
from urllib.parse import urlsplit
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MUNICIPALITIES = [
    item["name"]
    for item in json.loads((ROOT / "data" / "municipalities.json").read_text(encoding="utf-8"))["municipalities"]
]
ALLOWED_CATEGORIES = {
    "Vårdcentral & läkare",
    "Akut & jour",
    "Sjukhus & akutmottagning",
    "Barn & unga",
    "Psykisk hälsa & beroende",
    "Tandvård",
    "Apotek",
    "Rehabilitering & fysioterapi",
    "Kiropraktor, naprapat & osteopat",
    "Massage & kroppsterapi",
    "Medicinsk fotvård",
    "Fotvård & medicinsk fotvård",
    "Optik & syn",
    "Psykisk hälsa & samtalsstöd",
    "Barnmorska & kvinnohälsa",
    "Vaccination",
    "Företagshälsa & specialist",
    "Övrig vård & hälsa",
}


class HealthDirectoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.main_data = json.loads((ROOT / "data" / "health-private.json").read_text(encoding="utf-8"))
        cls.supplement_data = json.loads((ROOT / "data" / "health-private-supplement.json").read_text(encoding="utf-8"))
        cls.local_data = json.loads((ROOT / "data" / "health-local-supplement.json").read_text(encoding="utf-8"))
        cls.official_data = json.loads((ROOT / "data" / "health.json").read_text(encoding="utf-8"))
        cls.main_providers = cls.main_data.get("providers", [])
        cls.supplement_providers = cls.supplement_data.get("providers", [])
        cls.local_providers = cls.local_data.get("providers", [])
        cls.providers = cls.main_providers + cls.supplement_providers + cls.local_providers

    def test_all_municipalities_have_health_entries(self):
        covered = {item.get("municipality") for item in self.providers + self.official_data.get("providers", [])}
        self.assertEqual(set(MUNICIPALITIES), covered)

    def test_every_entry_is_contactable_and_categorized(self):
        for item in self.providers:
            with self.subTest(provider=item.get("name")):
                self.assertIn(item.get("municipality"), MUNICIPALITIES)
                self.assertTrue(str(item.get("name") or "").strip())
                self.assertIn(item.get("category"), ALLOWED_CATEGORIES)
                self.assertTrue(any(str(item.get(key) or "").strip() for key in ("url", "phone", "address")))

    def test_no_duplicate_names_inside_each_source(self):
        for providers in (self.main_providers, self.supplement_providers, self.local_providers):
            keys = [(item.get("municipality"), str(item.get("name") or "").casefold()) for item in providers]
            self.assertEqual(len(keys), len(set(keys)))

    def test_eda_verified_coverage_without_duplicates(self):
        entries = [item for item in self.providers + self.official_data.get("providers", [])
                   if item.get("municipality") == "Eda"]
        names = [item["name"].strip().casefold() for item in entries]
        self.assertEqual(len(names), len(set(names)))
        by_name = {item["name"]: item for item in entries}
        for name in ("Vårdcentralen Eda", "Fysioterapimottagningen Charlottenberg",
                     "Barnmorskemottagningen vårdcentralen Eda", "Folktandvården Åmotfors",
                     "Charlottenbergs Tandklinik"):
            with self.subTest(provider=name):
                self.assertIn(name, by_name)
                self.assertEqual(urlsplit(by_name[name]["url"]).hostname, "www.1177.se")
        wellness = [by_name[name] for name in
                    ("Fixa Foten", "Holmens massagepraktik", "Marihas Akupressur")]
        self.assertTrue({"Fotvård & medicinsk fotvård", "Massage & kroppsterapi"}
                        <= {item["category"] for item in wellness})
        for item in wellness:
            parsed = urlsplit(item["url"])
            self.assertEqual(parsed.scheme, "https")
            self.assertEqual(parsed.hostname, "www.bokadirekt.se")
            self.assertTrue(parsed.path.startswith("/places/"))
            self.assertTrue(item.get("sourceType"))
            self.assertIn("Charlottenberg", item["address"])

    def test_frontend_loads_complete_directory(self):
        script = (ROOT / "health-page.js").read_text(encoding="utf-8")
        page = (ROOT / "vard.html").read_text(encoding="utf-8")
        self.assertIn('data/health-private.json', script)
        self.assertIn('data/health-private-supplement.json', script)
        self.assertIn('data/health-local-supplement.json', script)
        self.assertIn('health-directory-groups', page)
        self.assertIn('health-page.css?version=', page)
        self.assertIn('Fotvård & medicinsk fotvård', script)
        self.assertIn('"Apotek"', script)


if __name__ == "__main__":
    unittest.main()
