#!/usr/bin/env python3
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class InformationStatusTests(unittest.TestCase):
    def test_information_page_uses_current_registry(self):
        page = (ROOT / "information.html").read_text(encoding="utf-8")
        script = (ROOT / "information-page.js").read_text(encoding="utf-8")
        registry = json.loads((ROOT / "data" / "municipalities.json").read_text(encoding="utf-8"))
        self.assertEqual(len(registry["municipalities"]), 21)
        self.assertIn('id="municipality-coverage"', page)
        self.assertIn('src="information-page.js', page)
        self.assertIn('fetch("data/municipalities.json"', script)
        self.assertIn('item.launchMode === "pilot"', script)
        self.assertNotIn("Kil och Sunne finns i pilotläge", page)

    def test_header_dialogs_have_viewport_bounds(self):
        styles = (ROOT / "styles.css").read_text(encoding="utf-8")
        self.assertIn(".homepage-customize-dialog {", styles)
        self.assertIn("max-width: calc(100vw - 24px)", styles)
        self.assertIn("max-height: calc(100dvh - 24px)", styles)
        self.assertIn("margin: auto", styles)


if __name__ == "__main__":
    unittest.main()
