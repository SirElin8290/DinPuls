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
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEWS = ROOT / "data" / "news.json"
USER_AGENT = "DinPuls.se/0.21 (lokal nyhetsaggregator; https://sirelin8290.github.io/DinPuls/)"

MUNICIPALITY_CONFIG = json.loads((ROOT / "data" / "municipalities.json").read_text(encoding="utf-8"))["municipalities"]
MUNICIPALITIES = {item["name"]: item.get("newsSearchTerms", []) for item in MUNICIPALITY_CONFIG}
if any(not terms for terms in MUNICIPALITIES.values()):
    raise RuntimeError("Alla kommuner måste ha newsSearchTerms i data/municipalities.json")

LOCAL_SEARCH_FEEDS = [
    dict(
        url="https://news.google.com/rss/search?q=" + urllib.parse.quote_plus(name) + "&hl=sv&gl=SE&ceid=SE:sv",
        scope="local",
        source=f"Google Nyheter – {name}",
        sourceType="media",
        quality=88,
        impact=58,
        category="Lokalt",
        region=name,
        municipalities=[name],
    )
    for name in MUNICIPALITIES
]

FEEDS = [
    dict(url="https://www.svt.se/nyheter/lokalt/varmland/rss.xml", scope="regional", source="SVT Nyheter Värmland", sourceType="media", quality=98, impact=65, category="Regionalt", region="Värmland", municipalities=[]),
    dict(url="https://www.svt.se/nyheter/lokalt/vast/rss.xml", scope="regional", source="SVT Nyheter Väst", sourceType="media", quality=98, impact=65, category="Regionalt", region="Västra Götaland", municipalities=[]),
    dict(url="https://arvikamagasinet.se/feed/", scope="regional", source="Arvikamagasinet", sourceType="media", quality=85, impact=55, category="Lokalt", region="Västra Värmland", municipalities=[]),
    dict(url="https://www.svt.se/nyheter/rss.xml", scope="sweden", source="SVT Nyheter", sourceType="media", quality=99, impact=75, category="Sverige", region="Sverige", municipalities=[]),
    dict(url="https://rss.dw.com/rdf/rss-en-world", scope="world", source="Deutsche Welle", sourceType="media", quality=96, impact=70, category="Världen", region="Världen", municipalities=[]),
]

LOCAL_LISTINGS = [
    dict(
        url="https://amal.se/arkiv/nyheter",
        source="Åmåls kommun",
        sourceType="municipality",
        municipalities=["Åmål"],
        pathContains="/arkiv/nyheter/20",
        quality=96,
        impact=55,
        category="Kommunalt",
        region="Åmål",
    ),
    dict(url="https://saffle.se/", source="Säffle kommun", sourceType="municipality",
         municipalities=["Säffle"], pathContains="/arkiv/nyhetsarkiv/2026/",
         quality=96, impact=55, category="Kommunalt", region="Säffle"),
    dict(url="https://www.bengtsfors.se/arkiv/nyheter", source="Bengtsfors kommun", sourceType="municipality",
         municipalities=["Bengtsfors"], pathContains="/arkiv/nyheter/nyheter/20",
         quality=96, impact=55, category="Kommunalt", region="Bengtsfors"),
    dict(url="https://mellerud.se/nyheter/aktuella-nyheter/", source="Melleruds kommun", sourceType="municipality",
         municipalities=["Mellerud"], pathContains="/nyheter/aktuella-nyheter/",
         quality=96, impact=55, category="Kommunalt", region="Mellerud"),
    dict(url="https://www.arjang.se/kommunalservice/startsida/arkiv/upplevaochgora/nyheter.4722.html",
         source="Årjängs kommun", sourceType="municipality", municipalities=["Årjäng"],
         pathContains="/nyheter/nyheter/", quality=96, impact=55,
         category="Kommunalt", region="Årjäng"),
    dict(url="https://www.arvika.se/nyheter.2932.html", source="Arvika kommun", sourceType="municipality",
         municipalities=["Arvika"], pathContains="/nyheter/nyhetsarkiv/",
         quality=96, impact=55, category="Kommunalt", region="Arvika"),
    dict(url="https://www.grums.se/omwebbplatsen/sidorutanformeny/nyheter.2205.html",
         source="Grums kommun", sourceType="municipality", municipalities=["Grums"],
         pathContains="/nyheter/startsida/", quality=96, impact=55,
         category="Kommunalt", region="Grums"),
    dict(url="https://kil.se/arkiv/nyheter", source="Kils kommun", sourceType="municipality",
         municipalities=["Kil"], pathContains="/arkiv/nyheter/20",
         quality=96, impact=55, category="Kommunalt", region="Kil"),
]

