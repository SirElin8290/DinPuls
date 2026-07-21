#!/usr/bin/env python3
"""Hämtar officiell kris-, polis- och trafikinfo för Dagens viktigaste."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "data" / "municipalities.json"
TRANSPORT = ROOT / "data" / "transport.json"
OUTPUT = ROOT / "data" / "important.json"
POLICE_API = "https://polisen.se/api/events"
CRISIS_API = "https://api.krisinformation.se/v3/news"
USER_AGENT = "DinPuls/0.13.0 (+https://sirelin8290.github.io/DinPuls/)"


def load(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def fetch_json(url: str):
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code} från {url}") from None
    except URLError as error:
        raise RuntimeError(f"Kunde inte nå {url}: {error.reason}") from None


def text(item: dict, *keys: str) -> str:
    for key in keys:
        value = item.get(key)
        if value not in (None, ""):
            return str(value).strip()
    return ""


def parse_time(value: str):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        try:
            return datetime.strptime(str(value), "%Y-%m-%d %H:%M:%S %z")
        except (TypeError, ValueError):
            return None


def police_items(payload, name: str, now: datetime) -> list[dict]:
    if not isinstance(payload, list):
        raise RuntimeError("Polisens svar har oväntat format")
    serious = ("brand", "trafikolycka", "rån", "mord", "skott", "explosion", "farligt föremål")
    result = []
    for event in payload:
        location = event.get("location") or {}
        location_name = text(location, "name") if isinstance(location, dict) else ""
        searchable = f"{event.get('name', '')} {event.get('summary', '')} {location_name}".lower()
        if name.lower() not in searchable:
            continue
        published = parse_time(event.get("datetime"))
        if published and published.astimezone(timezone.utc) < now - timedelta(hours=36):
            continue
        title = text(event, "name", "type") or "Polishändelse"
        combined = f"{title} {text(event, 'summary')}".lower()
        result.append({
            "id": f"police-{event.get('id', title)}",
            "category": "police",
            "severity": "warning" if any(word in combined for word in serious) else "info",
            "priority": 75 if any(word in combined for word in serious) else 45,
            "title": title,
            "publishedAt": event.get("datetime"),
            "source": "Polisen",
            "url": f"https://polisen.se{event.get('url')}" if str(event.get("url") or "").startswith("/") else event.get("url") or f"https://polisen.se/aktuellt/polisens-nyheter/?lpfm.loc={name}",
        })
    return result


def crisis_records(payload) -> list[dict]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("items", "Items", "news", "News", "results", "Results"):
            if isinstance(payload.get(key), list):
                return [item for item in payload[key] if isinstance(item, dict)]
    return []


def crisis_items(records: list[dict], name: str, county: str, now: datetime) -> list[dict]:
    result = []
    for item in records:
        serialized = json.dumps(item, ensure_ascii=False).lower()
        title = text(item, "Headline", "headline", "Title", "title")
        relevant = name.lower() in serialized or county.lower() in serialized
        nationally_important = any(marker in title.lower() for marker in ("viktigt meddelande", "vma", "myndighetsmeddelande"))
        if not relevant and not nationally_important:
            continue
        published_value = text(item, "Published", "published", "PublishedAt", "publishedAt", "Updated", "updated")
        published = parse_time(published_value)
        if published and published.astimezone(timezone.utc) < now - timedelta(days=7):
            continue
        url = text(item, "Web", "web", "Url", "url", "Link", "link")
        identifier = text(item, "Identifier", "identifier", "Id", "id") or title
        result.append({
            "id": f"crisis-{identifier}",
            "category": "crisis",
            "severity": "danger",
            "priority": 100,
            "title": title or "Viktig krisinformation",
            "publishedAt": published_value,
            "source": "Krisinformation.se",
            "url": url or "https://www.krisinformation.se/",
        })
    return result


def traffic_items(transport: dict, name: str, now: datetime) -> list[dict]:
    result = []
    stops = transport.get("municipalities", {}).get(name, {}).get("stops", [])
    for stop in stops:
        for index, alert in enumerate(stop.get("alerts") or []):
            message = alert if isinstance(alert, str) else text(alert, "title", "text", "message")
            if message:
                result.append({
                    "id": f"traffic-{stop.get('id', name)}-{index}",
                    "category": "traffic", "severity": "warning", "priority": 70,
                    "title": message, "publishedAt": transport.get("generatedAt"),
                    "source": "Trafiklab", "url": "https://www.trafiklab.se/",
                })
        for departure in stop.get("departures") or []:
            departure_time = parse_time(departure.get("realtime") or departure.get("scheduled"))
            if departure_time and departure_time.replace(tzinfo=departure_time.tzinfo or timezone.utc) < now - timedelta(minutes=10):
                continue
            if departure.get("canceled"):
                result.append({
                    "id": f"traffic-cancel-{stop.get('id')}-{departure.get('line')}-{departure.get('scheduled')}",
                    "category": "traffic", "severity": "warning", "priority": 65,
                    "title": f"Inställd avgång {departure.get('line', '')} mot {departure.get('direction', '')}".strip(),
                    "publishedAt": transport.get("generatedAt"), "source": "Trafiklab", "url": "https://www.trafiklab.se/",
                })
    return result


def main() -> int:
    config = load(CONFIG, {})
    existing = load(OUTPUT, {"municipalities": {}})
    transport = load(TRANSPORT, {})
    now = datetime.now(timezone.utc)
    try:
        crises = crisis_records(fetch_json(f"{CRISIS_API}?format=json"))
        crisis_ok = True
    except RuntimeError as error:
        print(f"VARNING Krisinformation: {error}")
        crises, crisis_ok = [], False
    try:
        police_events = fetch_json(POLICE_API)
        police_ok = isinstance(police_events, list)
    except RuntimeError as error:
        print(f"VARNING Polisen: {error}")
        police_events, police_ok = [], False

    municipalities = {}
    successful_sources = int(crisis_ok)
    for municipality in config.get("municipalities", []):
        name = text(municipality, "name")
        county = text(municipality, "county")
        if not name:
            continue
        items = crisis_items(crises, name, county, now) if crisis_ok else []
        try:
            if not police_ok:
                raise RuntimeError("Polisens källa kunde inte nås")
            items.extend(police_items(police_events, name, now))
            successful_sources += 1
        except RuntimeError as error:
            print(f"VARNING Polisen {name}: {error}")
            previous = existing.get("municipalities", {}).get(name, {}).get("items", [])
            items.extend(item for item in previous if item.get("category") == "police")
        items.extend(traffic_items(transport, name, now))
        unique = {str(item.get("id")): item for item in items if item.get("id") and item.get("title")}
        sorted_items = sorted(unique.values(), key=lambda item: (item.get("priority", 0), item.get("publishedAt") or ""), reverse=True)[:8]
        municipalities[name] = {"items": sorted_items}
        print(f"{name}: {len(sorted_items)} viktiga händelser")

    if successful_sources == 0:
        print("Ingen officiell källa kunde nås; behåller befintlig fil")
        return 1
    output = {
        "version": "0.13.0",
        "generatedAt": now.isoformat(timespec="seconds"),
        "sources": [
            {"name": "Krisinformation.se", "url": "https://www.krisinformation.se/"},
            {"name": "Polisen", "url": "https://polisen.se/aktuellt/"},
            {"name": "Trafiklab", "url": "https://www.trafiklab.se/"},
        ],
        "municipalities": municipalities,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
