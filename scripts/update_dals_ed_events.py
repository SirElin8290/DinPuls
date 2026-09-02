#!/usr/bin/env python3
"""Hämtar Dals-Eds officiella evenemangskalender och fyller kommunens events.json-post.

Dals-Eds SiteVision-kalender saknar den strukturerade källa som den generella
DinPuls-importen använder för flera andra kommuner. Den här adaptern läser den
publika kommunala kalendern direkt och lämnar övriga kommuner helt orörda.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import urllib.request
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "events.json"
SOURCE_URL = "https://www.dalsed.se/evenemang/"
SOURCE_NAME = "Dals-Eds kommun – evenemang"
VISIT_URL = "https://www.vastsverige.com/dalsland/dals-ed/"
USER_AGENT = "DinPuls.se/0.21 (+https://dinpuls.se/)"

MONTHS = {
    "januari": 1, "februari": 2, "mars": 3, "april": 4,
    "maj": 5, "juni": 6, "juli": 7, "augusti": 8,
    "september": 9, "oktober": 10, "november": 11, "december": 12,
}
WEEKDAYS = "måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag"
DATE_PART = rf"(?:{WEEKDAYS})\s+(\d{{1,2}})\s+({'|'.join(MONTHS)})\s+(\d{{4}})(?:\s+(\d{{2}}:\d{{2}}))?"
DATE_LINE = re.compile(rf"^\s*{DATE_PART}(?:\s*-\s*{DATE_PART})?\s*$", re.I)


class TextCollector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        text = html.unescape(data).replace("\xa0", " ").strip()
        if text:
            self.parts.append(re.sub(r"\s+", " ", text))


def fetch_page() -> str:
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def iso(day: str, month: str, year: str) -> str:
    return f"{int(year):04d}-{MONTHS[month.casefold()]:02d}-{int(day):02d}"


def parse_date_line(text: str) -> tuple[str, str, str] | None:
    match = DATE_LINE.match(text)
    if not match:
        return None
    groups = match.groups()
    start = iso(groups[0], groups[1], groups[2])
    start_time = groups[3] or ""
    if groups[4]:
        end = iso(groups[4], groups[5], groups[6])
        end_time = groups[7] or ""
    else:
        end = start
        end_time = ""
    if start_time and end_time:
        time_label = f"{start_time}–{end_time}"
    elif start_time:
        time_label = start_time
    else:
        time_label = "Se källan"
    return start, end, time_label


def category(title: str) -> tuple[str, str]:
    lowered = title.casefold()
    if any(word in lowered for word in ("bio", "film", "utställ", "konst", "kultur", "revyn")):
        return "culture", "Konst och kultur"
    if any(word in lowered for word in ("barn", "familj", "sago")):
        return "family", "Barn och familj"
    if any(word in lowered for word in ("musik", "konsert", "haaks")):
        return "music", "Musik"
    if any(word in lowered for word in ("lopp", "match", "tävling", "idrott")):
        return "sport", "Sport"
    if "motor" in lowered or re.search(r"\b(?:bilträff|bilshow|bilsport|bilklubb|bilutställning|mc)\b", lowered):
        return "motor", "Motor"
    return "community", "Lokalt och föreningar"


def parse_events(markup: str) -> list[dict]:
    collector = TextCollector()
    collector.feed(markup)
    lines = collector.parts
    try:
        start_index = next(i for i, value in enumerate(lines) if "Prenumerera på evenemang" in value)
    except StopIteration:
        start_index = 0
    try:
        end_index = next(i for i, value in enumerate(lines[start_index:], start_index) if value.startswith("Sidan uppdaterades"))
    except StopIteration:
        end_index = len(lines)
    lines = lines[start_index:end_index]

    pending_dates: list[tuple[str, str, str]] = []
    results: list[dict] = []
    today = date.today().isoformat()
    ignored_prefixes = (
        "Prenumerera på evenemang", "Visa bara bioföreställningar", "Läs mer",
        "Vill du ha med ditt evenemang", "Använd länken", "Evenemangsanmälan",
    )

    for raw in lines:
        text = raw.strip(" •\t")
        if not text or text.startswith(ignored_prefixes):
            continue
        parsed = parse_date_line(text)
        if parsed:
            pending_dates.append(parsed)
            continue
        if not pending_dates:
            continue
        title = text
        event_category, label = category(title)
        for start, end, time_label in pending_dates:
            if end < today:
                continue
            identifier = hashlib.sha1(f"Dals-Ed|{title}|{start}|{SOURCE_URL}".encode()).hexdigest()[:16]
            results.append({
                "id": f"event-{identifier}",
                "title": title,
                "startDate": start,
                "endDate": end,
                "time": time_label,
                "venue": "Dals-Ed",
                "category": event_category,
                "categoryLabel": label,
                "sourceName": SOURCE_NAME,
                "url": SOURCE_URL,
            })
        pending_dates = []

    unique: dict[tuple[str, str], dict] = {}
    for item in results:
        unique[(item["title"].casefold(), item["startDate"])] = item
    return sorted(unique.values(), key=lambda item: (item["startDate"], item["title"]))[:80]


def main() -> int:
    payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
    markup = fetch_page()
    events = parse_events(markup)
    if not events:
        raise SystemExit("Dals-Eds kalender gav inga framtida evenemang; befintlig data lämnas orörd")

    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    municipalities = payload.setdefault("municipalities", {})
    municipality = municipalities.setdefault("Dals-Ed", {})
    municipality["events"] = events
    municipality["sources"] = [
        {
            "name": SOURCE_NAME,
            "type": "Kommunal kalender",
            "url": SOURCE_URL,
            "icon": "landmark",
            "automatic": True,
        },
        {
            "name": "Visit Dalsland – Dals-Ed",
            "type": "Regional besöksguide",
            "url": VISIT_URL,
            "icon": "map",
        },
    ]
    municipality["sourceHealth"] = [
        {
            "name": SOURCE_NAME,
            "url": SOURCE_URL,
            "status": "ok",
            "mode": "automatic",
            "events": len(events),
            "checkedAt": checked_at,
        },
        {
            "name": "Visit Dalsland – Dals-Ed",
            "url": VISIT_URL,
            "status": "reference",
            "mode": "reference",
            "events": 0,
            "checkedAt": checked_at,
        },
    ]
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Dals-Ed: {len(events)} framtida evenemang från kommunens officiella kalender")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
