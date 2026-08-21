#!/usr/bin/env python3
"""Importera offentliga föreningsregister till DinPuls fritids- och idrottsdata."""

from __future__ import annotations

import html
import http.cookiejar
import json
import re
import subprocess
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MUNICIPALITIES = [
    item["name"]
    for item in json.loads((ROOT / "data" / "municipalities.json").read_text(encoding="utf-8"))["municipalities"]
]
DIRECTORIES = {
    "Åmål": "https://saffle.ibgo.se/AssociationRegister",
    "Säffle": "https://saffle.ibgo.se/AssociationRegister",
    "Bengtsfors": "https://ibgo.bengtsfors.se/AssociationRegister",
    "Mellerud": "https://mellerud.se/uppleva-och-gora/foreningar/foreningsliv/foreningsregister/",
    "Årjäng": "https://arjang.interbookfri.se/AssociationRegister",
    "Arvika": "https://arvika.ibgo.se/AssociationRegister",
    "Grums": "https://business.updatesystem.se/ifgrums/search-char",
    "Kil": "https://kil.rbok.se/foreningsregister",
}
IBGO = {
    "Åmål": ("https://saffle.ibgo.se", "18"),
    "Säffle": ("https://saffle.ibgo.se", "11"),
    "Bengtsfors": ("https://ibgo.bengtsfors.se", ""),
    "Årjäng": ("https://arjang.interbookfri.se", ""),
    "Arvika": ("https://arvika.ibgo.se", ""),
}
EXTRA_LEISURE = {
    "Åmål": [
        ("Trudelutten", "musik", "Barnkör", "https://www.svenskakyrkan.se/amal/kor"),
        ("Gosskören och Voces Adolescens", "musik", "Barn- och ungdomskör", "https://www.svenskakyrkan.se/amal/kor"),
        ("Himlaliv", "musik", "Barnkör", "https://www.svenskakyrkan.se/amal/kor"),
        ("Åmåls församlings ungdomskör", "musik", "Ungdomskör", "https://www.svenskakyrkan.se/amal/kor"),
        ("Mokören", "musik", "Kör", "https://www.svenskakyrkan.se/amal/kor"),
        ("Trivselkören", "musik", "Kör och körskola", "https://www.svenskakyrkan.se/amal/kor"),
        ("Worship Gospel", "musik", "Gospelkör", "https://www.svenskakyrkan.se/amal/kor"),
        ("Ånimmekören", "musik", "Kör", "https://www.svenskakyrkan.se/amal/kor"),
        ("Vokalensemblen", "musik", "Projektkör", "https://www.svenskakyrkan.se/amal/kor"),
    ],
    "Säffle": [
        ("Bro–Ny-Huggenäs barnkör", "musik", "Barnkör", "https://www.svenskakyrkan.se/safflepastorat/korverksamhet"),
        ("Gillberga–Kila barnkör", "musik", "Barnkör och pyssel", "https://www.svenskakyrkan.se/safflepastorat/korverksamhet"),
        ("Gillberga–Kila kyrkokör", "musik", "Kyrkokör", "https://www.svenskakyrkan.se/safflepastorat/korverksamhet"),
        ("Långseruds kyrkokör", "musik", "Kyrkokör", "https://www.svenskakyrkan.se/safflepastorat/korverksamhet"),
        ("Svanskogs kyrkokör", "musik", "Kyrkokör", "https://www.svenskakyrkan.se/safflepastorat/korverksamhet"),
        ("Sonuskören", "musik", "Kör", "https://www.svenskakyrkan.se/safflepastorat/korverksamhet"),
        ("Säffle kyrkokör", "musik", "Kyrkokör", "https://www.svenskakyrkan.se/safflepastorat/korverksamhet"),
        ("Säffle Oratoriekör", "musik", "Oratoriekör", "https://www.svenskakyrkan.se/safflepastorat/korverksamhet"),
        ("Värmlandsnäskören", "musik", "Kör", "https://www.svenskakyrkan.se/safflepastorat/korverksamhet"),
        ("Tveta Sångkör", "musik", "Sångkör", "https://www.svenskakyrkan.se/safflepastorat/korverksamhet"),
        ("Tonfixarna", "musik", "Barnkör och pyssel", "https://www.svenskakyrkan.se/safflepastorat/korverksamhet"),
    ],
    "Bengtsfors": [
        ("Miniorkören", "musik", "Barnkör 6–9 år", "https://www.svenskakyrkan.se/bengtsfors/barnkor"),
        ("Miniorer i Bengtsfors", "gemenskap", "Barn, lek, pyssel och teater", "https://www.svenskakyrkan.se/bengtsfors/miniorer"),
        ("Mix-Minior i Ärtemark", "gemenskap", "Barn, spel, lek, pyssel och teater", "https://www.svenskakyrkan.se/bengtsfors/mix"),
    ],
    "Årjäng": [
        ("Silleruds barnkör", "musik", "Barnkör", "https://www.svenskakyrkan.se/nordmarkenspastorat/vara-barn--och-ungdomsgrupper"),
        ("Töcksmarks kör för barn och unga", "musik", "Barn- och ungdomskör", "https://www.svenskakyrkan.se/nordmarkenspastorat/vara-barn--och-ungdomsgrupper"),
        ("Blomskogs barnkör", "musik", "Barnkör", "https://www.svenskakyrkan.se/nordmarkenspastorat/vara-barn--och-ungdomsgrupper"),
    ],
    "Arvika": [
        ("SingOut", "musik", "Gospel-, pop- och folkmusikkör", "https://www.svenskakyrkan.se/arvika/musik-och-kultur"),
        ("Voices", "musik", "Ungdomskör", "https://www.svenskakyrkan.se/arvika/musik-och-kultur"),
        ("Onsdagskören", "musik", "Blandad kör", "https://www.svenskakyrkan.se/arvika/musik-och-kultur"),
        ("Arvika Oratoriekör", "musik", "Projektkör", "https://www.svenskakyrkan.se/arvika/musik-och-kultur"),
        ("Älgå–Glava församlingskör", "musik", "Kyrkokör", "https://www.svenskakyrkan.se/arvika/musik-och-kultur"),
        ("Arvika pastorats barnkörer", "musik", "Barnkör", "https://www.svenskakyrkan.se/arvika/musik-och-kultur"),
        ("Helig dans i Älgå", "kultur", "Dans och gemenskap", "https://www.svenskakyrkan.se/arvika/musik-och-kultur"),
    ],
}
MELLERUD_PAGES = {
    "natur": "djur-och-natur",
    "gemenskap": "ideella-foreningar",
    "sport": "idrott-och-sport",
    "gemenskap-intresse": "intresseforeningar",
    "kultur": "kultur-och-hembygd",
    "kyrka": "kyrkliga-organisationer",
    "studie": "studieforbund",
    "ovrigt": "ovriga",
}
SKIP = ("politisk", "parti", "arbetarekommun", "moderata", "centerpart", "socialdemokrat", "vänsterpart", "sverigedemokrat", "liberalerna")

