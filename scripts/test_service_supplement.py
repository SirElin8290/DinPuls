#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MUNICIPALITIES = ["Åmål", "Säffle", "Bengtsfors", "Mellerud", "Årjäng", "Arvika", "Grums", "Kil", "Sunne"]

data = json.loads((ROOT / "data" / "service-private-supplement.json").read_text(encoding="utf-8"))
businesses = data.get("businesses", [])
categories = set(data.get("categoryOrder", []))

assert businesses, "Kompletterande servicekatalog är tom"
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

print(f"Servicekatalogen godkänd: {len(businesses)} kompletterande företag i {len(MUNICIPALITIES)} kommuner.")
