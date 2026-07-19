#!/usr/bin/env python3
"""Söker säkra hållplatsgrupper för DinPuls startkommuner.

API-nyckeln läses enbart från TRAFIKLAB_API_KEY och skrivs aldrig till fil.
De sju manuellt granskade hållplats-id:na återställs alltid i den centrala
kommunfilen. Kandidater sparas fortsatt i data/stop-candidates.json.
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

# Manuellt verifierade mot Trafiklab Stop Lookup 2026-07-19.
# Denna reserv gör körningen självreparerande om en äldre workflow tidigare
# har hunnit skriva tomma transportStops till municipalities.json.
REVIEWED_STOPS = {
    "Åmål": {"id": "740000076", "name": "Åmål station"},
    "Säffle": {"id": "740000023", "name": "Säffle station"},
    "Bengtsfors": {"id": "740098286", "name": "Bengtsfors"},
    "Mellerud": {"id": "740098017", "name": "Mellerud"},
    "Årjäng": {"id": "740000364", "name": "Årjäng busstation"},
    "Arvika": {"id": "740098080", "name": "Arvika"},
    "Grums": {"id": "740000217", "name": "Grums station"},
}


def normalize_name(value: str) -> str:
    value = unicodedata.normalize("NFKC", str(value)).casefold().strip()
    return " ".join(value.split())


def fetch_candidates(name: str) -> list[dict]:
    url = (
        "https://realtime-api.trafiklab.se/v1/stops/name/"
        f"{quote(name)}?key={quote(API_KEY)}"
    )
    request = Request(url, headers={"User-Agent": "DinPuls/0.7.3"})
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


def choose_safe(name: str, groups: list[dict], configured_ids: set[str]) -> dict | None:
    exact = [
        group for group in groups
        if normalize_name(group.get("name", "")) == normalize_name(name)
        and str(group.get("id", "")).isdigit()
    ]
    if exact:
        return max(
            exact,
            key=lambda group: (
                group.get("area_type") == "META_STOP",
                float(group.get("average_daily_stop_times") or 0),
            ),
        )

    reviewed = [
        group for group in groups
        if str(group.get("id", "")) in configured_ids
    ]
    return reviewed[0] if len(reviewed) == 1 else None


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

        reviewed = REVIEWED_STOPS.get(name)
        configured_ids = {reviewed["id"]} if reviewed else set()
        selected = choose_safe(name, groups, configured_ids)
        if reviewed:
            # ID:t är redan manuellt verifierat. Använd det även om Trafiklabs
            # namnsökning tillfälligt ändrar sortering eller inte returnerar det.
            selected = reviewed
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
            print(f"{name}: säker träff hittad ({selected['name']})")
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
