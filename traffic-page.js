const municipalityState = window.DinPulsMunicipalityState;
const TRAFFIC_STALE_MINUTES = 40;
let trafficMunicipality = municipalityState.getInitial();
let fullRoadTrafficData = null;
const municipalityWebsites = {
  "Åmål": "https://www.amal.se/", "Säffle": "https://www.saffle.se/",
  "Bengtsfors": "https://www.bengtsfors.se/", "Mellerud": "https://www.mellerud.se/",
  "Årjäng": "https://www.arjang.se/", "Arvika": "https://www.arvika.se/", "Grums": "https://www.grums.se/"
};

const escapeTraffic = (value) => String(value ?? "").replace(
  /[&<>"']/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]
);

async function initializeTrafficPage() {
  const select = document.querySelector("#traffic-municipality");
  municipalityState.populateSelect(select, trafficMunicipality);
  select.addEventListener("change", () => {
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
    const response = await fetch(`data/road-traffic.json?version=${Date.now()}`, { cache: "no-store" });
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
  if (municipalitySource) municipalitySource.href = municipalityWebsites[trafficMunicipality];

  const query = document.querySelector("#traffic-search").value.trim().toLocaleLowerCase("sv-SE");
  const type = document.querySelector("#traffic-type").value;
  const allItems = fullRoadTrafficData.municipalities?.[trafficMunicipality]?.items || [];
  const items = allItems.filter((item) => {
    const typeMatches = type === "all" || item.category === type;
    const searchable = [item.title, item.message, item.road, item.location].join(" ").toLocaleLowerCase("sv-SE");
    return typeMatches && (!query || searchable.includes(query));
  });

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

function renderTrafficMessage(item) {
  const icons = { accident: "triangle-alert", roadwork: "construction", congestion: "traffic-cone", obstacle: "shield-alert", weather: "cloud-snow" };
  const time = new Date(item.updatedAt || item.startTime || "");
  const source = item.source || "Trafikverket";
  const status = item.status === "planned" ? "Planerad" : item.categoryLabel;
  return `<article class="portal-card traffic-message">
    <span class="portal-card-icon traffic ${escapeTraffic(item.severity)}"><i data-lucide="${icons[item.category] || "car-front"}"></i></span>
    <div>
      <h3>${escapeTraffic(item.title)}</h3>
      ${item.message ? `<p>${escapeTraffic(item.message)}</p>` : ""}
      <div class="portal-tags">${[item.road, item.location, status].filter(Boolean).map((value) => `<span>${escapeTraffic(value)}</span>`).join("")}</div>
      <div class="traffic-source"><span>Källa: ${escapeTraffic(source)}</span><a href="${escapeTraffic(item.sourceUrl || "https://www.trafikverket.se/trafikinformation/vag/")}" target="_blank" rel="noopener noreferrer">Öppna trafikkartan</a></div>
    </div>
    <time>${Number.isNaN(time.getTime()) ? "Tid saknas" : time.toLocaleString("sv-SE", { timeZone: "Europe/Stockholm", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
  </article>`;
}

function renderStrategicAds(category, pageLabel, listSelector) {
  const slots = [...document.querySelectorAll("[data-strategic-ad]")];
  slots.forEach((slot) => {
    const position = Number(slot.dataset.adPosition || 1);
    const subject = encodeURIComponent(`Annonsplats ${category} ${position}`);
    slot.innerHTML = `<a class="secondary-ad strategic-ad" href="mailto:annonser@dinpuls.se?subject=${subject}"><b>ANNONSPLATS ${position}</b><strong>Ditt företag här</strong><small>På DinPuls ${pageLabel} · 500 kr/mån</small></a>`;
  });
  const inlineSlot = slots.find((slot) => slot.dataset.adPosition === "3");
  const list = document.querySelector(listSelector);
  if (!inlineSlot || !list) return;
  const placeInline = () => {
    const cards = [...list.children].filter((child) => child !== inlineSlot);
    if (cards.length < 4) return;
    const anchor = cards[Math.min(cards.length - 1, Math.max(2, Math.floor(cards.length / 2)))];
    if (anchor.previousElementSibling !== inlineSlot) list.insertBefore(inlineSlot, anchor);
  };
  new MutationObserver(placeInline).observe(list, { childList: true });
  queueMicrotask(placeInline);
}

initializeTrafficPage();
