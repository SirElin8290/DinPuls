#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, re, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEWS = ROOT / "data" / "news.json"
FEEDS = [
    dict(url="https://www.svt.se/nyheter/lokalt/varmland/rss.xml", scope="local", source="SVT Nyheter Värmland", sourceType="media", quality=98, impact=70, category="Lokalt", region="Värmland", municipalities=["Säffle", "Årjäng", "Arvika", "Grums"]),
    dict(url="https://www.svt.se/nyheter/lokalt/vast/rss.xml", scope="local", source="SVT Nyheter Väst", sourceType="media", quality=98, impact=70, category="Lokalt", region="Västra Götaland", municipalities=["Åmål", "Bengtsfors", "Mellerud"]),
    dict(url="https://www.svt.se/nyheter/rss.xml", scope="sweden", source="SVT Nyheter", sourceType="media", quality=99, impact=80, category="Riksnytt", region="Sverige", municipalities=[]),
    dict(url="https://rss.dw.com/rdf/rss-en-world", scope="world", source="Deutsche Welle", sourceType="media", quality=96, impact=70, category="Världen", region="Världen", municipalities=[]),
    dict(url="https://rss.dw.com/rdf/rss-en-eu", scope="world", source="Deutsche Welle Europe", sourceType="media", quality=96, impact=65, category="Europa", region="Europa", municipalities=[]),
]

def text(node, names):
    for name in names:
        found = node.find(name)
        if found is not None and found.text:
            return re.sub(r"<[^>]+>", "", found.text).strip()
    for child in node:
        if child.tag.split("}")[-1] in names and child.text:
            return re.sub(r"<[^>]+>", "", child.text).strip()
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

def fetch(feed):
    req = urllib.request.Request(feed["url"], headers={"User-Agent": "DinPuls/0.17 (+https://sirelin8290.github.io/DinPuls/)"})
    with urllib.request.urlopen(req, timeout=25) as response:
        data = response.read()
    root = ET.fromstring(data)
    items = []
    for node in root.iter():
        if node.tag.split("}")[-1] not in ("item", "entry"):
            continue
        title = text(node, ["title"])
        link = text(node, ["link"])
        if not link:
            for child in node:
                if child.tag.split("}")[-1] == "link" and child.attrib.get("href"):
                    link = child.attrib["href"]
                    break
        summary = text(node, ["description", "summary", "content"])
        published = text(node, ["pubDate", "published", "updated", "date"])
        if not title or not link:
            continue
        item = {key: value for key, value in feed.items() if key != "url"}
        item.update(
            id="feed-" + hashlib.sha1((feed["source"] + link).encode()).hexdigest()[:14],
            title=title,
            summary=summary[:260],
            access="free",
            publishedAt=date_iso(published),
            url=link,
            important=False,
        )
        items.append(item)
    return items[:16]

def main():
    data = json.loads(NEWS.read_text(encoding="utf-8"))
    previous = data.get("articles", [])
    fallback = [article for article in previous if not str(article.get("id", "")).startswith("feed-")]
    fetched = []
    successful_sources = set()
    for feed in FEEDS:
        try:
            rows = fetch(feed)
            if rows:
                fetched.extend(rows)
                successful_sources.add(feed["source"])
            print(feed["source"], len(rows))
        except Exception as exc:
            print("VARNING", feed["source"], exc)
    retained = [
        article for article in previous
        if str(article.get("id", "")).startswith("feed-")
        and article.get("source") not in successful_sources
    ]
    articles = fallback + retained + fetched
    if articles == previous:
        print("Inga nyhetsförändringar; lämnar news.json orörd")
        return
    data["articles"] = articles
    data["generatedAt"] = datetime.now(timezone.utc).isoformat()
    NEWS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
