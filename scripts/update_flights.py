#!/usr/bin/env python3
"""Bygg regionala flygavgångar för DinPuls.

Geografi:
- Värmland: Karlstad, Hagfors och Torsby.
- Dalsland: Karlstad och Göteborg Stallbacka.

Karlstad Airport och Göteborg Stallbacka läses från flygplatsernas egna
aktuella avgångstavlor. Hagfors och Torsby använder kommunernas officiella
2026-tidtabeller. Om en livekälla tillfälligt inte går att nå behålls ännu
framtida poster från föregående lyckade körning, tydligt markerade som stale.
"""
from __future__ import annotations

import json
import re
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "flights.json"
STOCKHOLM = ZoneInfo("Europe/Stockholm")
FETCH_ATTEMPTS = 3
FETCH_TIMEOUT_SECONDS = 25

AIRPORTS = [
    {
        "id": "KSD",
        "name": "Karlstad Airport",
        "audiences": ["Värmland", "Dalsland"],
        "live": True,
        "sourceUrl": "https://www.ksdarprt.se/",
        "scheduleUrl": "https://www.ksdarprt.se/resmal/tidtabeller/",
    },
    {
        "id": "HFS",
        "name": "Hagfors Airport",
        "audiences": ["Värmland"],
        "live": False,
        "sourceUrl": "https://www.hagfors.se/undersidor/trafik-och-infrastruktur/hagfors-airport.html",
    },
    {
        "id": "TYF",
        "name": "Torsby flygplats",
        "audiences": ["Värmland"],
        "live": False,
        "sourceUrl": "https://torsby.se/torsbyflygplats/torsbyflygplats/tidtabell.4.5ab966ab193901545fff61a.html",
    },
    {
        "id": "THN",
        "name": "Göteborg Stallbacka Airport",
        "audiences": ["Dalsland"],
        "live": True,
        "sourceUrl": "https://gsairport.se/infor-resan/reseinformation/",
        "scheduleUrl": "https://vastflyg.se/avgangstider/",
    },
]

AIRPORT_BY_ID = {airport["id"]: airport for airport in AIRPORTS}


def fetch_html(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
            "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.7",
        },
    )
    last_error = None
    for attempt in range(1, FETCH_ATTEMPTS + 1):
        try:
            with urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
                return response.read().decode("utf-8", errors="replace")
        except HTTPError as error:
            last_error = error
            if 400 <= error.code < 500 and error.code not in (408, 429):
                break
        except (URLError, TimeoutError, OSError) as error:
            last_error = error
        if attempt < FETCH_ATTEMPTS:
            time.sleep(attempt * 2)
    raise RuntimeError(f"Kunde inte hämta {url}: {last_error}")


def normalize_time(value: str) -> str | None:
    match = re.fullmatch(r"\s*(\d{1,2})[:.]([0-5]\d)\s*", value or "")
    if not match:
        return None
    hour = int(match.group(1))
    if not 0 <= hour <= 23:
        return None
    return f"{hour:02d}:{match.group(2)}"


def build_dt(day: date, hhmm: str) -> datetime:
    hour, minute = map(int, hhmm.split(":"))
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=STOCKHOLM)


def status_realtime(day: date, scheduled: datetime, status: str) -> datetime:
    match = re.search(r"(\d{1,2})[:.]([0-5]\d)", status or "")
    if not match:
        return scheduled
    actual = build_dt(day, f"{int(match.group(1)):02d}:{match.group(2)}")
    if actual < scheduled - timedelta(hours=12):
        actual += timedelta(days=1)
    return actual


