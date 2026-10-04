"""STRICT kontrollerar lunchmotorns fullständiga kurerade lista utan att skriva över menyer."""
import json
from update_lunch import SOURCES, merge_config, validate_config


def assert_curated_lunch(municipality, entry, config=None):
    if config is None:
        config = merge_config(json.loads(SOURCES.read_text(encoding="utf-8")))
    validate_config(config)
    expected = {r["id"]: r for r in config["municipalities"][municipality]}
    assert expected, f"{municipality}: ingen kurerad lunchkälla konfigurerad"
    rows = entry.get("restaurants") or []
    ids = [r.get("id") for r in rows]
    assert len(ids) == len(set(ids)), f"{municipality}: dubblerade lunch-ID:n"
    assert set(ids) == set(expected), (
        f"{municipality}: lunchkällor saknas={sorted(set(expected)-set(ids))}, "
        f"oväntade={sorted(set(ids)-set(expected), key=str)}"
    )
    for row in rows:
        source = expected[row["id"]]
        for field in ("name", "url", "parser"):
            assert row.get(field) == source.get(field), f"{municipality}: fel {field} för {row['id']}"
        assert isinstance(row.get("days"), dict), f"{municipality}: menystruktur saknas för {row['id']}"
    return len(rows)
