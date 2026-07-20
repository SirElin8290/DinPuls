#!/usr/bin/env python3
"""Hämtar lediga bostäder från officiella kommunala bostadsbolag."""
from __future__ import annotations

import html
import json
import re
import sys
from http.cookiejar import CookieJar
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin
from urllib.request import HTTPCookieProcessor, Request, build_opener, urlopen

ROOT = Path(__file__).resolve().parents[1]
MUNICIPALITY_FILE = ROOT / "data" / "municipalities.json"
OUTPUT = ROOT / "data" / "housing.json"
USER_AGENT = "DinPuls/0.9.1 (+https://sirelin8290.github.io/DinPuls/)"


class HousingTableParser(HTMLParser):
    """Läser Vitec HSS-tabeller utan externa Python-paket."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_row = False
        self.row_depth = 0
        self.in_cell = False
        self.cells: list[str] = []
        self.cell_parts: list[str] = []
        self.link = ""
        self.address = ""
        self.rows: list[dict] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "tr":
            if not self.in_row:
                self.in_row = True
                self.row_depth = 1
                self.cells, self.link, self.address = [], "", ""
            else:
                self.row_depth += 1
        elif tag in {"td", "th"} and self.in_row and self.row_depth == 1:
            self.in_cell = True
            self.cell_parts = []
        elif tag == "a" and self.in_row and self.row_depth == 1:
            identifier = str(attributes.get("id", ""))
            href = str(attributes.get("href") or "")
            if identifier.endswith("ObjectDetailsUrl") or "hlDetails" in identifier or "ObjectDetailsTemplate" in href:
                self.link = href

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.cell_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self.in_cell and self.row_depth == 1:
            value = " ".join("".join(self.cell_parts).replace("\xa0", " ").split())
            self.cells.append(value)
            if self.link and not self.address and value:
                self.address = value
            self.in_cell = False
        elif tag == "tr" and self.in_row and self.row_depth > 1:
            self.row_depth -= 1
        elif tag == "tr" and self.in_row:
            if self.link and self.address:
                self.rows.append({"cells": self.cells[:], "link": self.link, "address": self.address})
            self.in_row = False
            self.row_depth = 0


class HiddenFieldParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.fields: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "input" and str(attributes.get("type", "")).lower() == "hidden" and attributes.get("name"):
            self.fields[str(attributes["name"])] = str(attributes.get("value") or "")


def get_json(path: Path, fallback: dict) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def fetch(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/json"})
    try:
        with urlopen(request, timeout=35) as response:
            return response.read()
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code}") from None
    except URLError as error:
        raise RuntimeError(f"kunde inte nå källan: {error.reason}") from None


def number(value: str) -> int | float | None:
    cleaned = "".join(character for character in value.replace(",", ".") if character.isdigit() or character == ".")
    try:
        result = float(cleaned)
        return int(result) if result.is_integer() else result
    except ValueError:
        return None


def parse_hss(provider: dict) -> list[dict]:
    parser = HousingTableParser()
    for page in fetch_hss_pages(provider["dataUrl"]):
        parser.feed(page)
    listings = []
    seen = set()
    for row in parser.rows:
        cells = row["cells"]
        address_index = next((i for i, value in enumerate(cells) if value == row["address"]), -1)
        tail = cells[address_index + 1:]
        # Åmåls tabell har en extra fastighetskolumn; de fyra sista
        # värdena före tillgänglighetsdatum är alltid rum, yta och hyra.
        if len(tail) < 5:
            continue
        availability_index = -2 if len(tail) >= 6 else -1
        availability = tail[availability_index]
        rent = number(tail[availability_index - 1])
        size = number(tail[availability_index - 2])
        rooms = number(tail[availability_index - 3])
        area_values = tail[:availability_index - 3]
        area = next((value for value in area_values if value), "")
        url = urljoin(provider["dataUrl"], html.unescape(row["link"]))
        identifier = url.rsplit("/", 1)[-1]
        if identifier in seen:
            continue
        seen.add(identifier)
        listings.append({
            "id": identifier,
            "address": row["address"],
            "area": area,
            "rooms": rooms,
            "size": size,
            "rent": rent,
            "available": availability,
            "url": url,
            "provider": provider["name"],
        })
    return listings


def fetch_hss_pages(url: str) -> list[str]:
    """Hämtar samtliga ASP.NET-resultatsidor med samma session."""
    opener = build_opener(HTTPCookieProcessor(CookieJar()))
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    try:
        first = opener.open(request, timeout=35).read().decode("utf-8", errors="replace")
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code}") from None
    except URLError as error:
        raise RuntimeError(f"kunde inte nå källan: {error.reason}") from None

    pagination_text = html.unescape(first).replace("\xa0", " ")
    match = re.search(r"lblNoOfPages[^>]*>(\d+)<", pagination_text, flags=re.IGNORECASE)
    total_pages = min(int(match.group(1)), 20) if match else 1
    pages = [first]
    current = first
    event_target = "ctl00$ctl01$DefaultSiteContentPlaceHolder1$Col1$ucNavBar$btnNavNext"
    for _ in range(1, total_pages):
        hidden = HiddenFieldParser()
        hidden.feed(current)
        form = hidden.fields
        form["__EVENTTARGET"] = event_target
        form["__EVENTARGUMENT"] = ""
        post = Request(
            url,
            data=urlencode(form).encode("utf-8"),
            headers={
                "User-Agent": USER_AGENT,
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": url,
            },
        )
        try:
            current = opener.open(post, timeout=35).read().decode("utf-8", errors="replace")
        except (HTTPError, URLError) as error:
            raise RuntimeError(f"sidbläddringen misslyckades: {error}") from None
        pages.append(current)
    return pages


def parse_arvika(provider: dict) -> list[dict]:
    payload = json.loads(fetch(provider["dataUrl"]))
    raw = payload.get("data", "[]")
    objects = json.loads(raw) if isinstance(raw, str) else raw
    listings = []
    for item in objects if isinstance(objects, list) else []:
        identifier = str(item.get("Guid") or item.get("Id") or "")
        if not identifier:
            continue
        listings.append({
            "id": identifier,
            "address": str(item.get("Adress1") or "Ledig lägenhet"),
            "area": str(item.get("AreaName") or item.get("Adress3") or ""),
            "rooms": item.get("NoOfRooms"),
            "size": item.get("Size"),
            "rent": item.get("TotalCost") or item.get("Cost"),
            "available": item.get("AvailableDate"),
            "url": urljoin(provider["url"], str(item.get("DetailsUrl") or provider["url"])),
            "provider": provider["name"],
        })
    return listings


def main() -> int:
    configuration = get_json(MUNICIPALITY_FILE, {})
    existing = get_json(OUTPUT, {"municipalities": {}})
    previous = existing.get("municipalities", {})
    municipalities = {}
    successful = 0
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    for municipality in configuration.get("municipalities", []):
        name = municipality.get("name", "")
        providers = municipality.get("housingProviders", [])
        listings = []
        errors = []
        fetched_any = False
        for provider in providers:
            parser_name = provider.get("parser")
            if not parser_name:
                continue
            try:
                fetched = parse_hss(provider) if parser_name == "vitec-hss" else parse_arvika(provider)
                listings.extend(fetched)
                fetched_any = True
                print(f"{name}, {provider['name']}: {len(fetched)} objekt")
            except (RuntimeError, ValueError, TypeError, json.JSONDecodeError) as error:
                errors.append(f"{provider.get('name', 'Källa')}: {error}")
                print(f"VARNING {name}: {errors[-1]}")

        provider_view = [{key: item[key] for key in ("name", "url", "official") if key in item} for item in providers]
        if fetched_any or not any(item.get("parser") for item in providers):
            content = {"total": len(listings), "listings": listings, "providers": provider_view, "errors": errors}
            old = previous.get(name, {})
            old_content = {key: value for key, value in old.items() if key != "updatedAt"}
            content["updatedAt"] = old.get("updatedAt", now) if content == old_content else now
            municipalities[name] = content
            successful += 1
        elif name in previous:
            municipalities[name] = previous[name]

    if successful == 0:
        print("Ingen bostadskälla kunde uppdateras; behåller befintlig housing.json")
        return 1

    candidate = {"municipalities": municipalities}
    if candidate == {"municipalities": existing.get("municipalities")}:
        print("Bostadsdata är oförändrad")
        return 0
    OUTPUT.write_text(json.dumps({"generatedAt": now, **candidate}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Skrev {OUTPUT} för {successful} kommuner")
    return 0


if __name__ == "__main__":
    sys.exit(main())
