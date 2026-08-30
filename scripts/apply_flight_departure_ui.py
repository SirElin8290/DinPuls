#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PRIMARY = ROOT / "components" / "primary-cards.html"
TRANSPORT = ROOT / "components" / "transport.html"
SCRIPT = ROOT / "script.js"

# 1. Ta bort det lilla duplicerade Buss & tåg-kortet.
primary = PRIMARY.read_text(encoding="utf-8")
primary = re.sub(
    r'\n\s*<article class="card" id="buss">.*?</article>',
    '',
    primary,
    count=1,
    flags=re.S,
)
if 'id="buss"' in primary:
    raise SystemExit("Kunde inte ta bort det duplicerade Buss & tåg-kortet")
if "dinpuls-primary-two" not in primary:
    primary += '''\n<style id="dinpuls-primary-two">
  .primary-service-grid{grid-template-columns:minmax(0,1.12fr) minmax(0,.88fr)}
  @media(max-width:980px){.primary-service-grid{grid-template-columns:1fr}}
</style>\n'''
PRIMARY.write_text(primary, encoding="utf-8")

# 2. Gör den stora avgångstavlan generell och lägg till Flyg.
transport = TRANSPORT.read_text(encoding="utf-8")
transport = transport.replace(
    '<span class="section-kicker">Buss och tåg nära dig</span>\n      <h2>Avgångar från <span id="transport-place">Åmål</span></h2>',
    '<span class="section-kicker">Resor och avgångar</span>\n      <h2>Avgångar · <span id="transport-place">Åmål</span></h2>'
)
train_button = '<button class="transport-tab" type="button" data-transport-mode="train" aria-selected="false"><i data-lucide="train-front"></i>Tåg</button>'
flight_button = train_button + '\n      <button class="transport-tab" type="button" data-transport-mode="flight" aria-selected="false"><i data-lucide="plane"></i>Flyg</button>'
if 'data-transport-mode="flight"' not in transport:
    transport = transport.replace(train_button, flight_button)
transport = transport.replace(
    '<label class="transport-stop-select">\n      <span>Hållplats eller station</span>',
    '<label class="transport-stop-select" id="transport-stop-select">\n      <span id="transport-stop-label">Hållplats eller station</span>'
)
transport = transport.replace(
    '<span>Prova en annan hållplats eller välj ett annat trafikslag.</span>',
    '<span>Nästa avgångsfönster kontrolleras automatiskt.</span>'
)
if "dinpuls-flight-ui" not in transport:
    transport += '''\n<style id="dinpuls-flight-ui">
  .departure-mode.flight{background:#efe9ff;color:#6542c7}
  [data-theme="dark"] .departure-mode.flight{background:#2c2448;color:#b9a5ff}
  .transport-regional-note{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--muted)}
  .transport-regional-note svg{width:14px;height:14px}
</style>\n'''
TRANSPORT.write_text(transport, encoding="utf-8")

# 3. Koppla in regional flygdata i befintlig transportmotor.
script = SCRIPT.read_text(encoding="utf-8")
script = script.replace(
    'let transportData = null;\nlet activeTransportMode = "all";',
    'let transportData = null;\nlet flightData = null;\nlet activeTransportMode = "all";',
    1,
)
script = script.replace(
    '  await loadTransport();\n  clearInterval(transportRefreshTimer);',
    '  await Promise.all([loadTransport(), loadFlights()]);\n  clearInterval(transportRefreshTimer);',
    1,
)

load_flights = '''\nasync function loadFlights() {
  try {
    const response = await fetch(`data/flights.json`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    flightData = await response.json();
  } catch (error) {
    console.error("Flygavgångarna kunde inte laddas:", error);
    flightData = null;
  }
  if (transportData) renderTransport();
}

'''
if 'async function loadFlights()' not in script:
    script = script.replace('function populateTransportStops() {', load_flights + 'function populateTransportStops() {', 1)

