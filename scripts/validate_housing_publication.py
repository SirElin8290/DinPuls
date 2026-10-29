"""Block malformed data, but isolate source/freshness failures per municipality."""
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def validate(data, names, now=None):
    now = now or datetime.now(timezone.utc)
    rows = data.get("municipalities", {})
    assert set(rows) == set(names), "Bostadskommuner saknas eller är felaktiga"
    warnings = []
    for name in names:
        row = rows[name]
        items = row.get("listings")
        assert isinstance(items, list), f"{name}: bostadslista saknas"
        assert row.get("total") == len(items) or (row.get("availabilityMode") == "official-reference" and row.get("total") is None), f"{name}: total matchar inte listan"
        assert all(item.get("url") and item.get("address") for item in items), f"{name}: objekt saknar adress eller källänk"
        assert len({(item.get('provider'), item.get('id') or item['url']) for item in items}) == len(items), f"{name}: dubbletter"
        try:
            stamp = datetime.fromisoformat((row.get("checkedAt") or row.get("updatedAt") or "").replace("Z", "+00:00"))
            if stamp.tzinfo is None:
                stamp = stamp.replace(tzinfo=timezone.utc)
            old = (now - stamp).total_seconds() > 12 * 3600
        except ValueError:
            old = True
        failed = row.get("errors") or row.get("stale") or any(item.get("status") != "ok" for item in row.get("sourceHealth", []))
        if failed or old:
            row["stale"] = True
            warnings.append(name)
    return warnings


if __name__ == "__main__":
    path = ROOT / "data/housing.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    config = json.loads((ROOT / "data/municipalities.json").read_text(encoding="utf-8"))
    warnings = validate(data, [item["name"] for item in config["municipalities"]])
    for name in warnings:
        print(f"::warning::{name}: bostadskällan behöver kontroll; senaste data är markerad stale")
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"21 kommuner kontrollerade, {len(warnings)} med särredovisad källvarning")
