#!/usr/bin/env python3
"""Hämta Forshagabostäders publika, serverrenderade lägenhetstabell."""
from __future__ import annotations

import hashlib
import html
import json
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "housing.json"
SOURCE_URL = "https://minasidor.forshagabostader.se/ledigt/lagenhet"
PROVIDER = "Forshagabostäder"
USER_AGENT = "DinPuls/0.25 (+https://dinpuls.se/)"


class HousingTableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[tuple[list[str], str]] = []
        self.in_row = False
        self.in_cell = False
        self.cells: list[str] = []
        self.parts: list[str] = []
        self.href = ""

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "tr":
            self.in_row = True
            self.cells = []
            self.href = ""
        elif self.in_row and tag in {"td", "th"}:
            self.in_cell = True
            self.parts = []
        elif self.in_row and tag == "a" and not self.href:
            self.href = str(attributes.get("href") or "")

    def handle_data(self, data):
        if self.in_cell:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if self.in_row and self.in_cell and tag in {"td", "th"}:
            value = re.sub(r"\s+", " ", " ".join(self.parts).replace("\xa0", " ")).strip()
            self.cells.append(value)
            self.in_cell = False
        elif self.in_row and tag == "tr":
            if self.cells:
                self.rows.append((self.cells[:], self.href))
            self.in_row = False


def fetch_text(url: str = SOURCE_URL) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    try:
        with urlopen(request, timeout=35) as response:
            return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code}") from None
    except (URLError, TimeoutError) as error:
        raise RuntimeError(f"kunde inte nå källan: {getattr(error, 'reason', error)}") from None


def number(value: object) -> int | float | None:
    raw = html.unescape(str(value or "")).replace("\xa0", " ").replace(",", ".")
    match = re.search(r"\d+(?:[ .]\d{3})*(?:\.\d+)?", raw)
    if not match:
        return None
    normalized = match.group(0).replace(" ", "")
    try:
        result = float(normalized)
        return int(result) if result.is_integer() else result
    except ValueError:
        return None


def stable_id(*parts: object) -> str:
    return hashlib.sha1("|".join(str(part or "") for part in parts).encode("utf-8")).hexdigest()[:16]


def parse_listings(markup: str) -> list[dict]:
    parser = HousingTableParser()
    parser.feed(markup)
    listings: list[dict] = []
    seen: set[str] = set()
    for cells, href in parser.rows:
        values = [value for value in cells if value]
        if len(values) < 7:
            continue
        address, area, rooms_raw, size_raw, rent_raw, floor_raw, available = values[-7:]
        if not address or address.casefold() == "adress" or not re.search(r"\d", rooms_raw):
            continue
        rooms = number(rooms_raw)
        size = number(size_raw)
        rent = number(rent_raw)
        floor = number(floor_raw)
        if rooms is None or size is None or rent is None:
            continue
        url = urljoin(SOURCE_URL, href) if href else SOURCE_URL
        identifier = stable_id(url, address, available)
        if identifier in seen:
            continue
        seen.add(identifier)
        item = {
            "id": identifier,
            "address": address,
            "area": area,
            "rooms": rooms,
            "size": size,
            "rent": rent,
            "available": available,
            "url": url,
            "provider": PROVIDER,
        }
        if floor is not None:
            item["floor"] = floor
        listings.append(item)
    return listings


def main() -> int:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    housing = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {"municipalities": {}}
    entry = housing.setdefault("municipalities", {}).setdefault("Forshaga", {})
    try:
        markup = fetch_text()
        listings = parse_listings(markup)
        if not listings:
            raise RuntimeError("Forshagabostäders tabell kändes igen men gav inga verifierbara objekt")
    except Exception as error:
        entry["sourceHealth"] = [{
            "provider": PROVIDER,
            "url": SOURCE_URL,
            "mode": "automatic-forshaga",
            "checkedAt": now,
            "status": "error",
            "message": str(error)[:220],
        }]
        entry["errors"] = [f"{PROVIDER}: {error}"]
        entry["stale"] = True
        entry["checkedAt"] = now
        housing["generatedAt"] = now
        OUTPUT.write_text(json.dumps(housing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        raise

    entry.update({
        "total": len(listings),
        "listings": listings,
        "providers": [{"name": PROVIDER, "url": SOURCE_URL, "official": True, "mode": "automatic-forshaga"}],
        "errors": [],
        "stale": False,
        "checkedAt": now,
        "updatedAt": now,
        "sourceHealth": [{
            "provider": PROVIDER,
            "url": SOURCE_URL,
            "mode": "automatic-forshaga",
            "checkedAt": now,
            "status": "ok",
            "inventoryCount": len(listings),
        }],
        "availabilityMode": "automatic",
    })
    housing["generatedAt"] = now
    OUTPUT.write_text(json.dumps(housing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Forshaga: {len(listings)} verifierade lägenheter från Forshagabostäder")
    return 0


if __name__ == "__main__":
    sys.exit(main())
