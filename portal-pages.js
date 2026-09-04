const municipalityState = window.DinPulsMunicipalityState;
const portalType = document.documentElement.dataset.portal;
let portalMunicipality = municipalityState.getInitial();
let portalData;
let portalSelectedListing = new URLSearchParams(window.location.search).get("annons") || "";

const escapePortal = window.DinPulsSecurity.escapeHtml;
const safePortalUrl = window.DinPulsSecurity.safeExternalUrl;
const formatNumber = value => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(Number(value));

function updatePortalChrome() {
  document.querySelectorAll("[data-portal-municipality]").forEach(element => element.textContent = portalMunicipality);
  document.title = `${portalType === "jobs" ? "Lediga jobb" : "Lediga bostäder"} i ${portalMunicipality} – DinPuls`;
}

async function initializePortal() {
  const municipalitySelect = document.querySelector("#portal-municipality");
  municipalityState.populateSelect(municipalitySelect, portalMunicipality);
  updatePortalChrome();
  municipalitySelect.addEventListener("change", () => {
    portalMunicipality = municipalityState.set(municipalitySelect.value);
    portalSelectedListing = "";
    renderPortal();
  });
  document.querySelector("#portal-search")?.addEventListener("input", renderPortal);
  document.querySelector("#housing-rooms")?.addEventListener("change", renderPortal);
  document.querySelector("#housing-rent")?.addEventListener("input", renderPortal);
  renderSecondaryAds();
  const response = await fetch(`data/${portalType === "jobs" ? "jobs" : "housing"}.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Data kunde inte laddas (${response.status})`);
  portalData = await response.json();

  if (portalType === "housing") {
    try {
      const supplementResponse = await fetch("data/housing-fargelanda-supplement.json", { cache: "no-store" });
      if (supplementResponse.ok) {
        const supplement = await supplementResponse.json();
        if (Array.isArray(supplement?.listings) && supplement.listings.length > 0) {
          portalData.municipalities ||= {};
          portalData.municipalities.Färgelanda = {
            ...supplement,
            checkedAt: supplement.sourceChecked ? `${supplement.sourceChecked}T12:00:00+02:00` : undefined,
            updatedAt: supplement.sourceChecked ? `${supplement.sourceChecked}T12:00:00+02:00` : undefined
          };
        }
      }
    } catch (error) {
      console.error("Färgelandas bostadstillägg kunde inte laddas på bostadssidan:", error);
    }
  }

  renderPortal();
}

