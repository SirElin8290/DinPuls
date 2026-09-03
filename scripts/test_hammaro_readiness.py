#!/usr/bin/env python3
"""Hammarö-specifik kontraktskontroll inför slutlig rendered QA.

Kontrollen speglar de datakällor som den riktiga frontenden använder och ska
fånga regressionsfel i Hammarö utan att kräva samma volym som större kommuner.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
NAME = "Hammarö"


def load(name: str) -> dict:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def municipality(payload: dict) -> dict:
    value = (payload.get("municipalities") or {}).get(NAME)
    assert isinstance(value, dict), f"{NAME}: kommunpost saknas"
    return value


def normalized(value: object) -> str:
    return " ".join(str(value or "").casefold().split())


def effective_named(files: tuple[str, ...], key: str) -> list[dict]:
    items: list[dict] = []
    seen: set[str] = set()
    for filename in files:
        payload = load(filename)
        for item in payload.get(key) if isinstance(payload.get(key), list) else []:
            if not isinstance(item, dict) or item.get("municipality") != NAME:
                continue
            identity = normalized(item.get("name"))
            if not identity or identity in seen:
                continue
            seen.add(identity)
            items.append(item)
    return items


def main() -> None:
    config = next(item for item in load("municipalities.json")["municipalities"] if item["name"] == NAME)
    assert config["code"] == "1761"
    assert config["transportSearchName"] == "Skoghall centrum"
    assert config["transportStops"] == [{"id": "740000820", "name": "Skoghall centrum"}]
    assert {normalized(item) for item in config.get("missingPeopleAliases", [])} >= {"hammarö", "skoghall"}

    lunch = municipality(load("lunch.json"))
    restaurants = lunch.get("restaurants") or []
    assert len(restaurants) >= 5, f"{NAME}: för få verifierade lunchreferenser: {len(restaurants)}"
    assert all(str(item.get("url", "")).startswith("https://") for item in restaurants)
    assert any(item.get("id") == "abbes-golfkrog-hammaro" for item in restaurants)
    abbes = next(item for item in restaurants if item.get("id") == "abbes-golfkrog-hammaro")
    assert abbes.get("mode") == "reference" and not abbes.get("days"), "Abbes får inte visa gissad/stale veckomeny"
    assert lunch.get("referenceSources"), f"{NAME}: lokal matguide saknas"

    health = effective_named(
        ("health.json", "health-private-supplement.json", "health-local-supplement.json", "health-private.json"),
        "providers",
    )
    assert len(health) >= 10, f"{NAME}: för tunt vårdutbud: {len(health)}"
    health_names = {item.get("name") for item in health}
    assert {"Vårdcentralen Skoghall", "Hammarö Fysioterapi", "Folktandvården Skoghall"} <= health_names

    service = effective_named(
        ("service.json", "service-private-supplement.json", "service-launch-supplement.json", "service-local-supplement.json"),
        "businesses",
    )
    assert len(service) >= 8, f"{NAME}: för tunt serviceutbud: {len(service)}"
    service_names = [normalized(item.get("name")) for item in service]
    assert len(service_names) == len(set(service_names)), f"{NAME}: exakt namndubblett i service"
    assert not ({"hammarö rörinstallationer", "hammarö rörinstallationer ab"} <= set(service_names)), "Hammarö Rör visas dubbelt"
    assert not ({"vvs partner i karlstad ab", "vvs partner karlstad ab"} <= set(service_names)), "VVS Partner visas dubbelt"
    categories = {str(item.get("category") or item.get("group") or "").strip() for item in service}
    assert len({value for value in categories if value}) >= 4, f"{NAME}: service behöver minst fyra kategorier"

    sports = municipality(load("sports.json"))
    clubs = sports.get("clubs") or []
    club_names = {item.get("name") for item in clubs}
    assert len(clubs) >= 8, f"{NAME}: för få sportföreningar: {len(clubs)}"
    assert {"Hammarö Golfklubb", "Skoghalls IBK", "IFK Skoghall"} <= club_names

    leisure = municipality(load("leisure.json"))
    activities = leisure.get("activities") or []
    activity_names = {item.get("name") for item in activities}
    assert len(activities) >= 12, f"{NAME}: för tunt fritidsutbud: {len(activities)}"
    assert {"Fritidsbanken Hammarö", "Hammarö Arena", "Hammarö bibliotek"} <= activity_names

    cinemas = (load("cinemas.json").get("municipalities") or {}).get(NAME) or []
    assert len(cinemas) == 1, f"{NAME}: förväntade en verifierad biograf"
    cinema = cinemas[0]
    assert cinema.get("name") == "Skoghalls Folkets Hus Bio"
    assert str(cinema.get("programUrl", "")).startswith("https://skoghallsfolketshus.se")
    assert str(cinema.get("bookingUrl", "")).startswith("https://skoghallsfolketshus.se")

    housing = municipality(load("housing.json"))
    assert housing.get("providers"), f"{NAME}: Hammaröbostäder saknas i genererad bostadsdata"
    assert housing.get("availabilityMode") in {"official-reference", "automatic"}
    assert any("hammar" in normalized(item.get("name") or item.get("provider")) for item in housing.get("providers", []))

    jobs = municipality(load("jobs.json"))
    assert jobs.get("jobs"), f"{NAME}: aktuella jobb saknas"

    events = municipality(load("events.json"))
    assert events.get("events") or events.get("sourceHealth"), f"{NAME}: evenemang saknar innehåll/källstatus"

    transport = municipality(load("transport.json"))
    stops = transport.get("stops") or []
    assert stops, f"{NAME}: transportstopp saknas"
    assert any(str(stop.get("id")) == "740000820" for stop in stops), f"{NAME}: fel hållplats i genererad transportdata"
    assert any(stop.get("departures") for stop in stops), f"{NAME}: avgångar saknas"

    weather = municipality(load("weather-live.json"))
    current = ((weather.get("nowcast") or {}).get("current") or {})
    assert current.get("time"), f"{NAME}: liveväder saknas"

    articles = load("news.json").get("articles") or []
    assert any(NAME in (item.get("municipalities") or []) for item in articles), f"{NAME}: lokala nyheter saknas"

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    intended_order = [
        'data-component="hero"',
        'data-component="missing-people"',
        'data-component="primary-cards"',
        'data-component="secondary-cards"',
        'data-component="transport"',
        'data-component="premium-ad-1"',
        'data-component="jobs-housing"',
        'data-component="premium-ad-2"',
        'data-component="health"',
        'data-component="sport"',
        'data-component="leisure"',
        'data-component="cinema"',
        'data-component="service"',
        'data-component="authorities"',
        'id="news-sources"',
        'data-component="premium-ad-3"',
    ]
    positions = [index.index(marker) for marker in intended_order]
    assert positions == sorted(positions), "Startsidesordningen avviker från aktuell beslutad layout"

    print(
        f"Hammarö grön datakontrakt: lunch={len(restaurants)}, vård={len(health)}, "
        f"service={len(service)}, sport={len(clubs)}, fritid={len(activities)}, "
        f"jobb={len(jobs.get('jobs') or [])}, bio={len(cinemas)}"
    )


if __name__ == "__main__":
    main()