# Verifierade egna webbplatser eller direkta organisationssidor. Dessa ska
# alltid vinna över kommunernas registerlänkar vid en ny import.
DIRECT_LINKS = {
    "Arvika Disc Golf Club": "https://tjing.se/club/arvika-disc-golf-club/",
    "Arvika Simsällskap": "https://www.arvikass.se/",
    "Bengtsfors Scoutkår": "https://www.scouterna.se/hitta-scoutkar/vastra-gotalands-lan/bengtsfors-kommun/bengtsfors-scoutkar/",
    "Dalslands Konstförening": "https://dkf.se/dalslands-konstforening/",
    "Dalslands Konstnärsförbund": "https://dkf.se/dalslands-konstnarsforbund/",
    "Dalslands Litteraturförening": "https://www.bokdagaridalsland.se/dalslands-litteraturforening/",
    "Dalslands Skrivarförening": "https://dalslandsskrivarforening.se/",
    "Dalslands Skrivarförening – Mellerudsgruppen": "https://dalslandsskrivarforening.se/",
    "Filmföreningen på Dal": "https://www.filmfestivalpadal.se/",
    "Grums Brukshundklubb": "https://grumsbrukshundklubb.se/",
    "Halmens Hus": "https://www.halmenshus.com/",
    "Melleruds Ridklubb": "https://www.mellerudsridklubb.com/",
    "Melleruds Scoutkår": "https://mellerud.scout.se/",
    "Säffle Filmstudio": "https://saffle.filmstudio.se/",
    "Säffle IBF": "https://www.saffleibf.se/",
    "Åmåls Brukshundklubb": "https://xn--mlsbrukshundklubb-7qbb.se/",
    "Åmåls Fotoklubb": "https://amalsfotoklubb.se/",
    "Åmåls Innebandyklubb": "https://amalsibk.com/",
    "Åmåls Scoutkår": "https://www.scouterna.se/hitta-scoutkar/vastra-gotalands-lan/amals-kommun/amals-scoutkar/",
    "Årjängs Brukshundklubb": "https://arjangsbrukshund.wordpress.com/",
}
LINK_OVERRIDES = json.loads((ROOT / "data/association-link-overrides.json").read_text(encoding="utf-8"))

