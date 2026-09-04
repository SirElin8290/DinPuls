const municipalityState = window.DinPulsMunicipalityState;
let eventMunicipality = municipalityState.getInitial();
let fullEventsData = null;
let fargelandaEventSupplement = null;

const escapeEvent = window.DinPulsSecurity.escapeHtml;
const safeEventUrl = window.DinPulsSecurity.safeExternalUrl;
const safeEventIcon = window.DinPulsSecurity.safeIconName;
const eventIcons = { culture:"palette", music:"music", family:"baby", church:"church", sport:"trophy", community:"users", motor:"car-front" };

function updateEventPageChrome() {
  document.querySelectorAll("[data-events-municipality]").forEach(element => element.textContent = eventMunicipality);
  document.title = `Evenemang i ${eventMunicipality} – DinPuls`;
}

async function initializeEventPage() {
  const select = document.querySelector("#events-municipality");
  municipalityState.populateSelect(select, eventMunicipality);
  updateEventPageChrome();
  select.addEventListener("change", () => {
    eventMunicipality = municipalityState.set(select.value);
    renderEventPage();
  });
  ["#events-category", "#events-period"].forEach(selector => document.querySelector(selector).addEventListener("change", renderEventPage));
  document.querySelector("#events-search").addEventListener("input", renderEventPage);
  renderStrategicAds("evenemang", "evenemangssida", "#events-page-list");
  const [response, fargelandaSupplementResponse] = await Promise.all([
    fetch(`data/events.json`, { cache:"no-store" }),
    fetch(`data/events-fargelanda-supplement.json`, { cache:"no-store" })
  ]);
  if (!response.ok) throw new Error(`Status ${response.status}`);
  fullEventsData = await response.json();
  fargelandaEventSupplement = fargelandaSupplementResponse.ok
    ? await fargelandaSupplementResponse.json()
    : { events:[] };
  renderEventPage();
}

function stockholmDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Stockholm", year:"numeric", month:"2-digit", day:"2-digit" }).format(date);
}

function weekendRange() {
  const today = new Date(`${stockholmDateKey()}T12:00:00`);
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7));
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return [stockholmDateKey(saturday), stockholmDateKey(sunday)];
}

function eventMatchesPeriod(item, period) {
  const today = stockholmDateKey();
  const start = String(item.startDate || "").slice(0, 10);
  const end = String(item.endDate || item.startDate || "").slice(0, 10);
  if (end < today) return false;
  if (period === "today") return start <= today && end >= today;
  if (period === "weekend") {
    const [saturday, sunday] = weekendRange();
    return end >= saturday && start <= sunday;
  }
  if (period === "30") {
    const limit = new Date(`${today}T12:00:00`);
    limit.setDate(limit.getDate() + 30);
    return start <= stockholmDateKey(limit);
  }
  return true;
}

function mergedEventDataForMunicipality() {
  const base = fullEventsData?.municipalities?.[eventMunicipality] || { events:[], sources:[] };
  if (eventMunicipality !== "Färgelanda" || !fargelandaEventSupplement?.events?.length) return base;

  const today = stockholmDateKey();
  const supplementEvents = fargelandaEventSupplement.events.filter(item => String(item.endDate || item.startDate || "") >= today);
  const merged = new Map();
  [...(base.events || []), ...supplementEvents].forEach(item => {
    const titleKey = String(item.title || "").toLocaleLowerCase("sv-SE").replace(/\W+/g, "");
    const key = `${titleKey}|${String(item.startDate || "").slice(0, 10)}`;
    const current = merged.get(key);
    if (!current || item.verified) merged.set(key, item);
  });
  return {
    ...base,
    events:[...merged.values()],
    sources:base.sources || []
  };
}

