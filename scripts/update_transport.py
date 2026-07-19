#!/usr/bin/env python3
"""Hämtar kollektivtrafikdata från Trafiklab Realtime API.

Kräver repository-secret TRAFIKLAB_API_KEY. Stop-id:n anges i STOP_AREAS nedan.
Om nyckel eller stop-id saknas lämnas befintlig transport.json orörd.
"""
import json, os, sys
from datetime import datetime
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen

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
    with urlopen(url, timeout=20) as response:
        return json.load(response)

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
    municipalities = {}
    fetched = 0
    for municipality, stops in load_stop_areas().items():
        normalized_stops = []
        for stop in stops:
            if not stop["id"]:
                continue
            payload = fetch(stop["id"])
            normalized_stops.append({
                "id": stop["id"],
                "name": stop["name"],
                "alerts": [],
                "departures": [normalize(item) for item in payload.get("departures", [])[:20]],
            })
            fetched += 1
        if normalized_stops:
            municipalities[municipality] = {"stops": normalized_stops}
    if not fetched:
        print("Inga verifierade hållplats-id:n finns; behåller befintlig transport.json")
        return 0
    OUTPUT.write_text(json.dumps({"generatedAt": datetime.now().isoformat(timespec="seconds"), "source":"Trafiklab", "municipalities":municipalities}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Skrev {OUTPUT} med {fetched} hållplatser")
    return 0

if __name__ == "__main__":
    sys.exit(main())
