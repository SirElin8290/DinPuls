#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SPORTS = DATA / "sports.json"
SUPPLEMENT = DATA / "association-hammaro-supplement.json"

sports = json.loads(SPORTS.read_text(encoding="utf-8"))
supplement = json.loads(SUPPLEMENT.read_text(encoding="utf-8"))
row = sports.setdefault("municipalities", {}).setdefault("Hammarö", {})
existing = [x for x in (row.get("clubs") or []) if isinstance(x, dict)]
by_name = {str(x.get("name") or "").strip().casefold(): x for x in existing if x.get("name")}
extra = ((supplement.get("municipalities") or {}).get("Hammarö") or {}).get("clubs") or []
for club in extra:
    if not isinstance(club, dict) or not club.get("name"):
        continue
    key = str(club["name"]).strip().casefold()
    by_name[key] = {**by_name.get(key, {}), **club}
row["clubs"] = sorted(by_name.values(), key=lambda x: str(x.get("name") or "").casefold())
directory_url = ((supplement.get("municipalities") or {}).get("Hammarö") or {}).get("directoryUrl")
if directory_url:
    row["directoryUrl"] = directory_url
if len(row["clubs"]) < 20:
    raise SystemExit(f"Hammarö: endast {len(row['clubs'])} föreningar efter komplettering; minst 20 krävs")
SPORTS.write_text(json.dumps(sports, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Hammarö: {len(row['clubs'])} idrottsföreningar efter komplettering")
