import json, unittest
from datetime import datetime
from urllib.error import HTTPError
from zoneinfo import ZoneInfo
import update_energy as energy

STOCKHOLM = ZoneInfo("Europe/Stockholm")

def payload(day, value=0.25):
    start = datetime(day.year, day.month, day.day, tzinfo=STOCKHOLM)
    rows = []
    for index in range(96):
        a = start.timestamp() + index * 900
        b = a + 900
        rows.append({"SEK_per_kWh": value if index else -0.1, "time_start": datetime.fromtimestamp(a, STOCKHOLM).isoformat(), "time_end": datetime.fromtimestamp(b, STOCKHOLM).isoformat()})
    return rows

class EnergyUpdaterTests(unittest.TestCase):
    now = datetime(2026, 9, 28, 12, tzinfo=STOCKHOLM)
    def test_all_areas_units_negative_and_optional_tomorrow(self):
        def fetcher(url):
            if "09-29" in url: raise HTTPError(url, 404, "missing", {}, None)
            return payload(self.now.date())
        result = energy.build_energy(self.now, fetcher)
        self.assertEqual(set(result["areas"]), set(energy.AREAS))
        self.assertEqual(result["unit"], "öre/kWh")
        self.assertEqual(result["areas"]["SE3"]["periods"][0]["orePerKwh"], -10.0)
        self.assertIsNone(result["areas"]["SE3"]["tomorrow"])
    def test_invalid_json_and_missing_today_fail(self):
        for broken in ({}, [], [{"SEK_per_kWh": "bad"}]):
            with self.assertRaises(ValueError): energy.normalize_periods(broken, self.now.date(), "SE3")
        with self.assertRaises(HTTPError):
            energy.build_energy(self.now, lambda url: (_ for _ in ()).throw(HTTPError(url, 500, "fail", {}, None)))

if __name__ == "__main__": unittest.main()
