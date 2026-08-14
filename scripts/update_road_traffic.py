#!/usr/bin/env python3
"""Hämta och normalisera aktuella vägmeddelanden från Trafikverket."""
from __future__ import annotations

import json
import math
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "data" / "municipalities.json"
OUTPUT = ROOT / "data" / "road-traffic.json"
API_URL = "https://api.trafikinfo.trafikverket.se/v2/data.json"
MAP_URL = "https://www.trafikverket.se/trafikinformation/vag/"
RADIUS_KM = 35
EXPIRED_GRACE = timedelta(minutes=15)
COUNTY_CODES = {
    "Västra Götalands län": "14",
    "Värmlands län": "17",
}


def load_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def parse_datetime(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def haversine(lat1, lon1, lat2, lon2):
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    value = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lon / 2) ** 2
    )
    return 6371 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def parse_point(value):
    match = re.search(r"POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)", str(value or ""), re.I)
    return (float(match.group(2)), float(match.group(1))) if match else None


def first(data, *keys):
    for key in keys:
        value = data.get(key)
        if value not in (None, ""):
            return str(value).strip()
    return ""


def classify(text):
    value = text.casefold()
    if any(word in value for word in ("olycka", "accident", "kollision")):
        return "accident", "Olycka"
    if any(word in value for word in ("vägarbete", "roadwork", "beläggningsarbete", "arbete")):
        return "roadwork", "Vägarbete"
    if any(word in value for word in ("kö", "congestion", "stillastående", "långsam trafik")):
        return "congestion", "Kö"
    if any(word in value for word in ("väglag", "halka", "snö", "isbildning", "weather")):
        return "weather", "Väder och väglag"
    return "obstacle", "Trafikhinder"


def classify_severity(text):
    value = text.casefold()
    if any(word in value for word in ("avstängd", "totalstopp", "mycket stor påverkan", "very serious")):
        return "danger"
    if any(word in value for word in ("stor påverkan", "olycka", "kö", "begränsad framkomlighet", "serious")):
        return "warning"
    return "info"


def normalize(situation, deviation, index, now=None):
    now = now or datetime.now(timezone.utc)
    geometry = deviation.get("Geometry") or {}
    wgs84 = geometry.get("WGS84") if isinstance(geometry, dict) else ""
    if isinstance(wgs84, list):
        wgs84 = wgs84[0] if wgs84 else ""
    coordinates = parse_point(wgs84)
    message = first(deviation, "Message", "LocationDescriptor", "Header")
    header = first(deviation, "Header")
    code = first(deviation, "MessageCode", "TrafficRestrictionType", "DeviationType")
    combined = " ".join((header, message, code, first(deviation, "SeverityText", "Severity")))
    category, category_label = classify(combined)
    start_time = deviation.get("StartTime")
    start = parse_datetime(start_time)
    return {
        "id": f"{situation.get('Id', 'situation')}-{index}",
        "category": category,
        "categoryLabel": category_label,
        "severity": classify_severity(combined),
        "status": "planned" if start and start > now else "current",
        "title": header or message or category_label,
        "message": "" if message == header else message,
        "road": first(deviation, "RoadNumber", "RoadName"),
        "location": first(deviation, "LocationDescriptor", "CountyNo"),
        "countyCode": first(deviation, "CountyNo"),
        "startTime": start_time,
        "endTime": deviation.get("EndTime"),
        "updatedAt": deviation.get("LastUpdateTime") or situation.get("ModifiedTime"),
        "latitude": coordinates[0] if coordinates else None,
        "longitude": coordinates[1] if coordinates else None,
        "source": "Trafikverket",
        "sourceUrl": MAP_URL,
    }


def is_relevant(item, now=None):
    now = now or datetime.now(timezone.utc)
    end = parse_datetime(item.get("endTime"))
    return not end or end >= now - EXPIRED_GRACE


def fetch_situations(api_key):
    body = (
        f'<REQUEST><LOGIN authenticationkey="{api_key}"/>'
        '<QUERY objecttype="Situation" namespace="road.trafficinfo" '
        'schemaversion="1.6" limit="5000"></QUERY></REQUEST>'
    ).encode()
    request = Request(
        API_URL,
        data=body,
        headers={"Content-Type": "text/xml", "User-Agent": "DinPuls/traffic"},
    )
    try:
        with urlopen(request, timeout=45) as response:
            payload = json.load(response)
    except HTTPError as error:
        details = error.read().decode("utf-8", "replace").replace(api_key, "***")[:1000]
        raise RuntimeError(f"Trafikverket svarade HTTP {error.code}: {details}") from None
    except URLError as error:
        raise RuntimeError(f"Trafikverket kunde inte nås: {error.reason}") from None

    situations = []
    for result in payload.get("RESPONSE", {}).get("RESULT", []):
        if isinstance(result, dict):
            situations.extend(result.get("Situation", []))
    if not situations:
        raise RuntimeError("Trafikverket returnerade inga Situation-poster; befintlig data behålls")
    return situations