function renderEventPage() {
  if (!fullEventsData) return;
  updateEventPageChrome();
  const data = mergedEventDataForMunicipality();
  const query = document.querySelector("#events-search").value.trim().toLocaleLowerCase("sv-SE");
  const category = document.querySelector("#events-category").value;
  const period = document.querySelector("#events-period").value;
  const items = (data.events || []).filter(item => {
    if (!eventMatchesPeriod(item, period)) return false;
    if (category !== "all" && item.category !== category) return false;
    const searchable = [item.title, item.venue, item.sourceName, item.categoryLabel].join(" ").toLocaleLowerCase("sv-SE");
    return !query || searchable.includes(query);
  }).sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)) || String(a.title).localeCompare(String(b.title), "sv"));

  document.querySelector("#events-page-total").textContent = `${items.length} kommande ${items.length === 1 ? "evenemang" : "evenemang"}`;
  const updated = new Date(fullEventsData.generatedAt || "");
  document.querySelector("#events-page-updated").textContent = Number.isNaN(updated.getTime()) ? "" : `Källor kontrollerade ${updated.toLocaleString("sv-SE", { timeZone:"Europe/Stockholm", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}`;
  const list = document.querySelector("#events-page-list");
  list.innerHTML = items.map(renderEventCard).join("");
  list.hidden = !items.length;
  document.querySelector("#events-page-empty").hidden = Boolean(items.length);
  const healthByUrl = new Map((data.sourceHealth || []).map(status => [status.url, status]));
  document.querySelector("#events-source-list").innerHTML = (data.sources || []).map(source => renderEventSource(source, healthByUrl.get(source.url))).join("");
  if (window.lucide) lucide.createIcons();
}

function renderEventCard(item) {
  const start = new Date(`${String(item.startDate).slice(0, 10)}T12:00:00`);
  const end = new Date(`${String(item.endDate || item.startDate).slice(0, 10)}T12:00:00`);
  const same = start.toDateString() === end.toDateString();
  const dateLabel = Number.isNaN(start.getTime()) ? "Datum saknas" : same
    ? start.toLocaleDateString("sv-SE", { timeZone:"Europe/Stockholm", weekday:"short", day:"numeric", month:"short" })
    : `${start.toLocaleDateString("sv-SE", { timeZone:"Europe/Stockholm", day:"numeric", month:"short" })}–${end.toLocaleDateString("sv-SE", { timeZone:"Europe/Stockholm", day:"numeric", month:"short" })}`;
  return `<article class="portal-card event-message"><span class="portal-card-icon event"><i data-lucide="${eventIcons[item.category] || "calendar-days"}"></i></span><div><span class="event-date">${escapeEvent(dateLabel)}${item.time ? ` · ${escapeEvent(item.time)}` : ""}</span><h3>${escapeEvent(item.title)}</h3><p>${escapeEvent(item.venue || eventMunicipality)}</p><div class="portal-tags"><span>${escapeEvent(item.categoryLabel || "Evenemang")}</span><span>${escapeEvent(item.sourceName || "Lokal källa")}</span>${item.verified ? '<span><i data-lucide="badge-check"></i> Verifierad källa</span>' : ""}</div></div><a class="portal-source-button" href="${escapeEvent(safeEventUrl(item.url))}" target="_blank" rel="noopener noreferrer">Tid och detaljer <i data-lucide="external-link"></i></a></article>`;
}

function renderEventSource(source, health) {
  const imported = Number(health?.events) || 0;
  let status = "Verifierad lokal källa";
  if (health?.status === "ok") status = imported ? `Automatisk källa · ${imported} kommande tillfällen` : "Kontrollerad kalender · öppna hela programmet";
  if (health?.status === "error") status = "Tillfälligt fel vid automatisk kontroll · länken fungerar fortfarande";
  return `<a class="event-source" href="${escapeEvent(safeEventUrl(source.url))}" target="_blank" rel="noopener noreferrer"><span class="portal-card-icon event"><i data-lucide="${escapeEvent(safeEventIcon(source.icon, "calendar-days"))}"></i></span><span><strong>${escapeEvent(source.name)}</strong><small>${escapeEvent(source.type)} · ${escapeEvent(status)}</small></span><i data-lucide="external-link"></i></a>`;
}

initializeEventPage().catch(error => {
  console.error(error);
  document.querySelector("#events-page-total").textContent = "Evenemangen kunde inte laddas";
  document.querySelector("#events-page-empty").hidden = false;
});
