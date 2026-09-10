import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import update_housing


class HousingUpdateTests(unittest.TestCase):
    def test_munkfors_parser_requires_declared_count_to_match_cards(self):
        markup = '''<h1>Lediga lägenheter</h1>
        <h3><strong>Lediga lägenheter</strong> <strong>[1 st]</strong></h3>
        <p class="has-background"><strong>Adress:</strong> Testvägen 1, lägenhet 1001<br>
        <strong>Månadshyra:</strong> 5 100 kr/mån<br><strong>Storlek:</strong> 2 RoK<br>
        <strong>Bostadsyta:</strong> 55 m<sup>2</sup><br><strong>Tillträde:</strong> ledig<br>
        <strong>Ingår:</strong> förråd</p>'''
        with patch.object(update_housing, "fetch", return_value=markup.encode()):
            result = update_housing.parse_munkfors({"name": "Munkforsbostäder", "url": "https://example.test"})
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["rent"], 5100)

    def test_vitec_public_filter_keeps_only_configured_municipality(self):
        payload = {"data": json.dumps([
            {"Id": "1", "Adress1": "A 1", "Adress3": "Säffle", "DetailsUrl": "/1"},
            {"Id": "2", "Adress1": "B 2", "Adress3": "Karlstad", "DetailsUrl": "/2"},
        ])}
        provider = {"name": "Albèr", "url": "https://example.test/ledigt", "dataUrl": "https://example.test/api", "municipality": "Säffle"}
        with patch.object(update_housing, "fetch", return_value=json.dumps(payload).encode()):
            result = update_housing.parse_arvika(provider)
        self.assertEqual([row["id"] for row in result], ["1"])

    def test_torsby_municipal_parser_reads_current_rows(self):
        markup = '''<h1>Lediga lägenheter hos kommunen</h1><p>Här ser du vilka lägenheter som är lediga just nu.</p>
        <p>Testvägen 1, 2 r.o.k, 63 m², 5 307 kr/månad. Ledig 2026-10-01</p>
        <p>Senast genomgången: 2026-09-10</p>'''
        with patch.object(update_housing, "visible_content", return_value=(
            ["Lediga lägenheter hos kommunen", "Testvägen 1, 2 r.o.k, 63 m², 5 307 kr/månad. Ledig 2026-10-01", "Senast genomgången:"], [])):
            result = update_housing.parse_torsby_municipal({"name": "Torsby kommun", "url": "https://example.test"})
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["size"], 63)

    def test_cross_provider_dedupe_normalizes_address_but_keeps_distinct_units(self):
        rows = [
            {"id": "primary", "provider": "Primary", "address": "Testgatan 1 A", "rooms": 2, "size": 60, "rent": 6000},
            {"id": "copy", "provider": "Aggregator", "address": "Testgatan 1A", "rooms": 2, "size": 60, "rent": 6000},
            {"id": "other", "provider": "Primary", "address": "Testgatan 1 A", "rooms": 3, "size": 75, "rent": 7000},
        ]
        result = update_housing.deduplicate_listings(rows)
        self.assertEqual([row["id"] for row in result], ["primary", "other"])

    def test_strandell_expands_explicit_unit_counts(self):
        markup = """
        <main>Följande lägenheter finns nu att söka: sex st 2 rok samt tre st 3 rok
        med tillgång till hiss på Blombackavägen 4B. 5 ROK och 137 kvm stor våning i
        Gamla Sparbankshuset, Allégatan 17 i Filipstad. Ledig 2027-08-01.
        Varmhyra 13 572 kr/mån.</main>
        """
        with patch.object(update_housing, "fetch", return_value=markup.encode()):
            result = update_housing.parse_strandell({"name": "Strandell", "url": "https://example.test/ledigt"})
        self.assertEqual(len(result), 10)
        self.assertEqual(sum(row["rooms"] == 2 for row in result), 6)
        self.assertEqual(result[-1]["rent"], 13572)

    def test_podium_requires_card_count_to_match_detail_links(self):
        markup = """
        <a href="https://example.test/ledigt/one/"><span>1 RKV Filipstad – 36 m</span><sup>2</sup></a>
        <span>Filipstad</span><span>-</span><span>Hyra:</span><span>4 479 kr/mån</span>
        <span>Adress:</span><span>Stora Torget 3 D</span><span>Inflyttning:</span><span>Enl ök</span>
        """
        with patch.object(update_housing, "fetch", return_value=markup.encode()):
            result = update_housing.parse_podium({"name": "Podium", "url": "https://example.test/ledigt/"})
        self.assertEqual(result[0]["address"], "Stora Torget 3 D")
        self.assertEqual(result[0]["rent"], 4479)

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
            "count": 1,
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

    def test_momentum_fetches_every_page_and_checks_total(self):
        settings = {"apiBaseUrl": "https://api.example/", "xApiKey": "key", "appInstanceId": "client", "appVersion": "1"}
        first = {"count": 101, "items": [{"id": str(i), "displayName": f"Gatan {i}"} for i in range(100)]}
        second = {"count": 101, "items": [{"id": "100", "displayName": "Gatan 100"}]}
        provider = {"name": "Testbostäder", "url": "https://homes.example/market/residential"}
        with patch.object(update_housing, "fetch_json_url", side_effect=[settings, first, second]) as fetcher:
            listings = update_housing.parse_momentum(provider)
        self.assertEqual(len(listings), 101)
        self.assertIn("offset=100", fetcher.call_args_list[-1].args[0])

    def test_homeq_company_filters_to_configured_municipality(self):
        payload = {"results": [
            {"id": 1, "municipality": "Grums", "city": "Slottsbron", "title": "Testgatan 1",
             "rooms": 2, "area": 61, "rent": 6500, "date_access": "2026-10-01",
             "uri": "/lagenhet/1-testgatan"},
            {"id": 2, "municipality": "Karlstad", "city": "Karlstad", "title": "Annan gata 2",
             "rooms": 3, "area": 70, "rent": 8000, "uri": "/lagenhet/2-annan"},
        ]}
        provider = {"name": "Akka", "url": "https://example.test/ledigt", "parser": "homeq-company",
                    "companyId": "344", "municipality": "Grums"}
        with patch.object(update_housing, "post_json_url", return_value=payload) as fetcher:
            listings = update_housing.parse_homeq_company(provider)
        self.assertEqual(len(listings), 1)
        self.assertEqual(listings[0]["id"], "1")
        self.assertEqual(listings[0]["area"], "Slottsbron")
        self.assertEqual(fetcher.call_args.args[1], {"company": "344"})

    def test_orvelin_verifies_zero_when_public_inventory_has_no_local_residential_objects(self):
        payload = {"data": {"allRentable": {"edges": [{"node": {
            "slug": "office", "type": "Kontor", "space": 50,
            "property": {"title": "Kontoret", "city": "Bengtsfors", "address": "Gatan 1",
                         "zipCode": "666 00", "category": "Kommersiellt"},
        }}]}}}
        provider = {"name": "Orvelin", "url": "https://orvelin.example/", "municipality": "Bengtsfors"}
        with patch.object(update_housing, "post_json_url", return_value=payload):
            self.assertEqual(update_housing.parse_orvelin_residential(provider), [])

    def test_willhem_resolves_city_and_returns_all_objects(self):
        landing = {"data": {"regionPages": [{"name": "Karlstad", "contentLink": {"id": 6010}}]}}
        result = {"data": {"realEstates": [{
            "street": "Testgatan 1", "access": "2026-10-01", "rooms": 2,
            "rentMin": 7000, "url": "/sok-bostad/Karlstad/testgatan-1/",
            "trackingData": {"id": "42", "city": "Karlstad", "area": "62"},
        }]}}
        provider = {"name": "Willhem", "url": "https://www.willhem.se/sok-bostad/Karlstad/", "municipality": "Karlstad"}
        with patch.object(update_housing, "fetch_json_url", side_effect=[landing, result]) as fetcher:
            listings = update_housing.parse_willhem(provider)
        self.assertEqual(len(listings), 1)
        self.assertEqual(listings[0]["id"], "42")
        self.assertEqual(listings[0]["size"], 62)
        self.assertEqual(fetcher.call_args_list[-1].args[1]["x-page-id"], "6010")

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

    def test_failed_provider_keeps_its_previous_rows_when_peer_provider_succeeds(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_path = root / "municipalities.json"
            output_path = root / "housing.json"
            providers = [
                {"name": "Fresh", "url": "https://fresh.example", "parser": "momentum"},
                {"name": "Flaky", "url": "https://flaky.example", "parser": "momentum"},
            ]
            config_path.write_text(json.dumps({"municipalities": [{"name": "Torsby", "housingProviders": providers}]}), encoding="utf-8")
            old = {"id": "old", "provider": "Flaky", "address": "Gamla vägen 1", "url": "https://flaky.example/old"}
            output_path.write_text(json.dumps({"municipalities": {"Torsby": {"total": 1, "listings": [old], "providers": []}}}), encoding="utf-8")
            fresh = {"id": "new", "provider": "Fresh", "address": "Nya vägen 2", "url": "https://fresh.example/new"}
            with (
                patch.object(update_housing, "MUNICIPALITY_FILE", config_path),
                patch.object(update_housing, "OUTPUT", output_path),
                patch.object(update_housing, "parse_momentum", side_effect=[[fresh], RuntimeError("timeout")]),
            ):
                self.assertEqual(update_housing.main("Torsby"), 0)
            result = json.loads(output_path.read_text(encoding="utf-8"))["municipalities"]["Torsby"]
            self.assertEqual({row["id"] for row in result["listings"]}, {"new", "old"})
            self.assertTrue(next(row for row in result["sourceHealth"] if row["provider"] == "Flaky")["stale"])

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

    def test_single_municipality_mode_preserves_every_other_entry(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_path = root / "municipalities.json"
            output_path = root / "housing.json"
            provider = {"name": "A-bostäder", "url": "https://a.example", "parser": "momentum", "official": True}
            config_path.write_text(json.dumps({"municipalities": [
                {"name": "A", "housingProviders": [provider]},
                {"name": "B", "housingProviders": []},
            ]}), encoding="utf-8")
            untouched = {"total": 7, "listings": [{"id": "keep"}], "providers": []}
            output_path.write_text(json.dumps({"municipalities": {
                "A": {"total": 0, "listings": [], "providers": []}, "B": untouched,
            }}), encoding="utf-8")
            with (
                patch.object(update_housing, "MUNICIPALITY_FILE", config_path),
                patch.object(update_housing, "OUTPUT", output_path),
                patch.object(update_housing, "parse_momentum", return_value=[{
                    "id": "new", "address": "Nya vägen 1", "url": "https://a.example/new", "provider": "A-bostäder",
                }]),
            ):
                self.assertEqual(update_housing.main("A"), 0)
            result = json.loads(output_path.read_text(encoding="utf-8"))["municipalities"]
            self.assertEqual(result["B"], untouched)
            self.assertEqual(result["A"]["total"], 1)


if __name__ == "__main__":
    unittest.main()
