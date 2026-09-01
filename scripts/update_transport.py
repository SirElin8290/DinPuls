#!/usr/bin/env python3
"""Hämta buss- och tågtider från Trafiklab utan att radera fungerande data."""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "transport.json"
MUNICIPALITY_FILE = ROOT / "data" / "municipalities.json"
API_URL = "https://realtime-api.trafiklab.se/v1/departures"
STOCKHOLM = ZoneInfo("Europe/Stockholm")
TRANSPORT_VERSION = "0.21.3"
MAX_DEPARTURES = 40
LOOKAHEAD_OFFSETS_HOURS = (1, 2, 4, 6, 8, 12)
DEEP_SEARCH_INTERVAL_HOURS = 2
EMPTY_RETRY_MINUTES = 45
FETCH_ATTEMPTS = 3
FETCH_TIMEOUT_SECONDS = 25
MIN_REQUEST_INTERVAL_SECONDS = 0.35
MAX_RATE_LIMIT_DELAY_SECONDS = 15
MIN_DEPARTURES_FOR_DEEP_SEARCH = 4
TARGET_DEPARTURES = 10
_last_request_started = 0.0


def load_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback


def load_stop_areas():
    data = load_json(MUNICIPALITY_FILE, {})
    return {
        item["name"]: item.get("transportStops", [])
        for item in data.get("municipalities", [])
        if item.get("name")
    }


def load_previous_stops():
    data = load_json(OUTPUT, {})
    return {
        str(stop.get("id")): stop
        for municipality in (data.get("municipalities") or {}).values()
        for stop in municipality.get("stops", [])
        if stop.get("id")
    }


def parse_time(value, default_timezone=STOCKHOLM):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return parsed.replace(tzinfo=default_timezone) if parsed.tzinfo is None else parsed


def future_departures(stop, now):
    departures = []
    for item in stop.get("departures", []):
        departure_time = parse_time(item.get("realtime") or item.get("scheduled"), now.tzinfo)
        if departure_time and departure_time >= now - timedelta(minutes=2):
            retained = dict(item)
            retained["isRealtime"] = False
            retained["stale"] = True
            departures.append(retained)
    return sorted(
        departures,
        key=lambda item: parse_time(item.get("realtime") or item.get("scheduled"), now.tzinfo),
    )[:MAX_DEPARTURES]


def pace_request():
    """Undvik täta anropsskurar när flera kommuner uppdateras i samma körning."""
    global _last_request_started
    elapsed = time.monotonic() - _last_request_started
    if _last_request_started and elapsed < MIN_REQUEST_INTERVAL_SECONDS:
        time.sleep(MIN_REQUEST_INTERVAL_SECONDS - elapsed)
    _last_request_started = time.monotonic()


def fetch(api_key, area_id, query_time=None):
    time_path = f"/{quote(query_time)}" if query_time else ""
    url = f"{API_URL}/{quote(area_id)}{time_path}?key={quote(api_key)}"
    last_error = "okänt fel"

    for attempt in range(1, FETCH_ATTEMPTS + 1):
        retry_after = None
        pace_request()
        request = Request(url, headers={"User-Agent": "DinPuls/transport"})
        try:
            with urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
                payload = json.load(response)
            if not isinstance(payload.get("departures"), list):
                raise RuntimeError("Trafiklab-svaret saknar departures")
            return payload
        except HTTPError as error:
            last_error = f"Trafiklab svarade med HTTP {error.code}"
            if 400 <= error.code < 500 and error.code not in {408, 429}:
                break
            retry_after = error.headers.get("Retry-After") if error.headers else None
        except URLError as error:
            last_error = f"Trafiklab kunde inte nås: {error.reason}"
        except TimeoutError:
            last_error = "Tidsgränsen mot Trafiklab överskreds"
        except (json.JSONDecodeError, RuntimeError) as error:
            last_error = str(error)

        if attempt < FETCH_ATTEMPTS:
            requested_delay = int(retry_after) if str(retry_after).isdigit() else attempt * 2
            delay = min(max(requested_delay, attempt * 2), MAX_RATE_LIMIT_DELAY_SECONDS)
            print(f"{area_id}: hämtningsförsök {attempt} misslyckades ({last_error}). Försöker igen om {delay} s.")
            time.sleep(delay)

    raise RuntimeError(f"{last_error} efter {FETCH_ATTEMPTS} försök")


