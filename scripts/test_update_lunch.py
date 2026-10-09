#!/usr/bin/env python3
import json
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

import update_lunch


class LunchUpdateTests(unittest.TestCase):
    def test_concurrent_fetches_preserve_order_and_week_validation(self):
        import threading
        import time
        municipalities={name:[] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities['Åmål']=[{'id':f'test-{i}','name':f'Restaurant {i}','url':f'https://test.invalid/{i}','parser':'weekday-headings'} for i in range(6)]
        page='<p>Lunchmeny v. 41</p><p>Måndag</p><p>Verifierad fisk med potatis</p>'
        now=datetime(2026,10,9,tzinfo=ZoneInfo('Europe/Stockholm'))
        serial=update_lunch.build_output({'municipalities':municipalities},now,fetcher=lambda _:page)
        active=peak=0
        lock=threading.Lock()
        def fetcher(url):
            nonlocal active,peak
            with lock:
                active+=1
                peak=max(peak,active)
            time.sleep(.025)
            with lock:active-=1
            return page
        parallel=update_lunch.build_output({'municipalities':municipalities},now,fetcher=fetcher,max_workers=4)
        self.assertEqual(serial,parallel)
        self.assertGreater(peak,1)
        self.assertLessEqual(peak,4)

    def test_static_all_days_menu_stops_before_weekly_buffet(self):
        page = "<h3>Alla dagar</h3><p>Pannbiff med potatismos</p><h3>Lunchbuffé V 40</h3><p>Veckans andra rätt</p>"
        week, days = update_lunch.parse_all_days_menu(page)
        self.assertEqual(week, 40)
        self.assertEqual(days["wednesday"], ["Pannbiff med potatismos"])

    def test_strict_does_not_remove_new_verified_torsby_sources(self):
        import ast
        from pathlib import Path
        source=(Path(__file__).parent/"apply_torsby_strict.py").read_text(encoding="utf-8")
        self.assertNotIn("c['updatedAt']=SRC['sourceChecked']",source)
        tree=ast.parse(source)
        start=next(i for i,n in enumerate(tree.body) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=="excluded" for t in n.targets))
        code=ast.Module(body=tree.body[start:start+2],type_ignores=[])
        namespace={"load":lambda _: {"excludedRestaurants":[{"id":"excluded"}]},"lur":{"restaurants":[{"id":"skogsstjarnan-torsby"},{"id":"valbergsangen-torsby"},{"id":"sahlstromsgarden-torsby","days":{"monday":["Verifierad rätt"]}},{"id":"excluded"}]}}
        exec(compile(code,"STRICT lunch filter","exec"),namespace)
        rows=namespace["lur"]["restaurants"]
        self.assertEqual(["skogsstjarnan-torsby","valbergsangen-torsby","sahlstromsgarden-torsby"],[r["id"] for r in rows])
        self.assertEqual({"monday":["Verifierad rätt"]},rows[2]["days"])

    def test_relative_wordpress_menu_requires_same_page_and_current_week(self):
        page='<h4>Denna vecka</h4><h4>Måndag</h4><p>Fisk med kokt potatis</p><h4>Helgmeny</h4><p>Helgens rätt</p><h4>Nästa vecka</h4><h4>Måndag</h4><p>Nästa veckas rätt</p>'
        now=datetime(2026,10,4,12,tzinfo=ZoneInfo('Europe/Stockholm'))
        url='https://example.test/meny/'
        meta=[{'link':url,'modified_gmt':'2026-09-30T11:34:41'}]
        week,days=update_lunch.parse_wordpress_relative_menu(page,meta,now,url)
        self.assertEqual(40,week)
        self.assertEqual(['Fisk med kokt potatis'],days['monday'])
        for modified in ['2026-09-20T11:00:00','2026-10-05T11:00:00','2025-09-30T11:00:00']:
            with self.assertRaises(RuntimeError):
                update_lunch.parse_wordpress_relative_menu(page,[{'link':url,'modified_gmt':modified}],now,url)
        with self.assertRaisesRegex(RuntimeError,'identitet'):
            update_lunch.parse_wordpress_relative_menu(page,[{'link':'https://wrong.test/','modified_gmt':'2026-09-30T11:34:41'}],now,url)
        with self.assertRaises(RuntimeError):
            update_lunch.parse_wordpress_relative_menu(page.replace('Denna vecka','Nästa vecka'),meta,now,url)

    def test_mashie_exact_dates_keep_current_day_and_next_week_isolated(self):
        page='<h1>Matsedel Uranus Matsal</h1><span js-date="2026-10-02"></span><section class="day-alternative"><strong>Lunch 1<span>Fredagens fisk</span></strong></section><div class="row day-current"><span js-date="2026-10-03"></span></div><section class="day-alternative"><strong>Lunch 1<span>Lördagens gryta</span></strong></section><span js-date="2026-10-05"></span><section class="day-alternative"><strong>Lunch 1<span>Nästa veckas korv</span></strong></section>'
        week,days=update_lunch.parse_mashie_menu(page,datetime(2026,10,3).date(),'Matsedel Uranus Matsal')
        self.assertEqual(40,week)
        self.assertEqual(['Fredagens fisk'],days['friday'])
        self.assertEqual(['Lördagens gryta'],days['saturday'])
        self.assertFalse(days['monday'])
        with self.assertRaisesRegex(RuntimeError,'fel matsal'):
            update_lunch.parse_mashie_menu(page,datetime(2026,10,3).date(),'Annan matsal')
        self.assertIsNone(update_lunch.parse_mashie_menu(page.replace('2026-','2025-'),datetime(2026,10,3).date(),'Matsedel Uranus Matsal')[0])

    def test_standing_pdf_excludes_a_la_carte_and_drinks(self):
        text='LUNCHMENY\n209FISK MED POTATIS\nCitron och grönsaker\n(fisk, mjölk)\nÀ LA CARTE\n229BURGER\nDRYCK\n100VIN'
        self.assertEqual(['FISK MED POTATIS – Citron och grönsaker'],update_lunch.parse_standing_pdf(text))
        with self.assertRaisesRegex(RuntimeError,'lunchmenysektion'):
            update_lunch.parse_standing_pdf('DRYCK\n100VIN')

    def test_upcoming_menu_is_preserved_without_publishing_as_current(self):
        config={'municipalities':{name:[] for name in update_lunch.EXPECTED_MUNICIPALITIES}}
        config['municipalities']['Munkfors']=[{'id':'next','name':'Meny','url':'https://example.test','parser':'weekday-headings'}]
        output=update_lunch.build_output(config,datetime(2026,10,3,tzinfo=ZoneInfo('Europe/Stockholm')),fetcher=lambda _:'<h1>Vecka 41</h1><h2>Måndag</h2><p>Kyckling med ris</p>')
        row=output['municipalities']['Munkfors']['restaurants'][0]
        self.assertEqual('upcoming',row['status'])
        self.assertEqual({},row['days'])
        self.assertEqual('2026-10-05',row['upcomingMenu']['validFrom'])
        self.assertEqual(['Kyckling med ris'],row['upcomingMenu']['days']['monday'])

    def test_menu_from_two_weeks_ahead_is_not_upcoming(self):
        config={'municipalities':{name:[] for name in update_lunch.EXPECTED_MUNICIPALITIES}}
        config['municipalities']['Munkfors']=[{'id':'later','name':'Meny','url':'https://example.test','parser':'weekday-headings'}]
        row=update_lunch.build_output(config,datetime(2026,10,3,tzinfo=ZoneInfo('Europe/Stockholm')),fetcher=lambda _:'<h1>Vecka 42</h1><h2>Måndag</h2><p>Kyckling med ris</p>')['municipalities']['Munkfors']['restaurants'][0]
        self.assertEqual('outdated',row['status'])
        self.assertNotIn('upcomingMenu',row)

    def test_source_fallback_only_after_fetch_failure(self):
        calls=[]
        def fetcher(url):
            calls.append(url)
            if url.endswith('/first'): raise RuntimeError('timeout')
            return '<p>Verifierad källa</p>'
        self.assertEqual('<p>Verifierad källa</p>',update_lunch.fetch_source({'url':'https://example.test/first','fallbackDataUrls':['https://example.test/second']},fetcher))
        self.assertEqual(['https://example.test/first','https://example.test/second'],calls)

    def test_public_menu_placeholders_and_closed_days_are_not_dishes(self):
        rows=[{'day_index':0,'dish':'Dagens rätt kommer snart','is_lunch_served':True},{'day_index':1,'dish':'Pizza och Grill','is_lunch_served':False},{'day_index':2,'dish':'Fiskgratäng','description':'med potatis','is_lunch_served':True}]
        days=update_lunch.parse_hogsater_days(rows)
        self.assertFalse(days['monday'])
        self.assertFalse(days['tuesday'])
        self.assertEqual(['Fiskgratäng – med potatis'],days['wednesday'])

    def test_standing_menu_is_never_a_current_week_menu(self):
        source={'id':'standing','name':'Restaurangen','url':'https://example.test','parser':'standing-html','expectedPagePattern':'Restaurangen','headingPattern':'Lunch','stopAfterPattern':'Dryck','menuCategories':[]}
        config={'municipalities':{name:[] for name in update_lunch.EXPECTED_MUNICIPALITIES}};config['municipalities']['Sunne']=[source]
        page='<h1>Restaurangen</h1><h2>Lunch</h2><p>Fiskgratäng</p><p>120:-</p><h2>Dryck</h2><p>Vin</p>'
        row=update_lunch.build_output(config,datetime(2026,10,3,tzinfo=ZoneInfo('Europe/Stockholm')),fetcher=lambda _:page)['municipalities']['Sunne']['restaurants'][0]
        self.assertEqual('standing_menu',row['status'])
        self.assertIsNone(row['weekNumber'])
        self.assertEqual({},row['days'])
        self.assertEqual(['Fiskgratäng'],row['standingDishes'])

    def test_image_week_label_can_span_lines_without_guessing(self):
        week,_=update_lunch.parse_ocr_menu("VECKA\n40\nFYRENDUSEUDDE.SE",{"expectedTextPattern":"FYRENDUSEUDDE"})
        self.assertEqual(40,week)
        week,_=update_lunch.parse_ocr_menu("40\nFYRENDUSEUDDE.SE",{"expectedTextPattern":"FYRENDUSEUDDE"})
        self.assertIsNone(week)

    def test_public_json_requires_exact_date_and_preserves_dishes(self):
        now=datetime(2026,10,3,tzinfo=ZoneInfo("Europe/Stockholm"))
        source={"parser":"galna-tuppen-json"}
        payload={"mode":"daily","week_start":"2026-09-28","days":[{"weekday":1,"dishes":[{"description":"Pannbiff med potatis"}]}]}
        week,days=update_lunch.fetch_structured_menu(source,now,lambda _:json.dumps(payload))
        self.assertEqual((week,days["monday"]),(40,["Pannbiff med potatis"]))
        payload["week_start"]="2025-09-29"
        with self.assertRaisesRegex(RuntimeError,"aktuell vecka"):
            update_lunch.fetch_structured_menu(source,now,lambda _:json.dumps(payload))

    def test_facility_feed_rejects_other_municipality_and_closed_days(self):
        now=datetime(2026,10,3,tzinfo=ZoneInfo("Europe/Stockholm"))
        source={"parser":"omsorgen-json","facilityId":"facility","expectedMunicipalityId":"1737","expectedFacilityName":"Skogsstjärnan"}
        payload={"ok":True,"facility":{"id":"facility","municipalityId":"1737","name":"Skogsstjärnan"},"week":{"year":2026,"weekNumber":40,"days":{"MONDAY":{"isOpen":True,"rows":[{"text":"Fiskgratäng\nPotatis"}]},"SATURDAY":{"isOpen":False,"rows":[{"text":"Gammal rätt"}]}}}}
        _,days=update_lunch.fetch_structured_menu(source,now,lambda _:json.dumps(payload))
        self.assertNotIn("saturday",days)
        payload["facility"]["municipalityId"]="1780"
        with self.assertRaisesRegex(RuntimeError,"kommun"):
            update_lunch.fetch_structured_menu(source,now,lambda _:json.dumps(payload))

    def test_pdf_selects_exact_week_and_rejects_other_year(self):
        today=datetime(2026,10,3).date()
        text="Matsedel 2026\nVecka 39\nMÅNDAG Gammal meny\nVecka 40\nMÅNDAG Fisk med potatis\nTISDAG Pannbiff med potatis\nVecka 41\nMÅNDAG Framtida meny"
        week,days=update_lunch.parse_pdf_week(text,today)
        self.assertEqual((week,days["monday"]),(40,["Fisk med potatis"]))
        with self.assertRaisesRegex(RuntimeError,"år"):
            update_lunch.parse_pdf_week(text.replace("2026","2025"),today)

    def test_curated_exclusions_are_removed_from_production_catalog(self):
        config = json.loads(update_lunch.SOURCES.read_text(encoding="utf-8"))
        merged = update_lunch.merge_config(config)
        configured_ids = {
            item["id"]
            for sources in merged["municipalities"].values()
            for item in sources
            if item.get("active") is not False
        }
        exclusions = json.loads(update_lunch.EXCLUSIONS.read_text(encoding="utf-8"))
        excluded_ids = {item["id"] for item in exclusions["excludedRestaurants"]}

        self.assertTrue(excluded_ids)
        self.assertTrue(configured_ids.isdisjoint(excluded_ids))
        self.assertEqual(46, len(configured_ids))

    def test_ocr_parser_requires_identity_and_reads_current_week(self):
        text = """Restaurang Ferrum\nVeckans meny vecka 40\nMåndag\nPannbiff med potatismos\nTisdag\nFiskgratäng med ris"""
        week,days=update_lunch.parse_ocr_menu(text,{"expectedTextPattern":r"Restaurang Ferrum"})
        self.assertEqual(week,40)
        self.assertEqual(days["monday"],["Pannbiff med potatismos"])
        self.assertEqual(days["tuesday"],["Fiskgratäng med ris"])

    def test_ocr_parser_rejects_wrong_restaurant(self):
        with self.assertRaisesRegex(RuntimeError,"identiteten"):
            update_lunch.parse_ocr_menu("Annan restaurang vecka 40\nMåndag\nPannbiff",{"expectedTextPattern":r"Ferrum"})

    def test_image_menu_without_verified_current_week_goes_to_review(self):
        municipalities={name:[] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Hagfors"]=[{"id":"image","name":"Bildmeny","url":"https://example.test","imageUrl":"https://example.test/menu.png","parser":"image-weekday-menu","expectedTextPattern":"Bildmeny"}]
        original=update_lunch.fetch_ocr_menu
        try:
            update_lunch.fetch_ocr_menu=lambda *_args,**_kwargs: (_ for _ in ()).throw(RuntimeError("OCR-identiteten kunde inte verifieras"))
            item=update_lunch.build_output({"municipalities":municipalities},datetime(2026,9,28,8,tzinfo=ZoneInfo("Europe/Stockholm")))["municipalities"]["Hagfors"]["restaurants"][0]
        finally: update_lunch.fetch_ocr_menu=original
        self.assertEqual(item["status"],"review_required")
        self.assertEqual(item["days"],{})

    def test_image_menu_with_ocr_text_but_no_week_goes_to_review(self):
        municipalities={name:[] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Hagfors"]=[{"id":"image","name":"Bildmeny","url":"https://example.test","parser":"image-weekday-menu","expectedTextPattern":"Bildmeny"}]
        original=update_lunch.fetch_ocr_menu
        try:
            update_lunch.fetch_ocr_menu=lambda *_args,**_kwargs: (None,{"monday":["Pannbiff"]},"https://example.test/menu.png")
            item=update_lunch.build_output({"municipalities":municipalities},datetime(2026,9,28,8,tzinfo=ZoneInfo("Europe/Stockholm")))["municipalities"]["Hagfors"]["restaurants"][0]
        finally: update_lunch.fetch_ocr_menu=original
        self.assertEqual(item["status"],"review_required")
        self.assertEqual(item["sourceAsset"],"https://example.test/menu.png")
        self.assertEqual(item["days"],{})

    def test_image_menu_requires_identity_check_in_config(self):
        municipalities={name:[] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Hagfors"]=[{"id":"unsafe","name":"Unsafe","url":"https://example.test","parser":"image-weekday-menu"}]
        with self.assertRaisesRegex(ValueError,"identitetskontroll"):
            update_lunch.validate_config({"municipalities":municipalities})

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

    def test_eds_bowlinghall_current_week_stops_before_a_la_carte(self):
        page="""<p>Måndag - Fredag 11:00 - 14:00</p><h2>Lunchen vecka 40</h2><p>Lunchbuffé 139:-</p>
        <p>Måndag: Köttbullar med gräddsås serveras med mos</p>
        <p>Tisdag: Korvstroganoff serveras med ris</p>
        <p>Onsdag: Gulaschsoppa på köttfärs. Pannkakor med grädde &amp; sylt</p>
        <p>Torsdag: Baconröra serveras med pasta</p>
        <p>Fredag: Kycklingfilé i rosépepparsås serveras med råstekt potatis</p>
        <h3>Crispy chicken burger med pommes 169kr</h3><p>Bowlingburgare 169kr</p>"""
        week,days=update_lunch.parse_weekday_menu(page,r"^Crispy chicken burger")
        self.assertEqual(week,40)
        self.assertEqual(days["monday"],["Köttbullar med gräddsås serveras med mos"])
        self.assertEqual(days["wednesday"],["Gulaschsoppa på köttfärs. Pannkakor med grädde & sylt"])
        self.assertEqual(days["friday"],["Kycklingfilé i rosépepparsås serveras med råstekt potatis"])

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

    def test_hammaro_supplement_keeps_only_verified_menu_sources(self):
        config = {
            "municipalities": {name: [] for name in update_lunch.EXPECTED_MUNICIPALITIES},
            "referenceSources": {},
        }
        merged = update_lunch.merge_config(config)
        sources = merged["municipalities"]["Hammarö"]
        self.assertEqual(
            {"skoghalls-folkets-hus-restaurang", "ica-supermarket-skoghall", "glg-lysasen"},
            {item["id"] for item in sources},
        )
        self.assertTrue(merged["referenceSources"].get("Hammarö"))

    def test_source_only_season_uses_exact_date_window(self):
        municipalities={name:[] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Dals-Ed"]=[{"id":"seasonal","name":"Seasonal","url":"https://example.test","parser":"source-only","seasonal":True,"seasonStart":"05-01","seasonEnd":"09-15"}]
        before=update_lunch.build_output({"municipalities":municipalities},datetime(2026,9,14,8,tzinfo=ZoneInfo("Europe/Stockholm")))
        after=update_lunch.build_output({"municipalities":municipalities},datetime(2026,9,29,8,tzinfo=ZoneInfo("Europe/Stockholm")))
        self.assertEqual(before["municipalities"]["Dals-Ed"]["restaurants"][0]["status"],"active")
        self.assertEqual(after["municipalities"]["Dals-Ed"]["restaurants"][0]["status"],"seasonally_closed")

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

class CalendarMenuTests(unittest.TestCase):
    def test_current_dates_exclude_next_week_and_footer(self):
        page="<p>Måndag 28 september</p><p>Fisk med potatis</p><p>Fredag 2 oktober</p><p>Kyckling med ris</p><p>Sidfot</p><p>Reklamtext</p><p>Måndag 5 oktober</p><p>Nästa veckas rätt</p>"
        week,days=update_lunch.parse_calendar_week_menu(page,datetime(2026,10,3).date(),"Sidfot")
        self.assertEqual(week,40);self.assertEqual(days["monday"],["Fisk med potatis"]);self.assertEqual(days["friday"],["Kyckling med ris"])

    def test_wrong_weekday_and_stale_dates_are_rejected(self):
        week,days=update_lunch.parse_calendar_week_menu("<p>Måndag 29 september</p><p>Fel datumrätt</p><p>Tisdag 22 september</p><p>Gammal rätt</p>",datetime(2026,10,3).date())
        self.assertIsNone(week);self.assertFalse(any(days.values()))

    def test_next_week_and_year_boundary(self):
        week,days=update_lunch.parse_calendar_week_menu("<p>Måndag 5/10</p><p>Framtida fisk</p>",datetime(2026,10,3).date())
        self.assertIsNone(week);self.assertFalse(any(days.values()))
        week,days=update_lunch.parse_calendar_week_menu("<p>Torsdag 1 januari</p><p>Nyårsfisk med potatis</p>",datetime(2025,12,29).date())
        self.assertEqual(week,1);self.assertTrue(days["thursday"])

    def test_closure_and_unknown_season_do_not_publish_dishes(self):
        municipalities={name:[] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities["Åmål"]=[{"id":"closed","name":"Closed","url":"https://official.test","parser":"weekday-headings","closedTextPattern":"dagens lunch stängt"},{"id":"season","name":"Season","url":"https://official.test","parser":"source-only","seasonal":True}]
        page="<p>Vecka 40</p><p>Vi håller dagens lunch stängt</p><p>Måndag</p><p>Gammal fisk med potatis</p>"
        rows=update_lunch.build_output({"municipalities":municipalities},datetime(2026,10,3,tzinfo=ZoneInfo("Europe/Stockholm")),fetcher=lambda url:page)["municipalities"]["Åmål"]["restaurants"]
        self.assertEqual(rows[0]["days"],{});self.assertEqual(rows[0]["status"],"unavailable");self.assertTrue(rows[0]["closureNotice"])
        self.assertEqual(rows[1]["status"],"reference")

    def test_compact_week_notation(self):
        self.assertEqual(update_lunch.extract_week(["Dagens Lunch V40"]),40)
        self.assertEqual(update_lunch.extract_week(["Lunchmeny v 40"]),40)
        self.assertIsNone(update_lunch.extract_week(["Lunchmeny v 400"]))

    def test_recurring_even_and_odd_are_isolated(self):
        page="<h2>Jämn vecka</h2><p>Måndag</p><p>Jämn veckas fisk</p><h2>Ojämn vecka</h2><p>Måndag</p><p>Ojämn veckas kyckling</p><p>Nyfiken på köttet?</p><p>Kontaktinformation</p>"
        self.assertEqual(update_lunch.parse_rotating_week_menu(page,datetime(2026,10,3).date())[1]["monday"],["Jämn veckas fisk"])
        self.assertEqual(update_lunch.parse_rotating_week_menu(page,datetime(2026,10,5).date())[1]["monday"],["Ojämn veckas kyckling"])


class PublicSocialMenuTests(unittest.TestCase):
    def test_public_actor_reposts_and_adverts_are_isolated(self):
        def story(actor="own",**extra): return {"__typename":"Story","creation_time":1790882411,"actors":[{"id":actor}],**extra}
        import json
        page='<script type="application/json">'+json.dumps([story(),story("other"),story(sponsored_data={"id":"ad"}),story(attached_story={"id":"repost"})])+'</script>'
        self.assertEqual(len(update_lunch.public_menu_posts(page,"own")),1)

    def test_social_date_requires_year_weekday_and_fresh_publication(self):
        from datetime import date
        actual=date(2026,10,3);published=date(2026,10,1)
        self.assertEqual(update_lunch.parse_public_image_date("Fredag 2/10/2026",published,actual),(date(2026,10,2),"friday"))
        for text in ["Fredag 3/10/2026","Fredag 2/10","Fredag 25/9/2026","Fredag 2/10/2025"]:
            with self.assertRaises(RuntimeError): update_lunch.parse_public_image_date(text,published,actual)


class RetainedMenuTests(unittest.TestCase):
    def setUp(self):
        self.now=datetime(2026,10,3,20,tzinfo=ZoneInfo("Europe/Stockholm"))
        self.previous={"status":"current","url":"https://official.test","parser":"weekday-headings","checkedAt":"2026-10-03T19:00:00+02:00","weekNumber":40,"days":{"monday":["Verifierad fisk"]}}
        self.item={"status":"unavailable","url":"https://official.test","parser":"weekday-headings","error":"timeout","fetchFailure":True,"days":{}}
    def test_same_week_network_failure_keeps_verified_dishes_and_original_time(self):
        update_lunch.retain_verified_week(self.item,self.previous,self.now)
        self.assertEqual(self.item["status"],"current");self.assertEqual(self.item["days"],self.previous["days"])
        self.assertEqual(self.item["checkedAt"],self.previous["checkedAt"]);self.assertEqual(self.item["fetchWarning"],"timeout")
    def test_validation_failure_is_not_overridden(self):
        self.item.pop("fetchFailure");update_lunch.retain_verified_week(self.item,self.previous,self.now)
        self.assertEqual(self.item["days"],{})
    def test_next_week_never_keeps_old_dishes(self):
        update_lunch.retain_verified_week(self.item,self.previous,datetime(2026,10,5,10,tzinfo=ZoneInfo("Europe/Stockholm")))
        self.assertEqual(self.item["days"],{})
    def test_real_outdated_source_is_not_overridden(self):
        self.item["status"]="outdated";update_lunch.retain_verified_week(self.item,self.previous,self.now)
        self.assertEqual(self.item["days"],{})
    def test_source_changes_are_not_overridden(self):
        self.item["url"]="https://changed.test";update_lunch.retain_verified_week(self.item,self.previous,self.now)
        self.assertEqual(self.item["days"],{})
    def test_future_or_wrong_year_verification_is_not_retained(self):
        for timestamp in ["2026-10-03T21:00:00+02:00","2025-10-02T19:00:00+02:00"]:
            self.previous["checkedAt"]=timestamp;update_lunch.retain_verified_week(self.item,self.previous,self.now)
            self.assertEqual(self.item["days"],{})


class AdditionalPublicLunchTests(unittest.TestCase):
    WEEK="VECKA 40\nMån 28/9\nPasta\nTis 29/9\nFläsk\nOns 30/9\nLax\nTor 1/10\nPannbiff\nFre 2/10\nSchnitzel"
    def test_public_week_image_requires_all_dates(self):
        from datetime import date
        self.assertEqual(update_lunch.parse_public_week_image(self.WEEK,date(2026,9,28),date(2026,10,3)),40)
        for wrong in [self.WEEK.replace("Ons 30/9","Ons 29/9"),self.WEEK.replace("VECKA 40","VECKA 41"),self.WEEK.replace("Mån 28/9","Mån 28/9/2025"),self.WEEK.replace("Fre 2/10","Fre")]:
            with self.assertRaises(RuntimeError): update_lunch.parse_public_week_image(wrong,date(2026,9,28),date(2026,10,3))
    def test_public_next_week_image_is_verified_separately(self):
        from datetime import date
        text="VECKA 41\nMån 5/10\nTis 6/10\nOns 7/10\nTor 8/10\nFre 9/10"
        self.assertEqual(update_lunch.parse_public_week_image(text,date(2026,10,3),date(2026,10,3)),41)
    def test_public_message_never_reads_comments(self):
        self.assertEqual(update_lunch.public_post_message({"feedback":{"text":"Dagens lunch idag är fake fisk"}}),"")
    def test_daily_public_text_belongs_only_to_publication_day(self):
        import json
        post={"__typename":"Story","actors":[{"id":"own"}],"creation_time":int(datetime(2026,10,2,12,tzinfo=ZoneInfo("Europe/Stockholm")).timestamp()),"message":{"text":"Dagen lunch idag är Flapsteak Sandwich 😋 välkomna!"}}
        page='<script type="application/json">'+json.dumps(post)+'</script>'
        source={"url":"https://public.test","publicActorId":"own"}
        now=datetime(2026,10,3,tzinfo=ZoneInfo("Europe/Stockholm"))
        week,days,_,date=update_lunch.fetch_public_social_text(source,now,page_fetcher=lambda _:page)
        self.assertEqual(week,40);self.assertEqual(days,{"friday":["Flapsteak Sandwich"]});self.assertEqual(date,"2026-10-02")
        with self.assertRaises(RuntimeError):update_lunch.fetch_public_social_text(source,datetime(2026,10,5,tzinfo=ZoneInfo("Europe/Stockholm")),page_fetcher=lambda _:page)
    def test_hagfors_only_lunch_classes_are_extracted(self):
        text='<p>PRISKLASS 1. 85 :- FAMILJEPIZZA 210:-1. MARGARETA ost2. VESUVIO skinka</p><p>PRISKLASS 2. 90:- FAMILJEPIZZA 220:-</p><p>3. HAWAII skinka, ananas</p><p>PRISKLASS 3. 95:- FAMILJEPIZZA 225:-</p><p>4. VEGETARIANA grönsaker</p><p>PRISKLASS 4 100:- FAMILJEPIZZA 255:-</p><p>5. INDIA kyckling</p><p>Pizzor med fläskfilé 105:-</p><p>6. Inte lunch</p>'
        dishes=update_lunch.parse_hagfors_lunch_pizzas(text)
        self.assertEqual(len(dishes),5);self.assertEqual(dishes[0],"MARGARETA ost");self.assertFalse(any('Inte lunch' in d or '85' in d for d in dishes))
        with self.assertRaises(RuntimeError):update_lunch.parse_hagfors_lunch_pizzas(text.replace('PRISKLASS 4','PRISKLASS 5'))

    def test_ramo_only_explicit_lunch_products(self):
        page='<p>Pizzeria Ramo i Forshaga Storgatan 2, 667 30 Forshaga</p><article><h2>KEBABTALLRIK</h2><p>LUNCHPAKET med sås</p></article><article><h2>OXFILÉ</h2><p>Middag</p></article>'
        self.assertEqual(update_lunch.parse_ramo_lunch(page),['KEBABTALLRIK'])
        with self.assertRaises(RuntimeError):update_lunch.parse_ramo_lunch(page.replace('Forshaga','Karlstad'))
    def test_scan_images_prefers_current_week_and_rejects_stale(self):
        page='<title>Dalslands Skafferi</title><img src="https://static.wixstatic.com/next.jpg"><img src="https://static.wixstatic.com/current.jpg">'
        source={'url':'https://restaurant.test','scanMenuImages':True,'expectedPagePattern':'Dalslands Skafferi','expectedTextPattern':'DAGENS LUNCH'}
        def ocr(payload):return 'DAGENS LUNCH VECKA '+('41' if payload==b'next' else '40')+'\nMÅNDAG (varje måndag)\nPannbiff med potatis\nTisdag\nStekt fisk'
        now=datetime(2026,10,3,tzinfo=ZoneInfo('Europe/Stockholm'))
        result=update_lunch.fetch_ocr_menu(source,page_fetcher=lambda _:page,binary_fetcher=lambda url:b'next' if 'next' in url else b'current',ocr_runner=ocr,now=now)
        self.assertEqual(result[0],40);self.assertEqual(result[1]['monday'],['Pannbiff med potatis'])
        with self.assertRaises(RuntimeError):update_lunch.fetch_ocr_menu(source,page_fetcher=lambda _:page,binary_fetcher=lambda _:b'current',ocr_runner=ocr,now=datetime(2026,10,12,tzinfo=ZoneInfo('Europe/Stockholm')))

    def test_source_filter_removes_unspecified_choices_and_duplicates(self):
        municipalities={name:[] for name in update_lunch.EXPECTED_MUNICIPALITIES}
        municipalities['Hammarö']=[{'id':'glg-test','name':'GLG','url':'https://test.invalid','parser':'weekday-headings','excludeDishPattern':'^Kökets val','stopAfterPattern':'^Varje dag'}]
        page='<p>Lunchmeny v. 40</p><p>Måndag</p><p>Panerad fisk med potatis</p><p>Panerad fisk med potatis</p><p>Kökets val ett alternativ varje dag</p><p>Varje dag</p><p>Middag</p>'
        result=update_lunch.build_output({'municipalities':municipalities},datetime(2026,10,3,tzinfo=ZoneInfo('Europe/Stockholm')),fetcher=lambda _:page)
        self.assertEqual(result['municipalities']['Hammarö']['restaurants'][0]['days']['monday'],['Panerad fisk med potatis'])


if __name__ == "__main__":
    unittest.main()
