import importlib.util
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("update_deviations", Path(__file__).with_name("update_deviations.py"))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

class DeviationUpdateTests(unittest.TestCase):
    def setUp(self): self.municipality = {"name": "Åmål", "code": "1492"}
    def test_trade_hours_remain_general(self):
        source = {"name": "Åmål Handel", "url": "https://example.test", "scope": "general"}
        items = MODULE.amal_trade_recommended_hours("Rekommenderade öppettider Avvikande öppettider 31 oktober 10 - 20", source, self.municipality, date(2026, 9, 17))
        self.assertTrue(items); self.assertTrue(all(item["scope"] == "general" and item["affectedEntity"] is None for item in items)); self.assertIn("kontrollera alltid", items[0]["description"].lower())
    def test_specific_closure_and_expiry(self):
        source = {"name": "Åmåls kommun", "url": "https://example.test", "scope": "specific", "affectedEntity": "Åmåls simhall"}
        items = MODULE.amal_simhall_closures("24/12-2026 Stängt 01/01-2027 Stängt", source, self.municipality, date(2026, 9, 17))
        self.assertEqual(len(items), 2); self.assertTrue(all(item["scope"] == "specific" for item in items))
    def test_source_failure_keeps_only_unexpired_data(self):
        config = {"leadTimeDays": 14, "municipalities": {"1492": {"name": "Åmål", "sources": [{"id": "x", "adapter": "amal_trade_recommended_hours", "name": "Källa", "url": "https://example.test", "scope": "general"}]}}}
        previous = {"municipalities": {"1492": {"items": [{"sourceUrl": "https://example.test", "validFrom": "2026-09-17T00:00:00Z", "validUntil": "2026-09-18T23:59:59Z", "priority": 50, "title": "behåll"}, {"sourceUrl": "https://example.test", "validFrom": "2026-09-15T00:00:00Z", "validUntil": "2026-09-16T23:59:59Z", "priority": 50, "title": "ta bort"}]}}}
        result = MODULE.update(config, previous, datetime(2026, 9, 17, tzinfo=timezone.utc), lambda _: (_ for _ in ()).throw(RuntimeError("down")))
        self.assertEqual([item["title"] for item in result["municipalities"]["1492"]["items"]], ["behåll"])

if __name__ == "__main__": unittest.main()
