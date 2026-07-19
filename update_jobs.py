#!/usr/bin/env python3
"""Hämtar aktuella platsannonser för DinPuls startkommuner.

Kommunernas JobSearch-id:n läses från data/municipalities.json. Jobbfilen
ersätts bara när minst en hämtning lyckas och innehållet faktiskt förändras.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MUNICIPALITY_FILE = ROOT / "data" / "municipalities.json"
OUTPUT = ROOT / "data" / "jobs.json"
API_URL = "https://jobsearch.api.jobtechdev.se/search"
SOURCE = {
    "name": "Arbetsförmedlingen – Platsbanken",
    "url": "https://jobsearch.api.jobtechdev.se/",
}


def fetch_jobs(municipality_id: str) -> dict:
    query = urlencode({
        "municipality": municipality_id,
        "limit": 25,
        "sort": "pubdate-desc",
    })
    request = Request(
        f"{API_URL}?{query}",
        headers={"User-Agent": "DinPuls/0.8.0 (+https://sirelin8290.github.io/DinPuls/)"},
    )
    try:
        with urlopen(request, timeout=30) as response:
            payload = json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"JobSearch svarade med HTTP {error.code}") from None
    except URLError as error:
        raise RuntimeError(f"JobSearch kunde inte nås: {error.reason}") from None

    if not isinstance(payload.get("hits"), list):
        raise RuntimeError("JobSearch-svaret saknar hits")
    return payload


def nested_label(item: dict, key: str) -> str:
    value = item.get(key) or {}
    return str(value.get("label") or "").strip() if isinstance(value, dict) else ""


def normalize_job(item: dict) -> dict:
    employer = item.get("employer") or {}
    address = item.get("workplace_address") or {}
    return {
        "id": str(item.get("id") or ""),
        "headline": str(item.get("headline") or "Ledigt jobb").strip(),
        "employer": str(employer.get("name") or "").strip(),
        "workplace": str(address.get("city") or address.get("municipality") or "").strip(),
        "municipality": str(address.get("municipality") or "").strip(),
        "occupation": nested_label(item, "occupation"),
        "employmentType": nested_label(item, "employment_type"),
        "duration": nested_label(item, "duration"),
        "workingHours": nested_label(item, "working_hours_type"),
        "publicationDate": item.get("publication_date"),
        "applicationDeadline": item.get("application_deadline"),
        "vacancies": int(item.get("number_of_vacancies") or 1),
        "webpageUrl": str(item.get("webpage_url") or "").strip(),
    }


def load_json(path: Path, fallback: dict) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def main() -> int:
    config = load_json(MUNICIPALITY_FILE, {})
    existing = load_json(OUTPUT, {"municipalities": {}})
    previous_municipalities = existing.get("municipalities", {})
    municipalities = {}
    successful = 0
    failed = []
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    for municipality in config.get("municipalities", []):
        name = str(municipality.get("name") or "").strip()
        municipality_id = str(municipality.get("jobSearchMunicipalityId") or "").strip()
        if not name or not municipality_id:
            failed.append(name or "Namnlös kommun")
            if name in previous_municipalities:
                municipalities[name] = previous_municipalities[name]
            continue

        try:
            payload = fetch_jobs(municipality_id)
            jobs = [normalize_job(item) for item in payload["hits"]]
            jobs = [job for job in jobs if job["id"] and job["webpageUrl"]]
            total = payload.get("total", {}).get("value", len(jobs))
            refreshed = {
                "municipalityId": municipality_id,
                "total": int(total or 0),
                "jobs": jobs,
            }
            previous = previous_municipalities.get(name, {})
            previous_content = {key: value for key, value in previous.items() if key != "updatedAt"}
            refreshed["updatedAt"] = previous.get("updatedAt", now) if refreshed == previous_content else now
            municipalities[name] = refreshed
            successful += 1
            print(f"{name}: {len(jobs)} annonser hämtade, {total} totalt")
        except (RuntimeError, ValueError, TypeError) as error:
            failed.append(name)
            print(f"VARNING {name}: {error}")
            if name in previous_municipalities:
                municipalities[name] = previous_municipalities[name]

    if successful == 0:
        print("Ingen kommun kunde uppdateras; behåller befintlig jobs.json")
        return 1

    candidate = {"source": SOURCE, "municipalities": municipalities}
    comparable_existing = {
        "source": existing.get("source"),
        "municipalities": existing.get("municipalities"),
    }
    if candidate == comparable_existing:
        print("Inga jobbannonser har förändrats; lämnar jobs.json orörd")
        return 0

    output = {"generatedAt": now, **candidate}
    temporary = OUTPUT.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(OUTPUT)
    print(f"Skrev {OUTPUT} för {successful} kommuner")
    if failed:
        print("Behöll tidigare data där det gick för: " + ", ".join(failed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
