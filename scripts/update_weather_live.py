#!/usr/bin/env python3
"""Hämtar radarbaserat väderläge och valfria blixtobservationer för DinPuls."""
from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MUNICIPALITIES_FILE = ROOT / "data" / "municipalities.json"
OUTPUT_FILE = ROOT / "data" / "weather-live.json"
USER_AGENT = "DinPuls.se weather-live/1.0 kontakt@dinpuls.se"


def fetch_json(url: str, timeout: int = 25) -> dict:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": USER_AGENT})
    with urlopen(request, timeout=timeout) as response:
        return json.load(response)


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def parse_nowcast(payload: dict) -> dict:
    properties = payload.get("properties", {})
    timeseries = properties.get("timeseries", [])
    timeline = []
    for entry in timeseries:
        data = entry.get("data", {})
        instant = data.get("instant", {}).get("details", {})
        next_hour = data.get("next_1_hours", {})
        details = next_hour.get("details", {})
        summary = next_hour.get("summary", {})
        timeline.append({
            "time": entry.get("time"),
            "temperature": number(instant.get("air_temperature")),
            "windSpeed": number(instant.get("wind_speed")),
            "humidity": number(instant.get("relative_humidity")),
            "precipitationRate": number(instant.get("precipitation_rate")),
            "precipitationAmount": number(details.get("precipitation_amount")),
            "symbolCode": summary.get("symbol_code"),
        })
    timeline = [item for item in timeline if item.get("time")]
    if not timeline:
        raise ValueError("MET Nowcast saknar användbara tidsserier")
    return {
        "updatedAt": properties.get("meta", {}).get("updated_at"),
        "radarCoverage": properties.get("meta", {}).get("radar_coverage"),
        "current": timeline[0],
        "timeline": timeline[:25],
    }


def should_check_lightning(nowcast: dict) -> bool:
    for item in nowcast.get("timeline", [])[:13]:
        symbol = str(item.get("symbolCode") or "").lower()
        rate = number(item.get("precipitationRate")) or 0
        amount = number(item.get("precipitationAmount")) or 0
        if "thunder" in symbol or rate >= 0.1 or amount >= 0.2:
            return True
    return False


def parse_lightning(payload: dict, checked_at: str) -> dict:
    records = payload.get("response") if isinstance(payload.get("response"), list) else []
    distances = [
        number(item.get("relativeTo", {}).get("distanceKM"))
        for item in records
    ]
    distances = [value for value in distances if value is not None]
    ground = sum(
        1 for item in records
        if str(item.get("ob", {}).get("pulse", {}).get("type", "")).lower() == "cg"
    )
    return {
        "available": True,
        "checkedAt": checked_at,
        "minutes": 5,
        "count": len(records),
        "groundStrikes": ground,
        "nearestKm": round(min(distances), 1) if distances else None,
    }


def fetch_lightning(latitude: float, longitude: float, client_id: str, client_secret: str, checked_at: str) -> dict:
    query = urlencode({
        "p": f"{latitude:.4f},{longitude:.4f}",
        "radius": "40km",
        "limit": 1000,
        "client_id": client_id,
        "client_secret": client_secret,
    })
    payload = fetch_json(f"https://data.api.xweather.com/lightning/flash/closest?{query}")
    if payload.get("success") is False:
        raise RuntimeError("Xweather avvisade blixtförfrågan")
    return parse_lightning(payload, checked_at)


def load_previous() -> dict:
    try:
        return json.loads(OUTPUT_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"municipalities": {}}


def main() -> int:
    config = json.loads(MUNICIPALITIES_FILE.read_text(encoding="utf-8"))
    previous = load_previous().get("municipalities", {})
    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    client_id = os.getenv("XWEATHER_CLIENT_ID", "").strip()
    client_secret = os.getenv("XWEATHER_CLIENT_SECRET", "").strip()
    municipalities = {}

    for municipality in config.get("municipalities", []):
        name = municipality["name"]
        latitude = float(municipality["latitude"])
        longitude = float(municipality["longitude"])
        item = {
            "coordinates": {"latitude": latitude, "longitude": longitude},
            "nowcast": None,
            "lightning": {"available": False, "reason": "credentials-missing"},
        }
        try:
            query = urlencode({"lat": f"{latitude:.4f}", "lon": f"{longitude:.4f}"})
            item["nowcast"] = parse_nowcast(fetch_json(
                f"https://api.met.no/weatherapi/nowcast/2.0/complete?{query}"
            ))
        except Exception as error:  # En kommun får inte slå ut övriga kommuner.
            old_nowcast = previous.get(name, {}).get("nowcast")
            if old_nowcast:
                item["nowcast"] = {**old_nowcast, "stale": True}
            item["nowcastError"] = str(error)[:180]

        if client_id and client_secret:
            if item["nowcast"] and should_check_lightning(item["nowcast"]):
                try:
                    item["lightning"] = fetch_lightning(
                        latitude, longitude, client_id, client_secret, generated_at
                    )
                except Exception as error:
                    item["lightning"] = {"available": False, "reason": "fetch-failed", "error": str(error)[:160]}
            else:
                item["lightning"] = {
                    "available": True,
                    "checkedAt": generated_at,
                    "minutes": 5,
                    "count": 0,
                    "nearestKm": None,
                    "skippedDryWeather": True,
                }
        municipalities[name] = item

    output = {
        "version": "1.0.0",
        "generatedAt": generated_at,
        "refreshMinutes": 10,
        "sources": {
            "nowcast": "MET Norway Nowcast 2.0",
            "forecast": "SMHI SNOW1G",
            "lightning": "Vaisala Xweather",
        },
        "municipalities": municipalities,
    }
    OUTPUT_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
