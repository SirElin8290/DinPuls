const healthState = window.DinPulsMunicipalityState;
let healthMunicipality = healthState.getInitial();
let healthData;

const escapeHealth = window.DinPulsSecurity.escapeHtml;
const safeHealthUrl = window.DinPulsSecurity.safeExternalUrl;
const safeHealthIcon = window.DinPulsSecurity.safeIconName;

function regionDetails(county) {
  return county === "Värmlands län"
    ? { name: "1177 Värmland", url: "https://www.1177.se/Varmland/" }
    : { name: "1177 Västra Götaland", url: "https://www.1177.se/Vastra-Gotaland/" };
}

function renderHealthPage() {
  const municipalityData = healthData?.municipalities?.[healthMunicipality];
  if (!municipalityData) return;
  const query = document.querySelector("#health-search")?.value.trim().toLocaleLowerCase("sv-SE") || "";
  const providers = (healthData.providers || []).filter(provider =>
    provider.municipality === healthMunicipality &&
    [provider.name, provider.description, provider.sourceType].join(" ").toLocaleLowerCase("sv-SE").includes(query)
  ).sort((first, second) => first.name.localeCompare(second.name, "sv-SE"));
  const region = regionDetails(municipalityData.county);
  document.querySelectorAll("[data-health-municipality]").forEach(element => { element.textContent = healthMunicipality; });
  document.querySelector("#health-county").textContent = municipalityData.county;
  document.querySelector("#health-region-name").textContent = region.name;
  document.querySelector("#health-region-link").href = region.url;
  document.querySelector("#health-1177-link").href = healthData.officialCareUrl;
  document.querySelector("#health-result-count").textContent = `${providers.length} mottagningar`;
  document.querySelector("#health-category-grid").innerHTML = providers.map(provider => `
    <a class="health-category-card" href="${escapeHealth(safeHealthUrl(provider.url))}" target="_blank" rel="noopener noreferrer" aria-label="Öppna ${escapeHealth(provider.name)} hos ${escapeHealth(provider.sourceType)}">
      <span class="portal-card-icon health"><i data-lucide="${escapeHealth(safeHealthIcon(provider.icon))}"></i></span>
      <span><strong>${escapeHealth(provider.name)}</strong><small>${escapeHealth(provider.description)}</small><em>Direktlänk · ${escapeHealth(provider.sourceType)}</em></span>
      <i data-lucide="external-link"></i>
    </a>`).join("");
  document.querySelector("#health-empty").hidden = providers.length > 0;
  document.querySelector("#health-category-grid").hidden = providers.length === 0;
  document.title = `Vård och hälsa i ${healthMunicipality} – DinPuls`;
  if (window.lucide) lucide.createIcons();
}

function renderHealthAds() {
  document.querySelectorAll("[data-strategic-ad]").forEach(slot => {
    const position = Number(slot.dataset.adPosition || 1);
    const subject = encodeURIComponent(`Annonsplats vård och hälsa ${position}`);
    slot.innerHTML = `<a class="secondary-ad strategic-ad" href="mailto:annons@dinpuls.se?subject=${subject}"><b>ANNONSPLATS ${position}</b><strong>Ditt företag här</strong><small>På DinPuls Vård och hälsa · 500 kr/månad + moms</small></a>`;
  });
}

async function initializeHealthPage() {
  const response = await fetch("data/health.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`Vårddata kunde inte laddas (${response.status})`);
  healthData = await response.json();
  const select = document.querySelector("#health-municipality");
  healthState.populateSelect(select, healthMunicipality);
  select.addEventListener("change", () => {
    healthMunicipality = healthState.set(select.value);
    renderHealthPage();
  });
  document.querySelector("#health-search")?.addEventListener("input", renderHealthPage);
  renderHealthAds();
  renderHealthPage();
}

initializeHealthPage().catch(error => {
  console.error(error);
  document.querySelector("#health-result-count").textContent = "Innehållet kunde inte laddas";
  document.querySelector("#health-empty").hidden = false;
});
