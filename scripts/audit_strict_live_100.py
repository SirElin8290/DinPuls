#!/usr/bin/env python3
# Full omkontroll begärd 2026-09-07: samtliga 21 kommuner nollställs och granskas på nytt.
from __future__ import annotations
import json, re, sys, urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[1]; DATA=ROOT/'data'; REPORT=ROOT/'docs/STRICT-LIVE-AUDIT-LATEST.md'
TZ=ZoneInfo('Europe/Stockholm'); NOW=datetime.now(TZ); LIVE='https://dinpuls.se/data/'
MUNIS=['Åmål','Årjäng','Bengtsfors','Mellerud','Arvika','Grums','Säffle','Dals-Ed','Eda','Filipstad','Forshaga','Färgelanda','Hagfors','Hammarö','Karlstad','Kil','Kristinehamn','Munkfors','Storfors','Sunne','Torsby']
FILES=['municipalities.json','important.json','important-sources.json','weather-live.json','road-traffic.json','transport.json','flights.json','jobs.json','housing.json','housing-fargelanda-supplement.json','events.json','events-fargelanda-supplement.json','news.json','missing-people.json','health.json','health-private.json','health-private-supplement.json','health-local-supplement.json','health-karlstad-private-supplement.json','health-fargelanda-supplement.json','health-eda-supplement.json','service.json','service-private-supplement.json','service-launch-supplement.json','service-local-supplement.json','authorities.json','authorities-hagfors-supplement.json','authorities-arjang-supplement.json','authorities-arvika-supplement.json','lunch.json','cinemas.json','leisure.json','leisure-enrichment.json','leisure-fargelanda-supplement.json','sports.json','sports-fargelanda-supplement.json','association-hagfors-supplement.json','community-sources.json','community-posts.json']
def load_repo(fn):
 try:v=json.loads((DATA/fn).read_text(encoding='utf-8'));return v if isinstance(v,dict) else {}
 except Exception:return {}
def load(fn):
 try:
  bust=str(int(NOW.timestamp()))
  req=urllib.request.Request(LIVE+fn+'?strict='+bust,headers={'User-Agent':'DinPuls-Strict-Audit/1.3','Cache-Control':'no-cache','Pragma':'no-cache'});r=urllib.request.urlopen(req,timeout=8);v=json.loads(r.read().decode('utf-8'));r.close()
  if isinstance(v,dict):return v,'live'
 except Exception:pass
 return load_repo(fn),'repo-fallback'
def norm(v):return re.sub(r'\s+',' ',str(v or '').strip().casefold())
def dt(v):
 try:
  x=datetime.fromisoformat(str(v).replace('Z','+00:00'));return (x if x.tzinfo else x.replace(tzinfo=TZ)).astimezone(TZ)
 except Exception:return None
def fresh(v,h):
 x=dt(v);return bool(x and timedelta(0)<=NOW-x<=timedelta(hours=h))
def me(p,n):
 x=(p.get('municipalities') or {}).get(n,{});return x if isinstance(x,dict) else {}
def dedupe(xs):
 out=[];seen=set()
 for x in xs:
  if not isinstance(x,dict):continue
  k=norm(x.get('name') or x.get('title') or x.get('id') or x.get('address')) or json.dumps(x,ensure_ascii=False,sort_keys=True)[:160]
  if k in seen:continue
  seen.add(k);out.append(x)
 return out
def named(p,key,n):return [x for x in (p.get(key) or []) if isinstance(x,dict) and x.get('municipality')==n]
def cats(xs):return {norm(x.get('category') or x.get('type') or x.get('serviceType') or x.get('activityType')) for x in xs if norm(x.get('category') or x.get('type') or x.get('serviceType') or x.get('activityType'))}
def effective_named(D,n,files,key):
 xs=[]
 for fn in files:
  p=D[fn];xs+=named(p,key,n)
  if p.get('municipality')==n and isinstance(p.get(key),list):xs += [x for x in p[key] if isinstance(x,dict)]
 return dedupe(xs)
def leisure(D,n):
 xs=[x for x in (me(D['leisure.json'],n).get('activities') or []) if isinstance(x,dict)];xs += [x for x in (D['leisure-enrichment.json'].get('entries') or []) if isinstance(x,dict) and x.get('municipality')==n];p=D['leisure-fargelanda-supplement.json']
 if p.get('municipality')==n:xs += [x for k in ('activities','entries') for x in (p.get(k) or []) if isinstance(x,dict)]
 return dedupe(xs)
def sports(D,n):
 xs=[x for x in (me(D['sports.json'],n).get('clubs') or []) if isinstance(x,dict)];p=D['sports-fargelanda-supplement.json']
 if p.get('municipality')==n:xs += [x for x in (p.get('clubs') or []) if isinstance(x,dict)]
 xs += [x for x in (me(D['association-hagfors-supplement.json'],n).get('clubs') or []) if isinstance(x,dict)]
 return dedupe(xs)
