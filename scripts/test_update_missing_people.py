#!/usr/bin/env python3
import unittest

import update_missing_people as missing


SAMPLE = """
<article class="person mix region--fyrbodal">
  <h5 class="card-title">Försvunnen man</h5>
  <div class="person__location">TÖSSE</div>
  <time class="person__date" datetime="2026-08-17">2026-08-17</time>
  <p class="person__ingress">Har någon sett den försvunne mannen?</p>
  <a class="person__link" href="/efterlysningar/forsvunnen-man/">Läs mer</a>
</article>
<article class="person mix region--varmland">
  <h5 class="card-title">Bengt</h5><div class="person__location">GRUMS</div>
  <time class="person__date" datetime="2026-05-11">2026-05-11</time>
  <p class="person__ingress">Efterlysningen är fortfarande publicerad.</p>
  <a class="person__link" href="/efterlysningar/bengt-1/">Läs mer</a>
</article>
"""

HAGFORS_NEIGHBOR_SAMPLE = """
<article class="person mix region--varmland">
  <h5 class="card-title">Test Sunne</h5><div class="person__location">SUNNE</div>
  <time class="person__date" datetime="2026-09-03">2026-09-03</time>
  <p class="person__ingress">Test för grannkommun.</p>
  <a class="person__link" href="/efterlysningar/test-sunne/">Läs mer</a>
</article>
<article class="person mix region--varmland">
  <h5 class="card-title">Test Karlstad</h5><div class="person__location">KARLSTAD</div>
  <time class="person__date" datetime="2026-09-03">2026-09-03</time>
  <p class="person__ingress">Test för grannkommun.</p>
  <a class="person__link" href="/efterlysningar/test-karlstad/">Läs mer</a>
</article>
"""

KARLSTAD_NEIGHBOR_SAMPLE = """
<article class="person mix region--varmland"><h5 class="card-title">Test Kil</h5><div class="person__location">KIL</div><time class="person__date" datetime="2026-09-03">2026-09-03</time><p class="person__ingress">Test.</p><a class="person__link" href="/efterlysningar/test-kil/">Läs mer</a></article>
<article class="person mix region--varmland"><h5 class="card-title">Test Storfors</h5><div class="person__location">STORFORS</div><time class="person__date" datetime="2026-09-03">2026-09-03</time><p class="person__ingress">Test.</p><a class="person__link" href="/efterlysningar/test-storfors/">Läs mer</a></article>
<article class="person mix region--varmland"><h5 class="card-title">Test Hammarö</h5><div class="person__location">HAMMARÖ</div><time class="person__date" datetime="2026-09-03">2026-09-03</time><p class="person__ingress">Test.</p><a class="person__link" href="/efterlysningar/test-hammaro/">Läs mer</a></article>
<article class="person mix region--varmland"><h5 class="card-title">Test Forshaga</h5><div class="person__location">FORSHAGA</div><time class="person__date" datetime="2026-09-03">2026-09-03</time><p class="person__ingress">Test.</p><a class="person__link" href="/efterlysningar/test-forshaga/">Läs mer</a></article>
<article class="person mix region--varmland"><h5 class="card-title">Test Grums</h5><div class="person__location">GRUMS</div><time class="person__date" datetime="2026-09-03">2026-09-03</time><p class="person__ingress">Test.</p><a class="person__link" href="/efterlysningar/test-grums/">Läs mer</a></article>
<article class="person mix region--varmland"><h5 class="card-title">Test Kristinehamn</h5><div class="person__location">KRISTINEHAMN</div><time class="person__date" datetime="2026-09-03">2026-09-03</time><p class="person__ingress">Test.</p><a class="person__link" href="/efterlysningar/test-kristinehamn/">Läs mer</a></article>
<article class="person mix region--varmland"><h5 class="card-title">Test Filipstad</h5><div class="person__location">FILIPSTAD</div><time class="person__date" datetime="2026-09-03">2026-09-03</time><p class="person__ingress">Test.</p><a class="person__link" href="/efterlysningar/test-filipstad/">Läs mer</a></article>
<article class="person mix region--varmland"><h5 class="card-title">Test Hagfors</h5><div class="person__location">HAGFORS</div><time class="person__date" datetime="2026-09-03">2026-09-03</time><p class="person__ingress">Test.</p><a class="person__link" href="/efterlysningar/test-hagfors/">Läs mer</a></article>
"""


class MissingPeopleTests(unittest.TestCase):
    def test_parser_ignores_images_and_keeps_direct_link(self):
        items = missing.parse_people(SAMPLE)
        self.assertEqual(items[0]["name"], "Försvunnen man")
        self.assertEqual(items[0]["location"], "TÖSSE")
        self.assertEqual(items[0]["url"], "https://www.missingpeople.se/efterlysningar/forsvunnen-man/")
        self.assertNotIn("image", items[0])

    def test_place_is_mapped_to_exact_municipality(self):
        self.assertEqual(missing.municipality_for("TÖSSE"), "Åmål")
        self.assertEqual(missing.municipality_for("DALS LÅNGED"), "Bengtsfors")
        self.assertEqual(missing.municipality_for("KARLSTAD"), "Karlstad")

    def test_neighbor_case_is_visible_but_labeled(self):
        data = missing.distribute(missing.parse_people(SAMPLE))
        amal = data["Åmål"]["items"]
        saffle = data["Säffle"]["items"]
        self.assertEqual(amal[0]["scope"], "local")
        self.assertTrue(any(item["originMunicipality"] == "Grums" and item["scope"] == "neighbor" for item in saffle))

    def test_case_is_not_spread_beyond_neighbor_graph(self):
        data = missing.distribute(missing.parse_people(SAMPLE))
        self.assertFalse(any(item["originMunicipality"] == "Grums" for item in data["Bengtsfors"]["items"]))

    def test_hagfors_includes_supported_sunne_and_karlstad_neighbors(self):
        data = missing.distribute(missing.parse_people(HAGFORS_NEIGHBOR_SAMPLE))
        origins = {item["originMunicipality"] for item in data["Hagfors"]["items"] if item["scope"] == "neighbor"}
        self.assertIn("Sunne", origins)
        self.assertIn("Karlstad", origins)

    def test_karlstad_includes_all_eight_actual_neighbors_in_dinpuls(self):
        data = missing.distribute(missing.parse_people(KARLSTAD_NEIGHBOR_SAMPLE))
        origins = {item["originMunicipality"] for item in data["Karlstad"]["items"] if item["scope"] == "neighbor"}
        self.assertEqual(origins, {"Kil", "Storfors", "Hammarö", "Forshaga", "Grums", "Kristinehamn", "Filipstad", "Hagfors"})


if __name__ == "__main__":
    unittest.main()