# Centralkonfigurationen är enda sanningskällan. Listan ovan behålls tillfälligt
# endast som läsbar historik och får aldrig styra vilka kommuner som behandlas.
LOCAL_LISTINGS = [
    {
        **item["newsListing"],
        "sourceType": "municipality",
        "municipalities": [item["name"]],
        "quality": 96,
        "impact": 55,
        "category": "Kommunalt",
        "region": item["name"],
    }
    for item in MUNICIPALITY_CONFIG
]
if any(not item.get("newsListing") for item in MUNICIPALITY_CONFIG):
    raise RuntimeError("Alla kommuner måste ha newsListing i data/municipalities.json")

SOURCE_DIRECTORY = [
    dict(name="Provinstidningen Dalsland", type="Lokaltidning", access="subscription", scope="local", municipalities=["Åmål", "Mellerud"], url="https://www.provinstidningen.se/"),
    dict(name="Åmåls kommun", type="Kommunala nyheter", access="free", scope="local", municipalities=["Åmål"], url="https://amal.se/arkiv/nyheter"),
    dict(name="Säffle-Tidningen", type="Lokaltidning", access="subscription", scope="local", municipalities=["Säffle"], url="https://www.saffletidningen.se/"),
    dict(name="Säffle kommun", type="Kommunala nyheter", access="free", scope="local", municipalities=["Säffle"], url="https://saffle.se/kommun-och-politik/nyheter.html"),
    dict(name="Dalslänningen", type="Lokaltidning", access="subscription", scope="local", municipalities=["Bengtsfors"], url="https://www.dalslanningen.se/"),
    dict(name="Bengtsfors kommun", type="Kommunala nyheter", access="free", scope="local", municipalities=["Bengtsfors"], url="https://www.bengtsfors.se/arkiv/nyheter"),
    dict(name="Melleruds Nyheter", type="Lokaltidning", access="subscription", scope="local", municipalities=["Mellerud"], url="https://www.mellerudsnyheter.se/"),
    dict(name="Melleruds kommun", type="Kommunala nyheter", access="free", scope="local", municipalities=["Mellerud"], url="https://mellerud.se/nyheter/aktuella-nyheter/"),
    dict(name="Nordmarksbygden", type="Lokal tidning", access="free", scope="local", municipalities=["Årjäng"], url="https://www.nordmarksbygden.se/nb/"),
    dict(name="Arvikamagasinet", type="Lokal nyhetskälla", access="free", scope="local", municipalities=["Årjäng", "Arvika"], url="https://arvikamagasinet.se/"),
    dict(name="Årjängs kommun", type="Kommunala nyheter", access="free", scope="local", municipalities=["Årjäng"], url="https://www.arjang.se/kommunalservice/startsida/arkiv/upplevaochgora/nyheter.4722.html"),
    dict(name="Arvika Nyheter", type="Lokaltidning", access="subscription", scope="local", municipalities=["Arvika"], url="https://www.arvikanyheter.se/"),
    dict(name="Arvika kommun", type="Kommunala nyheter", access="free", scope="local", municipalities=["Arvika"], url="https://www.arvika.se/nyheter.2932.html"),
    dict(name="Grums kommun", type="Kommunala nyheter", access="free", scope="local", municipalities=["Grums"], url="https://www.grums.se/omwebbplatsen/sidorutanformeny/nyheter.2205.html"),
    dict(name="SVT Nyheter Grums", type="Lokal ämnessida", access="free", scope="local", municipalities=["Grums"], url="https://www.svt.se/nyheter/om/grums"),
    dict(name="KilNytt", type="Lokal nyhetskälla", access="free", scope="local", municipalities=["Kil"], url="https://kilnytt.se/"),
    dict(name="Kils kommun", type="Kommunala nyheter", access="free", scope="local", municipalities=["Kil"], url="https://kil.se/arkiv/nyheter"),
    dict(name="SVT Nyheter Värmland", type="Regional nyhetskälla", access="free", scope="local", municipalities=["Kil"], url="https://www.svt.se/nyheter/lokalt/varmland/"),
    dict(name="Polisen", type="Lokala händelser", access="free", scope="local", municipalities=list(MUNICIPALITIES), url="https://polisen.se/aktuellt/polisens-nyheter/"),
    dict(name="SVT Nyheter", type="Nationella nyheter", access="free", scope="sweden", municipalities=[], url="https://www.svt.se/nyheter/"),
    dict(name="Sveriges Radio Ekot", type="Nationella nyheter", access="free", scope="sweden", municipalities=[], url="https://www.sverigesradio.se/ekot"),
    dict(name="Omni", type="Nationell nyhetsöversikt", access="free", scope="sweden", municipalities=[], url="https://omni.se/"),
    dict(name="Dagens Nyheter", type="Nationella nyheter", access="subscription", scope="sweden", municipalities=[], url="https://www.dn.se/"),
    dict(name="Aftonbladet", type="Nationella nyheter", access="free", scope="sweden", municipalities=[], url="https://www.aftonbladet.se/nyheter"),
    dict(name="Expressen", type="Nationella nyheter", access="free", scope="sweden", municipalities=[], url="https://www.expressen.se/nyheter/"),
    dict(name="Reuters", type="Internationella nyheter", access="free", scope="world", municipalities=[], url="https://www.reuters.com/world/"),
    dict(name="BBC News", type="Internationella nyheter", access="free", scope="world", municipalities=[], url="https://www.bbc.com/news/world"),
    dict(name="AP News", type="Internationella nyheter", access="free", scope="world", municipalities=[], url="https://apnews.com/world-news"),
    dict(name="Deutsche Welle", type="Internationella nyheter", access="free", scope="world", municipalities=[], url="https://www.dw.com/en/top-stories/s-9097"),
    dict(name="Euronews", type="Internationella nyheter", access="free", scope="world", municipalities=[], url="https://www.euronews.com/news/international"),
]


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value or "")).strip()


