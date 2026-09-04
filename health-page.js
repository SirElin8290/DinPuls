const healthState = window.DinPulsMunicipalityState;
let healthMunicipality = healthState.getInitial();
let healthData;
let healthPrivateData;
let healthPrivateSupplement;
let healthLocalSupplement;
let healthKarlstadPrivateSupplement;

const escapeHealth = window.DinPulsSecurity.escapeHtml;
const safeHealthUrl = window.DinPulsSecurity.safeExternalUrl;
const safeHealthIcon = window.DinPulsSecurity.safeIconName;

const DEFAULT_CATEGORY_ORDER = [
  "Vårdcentral & läkare",
  "Akut & jour",
  "Tandvård",
  "Apotek",
  "Rehabilitering & fysioterapi",
  "Kiropraktor, naprapat & osteopat",
  "Massage & kroppsterapi",
  "Fotvård & medicinsk fotvård",
  "Optik & syn",
  "Psykisk hälsa & samtalsstöd",
  "Barnmorska & kvinnohälsa",
  "Vaccination",
  "Företagshälsa & specialist",
  "Övrig vård & hälsa"
];

function regionDetails(county) {
  return county === "Värmlands län"
    ? { name: "1177 Värmland", url: "https://www.1177.se/Varmland/" }
    : { name: "1177 Västra Götaland", url: "https://www.1177.se/Vastra-Gotaland/" };
}

function inferHealthCategory(provider) {
  if (provider.category === "Medicinsk fotvård") return "Fotvård & medicinsk fotvård";
  if (provider.category) return provider.category;
  const text = [provider.name, provider.description].join(" ").toLocaleLowerCase("sv-SE");
  if (/jour|akut/.test(text)) return "Akut & jour";
  if (/tand|folktand/.test(text)) return "Tandvård";
  if (/apotek|farmaci|läkemedel/.test(text)) return "Apotek";
  if (/fysioter|sjukgym|rehab|arbetster/.test(text)) return "Rehabilitering & fysioterapi";
  if (/kiroprakt|naprapat|osteopat/.test(text)) return "Kiropraktor, naprapat & osteopat";
  if (/massage|massör|kroppsterapi|fascia/.test(text)) return "Massage & kroppsterapi";
  if (/fotvård|fotterap/.test(text)) return "Fotvård & medicinsk fotvård";
  if (/optik|synundersök|glasögon|kontaktlins/.test(text)) return "Optik & syn";
  if (/psykolog|psykoter|samtal|beteendevet/.test(text)) return "Psykisk hälsa & samtalsstöd";
  if (/barnmorsk|kvinnohälsa|gravid|preventiv/.test(text)) return "Barnmorska & kvinnohälsa";
  if (/vaccin/.test(text)) return "Vaccination";
  if (/företagshälsa|arbetsmedicin|ortoped|specialist/.test(text)) return "Företagshälsa & specialist";
  if (/vårdcentral|läkare|primärvård/.test(text)) return "Vårdcentral & läkare";
  return "Övrig vård & hälsa";
}

