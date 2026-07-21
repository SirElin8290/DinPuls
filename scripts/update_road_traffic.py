#!/usr/bin/env python3
"""Hämtar aktuella väghändelser från Trafikverkets öppna API."""
from __future__ import annotations
import json, math, os, re, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
CONFIG=ROOT/"data"/"municipalities.json"
OUTPUT=ROOT/"data"/"road-traffic.json"
API="https://api.trafikinfo.trafikverket.se/v2/data.json"
RADIUS_KM=35

def load(path, fallback):
    try:return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError,json.JSONDecodeError):return fallback

def haversine(a,b,c,d):
    p1,p2=math.radians(a),math.radians(c); dp=math.radians(c-a); dl=math.radians(d-b)
    x=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 6371*2*math.atan2(math.sqrt(x),math.sqrt(1-x))

def point(value):
    match=re.search(r"POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)",str(value or ""),re.I)
    return (float(match.group(2)),float(match.group(1))) if match else None

def first(data,*keys):
    for key in keys:
        value=data.get(key)
        if value not in (None,""): return str(value).strip()
    return ""

def category(text):
    value=text.lower()
    if any(x in value for x in ("olycka","accident")):return "accident","Olycka"
    if any(x in value for x in ("vägarbete","roadwork","arbete")):return "roadwork","Vägarbete"
    if any(x in value for x in ("kö","congestion","stillastående")):return "congestion","Kö"
    if any(x in value for x in ("väglag","halka","snö","weather")):return "weather","Väder och väglag"
    return "obstacle","Trafikhinder"

def normalize(situation,deviation,index):
    geometry=deviation.get("Geometry") or {}
    wgs=geometry.get("WGS84") if isinstance(geometry,dict) else ""
    if isinstance(wgs,list): wgs=wgs[0] if wgs else ""
    coords=point(wgs)
    message=first(deviation,"Message","LocationDescriptor","Header")
    code=first(deviation,"MessageCode","TrafficRestrictionType","DeviationType")
    kind,label=category(f"{message} {code}")
    severity_text=first(deviation,"SeverityText","Severity").lower()
    severity="danger" if any(x in severity_text for x in ("very serious","mycket stor","avstäng")) else "warning" if severity_text else "info"
    road=first(deviation,"RoadNumber","RoadName")
    location=first(deviation,"LocationDescriptor","CountyNo")
    return {"id":f"{situation.get('Id','situation')}-{index}","category":kind,"categoryLabel":label,"severity":severity,"title":first(deviation,"Header") or message or label,"message":message,"road":road,"location":location,"startTime":deviation.get("StartTime"),"endTime":deviation.get("EndTime"),"updatedAt":deviation.get("LastUpdateTime") or situation.get("ModifiedTime"),"latitude":coords[0] if coords else None,"longitude":coords[1] if coords else None,"sourceUrl":"https://www.trafikverket.se/trafikinformation/vag/"}

def fetch(key):
    body=f'''<REQUEST><LOGIN authenticationkey="{key}"/><QUERY objecttype="RoadSituation" schemaversion="1" limit="1000"></QUERY></REQUEST>'''.encode()
    request=Request(API,data=body,headers={"Content-Type":"text/xml","User-Agent":"DinPuls/0.14.0"})
    try:
        with urlopen(request,timeout=45) as response:return json.load(response)
    except HTTPError as error:
        details=error.read().decode("utf-8","replace").replace(key,"***")[:1000]
        raise RuntimeError(f"Trafikverket svarade HTTP {error.code}: {details}") from None
    except URLError as error:raise RuntimeError(f"Trafikverket kunde inte nås: {error.reason}") from None

def main():
    key=os.environ.get("TRAFIKVERKET_API_KEY","").strip()
    if not key: print("TRAFIKVERKET_API_KEY saknas"); return 1
    payload=fetch(key); results=payload.get("RESPONSE",{}).get("RESULT",[])
    situations=[]
    for result in results:
        situations.extend(result.get("Situation",[]) if isinstance(result,dict) else [])
    normalized=[]
    for situation in situations:
        deviations=situation.get("Deviation") or []
        if isinstance(deviations,dict):deviations=[deviations]
        normalized.extend(normalize(situation,d,i) for i,d in enumerate(deviations) if isinstance(d,dict))
    config=load(CONFIG,{})
    municipalities={}
    for municipality in config.get("municipalities",[]):
        name=municipality["name"]; lat=float(municipality["latitude"]); lon=float(municipality["longitude"])
        items=[]
        for item in normalized:
            if item["latitude"] is None:continue
            distance=haversine(lat,lon,item["latitude"],item["longitude"])
            if distance<=RADIUS_KM:items.append({**item,"distanceKm":round(distance,1)})
        items.sort(key=lambda x:({"danger":3,"warning":2,"info":1}.get(x["severity"],0),x.get("updatedAt") or ""),reverse=True)
        municipalities[name]={"items":items[:100]}; print(f"{name}: {len(items)} vägmeddelanden")
    output={"version":"0.14.0","generatedAt":datetime.now(timezone.utc).isoformat(timespec="seconds"),"active":True,"radiusKm":RADIUS_KM,"source":{"name":"Trafikverket","url":"https://www.trafikverket.se/trafikinformation/vag/"},"municipalities":municipalities}
    OUTPUT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); return 0

if __name__=="__main__":sys.exit(main())
