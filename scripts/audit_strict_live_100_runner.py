#!/usr/bin/env python3
"""STRICT-runner med stöd för verifierat faktiskt lunchutbud under normalgränsen."""
from __future__ import annotations

import audit_strict_live_100 as base

# Körs efter att aktuell lunch.json har publicerats live.
_original_audit = base.audit


def audit_with_verified_supply(name, data, config):
    result = _original_audit(name, data, config)
    row = base.me(data["lunch.json"], name)
    restaurants = [item for item in (row.get("restaurants") or []) if isinstance(item, dict)]
    actual_supply = row.get("actualLocalLunchSupply")
    supply_verified = row.get("actualSupplyVerified") is True

    try:
        actual_supply = int(actual_supply)
    except (TypeError, ValueError):
        actual_supply = 0

    if supply_verified and 0 < actual_supply < 4 and len(restaurants) >= actual_supply:
        result["modules"]["Dagens lunch"] = (
            "🟢",
            f"{len(restaurants)} / {actual_supply} verifierat faktiskt utbud",
            "",
        )
        result["blockers"] = [
            key for key, value in result["modules"].items() if value[0] != "🟢"
        ]
        result["overall"] = "🟢 100 %" if not result["blockers"] else "🟡 EJ 100 %"

    return result


base.audit = audit_with_verified_supply

if __name__ == "__main__":
    raise SystemExit(base.main())
