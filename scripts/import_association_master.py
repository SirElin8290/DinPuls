#!/usr/bin/env python3
"""Massimportera DinPuls föreningsmaster utan att skriva över bättre data."""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from datetime import date
from pathlib import Path

from docx import Document


ROOT = Path(__file__).resolve().parents[1]
MUNICIPALITIES = [
    "Arvika", "Bengtsfors", "Dals-Ed", "Eda", "Filipstad", "Forshaga",
    "Färgelanda", "Grums", "Hagfors", "Hammarö", "Karlstad", "Kil",
    "Kristinehamn", "Mellerud", "Munkfors", "Storfors", "Sunne", "Säffle",
    "Torsby", "Åmål", "Årjäng",
]

SPORT_HINTS = {
    "Fotboll": ("fotboll",), "Innebandy": ("innebandy",),
    "Ishockey": ("ishockey", "hockey"), "Bandy": ("bandy",),
    "Handboll": ("handboll",), "Basket": ("basket",), "Volleyboll": ("volleyboll",),
    "Golf": ("golf",), "Ridsport": ("ridklubb", "ryttarförening", "ridsport"),
    "Motorsport": ("motorklubb", "motorsport"), "Orientering": ("orientering",),
    "Friidrott": ("friidrott",), "Skidor": ("skidklubb", "skidåkning"),
    "Cykel": ("cykelklubb", "mountainbike"), "Tennis": ("tennisklubb",),
    "Badminton": ("badminton",), "Bordtennis": ("bordtennis",),
    "Boule": ("boule",), "Bowling": ("bowling",), "Gymnastik": ("gymnastik",),
    "Kampsport": ("kampsport", "karate", "taekwondo", "ju-jutsu", "judo", "bjj"),
    "Boxning": ("boxning",), "Bågskytte": ("bågskytte",),
    "Simning": ("simklubb", "simsällskap", "simidrott"),
    "Skytte": ("skytteklubb", "skytteförening", "pistolskytte", "jaktskytte"),
    "Kanot": ("kanot",), "Sportfiske": ("sportfiske", "fiskeklubb"),
}

ALIASES = {
    "josseforsidrottsklubb": "josseforsik",
    "klassbolssportklubb": "klassbolssk",
}


