"""Uppdatera verifierad skolmat via gemensamma kommunadaptrar."""
from __future__ import annotations
import html, io, json, re, urllib.parse, urllib.request
from datetime import datetime
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from pypdf import PdfReader
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]; OUTPUT=ROOT/"data"/"school-family.json"
LANDING="https://amal.se/barn-och-utbildning/skolmatsedel"
GROUPS={"grundskola":"Grundskolan","hogstadiet":"Högstadiet","gymnasiet":"Gymnasiet"}
UA="DinPuls.se school-meals/1.0 kontakt@dinpuls.se"
SKOLMATEN_FEEDS={"Sunne":"https://skolmaten.se/api/4/rss/week/fryxellska-skolan?locale=sv","Forshaga":"https://skolmaten.se/api/4/rss/week/skolrestaurangen?locale=sv","Munkfors":"https://skolmaten.se/api/4/rss/week/forsnasskolan?locale=sv","Kil":"https://skolmaten.se/api/4/rss/week/bodaskolan?locale=sv","Torsby":"https://skolmaten.se/api/4/rss/week/frykenskolan?locale=sv","Filipstad":"https://skolmaten.se/api/4/rss/week/ferlinskolan?locale=sv"}
MATILDA_FEEDS={"Grums":"https://menu.matildaplatform.com/rss?displayMode=Week&distributorId=697a13a9e2d237d90a0ef1c2&lang=sv","Säffle":"https://menu.matildaplatform.com/rss?displayMode=Week&distributorId=67e56c4dea58e3e60c0252ff&lang=sv","Bengtsfors":"https://menu.matildaplatform.com/rss?displayMode=Week&distributorId=67e5697dea58e3e60c01eb09&lang=sv","Dals-Ed":"https://menu.matildaplatform.com/rss?displayMode=Week&distributorId=67c6fbe101a159adbb34f493&lang=sv","Mellerud":"https://menu.matildaplatform.com/rss?displayMode=Week&distributorId=6903135ebf545da84ec65723&lang=sv","Karlstad":"https://menu.matildaplatform.com/rss?displayMode=Week&distributorId=66b5f62340606243475f1ee4&lang=sv","Kristinehamn":"https://menu.matildaplatform.com/rss?displayMode=Week&distributorId=6973315ae2d237d90a0e78f9&lang=sv","Storfors":"https://menu.matildaplatform.com/rss?displayMode=Week&distributorId=6915ba8d47724ef16fb9805a&lang=sv","Årjäng":"https://menu.matildaplatform.com/rss?displayMode=Week&distributorId=689e013846b8c35286d63ebc&lang=sv","Färgelanda":"https://menu.matildaplatform.com/rss?displayMode=Week&distributorId=67e56c6dea58e3e60c0259e8&lang=sv"}
HTML_MENUS={
    "Eda": "https://eda.se/skolmat/matsedel-f%C3%B6r-edas-skolrestauranger__685",

}
DAY_RE=re.compile(r"^(Måndag|Tisdag|Onsdag|Torsdag|Fredag)\s+(\d{1,2})/(\d{1,2})$")
STOP={"Lunch","Green","Classic","Enjoy"}

def fetch(url:str)->bytes:
    request=urllib.request.Request(url,headers={"User-Agent":UA})
    with urllib.request.urlopen(request,timeout=30) as response:return response.read()

def menu_links(markup:str)->dict[str,str]:
    found={}
    for href,body in re.findall(r'<a[^>]+href="([^"]+\.pdf)"[^>]*>(.*?)</a>',markup,re.I|re.S):
        label=html.unescape(re.sub(r"<[^>]+>"," ",body)); label=" ".join(label.split())
        for key,title in GROUPS.items():
            if title.casefold() in label.casefold() and key not in found:found[key]=urllib.parse.urljoin(LANDING,html.unescape(href))
    missing=set(GROUPS)-set(found)
    if missing:raise RuntimeError(f"Meny-PDF saknas för: {', '.join(sorted(missing))}")
    return found

def clean_parts(parts:list[str])->str:
    useful=[]
    for part in parts:
        value=" ".join(part.replace("\x02"," ").split())
        if not value or value in {"CO2","ekv."} or re.fullmatch(r"\d+(?:,\d+)?",value) or value.startswith("Sida:"):continue
        useful.append(value)
    return re.sub(r"\s+20\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?\s*$", "", " ".join(useful)).strip()

