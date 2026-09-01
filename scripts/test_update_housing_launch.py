import unittest
from unittest.mock import patch

import update_housing_launch


class LaunchHousingUpdateTests(unittest.TestCase):
    def test_filipstad_accepts_leading_media_cell(self):
        markup = """
        <table><tbody><tr>
          <td><a href="/ledigt/lagenhet/42"><img alt=""></a></td>
          <td>Testgatan 1</td><td>Centrum</td><td>3</td>
          <td>72 m²</td><td>7 500 kr</td><td>2026-10-01</td>
        </tr></tbody></table>
        """
        source = {
            "url": "https://www.filipstadsbostader.se/ledigt/lagenhet",
            "provider": "Filipstadsbostäder",
        }
        with patch.object(update_housing_launch, "fetch_text", return_value=markup):
            listings = update_housing_launch.parse_filipstad(source)
        self.assertEqual(len(listings), 1)
        self.assertEqual(listings[0]["address"], "Testgatan 1")
        self.assertEqual(listings[0]["rooms"], 3)
        self.assertEqual(listings[0]["size"], 72)
        self.assertEqual(listings[0]["rent"], 7500)
        self.assertEqual(
            listings[0]["url"],
            "https://www.filipstadsbostader.se/ledigt/lagenhet/42",
        )


if __name__ == "__main__":
    unittest.main()
