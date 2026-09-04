#!/usr/bin/env python3
"""Hämtar Missing Peoples officiella lista utan att kopiera personbilder."""
from __future__ import annotations

import hashlib
import html
import json
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "missing-people.json"
SOURCE_URL = "https://www.missingpeople.se/efterlysningar/"
USER_AGENT = "DinPuls/0.24 (+https://dinpuls.se/)"
MUNICIPALITY_CONFIG = json.loads((ROOT / "data" / "municipalities.json").read_text(encoding="utf-8"))["municipalities"]
MUNICIPALITIES = [item["name"] for item in MUNICIPALITY_CONFIG]
MAX_AGE_MINUTES = 90
FETCH_ATTEMPTS = 3
FETCH_TIMEOUT_SECONDS = 30

NEIGHBORS = {item["name"]: item.get("neighbors", []) for item in MUNICIPALITY_CONFIG}
# Tillfälliga metadataöverstyrningar för faktiska grannkommuner som finns i
# DinPuls men ännu saknas i central municipalities.json. De hålls här tills
# kommunmetadata kan migreras säkert utan en riskabel helfilsersättning.
NEIGHBORS["Hagfors"] = list(dict.fromkeys([*NEIGHBORS.get("Hagfors", []), "Sunne", "Karlstad"]))
NEIGHBORS["Karlstad"] = list(dict.fromkeys([
    *NEIGHBORS.get("Karlstad", []),
    "Storfors",
    "Kristinehamn",
    "Filipstad",
    "Hagfors",
]))
PLACE_ALIASES = {item["name"]: item.get("missingPeopleAliases", []) for item in MUNICIPALITY_CONFIG}
if any(not aliases for aliases in PLACE_ALIASES.values()):
    raise RuntimeError("Alla kommuner måste ha missingPeopleAliases i data/municipalities.json")
unknown_neighbors = {neighbor for neighbors in NEIGHBORS.values() for neighbor in neighbors} - set(MUNICIPALITIES)
if unknown_neighbors:
    raise RuntimeError("Okända grannkommuner i data/municipalities.json: " + ", ".join(sorted(unknown_neighbors)))


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", html.unescape(value or ""))
    return re.sub(r"[^A-Z0-9]+", " ", "".join(char for char in decomposed if not unicodedata.combining(char)).upper()).strip()


ALIAS_TO_MUNICIPALITY = {
    normalize(alias): municipality
    for municipality, aliases in PLACE_ALIASES.items()
    for alias in aliases
}


class MissingPeopleParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.items: list[dict] = []
        self.current: dict | None = None
        self.capture: str | None = None
        self.capture_tag: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        classes = set((values.get("class") or "").split())
        if tag == "article" and "person" in classes:
            self.current = {}
            return
        if self.current is None:
            return
        if tag == "h5" and "card-title" in classes:
            self._begin_capture("name", tag)
        elif tag == "div" and "person__location" in classes:
            self._begin_capture("location", tag)
        elif tag == "time" and "person__date" in classes:
            self.current["publishedAt"] = values.get("datetime") or ""
            self._begin_capture("dateText", tag)
        elif tag == "p" and "person__ingress" in classes:
            self._begin_capture("summary", tag)
        elif tag == "a" and "person__link" in classes:
            self.current["url"] = urljoin(SOURCE_URL, values.get("href") or "")

    def _begin_capture(self, field: str, tag: str) -> None:
        self.capture = field
        self.capture_tag = tag
        assert self.current is not None
        self.current[field] = ""

    def handle_data(self, data: str) -> None:
        if self.current is not None and self.capture:
            self.current[self.capture] += data

    def handle_endtag(self, tag: str) -> None:
        if self.current is None:
            return
        if self.capture and tag == self.capture_tag:
            self.current[self.capture] = re.sub(r"\s+", " ", self.current[self.capture]).strip()
            self.capture = None
            self.capture_tag = None
        if tag == "article":
            if self.current.get("name") and self.current.get("location") and self.current.get("url"):
                self.items.append(self.current)
            self.current = None


def parse_people(page: str) -> list[dict]:
    parser = MissingPeopleParser()
    parser.feed(page)
    return parser.items


def municipality_for(location: str) -> str | None:
    normalized = normalize(location)
    if normalized in ALIAS_TO_MUNICIPALITY:
        return ALIAS_TO_MUNICIPALITY[normalized]
    for part in normalized.split("/"):
        if part.strip() in ALIAS_TO_MUNICIPALITY:
            return ALIAS_TO_MUNICIPALITY[part.strip()]
    return None


def clean_item(item: dict, origin: str) -> dict:
    url = str(item.get("url") or "")
    identifier = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
    summary = re.sub(r"\s+", " ", str(item.get("summary") or "")).strip()
    return {
        "id": f"missing-{identifier}",
        "name": str(item.get("name") or "Försvunnen person")[:100],
        "location": str(item.get("location") or origin)[:100],
        "originMunicipality": origin,
        "publishedAt": str(item.get("publishedAt") or item.get("dateText") or "")[:32],
        "summary": summary[:420],
        "url": url,
        "source": "Missing People Sweden",
    }


def distribute(items: list[dict]) -> dict:
    local: dict[str, list[dict]] = {name: [] for name in MUNICIPALITIES}
    for raw in items:
        origin = municipality_for(str(raw.get("location") or ""))
        if origin:
            local[origin].append(clean_item(raw, origin))

    result = {}
    for selected in MUNICIPALITIES:
        visible = [{**item, "scope": "local"} for item in local[selected]]
        for neighbor in NEIGHBORS[selected]:
            visible.extend({**item, "scope": "neighbor"} for item in local[neighbor])
        visible.sort(key=lambda item: (item["scope"] == "local", item.get("publishedAt") or ""), reverse=True)
        result[selected] = {"items": visible}
    return result


def fetch_page() -> str:
    last_error = "okänt fel"
    for attempt in range(1, FETCH_ATTEMPTS + 1):
        request = Request(SOURCE_URL, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
        try:
            with urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
                return response.read().decode("utf-8", errors="replace")
        except HTTPError as error:
            last_error = f"HTTP {error.code} från Missing People"
            if 400 <= error.code < 500 and error.code not in {408, 429}:
                break
        except URLError as error:
            last_error = f"Kunde inte nå Missing People: {error.reason}"
        except TimeoutError:
            last_error = "Tidsgränsen mot Missing People överskreds"

        if attempt < FETCH_ATTEMPTS:
            delay = attempt * 3
            print(f"Hämtningsförsök {attempt} misslyckades ({last_error}). Försöker igen om {delay} s.")
            time.sleep(delay)

    raise RuntimeError(f"{last_error} efter {FETCH_ATTEMPTS} försök")


def main() -> int:
    try:
        people = parse_people(fetch_page())
    except RuntimeError as error:
        print(f"VARNING: {error}. Befintlig data lämnas orörd.")
        return 1
    if not people:
        print("VARNING: Inga efterlysningar kunde läsas. Befintlig data lämnas orörd.")
        return 1
    now = datetime.now(timezone.utc)
    output = {
        "version": "1.0",
        "source": SOURCE_URL,
        "generatedAt": now.isoformat(timespec="seconds"),
        "maxAgeMinutes": MAX_AGE_MINUTES,
        "imagePolicy": "none",
        "municipalities": distribute(people),
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    local_ids = {item["id"] for payload in output["municipalities"].values() for item in payload["items"]}
    print(f"Missing People: {len(local_ids)} lokalt relevanta efterlysningar fördelade till {len(MUNICIPALITIES)} kommunflöden")
    return 0


if __name__ == "__main__":
    sys.exit(main())
