#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SRC = json.loads((DATA / "karlstad-strict-source.json").read_text(encoding="utf-8"))
TIMEZONE = ZoneInfo("Europe/Stockholm")


def load(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def save(name: str, obj):
    (DATA / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def key_for(item: dict) -> str:
    return str(item.get("id") or item.get("name") or item.get("address") or "").strip().casefold()


def merge_named(existing: list[dict], additions: list[dict]) -> list[dict]:
    out: dict[str, dict] = {}
    order: list[str] = []
    for item in existing:
        if not isinstance(item, dict):
            continue
        key = key_for(item)
        if key and key not in out:
            order.append(key)
            out[key] = item
    for item in additions:
        if not isinstance(item, dict):
            continue
        key = key_for(item)
        if not key:
            continue
        if key not in out:
            order.append(key)
            out[key] = item
        else:
            out[key] = {**out[key], **item}
    return [out[key] for key in order]


def apply_service() -> tuple[int, set[str]]:
    supplement = load("service-local-supplement.json")
    supplement["sourceChecked"] = SRC["sourceChecked"]
    supplement["businesses"] = merge_named(supplement.get("businesses") or [], SRC["service"])
    save("service-local-supplement.json", supplement)

    service: list[dict] = []
    for filename in (
        "service.json",
        "service-private-supplement.json",
        "service-launch-supplement.json",
        "service-local-supplement.json",
    ):
        payload = load(filename)
        service.extend(
            item
            for item in payload.get("businesses", [])
            if isinstance(item, dict) and item.get("municipality") == "Karlstad"
        )
    service = merge_named([], service)
    categories = {
        str(item.get("category") or item.get("group") or "").strip()
        for item in service
        if str(item.get("category") or item.get("group") or "").strip()
    }
    required_domains = {
        "VVS, värme & kyla",
        "El & installation",
        "Bygg & snickeri",
        "Bil, däck & fordonsservice",
        "Lås, glas & säkerhet",
        "Städ, hemservice & fastighet",
    }
    missing = required_domains - categories
    assert not missing, f"Karlstad service saknar verifierade lanseringsområden: {sorted(missing)}"
    return len(service), categories


def apply_authorities() -> None:
    authorities = load("authorities.json")
    row = authorities.setdefault("municipalities", {}).setdefault("Karlstad", {})
    row["website"] = SRC["authorities"]["website"]
    row["serviceUrls"] = {**(row.get("serviceUrls") or {}), **SRC["authorities"]["serviceUrls"]}
    required = {"socialtjanst", "ekonomiskt-bistand", "budget-skuld", "aldreomsorg", "lss", "bygglov"}
    assert all(row["serviceUrls"].get(key) for key in required), "Karlstad myndighetsingångar är ofullständiga"
    save("authorities.json", authorities)


def apply_lunch() -> tuple[int, int]:
    lunch = load("lunch.json")
    row = lunch.setdefault("municipalities", {}).setdefault("Karlstad", {})
    now = datetime.now(TIMEZONE).isoformat(timespec="seconds")
    existing = row.get("restaurants") or []
    by_id = {str(item.get("id")): item for item in existing if isinstance(item, dict) and item.get("id")}
    additions = []
    for source in SRC["lunch"]:
        source_id = str(source["id"])
        if source_id in by_id:
            current = dict(by_id[source_id])
            for field in ("name", "url", "address", "hours"):
                if source.get(field):
                    current[field] = source[field]
            additions.append(current)
        else:
            additions.append({
                **source,
                "checkedAt": now,
                "weekNumber": None,
                "days": {},
                "status": "reference",
                "mode": "reference",
            })
    row["restaurants"] = merge_named(existing, additions)
    refs = row.setdefault("referenceSources", [])
    seen = {str(item.get("url")) for item in refs if isinstance(item, dict)}
    for item in SRC.get("lunchReferenceSources", []):
        if item.get("url") not in seen:
            refs.append(item)
            seen.add(item.get("url"))
    names = {str(item.get("name")) for item in row["restaurants"]}
    required_anchors = {"Go Medda", "Joan's Karlstad", "Nöjesfabriken", "Scandic Winn Restaurang"}
    assert required_anchors <= names, f"Karlstad lunch saknar verifierade ankarkällor: {sorted(required_anchors - names)}"
    assert any("karlstad.com/restauranger" in str(item.get("url", "")) for item in refs), "Karlstads breda restaurangguide saknas"
    save("lunch.json", lunch)
    return len(row["restaurants"]), len(refs)


def apply_leisure() -> int:
    leisure = load("leisure.json")
    row = leisure.setdefault("municipalities", {}).setdefault("Karlstad", {})
    row["directoryUrl"] = SRC["leisureDirectoryUrl"]
    row["activities"] = merge_named(row.get("activities") or [], SRC["leisure"])
    names = {str(item.get("name")) for item in row["activities"]}
    anchors = {"Sundstabadet", "Karlstads bibliotek – 9 bibliotek", "Karlstads badplatser – kommunens badguide", "Sola Arena"}
    assert anchors <= names, f"Karlstad fritid saknar centrala verifierade ingångar: {sorted(anchors - names)}"
    categories = {str(item.get("category")) for item in row["activities"] if item.get("category")}
    assert {"kultur", "gemenskap", "natur", "sport"} <= categories, "Karlstad fritid saknar kategoribredd"
    save("leisure.json", leisure)
    return len(row["activities"])


def apply_sports() -> int:
    sports = load("sports.json")
    row = sports.setdefault("municipalities", {}).setdefault("Karlstad", {})
    row["directoryUrl"] = SRC["associationDirectoryUrl"]
    row["clubs"] = merge_named(row.get("clubs") or [], SRC["sports"])
    sport_types = {
        sport
        for item in row["clubs"]
        for sport in (item.get("sports") or [])
        if isinstance(sport, str) and sport.strip()
    }
    anchors = {"IF Karlstad Fotboll", "Karlstad IBF", "Carlstad Crusaders", "IF Göta Karlstad", "Färjestad BK", "Karlstad Ridklubb"}
    names = {str(item.get("name")) for item in row["clubs"]}
    assert anchors <= names, f"Karlstad föreningar saknar centrala verifierade ankare: {sorted(anchors - names)}"
    assert len(sport_types) >= 8, f"Karlstad föreningsurval saknar idrottslig bredd: {sorted(sport_types)}"
    assert "karlstad.se" in row["directoryUrl"], "Karlstads officiella föreningsregister saknas"
    save("sports.json", sports)
    return len(row["clubs"])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--modules",
        nargs="+",
        choices=("service", "authorities", "lunch", "leisure", "sports"),
        default=["service", "authorities", "lunch", "leisure", "sports"],
    )
    args = parser.parse_args()
    modules = set(args.modules)
    summary = []
    if "service" in modules:
        count, categories = apply_service()
        summary.append(f"service={count}/{len(categories)} kat")
    if "authorities" in modules:
        apply_authorities()
        summary.append("authorities=6")
    if "lunch" in modules:
        count, refs = apply_lunch()
        summary.append(f"lunch={count}+{refs} guider")
    if "leisure" in modules:
        summary.append(f"leisure={apply_leisure()}")
    if "sports" in modules:
        summary.append(f"sports={apply_sports()}")
    print("Karlstad STRICT v4: " + ", ".join(summary))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