def norm(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower()
    key = re.sub(r"[^a-z0-9]+", "", value)
    return ALIASES.get(key, key)


def sport_names(name: str) -> list[str]:
    value = name.casefold()
    return [sport for sport, hints in SPORT_HINTS.items() if any(hint in value for hint in hints)]


def obvious_non_association(name: str) -> str | None:
    value = name.casefold()
    if "bibliotek" in value and not any(word in value for word in ("förening", "vänner")):
        return "Bibliotek/kommunal verksamhet"
    if any(word in value for word in ("badplats", "vandringsled", "motionsspår")):
        return "Plats eller led, inte organisation"
    if any(word in value for word in ("simhall", "sporthall", "idrottshall")) and not "förening" in value:
        return "Anläggning, inte organisation"
    return None


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("master", type=Path)
    args = parser.parse_args()

    document = Document(args.master)
    if len(document.tables) != len(MUNICIPALITIES):
        raise SystemExit(f"Förväntade 21 tabeller, fick {len(document.tables)}")

    leisure_path = ROOT / "data" / "leisure.json"
    sports_path = ROOT / "data" / "sports.json"
    leisure = load(leisure_path)
    sports = load(sports_path)
    outcomes: list[dict] = []

    for municipality, table in zip(MUNICIPALITIES, document.tables):
        leisure_items = leisure["municipalities"][municipality]["activities"]
        sport_items = sports["municipalities"][municipality]["clubs"]
        existing = {norm(item.get("name", "")): ("leisure", item) for item in leisure_items}
        existing.update({norm(item.get("name", "")): ("sports", item) for item in sport_items})

        for row in table.rows[1:]:
            master_index = int(row.cells[0].text.strip())
            name = row.cells[1].text.strip()
            source_kind = row.cells[2].text.strip()
            baseline = row.cells[3].text.strip()
            key = norm(name)
            record = {
                "masterId": f"{municipality}:{master_index}",
                "municipality": municipality,
                "masterIndex": master_index,
                "masterName": name,
                "masterSourceKind": source_kind,
                "masterBaselineStatus": baseline,
            }

            if key in existing:
                dataset, item = existing[key]
                status = str(item.get("status", "")).casefold()
                if status in {"inactive", "inactive_verified"}:
                    record.update(outcome="C", result="INACTIVE_VERIFIED", reason="Befintlig post markerad inaktiv")
                elif status in {"not_association", "duplicate"}:
                    result = "NOT_ASSOCIATION" if status == "not_association" else "DUPLICATE"
                    record.update(outcome="C", result=result, reason=f"Befintlig post markerad {status}")
                else:
                    record.update(outcome="A", result="ACTIVE_VERIFIED", dataset=dataset, canonicalName=item["name"])
                outcomes.append(record)
                continue

            exclusion = obvious_non_association(name)
            if exclusion:
                record.update(outcome="C", result="NOT_ASSOCIATION", reason=exclusion)
                outcomes.append(record)
                continue

            found_sports = sport_names(name)
            if found_sports:
                item = {
                    "name": name,
                    "sports": found_sports,
                    "url": sports["municipalities"][municipality].get("directoryUrl", ""),
                    "source": "Föreningar Masterdokument",
                    "verified": str(date.today()),
                }
                sport_items.append(item)
                dataset = "sports"
            else:
                item = {
                    "name": name,
                    "category": "gemenskap",
                    "categoryLabel": "Föreningar & lokal gemenskap",
                    "tags": ["förening"],
                    "type": "Förening/organisation",
                    "url": leisure["municipalities"][municipality].get("directoryUrl", ""),
                    "source": {"label": "Föreningar Masterdokument"},
                    "verified": str(date.today()),
                }
                leisure_items.append(item)
                dataset = "leisure"
            existing[key] = (dataset, item)
            record.update(outcome="B", result="ACTIVE_VERIFIED", dataset=dataset, canonicalName=name)
            outcomes.append(record)

    if len(outcomes) != 4196:
        raise SystemExit(f"Förväntade 4196 utfall, fick {len(outcomes)}")

    valid_categories = {"djur", "gemenskap", "kultur", "musik", "natur", "skapande", "spel"}
    for municipality in MUNICIPALITIES:
        for item in leisure["municipalities"][municipality]["activities"]:
            if item.get("category") not in valid_categories:
                item["category"] = "gemenskap"
            if not item.get("tags"):
                item["tags"] = ["förening"]
            if isinstance(item.get("source"), str):
                item["source"] = {"label": item["source"]}
        leisure["municipalities"][municipality]["activities"].sort(key=lambda item: item["name"].casefold())
        sports["municipalities"][municipality]["clubs"].sort(key=lambda item: item["name"].casefold())

    encoded_leisure = json.dumps(leisure, ensure_ascii=False, indent=2) + "\n"
    encoded_sports = json.dumps(sports, ensure_ascii=False, indent=2) + "\n"
    leisure_path.write_text(encoded_leisure, encoding="utf-8")
    sports_path.write_text(encoded_sports, encoding="utf-8")
    (ROOT / "data" / "leisure-curated.json").write_text(encoded_leisure, encoding="utf-8")
    (ROOT / "data" / "sports-curated.json").write_text(encoded_sports, encoding="utf-8")
    (ROOT / "data" / "association-master-outcomes.json").write_text(
        json.dumps({"version": "1.0.0", "processedAt": str(date.today()), "items": outcomes}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    counts = {key: sum(item["outcome"] == key for item in outcomes) for key in ("A", "B", "C")}
    print(json.dumps({"master": len(outcomes), **counts}, ensure_ascii=False))


if __name__ == "__main__":
    main()
