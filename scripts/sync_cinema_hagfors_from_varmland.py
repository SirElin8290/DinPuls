#!/usr/bin/env python3
"""Synka Bio Hagfors Fasaden från Värmlands Biografnätverks officiella program."""
from __future__ import annotations

import html
import json
import re
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CINEMAS = ROOT / "data" / "cinemas.json"
PROGRAM_SOURCE = "https://www.varmland.bio/bio-hagfors/"
TZ = ZoneInfo("Europe/Stockholm")
MONTHS = {
    "januari": 1, "februari": 2, "mars": 3, "april": 4, "maj": 5, "juni": 6,
    "juli": 7, "augusti": 8, "september": 9, "oktober": 10, "november": 11, "december": 12,
}
DATE_RE = re.compile(r"^(\d{1,2})\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december),?\s+(\d{4})$", re.I)
TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})$")


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.current_href = ""
        self.current_text: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.current_href = dict(attrs).get("href") or ""
            self.current_text = []

    def handle_data(self, data):
        if self.current_href:
            self.current_text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.current_href:
            text = re.sub(r"\s+", " ", html.unescape(" ".join(self.current_text))).strip()
            href = urljoin(PROGRAM_SOURCE, self.current_href)
            if "/produktion/" in href:
                self.links.append((text, href))
            self.current_href = ""
            self.current_text = []


class TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data):
        text = re.sub(r"\s+", " ", html.unescape(data)).strip()
        if text:
            self.parts.append(text)


def fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": "DinPuls/0.21 (+https://dinpuls.se/)", "Accept": "text/html"})
    with urlopen(request, timeout=30) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def production_links(page: str) -> list[tuple[str, str]]:
    parser = LinkParser()
    parser.feed(page)
    seen = set()
    result = []
    for title, url in parser.links:
        if url in seen:
            continue
        seen.add(url)
        result.append((title, url))
    return result


def parse_showtimes(page: str, now: datetime) -> list[datetime]:
    parser = TextParser()
    parser.feed(page)
    parts = parser.parts
    values: list[datetime] = []
    for index, text in enumerate(parts):
        date_match = DATE_RE.match(text)
        if not date_match:
            continue
        month = MONTHS[date_match.group(2).casefold()]
        day = int(date_match.group(1))
        year = int(date_match.group(3))
        # WordPress-sidan visar datum, tid, salong och därefter biografnamn.
        window = parts[index + 1:index + 8]
        time_text = next((item for item in window if TIME_RE.match(item)), None)
        if not time_text:
            continue
        venue_window = " ".join(window).casefold()
        if "hagfors bio fasaden" not in venue_window and "bio hagfors fasaden" not in venue_window:
            continue
        tm = TIME_RE.match(time_text)
        assert tm is not None
        value = datetime(year, month, day, int(tm.group(1)), int(tm.group(2)), tzinfo=TZ)
        if value >= now and value not in values:
            values.append(value)
    return sorted(values)


def collect(now: datetime | None = None) -> list[dict]:
    now = now or datetime.now(TZ)
    films: list[dict] = []
    for title, url in production_links(fetch(PROGRAM_SOURCE)):
        try:
            times = parse_showtimes(fetch(url), now)
        except Exception:
            continue
        if not times:
            continue
        clean_title = title.strip() or url.rstrip("/").rsplit("/", 1)[-1].replace("-", " ").title()
        films.append({
            "title": clean_title,
            "url": url,
            "showtimes": [value.isoformat(timespec="minutes") for value in times],
            "label": " · ".join(value.strftime("%d/%m %H:%M") for value in times),
        })
    films.sort(key=lambda item: item["showtimes"][0])
    return films


def main() -> int:
    data = json.loads(CINEMAS.read_text(encoding="utf-8"))
    venues = data.setdefault("municipalities", {}).get("Hagfors") or []
    if not venues:
        raise RuntimeError("Bio Hagfors Fasaden saknas i data/cinemas.json")
    cinema = venues[0]
    now = datetime.now(TZ)
    try:
        films = collect(now)
        if not films:
            raise RuntimeError("Inga framtida Hagfors-visningar kunde verifieras")
        cinema["films"] = films
        cinema["programSource"] = PROGRAM_SOURCE
        cinema["programCheckedAt"] = now.isoformat(timespec="seconds")
        cinema["programStatus"] = "ok"
        cinema.pop("programError", None)
    except Exception as error:
        # Behåll senaste verifierade programmet vid källfel; markera bara kontrollstatus.
        cinema["programSource"] = PROGRAM_SOURCE
        cinema["programCheckedAt"] = now.isoformat(timespec="seconds")
        cinema["programStatus"] = "stale" if cinema.get("films") else "unavailable"
        cinema["programError"] = type(error).__name__
    CINEMAS.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Hagfors bio: {len(cinema.get('films') or [])} filmer, status={cinema.get('programStatus')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
