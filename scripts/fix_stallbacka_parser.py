#!/usr/bin/env python3
from pathlib import Path
import re

path = Path(__file__).resolve().parents[1] / "scripts" / "update_flights.py"
text = path.read_text(encoding="utf-8")
replacement = r'''def parse_stallbacka_live(now: datetime) -> list[dict]:
    html = fetch_html(AIRPORT_BY_ID["THN"]["sourceUrl"])
    soup = BeautifulSoup(html, "html.parser")
    lines = [re.sub(r"\s+", " ", line).strip() for line in soup.get_text("\n", strip=True).splitlines() if line.strip()]

    # Flygplatsens WordPress-sida kan servera svenska eller engelska rubriker
    # beroende på cache/edge. Leta därför efter båda och acceptera whitespace.
    departure_labels = {"avgångar", "departures"}
    arrival_labels = {"ankomster", "arrivals"}
    start = None
    end = None
    for index, line in enumerate(lines):
        normalized = line.casefold().strip(" :")
        if start is None and normalized in departure_labels:
            start = index + 1
            continue
        if start is not None and normalized in arrival_labels:
            end = index
            break

    if start is None or end is None or end <= start:
        # Reserv: sök rubrikblocket i hela sidtexten. Detta fångar varianter där
        # rubrik och innehåll hamnat i samma DOM-nod.
        page_text = "\n".join(lines)
        match = re.search(r"(?:^|\n)(?:Avgångar|Departures)\s*\n(.*?)(?:\n)(?:Ankomster|Arrivals)(?:\n|$)", page_text, flags=re.I | re.S)
        if not match:
            raise RuntimeError("Stallbackas avgångsblock kunde inte hittas")
        block = [line.strip() for line in match.group(1).splitlines() if line.strip()]
    else:
        block = lines[start:end]

    block = [line for line in block if "flight icon" not in line.casefold()]
    items: list[dict] = []
    i = 0
    while i < len(block):
        hhmm = normalize_time(block[i])
        if not hhmm or i + 2 >= len(block):
            i += 1
            continue
        flight = block[i + 1].strip()
        if not re.fullmatch(r"[A-Z0-9]{2,4}\s?\d{2,4}", flight, flags=re.I):
            i += 1
            continue
        destination = block[i + 2].strip()
        status = ""
        consumed = 3
        if i + 3 < len(block) and not normalize_time(block[i + 3]):
            candidate = block[i + 3].strip()
            if any(word in candidate.casefold() for word in ("start", "försen", "instäl", "beräkn", "avgår", "boarding", "gate", "depart", "cancel", "estimated")):
                status = candidate
                consumed = 4
        add_departure(
            items, "THN", now.date(), hhmm, destination, flight, "Västflyg",
            AIRPORT_BY_ID["THN"]["sourceUrl"], status=status, live_source=True,
        )
        i += consumed
    if not items:
        # Skriv en diagnostik som går att förstå i workflow-loggen utan att
        # exponera hela sidans HTML.
        candidates = [line for line in lines if re.fullmatch(r"\d{1,2}[:.]\d{2}", line) or re.fullmatch(r"[A-Z0-9]{2,4}\s?\d{2,4}", line, flags=re.I)]
        raise RuntimeError(f"Stallbackas liveavgångar kunde inte tolkas; kandidater={candidates[:12]}")
    return items


def generate_karlstad_fallback'''
new_text, count = re.subn(r'def parse_stallbacka_live\(now: datetime\) -> list\[dict\]:.*?\n\ndef generate_karlstad_fallback', replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit("Kunde inte hitta Stallbacka-parsern")
path.write_text(new_text, encoding="utf-8")
print("Stallbacka-parsern är uppdaterad")
