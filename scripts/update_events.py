#!/usr/bin/env python3
"""Samlar verifierbara evenemang ur JSON-LD på DinPuls officiella källsidor."""
from __future__ import annotations

import hashlib
import html
import json
import re
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "events.json"
USER_AGENT = "DinPuls/0.20 (+https://sirelin8290.github.io/DinPuls/)"


def fetch_html(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def json_ld_blocks(markup: str) -> list[object]:
    blocks = []
    pattern = re.compile(
        r"<script[^>]+type=[\"']application/ld\\+json[\"'][^>]*>(.*?)</script>",
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
    match = re.match(r"^(\\d{4}-\\d{2}-\\d{2})", raw)
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


def main() -> int:
    data = json.loads(OUTPUT.read_text(encoding="utf-8"))
    today = date.today().isoformat()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    any_source_ok = False

    for municipality, payload in data.get("municipalities", {}).items():
        existing = [
            item for item in payload.get("events", [])
            if str(item.get("endDate") or item.get("startDate") or "") >= today
        ]
        collected = []
        health = []
        for source in payload.get("sources", []):
            try:
                markup = fetch_html(source["url"])
                rows = []
                for block in json_ld_blocks(markup):
                    for candidate in walk_json(block):
                        if is_event(candidate):
                            event = event_from_json_ld(candidate, municipality, source)
                            if event:
                                rows.append(event)
                collected.extend(rows)
                health.append({"name": source["name"], "url": source["url"], "status": "ok", "events": len(rows), "checkedAt": now})
                any_source_ok = True
                print(f"{municipality}: {source['name']} – {len(rows)} strukturerade evenemang")
            except Exception as error:
                health.append({"name": source["name"], "url": source["url"], "status": "error", "events": 0, "checkedAt": now, "message": str(error)[:180]})
                print(f"VARNING {municipality}: {source['name']} – {error}")

        unique = {}
        for item in existing + collected:
            key = f"{str(item.get('title', '')).lower()}|{item.get('startDate')}|{item.get('venue')}"
            unique[key] = item
        payload["events"] = sorted(unique.values(), key=lambda item: (item.get("startDate") or "", item.get("title") or ""))[:80]
        payload["sourceHealth"] = health

    if not any_source_ok:
        print("Ingen evenemangskälla kunde kontrolleras; behåller tidigare tidsstämpel")
        return 1
    data["version"] = "0.20.1"
    data["generatedAt"] = now
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
