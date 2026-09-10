#!/usr/bin/env python3
"""DinPuls STRICT LIVE v4 audit.

V4 använder Åmål som kvalitativ kalibreringskommun. Fasta numeriska miniminivåer
är inte statusgrindar. GREEN blockeras av tekniska fel eller kända väsentliga
luckor, inte av teoretisk osäkerhet om okända aktörer.
"""
from __future__ import annotations

import json
import re
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
REPORT = ROOT / "docs" / "STRICT-LIVE-AUDIT-LATEST.md"
GAPS_FILE = DATA / "strict-live-v4-gaps.json"
TZ = ZoneInfo("Europe/Stockholm")
NOW = datetime.now(TZ)
LIVE = "https://dinpuls.se/data/"

MUNIS = [
    "Åmål", "Årjäng", "Bengtsfors", "Mellerud", "Arvika", "Grums", "Säffle",
    "Dals-Ed", "Eda", "Filipstad", "Forshaga", "Färgelanda", "Hagfors",
    "Hammarö", "Karlstad", "Kil", "Kristinehamn", "Munkfors", "Storfors",
    "Sunne", "Torsby",
]

FILES = [
    "municipalities.json", "important.json", "important-sources.json",
    "weather-live.json", "road-traffic.json", "transport.json", "flights.json",
    "jobs.json", "housing.json", "housing-fargelanda-supplement.json",
    "events.json", "events-fargelanda-supplement.json", "news.json",
    "missing-people.json", "health.json", "health-private.json",
    "health-private-supplement.json", "health-local-supplement.json",
    "health-karlstad-private-supplement.json", "health-fargelanda-supplement.json",
    "health-eda-supplement.json", "service.json", "service-private-supplement.json",
    "service-launch-supplement.json", "service-local-supplement.json",
    "authorities.json", "authorities-hagfors-supplement.json",
    "authorities-arjang-supplement.json", "authorities-arvika-supplement.json",
    "lunch.json", "cinemas.json", "leisure.json", "leisure-enrichment.json",
    "leisure-fargelanda-supplement.json", "sports.json",
    "sports-fargelanda-supplement.json", "association-hagfors-supplement.json",
    "community-sources.json", "community-posts.json",
]


def load_repo(fn: str) -> dict:
    try:
        value = json.loads((DATA / fn).read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def load_live(fn: str) -> tuple[dict, str]:
    try:
        req = urllib.request.Request(
            LIVE + fn + "?strict=" + str(int(NOW.timestamp())),
            headers={
                "User-Agent": "DinPuls-Strict-Audit/4.0",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
            },
        )
        with urllib.request.urlopen(req, timeout=8) as response:
            value = json.loads(response.read().decode("utf-8"))
        if isinstance(value, dict):
            return value, "live"
    except Exception:
        pass
    return load_repo(fn), "repo-fallback"


def norm(value) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().casefold())


def parse_dt(value):
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=TZ)
        return parsed.astimezone(TZ)
    except Exception:
        return None


def fresh(value, hours: int) -> bool:
    parsed = parse_dt(value)
    return bool(parsed and timedelta(0) <= NOW - parsed <= timedelta(hours=hours))


def me(payload: dict, name: str) -> dict:
    row = (payload.get("municipalities") or {}).get(name, {})
    return row if isinstance(row, dict) else {}


def dedupe(items: list[dict]) -> list[dict]:
    out, seen = [], set()
    for item in items:
        if not isinstance(item, dict):
            continue
        key = norm(item.get("id") or item.get("url") or item.get("name") or item.get("title") or item.get("address"))
        if not key:
            key = json.dumps(item, ensure_ascii=False, sort_keys=True)[:200]
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def named(payload: dict, key: str, name: str) -> list[dict]:
    return [item for item in (payload.get(key) or []) if isinstance(item, dict) and item.get("municipality") == name]


def effective_named(data: dict, name: str, files: list[str], key: str) -> list[dict]:
    items = []
    for fn in files:
        payload = data[fn]
        items += named(payload, key, name)
        if payload.get("municipality") == name and isinstance(payload.get(key), list):
            items += [item for item in payload[key] if isinstance(item, dict)]
    return dedupe(items)


def categories(items: list[dict]) -> set[str]:
    return {
        norm(item.get("category") or item.get("type") or item.get("serviceType") or item.get("activityType"))
        for item in items
        if norm(item.get("category") or item.get("type") or item.get("serviceType") or item.get("activityType"))
    }


def homes(data: dict, name: str) -> list[dict]:
    items = [item for item in (me(data["housing.json"], name).get("listings") or []) if isinstance(item, dict)]
    supplement = data["housing-fargelanda-supplement.json"]
    if supplement.get("municipality") == name:
        items += [item for item in (supplement.get("listings") or []) if isinstance(item, dict)]
    return dedupe(items)


