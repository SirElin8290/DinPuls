#!/usr/bin/env python3
"""Komplettera Forshagas sport- och fritidsdata från kommunens publika FRI-register.

Importen är medvetet defensiv. Om den externa källan tillfälligt inte går att nå
eller om HTML-strukturen ändras lämnas befintlig data orörd; den verifierade
Forshaga-supplementfilen fungerar då som reserv i nästa workflow-steg.
"""
from __future__ import annotations

import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BASE = "https://forening.forshaga.se/"
PAGES = (BASE, urljoin(BASE, "Default.aspx?page=2"), urljoin(BASE, "Default.aspx?page=3"))
USER_AGENT = "DinPuls association importer/1.1 (+https://dinpuls.se/)"

SPORT_TYPES = {"idrottsförening", "motorklubb", "fiske/fiskevårdsområ"}
SPORT_MAP = {
    "alpin skidåkning": "Skidor",
    "skidåkning - alpint": "Skidor",
    "skidåkning - längd": "Skidor",
    "fotboll": "Fotboll",
    "friidrott": "Friidrott",
    "gymnastik": "Gymnastik",
    "handboll": "Handboll",
    "innebandy": "Innebandy",
    "ishockey": "Ishockey",
    "orientering": "Orientering",
    "löpning": "Löpning",
    "simning": "Simning",
    "skytte": "Skytte",
    "styrketräning": "Övrig idrott",
    "bangolf": "Övrig idrott",
    "discgolf": "Övrig idrott",
    "hundsport": "Övrig idrott",
    "motorklubb": "Motorsport",
    "fiske": "Sportfiske",
}


class FriTableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[dict] = []
        self.in_row = False
        self.in_cell = False
        self.cells: list[str] = []
        self.cell_parts: list[str] = []
        self.links: list[tuple[str, str]] = []
        self.current_link: str | None = None
        self.link_parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "tr":
            self.in_row = True
            self.cells = []
            self.links = []
        elif self.in_row and tag in {"td", "th"}:
            self.in_cell = True
            self.cell_parts = []
        elif self.in_row and self.in_cell and tag == "a":
            self.current_link = html.unescape(str(attributes.get("href") or "")).strip()
            self.link_parts = []

    def handle_data(self, data):
        if self.in_cell:
            self.cell_parts.append(data)
        if self.current_link is not None:
            self.link_parts.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.current_link is not None:
            label = re.sub(r"\s+", " ", " ".join(self.link_parts)).strip()
            self.links.append((self.current_link, label))
            self.current_link = None
            self.link_parts = []
        elif self.in_row and self.in_cell and tag in {"td", "th"}:
            value = re.sub(r"\s+", " ", " ".join(self.cell_parts).replace("\xa0", " ")).strip()
            self.cells.append(value)
            self.in_cell = False
        elif self.in_row and tag == "tr":
            if self.cells:
                self.rows.append({"cells": self.cells[:], "links": self.links[:]})
            self.in_row = False


def fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    with urlopen(request, timeout=35) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def norm(value: object) -> str:
    return " ".join(str(value or "").casefold().split())


def clean_website(href: str) -> str:
    if not href:
        return ""
    url = urljoin(BASE, href)
    if url.startswith("http://"):
        url = "https://" + url[7:]
    return url if url.startswith("https://") else ""


def parse_page(markup: str) -> list[dict]:
    parser = FriTableParser()
    parser.feed(markup)
    output: list[dict] = []
    known_types = {
        "centrala och reg. or", "fiske/fiskevårdsområ", "fokets hus och park",
        "idrottsförening", "kulturförening", "motorklubb", "nykterhetsförening",
        "övrig förening", "pensionärsförening", "studieförbund",
    }
    for row in parser.rows:
        cells = [cell for cell in row["cells"] if cell]
        if len(cells) < 3:
            continue
        association_type_index = next((i for i, cell in enumerate(cells) if norm(cell) in known_types), None)
        if association_type_index is None or association_type_index == 0:
            continue
        name = cells[association_type_index - 1].strip()
        association_type = cells[association_type_index].strip()
        activity = cells[association_type_index + 1].strip() if association_type_index + 1 < len(cells) else ""
        if not name or norm(name) in {"name", "namn"}:
            continue
        links = row["links"]
        detail = next((clean_website(href) for href, label in links if norm(label) == norm(name)), BASE)
        external = next((clean_website(href) for href, _ in reversed(links)
                         if clean_website(href) and "forening.forshaga.se" not in clean_website(href)), "")
        output.append({
            "name": name,
            "associationType": association_type,
            "activity": activity,
            "url": external or detail or BASE,
        })
    return output


