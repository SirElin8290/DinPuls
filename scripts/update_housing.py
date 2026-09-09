#!/usr/bin/env python3
"""Hämtar lediga bostäder från officiella kommunala bostadsbolag."""
from __future__ import annotations

import html
import json
import re
import sys
import uuid
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
USER_AGENT = "DinPuls/0.9.2 (+https://sirelin8290.github.io/DinPuls/)"


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


class VisibleContentParser(HTMLParser):
    """Collect visible text and links from server-rendered provider pages."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.links: list[str] = []
        self.blocked = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript", "svg"}:
            self.blocked += 1
        elif tag == "a" and not self.blocked:
            href = dict(attrs).get("href")
            if href:
                self.links.append(str(href))

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "svg"} and self.blocked:
            self.blocked -= 1

    def handle_data(self, data: str) -> None:
        value = " ".join(data.replace("\xa0", " ").split())
        if value and not self.blocked:
            self.parts.append(value)


def visible_content(url: str) -> tuple[list[str], list[str]]:
    parser = VisibleContentParser()
    parser.feed(fetch(url).decode("utf-8", errors="replace"))
    return parser.parts, [urljoin(url, link) for link in parser.links]


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
    except (URLError, TimeoutError) as error:
        raise RuntimeError(f"kunde inte nå källan: {getattr(error, 'reason', error)}") from None


def number(value: str) -> int | float | None:
    cleaned = "".join(character for character in value.replace(",", ".") if character.isdigit() or character == ".")
    try:
        result = float(cleaned)
        return int(result) if result.is_integer() else result
    except ValueError:
        return None


def room_count(value: object) -> int | float | None:
    """Läser både numeriska rumsvärden och texter som '3 Rum och kök'."""
    if isinstance(value, (int, float)):
        return value
    match = re.search(r"\d+(?:[,.]\d+)?", str(value or ""))
    return number(match.group(0)) if match else None


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
    except (URLError, TimeoutError) as error:
        raise RuntimeError(f"kunde inte nå källan: {getattr(error, 'reason', error)}") from None

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
        except (HTTPError, URLError, TimeoutError) as error:
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


def momentum_date(value: object) -> str | None:
    match = re.search(r"/Date\((\d+)", str(value or ""))
    if not match:
        return None
    return datetime.fromtimestamp(int(match.group(1)) / 1000, tz=timezone.utc).isoformat(timespec="seconds")


def fetch_json_url(url: str, headers: dict[str, str] | None = None) -> dict:
    request_headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    request_headers.update(headers or {})
    try:
        with urlopen(Request(url, headers=request_headers), timeout=35) as response:
            return json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code}") from None
    except (URLError, TimeoutError) as error:
        raise RuntimeError(f"kunde inte nå källan: {getattr(error, 'reason', error)}") from None


def parse_momentum(provider: dict) -> list[dict]:
    settings_url = urljoin(provider["url"], "/assets/app-settings.json")
    settings = fetch_json_url(settings_url)
    api_base = str(settings.get("apiBaseUrl") or "")
    api_key = str(settings.get("xApiKey") or "")
    client_id = str(settings.get("appInstanceId") or "")
    if not api_base or not api_key or not client_id:
        raise RuntimeError("Momentum-konfigurationen är ofullständig")

    headers = {
        "X-Api-Key": api_key,
        "Accept-Language": "sv-SE",
        "X-Momentum-Client-Version": str(settings.get("appVersion") or ""),
        "X-Momentum-Client": "momentum.se-fastighetminasidor",
        "X-Momentum-Client-Id": client_id,
        "X-Momentum-Device-Key": str(uuid.uuid5(uuid.NAMESPACE_URL, provider["url"])),
    }

    items = []
    expected_count = None
    limit = 100
    for offset in range(0, 10000, limit):
        query = urlencode({"type": "residential", "limit": limit, "offset": offset})
        api_url = urljoin(api_base.rstrip("/") + "/", "v2/market/objects") + "?" + query
        payload = fetch_json_url(api_url, headers)
        page_items = payload.get("items") if isinstance(payload, dict) else None
        count = payload.get("count") if isinstance(payload, dict) else None
        if not isinstance(page_items, list) or not isinstance(count, int):
            raise RuntimeError("Momentum: oväntat svarsformat, inte ett verifierat resultat")
        if expected_count is None:
            expected_count = count
        elif count != expected_count:
            raise RuntimeError("Momentum: totalantalet ändrades under sidbläddringen")
        items.extend(page_items)
        if len(items) >= expected_count:
            break
        if not page_items:
            raise RuntimeError("Momentum: ofullständig sidbläddring")
    if expected_count is None or len(items) != expected_count:
        raise RuntimeError(f"Momentum: hämtade {len(items)} av {expected_count} objekt")

    listings = []
    for item in items:
        identifier = str(item.get("id") or "")
        if not identifier:
            continue
        pricing = item.get("pricing") or {}
        location = item.get("location") or {}
        area = location.get("area") or {}
        size = item.get("size") or {}
        availability = item.get("availability") or {}
        listings.append({
            "id": identifier,
            "address": str(item.get("displayName") or "Ledig lägenhet"),
            "area": str(area.get("displayName") or ""),
            "rooms": room_count(size.get("rooms") or size.get("roomsDisplayName") or size.get("shortRoomsDisplayName")),
            "size": size.get("area"),
            "rent": pricing.get("priceInclVAT") or pricing.get("price"),
            "available": momentum_date(availability.get("availableFrom")),
            "url": provider["url"].rstrip("/") + "/" + identifier,
            "provider": provider["name"],
        })
    return listings


def parse_maleon(provider: dict) -> list[dict]:
    """Read every Segmon apartment linked from Maleon's vacancies page."""
    _, links = visible_content(provider["url"])
    detail_urls = sorted({link.rstrip("/") + "/" for link in links if "/portfolio/segmon-" in link})
    if not detail_urls:
        raise RuntimeError("Maleon: sidan med lediga lägenheter saknar verifierbara objekt")
    listings = []
    for url in detail_urls:
        parts, _ = visible_content(url)
        text = " | ".join(parts)
        detail = text[text.find("Beskrivning:"):] if "Beskrivning:" in text else text
        detail = detail.split("| Kontakta oss", 1)[0]
        title = next((part.split("–", 1)[0].strip() for part in parts
                      if part.startswith("Segmon,") and re.search(r",\s*\d{4}\s*(?:–|$)", part)), "")
        address_match = re.search(r"(?:Adress:|Street address:)\s*\|?\s*([^|]+)", detail, re.I)
        if not address_match:
            address_match = re.search(r"Grums kommun\s*\|\s*([^|]+)", detail, re.I)
        address = " ".join((address_match.group(1) if address_match else title.removeprefix("Segmon,")).split())
        title_address = title.removeprefix("Segmon,").rsplit(",", 1)[0].strip()
        if (title and title_address.casefold() == address.casefold()
                and re.search(r",\s*\d{4}$", title) and not re.search(r"\d{4}$", address)):
            address += " " + title.rsplit(",", 1)[-1].strip()
        size_match = re.search(r"(?:Storlek:|Size \(square meters\):)\s*(?:\|\s*)?(\d+(?:[,.]\d+)?)", detail, re.I)
        if not size_match:
            size_match = re.search(r"(?:^|\|)\s*(?:ca\s*)?(\d+(?:[,.]\d+)?)\s*kvm", detail, re.I)
        rooms_match = re.search(r"(?:Rum:|Rooms:)\s*(?:\|\s*)?(\d+(?:[,.]\d+)?)", detail, re.I)
        if not rooms_match:
            rooms_match = re.search(r"(?:^|\|)\s*(\d+(?:[,.]\d+)?)\s+rum och kök", detail, re.I)
        rent_match = re.search(r"(?:Hyra:|Rent price:)\s*(?:\|\s*)?([\d ,.]+)\s*(?:kr|SEK)", detail, re.I)
        if not address:
            raise RuntimeError(f"Maleon: objektet saknar adress: {url}")
        listings.append({
            "id": url.rstrip("/").rsplit("/", 1)[-1], "address": address, "area": "Segmon",
            "rooms": number(rooms_match.group(1)) if rooms_match else None,
            "size": number(size_match.group(1)) if size_match else None,
            "rent": number(re.sub(r"\D", "", rent_match.group(1))) if rent_match else None,
            "available": "Se källan", "url": url, "provider": provider["name"],
        })
    return listings