def future_query_times(now, offsets=LOOKAHEAD_OFFSETS_HOURS):
    """Sök spridda 60-minutersfönster tätare när den första avgångstavlan är tunn."""
    base = now.replace(second=0, microsecond=0)
    return [(base + timedelta(hours=offset)).strftime("%Y-%m-%dT%H:%M") for offset in offsets]


def should_deep_search(previous_stop, now):
    next_search = parse_time(previous_stop.get("nextSearchAfter"), now.tzinfo)
    return not next_search or next_search <= now


def alert_text(alert):
    if isinstance(alert, str):
        return alert.strip()
    if isinstance(alert, dict):
        for key in ("header", "title", "message", "text"):
            if alert.get(key):
                return str(alert[key]).strip()
    return ""


def collect_alerts(*payloads):
    alerts = []
    for payload in payloads:
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
    scheduled = parse_time(item.get("scheduled"), STOCKHOLM)
    realtime = parse_time(item.get("realtime") or item.get("scheduled"), STOCKHOLM)
    return {
        "mode": "train" if mode == "train" else "bus",
        "line": route.get("designation") or route.get("name") or "–",
        "direction": route.get("direction") or (route.get("destination") or {}).get("name") or "",
        "operator": (item.get("agency") or {}).get("name") or "",
        "scheduled": scheduled.isoformat() if scheduled else item.get("scheduled"),
        "realtime": realtime.isoformat() if realtime else item.get("realtime") or item.get("scheduled"),
        "delayMinutes": round((item.get("delay") or 0) / 60),
        "isRealtime": bool(item.get("is_realtime")),
        "canceled": bool(item.get("canceled")),
        "platform": platform.get("designation") or "",
    }


def normalize_departures(payload):
    return [normalize(item) for item in payload.get("departures", [])]


def merge_departures(now, *groups):
    """Slå ihop flera tidtabellsfönster och behåll den färskaste versionen av varje avgång."""
    unique = {}
    for group in groups:
        for item in group or []:
            departure_time = parse_time(item.get("realtime") or item.get("scheduled"), now.tzinfo)
            if not departure_time or departure_time < now - timedelta(minutes=2):
                continue
            key = (
                item.get("scheduled"),
                item.get("mode"),
                item.get("line"),
                item.get("direction"),
            )
            if key not in unique or (unique[key].get("stale") and not item.get("stale")):
                unique[key] = item
    return sorted(
        unique.values(),
        key=lambda item: parse_time(item.get("realtime") or item.get("scheduled"), now.tzinfo),
    )[:MAX_DEPARTURES]


def find_next_departures(api_key, area_id, now, previous_stop, current_payload):
    current = normalize_departures(current_payload)
    retained = future_departures(previous_stop, now)
    payloads = [current_payload]
    lookup_time = previous_stop.get("lookupTime")
    next_search = previous_stop.get("nextSearchAfter")
    merged = merge_departures(now, current, retained)
    engine_changed = previous_stop.get("engineVersion") != TRANSPORT_VERSION

    # Ett enda eller ett fåtal träffar får inte stoppa framtidssökningen. Trafiklabs
    # avgångstavla täcker bara 60 minuter, så tunna resultat behöver flera framtidsfönster.
    if len(merged) < MIN_DEPARTURES_FOR_DEEP_SEARCH and (engine_changed or should_deep_search(previous_stop, now)):
        lookup_time = now.isoformat(timespec="minutes")
        future_departures_found = 0
        for query_time in future_query_times(now):
            try:
                payload = fetch(api_key, area_id, query_time)
            except RuntimeError as error:
                print(f"{area_id}: framtida fönster {query_time} misslyckades: {error}")
                continue
            payloads.append(payload)
            normalized_future = normalize_departures(payload)
            future_departures_found += len(normalized_future)
            current.extend(normalized_future)
            merged = merge_departures(now, current, retained)
            if len(merged) >= TARGET_DEPARTURES:
                break

        # Om resultatet fortfarande är tunt försöker vi igen redan efter 45 minuter.
        # Ett fylligt resultat behöver däremot bara djupsökas varannan timme.
        retry_minutes = EMPTY_RETRY_MINUTES if len(merged) < MIN_DEPARTURES_FOR_DEEP_SEARCH else 0
        retry_hours = 0 if retry_minutes else DEEP_SEARCH_INTERVAL_HOURS
        next_search = (now + timedelta(hours=retry_hours, minutes=retry_minutes)).isoformat(timespec="minutes")

    departures = merge_departures(now, current, retained)
    retained_only = bool(departures) and all(item.get("stale") for item in departures)
    return departures, lookup_time, retained_only, next_search, payloads


