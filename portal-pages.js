const PORTAL_MUNICIPALITIES = ["Åmål", "Säffle", "Bengtsfors", "Mellerud", "Årjäng", "Arvika", "Grums"];
const portalType = document.documentElement.dataset.portal;
const params = new URLSearchParams(location.search);
let portalMunicipality = params.get("kommun") || localStorage.getItem("dinpuls-municipality") || "Åmål";
if (!PORTAL_MUNICIPALITIES.includes(portalMunicipality)) portalMunicipality = "Åmål";
let portalData;

const escapePortal = (value) => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const formatNumber = value => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(Number(value));

async function initializePortal() {
  const municipalitySelect = document.querySelector("#portal-municipality");
  municipalitySelect.innerHTML = PORTAL_MUNICIPALITIES.map(name => `<option ${name === portalMunicipality ? "selected" : ""}>${name}</option>`).join("");
  municipalitySelect.addEventListener("change", () => {
    portalMunicipality = municipalitySelect.value;
    localStorage.setItem("dinpuls-municipality", portalMunicipality);
    history.replaceState(null, "", `${location.pathname}?kommun=${encodeURIComponent(portalMunicipality)}`);
    renderPortal();
  });
  document.querySelector("#portal-search")?.addEventListener("input", renderPortal);
  document.querySelector("#housing-rooms")?.addEventListener("change", renderPortal);
  document.querySelector("#housing-rent")?.addEventListener("input", renderPortal);
  renderSecondaryAds();
  const response = await fetch(`data/${portalType === "jobs" ? "jobs" : "housing"}.json?version=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Data kunde inte laddas (${response.status})`);
  portalData = await response.json();
  renderPortal();
}

function renderPortal() {
  if (!portalData) return;
  document.querySelectorAll("[data-portal-municipality]").forEach(element => element.textContent = portalMunicipality);
  document.title = `${portalType === "jobs" ? "Lediga jobb" : "Lediga bostäder"} i ${portalMunicipality} – DinPuls`;
  const municipalityData = portalData.municipalities?.[portalMunicipality] || {};
  const query = document.querySelector("#portal-search")?.value.trim().toLocaleLowerCase("sv-SE") || "";
  const sourceItems = portalType === "jobs" ? (municipalityData.jobs || []) : (municipalityData.listings || []);
  const filtered = sourceItems.filter(item => {
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
  const total = document.querySelector("#portal-total");
  total.textContent = `${filtered.length} ${portalType === "jobs" ? "lediga jobb" : "lediga bostäder"}`;
  const updated = new Date(municipalityData.updatedAt || portalData.generatedAt);
  document.querySelector("#portal-updated").textContent = Number.isNaN(updated.getTime()) ? "" : `Uppdaterad ${updated.toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
  const list = document.querySelector("#portal-list");
  list.innerHTML = filtered.map(portalType === "jobs" ? renderPortalJob : renderPortalHousing).join("");
  document.querySelector("#portal-empty").hidden = filtered.length > 0;
  list.hidden = filtered.length === 0;
  if (window.lucide) lucide.createIcons();
}

function renderPortalHousing(item) {
  const details = [Number(item.rooms) > 0 ? `${formatNumber(item.rooms)} rum` : "", Number(item.size) > 0 ? `${formatNumber(item.size)} m²` : "", Number(item.rent) > 0 ? `${new Intl.NumberFormat("sv-SE").format(item.rent)} kr/mån` : ""].filter(Boolean);
  return `<article class="portal-card"><span class="portal-card-icon housing"><i data-lucide="house"></i></span><div><h3>${escapePortal(item.address || "Ledig bostad")}</h3><p>${escapePortal(item.area || item.provider || "")}</p><div class="portal-tags">${details.map(detail => `<span>${escapePortal(detail)}</span>`).join("")}</div><small>${escapePortal(item.available ? `Tillgänglig ${item.available}` : "Se tillgänglighet hos hyresvärden")} · ${escapePortal(item.provider || "Officiell hyresvärd")}</small></div><a class="portal-source-button" href="${escapePortal(item.url)}" target="_blank" rel="noopener noreferrer">Visa hos hyresvärden <i data-lucide="external-link"></i></a></article>`;
}

function renderPortalJob(job) {
  return `<article class="portal-card"><span class="portal-card-icon jobs"><i data-lucide="briefcase-business"></i></span><div><h3>${escapePortal(job.headline || "Ledigt jobb")}</h3><p>${escapePortal(job.employer || "Arbetsgivare saknas")} · ${escapePortal(job.workplace || portalMunicipality)}</p><div class="portal-tags"><span>${escapePortal(job.workingHours || "Arbetstid ej angiven")}</span>${job.duration ? `<span>${escapePortal(job.duration)}</span>` : ""}</div><small>${job.applicationDeadline ? `Sök senast ${escapePortal(job.applicationDeadline)}` : "Se ansökningstid i annonsen"}</small></div><a class="portal-source-button" href="${escapePortal(job.webpageUrl)}" target="_blank" rel="noopener noreferrer">Läs och ansök <i data-lucide="external-link"></i></a></article>`;
}

function renderSecondaryAds() {
  const box = document.querySelector("[data-secondary-ads]");
  if (!box) return;
  box.innerHTML = `<span class="section-kicker">Lokala annonser</span><h2>Syns där kunderna letar</h2>${Array.from({ length: 4 }, (_, index) => `<a class="secondary-ad" href="mailto:annonser@dinpuls.se?subject=Annonsplats%20${portalType}%20${index + 1}"><b>ANNONSPLATS ${index + 1}</b><strong>Ditt företag här</strong><small>På DinPuls ${portalType === "jobs" ? "jobbsida" : "bostadssida"} · 500 kr/mån</small></a>`).join("")}<p class="ad-sales-note">Annonsplatserna kan säljas separat per kommun och kategori.</p>`;
}

initializePortal().catch(error => {
  console.error(error);
  document.querySelector("#portal-total").textContent = "Innehållet kunde inte laddas";
  document.querySelector("#portal-empty").hidden = false;
  document.querySelector("#portal-empty").textContent = "Försök igen om en liten stund.";
});
