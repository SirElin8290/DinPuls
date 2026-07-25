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
OUTPUT = ROOT / "data" / "lunch.json"
TIMEZONE = ZoneInfo("Europe/Stockholm")
USER_AGENT = "DinPuls/0.16.0 (+https://sirelin8290.github.io/DinPuls/)"
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
)


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


def extract_week(lines: list[str]) -> int | None:
    for line in lines:
        match = re.search(r"(?:vecka|v\.)\s*(\d{1,2})", line, re.I)
        if match:
            return int(match.group(1))
    return None


def weekday_key(line: str) -> str | None:
    normalized = line.lower().strip(" .:-")
    return DAYS.get(normalized)


def useful_dish(line: str) -> bool:
    lowered = line.lower()
    if len(line) < 5 or len(line) > 240:
        return False
    if any(lowered.startswith(marker) for marker in STOP_MARKERS):
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
    for line in lines:
        day = weekday_key(line)
        if day:
            active = day
            continue
        if active and any(line.lower().startswith(marker) for marker in STOP_MARKERS):
            active = None
            continue
        if active and useful_dish(line) and len(menu[active]) < 5:
            menu[active].append(line)
    return extract_week(lines), menu


def main() -> int:
    config = json.loads(SOURCES.read_text(encoding="utf-8"))
    now = datetime.now(TIMEZONE)
    current_week = now.isocalendar().week
    municipalities = {}

    for municipality, sources in config.get("municipalities", {}).items():
        restaurants = []
        for source in sources:
            item = {**source, "checkedAt": now.isoformat(timespec="seconds"), "weekNumber": None, "days": {}, "status": "source-only"}
            if source.get("parser") == "weekday-headings":
                try:
                    week, days = parse_weekday_menu(fetch(source["url"]))
                    item["weekNumber"] = week
                    item["days"] = days if week == current_week else {}
                    item["status"] = "current" if week == current_week and any(days.values()) else "outdated"
                except RuntimeError as error:
                    item["status"] = "unavailable"
                    item["error"] = str(error)
            restaurants.append(item)
            print(f"{municipality}: {source['name']} – {item['status']}")
        municipalities[municipality] = {"restaurants": restaurants}

    output = {
        "version": "0.16.0",
        "generatedAt": now.isoformat(timespec="seconds"),
        "timezone": "Europe/Stockholm",
        "currentWeek": current_week,
        "principle": "Exakta rätter visas bara när rätt vecka kan verifieras hos restaurangens originalkälla.",
        "municipalities": municipalities,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