SPORT_WORDS = {
    "Fotboll": ("fotboll",), "Futsal": ("futsal",), "Innebandy": ("innebandy",),
    "Ishockey": ("ishockey", "hockey"), "Bandy": ("bandy",), "Handboll": ("handboll",),
    "Basket": ("basket",), "Bowling": ("bowling",), "Golf": ("golf",),
    "Ridsport": ("ridning", "ridsport", "ridklubb", "ridskola"), "Motorsport": ("motorsport", "motorklubb"),
    "Orientering": ("orientering",), "Löpning": ("löpning", "friidrott"), "Friidrott": ("friidrott",),
    "Skidor": ("skidor", "skidåkning"), "Mountainbike": ("mountainbike", "mtb"), "Cykel": ("cykel",),
    "Tennis": ("tennis",), "Badminton": ("badminton",), "Bordtennis": ("bordtennis",),
    "Boule": ("boule",), "Kampsport": ("kampsport", "karate", "taekwondo", "ju-jutsu", "thaiboxning"),
    "Boxning": ("boxning",), "Judo": ("judo",), "Bågskytte": ("bågskytte",),
    "Simning": ("simning", "simidrott", "simsällskap"), "Gymnastik": ("gymnastik",),
    "Skytte": ("skytte", "skytteförening"), "Kanot": ("kanot",), "Travsport": ("travsport", "travsällskap"),
    "Sportfiske": ("sportfiske", "fiskeklubb"), "Båtsport": ("segling", "båtsport"),
}


def opener():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def get_text(url: str, client=None) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "DinPuls association importer/1.0"})
    open_request = client.open if client else urllib.request.urlopen
    for attempt in range(3):
        try:
            with open_request(request, timeout=45) as response:
                return response.read().decode("utf-8-sig", errors="replace")
        except Exception:
            if attempt == 2: raise
            time.sleep(2 * (attempt + 1))


def ibgo_rows(host: str, district: str) -> list[dict]:
    client = opener()
    get_text(f"{host}/AssociationRegister", client)
    params = {
        "sEcho": "1", "iColumns": "6", "sColumns": "Name,AssociationCategory,CustomerOccupations,WebSite,District,",
        "iDisplayStart": "0", "iDisplayLength": "1000", "iSortingCols": "1", "iSortCol_0": "0", "sSortDir_0": "asc",
        "mDataProp_0": "Name", "mDataProp_1": "AssociationCategoryName", "mDataProp_2": "CustomerOccupationsText",
        "mDataProp_3": "WebSite", "mDataProp_4": "DistrictName", "mDataProp_5": "", "SearchTerm": "",
        "DistrictId": district, "ActivityId": "", "AssociationCategoryId": "",
    }
    return json.loads(get_text(f"{host}/AssociationRegister/GetAssociationsList?{urllib.parse.urlencode(params)}", client))["aaData"]["Customers"]


def plain(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value or ""))).strip()


def website(value: str, fallback: str) -> str:
    match = re.search(r"href=['\"]([^'\"]+)", value or "", re.I)
    url = html.unescape(match.group(1) if match else plain(value))
    if url.startswith("//"): url = "https:" + url
    if url.startswith("www."): url = "https://" + url
    if url.startswith("http://"): url = "https://" + url[7:]
    return url if url.startswith("https://") else fallback


def sport_names(name: str, activity: str, category: str) -> list[str]:
    text = f"{name} {activity} {category}".lower()
    found = [sport for sport, words in SPORT_WORDS.items() if any(word in text for word in words)]
    return list(dict.fromkeys(found))


