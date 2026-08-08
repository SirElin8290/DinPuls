const healthState = window.DinPulsMunicipalityState;
let healthMunicipality = healthState.getInitial();
let healthData;

const escapeHealth = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function regionDetails(county) {
  return county === "Värmlands län"
    ? { name: "1177 Värmland", url: "https://www.1177.se/Varmland/" }
    : { name: "1177 Västra Götaland", url: "https://www.1177.se/Vastra-Gotaland/" };
}

function externalSearchUrl(category, municipality) {
  const terms = {
    vardcentral: "vårdcentral",
    jour: "jourcentral akutmottagning",
    tandvard: "tandläkare",
    apotek: "apotek",
    fysioterapi: "fysioterapeut sjukgymnast",
    kiropraktor: "kiropraktor",
    naprapat: "naprapat",
    massage: "massage friskvård",
    fotvard: "medicinsk fotvård",
    "psykisk-halsa": "psykolog samtalsstöd",
    arbetsterapi: "arbetsterapi rehabilitering",
    "syn-horsel": "optiker hörselmottagning"
  };
  return `https://www.google.com/maps/search/${encodeURIComponent(`${terms[category] || category} ${municipality}`)}`;
}

function renderHealthPage() {
  const municipalityData = healthData?.municipalities?.[healthMunicipality];
  if (!municipalityData) return;
  const query = document.querySelector("#health-search")?.value.trim().toLocaleLowerCase("sv-SE") || "";
  const categories = (healthData.categories || []).filter(category =>
    [category.name, category.description].join(" ").toLocaleLowerCase("sv-SE").includes(query)
  );
  const region = regionDetails(municipalityData.county);
  document.querySelectorAll("[data-health-municipality]").forEach(element => { element.textContent = healthMunicipality; });
  document.querySelector("#health-county").textContent = municipalityData.county;
  document.querySelector("#health-region-name").textContent = region.name;
  document.querySelector("#health-region-link").href = region.url;
  document.querySelector("#health-1177-link").href = healthData.officialCareUrl;
  document.querySelector("#health-result-count").textContent = `${categories.length} kategorier`;
  document.querySelector("#health-category-grid").innerHTML = categories.map(category => `
    <a class="health-category-card" href="${escapeHealth(externalSearchUrl(category.id, healthMunicipality))}" target="_blank" rel="noopener noreferrer">
      <span class="portal-card-icon health"><i data-lucide="${escapeHealth(category.icon)}"></i></span>
      <span><strong>${escapeHealth(category.name)}</strong><small>${escapeHealth(category.description)}</small>${category.official ? "<em>Kontrollera hos 1177</em>" : "<em>Lokalt sökresultat</em>"}</span>
      <i data-lucide="external-link"></i>
    </a>`).join("");
  document.querySelector("#health-empty").hidden = categories.length > 0;
  document.querySelector("#health-category-grid").hidden = categories.length === 0;
  document.title = `Vård och hälsa i ${healthMunicipality} – DinPuls`;
  if (window.lucide) lucide.createIcons();
}

function renderHealthAds() {
  document.querySelectorAll("[data-strategic-ad]").forEach(slot => {
    const position = Number(slot.dataset.adPosition || 1);
    const subject = encodeURIComponent(`Annonsplats vård och hälsa ${position}`);
    slot.innerHTML = `<a class="secondary-ad strategic-ad" href="mailto:annonser@dinpuls.se?subject=${subject}"><b>ANNONSPLATS ${position}</b><strong>Ditt företag här</strong><small>På DinPuls Vård och hälsa · 500 kr/mån</small></a>`;
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
