#!/usr/bin/env python3
"""Uppdatera Odéons verifierade program och filtrera passerade visningar."""
from __future__ import annotations

import html
import json
import re
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "cinemas.json"
SOURCE = "https://www.odeonbio.se/"
SVEA_SOURCE = "https://www.dalsed.se/om-webbplatsen/prenumerera/bio-rss/"
STOCKHOLM = ZoneInfo("Europe/Stockholm")
MONTHS = {"januari": 1, "februari": 2, "mars": 3, "april": 4, "maj": 5, "juni": 6,
          "juli": 7, "augusti": 8, "september": 9, "oktober": 10, "november": 11, "december": 12}
DATE_RE = re.compile(r"^(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)\s+(\d{1,2})\s+(\w+)\s+(\d{1,2}):(\d{2})$", re.I)


class ProgramParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.heading = False
        self.current_title = None
        self.entries = []

    def handle_starttag(self, tag, attrs):
        if tag == "h2":
            self.heading = True

    def handle_endtag(self, tag):
        if tag == "h2":
            self.heading = False

    def handle_data(self, data):
        text = re.sub(r"\s+", " ", html.unescape(data)).strip()
        if not text:
            return
        if self.heading:
            self.current_title = text
        elif self.current_title and DATE_RE.match(text):
            self.entries.append((self.current_title, text))


def fetch(url=SOURCE):
    request = Request(url, headers={"User-Agent": "DinPuls/0.21.3 (+https://dinpuls.se/)", "Accept": "text/html"})
    with urlopen(request, timeout=30) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def parse_datetime(text, now):
    match = DATE_RE.match(text)
    if not match or match.group(3).lower() not in MONTHS:
        return None
    value = datetime(now.year, MONTHS[match.group(3).lower()], int(match.group(2)), int(match.group(4)), int(match.group(5)), tzinfo=STOCKHOLM)
    if value < now and (now - value).days > 180:
        value = value.replace(year=now.year + 1)
    return value


def parse_program(page, now):
    parser = ProgramParser()
    parser.feed(page)
    grouped = {}
    for title, raw_date in parser.entries:
        value = parse_datetime(raw_date, now)
        if value and value >= now:
            grouped.setdefault(title, []).append((value, raw_date))
    return [{"title": title, "label": " och ".join(raw for _, raw in dates),
             "showtimes": [value.isoformat(timespec="minutes") for value, _ in dates]}
            for title, dates in grouped.items()]


def build(data, page, now):
    cinemas = data["municipalities"]["Bengtsfors"]
    odeon = next(item for item in cinemas if item["name"] == "Odéon Bio & Teater")
    odeon["films"] = parse_program(page, now)
    odeon["programSource"] = SOURCE
    odeon["programCheckedAt"] = now.isoformat(timespec="seconds")
    data["updatedAt"] = now.date().isoformat()
    return data


def parse_svea_program(xml, now):
    """This official programme feed uses pubDate for the performance, in UTC."""
    root = ET.fromstring(xml)
    if root.tag != "rss" or root.find("channel") is None:
        raise ValueError("Inte ett giltigt bioprogram")
    grouped = {}
    for item in root.findall("./channel/item"):
        title = (item.findtext("title") or "").strip()
        url = (item.findtext("link") or "").strip()
        if not title or not url.startswith("https://www.dalsed.se/uppleva-och-gora/evenemang/"):
            raise ValueError("Ofullständig biopost")
        value = parsedate_to_datetime(item.findtext("pubDate") or "").astimezone(STOCKHOLM)
        if value >= now:
            film = grouped.setdefault(url, {"title": title, "url": url, "showtimes": []})
            stamp = value.isoformat(timespec="minutes")
            if stamp not in film["showtimes"]:
                film["showtimes"].append(stamp)
    for film in grouped.values():
        film["showtimes"].sort()
        film["label"] = " · ".join(datetime.fromisoformat(stamp).strftime("%d/%m %H:%M") for stamp in film["showtimes"])
    return sorted(grouped.values(), key=lambda film: film["showtimes"][0])


def update_svea(data, now):
    svea = next(item for item in data["municipalities"]["Dals-Ed"] if item["name"] == "Svea Bio")
    svea["programSource"] = SVEA_SOURCE
    svea["programCheckedAt"] = now.isoformat(timespec="seconds")
    try:
        svea["films"] = parse_svea_program(fetch(SVEA_SOURCE), now)
        svea["programStatus"] = "ok"
        svea.pop("programError", None)
    except Exception as error:
        svea["films"] = []
        svea["programStatus"] = "unavailable"
        svea["programError"] = type(error).__name__


def main():
    now = datetime.now(STOCKHOLM)
    data = json.loads(OUTPUT.read_text(encoding="utf-8"))
    try:
        page = fetch()
        build(data, page, now)
    except Exception as error:
        odeon = next(item for item in data["municipalities"]["Bengtsfors"] if item["name"] == "Odéon Bio & Teater")
        odeon["films"] = []
        odeon["programStatus"] = "unavailable"
        odeon["programError"] = type(error).__name__
    update_svea(data, now)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
