import copy
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from curated_lunch_gate import assert_curated_lunch

ROOT = Path(__file__).resolve().parents[1]


class CuratedLunchTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / "data/lunch.json").read_text(encoding="utf-8"))

    def test_all_curated_sources_required(self):
        for name in ("Munkfors", "Kristinehamn"):
            with self.subTest(name=name):
                row = copy.deepcopy(self.data["municipalities"][name])
                self.assertEqual(len(row["restaurants"]), assert_curated_lunch(name, row))
                row["restaurants"].pop()
                with self.assertRaisesRegex(AssertionError, "saknas"):
                    assert_curated_lunch(name, row)

    def test_catalogue_duplicates_and_wrong_source_rejected(self):
        for name in ("Munkfors", "Kristinehamn"):
            for failure in ("extra", "duplicate", "url", "days"):
                with self.subTest(name=name, failure=failure):
                    row = copy.deepcopy(self.data["municipalities"][name])
                    if failure == "extra":
                        row["restaurants"].append({"id": "unapproved-catalogue-entry"})
                    elif failure == "duplicate":
                        row["restaurants"].append(copy.deepcopy(row["restaurants"][0]))
                    elif failure == "url":
                        row["restaurants"][0]["url"] = "https://wrong-source.example"
                    else:
                        row["restaurants"][0]["days"] = "invalid"
                    with self.assertRaises(AssertionError):
                        assert_curated_lunch(name, row)

    def test_full_strict_jobs_preserve_lunch_byte_for_byte(self):
        # Kör de verkliga jobben i separat datakopia, aldrig mot arbetskopians data.
        with tempfile.TemporaryDirectory() as directory:
            sandbox = Path(directory)
            shutil.copytree(ROOT / "data", sandbox / "data")
            shutil.copytree(ROOT / "scripts", sandbox / "scripts", ignore=shutil.ignore_patterns("__pycache__"))
            before = (sandbox / "data/lunch.json").read_bytes()
            for municipality in ("munkfors", "kristinehamn"):
                result = subprocess.run([sys.executable, str(sandbox / f"scripts/apply_{municipality}_strict.py")], cwd=sandbox, capture_output=True, text=True)
                self.assertEqual(0, result.returncode, result.stdout + result.stderr)
                self.assertEqual(before, (sandbox / "data/lunch.json").read_bytes())


if __name__ == "__main__":
    unittest.main()
