#!/usr/bin/env python3
"""Hämtar aktuella platsannonser för DinPuls startkommuner.

Kommunernas JobSearch-id:n läses från data/municipalities.json. Varje lyckad
kommunhämtning får checkedAt, medan updatedAt bara ändras när annonserna
faktiskt förändras. Tillfälliga API-fel provas om innan tidigare data används.
Kommuner som ännu saknar JobSearch-id hoppas över explicit i stället för att
markeras som tekniska fel; det gör stegvis kommunaktivering säker och synlig.
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MUNICIPALITY_FILE = ROOT / "data" / "municipalities.json"
OUTPUT = ROOT / "data" / "jobs.json"
API_URL = "https://jobsearch.api.jobtechdev.se/search"
FETCH_ATTEMPTS = 3
FETCH_TIMEOUT_SECONDS = 30
SOURCE = {
    "name": "Arbetsförmedlingen – Platsbanken",
    "url": "https://jobsearch.api.jobtechdev.se/",
}
MUNICIPALITY_CONFIG = json.loads(MUNICIPALITY_FILE.read_text(encoding="utf-8"))["municipalities"]
LOCALITIES = {
    item["name"]: {
        str(term).casefold()
        for term in item.get("localityAliases", [])
        if str(term).strip()
    }
    for item in MUNICIPALITY_CONFIG
}


def fetch_jobs(municipality_id: str) -> dict:
    query = urlencode({
        "municipality": municipality_id,
        "limit": 100,
        "sort": "pubdate-desc",
    })
    request = Request(
        f"{API_URL}?{query}",
        headers={"User-Agent": "DinPuls/0.8.0 (+https://dinpuls.se/)"},
    )
    last_error = None
    for attempt in range(1, FETCH_ATTEMPTS + 1):
        try:
            with urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
                payload = json.load(response)
            if not isinstance(payload.get("hits"), list):
                raise RuntimeError("JobSearch-svaret saknar hits")
            return payload
        except HTTPError as error:
            last_error = RuntimeError(f"JobSearch svarade med HTTP {error.code}")
            if 400 <= error.code < 500 and error.code not in (408, 429):
                break
        except URLError as error:
            last_error = RuntimeError(f"JobSearch kunde inte nås: {error.reason}")
        except (TimeoutError, OSError, json.JSONDecodeError, RuntimeError) as error:
            last_error = error
        if attempt < FETCH_ATTEMPTS:
            time.sleep(attempt * 2)
    raise RuntimeError(str(last_error or "JobSearch kunde inte hämtas"))


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


def same_municipality(job: dict, expected_name: str) -> bool:
    expected = expected_name.casefold().strip()
    actual = str(job.get("municipality") or "").casefold().strip()
    workplace = str(job.get("workplace") or "").casefold().strip()
    workplace = workplace.split(" (", 1)[0].strip()
    if actual != expected:
        return False
    if not workplace:
        return True
    return workplace in LOCALITIES.get(expected_name, {expected})


def load_json(path: Path, fallback: dict) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def content_without_timestamps(data: dict) -> dict:
    return {key: value for key, value in data.items() if key not in {"updatedAt", "checkedAt"}}


def main() -> int:
    config = load_json(MUNICIPALITY_FILE, {})
    existing = load_json(OUTPUT, {"municipalities": {}})
    previous_municipalities = existing.get("municipalities", {})
    municipalities = {}
    successful = 0
    failed = []
    skipped = []
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    configured_names = []
    for municipality in config.get("municipalities", []):
        name = str(municipality.get("name") or "").strip()
        municipality_id = str(municipality.get("jobSearchMunicipalityId") or "").strip()
        if name:
            configured_names.append(name)
        if not name:
            failed.append("Namnlös kommun")
            continue
        if not municipality_id:
            skipped.append(name)
            if name in previous_municipalities:
                municipalities[name] = previous_municipalities[name]
            continue

        try:
            payload = fetch_jobs(municipality_id)
            jobs = [normalize_job(item) for item in payload["hits"]]
            jobs = [
                job for job in jobs
                if job["id"] and job["webpageUrl"] and same_municipality(job, name)
            ]
            refreshed = {
                "municipalityId": municipality_id,
                "total": len(jobs),
                "jobs": jobs,
            }
            previous = previous_municipalities.get(name, {})
            changed = content_without_timestamps(refreshed) != content_without_timestamps(previous)
            refreshed["updatedAt"] = now if changed else previous.get("updatedAt", now)
            refreshed["checkedAt"] = now
            municipalities[name] = refreshed
            successful += 1
            print(f"{name}: {len(jobs)} verifierade annonser i kommunen")
        except (RuntimeError, ValueError, TypeError) as error:
            failed.append(name)
            print(f"VARNING {name}: {error}")
            if name in previous_municipalities:
                municipalities[name] = previous_municipalities[name]

    if successful == 0:
        print("Ingen konfigurerad kommun kunde uppdateras; behåller befintlig jobs.json")
        return 1

    # En partiell körning får behålla tidigare kommuninnehåll, men workflowen
    # kan ändå upptäcka att checkedAt inte är färskt för en konfigurerad kommun.
    output = {
        "generatedAt": now,
        "source": SOURCE,
        "municipalities": municipalities,
        "successfulMunicipalities": successful,
        "configuredMunicipalities": len(configured_names),
        "skippedMunicipalities": skipped,
        "failedMunicipalities": failed,
    }
    temporary = OUTPUT.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(OUTPUT)
    print(f"Skrev {OUTPUT} för {successful}/{len(configured_names)} kommuner")
    if skipped:
        print("Hoppade över kommuner utan JobSearch-id: " + ", ".join(skipped))
    if failed:
        print("Behöll tidigare data där det gick för: " + ", ".join(failed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
