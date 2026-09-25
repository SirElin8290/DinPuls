#!/usr/bin/env python3
"""Applicera källverifierade föreningsberikningar utan att skriva över bättre data."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

from association_quality import quality

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BATCH = DATA / "association-enrichment.json"


def norm(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode().casefold()
    return re.sub(r"[^a-z0-9]+", "", text).replace("brukshundsklubb", "brukshundklubb")


def generic_url(value: object) -> bool:
    text = str(value or "").casefold()
    return not text or "associationregister" in text


def merge(item: dict, patch: dict) -> int:
    changes = 0
    for key, value in patch.items():
        if key in {"name", "municipality", "dataset"} or value in (None, "", []):
            continue
        if key in {"contact", "social"}:
            current = item.setdefault(key, {})
            for child_key, child_value in value.items():
                if child_value and not current.get(child_key):
                    current[child_key] = child_value
                    changes += 1
        elif key in {"tags", "targetAudience", "sourcesProcessed"}:
            current = item.setdefault(key, [])
            known = {str(entry).casefold() for entry in current}
            for entry in value:
                if str(entry).casefold() not in known:
                    current.append(entry)
                    known.add(str(entry).casefold())
                    changes += 1
        elif key == "url":
            if generic_url(item.get("url")):
                item[key] = value
                changes += 1
        elif key == "source":
            current_source = item.get(key)
            current_text = json.dumps(current_source, ensure_ascii=False) if current_source else ""
            if not current_source or "Masterdokument" in current_text or "AssociationRegister" in current_text:
                item[key] = value
                changes += 1
        elif not item.get(key):
            item[key] = value
            changes += 1
    new_quality = quality(item)
    if item.get("dataQuality") != new_quality:
        item["dataQuality"] = new_quality
        changes += 1
    return changes


def apply(path: Path, entries: list[dict]) -> tuple[int, int]:
    data = json.loads(path.read_text(encoding="utf-8"))
    matched = changes = 0
    path_dataset = "sport" if path.name.startswith("sports") else "leisure"
    for entry in entries:
        if entry["dataset"] != path_dataset:
            continue
        municipality = entry["municipality"]
        key = "clubs" if entry["dataset"] == "sport" else "activities"
        items = data["municipalities"][municipality][key]
        item = next((row for row in items if norm(row.get("name")) == norm(entry["name"])), None)
        if not item:
            continue
        matched += 1
        changes += merge(item, entry)
    touched_municipalities = {entry["municipality"] for entry in entries if entry["dataset"] == path_dataset}
    for municipality, municipality_data in data.get("municipalities", {}).items():
        if municipality not in touched_municipalities:
            continue
        for key in ("activities", "clubs"):
            for item in municipality_data.get(key, []):
                item["dataQuality"] = quality(item)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return matched, changes


def main() -> None:
    entries = json.loads(BATCH.read_text(encoding="utf-8"))["entries"]
    total = {"entries": len(entries), "matched": 0, "changes": 0}
    for filename in ("leisure.json", "leisure-curated.json", "sports.json", "sports-curated.json"):
        matched, changes = apply(DATA / filename, entries)
        if filename in {"leisure.json", "sports.json"}:
            total["matched"] += matched
            total["changes"] += changes
    print(json.dumps(total, ensure_ascii=False))


if __name__ == "__main__":
    main()
