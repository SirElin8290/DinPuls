#!/usr/bin/env python3
"""Synka Hagfors kommuns officiella nyheter till DinPuls news.json.

Hagfors publicerar artiklar under /arkiv/nyheter/.... Den generella nyhetspipelinen
kan få ett felaktigt 404-svar från kommunens SiteVision-sida trots att sidan är
publikt åtkomlig i vanlig webbläsare. Den här lokala synken använder därför
webbläsarliknande headers och faller tillbaka till startsidan om arkivsidan
blockeras. Google News och övriga nyhetskällor lämnas orörda.
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
FALLBACK_URL = "https://www.hagfors.se/"
SOURCE_NAME = "Hagfors kommun"
ARTICLE_PREFIX = "/arkiv/nyheter/20"
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.7",
    "Cache-Control": "no-cache",
}


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


def parse_listing(page: str, base_url: str = SOURCE_URL) -> list[dict]:
    parser = LinkParser()
    parser.feed(page)
    rows: list[dict] = []
    seen: set[str] = set()
    for href, title in parser.links:
        link = urljoin(base_url, href)
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


def fetch_url(url: str) -> str:
    request = Request(url, headers=BROWSER_HEADERS)
    with urlopen(request, timeout=30) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def fetch_page() -> tuple[str, str]:
    """Hämta arkivet; använd startsidan som säker sekundär kommunal källa."""
    errors: list[str] = []
    for url in (SOURCE_URL, FALLBACK_URL):
        try:
            page = fetch_url(url)
            if ARTICLE_PREFIX not in page:
                raise ValueError("inga Hagfors-nyhetslänkar i svaret")
            return page, url
        except Exception as error:
            errors.append(f"{url}: {type(error).__name__}")
    raise RuntimeError("; ".join(errors))


def main() -> int:
    data = json.loads(NEWS.read_text(encoding="utf-8"))
    try:
        page, base_url = fetch_page()
        rows = parse_listing(page, base_url)
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
    print(f"Hagfors kommunnyheter: {len(rows)} verifierade länkar, {len(fresh_rows)} inom 21 dagar via {base_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
