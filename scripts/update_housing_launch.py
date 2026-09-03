#!/usr/bin/env python3
"""Update housing coverage for municipalities in the 21-municipality launch.

Three source types are intentionally supported:
- automatic-filipstad: server-rendered table of currently available apartments.
- automatic-hagfors: official server-rendered facts blocks.
- automatic-valbohem: official list + detail pages.
- official-reference: verify the official rental entry point without pretending that
  a JS/private rental backend has been mirrored.

A verified reference source is not reported as zero inventory. It is reported as
"official-reference" so the public UI can send the visitor to the authoritative source.
"""
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
SOURCES = ROOT / "data" / "housing-launch-sources.json"
OUTPUT = ROOT / "data" / "housing.json"
USER_AGENT = "DinPuls/0.24 (+https://dinpuls.se/)"


class TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.blocked = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript", "svg"}:
            self.blocked += 1
        elif not self.blocked and tag in {"p", "div", "li", "h1", "h2", "h3", "h4", "tr", "td", "th", "br"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript", "svg"} and self.blocked:
            self.blocked -= 1
        elif not self.blocked and tag in {"p", "div", "li", "h1", "h2", "h3", "h4", "tr", "td", "th"}:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.blocked:
            self.parts.append(data)

    def lines(self) -> list[str]:
        text = html.unescape("".join(self.parts)).replace("\xa0", " ")
        return [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if re.sub(r"\s+", " ", line).strip()]


class TableParser(HTMLParser):
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


def fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    try:
        with urlopen(request, timeout=35) as response:
            return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code}") from None
    except (URLError, TimeoutError) as error:
        raise RuntimeError(f"kunde inte nå källan: {getattr(error, 'reason', error)}") from None


def num(value: object) -> int | float | None:
    raw = str(value or "").replace("\xa0", " ").replace(",", ".")
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


def text_lines(markup: str) -> list[str]:
    parser = TextParser()
    parser.feed(markup)
    return parser.lines()


def parse_filipstad(source: dict) -> list[dict]:
    markup = fetch_text(source["url"])
    table = TableParser()
    table.feed(markup)
    listings: list[dict] = []
    for cells, href in table.rows:
        if len(cells) < 6:
            continue
        address, area, rooms_raw, size_raw, rent_raw, available = cells[-6:]
        if not address or address.casefold() == "adress" or not re.search(r"\d", rooms_raw):
            continue
        url = urljoin(source["url"], href) if href else source["url"]
        listings.append({
            "id": stable_id(address, area, available, rent_raw),
            "address": address,
            "area": area,
            "rooms": num(rooms_raw),
            "size": num(size_raw),
            "rent": num(rent_raw),
            "available": available,
            "url": url,
            "provider": source["provider"],
        })
    if not listings:
        lines = text_lines(markup)
        if not any("Lediga lägenheter" in line for line in lines):
            raise RuntimeError("kunde inte känna igen Filipstadsbostäders lediga-lista")
    return listings


def parse_hagfors(source: dict) -> list[dict]:
    markup = fetch_text(source["url"])
    lines = text_lines(markup)
    listings: list[dict] = []
    seen: set[str] = set()
    for index, line in enumerate(lines):
        if line.casefold() != "fakta:":
            continue
        block = lines[index + 1:index + 12]
        if not block:
            continue
        address = block[0]
        rooms_line = next((item for item in block if re.search(r"\b\d+\s*ROK\b", item, re.I)), "")
        rent_line = next((item for item in block if item.casefold().startswith("hyra ")), "")
        if not rooms_line or not rent_line:
            continue
        room_match = re.search(r"(\d+)\s*ROK", rooms_line, re.I)
        size_match = re.search(r"(\d+(?:[,.]\d+)?)\s*m2", rooms_line, re.I)
        available = next((item for item in block if re.search(r"kommer in|tillgäng", item, re.I)), "Se källan")
        identifier = stable_id(address, rent_line)
        if identifier in seen:
            continue
        seen.add(identifier)
        listings.append({
            "id": identifier,
            "address": address,
            "area": "Hagfors kommun",
            "rooms": int(room_match.group(1)) if room_match else None,
            "size": num(size_match.group(1)) if size_match else None,
            "rent": num(rent_line),
            "available": available,
            "url": source["url"],
            "provider": source["provider"],
        })
    if not listings and not any("Lediga lägenheter" in line for line in lines):
        raise RuntimeError("kunde inte känna igen Hagforshems lediga-lista")
    return listings


