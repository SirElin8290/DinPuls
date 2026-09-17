"""Uppdatera verifierad skolmat från Åmåls kommuns officiella meny-PDF:er."""
from __future__ import annotations
import html, io, json, re, urllib.parse, urllib.request
from datetime import datetime
from pathlib import Path
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]; OUTPUT=ROOT/"data"/"school-family.json"
LANDING="https://amal.se/barn-och-utbildning/skolmatsedel"
GROUPS={"grundskola":"Grundskolan","hogstadiet":"Högstadiet","gymnasiet":"Gymnasiet"}
UA="DinPuls.se school-meals/1.0 kontakt@dinpuls.se"
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
    return " ".join(useful).strip()

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

def main()->None:
    payload=json.loads(OUTPUT.read_text(encoding="utf-8")); markup=fetch(LANDING).decode("utf-8","replace"); links=menu_links(markup); meals=[]
    for group,url in links.items():meals.extend(parse_pdf(fetch(url),group,url))
    if len(meals)<15:raise RuntimeError(f"Orimligt få menydagar: {len(meals)}")
    amal=payload["municipalities"]["Åmål"]; amal["meals"]=sorted(meals,key=lambda item:(item["date"],item["schoolGroup"])); amal["mealSource"]["verifiedAt"]=datetime.now().date().isoformat(); amal["mealSource"]["documents"]=links; payload["generatedAt"]=datetime.now().astimezone().isoformat(timespec="seconds")
    OUTPUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); print(f"Åmål: {len(meals)} verifierade menydagar från {len(links)} officiella PDF:er")
if __name__=="__main__":main()
