#!/usr/bin/env python3
"""Kompletterar data/housing.json med Sunne Fastighets officiella lediga lägenheter.

Sunne Fastighets AB publicerar sina objekt i WordPress i stället för de Vitec/
Momentum-system som övriga bostadskällor använder. Den här adaptern körs direkt
efter den ordinarie bostadshämtningen och uppdaterar endast kommunen Sunne.
"""
from __future__ import annotations

import html
import json
import re
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "housing.json"
SOURCE_URL = "https://sunnefastighet.se/lediga-lagenheter/"
PROVIDER_NAME = "Sunne Fastighets AB"
USER_AGENT = "DinPuls/0.9.2 (+https://sirelin8290.github.io/DinPuls/)"
FETCH_ATTEMPTS = 3
FETCH_TIMEOUT_SECONDS = 35


class SunneListingParser(HTMLParser):
    """Delar sidan i block från en lägenhetsrubrik (h3) till nästa h3."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_h3 = False
        self.h3_parts: list[str] = []
        self.current: dict | None = None
        self.blocks: list[dict] = []
        self.anchor_href = ""
        self.anchor_parts: list[str] = []
        self.in_anchor = False

    def _finish_current(self) -> None:
        if self.current:
            self.blocks.append(self.current)
            self.current = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "h3":
            self._finish_current()
            self.in_h3 = True
            self.h3_parts = []
        elif tag == "a" and self.current is not None:
            self.in_anchor = True
            self.anchor_href = str(attributes.get("href") or "")
            self.anchor_parts = []

    def handle_data(self, data: str) -> None:
        cleaned = " ".join(data.replace("\xa0", " ").split())
        if not cleaned:
            return
        if self.in_h3:
            self.h3_parts.append(cleaned)
        elif self.current is not None:
            self.current["text"].append(cleaned)
            if self.in_anchor:
                self.anchor_parts.append(cleaned)

    def handle_endtag(self, tag: str) -> None:
        if tag == "h3" and self.in_h3:
            title = " ".join(self.h3_parts).strip()
            self.in_h3 = False
            if title and title.lower() not in {"filtrera lägenheter", "lediga lägenheter", "kontakta oss", "besök- & postadress", "meny"}:
                self.current = {"title": title, "text": [], "url": ""}
        elif tag == "a" and self.in_anchor:
            anchor_text = " ".join(self.anchor_parts).lower()
            if self.current is not None and "läs mer om lägenheten" in anchor_text and self.anchor_href:
                self.current["url"] = self.anchor_href
            self.in_anchor = False
            self.anchor_href = ""
            self.anchor_parts = []

    def close(self) -> None:
        super().close()
        self._finish_current()


def fetch_page() -> str:
    last_error: Exception | None = None
    for attempt in range(1, FETCH_ATTEMPTS + 1):
        request = Request(
            SOURCE_URL,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.7",
            },
        )
        try:
            with urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
                return response.read().decode("utf-8", errors="replace")
        except (HTTPError, URLError, TimeoutError) as error:
            last_error = error
            if attempt < FETCH_ATTEMPTS:
                time.sleep(attempt * 2)
    raise RuntimeError(f"kunde inte nå Sunne Fastighets källa efter {FETCH_ATTEMPTS} försök: {last_error}")


def number(value: str) -> int | float | None:
    match = re.search(r"\d+(?:[.,]\d+)?", value.replace(" ", ""))
    if not match:
        return None
    result = float(match.group(0).replace(",", "."))
    return int(result) if result.is_integer() else result


def field(text: str, label: str, next_labels: list[str]) -> str:
    end = "|".join(re.escape(item) for item in next_labels)
    pattern = rf"{re.escape(label)}\s*(.*?)(?=\s*(?:{end})\s*|$)"
    match = re.search(pattern, text, flags=re.IGNORECASE)
    return match.group(1).strip() if match else ""


def parse_listings(page: str) -> list[dict]:
    parser = SunneListingParser()
    parser.feed(page)
    parser.close()
    listings: list[dict] = []
    seen: set[str] = set()

    for block in parser.blocks:
        text = " ".join(block["text"])
        if "Adress:" not in text or "Hyra:" not in text or "Tillträde:" not in text:
            continue
        address = field(text, "Adress:", ["Storlek:"])
        rooms_text = field(text, "Storlek:", ["Yta:"])
        size_text = field(text, "Yta:", ["Hyra:"])
        rent_text = field(text, "Hyra:", ["Tillträde:"])
        available = field(text, "Tillträde:", ["Läs mer om lägenheten"])
        url = urljoin(SOURCE_URL, html.unescape(str(block.get("url") or ""))) or SOURCE_URL
        id_match = re.search(r"\b\d{2}-\d{4}\b", str(block.get("title") or ""))
        identifier = id_match.group(0) if id_match else url.rstrip("/").rsplit("/", 1)[-1]
        if not identifier or identifier in seen or not address:
            continue
        seen.add(identifier)
        listings.append({
            "id": identifier,
            "address": address,
            "area": "Sunne",
            "rooms": number(rooms_text),
            "size": number(size_text),
            "rent": number(rent_text),
            "available": available,
            "url": url,
            "provider": PROVIDER_NAME,
        })
    return listings


def main() -> int:
    data = json.loads(OUTPUT.read_text(encoding="utf-8"))
    municipalities = data.setdefault("municipalities", {})
    previous = municipalities.get("Sunne", {})
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    try:
        page = fetch_page()
        listings = parse_listings(page)
        if not listings:
            raise RuntimeError("Sunne Fastighets sida kunde läsas men inga lägenhetsobjekt kunde tolkas")
        core = {
            "total": len(listings),
            "listings": listings,
            "providers": [{"name": PROVIDER_NAME, "url": SOURCE_URL, "official": True}],
        }
        old_core = {key: previous.get(key) for key in ("total", "listings", "providers")}
        municipalities["Sunne"] = {
            **core,
            "errors": [],
            "stale": False,
            "checkedAt": now,
            "updatedAt": previous.get("updatedAt", now) if core == old_core else now,
        }
        print(f"Sunne, {PROVIDER_NAME}: {len(listings)} objekt")
    except (RuntimeError, ValueError, TypeError, json.JSONDecodeError) as error:
        if previous:
            municipalities["Sunne"] = {
                **previous,
                "errors": [f"{PROVIDER_NAME}: {error}"],
                "stale": True,
                "checkedAt": now,
            }
            print(f"VARNING Sunne: {error}; tidigare data behålls")
        else:
            raise

    data["generatedAt"] = now
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
