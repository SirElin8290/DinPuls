#!/usr/bin/env python3
import unittest
from datetime import datetime

import sync_hagfors_municipal_news as hagfors_news


SAMPLE = '''
<html><body>
<a href="/arkiv/nyheter/2026-09-04-ny-offentlig-toalett-oppnad.html">Läs mer</a>
<a href="/arkiv/nyheter/2026-09-03-test-med-rubrik.html" title="Test med rubrik">Läs mer</a>
<a href="/undersidor/fritid-och-kultur/bio-hagfors.html">Bio</a>
</body></html>
'''


class HagforsMunicipalNewsTests(unittest.TestCase):
    def test_parses_hagfors_archive_paths_only(self):
        rows = hagfors_news.parse_listing(SAMPLE)
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(row["source"] == "Hagfors kommun" for row in rows))
        self.assertTrue(all(row["municipalities"] == ["Hagfors"] for row in rows))

    def test_generic_read_more_uses_slug_title(self):
        rows = hagfors_news.parse_listing(SAMPLE)
        row = next(item for item in rows if "toalett" in item["url"])
        self.assertEqual(row["title"], "Ny offentlig toalett oppnad")

    def test_date_comes_from_article_url(self):
        rows = hagfors_news.parse_listing(SAMPLE)
        row = next(item for item in rows if "2026-09-04" in item["url"])
        value = datetime.fromisoformat(row["publishedAt"])
        self.assertEqual((value.year, value.month, value.day), (2026, 9, 4))


if __name__ == "__main__":
    unittest.main()
