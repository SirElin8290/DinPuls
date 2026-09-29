#!/usr/bin/env python3
"""Hämtar verifierbara veckomenyer från restaurangernas egna sidor."""
from __future__ import annotations

import html
import json
import re
import sys
import time
from datetime import date, datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "data" / "lunch-sources.json"
LAUNCH_SUPPLEMENT = ROOT / "data" / "lunch-launch-supplement.json"
HAMMARO_SUPPLEMENT = ROOT / "data" / "lunch-hammaro-supplement.json"
HAGFORS_SUPPLEMENT = ROOT / "data" / "lunch-hagfors-supplement.json"
TORSBY_SUPPLEMENT = ROOT / "data" / "lunch-torsby-supplement.json"
OUTPUT = ROOT / "data" / "lunch.json"
TIMEZONE = ZoneInfo("Europe/Stockholm")
USER_AGENT = "DinPuls/0.21.2 (+https://sirelin8290.github.io/DinPuls/)"
EXPECTED_MUNICIPALITIES = {item["name"] for item in json.loads((ROOT / "data" / "municipalities.json").read_text(encoding="utf-8"))["municipalities"]}
DAYS = {"måndag":"monday","mandag":"monday","tisdag":"tuesday","onsdag":"wednesday","torsdag":"thursday","fredag":"friday","lördag":"saturday","lordag":"saturday","söndag":"sunday","sondag":"sunday"}
STOP_MARKERS = ("veckans vegetariska","sallader","lunchpriser","öppettider","kontakt","pris ","priser","barn ","utkörningsservice","ta kontakt","catering","ring oss","galleri","adress","bordsbokning","öppet för","veckans meny","inkl.","sommarerbjudanden","ladda ner","med goda drycker","övrigt","lördagslunch","veckans burgare","veckans pasta","ta en titt på vår meny","kunden har alltid rätt","det här tycker våra kunder")
NON_DISH_LINES = {"stängt","lunchbuffé","lunchbuffe","helgbuffé","dagens lunch","veckans lunch","måltidsdryck","kaffe & kaka","dessert","ingen dagens","ingen dagens."}

class TextExtractor(HTMLParser):
    def __init__(self): super().__init__(); self.lines=[]; self.blocked=0
    def handle_starttag(self, tag, attrs):
        if tag in {"script","style","noscript","svg"}: self.blocked += 1
        if not self.blocked and tag in {"p","div","li","h1","h2","h3","h4","br"}: self.lines.append("\n")
    def handle_endtag(self, tag):
        if tag in {"script","style","noscript","svg"} and self.blocked: self.blocked -= 1
        if not self.blocked and tag in {"p","div","li","h1","h2","h3","h4"}: self.lines.append("\n")
    def handle_data(self, data):
        if not self.blocked: self.lines.append(data)
    def text_lines(self):
        text=html.unescape("".join(self.lines)); return [re.sub(r"\s+"," ",line).strip(" \t–—|") for line in text.splitlines() if re.sub(r"\s+"," ",line).strip(" \t–—|")]

def fetch(url):
    last_error="okänt hämtningsfel"
    for attempt in range(3):
        request=Request(url,headers={"User-Agent":USER_AGENT,"Accept":"text/html"})
        try:
            with urlopen(request,timeout=30) as response: return response.read().decode(response.headers.get_content_charset() or "utf-8",errors="replace")
        except HTTPError as error:
            last_error=f"HTTP {error.code}"
            if error.code < 500: break
        except URLError as error: last_error=str(error.reason)
        except TimeoutError: last_error="timeout"
        if attempt < 2: time.sleep(2 ** attempt)
    raise RuntimeError(last_error)

def fetch_source(source, fetcher=fetch):
    page=fetcher(source.get("dataUrl") or source["url"])
    if source.get("dataFormat") != "wordpress-page": return page
    try:
        payload=json.loads(page); rendered=payload[0]["content"]["rendered"]
        if not isinstance(rendered,str) or not rendered.strip(): raise ValueError
        return rendered
    except (IndexError,KeyError,TypeError,ValueError,json.JSONDecodeError): raise RuntimeError("ogiltigt WordPress-svar") from None

def extract_week(lines):
    for line in lines:
        match=re.search(r"(?:vecka|v\.)\s*(\d{1,2})",line,re.I)
        if match: return int(match.group(1))
    return None

def weekday_key(line):
    normalized=line.lower().strip(" .:-")
    for swedish,english in DAYS.items():
        if re.fullmatch(rf"{re.escape(swedish)}(?:\s+\d{{1,2}}(?:[/.]\d{{1,2}})?)?",normalized): return english
    return None