def parse_strandell(provider: dict) -> list[dict]:
    """Expand Strandell's stated multi-unit vacancies into stable items."""
    parts, _ = visible_content(provider["url"])
    text = " ".join(parts)
    if "Följande lägenheter finns nu att söka" not in text:
        raise RuntimeError("Strandell: ledigtsidan saknar verifierad bostadssektion")
    listings = []
    group = re.search(r"(\w+) st 2 rok samt (\w+) st 3 rok.*?på ([^.]+)", text, re.I)
    swedish_numbers = {"en": 1, "ett": 1, "två": 2, "tre": 3, "fyra": 4, "fem": 5,
                       "sex": 6, "sju": 7, "åtta": 8, "nio": 9, "tio": 10}
    if group:
        address = " ".join(group.group(3).split())
        for rooms, word in ((2, group.group(1)), (3, group.group(2))):
            count = swedish_numbers.get(word.casefold())
            if count is None and word.isdigit():
                count = int(word)
            if count is None:
                raise RuntimeError(f"Strandell: okänt antalsord {word!r}")
            for index in range(1, count + 1):
                listings.append({
                    "id": f"blombacka-{rooms}rok-{index}", "address": f"{address} ({rooms} rok, objekt {index})",
                    "area": "Filipstad", "rooms": rooms, "size": None, "rent": None,
                    "available": "Från augusti/hösten 2026", "url": provider["url"], "provider": provider["name"],
                })
    single = re.search(r"5 ROK och (\d+) kvm.*?Allégatan 17.*?Ledig (\d{4}-\d{2}-\d{2}).*?Varmhyra ([\d ]+) kr", text, re.I)
    if single:
        listings.append({
            "id": "allegatan-17-5rok", "address": "Allégatan 17", "area": "Filipstad", "rooms": 5,
            "size": number(single.group(1)), "rent": number(single.group(3)), "available": single.group(2),
            "url": provider["url"], "provider": provider["name"],
        })
    if not listings:
        raise RuntimeError("Strandell: inga aktuella bostadsobjekt kunde tolkas")
    return listings


