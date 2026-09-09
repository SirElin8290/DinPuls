#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
SRC=json.loads((DATA/'karlstad-strict-source.json').read_text(encoding='utf-8'))

def load(name): return json.loads((DATA/name).read_text(encoding='utf-8'))
def save(name,obj): (DATA/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def merge_named(existing, additions):
    out={str(x.get('name') or x.get('id') or x.get('address') or '').strip().casefold():x for x in existing if isinstance(x,dict)}
    for x in additions:
        k=str(x.get('name') or x.get('id') or x.get('address') or '').strip().casefold()
        if k: out[k]=x
    return list(out.values())

# Housing is owned by update_housing.py; this legacy STRICT patch must not add snapshots.
row=load('housing.json').setdefault('municipalities',{}).setdefault('Karlstad',{})

# Service: file is already consumed directly by service-page.js.
s=load('service-local-supplement.json'); s['sourceChecked']=SRC['sourceChecked']; s['businesses']=merge_named(s.get('businesses') or [],SRC['service']); save('service-local-supplement.json',s)

# Authorities: base file is consumed directly by myndigheter-page.js.
a=load('authorities.json'); ar=a.setdefault('municipalities',{}).setdefault('Karlstad',{}); ar['website']=SRC['authorities']['website']; ar['serviceUrls']={**(ar.get('serviceUrls') or {}),**SRC['authorities']['serviceUrls']}; save('authorities.json',a)

# Leisure and sports: base files are the active frontend inputs.
l=load('leisure.json'); lr=l.setdefault('municipalities',{}).setdefault('Karlstad',{}); lr['activities']=merge_named(lr.get('activities') or [],SRC['leisure']); save('leisure.json',l)
sp=load('sports.json'); sr=sp.setdefault('municipalities',{}).setdefault('Karlstad',{}); sr['clubs']=merge_named(sr.get('clubs') or [],SRC['sports']); save('sports.json',sp)

# Hard gates: fail workflow instead of publishing a below-threshold Karlstad patch.
service=[]
for fn in ['service.json','service-private-supplement.json','service-launch-supplement.json','service-local-supplement.json']:
    p=load(fn); service += [x for x in p.get('businesses',[]) if isinstance(x,dict) and x.get('municipality')=='Karlstad']
service=merge_named([],service)
cats={str(x.get('category') or x.get('group') or '').strip() for x in service if str(x.get('category') or x.get('group') or '').strip()}
assert len(row['listings'])>=1
assert len(service)>=8 and len(cats)>=4,(len(service),cats)
assert all(ar['serviceUrls'].get(k) for k in ['socialtjanst','ekonomiskt-bistand','budget-skuld','aldreomsorg','lss','bygglov'])
assert len(lr['activities'])>=10,len(lr['activities'])
assert len(sr['clubs'])>=20,len(sr['clubs'])
print(f"Karlstad STRICT patch: housing={len(row['listings'])}, service={len(service)}/{len(cats)} kat, authorities=6, leisure={len(lr['activities'])}, sports={len(sr['clubs'])}")
