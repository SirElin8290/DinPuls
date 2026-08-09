const cinemaState = window.DinPulsMunicipalityState;
let cinemaMunicipality = cinemaState.getInitial();
let cinemaData = null;
const escapeCinema = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
function updateCinemaChrome() {
  document.querySelectorAll("[data-cinema-municipality]").forEach(element => element.textContent = cinemaMunicipality);
  document.title = `Bio i ${cinemaMunicipality} – DinPuls`;
}
function renderCinemaPage() {
  if (!cinemaData) return;
  updateCinemaChrome();
  const query = document.querySelector("#cinema-search").value.trim().toLocaleLowerCase("sv-SE");
  const cinemas = (cinemaData.municipalities?.[cinemaMunicipality] || []).filter(cinema => [cinema.name, cinema.place, cinema.address, ...(cinema.features || [])].join(" ").toLocaleLowerCase("sv-SE").includes(query));
  document.querySelector("#cinema-total").textContent = `${cinemas.length} ${cinemas.length === 1 ? "biograf" : "biografer"} i ${cinemaMunicipality}`;
  document.querySelector("#cinema-updated").textContent = `Källor kontrollerade ${cinemaData.updatedAt || ""}`;
  const list = document.querySelector("#cinema-list");
  list.innerHTML = cinemas.map(cinema => `<article class="cinema-card"><span class="portal-card-icon cinema"><i data-lucide="clapperboard"></i></span><div class="cinema-card-copy"><small>${escapeCinema(cinema.place)}</small><h3>${escapeCinema(cinema.name)}</h3><p><i data-lucide="map-pin"></i>${escapeCinema(cinema.address)}</p><div class="portal-tags">${(cinema.features || []).map(feature => `<span>${escapeCinema(feature)}</span>`).join("")}</div>${cinema.notice ? `<div class="cinema-notice"><i data-lucide="info"></i>${escapeCinema(cinema.notice)}</div>` : ""}</div><div class="cinema-actions"><a class="portal-source-button" href="${escapeCinema(cinema.programUrl)}" target="_blank" rel="noopener noreferrer">Se filmprogram <i data-lucide="external-link"></i></a><a href="${escapeCinema(cinema.bookingUrl)}" target="_blank" rel="noopener noreferrer">Biljetter och tider <i data-lucide="ticket"></i></a></div></article>`).join("");
  list.hidden = !cinemas.length;
  document.querySelector("#cinema-empty").hidden = Boolean(cinemas.length);
  if (window.lucide) lucide.createIcons();
}
async function initializeCinemaPage() {
  const select = document.querySelector("#cinema-municipality");
  cinemaState.populateSelect(select, cinemaMunicipality);
  select.addEventListener("change", () => { cinemaMunicipality = cinemaState.set(select.value); renderCinemaPage(); });
  document.querySelector("#cinema-search").addEventListener("input", renderCinemaPage);
  updateCinemaChrome();
  const response = await fetch("data/cinemas.json", { cache:"no-cache" });
  if (!response.ok) throw new Error(`Status ${response.status}`);
  cinemaData = await response.json(); renderCinemaPage();
}
initializeCinemaPage().catch(error => {
  console.error(error);
  document.querySelector("#cinema-total").textContent = "Biograferna kunde inte laddas";
  document.querySelector("#cinema-empty").hidden = false;
});
