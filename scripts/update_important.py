#!/usr/bin/env python3
"""Hämtar officiell kris-, polis-, trafik- och kommuninfo för Dagens viktigaste."""
from __future__ import annotations

import hashlib
import html
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "data" / "municipalities.json"
SOURCES_CONFIG = ROOT / "data" / "important-sources.json"
TRANSPORT = ROOT / "data" / "transport.json"
ROAD_TRAFFIC = ROOT / "data" / "road-traffic.json"
OUTPUT = ROOT / "data" / "important.json"
POLICE_API = "https://polisen.se/api/events"
CRISIS_API = "https://api.krisinformation.se/v3/news"
SMHI_WARNINGS_API = "https://opendata-download-warnings.smhi.se/ibww/api/version/1/warning.json"
USER_AGENT = "DinPuls/0.17.4 (+https://sirelin8290.github.io/DinPuls/)"

IMPORTANT_TERMS = (
    "kokningspåbud", "kokrekommendation", "otjänligt vatten", "vattenavstäng",
    "vattenläcka", "strömavbrott", "elavbrott", "driftstör",
    "driftavbrott", "fiberavbrott", "avbrott", "sophämt", "avfallshämt",
    "inställd sophämtning", "stängd skola", "stängd förskola", "stängd verksamhet",
    "tillfälligt stäng", "it-stör", "telefonstör", "trafikomledning",
    "begränsad framkomlighet", "akut information",
)
GENERIC_TITLES = {
    "driftinformation", "driftstörningar", "aktuella driftstörningar",
    "vatten och avlopp", "nyheter", "information", "läs mer", "fjärrvärme",
    "viktigt meddelande till allmänheten - vma",
    "viktigt meddelande till allmänheten – vma",
    "sms-tjänst driftstörning",
}
RESOLVED_TERMS = ("åtgärdad", "avslutad", "åter i drift", "fungerar igen", "tidigare avbrott")
MONTHS = {
    "januari": 1, "februari": 2, "mars": 3, "april": 4, "maj": 5, "juni": 6,
    "juli": 7, "augusti": 8, "september": 9, "oktober": 10, "november": 11, "december": 12,
}


def load(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def fetch(url: str, accept: str = "application/json") -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    try:
        with urlopen(request, timeout=30) as response:
            return response.read()
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code} från {url}") from None
    except URLError as error:
        raise RuntimeError(f"Kunde inte nå {url}: {error.reason}") from None
    except TimeoutError:
        raise RuntimeError(f"Tidsgränsen överskreds för {url}") from None


def fetch_json(url: str):
    return json.loads(fetch(url).decode("utf-8-sig"))


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


