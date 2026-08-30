#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "script.js"
text = SCRIPT.read_text(encoding="utf-8")

old = '''  transportRefreshTimer = window.setInterval(() => {
    if (!document.hidden) loadTransport();
  }, 15 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadTransport();
  });
  window.addEventListener("online", loadTransport);'''
new = '''  transportRefreshTimer = window.setInterval(() => {
    if (!document.hidden) Promise.all([loadTransport(), loadFlights()]);
  }, 15 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) Promise.all([loadTransport(), loadFlights()]);
  });
  window.addEventListener("online", () => Promise.all([loadTransport(), loadFlights()]));'''
if old not in text:
    raise SystemExit("Kunde inte hitta transportens uppdateringsintervall")
text = text.replace(old, new, 1)

old = '''  const regionalFlights = (flightData?.departures || [])
    .filter((item) => ["all", "flight"].includes(activeTransportMode))
    .filter((item) => new Date(item.realtime || item.scheduled).getTime() >= now - 30000);'''
new = '''  const flightAudience = ["Åmål", "Bengtsfors", "Mellerud", "Dals-Ed", "Färgelanda"].includes(municipality)
    ? "Dalsland"
    : "Värmland";
  const regionalFlights = (flightData?.departures || [])
    .filter((item) => ["all", "flight"].includes(activeTransportMode))
    .filter((item) => !Array.isArray(item.audiences) || item.audiences.includes(flightAudience))
    .filter((item) => !item.departed)
    .filter((item) => new Date(item.realtime || item.scheduled).getTime() >= now - 30000);'''
if old not in text:
    raise SystemExit("Kunde inte hitta regionalFlights-blocket")
text = text.replace(old, new, 1)

old = '''    empty.querySelector("span").textContent = activeTransportMode === "flight"
      ? "Nästa publicerade flyg från Karlstad, Hagfors och Torsby visas automatiskt."
      : stop?.error'''
new = '''    empty.querySelector("span").textContent = activeTransportMode === "flight"
      ? flightAudience === "Dalsland"
        ? "Nästa publicerade flyg från Karlstad och Göteborg Stallbacka visas automatiskt."
        : "Nästa publicerade flyg från Karlstad, Hagfors och Torsby visas automatiskt."
      : stop?.error'''
if old not in text:
    raise SystemExit("Kunde inte hitta flygets tomtext")
text = text.replace(old, new, 1)

old = '''  const status = isDemo
    ? '<span class="departure-status planned">Demodata</span>'
    : item.canceled
    ? '<span class="departure-status canceled">Inställd</span>'
    : delayMinutes > 0
      ? `<span class="departure-status delayed">+${delayMinutes} min</span>`
      : item.stale
        ? '<span class="departure-status planned">Senast verifierad</span>'
      : item.isRealtime
        ? '<span class="departure-status realtime">Realtid</span>'
        : '<span class="departure-status planned">Tidtabell</span>';'''
new = '''  const flightStatus = item.mode === "flight" && item.statusText
    ? `<span class="departure-status ${item.canceled ? "canceled" : delayMinutes > 0 ? "delayed" : "realtime"}">${escapeHtml(item.statusText)}</span>`
    : "";
  const status = flightStatus || (isDemo
    ? '<span class="departure-status planned">Demodata</span>'
    : item.canceled
    ? '<span class="departure-status canceled">Inställd</span>'
    : delayMinutes > 0
      ? `<span class="departure-status delayed">+${delayMinutes} min</span>`
      : item.stale
        ? '<span class="departure-status planned">Senast verifierad</span>'
      : item.isRealtime
        ? '<span class="departure-status realtime">Realtid</span>'
        : '<span class="departure-status planned">Tidtabell</span>');'''
if old not in text:
    raise SystemExit("Kunde inte hitta departure-status-blocket")
text = text.replace(old, new, 1)

old = '''  if (activeTransportMode === "flight") {
    if (note) note.innerHTML = '<i data-lucide="plane"></i>Regionala avgångar från Karlstad, Hagfors och Torsby · officiella flygplatstidtabeller';
    if (link) {
      link.hidden = false;
      link.href = "https://www.ksdarprt.se/resmal/tidtabeller/";
      link.textContent = "Officiella flygtidtabeller";
    }
    return;
  }'''
new = '''  if (activeTransportMode === "flight") {
    const municipality = DinPulsMunicipality.getName();
    const dalsland = ["Åmål", "Bengtsfors", "Mellerud", "Dals-Ed", "Färgelanda"].includes(municipality);
    if (note) note.innerHTML = dalsland
      ? '<i data-lucide="plane"></i>Karlstad + Göteborg Stallbacka · officiella live- och tidtabellskällor'
      : '<i data-lucide="plane"></i>Karlstad + Hagfors + Torsby · officiella live- och tidtabellskällor';
    if (link) {
      link.hidden = false;
      link.href = dalsland ? "https://gsairport.se/infor-resan/reseinformation/" : "https://www.ksdarprt.se/";
      link.textContent = "Öppna officiell flyginformation";
    }
    return;
  }'''
if old not in text:
    raise SystemExit("Kunde inte hitta flygets källtext")
text = text.replace(old, new, 1)

SCRIPT.write_text(text, encoding="utf-8")
print("Flygvisningen är geografiskt styrd och visar officiell status när den finns")
