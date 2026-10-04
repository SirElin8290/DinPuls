#!/usr/bin/env python3
"""Hämtar verifierbara veckomenyer från restaurangernas egna sidor."""
from __future__ import annotations

import html
import base64
import io
import json
import re
import subprocess
import sys
import time
from datetime import date, datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "data" / "lunch-sources.json"
LAUNCH_SUPPLEMENT = ROOT / "data" / "lunch-launch-supplement.json"
HAMMARO_SUPPLEMENT = ROOT / "data" / "lunch-hammaro-supplement.json"
HAGFORS_SUPPLEMENT = ROOT / "data" / "lunch-hagfors-supplement.json"
TORSBY_SUPPLEMENT = ROOT / "data" / "lunch-torsby-supplement.json"
OUTPUT = ROOT / "data" / "lunch.json"
REVIEW_OUTPUT = ROOT / "data" / "lunch-review.json"
EXCLUSIONS = ROOT / "data" / "lunch-exclusions.json"
TIMEZONE = ZoneInfo("Europe/Stockholm")
USER_AGENT = "DinPuls/0.21.2 (+https://sirelin8290.github.io/DinPuls/)"
EXPECTED_MUNICIPALITIES = {item["name"] for item in json.loads((ROOT / "data" / "municipalities.json").read_text(encoding="utf-8"))["municipalities"]}
DAYS = {"måndag":"monday","mandag":"monday","tisdag":"tuesday","onsdag":"wednesday","torsdag":"thursday","fredag":"friday","lördag":"saturday","lordag":"saturday","söndag":"sunday","sondag":"sunday"}
STOP_MARKERS = ("veckans vegetariska","sallader","lunchpriser","öppettider","kontakt","pris ","priser","barn ","utkörningsservice","ta kontakt","catering","ring oss","galleri","adress","bordsbokning","öppet för","veckans meny","inkl.","sommarerbjudanden","ladda ner","med goda drycker","övrigt","lördagslunch","veckans burgare","veckans pasta","ta en titt på vår meny","kunden har alltid rätt","det här tycker våra kunder")
NON_DISH_LINES = {"stängt","lunchbuffé","lunchbuffe","helgbuffé","dagens lunch","veckans lunch","veckans fisk","veckans vegetariska","fredagsdessert","måltidsdryck","kaffe & kaka","dessert","ingen dagens","ingen dagens."}

class SourceFetchError(RuntimeError):
    pass

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

class ImageExtractor(HTMLParser):
    def __init__(self): super().__init__(); self.images=[]
    def handle_starttag(self,tag,attrs):
        if tag != "img": return
        values=dict(attrs); src=values.get("src") or values.get("data-src") or values.get("data-lazy-src")
        if src: self.images.append((src,values.get("alt", "")))

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
    raise SourceFetchError(last_error)

def fetch_binary(url):
    request=Request(url,headers={"User-Agent":USER_AGENT,"Accept":"image/*"})
    try:
        with urlopen(request,timeout=30) as response: payload=response.read(12_000_001)
    except (HTTPError,URLError,TimeoutError) as error: raise RuntimeError(f"bildhämtning misslyckades: {error}") from None
    if len(payload)>12_000_000: raise RuntimeError("menybilden är större än 12 MB")
    if not (payload.startswith(b"\x89PNG\r\n\x1a\n") or payload.startswith(b"\xff\xd8\xff") or payload.startswith(b"RIFF")): raise RuntimeError("källan returnerade inte en stödd menybild")
    return payload

def find_menu_image(page,base_url,pattern):
    parser=ImageExtractor(); parser.feed(page); matcher=re.compile(pattern,re.I)
    matches=[urljoin(base_url,src) for src,alt in parser.images if matcher.search(f"{src} {alt}")]
    if not matches: raise RuntimeError("ingen aktuell menybild hittades på källsidan")
    return matches[0]

def run_tesseract(payload, min_length=20):
    try: result=subprocess.run(["tesseract","stdin","stdout","-l","swe+eng","--psm","6"],input=payload,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=False,timeout=45)
    except FileNotFoundError: raise RuntimeError("OCR-motorn Tesseract saknas") from None
    except subprocess.TimeoutExpired: raise RuntimeError("OCR-tolkningen tog för lång tid") from None
    if result.returncode: raise RuntimeError("OCR-tolkningen misslyckades")
    text=result.stdout.decode("utf-8",errors="replace").strip()
    if len(text)<min_length: raise RuntimeError("OCR gav för lite text för säker publicering")
    return text

def parse_ocr_menu(text,source):
    if source.get("expectedTextPattern") and not re.search(source["expectedTextPattern"],text,re.I): raise RuntimeError("OCR-identiteten kunde inte verifieras")
    text=re.sub(r"^(MÅNDAG)\s+\(varje måndag\)\s*$",r"\1",text,flags=re.I|re.M)
    markup="".join(f"<p>{html.escape(line)}</p>" for line in text.splitlines() if line.strip())
    week,days=parse_weekday_menu(markup,source.get("stopAfterPattern"))
    return week or extract_week([text]),days