def events(data: dict, name: str) -> list[dict]:
    items = [item for item in (me(data["events.json"], name).get("events") or []) if isinstance(item, dict)]
    supplement = data["events-fargelanda-supplement.json"]
    if supplement.get("municipality") == name:
        items += [item for item in (supplement.get("events") or []) if isinstance(item, dict)]
    current = []
    for item in items:
        when = parse_dt(item.get("start") or item.get("startDate") or item.get("date") or item.get("datetime"))
        if when is None or when.date() >= NOW.date():
            current.append(item)
    return dedupe(current)


def news(data: dict, name: str) -> tuple[list[dict], int]:
    items, recent = [], 0
    cutoff = NOW - timedelta(days=30)
    for item in data["news.json"].get("articles") or []:
        if not isinstance(item, dict) or name not in (item.get("municipalities") or []):
            continue
        items.append(item)
        when = parse_dt(item.get("publishedAt") or item.get("date") or item.get("published"))
        if when is None or when >= cutoff:
            recent += 1
    return dedupe(items), recent


def leisure(data: dict, name: str) -> list[dict]:
    items = [item for item in (me(data["leisure.json"], name).get("activities") or []) if isinstance(item, dict)]
    items += [item for item in (data["leisure-enrichment.json"].get("entries") or []) if isinstance(item, dict) and item.get("municipality") == name]
    supplement = data["leisure-fargelanda-supplement.json"]
    if supplement.get("municipality") == name:
        for key in ("activities", "entries"):
            items += [item for item in (supplement.get(key) or []) if isinstance(item, dict)]
    return dedupe(items)


def sports(data: dict, name: str) -> list[dict]:
    items = [item for item in (me(data["sports.json"], name).get("clubs") or []) if isinstance(item, dict)]
    supplement = data["sports-fargelanda-supplement.json"]
    if supplement.get("municipality") == name:
        items += [item for item in (supplement.get("clubs") or []) if isinstance(item, dict)]
    items += [item for item in (me(data["association-hagfors-supplement.json"], name).get("clubs") or []) if isinstance(item, dict)]
    return dedupe(items)


def authorities(data: dict, name: str) -> tuple[bool, int, list[str]]:
    row = (data["authorities.json"].get("municipalities") or {}).get(name, {}) or {}
    urls = dict(row.get("serviceUrls") or {})
    website = row.get("website")
    for fn in ("authorities-hagfors-supplement.json", "authorities-arjang-supplement.json", "authorities-arvika-supplement.json"):
        payload = data[fn]
        nested = (payload.get("municipalities") or {}).get(name, {}) if isinstance(payload.get("municipalities"), dict) else {}
        if isinstance(nested, dict):
            urls.update(nested.get("serviceUrls") or {})
            website = website or nested.get("website")
        if payload.get("municipality") == name:
            urls.update(payload.get("serviceUrls") or {})
            website = website or payload.get("website")
    required = ["socialtjanst", "ekonomiskt-bistand", "budget-skuld", "aldreomsorg", "lss", "bygglov"]
    missing = [key for key in required if not urls.get(key)]
    return bool(website) and not missing, len(urls), missing


def configuration(data: dict) -> dict:
    return {item.get("name"): item for item in data["municipalities.json"].get("municipalities") or [] if isinstance(item, dict) and item.get("name")}


