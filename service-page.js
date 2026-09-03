const serviceState = window.DinPulsMunicipalityState;
let serviceMunicipality = serviceState.getInitial();
let serviceData;
let serviceSupplement;
let serviceLaunchSupplement;
let serviceLocalSupplement;

const serviceAdvertisers = {
  "Årjäng": {
    1: {
      name: "Åslanda Handelsträdgård",
      image: "assets/ads/aslanda-handelstradgard.webp",
      url: "https://www.facebook.com/profile.php?id=61576659453588",
      alt: "Åslanda Handelsträdgård – höstväxter och pumpor, öppet måndag till fredag 09–18 från 31 augusti"
    }
  }
};

const escapeService = window.DinPulsSecurity.escapeHtml;
const safeServiceUrl = window.DinPulsSecurity.safeExternalUrl;
const safeServiceIcon = window.DinPulsSecurity.safeIconName;

const DEFAULT_SERVICE_CATEGORY_ORDER = [
  "Bygg & snickeri",
  "El & installation",
  "VVS, värme & kyla",
  "Måleri, golv & ytskikt",
  "Tak, plåt & fasad",
  "Mark, trädgård & entreprenad",
  "Städ, hemservice & fastighet",
  "Bil, däck & fordonsservice",
  "Lås, glas & säkerhet",
  "Flytt & transport",
  "Maskin, skog & industri",
  "Byggvaror & utrustning",
  "Företagstjänster & tryck",
  "Foto, inredning & kreativa tjänster",
  "Övrig service"
];

function inferServiceCategory(business) {
  if (business.category) return business.category;
  const text = [business.group, business.name, business.description].join(" ").toLocaleLowerCase("sv-SE");
  if (/bil|däck|fordon|motor|verkstad|kaross|lack/.test(text)) return "Bil, däck & fordonsservice";
  if (/elektr|elinstall|elservice|solcell/.test(text)) return "El & installation";
  if (/vvs|rör|värme|kyla|ventilation|värmepump/.test(text)) return "VVS, värme & kyla";
  if (/måleri|målare|färg|golv|kakel|plattsätt/.test(text)) return "Måleri, golv & ytskikt";
  if (/tak|plåt|fasad/.test(text)) return "Tak, plåt & fasad";
  if (/mark|gräv|entrepren|trädgård|schakt|dräner|brunn/.test(text)) return "Mark, trädgård & entreprenad";
  if (/städ|hemservice|fastighetsservice|förvaltning/.test(text)) return "Städ, hemservice & fastighet";
  if (/lås|glas|säkerhet|larm/.test(text)) return "Lås, glas & säkerhet";
  if (/flytt|transport|åkeri|magasin/.test(text)) return "Flytt & transport";
  if (/skog|maskin|industri|svets|smide/.test(text)) return "Maskin, skog & industri";
  if (/byggmaterial|bygghandel|byggvar|utrustning|järn/.test(text)) return "Byggvaror & utrustning";
  if (/tryck|redovis|ekonomi|företagstjänst/.test(text)) return "Företagstjänster & tryck";
  if (/foto|interiör|inredning/.test(text)) return "Foto, inredning & kreativa tjänster";
  if (/bygg|snicker|renover|hus|badrum|kök/.test(text)) return "Bygg & snickeri";
  return "Övrig service";
}

