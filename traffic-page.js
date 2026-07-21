const TRAFFIC_MUNICIPALITIES = ["Åmål", "Säffle", "Bengtsfors", "Mellerud", "Årjäng", "Arvika", "Grums"];
const trafficParams = new URLSearchParams(location.search);
let trafficMunicipality = trafficParams.get("kommun") || localStorage.getItem("dinpuls-municipality") || "Åmål";
if (!TRAFFIC_MUNICIPALITIES.includes(trafficMunicipality)) trafficMunicipality = "Åmål";
let fullRoadTrafficData;
const escapeTraffic = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);

async function initializeTrafficPage() {
  const select = document.querySelector("#traffic-municipality");
  select.innerHTML = TRAFFIC_MUNICIPALITIES.map(name => `<option ${name === trafficMunicipality ? "selected" : ""}>${name}</option>`).join("");
  select.addEventListener("change", () => { trafficMunicipality = select.value; localStorage.setItem("dinpuls-municipality", trafficMunicipality); history.replaceState(null,"",`${location.pathname}?kommun=${encodeURIComponent(trafficMunicipality)}`); renderTrafficPage(); });
  document.querySelector("#traffic-type").addEventListener("change", renderTrafficPage);
  document.querySelector("#traffic-search").addEventListener("input", renderTrafficPage);
  document.querySelector("#traffic-ads").innerHTML = `<span class="section-kicker">Lokala annonser</span><h2>Nå trafikanter nära dig</h2>${Array.from({length:4},(_,i)=>`<a class="secondary-ad" href="mailto:annonser@dinpuls.se?subject=Annonsplats%20trafik%20${i+1}"><b>ANNONSPLATS ${i+1}</b><strong>Ditt företag här</strong><small>På DinPuls trafiksida · 500 kr/mån</small></a>`).join("")}`;
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