def load_gaps() -> dict:
    try:
        payload = json.loads(GAPS_FILE.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def audit(name: str, data: dict, config: dict, gaps: dict | None = None) -> dict:
    gaps = gaps or load_gaps()
    row = config.get(name, {}) or {}
    modules: dict[str, tuple[str, str, str]] = {}

    def put(label: str, status: str, metric: str = "", reason: str = ""):
        modules[label] = (status, metric, reason)

    cfg_ok = bool(row.get("slug") and row.get("code"))
    put("Grundkonfiguration", "🟢" if cfg_ok else "🔴", "konfigurerad" if cfg_ok else "saknas", "kommunregister ofullständigt" if not cfg_ok else "")

    imp = me(data["important.json"], name)
    imp_source = (data["important-sources.json"].get("municipalities") or {}).get(name)
    imp_ok = bool(imp or imp_source)
    put("Dagens viktigaste", "🟢" if imp_ok else "🔴", f"{len(imp.get('items') or [])} aktiva" if imp else "källa", "lokal källa/fallback saknas" if not imp_ok else "")

    weather = me(data["weather-live.json"], name)
    current = ((weather.get("nowcast") or {}).get("current") or {}) if isinstance(weather, dict) else {}
    weather_ok = bool(current.get("time")) and fresh(data["weather-live.json"].get("generatedAt"), 6)
    put("Väder", "🟢" if weather_ok else "🔴", "live" if weather_ok else "saknas/stale", "aktuell liveväderdata saknas" if not weather_ok else "")

    road = me(data["road-traffic.json"], name)
    road_ok = bool(road) and (fresh(data["road-traffic.json"].get("generatedAt"), 12) or road.get("items") is not None)
    put("Vägtrafik", "🟢" if road_ok else "🔴", f"{len(road.get('items') or [])} händelser", "fungerande trafikkälla kan inte verifieras" if not road_ok else "")

    transport = me(data["transport.json"], name)
    stops = [item for item in (transport.get("stops") or []) if isinstance(item, dict)]
    departures = sum(len([d for d in (stop.get("departures") or []) if isinstance(d, dict) and not d.get("canceled")]) for stop in stops)
    transport_ok = bool(stops) and transport.get("sourceStatus") != "missing-stop-configuration" and all(not stop.get("error") for stop in stops)
    put("Kollektivtrafik", "🟢" if transport_ok else "🔴", f"{len(stops)} hållplatser / {departures} avgångar", "transportkälla saknas eller felar" if not transport_ok else "")

    flight = me(data["flights.json"], name)
    flight_ok = bool(flight) or bool(data["flights.json"].get("airports"))
    put("Flyg", "🟢" if flight_ok else "🔴", "konfigurerad" if flight_ok else "saknas", "användbar flyginformation saknas" if not flight_ok else "")

    jobs = [item for item in (me(data["jobs.json"], name).get("jobs") or []) if isinstance(item, dict)]
    put("Jobb", "🟢" if jobs else "🟡", str(len(jobs)), "inga aktuella lokala jobb och inget verifierat nolläge" if not jobs else "")

    housing = homes(data, name)
    put("Bostäder", "🟢" if housing else "🟡", str(len(housing)), "inga aktuella bostäder och inget verifierat nolläge" if not housing else "")

    event_items = events(data, name)
    put("Evenemang", "🟢" if event_items else "🟡", str(len(event_items)), "inga aktuella/framtida evenemang och inget verifierat nolläge" if not event_items else "")

    news_items, news_fresh = news(data, name)
    put("Nyheter", "🟢" if news_items and news_fresh else "🟡", f"{len(news_items)} / {news_fresh} färska", "lokala aktuella nyheter saknas" if not (news_items and news_fresh) else "")

    missing = me(data["missing-people.json"], name)
    neighbours = row.get("neighbors") if isinstance(row.get("neighbors"), list) else []
    missing_ok = bool(missing or neighbours or row.get("missingPeopleAliases"))
    put("Missing People", "🟢" if missing_ok else "🔴", f"{len(neighbours)} grannar", "lokal/grannkommunal logik kan inte verifieras" if not missing_ok else "")

    health = effective_named(data, name, ["health-eda-supplement.json", "health.json", "health-private.json", "health-private-supplement.json", "health-local-supplement.json", "health-karlstad-private-supplement.json", "health-fargelanda-supplement.json"], "providers")
    health_cats = categories(health)
    put("Vård & hälsa", "🟢" if health else "🟡", f"{len(health)} / {len(health_cats)} kat", "ingen användbar lokal vårdtäckning" if not health else "")

    service = effective_named(data, name, ["service.json", "service-private-supplement.json", "service-launch-supplement.json", "service-local-supplement.json"], "businesses")
    service_cats = categories(service)
    put("Service & hantverk", "🟢" if service else "🟡", f"{len(service)} / {len(service_cats)} kat", "ingen användbar lokal servicekatalog" if not service else "")

    auth_ok, auth_count, auth_missing = authorities(data, name)
    put("Myndigheter", "🟢" if auth_ok else "🔴", f"{auth_count} lokala länkar", "saknar centrala direktlänkar: " + ", ".join(auth_missing) if auth_missing else ("centrala ingångar ofullständiga" if not auth_ok else ""))

    lunch_row = me(data["lunch.json"], name)
    lunch = [item for item in (lunch_row.get("restaurants") or []) if isinstance(item, dict)]
    actual_supply = lunch_row.get("actualLocalLunchSupply")
    verified_supply = lunch_row.get("actualSupplyVerified") is True
    lunch_metric = str(len(lunch))
    if verified_supply and actual_supply is not None:
        lunch_metric = f"{len(lunch)} / {actual_supply} verifierat faktiskt utbud"
    put("Dagens lunch", "🟢" if lunch else "🟡", lunch_metric, "inga verifierade lunchställen" if not lunch else "")

    cinemas = (data["cinemas.json"].get("municipalities") or {}).get(name, [])
    cinemas = cinemas if isinstance(cinemas, list) else []
    cinema_ok = bool(cinemas) and all(bool(item.get("programUrl") or item.get("bookingUrl")) for item in cinemas if isinstance(item, dict))
    put("Bio", "🟢" if cinema_ok else "🟡", str(len(cinemas)), "ingen verifierad lokal bio/programkälla eller korrekt nollhantering" if not cinema_ok else "")

    leisure_items = leisure(data, name)
    put("Fritid & aktiviteter", "🟢" if leisure_items else "🟡", str(len(leisure_items)), "inget användbart lokalt fritidsunderlag" if not leisure_items else "")

    sport_items = sports(data, name)
    put("Idrott & föreningar", "🟢" if sport_items else "🟡", str(len(sport_items)), "inget användbart lokalt föreningsunderlag" if not sport_items else "")

    community_ok = isinstance(data["community-sources.json"], dict) and isinstance(data["community-posts.json"], dict)
    put("Community", "🟢" if community_ok else "🔴", "källa/fallback", "communityfunktionen kan inte verifieras" if not community_ok else "")

    municipality_gap = ((gaps.get("municipalities") or {}).get(name) or {}) if isinstance(gaps, dict) else {}
    for gap in municipality_gap.get("gaps") or []:
        if not isinstance(gap, dict):
            continue
        module = gap.get("module")
        reason = str(gap.get("reason") or "känd väsentlig lucka")
        if module in modules and modules[module][0] != "🔴":
            modules[module] = ("🟡", modules[module][1], reason)

    red = [key for key, value in modules.items() if value[0] == "🔴"]
    yellow = [key for key, value in modules.items() if value[0] == "🟡"]
    overall = "🔴 RED" if red else ("🟡 YELLOW" if yellow else "🟢 GREEN")
    return {"name": name, "modules": modules, "red": red, "yellow": yellow, "overall": overall}


def main() -> int:
    data, origin = {}, {}
    for fn in FILES:
        data[fn], origin[fn] = load_live(fn)
    cfg = configuration(data)
    gaps = load_gaps()
    results = [audit(name, data, cfg, gaps) for name in MUNIS]

    green = [row["name"] for row in results if row["overall"] == "🟢 GREEN"]
    yellow = [row["name"] for row in results if row["overall"] == "🟡 YELLOW"]
    red = [row["name"] for row in results if row["overall"] == "🔴 RED"]

    lines = [
        "# DinPuls – STRICT LIVE v4 audit", "",
        f"Genererad: {NOW.isoformat(timespec='seconds')}",
        f"Datakälla: {sum(value == 'live' for value in origin.values())} livefiler, {sum(value != 'live' for value in origin.values())} repo-fallback.",
        "Kalibreringskommun: Åmål.", "",
        "Fasta numeriska miniminivåer används inte som statusgrindar. GREEN blockeras av tekniska fel eller dokumenterade kända väsentliga luckor enligt v4.", "",
        f"## Resultat: {len(green)} GREEN / {len(yellow)} YELLOW / {len(red)} RED", "",
        "**GREEN:** " + (", ".join(green) if green else "inga"), "",
        "**YELLOW:** " + (", ".join(yellow) if yellow else "inga"), "",
        "**RED:** " + (", ".join(red) if red else "inga"), "",
        "| Kommun | Totalstatus | Jobb | Bostäder | Event | Nyheter | Vård | Service | Lunch | Fritid | Föreningar |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for row in results:
        modules = row["modules"]
        metric = lambda key: modules[key][1]
        lines.append(f"| {row['name']} | {row['overall']} | {metric('Jobb')} | {metric('Bostäder')} | {metric('Evenemang')} | {metric('Nyheter')} | {metric('Vård & hälsa')} | {metric('Service & hantverk')} | {metric('Dagens lunch')} | {metric('Fritid & aktiviteter')} | {metric('Idrott & föreningar')} |")

    lines += ["", "## Blockerare per kommun", ""]
    for row in results:
        lines.append(f"### {row['name']} — {row['overall']}")
        blockers = row["red"] + row["yellow"]
        if not blockers:
            lines.append("Ingen känd väsentlig lucka eller teknisk blockerare. Kommunen når v4 GREEN.")
        else:
            for key in blockers:
                status, metric, reason = row["modules"][key]
                lines.append(f"- **{key}:** {status} — {reason or 'kräver åtgärd'} ({metric})")
        lines.append("")

    lines += ["## V4-princip", "", "En BLOCKED provider utan belägg för aktuellt saknat innehåll blockerar inte automatiskt GREEN. Konkret aktuell saknad data, uppenbart oproportionerligt tunn modul eller tekniskt fel gör däremot kommunen YELLOW eller RED.", "", "Hero och Matkassen ingår inte."]
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"STRICT LIVE v4: {len(green)} GREEN / {len(yellow)} YELLOW / {len(red)} RED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