def homes(D,n):
 xs=[x for x in (me(D['housing.json'],n).get('listings') or []) if isinstance(x,dict)];p=D['housing-fargelanda-supplement.json']
 if p.get('municipality')==n:xs += [x for x in (p.get('listings') or []) if isinstance(x,dict)]
 return dedupe(xs)
def events(D,n):
 xs=[x for x in (me(D['events.json'],n).get('events') or []) if isinstance(x,dict)];p=D['events-fargelanda-supplement.json']
 if p.get('municipality')==n:xs += [x for x in (p.get('events') or []) if isinstance(x,dict)]
 ok=[]
 for x in xs:
  t=dt(x.get('start') or x.get('startDate') or x.get('date') or x.get('datetime'))
  if not t or t.date()>=NOW.date():ok.append(x)
 return dedupe(ok)
def news(D,n):
 xs=[];recent=0;cut=NOW-timedelta(days=30)
 for x in D['news.json'].get('articles') or []:
  if not isinstance(x,dict) or n not in (x.get('municipalities') or []):continue
  xs.append(x);t=dt(x.get('publishedAt') or x.get('date') or x.get('published'))
  if t is None or t>=cut:recent+=1
 return dedupe(xs),recent
def auth(D,n):
 row=(D['authorities.json'].get('municipalities') or {}).get(n,{}) or {};urls=dict(row.get('serviceUrls') or {});website=row.get('website')
 for fn in ('authorities-hagfors-supplement.json','authorities-arjang-supplement.json','authorities-arvika-supplement.json'):
  p=D[fn];sr=(p.get('municipalities') or {}).get(n,{}) if isinstance(p.get('municipalities'),dict) else {}
  if isinstance(sr,dict):urls.update(sr.get('serviceUrls') or {});website=website or sr.get('website')
  if p.get('municipality')==n:urls.update(p.get('serviceUrls') or {});website=website or p.get('website')
 req=['socialtjanst','ekonomiskt-bistand','budget-skuld','aldreomsorg','lss','bygglov'];miss=[x for x in req if not urls.get(x)];return bool(website) and not miss,len(urls),miss
