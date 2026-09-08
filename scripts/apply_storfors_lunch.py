#!/usr/bin/env python3
"""Lägger in verifierade Storfors-lunchställen efter ordinarie lunchgenerator."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LUNCH = ROOT / "data" / "lunch.json"
SUPPLEMENT = ROOT / "data" / "lunch-storfors-supplement.json"


def main() -> int:
    data = json.loads(LUNCH.read_text(encoding="utf-8"))
    supplement = json.loads(SUPPLEMENT.read_text(encoding="utf-8"))
    municipality = supplement["municipality"]
    row = data.setdefault("municipalities", {}).setdefault(municipality, {})
    restaurants = [item for item in row.get("restaurants", []) if isinstance(item, dict)]
    by_id = {str(item.get("id") or item.get("name") or "").casefold(): item for item in restaurants}
    for item in supplement.get("restaurants") or []:
        key = str(item.get("id") or item.get("name") or "").casefold()
        if key:
            by_id[key] = item
    row["restaurants"] = list(by_id.values())
    row["referenceSources"] = supplement.get("referenceSources") or row.get("referenceSources") or []
    row["sourceChecked"] = supplement.get("sourceChecked")
    LUNCH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Storfors: {len(row['restaurants'])} verifierade lunchställen")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
