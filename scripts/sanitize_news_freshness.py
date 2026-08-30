#!/usr/bin/env python3
"""Sanerar nyhetsdata så att gamla/odaterade kommunposter inte ser nypublicerade ut."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEWS = ROOT / "data" / "news.json"

DATE_IN_URL = re.compile(r"/(20\d{2})-(\d{2})-(\d{2})(?:-|/)")
GENERIC_TITLES = {
    "januari", "februari", "mars", "april", "maj", "juni",
    "juli", "augusti", "september", "oktober", "november", "december",
    "nyheter", "nyhetsarkiv", "aktuella nyheter", "arkiv",
}


def parse_dt(value: str) -> datetime:
    try:
        return datetime.fromisoformat((value or "").replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)


def trustworthy_listing_date(article: dict) -> str | None:
    """Returnera datum från URL när det är explicit, annars None.

    update_news.py har historiskt använt hämtningstid som reservdatum för kommunala
    listningar. Det gör odaterade gamla länkar falskt färska. För listing-poster
    accepterar vi därför endast explicit kalenderdatum i URL:en.
    """
    url = str(article.get("url") or "")
    match = DATE_IN_URL.search(url)
    if not match:
        return None
    try:
        dt = datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)), 12, tzinfo=timezone.utc)
        return dt.isoformat()
    except ValueError:
        return None


def main() -> None:
    data = json.loads(NEWS.read_text(encoding="utf-8"))
    kept: list[dict] = []
    removed: list[dict] = []
    corrected = 0

    for article in data.get("articles", []):
        article_id = str(article.get("id") or "")
        source_type = str(article.get("sourceType") or "")
        title = str(article.get("title") or "").strip()

        if article_id.startswith("listing-") and source_type == "municipality":
            explicit_date = trustworthy_listing_date(article)
            if explicit_date is None:
                removed.append({
                    "source": article.get("source"),
                    "title": title,
                    "url": article.get("url"),
                    "reason": "kommunal listing saknar verifierbart publiceringsdatum",
                })
                continue
            if article.get("publishedAt") != explicit_date:
                article["publishedAt"] = explicit_date
                corrected += 1

        # Arkiv-/månadsrubriker är navigationssidor, inte nyhetsartiklar.
        if title.casefold() in GENERIC_TITLES:
            removed.append({
                "source": article.get("source"),
                "title": title,
                "url": article.get("url"),
                "reason": "arkiv- eller navigationssida",
            })
            continue

        kept.append(article)

    kept.sort(key=lambda a: parse_dt(str(a.get("publishedAt") or "")), reverse=True)
    data["articles"] = kept
    data["freshnessSanitizer"] = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "removedCount": len(removed),
        "correctedCount": corrected,
        "removed": removed[:100],
    }
    NEWS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Nyhetsfärskhet sanerad: {len(removed)} borttagna, {corrected} datum korrigerade")


if __name__ == "__main__":
    main()
