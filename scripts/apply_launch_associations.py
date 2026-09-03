#!/usr/bin/env python3
"""Merge verified launch associations into generated sports/leisure data.

Supplements are additive: automated association imports remain authoritative and
future imported entries replace the need for manual launch coverage without creating
duplicates.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SUPPLEMENTS = (
    DATA / "association-launch-supplement.json",
    DATA / "association-priority-supplement.json",
    DATA / "association-wave2-supplement.json",
    DATA / "association-wave3-supplement.json",
    DATA / "association-wave4-supplement.json",
    DATA / "association-forshaga-supplement.json",
    DATA / "association-enrichment-prerequisites.json",
)


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def normalized_name(value: object) -> str:
    return " ".join(str(value or "").casefold().split())


def merge_named(existing: list[dict], supplemental: list[dict]) -> list[dict]:
    """Keep generated/curated item when names collide; add verified missing items."""
    result = [dict(item) for item in existing if isinstance(item, dict)]
    seen = {normalized_name(item.get("name")) for item in result}
    for item in supplemental:
        if not isinstance(item, dict):
            continue
        key = normalized_name(item.get("name"))
        if not key or key in seen:
            continue
        result.append(dict(item))
        seen.add(key)
    return sorted(result, key=lambda item: str(item.get("name") or "").casefold())


def main() -> None:
    sports_path = DATA / "sports.json"
    leisure_path = DATA / "leisure.json"
    sports = load(sports_path)
    leisure = load(leisure_path)

    merged_municipalities: dict[str, dict] = {}
    for supplement_path in SUPPLEMENTS:
        if not supplement_path.exists():
            continue
        supplement = load(supplement_path)
        for municipality, extra in (supplement.get("municipalities") or {}).items():
            merged = merged_municipalities.setdefault(
                municipality,
                {"directoryUrl": extra.get("directoryUrl", ""), "clubs": [], "activities": []},
            )
            if extra.get("directoryUrl") and not merged.get("directoryUrl"):
                merged["directoryUrl"] = extra["directoryUrl"]
            merged["clubs"] = merge_named(merged.get("clubs") or [], extra.get("clubs") or [])
            merged["activities"] = merge_named(merged.get("activities") or [], extra.get("activities") or [])

    for municipality, extra in merged_municipalities.items():
        sport_entry = (sports.setdefault("municipalities", {})).setdefault(
            municipality,
            {"directoryUrl": extra.get("directoryUrl", ""), "clubs": [], "liveSources": []},
        )
        leisure_entry = (leisure.setdefault("municipalities", {})).setdefault(
            municipality,
            {"directoryUrl": extra.get("directoryUrl", ""), "activities": []},
        )
        if extra.get("directoryUrl"):
            sport_entry["directoryUrl"] = sport_entry.get("directoryUrl") or extra["directoryUrl"]
            leisure_entry["directoryUrl"] = leisure_entry.get("directoryUrl") or extra["directoryUrl"]
        sport_entry["clubs"] = merge_named(sport_entry.get("clubs") or [], extra.get("clubs") or [])
        leisure_entry["activities"] = merge_named(leisure_entry.get("activities") or [], extra.get("activities") or [])

    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    sports["generatedAt"] = now
    leisure["updatedAt"] = now
    sports_path.write_text(json.dumps(sports, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    leisure_path.write_text(json.dumps(leisure, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    missing = []
    for municipality in merged_municipalities:
        if not (sports["municipalities"][municipality].get("clubs") or []):
            missing.append(f"{municipality}: sport")
        if not (leisure["municipalities"][municipality].get("activities") or []):
            missing.append(f"{municipality}: fritid")
    if missing:
        raise SystemExit("Launch association merge failed: " + ", ".join(missing))
    print(f"Launch association coverage verified for {len(merged_municipalities)} municipalities")


if __name__ == "__main__":
    main()
