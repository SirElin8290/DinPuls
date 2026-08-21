#!/usr/bin/env python3
"""Lägg till säkra kommunposter utan att formatera om godkänd befintlig data."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def replace_javascript_registry(path: Path, pattern: str, replacement: str) -> None:
    text = path.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise ValueError(f"Kunde inte synkronisera kommunregistret i {path.relative_to(ROOT)}")
    path.write_text(updated, encoding="utf-8")


def sync_runtime_registries(municipalities: list[dict]) -> None:
    names = [item["name"] for item in municipalities]
    engine_names = ", ".join(json.dumps(name, ensure_ascii=False) for name in names)
    replace_javascript_registry(
        ROOT / "municipality-engine.js",
        r"const MUNICIPALITIES = Object\.freeze\(\[.*?\]\);",
        f"const MUNICIPALITIES = Object.freeze([{engine_names}]);",
    )
    worker_names = ", ".join(json.dumps(name, ensure_ascii=False) for name in names)
    replace_javascript_registry(
        ROOT / "cloudflare" / "push-worker.js",
        r"const MUNICIPALITIES = new Set\(\[.*?\]\);",
        f"const MUNICIPALITIES = new Set([{worker_names}]);",
    )


def mapping_bounds(text: str, key: str) -> tuple[int, int]:
    match = re.search(rf'"{re.escape(key)}"\s*:\s*\{{', text)
    if not match:
        raise ValueError(f"Saknar objektet {key}")
    start = text.find("{", match.start())
    depth = 0
    quoted = escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if quoted:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quoted = False
            continue
        if char == '"':
            quoted = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return start, index
    raise ValueError(f"Ofullständigt objekt {key}")


def add_entry(text: str, mapping_key: str, name: str, value: object) -> str:
    payload = json.loads(text)
    if name in payload.get(mapping_key, {}):
        return text
    start, end = mapping_bounds(text, mapping_key)
    comma = "" if not text[start + 1:end].strip() else ","
    encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return text[:end] + f'{comma}\n"{name}":{encoded}' + text[end:]


def default_for(filename: str, municipality: dict) -> object:
    name, website = municipality["name"], municipality["website"]
    directory = municipality.get("associationDirectoryUrl") or website
    providers = municipality.get("housingProviders") or []
    return {
        "arenas.json": {"coordinates": [municipality["latitude"], municipality["longitude"]], "arenas": []},
        "authorities.json": {"website": website}, "cinemas.json": [],
        "event-sources.json": {"sources": municipality.get("eventSources", []), "featuredEvents": []},
        "events.json": {"events": [], "sources": municipality.get("eventSources", [])},
        "fuel.json": {"updatedAt": None, "stations": []}, "grocery.json": {"stores": []},
        "health.json": {"county": municipality["county"]},
        "housing.json": {"total": 0, "listings": [], "providers": providers},
        "important-sources.json": [{"name": f"{name} kommun", "url": website}],
        "important.json": {"items": [], "checkedAt": None, "sourceHealth": []},
        "jobs.json": {"municipalityId": municipality.get("jobSearchMunicipalityId"), "total": 0, "jobs": []},
        "leisure-curated.json": {"directoryUrl": directory, "activities": []},
        "leisure.json": {"directoryUrl": directory, "activities": []},
        "lunch-sources.json": municipality.get("lunchSources", []),
        "lunch.json": {"restaurants": [], "referenceSources": municipality.get("lunchReferenceSources", [])},
        "missing-people.json": {"items": []}, "road-traffic.json": {"items": []},
        "service.json": {"county": municipality["county"]}, "sport-feeds.json": {"matches": []},
        "sport-seasons.json": [], "sport-sources.json": [],
        "sports-curated.json": {"directoryUrl": directory, "clubs": [], "liveSources": []},
        "sports.json": {"directoryUrl": directory, "clubs": [], "liveSources": []},
        "stop-candidates.json": {"selectedId": None, "selectedName": None, "candidates": []},
        "transport.json": {"stops": []},
        "weather-live.json": {"coordinates": {"latitude": municipality["latitude"], "longitude": municipality["longitude"]}},
    }[filename]


def main() -> None:
    config = json.loads((DATA / "municipalities.json").read_text(encoding="utf-8"))
    sync_runtime_registries(config["municipalities"])
    for path in sorted(DATA.glob("*.json")):
        if path.name == "municipalities.json":
            continue
        text = path.read_text(encoding="utf-8")
        payload = json.loads(text)
        if not isinstance(payload.get("municipalities"), dict):
            continue
        for municipality in config["municipalities"]:
            text = add_entry(text, "municipalities", municipality["name"], default_for(path.name, municipality))
        if path.name == "lunch-sources.json":
            for municipality in config["municipalities"]:
                text = add_entry(text, "referenceSources", municipality["name"], municipality.get("lunchReferenceSources", []))
        path.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
