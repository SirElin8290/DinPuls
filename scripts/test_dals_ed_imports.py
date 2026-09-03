import copy
import io
import json
import unittest
from datetime import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

import update_housing as housing
import update_cinemas as cinema
import update_dals_ed_events as events


class DalsEdTests(unittest.TestCase):
    def provider(self):
        return {"name": "Edshus AB", "url": "https://bostad.edshus.se/properties", "dataUrl": "https://api.example/homeinfo/filter"}

    def response(self, items, total=None):
        return io.BytesIO(json.dumps({"data": {"items": items, "totalResults": len(items) if total is None else total}}).encode())

    def test_housing_fields_pagination_dedup_and_request(self):
        item = {"id": "one", "header": "Testgatan 1", "category": 0, "numberOfRooms": 2,
                "squareMeters": 60, "monthlyRent": {"amount": 5000}, "searchTags": ["Centrum"],
                "vacantFrom": {"year": 2026, "month": 10, "day": 1}}
        other = {**item, "id": "two"}
        parking = {**item, "id": "parking", "category": 1}
        with patch.object(housing, "urlopen", side_effect=[self.response([item], 3), self.response([item, other, parking], 3)]) as fetch:
            rows = housing.parse_hogia(self.provider())
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["rent"], 5000)
        self.assertEqual(rows[0]["available"], "2026-10-01")
        self.assertEqual(rows[0]["url"], "https://bostad.edshus.se/properties/p/one")
        request = fetch.call_args_list[0].args[0]
        self.assertEqual(request.get_header("Origin"), "https://bostad.edshus.se")
        self.assertEqual(request.get_method(), "POST")

    def test_housing_empty_is_valid_but_malformed_is_not(self):
        with patch.object(housing, "urlopen", return_value=self.response([])):
            self.assertEqual(housing.parse_hogia(self.provider()), [])
        with patch.object(housing, "urlopen", return_value=io.BytesIO(b'{"data":{}}')):
            with self.assertRaises(RuntimeError):
                housing.parse_hogia(self.provider())
        with patch.object(housing, "urlopen", return_value=self.response([], 2)):
            with self.assertRaises(RuntimeError):
                housing.parse_hogia(self.provider())

    def feed(self, dates):
        return '<rss><channel>' + ''.join(f'<item><title>Film</title><link>https://www.dalsed.se/uppleva-och-gora/evenemang/film/</link><pubDate>{date}</pubDate></item>' for date in dates) + '</channel></rss>'

    def test_cinema_timezone_expiry_and_dedup(self):
        now = datetime(2026, 9, 20, 17, tzinfo=ZoneInfo("Europe/Stockholm"))
        feed = self.feed(["Sun, 20 Sep 2026 14:30:00 GMT", "Sun, 27 Sep 2026 17:00:00 GMT", "Sun, 27 Sep 2026 17:00:00 GMT"])
        self.assertEqual(cinema.parse_svea_program(feed, now)[0]["showtimes"], ["2026-09-27T19:00+02:00"])
        self.assertEqual(cinema.parse_svea_program(self.feed([]), now), [])
        with self.assertRaises(ValueError):
            cinema.parse_svea_program('<html/>', now)

    def test_cinema_failure_removes_stale_manual_films_only_for_svea(self):
        data = {"municipalities": {"Dals-Ed": [{"name": "Svea Bio", "films": [{"title": "Old"}]}], "Other": [{"films": [1]}]}}
        old = copy.deepcopy(data["municipalities"]["Other"])
        with patch.object(cinema, "fetch", side_effect=TimeoutError):
            cinema.update_svea(data, datetime.now(ZoneInfo("Europe/Stockholm")))
        self.assertEqual(data["municipalities"]["Dals-Ed"][0]["films"], [])
        self.assertEqual(data["municipalities"]["Other"], old)

    def card(self, date):
        return '<li class="mb-3 pb-3 border-bottom"><a href="/uppleva-och-gora/evenemang/test/"></a><p>' + date + '</p><p class="fs-5 fw-bold">Konstutställning</p></li>'

    def test_events_direct_link_repeat_dates_expiry_and_invalid(self):
        rows = events.parse_events(self.card('Söndag 20 september 2099 16:30') + self.card('Söndag 20 september 2099 16:30') + self.card('Måndag 1 januari 2020'))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["url"], 'https://www.dalsed.se/uppleva-och-gora/evenemang/test/')
        self.assertEqual(rows[0]["category"], 'culture')
        self.assertEqual(events.parse_events(self.card('Måndag 1 januari 2020')), [])
        self.assertEqual(events.parse_events('<ul/>', empty_verified=True), [])
        for page in ['<html>Error</html>', self.card('Invalid date')]:
            with self.assertRaises(ValueError):
                events.parse_events(page)

    def test_venue(self):
        self.assertEqual(events.venue_from_page('<a href="https://www.google.se/maps/search/?api=1&amp;query=1,2">Svea Bio, Ed</a>'), 'Svea Bio, Ed')


if __name__ == '__main__':
    unittest.main()
