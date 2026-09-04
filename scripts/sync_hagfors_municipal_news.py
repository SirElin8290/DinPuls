#!/usr/bin/env python3
"""Synka Hagfors kommuns officiella nyheter till DinPuls news.json.

Hagfors använder /arkiv/nyheter/... för artiklar medan den generella
kommun-konfigurationen tidigare matchade /nyheter/. Den här lilla synken är
avsiktligt lokal: Google News och övriga nyhetskällor lämnas helt orörda.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
NEWS = ROOT / "data" / "news.json"
SOURCE_URL = "https://www.hagfors.se/verktygsmeny/kontakta-oss/nyhetsarkiv.html"
SOURCE_NAME = "Hagfors kommun"
USER_AGENT = "DinPuls.se/0.21 (+https://dinpuls.se/)"
ARTICLE_PREFIX = "/arkiv/nyheter/20"


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []
        self.current: dict | None = None

    def handle_starttag(self, tag, attrs):
        if tag.casefold() != "a":
            return
        values = dict(attrs)
        href = values.get("href")
        self.current = {"href": href, "text": [], "label": values.get("aria-label") or values.get("title") or ""} if href else None

    def handle_data(self, data):
        if self.current:
            self.current["text"].append(data)

    def handle_endtag(self, tag):
        if tag.casefold() == "a" and self.current:
            title = self.current["label"] or " ".join(self.current["text"])
            title = re.sub(r"\s+", " ", html.unescape(title)).strip()
            self.links.append((self.current["href"], title))
            self.current = None


def published_at(url: str) -> str:
    match = re.search(r"/(20\d{2})-(\d{2})-(\d{2})-", urlparse(url).path)
    if not match:
        raise ValueError(f"Hagfors-nyhet saknar datum i URL: {url}")
    return datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)), 12, tzinfo=timezone.utc).isoformat()


def title_from_url(url: str) -> str:
    slug = unquote(urlparse(url).path.rsplit("/", 1)[-1])
    slug = re.sub(r"^20\d{2}-\d{2}-\d{2}-", "", slug)
    slug = re.sub(r"\.html$", "", slug)
    slug = re.sub(r"[-_]+", " ", slug).strip()
    return slug[:1].upper() + slug[1:] if slug else "Hagfors kommunnyhet"


def parse_listing(page: str) -> list[dict]:
    parser = LinkParser()
    parser.feed(page)
    rows: list[dict] = []
    seen: set[str] = set()
    for href, title in parser.links:
        link = urljoin(SOURCE_URL, href)
        if ARTICLE_PREFIX not in urlparse(link).path or link in seen:
            continue
        title = re.sub(r"^Läs mer(?: om)?\s+", "", title, flags=re.I).strip()
        if not title or title.casefold() == "läs mer":
            title = title_from_url(link)
        seen.add(link)
        rows.append({
            "id": "hagfors-listing-" + hashlib.sha1(link.encode()).hexdigest()[:14],
            "scope": "local",
            "source": SOURCE_NAME,
            "sourceType": "municipality",
            "quality": 96,
            "impact": 55,
            "category": "Kommunalt",
            "region": "Hagfors",
            "municipalities": ["Hagfors"],
            "title": title[:160],
            "summary": "",
            "access": "free",
            "publishedAt": published_at(link),
            "url": link,
            "important": False,
        })
    return sorted(rows, key=lambda item: item["publishedAt"], reverse=True)[:20]


def fetch_page() -> str:
    request = Request(SOURCE_URL, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urlopen(request, timeout=30) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def main() -> int:
    data = json.loads(NEWS.read_text(encoding="utf-8"))
    try:
        rows = parse_listing(fetch_page())
    except Exception as error:
        print(f"Hagfors kommunnyheter: källfel {type(error).__name__}; befintlig data lämnas orörd.")
        return 0

    if not rows:
        print("Hagfors kommunnyheter: inga artikellänkar hittades; befintlig data lämnas orörd.")
        return 0

    now = datetime.now(timezone.utc)
    articles = data.get("articles") or []
    articles = [
        item for item in articles
        if not (item.get("source") == SOURCE_NAME and str(item.get("id") or "").startswith(("listing-", "hagfors-listing-")))
    ]
    cutoff = now - timedelta(days=21)
    fresh_rows = [row for row in rows if datetime.fromisoformat(row["publishedAt"]) >= cutoff]
    articles.extend(fresh_rows)
    articles.sort(key=lambda item: str(item.get("publishedAt") or ""), reverse=True)
    data["articles"] = articles
    status = data.setdefault("sourceStatus", {})
    successful = set(status.get("successful") or [])
    errors = [value for value in (status.get("errors") or []) if not str(value).startswith(SOURCE_NAME + ":")]
    successful.add(SOURCE_NAME)
    status["successful"] = sorted(successful)
    status["errors"] = errors
    NEWS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Hagfors kommunnyheter: {len(rows)} verifierade länkar, {len(fresh_rows)} inom 21 dagar")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
