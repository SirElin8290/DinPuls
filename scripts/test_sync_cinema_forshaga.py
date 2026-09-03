import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

import sync_cinema_forshaga_from_events as sync


class ForshagaCinemaSyncTests(unittest.TestCase):
    def test_extracts_future_forshaga_bio_and_filters_other_events(self):
        now = datetime(2026, 9, 3, 12, 0, tzinfo=ZoneInfo("Europe/Stockholm"))
        events = [
            {"title":"Bio: Toy Story 5","startDate":"2026-09-20","time":"16:00–00:00","venue":"Forshaga Folkets hus","url":"https://example.test/toy"},
            {"title":"Bio: Toy Story 5","startDate":"2026-09-27","time":"16:00–00:00","venue":"Forshaga Folkets hus","url":"https://example.test/toy"},
            {"title":"Familjedag","startDate":"2026-09-05","time":"11:00–15:00","venue":"Forshaga centrum"},
            {"title":"Bio: Gammal film","startDate":"2026-09-01","time":"19:00–00:00","venue":"Forshaga Folkets hus"},
            {"title":"Bio: Annan ort","startDate":"2026-09-20","time":"18:00–00:00","venue":"Skoghalls Folkets hus"},
        ]
        films = sync.extract_films(events, now=now)
        self.assertEqual(len(films), 1)
        self.assertEqual(films[0]["title"], "Toy Story 5")
        self.assertEqual(len(films[0]["showtimes"]), 2)
        self.assertTrue(all(value.startswith("2026-09-") for value in films[0]["showtimes"]))


if __name__ == "__main__":
    unittest.main()
