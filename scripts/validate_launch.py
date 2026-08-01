#!/usr/bin/env python3
"""Stoppar publicering om DinPuls saknar en central lanseringsdel."""
from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.20.9"
MUNICIPALITIES = ["Åmål", "Säffle", "Bengtsfors", "Mellerud", "Årjäng", "Arvika", "Grums"]
ACTIVE_PAGES = [
    "index.html", "jobb.html", "bostader.html", "trafik.html",
    "evenemang.html", "lunch.html", "matkasse.html", "sport.html",
    "information.html",
]
COMPONENTS = [
    "header", "quick-strip", "navigation", "lunch-strip", "hero",
    "premium-ad-1", "primary-cards", "transport", "sport",
    "secondary-cards", "premium-ad-2", "jobs-housing", "grocery",
    "premium-ad-3", "footer",
]


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.assets: list[str] = []
        self.ids: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(str(values["id"]))
        for name in ("href", "src"):
            value = values.get(name)
            if value:
                self.assets.append(value)


def load_json(path: str) -> dict:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def municipality_map(path: str) -> dict:
    data = load_json(path)
    value = data.get("municipalities")
    if not isinstance(value, dict):
        raise AssertionError(f"{path}: municipalities måste vara ett objekt")
    assert list(value) == MUNICIPALITIES, f"{path}: fel eller felordnade kommuner"
    return value


def verify_assets() -> None:
    for page in ACTIVE_PAGES:
        source = (ROOT / page).read_text(encoding="utf-8")
        parser = AssetParser()
        parser.feed(source)
        for value in parser.assets:
            clean = value.split("?", 1)[0].split("#", 1)[0]
            if not clean or clean.startswith(("http://", "https://", "mailto:", "tel:")):
                continue
            assert (ROOT / clean).is_file(), f"{page}: filen {clean} saknas"

    assembled = (ROOT / "index.html").read_text(encoding="utf-8")
    assembled += "".join((ROOT / "components" / f"{name}.html").read_text(encoding="utf-8") for name in COMPONENTS)
    parser = AssetParser()
    parser.feed(assembled)
    duplicates = sorted({value for value in parser.ids if parser.ids.count(value) > 1})
    assert not duplicates, f"Startsidan innehåller dubbla id:n: {', '.join(duplicates)}"


def verify_content() -> None:
    active = "\n".join((ROOT / page).read_text(encoding="utf-8") for page in ACTIVE_PAGES)
    active += "\n".join((ROOT / "components" / f"{name}.html").read_text(encoding="utf-8") for name in COMPONENTS)
    forbidden = ["Sökfunktionen kopplas", "Ladda ner appen", "Personligt för dig", "Borlänge"]
    for phrase in forbidden:
        assert phrase.lower() not in active.lower(), f"Inaktiv eller felaktig text finns kvar: {phrase}"

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    script = (ROOT / "script.js").read_text(encoding="utf-8")
    assert f'data-version="{VERSION}"' in index
    assert f'content="{VERSION}"' in index
    assert f'const DINPULS_VERSION = "{VERSION}"' in script
    assert "updateMunicipalityLinks" in script
    assert "Sök bland DinPuls moduler" in (ROOT / "components/header.html").read_text(encoding="utf-8")


