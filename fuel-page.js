const municipalityState = window.DinPulsMunicipalityState;
let fuelMunicipality = municipalityState.getInitial();
let fullFuelData;
const escapeFuel = window.DinPulsSecurity.escapeHtml;
const safeFuelUrl = window.DinPulsSecurity.safeExternalUrl;
const fuelNumber = value => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(Number(value));

async function initializeFuelPage() {
  const select = document.querySelector("#fuel-municipality");
  municipalityState.populateSelect(select, fuelMunicipality);
  select.addEventListener("change", () => { fuelMunicipality = municipalityState.set(select.value); renderFuelPage(); });
  ["#fuel-type", "#fuel-price-filter"].forEach(selector => document.querySelector(selector).addEventListener("change", renderFuelPage));
  document.querySelector("#fuel-search").addEventListener("input", renderFuelPage);
  renderStrategicAds("drivmedel", "drivmedelssida", "#fuel-list");
  const response = await fetch(`data/fuel.json`, { cache:"no-store" });
  if (!response.ok) throw new Error(`Status ${response.status}`);
  fullFuelData = await response.json(); renderFuelPage();
}

function renderFuelPage() {
  if (!fullFuelData) return;
  document.querySelectorAll("[data-fuel-municipality]").forEach(element => element.textContent = fuelMunicipality);
  document.title = `Tankning och billaddning i ${fuelMunicipality} – DinPuls`;
  const municipalityData = fullFuelData.municipalities?.[fuelMunicipality] || {stations:[]};
  const query = document.querySelector("#fuel-search").value.trim().toLocaleLowerCase("sv-SE");
  const type = document.querySelector("#fuel-type").value;
  const priceFilter = document.querySelector("#fuel-price-filter").value;
  const stations = (municipalityData.stations || []).filter(station => {
    if (type !== "all" && station.type !== type) return false;
    if (priceFilter === "priced" && !(Number(station.price) > 0)) return false;
    if (priceFilter === "missing" && Number(station.price) > 0) return false;
    return !query || [station.name, station.brand, station.operator, station.address, ...(station.products||[])].join(" ").toLocaleLowerCase("sv-SE").includes(query);
  }).sort((a,b) => Number(a.distanceKm)-Number(b.distanceKm));
  document.querySelector("#fuel-total").textContent = `${stations.length} stationer inom ${fullFuelData.radiusKm || 15} km`;
  const updated = new Date(municipalityData.updatedAt || fullFuelData.generatedAt);
  document.querySelector("#fuel-updated").textContent = Number.isNaN(updated.getTime()) ? "" : `Kontrollerad ${updated.toLocaleString("sv-SE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}`;
  const list = document.querySelector("#fuel-list"); list.innerHTML = stations.map(renderFuelStation).join(""); list.hidden = !stations.length; document.querySelector("#fuel-empty").hidden = !!stations.length;
  if (window.lucide) lucide.createIcons();
}

function renderFuelStation(station) {
  const isPriced = Number(station.price) > 0;
  const attributes = station.type === "charging" ? [...(station.connectors||[]), station.maxPower].filter(Boolean) : (station.products||[]);
  const distance = Number(station.distanceKm) > 0 ? `${fuelNumber(station.distanceKm)} km` : `i ${fuelMunicipality}`;
  return `<article class="portal-card fuel-station"><span class="portal-card-icon ${station.type === "charging" ? "charging" : "fuel"}"><i data-lucide="${station.type === "charging" ? "plug-zap" : "fuel"}"></i></span><div><h3>${escapeFuel(station.name)}</h3><p>${escapeFuel(station.address)} · ${distance}</p><div class="portal-tags">${attributes.slice(0,5).map(value=>`<span>${escapeFuel(value)}</span>`).join("")}</div><small>${escapeFuel(station.openingHours || "Öppettid saknas")} · Källa: ${escapeFuel(station.dataSource || "OpenStreetMap")}</small></div><div class="fuel-price ${isPriced ? "verified" : "missing"}"><strong>${isPriced ? `${fuelNumber(station.price)} ${escapeFuel(station.unit)}` : "Pris saknas"}</strong><small>${escapeFuel(station.priceLabel || "Lokalt pris ej verifierat")}</small>${station.priceCheckedAt ? `<time>Kontrollerat ${new Date(station.priceCheckedAt).toLocaleDateString("sv-SE")}</time>` : ""}</div><div class="fuel-actions"><a href="${escapeFuel(safeFuelUrl(station.directionsUrl))}" target="_blank" rel="noopener noreferrer">Vägbeskrivning</a><a href="${escapeFuel(safeFuelUrl(station.sourceUrl))}" target="_blank" rel="noopener noreferrer">Kontrollera källa</a></div></article>`;
}

initializeFuelPage().catch(error => { console.error(error); document.querySelector("#fuel-total").textContent="Stationerna kunde inte laddas"; document.querySelector("#fuel-empty").hidden=false; });
