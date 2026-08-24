#!/usr/bin/env python3
"""Kompletterar news.json med en bred färsk nyhetssökning för varje DinPuls-kommun."""
from __future__ import annotations

import hashlib
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEWS = ROOT / "data" / "news.json"
MUNICIPALITIES_FILE = ROOT / "data" / "municipalities.json"
USER_AGENT = "DinPuls.se/0.22 (daglig djupsokning av lokala nyheter)"


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value or "")).strip()


def node_text(node, names):
    for child in node.iter():
        if child.tag.split("}")[-1] in names and child.text:
            return clean(child.text)
    return ""


def parse_date(raw: str) -> datetime:
    if not raw:
        return datetime.now(timezone.utc)
    try:
        return parsedate_to_datetime(raw).astimezone(timezone.utc)
    except Exception:
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)
        except Exception:
            return datetime.now(timezone.utc)


def fetch_search(municipality: str, terms: list[str]):
    # Kommunnamnet är alltid huvudankare. Extra ortnamn från kommunmotorn breddar
    # sökningen så att lokala artiklar inte måste råka innehålla just kommunnamnet.
    useful = []
    for term in [municipality, *terms]:
        term = clean(str(term))
        if term and term.casefold() not in {x.casefold() for x in useful}:
            useful.append(term)
    quoted = [f'"{term}"' if " " in term else term for term in useful[:8]]
    query = " OR ".join(quoted) + " when:7d"
    url = "https://news.google.com/rss/search?q=" + urllib.parse.quote_plus(query) + "&hl=sv&gl=SE&ceid=SE:sv"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        root = ET.fromstring(response.read())

    rows = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    for node in root.iter():
        if node.tag.split("}")[-1] not in ("item", "entry"):
            continue
        title = node_text(node, ["title"])
        link = node_text(node, ["link"])
        if not link:
            link_node = next((c for c in node if c.tag.split("}")[-1] == "link" and c.attrib.get("href")), None)
            link = link_node.attrib["href"] if link_node is not None else ""
        if not title or not link:
            continue
        published = parse_date(node_text(node, ["pubDate", "published", "updated", "date"]))
        if published < cutoff:
            continue
        summary = node_text(node, ["description", "summary", "content"])
        rows.append({
            "id": "deep-" + hashlib.sha1((municipality + link).encode()).hexdigest()[:14],
            "scope": "local",
            "source": f"Google Nyheter – djupsökning {municipality}",
            "sourceType": "media",
            "quality": 88,
            "impact": 62,
            "category": "Lokalt",
            "region": municipality,
            "municipalities": [municipality],
            "title": title,
            "summary": summary[:300],
            "access": "free",
            "publishedAt": published.isoformat(),
            "url": link,
            "important": False,
        })
    return rows[:60]


def main():
    config = json.loads(MUNICIPALITIES_FILE.read_text(encoding="utf-8"))["municipalities"]
    data = json.loads(NEWS.read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc)

    # Gamla deep-poster ersätts varje körning. Övriga nyhetskällor lämnas orörda.
    existing = [a for a in data.get("articles", []) if not str(a.get("id", "")).startswith("deep-")]
    deep = []
    errors = []
    coverage = {}
    for municipality in config:
        name = municipality["name"]
        try:
            rows = fetch_search(name, municipality.get("newsSearchTerms", []))
            deep.extend(rows)
            coverage[name] = len(rows)
            print(f"Djupsökning {name}: {len(rows)} artiklar")
        except Exception as exc:
            errors.append(f"{name}: {exc}")
            coverage[name] = 0
            print(f"VARNING djupsökning {name}: {exc}")

    dedup = {}
    for article in existing + deep:
        key = article.get("url") or article.get("id")
        if not key:
            continue
        old = dedup.get(key)
        if old is None or parse_date(str(article.get("publishedAt", ""))) > parse_date(str(old.get("publishedAt", ""))):
            dedup[key] = article

    data["articles"] = sorted(dedup.values(), key=lambda a: parse_date(str(a.get("publishedAt", ""))), reverse=True)
    data["deepSearch"] = {
        "generatedAt": now.isoformat(timespec="seconds"),
        "windowDays": 7,
        "municipalities": coverage,
        "errors": errors,
    }
    NEWS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Djupsökning klar: {len(deep)} färska lokala träffar för {len(config)} kommuner")


if __name__ == "__main__":
    main()
