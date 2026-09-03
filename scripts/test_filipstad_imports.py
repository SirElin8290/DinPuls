import copy
import io
import json
import unittest
from datetime import datetime
from unittest.mock import patch

import update_cinemas as cinema
import update_events as events
import update_news as news
import update_lunch as lunch


class FilipstadImports(unittest.TestCase):
    def test_monitor_dates_dedup_deleted_and_other_town(self):
        now = datetime(2026, 9, 3, 12, tzinfo=cinema.STOCKHOLM)
        row = {"siteName": "Filipstad", "movie": {"title": "Film", "slug": "film"}, "startDate": "2026-09-08T15:00:00"}
        old = {**row, "startDate": "2026-09-03T11:00:00"}
        deleted = {**row, "deleted": True}
        films = cinema.parse_monitor_program([row, row, old, deleted], now)
        self.assertEqual(films[0]["showtimes"], ["2026-09-08T15:00+02:00"])
        self.assertEqual(films[0]["url"], cinema.MONITOR_SOURCE + "filmer/film")
        self.assertEqual(cinema.parse_monitor_program([], now), [])
        for payload in [{}, [{**row, "siteName": "Other"}], [{**row, "startDate": "bad"}], [row] * 500]:
            with self.assertRaises(ValueError):
                cinema.parse_monitor_program(payload, now)

    def test_monitor_success_failure_and_preserves_other_cinemas(self):
        data = {"municipalities": {"Filipstad": [{"name": "Bio Monitor", "features": ["Knattebio"]}], "Dals-Ed": [{"films": [1]}], "Bengtsfors": [{"films": [2]}]}}
        previous = copy.deepcopy(data)
        now = datetime.now(cinema.STOCKHOLM)
        with patch.object(cinema, "fetch", side_effect=TimeoutError):
            cinema.update_monitor(data, now)
        self.assertEqual(data["municipalities"]["Filipstad"][0]["programStatus"], "unavailable")
        with patch.object(cinema, "fetch", return_value='[]') as fetch:
            cinema.update_monitor(data, now)
        self.assertIn("StartDate=", fetch.call_args.args[0])
        self.assertEqual(data["municipalities"]["Filipstad"][0]["programStatus"], "ok")
        self.assertNotIn("programError", data["municipalities"]["Filipstad"][0])
        self.assertEqual(data["municipalities"]["Filipstad"][0]["features"], ["Knattebio"])
        for town in ["Dals-Ed", "Bengtsfors"]:
            self.assertEqual(data["municipalities"][town], previous["municipalities"][town])

    def test_turid_pagination_original_urls_categories_and_expiry(self):
        occasion = {"date_start": "2099-09-03", "date_end": "2099-09-03", "time_start": "15:00:00", "time_end": None}
        item = {"title": "Konsert", "slug": "evenemang/musik/konsert", "categories": [{"title": "Musik"}], "places": [{"title": "Lesjöfors"}], "occasions": [occasion, occasion, {**occasion, "date_start": "2020-01-01", "date_end": "2020-01-01"}]}
        later = {**item, "occasions": [{**occasion, "time_start": "19:00:00"}]}
        source = next(m for m in events.MUNICIPALITY_CONFIG if m['name'] == 'Filipstad')['eventSources'][0]
        responses = [io.BytesIO(json.dumps({"data": [item], "total_pages": 2}).encode()), io.BytesIO(json.dumps({"data": [later], "total_pages": 2}).encode())]
        with patch.object(events.urllib.request, "urlopen", side_effect=responses) as fetch:
            rows = events.fetch_turid_events(source, "Filipstad")
        self.assertEqual(len(rows), 2)
        self.assertEqual(len(events.merge_event_rows([], rows)), 2)
        self.assertIn("page=2", fetch.call_args.args[0].full_url)
        self.assertEqual(rows[0]['url'], 'https://www.visitvarmland.com/filipstad/evenemang/musik/konsert')
        self.assertEqual(rows[0]['venue'], 'Lesjöfors')
        self.assertEqual(rows[0]['category'], 'music')
        with patch.object(events.urllib.request, "urlopen", return_value=io.BytesIO(b'{}')):
            with self.assertRaises(ValueError):
                events.fetch_turid_events(source, 'Filipstad')

    def test_official_rss_uses_publication_date_and_local_scope(self):
        listing = next(row for row in news.LOCAL_LISTINGS if row['region'] == 'Filipstad')
        xml = b'<rss><channel><item><title>Kommunnyhet</title><link>https://www.filipstad.se/nyhet.123.html</link><pubDate>Wed, 02 Sep 2026 07:46:48 GMT</pubDate></item></channel></rss>'
        with patch.object(news.urllib.request, 'urlopen', return_value=io.BytesIO(xml)):
            rows = news.fetch_local_listing(listing)
        self.assertEqual(rows[0]['publishedAt'], '2026-09-02T07:46:48+00:00')
        self.assertEqual(rows[0]['municipalities'], ['Filipstad'])
        self.assertEqual(rows[0]['scope'], 'local')
        self.assertTrue(rows[0]['id'].startswith('feed-'))
        for bad in [xml.replace(b'Wed, 02 Sep 2026 07:46:48 GMT', b''), xml.replace(b'www.filipstad.se/nyhet', b'example.org/nyhet')]:
            with patch.object(news.urllib.request, 'urlopen', return_value=io.BytesIO(bad)):
                self.assertEqual(news.fetch_local_listing(listing), [])

    def test_lunch_geography_without_invented_menus(self):
        config = json.loads(lunch.SOURCES.read_text(encoding='utf-8'))
        # Build every municipality with a deterministic source, then inspect Filipstad.
        output = lunch.build_output(config, datetime.now(lunch.TIMEZONE), fetcher=lambda url: '')
        rows = output['municipalities']['Filipstad']['restaurants']
        for locality in ['Filipstad', 'Lesjöfors', 'Nykroppa']:
            self.assertTrue(any(locality in row.get('address', '') for row in rows))
        additions = [row for row in rows if row['id'] in {'lesjofors-grill-pizzeria', 'cafe-stationshuset-lesjofors', 'prastbacks-rasta-nykroppa'}]
        self.assertEqual(len(additions), 3)
        for row in additions:
            self.assertEqual(row['days'], {})
            self.assertEqual(row['status'], 'reference')


if __name__ == '__main__':
    unittest.main()