def valbohem_detail(url: str, source: dict) -> dict | None:
    lines = text_lines(fetch_text(url))
    if not lines:
        return None
    object_number_line = next((line for line in lines if line.startswith("Objektnr.:") or line.startswith("Objektnr:")), "")
    identifier = object_number_line.split(":", 1)[-1].strip() if object_number_line else url.rstrip("/").rsplit("/", 1)[-1]
    rent_size = next((line for line in lines if " kr" in line and ("m2" in line or "m²" in line)), "")
    rent = num(rent_size.split("kr", 1)[0]) if rent_size else None
    after_bullet = rent_size.split("•", 1)[1] if "•" in rent_size else ""
    size = num(after_bullet)
    rooms_line = next((line for line in lines if re.search(r"\d+\s+rum och kök", line, re.I)), "")
    room_match = re.search(r"(\d+)\s+rum", rooms_line, re.I)
    area_line = next((line for line in lines if line.startswith("Ort:")), "")
    available_line = next((line for line in lines if line.startswith("Tillgänglig fr.o.m:")), "")
    address = next((line for line in lines if line.startswith("# ")), "")
    if not address:
        rent_index = lines.index(rent_size) if rent_size in lines else min(len(lines), 8)
        candidates = [line for line in lines[:rent_index] if len(line) > 3 and "ledig lägenhet" not in line.casefold()]
        address = candidates[-1] if candidates else "Ledig lägenhet"
    if not identifier or rent is None:
        return None
    return {
        "id": identifier,
        "address": address,
        "area": area_line.split(":", 1)[-1].strip() if area_line else "Färgelanda kommun",
        "rooms": int(room_match.group(1)) if room_match else None,
        "size": size,
        "rent": rent,
        "available": available_line.split(":", 1)[-1].strip() if available_line else "Se källan",
        "url": url,
        "provider": source["provider"],
    }


def parse_valbohem(source: dict) -> list[dict]:
    markup = fetch_text(source["url"])
    hrefs = []
    for href in re.findall(r'href=["\']([^"\']+/ledigt/detalj/id/[^"\']+)["\']', markup, flags=re.I):
        url = urljoin(source["url"], html.unescape(href))
        if url not in hrefs:
            hrefs.append(url)
    listings = []
    for url in hrefs[:80]:
        item = valbohem_detail(url, source)
        if item:
            listings.append(item)
    if not listings:
        lines = text_lines(markup)
        if not any("ledig" in line.casefold() and "lägen" in line.casefold() for line in lines):
            raise RuntimeError("kunde inte känna igen Valbohems lediga-lista")
    return listings


def main() -> int:
    source_config = json.loads(SOURCES.read_text(encoding="utf-8"))
    housing = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {"municipalities": {}}
    municipalities = housing.setdefault("municipalities", {})
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    failures: list[str] = []

    for name, source in (source_config.get("municipalities") or {}).items():
        entry = municipalities.setdefault(name, {"total": 0, "listings": [], "providers": []})
        mode = source.get("mode")
        health = {
            "provider": source.get("provider"),
            "url": source.get("url"),
            "mode": mode,
            "checkedAt": now,
        }
        try:
            if mode == "automatic-filipstad":
                listings = parse_filipstad(source)
            elif mode == "automatic-hagfors":
                listings = parse_hagfors(source)
            elif mode == "automatic-valbohem":
                listings = parse_valbohem(source)
            elif mode == "automatic-hogia":
                from update_housing import parse_hogia
                listings = parse_hogia({**source, "name": source["provider"]})
            elif mode == "official-reference":
                fetch_text(source["url"])
                listings = None
            else:
                raise RuntimeError(f"okänt launch-läge: {mode}")

            health["status"] = "ok"
            health["inventoryCount"] = len(listings) if isinstance(listings, list) else None
            provider_view = {"name": source["provider"], "url": source["url"], "official": True, "mode": mode}
            entry["providers"] = [provider_view]
            entry["sourceHealth"] = [health]
            entry["errors"] = []
            entry["stale"] = False
            entry["checkedAt"] = now
            entry["availabilityMode"] = "automatic" if isinstance(listings, list) else "official-reference"
            if isinstance(listings, list):
                entry["listings"] = listings
                entry["total"] = len(listings)
                entry["updatedAt"] = now
            else:
                entry["listings"] = []
                entry["total"] = None
                entry["updatedAt"] = now
            print(f"{name}: {mode} – {health['inventoryCount'] if health['inventoryCount'] is not None else 'officiell källa'}")
        except Exception as error:
            health["status"] = "error"
            health["message"] = str(error)[:220]
            entry["sourceHealth"] = [health]
            entry["errors"] = [f"{source.get('provider')}: {error}"]
            entry["stale"] = True
            entry["checkedAt"] = now
            failures.append(f"{name}: {error}")
            print(f"VARNING {name}: {error}")

    housing["generatedAt"] = now
    OUTPUT.write_text(json.dumps(housing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if failures:
        raise SystemExit("Launch housing source failures:\n- " + "\n- ".join(failures))
    return 0


if __name__ == "__main__":
    sys.exit(main())