def parse_podium(provider: dict) -> list[dict]:
    """Read all apartment cards on Podium's Filipstad vacancies page."""
    parts, links = visible_content(provider["url"])
    text = " | ".join(parts)
    base = provider["url"].rstrip("/") + "/"
    detail_urls = sorted({link.rstrip("/") + "/" for link in links if link.startswith(base) and link.rstrip("/") != base.rstrip("/")})
    pattern = re.compile(
        r"(\d+) R(?:O|K)K?V? Filipstad\s*[–-]\s*(\d+) m\s*\|\s*2\s*\|\s*Filipstad\s*\|\s*-\s*\|\s*"
        r"Hyra:\s*\|\s*([\d ]+) kr/mån\s*\|\s*Adress:\s*\|\s*([^|]+)\s*\|\s*"
        r"(?:Inflyttning:|Ledig fr\.o\.m:)\s*\|\s*([^|]+)", re.I)
    matches = list(pattern.finditer(text))
    if not matches or len(matches) != len(detail_urls):
        raise RuntimeError(f"Podium: hittade {len(matches)} kort men {len(detail_urls)} objektslänkar")
    listings = []
    for match, url in zip(matches, detail_urls):
        listings.append({
            "id": url.rstrip("/").rsplit("/", 1)[-1], "address": " ".join(match.group(4).split()),
            "area": "Filipstad", "rooms": number(match.group(1)), "size": number(match.group(2)),
            "rent": number(match.group(3)), "available": " ".join(match.group(5).split()),
            "url": url, "provider": provider["name"],
        })
    return listings


