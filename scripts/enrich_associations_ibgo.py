#!/usr/bin/env python3
"""Berika befintliga DinPuls-föreningar från ett officiellt IBGO-register."""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import unicodedata
from datetime import date
from pathlib import Path

from association_quality import quality


ROOT = Path(__file__).resolve().parents[1]


def load_importer():
    spec = importlib.util.spec_from_file_location("association_importer", ROOT / "scripts" / "import_associations.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def norm(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", value).replace("brukshundsklubb", "brukshundklubb")


def values(value: str) -> list[str]:
    return [part.strip() for part in re.split(r"[,;/]", value or "") if part.strip()]


def audience(activity: str) -> list[str]:
    text = activity.casefold()
    mapping = (("barn", "Barn"), ("ungdom", "Ungdomar"), ("familj", "Familjer"),
               ("senior", "Seniorer"), ("pensionär", "Seniorer"), ("vux", "Vuxna"))
    return list(dict.fromkeys(label for word, label in mapping if word in text))


def external_url(importer, raw: str, fallback: str) -> str:
    return importer.website(raw, fallback)


def is_generic(url: str, directory_url: str) -> bool:
    return not url or url.rstrip("/") == directory_url.rstrip("/") or "AssociationRegister" in url


def description(name: str, activity: str, category: str, municipality: str) -> str:
    activities = values(activity)
    if activities:
        return f"{name} bedriver verksamhet inom {', '.join(activities).lower()}."
    if category:
        return f"{name} är registrerad som {category.lower()} i {municipality} kommuns föreningsregister."
    return ""


def enrich_item(item: dict, row: dict, dataset: str, directory_url: str, municipality: str, importer) -> int:
    changes = 0
    name = item["name"]
    category = importer.plain(row.get("AssociationCategoryName", ""))
    activity = importer.plain(row.get("CustomerOccupationsText", ""))
    website = external_url(importer, row.get("WebSite", ""), directory_url)
    city = importer.plain(row.get("City", ""))
    address = importer.plain(row.get("Address", ""))
    postal = importer.plain(row.get("ZipCode", ""))
    email = importer.plain(row.get("Email", ""))
    phone = importer.plain(row.get("Phone", ""))
    official_description = importer.plain(row.get("PublicInformation", "")) or description(name, activity, category, municipality)

    def fill(key, value):
        nonlocal changes
        if value and not item.get(key):
            item[key] = value
            changes += 1

    fill("description", official_description)
    fill("location", city)
    full_address = " ".join(part for part in (address, postal, city) if part)
    fill("address", full_address)
    if website and is_generic(item.get("url", ""), directory_url) and website != directory_url:
        item["url"] = website
        changes += 1
    contact = item.setdefault("contact", {})
    if email and not contact.get("email"):
        contact["email"] = email
        changes += 1
    if phone and not contact.get("phone"):
        contact["phone"] = phone
        changes += 1
    social = item.setdefault("social", {})
    lower_url = website.casefold()
    if "facebook.com" in lower_url and not social.get("facebook"):
        social["facebook"] = website
        changes += 1
    if "instagram.com" in lower_url and not social.get("instagram"):
        social["instagram"] = website
        changes += 1
    tags = item.setdefault("tags", [])
    new_tags = values(activity) + ([category] if category else [])
    for tag in new_tags:
        if tag.casefold() not in {str(value).casefold() for value in tags}:
            tags.append(tag)
            changes += 1
    targets = audience(activity)
    if targets and dataset == "leisure":
        current = item.setdefault("targetAudience", [])
        for target in targets:
            if target not in current:
                current.append(target)
                changes += 1
    if dataset == "leisure" and category and not item.get("categoryLabel"):
        item["categoryLabel"] = category
        changes += 1
    source_label = f"{municipality} kommuns föreningsregister"
    source = {"label": source_label, "url": directory_url}
    if not item.get("source") or item.get("source") == "Föreningar Masterdokument":
        item["source"] = source if dataset == "leisure" else source_label
        changes += 1
    if item.get("verified") != str(date.today()):
        item["verified"] = str(date.today())
        changes += 1
    source_key = norm(municipality) + "-municipality-register"
    item["sourcesProcessed"] = sorted(set(item.get("sourcesProcessed", [])) | {source_key})
    return changes


def process(path: Path, municipality: str, rows: list[dict], importer) -> tuple[int, int]:
    data = json.loads(path.read_text(encoding="utf-8"))
    payload = data["municipalities"][municipality]
    directory_url = payload["directoryUrl"]
    datasets = (("leisure", payload["activities"]),) if "activities" in payload else (("sports", payload["clubs"]),)
    row_map = {norm(importer.plain(row.get("Name", ""))): row for row in rows}
    matched = changes = 0
    for dataset, items in datasets:
        for item in items:
            row = row_map.get(norm(item.get("name", "")))
            if not row:
                item["dataQuality"] = quality(item)
                continue
            matched += 1
            changes += enrich_item(item, row, dataset, directory_url, municipality, importer)
            item["dataQuality"] = quality(item)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return matched, changes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--municipality", required=True)
    parser.add_argument("--host", required=True)
    parser.add_argument("--district", default="")
    args = parser.parse_args()
    importer = load_importer()
    rows = importer.ibgo_rows(args.host, args.district)
    totals = {"registryRows": len(rows), "matched": 0, "changes": 0}
    for filename in ("leisure.json", "leisure-curated.json", "sports.json", "sports-curated.json"):
        matched, changes = process(ROOT / "data" / filename, args.municipality, rows, importer)
        if filename in {"leisure.json", "sports.json"}:
            totals["matched"] += matched
            totals["changes"] += changes
    print(json.dumps(totals, ensure_ascii=False))


if __name__ == "__main__":
    main()
