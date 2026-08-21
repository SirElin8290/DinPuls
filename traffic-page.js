const municipalityState = window.DinPulsMunicipalityState;
const TRAFFIC_STALE_MINUTES = 40;
let trafficMunicipality = municipalityState.getInitial();
let fullRoadTrafficData = null;
let requestedTrafficEventId = new URLSearchParams(location.search).get("event") || "";
let municipalityWebsites = new Map();

const escapeTraffic = window.DinPulsSecurity.escapeHtml;
const safeTrafficUrl = window.DinPulsSecurity.safeExternalUrl;

async function initializeTrafficPage() {
  const municipalityResponse = await fetch("data/municipalities.json", { cache: "no-cache" });
  if (!municipalityResponse.ok) throw new Error(`Kommunfilen kunde inte laddas: ${municipalityResponse.status}`);
  const municipalityData = await municipalityResponse.json();
  municipalityWebsites = new Map(
    (municipalityData.municipalities || []).map(item => [item.name, item.website])
  );
  const select = document.querySelector("#traffic-municipality");
  municipalityState.populateSelect(select, trafficMunicipality);
  select.addEventListener("change", () => {
    requestedTrafficEventId = "";
    const url = new URL(location.href);
    url.searchParams.delete("event");
    history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
    trafficMunicipality = municipalityState.set(select.value);
    renderTrafficPage();
  });
  document.querySelector("#traffic-type").addEventListener("change", renderTrafficPage);
  document.querySelector("#traffic-search").addEventListener("input", renderTrafficPage);
  renderStrategicAds("trafik", "trafiksida", "#traffic-page-list");
  await loadTrafficPageData();
}