def strip_markup(value: str) -> str:
    value = re.sub(r"<script\b.*?</script>|<style\b.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def date_from_text(value: str, now: datetime):
    iso = re.search(r"\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b", value)
    if iso:
        try:
            return datetime(int(iso.group(1)), int(iso.group(2)), int(iso.group(3)), tzinfo=timezone.utc)
        except ValueError:
            pass
    swedish = re.search(
        r"\b(\d{1,2})\s+(" + "|".join(MONTHS) + r")(?:\s+(20\d{2}))?\b",
        value.lower(),
    )
    if swedish:
        year = int(swedish.group(3) or now.year)
        try:
            candidate = datetime(year, MONTHS[swedish.group(2)], int(swedish.group(1)), tzinfo=timezone.utc)
            if not swedish.group(3) and candidate > now + timedelta(days=45):
                candidate = candidate.replace(year=year - 1)
            return candidate
        except ValueError:
            pass
    return None


def municipal_priority(title: str) -> tuple[str, int]:
    lowered = title.lower()
    if any(term in lowered for term in ("kokningspåbud", "otjänligt vatten", "viktigt meddelande", "stängd skola", "stängd förskola")):
        return "danger", 95
    if any(term in lowered for term in ("vattenavstäng", "vattenläcka", "strömavbrott", "elavbrott", "driftstör", "driftavbrott", "avbrott")):
        return "warning", 85
    return "info", 72


def municipal_items(source_name: str, source_url: str, now: datetime) -> list[dict]:
    page = fetch(source_url, "text/html,application/xhtml+xml").decode("utf-8", errors="replace")
    results = []
    anchor_pattern = re.compile(
        r"<a\b[^>]*href\s*=\s*[\"']([^\"']+)[\"'][^>]*>(.*?)</a>",
        re.I | re.S,
    )
    for match in anchor_pattern.finditer(page):
        title = strip_markup(match.group(2))
        lowered = title.lower().strip(" .:-")
        if len(title) < 8 or lowered in GENERIC_TITLES:
            continue
        if not any(term in lowered for term in IMPORTANT_TERMS):
            continue
        context = strip_markup(page[max(0, match.start() - 240): min(len(page), match.end() + 240)])
        context_lower = context.lower()
        if any(term in context_lower for term in RESOLVED_TERMS):
            continue
        published = date_from_text(context, now)
        # Kommunernas startsidor länkar ofta till permanenta informationssidor
        # med ord som "driftstörning", "fjärrvärme" och "VMA". Utan ett
        # uttryckligt publiceringsdatum är det inte ett verifierat pågående
        # driftmeddelande och ska därför inte visas som en aktuell händelse.
        if published is None:
            continue
        if published < now - timedelta(days=7) or published > now + timedelta(days=1):
            continue
        url = urljoin(source_url, html.unescape(match.group(1)))
        severity, priority = municipal_priority(title)
        identifier = hashlib.sha1(f"{source_name}|{url}|{title}".encode("utf-8")).hexdigest()[:16]
        results.append({
            "id": f"municipal-{identifier}",
            "category": "municipal",
            "severity": severity,
            "priority": priority,
            "title": title[:180],
            "publishedAt": (published or now).isoformat(timespec="seconds"),
            "source": source_name,
            "url": url,
        })
    return list({item["id"]: item for item in results}.values())


def recent_previous(items: list[dict], category: str, now: datetime, max_age_hours: int = 48) -> list[dict]:
    result = []
    cutoff = now - timedelta(hours=max_age_hours)
    for item in items:
        if item.get("category") != category:
            continue
        title = str(item.get("title") or "").lower().strip(" .:-")
        if category == "municipal" and title in GENERIC_TITLES:
            continue
        published = parse_time(item.get("publishedAt"))
        if published and published.astimezone(timezone.utc) >= cutoff:
            result.append(item)
    return result


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
        is_serious = any(word in combined for word in serious)
        if not is_serious:
            continue
        result.append({
            "id": f"police-{event.get('id', title)}",
            "category": "police",
            "severity": "warning", "priority": 78,
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
        relevant = name.lower() in serialized or (county and county.lower() in serialized)
        alert_title = any(marker in title.lower() for marker in ("viktigt meddelande", "vma", "myndighetsmeddelande"))
        national_scope = any(
            marker in serialized
            for marker in (
                "hela sverige",
                "rikstäckande",
                "nationellt meddelande",
                '"scope": "national"',
                '"scope":"national"',
            )
        )
        # Ett VMA är normalt geografiskt avgränsat. Rubriken "Viktigt
        # meddelande" gör därför inte händelsen relevant för alla kommuner.
        # Endast uttryckligen rikstäckande meddelanden får passera utan lokal
        # kommun- eller länsträff.
        if not relevant and not (alert_title and national_scope):
            continue
        published_value = text(item, "Published", "published", "PublishedAt", "publishedAt", "Updated", "updated")
        published = parse_time(published_value)
        if published and published.astimezone(timezone.utc) < now - timedelta(days=7):
            continue
        url = text(item, "Web", "web", "Url", "url", "Link", "link")
        identifier = text(item, "Identifier", "identifier", "Id", "id") or title
        result.append({
            "id": f"crisis-{identifier}", "category": "crisis", "severity": "danger",
            "priority": 100, "title": title or "Viktig krisinformation",
            "publishedAt": published_value, "source": "Krisinformation.se",
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
    return result


def localized(value, default="") -> str:
    if isinstance(value, dict):
        return str(value.get("sv") or value.get("en") or default).strip()
    return str(value or default).strip()


def weather_items(payload, county: str, now: datetime) -> list[dict]:
    if not isinstance(payload, list):
        raise RuntimeError("SMHI:s svar har oväntat format")
    result = []
    for warning in payload:
        event_name = localized((warning.get("event") or {}), "Vädervarning")
        for area in warning.get("warningAreas") or []:
            affected = " ".join(localized(entry.get("name")) for entry in area.get("affectedAreas") or [])
            if county.lower().replace(" län", "") not in affected.lower().replace(" län", ""):
                continue
            level = localized(area.get("warningLevel"), "Meddelande")
            code = str((area.get("warningLevel") or {}).get("code") or "").upper()
            if code == "MESSAGE" and not area.get("pushNotice"):
                continue
            description = localized(area.get("eventDescription"))
            priority = {"RED": 98, "ORANGE": 92, "YELLOW": 82}.get(code, 72)
            result.append({
                "id": f"weather-{warning.get('id')}-{area.get('id')}",
                "category": "weather", "severity": "danger" if code in {"RED", "ORANGE"} else "warning",
                "priority": priority, "title": f"{level}: {event_name}" + (f" – {description}" if description else ""),
                "publishedAt": area.get("published") or area.get("approximateStart") or now.isoformat(),
                "source": "SMHI", "url": "https://www.smhi.se/vader/varningar-och-meddelanden/varningar-och-meddelanden",
            })
    return result


def road_items(road_data: dict, name: str, now: datetime) -> list[dict]:
    result = []
    cutoff = now - timedelta(hours=48)
    for item in road_data.get("municipalities", {}).get(name, {}).get("items", []):
        updated = parse_time(item.get("updatedAt") or item.get("publishedAt") or road_data.get("generatedAt"))
        if not updated or updated.astimezone(timezone.utc) < cutoff:
            continue
        title = str(item.get("title") or "").strip()
        combined = f"{title} {item.get('message', '')} {item.get('location', '')}".lower()
        serious = item.get("severity") == "danger" or any(term in combined for term in (
            "avstängd", "helt stopp", "olycka", "brand", "översväm", "ras", "blockerad",
        ))
        if not serious or item.get("category") == "roadwork":
            continue
        result.append({
            "id": f"road-{item.get('id')}", "category": "road", "severity": "danger" if item.get("severity") == "danger" else "warning",
            "priority": 80 if item.get("severity") == "danger" else 74,
            "title": title or item.get("message") or "Allvarlig trafikstörning",
            "publishedAt": item.get("updatedAt") or road_data.get("generatedAt"),
            "source": "Trafikverket", "url": f"trafik.html?kommun={quote(name)}&event={quote(str(item.get('id') or ''))}",
        })
    return result


def main() -> int:
    config = load(CONFIG, {})
    source_config = load(SOURCES_CONFIG, {})
    existing = load(OUTPUT, {"municipalities": {}})
    transport = load(TRANSPORT, {})
    road_traffic = load(ROAD_TRAFFIC, {})
    now = datetime.now(timezone.utc)
    try:
        crises = crisis_records(fetch_json(f"{CRISIS_API}?format=json"))
        crisis_ok = True
    except (RuntimeError, json.JSONDecodeError) as error:
        print(f"VARNING Krisinformation: {error}")
        crises, crisis_ok = [], False
    try:
        police_events = fetch_json(POLICE_API)
        police_ok = isinstance(police_events, list)
    except (RuntimeError, json.JSONDecodeError) as error:
        print(f"VARNING Polisen: {error}")
        police_events, police_ok = [], False
    try:
        weather_warnings = fetch_json(SMHI_WARNINGS_API)
        weather_ok = isinstance(weather_warnings, list)
    except (RuntimeError, json.JSONDecodeError) as error:
        print(f"VARNING SMHI: {error}")
        weather_warnings, weather_ok = [], False

    municipalities = {}
    successful_sources = int(crisis_ok) + int(police_ok) + int(weather_ok)
    global_sources = source_config.get("global", [])
    automated_status = {
        "crisis": "ok" if crisis_ok else "error",
        "police": "ok" if police_ok else "error",
        "weather": "ok" if weather_ok else "error",
        "road": "ok" if road_traffic.get("generatedAt") else "error",
        "sos": "reference",
    }
    for municipality in config.get("municipalities", []):
        name = text(municipality, "name")
        county = text(municipality, "county")
        if not name:
            continue
        items = crisis_items(crises, name, county, now) if crisis_ok else []
        if police_ok:
            items.extend(police_items(police_events, name, now))
        else:
            previous = existing.get("municipalities", {}).get(name, {}).get("items", [])
            items.extend(recent_previous(previous, "police", now, 36))
        items.extend(traffic_items(transport, name, now))
        items.extend(road_items(road_traffic, name, now))
        if weather_ok:
            items.extend(weather_items(weather_warnings, county, now))

        source_health = [
            {**source, "status": automated_status.get(source.get("id"), "reference")}
            for source in global_sources
        ]
        for source in source_config.get("municipalities", {}).get(name, []):
            source_name, source_url = source.get("name"), source.get("url")
            try:
                local_items = municipal_items(source_name, source_url, now)
                items.extend(local_items)
                successful_sources += 1
                source_health.append({**source, "status": "ok"})
                print(f"{name}: {len(local_items)} kommunala driftmeddelanden")
            except RuntimeError as error:
                print(f"VARNING {source_name}: {error}")
                previous = existing.get("municipalities", {}).get(name, {}).get("items", [])
                items.extend(recent_previous(previous, "municipal", now))
                source_health.append({**source, "status": "error"})

        unique = {
            str(item.get("id")): item for item in items
            if item.get("id") and item.get("title") and int(item.get("priority") or 0) >= 70
        }
        sorted_items = sorted(
            unique.values(),
            key=lambda item: (item.get("priority", 0), item.get("publishedAt") or ""),
            reverse=True,
        )[:8]
        municipalities[name] = {
            "items": sorted_items,
            "checkedAt": now.isoformat(timespec="seconds"),
            "sourceHealth": source_health,
        }
        print(f"{name}: {len(sorted_items)} viktiga händelser totalt")

    if successful_sources == 0:
        print("Ingen officiell källa kunde nås; behåller befintlig fil")
        return 1
    output = {
        "version": "0.21.0",
        "generatedAt": now.isoformat(timespec="seconds"),
        "sources": global_sources,
        "municipalities": municipalities,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
