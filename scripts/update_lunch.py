#!/usr/bin/env python3
"""Hämtar verifierbara veckomenyer från restaurangernas egna sidor."""
from __future__ import annotations

import html
import json
import re
import sys
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "data" / "lunch-sources.json"
LAUNCH_SUPPLEMENT = ROOT / "data" / "lunch-launch-supplement.json"
HAMMARO_SUPPLEMENT = ROOT / "data" / "lunch-hammaro-supplement.json"
HAGFORS_SUPPLEMENT = ROOT / "data" / "lunch-hagfors-supplement.json"
OUTPUT = ROOT / "data" / "lunch.json"
TIMEZONE = ZoneInfo("Europe/Stockholm")
USER_AGENT = "DinPuls/0.21.2 (+https://sirelin8290.github.io/DinPuls/)"
EXPECTED_MUNICIPALITIES = {
    item["name"]
    for item in json.loads((ROOT / "data" / "municipalities.json").read_text(encoding="utf-8"))["municipalities"]
}
DAYS = {
    "måndag": "monday", "mandag": "monday",
    "tisdag": "tuesday", "onsdag": "wednesday",
    "torsdag": "thursday", "fredag": "friday",
    "lördag": "saturday", "lordag": "saturday",
    "söndag": "sunday", "sondag": "sunday",
}
STOP_MARKERS = (
    "veckans vegetariska", "sallader", "lunchpriser", "öppettider",
    "kontakt", "pris ", "barn ", "utkörningsservice", "ta kontakt",
    "catering", "ring oss", "galleri", "adress", "bordsbokning",
    "öppet för", "veckans meny", "inkl.", "sommarerbjudanden",
    "ladda ner", "med goda drycker", "övrigt", "lördagslunch",
    "veckans burgare", "veckans pasta",
    "ta en titt på vår meny", "kunden har alltid rätt",
    "det här tycker våra kunder",
)
NON_DISH_LINES = {
    "stängt", "lunchbuffé", "lunchbuffe", "helgbuffé",
    "dagens lunch", "veckans lunch", "måltidsdryck", "kaffe & kaka",
}


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.lines: list[str] = []
        self.blocked = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript", "svg"}:
            self.blocked += 1
        if not self.blocked and tag in {"p", "div", "li", "h1", "h2", "h3", "h4", "br"}:
            self.lines.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript", "svg"} and self.blocked:
            self.blocked -= 1
        if not self.blocked and tag in {"p", "div", "li", "h1", "h2", "h3", "h4"}:
            self.lines.append("\n")

    def handle_data(self, data):
        if not self.blocked:
            self.lines.append(data)

    def text_lines(self) -> list[str]:
        text = html.unescape("".join(self.lines))
        return [re.sub(r"\s+", " ", line).strip(" \t–—|") for line in text.splitlines() if re.sub(r"\s+", " ", line).strip(" \t–—|")]


def fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    try:
        with urlopen(request, timeout=30) as response:
            return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code}") from None
    except URLError as error:
        raise RuntimeError(str(error.reason)) from None
    except TimeoutError:
        raise RuntimeError("timeout") from None


