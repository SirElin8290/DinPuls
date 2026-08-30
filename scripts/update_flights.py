#!/usr/bin/env python3
"""Bygg regionala flygavgångar för DinPuls från officiellt publicerade tidtabeller.

Flyg visas för alla DinPuls-kommuner. Uppgifterna är tidtabellstider, inte
påstådd realtid. Karlstad, Hagfors och Torsby ingår.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "flights.json"
STOCKHOLM = ZoneInfo("Europe/Stockholm")

AIRPORTS = [
    {
        "id": "KSD",
        "name": "Karlstad Airport",
        "sourceUrl": "https://www.ksdarprt.se/resmal/tidtabeller/",
    },
    {
        "id": "HFS",
        "name": "Hagfors Airport",
        "sourceUrl": "https://www.hagfors.se/undersidor/trafik-och-infrastruktur/hagfors-airport.html",
    },
    {
        "id": "TYF",
        "name": "Torsby flygplats",
        "sourceUrl": "https://torsby.se/torsbyflygplats/torsbyflygplats/tidtabell.4.5ab966ab193901545fff61a.html",
    },
]


def add_departure(items, airport, date, hhmm, destination, flight, operator, source_url):
    hour, minute = map(int, hhmm.split(":"))
    departure = datetime(date.year, date.month, date.day, hour, minute, tzinfo=STOCKHOLM)
    items.append({
        "mode": "flight",
        "airport": airport,
        "direction": destination,
        "line": flight,
        "operator": operator,
        "scheduled": departure.isoformat(),
        "realtime": departure.isoformat(),
        "delayMinutes": 0,
        "isRealtime": False,
        "canceled": False,
        "platform": "",
        "sourceUrl": source_url,
    })


def is_weekday(date):
    return date.weekday() < 5


def generate_karlstad(date, items):
    source = AIRPORTS[0]["sourceUrl"]
    weekday = date.weekday()
    # Officiell reguljärtidtabell 2026: vardagar + söndagar.
    if weekday < 5:
        add_departure(items, "Karlstad Airport", date, "06:15", "Köpenhamn Kastrup", "OJ600", "Sola Air", source)
        add_departure(items, "Karlstad Airport", date, "13:45", "Stockholm Arlanda", "", "Sola Air", source)
        add_departure(items, "Karlstad Airport", date, "16:30", "Köpenhamn Kastrup", "OJ610", "Sola Air", source)
    elif weekday == 6:
        add_departure(items, "Karlstad Airport", date, "13:45", "Stockholm Arlanda", "", "Sola Air", source)
        add_departure(items, "Karlstad Airport", date, "16:30", "Köpenhamn Kastrup", "OJ610", "Sola Air", source)

    # Mallorca 2026: tisdagar 4 aug–6 okt. Officiell avgångstavla visar 16:30.
    if weekday == 1 and datetime(2026, 8, 4).date() <= date <= datetime(2026, 10, 6).date():
        add_departure(items, "Karlstad Airport", date, "16:30", "Palma de Mallorca", "", "Sunclass Airlines", source)


def generate_hagfors_torsby(date, items):
    # Jonair trafikerar helgfria vardagar. Sommaruppehållet 2026 slutade 12 augusti.
    if not is_weekday(date):
        return
    if datetime(2026, 6, 29).date() <= date <= datetime(2026, 8, 12).date():
        return

    hagfors_source = AIRPORTS[1]["sourceUrl"]
    torsby_source = AIRPORTS[2]["sourceUrl"]
    add_departure(items, "Torsby flygplats", date, "06:05", "Stockholm Arlanda via Hagfors", "JON51", "Jonair", torsby_source)
    add_departure(items, "Torsby flygplats", date, "16:30", "Stockholm Arlanda via Hagfors", "JON53", "Jonair", torsby_source)
    add_departure(items, "Hagfors Airport", date, "06:40", "Stockholm Arlanda", "JON51", "Jonair", hagfors_source)
    add_departure(items, "Hagfors Airport", date, "17:00", "Stockholm Arlanda", "JON53", "Jonair", hagfors_source)


def main():
    now = datetime.now(STOCKHOLM)
    items = []
    # Sju dygn ger en användbar regional avgångstavla även under helg.
    for offset in range(0, 7):
        date = (now + timedelta(days=offset)).date()
        generate_karlstad(date, items)
        generate_hagfors_torsby(date, items)

    items = [item for item in items if datetime.fromisoformat(item["scheduled"]) >= now - timedelta(minutes=2)]
    items.sort(key=lambda item: item["scheduled"])

    output = {
        "version": "1.0.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Officiella flygplatstidtabeller",
        "realtime": False,
        "regional": True,
        "airports": AIRPORTS,
        "departures": items,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Skrev {len(items)} regionala flygavgångar till {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
