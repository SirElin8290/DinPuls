import unittest

import update_housing_forshaga


class ForshagaHousingTests(unittest.TestCase):
    def test_parses_floor_column_without_shifting_fields(self):
        markup = """
        <table><tbody><tr>
          <td><a href="/ledigt/detalj/id/6122-0006"><img alt=""></a></td>
          <td>Åsengatan 8 A</td><td>Höjda</td><td>2</td><td>50</td>
          <td>5 106</td><td>1</td><td>2026-10-01</td>
        </tr></tbody></table>
        """
        listings = update_housing_forshaga.parse_listings(markup)
        self.assertEqual(len(listings), 1)
        item = listings[0]
        self.assertEqual(item["address"], "Åsengatan 8 A")
        self.assertEqual(item["area"], "Höjda")
        self.assertEqual(item["rooms"], 2)
        self.assertEqual(item["size"], 50)
        self.assertEqual(item["rent"], 5106)
        self.assertEqual(item["floor"], 1)
        self.assertEqual(item["available"], "2026-10-01")
        self.assertEqual(item["url"], "https://minasidor.forshagabostader.se/ledigt/detalj/id/6122-0006")


if __name__ == "__main__":
    unittest.main()
