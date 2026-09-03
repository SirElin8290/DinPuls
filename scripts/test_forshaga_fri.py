import unittest
import json
from pathlib import Path

import apply_forshaga_fri


class ForshagaFriTests(unittest.TestCase):
    def test_launch_supplement_does_not_reintroduce_short_name_duplicates(self):
        data = Path(__file__).resolve().parents[1] / "data"
        launch = json.loads((data / "association-launch-supplement.json").read_text(encoding="utf-8"))
        existing = [
            {"name": "Deje Idrottsklubb", "sports": ["Fotboll"], "url": "https://www.dejeik.se/"},
            {"name": "Forshaga Idrottsförening", "sports": ["Fotboll", "Ishockey"], "url": "https://www.forshagaif.se"},
        ]
        merged = apply_forshaga_fri.merge_named(existing, launch["municipalities"]["Forshaga"]["clubs"])
        self.assertEqual(len(merged), 4)
        self.assertNotIn("Deje IK", {club["name"] for club in merged})
        self.assertNotIn("Forshaga IF", {club["name"] for club in merged})
        self.assertIn("Ishockey", next(club for club in merged if club["name"] == "Forshaga Idrottsförening")["sports"])

    def test_parse_registry_rows_and_classify_sport(self):
        markup = """
        <table><tbody>
          <tr><th>Namn</th><th>Typ</th><th>Aktivitet</th><th>Hemsida</th></tr>
          <tr>
            <td><a href="visapublik.aspx?id=DIK">Deje Idrottsklubb</a></td>
            <td>Idrottsförening</td><td>Fotboll</td>
            <td><a href="https://www.dejeik.se/">dejeik.se</a></td>
          </tr>
          <tr>
            <td><a href="visapublik.aspx?id=DM">Dejefors Musikkår</a></td>
            <td>Kulturförening</td><td>Kulturverksamhet, Musik, Orkester</td><td></td>
          </tr>
        </tbody></table>
        """
        rows = apply_forshaga_fri.parse_page(markup)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["name"], "Deje Idrottsklubb")
        self.assertEqual(rows[0]["url"], "https://www.dejeik.se/")
        self.assertEqual(apply_forshaga_fri.sport_names(rows[0]["activity"], rows[0]["associationType"]), ["Fotboll"])
        category, label, _ = apply_forshaga_fri.leisure_meta(rows[1]["activity"], rows[1]["associationType"])
        self.assertEqual(category, "musik")
        self.assertIn("Musik", label)


if __name__ == "__main__":
    unittest.main()