function renderPortal() {
  if (!portalData) return;
  updatePortalChrome();
  const municipalityData = portalData.municipalities?.[portalMunicipality] || {};
  const query = document.querySelector("#portal-search")?.value.trim().toLocaleLowerCase("sv-SE") || "";
  const sourceItems = portalType === "jobs" ? (municipalityData.jobs || []) : (municipalityData.listings || []);
  let filtered = sourceItems.filter(item => {
    const text = portalType === "jobs"
      ? [item.headline, item.employer, item.occupation, item.workplace].join(" ")
      : [item.address, item.area, item.provider].join(" ");
    if (query && !text.toLocaleLowerCase("sv-SE").includes(query)) return false;
    if (portalType === "housing") {
      const rooms = Number(document.querySelector("#housing-rooms")?.value || 0);
      const maxRent = Number(document.querySelector("#housing-rent")?.value || 0);
      if (rooms === 4 ? Number(item.rooms) < 4 : rooms > 0 && Number(item.rooms) < rooms) return false;
      if (maxRent > 0 && Number(item.rent) > maxRent) return false;
    }
    return true;
  });
  if (portalType === "housing" && portalSelectedListing) {
    filtered = [...filtered].sort((left, right) => Number(isSelectedHousing(right)) - Number(isSelectedHousing(left)));
  }
  const total = document.querySelector("#portal-total");
  if (portalType === "jobs") {
    const advertisedTotal = Number(municipalityData.total) || sourceItems.length;
    total.textContent = query
      ? `${filtered.length} jobb matchar sökningen`
      : sourceItems.length < advertisedTotal
        ? `Visar ${sourceItems.length} av ${advertisedTotal} lediga jobb`
        : `${filtered.length} lediga jobb`;
  } else {
    total.textContent = `${filtered.length} lediga bostäder`;
  }
  const checked = new Date(municipalityData.checkedAt || municipalityData.updatedAt || portalData.generatedAt);
  document.querySelector("#portal-updated").textContent = Number.isNaN(checked.getTime())
    ? ""
    : `${municipalityData.stale ? "Senaste data visas · kontroll misslyckades" : "Kontrollerad"} ${checked.toLocaleString("sv-SE", { timeZone: "Europe/Stockholm", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
  const list = document.querySelector("#portal-list");
  list.innerHTML = filtered.map(portalType === "jobs" ? renderPortalJob : renderPortalHousing).join("");
  document.querySelector("#portal-empty").hidden = filtered.length > 0;
  list.hidden = filtered.length === 0;
  if (portalType === "housing" && portalSelectedListing) {
    requestAnimationFrame(() => list.querySelector(".portal-card.selected")?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }
  if (window.lucide) lucide.createIcons();
}

function renderPortalHousing(item) {
  const details = [Number(item.rooms) > 0 ? `${formatNumber(item.rooms)} rum` : "", Number(item.size) > 0 ? `${formatNumber(item.size)} m²` : "", Number(item.rent) > 0 ? `${new Intl.NumberFormat("sv-SE").format(item.rent)} kr/mån` : ""].filter(Boolean);
  return `<article class="portal-card${isSelectedHousing(item) ? " selected" : ""}"><span class="portal-card-icon housing"><i data-lucide="house"></i></span><div><h3>${escapePortal(item.address || "Ledig bostad")}</h3><p>${escapePortal(item.area || item.provider || "")}</p><div class="portal-tags">${details.map(detail => `<span>${escapePortal(detail)}</span>`).join("")}</div><small>${escapePortal(formatPortalAvailability(item.available))} · ${escapePortal(item.provider || "Officiell hyresvärd")}</small></div><a class="portal-source-button" href="${escapePortal(safePortalUrl(item.url))}" target="_blank" rel="noopener noreferrer">Visa hos hyresvärden <i data-lucide="external-link"></i></a></article>`;
}

function formatPortalAvailability(value) {
  if (!value) return "Se tillgänglighet hos hyresvärden";
  if (String(value).trim().toLocaleLowerCase("sv-SE") === "nu") return "Tillgänglig nu";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? `Tillgänglig ${value}`
    : `Tillgänglig ${date.toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm", day: "numeric", month: "long", year: "numeric" })}`;
}

function isSelectedHousing(item) {
  return portalSelectedListing !== "" && [item.url, item.id, item.address].some(value => String(value || "") === portalSelectedListing);
}

function renderPortalJob(job) {
  const deadline = job.applicationDeadline
    ? new Date(job.applicationDeadline).toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm", day: "numeric", month: "short", year: "numeric" })
    : "";
  return `<article class="portal-card"><span class="portal-card-icon jobs"><i data-lucide="briefcase-business"></i></span><div><h3>${escapePortal(job.headline || "Ledigt jobb")}</h3><p>${escapePortal(job.employer || "Arbetsgivare saknas")} · ${escapePortal(job.workplace || portalMunicipality)}</p><div class="portal-tags"><span>${escapePortal(job.workingHours || "Arbetstid ej angiven")}</span>${job.duration ? `<span>${escapePortal(job.duration)}</span>` : ""}</div><small>${deadline ? `Sök senast ${escapePortal(deadline)}` : "Se ansökningstid i annonsen"}</small></div><a class="portal-source-button" href="${escapePortal(safePortalUrl(job.webpageUrl))}" target="_blank" rel="noopener noreferrer">Läs och ansök <i data-lucide="external-link"></i></a></article>`;
}

function renderSecondaryAds() {
  const category = portalType === "jobs" ? "jobb" : "bostäder";
  const label = portalType === "jobs" ? "jobbsida" : "bostadssida";
  renderStrategicAds(category, label, "#portal-list");
}

initializePortal().catch(error => {
  console.error(error);
  document.querySelector("#portal-total").textContent = "Innehållet kunde inte laddas";
  document.querySelector("#portal-empty").hidden = false;
  document.querySelector("#portal-empty").textContent = "Försök igen om en liten stund.";
});