def useful_dish(line):
    lowered=line.lower()
    if len(line)<5 or len(line)>240 or any(lowered.startswith(marker) for marker in STOP_MARKERS) or lowered in NON_DISH_LINES or re.fullmatch(r"stängt\.?",lowered): return False
    if re.fullmatch(r"\d+\s*(?::-|kr|kronor)?",lowered) or re.fullmatch(r"\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}",lowered): return False
    if re.search(r"(telefon|^\d{3,5}\s*[- ]\s*\d{2,}|\d{3}\s\d{2}\s+\D)",lowered): return False
    if re.fullmatch(r"(meny|hem|lunchmeny|dagens lunch|veckans lunchbuffé)",lowered): return False
    return True

def parse_weekday_menu(page, stop_after_pattern=None):
    parser=TextExtractor(); parser.feed(page); lines=parser.text_lines(); menu={key:[] for key in DAYS.values()}; active=None; seen_days=set()
    for line in lines:
        if stop_after_pattern and re.search(stop_after_pattern,line,re.I): break
        inline=re.match(r"^(måndag|mandag|tisdag|onsdag|torsdag|fredag|lördag|lordag|söndag|sondag)\s*(?:\d{1,2}(?:[/.]\d{1,2})?)?\s*:\s*(.+)$",line,re.I)
        day=DAYS[inline.group(1).lower()] if inline else weekday_key(line)
        if day:
            if day in seen_days: break
            seen_days.add(day); active=day
            if not inline: continue
            line=inline.group(2).strip()
        if active and any(line.lower().startswith(marker) for marker in STOP_MARKERS): active=None; continue
        if active and useful_dish(line) and len(menu[active])<5: menu[active].append(line)
    return extract_week(lines),menu

def parse_scoped_weekday_menu(page, heading, expected_week):
    """Läser endast den namngivna restaurangens sektion och exakt efterfrågad vecka."""
    parser=TextExtractor(); parser.feed(page); lines=parser.text_lines()
    marker=re.compile(heading,re.I); week_marker=re.compile(r"(?:vecka|v\.)\s*(\d{1,2})",re.I); start=None
    for index,line in enumerate(lines):
        match=week_marker.search(line)
        if marker.search(line) and match and int(match.group(1))==expected_week: start=index; break
    if start is None: return None,{key:[] for key in DAYS.values()}
    end=len(lines)
    for index in range(start+1,len(lines)):
        if week_marker.search(lines[index]) or re.match(r"(?:Sjukhuset|Vårdcentralen)\s+",lines[index],re.I): end=index; break
    return parse_weekday_menu("\n".join(lines[start:end]))

MONTHS={"jan":1,"januari":1,"feb":2,"februari":2,"mar":3,"mars":3,"apr":4,"april":4,"maj":5,"jun":6,"juni":6,"jul":7,"juli":7,"aug":8,"augusti":8,"sep":9,"sept":9,"september":9,"okt":10,"oktober":10,"nov":11,"november":11,"dec":12,"december":12}

def parse_dated_weekday_menu(page, today):
    """Väljer bara menysektionen vars publicerade datumintervall innehåller dagens datum."""
    parser=TextExtractor(); parser.feed(page); lines=parser.text_lines(); heading=re.compile(r"lunchmeny\s+(\d{1,2})\s+([a-zåäö]+)\s*[-–]\s*(\d{1,2})(?:\s+([a-zåäö]+))?",re.I); candidates=[]
    for index,line in enumerate(lines):
        match=heading.search(line)
        if not match: continue
        start_month=MONTHS.get(match.group(2).lower().rstrip(".")); end_month=MONTHS.get((match.group(4) or match.group(2)).lower().rstrip("."))
        if not start_month or not end_month: continue
        start_year=today.year; end_year=today.year
        if end_month < start_month:
            if today.month <= end_month: start_year-=1
            else: end_year+=1
        try: start_date=date(start_year,start_month,int(match.group(1))); end_date=date(end_year,end_month,int(match.group(3)))
        except ValueError: continue
        candidates.append((index,start_date,end_date))
    current_week=today.isocalendar()[:2]
    selected=next((entry for entry in candidates if entry[1].isocalendar()[:2] == current_week or entry[2].isocalendar()[:2] == current_week),None)
    if selected is None: return None,{key:[] for key in DAYS.values()}
    index,start_date,_end_date=selected; following=[entry[0] for entry in candidates if entry[0]>index]; end=min(following) if following else len(lines)
    _unused,days=parse_weekday_menu("\n".join(lines[index:end]))
    return start_date.isocalendar().week,days

