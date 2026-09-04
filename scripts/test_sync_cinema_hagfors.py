#!/usr/bin/env python3
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

import sync_cinema_hagfors_from_varmland as hagfors

TZ = ZoneInfo("Europe/Stockholm")

INDEX = '''
<html><body>
<a href="https://www.varmland.bio/produktion/testfilmen/">Testfilmen</a>
<a href="/produktion/testfilmen/">Testfilmen</a>
</body></html>
'''

PRODUCTION = '''
<html><body>
<h1>Testfilmen</h1>
<h3>Föreställningar</h3>
<div>5 september, 2026</div><div>19:00</div><div>Salongen</div><div>Hagfors Bio Fasaden</div><div>0,00</div>
<div>6 september, 2026</div><div>17:30</div><div>Salong Bro</div><div>Bio Bistro Kristinehamn</div><div>120,00</div>
<div>1 september, 2026</div><div>18:00</div><div>Salongen</div><div>Hagfors Bio Fasaden</div><div>0,00</div>
</body></html>
'''


class HagforsCinemaTests(unittest.TestCase):
    def test_production_links_are_deduplicated(self):
        links = hagfors.production_links(INDEX)
        self.assertEqual(links, [("Testfilmen", "https://www.varmland.bio/produktion/testfilmen/")])

    def test_only_future_hagfors_showtimes_are_kept(self):
        now = datetime(2026, 9, 4, 7, 0, tzinfo=TZ)
        values = hagfors.parse_showtimes(PRODUCTION, now)
        self.assertEqual([value.isoformat(timespec="minutes") for value in values], ["2026-09-05T19:00+02:00"])


if __name__ == "__main__":
    unittest.main()
