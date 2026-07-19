#!/usr/bin/env python3
"""Hämtar kollektivtrafikdata från Trafiklab Timetables API.

Kräver repository-secret TRAFIKLAB_API_KEY. Hållplats-id:n läses från den
centrala kommunfilen. Vid saknade id:n eller API-fel lämnas senaste fungerande
transport.json orörd.
"""
import json, os, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "transport.json"
API_KEY = os.getenv("TRAFIKLAB_API_KEY", "").strip()

MUNICIPALITY_FILE = ROOT / "data" / "municipalities.json"

def load_stop_areas():
    """Läser hållplatser från samma centrala kommunfil som webbplatsen."""
    data = json.loads(MUNICIPALITY_FILE.read_text(encoding="utf-8"))
    return {
        item["name"]: item.get("transportStops", [])
        for item in data.get("municipalities", [])
        if item.get("name")
    }

def fetch(area_id):
    url = f"https://realtime-api.trafiklab.se/v1/departures/{quote(area_id)}?key={quote(API_KEY)}"
    request = Request(url, headers={"User-Agent": "DinPuls/0.7.2"})
    try:
        with urlopen(request, timeout=25) as response:
            payload = json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"Trafiklab svarade med HTTP {error.code}") from None
    except URLError as error:
        raise RuntimeError(f"Trafiklab kunde inte nås: {error.reason}") from None
    if not isinstance(payload.get("departures"), list):
        raise RuntimeError("Trafiklab-svaret saknar departures")
    return payload

def alert_text(alert):
    if isinstance(alert, str):
        return alert.strip()
    if isinstance(alert, dict):
        for key in ("header", "title", "message", "text"):
            if alert.get(key):
                return str(alert[key]).strip()
    return ""

def collect_alerts(payload):
    alerts = []
    for stop in payload.get("stops", []):
        alerts.extend(stop.get("alerts", []))
    for departure in payload.get("departures", []):
        alerts.extend(departure.get("alerts", []))
    messages = [alert_text(alert) for alert in alerts]
    return list(dict.fromkeys(message for message in messages if message))

def normalize(item):
    route = item.get("route") or {}
    platform = item.get("realtime_platform") or item.get("scheduled_platform") or {}
    mode = str(route.get("transport_mode", "BUS")).lower()
    return {
        "mode": "train" if mode == "train" else "bus",
        "line": route.get("designation") or route.get("name") or "–",
        "direction": route.get("direction") or (route.get("destination") or {}).get("name") or "",
        "operator": (item.get("agency") or {}).get("name") or "",
        "scheduled": item.get("scheduled"),
        "realtime": item.get("realtime") or item.get("scheduled"),
        "delayMinutes": round((item.get("delay") or 0) / 60),
        "isRealtime": bool(item.get("is_realtime")),
        "canceled": bool(item.get("canceled")),
        "platform": platform.get("designation") or "",
    }

def main():
    if not API_KEY:
        print("TRAFIKLAB_API_KEY saknas; behåller befintlig transport.json")
        return 0
    stop_areas = load_stop_areas()
    missing = [
        municipality for municipality, stops in stop_areas.items()
        if not stops or any(not str(stop.get("id", "")).strip() for stop in stops)
    ]
    if missing:
        print("Saknar säkra hållplats-id:n för: " + ", ".join(missing))
        print("Behåller befintlig transport.json tills alla kommuner är klara.")
        return 0

    municipalities = {}
    fetched = 0
    for municipality, stops in stop_areas.items():
        normalized_stops = []
        for stop in stops:
            try:
                payload = fetch(str(stop["id"]))
            except RuntimeError as error:
                print(f"{municipality}: {error}")
                print("Behåller senaste fungerande transport.json.")
                return 1
            normalized_stops.append({
                "id": str(stop["id"]),
                "name": stop["name"],
                "alerts": collect_alerts(payload),
                "departures": [normalize(item) for item in payload.get("departures", [])[:20]],
            })
            fetched += 1
        if normalized_stops:
            municipalities[municipality] = {"stops": normalized_stops}
    if not fetched:
        print("Inga verifierade hållplats-id:n finns; behåller befintlig transport.json")
        return 0
    OUTPUT.write_text(
        json.dumps({
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source": "Trafiklab",
            "municipalities": municipalities,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Skrev {OUTPUT} med {fetched} hållplatser")
    return 0

if __name__ == "__main__":
    sys.exit(main())
