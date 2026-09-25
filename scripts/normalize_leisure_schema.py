#!/usr/bin/env python3
"""Normalisera fritidsposters obligatoriska renderingsfält efter alla importer."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data" / "leisure.json"
VALID_CATEGORIES = {"djur", "gemenskap", "kultur", "musik", "natur", "skapande", "spel"}

data = json.loads(PATH.read_text(encoding="utf-8"))
changed = 0
for payload in data["municipalities"].values():
    for item in payload["activities"]:
        if item.get("category") not in VALID_CATEGORIES:
            item["category"] = "gemenskap"
            changed += 1
        if not item.get("tags"):
            item["tags"] = ["förening"]
            changed += 1
        if isinstance(item.get("source"), str):
            item["source"] = {"label": item["source"]}
            changed += 1

PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Normaliserade {changed} fritidsfält.")
