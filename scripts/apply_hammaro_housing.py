#!/usr/bin/env python3
from __future__ import annotations
import hashlib
import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
HOUSING = DATA / "housing.json"
SUPPLEMENT = DATA / "housing-hammaro-supplement.json"
STORFORS_URL = "https://www.stiftelsenbjorkasen.se/lediga-bostader/"
USER_AGENT = "DinPuls/0.24 (+https://dinpuls.se/)"
TZ = ZoneInfo("Europe/Stockholm")


class LinkTextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.href = None
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href = dict(attrs).get("href")
            self.parts = []

    def handle_data(self, data):
        if self.href is not None:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.href is not None:
            text = re.sub(r"\s+", " ", html.unescape(" ".join(self.parts))).strip()
            self.links.append((self.href, text))
            self.href = None
            self.parts = []


class TextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.blocked = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript", "svg"}:
            self.blocked += 1
        elif not self.blocked and tag in {"p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "br"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript", "svg"} and self.blocked:
            self.blocked -= 1
        elif not self.blocked and tag in {"p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6"}:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.blocked:
            self.parts.append(data)

    def lines(self):
        text = html.unescape("".join(self.parts)).replace("\xa0", " ")
        return [re.sub(r"\s+", " ", x).strip() for x in text.splitlines() if re.sub(r"\s+", " ", x).strip()]


def fetch(url):
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    with urlopen(req, timeout=30) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def number(value):
    match = re.search(r"\d+(?:[\s.]\d{3})*(?:[,.]\d+)?", str(value or ""))
    if not match:
        return None
    raw = match.group(0).replace(" ", "").replace(".", "").replace(",", ".")
    result = float(raw)
    return int(result) if result.is_integer() else result


def value_after(lines, label):
    target = label.casefold()
    for index, line in enumerate(lines):
        normalized = line.casefold().rstrip(":")
        if normalized == target:
            return lines[index + 1] if index + 1 < len(lines) else ""
        if normalized.startswith(target + ":"):
            return line.split(":", 1)[1].strip()
    return ""


def storfors_listings():
    markup = fetch(STORFORS_URL)
    parser = LinkTextParser()
    parser.feed(markup)
    candidates = []
    for href, text in parser.links:
        if not re.fullmatch(r"\d+(?:[,.]\d+)?\s+rum och kök", text, re.I):
            continue
        url = urljoin(STORFORS_URL, href)
        if urlsplit(url).netloc != "www.stiftelsenbjorkasen.se":
            continue
        if url not in candidates:
            candidates.append(url)

    listings = []
    seen = set()
    for url in candidates:
        detail = TextParser()
        detail.feed(fetch(url))
        lines = detail.lines()
        address = value_after(lines, "Adress")
        apartment_id = value_after(lines, "Lägenhetsnr")
        rent_line = value_after(lines, "Hyra")
        available = value_after(lines, "Tillgänglig") or "Se källan"
        heading = next((x for x in lines if re.fullmatch(r"\d+(?:[,.]\d+)?\s+rum och kök", x, re.I)), "")
        if not address or not rent_line or not heading:
            continue
        rooms_match = re.match(r"(\d+(?:[,.]\d+)?)", heading)
        rooms = float(rooms_match.group(1).replace(",", ".")) if rooms_match else None
        if rooms is not None and rooms.is_integer():
            rooms = int(rooms)
        size = None
        for line in lines[:80]:
            m = re.search(r"(?:ca\s*)?(\d+(?:[,.]\d+)?)\s*(?:kvm|m²|m2)\b", line, re.I)
            if m:
                size = float(m.group(1).replace(",", "."))
                if size.is_integer():
                    size = int(size)
                break
        identifier = apartment_id or hashlib.sha1(f"{address}|{rent_line}".encode()).hexdigest()[:16]
        if identifier in seen:
            continue
        seen.add(identifier)
        listings.append({
            "id": identifier,
            "address": address,
            "area": "Storfors",
            "rooms": rooms,
            "size": size,
            "rent": number(rent_line),
            "available": available,
            "url": url,
            "provider": "Stiftelsen Björkåsen"
        })
    if not listings:
        raise SystemExit("Storfors: Björkåsens officiella sida gav inga verifierbara bostadsobjekt")
    return listings


housing = json.loads(HOUSING.read_text(encoding="utf-8"))
supplement = json.loads(SUPPLEMENT.read_text(encoding="utf-8"))
municipalities = housing.setdefault("municipalities", {})

row = municipalities.setdefault("Hammarö", {})
existing = [x for x in (row.get("listings") or []) if isinstance(x, dict)]
by_key = {str(x.get("id") or x.get("address") or "").strip().casefold(): x for x in existing}
for item in supplement.get("listings") or []:
    if not isinstance(item, dict):
        continue
    key = str(item.get("id") or item.get("address") or "").strip().casefold()
    if key:
        by_key[key] = item
row["listings"] = list(by_key.values())
row["total"] = len(row["listings"])
row["checkedAt"] = f"{supplement.get('sourceChecked')}T12:00:00+02:00"
row["updatedAt"] = row["checkedAt"]
row["stale"] = False
row["errors"] = []
row["availabilityMode"] = "automatic"
row.setdefault("sourceHealth", []).append({
    "source": "Hammarö verifierad komplettering",
    "status": "ok",
    "checkedAt": row["checkedAt"]
})
if len(row["listings"]) < 1:
    raise SystemExit("Hammarö: minst ett aktuellt bostadsobjekt krävs")

storfors = municipalities.setdefault("Storfors", {})
storfors["listings"] = storfors_listings()
storfors["total"] = len(storfors["listings"])
storfors["checkedAt"] = datetime.now(TZ).isoformat(timespec="seconds")
storfors["updatedAt"] = storfors["checkedAt"]
storfors["stale"] = False
storfors["errors"] = []
storfors["availabilityMode"] = "automatic"
storfors["providers"] = [{"name":"Stiftelsen Björkåsen","url":STORFORS_URL,"official":True,"mode":"automatic-bjorkasen"}]
storfors["sourceHealth"] = [{
    "provider": "Stiftelsen Björkåsen",
    "url": STORFORS_URL,
    "mode": "automatic-bjorkasen",
    "status": "ok",
    "inventoryCount": len(storfors["listings"]),
    "checkedAt": storfors["checkedAt"]
}]

HOUSING.write_text(json.dumps(housing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Hammarö: {len(row['listings'])} bostadsobjekt efter komplettering")
print(f"Storfors: {len(storfors['listings'])} aktuella Björkåsen-objekt")
