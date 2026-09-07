#!/usr/bin/env python3
"""DinPuls STRICT LIVE 100 % audit.

Bedömer alla 21 kommuner från noll enligt DINPULS-AUDIT-RULES.md.
Primärt används publicerade JSON-data från dinpuls.se när de kan hämtas;
repo-data används som fallback. Rapport skrivs till docs/STRICT-LIVE-AUDIT-LATEST.md.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
REPORT = ROOT / "docs" / "STRICT-LIVE-AUDIT-LATEST.md"
TZ = ZoneInfo("Europe/Stockholm")
NOW = datetime.now(TZ)
LIVE_BASE = "https://dinpuls.se/"

MUNICIPALITIES = [
    "Åmål", "Årjäng", "Bengtsfors", "Mellerud", "Arvika", "Grums", "Säffle",
    "Dals-Ed", "Eda", "Filipstad", "Forshaga", "Färgelanda", "Hagfors", "Hammarö",
    "Karlstad", "Kil", "Kristinehamn", "Munkfors", "Storfors", "Sunne", "Torsby",
]

FILES = [
    "municipalities.json", "important.json", "important-sources.json", "weather-live.json",
    "road-traffic.json", "transport.json", "flights.json", "jobs.json", "housing.json",
    "housing-fargelanda-supplement.json", "events.json", "events-fargelanda-supplement.json",
    "news.json", "missing-people.json", "health.json", "health-private.json",
    "health-private-supplement.json", "health-local-supplement.json",
    "health-karlstad-private-supplement.json", "health-fargelanda-supplement.json",
    "service.json", "service-private-supplement.json", "service-launch-supplement.json",
    "service-local-supplement.json", "authorities.json", "authorities-hagfors-supplement.json",
    "lunch.json", "cinemas.json", "leisure.json", "leisure-enrichment.json",
    "leisure-fargelanda-supplement.json", "sports.json", "sports-fargelanda-supplement.json",
    "community-sources.json", "community-posts.json",
]


def repo_json(name: str) -> dict:
    try:
        value = json.loads((DATA / name).read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def live_json(name: str) -> tuple[dict, str]:
    url = LIVE_BASE + "data/" + name
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "DinPuls-Strict-Audit/1.0"})
        with urllib.request.urlopen(req, timeout=12) as response:
            raw = response.read()
        value = json.loads(raw.decode("utf-8"))
        if isinstance(value, dict):
            return value, "live"
    except Exception:
        pass
    return repo_json(name), "repo-fallback"


def normalize(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().casefold())


def parse_dt(value: object) -> datetime | None:
    if value in (None, ""):
        return None
    text = str(value).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=TZ)
        return dt.astimezone(TZ)
    except Exception:
        return None


def age_ok(value: object, hours: int) -> bool:
    dt = parse_dt(value)
    if not dt:
        return False
    age = NOW - dt
    return timedelta(0) <= age <= timedelta(hours=hours)


def muni_entry(payload: dict, name: str) -> dict:
    row = (payload.get("municipalities") or {}).get(name, {})
    return row if isinstance(row, dict) else {}


def named_items(payload: dict, key: str, municipality: str) -> list[dict]:
    items = payload.get(key)
    if not isinstance(items, list):
        return []
    return [x for x in items if isinstance(x, dict) and x.get("municipality") == municipality]


def dedupe(items: list[dict]) -> list[dict]:
    out = []
    seen = set()
    for item in items:
        key = normalize(item.get("name") or item.get("title") or item.get("id") or item.get("address"))
        if not key:
            key = json.dumps(item, ensure_ascii=False, sort_keys=True)[:200]
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def config_map(config: dict) -> dict[str, dict]:
    result = {}
    for row in config.get("municipalities") or []:
        if isinstance(row, dict) and row.get("name"):
            result[row["name"]] = row
    return result


def categories(items: list[dict]) -> set[str]:
    out = set()
    for item in items:
        text = normalize(item.get("category") or item.get("type") or item.get("serviceType") or item.get("activityType"))
        if text:
            out.add(text)
    return out


def effective_health(data: dict[str, dict], name: str) -> list[dict]:
    items = []
    for fn in [
        "health.json", "health-private.json", "health-private-supplement.json",
        "health-local-supplement.json", "health-karlstad-private-supplement.json",
        "health-fargelanda-supplement.json",
    ]:
        payload = data[fn]
        items += named_items(payload, "providers", name)
        if payload.get("municipality") == name and isinstance(payload.get("providers"), list):
            items += [x for x in payload["providers"] if isinstance(x, dict)]
    return dedupe(items)


def effective_service(data: dict[str, dict], name: str) -> list[dict]:
    items = []
    for fn in ["service.json", "service-private-supplement.json", "service-launch-supplement.json", "service-local-supplement.json"]:
        items += named_items(data[fn], "businesses", name)
    return dedupe(items)


def effective_leisure(data: dict[str, dict], name: str) -> list[dict]:
    items = []
    base = muni_entry(data["leisure.json"], name)
    items += [x for x in (base.get("activities") or []) if isinstance(x, dict)]
    items += [x for x in (data["leisure-enrichment.json"].get("entries") or []) if isinstance(x, dict) and x.get("municipality") == name]
    f = data["leisure-fargelanda-supplement.json"]
    if f.get("municipality") == name:
        for key in ("activities", "entries"):
            items += [x for x in (f.get(key) or []) if isinstance(x, dict)]
    return dedupe(items)


def effective_sports(data: dict[str, dict], name: str) -> list[dict]:
    items = []
    base = muni_entry(data["sports.json"], name)
    items += [x for x in (base.get("clubs") or []) if isinstance(x, dict)]
    f = data["sports-fargelanda-supplement.json"]
    if f.get("municipality") == name:
        items += [x for x in (f.get("clubs") or []) if isinstance(x, dict)]
    return dedupe(items)


def event_items(data: dict[str, dict], name: str) -> list[dict]:
    items = [x for x in (muni_entry(data["events.json"], name).get("events") or []) if isinstance(x, dict)]
    f = data["events-fargelanda-supplement.json"]
    if f.get("municipality") == name:
        items += [x for x in (f.get("events") or []) if isinstance(x, dict)]
    # count only current/future where a date is parseable; keep undated current source items as published
    valid = []
    today = NOW.date()
    for item in items:
        raw = item.get("start") or item.get("startDate") or item.get("date") or item.get("datetime")
        dt = parse_dt(raw)
        if dt and dt.date() < today:
            continue
        valid.append(item)
    return dedupe(valid)


def housing_items(data: dict[str, dict], name: str) -> list[dict]:
    items = [x for x in (muni_entry(data["housing.json"], name).get("listings") or []) if isinstance(x, dict)]
    f = data["housing-fargelanda-supplement.json"]
    if f.get("municipality") == name:
        items += [x for x in (f.get("listings") or []) if isinstance(x, dict)]
    return dedupe(items)


def news_items(data: dict[str, dict], name: str) -> tuple[list[dict], int]:
    rows = []
    fresh = 0
    cutoff = NOW - timedelta(days=30)
    for a in data["news.json"].get("articles") or []:
        if not isinstance(a, dict) or name not in (a.get("municipalities") or []):
            continue
        rows.append(a)
        dt = parse_dt(a.get("publishedAt") or a.get("date") or a.get("published"))
        if dt is None or dt >= cutoff:
            fresh += 1
    return dedupe(rows), fresh


def authorities_score(data: dict[str, dict], name: str) -> tuple[bool, int, list[str]]:
    auth = data["authorities.json"]
    row = (auth.get("municipalities") or {}).get(name, {})
    row = row if isinstance(row, dict) else {}
    urls = row.get("serviceUrls") if isinstance(row.get("serviceUrls"), dict) else {}
    # Hagfors supplement may provide additional direct municipal links.
    sup = data["authorities-hagfors-supplement.json"]
    if sup.get("municipality") == name:
        extra = sup.get("serviceUrls") if isinstance(sup.get("serviceUrls"), dict) else {}
        urls = {**urls, **extra}
    essential = ["socialtjanst", "ekonomiskt-bistand", "budget-skuld", "aldreomsorg", "lss", "bygglov"]
    missing = [x for x in essential if not urls.get(x)]
    # Contactcenter can use the official municipality website as the common entry.
    has_contact = bool(row.get("website"))
    ok = has_contact and len(missing) == 0
    return ok, len(urls), missing


def classify(ok: bool, reason: str = "") -> tuple[str, str]:
    return ("🟢", "") if ok else ("🟡", reason)


def audit_one(name: str, data: dict[str, dict], config_by_name: dict[str, dict]) -> dict:
    c = config_by_name.get(name, {})
    modules: dict[str, tuple[str, str, str]] = {}

    def put(label: str, status: str, metric: str = "", reason: str = "") -> None:
        modules[label] = (status, metric, reason)

    put("Grundkonfiguration", *classify(bool(c and c.get("slug") and c.get("code")), "kommunregister ofullständigt"), metric="konfigurerad" if c else "saknas")

    imp = muni_entry(data["important.json"], name)
    imp_sources = (data["important-sources.json"].get("municipalities") or {}).get(name)
    put("Dagens viktigaste", *classify(bool(imp or imp_sources), "lokal källa/fallback saknas"), metric=str(len(imp.get("items") or [])) + " aktiva" if imp else "källa")

    wx = muni_entry(data["weather-live.json"], name)
    current = ((wx.get("nowcast") or {}).get("current") or {}) if isinstance(wx, dict) else {}
    wx_ok = bool(current.get("time")) and age_ok(data["weather-live.json"].get("generatedAt"), 6)
    put("Väder", *classify(wx_ok, "aktuell liveväderdata saknas"), metric="live" if wx_ok else "saknas/stale")

    road = muni_entry(data["road-traffic.json"], name)
    road_generated = data["road-traffic.json"].get("generatedAt")
    road_ok = bool(road) and (age_ok(road_generated, 12) or bool(road.get("sourceStatus") or road.get("items") is not None))
    put("Vägtrafik", *classify(road_ok, "fungerande aktuell trafikkälla kan inte verifieras"), metric=f"{len(road.get('items') or [])} händelser")

    tr = muni_entry(data["transport.json"], name)
    stops = [x for x in (tr.get("stops") or []) if isinstance(x, dict)]
    dep = 0
    for stop in stops:
        dep += sum(1 for d in (stop.get("departures") or []) if isinstance(d, dict) and not d.get("canceled"))
    tr_ok = bool(stops) and tr.get("sourceStatus") != "missing-stop-configuration" and all(not x.get("error") for x in stops)
    put("Kollektivtrafik", *classify(tr_ok, "hållplats/aktuell transportkälla saknas eller felar"), metric=f"{len(stops)} hållplatser / {dep} avgångar")

    fl = muni_entry(data["flights.json"], name)
    fl_ok = bool(fl) or bool(data["flights.json"].get("airports"))
    put("Flyg", *classify(fl_ok, "användbar flyginformation saknas"), metric="konfigurerad" if fl_ok else "saknas")

    jobs = [x for x in (muni_entry(data["jobs.json"], name).get("jobs") or []) if isinstance(x, dict)]
    put("Jobb", *(classify(len(jobs) >= 3, f"endast {len(jobs)} aktuella lokala jobb; minst 3 krävs")), metric=str(len(jobs)))

    homes = housing_items(data, name)
    put("Bostäder", *(classify(len(homes) >= 1, "inga faktiska aktuella lediga objekt; minst 1 krävs")), metric=str(len(homes)))

    evs = event_items(data, name)
    put("Evenemang", *(classify(len(evs) >= 5, f"endast {len(evs)} aktuella/framtida evenemang; minst 5 krävs")), metric=str(len(evs)))

    news, fresh_news = news_items(data, name)
    news_ok = len(news) >= 5 and fresh_news >= 3
    put("Nyheter", *(classify(news_ok, f"{len(news)} lokala nyheter varav {fresh_news} inom cirka 30 dagar; minst 5 och tydlig aktualitet krävs")), metric=f"{len(news)} / {fresh_news} färska")

    mp = muni_entry(data["missing-people.json"], name)
    neighbors = c.get("neighbors") if isinstance(c.get("neighbors"), list) else []
    mp_ok = bool(mp or neighbors or c.get("missingPeopleAliases"))
    put("Missing People", *classify(mp_ok, "lokal/grannkommunal logik kan inte verifieras"), metric=f"{len(neighbors)} grannar")

    health = effective_health(data, name)
    hcats = categories(health)
    health_ok = len(health) >= 5 and len(hcats) >= 3
    put("Vård & hälsa", *(classify(health_ok, f"{len(health)} verksamheter i {len(hcats)} kategorier; minst 5 och rimlig bredd krävs")), metric=f"{len(health)} / {len(hcats)} kat")

    service = effective_service(data, name)
    scats = categories(service)
    service_ok = len(service) >= 8 and len(scats) >= 4
    put("Service & hantverk", *(classify(service_ok, f"{len(service)} företag i {len(scats)} kategorier; minst 8 företag och 4 kategorier krävs")), metric=f"{len(service)} / {len(scats)} kat")

    auth_ok, auth_count, auth_missing = authorities_score(data, name)
    auth_reason = "saknar direkta centrala kommunlänkar: " + ", ".join(auth_missing) if auth_missing else "centrala myndighetsingångar ofullständiga"
    put("Myndigheter", *classify(auth_ok, auth_reason), metric=f"{auth_count} lokala länkar")

    lunch = [x for x in (muni_entry(data["lunch.json"], name).get("restaurants") or []) if isinstance(x, dict)]
    put("Dagens lunch", *(classify(len(lunch) >= 4, f"endast {len(lunch)} verifierade lunchställen; minst 4 krävs")), metric=str(len(lunch)))

    cinemas = (data["cinemas.json"].get("municipalities") or {}).get(name, [])
    cinemas = cinemas if isinstance(cinemas, list) else []
    # If repo explicitly has no local cinema, strict audit cannot infer non-existence; mark yellow.
    cinema_ok = bool(cinemas) and all(bool(x.get("programUrl") or x.get("bookingUrl")) for x in cinemas if isinstance(x, dict))
    put("Bio", *classify(cinema_ok, "ingen verifierad lokal bio/programkälla eller korrekt 'ingen lokal bio'-hantering"), metric=str(len(cinemas)))

    leisure = effective_leisure(data, name)
    put("Fritid & aktiviteter", *(classify(len(leisure) >= 10, f"endast {len(leisure)} lokala aktiviteter/anläggningar; minst 10 krävs")), metric=str(len(leisure)))

    sports = effective_sports(data, name)
    put("Idrott & föreningar", *(classify(len(sports) >= 20, f"endast {len(sports)} lokala föreningar; minst 20 krävs om inte verifierat verkligt utbud är mindre")), metric=str(len(sports)))

    community_ok = isinstance(data["community-sources.json"], dict) and isinstance(data["community-posts.json"], dict)
    put("Community", *classify(community_ok, "communityfunktionen kan inte verifieras"), metric="källa/fallback")

    yellow = [label for label, (status, _, _) in modules.items() if status != "🟢"]
    return {"name": name, "modules": modules, "overall": "🟢 100 %" if not yellow else "🟡 EJ 100 %", "blockers": yellow}


def main() -> int:
    data: dict[str, dict] = {}
    origins = {}
    for fn in FILES:
        payload, origin = live_json(fn)
        data[fn] = payload
        origins[fn] = origin

    config_by_name = config_map(data["municipalities.json"])
    results = [audit_one(name, data, config_by_name) for name in MUNICIPALITIES]

    live_count = sum(1 for x in origins.values() if x == "live")
    repo_count = len(origins) - live_count
    green = [r["name"] for r in results if r["overall"].startswith("🟢")]

    lines = [
        "# DinPuls – STRICT LIVE 100 % audit",
        "",
        f"Genererad: {NOW.isoformat(timespec='seconds')}",
        f"Datakälla: {live_count} filer hämtade från publicerad dinpuls.se, {repo_count} repo-fallback.",
        "",
        "Denna rapport nollställer tidigare status och använder `DINPULS-AUDIT-RULES.md`. Hero och Matkassen ingår inte.",
        "",
        f"## Resultat: {len(green)} av 21 kommuner når 100 %",
        "",
        ("**100 % gröna:** " + ", ".join(green)) if green else "**100 % gröna:** inga.",
        "",
        "| Kommun | Totalstatus | Jobb | Bostäder | Event | Nyheter | Vård | Service | Lunch | Fritid | Föreningar |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for r in results:
        m = r["modules"]
        metric = lambda k: m[k][1]
        lines.append(
            f"| {r['name']} | {r['overall']} | {metric('Jobb')} | {metric('Bostäder')} | {metric('Evenemang')} | {metric('Nyheter')} | {metric('Vård & hälsa')} | {metric('Service & hantverk')} | {metric('Dagens lunch')} | {metric('Fritid & aktiviteter')} | {metric('Idrott & föreningar')} |"
        )

    lines += ["", "## Blockerare per kommun", ""]
    for r in results:
        if not r["blockers"]:
            lines.append(f"### {r['name']} — 🟢 100 %")
            lines.append("Samtliga obligatoriska moduler passerar den strikta auditen.")
            lines.append("")
            continue
        lines.append(f"### {r['name']} — 🟡 EJ 100 %")
        for label in r["blockers"]:
            status, metric, reason = r["modules"][label]
            lines.append(f"- **{label}:** {status} — {reason} ({metric})")
        lines.append("")

    lines += ["## Modulmatris", ""]
    module_names = list(results[0]["modules"].keys())
    lines.append("| Kommun | " + " | ".join(module_names) + " |")
    lines.append("|---|" + "---:|" * len(module_names))
    for r in results:
        lines.append("| " + r["name"] + " | " + " | ".join(r["modules"][k][0] for k in module_names) + " |")

    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines[:40]))
    print(f"\nRapport: {REPORT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
