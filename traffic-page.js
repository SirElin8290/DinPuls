const municipalityState = window.DinPulsMunicipalityState;
let trafficMunicipality = municipalityState.getInitial();
let fullRoadTrafficData;
const escapeTraffic = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);

async function initializeTrafficPage() {
  const select = document.querySelector("#traffic-municipality");
  municipalityState.populateSelect(select, trafficMunicipality);
  select.addEventListener("change", () => { trafficMunicipality = municipalityState.set(select.value); renderTrafficPage(); });
  document.querySelector("#traffic-type").addEventListener("change", renderTrafficPage);
  document.querySelector("#traffic-search").addEventListener("input", renderTrafficPage);
  renderStrategicAds("trafik", "trafiksida", "#traffic-page-list");
  const response = await fetch(`data/road-traffic.json?version=${Date.now()}`, {cache:"no-store"});
  if (!response.ok) throw new Error(`Status ${response.status}`);
  fullRoadTrafficData = await response.json(); renderTrafficPage();
}

function renderTrafficPage() {
  if (!fullRoadTrafficData) return;
  document.querySelectorAll("[data-traffic-municipality]").forEach(el => el.textContent = trafficMunicipality);
  document.title = `Trafikläget nära ${trafficMunicipality} – DinPuls`;
  const query = document.querySelector("#traffic-search").value.trim().toLocaleLowerCase("sv-SE");
  const type = document.querySelector("#traffic-type").value;
  const all = fullRoadTrafficData.municipalities?.[trafficMunicipality]?.items || [];
  const items = all.filter(item => (type === "all" || item.category === type) && (!query || [item.title,item.message,item.road,item.location].join(" ").toLocaleLowerCase("sv-SE").includes(query)));
  const total = document.querySelector("#traffic-page-total");
  total.textContent = fullRoadTrafficData.active ? `${items.length} aktuella vägmeddelanden` : "Trafikverkets API väntar på aktivering";
  const updated = new Date(fullRoadTrafficData.generatedAt || "");
  document.querySelector("#traffic-page-updated").textContent = Number.isNaN(updated.getTime()) ? "" : `Uppdaterad ${updated.toLocaleString("sv-SE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}`;
  const list = document.querySelector("#traffic-page-list");
  list.innerHTML = items.map(renderTrafficMessage).join(""); list.hidden = !items.length;
  const empty = document.querySelector("#traffic-page-empty"); empty.hidden = !!items.length;
  if (!fullRoadTrafficData.active) empty.textContent = "Lägg till Trafikverkets API-nyckel för att aktivera riktiga vägmeddelanden.";
  else empty.textContent = "Inga aktuella vägmeddelanden matchar filtret.";
  if (window.lucide) lucide.createIcons();
}

function renderTrafficMessage(item) {
  const icons={accident:"triangle-alert",roadwork:"construction",congestion:"traffic-cone",obstacle:"shield-alert",weather:"cloud-snow"};
  const time=new Date(item.updatedAt||item.startTime||"");
  return `<article class="portal-card traffic-message"><span class="portal-card-icon traffic ${escapeTraffic(item.severity)}"><i data-lucide="${icons[item.category]||"car-front"}"></i></span><div><h3>${escapeTraffic(item.title)}</h3><p>${escapeTraffic(item.message||item.location||"")}</p><div class="portal-tags">${[item.road,item.location,item.categoryLabel].filter(Boolean).map(v=>`<span>${escapeTraffic(v)}</span>`).join("")}</div><div class="traffic-source"><span>Källa: Trafikverket</span><a href="${escapeTraffic(item.sourceUrl||"https://www.trafikverket.se/trafikinformation/vag/")}" target="_blank" rel="noopener noreferrer">Öppna trafikkartan</a></div></div><time>${Number.isNaN(time.getTime())?"Tid saknas":time.toLocaleString("sv-SE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</time></article>`;
}

initializeTrafficPage().catch(error => { console.error(error); document.querySelector("#traffic-page-total").textContent="Trafikläget kunde inte laddas"; document.querySelector("#traffic-page-empty").hidden=false; });


function renderStrategicAds(category, pageLabel, listSelector) {
  const slots = [...document.querySelectorAll("[data-strategic-ad]")];
  slots.forEach(slot => {
    const position = Number(slot.dataset.adPosition || 1);
    const subject = encodeURIComponent(`Annonsplats ${category} ${position}`);
    slot.innerHTML = `<a class="secondary-ad strategic-ad" href="mailto:annonser@dinpuls.se?subject=${subject}"><b>ANNONSPLATS ${position}</b><strong>Ditt företag här</strong><small>På DinPuls ${pageLabel} · 500 kr/mån</small></a>`;
  });
  const inlineSlot = slots.find(slot => slot.dataset.adPosition === "3");
  const list = document.querySelector(listSelector);
  if (!inlineSlot || !list) return;
  const placeInline = () => {
    const cards = [...list.children].filter(child => child !== inlineSlot);
    if (cards.length < 4) return;
    const anchor = cards[Math.min(cards.length - 1, Math.max(2, Math.floor(cards.length / 2)))];
    if (anchor.previousElementSibling !== inlineSlot) list.insertBefore(inlineSlot, anchor);
  };
  new MutationObserver(placeInline).observe(list, { childList: true });
  queueMicrotask(placeInline);
}