def decode_web_text(raw: bytes) -> str:
    """Decode Vitec's JSON, whose response lacks a reliable charset."""
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp1252")


def parse_vitec_arena(provider: dict) -> list[dict]:
    """Read all published apartments from a public Vitec Arena portal."""
    opener = build_opener(HTTPCookieProcessor(CookieJar()))
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    register = Request(
        urljoin(provider["url"], "/api/v1/token/register/"),
        data=json.dumps({"Guid": provider["appGuid"]}).encode(),
        headers={**headers, "Content-Type": "application/json;charset=utf-8"},
    )
    try:
        key = json.loads(decode_web_text(opener.open(register, timeout=35).read())).get("key")
        if not key:
            raise RuntimeError("Vitec Arena: registrering saknar nyckel")
        validate = Request(
            urljoin(provider["url"], "/api/v1/token/validate/"),
            data=json.dumps({"key": key}).encode(),
            headers={**headers, "Content-Type": "application/json;charset=utf-8"},
        )
        token = decode_web_text(opener.open(validate, timeout=35).read()).strip('"')
        if not token:
            raise RuntimeError("Vitec Arena: validering saknar token")
        endpoint = urljoin(provider["url"], "/rentalobject/Listapartment/published?sortOrder=Address")
        response = opener.open(Request(endpoint, headers={**headers, "Authorization": f"Bearer {token}"}), timeout=35)
        payload = json.loads(decode_web_text(response.read()))
    except HTTPError as error:
        raise RuntimeError(f"Vitec Arena: HTTP {error.code}") from None
    except (URLError, TimeoutError) as error:
        raise RuntimeError(f"Vitec Arena kunde inte nås: {getattr(error, 'reason', error)}") from None
    raw_items = payload.get("data") if isinstance(payload, dict) else None
    items = json.loads(raw_items) if isinstance(raw_items, str) else raw_items
    if not isinstance(items, list):
        raise RuntimeError("Vitec Arena: oväntat svarsformat, inte ett verifierat resultat")

    listings = []
    for item in items:
        identifier = str(item.get("Guid") or item.get("Id") or "")
        if not identifier or not item.get("Adress1"):
            raise RuntimeError("Vitec Arena: ofullständigt bostadsobjekt")
        listings.append({
            "id": identifier,
            "address": " ".join(str(item["Adress1"]).split()),
            "area": str(item.get("AreaName") or item.get("Adress3") or "").title(),
            "rooms": room_count(item.get("NoOfRooms") or item.get("ObjectTypeName")),
            "size": item.get("Size"),
            "rent": item.get("TotalCost") or item.get("Cost"),
            "available": item.get("AvailableDate") or item.get("MoveInDate"),
            "url": urljoin(provider["url"], str(item.get("DetailsUrl") or "")),
            "provider": provider["name"],
        })
    return listings


