import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MUNICIPALITIES = [
    item["name"]
    for item in json.loads((ROOT / "data" / "municipalities.json").read_text(encoding="utf-8"))["municipalities"]
]


class HealthDirectoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / "data" / "health-private.json").read_text(encoding="utf-8"))
        cls.providers = cls.data.get("providers", [])

    def test_all_municipalities_have_private_entries(self):
        covered = {item.get("municipality") for item in self.providers}
        self.assertEqual(set(MUNICIPALITIES), covered)

    def test_every_entry_is_contactable_and_categorized(self):
        allowed_categories = set(self.data.get("categoryOrder", [])) | {"Övrig vård & hälsa"}
        for item in self.providers:
            with self.subTest(provider=item.get("name")):
                self.assertIn(item.get("municipality"), MUNICIPALITIES)
                self.assertTrue(str(item.get("name") or "").strip())
                self.assertIn(item.get("category"), allowed_categories)
                self.assertTrue(any(str(item.get(key) or "").strip() for key in ("url", "phone", "address")))

    def test_no_duplicate_provider_names_per_municipality(self):
        keys = [(item.get("municipality"), str(item.get("name") or "").casefold()) for item in self.providers]
        self.assertEqual(len(keys), len(set(keys)))

    def test_frontend_loads_private_directory(self):
        script = (ROOT / "health-page.js").read_text(encoding="utf-8")
        page = (ROOT / "vard.html").read_text(encoding="utf-8")
        self.assertIn('data/health-private.json', script)
        self.assertIn('health-directory-groups', page)
        self.assertIn('health-page.css?version=', page)


if __name__ == "__main__":
    unittest.main()