def leisure_meta(name: str, activity: str, category: str) -> tuple[str, str, list[str]]:
    text = f"{name} {activity} {category}".lower()
    tags = [part.strip() for part in re.split(r"[,;/]", plain(activity)) if part.strip()]
    if any(word in text for word in ("kör", "musik", "orkester", "spelman", "sång", "brass")):
        return "musik", "Musik, kör & scen", tags or ["musik"]
    if any(word in text for word in ("konst", "hantverk", "slöjd", "foto", "keramik", "skriv", "målning")):
        return "skapande", "Konst, hantverk & skapande", tags or ["skapande"]
    if any(word in text for word in ("spel", "gaming", "rollspel", "cosplay", "bridge", "schack")):
        return "spel", "Spel, gaming & sällskapsspel", tags or ["spel"]
    if any(word in text for word in ("hund", "brukshund", "kennel", "häst")):
        return "djur", "Djur, hund & häst", tags or ["djur"]
    if any(word in text for word in ("natur", "scout", "fiske", "viltvård", "jakt", "båt", "friluft", "biodl", "ornitolog", "botan")):
        return "natur", "Natur, scouter & friluftsliv", tags or ["natur"]
    if any(word in text for word in ("teater", "film", "litteratur", "kultur", "dans", "museum")):
        return "kultur", "Kultur, dans & berättande", tags or ["kultur"]
    if any(word in text for word in ("kyrk", "samfund", "församling", "religion", "mission", "equmenia", "pingst", "smyrna")):
        return "gemenskap", "Kyrkor, samfund & gemenskap", tags or ["kyrklig verksamhet"]
    return "gemenskap", "Föreningar & lokal gemenskap", tags or [plain(category) or "förening"]


def should_skip(name: str, category: str) -> bool:
    text = f"{name} {category}".lower()
    return any(word in text for word in SKIP) or "vägförening" in text


def add_registry_rows(municipality: str, rows: list[dict], leisure: list[dict], sports: list[dict]):
    fallback = DIRECTORIES[municipality]
    for row in rows:
        name = plain(row.get("Name", ""))
        category = plain(row.get("AssociationCategoryName", ""))
        activity = plain(row.get("CustomerOccupationsText", ""))
        if not name or should_skip(name, category): continue
        url = website(row.get("WebSite", ""), fallback)
        found_sports = sport_names(name, activity, category)
        is_sport = "idrott" in category.lower() or bool(found_sports)
        if is_sport:
            found_sports = found_sports or ["Övrig idrott"]
            sports.append({"name": name, "sports": found_sports, "url": url, "source": f"{municipality} föreningsregister"})
        else:
            cat, label, tags = leisure_meta(name, activity, category)
            leisure.append({"name": name, "category": cat, "categoryLabel": label, "tags": tags, "type": "Förening", "url": url})


def mellerud_rows() -> tuple[list[dict], list[dict]]:
    leisure, sports = [], []
    base = DIRECTORIES["Mellerud"]
    pages = [(kind, f"{base}{slug}/") for kind, slug in MELLERUD_PAGES.items()]
    with ThreadPoolExecutor(max_workers=8) as pool:
        bodies = list(pool.map(get_text, [url for _, url in pages]))
    for (kind, url), body in zip(pages, bodies):
        content = body.split('<div class="col-sm-9">', 1)[-1].split('<div class="row">\n    <div class="col text-center', 1)[0]
        names = []
        for raw in re.findall(r"<strong>(.*?)</strong>", content, re.I | re.S):
            name = plain(raw).strip(" :-")
            if name in {"SMU)", "SMU", "f.d. SMU)"}: continue
            if name and len(name) > 2 and name.lower() not in {n.lower() for n in names}: names.append(name)
        for name in names:
            if should_skip(name, kind): continue
            found = sport_names(name, kind, kind)
            if kind == "sport" and found:
                sports.append({"name": name, "sports": found, "url": url, "source": "Melleruds föreningsregister"})
            elif kind != "sport":
                hint = {"kyrka":"kyrklig verksamhet", "natur":"natur", "kultur":"kultur", "studie":"studieverksamhet"}.get(kind, kind)
                cat, label, tags = leisure_meta(name, hint, kind)
                leisure.append({"name": name, "category": cat, "categoryLabel": label, "tags": tags, "type": "Förening", "url": url})
    return leisure, sports