def parse_willhem(provider: dict) -> list[dict]:
    """Read a complete city result from Willhem's public search API."""
    landing = fetch_json_url(urljoin(provider["url"], "/mvcapi/search-landing"))
    regions = (landing.get("data") or {}).get("regionPages") if isinstance(landing, dict) else None
    if not isinstance(regions, list):
        raise RuntimeError("Willhem: regionregistret har oväntat format")
    region = next((item for item in regions if str(item.get("name", "")).casefold() == provider["municipality"].casefold()), None)
    page_id = ((region or {}).get("contentLink") or {}).get("id")
    if not page_id:
        raise RuntimeError(f"Willhem: kommunen {provider['municipality']} saknas i regionregistret")
    endpoint = urljoin(provider["url"], "/mvcapi/region-container/search") + "?" + urlencode({"pageId": page_id})
    payload = fetch_json_url(endpoint, {"x-page-id": str(page_id)})
    items = (payload.get("data") or {}).get("realEstates") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        raise RuntimeError("Willhem: objektsvaret har oväntat format")
    listings = []
    for item in items:
        tracking = item.get("trackingData") or {}
        identifier = str(tracking.get("id") or item.get("url") or "")
        address = str(item.get("street") or tracking.get("title") or "")
        if not identifier or not address:
            raise RuntimeError("Willhem: ofullständigt bostadsobjekt")
        listings.append({
            "id": identifier,
            "address": address,
            "area": str(tracking.get("city") or provider["municipality"]),
            "rooms": room_count(item.get("rooms") or tracking.get("rooms")),
            "size": number(str(tracking.get("area") or "")),
            "rent": item.get("rentMin") or number(str(item.get("rent") or "")),
            "available": item.get("access"),
            "url": urljoin(provider["url"], str(item.get("url") or "")),
            "provider": provider["name"],
        })
    return listings


def parse_hogia(provider: dict) -> list[dict]:
    """Read the same public, tenant-scoped search used by Edshus' portal."""
    origin = provider["url"].split("/properties")[0]
    listings = {}
    seen_ids = set()
    for page in range(1, 21):
        request = Request(provider["dataUrl"],
            data=json.dumps({"filter": {}, "pageSize": 100, "pageNumber": page}).encode(),
            headers={"User-Agent": USER_AGENT, "Content-Type": "application/json",
                     "Accept": "application/json", "Origin": origin, "Referer": origin + "/"})
        try:
            with urlopen(request, timeout=35) as response:
                data = json.load(response).get("data")
        except (URLError, TimeoutError) as error:
            raise RuntimeError(f"Hogia-källan kunde inte hämtas: {error}") from None
        if not isinstance(data, dict) or not isinstance(data.get("items"), list) or not isinstance(data.get("totalResults"), int):
            raise RuntimeError("Hogia: oväntat svarsformat, inte ett verifierat nollresultat")
        items = data["items"]
        before = len(seen_ids)
        for item in items:
            identifier = str(item.get("id") or "")
            if not identifier or not item.get("header") or "category" not in item:
                raise RuntimeError("Hogia: ofullständigt bostadsobjekt")
            seen_ids.add(identifier)
            if item["category"] != 0:  # Public portal enum: Dwelling=0; exclude parking/premises.
                continue
            value = item.get("vacantFrom")
            available = None
            if value:
                available = datetime(value["year"], value["month"], value["day"]).date().isoformat()
            listings[identifier] = {
                "id": identifier, "address": item["header"],
                "area": ", ".join(item.get("searchTags") or []),
                "rooms": item.get("numberOfRooms"), "size": item.get("squareMeters"),
                "rent": (item.get("monthlyRent") or {}).get("amount"),
                "available": available, "url": provider["url"].rstrip("/") + "/p/" + identifier,
                "provider": provider["name"],
            }
        if len(seen_ids) >= data["totalResults"]:
            return list(listings.values())
        if len(seen_ids) == before:
            raise RuntimeError("Hogia: ofullständig sidbläddring")
    raise RuntimeError("Hogia: sidgränsen nåddes innan alla objekt hämtats")


def deduplicate_listings(listings: list[dict]) -> list[dict]:
    """Prefer the first source for exact cross-provider matches without merging distinct units."""
    unique_listings = {}
    cross_provider_keys = {}
    for item in listings:
        key = f"{item.get('provider', '')}|{item.get('id') or item.get('url') or ''}"
        if not key or key in unique_listings:
            continue
        address = re.sub(r"[^a-z0-9]", "", str(item.get("address") or "").casefold())
        numeric = (item.get("rooms"), item.get("size"), item.get("rent"))
        cross_key = (address, *numeric) if address and sum(value is not None for value in numeric) >= 2 else None
        if cross_key and cross_key in cross_provider_keys and cross_provider_keys[cross_key] != item.get("provider"):
            continue
        unique_listings[key] = item
        if cross_key:
            cross_provider_keys[cross_key] = item.get("provider")
    return list(unique_listings.values())


