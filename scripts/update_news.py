#!/usr/bin/env python3
"""Bygger DinPuls nyhetsdata med lokalt innehåll som första prioritet."""
from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEWS = ROOT / "data" / "news.json"
USER_AGENT = "DinPuls.se/0.21 (lokal nyhetsaggregator; https://sirelin8290.github.io/DinPuls/)"

MUNICIPALITIES = {
    "Åmål": ["åmål", "tösse", "fengersfors", "edsleskog", "dalsland"],
    "Säffle": ["säffle", "svanskog", "värmlandsnäs", "värmlandsbro"],
    "Bengtsfors": ["bengtsfors", "billingsfors", "dals långed", "bäckefors"],
    "Mellerud": ["mellerud", "dals rostock", "åsensbruk", "brålanda"],
    "Årjäng": ["årjäng", "töcksfors", "sillerud", "holmedal"],
    "Arvika": ["arvika", "gunnarskog", "edane", "klässbol"],
    "Grums": ["grums", "slottsbron", "segelmon", "vålberg"],
}

FEEDS = [
    dict(url="https://www.svt.se/nyheter/lokalt/varmland/rss.xml", scope="local", source="SVT Nyheter Värmland", sourceType="media", quality=98, impact=65, category="Lokalt", region="Värmland", municipalities=["Säffle", "Årjäng", "Arvika", "Grums"]),
    dict(url="https://www.svt.se/nyheter/lokalt/vast/rss.xml", scope="local", source="SVT Nyheter Väst", sourceType="media", quality=98, impact=65, category="Lokalt", region="Västra Götaland", municipalities=["Åmål", "Bengtsfors", "Mellerud"]),
    dict(url="https://www.svt.se/nyheter/rss.xml", scope="sweden", source="SVT Nyheter", sourceType="media", quality=99, impact=75, category="Sverige", region="Sverige", municipalities=[]),
    dict(url="https://rss.dw.com/rdf/rss-en-world", scope="world", source="Deutsche Welle", sourceType="media", quality=96, impact=70, category="Världen", region="Världen", municipalities=[]),
]


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value or "")).strip()


def node_text(node, names):
    for child in node.iter():
        if child.tag.split("}")[-1] in names and child.text:
            return clean_text(child.text)
    return ""


def date_iso(raw):
    if not raw:
        return datetime.now(timezone.utc).isoformat()
    try:
        return parsedate_to_datetime(raw).astimezone(timezone.utc).isoformat()
    except Exception:
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
        except Exception:
            return datetime.now(timezone.utc).isoformat()


def request_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.load(response)


def fetch_feed(feed):
    request = urllib.request.Request(feed["url"], headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=25) as response:
        root = ET.fromstring(response.read())
    items = []
    for node in root.iter():
        if node.tag.split("}")[-1] not in ("item", "entry"):
            continue
        title = node_text(node, ["title"])
        link = node_text(node, ["link"])
        if not link:
            link_node = next((child for child in node if child.tag.split("}")[-1] == "link" and child.attrib.get("href")), None)
            link = link_node.attrib["href"] if link_node is not None else ""
        if not title or not link:
            continue
        summary = node_text(node, ["description", "summary", "content"])
        published = date_iso(node_text(node, ["pubDate", "published", "updated", "date"]))
        row = {key: value for key, value in feed.items() if key != "url"}
        row.update(
            id="feed-" + hashlib.sha1((feed["source"] + link).encode()).hexdigest()[:14],
            title=title,
            summary=summary[:300],
            access="free",
            publishedAt=published,
            url=link,
            important=False,
        )
        items.append(row)
    return items[:24]


def event_municipalities(event):
    location = event.get("location") or {}
    haystack = clean_text(" ".join([
        str(location.get("name") or ""), str(event.get("name") or ""),
        str(event.get("summary") or ""), str(event.get("description") or ""),
    ])).casefold()
    return [name for name, terms in MUNICIPALITIES.items() if any(term.casefold() in haystack for term in terms)]


def fetch_police_events():
    events = request_json("https://polisen.se/api/events")
    articles = []
    important_types = {"brand", "explosion", "försvunnen person", "trafikolycka", "farligt föremål"}
    for event in events if isinstance(events, list) else []:
        municipalities = event_municipalities(event)
        if not municipalities:
            continue
        event_type = str(event.get("type") or "Polishändelse")
        link = str(event.get("url") or "")
        if link.startswith("/"):
            link = "https://polisen.se" + link
        important = event_type.casefold() in important_types
        articles.append({
            "id": "police-" + str(event.get("id") or hashlib.sha1(link.encode()).hexdigest()[:12]),
            "scope": "local", "source": "Polisen", "sourceType": "authority",
            "quality": 100, "impact": 92 if important else 72,
            "category": event_type, "region": ", ".join(municipalities),
            "municipalities": municipalities, "title": clean_text(event.get("name") or event_type),
            "summary": clean_text(event.get("summary") or event.get("description") or "")[:300],
            "access": "free", "publishedAt": date_iso(event.get("datetime")),
            "url": link or "https://polisen.se/aktuellt/polisens-nyheter/", "important": important,
        })
    return articles[:60]


def parse_date(article):
    try:
        return datetime.fromisoformat(str(article.get("publishedAt") or "").replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)


def main():
    previous_data = json.loads(NEWS.read_text(encoding="utf-8"))
    previous = previous_data.get("articles", [])
    fetched, successful_sources, errors = [], set(), []
    for feed in FEEDS:
        try:
            rows = fetch_feed(feed)
            fetched.extend(rows)
            successful_sources.add(feed["source"])
            print(feed["source"], len(rows))
        except Exception as exc:
            errors.append(f"{feed['source']}: {exc}")
            print("VARNING", errors[-1])
    try:
        police = fetch_police_events()
        fetched.extend(police)
        successful_sources.add("Polisen")
        print("Polisen", len(police))
    except Exception as exc:
        errors.append(f"Polisen: {exc}")
        print("VARNING", errors[-1])

    now = datetime.now(timezone.utc)
    retained = []
    for article in previous:
        source = article.get("source")
        is_automatic = str(article.get("id", "")).startswith(("feed-", "police-"))
        if source in successful_sources and is_automatic:
            continue
        max_age = timedelta(days=14 if article.get("scope") == "local" else 5)
        if parse_date(article) >= now - max_age:
            retained.append(article)

    deduplicated = {}
    for article in retained + fetched:
        key = article.get("url") or article.get("id")
        if key:
            deduplicated[key] = article
    articles = sorted(deduplicated.values(), key=parse_date, reverse=True)
    if not articles and errors:
        print("Alla nyhetskällor misslyckades; behåller befintlig news.json")
        return 1
    output = {
        "generatedAt": now.isoformat(timespec="seconds"),
        "sourceStatus": {"errors": errors, "successful": sorted(successful_sources)},
        "articles": articles,
        "sources": previous_data.get("sources", []),
    }
    NEWS.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Skrev {len(articles)} aktuella artiklar")
    return 0


if __name__ == "__main__":
    sys.exit(main())