def config(D):return {x.get('name'):x for x in D['municipalities.json'].get('municipalities') or [] if isinstance(x,dict) and x.get('name')}
def C(ok,reason=''):return ('🟢','') if ok else ('🟡',reason)
def audit(n,D,CFG):
 c=CFG.get(n,{}) or {};M={}
 def put(label,status,reason='',metric=''):M[label]=(status,metric,reason)
 put('Grundkonfiguration',*C(bool(c.get('slug') and c.get('code')),'kommunregister ofullständigt'),metric='konfigurerad' if c else 'saknas');imp=me(D['important.json'],n);src=(D['important-sources.json'].get('municipalities') or {}).get(n);put('Dagens viktigaste',*C(bool(imp or src),'lokal källa/fallback saknas'),metric=f"{len(imp.get('items') or [])} aktiva" if imp else 'källa');wx=me(D['weather-live.json'],n);cur=((wx.get('nowcast') or {}).get('current') or {}) if isinstance(wx,dict) else {};wok=bool(cur.get('time')) and fresh(D['weather-live.json'].get('generatedAt'),6);put('Väder',*C(wok,'aktuell liveväderdata saknas'),metric='live' if wok else 'saknas/stale');rd=me(D['road-traffic.json'],n);rok=bool(rd) and (fresh(D['road-traffic.json'].get('generatedAt'),12) or rd.get('items') is not None);put('Vägtrafik',*C(rok,'fungerande aktuell trafikkälla kan inte verifieras'),metric=f"{len(rd.get('items') or [])} händelser");tr=me(D['transport.json'],n);stops=[x for x in (tr.get('stops') or []) if isinstance(x,dict)];dep=sum(len([d for d in (s.get('departures') or []) if isinstance(d,dict) and not d.get('canceled')]) for s in stops);tok=bool(stops) and tr.get('sourceStatus')!='missing-stop-configuration' and all(not s.get('error') for s in stops);put('Kollektivtrafik',*C(tok,'hållplats/aktuell transportkälla saknas eller felar'),metric=f'{len(stops)} hållplatser / {dep} avgångar');fl=me(D['flights.json'],n);fok=bool(fl) or bool(D['flights.json'].get('airports'));put('Flyg',*C(fok,'användbar flyginformation saknas'),metric='konfigurerad' if fok else 'saknas');js=[x for x in (me(D['jobs.json'],n).get('jobs') or []) if isinstance(x,dict)];put('Jobb',*C(len(js)>=3,f'endast {len(js)} aktuella lokala jobb; minst 3 krävs'),metric=str(len(js)));hs=homes(D,n);put('Bostäder',*C(len(hs)>=1,'inga faktiska aktuella lediga objekt; minst 1 krävs'),metric=str(len(hs)));es=events(D,n);put('Evenemang',*C(len(es)>=5,f'endast {len(es)} aktuella/framtida evenemang; minst 5 krävs'),metric=str(len(es)));ns,nf=news(D,n);put('Nyheter',*C(len(ns)>=5 and nf>=3,f'{len(ns)} lokala nyheter varav {nf} aktuella; minst 5 och tydlig aktualitet krävs'),metric=f'{len(ns)} / {nf} färska');mp=me(D['missing-people.json'],n);neigh=c.get('neighbors') if isinstance(c.get('neighbors'),list) else [];mok=bool(mp or neigh or c.get('missingPeopleAliases'));put('Missing People',*C(mok,'lokal/grannkommunal logik kan inte verifieras'),metric=f'{len(neigh)} grannar');health=effective_named(D,n,['health-eda-supplement.json','health.json','health-private.json','health-private-supplement.json','health-local-supplement.json','health-karlstad-private-supplement.json','health-fargelanda-supplement.json'],'providers');hc=cats(health);put('Vård & hälsa',*C(len(health)>=5 and len(hc)>=3,f'{len(health)} verksamheter i {len(hc)} kategorier; minst 5 och rimlig bredd krävs'),metric=f'{len(health)} / {len(hc)} kat');svc=effective_named(D,n,['service.json','service-private-supplement.json','service-launch-supplement.json','service-local-supplement.json'],'businesses');sc=cats(svc);put('Service & hantverk',*C(len(svc)>=8 and len(sc)>=4,f'{len(svc)} företag i {len(sc)} kategorier; minst 8 och 4 kategorier krävs'),metric=f'{len(svc)} / {len(sc)} kat');aok,ac,miss=auth(D,n);put('Myndigheter',*C(aok,'saknar centrala direktlänkar: '+', '.join(miss) if miss else 'centrala ingångar ofullständiga'),metric=f'{ac} lokala länkar');ls=[x for x in (me(D['lunch.json'],n).get('restaurants') or []) if isinstance(x,dict)];put('Dagens lunch',*C(len(ls)>=4,f'endast {len(ls)} verifierade lunchställen; minst 4 krävs'),metric=str(len(ls)));bios=(D['cinemas.json'].get('municipalities') or {}).get(n,[]);bios=bios if isinstance(bios,list) else [];bok=bool(bios) and all(bool(x.get('programUrl') or x.get('bookingUrl')) for x in bios if isinstance(x,dict));put('Bio',*C(bok,"ingen verifierad lokal bio/programkälla eller korrekt 'ingen lokal bio'-hantering"),metric=str(len(bios)));leis=leisure(D,n);put('Fritid & aktiviteter',*C(len(leis)>=10,f'endast {len(leis)} lokala aktiviteter/anläggningar; minst 10 krävs'),metric=str(len(leis)));sp=sports(D,n);put('Idrott & föreningar',*C(len(sp)>=20,f'endast {len(sp)} lokala föreningar; minst 20 krävs om inte verkligt utbud verifieras lägre'),metric=str(len(sp)));cok=isinstance(D['community-sources.json'],dict) and isinstance(D['community-posts.json'],dict);put('Community',*C(cok,'communityfunktionen kan inte verifieras'),metric='källa/fallback');blockers=[k for k,v in M.items() if v[0]!='🟢'];return {'name':n,'modules':M,'blockers':blockers,'overall':'🟢 100 %' if not blockers else '🟡 EJ 100 %'}
def main():
 D={};origin={}
 for fn in FILES:D[fn],origin[fn]=load(fn)
 CFG=config(D);R=[audit(n,D,CFG) for n in MUNIS];green=[r['name'] for r in R if not r['blockers']];lines=['# DinPuls – STRICT LIVE 100 % audit','',f"Genererad: {NOW.isoformat(timespec='seconds')}",f"Datakälla: {sum(v=='live' for v in origin.values())} livefiler, {sum(v!='live' for v in origin.values())} repo-fallback.",'','Tidigare status är nollställd. Hero och Matkassen ingår inte.','',f'## Resultat: {len(green)} av 21 kommuner når 100 %','',('**100 % gröna:** '+', '.join(green)) if green else '**100 % gröna:** inga.','', '| Kommun | Totalstatus | Jobb | Bostäder | Event | Nyheter | Vård | Service | Lunch | Fritid | Föreningar |','|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
 for r in R:
  m=r['modules'];g=lambda k:m[k][1];lines.append(f"| {r['name']} | {r['overall']} | {g('Jobb')} | {g('Bostäder')} | {g('Evenemang')} | {g('Nyheter')} | {g('Vård & hälsa')} | {g('Service & hantverk')} | {g('Dagens lunch')} | {g('Fritid & aktiviteter')} | {g('Idrott & föreningar')} |")
 lines+=['','## Blockerare per kommun','']
 for r in R:
  lines.append(f"### {r['name']} — {r['overall']}")
  if not r['blockers']:lines.append('Samtliga obligatoriska moduler passerar den strikta auditen.')
  else:
   for k in r['blockers']:
    s,metric,reason=r['modules'][k];lines.append(f'- **{k}:** {s} — {reason} ({metric})')
  lines.append('')
 REPORT.write_text('\n'.join(lines).rstrip()+'\n',encoding='utf-8');print(f'{len(green)}/21 kommuner 100 %');return 0
if __name__=='__main__':raise SystemExit(main())
