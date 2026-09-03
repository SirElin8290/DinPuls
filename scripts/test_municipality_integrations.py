#!/usr/bin/env python3
"""Regressionsskydd: insamlare får inte ha egna parallella kommunregister."""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


class MunicipalityIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = json.loads((ROOT / "data/municipalities.json").read_text(encoding="utf-8"))["municipalities"]
        cls.names = {item["name"] for item in cls.config}

    def test_collectors_follow_central_registry(self):
        self.assertEqual(set(load_module("update_events").LOCALITIES), self.names)
        self.assertEqual(set(load_module("update_jobs").LOCALITIES), self.names)
        self.assertEqual(set(load_module("update_news").MUNICIPALITIES), self.names)

    def test_association_import_follows_central_registry(self):
        importer = load_module("import_associations")
        self.assertEqual(set(importer.MUNICIPALITIES), self.names)
        self.assertEqual(set(importer.DIRECTORIES), self.names)

    def test_every_municipality_has_launch_integrations(self):
        for item in self.config:
            with self.subTest(municipality=item["name"]):
                self.assertTrue(item.get("newsSearchTerms"))
                self.assertTrue(item.get("localityAliases"))
                self.assertTrue(item.get("newsListing", {}).get("url"))
                self.assertTrue(item.get("associationDirectoryUrl"))
                self.assertTrue(item.get("associationImport", {}).get("parser"))
                if item.get("launchMode") != "pilot":
                    self.assertTrue(item.get("transportStops"), "produktionskommun saknar verifierad hållplats")

    def test_forshaga_uses_centrum_not_namesake_stop(self):
        municipality = next(item for item in self.config if item["name"] == "Forshaga")
        self.assertEqual(municipality["transportSearchName"], "Forshaga centrum")
        self.assertEqual(municipality["transportStops"], [
            {"id": "740000375", "name": "Forshaga centrum"},
        ])

    def test_exact_21_municipality_scope(self):
        expected = {
            "Åmål", "Bengtsfors", "Mellerud", "Dals-Ed", "Färgelanda",
            "Arvika", "Eda", "Filipstad", "Forshaga", "Grums", "Hagfors",
            "Hammarö", "Karlstad", "Kil", "Kristinehamn", "Munkfors",
            "Storfors", "Sunne", "Säffle", "Torsby", "Årjäng",
        }
        self.assertEqual(len(self.config), 21)
        self.assertEqual(self.names, expected)

    def test_all_municipality_indexed_outputs_have_all_21_keys(self):
        for filename in (
            "jobs.json", "weather-live.json", "transport.json", "road-traffic.json",
            "housing.json", "events.json", "lunch.json", "sports.json", "leisure.json",
        ):
            with self.subTest(filename=filename):
                payload = json.loads((ROOT / "data" / filename).read_text(encoding="utf-8"))
                self.assertEqual(set((payload.get("municipalities") or {}).keys()), self.names)

    def test_smaller_existing_localities_remain_covered(self):
        aliases = {item["name"]: set(item["localityAliases"]) for item in self.config}
        self.assertTrue({"tydje"} <= aliases["Åmål"])
        self.assertTrue({"bolstad"} <= aliases["Mellerud"])
        self.assertTrue({"segelmon", "liljedal"} <= aliases["Grums"])


if __name__ == "__main__":
    unittest.main()
