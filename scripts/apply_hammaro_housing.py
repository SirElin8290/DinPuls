#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
HOUSING = DATA / "housing.json"
SUPPLEMENT = DATA / "housing-hammaro-supplement.json"

housing = json.loads(HOUSING.read_text(encoding="utf-8"))
supplement = json.loads(SUPPLEMENT.read_text(encoding="utf-8"))
municipalities = housing.setdefault("municipalities", {})
row = municipalities.setdefault("Hammarö", {})
existing = [x for x in (row.get("listings") or []) if isinstance(x, dict)]
by_key = {str(x.get("id") or x.get("address") or "").strip().casefold(): x for x in existing}
for item in supplement.get("listings") or []:
    if not isinstance(item, dict):
        continue
    key = str(item.get("id") or item.get("address") or "").strip().casefold()
    if key:
        by_key[key] = item
row["listings"] = list(by_key.values())
row["total"] = len(row["listings"])
row["checkedAt"] = f"{supplement.get('sourceChecked')}T12:00:00+02:00"
row["updatedAt"] = row["checkedAt"]
row["stale"] = False
row["errors"] = []
# När en verifierad objektslista applicerats är Hammarö inte längre bara en
# official-reference-post. Detta måste vara automatic så den gemensamma
# bostadsvalideringen tillåter numerisk total och faktiska objekt.
row["availabilityMode"] = "automatic"
row.setdefault("sourceHealth", []).append({
    "source": "Hammarö verifierad komplettering",
    "status": "ok",
    "checkedAt": row["checkedAt"]
})
if len(row["listings"]) < 1:
    raise SystemExit("Hammarö: minst ett aktuellt bostadsobjekt krävs")
HOUSING.write_text(json.dumps(housing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Hammarö: {len(row['listings'])} bostadsobjekt efter komplettering")
