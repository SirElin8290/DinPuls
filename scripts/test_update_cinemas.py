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


if __name__ == "__main__":
    unittest.main()
