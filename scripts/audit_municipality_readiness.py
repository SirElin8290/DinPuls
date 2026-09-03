#!/usr/bin/env python3
"""Sammanfatta och validera hur väl varje DinPuls-kommun faktiskt är aktiverad."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
EXPECTED_MUNICIPALITIES = {
    "Åmål", "Bengtsfors", "Mellerud", "Dals-Ed", "Färgelanda",
    "Arvika", "Eda", "Filipstad", "Forshaga", "Grums", "Hagfors",
    "Hammarö", "Karlstad", "Kil", "Kristinehamn", "Munkfors",
    "Storfors", "Sunne", "Säffle", "Torsby", "Årjäng",
}


def load(name: str) -> dict:
    path = DATA / name
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def municipality_entry(payload: dict, name: str) -> dict:
    value = (payload.get("municipalities") or {}).get(name, {})
    return value if isinstance(value, dict) else {}


def count_list(value) -> int:
    return len(value) if isinstance(value, list) else 0


def normalized_name(value: object) -> str:
    return " ".join(str(value or "").casefold().split())


def merge_effective_named(payloads: tuple[dict, ...], key: str) -> list[dict]:
    """Spegel frontendens additiva datakedja och räkna varje verksamhet en gång."""
    result: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for payload in payloads:
        items = payload.get(key) if isinstance(payload.get(key), list) else []
        for item in items:
            if not isinstance(item, dict):
                continue
            identity = (str(item.get("municipality") or ""), normalized_name(item.get("name")))
            if not identity[0] or not identity[1] or identity in seen:
                continue
            seen.add(identity)
            result.append(item)
    return result


def count_named(items: list[dict], name: str) -> int:
    return sum(1 for item in items if item.get("municipality") == name)


def active_departure_count(stops: list[dict]) -> int:
    """Räkna bara användbara avgångar; gammal cache får inte göra kommunen grön."""
    now = datetime.now(timezone.utc) - timedelta(minutes=2)
    total = 0
    for stop in stops:
        for departure in stop.get("departures") if isinstance(stop, dict) else []:
            if not isinstance(departure, dict) or departure.get("canceled"):
                continue
            raw = departure.get("realtime") or departure.get("scheduled")
            try:
                value = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
                if value.tzinfo and value.astimezone(timezone.utc) >= now:
                    total += 1
            except (TypeError, ValueError):
                continue
    return total


def fresh_timestamp(value: object, max_age_minutes: int) -> bool:
    try:
        checked = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if not checked.tzinfo:
            return False
        age = datetime.now(timezone.utc) - checked.astimezone(timezone.utc)
        return timedelta(0) <= age <= timedelta(minutes=max_age_minutes)
    except (TypeError, ValueError):
        return False


def healthy_sources(entry: dict) -> bool:
    health = entry.get("sourceHealth")
    return isinstance(health, list) and bool(health) and all(
        isinstance(row, dict) and row.get("status") in {"ok", "reference"}
        for row in health
    )


def readiness_gaps(
    municipality: dict,
    *,
    current_weather: dict,
    transit_source_ok: bool,
    job: dict,
    homes: dict,
    housing_source_ok: bool,
    calendar: dict,
    meals: dict,
    sport: dict,
    free_time: dict,
    local_news: int,
    health_count: int,
    service_count: int,
) -> list[str]:
    """Returnera funktionella datagap utan att fabricera krav på volym."""
    gaps: list[str] = []
    providers = municipality.get("housingProviders") or []

    if not current_weather.get("time"):
        gaps.append("väder saknar live-data")
    if not transit_source_ok:
        gaps.append("kollektivtrafik saknar färsk, verifierad källstatus")
    if not count_list(job.get("jobs")):
        gaps.append("jobb saknar resultat")
    if providers and not (count_list(homes.get("listings")) or housing_source_ok):
        gaps.append("bostadskällan saknar verifierat friskt resultat")
    if municipality.get("eventSources") and not (
        count_list(calendar.get("events")) or healthy_sources(calendar)
    ):
        gaps.append("evenemangskällor saknar innehåll och frisk källstatus")
    lunch_references = meals.get("referenceSources")
    if not (count_list(meals.get("restaurants")) or count_list(lunch_references)):
        gaps.append("lunch saknar restaurang eller verifierad direktkälla")
    if municipality.get("associationImport") and not (
        count_list(sport.get("clubs")) or count_list(free_time.get("activities"))
    ):
        gaps.append("föreningsimport gav inget sport/fritid-innehåll")
    if not local_news:
        gaps.append("nyheter saknar lokala träffar")
    if not health_count:
        gaps.append("vård och hälsa saknar innehåll")
    if not service_count:
        gaps.append("service och hantverk saknar innehåll")

    return gaps


def main() -> None:
    config = load("municipalities.json")
    jobs = load("jobs.json")
    weather = load("weather-live.json")
    transport = load("transport.json")
    road = load("road-traffic.json")
    housing = load("housing.json")
    events = load("events.json")
    lunch = load("lunch.json")
    sports = load("sports.json")
    leisure = load("leisure.json")
    news = load("news.json")
    health = load("health.json")
    health_private = load("health-private.json")
    health_supplement = load("health-private-supplement.json")
    health_local = load("health-local-supplement.json")
    service = load("service.json")
    service_supplement = load("service-private-supplement.json")
    service_launch_supplement = load("service-launch-supplement.json")
    service_local_supplement = load("service-local-supplement.json")

    articles = news.get("articles") if isinstance(news.get("articles"), list) else []
    health_items = merge_effective_named(
        (health, health_supplement, health_local, health_private), "providers"
    )
    service_items = merge_effective_named(
        (service, service_supplement, service_launch_supplement, service_local_supplement), "businesses"
    )

    configured_names = [item.get("name") for item in config.get("municipalities", []) if item.get("name")]
    if len(configured_names) != 21 or set(configured_names) != EXPECTED_MUNICIPALITIES:
        raise SystemExit(
            "Kommunregistret ska innehålla exakt de 21 lanseringskommunerna; "
            f"fick {len(configured_names)} poster: {configured_names}"
        )

    indexed_payloads = {
        "jobb": jobs, "väder": weather, "kollektivtrafik": transport,
        "vägtrafik": road, "bostäder": housing, "evenemang": events,
        "lunch": lunch, "sport": sports, "fritid": leisure,
    }
    for label, payload in indexed_payloads.items():
        actual = set((payload.get("municipalities") or {}).keys())
        missing = EXPECTED_MUNICIPALITIES - actual
        if missing:
            raise SystemExit(f"{label} saknar kommunindex för: {', '.join(sorted(missing))}")

    failures = []
    print("DinPuls kommun-audit")
    print("=" * 78)
    for municipality in config.get("municipalities", []):
        name = municipality.get("name")
        if not name:
            continue

        job = municipality_entry(jobs, name)
        wx = municipality_entry(weather, name)
        transit = municipality_entry(transport, name)
        traffic = municipality_entry(road, name)
        homes = municipality_entry(housing, name)
        calendar = municipality_entry(events, name)
        meals = municipality_entry(lunch, name)
        sport = municipality_entry(sports, name)
        free_time = municipality_entry(leisure, name)

        stops = transit.get("stops") if isinstance(transit.get("stops"), list) else []
        departures = active_departure_count(stops)
        transit_source_ok = (
            bool(stops)
            and transit.get("sourceStatus") != "missing-stop-configuration"
            and all(not stop.get("error") for stop in stops if isinstance(stop, dict))
            and fresh_timestamp(transport.get("generatedAt"), 60)
        )
        local_news = sum(1 for article in articles if name in (article.get("municipalities") or []))
        providers = municipality.get("housingProviders") or []
        housing_machine_source = any(
            isinstance(provider, dict) and (provider.get("parser") or provider.get("dataUrl"))
            for provider in providers
        )
        if count_list(homes.get("listings")):
            housing_machine_source = True
        housing_source_ok = healthy_sources(homes) and (
            homes.get("availabilityMode") == "official-reference"
            or (
                homes.get("availabilityMode") == "automatic"
                and isinstance(homes.get("total"), int)
                and homes.get("total") == count_list(homes.get("listings"))
            )
        )

        nowcast = wx.get("nowcast") if isinstance(wx.get("nowcast"), dict) else {}
        current_weather = nowcast.get("current") if isinstance(nowcast.get("current"), dict) else {}
        health_count = count_named(health_items, name)
        service_count = count_named(service_items, name)
        is_pilot = municipality.get("launchMode") == "pilot"

        metrics = {
            "läge": "pilot" if is_pilot else "produktion",
            "jobb": count_list(job.get("jobs")),
            "väder": "live" if current_weather.get("time") else "scaffold",
            "avgångar": departures,
            "vägtrafik": count_list(traffic.get("items")),
            "bostäder": count_list(homes.get("listings")),
            "bostadskälla": "maskin" if housing_machine_source else ("länk" if providers else "saknas"),
            "evenemang": count_list(calendar.get("events")),
            "lunch": count_list(meals.get("restaurants")),
            "sport": count_list(sport.get("clubs")),
            "fritid": count_list(free_time.get("activities")),
            "nyheter": local_news,
            "vård": health_count,
            "service": service_count,
        }
        print(f"{name}: " + " · ".join(f"{key}={value}" for key, value in metrics.items()))

        gaps = readiness_gaps(
            municipality,
            current_weather=current_weather,
            transit_source_ok=transit_source_ok,
            job=job,
            homes=homes,
            housing_source_ok=housing_source_ok,
            calendar=calendar,
            meals=meals,
            sport=sport,
            free_time=free_time,
            local_news=local_news,
            health_count=health_count,
            service_count=service_count,
        )
        if is_pilot:
            print("  PILOT REST: " + ("; ".join(gaps) if gaps else "inga automatiska datagap upptäckta"))
        elif gaps:
            failures.extend(f"{name}: {gap}" for gap in gaps)

    if failures:
        raise SystemExit("Produktionsspärr:\n- " + "\n- ".join(failures))


if __name__ == "__main__":
    main()