def main():
    api_key = os.getenv("TRAFIKLAB_API_KEY", "").strip()
    if not api_key:
        print("TRAFIKLAB_API_KEY saknas; befintlig transport.json behålls")
        return 1

    stop_areas = load_stop_areas()
    missing = [
        municipality
        for municipality, stops in stop_areas.items()
        if not stops or any(not str(stop.get("id", "")).strip() for stop in stops)
    ]
    if missing:
        print("Hoppar över kommuner utan säkra hållplats-id:n: " + ", ".join(missing))
        stop_areas = {
            municipality: stops
            for municipality, stops in stop_areas.items()
            if municipality not in missing
        }
    if not stop_areas:
        print("Inga kommuner har säkra hållplats-id:n; befintlig transport.json behålls")
        return 1

    previous_stops = load_previous_stops()
    now = datetime.now(STOCKHOLM)
    # Keep every registered municipality in the public index, including those
    # that still lack a verified stop id. Empty, explicitly degraded entries are
    # preferable to silently omitting a municipality or inventing a stop.
    municipalities = {
        municipality: {
            "stops": [],
            "sourceStatus": "missing-stop-configuration",
        }
        for municipality in missing
    }
    successful_current_requests = 0
    failed_stops = []

    for municipality, stops in stop_areas.items():
        normalized_stops = []
        for stop in stops:
            stop_id = str(stop["id"])
            previous = previous_stops.get(stop_id, {})
            try:
                current_payload = fetch(api_key, stop_id)
                successful_current_requests += 1
                departures, lookup_time, retained, next_search, payloads = find_next_departures(
                    api_key, stop_id, now, previous, current_payload
                )
                alerts = collect_alerts(*payloads)
                error_message = None
            except RuntimeError as error:
                print(f"{municipality}: {error}")
                departures = future_departures(previous, now)
                alerts = previous.get("alerts", [])
                lookup_time = previous.get("lookupTime")
                retained = bool(departures)
                next_search = previous.get("nextSearchAfter")
                error_message = str(error)
                failed_stops.append(municipality)

            normalized_stops.append({
                "id": stop_id,
                "name": stop["name"],
                "alerts": alerts,
                "lookupTime": lookup_time,
                "retained": retained,
                "nextSearchAfter": next_search,
                "engineVersion": TRANSPORT_VERSION,
                "error": error_message,
                "departures": departures,
            })
            print(f"{municipality}: {len(departures)} kommande avgångar")

        municipalities[municipality] = {"stops": normalized_stops, "sourceStatus": "ok"}

    if successful_current_requests == 0:
        print("Samtliga Trafiklab-anrop misslyckades; befintlig transport.json behålls")
        return 1

    output = {
        "version": TRANSPORT_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Trafiklab",
        "sourceUrl": "https://www.trafiklab.se/api/our-apis/trafiklab-realtime-apis/timetables/",
        "partial": bool(failed_stops or missing),
        "failedMunicipalities": list(dict.fromkeys([*missing, *failed_stops])),
        "municipalities": municipalities,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Skrev {OUTPUT} med {successful_current_requests} fungerande hållplatsanrop")
    return 0


if __name__ == "__main__":
    sys.exit(main())