def add_departure(
    items: list[dict], airport_id: str, day: date, hhmm: str, destination: str,
    flight: str, operator: str, source_url: str, *, status: str = "",
    live_source: bool = False, stale: bool = False,
):
    airport = AIRPORT_BY_ID[airport_id]
    scheduled = build_dt(day, hhmm)
    realtime = status_realtime(day, scheduled, status) if status else scheduled
    status_lower = status.casefold()
    canceled = "inställd" in status_lower or "cancel" in status_lower
    departed = "startat" in status_lower or "departed" in status_lower
    delay = max(0, round((realtime - scheduled).total_seconds() / 60))
    items.append({
        "mode": "flight",
        "airportId": airport_id,
        "airport": airport["name"],
        "audiences": airport["audiences"],
        "direction": destination,
        "line": flight,
        "operator": operator,
        "scheduled": scheduled.isoformat(),
        "realtime": realtime.isoformat(),
        "delayMinutes": delay,
        "isRealtime": bool(live_source and status),
        "liveSource": live_source,
        "statusText": status.strip(),
        "departed": departed,
        "canceled": canceled,
        "stale": stale,
        "platform": "",
        "sourceUrl": source_url,
    })


def table_rows_after_heading(soup: BeautifulSoup, label: str) -> list[list[str]]:
    heading = soup.find(
        lambda tag: tag.name in ("h2", "h3", "h4")
        and label.casefold() in tag.get_text(" ", strip=True).casefold()
    )
    if not heading:
        return []
    table = heading.find_next("table")
    if not table:
        return []
    rows = []
    for tr in table.find_all("tr"):
        cells = [cell.get_text(" ", strip=True) for cell in tr.find_all(["td", "th"])]
        if cells:
            rows.append(cells)
    return rows


def parse_karlstad_live(now: datetime) -> list[dict]:
    html = fetch_html(AIRPORT_BY_ID["KSD"]["sourceUrl"])
    soup = BeautifulSoup(html, "html.parser")
    items: list[dict] = []
    for heading, day in (("Avgångar idag", now.date()), ("Avgångar imorgon", (now + timedelta(days=1)).date())):
        for cells in table_rows_after_heading(soup, heading):
            if len(cells) < 3:
                continue
            hhmm = normalize_time(cells[0])
            if not hhmm:
                continue
            destination = cells[1]
            flight = cells[2] if len(cells) > 2 else ""
            operator = cells[3] if len(cells) > 3 else ""
            status = cells[4] if len(cells) > 4 else ""
            add_departure(
                items, "KSD", day, hhmm, destination, flight, operator,
                AIRPORT_BY_ID["KSD"]["sourceUrl"], status=status, live_source=True,
            )
    if not items:
        raise RuntimeError("Karlstads liveavgångar kunde inte tolkas")
    return items


def parse_stallbacka_live(now: datetime) -> list[dict]:
    html = fetch_html(AIRPORT_BY_ID["THN"]["sourceUrl"])
    soup = BeautifulSoup(html, "html.parser")
    lines = [re.sub(r"\s+", " ", line).strip() for line in soup.get_text("\n", strip=True).splitlines() if line.strip()]

    departure_labels = {"avgångar", "departures"}
    arrival_labels = {"ankomster", "arrivals"}
    start = None
    end = None
    for index, line in enumerate(lines):
        normalized = line.casefold().strip(" :")
        if start is None and normalized in departure_labels:
            start = index + 1
            continue
        if start is not None and normalized in arrival_labels:
            end = index
            break

    if start is None or end is None or end <= start:
        page_text = "\n".join(lines)
        match = re.search(r"(?:^|\n)(?:Avgångar|Departures)\s*\n(.*?)(?:\n)(?:Ankomster|Arrivals)(?:\n|$)", page_text, flags=re.I | re.S)
        if not match:
            raise RuntimeError("Stallbackas avgångsblock kunde inte hittas")
        block = [line.strip() for line in match.group(1).splitlines() if line.strip()]
    else:
        block = lines[start:end]

    block = [line for line in block if "flight icon" not in line.casefold()]
    items: list[dict] = []
    i = 0
    while i < len(block):
        hhmm = normalize_time(block[i])
        if not hhmm or i + 2 >= len(block):
            i += 1
            continue
        flight = block[i + 1].strip()
        if not re.fullmatch(r"[A-Z0-9]{2,4}\s?\d{2,4}", flight, flags=re.I):
            i += 1
            continue
        destination = block[i + 2].strip()
        status = ""
        consumed = 3
        if i + 3 < len(block) and not normalize_time(block[i + 3]):
            candidate = block[i + 3].strip()
            if any(word in candidate.casefold() for word in ("start", "försen", "instäl", "beräkn", "avgår", "boarding", "gate", "depart", "cancel", "estimated")):
                status = candidate
                consumed = 4
        add_departure(
            items, "THN", now.date(), hhmm, destination, flight, "Västflyg",
            AIRPORT_BY_ID["THN"]["sourceUrl"], status=status, live_source=True,
        )
        i += consumed
    if not items:
        candidates = [line for line in lines if re.fullmatch(r"\d{1,2}[:.]\d{2}", line) or re.fullmatch(r"[A-Z0-9]{2,4}\s?\d{2,4}", line, flags=re.I)]
        raise RuntimeError(f"Stallbackas liveavgångar kunde inte tolkas; kandidater={candidates[:12]}")
    return items


