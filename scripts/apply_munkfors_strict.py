#!/usr/bin/env python3
from __future__ import annotations
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
SRC = json.loads((DATA / 'munkfors-strict-source.json').read_text(encoding='utf-8'))
ALL = {'housing','health','service','authorities','lunch','leisure','sports'}


def load(name):
    return json.loads((DATA / name).read_text(encoding='utf-8'))


def save(name, obj):
    (DATA / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def key(item):
    return str(item.get('name') or item.get('id') or item.get('address') or '').strip().casefold()


def merge(existing, adds):
    out = {key(x): x for x in existing if isinstance(x, dict) and key(x)}
    for item in adds:
        if isinstance(item, dict) and key(item):
            out[key(item)] = item
    return list(out.values())


def selected_modules():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', action='append', choices=sorted(ALL))
    args = parser.parse_args()
    return set(args.only or ALL)


def apply(modules):
    if 'housing' in modules:
        data = load('housing.json')
        entry = data.setdefault('municipalities', {}).setdefault('Munkfors', {})
        entry['listings'] = merge(entry.get('listings') or [], SRC['housing'])
        entry['total'] = len(entry['listings'])
        entry['checkedAt'] = SRC['sourceChecked'] + 'T09:00:00+02:00'
        entry['updatedAt'] = entry['checkedAt']
        entry['stale'] = False
        entry['errors'] = []
        save('housing.json', data)

    if 'health' in modules:
        data = load('health-local-supplement.json')
        data['sourceChecked'] = SRC['sourceChecked']
        data['providers'] = merge(data.get('providers') or [], SRC['health'])
        save('health-local-supplement.json', data)

    if 'service' in modules:
        data = load('service-local-supplement.json')
        data['sourceChecked'] = SRC['sourceChecked']
        current = []
        for item in data.get('businesses') or []:
            if not isinstance(item, dict):
                continue
            if item.get('municipality') == 'Munkfors' and str(item.get('name') or '').startswith('Munkfors lokala '):
                continue
            current.append(item)
        data['businesses'] = merge(current, SRC['service'])
        save('service-local-supplement.json', data)

    if 'authorities' in modules:
        data = load('authorities.json')
        entry = data.setdefault('municipalities', {}).setdefault('Munkfors', {})
        entry['website'] = SRC['authorities']['website']
        entry['serviceUrls'] = {**(entry.get('serviceUrls') or {}), **SRC['authorities']['serviceUrls']}
        save('authorities.json', data)

    if 'lunch' in modules:
        data = load('lunch.json')
        entry = data.setdefault('municipalities', {}).setdefault('Munkfors', {})
        entry['restaurants'] = merge(entry.get('restaurants') or [], SRC['lunch'])
        entry.setdefault('referenceSources', [])
        save('lunch.json', data)

    if 'leisure' in modules:
        data = load('leisure.json')
        entry = data.setdefault('municipalities', {}).setdefault('Munkfors', {})
        entry['activities'] = merge(entry.get('activities') or [], SRC['leisure'])
        save('leisure.json', data)

    if 'sports' in modules:
        data = load('sports.json')
        entry = data.setdefault('municipalities', {}).setdefault('Munkfors', {})
        entry['clubs'] = merge(entry.get('clubs') or [], SRC['sports'])
        save('sports.json', data)


def health_state():
    items = []
    for filename in ['health-eda-supplement.json','health.json','health-private.json','health-private-supplement.json','health-local-supplement.json','health-karlstad-private-supplement.json','health-fargelanda-supplement.json']:
        data = load(filename)
        seq = data.get('providers') or data.get('businesses') or []
        items += [x for x in seq if isinstance(x, dict) and x.get('municipality') == 'Munkfors']
    items = merge([], items)
    cats = {str(x.get('category') or '').strip() for x in items if str(x.get('category') or '').strip()}
    return items, cats


def service_state():
    items = []
    for filename in ['service.json','service-private-supplement.json','service-launch-supplement.json','service-local-supplement.json']:
        data = load(filename)
        items += [x for x in data.get('businesses', []) if isinstance(x, dict) and x.get('municipality') == 'Munkfors']
    items = merge([], items)
    cats = {str(x.get('category') or x.get('group') or '').strip() for x in items if str(x.get('category') or x.get('group') or '').strip()}
    return items, cats


def gate(modules):
    if 'housing' in modules:
        entry = load('housing.json').get('municipalities', {}).get('Munkfors', {})
        assert len(entry.get('listings') or []) >= 1, 'Munkfors housing < 1'
    if 'health' in modules:
        items, cats = health_state()
        assert len(items) >= 5 and len(cats) >= 3, (len(items), cats)
    if 'service' in modules:
        items, cats = service_state()
        assert len(items) >= 8 and len(cats) >= 4, (len(items), cats)
    if 'authorities' in modules:
        entry = load('authorities.json').get('municipalities', {}).get('Munkfors', {})
        required = ['socialtjanst','ekonomiskt-bistand','budget-skuld','aldreomsorg','lss','bygglov']
        assert all((entry.get('serviceUrls') or {}).get(k) for k in required), 'Munkfors authorities incomplete'
    if 'lunch' in modules:
        entry = load('lunch.json').get('municipalities', {}).get('Munkfors', {})
        assert len(entry.get('restaurants') or []) >= 4, f"Munkfors lunch={len(entry.get('restaurants') or [])}"
    if 'leisure' in modules:
        entry = load('leisure.json').get('municipalities', {}).get('Munkfors', {})
        assert len(entry.get('activities') or []) >= 10, f"Munkfors leisure={len(entry.get('activities') or [])}"
    if 'sports' in modules:
        entry = load('sports.json').get('municipalities', {}).get('Munkfors', {})
        assert len(entry.get('clubs') or []) >= 20, f"Munkfors sports={len(entry.get('clubs') or [])}"


def summary():
    h = load('housing.json').get('municipalities', {}).get('Munkfors', {})
    he, hcats = health_state()
    se, scats = service_state()
    au = load('authorities.json').get('municipalities', {}).get('Munkfors', {})
    lu = load('lunch.json').get('municipalities', {}).get('Munkfors', {})
    le = load('leisure.json').get('municipalities', {}).get('Munkfors', {})
    sp = load('sports.json').get('municipalities', {}).get('Munkfors', {})
    auth_count = sum(1 for k in ['socialtjanst','ekonomiskt-bistand','budget-skuld','aldreomsorg','lss','bygglov'] if (au.get('serviceUrls') or {}).get(k))
    print(f"Munkfors STRICT patch: housing={len(h.get('listings') or [])}, health={len(he)}/{len(hcats)}, service={len(se)}/{len(scats)}, authorities={auth_count}, lunch={len(lu.get('restaurants') or [])}, leisure={len(le.get('activities') or [])}, sports={len(sp.get('clubs') or [])}")


if __name__ == '__main__':
    modules = selected_modules()
    apply(modules)
    gate(modules)
    summary()