async function loadTrafficPageData() {
  try {
    const response = await fetch(`data/road-traffic.json`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    fullRoadTrafficData = await response.json();
    renderTrafficPage();
  } catch (error) {
    console.error("Trafikläget kunde inte laddas:", error);
    renderTrafficPageError();
  }
}

function trafficDataAgeMinutes() {
  const generatedAt = new Date(fullRoadTrafficData?.generatedAt || "");
  return Number.isNaN(generatedAt.getTime()) ? null : (Date.now() - generatedAt.getTime()) / 60000;
}

function renderTrafficPage() {
  if (!fullRoadTrafficData) return;
  document.querySelectorAll("[data-traffic-municipality]").forEach((element) => {
    element.textContent = trafficMunicipality;
  });
  document.title = `Trafikläget nära ${trafficMunicipality} – DinPuls`;
  const municipalitySource = document.querySelector("#traffic-municipality-source");
  if (municipalitySource) municipalitySource.href = municipalityWebsites.get(trafficMunicipality) || "https://www.trafikverket.se/trafikinformation/vag/";

  const query = document.querySelector("#traffic-search").value.trim().toLocaleLowerCase("sv-SE");
  const type = document.querySelector("#traffic-type").value;
  const allItems = fullRoadTrafficData.municipalities?.[trafficMunicipality]?.items || [];
  const items = allItems.filter((item) => {
    const typeMatches = type === "all" || item.category === type;
    const searchable = [item.title, item.message, item.road, item.location].join(" ").toLocaleLowerCase("sv-SE");
    return typeMatches && (!query || searchable.includes(query));
  }).sort((a, b) => Number(b.id === requestedTrafficEventId) - Number(a.id === requestedTrafficEventId));

  const stale = trafficDataAgeMinutes() > TRAFFIC_STALE_MINUTES;
  const total = document.querySelector("#traffic-page-total");
  const updated = new Date(fullRoadTrafficData.generatedAt || "");
  document.querySelector("#traffic-page-updated").textContent = Number.isNaN(updated.getTime())
    ? "Senaste kontrolltid saknas"
    : `${stale ? "Uppdateringen är försenad · " : "Kontrollerad "}${updated.toLocaleString("sv-SE", { timeZone: "Europe/Stockholm", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;

  const list = document.querySelector("#traffic-page-list");
  list.innerHTML = items.map(renderTrafficMessage).join("");
  list.hidden = !items.length;

  if (!fullRoadTrafficData.active) {
    total.textContent = "Trafikdata är tillfälligt otillgänglig";
    renderTrafficEmpty("cloud-off", "Trafikläget kunde inte kontrolleras", "Öppna Trafikverkets vägkarta för aktuell myndighetsinformation.", "error");
  } else if (stale) {
    total.textContent = items.length ? `${items.length} senast kända vägmeddelanden` : "Senaste uppdateringen är försenad";
    if (!items.length) renderTrafficEmpty("clock-alert", "Trafikläget är inte nykontrollerat", "Uppgifterna är äldre än 40 minuter. Kontrollera Trafikverkets vägkarta innan du kör.", "warning");
    else hideTrafficEmpty();
  } else if (!items.length && allItems.length) {
    total.textContent = "Inga träffar med valt filter";
    renderTrafficEmpty("list-filter", "Inga vägmeddelanden matchar filtret", "Prova Alla händelser eller töm sökfältet.", "neutral");
  } else if (!items.length) {
    total.textContent = "Inga aktuella störningar";
    renderTrafficEmpty("circle-check", `Lugnt trafikläge nära ${trafficMunicipality}`, `Trafikverket har kontrollerats inom ${fullRoadTrafficData.radiusKm || 35} km och inga aktuella vägmeddelanden hittades.`, "success");
  } else {
    total.textContent = `${items.length} vägmeddelande${items.length === 1 ? "" : "n"}`;
    hideTrafficEmpty();
  }
  if (window.lucide) lucide.createIcons();
  const focusedEvent = list.querySelector('[data-traffic-event="focused"]');
  if (focusedEvent) {
    focusedEvent.setAttribute("tabindex", "-1");
    requestAnimationFrame(() => focusedEvent.scrollIntoView({ behavior: "smooth", block: "center" }));
  }
}

function renderTrafficEmpty(icon, title, detail, state) {
  const empty = document.querySelector("#traffic-page-empty");
  empty.hidden = false;
  empty.className = `portal-empty traffic-page-empty ${state}`;
  empty.innerHTML = `<i data-lucide="${icon}"></i><div><strong>${escapeTraffic(title)}</strong><span>${escapeTraffic(detail)}</span></div><a href="https://www.trafikverket.se/trafikinformation/vag/" target="_blank" rel="noopener noreferrer">Öppna Trafikverkets vägkarta</a>`;
}

function hideTrafficEmpty() {
  document.querySelector("#traffic-page-empty").hidden = true;
}

function renderTrafficPageError() {
  document.querySelector("#traffic-page-total").textContent = "Trafikläget kunde inte laddas";
  document.querySelector("#traffic-page-updated").textContent = "";
  renderTrafficEmpty("cloud-off", "Ingen trafikdata kunde hämtas", "Försök igen om en stund eller öppna Trafikverkets vägkarta.", "error");
  if (window.lucide) lucide.createIcons();
}

function formatTrafficValidity(item) {
  const options = { timeZone: "Europe/Stockholm", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
  const start = new Date(item.startTime || "");
  const end = new Date(item.endTime || "");
  const updated = new Date(item.updatedAt || "");
  if (item.status === "planned" && !Number.isNaN(start.getTime())) return `Planerad från ${start.toLocaleString("sv-SE", options)}`;
  if (!Number.isNaN(end.getTime()) && end.getTime() > Date.now()) return `Gäller till ${end.toLocaleString("sv-SE", options)}`;
  if (!Number.isNaN(updated.getTime())) return `Händelsen ändrad ${updated.toLocaleString("sv-SE", options)}`;
  return "Giltighetstid saknas";
}

function renderTrafficMessage(item) {
  const icons = { accident: "triangle-alert", roadwork: "construction", congestion: "traffic-cone", obstacle: "shield-alert", weather: "cloud-snow" };
  const source = item.source || "Trafikverket";
  const status = item.status === "planned" ? "Planerad" : item.categoryLabel;
  const isFocused = requestedTrafficEventId && item.id === requestedTrafficEventId;
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);
  const hasPosition = Number.isFinite(latitude) && Number.isFinite(longitude);
  const mapUrl = hasPosition
    ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(latitude)}&mlon=${encodeURIComponent(longitude)}#map=15/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`
    : "";
  return `<article class="portal-card traffic-message${isFocused ? " selected" : ""}"${isFocused ? ' data-traffic-event="focused"' : ""}>
    <span class="portal-card-icon traffic ${escapeTraffic(item.severity)}"><i data-lucide="${icons[item.category] || "car-front"}"></i></span>
    <div>
      <h3>${escapeTraffic(item.title)}</h3>
      ${item.message ? `<p>${escapeTraffic(item.message)}</p>` : ""}
      <div class="portal-tags">${[item.road, item.location, status].filter(Boolean).map((value) => `<span>${escapeTraffic(value)}</span>`).join("")}</div>
      ${isFocused ? '<strong class="traffic-selected-label"><i data-lucide="map-pin"></i> Händelsen du valde</strong>' : ""}
      <div class="traffic-source"><span>Källa: ${escapeTraffic(source)}</span><div class="traffic-source-actions">${hasPosition ? `<a href="${escapeTraffic(safeTrafficUrl(mapUrl))}" target="_blank" rel="noopener noreferrer">Visa exakt plats</a>` : ""}<a href="${escapeTraffic(safeTrafficUrl(item.sourceUrl || "https://www.trafikverket.se/trafikinformation/vag/"))}" target="_blank" rel="noopener noreferrer">Trafikverkets vägkarta</a></div></div>
    </div>
    <time>${escapeTraffic(formatTrafficValidity(item))}</time>
  </article>`;
}

initializeTrafficPage();
