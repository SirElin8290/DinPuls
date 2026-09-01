#!/usr/bin/env python3
"""Hämtar Eda Bostads AB:s publicerade lediga lägenheter via Vitec Arena."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import update_housing

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "housing.json"
PROVIDER_URL = "https://bostadsbolaget.eda.se/ledigt/lagenhet"
DATA_URL = "https://bostadsbolaget.eda.se/rentalobject/Listapartment/published?sortOrder=NEWEST"
PROVIDER = {
    "name": "Eda Bostads AB",
    "url": PROVIDER_URL,
    "dataUrl": DATA_URL,
    "official": True,
}


def main() -> int:
    data = json.loads(OUTPUT.read_text(encoding="utf-8"))
    previous = (data.get("municipalities") or {}).get("Eda", {})
    try:
        listings = update_housing.parse_arvika(PROVIDER)
    except Exception as error:
        raise RuntimeError(f"Eda Bostads Vitec Arena kunde inte hämtas: {error}") from error

    if not listings:
        if previous.get("listings"):
            raise RuntimeError(
                f"Eda Bostads gav oväntat 0 objekt; tidigare fanns {len(previous['listings'])} objekt"
            )
        raise RuntimeError("Eda Bostads Vitec Arena gav 0 objekt; importen stoppas")

    # Vitec Arena använder generiska detaljlänkar. Lås dem till Eda Bostads domän.
    for item in listings:
        item["provider"] = "Eda Bostads AB"

    listings.sort(key=lambda item: (item.get("area") or "", item.get("address") or "", item.get("id") or ""))
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    old_core = {
        key: previous.get(key)
        for key in ("total", "listings", "providers")
    }
    core = {
        "total": len(listings),
        "listings": listings,
        "providers": [{"name": "Eda Bostads AB", "url": PROVIDER_URL, "official": True}],
    }
    data.setdefault("municipalities", {})["Eda"] = {
        **core,
        "errors": [],
        "stale": False,
        "checkedAt": now,
        "updatedAt": previous.get("updatedAt", now) if core == old_core else now,
    }
    data["generatedAt"] = now
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Eda, Eda Bostads AB: {len(listings)} objekt via Vitec Arena")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
