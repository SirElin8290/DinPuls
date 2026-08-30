#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "scripts" / "update_flights.py"
text = path.read_text(encoding="utf-8")
old = '"User-Agent": "DinPuls/1.0 (+https://dinpuls.se; public flight information)",'
new = '"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",'
if old not in text:
    if new in text:
        print("Webbläsaridentiteten är redan applicerad")
        raise SystemExit(0)
    raise SystemExit("Kunde inte hitta User-Agent i flygmotorn")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("Flygmotorn använder webbläsaridentitet mot officiella flygplatssidor")