new_render = r'''function renderTransport() {
  const board = document.querySelector("#departure-board");
  const loading = document.querySelector("#transport-loading");
  const empty = document.querySelector("#transport-empty");
  const alertBox = document.querySelector("#transport-alert");
  const select = document.querySelector("#transport-stop");
  const selectWrap = document.querySelector("#transport-stop-select");
  if (!board || !transportData || !select) return;

  const municipality = DinPulsMunicipality.getName();
  const municipalityData = transportData.municipalities?.[municipality];
  const stop = municipalityData?.stops?.find((item) => item.id === select.value) || municipalityData?.stops?.[0];
  const isDemo = transportData.source === "demo";
  const now = Date.now();

  const localDepartures = (stop?.departures || [])
    .filter((item) => ["all", "bus", "train"].includes(activeTransportMode) && (activeTransportMode === "all" || item.mode === activeTransportMode))
    .filter((item) => isDemo || new Date(item.realtime || item.scheduled).getTime() >= now - 30000);
  const regionalFlights = (flightData?.departures || [])
    .filter((item) => ["all", "flight"].includes(activeTransportMode))
    .filter((item) => new Date(item.realtime || item.scheduled).getTime() >= now - 30000);
  const departures = [...localDepartures, ...regionalFlights]
    .sort((a, b) => new Date(a.realtime || a.scheduled) - new Date(b.realtime || b.scheduled))
    .slice(0, 12);

  if (selectWrap) selectWrap.hidden = activeTransportMode === "flight";
  board.innerHTML = departures.map((item) => renderDeparture(item, isDemo && item.mode !== "flight")).join("");
  loading.hidden = true;
  board.hidden = departures.length === 0;
  empty.hidden = departures.length > 0;
  if (!departures.length) {
    const modeLabel = activeTransportMode === "train" ? "tåg" : activeTransportMode === "bus" ? "bussar" : activeTransportMode === "flight" ? "flyg" : "avgångar";
    empty.querySelector("strong").textContent = `Inga kommande ${modeLabel} hittades`;
    empty.querySelector("span").textContent = activeTransportMode === "flight"
      ? "Nästa publicerade flyg från Karlstad, Hagfors och Torsby visas automatiskt."
      : stop?.error
        ? "Trafiklab kunde inte nås. Senast sparade tider visas när de fortfarande gäller."
        : "Nästa tidtabellsfönster kontrolleras automatiskt.";
  }

  const alerts = activeTransportMode === "flight" ? [] : (stop?.alerts || []);
  alertBox.hidden = alerts.length === 0;
  alertBox.innerHTML = alerts.length ? `<i data-lucide="triangle-alert"></i><div><strong>Trafikinformation</strong>${alerts.map((message) => `<span>${escapeHtml(message)}</span>`).join("")}</div>` : "";

  const updated = document.querySelector("#transport-updated");
  if (updated) {
    const sourceData = activeTransportMode === "flight" ? flightData : transportData;
    const timestamp = new Date(sourceData?.generatedAt || "");
    const staleLimit = activeTransportMode === "flight" ? 12 * 60 * 60 * 1000 : 50 * 60 * 1000;
    const stale = !Number.isNaN(timestamp.getTime()) && Date.now() - timestamp.getTime() > staleLimit;
    updated.classList.toggle("stale", stale);
    updated.innerHTML = `<i data-lucide="${stale ? "clock-3" : "refresh-cw"}"></i>${Number.isNaN(timestamp.getTime()) ? "Tider kontrollerade" : activeTransportMode === "flight" ? `Flygtidtabeller kontrollerade ${timestamp.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" })}` : stale ? `Senast fungerande kontroll ${timestamp.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" })}` : `Uppdaterad ${timestamp.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" })}`}`;
  }

  updateTransportSource(isDemo, stop, departures);
  updateQuickTransport();
  if (window.lucide) lucide.createIcons();
}

'''
script, count = re.subn(r'function renderTransport\(\) \{.*?\n\}\n\nfunction renderDeparture\(', new_render + 'function renderDeparture(', script, count=1, flags=re.S)
if count != 1:
    raise SystemExit("Kunde inte ersätta renderTransport")