def verify_data() -> None:
    config = load_json("data/municipalities.json")
    names = [item.get("name") for item in config.get("municipalities", [])]
    assert names == MUNICIPALITIES, "Kommunmotorn innehåller inte exakt de sju startkommunerna"

    transport = municipality_map("data/transport.json")
    for name, payload in transport.items():
        stops = payload.get("stops", [])
        departures = [item for stop in stops for item in stop.get("departures", [])]
        assert stops, f"{name}: säker hållplats saknas"
        assert departures, f"{name}: inga kollektivtrafikavgångar"
    assert load_json("data/transport.json").get("source") != "demo", "Kollektivtrafiken använder demodata"

    jobs = municipality_map("data/jobs.json")
    housing = municipality_map("data/housing.json")
    events = municipality_map("data/events.json")
    lunch = municipality_map("data/lunch.json")
    sports = municipality_map("data/sports.json")
    municipality_map("data/important.json")
    municipality_map("data/road-traffic.json")

    for name in MUNICIPALITIES:
        assert jobs[name].get("jobs"), f"{name}: jobb saknas"
        assert housing[name].get("providers"), f"{name}: bostadskälla saknas"
        assert events[name].get("sources"), f"{name}: evenemangskällor saknas"
        assert lunch[name].get("restaurants"), f"{name}: lunchställen saknas"
        assert sports[name].get("clubs"), f"{name}: lokala sportföreningar saknas"

    important_text = json.dumps(load_json("data/important.json"), ensure_ascii=False)
    assert not re.search(r"\bBorlänge\b", important_text, re.I), "Dagens viktigaste innehåller Borlänge"
    assert load_json("data/lunch.json").get("version") == "0.20.5", "Fel lunchdataversion"


def verify_ads() -> None:
    for page in ["jobb.html", "bostader.html", "trafik.html", "evenemang.html", "lunch.html", "matkasse.html"]:
        source = (ROOT / page).read_text(encoding="utf-8")
        assert source.count("data-strategic-ad=") == 4, f"{page}: ska ha fyra annonsplatser"
    sport = (ROOT / "sport-hub-stage48.js").read_text(encoding="utf-8")
    assert "ad(1)" in sport and "ad(8)" in sport, "Sportsidan ska behålla åtta annonsplatser"


def verify_simple_sport_hub() -> None:
    removed = [
        "player.html", "match.html", "club.html", "arena.html",
        "sport-matchcenter-stage41.js", "sport-clubs-stage42.js",
        "sport-tables-stage43.js", "sport-match-details-stage44.js",
        "sport-favorites-stage45.js", "sport-players-stage46.js",
        "sport-arenas-stage47.js",
    ]
    for asset in removed:
        assert not (ROOT / asset).exists(), f"Avancerad sportfil ska vara borttagen: {asset}"
    sport = (ROOT / "sport.html").read_text(encoding="utf-8")
    assert "Matcher & resultat" in sport and "Tabeller" in sport
    assert "Föreningar & källor" in sport and "Arenor & sporthallar" in sport

    data = load_json("data/sports.json")
    providers = data.get("sportProviders", {})
    municipalities = data.get("municipalities", {})
    clubs = [club for payload in municipalities.values() for club in payload.get("clubs", [])]
    sports = {name for club in clubs for name in club.get("sports", [])}
    local_sources = [source for payload in municipalities.values() for source in payload.get("liveSources", [])]
    assert len(providers) >= 30, "Sporthubben saknar nationella kalender- och resultatkällor"
    assert len(clubs) >= 70, "Sporthubben har för få lokala föreningar"
    assert len(sports) >= 25, "Sporthubben representerar för få idrotter"
    assert len(local_sources) >= 25, "Sporthubben saknar lokala direktlänkar"
    for name, payload in municipalities.items():
        assert payload.get("directoryUrl", "").startswith("https://"), f"{name}: föreningsregister saknas"
        assert payload.get("clubs"), f"{name}: föreningar saknas"
        assert payload.get("liveSources"), f"{name}: sportkällor saknas"
        for club in payload["clubs"]:
            assert club.get("url", "").startswith("https://"), f"{name}: ogiltig klubblänk"
        for source in payload["liveSources"]:
            assert source.get("url", "").startswith("https://"), f"{name}: ogiltig sportkälla"


def main() -> int:
    checks = [verify_assets, verify_content, verify_data, verify_ads, verify_simple_sport_hub]
    for check in checks:
        check()
        print(f"✓ {check.__name__}")
    print("✓ DinPuls är godkänd för publicering i sju kommuner")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as error:
        print(f"✗ {error}", file=sys.stderr)
        raise SystemExit(1)
