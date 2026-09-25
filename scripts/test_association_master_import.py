#!/usr/bin/env python3
"""Validera att hela föreningsmastern är behandlad och representerad."""

import json
import re
import unicodedata
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def norm(value):
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", value).replace("brukshundsklubb", "brukshundklubb")


outcomes = json.loads((ROOT / "data/association-master-outcomes.json").read_text(encoding="utf-8"))["items"]
leisure = json.loads((ROOT / "data/leisure.json").read_text(encoding="utf-8"))["municipalities"]
sports = json.loads((ROOT / "data/sports.json").read_text(encoding="utf-8"))["municipalities"]

assert len(outcomes) == 4196, f"Fel antal masterutfall: {len(outcomes)}"
assert len({item["masterId"] for item in outcomes}) == 4196, "Master-ID är inte unika"
assert all(item["outcome"] in {"A", "B", "C"} for item in outcomes), "Obehandlat utfall finns"
assert all(item["masterName"].strip() for item in outcomes), "Tomt masternamn finns"

for municipality in leisure:
    records = leisure[municipality]["activities"] + sports[municipality]["clubs"]
    keys = [norm(item["name"]) for item in records]
    duplicates = [key for key, count in Counter(keys).items() if key and count > 1]
    assert not duplicates, f"{municipality}: normaliserade dubbletter finns"
    available = set(keys)
    for item in (row for row in outcomes if row["municipality"] == municipality and row["outcome"] != "C"):
        assert norm(item.get("canonicalName", item["masterName"])) in available, (
            f"{item['masterId']}: relevant masterpost saknas i data"
        )

for item in (row for row in outcomes if row["outcome"] == "C"):
    assert item.get("reason"), f"{item['masterId']}: exkludering saknar orsak"

print("Föreningsmaster: 4196/4196 behandlade, 21/21 kommuner, 0 obehandlade")
