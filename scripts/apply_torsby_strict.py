#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
SRC=json.loads((DATA/'torsby-strict-source.json').read_text(encoding='utf-8'))

def load(name): return json.loads((DATA/name).read_text(encoding='utf-8'))
def save(name,obj): (DATA/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def key(x): return str(x.get('name') or x.get('id') or x.get('address') or '').strip().casefold()
def merge_named(existing, additions):
    out={key(x):x for x in existing if isinstance(x,dict) and key(x)}
    for x in additions:
        if isinstance(x,dict) and key(x): out[key(x)]=x
    return list(out.values())

def cats(xs):
    return {str(x.get('category') or x.get('type') or x.get('serviceType') or x.get('activityType') or '').strip().casefold() for x in xs if str(x.get('category') or x.get('type') or x.get('serviceType') or x.get('activityType') or '').strip()}

# Vård: aktiv basfil som STRICT och frontend läser.
h=load('health.json')
h['sourceChecked']=SRC['sourceChecked']
h['providers']=merge_named(h.get('providers') or [],SRC['health'])
save('health.json',h)

# Service: aktivt supplement som service-page och STRICT läser.
s=load('service-local-supplement.json')
s['sourceChecked']=SRC['sourceChecked']
s['businesses']=merge_named(s.get('businesses') or [],SRC['service'])
save('service-local-supplement.json',s)

# Myndigheter: aktiva direktlänkar.
a=load('authorities.json')
ar=a.setdefault('municipalities',{}).setdefault('Torsby',{})
ar['website']=SRC['authorities']['website']
ar['serviceUrls']={**(ar.get('serviceUrls') or {}),**SRC['authorities']['serviceUrls']}
save('authorities.json',a)

# Bio: aktiv basfil.
c=load('cinemas.json')
c.setdefault('municipalities',{})['Torsby']=merge_named(c.setdefault('municipalities',{}).get('Torsby') or [],SRC['cinemas'])
c['updatedAt']=SRC['sourceChecked']
save('cinemas.json',c)

# Fritid och föreningar: aktiva basfiler.
l=load('leisure.json')
lr=l.setdefault('municipalities',{}).setdefault('Torsby',{})
lr['activities']=merge_named(lr.get('activities') or [],SRC['leisure'])
save('leisure.json',l)

sp=load('sports.json')
sr=sp.setdefault('municipalities',{}).setdefault('Torsby',{})
sr['clubs']=merge_named(sr.get('clubs') or [],SRC['sports'])
save('sports.json',sp)

# Lunch: lägg endast in verifierade faktiska lunchställen. Ingen utfyllnad.
lu=load('lunch.json')
lur=lu.setdefault('municipalities',{}).setdefault('Torsby',{})
lur['restaurants']=merge_named(lur.get('restaurants') or [],SRC['lunch'])
save('lunch.json',lu)

# Kontrollera de blockerare som denna patch faktiskt ska lösa.
health=[]
for fn in ['health-eda-supplement.json','health.json','health-private.json','health-private-supplement.json','health-local-supplement.json','health-karlstad-private-supplement.json','health-fargelanda-supplement.json']:
    p=load(fn)
    health += [x for x in p.get('providers',[]) if isinstance(x,dict) and x.get('municipality')=='Torsby']
health=merge_named([],health)

service=[]
for fn in ['service.json','service-private-supplement.json','service-launch-supplement.json','service-local-supplement.json']:
    p=load(fn)
    service += [x for x in p.get('businesses',[]) if isinstance(x,dict) and x.get('municipality')=='Torsby']
service=merge_named([],service)

assert len(health)>=5 and len(cats(health))>=3,(len(health),cats(health))
assert len(service)>=8 and len(cats(service))>=4,(len(service),cats(service))
assert all(ar['serviceUrls'].get(k) for k in ['socialtjanst','ekonomiskt-bistand','budget-skuld','aldreomsorg','lss','bygglov'])
assert len(c['municipalities']['Torsby'])>=1 and all(x.get('programUrl') or x.get('bookingUrl') for x in c['municipalities']['Torsby'])
assert len(lr['activities'])>=10,len(lr['activities'])

print(f"Torsby STRICT patch: health={len(health)}/{len(cats(health))} kat, service={len(service)}/{len(cats(service))} kat, authorities=6, cinema={len(c['municipalities']['Torsby'])}, leisure={len(lr['activities'])}, sports={len(sr['clubs'])}, lunch={len(lur['restaurants'])}")