def municipality_items(items, municipality):
    latitude = float(municipality["latitude"])
    longitude = float(municipality["longitude"])
    nearby = []
    for item in items:
        if item["latitude"] is None:
            continue
        distance = haversine(latitude, longitude, item["latitude"], item["longitude"])
        if distance <= RADIUS_KM:
            nearby.append({**item, "distanceKm": round(distance, 1)})

    unique = {}
    for item in nearby:
        key = "|".join(
            str(item.get(field) or "").strip().casefold()
            for field in ("category", "title", "road", "location")
        )
        current = unique.get(key)
        if current is None or item["distanceKm"] < current["distanceKm"]:
            unique[key] = item

    severity_order = {"danger": 0, "warning": 1, "info": 2}
    status_order = {"current": 0, "planned": 1}
    return sorted(
        unique.values(),
        key=lambda item: (
            status_order.get(item["status"], 2),
            severity_order.get(item["severity"], 3),
            item["distanceKm"],
        ),
    )[:100]


def assign_items_to_municipalities(items, municipalities):
    """Tilldela varje trafikmeddelande till högst en av DinPuls kommuner.

    Den tidigare 35-km-cirkeln kördes oberoende för varje kommun och skapade
    därför många kopior i närliggande kommuner. Länskod används först när den
    finns och därefter väljs den närmaste centralorten inom bevakningsradien.
    """
    assignments = {municipality["name"]: [] for municipality in municipalities}
    for item in items:
        if item.get("latitude") is None or item.get("longitude") is None:
            continue
        county_code = str(item.get("countyCode") or "").strip()
        candidates = []
        for municipality in municipalities:
            expected_county = COUNTY_CODES.get(str(municipality.get("county") or ""))
            if county_code and expected_county and county_code != expected_county:
                continue
            distance = haversine(
                float(municipality["latitude"]), float(municipality["longitude"]),
                float(item["latitude"]), float(item["longitude"]),
            )
            if distance <= RADIUS_KM:
                candidates.append((distance, municipality))
        if not candidates:
            continue
        distance, municipality = min(candidates, key=lambda candidate: candidate[0])
        assignments[municipality["name"]].append({**item, "distanceKm": round(distance, 1)})

    return {
        municipality["name"]: municipality_items(assignments[municipality["name"]], municipality)
        for municipality in municipalities
    }


def main():
    api_key = os.environ.get("TRAFIKVERKET_API_KEY", "").strip()
    if not api_key:
        print("TRAFIKVERKET_API_KEY saknas")
        return 1

    now = datetime.now(timezone.utc)
    normalized = []
    for situation in fetch_situations(api_key):
        deviations = situation.get("Deviation") or []
        if isinstance(deviations, dict):
            deviations = [deviations]
        for index, deviation in enumerate(deviations):
            if isinstance(deviation, dict):
                item = normalize(situation, deviation, index, now)
                if is_relevant(item, now):
                    normalized.append(item)

    config_municipalities = load_json(CONFIG, {}).get("municipalities", [])
    assigned = assign_items_to_municipalities(normalized, config_municipalities)
    municipalities = {}
    for municipality in config_municipalities:
        items = assigned[municipality["name"]]
        municipalities[municipality["name"]] = {"items": items}
        print(f"{municipality['name']}: {len(items)} vägmeddelanden")

    output = {
        "version": "0.21.0",
        "generatedAt": now.isoformat(timespec="seconds"),
        "active": True,
        "radiusKm": RADIUS_KM,
        "source": {"name": "Trafikverket", "url": MAP_URL},
        "sources": [
            {"name": "Trafikverkets öppna API", "url": "https://www.trafikverket.se/e-tjanster/trafikverkets-oppna-api-for-trafikinformation/", "automated": True},
            {"name": "Trafikverkets vägkarta", "url": MAP_URL, "automated": False},
            {"name": "Vägväder VViS", "url": "https://bransch.trafikverket.se/tjanster/trafiktjanster/VViS/", "automated": False},
        ],
        "municipalities": municipalities,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
