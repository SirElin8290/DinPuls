#!/usr/bin/env python3
"""Kontrollera DinPuls publicerade kärndata och skriv en enkel driftstatusfil."""
from __future__ import annotations

import argparse
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE_URL = "https://dinpuls.se/data/"
DEFAULT_OUTPUT = ROOT / "data" / "system-health.json"

MODULES = {
    "news": (["news.json"], 6),
    "jobs": (["jobs.json"], 12),
    "housing": (["housing.json", "housing-fargelanda-supplement.json"], 12),
    "events": (["events.json", "events-fargelanda-supplement.json"], 12),
    "weather": (["weather-live.json"], 6),
    "lunch": (["lunch.json"], 48),
    "health": (["health.json", "health-private.json", "health-private-supplement.json", "health-local-supplement.json", "health-karlstad-private-supplement.json", "health-fargelanda-supplement.json", "health-eda-supplement.json"], 24 * 45),
    "service": (["service.json", "service-private-supplement.json", "service-launch-supplement.json", "service-local-supplement.json"], 24 * 45),
    "cinema": (["cinemas.json"], 24 * 14),
    "leisure": (["leisure.json", "leisure-fargelanda-supplement.json"], 24 * 14),
    "sports": (["sports.json", "sports-fargelanda-supplement.json", "association-hagfors-supplement.json"], 24 * 14),
}


def parse_time(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def payload_time(payload):
    for key in ("generatedAt", "updatedAt", "sourceChecked"):
        parsed = parse_time(payload.get(key))
        if parsed:
            return parsed
    return None


def count_for(module, payload, municipality):
    municipalities = payload.get("municipalities") or {}
    row = municipalities.get(municipality, {})
    if module == "news":
        return sum(municipality in (item.get("municipalities") or []) for item in payload.get("articles", []) if isinstance(item, dict))
    if module == "jobs":
        return len(row.get("jobs") or []) if isinstance(row, dict) else 0
    if module == "housing":
        nested = len(row.get("listings") or []) if isinstance(row, dict) else 0
        return nested + (len(payload.get("listings") or []) if payload.get("municipality") == municipality else 0)
    if module == "events":
        nested = len(row.get("events") or []) if isinstance(row, dict) else 0
        return nested + (len(payload.get("events") or []) if payload.get("municipality") == municipality else 0)
    if module == "weather":
        current = ((row.get("nowcast") or {}).get("current") or {}) if isinstance(row, dict) else {}
        return 1 if current.get("time") else 0
    if module == "lunch":
        return len(row.get("restaurants") or []) if isinstance(row, dict) else 0
    if module == "health":
        return sum(item.get("municipality") == municipality for item in payload.get("providers", []) if isinstance(item, dict))
    if module == "service":
        return sum(item.get("municipality") == municipality for item in payload.get("businesses", []) if isinstance(item, dict))
    if module == "cinema":
        return len(row) if isinstance(row, list) else 0
    if module == "leisure":
        nested = len(row.get("activities") or []) if isinstance(row, dict) else 0
        if payload.get("municipality") == municipality:
            nested += len(payload.get("activities") or []) + len(payload.get("entries") or [])
        return nested
    if module == "sports":
        nested = len(row.get("clubs") or []) if isinstance(row, dict) else 0
        return nested + (len(payload.get("clubs") or []) if payload.get("municipality") == municipality else 0)
    return 0


def verified_zero(module, payload, municipality):
    if module != "lunch":
        return False
    row = (payload.get("municipalities") or {}).get(municipality, {})
    return bool(isinstance(row, dict) and row.get("actualSupplyVerified") is True and row.get("actualLocalLunchSupply") == 0)


def fetch_json(url, opener=urllib.request.urlopen):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "DinPuls-System-Health/1.0", "Cache-Control": "no-cache"},
    )
    with opener(request, timeout=15) as response:
        status = getattr(response, "status", 200)
        if status != 200:
            raise RuntimeError(f"HTTP {status}")
        return json.loads(response.read().decode("utf-8"))


def build_health(base_url=DEFAULT_BASE_URL, now=None, opener=urllib.request.urlopen):
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    base_url = base_url.rstrip("/") + "/"
    municipality_payload = fetch_json(base_url + "municipalities.json", opener)
    municipalities = [row.get("name") for row in municipality_payload.get("municipalities", []) if row.get("name")]
    loaded, failures = {}, {}
    for module, (filenames, _) in MODULES.items():
        try:
            values = []
            for filename in filenames:
                value = fetch_json(f"{base_url}{filename}?health={int(now.timestamp())}", opener)
                if not isinstance(value, dict):
                    raise ValueError("JSON-roten är inte ett objekt")
                values.append(value)
            loaded[module] = values
        except Exception as error:
            failures[module] = str(error)

    results = {}
    summary = {"green": 0, "warning": 0, "critical": 0}
    for municipality in municipalities:
        results[municipality] = {}
        for module, (_, max_age_hours) in MODULES.items():
            if module in failures:
                status, count, reason = "critical", None, "unreadable_source"
            else:
                payloads = loaded[module]
                payload = payloads[0]
                count = sum(count_for(module, item, municipality) for item in payloads)
                checked = payload_time(payload)
                age_hours = (now - checked).total_seconds() / 3600 if checked else None
                if count == 0 and not verified_zero(module, payload, municipality):
                    status, reason = "critical", "zero_records"
                elif checked is None:
                    status, reason = "warning", "missing_timestamp"
                elif age_hours > max_age_hours:
                    status, reason = "warning", "stale_data"
                else:
                    status, reason = "green", None
            summary[status] += 1
            results[municipality][module] = {
                "status": status,
                "currentCount": count,
                "lastChecked": now.isoformat(timespec="seconds"),
                "reason": reason,
            }
    return {
        "version": "1.0.0",
        "generatedAt": now.isoformat(timespec="seconds"),
        "summary": summary,
        "municipalities": results,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    result = build_health(args.base_url)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = result["summary"]
    print(f"Systemstatus: {summary['green']} OK, {summary['warning']} varningar, {summary['critical']} kritiska")


if __name__ == "__main__":
    main()
