#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "scripts" / "update_flights.py"
text = path.read_text(encoding="utf-8")

marker = '''def generate_hagfors_torsby(day: date, items: list[dict]):'''
fallback = '''def generate_stallbacka_fallback(day: date, items: list[dict]):
    """Reservtidtabell för THN→BMA när flygplatsens livevy inte kan hämtas.

    Veckomönstret är kontrollerat mot aktuell publicerad flygtidtabell.
    Söndag 30 augusti 2026 har en officiellt publicerad avvikelse 15:20.
    Poster härifrån är alltid tidtabell, aldrig påstådd realtid.
    """
    source = AIRPORT_BY_ID["THN"]["scheduleUrl"]
    weekday = day.weekday()
    if day == date(2026, 8, 30):
        add_departure(items, "THN", day, "15:20", "Stockholm-Bromma Airport", "OJ256", "Västflyg", source, stale=True)
        return
    if weekday in (0, 1, 2):
        add_departure(items, "THN", day, "07:15", "Stockholm-Bromma Airport", "OJ250", "Västflyg", source, stale=True)
        add_departure(items, "THN", day, "15:55", "Stockholm-Bromma Airport", "OJ256", "Västflyg", source, stale=True)
    elif weekday == 3:
        add_departure(items, "THN", day, "07:30", "Stockholm-Bromma Airport", "OJ250", "Västflyg", source, stale=True)
        add_departure(items, "THN", day, "16:20", "Stockholm-Bromma Airport", "OJ256", "Västflyg", source, stale=True)
    elif weekday == 4:
        add_departure(items, "THN", day, "15:00", "Stockholm-Bromma Airport", "OJ256", "Västflyg", source, stale=True)
    elif weekday == 6:
        add_departure(items, "THN", day, "15:55", "Stockholm-Bromma Airport", "OJ256", "Västflyg", source, stale=True)


'''
if 'def generate_stallbacka_fallback' not in text:
    if marker not in text:
        raise SystemExit("Kunde inte hitta Hagfors/Torsby-generatorn")
    text = text.replace(marker, fallback + marker, 1)

old = '''    except Exception as error:
        errors.append(f"Stallbacka: {error}")
        items.extend(previous_future("THN", now))

    for offset in range(0, 7):
        generate_hagfors_torsby((now + timedelta(days=offset)).date(), items)'''
new = '''    except Exception as error:
        errors.append(f"Stallbacka live: {error}; använder verifierad tidtabellsfallback")
        retained = previous_future("THN", now)
        if retained:
            items.extend(retained)
        else:
            for offset in range(0, 7):
                generate_stallbacka_fallback((now + timedelta(days=offset)).date(), items)

    for offset in range(0, 7):
        generate_hagfors_torsby((now + timedelta(days=offset)).date(), items)'''
if old in text:
    text = text.replace(old, new, 1)
elif 'använder verifierad tidtabellsfallback' not in text:
    raise SystemExit("Kunde inte hitta Stallbackas felhantering")

path.write_text(text, encoding="utf-8")
print("Stallbacka har nu livekälla med verifierad tidtabellsfallback")
