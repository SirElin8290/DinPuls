#!/usr/bin/env python3
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo
import update_cinemas


class CinemaTests(unittest.TestCase):
    def test_expired_showtimes_are_removed(self):
        page = "<h2>Film A</h2><p>onsdag 02 september 19:00</p><p>söndag 06 september 19:00</p>"
        films = update_cinemas.parse_program(page, datetime(2026, 9, 2, 20, tzinfo=ZoneInfo("Europe/Stockholm")))
        self.assertEqual([film["title"] for film in films], ["Film A"])
        self.assertEqual(films[0]["showtimes"], ["2026-09-06T19:00+02:00"])

    def test_film_without_future_showtime_is_removed(self):
        page = "<h2>Gammal film</h2><p>söndag 30 augusti 19:00</p>"
        films = update_cinemas.parse_program(page, datetime(2026, 9, 2, 20, tzinfo=ZoneInfo("Europe/Stockholm")))
        self.assertEqual(films, [])

    def test_new_year_is_inferred_for_winter_program(self):
        value = update_cinemas.parse_datetime("lördag 23 januari 19:00", datetime(2026, 9, 2, tzinfo=ZoneInfo("Europe/Stockholm")))
        self.assertEqual(value.year, 2027)



class AmalCinemaTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 4, 12, tzinfo=ZoneInfo('Europe/Stockholm'))
        self.identity = {'id':13875, 'slug':'saga-amal', 'city':'Åmål'}
        self.payload = {'movies':[{'movie':{'id':42,'title':'Testfilm'}, 'sessions':[
            {'show_date_time':'2026-11-03T18:00:00','payment_link':'/bokning/cinemaId/13875/sessionId/1'},
            {'show_date_time':'2026-11-06T18:00:00','payment_link':'/bokning/cinemaId/13875/sessionId/2'}]}]}
    def test_future_local_times_only(self):
        films = update_cinemas.parse_amal_program(self.identity,self.payload,self.now)
        self.assertEqual(films[0]['showtimes'],['2026-11-06T18:00+01:00'])
        self.assertEqual(films[0]['url'],'https://bio.se/biografer/saga-amal')
    def test_wrong_cinema_rejected(self):
        with self.assertRaises(ValueError):
            update_cinemas.parse_amal_program({**self.identity,'id':1},self.payload,self.now)
        self.payload['movies'][0]['sessions'][0]['payment_link']='/bokning/cinemaId/99/sessionId/1'
        with self.assertRaises(ValueError):
            update_cinemas.parse_amal_program(self.identity,self.payload,self.now)
    def test_missing_list_is_not_empty_program(self):
        with self.assertRaises(ValueError): update_cinemas.parse_amal_program(self.identity,{},self.now)
        self.assertEqual(update_cinemas.parse_amal_program(self.identity,{'movies':[]},self.now),[])

if __name__ == "__main__":
    unittest.main()