def parse_lunchsidan_restaurant(page, expected_name, expected_address, remove_prefixes=None):
    """Tolkar en restaurangsida hos Lunchsidan efter hård identitets- och veckokontroll."""
    parser=TextExtractor(); parser.feed(page); lines=parser.text_lines()
    if not any(re.search(expected_name,line,re.I) for line in lines[:8]): raise RuntimeError("Lunchsidan: fel restaurang")
    if not any(expected_address.casefold() in line.casefold() for line in lines[:10]): raise RuntimeError("Lunchsidan: fel adress")
    updated=next((line for line in lines if line.lower().startswith("uppdaterad:")),None)
    week=extract_week([updated]) if updated else None
    if week is None: raise RuntimeError("Lunchsidan: veckonummer saknas")
    menu={key:[] for key in DAYS.values()}; active=None; started=False
    for line in lines:
        inline=re.match(r"^(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)\s+(.+)$",line,re.I)
        if inline:
            active=DAYS[inline.group(1).lower()]; started=True; line=inline.group(2).strip()
        elif started and (line.lower() in {"hitta hit","saknar du en restaurang?"} or line.lower().startswith("öppna i google maps")): break
        elif not started: continue
        for prefix in remove_prefixes or []: line=re.sub(rf"^{prefix}\s*", "", line, flags=re.I)
        if active and useful_dish(line) and len(menu[active])<5: menu[active].append(line)
    return week,menu

def parse_lunchsidan_place_restaurant(page, expected_name, expected_address, remove_prefixes=None):
    """Avgränsar en restaurang på en Lunchsidan-ortsida innan den vanliga parsern körs."""
    heading=re.compile(r"<(h[1-4])\b[^>]*>\s*(?:<[^>]+>\s*)*([^<]*?)\s*(?:</[^>]+>\s*)*</\1>",re.I|re.S)
    matches=list(heading.finditer(page))
    selected=None
    for index,match in enumerate(matches):
        title=html.unescape(re.sub(r"\s+"," ",match.group(2))).strip()
        if re.search(expected_name,title,re.I):
            end=matches[index+1].start() if index+1<len(matches) else len(page)
            selected=page[match.start():end]
            break
    if selected is None: raise RuntimeError("Lunchsidan: restaurangsektion saknas")
    return parse_lunchsidan_restaurant(selected,expected_name,expected_address,remove_prefixes)

def parse_all_days_menu(page):
    parser=TextExtractor(); parser.feed(page); lines=parser.text_lines(); dishes=[]; active=False
    for line in lines:
        normalized=line.lower().strip(" .:-")
        if "alla dagar" in normalized: active=True; continue
        if active and (weekday_key(line) or any(normalized.startswith(marker) for marker in STOP_MARKERS)): break
        if active and useful_dish(line) and len(dishes)<5: dishes.append(line)
    return extract_week(lines),{day:list(dishes) for day in ("monday","tuesday","wednesday","thursday","friday")}

def merge_config(config):
    municipalities=config.setdefault("municipalities",{}); references=config.setdefault("referenceSources",{})
    for supplement_path in (LAUNCH_SUPPLEMENT,HAMMARO_SUPPLEMENT,HAGFORS_SUPPLEMENT,TORSBY_SUPPLEMENT):
        if not supplement_path.exists(): continue
        supplement=json.loads(supplement_path.read_text(encoding="utf-8")); supplement_municipalities=supplement.get("municipalities") or {}
        if supplement_path == HAGFORS_SUPPLEMENT and supplement.get("restaurants"): supplement_municipalities={"Hagfors":supplement["restaurants"]}
        for name,sources in supplement_municipalities.items():
            current=municipalities.setdefault(name,[]); by_id={str(item.get("id")):index for index,item in enumerate(current) if isinstance(item,dict)}
            for item in sources:
                if not isinstance(item,dict): continue
                source_id=str(item.get("id"))
                if source_id in by_id: current[by_id[source_id]]={**current[by_id[source_id]],**item}
                else: by_id[source_id]=len(current); current.append(item)
        for name,sources in (supplement.get("referenceSources") or {}).items():
            current=references.setdefault(name,[]); seen={str(item.get("url")) for item in current if isinstance(item,dict)}; current.extend(item for item in sources if isinstance(item,dict) and str(item.get("url")) not in seen)
    return config

def validate_config(config):
    municipalities=config.get("municipalities",{}); missing=EXPECTED_MUNICIPALITIES-set(municipalities)
    if missing: raise ValueError(f"Kommuner saknas: {', '.join(sorted(missing))}")
    seen=set()
    for municipality,sources in municipalities.items():
        for source in sources:
            source_id=source.get("id")
            if not source_id or source_id in seen: raise ValueError(f"Saknat eller dubblerat restaurang-id: {source_id!r} ({municipality})")
            if not source.get("name") or not source.get("url"): raise ValueError(f"Ofullständig restaurangkälla: {source_id}")
            seen.add(source_id)

