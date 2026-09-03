#!/usr/bin/env python3
"""Applicera verifierad, beständig berikning på genererad fritidsdata."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def norm(value: object) -> str:
    return "".join(ch for ch in str(value or "").casefold() if ch.isalnum())


def infer_category(patch: dict) -> tuple[str, str, str, list[str]]:
    text = " ".join(str(patch.get(key, "")) for key in ("name", "activityType", "description", "location")).casefold()
    if any(word in text for word in ("badplats", "badhus", "vandring", "friluft", "cykel", "kanot", "kajak", "sup", "utsikt")):
        return "natur", "Natur, motion & friluftsliv", "Aktivitet", ["friluftsliv"]
    if any(word in text for word in ("idrott", "fotboll", "friidrott", "ishall", "skidor", "utegym", "isrink")):
        return "natur", "Idrott & motion", "Anläggning", ["idrott", "motion"]
    if any(word in text for word in ("fritidsgård", "ungdom")):
        return "gemenskap", "Barn & unga", "Kommunal verksamhet", ["unga", "mötesplats"]
    return "gemenskap", "Fritid & lokal gemenskap", "Aktivitet", ["fritid"]


def main() -> None:
    leisure_path = DATA / "leisure.json"
    enrichment_path = DATA / "leisure-enrichment.json"
    leisure = json.loads(leisure_path.read_text(encoding="utf-8"))
    enrichment = json.loads(enrichment_path.read_text(encoding="utf-8"))
    applied = 0
    added = 0

    for patch in enrichment.get("entries", []):
        municipality = patch.get("municipality")
        name = patch.get("name")
        municipality_payload = leisure.get("municipalities", {}).get(municipality)
        if not municipality_payload:
            raise RuntimeError(f"Okänd kommun i fritidsberikning: {municipality}")
        activities = municipality_payload.setdefault("activities", [])
        target = next((item for item in activities if norm(item.get("name")) == norm(name)), None)
        if not target:
            category, category_label, item_type, tags = infer_category(patch)
            target = {
                "name": name,
                "category": patch.get("category") or category,
                "categoryLabel": patch.get("categoryLabel") or category_label,
                "tags": list(dict.fromkeys([*tags, *(patch.get("tags") or [])])),
                "type": patch.get("type") or item_type,
                "url": patch.get("url") or (patch.get("source") or {}).get("url") or ""
            }
            activities.append(target)
            added += 1

        for key, value in patch.items():
            if key in {"municipality", "name", "category", "categoryLabel", "type"}:
                continue
            if key == "tags":
                target["tags"] = list(dict.fromkeys([*(target.get("tags") or []), *(value or [])]))
            else:
                target[key] = value
        applied += 1

    leisure_path.write_text(json.dumps(leisure, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Applicerade verifierad fritidsberikning på {applied} poster, varav {added} nya.")


if __name__ == "__main__":
    main()
