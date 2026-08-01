import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import update_housing


class HousingUpdateTests(unittest.TestCase):
    def test_room_count_reads_momentum_labels(self):
        self.assertEqual(update_housing.room_count("3 Rum och kök"), 3)
        self.assertEqual(update_housing.room_count("1,5 rum"), 1.5)
        self.assertIsNone(update_housing.room_count("Uppgift saknas"))

    def test_momentum_uses_rooms_display_name(self):
        settings = {
            "apiBaseUrl": "https://api.example/",
            "xApiKey": "key",
            "appInstanceId": "client",
            "appVersion": "1",
        }
        payload = {
            "items": [{
                "id": "home-1",
                "displayName": "Testgatan 1",
                "location": {"area": {"displayName": "Centrum"}},
                "size": {"roomsDisplayName": "3 Rum och kök", "area": 72},
                "pricing": {"price": 7500},
                "availability": {},
            }]
        }
        provider = {"name": "Testbostäder", "url": "https://homes.example/market/residential"}
        with patch.object(update_housing, "fetch_json_url", side_effect=[settings, payload]):
            listings = update_housing.parse_momentum(provider)
        self.assertEqual(listings[0]["rooms"], 3)

    def test_hss_timeout_becomes_runtime_error(self):
        opener = Mock()
        opener.open.side_effect = TimeoutError("timed out")
        with patch.object(update_housing, "build_opener", return_value=opener):
            with self.assertRaisesRegex(RuntimeError, "kunde inte nå källan"):
                update_housing.fetch_hss_pages("https://example.invalid")

    def test_partial_failure_preserves_previous_data_and_deduplicates(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_path = root / "municipalities.json"
            output_path = root / "housing.json"
            providers = [
                {"name": "A-bostäder", "url": "https://a.example", "parser": "momentum", "official": True},
                {"name": "B-bostäder", "url": "https://b.example", "parser": "momentum", "official": True},
            ]
            config_path.write_text(json.dumps({
                "municipalities": [
                    {"name": "A", "housingProviders": [providers[0]]},
                    {"name": "B", "housingProviders": [providers[1]]},
                ]
            }), encoding="utf-8")
            old_listing = {"id": "old", "address": "Gamla vägen 1", "url": "https://a.example/old", "provider": "A-bostäder"}
            output_path.write_text(json.dumps({
                "generatedAt": "2026-01-01T00:00:00+00:00",
                "municipalities": {
                    "A": {"total": 1, "listings": [old_listing], "providers": [], "updatedAt": "2026-01-01T00:00:00+00:00"}
                }
            }), encoding="utf-8")
            new_listing = {"id": "new", "address": "Nya vägen 2", "url": "https://b.example/new", "provider": "B-bostäder"}

            def fake_momentum(provider):
                if provider["name"] == "A-bostäder":
                    raise RuntimeError("timeout")
                return [new_listing, dict(new_listing)]

            with (
                patch.object(update_housing, "MUNICIPALITY_FILE", config_path),
                patch.object(update_housing, "OUTPUT", output_path),
                patch.object(update_housing, "parse_momentum", side_effect=fake_momentum),
            ):
                self.assertEqual(update_housing.main(), 0)

            result = json.loads(output_path.read_text(encoding="utf-8"))["municipalities"]
            self.assertEqual(result["A"]["listings"], [old_listing])
            self.assertTrue(result["A"]["stale"])
            self.assertEqual(len(result["B"]["listings"]), 1)
            self.assertFalse(result["B"]["stale"])
            self.assertIn("checkedAt", result["A"])

    def test_unexpected_zero_does_not_replace_previous_objects(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_path = root / "municipalities.json"
            output_path = root / "housing.json"
            provider = {"name": "Testbostäder", "url": "https://example.test", "parser": "momentum", "official": True}
            config_path.write_text(json.dumps({"municipalities": [{"name": "Test", "housingProviders": [provider]}]}), encoding="utf-8")
            previous = {
                "generatedAt": "2026-01-01T00:00:00+00:00",
                "municipalities": {"Test": {
                    "total": 1,
                    "listings": [{"id": "1", "url": "https://example.test/1", "provider": "Testbostäder"}],
                    "providers": [{"name": "Testbostäder", "url": "https://example.test", "official": True}],
                    "updatedAt": "2026-01-01T00:00:00+00:00",
                }}
            }
            output_path.write_text(json.dumps(previous), encoding="utf-8")
            with (
                patch.object(update_housing, "MUNICIPALITY_FILE", config_path),
                patch.object(update_housing, "OUTPUT", output_path),
                patch.object(update_housing, "parse_momentum", return_value=[]),
            ):
                self.assertEqual(update_housing.main(), 1)
            self.assertEqual(json.loads(output_path.read_text(encoding="utf-8")), previous)


if __name__ == "__main__":
    unittest.main()
