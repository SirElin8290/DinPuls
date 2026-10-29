import copy
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import apply_storfors_events
import update_housing
from validate_housing_publication import validate
from test_system_health import payloads, opener_for
import check_system_health as health


class PublicationResilienceTests(unittest.TestCase):
    def test_expired_storfors_supplement_does_not_block_other_municipalities(self):
        with tempfile.TemporaryDirectory() as directory:
            events = Path(directory) / 'events.json'
            supplement = Path(directory) / 'supplement.json'
            expected = {'municipalities': {'Åmål': {'events': [{'id': 'keep'}]}}}
            events.write_text(json.dumps(expected), encoding='utf-8')
            supplement.write_text(json.dumps({'municipality': 'Storfors', 'events': [{'startDate': '2000-01-01'}]}), encoding='utf-8')
            with patch.object(apply_storfors_events, 'EVENTS', events), patch.object(apply_storfors_events, 'SUPPLEMENT', supplement):
                self.assertEqual(apply_storfors_events.main(), 0)
            self.assertEqual(json.loads(events.read_text(encoding='utf-8'))['municipalities']['Åmål'], expected['municipalities']['Åmål'])

    def test_failed_housing_source_is_marked_but_does_not_block_fresh_peer(self):
        data = {'municipalities': {'A': {'total': 0, 'listings': [], 'stale': True}, 'B': {'total': 0, 'listings': [], 'checkedAt': '2026-10-29T09:00:00Z'}}}
        self.assertEqual(validate(data, ['A', 'B'], datetime(2026, 10, 29, 10, tzinfo=timezone.utc)), ['A'])
        self.assertNotIn('stale', data['municipalities']['B'])
        data['municipalities']['B']['total'] = 2
        with self.assertRaises(AssertionError):
            validate(data, ['A', 'B'])

    def test_public_vitec_result_rejects_missing_data_and_accepts_verified_empty(self):
        self.assertEqual(update_housing.normalize_vitec_items({'data': '[]'}, {}), [])
        with self.assertRaises(RuntimeError):
            update_housing.normalize_vitec_items({'status': 'success'}, {})

    def test_new_global_stamp_does_not_hide_old_municipality(self):
        data = payloads()
        data['housing.json']['municipalities']['Storfors']['checkedAt'] = '2026-09-01T00:00:00Z'
        report = health.build_health('https://example.test', datetime(2026, 9, 10, 12, tzinfo=timezone.utc), opener_for(data))
        self.assertEqual(report['municipalities']['Storfors']['housing']['reason'], 'stale_data')
        self.assertEqual(report['municipalities']['Kommun 1']['housing']['status'], 'green')

    def test_energy_health_uses_tomorrow_but_rejects_expired_intervals(self):
        data = payloads()
        area = data['energy.json']['areas']['SE3']
        area['tomorrow'] = {'periods': copy.deepcopy(area['periods'])}
        area['periods'] = [{'start': '2026-09-09T00:00:00Z', 'end': '2026-09-10T00:00:00Z'}]
        now = datetime(2026, 9, 10, 12, tzinfo=timezone.utc)
        report = health.build_health('https://example.test', now, opener_for(data))
        self.assertEqual(report['municipalities']['Storfors']['energy']['status'], 'green')
        area.pop('tomorrow')
        report = health.build_health('https://example.test', now, opener_for(data))
        self.assertEqual(report['municipalities']['Storfors']['energy']['status'], 'critical')


if __name__ == '__main__':
    unittest.main()
