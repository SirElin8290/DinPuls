#!/usr/bin/env python3
"""Stoppar publicering om DinPuls saknar en central lanseringsdel."""
from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.21.16"
MUNICIPALITIES = ["Åmål", "Säffle", "Bengtsfors", "Mellerud", "Årjäng", "Arvika", "Grums"]
ACTIVE_PAGES = [
    "index.html", "jobb.html", "bostader.html", "trafik.html",
    "evenemang.html", "lunch.html", "matkasse.html", "sport.html",
    "information.html", "vard.html", "myndigheter.html", "service.html",
    "nyheter.html", "drivmedel.html", "bio.html",
]
COMPONENTS = [
    "header", "google-search", "quick-strip", "navigation", "lunch-strip", "hero",
    "premium-ad-1", "primary-cards", "transport", "sport", "health", "authorities", "service",
    "cinema", "secondary-cards", "premium-ad-2", "jobs-housing",
    "premium-ad-3", "footer",
]


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.assets: list[str] = []
        self.ids: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(str(values["id"]))
        for name in ("href", "src"):
            value = values.get(name)
            if value:
                self.assets.append(value)


def load_json(path: str) -> dict:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def municipality_map(path: str) -> dict:
    data = load_json(path)
    value = data.get("municipalities")
    if not isinstance(value, dict):
        raise AssertionError(f"{path}: municipalities måste vara ett objekt")
    assert list(value) == MUNICIPALITIES, f"{path}: fel eller felordnade kommuner"
    return value


def verify_assets() -> None:
    for page in ACTIVE_PAGES:
        source = (ROOT / page).read_text(encoding="utf-8")
        parser = AssetParser()
        parser.feed(source)
        for value in parser.assets:
            clean = value.split("?", 1)[0].split("#", 1)[0]
            if not clean or clean.startswith(("http://", "https://", "mailto:", "tel:")):
                continue
            assert (ROOT / clean).is_file(), f"{page}: filen {clean} saknas"

    assembled = (ROOT / "index.html").read_text(encoding="utf-8")
    assembled += "".join((ROOT / "components" / f"{name}.html").read_text(encoding="utf-8") for name in COMPONENTS)
    parser = AssetParser()
    parser.feed(assembled)
    duplicates = sorted({value for value in parser.ids if parser.ids.count(value) > 1})
    assert not duplicates, f"Startsidan innehåller dubbla id:n: {', '.join(duplicates)}"


def verify_content() -> None:
    active = "\n".join((ROOT / page).read_text(encoding="utf-8") for page in ACTIVE_PAGES)
    active += "\n".join((ROOT / "components" / f"{name}.html").read_text(encoding="utf-8") for name in COMPONENTS)
    forbidden = ["Sökfunktionen kopplas", "Ladda ner appen", "Personligt för dig", "Borlänge"]
    for phrase in forbidden:
        assert phrase.lower() not in active.lower(), f"Inaktiv eller felaktig text finns kvar: {phrase}"

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    script = (ROOT / "script.js").read_text(encoding="utf-8")
    assert f'data-version="{VERSION}"' in index
    assert f'content="{VERSION}"' in index
    assert f'const DINPULS_VERSION = "{VERSION}"' in script
    assert "updateMunicipalityLinks" in script
    assert "Sök bland DinPuls moduler" in (ROOT / "components/header.html").read_text(encoding="utf-8")
    google_search = (ROOT / "components/google-search.html").read_text(encoding="utf-8")
    assert 'action="https://www.google.se/search"' in google_search, "Google-sökningen går inte till google.se"
    assert 'name="q"' in google_search and 'method="get"' in google_search, "Google-sökningen skickar inte sökfrasen korrekt"
    assert 'target="_blank"' in google_search, "Google-sökningen öppnas inte i en ny flik"
    assert 'rel="noopener noreferrer"' in google_search, "Google-sökningen saknar säkert skydd för den nya fliken"
    assert 'data-component="google-search"' in index, "Google-sökningen saknas på startsidan"
    cinema = (ROOT / "components/cinema.html").read_text(encoding="utf-8")
    assert 'data-component="cinema"' in index, "Biomodulen saknas på startsidan"
    assert 'id="cinema-home-grid"' in cinema, "Biomodulens filmlista saknas"
    assert "initializeCinemaHome()" in script, "Biomodulen initieras inte"

    all_html = "\n".join(path.read_text(encoding="utf-8") for path in ROOT.glob("*.html"))
    assert "fonts.googleapis.com" not in all_html and "fonts.gstatic.com" not in all_html, "Google Fonts laddas fortfarande automatiskt"
    assert "unpkg.com/lucide" not in all_html, "Lucide laddas fortfarande från tredje part"
    assert (ROOT / "assets/vendor/lucide.min.js").is_file(), "Lokal Lucide-fil saknas"
    assert all("privacy-controls.js" in (ROOT / page).read_text(encoding="utf-8") for page in ACTIVE_PAGES), "Integritetskontroller saknas på en aktiv sida"
    information = (ROOT / "information.html").read_text(encoding="utf-8")
    assert "Integritet, kakor och lokal lagring" in information
    assert "data-clear-local-data" in information
    assert "dinpuls-nameday-" not in script and "dinpuls-weather-" not in script, "Automatisk långtidslagring finns kvar"


