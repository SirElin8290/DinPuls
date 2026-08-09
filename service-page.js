const serviceState = window.DinPulsMunicipalityState;
let serviceMunicipality = serviceState.getInitial();
let serviceData;

const serviceAdvertisers = {
  "Årjäng": {
    1: {
      name: "Åslanda Handelsträdgård",
      image: "assets/ads/aslanda-handelstradgard.webp",
      url: "https://www.facebook.com/profile.php?id=61576659453588",
      alt: "Åslanda Handelsträdgård – öppet torsdagar 14–18"
    }
  }
};

const escapeService = window.DinPulsSecurity.escapeHtml;
const safeServiceUrl = window.DinPulsSecurity.safeExternalUrl;

function serviceSearchUrl(category, municipality) {
  return `https://www.google.com/maps/search/${encodeURIComponent(`${category.query} ${municipality}`)}`;
}

function renderServicePage() {
  const query = document.querySelector("#service-search")?.value.trim().toLocaleLowerCase("sv-SE") || "";
  const group = document.querySelector("#service-group")?.value || "";
  const categories = (serviceData.categories || []).filter(category =>
    (!group || category.group === group) && [category.name, category.description, category.group, category.query].join(" ").toLocaleLowerCase("sv-SE").includes(query)
  );
  document.querySelectorAll("[data-service-municipality]").forEach(element => { element.textContent = serviceMunicipality; });
  document.querySelector("#service-result-count").textContent = `${categories.length} kategorier`;
  document.querySelector("#service-category-grid").innerHTML = categories.map(category => `
    <a class="service-category-card" href="${escapeService(safeServiceUrl(serviceSearchUrl(category, serviceMunicipality)))}" target="_blank" rel="noopener noreferrer">
      <span class="portal-card-icon service"><i data-lucide="${escapeService(category.icon)}"></i></span>
      <span><em>${escapeService(category.group)}</em><strong>${escapeService(category.name)}</strong><small>${escapeService(category.description)}</small></span>
      <i data-lucide="external-link"></i>
    </a>`).join("");
  document.querySelector("#service-empty").hidden = categories.length > 0;
  document.querySelector("#service-category-grid").hidden = categories.length === 0;
  document.title = `Service & hantverk i ${serviceMunicipality} – DinPuls`;
  if (window.lucide) lucide.createIcons();
}

function renderServiceAds() {
  document.querySelectorAll("[data-strategic-ad]").forEach(slot => {
    const position = Number(slot.dataset.adPosition || 1);
    const advertiser = serviceAdvertisers[serviceMunicipality]?.[position];
    if (advertiser) {
      slot.innerHTML = `
        <a class="secondary-ad strategic-ad strategic-image-ad" href="${escapeService(safeServiceUrl(advertiser.url))}" target="_blank" rel="noopener noreferrer" aria-label="Annons: ${escapeService(advertiser.name)} – öppna Facebooksidan i en ny flik">
          <span class="strategic-image-ad-label">Annons</span>
          <img src="${escapeService(advertiser.image)}" alt="${escapeService(advertiser.alt)}" width="1536" height="1024">
        </a>`;
      return;
    }
    const subject = encodeURIComponent(`Annonsplats Service & hantverk ${position}`);
    slot.innerHTML = `<a class="secondary-ad strategic-ad" href="mailto:annonser@dinpuls.se?subject=${subject}"><b>ANNONSPLATS ${position}</b><strong>Ditt företag här</strong><small>På DinPuls Service &amp; hantverk · 500 kr/mån</small></a>`;
  });
}

async function initializeServicePage() {
  const response = await fetch("data/service.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`Servicedata kunde inte laddas (${response.status})`);
  serviceData = await response.json();
  const municipalitySelect = document.querySelector("#service-municipality");
  const groupSelect = document.querySelector("#service-group");
  serviceState.populateSelect(municipalitySelect, serviceMunicipality);
  [...new Set(serviceData.categories.map(category => category.group))].forEach(group => groupSelect.add(new Option(group, group)));
  const parameters = new URLSearchParams(window.location.search);
  if (parameters.get("grupp") && [...groupSelect.options].some(option => option.value === parameters.get("grupp"))) groupSelect.value = parameters.get("grupp");
  municipalitySelect.addEventListener("change", () => {
    serviceMunicipality = serviceState.set(municipalitySelect.value);
    renderServiceAds();
    renderServicePage();
  });
  groupSelect.addEventListener("change", renderServicePage);
  document.querySelector("#service-search")?.addEventListener("input", renderServicePage);
  renderServiceAds();
  renderServicePage();
}

initializeServicePage().catch(error => {
  console.error(error);
  document.querySelector("#service-result-count").textContent = "Innehållet kunde inte laddas";
  document.querySelector("#service-empty").hidden = false;
});