def fetch_source(source: dict, fetcher=fetch) -> str:
    page = fetcher(source.get("dataUrl") or source["url"])
    if source.get("dataFormat") != "wordpress-page":
        return page
    try:
        payload = json.loads(page)
        rendered = payload[0]["content"]["rendered"]
        if not isinstance(rendered, str) or not rendered.strip():
            raise ValueError
        return rendered
    except (IndexError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        raise RuntimeError("ogiltigt WordPress-svar") from None


def extract_week(lines: list[str]) -> int | None:
    for line in lines:
        match = re.search(r"(?:vecka|v\.)\s*(\d{1,2})", line, re.I)
        if match:
            return int(match.group(1))
    return None


def weekday_key(line: str) -> str | None:
    normalized = line.lower().strip(" .:-")
    for swedish, english in DAYS.items():
        if re.fullmatch(rf"{re.escape(swedish)}(?:\s+\d{{1,2}}(?:[/.]\d{{1,2}})?)?", normalized):
            return english
    return None


def useful_dish(line: str) -> bool:
    lowered = line.lower()
    if len(line) < 5 or len(line) > 240:
        return False
    if any(lowered.startswith(marker) for marker in STOP_MARKERS):
        return False
    if lowered in NON_DISH_LINES:
        return False
    if re.fullmatch(r"\d+\s*(?::-|kr|kronor)?", lowered):
        return False
    if re.fullmatch(r"\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}", lowered):
        return False
    if re.search(r"(telefon|^\d{3,5}\s*[- ]\s*\d{2,}|\d{3}\s\d{2}\s+\D)", lowered):
        return False
    if re.fullmatch(r"(meny|hem|lunchmeny|dagens lunch|veckans lunchbuffé)", lowered):
        return False
    return True


def parse_weekday_menu(page: str) -> tuple[int | None, dict[str, list[str]]]:
    parser = TextExtractor()
    parser.feed(page)
    lines = parser.text_lines()
    menu = {key: [] for key in DAYS.values()}
    active = None
    seen_days: set[str] = set()
    for line in lines:
        day = weekday_key(line)
        if day:
            if day in seen_days:
                break
            seen_days.add(day)
            active = day
            continue
        if active and any(line.lower().startswith(marker) for marker in STOP_MARKERS):
            active = None
            continue
        if active and useful_dish(line) and len(menu[active]) < 5:
            menu[active].append(line)
    return extract_week(lines), menu


def parse_all_days_menu(page: str) -> tuple[int | None, dict[str, list[str]]]:
    parser = TextExtractor()
    parser.feed(page)
    lines = parser.text_lines()
    dishes: list[str] = []
    active = False
    for line in lines:
        normalized = line.lower().strip(" .:-")
        if "alla dagar" in normalized:
            active = True
            continue
        if active and (weekday_key(line) or any(normalized.startswith(marker) for marker in STOP_MARKERS)):
            break
        if active and useful_dish(line) and len(dishes) < 5:
            dishes.append(line)
    return extract_week(lines), {day: list(dishes) for day in ("monday", "tuesday", "wednesday", "thursday", "friday")}


def merge_config(config: dict) -> dict:
    """Add verified supplements without rewriting the established source catalog."""
    municipalities = config.setdefault("municipalities", {})
    references = config.setdefault("referenceSources", {})
    for supplement_path in (LAUNCH_SUPPLEMENT, HAMMARO_SUPPLEMENT, HAGFORS_SUPPLEMENT):
        if not supplement_path.exists():
            continue
        supplement = json.loads(supplement_path.read_text(encoding="utf-8"))
        supplement_municipalities = supplement.get("municipalities") or {}
        if supplement_path == HAGFORS_SUPPLEMENT and supplement.get("restaurants"):
            supplement_municipalities = {"Hagfors": supplement["restaurants"]}
        for name, sources in supplement_municipalities.items():
            current = municipalities.setdefault(name, [])
            by_id = {str(item.get("id")): index for index, item in enumerate(current) if isinstance(item, dict)}
            for item in sources:
                if not isinstance(item, dict):
                    continue
                source_id = str(item.get("id"))
                if source_id in by_id:
                    current[by_id[source_id]] = {**current[by_id[source_id]], **item}
                else:
                    by_id[source_id] = len(current)
                    current.append(item)
        for name, sources in (supplement.get("referenceSources") or {}).items():
            current = references.setdefault(name, [])
            seen = {str(item.get("url")) for item in current if isinstance(item, dict)}
            current.extend(item for item in sources if isinstance(item, dict) and str(item.get("url")) not in seen)
    return config


def validate_config(config: dict) -> None:
    municipalities = config.get("municipalities", {})
    missing = EXPECTED_MUNICIPALITIES - set(municipalities)
    if missing:
        raise ValueError(f"Kommuner saknas: {', '.join(sorted(missing))}")
    seen: set[str] = set()
    for municipality, sources in municipalities.items():
        for source in sources:
            source_id = source.get("id")
            if not source_id or source_id in seen:
                raise ValueError(f"Saknat eller dubblerat restaurang-id: {source_id!r} ({municipality})")
            if not source.get("name") or not source.get("url"):
                raise ValueError(f"Ofullständig restaurangkälla: {source_id}")
            seen.add(source_id)


def build_output(config: dict, now: datetime, fetcher=fetch) -> dict:
    config = merge_config(config)
    validate_config(config)
    current_week = now.isocalendar().week
    municipalities = {}

    for municipality, sources in config.get("municipalities", {}).items():
        restaurants = []
        for source in sources:
            item = {
                **source,
                "checkedAt": now.isoformat(timespec="seconds"),
                "weekNumber": None,
                "days": {},
                "status": "reference",
                "mode": "reference",
            }
            if source.get("parser") in {"weekday-headings", "all-days-heading"}:
                try:
                    page = fetch_source(source, fetcher)
                    if source.get("parser") == "all-days-heading":
                        week, days = parse_all_days_menu(page)
                        if any(days.values()):
                            week = current_week
                    else:
                        week, days = parse_weekday_menu(page)
                    if source.get("id") == "mickans-grill":
                        days = {day: [dish for dish in dishes if dish != "$9.95"] for day, dishes in days.items()}
                    item["weekNumber"] = week
                    item["days"] = days if week == current_week else {}
                    item["status"] = "current" if week == current_week and any(days.values()) else "outdated"
                    item["mode"] = "automatic"
                except RuntimeError as error:
                    item["status"] = "unavailable"
                    item["mode"] = "reference" if source.get("fallbackMode") == "reference" else "automatic"
                    item["error"] = str(error)
            if source.get("seasonal"):
                item["seasonal"] = True
            restaurants.append(item)
        municipalities[municipality] = {
            "restaurants": restaurants,
            "referenceSources": config.get("referenceSources", {}).get(municipality, []),
        }

    return {
        "version": "0.21.3",
        "generatedAt": now.isoformat(timespec="seconds"),
        "timezone": "Europe/Stockholm",
        "currentWeek": current_week,
        "principle": "Exakta rätter visas bara när rätt vecka kan verifieras hos restaurangens originalkälla.",
        "municipalities": municipalities,
    }


def main() -> int:
    config = json.loads(SOURCES.read_text(encoding="utf-8"))
    now = datetime.now(TIMEZONE)
    output = build_output(config, now)
    for municipality, entry in output["municipalities"].items():
        for item in entry["restaurants"]:
            print(f"{municipality}: {item['name']} – {item['status']}")
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
