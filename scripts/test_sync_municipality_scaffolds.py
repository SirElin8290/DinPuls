import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import sync_municipality_scaffolds as sync

class ScaffoldTests(unittest.TestCase):
    def test_partial_supplements_are_preserved_and_canonical_records_added(self):
        config = json.loads((sync.DATA / 'municipalities.json').read_text(encoding='utf-8'))
        towns = config['municipalities'][:2]
        with TemporaryDirectory() as directory:
            root = Path(directory); data = root / 'data'; data.mkdir()
            (root / 'municipality-engine.js').write_text('const MUNICIPALITIES = Object.freeze([]);', encoding='utf-8')
            (data / 'municipalities.json').write_text(json.dumps({'municipalities': towns}), encoding='utf-8')
            partial = '{"municipalities": {"Dals-Ed": {"clubs": [{"name": "Preserved"}]}}}'
            supplement = data / 'association-dals-ed-supplement.json'
            supplement.write_text(partial, encoding='utf-8')
            original = {'coordinates': [1, 2], 'arenas': [{'name': 'Existing'}]}
            canonical = data / 'arenas.json'
            canonical.write_text(json.dumps({'municipalities': {towns[0]['name']: original}}), encoding='utf-8')
            with patch.object(sync, 'ROOT', root), patch.object(sync, 'DATA', data):
                sync.main()
            self.assertEqual(supplement.read_text(encoding='utf-8'), partial)
            result = json.loads(canonical.read_text(encoding='utf-8'))['municipalities']
            self.assertEqual(set(result), {town['name'] for town in towns})
            self.assertEqual(result[towns[0]['name']], original)
            self.assertEqual(result[towns[1]['name']]['arenas'], [])

if __name__ == '__main__':
    unittest.main()
