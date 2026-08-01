#!/usr/bin/env python3
"""Små regressionsprov för filtreringen i Dagens viktigaste."""
from datetime import datetime, timezone

import update_important as important


NOW = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)


def test_routine_police_event_is_hidden():
    events = [{"id": 1, "name": "Kontroll person/fordon", "summary": "Åmål", "datetime": NOW.isoformat(), "location": {"name": "Åmål"}}]
    assert important.police_items(events, "Åmål", NOW) == []


def test_serious_police_event_is_kept():
    events = [{"id": 2, "name": "Trafikolycka", "summary": "E45 i Åmål", "datetime": NOW.isoformat(), "location": {"name": "Åmål"}}]
    assert important.police_items(events, "Åmål", NOW)[0]["priority"] >= 70


def test_single_cancelled_departure_is_not_important():
    transport = {"generatedAt": NOW.isoformat(), "municipalities": {"Åmål": {"stops": [{"id": "x", "alerts": [], "departures": [{"canceled": True, "line": "1", "scheduled": NOW.isoformat()}]}]}}}
    assert important.traffic_items(transport, "Åmål", NOW) == []


def test_smhi_warning_uses_county():
    payload = [{"id": "w1", "event": {"sv": "Skyfall"}, "warningAreas": [{"id": "a1", "warningLevel": {"sv": "Gul varning", "code": "YELLOW"}, "affectedAreas": [{"name": {"sv": "Värmlands län"}}], "published": NOW.isoformat()}]}]
    assert len(important.weather_items(payload, "Värmlands län", NOW)) == 1
    assert important.weather_items(payload, "Västra Götalands län", NOW) == []


def test_only_serious_road_event_is_kept():
    data = {"generatedAt": NOW.isoformat(), "municipalities": {"Åmål": {"items": [
        {"id": "work", "category": "roadwork", "severity": "warning", "title": "Vägarbete"},
        {"id": "crash", "category": "accident", "severity": "danger", "title": "Vägen helt avstängd efter olycka"},
    ]}}}
    assert [item["id"] for item in important.road_items(data, "Åmål")] == ["road-crash"]


if __name__ == "__main__":
    tests = [value for key, value in globals().items() if key.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"OK: {len(tests)} tester")