function servicePhoneHref(phone) {
  const value = String(phone || "").trim();
  if (!value) return "";
  const cleaned = value.replace(/[^0-9+]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

function renderServiceCard(business) {
  const website = business.url ? safeServiceUrl(business.url) : "";
  const phoneHref = servicePhoneHref(business.phone);
  const href = website || phoneHref;
  const tag = href ? "a" : "article";
  const linkAttributes = website
    ? ` href="${escapeService(website)}" target="_blank" rel="noopener noreferrer"`
    : phoneHref
      ? ` href="${escapeService(phoneHref)}"`
      : "";
  const actionLabel = website ? "Öppna webbplats" : phoneHref ? "Ring" : "Kontaktuppgifter";
  const actionIcon = website ? "external-link" : phoneHref ? "phone" : "map-pin";
  const contact = [business.phone, business.address]
    .filter(Boolean)
    .map(value => `<span>${escapeService(value)}</span>`)
    .join("");
  return `
    <${tag} class="service-category-card${href ? "" : " service-contact-only"}"${linkAttributes} aria-label="${escapeService(actionLabel)} för ${escapeService(business.name)}">
      <span class="portal-card-icon service"><i data-lucide="${escapeService(safeServiceIcon(business.icon || "wrench"))}"></i></span>
      <span>
        <strong>${escapeService(business.name)}</strong>
        <small>${escapeService(business.description || "Lokal service- eller hantverkstjänst")}</small>
        ${contact ? `<span class="health-contact-lines">${contact}</span>` : ""}
        <em>${escapeService(actionLabel)} · ${escapeService(business.sourceType || "Verifierad verksamhet")}</em>
      </span>
      <i data-lucide="${actionIcon}"></i>
    </${tag}>`;
}

function serviceCategorySort(first, second) {
  const firstIndex = DEFAULT_SERVICE_CATEGORY_ORDER.indexOf(first);
  const secondIndex = DEFAULT_SERVICE_CATEGORY_ORDER.indexOf(second);
  if (firstIndex === -1 && secondIndex === -1) return first.localeCompare(second, "sv-SE");
  if (firstIndex === -1) return 1;
  if (secondIndex === -1) return -1;
  return firstIndex - secondIndex;
}

function allServiceBusinesses() {
  const seen = new Set();
  return [
    ...(serviceData?.businesses || []),
    ...(serviceSupplement?.businesses || []),
    ...(serviceLaunchSupplement?.businesses || []),
    ...(serviceLocalSupplement?.businesses || [])
  ]
    .map(business => ({ ...business, category: inferServiceCategory(business) }))
    .filter(business => {
      const key = `${business.municipality}|${String(business.name || "").toLocaleLowerCase("sv-SE")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function renderServicePage() {
  const query = document.querySelector("#service-search")?.value.trim().toLocaleLowerCase("sv-SE") || "";
  const category = document.querySelector("#service-group")?.value || "";
  const businesses = allServiceBusinesses()
    .filter(business =>
      business.municipality === serviceMunicipality &&
      (!category || business.category === category) &&
      [business.name, business.description, business.category, business.address, business.phone]
        .join(" ")
        .toLocaleLowerCase("sv-SE")
        .includes(query)
    )
    .sort((first, second) => first.name.localeCompare(second.name, "sv-SE"));

  const categories = [...new Set(businesses.map(business => business.category))].sort(serviceCategorySort);
  document.querySelectorAll("[data-service-municipality]").forEach(element => { element.textContent = serviceMunicipality; });
  document.querySelectorAll('a[href^="index.html"]').forEach(link => { link.href = `index.html?kommun=${encodeURIComponent(serviceMunicipality)}`; });
  document.querySelector("#service-result-count").textContent = `${businesses.length} företag`;
  document.querySelector("#service-category-grid").innerHTML = categories.map(group => {
    const items = businesses.filter(business => business.category === group);
    return `
      <section class="health-directory-group service-directory-group">
        <div class="health-directory-group-heading"><h3>${escapeService(group)}</h3><span>${items.length}</span></div>
        <div class="service-category-grid">${items.map(renderServiceCard).join("")}</div>
      </section>`;
  }).join("");
  document.querySelector("#service-empty").hidden = businesses.length > 0;
  document.querySelector("#service-category-grid").hidden = businesses.length === 0;
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
    slot.innerHTML = `<a class="secondary-ad strategic-ad" href="mailto:annons@dinpuls.se?subject=${subject}"><b>ANNONSPLATS ${position}</b><strong>Ditt företag här</strong><small>På DinPuls Service &amp; hantverk · 500 kr/månad + moms</small></a>`;
  });
}

async function initializeServicePage() {
  const [baseResponse, supplementResponse, launchSupplementResponse, localSupplementResponse] = await Promise.all([
    fetch("data/service.json", { cache: "no-cache" }),
    fetch("data/service-private-supplement.json", { cache: "no-cache" }),
    fetch("data/service-launch-supplement.json", { cache: "no-cache" }),
    fetch("data/service-local-supplement.json", { cache: "no-cache" })
  ]);
  if (!baseResponse.ok) throw new Error(`Servicedata kunde inte laddas (${baseResponse.status})`);
  serviceData = await baseResponse.json();
  serviceSupplement = supplementResponse.ok ? await supplementResponse.json() : { businesses: [] };
  serviceLaunchSupplement = launchSupplementResponse.ok ? await launchSupplementResponse.json() : { businesses: [] };
  serviceLocalSupplement = localSupplementResponse.ok ? await localSupplementResponse.json() : { businesses: [] };
  if (!supplementResponse.ok) console.warn(`Kompletterande servicedata kunde inte laddas (${supplementResponse.status})`);
  if (!launchSupplementResponse.ok) console.warn(`Lanseringens kompletterande servicedata kunde inte laddas (${launchSupplementResponse.status})`);
  if (!localSupplementResponse.ok) console.warn(`Lokala servicekompletteringar kunde inte laddas (${localSupplementResponse.status})`);

  const municipalitySelect = document.querySelector("#service-municipality");
  const groupSelect = document.querySelector("#service-group");
  serviceState.populateSelect(municipalitySelect, serviceMunicipality);
  [...new Set(allServiceBusinesses().map(business => business.category))]
    .sort(serviceCategorySort)
    .forEach(group => groupSelect.add(new Option(group, group)));

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
