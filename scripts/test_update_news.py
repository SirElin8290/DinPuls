import unittest

import update_news


class NewsUpdateTests(unittest.TestCase):
    def test_police_event_matches_exact_municipality(self):
        event = {"location": {"name": "Arvika"}, "name": "Trafikolycka", "summary": "Centrala Arvika"}
        self.assertEqual(update_news.event_municipalities(event), ["Arvika"])

    def test_police_event_matches_smaller_place(self):
        event = {"location": {"name": "Värmlands län"}, "summary": "Händelse i Töcksfors"}
        self.assertEqual(update_news.event_municipalities(event), ["Årjäng"])

    def test_unrelated_event_is_excluded(self):
        event = {"location": {"name": "Stockholm"}, "summary": "Händelse på Södermalm"}
        self.assertEqual(update_news.event_municipalities(event), [])

    def test_html_is_removed_from_summary(self):
        self.assertEqual(update_news.clean_text("<p>Lokalt <b>meddelande</b></p>"), "Lokalt meddelande")


if __name__ == "__main__":
    unittest.main()
