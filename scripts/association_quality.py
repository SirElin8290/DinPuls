#!/usr/bin/env python3
"""Gemensam kvalitetsmodell och rapportering för DinPuls Föreningsliv."""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
PUBLISHABLE = {"", "active", "active_verified"}


def norm(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode().casefold()
    return re.sub(r"[^a-z0-9]+", "", text).replace("brukshundsklubb", "brukshundklubb")


def is_publishable(item: dict) -> bool:
    return str(item.get("status") or "").casefold() in PUBLISHABLE


def valid_url(value: object) -> bool:
    try:
        parsed = urlparse(str(value or ""))
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
    except ValueError:
        return False


def quality(item: dict) -> str:
    category = item.get("category") or item.get("categoryLabel") or item.get("sports") or item.get("type")
    basic = bool(item.get("name") and category)
    social = item.get("social") if isinstance(item.get("social"), dict) else {}
    external = valid_url(item.get("url")) or any(valid_url(value) for value in social.values())
    enriched = basic and bool(item.get("description") and item.get("tags") and external)
    complete = enriched and bool(item.get("source") and item.get("verified") and item.get("sourcesProcessed"))
    return "COMPLETE" if complete else "ENRICHED" if enriched else "BASIC"


def load_items(municipality: str, curated: bool = False) -> list[dict]:
    suffix = "-curated" if curated else ""
    result = []
    for filename, key, origin in ((f"leisure{suffix}.json", "activities", "leisure"), (f"sports{suffix}.json", "clubs", "sport")):
        data = json.loads((ROOT / "data" / filename).read_text(encoding="utf-8"))
        for item in data["municipalities"][municipality][key]:
            result.append({**item, "_origin": origin})
    return result


def report(municipality: str, curated: bool = False) -> dict:
    all_items = load_items(municipality, curated)
    items = [item for item in all_items if is_publishable(item)]
    quality_counts = Counter(quality(item) for item in items)
    names = Counter(norm(item.get("name")) for item in items if item.get("name"))
    fields = {
        "description": lambda x: bool(x.get("description")),
        "location": lambda x: bool(x.get("location") or x.get("venue") or x.get("arena")),
        "category": lambda x: bool(x.get("category") or x.get("categoryLabel") or x.get("sports") or x.get("type")),
        "tags": lambda x: bool(x.get("tags")),
        "website": lambda x: valid_url(x.get("url")),
        "email": lambda x: bool((x.get("contact") or {}).get("email")),
        "phone": lambda x: bool((x.get("contact") or {}).get("phone")),
        "social": lambda x: any(valid_url(v) for v in (x.get("social") or {}).values()),
        "source": lambda x: bool(x.get("source")),
        "verified": lambda x: bool(x.get("verified")),
    }
    return {
        "municipality": municipality,
        "total": len(items),
        "excludedFromPublication": len(all_items) - len(items),
        "quality": {key: quality_counts.get(key, 0) for key in ("BASIC", "ENRICHED", "COMPLETE")},
        "fields": {key: sum(check(item) for item in items) for key, check in fields.items()},
        "issues": {
            "emptyNames": sum(not item.get("name") for item in items),
            "normalizedDuplicates": sorted(key for key, count in names.items() if key and count > 1),
            "brokenUrls": sorted({str(item.get("url")) for item in items if item.get("url") and not valid_url(item.get("url"))}),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--municipality", required=True)
    parser.add_argument("--curated", action="store_true")
    parser.add_argument("--write")
    args = parser.parse_args()
    payload = report(args.municipality, args.curated)
    output = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if args.write:
        (ROOT / args.write).write_text(output, encoding="utf-8")
    print(output, end="")


if __name__ == "__main__":
    main()