def verify_data() -> None:
    config = load_json("data/municipalities.json")
    names = [item.get("name") for item in config.get("municipalities", [])]
    assert names == MUNICIPALITIES, "Kommunmotorn innehåller inte exakt de sju startkommunerna"

    transport = municipality_map("data/transport.json")
    for name, payload in transport.items():
        stops = payload.get("stops", [])
        departures = [item for stop in stops for item in stop.get("departures", [])]
        assert stops, f"{name}: säker hållplats saknas"
        assert departures, f"{name}: inga kollektivtrafikavgångar"
    assert load_json("data/transport.json").get("source") != "demo", "Kollektivtrafiken använder demodata"

    jobs = municipality_map("data/jobs.json")
    housing = municipality_map("data/housing.json")
    events = municipality_map("data/events.json")
    lunch = municipality_map("data/lunch.json")
    sports = municipality_map("data/sports.json")
    municipality_map("data/important.json")
    municipality_map("data/road-traffic.json")

    for name in MUNICIPALITIES:
        assert jobs[name].get("jobs"), f"{name}: jobb saknas"
        assert housing[name].get("providers"), f"{name}: bostadskälla saknas"
        assert events[name].get("sources"), f"{name}: evenemangskällor saknas"
        assert lunch[name].get("restaurants"), f"{name}: lunchställen saknas"
        assert sports[name].get("clubs"), f"{name}: lokala sportföreningar saknas"

    important_text = json.dumps(load_json("data/important.json"), ensure_ascii=False)
    assert not re.search(r"\bBorlänge\b", important_text, re.I), "Dagens viktigaste innehåller Borlänge"
    assert re.fullmatch(r"\d+\.\d+\.\d+", str(load_json("data/lunch.json").get("version", ""))), "Fel lunchdataversion"


def verify_ads() -> None:
    four_slot_pages = ["jobb.html", "trafik.html", "evenemang.html", "lunch.html", "matkasse.html", "vard.html", "myndigheter.html", "service.html", "nyheter.html", "bio.html"]
    for page in four_slot_pages:
        source = (ROOT / page).read_text(encoding="utf-8")
        assert source.count("data-strategic-ad=") == 4, f"{page}: ska ha fyra annonsplatser"
    housing = (ROOT / "bostader.html").read_text(encoding="utf-8")
    assert housing.count("data-strategic-ad=") == 7, "Bostadssidan ska ha sju annonsplatser"
    sport = (ROOT / "sport-hub-stage48.js").read_text(encoding="utf-8")
    assert "ad(1)" in sport and "ad(8)" in sport, "Sportsidan ska behålla åtta annonsplatser"


def verify_health() -> None:
    data = load_json("data/health.json")
    assert list(data.get("municipalities", {})) == MUNICIPALITIES, "Vårdmodulen saknar någon startkommun"
    assert data.get("officialCareUrl", "").startswith("https://www.1177.se/"), "Vårdmodulen saknar officiell 1177-källa"
    categories = {item.get("id") for item in data.get("categories", [])}
    required = {"vardcentral", "jour", "tandvard", "apotek", "fysioterapi", "kiropraktor", "naprapat", "massage", "fotvard", "psykisk-halsa", "arbetsterapi", "syn-horsel"}
    assert required <= categories, "Vårdmodulen saknar vård- eller behandlingskategori"
    page = (ROOT / "vard.html").read_text(encoding="utf-8")
    component = (ROOT / "components/health.html").read_text(encoding="utf-8")
    script = (ROOT / "health-page.js").read_text(encoding="utf-8")
    assert 'href="tel:112"' in page and 'href="tel:1177"' in page, "Viktiga vårdnummer saknas"
    assert "inga medicinska råd" in page.lower(), "Vårdmodulens säkerhetsgräns saknas"
    assert "data-municipality-name" in component and "vard.html" in component, "Startsidans vårdmodul är inte kommunansluten"
    assert "healthState.populateSelect" in script and "healthState.set" in script, "Vårdsidan följer inte kommunmotorn"