def parse_pdf(content:bytes,group:str,url:str)->list[dict]:
    reader=PdfReader(io.BytesIO(content)); meals=[]
    for page in reader.pages:
        lines=[" ".join(line.split()) for line in (page.extract_text() or "").splitlines() if line.strip()]
        year_match=re.search(r"20\d{2}"," ".join(lines[:12])); year=int(year_match.group()) if year_match else datetime.now().year
        index=0
        while index<len(lines):
            match=DAY_RE.match(lines[index])
            if not match:index+=1;continue
            day,month=map(int,match.groups()[1:]); date=f"{year:04d}-{month:02d}-{day:02d}"; index+=1; options=[]
            while index<len(lines) and not DAY_RE.match(lines[index]):
                label=lines[index]
                if label in {"Green","Classic","Enjoy"}:
                    index+=1; parts=[]
                    while index<len(lines) and lines[index] not in STOP and not DAY_RE.match(lines[index]):parts.append(lines[index]);index+=1
                    meal=clean_parts(parts)
                    if meal:options.append({"label":label,"meal":meal})
                else:index+=1
            if options:meals.append({"municipality":"Åmål","schoolGroup":group,"date":date,"options":options,"notes":[],"source":url,"updatedAt":datetime.now().astimezone().isoformat(timespec="seconds")})
    return meals


def clean_meal_text(value:str)->str:
    value=re.sub(r"https?://\S+", "", value)
    value=re.sub(r"(?:Symboler|Uppdaterad|Publicerad):.*?(?=\n\n|$)", "", value, flags=re.I|re.S)
    value=re.sub(r"\b20\d{2}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?\b", "", value)
    return " ".join(value.split()).strip(" -")

def parse_matilda_rss(content:bytes,municipality:str,group:str,url:str)->list[dict]:
    months={"januari":1,"februari":2,"mars":3,"april":4,"maj":5,"juni":6,"juli":7,"augusti":8,"september":9,"oktober":10,"november":11,"december":12}
    meals=[]
    for node in ET.fromstring(content).findall("./channel/item"):
        title=node.findtext("title",""); match=re.search(r"(\d{1,2})\s+([a-zåäö]+),\s*(20\d{2})",title,re.I)
        if not match: continue
        day,month,year=int(match.group(1)),months.get(match.group(2).casefold()),int(match.group(3))
        if not month: continue
        description=node.findtext("description",""); options=[]
        for label,meal in re.findall(r"(?:^|\n\n)([^:\n]+):\s*(.*?)(?=\n\n[^:\n]+:|$)",description,re.S):
            cleaned=clean_meal_text(meal)
            if cleaned and not label.casefold().startswith("symboler"): options.append({"label":clean_meal_text(label),"meal":cleaned})
        if not options:
            options=[{"label":f"Alternativ {index+1}","meal":clean_meal_text(part)} for index,part in enumerate(re.split(r"\n\s*\n",description)) if clean_meal_text(part)]
        if options: meals.append({"municipality":municipality,"schoolGroup":group,"date":f"{year:04d}-{month:02d}-{day:02d}","options":options,"notes":[],"source":url,"updatedAt":datetime.now().astimezone().isoformat(timespec="seconds")})
    return meals
def parse_skolmaten_rss(content:bytes,municipality:str,group:str,url:str)->list[dict]:
    meals=[]
    for node in ET.fromstring(content).findall("./channel/item"):
        try: date=parsedate_to_datetime(node.findtext("pubDate","")).date().isoformat()
        except (TypeError,ValueError): continue
        raw=node.findtext("description",""); parts=[clean_meal_text(part) for part in re.split(r"\n+|<br\s*/?>",raw,flags=re.I)]
        options=[{"label":f"Alternativ {index+1}","meal":part} for index,part in enumerate(filter(None,parts))]
        if options: meals.append({"municipality":municipality,"schoolGroup":group,"date":date,"options":options,"notes":[],"source":url,"updatedAt":datetime.now().astimezone().isoformat(timespec="seconds")})
    return meals

class TextLines(HTMLParser):
    def __init__(self):
        super().__init__(); self.lines=[]; self.current=[]
    def handle_data(self,data):
        value=" ".join(html.unescape(data).split())
        if value:self.current.append(value)
    def handle_endtag(self,tag):
        if tag in {"h1","h2","h3","h4","p","li","div","br"} and self.current:
            self.lines.append(" ".join(self.current)); self.current=[]

def html_lines(content:bytes)->list[str]:
    parser=TextLines(); parser.feed(content.decode("utf-8","replace"));
    if parser.current:parser.lines.append(" ".join(parser.current))
    return parser.lines

def meal_record(municipality:str,group:str,date:str,meal:str,url:str)->dict:
    return {"municipality":municipality,"schoolGroup":group,"date":date,"options":[{"label":"Dagens lunch","meal":clean_meal_text(meal)}],"notes":[],"source":url,"updatedAt":datetime.now().astimezone().isoformat(timespec="seconds")}

