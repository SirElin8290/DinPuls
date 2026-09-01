#!/usr/bin/env python3
"""Hämtar Eda Bostads AB:s publicerade lediga lägenheter från officiella sidor."""
from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "housing.json"
BASE_URL = "https://bostadsbolaget.eda.se/"
PROVIDER_URL = urljoin(BASE_URL, "ledigt/lagenhet")
USER_AGENT = "DinPuls/0.24 (+https://dinpuls.se/)"
AREA_URLS = [
    urljoin(BASE_URL, "omrade/charlottenberg-2"),
    urljoin(BASE_URL, "omrade/amotfors-2"),
    urljoin(BASE_URL, "omrade/koppom-2"),
    urljoin(BASE_URL, "omrade/skillingsfors-2"),
]


def fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    try:
        with urlopen(request, timeout=35) as response:
            return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code} för {url}") from None
    except (URLError, TimeoutError) as error:
        raise RuntimeError(f"kunde inte nå {url}: {getattr(error, 'reason', error)}") from None


def plain_text(markup: str) -> str:
    value = re.sub(r"<script\b[^>]*>.*?</script>", " ", markup, flags=re.I | re.S)
    value = re.sub(r"<style\b[^>]*>.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", "\n", value)
    value = html.unescape(value).replace("\xa0", " ")
    return "\n".join(line.strip() for line in value.splitlines() if line.strip())


def detail_ids(markup: str) -> set[str]:
    ids = set()
    for match in re.finditer(r"(?:href=[\"'][^\"']*)?/ledigt/detalj/id/([^\"'/?#<\s]+)", markup, flags=re.I):
        ids.add(html.unescape(match.group(1)).strip())
    return ids


def diagnostics(markup: str, label: str) -> None:
    scripts = re.findall(r"<script\b[^>]*\bsrc=[\"']([^\"']+)", markup, flags=re.I)
    forms = re.findall(r"<form\b[^>]*\baction=[\"']([^\"']+)", markup, flags=re.I)
    urls = sorted(set(re.findall(r"https?://[^\"'<>\s]+", html.unescape(markup))))
    interesting = [url for url in urls if any(word in url.lower() for word in ("api", "ledig", "objekt", "object", "market", "rental"))]
    print(f"DIAG {label}: html={len(markup)} bytes")
    print(f"DIAG {label}: scripts={scripts[-12:]}")
    print(f"DIAG {label}: forms={forms[-8:]}")
    print(f"DIAG {label}: interesting_urls={interesting[-20:]}")
    for token in ("ledigt", "detail", "objekt", "object", "api", "rental", "vacant"):
        positions = [m.start() for m in re.finditer(token, markup, flags=re.I)][:3]
        for position in positions:
            snippet = re.sub(r"\s+", " ", markup[max(0, position-180):position+300])
            print(f"DIAG {label} {token}: {snippet[:480]}")


def number(value: str) -> int | float | None:
    cleaned = value.replace(" ", "").replace("\xa0", "").replace(",", ".")
    cleaned = re.sub(r"[^0-9.]", "", cleaned)
    if not cleaned:
        return None
    try:
        result = float(cleaned)
        return int(result) if result.is_integer() else result
    except ValueError:
        return None


def parse_detail(identifier: str) -> dict:
    url = urljoin(BASE_URL, f"ledigt/detalj/id/{identifier}")
    markup = fetch_text(url)
    text = plain_text(markup)
    title_match = re.search(r"Bostad\s+([0-9]+(?:[,.][0-9]+)?)\s+ROK(?:VR)?\s+på\s+(.+?),\s+ledig lägenhet i\s+([^\n]+)", text, flags=re.I)
    if not title_match:
        raise RuntimeError(f"kunde inte tolka rubriken för objekt {identifier}")
    rooms = number(title_match.group(1))
    address = title_match.group(2).strip()
    area = title_match.group(3).strip()
    price_match = re.search(r"([0-9][0-9 \u00a0]*)\s*kr", text, flags=re.I)
    size_match = re.search(r"([0-9]+(?:[,.][0-9]+)?)\s*m(?:\^?\{?2\}?|²)", text, flags=re.I)
    availability_match = re.search(r"Tillgänglig\s+fr\.o\.m\s*:?\s*([^\n]+)", text, flags=re.I)
    return {
        "id": identifier,
        "address": address,
        "area": area,
        "rooms": rooms,
        "size": number(size_match.group(1)) if size_match else None,
        "rent": number(price_match.group(1)) if price_match else None,
        "available": availability_match.group(1).strip() if availability_match else "Se källan",
        "url": url,
        "provider": "Eda Bostads AB",
    }


def main() -> int:
    data = json.loads(OUTPUT.read_text(encoding="utf-8"))
    previous = (data.get("municipalities") or {}).get("Eda", {})
    found_ids: set[str] = set()
    source_errors: list[str] = []
    diagnostic_pages: list[tuple[str, str]] = []
    for url in AREA_URLS:
        try:
            markup = fetch_text(url)
            diagnostic_pages.append((url, markup))
            found_ids.update(detail_ids(markup))
        except RuntimeError as error:
            source_errors.append(str(error))
    try:
        markup = fetch_text(PROVIDER_URL)
        diagnostic_pages.append((PROVIDER_URL, markup))
        found_ids.update(detail_ids(markup))
    except RuntimeError as error:
        source_errors.append(str(error))

    if not found_ids:
        for label, markup in diagnostic_pages:
            diagnostics(markup, label)

    listings = []
    detail_errors = []
    for identifier in sorted(found_ids):
        try:
            listings.append(parse_detail(identifier))
        except RuntimeError as error:
            detail_errors.append(str(error))
    if not listings and previous.get("listings"):
        raise RuntimeError(f"Eda Bostads gav 0 tolkbara objekt; tidigare fanns {len(previous['listings'])} objekt")
    if not listings and not found_ids:
        raise RuntimeError("Eda Bostads gav inga objektslänkar; se DIAG-rader ovan")

    listings.sort(key=lambda item: (item.get("area") or "", item.get("address") or "", item.get("id") or ""))
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    data.setdefault("municipalities", {})["Eda"] = {
        "total": len(listings), "listings": listings,
        "providers": [{"name": "Eda Bostads AB", "url": PROVIDER_URL, "official": True}],
        "errors": detail_errors, "sourceWarnings": source_errors, "stale": False,
        "checkedAt": now, "updatedAt": now,
    }
    data["generatedAt"] = now
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Eda, Eda Bostads AB: {len(listings)} objekt")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
