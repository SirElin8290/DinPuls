#!/usr/bin/env python3
"""Applicera verifierad, beständig berikning på genererad fritidsdata."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def norm(value: object) -> str:
    return "".join(ch for ch in str(value or "").casefold() if ch.isalnum())


def main() -> None:
    leisure_path = DATA / "leisure.json"
    enrichment_path = DATA / "leisure-enrichment.json"
    leisure = json.loads(leisure_path.read_text(encoding="utf-8"))
    enrichment = json.loads(enrichment_path.read_text(encoding="utf-8"))
    applied = 0
    missing = []

    for patch in enrichment.get("entries", []):
        municipality = patch.get("municipality")
        name = patch.get("name")
        activities = leisure.get("municipalities", {}).get(municipality, {}).get("activities", [])
        target = next((item for item in activities if norm(item.get("name")) == norm(name)), None)
        if not target:
            missing.append(f"{municipality}: {name}")
            continue

        for key, value in patch.items():
            if key in {"municipality", "name"}:
                continue
            if key == "tags":
                target["tags"] = list(dict.fromkeys([*(target.get("tags") or []), *(value or [])]))
            else:
                target[key] = value
        applied += 1

    if missing:
        raise RuntimeError("Berikningsposter saknas i importerad fritidsdata: " + "; ".join(missing))

    leisure_path.write_text(json.dumps(leisure, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Applicerade verifierad fritidsberikning på {applied} poster.")


if __name__ == "__main__":
    main()
