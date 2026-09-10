import unittest
import json
from pathlib import Path
from unittest.mock import patch

import update_housing_launch


class FakeResponse:
    def __init__(self, markup):
        self.markup = markup.encode()
        self.headers = type("Headers", (), {"get_content_charset": lambda self: "utf-8"})()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return self.markup


class FakeOpener:
    def __init__(self, pages):
        self.pages = iter(pages)

    def open(self, request, timeout=35):
        return FakeResponse(next(self.pages))


class LaunchHousingUpdateTests(unittest.TestCase):
    def test_torsby_is_only_managed_by_active_housing_import(self):
        config = json.loads((Path(__file__).parents[1] / "data" / "housing-launch-sources.json").read_text(encoding="utf-8"))
        self.assertNotIn("Torsby", config["municipalities"])

    def test_filipstad_accepts_leading_media_cell(self):
        markup = """
        <table><tbody><tr>
          <td><a id="x_ObjectDetailsUrl" href="/ledigt/lagenhet/42"><img alt=""></a></td>
          <td>Testgatan 1</td><td>Centrum</td><td>3</td>
          <td>72 m²</td><td>7 500 kr</td><td>2026-10-01</td>
        </tr></tbody></table>
        """
        source = {
            "url": "https://www.filipstadsbostader.se/ledigt/lagenhet",
            "provider": "Filipstadsbostäder",
        }
        with (
            patch.object(update_housing_launch, "fetch_text", return_value=markup),
            patch.object(update_housing_launch, "build_opener", return_value=FakeOpener([markup])),
        ):
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

    def test_filipstad_follows_all_postback_pages_and_matches_reported_total(self):
        def page(number, total_pages, rows):
            return f'''<input type="hidden" name="__VIEWSTATE" value="page-{number}">
              <span id="x_ucNavBar_lblCurrPage">{number}</span>
              <span id="x_ucNavBar_lblNoOfPages">{total_pages}</span>
              <table>{rows}</table>'''

        def row(identifier, address):
            return f'''<tr><td><a id="x_ObjectDetailsUrl" href="detalj/id/{identifier}">{address}</a></td>
              <td>Centrum</td><td>2</td><td>60</td><td>6000</td><td>Nu</td></tr>'''

        pages = [
            page(1, 3, row("a", "Gatan 1")),
            page(2, 3, row("b", "Gatan 2")),
            page(3, 3, row("c", "Gatan 3")),
        ]
        homepage = "<p>Lägenheter: 3</p>"
        source = {"url": "https://example.test/ledigt/lagenhet", "provider": "Filipstadsbostäder"}
        with (
            patch.object(update_housing_launch, "fetch_text", return_value=homepage),
            patch.object(update_housing_launch, "build_opener", return_value=FakeOpener(pages)),
        ):
            listings = update_housing_launch.parse_filipstad(source)
        self.assertEqual([item["id"] for item in listings], ["a", "b", "c"])


if __name__ == "__main__":
    unittest.main()