def parse_eda_html(content:bytes,url:str)->list[dict]:
    meals=[]; weekdays={"måndag":1,"tisdag":2,"onsdag":3,"torsdag":4,"fredag":5}
    for line in html_lines(content):
        match=re.match(r"Vecka\s+(\d{1,2})\b",line,re.I)
        if not match:continue
        week=int(match.group(1))
        for day,meal in re.findall(r"(måndag|tisdag|onsdag|torsdag|fredag):\s*(.*?)(?=\s+(?:måndag|tisdag|onsdag|torsdag|fredag):|$)",line,re.I):
            date=datetime.fromisocalendar(datetime.now().year,week,weekdays[day.casefold()]).date().isoformat()
            meals.append(meal_record("Eda","alla",date,meal,url))
    return meals

def parse_filipstad_html(content:bytes,url:str)->list[dict]:
    group=None; pending=None; meals=[]; weekdays={"måndag":1,"tisdag":2,"onsdag":3,"torsdag":4,"fredag":5}
    for line in html_lines(content):
        group_match=re.search(r"Matsedel\s+(Filipstad|Lesjöfors)\b",line,re.I)
        if group_match:group=group_match.group(1).casefold();continue
        day_match=re.match(r"(Måndag|Tisdag|Onsdag|Torsdag|Fredag)\s*-\s*Vecka\s+(\d{1,2})",line,re.I)
        if day_match and group:
            pending=(datetime.fromisocalendar(datetime.now().year,int(day_match.group(2)),weekdays[day_match.group(1).casefold()]).date().isoformat(),group)
            continue
        if pending and not re.match(r"^(Matsedel|Följande|Med reservation|Varje dag)",line,re.I):
            meals.append(meal_record("Filipstad",pending[1],pending[0],line,url));pending=None
    return meals
def main()->None:
    payload=json.loads(OUTPUT.read_text(encoding="utf-8")); meals=[]
    try:
        markup=fetch(LANDING).decode("utf-8","replace"); links=menu_links(markup)
        for group,url in links.items():meals.extend(parse_pdf(fetch(url),group,url))
        if len(meals)<15:raise RuntimeError(f"Orimligt få menydagar: {len(meals)}")
        amal=payload["municipalities"]["Åmål"]; amal["meals"]=sorted(meals,key=lambda item:(item["date"],item["schoolGroup"])); amal["mealSource"]["verifiedAt"]=datetime.now().date().isoformat(); amal["mealSource"]["documents"]=links
    except Exception as error:
        print(f"VARNING Åmål: behåller senast verifierade data ({error})")
    for municipality,feed in MATILDA_FEEDS.items():
        target=payload["municipalities"].get(municipality)
        try:current=parse_matilda_rss(fetch(feed),municipality,"alla",feed)
        except Exception as error:
            print(f"VARNING {municipality}: behåller senast verifierade data ({error})");continue
        if len(current)<5:
            target["mealSource"]["status"]="BLOCKED"; target["mealSource"]["reason"]=f"Källan gav {len(current)} giltiga menydagar"; continue
        target["meals"]=current; target["mealSource"]["status"]="PASS"; target["mealSource"]["verifiedAt"]=datetime.now().date().isoformat(); target["mealSource"]["feed"]=feed
    for municipality,feed in SKOLMATEN_FEEDS.items():
        target=payload["municipalities"].get(municipality)
        try:current=parse_skolmaten_rss(fetch(feed),municipality,"alla",feed)
        except Exception as error:
            print(f"VARNING {municipality}: behåller senast verifierade data ({error})");continue
        if len(current)<5:
            target["mealSource"]["status"]="BLOCKED"; target["mealSource"]["reason"]=f"Källan gav {len(current)} giltiga menydagar"; continue
        target["meals"]=current; target["mealSource"]["status"]="PASS"; target["mealSource"]["verifiedAt"]=datetime.now().date().isoformat(); target["mealSource"]["feed"]=feed
    for municipality,url in HTML_MENUS.items():
        target=payload["municipalities"].get(municipality)
        try:current=(parse_eda_html if municipality=="Eda" else parse_filipstad_html)(fetch(url),url)
        except Exception as error:
            print(f"VARNING {municipality}: behåller senast verifierade data ({error})");continue
        if len(current)<5:
            target["mealSource"]["status"]="BLOCKED"; target["mealSource"]["reason"]=f"Officiella sidan gav {len(current)} giltiga menydagar"; continue
        target["meals"]=current; target["mealSource"]["status"]="PASS"; target["mealSource"]["verifiedAt"]=datetime.now().date().isoformat(); target["mealSource"]["page"]=url
    payload["generatedAt"]=datetime.now().astimezone().isoformat(timespec="seconds")
    OUTPUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); print(f"Åmål: {len(meals)} nya verifierade menydagar")
if __name__=="__main__":main()