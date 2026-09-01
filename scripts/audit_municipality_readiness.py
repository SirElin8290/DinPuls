#!/usr/bin/env python3
"""Sammanfatta hur väl varje DinPuls-kommun faktiskt är aktiverad.

Skriptet skiljer på central konfiguration, tom scaffold och verkligt genererat
innehåll. Det gör kommun-onboarding verifierbar utan manuell genomgång av stora
JSON-filer. Det ändrar inga filer och gör inga nätverksanrop.
"""
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

    articles = news.get("articles") if isinstance(news.get("articles"), list) else []

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
        nowcast = wx.get("nowcast") if isinstance(wx.get("nowcast"), dict) else {}
        current_weather = nowcast.get("current") if isinstance(nowcast.get("current"), dict) else {}

        metrics = {
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
        }
        rendered = " · ".join(f"{key}={value}" for key, value in metrics.items())
        print(f"{name}: {rendered}")

        if name == "Eda":
            gaps = []
            if not current_weather.get("time"): gaps.append("väder saknar live-data")
            if not departures: gaps.append("kollektivtrafik saknar avgångar")
            if not count_list(job.get("jobs")): gaps.append("jobb saknar resultat")
            if providers and not housing_machine_source: gaps.append("bostäder har bara officiell länk, ingen maskinläsbar parser")
            if not count_list(calendar.get("events")): gaps.append("evenemang är ännu inte importerade")
            if municipality.get("lunchSources") and not count_list(meals.get("restaurants")): gaps.append("lunchkälla finns men gav inget innehåll")
            if municipality.get("associationImport") and not (count_list(sport.get("clubs")) or count_list(free_time.get("activities"))): gaps.append("föreningsimport gav inget sport/fritid-innehåll")
            if not local_news: gaps.append("nyheter saknar lokala träffar")
            print("  EDA REST: " + ("; ".join(gaps) if gaps else "inga automatiska datagap upptäckta"))


if __name__ == "__main__":
    main()
