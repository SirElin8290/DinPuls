import io
import json
import unittest
from datetime import datetime, timezone
from urllib.error import HTTPError

import check_system_health as health


class Response(io.BytesIO):
    status = 200
    def __enter__(self): return self
    def __exit__(self, *_): self.close()


def payloads(empty_module=None, verified_zero=False):
    now = "2026-09-10T12:00:00+00:00"
    names = ["Storfors"] + [f"Kommun {index}" for index in range(20)]
    common = {"generatedAt": now, "municipalities": {name: {} for name in names}}
    data = {"municipalities.json": {"municipalities": [{"name": name} for name in names]}}
    for module, (filenames, _) in health.MODULES.items():
        for file_index, filename in enumerate(filenames):
            value = json.loads(json.dumps(common))
            for name in names:
                row = value["municipalities"][name]
                if file_index:
                    continue
                if module == "news": value.setdefault("articles", []).append({"municipalities": [name]})
                elif module == "jobs": row["jobs"] = [{}]
                elif module == "housing": row["listings"] = [{}]
                elif module == "events": row["events"] = [{}]
                elif module == "weather": row["nowcast"] = {"current": {"time": now}}
                elif module == "lunch": row["restaurants"] = [{}]
                elif module == "health": value.setdefault("providers", []).append({"municipality": name})
                elif module == "service": value.setdefault("businesses", []).append({"municipality": name})
                elif module == "cinema": value["municipalities"][name] = [{}]
                elif module == "leisure": row["activities"] = [{}]
                elif module == "sports": row["clubs"] = [{}]
            data[filename] = value
    if empty_module:
        filename = health.MODULES[empty_module][0][0]
        if empty_module == "lunch":
            row = data[filename]["municipalities"]["Storfors"]
            row["restaurants"] = []
            if verified_zero:
                row.update(actualSupplyVerified=True, actualLocalLunchSupply=0)
    return data


def opener_for(data, broken=None, invalid=None):
    def open_url(request, timeout=0):
        filename = request.full_url.split("/")[-1].split("?")[0]
        if filename == broken:
            raise HTTPError(request.full_url, 404, "Not Found", {}, None)
        body = b"not json" if filename == invalid else json.dumps(data[filename]).encode()
        return Response(body)
    return open_url


class SystemHealthTests(unittest.TestCase):
    now = datetime(2026, 9, 10, 12, tzinfo=timezone.utc)

    def test_green_data_and_all_municipalities(self):
        data = payloads()
        result = health.build_health("https://example.test/data", self.now, opener_for(data))
        self.assertEqual(len(result["municipalities"]), 21)
        self.assertEqual(result["summary"], {"green": 231, "warning": 0, "critical": 0})

    def test_404_is_critical(self):
        data = payloads()
        result = health.build_health("https://example.test/data", self.now, opener_for(data, broken="jobs.json"))
        self.assertEqual(result["municipalities"]["Storfors"]["jobs"]["status"], "critical")

    def test_invalid_json_is_critical(self):
        data = payloads()
        result = health.build_health("https://example.test/data", self.now, opener_for(data, invalid="events.json"))
        self.assertEqual(result["municipalities"]["Storfors"]["events"]["status"], "critical")

    def test_required_empty_data_is_critical(self):
        data = payloads("lunch")
        result = health.build_health("https://example.test/data", self.now, opener_for(data))
        self.assertEqual(result["municipalities"]["Storfors"]["lunch"]["reason"], "zero_records")

    def test_verified_actual_zero_does_not_alarm(self):
        data = payloads("lunch", verified_zero=True)
        result = health.build_health("https://example.test/data", self.now, opener_for(data))
        self.assertEqual(result["municipalities"]["Storfors"]["lunch"]["status"], "green")


if __name__ == "__main__":
    unittest.main()
