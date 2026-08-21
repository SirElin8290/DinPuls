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
                self.assertTrue(item.get("newsListing", {}).get("url"))
                self.assertTrue(item.get("associationDirectoryUrl"))
                self.assertTrue(item.get("associationImport", {}).get("parser"))
                self.assertTrue(item.get("transportStops"))


if __name__ == "__main__":
    unittest.main()