def generate_karlstad_fallback(day: date, items: list[dict]):
    # Arlanda-linjen är pausad från slutet av juli 2026 och ska därför inte
    # genereras från den äldre publicerade årsöversikten.
    weekday = day.weekday()
    source = AIRPORT_BY_ID["KSD"]["scheduleUrl"]
    if weekday < 5:
        add_departure(items, "KSD", day, "06:15", "Köpenhamn Kastrup", "OJ600", "Sola Air", source, stale=True)
        add_departure(items, "KSD", day, "16:30", "Köpenhamn Kastrup", "OJ610", "Sola Air", source, stale=True)
    elif weekday == 6:
        add_departure(items, "KSD", day, "16:30", "Köpenhamn Kastrup", "OJ610", "Sola Air", source, stale=True)

    # Ving/Sunclass Mallorca: tisdagar 4 aug–6 okt 2026. Avgångstavlan är
    # primär källa; detta är endast reserv när livehämtningen misslyckas.
    if weekday == 1 and date(2026, 8, 4) <= day <= date(2026, 10, 6):
        add_departure(items, "KSD", day, "16:30", "Palma-Mallorca", "DK1410", "Sunclass Airlines", source, stale=True)


def generate_stallbacka_fallback(day: date, items: list[dict]):
    """Reservtidtabell för THN→BMA när flygplatsens livevy inte kan hämtas.

    Veckomönstret är kontrollerat mot aktuell publicerad flygtidtabell.
    Söndag 30 augusti 2026 har en officiellt publicerad avvikelse 15:20.
    Poster härifrån är alltid tidtabell, aldrig påstådd realtid.
    """
    source = AIRPORT_BY_ID["THN"]["scheduleUrl"]
    weekday = day.weekday()
    if day == date(2026, 8, 30):
        add_departure(items, "THN", day, "15:20", "Stockholm-Bromma Airport", "OJ256", "Västflyg", source, stale=True)
        return
    if weekday in (0, 1, 2):
        add_departure(items, "THN", day, "07:15", "Stockholm-Bromma Airport", "OJ250", "Västflyg", source, stale=True)
        add_departure(items, "THN", day, "15:55", "Stockholm-Bromma Airport", "OJ256", "Västflyg", source, stale=True)
    elif weekday == 3:
        add_departure(items, "THN", day, "07:30", "Stockholm-Bromma Airport", "OJ250", "Västflyg", source, stale=True)
        add_departure(items, "THN", day, "16:20", "Stockholm-Bromma Airport", "OJ256", "Västflyg", source, stale=True)
    elif weekday == 4:
        add_departure(items, "THN", day, "15:00", "Stockholm-Bromma Airport", "OJ256", "Västflyg", source, stale=True)
    elif weekday == 6:
        add_departure(items, "THN", day, "15:55", "Stockholm-Bromma Airport", "OJ256", "Västflyg", source, stale=True)


