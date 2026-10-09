import json
import unittest
from unittest.mock import patch
from tempfile import TemporaryDirectory
from datetime import datetime, timezone
from pathlib import Path

import update_events


class EventUpdateTests(unittest.TestCase):
    def test_sitevision_calendar_pagination_and_explicit_dates(self):
        markup="Soleil.webapps['EventsListing'].render('EventsListing', '#calendar', {\"itemsRoute\":\"/appresource/page/module/items\",\"paths\":[\"archive\"]});"
        item={"title":"Konsert","uri":"/events/2099-12-31-konsert.html","startDate":"31 december","endDate":"1 januari","startTime":"19:00","endTime":"21:00","location":"Medis"}
        with patch.object(update_events,'fetch_json',side_effect=[{"hits":[item],"hitCount":2},{"hits":[{"title":"Missing year","uri":"/no-date.html"}],"hitCount":2}]) as fetch:
            rows=update_events.events_from_sitevision_listing(markup,'Säffle',{'name':'Säffle kommun','url':'https://saffle.se/EVENEMANG'})
        self.assertEqual(fetch.call_count,2)
        self.assertIn('start=80',fetch.call_args.args[0])
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['startDate'],'2099-12-31')
        self.assertEqual(rows[0]['endDate'],'2100-01-01')
        self.assertEqual(rows[0]['time'],'19:00–21:00')

    def test_successful_visit_index_drops_deleted_cached_events(self):
        with TemporaryDirectory() as directory:
            output = Path(directory) / "events.json"
            catalog = Path(directory) / "sources.json"
            old = {"title": "Deleted", "startDate": "2099-01-01", "url": "https://www.visitvarmland.com/deleted"}
            other = {"title": "Local", "startDate": "2099-01-02", "url": "https://local.example/event"}
            fresh = {"title": "Current", "startDate": "2099-01-03", "url": "https://www.visitvarmland.com/current"}
            output.write_text(json.dumps({"municipalities": {"Sunne": {"events": [old, other]}}}), encoding="utf-8")
            catalog.write_text(json.dumps({"municipalities": {"Sunne": {"sources": [{"name": "Visit Värmland", "url": "https://www.visitvarmland.com/evenemang", "automatic": True}]}}}), encoding="utf-8")
            with patch.object(update_events, "OUTPUT", output), patch.object(update_events, "SOURCE_CATALOG", catalog), patch.object(update_events, "fetch_html", return_value=""), patch.object(update_events, "fetch_visit_varmland_events", return_value=[fresh]):
                self.assertEqual(update_events.main(), 0)
            titles = {e["title"] for e in json.loads(output.read_text(encoding="utf-8"))["municipalities"]["Sunne"]["events"]}
            self.assertEqual(titles, {"Local", "Current"})

    def test_all_municipalities_have_multiple_valid_sources(self):
        catalog = json.loads(Path(update_events.SOURCE_CATALOG).read_text(encoding="utf-8"))
        self.assertEqual(set(catalog["municipalities"]), set(update_events.LOCALITIES))
        for municipality, data in catalog["municipalities"].items():
            sources = data.get("sources", [])
            self.assertGreaterEqual(len(sources), 2, municipality)
            self.assertEqual(len({source.get("url") for source in sources}), len(sources), municipality)
            self.assertTrue(all(str(source.get("url", "")).startswith("https://") for source in sources), municipality)
            self.assertTrue(any(source.get("automatic") or "kommun" in source.get("type", "").casefold() for source in sources), municipality)

    def test_catalog_event_preserves_verified_source(self):
        event = update_events.catalog_event({
            "title":"Testkonsert", "startDate":"2099-08-07", "venue":"Testscenen",
            "category":"music", "sourceName":"Arrangören", "url":"https://example.com/event"
        }, "Åmål")
        self.assertTrue(event["verified"])
        self.assertEqual(event["category"], "music")

    def test_category_recognizes_common_events(self):
        self.assertEqual(update_events.category("Stor sommarkonsert")[0], "music")
        self.assertEqual(update_events.category("Familjedag för barn")[0], "family")
        self.assertEqual(update_events.category("Gudstjänst i kyrkan")[0], "church")

    def test_expired_catalog_event_is_removed(self):
        self.assertIsNone(update_events.catalog_event({"title":"Gammalt", "startDate":"2020-01-01"}, "Åmål"))

    def test_visit_varmland_time_label_uses_swedish_summer_time(self):
        start = int(datetime(2026, 9, 5, 8, 0, tzinfo=timezone.utc).timestamp())
        end = int(datetime(2026, 9, 5, 15, 0, tzinfo=timezone.utc).timestamp())
        self.assertEqual(update_events.visit_varmland_time_label(start, end), "10:00–17:00")

    def test_visit_varmland_all_day_midnight_is_not_shown_as_clock_time(self):
        start = int(datetime(2026, 8, 29, 22, 0, tzinfo=timezone.utc).timestamp())
        end = int(datetime(2026, 9, 29, 22, 0, tzinfo=timezone.utc).timestamp())
        self.assertEqual(update_events.visit_varmland_time_label(start, end), "Se källan")

    def test_fresh_automatic_event_replaces_cached_duplicate(self):
        existing = [{"title":"Hemvändardag", "startDate":"2026-09-05", "time":"08:00–14:00"}]
        collected = [{"title":"Hemvändardag", "startDate":"2026-09-05", "time":"10:00–16:00"}]
        merged = update_events.merge_event_rows(existing, collected)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["time"], "10:00–16:00")

    def test_verified_event_keeps_priority_over_automatic_duplicate(self):
        existing = [{"title":"Testdag", "startDate":"2099-09-05", "time":"08:00"}]
        collected = [
            {"title":"Testdag", "startDate":"2099-09-05", "time":"10:00"},
            {"title":"Testdag", "startDate":"2099-09-05", "time":"11:00", "verified":True},
        ]
        merged = update_events.merge_event_rows(existing, collected)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["time"], "11:00")
        self.assertTrue(merged[0]["verified"])

    def test_tickster_list_extracts_public_events(self):
        markup = '''
        <div class="c-tile" data-requestcode="ABC">
          <a href="/se/sv/events/abc/2099-11-05/testkvall" class="c-tile__head">
            <h2 class="c-tile__title">Testkväll i Åmål</h2>
          </a>
          <div class="c-tile__body"><span class="c-tile__label">5 nov 2099, Stadshotellet Åmål, ÅMÅL</span></div>
        </div>
        </section>'''
        source = {"name":"Tickster Åmål", "url":"https://www.tickster.com/se/sv/events/in/%C3%85m%C3%A5l"}
        events = update_events.tickster_events(markup, "Åmål", source)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["startDate"], "2099-11-05")
        self.assertEqual(events[0]["venue"], "Stadshotellet Åmål")

    def test_contiguous_festival_days_become_one_date_range(self):
        events = [
            {"title":"Fotofest", "startDate":"2099-05-01", "endDate":"2099-05-01", "url":"https://example.com/foto"},
            {"title":"Fotofest", "startDate":"2099-05-02", "endDate":"2099-05-02", "url":"https://example.com/foto"},
            {"title":"Annan dag", "startDate":"2099-05-02", "endDate":"2099-05-02", "url":"https://example.com/annan"},
        ]
        collapsed = update_events.collapse_contiguous_events(events)
        self.assertEqual(len(collapsed), 2)
        festival = next(item for item in collapsed if item["title"] == "Fotofest")
        self.assertEqual(festival["endDate"], "2099-05-02")


if __name__ == "__main__":
    unittest.main()
