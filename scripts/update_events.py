#!/usr/bin/env python3
"""Samlar lokala evenemang från officiella kalendrar och källkatalogen."""
from __future__ import annotations

import hashlib
import html
import json
import re
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urljoin, urlsplit
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "events.json"
SOURCE_CATALOG = ROOT / "data" / "event-sources.json"
USER_AGENT = "DinPuls.se/0.21 (lokal evenemangskalender; https://sirelin8290.github.io/DinPuls/)"
ALGOLIA_APP_ID = "JLIO3DI59W"
ALGOLIA_SEARCH_KEY = "c3e912c214238b637c6a86d637acfe79"
SWEDEN_TZ = ZoneInfo("Europe/Stockholm")
MUNICIPALITY_CONFIG = json.loads(
    (ROOT / "data" / "municipalities.json").read_text(encoding="utf-8")
)["municipalities"]
LOCALITIES = {
    item["name"]: {
        str(term).casefold()
        for term in item.get("localityAliases", [])
        if str(term).strip()
    }
    for item in MUNICIPALITY_CONFIG
}


def fetch_html(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def fetch_json(url: str):
    raw = fetch_html(url)
    value = json.loads(raw)
    return json.loads(value) if isinstance(value, str) else value


def visit_varmland_time_label(start_stamp, end_stamp=None) -> str:
    """Formaterar Visit Värmlands UTC-stämplar som svensk lokal tid.

    Datumintervall utan riktig klockslagstid kodas ibland som lokal midnatt.
    De ska visas som datum/"Se källan", inte som ett artificiellt 00:00/22:00.
    """
    if not start_stamp:
        return "Se källan"
    start_dt = datetime.fromtimestamp(int(start_stamp), timezone.utc).astimezone(SWEDEN_TZ)
    end_dt = (
        datetime.fromtimestamp(int(end_stamp), timezone.utc).astimezone(SWEDEN_TZ)
        if end_stamp else None
    )
    start_time = start_dt.strftime("%H:%M")
    end_time = end_dt.strftime("%H:%M") if end_dt else ""
    if start_time == "00:00" and (not end_time or end_time in {"00:00", "23:59"}):
        return "Se källan"
    return f"{start_time}–{end_time}" if end_time and end_time != start_time else start_time


def fetch_visit_varmland_events(municipality: str) -> list[dict]:
    """Läser Visit Värmlands publika sökindex när kalendersidan är JavaScript-renderad."""
    endpoint = f"https://{ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/events/query"
    today_timestamp = int(datetime.now(timezone.utc).timestamp())
    params = urlencode({
        "hitsPerPage": "100",
        "filters": f"municipality:'{municipality}' AND dates.occasion_end_date >= {today_timestamp}",
    })
    request = urllib.request.Request(
        endpoint,
        data=json.dumps({"params": params}).encode(),
        headers={
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json",
            "X-Algolia-Application-Id": ALGOLIA_APP_ID,
            "X-Algolia-API-Key": ALGOLIA_SEARCH_KEY,
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    today = date.today().isoformat()
    results = []
    for item in payload.get("hits") or []:
        title = str(item.get("title_sv") or "").strip()
        if not title:
            continue
        venue = str(item.get("place") or municipality).strip()
        item_url = urljoin("https://www.visitvarmland.com/", str(item.get("url_sv") or ""))
        event_category, label = category(title)
        for occurrence in (item.get("dates") or [])[:12]:
            start = iso_date(occurrence.get("date"))
            end = iso_date(occurrence.get("date_end")) or start
            if not start or end < today:
                continue
            start_stamp = occurrence.get("occasion_date")
            end_stamp = occurrence.get("occasion_end_date")
            time_label = visit_varmland_time_label(start_stamp, end_stamp)
            identifier = hashlib.sha1(
                f"{municipality}|{title}|{start}|{venue}|{item_url}".encode()
            ).hexdigest()[:16]
            results.append({
                "id": f"event-{identifier}", "title": title,
                "startDate": start, "endDate": end, "time": time_label,
                "venue": venue, "category": event_category,
                "categoryLabel": label, "sourceName": "Visit Värmland",
                "url": item_url,
            })
    return results


def fetch_turid_events(source: dict, municipality: str) -> list[dict]:
    """Read all pages of the municipality's documented Turid event feed."""
    url = source["dataUrl"]
    rows, seen = [], set()
    page = 1
    while True:
        request = urllib.request.Request(url + "&page=" + str(page), headers={
            "User-Agent": USER_AGENT, "Accept": "application/json,text/html",
            "Referer": "https://www.visitvarmland.com/",
        })
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.load(response)
        if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
            raise ValueError("Ogiltigt Turid-flöde")
        total_pages = int(payload.get("total_pages", 1))
        if total_pages < page or total_pages > 100:
            raise ValueError("Ogiltig Turid-paginering")
        for item in payload["data"]:
            title, slug = item.get("title"), item.get("slug")
            if not title or not slug or not slug.startswith("evenemang/"):
                raise ValueError("Ofullständig Turid-evenemangspost")
            item_url = urljoin(source["url"].rstrip("/") + "/", "../" + slug)
            venue = ", ".join(place["title"] for place in item.get("places", []) if place.get("title")) or municipality
            source_category = ", ".join(cat["title"] for cat in item.get("categories", []) if cat.get("title"))
            event_category, label = category(title)
            if "Musik" in source_category:
                event_category = "music"
            for occasion in item.get("occasions", []):
                start, end = iso_date(occasion.get("date_start")), iso_date(occasion.get("date_end"))
                end = end or start
                if not start:
                    raise ValueError("Evenemangsdatum saknas")
                if end < date.today().isoformat():
                    continue
                first, last = occasion.get("time_start"), occasion.get("time_end")
                time_label = str(first)[:5] if first else "Se källan"
                if first and last and last != first:
                    time_label += "–" + str(last)[:5]
                key = (item_url, start, end, time_label)
                if key in seen:
                    continue
                seen.add(key)
                identifier = hashlib.sha1("|".join(key).encode()).hexdigest()[:16]
                rows.append({"id": "event-" + identifier, "title": title,
                             "startDate": start, "endDate": end, "time": time_label,
                             "venue": venue, "category": event_category,
                             "categoryLabel": source_category or label,
                             "sourceName": source["name"], "sourceFormat": "turid", "url": item_url})
        if page == total_pages:
            return rows
        page += 1


def json_ld_blocks(markup: str) -> list[object]:
    blocks = []
    pattern = re.compile(
        r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
        re.I | re.S,
    )
    for raw in pattern.findall(markup):
        try:
            blocks.append(json.loads(html.unescape(raw).strip()))
        except (json.JSONDecodeError, TypeError):
            continue
    return blocks


def walk_json(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_json(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_json(child)


def is_event(item: dict) -> bool:
    item_type = item.get("@type")
    values = item_type if isinstance(item_type, list) else [item_type]
    return any(str(value).lower().endswith("event") for value in values if value)


def iso_date(value) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    match = re.match(r"^(\d{4}-\d{2}-\d{2})", raw)
    return match.group(1) if match else ""


def location_name(value) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        address = value.get("address")
        if isinstance(address, dict):
            parts = [address.get("streetAddress"), address.get("addressLocality")]
            address_text = ", ".join(str(part).strip() for part in parts if part)
        else:
            address_text = str(address or "").strip()
        return str(value.get("name") or address_text).strip()
    return ""


def category(title: str) -> tuple[str, str]:
    lowered = title.lower()
    options = [
        (("gudstjänst", "kyrk", "mässa", "andakt"), ("church", "Kyrka och gemenskap")),
        (("konsert", "musik", "allsång"), ("music", "Musik")),
        (("barn", "familj"), ("family", "Barn och familj")),
        (("match", "lopp", "tävling", "cup"), ("sport", "Sport")),
        (("utställning", "konst", "teater", "bio"), ("culture", "Konst och kultur")),
        (("motor", "bil", "rally"), ("motor", "Motor")),
    ]
    for words, result in options:
        if any(word in lowered for word in words):
            return result
    return "community", "Lokalt och föreningar"


def catalog_event(item: dict, municipality: str) -> dict | None:
    """Normaliserar ett manuellt verifierat evenemang ur källkatalogen."""
    title = str(item.get("title") or "").strip()
    start = iso_date(item.get("startDate"))
    end = iso_date(item.get("endDate")) or start
    if not title or not start or end < date.today().isoformat():
        return None
    identifier = hashlib.sha1(
        f"{municipality}|{title}|{start}|{item.get('url', '')}".encode()
    ).hexdigest()[:16]
    return {
        "id": f"event-{identifier}",
        "title": title,
        "startDate": start,
        "endDate": end,
        "time": str(item.get("time") or "Se källan"),
        "venue": str(item.get("venue") or municipality),
        "category": str(item.get("category") or "community"),
        "categoryLabel": str(item.get("categoryLabel") or "Lokalt och föreningar"),
        "sourceName": str(item.get("sourceName") or "Lokal arrangör"),
        "url": str(item.get("url") or ""),
        "verified": True,
    }


def event_from_json_ld(item: dict, municipality: str, source: dict) -> dict | None:
    title = str(item.get("name") or item.get("headline") or "").strip()
    start = iso_date(item.get("startDate"))
    end = iso_date(item.get("endDate")) or start
    if not title or not start or end < date.today().isoformat():
        return None
    venue = location_name(item.get("location")) or municipality
    item_url = item.get("url")
    if isinstance(item_url, dict):
        item_url = item_url.get("@id") or item_url.get("url")
    url = urljoin(source["url"], str(item_url or source["url"]))
    event_category, label = category(title)
    identifier = hashlib.sha1(f"{municipality}|{title}|{start}|{url}".encode()).hexdigest()[:16]
    return {
        "id": f"event-{identifier}",
        "title": title,
        "startDate": start,
        "endDate": end,
        "time": "Se källan",
        "venue": venue,
        "category": event_category,
        "categoryLabel": label,
        "sourceName": source["name"],
        "url": url,
    }


def filter_api_settings(markup: str) -> tuple[int, int] | None:
    component = re.search(r"<FilterApplication\b[^>]*>", markup, re.I | re.S)
    if not component:
        return None
    settings = re.search(r":settings=[\"'](\d+)[\"']", component.group(0), re.I)
    site = re.search(r":site=[\"'](\d+)[\"']", component.group(0), re.I)
    if not settings or not site:
        return None
    return int(settings.group(1)), int(site.group(1))


def occurrence_dates(item: dict) -> list[tuple[str, str, str]]:
    """Returnerar datum, slutdatum och läsbar tid från besökskalenderns API."""
    rows = []
    for occurrence in item.get("Dates") or []:
        start = iso_date(occurrence.get("Date"))
        end = iso_date(occurrence.get("EndDate")) or start
        if not start:
            continue
        times = occurrence.get("Times") or []
        time_labels = []
        for value in times[:3]:
            start_time = str(value.get("Start") or "").strip()
            end_time = str(value.get("End") or "").strip()
            if start_time and end_time:
                time_labels.append(f"{start_time}–{end_time}")
            elif start_time:
                time_labels.append(start_time)
        rows.append((start, end, ", ".join(time_labels) or "Se källan"))
    if rows:
        return rows
    start = iso_date(item.get("Start"))
    end = iso_date(item.get("End")) or start
    if not start:
        return []
    raw_start = str(item.get("Start") or "")
    raw_end = str(item.get("End") or "")
    start_time = re.search(r"T(\d{2}:\d{2})", raw_start)
    end_time = re.search(r"T(\d{2}:\d{2})", raw_end)
    label = start_time.group(1) if start_time else "Se källan"
    if start_time and end_time and end_time.group(1) != start_time.group(1):
        label = f"{start_time.group(1)}–{end_time.group(1)}"
    return [(start, end, label)]


def events_from_filter_api(markup: str, municipality: str, source: dict) -> list[dict]:
    settings = filter_api_settings(markup)
    if not settings:
        return []
    settings_id, site_id = settings
    parts = urlsplit(source["url"])
    hits = []
    total = 1
    skip = 0
    page = 1
    while skip < total and page <= 10:
        query = urlencode({
            "includeCategories": "true",
            "page": str(page),
            "pageActivites": "1",
            "site": str(site_id),
            "settings": str(settings_id),
            "skip": str(skip),
            "wasInitialRendered": "true",
        })
        endpoint = f"{parts.scheme}://{parts.netloc}/sv/businesslist/list/?{query}"
        payload = fetch_json(endpoint)
        page_hits = payload.get("extendedHits") or []
        hits.extend(page_hits)
        total = int(payload.get("totalHits") or len(hits))
        if not page_hits:
            break
        skip += len(page_hits)
        page += 1
    today = date.today().isoformat()
    allowed = LOCALITIES.get(municipality, {municipality.casefold()})
    results = []
    for item in hits:
        title = str(item.get("Heading") or "").strip()
        city = str(item.get("City") or municipality).strip()
        if not title or city.casefold() not in allowed:
            continue
        item_url = urljoin(source["url"], str(item.get("Url") or source["url"]))
        event_category, label = category(title)
        future = [row for row in occurrence_dates(item) if row[1] >= today][:12]
        for start, end, time_label in future:
            identifier = hashlib.sha1(
                f"{municipality}|{title}|{start}|{city}|{item_url}".encode()
            ).hexdigest()[:16]
            results.append({
                "id": f"event-{identifier}",
                "title": title,
                "startDate": start,
                "endDate": end,
                "time": time_label,
                "venue": city,
                "category": event_category,
                "categoryLabel": label,
                "sourceName": source["name"],
                "url": item_url,
            })
    return results


def merge_event_rows(existing: list[dict], collected: list[dict]) -> list[dict]:
    """Slår ihop event så färsk automatdata ersätter cache, medan verifierat vinner."""
    unique = {}
    for item in collected + existing:
        title_key = re.sub(r"\W+", "", str(item.get("title", "")).casefold())
        key = f"{title_key}|{item.get('startDate')}"
        if item.get("sourceFormat") == "turid":
            key += "|" + str(item.get("time"))
        current = unique.get(key)
        if not current or item.get("verified"):
            unique[key] = item
    return list(unique.values())


def main() -> int:
    data = json.loads(OUTPUT.read_text(encoding="utf-8"))
    catalog = json.loads(SOURCE_CATALOG.read_text(encoding="utf-8"))
    today = date.today().isoformat()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    any_source_ok = False

    for municipality, payload in data.get("municipalities", {}).items():
        municipality_catalog = catalog.get("municipalities", {}).get(municipality, {})
        sources = municipality_catalog.get("sources", [])
        if sources:
            payload["sources"] = sources
        existing = [
            item for item in payload.get("events", [])
            if not item.get("verified")
            and str(item.get("endDate") or item.get("startDate") or "") >= today
        ]
        collected = [
            event for item in municipality_catalog.get("featuredEvents", [])
            if (event := catalog_event(item, municipality))
        ]
        if collected:
            any_source_ok = True
        health = []
        for source in payload.get("sources", []):
            if not source.get("automatic"):
                health.append({
                    "name": source["name"], "url": source["url"],
                    "status": "reference", "mode": "reference", "events": 0,
                    "checkedAt": now,
                })
                continue
            try:
                if source.get("parser") == "turid":
                    rows = fetch_turid_events(source, municipality)
                    # A complete successful feed supersedes its previous occurrences.
                    existing = [row for row in existing if row.get("sourceName") not in {source["name"], "Visit Värmland"}]
                else:
                    markup = fetch_html(source["url"])
                    rows = []
                    for block in json_ld_blocks(markup):
                        for candidate in walk_json(block):
                            if is_event(candidate):
                                event = event_from_json_ld(candidate, municipality, source)
                                if event:
                                    rows.append(event)
                    rows.extend(events_from_filter_api(markup, municipality, source))
                    if "visitvarmland.com" in source["url"]:
                        rows.extend(fetch_visit_varmland_events(municipality))
                collected.extend(rows)
                health.append({
                    "name": source["name"],
                    "url": source["url"],
                    "status": "ok",
                    "mode": "automatic" if rows else "reference",
                    "events": len(rows),
                    "checkedAt": now,
                })
                any_source_ok = True
                print(f"{municipality}: {source['name']} – {len(rows)} strukturerade evenemang")
            except Exception as error:
                health.append({"name": source["name"], "url": source["url"], "status": "error", "events": 0, "checkedAt": now, "message": str(error)[:180]})
                print(f"VARNING {municipality}: {source['name']} – {error}")

        ordered = sorted(
            merge_event_rows(existing, collected),
            key=lambda item: (item.get("startDate") or "", item.get("title") or ""),
        )
        selected = ordered[:80]
        selected_keys = {item.get("id") for item in selected}
        for verified in (item for item in ordered if item.get("verified") and item.get("id") not in selected_keys):
            replace_at = next((index for index in range(len(selected) - 1, -1, -1) if not selected[index].get("verified")), None)
            if replace_at is not None:
                selected[replace_at] = verified
                selected_keys.add(verified.get("id"))
        payload["events"] = sorted(selected, key=lambda item: (item.get("startDate") or "", item.get("title") or ""))
        payload["sourceHealth"] = health

    if not any_source_ok:
        print("Ingen evenemangskälla kunde kontrolleras; behåller tidigare tidsstämpel")
        return 1
    data["version"] = "0.21.0"
    data["generatedAt"] = now
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