def verify_service() -> None:
    data = load_json("data/service.json")
    assert list(data.get("municipalities", {})) == MUNICIPALITIES, "Servicemodulen saknar någon startkommun"
    categories = {item.get("id") for item in data.get("categories", [])}
    required = {"bilverkstad", "dack", "snickare", "vvs", "elektriker", "malare-golv", "stad-flytt", "byggvaruhus", "maskinuthyrning"}
    assert required <= categories, "Servicemodulen saknar central service- eller hantverkskategori"
    page = (ROOT / "service.html").read_text(encoding="utf-8")
    component = (ROOT / "components" / "service.html").read_text(encoding="utf-8")
    script = (ROOT / "service-page.js").read_text(encoding="utf-8")
    assert "ingen rekommendation eller rangordning" in page.lower(), "Servicemodulens neutrala katalogprincip saknas"
    assert "märks tydligt som annons" in page.lower(), "Servicemodulen skiljer inte annons från katalog"
    assert "data-municipality-name" in component and "service.html" in component, "Startsidans servicemodul är inte kommunansluten"
    assert "serviceState.populateSelect" in script and "serviceState.set" in script, "Servicesidan följer inte kommunmotorn"
    assert '"Årjäng"' in script and "Åslanda Handelsträdgård" in script, "Årjängs lokala serviceannons saknas"
    assert "assets/ads/aslanda-handelstradgard.webp" in script, "Åslandas annonsbild är inte kopplad"
    assert "https://www.facebook.com/profile.php?id=61576659453588" in script, "Åslandas Facebooklänk saknas"
    assert 'target="_blank"' in script and 'rel="noopener noreferrer"' in script, "Extern annonslänk öppnas inte säkert i ny flik"
    assert (ROOT / "assets" / "ads" / "aslanda-handelstradgard.webp").is_file(), "Åslandas annonsbild saknas"


def verify_authorities() -> None:
    data = load_json("data/authorities.json")
    assert list(data.get("municipalities", {})) == MUNICIPALITIES, "Myndighetsmodulen saknar någon startkommun"
    national = {item.get("id") for item in data.get("nationalServices", [])}
    required = {"forsakringskassan", "pensionsmyndigheten", "skatteverket", "arbetsformedlingen", "csn", "kronofogden", "polisen", "transportstyrelsen", "trafikverket", "domstolar", "lantmateriet", "migrationsverket"}
    assert required <= national, "Myndighetsmodulen saknar centrala myndigheter"
    local = {item.get("id") for item in data.get("municipalServices", [])}
    assert {"socialtjanst", "ekonomiskt-bistand", "budget-skuld", "overformyndare", "bygglov"} <= local, "Kommunal samhällsservice saknas"
    page = (ROOT / "myndigheter.html").read_text(encoding="utf-8")
    component = (ROOT / "components" / "authorities.html").read_text(encoding="utf-8")
    script = (ROOT / "myndigheter-page.js").read_text(encoding="utf-8")
    assert 'href="tel:112"' in page and 'href="tel:11414"' in page, "Akuta samhällsnummer saknas"
    assert "hanterar inga personuppgifter" in page.lower(), "Myndighetsguidens säkerhetsgräns saknas"
    assert "data-municipality-name" in component and "myndigheter.html" in component, "Startsidans myndighetsmodul är inte kommunansluten"
    assert "authorityState.populateSelect" in script and "authorityState.set" in script, "Myndighetssidan följer inte kommunmotorn"


def verify_cinema() -> None:
    data = load_json("data/cinemas.json")
    municipalities = data.get("municipalities", {})
    assert list(municipalities) == MUNICIPALITIES, "Biomodulen saknar någon startkommun"
    assert all(municipalities[name] for name in MUNICIPALITIES), "Någon kommun saknar biograf"
    assert len(municipalities["Mellerud"]) == 2, "Melleruds två biografer ska visas"
    for name, cinemas in municipalities.items():
        for cinema in cinemas:
            assert cinema.get("programUrl", "").startswith("https://"), f"{name}: programlänk saknas"
            assert cinema.get("bookingUrl", "").startswith("https://"), f"{name}: biljettlänk saknas"
    page = (ROOT / "bio.html").read_text(encoding="utf-8")
    script = (ROOT / "bio-page.js").read_text(encoding="utf-8")
    navigation = (ROOT / "components/navigation.html").read_text(encoding="utf-8")
    assert "Evenemang · Bio" in page and "evenemang.html" in page, "Bio är inte sammankopplat med Evenemang"
    assert "cinemaState.populateSelect" in script and "cinemaState.set" in script, "Biosidan följer inte kommunmotorn"
    assert 'href="bio.html"' in navigation, "Bio saknas i navigationen"


