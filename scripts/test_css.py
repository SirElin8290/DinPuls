#!/usr/bin/env python3
"""Kontrollerar CSS-struktur och DinPuls gemensamma designvariabler."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS_FILES = sorted(ROOT.glob("*.css"))
CORE_TOKENS = {
    "blue950", "blue900", "blue700", "blue600", "blue100",
    "green", "red", "text", "muted", "border", "bg", "card",
    "shadow", "radius", "max",
}


def without_comments(source: str) -> str:
    return re.sub(r"/\*.*?\*/", "", source, flags=re.S)


def verify_balanced(path: Path, source: str) -> list[str]:
    errors: list[str] = []
    depth = 0
    quote = ""
    escaped = False
    for character in without_comments(source):
        if escaped:
            escaped = False
            continue
        if character == "\\":
            escaped = True
            continue
        if quote:
            if character == quote:
                quote = ""
            continue
        if character in {'"', "'"}:
            quote = character
        elif character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth < 0:
                errors.append(f"{path.name}: avslutande klammerparentes utan öppning")
                break
    if quote:
        errors.append(f"{path.name}: oavslutad sträng")
    if depth:
        errors.append(f"{path.name}: obalanserade klammerparenteser ({depth:+d})")
    return errors


def main() -> None:
    errors: list[str] = []
    combined = "\n".join(path.read_text(encoding="utf-8") for path in CSS_FILES)
    for path in CSS_FILES:
        errors.extend(verify_balanced(path, path.read_text(encoding="utf-8")))

    declarations = set(re.findall(r"--([a-zA-Z0-9_-]+)\s*:", combined))
    references = set(re.findall(r"var\(\s*--([a-zA-Z0-9_-]+)", combined))
    missing = sorted(references - declarations)
    if missing:
        errors.append(f"Odefinierade CSS-variabler: {', '.join('--' + name for name in missing)}")

    absent_core = sorted(CORE_TOKENS - declarations)
    if absent_core:
        errors.append(f"Grundvariabler saknas: {', '.join('--' + name for name in absent_core)}")

    for name, value in re.findall(r"--([a-zA-Z0-9_-]+)\s*:\s*([^;}]+)", combined):
        if re.search(rf"var\(\s*--{re.escape(name)}\s*\)", value):
            errors.append(f"CSS-variabeln --{name} refererar till sig själv")

    repeated_fallbacks = sorted(set(re.findall(
        r"var\(\s*--([a-zA-Z0-9_-]+)\s*,\s*var\(\s*--\1\s*\)\s*\)",
        combined,
    )))
    if repeated_fallbacks:
        errors.append("Självrefererande var()-reservvärden: " + ", ".join("--" + name for name in repeated_fallbacks))

    if errors:
        raise AssertionError("\n".join(errors))
    print(f"CSS-kontrakt godkända för {len(CSS_FILES)} stilmallar och {len(declarations)} variabler.")


if __name__ == "__main__":
    main()
