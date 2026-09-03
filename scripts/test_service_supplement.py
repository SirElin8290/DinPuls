#!/usr/bin/env python3
import json
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
MUNICIPALITIES = ["Åmål", "Säffle", "Bengtsfors", "Mellerud", "Årjäng", "Arvika", "Grums", "Kil", "Sunne"]

data = json.loads((ROOT / "data" / "service-private-supplement.json").read_text(encoding="utf-8"))
local_data = json.loads((ROOT / "data" / "service-local-supplement.json").read_text(encoding="utf-8"))
businesses = data.get("businesses", [])
local_businesses = local_data.get("businesses", [])
categories = set(data.get("categoryOrder", []))

assert businesses, "Kompletterande servicekatalog är tom"
assert local_businesses, "Lokala servicekompletteringar är tomma"
assert categories, "Servicekatalogens kategoriordning saknas"

seen = set()
for item in businesses:
    municipality = item.get("municipality")
    name = str(item.get("name", "")).strip()
    category = item.get("category")
    url = str(item.get("url", "")).strip()
    phone = str(item.get("phone", "")).strip()
    address = str(item.get("address", "")).strip()

    assert municipality in MUNICIPALITIES, f"Ogiltig kommun för {name}: {municipality}"
    assert name, "Serviceföretag saknar namn"
    assert category in categories, f"{name}: okänd kategori {category}"
    assert url or phone or address, f"{name}: saknar webbplats och kontaktuppgifter"
    if url:
        assert url.startswith("https://"), f"{name}: webbplats måste använda https"
        assert "google." not in url.lower(), f"{name}: får inte länka till Google"
    key = (municipality, name.casefold())
    assert key not in seen, f"Dubblett i servicekatalogen: {municipality} / {name}"
    seen.add(key)

for municipality in MUNICIPALITIES:
    local = [item for item in businesses if item.get("municipality") == municipality]
    assert len(local) >= 5, f"{municipality}: behöver minst fem kompletterande serviceföretag"
    assert len({item.get("category") for item in local}) >= 3, f"{municipality}: behöver minst tre servicekategorier"

for item in local_businesses:
    name = str(item.get("name", "")).strip()
    category = item.get("category")
    url = str(item.get("url", "")).strip()
    phone = str(item.get("phone", "")).strip()
    address = str(item.get("address", "")).strip()
    assert item.get("municipality") in {row["name"] for row in json.loads((ROOT / "data/municipalities.json").read_text(encoding="utf-8"))["municipalities"]}, f"Lokal supplementpost ligger i oväntad kommun: {name}"
    assert name, "Lokalt serviceföretag saknar namn"
    assert category in categories, f"{name}: okänd kategori {category}"
    assert url or phone or address, f"{name}: saknar webbplats och kontaktuppgifter"
    if url:
        assert url.startswith("https://"), f"{name}: webbplats måste använda https"
        assert "google." not in url.lower(), f"{name}: får inte länka till Google"

assert len([item for item in local_businesses if item.get("municipality") == "Dals-Ed"]) >= 5, "Dals-Ed behöver minst fem lokala servicekompletteringar"
assert len({item.get("category") for item in local_businesses if item.get("municipality") == "Dals-Ed"}) >= 3, "Dals-Ed behöver minst tre servicekategorier"
script = (ROOT / "service-page.js").read_text(encoding="utf-8")
assert 'data/service-local-supplement.json' in script, "Frontend laddar inte lokala servicekompletteringar"

base = json.loads((ROOT / "data/service.json").read_text(encoding="utf-8"))
launch = json.loads((ROOT / "data/service-launch-supplement.json").read_text(encoding="utf-8"))
eda = [item for item in base.get("businesses", []) + launch.get("businesses", [])
       + businesses + local_businesses if item.get("municipality") == "Eda"]
names = [item["name"].strip().casefold() for item in eda]
assert len(names) == len(set(names)), "Eda: dubbletter mellan produktionskällor"
assert not any("värmlandsvillan" in name for name in names), "Konkursbolag får inte läggas till"
assert {"El & installation", "VVS, värme & kyla", "Bygg & snickeri", "Bil, däck & fordonsservice"} <= {item.get("category") for item in eda}
expected = {"Stens EL", "Aaror AB", "Mekonomen Bilverkstad Charlottenberg",
            "Gränsverkstad Charlottenberg / Autoexperten", "Engelbrekts Motor AB",
            "Lässeruds Bygg AB", "FC Bygg AB", "VibeHus Bygg AB", "Vittensten Bygg AB"}
added = [item for item in eda if item["name"] in expected]
assert {item["name"] for item in added} == expected, "Eda: verifierade företag saknas"
for town in ("Charlottenberg", "Åmotfors", "Koppom"):
    assert any(town in item.get("address", "") for item in added), f"Eda: {town} saknas"
for item in added:
    assert item["category"] in categories
    assert item.get("sourceType"), f"{item['name']}: källa saknas"
    parsed = urlsplit(item.get("url") or item.get("sourceUrl") or "")
    assert parsed.scheme == "https" and parsed.hostname, f"{item['name']}: ogiltig käll-URL"
    assert not parsed.username and not parsed.password
assert 'data/service-launch-supplement.json' in script, "Frontend laddar inte Eda-kompletteringen"

print(f"Servicekatalogen godkänd: {len(businesses)} basposter, {len(local_businesses)} lokala supplementposter och {len(eda)} Eda-poster.")

filipstad = [item for item in base.get("businesses", []) + launch.get("businesses", [])
             + businesses + local_businesses if item.get("municipality") == "Filipstad"]
assert len({item["name"].strip().casefold() for item in filipstad}) == len(filipstad), "Filipstad: dubbla företag"
assert {"El & installation", "VVS, värme & kyla", "Bygg & snickeri", "Bil, däck & fordonsservice"} <= {item.get("category") for item in filipstad}