def contains_term(text: str, term: str) -> bool:
    """Matcha ortnamn som hela uttryck, inte som delar av andra ord."""
    return re.search(rf"(?<!\w){re.escape(term.casefold())}(?!\w)", text.casefold()) is not None


def article_municipalities(article):
    haystack = clean_text(" ".join([
        str(article.get("title") or ""), str(article.get("summary") or ""),
        urllib.parse.unquote(str(article.get("url") or "")),
    ]))
    return [name for name, terms in MUNICIPALITIES.items() if any(contains_term(haystack, term) for term in terms)]


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


class ListingLinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        if tag.casefold() == "a":
            attributes = dict(attrs)
            href = attributes.get("href")
            self.current = {"href": href, "text": [], "label": attributes.get("aria-label") or attributes.get("title") or ""} if href else None

    def handle_data(self, data):
        if self.current:
            self.current["text"].append(data)

    def handle_endtag(self, tag):
        if tag.casefold() == "a" and self.current:
            title = self.current["label"] or " ".join(self.current["text"])
            self.links.append((self.current["href"], clean_text(title)))
            self.current = None


def listing_date(url, fallback_rank=0):
    match = re.search(r"/(20\d{2})-(\d{2})-(\d{2})-", url)
    if not match:
        return (datetime.now(timezone.utc) - timedelta(minutes=fallback_rank)).isoformat()
    return datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)), 12, tzinfo=timezone.utc).isoformat()