def main() -> int:
    configuration = get_json(MUNICIPALITY_FILE, {})
    existing = get_json(OUTPUT, {"municipalities": {}})
    previous = existing.get("municipalities", {})
    municipalities = {}
    successful = 0
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    for municipality in configuration.get("municipalities", []):
        name = municipality.get("name", "")
        strict_v3 = name in {"Karlstad", "Kristinehamn", "Hammarö", "Grums", "Filipstad", "Bengtsfors"}
        providers = municipality.get("housingProviders", [])
        listings = []
        errors = []
        source_health = []
        fetched_any = False
        for provider in providers:
            parser_name = provider.get("parser")
            if not parser_name:
                continue
            try:
                if parser_name == "vitec-hss":
                    fetched = parse_hss(provider)
                elif parser_name == "vitec-arena":
                    fetched = parse_arvika(provider)
                elif parser_name == "vitec-arena-token":
                    fetched = parse_vitec_arena(provider)
                elif parser_name == "momentum":
                    fetched = parse_momentum(provider)
                elif parser_name == "filipstad-table":
                    from update_housing_launch import parse_filipstad
                    fetched = parse_filipstad({"provider": provider["name"], "url": provider["url"]})
                elif parser_name == "maleon":
                    fetched = parse_maleon(provider)
                elif parser_name == "strandell":
                    fetched = parse_strandell(provider)
                elif parser_name == "podium":
                    fetched = parse_podium(provider)
                elif parser_name == "hogia":
                    fetched = parse_hogia(provider)
                elif parser_name == "willhem":
                    fetched = parse_willhem(provider)
                else:
                    raise RuntimeError(f"okänd hämtare: {parser_name}")
                previous_provider_listings = [
                    item for item in previous.get(name, {}).get("listings", [])
                    if item.get("provider") == provider.get("name")
                ]
                if not fetched and previous_provider_listings:
                    raise RuntimeError(
                        f"källan gav oväntat 0 objekt; behåller {len(previous_provider_listings)} tidigare objekt"
                    )
                listings.extend(fetched)
                if strict_v3:
                    for item in fetched:
                        item["municipality"] = name
                fetched_any = True
                if strict_v3:
                    source_health.append({
                        "provider": provider["name"], "url": provider["url"], "status": "ok", "checkedAt": now,
                        "lastSuccessfulFetch": now,
                        "rawCount": len(fetched), "error": None, "stale": False,
                    })
                print(f"{name}, {provider['name']}: {len(fetched)} objekt")
            except (RuntimeError, ValueError, TypeError, json.JSONDecodeError) as error:
                errors.append(f"{provider.get('name', 'Källa')}: {error}")
                if strict_v3:
                    source_health.append({
                        "provider": provider.get("name", "Källa"), "url": provider.get("url"),
                        "status": "error", "checkedAt": now, "lastSuccessfulFetch": None,
                        "rawCount": None, "error": str(error), "stale": True,
                    })
                print(f"VARNING {name}: {errors[-1]}")

        listings = deduplicate_listings(listings)
        provider_view = [{key: item[key] for key in ("name", "url", "official") if key in item} for item in providers]
        if fetched_any or not any(item.get("parser") for item in providers):
            core = {"total": len(listings), "listings": listings, "providers": provider_view}
            old = previous.get(name, {})
            old_core = {key: old.get(key) for key in ("total", "listings", "providers")}
            content = {
                **core,
                "errors": errors,
                "stale": False,
                "checkedAt": now,
                "updatedAt": old.get("updatedAt", now) if core == old_core else now,
            }
            if strict_v3:
                content["sourceHealth"] = source_health
                content["availabilityMode"] = "automatic"
            municipalities[name] = content
            successful += 1
        elif name in previous:
            municipalities[name] = {
                **previous[name],
                "errors": errors,
                "stale": True,
                "checkedAt": now,
            }

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
