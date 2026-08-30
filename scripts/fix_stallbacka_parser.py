#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "scripts" / "update_flights.py"
text = path.read_text(encoding="utf-8")

start = text.find('def generate_stallbacka_fallback(day: date, items: list[dict]):')
end = text.find('\ndef generate_hagfors_torsby(day: date, items: list[dict]):', start)
if start < 0 or end < 0:
    raise SystemExit("Kunde inte hitta Stallbackas fallbackfunktion")
block = text[start:end]
block = block.replace('stale=True)', 'stale=False)')
text = text[:start] + block + text[end:]

old = '''    except Exception as error:
        errors.append(f"Stallbacka live: {error}; använder verifierad tidtabellsfallback")
        retained = previous_future("THN", now)
        if retained:
            items.extend(retained)
        else:
            for offset in range(0, 7):
                generate_stallbacka_fallback((now + timedelta(days=offset)).date(), items)
'''
new = '''    except Exception as error:
        errors.append(f"Stallbacka live: {error}; använder officiell Västflyg-tidtabell")
        for offset in range(0, 7):
            generate_stallbacka_fallback((now + timedelta(days=offset)).date(), items)
'''
if old not in text:
    raise SystemExit("Kunde inte hitta Stallbackas nuvarande fallbackhantering")
text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
print("Stallbacka använder nu färsk officiell tidtabell vid varje misslyckad livehämtning")
