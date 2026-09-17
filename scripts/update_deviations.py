#!/usr/bin/env python3
"""Update verified local deviations without inventing missing facts."""
from __future__ import annotations

import argparse
import html
import json
import re
import urllib.request
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "data" / "deviation-sources.json"
OUTPUT_PATH = ROOT / "data" / "deviations.json"
UA = "DinPuls local deviations/1.0 (+https://dinpuls.se/)"
STOCKHOLM = ZoneInfo("Europe/Stockholm")


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "sv-SE,sv;q=0.9"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def text_content(markup: str) -> str:
    value = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", markup, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def iso_bounds(day: date) -> tuple[str, str]:
    start = datetime.combine(day, time.min, tzinfo=STOCKHOLM)
    end = datetime.combine(day, time.max, tzinfo=STOCKHOLM)
    return start.isoformat(), end.isoformat()


def base_item(source: dict, municipality: dict, day: date, title: str, description: str, priority: int) -> dict:
    valid_from, valid_until = iso_bounds(day)
    return {
        "municipality": municipality["name"], "municipalityCode": municipality["code"],
        "type": "opening-hours", "scope": source["scope"], "title": title,
        "description": description, "affectedEntity": source.get("affectedEntity"),
        "validFrom": valid_from, "validUntil": valid_until,
        "source": source["name"], "sourceUrl": source["url"],
        "priority": priority, "confidence": "verified"
    }


def amal_trade_recommended_hours(markup: str, source: dict, municipality: dict, today: date) -> list[dict]:
    text = text_content(markup).lower()
    if "rekommenderade" not in text or "avvikande öppettider" not in text:
        raise ValueError("Källan anger inte längre rekommenderade avvikande öppettider")
    items = []
    # Källan publicerar återkommande kalenderdagar. Endast rader som faktiskt finns i sidan tas med.
    candidates = [(date(today.year, 10, 31), "31 oktober", "31 oktober", "10", "20")]
    for day, source_label, display_label, start, end in candidates:
        if day < today or source_label.lower() not in text:
            continue
        hours = "stängt" if start == "stängt" else f"kl. {start}–{end}"
        items.append(base_item(source, municipality, day, f"Rekommenderade öppettider: {display_label}",
            f"Åmål Handel rekommenderar {hours}. Tiden är generell; kontrollera alltid den enskilda verksamheten.", 55))
    return items


def amal_simhall_closures(markup: str, source: dict, municipality: dict, today: date) -> list[dict]:
    text = text_content(markup)
    items = []
    for match in re.finditer(r"(?<!\d)(\d{1,2})/(\d{1,2})(?:[-/](\d{2,4}))?", text):
        if "stängt" not in text[match.end():match.end() + 55].lower():
            continue
        day_number, month_number, year = match.groups()
        year_number = int(year) if year else today.year
        if year_number < 100:
            year_number += 2000
        try:
            day = date(year_number, int(month_number), int(day_number))
        except ValueError:
            continue
        if day < today:
            continue
        items.append(base_item(source, municipality, day, "Åmåls simhall är stängd",
            f"Åmåls kommun anger att simhallen är stängd {day.strftime('%Y-%m-%d')}.", 65))
    if "stängt" not in text.lower():
        raise ValueError("Källan innehåller inga markerade stängningsdagar")
    unique = {item["validFrom"]: item for item in items}
    return list(unique.values())


ADAPTERS = {"amal_trade_recommended_hours": amal_trade_recommended_hours, "amal_simhall_closures": amal_simhall_closures}


def update(config: dict, previous: dict, now: datetime, fetcher=fetch_text) -> dict:
    municipalities = {}
    for code, municipality_config in config.get("municipalities", {}).items():
        municipality = {"name": municipality_config["name"], "code": code}
        items, health = [], []
        for source in municipality_config.get("sources", []):
            try:
                parsed = ADAPTERS[source["adapter"]](fetcher(source["url"]), source, municipality, now.date())
                for item in parsed:
                    item["verifiedAt"] = now.isoformat().replace("+00:00", "Z")
                items.extend(parsed)
                health.append({"id": source["id"], "name": source["name"], "url": source["url"], "status": "ok", "count": len(parsed)})
            except Exception as error:
                retained = [item for item in previous.get("municipalities", {}).get(code, {}).get("items", [])
                            if item.get("sourceUrl") == source["url"] and datetime.fromisoformat(item["validUntil"].replace("Z", "+00:00")) >= now]
                items.extend(retained)
                health.append({"id": source["id"], "name": source["name"], "url": source["url"], "status": "error", "retained": len(retained), "error": str(error)[:180]})
        municipalities[code] = {"name": municipality["name"], "items": sorted(items, key=lambda item: (item.get("validFrom", ""), -int(item.get("priority", 0)))), "sourceHealth": health}
    return {"version": "1.0.0", "generatedAt": now.isoformat().replace("+00:00", "Z"), "leadTimeDays": config.get("leadTimeDays", 14), "municipalities": municipalities}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=CONFIG_PATH)
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    previous = json.loads(args.output.read_text(encoding="utf-8")) if args.output.exists() else {}
    result = update(config, previous, datetime.now(timezone.utc))
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {sum(len(value['items']) for value in result['municipalities'].values())} deviations to {args.output}")


if __name__ == "__main__":
    main()