def fetch_local_listing(listing):
    request = urllib.request.Request(listing["url"], headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urllib.request.urlopen(request, timeout=25) as response:
        parser = ListingLinkParser()
        parser.feed(response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace"))
    rows, seen = [], set()
    for href, title in parser.links:
        link = urllib.parse.urljoin(listing["url"], href)
        link_path = urllib.parse.urlparse(link).path.rstrip("/")
        listing_path = urllib.parse.urlparse(listing["url"]).path.rstrip("/")
        if (listing["pathContains"] not in link_path or not title or link in seen
                or link_path == listing_path):
            continue
        title = re.sub(r"^Läs mer om\s+", "", title, flags=re.IGNORECASE)
        title = re.sub(r"^\d{1,2}\s+(?:[a-zåäö]{3}|[a-zåäö]+)(?:\s+20\d{2})?\s+", "", title, flags=re.IGNORECASE)
        if len(title) > 160:
            sentence = re.match(r"^(.{30,160}?[.!?])(?:\s|$)", title)
            if sentence:
                title = sentence.group(1)
        seen.add(link)
        row = {key: value for key, value in listing.items() if key not in ("url", "pathContains")}
        row.update(
            id="listing-" + hashlib.sha1((listing["source"] + link).encode()).hexdigest()[:14],
            scope="local", title=title, summary="", access="free",
            publishedAt=listing_date(link, len(rows)), url=link, important=False,
        )
        rows.append(row)
    return sorted(rows, key=parse_date, reverse=True)[:20]


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
        if row["scope"] == "regional":
            municipalities = article_municipalities(row)
            if municipalities:
                row.update(scope="local", category="Lokalt", municipalities=municipalities)
        items.append(row)
    return items[:24]


def event_municipalities(event):
    location = event.get("location") or {}
    haystack = clean_text(" ".join([
        str(location.get("name") or ""), str(event.get("name") or ""),
        str(event.get("summary") or ""), str(event.get("description") or ""),
    ])).casefold()
    return [name for name, terms in MUNICIPALITIES.items() if any(contains_term(haystack, term) for term in terms)]


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


SWEDISH_MONTHS = {
    "januari": 1, "februari": 2, "mars": 3, "april": 4, "maj": 5, "juni": 6,
    "juli": 7, "augusti": 8, "september": 9, "oktober": 10, "november": 11, "december": 12,
}
FUTURE_EVENT_MARKERS = (
    "kommer snart", "nedräkning", "är det dags", "på lördag", "på söndag",
    "äger rum", "välkommen till", "missa inte", "vi ses",
)


def explicit_event_date(article, now):
    value = clean_text(f"{article.get('title', '')} {article.get('summary', '')}").casefold()
    numeric = re.search(r"\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b", value)
    if numeric:
        try:
            return datetime(int(numeric.group(1)), int(numeric.group(2)), int(numeric.group(3)), tzinfo=timezone.utc)
        except ValueError:
            return None
    swedish = re.search(
        r"\b(\d{1,2})\s+(" + "|".join(SWEDISH_MONTHS) + r")(?:\s+(20\d{2}))?\b",
        value,
    )
    if not swedish:
        return None
    try:
        return datetime(
            int(swedish.group(3) or now.year),
            SWEDISH_MONTHS[swedish.group(2)],
            int(swedish.group(1)),
            tzinfo=timezone.utc,
        )
    except ValueError:
        return None


def is_expired_event_article(article, now):
    value = clean_text(f"{article.get('title', '')} {article.get('summary', '')}").casefold()
    if not any(marker in value for marker in FUTURE_EVENT_MARKERS):
        return False
    event_date = explicit_event_date(article, now)
    return bool(event_date and event_date.date() < now.date())


def main():
    previous_data = json.loads(NEWS.read_text(encoding="utf-8"))
    previous = previous_data.get("articles", [])
    fetched, successful_sources, errors = [], set(), []
    for feed in FEEDS + LOCAL_SEARCH_FEEDS:
        try:
            rows = fetch_feed(feed)
            if not rows:
                raise ValueError("tomt nyhetsflöde; tidigare färska artiklar behålls")
            fetched.extend(rows)
            successful_sources.add(feed["source"])
            print(feed["source"], len(rows))
        except Exception as exc:
            errors.append(f"{feed['source']}: {exc}")
            print("VARNING", errors[-1])
    for listing in LOCAL_LISTINGS:
        try:
            rows = fetch_local_listing(listing)
            if not rows:
                raise ValueError("inga artikellänkar hittades")
            fetched.extend(rows)
            successful_sources.add(listing["source"])
            print(listing["source"], len(rows))
        except Exception as exc:
            errors.append(f"{listing['source']}: {exc}")
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
        is_automatic = str(article.get("id", "")).startswith(("feed-", "police-", "listing-"))
        if source in successful_sources and is_automatic:
            continue
        max_age = timedelta(days=45 if article.get("scope") == "local" else 5)
        if parse_date(article) >= now - max_age:
            retained.append(article)

    deduplicated = {}
    for article in retained + fetched:
        if is_expired_event_article(article, now):
            continue
        max_age = timedelta(days=21 if article.get("scope") == "local" else 5)
        if parse_date(article) < now - max_age:
            continue
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
        "sources": SOURCE_DIRECTORY,
    }
    NEWS.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Skrev {len(articles)} aktuella artiklar")
    return 0


if __name__ == "__main__":
    sys.exit(main())
