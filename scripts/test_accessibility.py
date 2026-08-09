#!/usr/bin/env python3
"""Snabba tillgänglighetskontrakt för alla publicerade DinPuls-sidor."""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = sorted(ROOT.glob("*.html"))
FRAGMENTS = sorted((ROOT / "components").glob("*.html"))


class AccessibilityParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.errors: list[str] = []
        self.button_stack: list[dict[str, object]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "img" and "alt" not in values:
            self.errors.append(f"bild utan alt-text: {values.get('src', '(okänd)')}")
        if tag == "a" and values.get("target") == "_blank":
            rel = set((values.get("rel") or "").split())
            if not {"noopener", "noreferrer"}.issubset(rel):
                self.errors.append(f"ny flik utan noopener/noreferrer: {values.get('href', '(okänd)')}")
        if tag == "button":
            self.button_stack.append({"label": values.get("aria-label", ""), "text": ""})

    def handle_data(self, data: str) -> None:
        if self.button_stack:
            self.button_stack[-1]["text"] = str(self.button_stack[-1]["text"]) + data

    def handle_endtag(self, tag: str) -> None:
        if tag == "button" and self.button_stack:
            button = self.button_stack.pop()
            if not str(button["label"]).strip() and not str(button["text"]).strip():
                self.errors.append("knapp utan synligt namn eller aria-label")


def main() -> None:
    failures: list[str] = []
    for page in PAGES:
        source = page.read_text(encoding="utf-8")
        parser = AccessibilityParser()
        parser.feed(source)
        required = {
            '<html lang="sv"': "svenskt språk på html-elementet",
            'name="viewport"': "viewport-meta",
            '<title>': "sidtitel",
        }
        for marker, description in required.items():
            if marker not in source:
                parser.errors.append(f"saknar {description}")
        failures.extend(f"{page.name}: {error}" for error in parser.errors)

    for fragment in FRAGMENTS:
        parser = AccessibilityParser()
        parser.feed(fragment.read_text(encoding="utf-8"))
        failures.extend(f"components/{fragment.name}: {error}" for error in parser.errors)

    if failures:
        raise AssertionError("\n".join(failures))
    print(f"Tillgänglighetskontrakt godkända för {len(PAGES)} sidor och {len(FRAGMENTS)} komponenter.")


if __name__ == "__main__":
    main()
