#!/usr/bin/env python3
"""Hämtar tank- och laddstationer från OpenStreetMap för DinPuls kommunmotor.

Priser läggs bara till när en offentlig operatörskälla anger ett entydigt pris.
Lokala pumppriser gissas aldrig och nationella företagslistpriser märks inte som
stationspriser.
"""
from __future__ import annotations

import json
import math
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MUNICIPALITIES = ROOT / "data" / "municipalities.json"
OUTPUT = ROOT / "data" / "fuel.json"
OVERPASS_ENDPOINTS = (
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
)
RADIUS_METERS = 15000

CHARGING_TARIFFS = {
    "circle k": {
        "price": 5.59, "unit": "kr/kWh", "priceType": "operator-list",
        "priceLabel": "Operatörspris", "sourceUrl": "https://www.circlek.se/laddning/priser",
    },
    "okq8": {
        "price": 5.49, "unit": "kr/kWh", "priceType": "operator-list",
        "priceLabel": "Engångspris upp till 200 kW", "sourceUrl": "https://www.okq8.se/elbilsladdning/kostnad-ladda-elbil/",
    },
}


def request_json(query: str) -> dict:
    body = urllib.parse.urlencode({"data": query}).encode()
    last_error = None
    for attempt in range(2):
        endpoint = OVERPASS_ENDPOINTS[attempt % len(OVERPASS_ENDPOINTS)]
        request = urllib.request.Request(
            endpoint, data=body,
            headers={"User-Agent": "DinPuls/0.11 public-local-information-portal"},
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as error:
            last_error = error
            time.sleep(4 * (attempt + 1))
    raise last_error or RuntimeError("Overpass svarade inte")


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    value = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(radius * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value)), 1)


def address(tags: dict) -> str:
    street = " ".join(filter(None, [tags.get("addr:street"), tags.get("addr:housenumber")])).strip()
    return street or tags.get("addr:place") or tags.get("addr:city") or "Adress saknas"


def products(tags: dict) -> list[str]:
    mapping = {
        "fuel:octane_95": "Bensin 95", "fuel:octane_98": "Bensin 98",
        "fuel:diesel": "Diesel", "fuel:e85": "E85", "fuel:hvo": "HVO100",
        "fuel:lpg": "Gasol", "fuel:adblue": "AdBlue",
    }
    return [label for key, label in mapping.items() if tags.get(key) == "yes"]


def connectors(tags: dict) -> list[str]:
    mapping = {
        "socket:type2": "Type 2", "socket:type2_combo": "CCS",
        "socket:chademo": "CHAdeMO", "socket:tesla_supercharger": "Tesla Supercharger",
    }
    return [label for key, label in mapping.items() if tags.get(key) and tags.get(key) != "no"]


def normalize(element: dict, municipality: dict) -> dict | None:
    tags = element.get("tags") or {}
    kind = "charging" if tags.get("amenity") == "charging_station" else "fuel"
    center = element.get("center") or element
    lat, lon = center.get("lat"), center.get("lon")
    if lat is None or lon is None:
        return None
    name = tags.get("name") or tags.get("brand") or tags.get("operator") or ("Laddstation" if kind == "charging" else "Tankstation")
    operator = tags.get("operator") or tags.get("brand") or name
    osm_type = element.get("type", "node")
    item = {
        "id": f"osm-{osm_type}-{element.get('id')}", "type": kind, "name": name,
        "brand": tags.get("brand") or "", "operator": operator,
        "address": address(tags), "latitude": lat, "longitude": lon,
        "distanceKm": distance_km(municipality["latitude"], municipality["longitude"], lat, lon),
        "openingHours": tags.get("opening_hours") or "", "products": products(tags),
        "connectors": connectors(tags), "capacity": tags.get("capacity") or "",
        "maxPower": tags.get("socket:type2_combo:output") or tags.get("socket:type2:output") or tags.get("charging_station:output") or "",
        "price": None, "unit": "kr/kWh" if kind == "charging" else "kr/l",
        "priceType": "missing", "priceLabel": "Pris saknas",
        "priceCheckedAt": None, "dataSource": "OpenStreetMap",
        "sourceUrl": f"https://www.openstreetmap.org/{osm_type}/{element.get('id')}",
        "directionsUrl": f"https://www.google.com/maps/dir/?api=1&destination={lat},{lon}",
    }
    if kind == "charging":
        operator_key = operator.casefold()
        tariff = next((value for key, value in CHARGING_TARIFFS.items() if key in operator_key), None)
        if tariff:
            item.update(tariff)
            item["priceCheckedAt"] = datetime.now(timezone.utc).isoformat()
    return item


def fetch_municipality(municipality: dict) -> list[dict]:
    query = f'''[out:json][timeout:45];(
      node(around:{RADIUS_METERS},{municipality["latitude"]},{municipality["longitude"]})["amenity"="fuel"];
      node(around:{RADIUS_METERS},{municipality["latitude"]},{municipality["longitude"]})["amenity"="charging_station"];
    );out body;'''
    payload = request_json(query)
    items = [normalize(element, municipality) for element in payload.get("elements", [])]
    unique = {item["id"]: item for item in items if item}
    return sorted(unique.values(), key=lambda item: (item["distanceKm"], item["name"].casefold()))


def fetch_all_elements(municipalities: list[dict]) -> list[dict]:
    south = min(item["latitude"] for item in municipalities) - 0.18
    north = max(item["latitude"] for item in municipalities) + 0.18
    west = min(item["longitude"] for item in municipalities) - 0.32
    east = max(item["longitude"] for item in municipalities) + 0.32
    query = f'''[out:json][timeout:60];(
      node["amenity"="fuel"]({south},{west},{north},{east});
      node["amenity"="charging_station"]({south},{west},{north},{east});
    );out center tags;'''
    return request_json(query).get("elements", [])


def main() -> None:
    municipalities = json.loads(MUNICIPALITIES.read_text(encoding="utf-8"))["municipalities"]
    previous = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {"municipalities": {}}
    generated = datetime.now(timezone.utc).isoformat()
    result = {"version": "0.11.1", "generatedAt": generated, "radiusKm": RADIUS_METERS // 1000,
              "principle": "Lokala pumppriser gissas aldrig. Prisets typ och kontrolltid visas alltid.", "municipalities": {}}
    try:
        elements = fetch_all_elements(municipalities)
        print(f"Öppen kartdata: {len(elements)} stationer hämtade i ett samlat anrop")
    except Exception as error:
        print(f"Samlad hämtning misslyckades ({error}); behåller tidigare stationsdata")
        elements = None
    for municipality in municipalities:
        name = municipality["name"]
        try:
            if elements is None:
                raise RuntimeError("ingen ny kartdata")
            normalized = [normalize(element, municipality) for element in elements]
            stations = [item for item in normalized if item and item["distanceKm"] <= RADIUS_METERS / 1000]
            stations = sorted({item["id"]: item for item in stations}.values(), key=lambda item: (item["distanceKm"], item["name"].casefold()))
            result["municipalities"][name] = {"updatedAt": generated, "stations": stations}
            print(f"{name}: {len(stations)} stationer")
        except Exception as error:
            print(f"{name}: hämtning misslyckades ({error}); behåller tidigare data")
            result["municipalities"][name] = previous.get("municipalities", {}).get(name, {"updatedAt": generated, "stations": []})
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
