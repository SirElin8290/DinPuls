#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; DATA=ROOT/'data'
SRC=json.loads((DATA/'kristinehamn-strict-source.json').read_text(encoding='utf-8'))
def load(n): return json.loads((DATA/n).read_text(encoding='utf-8'))
def save(n,o): (DATA/n).write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def merge(existing,adds):
 out={str(x.get('name') or x.get('id') or x.get('address') or '').strip().casefold():x for x in existing if isinstance(x,dict)}
 for x in adds:
  k=str(x.get('name') or x.get('id') or x.get('address') or '').strip().casefold()
  if k: out[k]=x
 return list(out.values())
# housing
h=load('housing.json'); hr=h.setdefault('municipalities',{}).setdefault('Kristinehamn',{}); hr['listings']=merge(hr.get('listings') or [],SRC['housing']); hr['total']=len(hr['listings']); hr['checkedAt']=SRC['sourceChecked']+'T09:00:00+02:00'; hr['updatedAt']=hr['checkedAt']; hr['stale']=False; hr['errors']=[]; save('housing.json',h)
# health supplement
he=load('health-local-supplement.json'); he['sourceChecked']=SRC['sourceChecked']; he['providers']=merge(he.get('providers') or [],SRC['health']); save('health-local-supplement.json',he)
# service supplement
s=load('service-local-supplement.json'); s['sourceChecked']=SRC['sourceChecked']; s['businesses']=merge(s.get('businesses') or [],SRC['service']); save('service-local-supplement.json',s)
# authorities
a=load('authorities.json'); ar=a.setdefault('municipalities',{}).setdefault('Kristinehamn',{}); ar['website']=SRC['authorities']['website']; ar['serviceUrls']={**(ar.get('serviceUrls') or {}),**SRC['authorities']['serviceUrls']}; save('authorities.json',a)
# lunch
lu=load('lunch-launch-supplement.json'); key='restaurants' if 'restaurants' in lu else ('places' if 'places' in lu else 'restaurants'); lu[key]=merge(lu.get(key) or [],SRC['lunch']); save('lunch-launch-supplement.json',lu)
# leisure/sports
l=load('leisure.json'); lr=l.setdefault('municipalities',{}).setdefault('Kristinehamn',{}); lr['activities']=merge(lr.get('activities') or [],SRC['leisure']); save('leisure.json',l)
sp=load('sports.json'); sr=sp.setdefault('municipalities',{}).setdefault('Kristinehamn',{}); sr['clubs']=merge(sr.get('clubs') or [],SRC['sports']); save('sports.json',sp)
# hard gates, using active families
health=[]
for fn in ['health.json','health-private.json','health-private-supplement.json','health-chat-supplement.json','health-local-supplement.json']:
 p=load(fn); health += [x for x in (p.get('providers') or p.get('businesses') or []) if isinstance(x,dict) and x.get('municipality')=='Kristinehamn']
health=merge([],health); hcats={str(x.get('category') or '').strip() for x in health if str(x.get('category') or '').strip()}
service=[]
for fn in ['service.json','service-private-supplement.json','service-launch-supplement.json','service-local-supplement.json']:
 p=load(fn); service += [x for x in p.get('businesses',[]) if isinstance(x,dict) and x.get('municipality')=='Kristinehamn']
service=merge([],service); scats={str(x.get('category') or x.get('group') or '').strip() for x in service if str(x.get('category') or x.get('group') or '').strip()}
assert len(hr['listings'])>=1
assert len(health)>=5 and len(hcats)>=3,(len(health),hcats)
assert len(service)>=8 and len(scats)>=4,(len(service),scats)
assert all(ar['serviceUrls'].get(k) for k in ['socialtjanst','ekonomiskt-bistand','budget-skuld','aldreomsorg','lss','bygglov'])
assert len(lr['activities'])>=10,len(lr['activities'])
assert len(sr['clubs'])>=20,len(sr['clubs'])
print(f"Kristinehamn STRICT patch: housing={len(hr['listings'])}, health={len(health)}/{len(hcats)}, service={len(service)}/{len(scats)}, authorities=6, leisure={len(lr['activities'])}, sports={len(sr['clubs'])}")