new_departure = r'''function renderDeparture(item, isDemo = false) {
  const realtime = item.realtime || item.scheduled;
  const scheduled = new Date(item.scheduled);
  const actual = new Date(realtime);
  const delayMinutes = Number(item.delayMinutes) || 0;
  const modeIcon = item.mode === "flight" ? "plane" : item.mode === "train" ? "train-front" : "bus-front";
  const status = isDemo
    ? '<span class="departure-status planned">Demodata</span>'
    : item.canceled
    ? '<span class="departure-status canceled">Inställd</span>'
    : delayMinutes > 0
      ? `<span class="departure-status delayed">+${delayMinutes} min</span>`
      : item.stale
        ? '<span class="departure-status planned">Senast verifierad</span>'
      : item.isRealtime
        ? '<span class="departure-status realtime">Realtid</span>'
        : '<span class="departure-status planned">Tidtabell</span>';
  const time = Number.isNaN(actual.getTime()) ? "--:--" : actual.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const scheduledTime = Number.isNaN(scheduled.getTime()) ? "" : scheduled.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const lineLabel = item.mode === "flight" ? (item.airport || item.line || item.operator || "Flyg") : (item.line || item.operator || "–");
  const detail = item.mode === "flight"
    ? [item.line, item.operator].filter(Boolean).join(" · ")
    : `${item.operator || ""}${item.platform ? ` · Läge ${item.platform}` : ""}`;
  return `<article class="departure-row${item.canceled ? " is-canceled" : ""}">
    <span class="departure-mode ${item.mode}"><i data-lucide="${modeIcon}"></i></span>
    <span class="departure-line">${escapeHtml(lineLabel)}</span>
    <span class="departure-destination"><strong>${escapeHtml(item.direction || "Destination saknas")}</strong><small>${escapeHtml(detail)}</small></span>
    <span class="departure-time"><strong>${time}</strong>${delayMinutes > 0 && scheduledTime ? `<small>${scheduledTime}</small>` : ""}</span>
    ${status}
  </article>`;
}

'''
script, count = re.subn(r'function renderDeparture\(item, isDemo = false\) \{.*?\n\}\n\nfunction updateTransportSource\(', new_departure + 'function updateTransportSource(', script, count=1, flags=re.S)
if count != 1:
    raise SystemExit("Kunde inte ersätta renderDeparture")

new_source = r'''function updateTransportSource(isDemo, stop, departures) {
  const note = document.querySelector("#transport-source-note");
  const link = document.querySelector("#transport-source-link");
  if (activeTransportMode === "flight") {
    if (note) note.innerHTML = '<i data-lucide="plane"></i>Regionala avgångar från Karlstad, Hagfors och Torsby · officiella flygplatstidtabeller';
    if (link) {
      link.hidden = false;
      link.href = "https://www.ksdarprt.se/resmal/tidtabeller/";
      link.textContent = "Officiella flygtidtabeller";
    }
    return;
  }
  const retained = Boolean(stop?.retained) || departures.some((item) => item.mode !== "flight" && item.stale);
  if (note) {
    note.textContent = isDemo
      ? "Exempeltider – inte liveinformation"
      : retained
        ? "Trafiklab – visar senast verifierade framtida avgångar medan nya tider hämtas"
      : activeTransportMode === "all" && flightData?.departures?.length
        ? "Lokala buss- och tågtider från Trafiklab · regionala flyg från officiella flygplatstidtabeller"
      : transportData.partial
        ? "Trafiklab – vissa hållplatser kunde inte uppdateras"
        : "Aktuella avgångar från Trafiklab";
  }
  if (link) {
    link.hidden = isDemo;
    link.href = "https://www.trafiklab.se/";
    link.textContent = "Data från Trafiklab.se";
  }
}

'''
script, count = re.subn(r'function updateTransportSource\(isDemo, stop, departures\) \{.*?\n\}\n\nfunction renderCompactTransport\(', new_source + 'function renderCompactTransport(', script, count=1, flags=re.S)
if count != 1:
    raise SystemExit("Kunde inte ersätta updateTransportSource")

SCRIPT.write_text(script, encoding="utf-8")
print("Flygflik tillagd, liten duplicerad buss/tåg-modul borttagen och samlad avgångstavla aktiverad")
