#!/usr/bin/env python3
"""Söker säkra hållplatsgrupper för DinPuls startkommuner.

API-nyckeln läses enbart från TRAFIKLAB_API_KEY och skrivs aldrig till fil.
Endast en exakt namnträff aktiveras automatiskt. Alla kandidater sparas för
granskning i data/stop-candidates.json.
"""
from __future__ import annotations

import json
import os
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MUNICIPALITY_FILE = ROOT / "data" / "municipalities.json"
CANDIDATE_FILE = ROOT / "data" / "stop-candidates.json"
API_KEY = os.getenv("TRAFIKLAB_API_KEY", "").strip()


def normalize_name(value: str) -> str:
    value = unicodedata.normalize("NFKC", str(value)).casefold().strip()
    return " ".join(value.split())


def fetch_candidates(name: str) -> list[dict]:
    url = (
        "https://realtime-api.trafiklab.se/v1/stops/name/"
        f"{quote(name)}?key={quote(API_KEY)}"
    )
    request = Request(url, headers={"User-Agent": "DinPuls/0.7.1"})
    try:
        with urlopen(request, timeout=25) as response:
            payload = json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"Trafiklab svarade med HTTP {error.code}") from None
    except URLError as error:
        raise RuntimeError(f"Trafiklab kunde inte nås: {error.reason}") from None

    groups = payload.get("stop_groups", [])
    if not isinstance(groups, list):
        raise RuntimeError("Trafiklab-svaret saknar stop_groups")
    return groups


def public_candidate(group: dict) -> dict:
    return {
        "id": str(group.get("id", "")),
        "name": str(group.get("name", "")),
        "areaType": str(group.get("area_type", "")),
        "transportModes": group.get("transport_modes", []),
        "averageDailyStopTimes": group.get("average_daily_stop_times"),
    }


def choose_exact(name: str, groups: list[dict]) -> dict | None:
    exact = [
        group for group in groups
        if normalize_name(group.get("name", "")) == normalize_name(name)
        and str(group.get("id", "")).isdigit()
    ]
    if not exact:
        return None
    return max(
        exact,
        key=lambda group: (
            group.get("area_type") == "META_STOP",
            float(group.get("average_daily_stop_times") or 0),
        ),
    )


def main() -> int:
    if not API_KEY:
        print("TRAFIKLAB_API_KEY saknas.")
        return 1

    config = json.loads(MUNICIPALITY_FILE.read_text(encoding="utf-8"))
    result = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "Trafiklab Stop Lookup",
        "municipalities": {},
    }
    selected_count = 0

    for municipality in config.get("municipalities", []):
        name = municipality["name"]
        try:
            groups = fetch_candidates(name)
        except RuntimeError as error:
            print(f"{name}: {error}")
            return 1

        selected = choose_exact(name, groups)
        candidates = [public_candidate(group) for group in groups[:10]]
        result["municipalities"][name] = {
            "selectedId": str(selected.get("id")) if selected else None,
            "selectedName": str(selected.get("name")) if selected else None,
            "candidates": candidates,
        }

        if selected:
            municipality["transportStops"] = [{
                "id": str(selected["id"]),
                "name": str(selected["name"]),
            }]
            selected_count += 1
            print(f"{name}: säker exakt träff hittad ({selected['name']})")
        else:
            print(f"{name}: ingen säker exakt träff; lämnar hållplats-id tomt")

    MUNICIPALITY_FILE.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    CANDIDATE_FILE.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Säkra automatiska träffar: {selected_count}/7")
    return 0


if __name__ == "__main__":
    sys.exit(main())
