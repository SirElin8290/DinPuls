#!/usr/bin/env python3
"""Sammanfatta och validera hur väl varje DinPuls-kommun faktiskt är aktiverad."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


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


def count_named(items, name: str) -> int:
    return sum(1 for item in items if isinstance(item, dict) and item.get("municipality") == name)


def pilot_gaps(
    municipality: dict,
    *,
    current_weather: dict,
    departures: int,
    job: dict,
    homes: dict,
    housing_machine_source: bool,
    calendar: dict,
    meals: dict,
    sport: dict,
    free_time: dict,
    local_news: int,
    health_count: int,
    service_count: int,
) -> list[str]:
    """Returnera konkreta datagap för en pilotkommun utan att fabricera krav på volym.

    En liten kommun får naturligt ha färre poster än en stor kommun. Här testas därför
    framför allt om centrala moduler faktiskt har kommit igång, inte om alla kommuner
    når samma absoluta antal poster.
    """
    gaps: list[str] = []
    providers = municipality.get("housingProviders") or []

    if not current_weather.get("time"):
        gaps.append("väder saknar live-data")
    if not departures:
        gaps.append("kollektivtrafik saknar avgångar")
    if not count_list(job.get("jobs")):
        gaps.append("jobb saknar resultat")
    if providers and not count_list(homes.get("listings")):
        if housing_machine_source:
            gaps.append("bostadskälla finns men gav 0 objekt")
        else:
            gaps.append("bostadskälla finns men saknar maskinläsbar import")
    if municipality.get("eventSources") and not count_list(calendar.get("events")):
        gaps.append("evenemangskällor finns men gav inget innehåll")
    if municipality.get("lunchSources") and not count_list(meals.get("restaurants")):
        gaps.append("lunchkälla finns men gav inget innehåll")
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
    service = load("service.json")
    service_supplement = load("service-private-supplement.json")

    articles = news.get("articles") if isinstance(news.get("articles"), list) else []
    health_items = []
    for payload in (health, health_private, health_supplement):
        health_items.extend(payload.get("providers") if isinstance(payload.get("providers"), list) else [])
    service_items = []
    for payload in (service, service_supplement):
        service_items.extend(payload.get("businesses") if isinstance(payload.get("businesses"), list) else [])

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
        departures = sum(count_list(stop.get("departures")) for stop in stops if isinstance(stop, dict))
        local_news = sum(1 for article in articles if name in (article.get("municipalities") or []))
        providers = municipality.get("housingProviders") or []
        housing_machine_source = any(
            isinstance(provider, dict) and (provider.get("parser") or provider.get("dataUrl"))
            for provider in providers
        )
        # Specialimporter kan vara maskinläsbara via separat updater även om parsern
        # inte ligger i municipalities.json. Faktiska objekt är då beviset.
        if count_list(homes.get("listings")):
            housing_machine_source = True

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

        if not is_pilot:
            if not health_count:
                failures.append(f"{name}: produktionskommun saknar vård- och hälsodata")
            if not service_count:
                failures.append(f"{name}: produktionskommun saknar serviceföretag")
            if providers and not count_list(homes.get("listings")):
                failures.append(f"{name}: produktionskommun har bostadskälla men 0 bostadsobjekt")
        else:
            gaps = pilot_gaps(
                municipality,
                current_weather=current_weather,
                departures=departures,
                job=job,
                homes=homes,
                housing_machine_source=housing_machine_source,
                calendar=calendar,
                meals=meals,
                sport=sport,
                free_time=free_time,
                local_news=local_news,
                health_count=health_count,
                service_count=service_count,
            )
            print("  PILOT REST: " + ("; ".join(gaps) if gaps else "inga automatiska datagap upptäckta"))

    if failures:
        raise SystemExit("Produktionsspärr:\n- " + "\n- ".join(failures))


if __name__ == "__main__":
    main()