def grums_rows() -> tuple[list[dict], list[dict]]:
    leisure, sports, seen = [], [], set()
    base = "https://business.updatesystem.se/ifgrums/"
    urls = [f"{base}search-char?{urllib.parse.urlencode({'chr': letter})}" for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ"]
    with ThreadPoolExecutor(max_workers=8) as pool:
      bodies = list(pool.map(get_text, urls))
    for body in bodies:
        pattern = r'href="company-details/(\d+)">([^<]+)</a></h4>.*?Label1_\d+">(.*?)</span>'
        for ident, raw_name, raw_desc in re.findall(pattern, body, re.I | re.S):
            name, activity = plain(raw_name), plain(raw_desc)
            if not name or name.casefold() in seen or should_skip(name, activity): continue
            seen.add(name.casefold())
            url = f"{base}company-details/{ident}"
            found = sport_names(name, activity, "")
            if found:
                sports.append({"name": name, "sports": found, "url": url, "source": "Grums föreningsregister"})
            else:
                cat, label, tags = leisure_meta(name, activity, "")
                leisure.append({"name": name, "category": cat, "categoryLabel": label, "tags": tags, "type": "Förening", "url": url})
    return leisure, sports


def dedupe(items: list[dict], manual: list[dict], municipality: str) -> list[dict]:
    def key_for(name):
        key = re.sub(r"[^a-zåäö0-9]", "", name.casefold())
        key = key.replace("brukshundsklubb", "brukshundklubb").replace("forening", "förening")
        aliases = {
            "eritreanskakulturföreningen":"eritreanskakulturförening",
            "eritreanskkulturföreningiarvika":"eritreanskakulturföreningiarvika",
            "bygdegårdsföreningenvärmskog":"bygdegårdsföreningvärmskog",
            "segmomshembygdsförening":"segmonshembygdsförening",
            "spfseniorergrumsbyggden":"spfseniorernagrumsbygden",
        }
        return aliases.get(key, key)
    merged = {key_for(item["name"]): item for item in items}
    for item in manual:
        key = key_for(item["name"])
        if key in merged:
            generated = merged[key]
            if generated.get("tags"):
                item = dict(item, tags=list(dict.fromkeys(item.get("tags", []) + generated["tags"])))
        merged[key] = item
    for item in merged.values():
        direct_url = LINK_OVERRIDES.get(f"{municipality}|{item['name']}") or DIRECT_LINKS.get(item["name"])
        if direct_url:
            item["url"] = direct_url
            if "source" in item:
                item["source"] = "Föreningens egen sida"
    return sorted(merged.values(), key=lambda item: item["name"].casefold())


def main():
    def curated(name):
        path = ROOT / "data" / f"{name}-curated.json"
        if not path.exists():
            content = subprocess.check_output(["git", "show", f"HEAD:data/{name}.json"], cwd=ROOT, text=True)
            path.write_text(content, encoding="utf-8")
        return json.loads(path.read_text(encoding="utf-8"))
    old_leisure = curated("leisure")
    old_sports = curated("sports")
    leisure_by = {name: [] for name in MUNICIPALITIES}
    sports_by = {name: [] for name in MUNICIPALITIES}
    registry_jobs = [(municipality, host, district) for municipality, (host, district) in IBGO.items()]
    with ThreadPoolExecutor(max_workers=5) as pool:
        registry_rows = list(pool.map(lambda job: ibgo_rows(job[1], job[2]), registry_jobs))
    for (municipality, _, _), rows in zip(registry_jobs, registry_rows):
        add_registry_rows(municipality, rows, leisure_by[municipality], sports_by[municipality])
    leisure_by["Mellerud"], sports_by["Mellerud"] = mellerud_rows()
    leisure_by["Grums"], sports_by["Grums"] = grums_rows()
    output_leisure = {"version":"2.0.0", "updatedAt":datetime.now(timezone.utc).date().isoformat(),
        "notice":"Lokalt föreningsregister importerat från kommunernas offentliga register och kompletterat med direkta föreningslänkar.", "municipalities":{}}
    for name in MUNICIPALITIES:
        for extra_name, category, label, url in EXTRA_LEISURE.get(name, []):
            leisure_by[name].append({"name":extra_name, "category":category, "categoryLabel":label,
                "tags":[label, "kyrka", "musik" if category == "musik" else "gemenskap"], "type":"Fritidsverksamhet", "url":url})
        manual_leisure = old_leisure["municipalities"][name]["activities"]
        output_leisure["municipalities"][name] = {"directoryUrl":DIRECTORIES[name], "activities":dedupe(leisure_by[name], manual_leisure, name)}
        manual_sports = old_sports["municipalities"][name]["clubs"]
        old_sports["municipalities"][name]["clubs"] = dedupe(sports_by[name], manual_sports, name)
    old_sports["generatedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    (ROOT / "data/leisure.json").write_text(json.dumps(output_leisure, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "data/sports.json").write_text(json.dumps(old_sports, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Fritid:", sum(len(v["activities"]) for v in output_leisure["municipalities"].values()))
    print("Idrott:", sum(len(v["clubs"]) for v in old_sports["municipalities"].values()))
    for name in MUNICIPALITIES:
        print(f"{name}: {len(output_leisure['municipalities'][name]['activities'])} fritid, {len(old_sports['municipalities'][name]['clubs'])} idrott")


if __name__ == "__main__":
    main()
