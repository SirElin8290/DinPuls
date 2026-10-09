#!/usr/bin/env python3
"""Nightly real-browser layout/contrast checks, with no screenshots or submissions."""
import argparse
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["information.html", "evenemang.html", "nyheter.html", "lunch.html", "vard.html", "service.html", "myndigheter.html", "skola-familj.html", "praktiskt.html", "kris-beredskap.html", "foreningsliv.html", "bio.html", "bostader.html", "jobb.html", "trafik.html", "foreningar-konto.html", "foreningskonto.html", "foretag/valkommen.html", "foretag/start.html"]

MEASURE = """() => {
 const panel=document.getElementById('notification-panel');
 const r=panel&&!panel.hidden?panel.getBoundingClientRect():null;
 const horizontal=document.documentElement.scrollWidth>innerWidth+1;
 const menu=r&&(r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1);
 const recovery=window.DinPulsUIResilience?.audit();
 return {horizontalOverflow:horizontal,menuOutsideViewport:!!menu,recovery};
}"""

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="https://dinpuls.se")
    parser.add_argument("--output", type=Path, default=ROOT / "data/ui-quality.json")
    args = parser.parse_args()
    municipalities = [row["name"] for row in json.loads((ROOT / "data/municipalities.json").read_text(encoding="utf-8"))["municipalities"]]
    checks, issues = [], []
    # One active association in every municipality covers the shared profile template.
    sports=json.loads((ROOT / "data/sports.json").read_text(encoding="utf-8"))
    profiles={}
    for name in municipalities:
        club=next((r for r in sports.get("municipalities",{}).get(name,{}).get("clubs",[]) if r.get("name") and r.get("description") and "bedriver lokal medlemsverksamhet" not in r["description"].lower() and r.get("status","active") in {"active","active_verified"}),None)
        if club: profiles[name]=re.sub("[^a-z0-9]+","-",unicodedata.normalize("NFD",club["name"].lower()).encode("ascii","ignore").decode()).strip("-")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for theme in ("dark", "light"):
            context = browser.new_context()
            page = context.new_page()
            # Use the real saved preference, before any page loads.
            context.add_init_script(f"localStorage.setItem('dinpuls-theme', {json.dumps(theme)});")
            for width, height in ((1440, 900), (390, 844)):
                page.set_viewport_size({"width": width, "height": height})
                routes = [("index.html", name, None) for name in municipalities] + [("forening.html", name, identifier) for name,identifier in profiles.items()] + [(name, "Åmål", None) for name in PAGES]
                for route, municipality, identifier in routes:
                    entry = {"page": route, "municipality": municipality, "theme": theme, "viewport": f"{width}×{height}"}
                    try:
                        url = args.base_url.rstrip("/") + "/" + route + "?" + urlencode({"kommun": municipality, "qualityCheck": "nightly", **({"slug":identifier} if identifier else {})})
                        response = page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        if not response or response.status != 200:
                            raise RuntimeError(f"HTTP {response.status if response else 'missing'}")
                        page.wait_for_function("!!window.DinPulsUIResilience", timeout=20000)
                        consent=page.locator("[data-privacy-essential-only]")
                        if consent.is_visible(): consent.click()
                        if route == "forening.html":
                            page.wait_for_function("document.title !== 'Föreningsliv i ' + new URL(location.href).searchParams.get('kommun') + ' – DinPuls'", timeout=20000)
                            if page.get_by_text("Föreningen hittades inte", exact=True).count(): raise RuntimeError("Association profile not found")
                        if route == "index.html":
                            page.wait_for_function("document.title.includes(new URL(location.href).searchParams.get('kommun'))", timeout=20000)
                            page.locator("#notification-button").click()
                            page.wait_for_timeout(350)
                        entry.update(page.evaluate(MEASURE))
                        if entry["horizontalOverflow"] or entry["menuOutsideViewport"]:
                            issues.append({**entry, "reason": "layout_outside_viewport"})
                        if route == "index.html":
                            page.locator("#notification-close").click()
                    except Exception as error:
                        entry["error"] = str(error)[:300]
                        issues.append({**entry, "reason": "page_check_failed"})
                    checks.append(entry)
                    print(f"{entry['viewport']} {theme} {municipality} {route}: {'ERROR' if entry.get('error') or entry.get('horizontalOverflow') or entry.get('menuOutsideViewport') else 'OK'}", flush=True)
        # Demonstrate actual recovery from the two regressions, without touching source files.
        try:
            page.set_viewport_size({"width": 1440, "height": 900})
            page.goto(args.base_url.rstrip("/") + "/index.html?kommun=Åmål", wait_until="domcontentloaded")
            page.wait_for_function("!!window.DinPulsUIResilience")
            page.wait_for_function("document.title.includes('Åmål')")
            page.locator("#notification-button").click()
            recovered = page.evaluate("""() => {
              const panel=document.getElementById('notification-panel');
              panel.style.setProperty('position','relative','important');
              panel.style.setProperty('left','-500px','important');
              const probe=document.createElement('p');
              probe.textContent='Readability recovery probe';
              probe.style.cssText='color:rgb(240,240,240);background:rgb(255,255,255);opacity:1';
              document.body.appendChild(probe);
              const repair=window.DinPulsUIResilience.audit();
              const r=panel.getBoundingClientRect();
              const readable=getComputedStyle(probe).color==='rgb(0, 0, 0)';
              probe.remove();
              return {menu: r.left>=0&&r.right<=innerWidth&&getComputedStyle(panel).position==='fixed',contrast:readable,menuRect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},position:getComputedStyle(panel).position};
            }""")
            if not recovered["menu"] or not recovered["contrast"]:
                issues.append({"reason": "automatic_recovery_failed", **recovered})
        except Exception as error:
            issues.append({"reason": "recovery_test_failed", "error": str(error)[:300]})
        browser.close()
    report = {"generatedAt": datetime.now(timezone.utc).isoformat(), "completed": True, "municipalities": len(municipalities), "checks": len(checks), "issues": issues, "results": checks, "scope": "Real Chromium DOM geometry and eligible solid-background text; photos/gradients require visual review. No emails, purchases, uploads or screenshots."}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"UI quality: {len(checks)} checks, {len(issues)} issues", flush=True)
    return bool(issues)

if __name__ == "__main__":
    raise SystemExit(main())
