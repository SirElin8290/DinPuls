#!/usr/bin/env python3
"""Lägger beständiga verifierade Färgelanda-källor ovanpå genererad lunchdata."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LUNCH = ROOT / "data" / "lunch.json"
SUPPLEMENT = ROOT / "data" / "lunch-fargelanda-supplement.json"


def main() -> int:
    lunch = json.loads(LUNCH.read_text(encoding="utf-8"))
    supplement = json.loads(SUPPLEMENT.read_text(encoding="utf-8"))
    generated_at = lunch.get("generatedAt")

    municipalities = lunch.setdefault("municipalities", {})
    for name, sources in (supplement.get("municipalities") or {}).items():
        entry = municipalities.setdefault(name, {"restaurants": [], "referenceSources": []})
        restaurants = entry.setdefault("restaurants", [])
        by_id = {str(item.get("id")): index for index, item in enumerate(restaurants) if isinstance(item, dict)}
        for source in sources:
            if not isinstance(source, dict):
                continue
            item = {
                **source,
                "checkedAt": generated_at,
                "weekNumber": None,
                "days": {},
                "status": "reference",
                "mode": "reference",
            }
            source_id = str(source.get("id"))
            if source_id in by_id:
                restaurants[by_id[source_id]] = {**restaurants[by_id[source_id]], **item}
            else:
                by_id[source_id] = len(restaurants)
                restaurants.append(item)

        references = entry.setdefault("referenceSources", [])
        seen_urls = {str(item.get("url")) for item in references if isinstance(item, dict)}
        for source in (supplement.get("referenceSources") or {}).get(name, []):
            if isinstance(source, dict) and str(source.get("url")) not in seen_urls:
                references.append(source)
                seen_urls.add(str(source.get("url")))

    LUNCH.write_text(json.dumps(lunch, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    count = len((municipalities.get("Färgelanda") or {}).get("restaurants") or [])
    if count < 4:
        raise SystemExit(f"Färgelanda: endast {count} lunchkällor efter komplettering")
    print(f"Färgelanda: {count} verifierade lunchkällor efter komplettering")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