def generate_hagfors_torsby(day: date, items: list[dict]):
    if day.weekday() >= 5:
        return
    if date(2026, 6, 29) <= day <= date(2026, 8, 12):
        return
    hagfors_source = AIRPORT_BY_ID["HFS"]["sourceUrl"]
    torsby_source = AIRPORT_BY_ID["TYF"]["sourceUrl"]
    add_departure(items, "TYF", day, "06:05", "Stockholm Arlanda via Hagfors", "JON51", "Jonair", torsby_source)
    add_departure(items, "TYF", day, "16:30", "Stockholm Arlanda via Hagfors", "JON53", "Jonair", torsby_source)
    add_departure(items, "HFS", day, "06:40", "Stockholm Arlanda", "JON51", "Jonair", hagfors_source)
    add_departure(items, "HFS", day, "17:00", "Stockholm Arlanda", "JON53", "Jonair", hagfors_source)


def previous_future(airport_id: str, now: datetime) -> list[dict]:
    if not OUTPUT.exists():
        return []
    try:
        old = json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    kept = []
    for item in old.get("departures", []):
        if item.get("airportId") != airport_id:
            continue
        try:
            departure = datetime.fromisoformat(item.get("realtime") or item["scheduled"])
        except (ValueError, TypeError, KeyError):
            continue
        if departure >= now - timedelta(minutes=2):
            copy = dict(item)
            copy["stale"] = True
            copy["isRealtime"] = False
            kept.append(copy)
    return kept


def dedupe(items: list[dict]) -> list[dict]:
    best: dict[tuple, dict] = {}
    for item in items:
        key = (item.get("airportId"), item.get("scheduled"), item.get("line"), item.get("direction"))
        current = best.get(key)
        if current is None or (current.get("stale") and not item.get("stale")) or (item.get("isRealtime") and not current.get("isRealtime")):
            best[key] = item
    return sorted(best.values(), key=lambda item: item.get("realtime") or item.get("scheduled") or "")


def main():
    now = datetime.now(STOCKHOLM)
    items: list[dict] = []
    errors: list[str] = []

    try:
        items.extend(parse_karlstad_live(now))
    except Exception as error:  # livekälla får falla tillbaka utan att slå ut hela modulen
        errors.append(f"Karlstad: {error}")
        retained = previous_future("KSD", now)
        if retained:
            items.extend(retained)
        else:
            for offset in range(0, 7):
                generate_karlstad_fallback((now + timedelta(days=offset)).date(), items)

    try:
        items.extend(parse_stallbacka_live(now))
    except Exception as error:
        errors.append(f"Stallbacka live: {error}; använder verifierad tidtabellsfallback")
        retained = previous_future("THN", now)
        if retained:
            items.extend(retained)
        else:
            for offset in range(0, 7):
                generate_stallbacka_fallback((now + timedelta(days=offset)).date(), items)

    for offset in range(0, 7):
        generate_hagfors_torsby((now + timedelta(days=offset)).date(), items)

    filtered = []
    for item in dedupe(items):
        try:
            effective = datetime.fromisoformat(item.get("realtime") or item["scheduled"])
        except (ValueError, TypeError, KeyError):
            continue
        # Redan startade flyg behöver inte ligga kvar på en avgångstavla.
        if item.get("departed") and effective < now + timedelta(minutes=2):
            continue
        if effective >= now - timedelta(minutes=2) or item.get("canceled"):
            filtered.append(item)

    output = {
        "version": "1.1.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Officiella flygplatskällor",
        "regional": True,
        "liveAirports": ["KSD", "THN"],
        "scheduleAirports": ["HFS", "TYF"],
        "audienceRules": {
            "Värmland": ["KSD", "HFS", "TYF"],
            "Dalsland": ["KSD", "THN"],
        },
        "airports": AIRPORTS,
        "sourceErrors": errors,
        "departures": filtered,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Skrev {len(filtered)} flygavgångar från fyra flygplatser till {OUTPUT}")
    if errors:
        print("Källvarningar: " + " | ".join(errors))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
