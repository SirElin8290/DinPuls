const authorityState = window.DinPulsMunicipalityState;
let authorityMunicipality = authorityState.getInitial();
let authorityData;

const escapeAuthority = window.DinPulsSecurity.escapeHtml;
const safeAuthorityUrl = window.DinPulsSecurity.safeExternalUrl;
const safeAuthorityIcon = window.DinPulsSecurity.safeIconName;
const authorityText = item => [item.name, item.description, item.group, item.terms, item.type].join(" ").toLocaleLowerCase("sv-SE");

function municipalServiceTarget(service) {
  const municipality = authorityData.municipalities[authorityMunicipality];
  const directUrl = municipality?.serviceUrls?.[service.id];
  return { url: directUrl || municipality?.website || "", direct: Boolean(directUrl) };
}

function authorityCard(item, local = false) {
  const localTarget = local ? municipalServiceTarget(item) : null;
  const url = local ? localTarget.url : item.url;
  const type = local ? "Kommunal verksamhet" : item.type;
  const label = local ? (localTarget.direct ? "Öppna rätt sida" : "Öppna kommunens webbplats") : "Öppna officiell webbplats";
  const actions = [
    `<a href="${escapeAuthority(safeAuthorityUrl(url))}" target="_blank" rel="noopener noreferrer">${label}<i data-lucide="external-link"></i></a>`
  ];
  if (!local && item.selfServiceUrl) actions.push(`<a href="${escapeAuthority(safeAuthorityUrl(item.selfServiceUrl))}" target="_blank" rel="noopener noreferrer">E-tjänster / Mina sidor</a>`);
  if (!local && item.contactUrl) actions.push(`<a href="${escapeAuthority(safeAuthorityUrl(item.contactUrl))}" target="_blank" rel="noopener noreferrer">Kontakta</a>`);
  return `<article class="authority-card"><div class="authority-card-top"><span class="authority-card-icon"><i data-lucide="${escapeAuthority(safeAuthorityIcon(item.icon))}"></i></span><span class="authority-owner">${escapeAuthority(type)}</span></div><em>${escapeAuthority(item.group)}</em><h3>${escapeAuthority(item.name)}</h3><p>${escapeAuthority(item.description)}</p><div class="authority-actions">${actions.join("")}</div></article>`;
}

function renderAuthorities() {
  const query = document.querySelector("#authority-search")?.value.trim().toLocaleLowerCase("sv-SE") || "";
  const group = document.querySelector("#authority-group")?.value || "";
  const matches = item => (!group || item.group === group) && (!query || authorityText(item).includes(query));
  const local = authorityData.municipalServices.filter(matches);
  const national = authorityData.nationalServices.filter(matches);
  document.querySelectorAll("[data-authority-municipality]").forEach(element => { element.textContent = authorityMunicipality; });
  document.querySelector("#authority-local-count").textContent = `${local.length} träffar`;
  document.querySelector("#authority-national-count").textContent = `${national.length} träffar`;
  document.querySelector("#authority-local-grid").innerHTML = local.map(item => authorityCard(item, true)).join("");
  document.querySelector("#authority-national-grid").innerHTML = national.map(item => authorityCard(item)).join("");
  document.querySelector("#authority-local-grid").closest(".authority-section").hidden = local.length === 0;
  document.querySelector("#authority-national-grid").closest(".authority-section").hidden = national.length === 0;
  document.querySelector("#authority-empty").hidden = local.length + national.length > 0;
  document.title = `Myndigheter & samhällsservice i ${authorityMunicipality} – DinPuls`;
  if (window.lucide) lucide.createIcons();
}

function renderAuthorityAds() {
  document.querySelectorAll("[data-strategic-ad]").forEach(slot => {
    const position = Number(slot.dataset.adPosition || 1);
    const subject = encodeURIComponent(`Annonsplats Myndigheter & samhällsservice ${position}`);
    slot.innerHTML = `<a class="secondary-ad strategic-ad" href="mailto:annons@dinpuls.se?subject=${subject}"><b>ANNONSPLATS ${position}</b><strong>Ditt företag här</strong><small>Tydligt avskild från myndighetsinformationen · 500 kr/månad + moms</small></a>`;
  });
}

async function initializeAuthoritiesPage() {
  const [response, hagforsSupplementResponse] = await Promise.all([
    fetch("data/authorities.json", { cache: "no-cache" }),
    fetch("data/authorities-hagfors-supplement.json", { cache: "no-cache" })
  ]);
  if (!response.ok) throw new Error(`Myndighetsdata kunde inte laddas (${response.status})`);
  authorityData = await response.json();
  if (hagforsSupplementResponse.ok) {
    const supplement = await hagforsSupplementResponse.json();
    Object.entries(supplement.municipalities || {}).forEach(([name, municipality]) => {
      const current = authorityData.municipalities[name] || {};
      authorityData.municipalities[name] = {
        ...current,
        ...municipality,
        serviceUrls: { ...(current.serviceUrls || {}), ...(municipality.serviceUrls || {}) }
      };
    });
  } else {
    console.warn(`Hagfors samhällsservice-komplettering kunde inte laddas (${hagforsSupplementResponse.status})`);
  }
  const municipalitySelect = document.querySelector("#authority-municipality");
  const groupSelect = document.querySelector("#authority-group");
  authorityState.populateSelect(municipalitySelect, authorityMunicipality);
  [...new Set([...authorityData.municipalServices, ...authorityData.nationalServices].map(item => item.group))].forEach(group => groupSelect.add(new Option(group, group)));
  const parameters = new URLSearchParams(window.location.search);
  if (parameters.get("grupp") && [...groupSelect.options].some(option => option.value === parameters.get("grupp"))) groupSelect.value = parameters.get("grupp");
  municipalitySelect.addEventListener("change", () => { authorityMunicipality = authorityState.set(municipalitySelect.value); renderAuthorities(); });
  groupSelect.addEventListener("change", renderAuthorities);
  document.querySelector("#authority-search").addEventListener("input", renderAuthorities);
  renderAuthorityAds();
  renderAuthorities();
}

initializeAuthoritiesPage().catch(error => {
  console.error(error);
  document.querySelector("#authority-empty").hidden = false;
  document.querySelector("#authority-empty").textContent = "Innehållet kunde inte laddas just nu.";
});
