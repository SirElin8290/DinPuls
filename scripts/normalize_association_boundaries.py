#!/usr/bin/env python3
"""Flytta uppenbara idrottsföreningar från Fritid till Idrott efter import.

Detta är ett skyddsnät för kommunregister vars kategorier är otydliga. Målet är
att samma modulgräns ska gälla automatiskt när nya kommuner läggs till.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEISURE_PATH = ROOT / "data" / "leisure.json"
SPORTS_PATH = ROOT / "data" / "sports.json"

SPORT_HINTS = {
    "Airsoft": ("airsoft",),
    "Paintball": ("paintball",),
    "Padel": ("padel",),
    "Skateboard": ("skateboard", "skateförening"),
    "Skolidrott": ("skolidrott",),
    "Parasport": ("parasport",),
    "Båtsport": ("båtklubb", "segelklubb", "segelsällskap"),
    "Brukshund": ("brukshund",),
}


def sport_for(activity: dict) -> list[str]:
    text = " ".join(
        str(activity.get(field) or "")
        for field in ("name", "categoryLabel", "type", "description")
    ).casefold()
    text += " " + " ".join(str(value) for value in activity.get("tags", [])).casefold()
    return [sport for sport, hints in SPORT_HINTS.items() if any(hint in text for hint in hints)]


def main() -> None:
    leisure = json.loads(LEISURE_PATH.read_text(encoding="utf-8"))
    sports = json.loads(SPORTS_PATH.read_text(encoding="utf-8"))
    moved = 0

    for municipality, leisure_data in leisure.get("municipalities", {}).items():
        sport_data = sports.setdefault("municipalities", {}).setdefault(
            municipality, {"clubs": [], "liveSources": []}
        )
        clubs = sport_data.setdefault("clubs", [])
        club_names = {str(item.get("name", "")).strip().casefold() for item in clubs}
        kept = []

        for activity in leisure_data.get("activities", []):
            detected = sport_for(activity)
            if not detected:
                kept.append(activity)
                continue
            name = str(activity.get("name", "")).strip()
            if name and name.casefold() not in club_names:
                clubs.append({
                    "name": name,
                    "sports": detected,
                    "url": activity.get("url"),
                    "source": f"{municipality} föreningsregister",
                })
                club_names.add(name.casefold())
            moved += 1
        leisure_data["activities"] = kept
        clubs.sort(key=lambda item: str(item.get("name", "")).casefold())

    LEISURE_PATH.write_text(json.dumps(leisure, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    SPORTS_PATH.write_text(json.dumps(sports, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Flyttade {moved} uppenbara idrottsposter från Fritid till Idrott.")


if __name__ == "__main__":
    main()