def verify_simple_sport_hub() -> None:
    removed = [
        "player.html", "match.html", "club.html", "arena.html",
        "sport-matchcenter-stage41.js", "sport-clubs-stage42.js",
        "sport-tables-stage43.js", "sport-match-details-stage44.js",
        "sport-favorites-stage45.js", "sport-players-stage46.js",
        "sport-arenas-stage47.js",
    ]
    for asset in removed:
        assert not (ROOT / asset).exists(), f"Avancerad sportfil ska vara borttagen: {asset}"
    sport = (ROOT / "sport.html").read_text(encoding="utf-8")
    assert "Matcher & resultat" in sport and "Tabeller" in sport
    assert "Föreningar & källor" in sport and "Arenor & sporthallar" in sport

    data = load_json("data/sports.json")
    providers = data.get("sportProviders", {})
    municipalities = data.get("municipalities", {})
    clubs = [club for payload in municipalities.values() for club in payload.get("clubs", [])]
    sports = {name for club in clubs for name in club.get("sports", [])}
    local_sources = [source for payload in municipalities.values() for source in payload.get("liveSources", [])]
    assert len(providers) >= 30, "Sporthubben saknar nationella kalender- och resultatkällor"
    assert len(clubs) >= 70, "Sporthubben har för få lokala föreningar"
    assert len(sports) >= 25, "Sporthubben representerar för få idrotter"
    assert len(local_sources) >= 25, "Sporthubben saknar lokala direktlänkar"
    for name, payload in municipalities.items():
        assert payload.get("directoryUrl", "").startswith("https://"), f"{name}: föreningsregister saknas"
        assert payload.get("clubs"), f"{name}: föreningar saknas"
        assert payload.get("liveSources"), f"{name}: sportkällor saknas"
        for club in payload["clubs"]:
            assert club.get("url", "").startswith("https://"), f"{name}: ogiltig klubblänk"
        for source in payload["liveSources"]:
            assert source.get("url", "").startswith("https://"), f"{name}: ogiltig sportkälla"


def verify_final_experience() -> None:
    quick = (ROOT / "components/quick-strip.html").read_text(encoding="utf-8")
    navigation = (ROOT / "components/navigation.html").read_text(encoding="utf-8")
    footer = (ROOT / "components/footer.html").read_text(encoding="utf-8")
    header = (ROOT / "components/header.html").read_text(encoding="utf-8")
    information = (ROOT / "information.html").read_text(encoding="utf-8")
    script = (ROOT / "script.js").read_text(encoding="utf-8")
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    for marker in ["data-quick-jobs-title", "data-quick-housing-title", "data-quick-events-title", "data-quick-news-title", "data-quick-sport-title", "data-quick-transport-title"]:
        assert marker in quick, f"Snabbrullen saknar {marker}"
    assert 'tabindex="-1"' in quick, "Snabbrullens dubblett får inte vara tangentbordsfokuserbar"
    assert "notification-panel" in header and "aria-expanded" in header, "Notiscentrets tillgänglighet saknas"
    assert "notiser" in script.lower() and 'kind, icon' in script, "Notiscentret är inte kopplat"
    assert "matkasse.html" not in navigation and 'data-component="grocery"' not in index, "Dold Matkasse visas fortfarande"
    assert "Källor & ansvar" in footer and 'id="kallor"' in information, "Käll- och ansvarsinformation saknas"
    assert index.count('data-component="premium-ad-') == 3, "Startsidan ska ha tre premiumannonsgrupper"
    assert not (ROOT / "quick-strip.html").exists(), "Gammal snabbrulle ligger kvar"
    assert not (ROOT / "components/ads.html").exists(), "Gammal annonskomponent ligger kvar"


