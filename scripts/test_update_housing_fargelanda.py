#!/usr/bin/env python3
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from update_housing_fargelanda import rent_amount


class FargelandaRentParsingTest(unittest.TestCase):
    def test_rooms_before_rent_do_not_become_rent(self):
        self.assertEqual(rent_amount("3 rum 91 m² 8 765 kr/mån"), 8765)

    def test_compact_rent(self):
        self.assertEqual(rent_amount("2 rum · 7450 kr/mån"), 7450)

    def test_dotted_thousands(self):
        self.assertEqual(rent_amount("3 rum 91 m² 8.765 kr/mån"), 8765)


if __name__ == "__main__":
    unittest.main()