def fetch_ocr_menu(source,page_fetcher=fetch,binary_fetcher=fetch_binary,ocr_runner=run_tesseract,now=None):
    if source.get("scanMenuImages"):
        now=now or datetime.now(TIMEZONE)
        page=page_fetcher(source.get("dataUrl") or source["url"])
        if not re.search(source["expectedPagePattern"],page,re.I): raise RuntimeError("källsidans identitet kunde inte verifieras")
        extractor=ImageExtractor();extractor.feed(page);next_menu=None
        for src,alt in dict.fromkeys(extractor.images):
            image_url=urljoin(source["url"],src)
            if urlsplit(image_url).hostname!="static.wixstatic.com": continue
            try:
                result=fetch_ocr_menu({**source,"scanMenuImages":False,"imageUrl":image_url},page_fetcher,binary_fetcher,ocr_runner,now)
            except RuntimeError: continue
            if result[0]==now.isocalendar().week and any(result[1].values()): return result
            if result[0]==(now+timedelta(days=7)).isocalendar().week and any(result[1].values()): next_menu=result
        if next_menu: return next_menu
        raise RuntimeError("ingen verifierad aktuell eller kommande veckobild hittades")
    image_url=source.get("imageUrl")
    if not image_url:
        page=page_fetcher(source.get("dataUrl") or source["url"])
        if source.get("expectedPagePattern") and not re.search(source["expectedPagePattern"],page,re.I): raise RuntimeError("källsidans identitet kunde inte verifieras")
        image_url=find_menu_image(page,source.get("dataUrl") or source["url"],source.get("imagePattern",r"lunch|meny|menu"))
    if source.get("originalWixImage"):
        if urlsplit(image_url).hostname!="static.wixstatic.com": raise RuntimeError("oväntad värd för originalbilden")
        image_url=image_url.split("/v1/",1)[0]
    payload=binary_fetcher(image_url)
    if source.get("ocrRegions"):
        from PIL import Image
        try:
            image=Image.open(io.BytesIO(payload)); image.load(); crops=[]
            for region in source["ocrRegions"]:
                if len(region)!=4 or not all(isinstance(n,(int,float)) and 0<=n<=1 for n in region) or region[0]>=region[2] or region[1]>=region[3]: raise RuntimeError("ogiltig OCR-region")
                crop=image.crop(tuple(round(value*(image.width if index%2==0 else image.height)) for index,value in enumerate(region)))
                crops.append(crop.convert("RGB"))
            texts=[]
            for crop in crops:
                buffer=io.BytesIO(); crop.save(buffer,format="PNG")
                texts.append(ocr_runner(buffer.getvalue(),min_length=0) if ocr_runner is run_tesseract else ocr_runner(buffer.getvalue()))
            text="\n".join(texts)
            if len(text.strip())<20: raise RuntimeError("OCR gav för lite text för säker publicering")
        except (OSError,ValueError): raise RuntimeError("menybilden kunde inte läsas") from None
    else: text=ocr_runner(payload)
    week,days=parse_ocr_menu(text,source)
    return week,days,image_url

def parse_hogsater_days(rows):
    days={key:[] for key in DAYS.values()}
    for row in rows:
        if not isinstance(row,dict): raise RuntimeError("ogiltig menydag")
        index=row.get("day_index")
        if not isinstance(index,int) or not 0<=index<=6: raise RuntimeError("ogiltig dag i restaurangens menyflöde")
        if row.get("is_lunch_served") is not True: continue
        dish=row.get("dish")
        if not isinstance(dish,str) or not dish.strip() or re.search(r"kommer snart|kontakta oss|pizza och grill",dish,re.I): continue
        description=row.get("description") or ""
        if not isinstance(description,str): raise RuntimeError("ogiltig lunchbeskrivning")
        days[list(dict.fromkeys(DAYS.values()))[index]]=[dish.strip()+(" – "+description.strip() if description.strip() else "")]
    return days

