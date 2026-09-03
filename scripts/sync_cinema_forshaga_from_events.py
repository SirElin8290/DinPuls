#!/usr/bin/env python3
"""Bygg Forshaga Folkets Hus bioprogram från DinPuls verifierade Visit Värmland-evenemang."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
EVENTS = ROOT / "data" / "events.json"
CINEMAS = ROOT / "data" / "cinemas.json"
TZ = ZoneInfo("Europe/Stockholm")
PROGRAM_SOURCE = "https://www.visitvarmland.com/forshaga/evenemang"


def parse_start(event: dict) -> datetime | None:
    date = str(event.get("startDate") or "").strip()
    raw_time = str(event.get("time") or "").strip()
    match = re.match(r"^(\d{2}):(\d{2})", raw_time)
    if not date or not match:
        return None
    try:
        return datetime.fromisoformat(f"{date}T{match.group(1)}:{match.group(2)}:00").replace(tzinfo=TZ)
    except ValueError:
        return None


def extract_films(events: list[dict], now: datetime | None = None) -> list[dict]:
    now = now or datetime.now(TZ)
    grouped: dict[str, dict] = {}
    showtimes: dict[str, list[datetime]] = defaultdict(list)
    for event in events:
        title = str(event.get("title") or "").strip()
        venue = str(event.get("venue") or "").casefold()
        if not title.casefold().startswith("bio:") or "forshaga folkets hus" not in venue:
            continue
        start = parse_start(event)
        if start is None or start < now:
            continue
        film_title = re.sub(r"^bio:\s*", "", title, flags=re.I).strip()
        if not film_title:
            continue
        key = film_title.casefold()
        grouped.setdefault(key, {"title": film_title, "url": str(event.get("url") or PROGRAM_SOURCE)})
        showtimes[key].append(start)

    films: list[dict] = []
    for key, base in grouped.items():
        times = sorted(set(showtimes[key]))
        if not times:
            continue
        labels = [time.strftime("%d/%m %H:%M") for time in times]
        films.append({
            **base,
            "showtimes": [time.isoformat(timespec="minutes") for time in times],
            "label": " · ".join(labels),
        })
    films.sort(key=lambda film: film["showtimes"][0])
    return films


def main() -> int:
    events_data = json.loads(EVENTS.read_text(encoding="utf-8"))
    cinemas_data = json.loads(CINEMAS.read_text(encoding="utf-8"))
    municipality_events = (events_data.get("municipalities", {}).get("Forshaga", {}).get("events") or [])
    films = extract_films(municipality_events)
    if not films:
        print("Forshaga bio: inga verifierade framtida filmvisningar med klockslag; behåller tidigare program.")
        return 0

    venues = cinemas_data.setdefault("municipalities", {}).get("Forshaga") or []
    if not venues:
        raise RuntimeError("Forshaga Folkets Hus saknas i data/cinemas.json")
    cinema = venues[0]
    cinema["films"] = films
    cinema["programSource"] = PROGRAM_SOURCE
    cinema["programCheckedAt"] = datetime.now(TZ).isoformat(timespec="seconds")
    cinema["programStatus"] = "ok"
    CINEMAS.write_text(json.dumps(cinemas_data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Forshaga bio: {len(films)} filmer / {sum(len(f['showtimes']) for f in films)} framtida visningar")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
