#!/usr/bin/env python3
"""Hämta och validera dagen-före-spotpriser för Sveriges fyra elområden."""
from __future__ import annotations

import json, math
from datetime import datetime, timedelta
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_FILE = ROOT / "data" / "energy.json"
AREAS = ("SE1", "SE2", "SE3", "SE4")
SOURCE = "https://www.elprisetjustnu.se/api/v1/prices/{year}/{month_day}_{area}.json"
USER_AGENT = "DinPuls.se energy/1.0 kontakt@dinpuls.se"
STOCKHOLM = ZoneInfo("Europe/Stockholm")

def fetch_json(url, timeout=20):
    request = Request(url, headers={"Accept": "application/json", "User-Agent": USER_AGENT})
    with urlopen(request, timeout=timeout) as response:
        if getattr(response, "status", 200) != 200:
            raise HTTPError(url, response.status, "HTTP error", response.headers, None)
        return json.load(response)

def source_url(day, area):
    return SOURCE.format(year=day.strftime("%Y"), month_day=day.strftime("%m-%d"), area=area)

def normalize_periods(payload, day, area):
    if not isinstance(payload, list) or not payload:
        raise ValueError(f"{area} {day}: tom eller ogiltig JSON")
    result = []
    for row in payload:
        try:
            value = float(row["SEK_per_kWh"])
            start = datetime.fromisoformat(str(row["time_start"]))
            end = datetime.fromisoformat(str(row["time_end"]))
        except (KeyError, TypeError, ValueError) as error:
            raise ValueError(f"{area} {day}: ogiltig period") from error
        if not math.isfinite(value) or start.tzinfo is None or end.tzinfo is None or end <= start:
            raise ValueError(f"{area} {day}: ogiltigt värde eller tidsintervall")
        if start.astimezone(STOCKHOLM).date() != day:
            raise ValueError(f"{area} {day}: period från fel leveransdag")
        result.append({"start": start.isoformat(), "end": end.isoformat(), "orePerKwh": round(value * 100, 3)})
    result.sort(key=lambda row: row["start"])
    if len(result) not in (23, 24, 25, 92, 96, 100):
        raise ValueError(f"{area} {day}: oväntat antal perioder ({len(result)})")
    for previous, current in zip(result, result[1:]):
        if previous["end"] != current["start"]:
            raise ValueError(f"{area} {day}: glapp eller överlapp")
    return result

def build_energy(now=None, fetcher=fetch_json):
    now = (now or datetime.now(STOCKHOLM)).astimezone(STOCKHOLM)
    today, tomorrow = now.date(), now.date() + timedelta(days=1)
    areas = {}
    for area in AREAS:
        today_url = source_url(today, area)
        area_data = {"date": today.isoformat(), "sourceUrl": today_url, "periods": normalize_periods(fetcher(today_url), today, area)}
        tomorrow_url = source_url(tomorrow, area)
        try:
            area_data["tomorrow"] = {"date": tomorrow.isoformat(), "sourceUrl": tomorrow_url, "periods": normalize_periods(fetcher(tomorrow_url), tomorrow, area)}
        except (HTTPError, OSError, TimeoutError, ValueError, json.JSONDecodeError):
            area_data["tomorrow"] = None
        areas[area] = area_data
    return {
        "version": "1.0.0", "generatedAt": now.isoformat(timespec="seconds"), "timeZone": "Europe/Stockholm", "unit": "öre/kWh",
        "priceBasis": "Dagen-före spotpris utan moms, skatter, elhandlarpåslag eller nätavgift",
        "source": {"name": "Elpriset just nu", "url": "https://www.elprisetjustnu.se/", "documentation": "https://www.elprisetjustnu.se/elpris-api", "upstream": "ENTSO-E Transparency Platform", "license": "Öppet och gratis API; källhänvisning önskas", "updateFrequency": "Dagens priser; morgondagens priser normalt tidigast kl. 13"},
        "areas": areas,
    }

def main():
    OUTPUT_FILE.write_text(json.dumps(build_energy(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Elprisdata uppdaterad för SE1-SE4")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
