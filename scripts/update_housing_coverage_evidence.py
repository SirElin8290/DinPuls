#!/usr/bin/env python3
"""Build machine-readable Block 2 coverage evidence from inventory and generated housing data."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "data" / "housing-coverage-sources.json"
HOUSING = ROOT / "data" / "housing.json"
OUTPUT = ROOT / "data" / "housing-coverage-evidence.json"


def main() -> int:
    inventory = json.loads(SOURCES.read_text(encoding="utf-8"))["municipalities"]
    housing = json.loads(HOUSING.read_text(encoding="utf-8"))["municipalities"]
    verified_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    result = {"generatedAt": verified_at, "municipalities": {}}
    for municipality, sources in inventory.items():
        live = housing[municipality]
        health = {row["provider"]: row for row in live.get("sourceHealth", [])}
        provider_counts = {}
        for listing in live.get("listings", []):
            provider = listing.get("provider")
            provider_counts[provider] = provider_counts.get(provider, 0) + 1
        rows = []
        for source in sources:
            row = dict(source)
            status = health.get(source["provider"])
            accepted = provider_counts.get(source["provider"], 0)
            row.update({
                "municipality": municipality,
                "verificationTimestamp": status.get("checkedAt") if status else verified_at,
                "sourceStatus": status.get("status") if status else ("blocked" if source["classification"] == "BLOCKED" else "reference"),
                "rawCount": status.get("rawCount") if status else None,
                "acceptedCount": accepted,
                "duplicateCount": (status.get("rawCount", accepted) - accepted) if status and status.get("rawCount") is not None else None,
                "currentObjectCount": accepted if source["classification"] in {"ACTIVE_WITH_OBJECTS", "VERIFIED_ZERO"} else source.get("discoveredCurrentCount"),
                "error": status.get("error") if status else source.get("error"),
                "stale": status.get("stale") if status else source["classification"] == "BLOCKED",
            })
            rows.append(row)
        blocked = [row for row in rows if row["classification"] == "BLOCKED"]
        verified_universe = sum(row["acceptedCount"] for row in rows if row["classification"] == "ACTIVE_WITH_OBJECTS")
        result["municipalities"][municipality] = {
            "providers": rows,
            "relevantProviderCount": sum(row["classification"] != "NOT_RELEVANT" for row in rows),
            "verifiedUniqueUniverse": verified_universe,
            "dinpulsCount": live.get("total"),
            "coveragePercent": 100 if not blocked and live.get("total") == verified_universe else None,
            "status": "GREEN" if not blocked and live.get("total") == verified_universe else "YELLOW",
            "blockedProviders": [row["provider"] for row in blocked],
        }
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