def sport_names(activity: str, association_type: str) -> list[str]:
    names: list[str] = []
    for part in [part.strip() for part in activity.split(",") if part.strip()]:
        mapped = SPORT_MAP.get(norm(part))
        if mapped and mapped not in names:
            names.append(mapped)
    if not names and norm(association_type) in SPORT_TYPES:
        names.append("Övrig idrott")
    return names


def leisure_meta(activity: str, association_type: str) -> tuple[str, str, list[str]]:
    text = norm(f"{activity} {association_type}")
    tags = [part.strip() for part in activity.split(",") if part.strip()][:6]
    if any(word in text for word in ("musik", "orkester")):
        return "musik", "Musik, kör & scen", tags or ["musik"]
    if any(word in text for word in ("kultur", "dans", "hembygd", "arrangemang")):
        return "kultur", "Kultur & lokala arrangemang", tags or ["kultur"]
    if any(word in text for word in ("friluft", "natur", "scouting")):
        return "natur", "Natur, scouter & friluftsliv", tags or ["friluftsliv"]
    return "gemenskap", "Föreningar & gemenskap", tags or [association_type]


def merge_named(existing: list[dict], incoming: list[dict]) -> list[dict]:
    result = [dict(item) for item in existing if isinstance(item, dict)]
    by_name = {norm(item.get("name")): index for index, item in enumerate(result) if item.get("name")}
    for item in incoming:
        key = norm(item.get("name"))
        if not key:
            continue
        if key in by_name:
            old = result[by_name[key]]
            if item.get("url") and (not old.get("url") or "forening.forshaga.se" in str(old.get("url"))):
                old["url"] = item["url"]
            if item.get("sports"):
                old["sports"] = list(dict.fromkeys([*(old.get("sports") or []), *item["sports"]]))
            continue
        by_name[key] = len(result)
        result.append(dict(item))
    return sorted(result, key=lambda item: norm(item.get("name")))


def main() -> int:
    try:
        rows: list[dict] = []
        for page in PAGES:
            rows.extend(parse_page(fetch(page)))
        unique = {norm(row["name"]): row for row in rows if row.get("name")}
        if len(unique) < 25:
            raise RuntimeError(f"FRI-registret gav bara {len(unique)} föreningar")
    except Exception as error:
        print(f"VARNING Forshaga FRI: {type(error).__name__}: {error}. Verifierad supplementfallback används.")
        return 0

    sports_path = DATA / "sports.json"
    leisure_path = DATA / "leisure.json"
    sports = json.loads(sports_path.read_text(encoding="utf-8"))
    leisure = json.loads(leisure_path.read_text(encoding="utf-8"))
    sport_entry = sports.setdefault("municipalities", {}).setdefault("Forshaga", {"directoryUrl": BASE, "clubs": [], "liveSources": []})
    leisure_entry = leisure.setdefault("municipalities", {}).setdefault("Forshaga", {"directoryUrl": BASE, "activities": []})
    sport_entry["directoryUrl"] = BASE
    leisure_entry["directoryUrl"] = BASE

    imported_sports: list[dict] = []
    imported_leisure: list[dict] = []
    for row in unique.values():
        sport_list = sport_names(row["activity"], row["associationType"])
        if sport_list:
            imported_sports.append({
                "name": row["name"], "sports": sport_list, "url": row["url"],
                "source": "Forshaga kommuns FRI-register",
            })
        else:
            category, label, tags = leisure_meta(row["activity"], row["associationType"])
            imported_leisure.append({
                "name": row["name"], "category": category, "categoryLabel": label,
                "tags": tags, "type": "Förening", "url": row["url"],
            })

    sport_entry["clubs"] = merge_named(sport_entry.get("clubs") or [], imported_sports)
    leisure_entry["activities"] = merge_named(leisure_entry.get("activities") or [], imported_leisure)
    sports_path.write_text(json.dumps(sports, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    leisure_path.write_text(json.dumps(leisure, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Forshaga FRI: {len(unique)} föreningar, {len(imported_sports)} idrott, {len(imported_leisure)} fritid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
