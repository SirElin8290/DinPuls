#!/usr/bin/env python3
"""Regressionskontroll för den generella föreningsberikningen."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from association_quality import quality, report

ROOT = Path(__file__).resolve().parents[1]


def item(filename: str, key: str, name: str) -> dict:
    data = json.loads((ROOT / "data" / filename).read_text(encoding="utf-8"))
    return next(row for row in data["municipalities"]["Arvika"][key] if row.get("name") == name)


def main() -> None:
    subprocess.run([sys.executable, str(ROOT / "scripts" / "apply_association_enrichment.py")], check=True, cwd=ROOT)
    demens = item("leisure.json", "activities", "Arvika-Eda Demensförening")
    church = item("leisure.json", "activities", "Onsdagskören")
    sport = item("sports.json", "clubs", "Mangskogs SK")
    assert demens["contact"]["phone"] == "070-211 79 13"
    assert "demensforbundet" in demens["sourcesProcessed"]
    assert church["location"].startswith("Trefaldighetskyrkans")
    assert "Fotboll" in sport["sports"] and "Innebandy" in sport["sports"]
    assert quality(demens) == "COMPLETE"
    result = report("Arvika")
    assert result["total"] > 300
    assert not result["issues"]["emptyNames"]
    assert not result["issues"]["normalizedDuplicates"]
    assert not result["issues"]["brokenUrls"]
    print("Association enrichment: PASS")


if __name__ == "__main__":
    main()
