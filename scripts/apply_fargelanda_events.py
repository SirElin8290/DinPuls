#!/usr/bin/env python3
"""Lägger in verifierade Färgelanda-evenemang efter den ordinarie eventgeneratorn."""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVENTS = ROOT / "data" / "events.json"
SUPPLEMENT = ROOT / "data" / "events-fargelanda-supplement.json"


def main() -> int:
    data = json.loads(EVENTS.read_text(encoding="utf-8"))
    supplement = json.loads(SUPPLEMENT.read_text(encoding="utf-8"))
    municipality = supplement["municipality"]
    municipality_data = data.setdefault("municipalities", {}).setdefault(municipality, {})
    events = municipality_data.setdefault("events", [])
    today = date.today().isoformat()
    supplement_events = [item for item in supplement.get("events", []) if (item.get("endDate") or item.get("startDate") or "") >= today]
    ids = {item.get("id") for item in supplement_events if item.get("id")}
    keys = {(item.get("title"), item.get("startDate")) for item in supplement_events}
    retained = [item for item in events if item.get("id") not in ids and (item.get("title"), item.get("startDate")) not in keys]
    retained.extend(supplement_events)
    retained.sort(key=lambda item: (item.get("startDate") or "9999-12-31", item.get("title") or ""))
    municipality_data["events"] = retained
    EVENTS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Färgelanda: {len(supplement_events)} verifierade supplement-evenemang, totalt {len(retained)} poster")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
