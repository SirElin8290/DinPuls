#!/usr/bin/env python3
"""Kompletterar Färgelandas bostadsmodul med aktuella annonser från SökBostad.

Valbohems egen listvy är JavaScript-renderad och kan inte alltid läsas från Actions.
Den här hämtaren använder därför den serverrenderade Färgelanda-sidan på SökBostad
som marknadsfallback. Endast annonser som ligger i sektionen för aktuella bostäder
före 'Tidigare uthyrda lägenheter' används.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "housing.json"
LIST_URL = "https://www.sokbostad.se/omrade/fargelanda/"
USER_AGENT = "DinPuls/0.25 (+https://dinpuls.se/)"


class TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.blocked = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript", "svg"}:
            self.blocked += 1
        elif not self.blocked and tag in {"p", "div", "li", "h1", "h2", "h3", "h4", "dt", "dd", "br"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript", "svg"} and self.blocked:
            self.blocked -= 1
        elif not self.blocked and tag in {"p", "div", "li", "h1", "h2", "h3", "h4", "dt", "dd"}:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.blocked:
            self.parts.append(data)

    def lines(self) -> list[str]:
        text = html.unescape("".join(self.parts)).replace("\xa0", " ")
        return [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if re.sub(r"\s+", " ", line).strip()]


def fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    try:
        with urlopen(request, timeout=35) as response:
            return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code} från {url}") from None
    except (URLError, TimeoutError) as error:
        raise RuntimeError(f"kunde inte nå {url}: {getattr(error, 'reason', error)}") from None


def lines(markup: str) -> list[str]:
    parser = TextParser()
    parser.feed(markup)
    return parser.lines()


def number(value: str) -> int | float | None:
    match = re.search(r"\d+(?:[ .]\d{3})*(?:[,.]\d+)?", value.replace("\xa0", " "))
    if not match:
        return None
    raw = match.group(0).replace(" ", "").replace(",", ".")
    try:
        value_num = float(raw)
        return int(value_num) if value_num.is_integer() else value_num
    except ValueError:
        return None


def current_detail_links(markup: str) -> list[str]:
    """Ta bara länkar från den aktuella annonsdelen, aldrig historiska/borttagna."""
    lower = markup.casefold()
    start = lower.find("lediga lägenheter i färgelanda")
    if start < 0:
        start = lower.find("lediga lägenheter")
    end = lower.find("tidigare uthyrda lägenheter", max(start, 0))
    section = markup[max(start, 0): end if end > start else len(markup)]
    found: list[str] = []
    for href in re.findall(r'href=["\']([^"\']*/hyresobjekt/[^"\'#?]+/?)["\']', section, flags=re.I):
        url = urljoin(LIST_URL, html.unescape(href)).rstrip("/") + "/"
        if url not in found:
            found.append(url)
    return found


def after_label(values: list[str], label: str) -> str:
    for index, value in enumerate(values[:-1]):
        if value.casefold() == label.casefold():
            return values[index + 1]
    return ""


def parse_detail(url: str) -> dict | None:
    values = lines(fetch(url))
    if not values:
        return None

    title = next((value for value in values if value.casefold().startswith("ledig lägenhet")), "")
    address = ""
    title_match = re.search(r"\bpå\s+(.+?)\s+i\s+[^–-]+(?:\s+[–-]|$)", title, flags=re.I)
    if title_match:
        address = title_match.group(1).strip()

    rent_text = next((value for value in values if re.search(r"\d[\d ]*\s*kr/mån", value, flags=re.I)), "")
    rent = number(rent_text)
    rooms_text = after_label(values, "Rum")
    size_text = after_label(values, "Yta")
    provider = after_label(values, "Hyresvärd")

    if not address:
        # På detaljsidan kommer adressen normalt direkt efter hyresraden.
        try:
            rent_index = values.index(rent_text)
        except ValueError:
            rent_index = -1
        if rent_index >= 0 and rent_index + 1 < len(values):
            candidate = values[rent_index + 1]
            if any(char.isdigit() for char in candidate):
                address = candidate.split(",", 1)[0].strip()

    rooms = number(rooms_text)
    if rooms is None:
        match = re.search(r"(\d+(?:[,.]\d+)?)\s*(?:rok|rum)", title, flags=re.I)
        rooms = number(match.group(1)) if match else None
    size = number(size_text)
    if size is None:
        match = re.search(r"(\d+(?:[,.]\d+)?)\s*m²", title, flags=re.I)
        size = number(match.group(1)) if match else None

    if not address or rent is None or rooms is None:
        return None
    provider = provider or "Hyresvärd via SökBostad"
    identifier = hashlib.sha1(f"{address}|{rent}|{provider}".encode("utf-8")).hexdigest()[:16]
    return {
        "id": identifier,
        "address": address,
        "area": "Färgelanda kommun",
        "rooms": rooms,
        "size": size,
        "rent": rent,
        "available": "Se källan",
        "url": url,
        "provider": provider,
    }


def main() -> int:
    markup = fetch(LIST_URL)
    detail_links = current_detail_links(markup)
    if not detail_links:
        raise RuntimeError("SökBostads Färgelanda-sida gav inga aktuella annonslänkar")

    listings: list[dict] = []
    seen: set[str] = set()
    for url in detail_links[:60]:
        try:
            item = parse_detail(url)
        except RuntimeError as error:
            print(f"VARNING Färgelanda detalj: {error}")
            continue
        if item and item["id"] not in seen:
            seen.add(item["id"])
            listings.append(item)

    if not listings:
        raise RuntimeError("Färgelandas aktuella annonslänkar kunde inte parsas till bostadsobjekt")

    housing = json.loads(OUTPUT.read_text(encoding="utf-8"))
    municipalities = housing.setdefault("municipalities", {})
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    previous = municipalities.get("Färgelanda", {})
    valbohem = [item for item in previous.get("listings", []) if item.get("provider") == "Valbohem AB"]
    merged: dict[str, dict] = {str(item.get("id")): item for item in valbohem if item.get("id")}
    for item in listings:
        merged[str(item["id"])] = item

    final_list = sorted(merged.values(), key=lambda item: (str(item.get("area") or ""), str(item.get("address") or "")))
    municipalities["Färgelanda"] = {
        **previous,
        "total": len(final_list),
        "listings": final_list,
        "providers": [
            {"name": "Valbohem AB", "url": "https://www.valbohem.se/ledigt/lagenhet", "official": True, "mode": "automatic-valbohem"},
            {"name": "SökBostad – Färgelanda", "url": LIST_URL, "official": False, "mode": "automatic-market-fallback"}
        ],
        "errors": [],
        "stale": False,
        "checkedAt": now,
        "updatedAt": now,
        "availabilityMode": "automatic",
        "sourceHealth": [
            {"provider": "SökBostad – Färgelanda", "url": LIST_URL, "mode": "automatic-market-fallback", "checkedAt": now, "status": "ok", "inventoryCount": len(listings)}
        ]
    }
    housing["generatedAt"] = now
    OUTPUT.write_text(json.dumps(housing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Färgelanda: {len(final_list)} bostäder, varav {len(listings)} från marknadsfallback")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