function healthPhoneHref(phone) {
  const value = String(phone || "").trim();
  if (!value) return "";
  const cleaned = value.replace(/[^0-9+]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

function renderProviderCard(provider) {
  const website = provider.url ? safeHealthUrl(provider.url) : "";
  const phoneHref = healthPhoneHref(provider.phone);
  const href = website || phoneHref;
  const tag = href ? "a" : "article";
  const linkAttributes = website
    ? ` href="${escapeHealth(website)}" target="_blank" rel="noopener noreferrer"`
    : phoneHref
      ? ` href="${escapeHealth(phoneHref)}"`
      : "";
  const actionLabel = website ? "Öppna webbplats" : phoneHref ? "Ring" : "Kontaktuppgifter";
  const actionIcon = website ? "external-link" : phoneHref ? "phone" : "map-pin";
  const contact = [provider.phone, provider.address].filter(Boolean).map(value => `<span>${escapeHealth(value)}</span>`).join("");
  return `
    <${tag} class="health-category-card${href ? "" : " health-contact-only"}"${linkAttributes} aria-label="${escapeHealth(actionLabel)} för ${escapeHealth(provider.name)}">
      <span class="portal-card-icon health"><i data-lucide="${escapeHealth(safeHealthIcon(provider.icon || "heart-pulse"))}"></i></span>
      <span>
        <strong>${escapeHealth(provider.name)}</strong>
        <small>${escapeHealth(provider.description || "Vård- och hälsotjänst")}</small>
        ${contact ? `<span class="health-contact-lines">${contact}</span>` : ""}
        <em>${escapeHealth(actionLabel)} · ${escapeHealth(provider.sourceType || "Verifierad verksamhet")}</em>
      </span>
      <i data-lucide="${actionIcon}"></i>
    </${tag}>`;
}

function allHealthProviders() {
  return [
    ...(healthData?.providers || []),
    ...(healthPrivateSupplement?.providers || []),
    ...(healthLocalSupplement?.providers || []),
    ...(healthKarlstadPrivateSupplement?.providers || []),
    ...(healthPrivateData?.providers || [])
  ];
}

function renderHealthPage() {
  const municipalityData = healthData?.municipalities?.[healthMunicipality];
  if (!municipalityData) return;
  const query = document.querySelector("#health-search")?.value.trim().toLocaleLowerCase("sv-SE") || "";
  const selectedCategory = document.querySelector("#health-group")?.value || "";
  const seen = new Set();
  const providers = allHealthProviders()
    .map(provider => ({ ...provider, category: inferHealthCategory(provider) }))
    .filter(provider => {
      if (provider.municipality !== healthMunicipality) return false;
      const key = `${provider.municipality}|${String(provider.name || "").toLocaleLowerCase("sv-SE")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return [provider.name, provider.description, provider.sourceType, provider.category, provider.address, provider.phone]
        .join(" ")
        .toLocaleLowerCase("sv-SE")
        .includes(query) && (!selectedCategory || provider.category === selectedCategory);
    })
    .sort((first, second) => first.name.localeCompare(second.name, "sv-SE"));

  const categories = [...new Set(providers.map(provider => provider.category))]
    .sort((first, second) => {
      const firstIndex = DEFAULT_CATEGORY_ORDER.indexOf(first);
      const secondIndex = DEFAULT_CATEGORY_ORDER.indexOf(second);
      if (firstIndex === -1 && secondIndex === -1) return first.localeCompare(second, "sv-SE");
      if (firstIndex === -1) return 1;
      if (secondIndex === -1) return -1;
      return firstIndex - secondIndex;
    });

  const region = regionDetails(municipalityData.county);
  document.querySelectorAll("[data-health-municipality]").forEach(element => { element.textContent = healthMunicipality; });
  document.querySelector("#health-county").textContent = municipalityData.county;
  document.querySelector("#health-region-name").textContent = region.name;
  document.querySelector("#health-region-link").href = region.url;
  document.querySelector("#health-1177-link").href = healthData.officialCareUrl;
  document.querySelector("#health-result-count").textContent = `${providers.length} verksamheter`;
  document.querySelector("#health-category-grid").innerHTML = categories.map(category => {
    const items = providers.filter(provider => provider.category === category);
    return `
      <section class="health-directory-group">
        <div class="health-directory-group-heading"><h3>${escapeHealth(category)}</h3><span>${items.length}</span></div>
        <div class="health-category-grid">${items.map(renderProviderCard).join("")}</div>
      </section>`;
  }).join("");
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
  const [officialResponse, privateResponse, supplementResponse, localSupplementResponse, karlstadPrivateResponse] = await Promise.all([
    fetch("data/health.json", { cache: "no-cache" }),
    fetch("data/health-private.json", { cache: "no-cache" }),
    fetch("data/health-private-supplement.json", { cache: "no-cache" }),
    fetch("data/health-local-supplement.json", { cache: "no-cache" }),
    fetch("data/health-karlstad-private-supplement.json", { cache: "no-cache" })
  ]);
  if (!officialResponse.ok) throw new Error(`Vårddata kunde inte laddas (${officialResponse.status})`);
  healthData = await officialResponse.json();
  healthPrivateData = privateResponse.ok ? await privateResponse.json() : { providers: [] };
  healthPrivateSupplement = supplementResponse.ok ? await supplementResponse.json() : { providers: [] };
  healthLocalSupplement = localSupplementResponse.ok ? await localSupplementResponse.json() : { providers: [] };
  healthKarlstadPrivateSupplement = karlstadPrivateResponse.ok ? await karlstadPrivateResponse.json() : { providers: [] };
  if (!privateResponse.ok) console.warn(`Privat vårddata kunde inte laddas (${privateResponse.status})`);
  if (!supplementResponse.ok) console.warn(`Kompletterande vårddata kunde inte laddas (${supplementResponse.status})`);
  if (!localSupplementResponse.ok) console.warn(`Lokala vårdkompletteringar kunde inte laddas (${localSupplementResponse.status})`);
  if (!karlstadPrivateResponse.ok) console.warn(`Privata Karlstad-aktörer kunde inte laddas (${karlstadPrivateResponse.status})`);
  const select = document.querySelector("#health-municipality");
  const categorySelect = document.querySelector("#health-group");
  healthState.populateSelect(select, healthMunicipality);
  const allCategories = [...new Set(allHealthProviders().map(inferHealthCategory))]
    .sort((first, second) => first.localeCompare(second, "sv-SE"));
  categorySelect.innerHTML = `<option value="">Alla kategorier</option>${allCategories.map(category => `<option value="${escapeHealth(category)}">${escapeHealth(category)}</option>`).join("")}`;
  select.addEventListener("change", () => {
    healthMunicipality = healthState.set(select.value);
    renderHealthPage();
  });
  document.querySelector("#health-search")?.addEventListener("input", renderHealthPage);
  categorySelect.addEventListener("change", renderHealthPage);
  renderHealthAds();
  renderHealthPage();
}

initializeHealthPage().catch(error => {
  console.error(error);
  document.querySelector("#health-result-count").textContent = "Innehållet kunde inte laddas";
  document.querySelector("#health-empty").hidden = false;
});