def verify_review_fixes() -> None:
    lunch = (ROOT / "lunch-page.js").read_text(encoding="utf-8")
    portals = (ROOT / "portal-pages.js").read_text(encoding="utf-8")
    events = (ROOT / "event-page.js").read_text(encoding="utf-8")
    news = (ROOT / "news-page.js").read_text(encoding="utf-8")
    sport = (ROOT / "sport-hub-stage48.js").read_text(encoding="utf-8")
    script = (ROOT / "script.js").read_text(encoding="utf-8")
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    styles = (ROOT / "styles.css").read_text(encoding="utf-8")
    transport = (ROOT / "scripts/update_transport.py").read_text(encoding="utf-8")
    sources = load_json("data/news.json").get("sources", [])
    assert "updateLunchPageChrome();" in lunch, "Lunchsidan visar inte vald kommun före dataladdning"
    assert "updatePortalChrome();" in portals, "Jobb och bostäder visar inte vald kommun före dataladdning"
    assert "formatPortalAvailability(item.available)" in portals and 'month: "long"' in portals, "Bostadsdatum är inte läsbart formaterade"
    assert "Pågår till" in script and "formatEventShortDate(events[0])" in script, "Pågående evenemang saknar tydlig märkning"
    for name, source in [("startsidan", script), ("lunch", lunch), ("jobb och bostäder", portals), ("evenemang", events), ("nyheter", news), ("sport", sport)]:
        assert "Europe/Stockholm" in source or "STOCKHOLM_TIME_ZONE" in source, f"{name}: svensk tidszon saknas"
    assert "äldre än 45 minuter" not in script and "Försenad uppdatering" not in script, "Föråldrade statusvarningar finns kvar"
    assert "LOOKAHEAD_OFFSETS_HOURS" in transport and "EMPTY_RETRY_MINUTES = 45" in transport, "Kollektivtrafikens återförsök är inte robusta"
    assert "tickerRestaurants" in script, "Lunchrullen visar inte hela restaurangutbudet"
    assert "dinpuls-ticker 42s" in styles and "lunch-airport-roll 24s" in styles, "Rullarnas hastighet är inte rättad"
    assert index.index('data-component="secondary-cards"') < index.index('id="news-sources"') < index.index('data-component="premium-ad-2"'), "Lokala nyheter och källor ligger inte tillsammans"
    source_names = {item.get("name") for item in sources}
    assert {"Provinstidningen Dalsland", "Dalslänningen"} <= source_names, "Lokala Dalslandskällor saknas"


def verify_optimization() -> None:
    html_sources = {page: (ROOT / page).read_text(encoding="utf-8") for page in ACTIVE_PAGES}
    javascript = "\n".join(path.read_text(encoding="utf-8") for path in ROOT.glob("*.js"))
    assert "${Date.now()}" not in javascript, "Cache-busting med Date.now() finns kvar"
    assert not (ROOT / "jobs-housing.html").exists(), "Gammal fristående komponent ligger kvar"

    hero = ROOT / "assets/amal.webp"
    icons = ROOT / "assets/vendor/lucide.min.js"
    assert hero.is_file() and hero.stat().st_size < 200_000, "Hero-bilden är inte tillräckligt optimerad"
    assert not (ROOT / "assets/amal.jpg").exists(), "Den tunga gamla hero-bilden ligger kvar"
    assert icons.is_file() and icons.stat().st_size < 75_000, "Ikonpaketet innehåller fortfarande onödiga ikoner"

    ad_pages = {"jobb.html", "bostader.html", "trafik.html", "evenemang.html", "lunch.html", "matkasse.html", "drivmedel.html", "bio.html"}
    for page in ad_pages:
        assert "portal-ads.js?version=" + VERSION in html_sources[page], f"{page}: gemensam annonskod saknas"
    assert javascript.count("function renderStrategicAds(") == 1, "Annonsfunktionen är duplicerad"

    for page, source in html_sources.items():
        assert 'lang="sv"' in source, f"{page}: svenskt språk saknas"
        assert "<title>" in source and 'name="description"' in source, f"{page}: grundläggande metadata saknas"
        for version in re.findall(r"[?&]version=(0\.\d+\.\d+)", source):
            assert version == VERSION, f"{page}: gammal resursversion {version}"
    logo_markup = "\n".join(html_sources.values()) + (ROOT / "components/header.html").read_text(encoding="utf-8")
    assert 'width="620" height="150"' in logo_markup, "Logotypen saknar stabila bildmått"
    hero_markup = (ROOT / "components/hero.html").read_text(encoding="utf-8")
    assert 'width="1024" height="576"' in hero_markup and 'fetchpriority="high"' in hero_markup, "Hero-bilden saknar LCP-optimering"


def main() -> int:
    checks = [verify_assets, verify_content, verify_data, verify_ads, verify_health, verify_authorities, verify_service, verify_cinema, verify_simple_sport_hub, verify_final_experience, verify_review_fixes, verify_optimization]
    for check in checks:
        check()
        print(f"✓ {check.__name__}")
    print("✓ DinPuls är godkänd för publicering i sju kommuner")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as error:
        print(f"✗ {error}", file=sys.stderr)
        raise SystemExit(1)
