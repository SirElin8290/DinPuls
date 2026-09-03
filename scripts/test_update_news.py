import unittest
import json
import tempfile
from pathlib import Path
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import update_news


class NewsUpdateTests(unittest.TestCase):
    def test_empty_feed_keeps_recent_articles_but_expires_old_ones(self):
        now = datetime.now(timezone.utc)
        recent = {"id": "feed-recent", "scope": "local", "source": "Forshaga feed",
                  "title": "Lokala nyheter", "url": "https://example.se/recent",
                  "municipalities": ["Forshaga"], "publishedAt": (now - timedelta(days=1)).isoformat()}
        old = dict(recent, id="feed-old", url="https://example.se/old", publishedAt=(now - timedelta(days=30)).isoformat())
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "news.json"
            path.write_text(json.dumps({"articles": [recent, old]}), encoding="utf-8")
            with patch.object(update_news, "NEWS", path), \
                 patch.object(update_news, "FEEDS", [{"source": "Forshaga feed"}]), \
                 patch.object(update_news, "LOCAL_SEARCH_FEEDS", []), \
                 patch.object(update_news, "LOCAL_LISTINGS", []), \
                 patch.object(update_news, "fetch_feed", return_value=[]), \
                 patch.object(update_news, "fetch_police_events", return_value=[]):
                self.assertEqual(update_news.main(), 0)
            output = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(output["articles"], [recent])
        self.assertTrue(output["sourceStatus"]["errors"])
        self.assertNotIn("Forshaga feed", output["sourceStatus"]["successful"])

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

    def test_regional_story_is_not_local_without_place_match(self):
        article = {"title": "Olycka utanför Tjörn", "summary": "En händelse i skärgården", "url": "https://example.se/tjorn"}
        self.assertEqual(update_news.article_municipalities(article), [])

    def test_small_local_story_is_local_even_without_high_impact(self):
        article = {"title": "Ny garnsatsning i Åmål", "summary": "En lokal förening samlar stickare", "url": "https://example.se/garn"}
        self.assertEqual(update_news.article_municipalities(article), ["Åmål"])

    def test_haverud_belongs_to_mellerud(self):
        article = {"title": "Utställning öppnar i Håverud", "summary": "", "url": "https://example.se/haverud"}
        self.assertEqual(update_news.article_municipalities(article), ["Mellerud"])

    def test_valberg_is_correctly_mapped_to_karlstad(self):
        article = {"title": "Nyheter från Brålanda och Vålberg", "summary": "", "url": "https://example.se/region"}
        self.assertEqual(update_news.article_municipalities(article), ["Karlstad"])

    def test_every_municipality_has_local_sources(self):
        covered = {municipality for source in update_news.SOURCE_DIRECTORY if source["scope"] == "local" for municipality in source["municipalities"]}
        self.assertEqual(covered, set(update_news.MUNICIPALITIES))

    def test_national_and_world_sources_are_directory_only(self):
        scopes = {source["scope"] for source in update_news.SOURCE_DIRECTORY}
        self.assertTrue({"sweden", "world"}.issubset(scopes))


if __name__ == "__main__":
    unittest.main()
