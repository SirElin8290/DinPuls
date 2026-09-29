#!/usr/bin/env python3
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

import update_lunch


class LunchUpdateTests(unittest.TestCase):
    def test_parser_accepts_weekday_with_date(self):
        page = "<h2>Vecka 31</h2><h3>Måndag 27/7</h3><p>Korvstroganoff med ris</p>"
        week, days = update_lunch.parse_weekday_menu(page)
        self.assertEqual(week, 31)
        self.assertEqual(days["monday"], ["Korvstroganoff med ris"])

    def test_parser_does_not_mix_two_weeks(self):
        page = "<h2>Vecka 31</h2><h3>Måndag</h3><p>Rätt vecka 31</p><h3>Tisdag</h3><p>Tisdagsrätt</p><h2>Vecka 32</h2><h3>Måndag</h3><p>Rätt vecka 32</p>"
        _week, days = update_lunch.parse_weekday_menu(page)
        self.assertEqual(days["monday"], ["Rätt vecka 31"])

    def test_generic_reference_is_not_a_restaurant(self):
        config = {
            "municipalities": {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES},
            "referenceSources": {"Arvika": [{"name": "Arvika Lunch", "url": "https://example.test"}]},
        }
        output = update_lunch.build_output(
            config,
            datetime(2026, 7, 27, 8, tzinfo=ZoneInfo("Europe/Stockholm")),
        )
        self.assertEqual(output["municipalities"]["Arvika"]["restaurants"], [])
        self.assertEqual(len(output["municipalities"]["Arvika"]["referenceSources"]), 1)

    def test_failed_fetch_never_exposes_unverified_dishes(self):
        municipalities = {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Åmål"] = [{
            "id": "test", "name": "Test", "url": "https://example.test",
            "address": "Åmål", "hours": "11–14", "parser": "weekday-headings",
        }]
        output = update_lunch.build_output(
            {"municipalities": municipalities},
            datetime(2026, 7, 27, 8, tzinfo=ZoneInfo("Europe/Stockholm")),
            fetcher=lambda _url: (_ for _ in ()).throw(RuntimeError("timeout")),
        )
        item = output["municipalities"]["Åmål"]["restaurants"][0]
        self.assertEqual(item["status"], "unavailable")
        self.assertEqual(item["days"], {})

    def test_wordpress_page_uses_rendered_content(self):
        municipalities = {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Arvika"] = [{
            "id": "jennys", "name": "Jennys", "url": "https://example.test/lunch/",
            "dataUrl": "https://example.test/wp-json/page", "dataFormat": "wordpress-page",
            "parser": "weekday-headings", "fallbackMode": "reference",
        }]
        requested = []
        output = update_lunch.build_output(
            {"municipalities": municipalities},
            datetime(2026, 9, 2, 8, tzinfo=ZoneInfo("Europe/Stockholm")),
            fetcher=lambda url: requested.append(url) or '[{"content":{"rendered":"<h2>Vecka 36</h2><h3>Onsdag</h3><p>Pannbiff med potatis</p>"}}]',
        )
        item = output["municipalities"]["Arvika"]["restaurants"][0]
        self.assertIn("https://example.test/wp-json/page", requested)
        self.assertNotIn("https://example.test/lunch/", requested)
        self.assertEqual(item["status"], "current")
        self.assertEqual(item["days"]["wednesday"], ["Pannbiff med potatis"])

    def test_reference_fallback_on_wordpress_failure(self):
        municipalities = {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Arvika"] = [{
            "id": "stefan-pa-statt", "name": "Stefan på Statt", "url": "https://example.test/lunch/",
            "dataUrl": "https://example.test/wp-json/page", "dataFormat": "wordpress-page",
            "parser": "weekday-headings", "fallbackMode": "reference",
        }]
        output = update_lunch.build_output(
            {"municipalities": municipalities},
            datetime(2026, 9, 2, 8, tzinfo=ZoneInfo("Europe/Stockholm")),
            fetcher=lambda _url: (_ for _ in ()).throw(RuntimeError("Network is unreachable")),
        )
        item = output["municipalities"]["Arvika"]["restaurants"][0]
        self.assertEqual(item["status"], "unavailable")
        self.assertEqual(item["mode"], "reference")
        self.assertEqual(item["days"], {})

    def test_weekly_extras_do_not_leak_into_friday(self):
        page = "<h2>Vecka 36</h2><h3>Fredag</h3><p>Fredagsrätt</p><h3>Veckans burgare 189kr</h3><p>Burgare</p>"
        _week, days = update_lunch.parse_weekday_menu(page)
        self.assertEqual(days["friday"], ["Fredagsrätt"])

    def test_mickans_price_metadata_is_not_exposed_as_a_dish(self):
        municipalities = {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Åmål"] = [{
            "id": "mickans-grill", "name": "Mickans Grill",
            "url": "https://example.test", "address": "Åmål",
            "hours": "11–14", "parser": "weekday-headings",
        }]
        page = "<h2>Vecka 31</h2><h3>Måndag</h3><p>$9.95</p><p>Pannbiff med potatis</p>"
        output = update_lunch.build_output(
            {"municipalities": municipalities},
            datetime(2026, 7, 27, 8, tzinfo=ZoneInfo("Europe/Stockholm")),
            fetcher=lambda _url: page,
        )
        dishes = output["municipalities"]["Åmål"]["restaurants"][0]["days"]["monday"]
        self.assertEqual(dishes, ["Pannbiff med potatis"])

    def test_hammaro_supplement_adds_verified_sources(self):
        config = {
            "municipalities": {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES},
            "referenceSources": {},
        }
        merged = update_lunch.merge_config(config)
        sources = merged["municipalities"]["Hammarö"]
        self.assertGreaterEqual(len(sources), 5)
        self.assertTrue(any(source.get("id") == "abbes-golfkrog-hammaro" for source in sources))
        self.assertTrue(merged["referenceSources"].get("Hammarö"))

    def test_duplicate_ids_are_rejected(self):
        municipalities = {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        duplicate = {"id": "same", "name": "A", "url": "https://example.test"}
        municipalities["Åmål"] = [duplicate]
        municipalities["Säffle"] = [{**duplicate, "name": "B"}]
        with self.assertRaises(ValueError):
            update_lunch.validate_config({"municipalities": municipalities})

    def test_scoped_parser_selects_named_restaurant_and_current_week(self):
        page = """<h2>Sjukhuset Karlstad</h2><h4>Solsidans matsedel vecka 40</h4><h4>Måndag</h4><p>Fel restaurang</p>
        <h2>Sjukhuset Arvika</h2><h4>Café Gnistan lunchmeny vecka 39</h4><h4>Måndag</h4><p>Gammal rätt</p>
        <h4>Café Gnistan lunchmeny vecka 40</h4><h4>Måndag</h4><p>Sprödbakad fisk med kokt potatis</p><h2>Sjukhuset Torsby</h2>"""
        week, days = update_lunch.parse_scoped_weekday_menu(page, r"Café Gnistan lunchmeny", 40)
        self.assertEqual(week, 40)
        self.assertEqual(days["monday"], ["Sprödbakad fisk med kokt potatis"])

    def test_dated_parser_rejects_stale_menu_and_accepts_current_period(self):
        page = """<h3>Lunchmeny 1 sept-5 sept</h3><h4>Måndag</h4><p>Gammal rätt</p>
        <h3>Lunchmeny 28 sept-2 okt</h3><h4>Måndag</h4><p>Stängt</p><h4>Tisdag</h4><p>Potatissoppa</p>"""
        week, days = update_lunch.parse_dated_weekday_menu(page, datetime(2026, 9, 29).date())
        self.assertEqual(week, 40)
        self.assertEqual(days["tuesday"], ["Potatissoppa"])
        stale_week, stale_days = update_lunch.parse_dated_weekday_menu(page, datetime(2026, 10, 12).date())
        self.assertIsNone(stale_week)
        self.assertFalse(any(stale_days.values()))

    def test_inactive_restaurant_is_not_published(self):
        municipalities = {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Arvika"] = [{"id":"closed","name":"Closed","url":"https://example.test","parser":"source-only","active":False}]
        output = update_lunch.build_output({"municipalities":municipalities}, datetime(2026,9,28,8,tzinfo=ZoneInfo("Europe/Stockholm")))
        self.assertEqual(output["municipalities"]["Arvika"]["restaurants"], [])

    def test_seasonal_source_has_explicit_status(self):
        municipalities = {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Arvika"] = [{"id":"golf","name":"Golf","url":"https://example.test","parser":"source-only","seasonal":True,"seasonMonths":[4,5,6,7,8,9,10]}]
        active = update_lunch.build_output({"municipalities":municipalities}, datetime(2026,9,28,8,tzinfo=ZoneInfo("Europe/Stockholm")))
        closed = update_lunch.build_output({"municipalities":municipalities}, datetime(2026,12,1,8,tzinfo=ZoneInfo("Europe/Stockholm")))
        self.assertEqual(active["municipalities"]["Arvika"]["restaurants"][0]["status"], "active")
        self.assertEqual(closed["municipalities"]["Arvika"]["restaurants"][0]["status"], "seasonally_closed")

    def test_skeppet_name_changes_only_on_effective_date(self):
        municipalities = {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Arvika"] = [{"id":"skeppet","name":"Restaurang Skeppet","nameAfter":"Restaurang Skeppet by Smak & Co","nameAfterDate":"2026-10-01","url":"https://example.test","parser":"source-only"}]
        before = update_lunch.build_output({"municipalities":municipalities}, datetime(2026,9,30,8,tzinfo=ZoneInfo("Europe/Stockholm")))
        after = update_lunch.build_output({"municipalities":municipalities}, datetime(2026,10,1,8,tzinfo=ZoneInfo("Europe/Stockholm")))
        self.assertEqual(before["municipalities"]["Arvika"]["restaurants"][0]["name"], "Restaurang Skeppet")
        self.assertEqual(after["municipalities"]["Arvika"]["restaurants"][0]["name"], "Restaurang Skeppet by Smak & Co")

    def test_parser_failure_is_isolated_and_previous_menu_is_history_only(self):
        municipalities = {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Arvika"] = [
            {"id":"broken","name":"Broken","url":"https://broken.test","parser":"weekday-headings"},
            {"id":"working","name":"Working","url":"https://working.test","parser":"weekday-headings"},
        ]
        previous={"municipalities":{"Arvika":{"restaurants":[{"id":"broken","status":"current","weekNumber":39,"checkedAt":"2026-09-21T08:00:00+02:00","days":{"monday":["Historisk rätt"]}}]}}}
        def fetcher(url):
            if "broken" in url: raise RuntimeError("timeout")
            return "<h2>Vecka 40</h2><h3>Måndag</h3><p>Ny rätt</p>"
        output=update_lunch.build_output({"municipalities":municipalities},datetime(2026,9,28,8,tzinfo=ZoneInfo("Europe/Stockholm")),fetcher,previous)
        broken,working=output["municipalities"]["Arvika"]["restaurants"]
        self.assertEqual(broken["status"],"unavailable")
        self.assertEqual(broken["days"],{})
        self.assertEqual(broken["lastSuccessfulMenu"]["days"]["monday"],["Historisk rätt"])
        self.assertEqual(working["status"],"current")
        self.assertEqual(working["days"]["monday"],["Ny rätt"])

    def test_lunchsidan_skeppet_maps_current_week_and_only_right_restaurant(self):
        page = """<h1>Restaurant Skeppet – lunchmeny och dagens lunch</h1><a>Fler lunchmenyer i Arvika</a>
        <h2>Restaurant Skeppet</h2><p>Strandvägen 2, 671 51 Arvika</p><p>Uppdaterad: 28 sep 2026 (vecka 40)</p>
        <div>Måndag Köttbullar med potatismos</div><div>Tisdag Fisk med kokt potatis</div>
        <div>Onsdag Pannbiff med gräddsås</div><div>Torsdag Idag öppnar vi i ny regi! Varmt välkomna till Restaurang Skeppet by Smak &amp; co Vår hemgjorda pannbiff</div>
        <p>Kålsoppa med nybakt bröd</p><div>Fredag Oxfilé med kantarellsås</div><p>Dessert</p>
        <h2>Hitta hit</h2><p>Öppna i Google Maps</p><h2>En annan restaurang</h2><p>Måndag Fel rätt</p>"""
        week,days=update_lunch.parse_lunchsidan_restaurant(page,r"Restaurant Skeppet","Strandvägen 2, 671 51 Arvika",[r"Idag öppnar vi i ny regi! Varmt välkomna till Restaurang Skeppet by Smak & co"])
        self.assertEqual(week,40)
        self.assertEqual(days["monday"],["Köttbullar med potatismos"])
        self.assertEqual(days["tuesday"],["Fisk med kokt potatis"])
        self.assertEqual(days["wednesday"],["Pannbiff med gräddsås"])
        self.assertEqual(days["thursday"],["Vår hemgjorda pannbiff","Kålsoppa med nybakt bröd"])
        self.assertEqual(days["friday"],["Oxfilé med kantarellsås"])
        self.assertNotIn("Fel rätt",str(days))

    def test_lunchsidan_wrong_identity_and_missing_week_are_rejected(self):
        with self.assertRaisesRegex(RuntimeError,"fel restaurang"):
            update_lunch.parse_lunchsidan_restaurant("<h1>Annat Skepp</h1><p>Strandvägen 2, 671 51 Arvika</p>",r"Restaurant Skeppet","Strandvägen 2, 671 51 Arvika")
        with self.assertRaisesRegex(RuntimeError,"veckonummer saknas"):
            update_lunch.parse_lunchsidan_restaurant("<h1>Restaurant Skeppet</h1><p>Strandvägen 2, 671 51 Arvika</p><p>Måndag Rätt</p>",r"Restaurant Skeppet","Strandvägen 2, 671 51 Arvika")

    def test_lunchsidan_old_week_never_becomes_current(self):
        municipalities = {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Arvika"]=[{"id":"skeppet","name":"Skeppet","url":"https://official.test","dataUrl":"https://menu.test","parser":"lunchsidan-restaurant","expectedNamePattern":"Restaurant Skeppet","expectedAddress":"Strandvägen 2, 671 51 Arvika"}]
        page="<h1>Restaurant Skeppet</h1><p>Strandvägen 2, 671 51 Arvika</p><p>Uppdaterad: 21 sep 2026 (vecka 39)</p><p>Måndag Gammal rätt</p>"
        item=update_lunch.build_output({"municipalities":municipalities},datetime(2026,9,28,8,tzinfo=ZoneInfo("Europe/Stockholm")),fetcher=lambda _url:page)["municipalities"]["Arvika"]["restaurants"][0]
        self.assertEqual(item["status"],"outdated")
        self.assertEqual(item["days"],{})

    def test_lunchsidan_empty_and_timeout_do_not_affect_other_restaurant(self):
        municipalities = {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Arvika"]=[
            {"id":"skeppet","name":"Skeppet","url":"https://official.test","dataUrl":"https://skeppet.test","parser":"lunchsidan-restaurant","expectedNamePattern":"Restaurant Skeppet","expectedAddress":"Strandvägen 2, 671 51 Arvika"},
            {"id":"other","name":"Other","url":"https://other.test","parser":"weekday-headings"},
        ]
        def fetcher(url):
            if "skeppet" in url: raise RuntimeError("timeout")
            return "<h2>Vecka 40</h2><h3>Måndag</h3><p>Fungerande rätt</p>"
        rows=update_lunch.build_output({"municipalities":municipalities},datetime(2026,9,28,8,tzinfo=ZoneInfo("Europe/Stockholm")),fetcher=fetcher)["municipalities"]["Arvika"]["restaurants"]
        self.assertEqual(rows[0]["status"],"unavailable")
        self.assertEqual(rows[1]["status"],"current")

    def test_lunchsidan_place_parser_isolates_rosellmagasinet(self):
        page="""
        <h2>Annat lunchställe</h2><p>Uppdaterad: 28 sep 2026 (vecka 40)</p>
        <p>Måndag Fel restaurangs rätt</p>
        <h2>Restaurang Rosellmagasinet</h2><p>Karlsbergsvägen 5, Bengtsfors</p>
        <p>Uppdaterad: 28 sep 2026 (vecka 40)</p>
        <p>Måndag Fisk i dillsås</p><p>Köttfärslimpa med gräddsås</p>
        <p>Tisdag Stekt fläsk med löksås</p>
        <p>Onsdag Pocherad fisk med smörsås</p>
        <p>Torsdag Fisksoppa</p><p>Piccata med tomatsås</p>
        <p>Fredag Fisk i ugn</p><p>Fläskfilé med pepparsås</p>
        <h2>Nästa restaurang</h2><p>Uppdaterad: 28 sep 2026 (vecka 40)</p>
        <p>Fredag Ska inte läcka in</p>
        """
        week,days=update_lunch.parse_lunchsidan_place_restaurant(page,r"Restaurang Rosellmagasinet","Karlsbergsvägen 5, Bengtsfors")
        self.assertEqual(week,40)
        self.assertEqual(days["monday"],["Fisk i dillsås","Köttfärslimpa med gräddsås"])
        self.assertEqual(days["friday"],["Fisk i ugn","Fläskfilé med pepparsås"])
        self.assertNotIn("Ska inte läcka in",sum(days.values(),[]))

    def test_lunchsidan_place_parser_rejects_wrong_address_and_stale_week(self):
        wrong="<h2>Restaurang Rosellmagasinet</h2><p>Fel adress</p><p>Uppdaterad: 28 sep 2026 (vecka 40)</p><p>Måndag Rätt</p>"
        with self.assertRaisesRegex(RuntimeError,"fel adress"):
            update_lunch.parse_lunchsidan_place_restaurant(wrong,r"Restaurang Rosellmagasinet","Karlsbergsvägen 5, Bengtsfors")
        municipalities={name:[] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Bengtsfors"]=[{"id":"rosellmagasinet","name":"Restaurang Rosellmagasinet","url":"https://official.test","dataUrl":"https://menu.test","parser":"lunchsidan-place-restaurant","expectedNamePattern":"Restaurang Rosellmagasinet","expectedAddress":"Karlsbergsvägen 5, Bengtsfors"}]
        stale="<h2>Restaurang Rosellmagasinet</h2><p>Karlsbergsvägen 5, Bengtsfors</p><p>Uppdaterad: 21 sep 2026 (vecka 39)</p><p>Måndag Gammal rätt</p>"
        item=update_lunch.build_output({"municipalities":municipalities},datetime(2026,9,28,8,tzinfo=ZoneInfo("Europe/Stockholm")),fetcher=lambda _url:stale)["municipalities"]["Bengtsfors"]["restaurants"][0]
        self.assertEqual(item["status"],"outdated")
        self.assertEqual(item["days"],{})


if __name__ == "__main__":
    unittest.main()