def build_output(config,now,fetcher=fetch,previous_output=None):
    config=merge_config(config); validate_config(config); current_week=now.isocalendar().week; municipalities={}
    previous_by_id={item.get("id"):item for row in ((previous_output or {}).get("municipalities") or {}).values() for item in (row.get("restaurants") or []) if isinstance(item,dict)}
    for municipality,sources in config.get("municipalities",{}).items():
        restaurants=[]
        for source in sources:
            if source.get("active") is False: continue
            item={**source,"checkedAt":now.isoformat(timespec="seconds"),"weekNumber":None,"days":{},"status":"reference","mode":"reference"}
            if source.get("nameAfter") and source.get("nameAfterDate") and now.date() >= date.fromisoformat(source["nameAfterDate"]): item["name"]=source["nameAfter"]
            parser_name=source.get("parser")
            if parser_name in {"weekday-headings","all-days-heading","scoped-weekday-headings","dated-weekday-headings","lunchsidan-restaurant","lunchsidan-place-restaurant"}:
                try:
                    page=fetch_source(source,fetcher)
                    if parser_name=="all-days-heading":
                        week,days=parse_all_days_menu(page)
                        if any(days.values()): week=current_week
                    elif parser_name=="scoped-weekday-headings": week,days=parse_scoped_weekday_menu(page,source["headingPattern"],current_week)
                    elif parser_name=="dated-weekday-headings": week,days=parse_dated_weekday_menu(page,now.date())
                    elif parser_name=="lunchsidan-restaurant": week,days=parse_lunchsidan_restaurant(page,source["expectedNamePattern"],source["expectedAddress"],source.get("removePrefixes"))
                    elif parser_name=="lunchsidan-place-restaurant": week,days=parse_lunchsidan_place_restaurant(page,source["expectedNamePattern"],source["expectedAddress"],source.get("removePrefixes"))
                    else: week,days=parse_weekday_menu(page,source.get("stopAfterPattern"))
                    if source.get("dishSplitPattern"):
                        days={day:[part.strip() for dish in dishes for part in re.split(source["dishSplitPattern"],dish) if part.strip()] for day,dishes in days.items()}
                    if source.get("id")=="mickans-grill": days={day:[dish for dish in dishes if dish!="$9.95"] for day,dishes in days.items()}
                    item["weekNumber"]=week; item["days"]=days if week==current_week else {}; item["status"]="current" if week==current_week and any(days.values()) else "outdated"; item["mode"]="automatic"
                except RuntimeError as error:
                    item["status"]="unavailable"; item["mode"]="reference" if source.get("fallbackMode")=="reference" else "automatic"; item["error"]=str(error)
            if source.get("seasonal"):
                item["seasonal"]=True
                season_months=source.get("seasonMonths") or []
                season_start=source.get("seasonStart"); season_end=source.get("seasonEnd")
                if parser_name=="source-only" and season_start and season_end:
                    current_mmdd=now.strftime("%m-%d")
                    item["status"]="active" if season_start <= current_mmdd <= season_end else "seasonally_closed"
                elif parser_name=="source-only": item["status"]="active" if now.month in season_months else "seasonally_closed"
            previous=previous_by_id.get(source.get("id"))
            if item["status"] != "current" and previous and previous.get("status") == "current" and any((previous.get("days") or {}).values()):
                item["lastSuccessfulMenu"]={"weekNumber":previous.get("weekNumber"),"checkedAt":previous.get("checkedAt"),"days":previous.get("days")}
            restaurants.append(item)
        municipalities[municipality]={"restaurants":restaurants,"referenceSources":config.get("referenceSources",{}).get(municipality,[])}
    return {"version":"0.21.4","generatedAt":now.isoformat(timespec="seconds"),"timezone":"Europe/Stockholm","currentWeek":current_week,"principle":"Exakta rätter visas bara när rätt vecka kan verifieras hos restaurangens originalkälla.","municipalities":municipalities}

def main():
    config=json.loads(SOURCES.read_text(encoding="utf-8")); now=datetime.now(TIMEZONE)
    previous=json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else None
    output=build_output(config,now,previous_output=previous)
    for municipality,entry in output["municipalities"].items():
        for item in entry["restaurants"]: print(f"{municipality}: {item['name']} – {item['status']}")
    OUTPUT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); return 0

if __name__=="__main__": sys.exit(main())