def fetch_hogsater_menu(source, now, fetcher=fetch):
    """Use only the anonymous read API embedded in the restaurant's public site."""
    page=fetcher(source["url"])
    match=re.search(r'<script[^>]+src=["\'](/assets/index-[^"\']+\.js)["\']',page)
    if not match: raise RuntimeError("restaurangens offentliga menyprogram hittades inte")
    script=fetcher(urljoin(source["url"],match.group(1)))
    host_match=re.search(r'https://[a-z0-9]+\.supabase\.co',script)
    key=None
    for candidate in re.findall(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',script):
        try: claims=json.loads(base64.urlsafe_b64decode(candidate.split(".")[1]+"==="))
        except (ValueError,UnicodeDecodeError): continue
        if claims.get("role")=="anon": key=candidate; break
    if not host_match or not key: raise RuntimeError("restaurangens offentliga läsflöde hittades inte")
    def read(path):
        request=Request(host_match.group(0)+"/rest/v1/"+path,headers={"User-Agent":USER_AGENT,"apikey":key,"Authorization":"Bearer "+key})
        try:
            with urlopen(request,timeout=30) as response: return json.loads(response.read().decode("utf-8"))
        except (HTTPError,URLError,TimeoutError,ValueError): raise RuntimeError("restaurangens offentliga menyflöde kunde inte läsas") from None
    for target in [now,(now+timedelta(days=7))]:
        iso=target.isocalendar()
        menus=read(f"weekly_menus?select=id,week_number,year&week_number=eq.{iso.week}&year=eq.{iso.year}")
        if not isinstance(menus,list): raise RuntimeError("ogiltigt offentligt menysvar")
        for menu in menus:
            if not isinstance(menu,dict): raise RuntimeError("ogiltig veckomeny")
            if menu.get("year")!=iso.year or menu.get("week_number")!=iso.week: continue
            identifier=menu.get("id")
            if not isinstance(identifier,str) or not re.fullmatch(r"[a-zA-Z0-9-]+",identifier): raise RuntimeError("ogiltigt meny-ID")
            rows=read("weekly_menu_days?select=day_index,dish,description,is_lunch_served&weekly_menu_id=eq."+identifier)
            if not isinstance(rows,list): raise RuntimeError("ogiltiga menydagar")
            days=parse_hogsater_days(rows)
            if any(days.values()): return iso.week,days
    return None,{key:[] for key in DAYS.values()}

def parse_mashie_menu(page, today, expected_heading):
    """Read only the named dining room and exact ISO dates in its public menu."""
    parser=TextExtractor(); parser.feed(page)
    if not re.search(expected_heading," ".join(parser.text_lines()),re.I): raise RuntimeError("Mashie: fel matsal")
    days={key:[] for key in DAYS.values()}
    dates=list(re.finditer(r'js-date=["\'](\d{4}-\d{2}-\d{2})["\']',page,re.I))
    for index,match in enumerate(dates):
        block=page[match.end():dates[index+1].start() if index+1<len(dates) else len(page)]
        try: menu_date=date.fromisoformat(match.group(1))
        except ValueError: continue
        if menu_date.isocalendar()[:2]!=today.isocalendar()[:2]: continue
        day=list(dict.fromkeys(DAYS.values()))[menu_date.weekday()]
        for section in re.findall(r'<section[^>]+class=["\']day-alternative["\'][^>]*>(.*?)</section>',block,re.I|re.S):
            extractor=TextExtractor(); extractor.feed(section); lines=extractor.text_lines()
            dish_match=re.search(r'<span[^>]*>(.*?)</span>',section,re.I|re.S)
            if not dish_match: continue
            dish_extractor=TextExtractor(); dish_extractor.feed(dish_match.group(1)); dish=" ".join(dish_extractor.text_lines())
            if useful_dish(dish): days[day].append(("Efterrätt: " if lines and lines[0].startswith("Dessert") else "")+dish)
    return (today.isocalendar().week if any(days.values()) else None),days

def parse_standing_html(page, source):
    parser=TextExtractor(); parser.feed(page); lines=parser.text_lines()
    if not re.search(source["expectedPagePattern"]," ".join(lines),re.I): raise RuntimeError("fast lunchmeny: fel restaurang")
    try: start=next(i for i,line in enumerate(lines) if re.fullmatch(source["headingPattern"],line,re.I))
    except StopIteration: raise RuntimeError("fast lunchmeny: rubriken saknas") from None
    dishes=[]; pending=[]; categories=set(source.get("menuCategories",[]))
    for line in lines[start+1:]:
        if re.search(source["stopAfterPattern"],line,re.I): break
        if line in categories: continue
        if re.fullmatch(r"\d+(?:[,.]\d+)?\s*(?::-|kr)",line,re.I):
            if pending: dishes.append(" – ".join(pending)); pending=[]
        else: pending.append(line)
    if not dishes: raise RuntimeError("fast lunchmeny: inga säkra rätter hittades")
    return dishes


def parse_hagfors_lunch_pizzas(page):
    extractor=TextExtractor();extractor.feed(page);text="\n".join(extractor.text_lines())
    match=re.search(r"(PRISKLASS\s+1\b.*?)(?=Pizzor med fläskfilé|PRISKLASS\s+5\b|\Z)",text,re.I|re.S)
    if not match: raise RuntimeError("pizzornas lunchprisklasser saknas")
    section=match[1]
    if set(re.findall(r"PRISKLASS\s+([1-4])\b",section,re.I))!={"1","2","3","4"}: raise RuntimeError("lunchprisklasserna kunde inte verifieras")
    section=re.sub(r"PRISKLASS\s+[1-4]\.?\s+\d+\s*:-\s*FAMILJEPIZZA\s*\d+\s*:-","",section,flags=re.I)
    matches=list(re.finditer(r"(?<!\d)(\d{1,2})\.\s*",section));dishes=[]
    if not matches or [int(m[1]) for m in matches]!=list(range(1,len(matches)+1)): raise RuntimeError("pizzornas numrering kunde inte verifieras")
    for i,m in enumerate(matches):
        dish=re.sub(r"\s+"," ",section[m.end():matches[i+1].start() if i+1<len(matches) else len(section)]).strip()
        if not useful_dish(dish): raise RuntimeError("ogiltig rätt i lunchutbudet")
        dishes.append(dish)
    return dishes

def fetch_hagfors_lunch(source,fetcher=fetch):
    page=fetcher(source["url"]);extractor=TextExtractor();extractor.feed(page);text=" ".join(extractor.text_lines())
    if not re.search(r"PIZZERIA HAGFORS",text,re.I) or not re.search(r"DAGENS LUNCH.*?Pizza klass 1-4",text,re.I): raise RuntimeError("det fasta luncherbjudandet kunde inte verifieras")
    if not re.search(r"href=[\"']pizza\.html[\"']",page,re.I): raise RuntimeError("lunchens pizzameny är inte länkad av restaurangen")
    return parse_hagfors_lunch_pizzas(fetcher(urljoin(source["url"],"pizza.html")))


def parse_ramo_lunch(page):
    extractor=TextExtractor();extractor.feed(page);text=" ".join(extractor.text_lines())
    if "Pizzeria Ramo i Forshaga" not in text or "Storgatan 2, 667 30 Forshaga" not in text: raise RuntimeError("lunchrestaurangens identitet kunde inte verifieras")
    dishes=[]
    for article in re.findall(r"<article\b[^>]*>(.*?)</article>",page,re.I|re.S):
        title=re.search(r"<h2\b[^>]*>(.*?)</h2>",article,re.I|re.S)
        content=TextExtractor();content.feed(article)
        if not title or not any(line.startswith("LUNCHPAKET") for line in content.text_lines()): continue
        name=TextExtractor();name.feed(title[1]);dish=" ".join(name.text_lines())
        if useful_dish(dish) and dish not in dishes: dishes.append(dish)
    if not dishes: raise RuntimeError("inga uttryckliga lunchpaket hittades")
    return dishes


def parse_standing_pdf(text):
    """Only the explicitly labelled lunch section, excluding a la carte/drinks."""
    match=re.search(r"LUNCHMENY(.*?)(?=À LA CARTE|A LA CARTE|DRYCK|\Z)",text,re.I|re.S)
    if not match: raise RuntimeError("PDF saknar lunchmenysektion")
    dishes=[]; pending=[]
    for line in match.group(1).splitlines():
        line=line.strip()
        if not line or line.upper()=="LUNCHMENY" or line.startswith("("): continue
        heading=re.match(r"^\d{2,4}\s*(.+)$",line)
        if heading:
            if pending: dishes.append(" – ".join(pending))
            pending=[heading.group(1).strip()]
        elif pending: pending.append(line)
    if pending: dishes.append(" – ".join(pending))
    if not dishes: raise RuntimeError("PDF saknar säkra lunchrätter")
    return dishes

def fetch_standing_pdf(source, fetcher=fetch):
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError
    page=fetcher(source["url"])
    links=[urljoin(source["url"],html.unescape(url)) for url in re.findall(r'href=["\']([^"\']+)["\']',page,re.I) if re.search(source["pdfLinkPattern"],url,re.I)]
    for url in dict.fromkeys(links):
        if urlsplit(url).hostname!=urlsplit(source["url"]).hostname: continue
        try:
            with urlopen(Request(url,headers={"User-Agent":USER_AGENT,"Accept":"application/pdf"}),timeout=30) as response: payload=response.read(12_000_001)
            if len(payload)>12_000_000 or not payload.startswith(b"%PDF-"): continue
            text="\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(payload)).pages)
            return parse_standing_pdf(text),url
        except (RuntimeError,OSError,ValueError,PdfReadError): continue
    raise RuntimeError("ingen verifierbar fast lunchmeny-PDF hittades")

def parse_pdf_week(text, today):
    iso=today.isocalendar()
    if not re.search(r"Matsedel\s*"+str(iso.year),text,re.I): raise RuntimeError("PDF-matsedelns år kunde inte verifieras")
    match=re.search(r"Vecka\s*"+str(iso.week)+r"(?!\d)(.*?)(?=Vecka\s*\d|\Z)",text,re.I|re.S)
    if not match: raise RuntimeError("PDF-matsedeln saknar aktuell vecka")
    lines=match.group(1).splitlines(); markup=[]
    for line in lines:
        if re.match(r"\s*(RESERVATION|Matsedel)",line,re.I): break
        line=re.sub(r"^(MÅNDAG|TISDAG|ONSDAG|TORSDAG|FREDAG|LÖRDAG|SÖNDAG)\s+",r"\1: ",line.strip(),flags=re.I)
        markup.append("<p>"+html.escape(line)+"</p>")
    _,days=parse_weekday_menu("".join(markup))
    return iso.week,days

def fetch_pdf_menu(source, now, fetcher=fetch):
    from pypdf import PdfReader
    page=fetcher(source["url"])
    links=[urljoin(source["url"],html.unescape(url)) for url in re.findall(r'href=["\']([^"\']+)["\']',page,re.I) if re.search(source["pdfLinkPattern"],url,re.I)]
    for url in dict.fromkeys(links):
        try:
            with urlopen(Request(url,headers={"User-Agent":USER_AGENT,"Accept":"application/pdf"}),timeout=30) as response: payload=response.read(12_000_001)
            if len(payload)>12_000_000 or not payload.startswith(b"%PDF-"): continue
            reader=PdfReader(io.BytesIO(payload)); text="\n".join(page.extract_text() or "" for page in reader.pages)
            week,days=parse_pdf_week(text,now.date())
            if any(days.values()): return week,days,url
        except RuntimeError: continue
        except (OSError,ValueError): continue
    raise RuntimeError("ingen verifierad PDF-matsedel för aktuell vecka hittades")

def fetch_structured_menu(source, now, fetcher=fetch):
    """Read public restaurant feeds, requiring the exact ISO week and identity."""
    monday=now.date()-timedelta(days=now.weekday())
    iso=now.isocalendar()
    try:
        if source["parser"]=="galna-tuppen-json":
            payload=json.loads(fetcher("https://galnatuppen.nu/api/lunch?week="+monday.isoformat()))
            if payload.get("week_start")!=monday.isoformat() or payload.get("mode")!="daily":
                raise RuntimeError("källan saknar daterad meny för aktuell vecka")
            days={}
            for row in payload.get("days",[]):
                number=row.get("weekday")
                if not isinstance(number,int) or not 1<=number<=7: raise RuntimeError("ogiltig veckodag i menyflödet")
                values=[dish.get("description") or dish.get("name") for dish in row.get("dishes",[])]
                if any(not isinstance(value,str) for value in values): raise RuntimeError("ogiltiga lunchrätter")
                days[list(dict.fromkeys(DAYS.values()))[number-1]]=[value.strip() for value in values if value.strip()]
        else:
            facility=source["facilityId"]
            payload=json.loads(fetcher(f"https://www.omsorgen.se/api/public/matsedlar/{facility}?year={iso.year}&week={iso.week}"))
            identity=payload.get("facility") or {}; menu=payload.get("week") or {}
            if payload.get("ok") is not True or identity.get("id")!=facility or str(identity.get("municipalityId"))!=str(source["expectedMunicipalityId"]) or identity.get("name")!=source["expectedFacilityName"]:
                raise RuntimeError("menyflödets verksamhet eller kommun kunde inte verifieras")
            if menu.get("year")!=iso.year or menu.get("weekNumber")!=iso.week:
                raise RuntimeError("källan saknar daterad meny för aktuell vecka")
            days={day:[line.strip() for row in record.get("rows",[]) for line in row.get("text","").splitlines() if line.strip()] for key,record in menu.get("days",{}).items() if (day:=key.lower()) in DAYS.values() and record.get("isOpen") is True}
        return iso.week,days
    except (ValueError,KeyError,TypeError,AttributeError):
        raise RuntimeError("ogiltigt offentligt menyflöde") from None


class PublicPostExtractor(HTMLParser):
    """Read only story data included in the unauthenticated public HTML response."""
    def __init__(self): super().__init__(); self.active=False; self.parts=[]; self.documents=[]
    def handle_starttag(self,tag,attrs):
        if tag=="script": self.active=dict(attrs).get("type")=="application/json"; self.parts=[]
    def handle_data(self,text):
        if self.active: self.parts.append(text)
    def handle_endtag(self,tag):
        if tag=="script" and self.active:
            try: self.documents.append(json.loads("".join(self.parts)))
            except ValueError: pass
            self.active=False

def public_menu_posts(page,actor_id):
    parser=PublicPostExtractor(); parser.feed(page); posts=[]
    def walk(value):
        if isinstance(value,dict):
            if value.get("__typename")=="Story" and "creation_time" in value:
                actors=value.get("actors") or []
                if not value.get("sponsored_data") and not value.get("attached_story") and not value.get("work_reposted_story") and isinstance(actors,list) and actors and all(isinstance(actor,dict) and actor.get("id")==actor_id for actor in actors): posts.append(value)
                return
            for child in value.values(): walk(child)
        elif isinstance(value,list):
            for child in value: walk(child)
    for document in parser.documents: walk(document)
    return posts

def parse_public_image_date(text,published,today):
    match=re.search(r"(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)\s+(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(\d{4})",text,re.I)
    if not match: raise RuntimeError("menybilden saknar ett fullständigt verifierbart datum")
    try: menu_date=date(int(match[4]),int(match[3]),int(match[2]))
    except ValueError: raise RuntimeError("menybildens datum är ogiltigt") from None
    day_key=DAYS[match[1].lower()]
    if day_key!=list(dict.fromkeys(DAYS.values()))[menu_date.weekday()]: raise RuntimeError("menybildens veckodag och datum stämmer inte överens")
    if not published <= menu_date <= published+timedelta(days=7): raise RuntimeError("menybildens datum stämmer inte med inläggets publicering")
    if menu_date.isocalendar()[:2]!=today.isocalendar()[:2]: raise RuntimeError("menybilden gäller inte aktuell vecka")
    return menu_date,day_key


def parse_public_week_image(text,published,today):
    week=extract_week([text]); aliases={"mån":0,"måndag":0,"tis":1,"tisdag":1,"ons":2,"onsdag":2,"tor":3,"torsdag":3,"fre":4,"fredag":4}
    dates=re.findall(r"\b(mån(?:dag)?|tis(?:dag)?|ons(?:dag)?|tor(?:sdag)?|fre(?:dag)?)\s+(\d{1,2})\s*/\s*(\d{1,2})(?:\s*/\s*(\d{4}))?",text,re.I)
    if len(dates)!=5 or {aliases[name.lower()] for name,_,_,_ in dates}!=set(range(5)): raise RuntimeError("veckobilden saknar fem verifierbara vardagsdatum")
    monday=today-timedelta(days=today.weekday())
    for candidate in [monday,monday+timedelta(days=7)]:
        if week!=candidate.isocalendar().week or not candidate-timedelta(days=7)<=published<=candidate+timedelta(days=4): continue
        if all((date_for_day:=candidate+timedelta(days=aliases[name.lower()])).day==int(day) and date_for_day.month==int(month) and (not year or date_for_day.year==int(year)) for name,day,month,year in dates): return week
    raise RuntimeError("veckobildens datum, vecka och publicering stämmer inte överens")

def public_post_message(post):
    content=(post.get("comet_sections") or {}).get("content") or {}
    body=content.get("story") or post
    return (body.get("message") or {}).get("text") or ""

def fetch_public_social_text(source,now,page_fetcher=fetch):
    posts=public_menu_posts(page_fetcher(source["url"]),source["publicActorId"])
    for post in sorted(posts,key=lambda row:row.get("creation_time",0),reverse=True):
        try: published=datetime.fromtimestamp(post["creation_time"],TIMEZONE).date()
        except (TypeError,ValueError,OverflowError): continue
        if published>now.date() or published.isocalendar()[:2]!=now.isocalendar()[:2]: continue
        text=public_post_message(post)
        # 'Idag' belongs only to the post's dated publication day, never all days.
        match=re.search(r"\bDagens? lunch idag är\s+([^\n.!]+)",text,re.I)
        if not match: continue
        dish=re.split(r"[^\w\s&(),/–-]",match[1],maxsplit=1)[0].strip()
        if not useful_dish(dish) or len(dish)>250: continue
        return published.isocalendar().week,{list(dict.fromkeys(DAYS.values()))[published.weekday()]:[dish]},post.get("permalink_url"),published.isoformat()
    raise RuntimeError("inget offentligt daterat inlägg med dagens lunch hittades")


def fetch_public_social_image(source,now,page_fetcher=fetch,binary_fetcher=fetch_binary,ocr_runner=run_tesseract):
    posts=public_menu_posts(page_fetcher(source["url"]),source["publicActorId"])
    def images(value):
        if isinstance(value,dict):
            if isinstance(value.get("photo_image"),dict): yield value["photo_image"].get("uri")
            for child in value.values(): yield from images(child)
        elif isinstance(value,list):
            for child in value: yield from images(child)
    for post in sorted(posts,key=lambda row:row.get("creation_time",0),reverse=True):
        try: published=datetime.fromtimestamp(post["creation_time"],TIMEZONE).date()
        except (TypeError,ValueError,OverflowError): continue
        if not now.date()-timedelta(days=7) <= published <= now.date(): continue
        for image_url in dict.fromkeys(images(post.get("attachments",[]))):
            host=urlsplit(image_url or "").hostname or ""
            if not host.endswith(".fbcdn.net") or urlsplit(image_url).scheme!="https": continue
            text=ocr_runner(binary_fetcher(image_url))
            if not re.search(source["expectedTextPattern"],text,re.I): continue
            if source.get("socialMenuSchedule")=="weekly":
                week=parse_public_week_image(text,published,now.date())
                return week,image_url,None,None,post.get("permalink_url")
            menu_date,day_key=parse_public_image_date(text,published,now.date())
            return menu_date.isocalendar().week,image_url,menu_date.isoformat(),day_key,post.get("permalink_url")
    raise RuntimeError("inget offentligt inlägg med säkert daterad lunchbild hittades")


def fetch_source(source, fetcher=fetch):
    error=None
    for url in [source.get("dataUrl") or source["url"],*source.get("fallbackDataUrls",[])]:
        try: page=fetcher(url); break
        except RuntimeError as failure: error=failure
    else: raise error or RuntimeError("ingen källa konfigurerad")
    if source.get("dataFormat") != "wordpress-page": return page
    try:
        payload=json.loads(page); rendered=payload[0]["content"]["rendered"]
        if not isinstance(rendered,str) or not rendered.strip(): raise ValueError
        return rendered
    except (IndexError,KeyError,TypeError,ValueError,json.JSONDecodeError): raise RuntimeError("ogiltigt WordPress-svar") from None

def extract_week(lines):
    for line in lines:
        match=re.search(r"(?:vecka|\bv\.?)\s*(\d{1,2})(?!\d)",line,re.I)
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

def parse_wordpress_relative_menu(page, metadata, now, expected_url):
    # Relativ veckorubrik får bara användas tillsammans med samma sidas färska publiceringsmetadata.
    records=[r for r in metadata if isinstance(r,dict) and str(r.get("link", "")).rstrip("/")==expected_url.rstrip("/")] if isinstance(metadata,list) else []
    if len(records)!=1: raise RuntimeError("WordPress: fel eller saknad menysideidentitet")
    try: modified=datetime.fromisoformat(records[0]["modified_gmt"]+"+00:00").astimezone(TIMEZONE)
    except (KeyError,ValueError,TypeError): raise RuntimeError("WordPress: verifierad uppdateringstid saknas") from None
    if modified>now or modified.date().isocalendar()[:2]!=now.date().isocalendar()[:2]: raise RuntimeError("WordPress: menyn uppdaterades inte aktuell vecka")
    parser=TextExtractor();parser.feed(page);lines=parser.text_lines()
    if "Denna vecka" not in lines: raise RuntimeError("WordPress: aktuell veckosektion saknas")
    start=lines.index("Denna vecka")+1
    end=next((i for i in range(start,len(lines)) if lines[i] in {"Nästa vecka","Helgmeny"}),len(lines))
    _,days=parse_weekday_menu("\n".join(lines[start:end]))
    if not any(days.values()): raise RuntimeError("WordPress: veckosektionen saknar lunchrätter")
    return now.isocalendar().week,days


def parse_scoped_weekday_menu(page, heading, expected_week):
    """Läser endast den namngivna restaurangens sektion och exakt efterfrågad vecka."""
    parser=TextExtractor(); parser.feed(page); lines=parser.text_lines()
    marker=re.compile(heading,re.I); week_marker=re.compile(r"(?:vecka|\bv\.?)\s*(\d{1,2})(?!\d)",re.I); start=None
    for index,line in enumerate(lines):
        match=week_marker.search(line)
        if marker.search(line) and match and int(match.group(1))==expected_week: start=index; break
    if start is None: return None,{key:[] for key in DAYS.values()}
    end=len(lines)
    for index in range(start+1,len(lines)):
        if week_marker.search(lines[index]) or re.match(r"(?:Sjukhuset|Vårdcentralen)\s+",lines[index],re.I): end=index; break
    return parse_weekday_menu("\n".join(lines[start:end]))

MONTHS={"jan":1,"januari":1,"feb":2,"februari":2,"mar":3,"mars":3,"apr":4,"april":4,"maj":5,"jun":6,"juni":6,"jul":7,"juli":7,"aug":8,"augusti":8,"sep":9,"sept":9,"september":9,"okt":10,"oktober":10,"nov":11,"november":11,"dec":12,"december":12}

def parse_dated_weekday_menu(page, today, heading_pattern=None):
    """Väljer bara menysektionen vars publicerade datumintervall innehåller dagens datum."""
    parser=TextExtractor(); parser.feed(page); lines=parser.text_lines(); heading=re.compile(heading_pattern or r"lunchmeny\s+(\d{1,2})\s+([a-zåäö]+)\s*[-–]\s*(\d{1,2})(?:\s+([a-zåäö]+))?",re.I); candidates=[]
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

def parse_calendar_week_menu(page, today, stop_after_pattern=None):
    """Select only explicitly dated weekdays in the current ISO year/week."""
    parser=TextExtractor(); parser.feed(page); lines=parser.text_lines()
    menu={key:[] for key in DAYS.values()}; active=None; found=False
    pattern=re.compile(r"^(måndag|mandag|tisdag|onsdag|torsdag|fredag|lördag|lordag|söndag|sondag)\s+(\d{1,2})(?:[/.](\d{1,2})|\s+([a-zåäö]+))(?:\s+Hej på Mârten)?$",re.I)
    for line in lines:
        if found and stop_after_pattern and re.search(stop_after_pattern,line,re.I): break
        match=pattern.fullmatch(line)
        if match:
            month=int(match.group(3)) if match.group(3) else MONTHS.get(match.group(4).lower())
            active=None
            if not month: continue
            year=today.year + (1 if today.month==12 and month==1 else -1 if today.month==1 and month==12 else 0)
            try: day_date=date(year,month,int(match.group(2)))
            except ValueError: continue
            key=DAYS[match.group(1).lower()]
            if day_date.isocalendar()[:2]==today.isocalendar()[:2] and day_date.weekday()==list(dict.fromkeys(DAYS.values())).index(key):
                active=key; found=True
            continue
        if active and any(line.lower().startswith(marker) for marker in STOP_MARKERS): active=None
        if active and useful_dish(line) and len(menu[active])<5: menu[active].append(line.lstrip("¤ "))
    return (today.isocalendar().week if found else None),menu


def parse_rotating_week_menu(page, today):
    """Use a source's explicit even/odd recurring menu without inventing dishes."""
    parser=TextExtractor(); parser.feed(page); lines=parser.text_lines()
    wanted="Jämn vecka" if today.isocalendar().week%2==0 else "Ojämn vecka"
    try: start=next(i for i,line in enumerate(lines) if line.casefold()==wanted.casefold())
    except StopIteration: return None,{key:[] for key in DAYS.values()}
    end=next((i for i in range(start+1,len(lines)) if lines[i].casefold() in {"jämn vecka","ojämn vecka","nyfiken på köttet?"}),len(lines))
    _week,days=parse_weekday_menu("".join(f"<p>{html.escape(line)}</p>" for line in lines[start+1:end]))
    return today.isocalendar().week,days


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
    if EXCLUSIONS.exists():
        exclusion_data=json.loads(EXCLUSIONS.read_text(encoding="utf-8"))
        excluded_ids={str(item.get("id")) for item in exclusion_data.get("excludedRestaurants",[]) if isinstance(item,dict)}
        for name,sources in municipalities.items():
            municipalities[name]=[item for item in sources if str(item.get("id")) not in excluded_ids]
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
            if source.get("parser")=="image-weekday-menu" and not source.get("expectedTextPattern"): raise ValueError(f"Bildmeny saknar identitetskontroll: {source_id}")
            seen.add(source_id)


def retain_verified_week(item,previous,now):
    """A network failure cannot revoke verified dishes still within their ISO week."""
    if item.get("status")!="unavailable" or not item.get("fetchFailure") or not item.get("error") or not previous or previous.get("status")!="current" or not any((previous.get("days") or {}).values()): return
    if any(item.get(key)!=previous.get(key) for key in ("url","parser","dataUrl")): return
    try: verified=datetime.fromisoformat(previous["checkedAt"])
    except (KeyError,ValueError,TypeError): return
    if verified.tzinfo is None: return
    if verified > now or verified.isocalendar()[:2]!=now.isocalendar()[:2] or previous.get("weekNumber")!=now.isocalendar().week: return
    item.update(status="current",weekNumber=previous["weekNumber"],days=previous["days"],checkedAt=previous["checkedAt"],fetchAttemptedAt=now.isoformat(timespec="seconds"),fetchWarning=item["error"],menuFreshness="retained_verified",mode="automatic")


def build_output(config,now,fetcher=fetch,previous_output=None):
    # Produktionskonfigurationen har versionsfält och kompletteras med kommunfiler.
    # Små syntetiska testkonfigurationer ska inte utlösa nät- eller OCR-hämtning
    # för hela produktionskatalogen.
    config=merge_config(config) if config.get("version") else config
    validate_config(config); current_week=now.isocalendar().week; municipalities={}
    previous_by_id={item.get("id"):item for row in ((previous_output or {}).get("municipalities") or {}).values() for item in (row.get("restaurants") or []) if isinstance(item,dict)}
    for municipality,sources in config.get("municipalities",{}).items():
        restaurants=[]
        for source in sources:
            if source.get("active") is False: continue
            item={**source,"checkedAt":now.isoformat(timespec="seconds"),"weekNumber":None,"days":{},"status":"reference","mode":"reference"}
            if source.get("nameAfter") and source.get("nameAfterDate") and now.date() >= date.fromisoformat(source["nameAfterDate"]): item["name"]=source["nameAfter"]
            parser_name=source.get("parser")
            if parser_name in {"weekday-headings","all-days-heading","scoped-weekday-headings","dated-weekday-headings","lunchsidan-restaurant","lunchsidan-place-restaurant","image-weekday-menu","calendar-weekday-headings","rotating-weekday-headings","galna-tuppen-json","omsorgen-json","pdf-weekday-menu","mashie-menu","standing-html","standing-pdf","hogsater-json","public-social-image","public-social-text","hagfors-standing-pizza","ramo-standing-lunch","wordpress-relative-week-menu"}:
                try:
                    if parser_name=="wordpress-relative-week-menu":
                        page=fetcher(source["url"]); metadata=json.loads(fetcher(source["metadataUrl"])); week,days=parse_wordpress_relative_menu(page,metadata,now,source["url"])
                    elif parser_name=="ramo-standing-lunch":
                        item["standingDishes"]=parse_ramo_lunch(fetcher(source["url"])); week=None; days={}
                    elif parser_name=="hagfors-standing-pizza":
                        item["standingDishes"]=fetch_hagfors_lunch(source,fetcher); week=None; days={}
                    elif parser_name=="public-social-text":
                        week,days,post_url,menu_date=fetch_public_social_text(source,now,page_fetcher=fetcher)
                        item["sourcePost"]=post_url; item["menuDate"]=menu_date; item["menuSchedule"]="daily_public_post"
                    elif parser_name=="public-social-image":
                        week,image_url,image_date,image_day,post_url=fetch_public_social_image(source,now,page_fetcher=fetcher)
                        days={}; item["verifiedMenuImage"]=image_url; item["sourceAsset"]=image_url; item["sourcePost"]=post_url; item["extraction"]="ocr"
                        if image_date: item["menuImageDate"]=image_date; item["verifiedMenuImageDays"]=[image_day]
                    elif parser_name=="image-weekday-menu":
                        week,days,image_url=fetch_ocr_menu(source,page_fetcher=fetcher,now=now)
                        item["sourceAsset"]=image_url; item["extraction"]="ocr"
                        if week != current_week: raise RuntimeError("OCR kunde inte verifiera aktuell vecka")
                        if not any(days.values()) and not source.get("displayAsImage"): raise RuntimeError("OCR hittade inga säkra lunchrätter")
                        if source.get("displayAsImage"): item["verifiedMenuImage"]=image_url; days={}
                    elif parser_name=="hogsater-json":
                        week,days=fetch_hogsater_menu(source,now,fetcher)
                        if not any(days.values()): item["availabilityNotice"]="Restaurangen har ännu inte publicerat veckans lunchrätter."
                    elif parser_name=="standing-pdf": item["standingDishes"],item["sourceAsset"]=fetch_standing_pdf(source,fetcher); week=None; days={}
                    elif parser_name=="pdf-weekday-menu": week,days,pdf_url=fetch_pdf_menu(source,now,fetcher); item["sourceAsset"]=pdf_url
                    elif parser_name in {"galna-tuppen-json","omsorgen-json"}: week,days=fetch_structured_menu(source,now,fetcher)
                    else: page=fetch_source(source,fetcher)
                    if parser_name=="mashie-menu": week,days=parse_mashie_menu(page,now.date(),source["expectedMenuPattern"])
                    elif parser_name=="standing-html": item["standingDishes"]=parse_standing_html(page,source); week=None; days={}
                    elif parser_name=="all-days-heading":
                        week,days=parse_all_days_menu(page)
                        if any(days.values()): week=current_week
                    elif parser_name=="scoped-weekday-headings": week,days=parse_scoped_weekday_menu(page,source["headingPattern"],current_week)
                    elif parser_name=="calendar-weekday-headings":
                        week,days=parse_calendar_week_menu(page,now.date(),source.get("stopAfterPattern"))
                        if not any(days.values()): week,days=parse_calendar_week_menu(page,(now+timedelta(days=7)).date(),source.get("stopAfterPattern"))
                    elif parser_name=="rotating-weekday-headings": week,days=parse_rotating_week_menu(page,now.date()); item["menuSchedule"]="recurring_even_odd_week"
                    elif parser_name=="dated-weekday-headings": week,days=parse_dated_weekday_menu(page,now.date(),source.get("dateHeadingPattern"))
                    elif parser_name=="lunchsidan-restaurant": week,days=parse_lunchsidan_restaurant(page,source["expectedNamePattern"],source["expectedAddress"],source.get("removePrefixes"))
                    elif parser_name=="lunchsidan-place-restaurant": week,days=parse_lunchsidan_place_restaurant(page,source["expectedNamePattern"],source["expectedAddress"],source.get("removePrefixes"))
                    elif parser_name not in {"image-weekday-menu","galna-tuppen-json","omsorgen-json","pdf-weekday-menu","mashie-menu","standing-html","standing-pdf","hogsater-json","public-social-image","public-social-text","hagfors-standing-pizza","ramo-standing-lunch","wordpress-relative-week-menu"}: week,days=parse_weekday_menu(page,source.get("stopAfterPattern"))
                    if source.get("menuYearPattern"):
                        match=re.search(source["menuYearPattern"],page,re.I)
                        target=(now+timedelta(days=7)).isocalendar() if week==(now+timedelta(days=7)).isocalendar().week else now.isocalendar()
                        if not match or int(match.group(1))!=target.year: raise RuntimeError("menyns år kunde inte verifieras")
                    if source.get("pendingTextPattern") and re.search(source["pendingTextPattern"],page,re.I) and not any(days.values()):
                        item["availabilityNotice"]=source["pendingNotice"]
                    if source.get("closedTextPattern") and re.search(source["closedTextPattern"],page,re.I):
                        days={}; week=None; item["closureNotice"]="Restaurangen meddelar att dagens lunch är stängd. Se källan."
                    if source.get("excludeDishPattern"):
                        days={day:list(dict.fromkeys(dish for dish in dishes if not re.search(source["excludeDishPattern"],dish,re.I))) for day,dishes in days.items()}
                    if source.get("dishSplitPattern"):
                        days={day:[part.strip() for dish in dishes for part in re.split(source["dishSplitPattern"],dish) if part.strip()] for day,dishes in days.items()}
                    if source.get("id")=="mickans-grill": days={day:[dish for dish in dishes if dish!="$9.95"] for day,dishes in days.items()}
                    item["weekNumber"]=week; item["days"]=days if week==current_week else {}; item["status"]="current" if week==current_week and (any(days.values()) or item.get("verifiedMenuImage")) else "outdated"; item["mode"]="automatic"
                    next_date=(now.date()-timedelta(days=now.weekday()))+timedelta(days=7)
                    if week==next_date.isocalendar().week and (any(days.values()) or item.get("verifiedMenuImage")):
                        item["upcomingMenu"]={"weekNumber":week,"year":next_date.isocalendar().year,"validFrom":next_date.isoformat(),"days":days}
                        item["status"]="upcoming"
                        if item.get("verifiedMenuImage"): item["upcomingMenu"]["image"]=item.pop("verifiedMenuImage")
                    if item.get("standingDishes"): item["status"]="standing_menu"; item["menuSchedule"]="standing"
                    if item.get("availabilityNotice"): item["status"]="awaiting_publication"
                    if item.get("closureNotice"): item["status"]="unavailable"
                except RuntimeError as error:
                    if isinstance(error,SourceFetchError): item["fetchFailure"]=True
                    item["status"]="review_required" if parser_name=="image-weekday-menu" else "unavailable"; item["mode"]="reference" if source.get("fallbackMode")=="reference" else "automatic"; item["error"]=str(error)
            if source.get("seasonal"):
                item["seasonal"]=True
                season_months=source.get("seasonMonths") or []
                season_start=source.get("seasonStart"); season_end=source.get("seasonEnd")
                if parser_name=="source-only" and season_start and season_end:
                    current_mmdd=now.strftime("%m-%d")
                    item["status"]="active" if season_start <= current_mmdd <= season_end else "seasonally_closed"
                elif parser_name=="source-only" and season_months: item["status"]="active" if now.month in season_months else "seasonally_closed"
            if source.get("closureNotice") and source.get("closureEvidenceUrl"):
                item["status"]="unavailable"; item["days"]={}; item.pop("verifiedMenuImage",None)
            previous=previous_by_id.get(source.get("id"))
            retain_verified_week(item,previous,now)
            if item["status"] != "current" and previous and previous.get("status") == "current" and any((previous.get("days") or {}).values()):
                item["lastSuccessfulMenu"]={"weekNumber":previous.get("weekNumber"),"checkedAt":previous.get("checkedAt"),"days":previous.get("days")}
            restaurants.append(item)
        municipalities[municipality]={"restaurants":restaurants,"referenceSources":config.get("referenceSources",{}).get(municipality,[])}
    excluded_count=0
    if EXCLUSIONS.exists():
        excluded_count=len(json.loads(EXCLUSIONS.read_text(encoding="utf-8")).get("excludedRestaurants",[]))
    return {"version":"0.23.0","generatedAt":now.isoformat(timespec="seconds"),"timezone":"Europe/Stockholm","currentWeek":current_week,"principle":"Exakta rätter visas bara när rätt vecka kan verifieras hos restaurangens originalkälla.","curation":{"menuCandidates":sum(len(row["restaurants"]) for row in municipalities.values()),"excludedWithoutVerifiableMenu":excluded_count,"exclusionSource":"data/lunch-exclusions.json"},"municipalities":municipalities}

def main():
    config=json.loads(SOURCES.read_text(encoding="utf-8")); now=datetime.now(TIMEZONE)
    previous=json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else None
    output=build_output(config,now,previous_output=previous)
    for municipality,entry in output["municipalities"].items():
        for item in entry["restaurants"]: print(f"{municipality}: {item['name']} – {item['status']}")
    OUTPUT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    review=[{"municipality":municipality,"id":item.get("id"),"name":item.get("name"),"status":item.get("status"),"error":item.get("error"),"source":item.get("url"),"sourceAsset":item.get("sourceAsset")} for municipality,entry in output["municipalities"].items() for item in entry["restaurants"] if item.get("status")=="review_required"]
    REVIEW_OUTPUT.write_text(json.dumps({"generatedAt":now.isoformat(timespec="seconds"),"items":review},ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); return 0

if __name__=="__main__": sys.exit(main())
