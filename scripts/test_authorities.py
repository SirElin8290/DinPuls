#!/usr/bin/env python3
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
data = json.loads((root / "data/authorities.json").read_text(encoding="utf-8"))
municipalities = json.loads((root / "data/municipalities.json").read_text(encoding="utf-8"))
assert set(data["municipalities"]) == {item["name"] for item in municipalities["municipalities"]}
local, national = data["municipalServices"], data["nationalServices"]
assert len({x["id"] for x in local}) == len(local) and len({x["id"] for x in national}) == len(national)
required_local = {"socialtjanst","ekonomiskt-bistand","budget-skuld","aldreomsorg","lss","barn-skola","fardtjanst-bostadsanpassning","overformyndare","bygglov","va-avfall","raddning-brandskydd","vald-nara","konsument","foretag","val-demokrati","kontaktcenter"}
required_national = {"forsakringskassan","pensionsmyndigheten","arbetsformedlingen","csn","skatteverket","migrationsverket","servicecenter","transportstyrelsen","trafikverket","polisen","kronofogden","domstolar","lantmateriet","do","imy","hallakonsument","konsumentverket","arn","arbetsmiljoverket","bolagsverket","verksamt","valmyndigheten"}
assert required_local <= {x["id"] for x in local}; assert required_national <= {x["id"] for x in national}
for x in national: assert x.get("url", "").startswith("https://")
local_ids = {x["id"] for x in local}
for m in data["municipalities"].values():
    assert m.get("website", "").startswith("https://")
    for key, url in m.get("serviceUrls", {}).items(): assert key in local_ids and url.startswith("https://")
assert next(x for x in national if x["id"] == "migrationsverket")["group"] == "Skatt, flytt & identitet"
print(f"Myndighetsguiden godkänd: {len(local)} kommunala behov, {len(national)} nationella ingångar, {len(data['municipalities'])} kommuner.")
