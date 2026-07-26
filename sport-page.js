const SPORT_MUNICIPALITIES=["Åmål","Säffle","Bengtsfors","Mellerud","Årjäng","Arvika","Grums"];
const sportParams=new URLSearchParams(location.search);
let sportMunicipality=sportParams.get("kommun")||localStorage.getItem("dinpuls-municipality")||"Åmål";
if(!SPORT_MUNICIPALITIES.includes(sportMunicipality))sportMunicipality="Åmål";
let sportData=null,activeSportTab="overview";
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

async function initializeSportPage(){
  const response=await fetch(`data/sports.json?version=${Date.now()}`,{cache:"no-store"});
  if(!response.ok)throw new Error(`Sportdata kunde inte laddas (${response.status})`);
  sportData=await response.json();
  const municipality=document.querySelector("#sport-municipality");
  municipality.innerHTML=SPORT_MUNICIPALITIES.map(name=>`<option ${name===sportMunicipality?"selected":""}>${name}</option>`).join("");
  municipality.addEventListener("change",()=>{sportMunicipality=municipality.value;localStorage.setItem("dinpuls-municipality",sportMunicipality);history.replaceState(null,"",`${location.pathname}?kommun=${encodeURIComponent(sportMunicipality)}`);renderSportPage()});
  document.querySelector("#sport-filter").addEventListener("change",renderSportPage);
  document.querySelector("#sport-search").addEventListener("input",renderSportPage);
  document.querySelector("#sport-search").value=sportParams.get("sok")||"";
  document.querySelectorAll("[data-sport-tab]").forEach(button=>button.addEventListener("click",()=>{activeSportTab=button.dataset.sportTab;document.querySelectorAll("[data-sport-tab]").forEach(item=>item.classList.toggle("active",item===button));renderSportPage()}));
  renderSportAds();
  renderSportPage();
}

function getCurrentData(){return sportData?.municipalities?.[sportMunicipality]||{clubs:[],liveSources:[]}}
function getSports(data){return [...new Set((data.clubs||[]).flatMap(club=>club.sports||[]))].sort((a,b)=>a.localeCompare(b,"sv"))}
function filteredClubs(data){
  const sport=document.querySelector("#sport-filter")?.value||"all";
  const query=document.querySelector("#sport-search")?.value.trim().toLocaleLowerCase("sv-SE")||"";
  return (data.clubs||[]).filter(club=>(sport==="all"||(club.sports||[]).includes(sport))&&(!query||[club.name,...(club.sports||[])].join(" ").toLocaleLowerCase("sv-SE").includes(query)));
}
function filteredSources(data){
  const sport=document.querySelector("#sport-filter")?.value||"all";
  return (data.liveSources||[]).filter(source=>sport==="all"||source.sport===sport||source.sport==="Alla sporter");
}

function renderSportPage(){
  const data=getCurrentData(),sports=getSports(data),filter=document.querySelector("#sport-filter");
  const previous=filter.value;
  filter.innerHTML=`<option value="all">Alla sporter</option>${sports.map(sport=>`<option value="${esc(sport)}">${esc(sport)}</option>`).join("")}`;
  filter.value=sports.includes(previous)?previous:"all";
  document.querySelectorAll("[data-sport-municipality]").forEach(element=>element.textContent=sportMunicipality);
  document.title=`Lokal sport i ${sportMunicipality} – DinPuls`;
  document.querySelector("#sport-stat-grid").innerHTML=`<article><strong>${data.clubs.length}</strong><span>lokala föreningar</span></article><article><strong>${sports.length}</strong><span>sporter hittade</span></article><article><strong>${data.liveSources.length}</strong><span>livekällor</span></article>`;
  const clubs=filteredClubs(data),sources=filteredSources(data),view=document.querySelector("#sport-view");
  if(activeSportTab==="clubs")view.innerHTML=renderClubDirectory(clubs);
  else if(activeSportTab==="overview")view.innerHTML=`<div class="sport-section-heading"><div><span class="section-kicker">Lokalt just nu</span><h2>Sportöversikt</h2></div><small>Uppdaterad källförteckning ${new Date(sportData.generatedAt).toLocaleDateString("sv-SE")}</small></div>${renderSourceCards(sources,"Öppna matcher, resultat och tabeller")}${renderClubDirectory(clubs.slice(0,6),true)}`;
  else {
    const labels={upcoming:["Kommande matcher","Se nästa matcher i respektive officiell livekälla."],results:["Spelade matcher","Senaste verifierade slutresultat finns hos förbundet eller föreningen."],tables:["Tabeller","Aktuella serietabeller öppnas hos ansvarigt specialförbund."]};
    const [title,text]=labels[activeSportTab];
    view.innerHTML=`<div class="sport-section-heading"><div><span class="section-kicker">Verifierad sportdata</span><h2>${title}</h2><p>${text}</p></div></div>${renderSourceCards(sources,activeSportTab==="tables"?"Öppna tabell":"Öppna livekälla")}`;
  }
  if(window.lucide)lucide.createIcons();
}

function renderSourceCards(sources,action){
  if(!sources.length)return `<div class="portal-empty sport-empty"><i data-lucide="search-x"></i><strong>Ingen särskild livekälla hittades för filtret</strong><span>Prova Alla sporter eller öppna föreningsregistret.</span></div>`;
  return `<div class="sport-source-grid">${sources.map((source,index)=>`${index===1?sportAdMarkup(3):""}<a class="sport-source-card" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer"><span class="portal-card-icon sport"><i data-lucide="trophy"></i></span><div><small>${esc(source.sport)}</small><strong>${esc(source.title)}</strong><span>${esc(source.provider)}</span></div><b>${esc(action)} <i data-lucide="external-link"></i></b></a>`).join("")}</div>`;
}
function renderClubDirectory(clubs,compact=false){
  return `<section class="sport-clubs"><div class="sport-section-heading"><div><span class="section-kicker">${compact?"Upptäck mer":"Från de största till de minsta"}</span><h2>${compact?"Några lokala föreningar":"Alla hittade föreningar"}</h2></div><small>${clubs.length} visas</small></div><div class="sport-club-grid">${clubs.map((club,index)=>`${index===2?sportAdMarkup(4):""}${index===5?sportAdMarkup(5):""}${index===8?sportAdMarkup(6):""}${index===11?sportAdMarkup(7):""}<a class="sport-club-card" href="${esc(club.url)}" target="_blank" rel="noopener noreferrer"><span class="portal-card-icon sport"><i data-lucide="medal"></i></span><span><strong>${esc(club.name)}</strong><small>${(club.sports||[]).map(esc).join(" · ")}</small><em>Källa: ${esc(club.source)}</em></span><i data-lucide="external-link"></i></a>`).join("")||`<div class="portal-empty">Inga föreningar matchar sökningen.</div>`}</div></section>`;
}
function sportAdMarkup(position){const subject=encodeURIComponent(`Annonsplats sport ${position}`);return `<div class="strategic-ad-slot sport-inline-ad"><a class="secondary-ad strategic-ad" href="mailto:annonser@dinpuls.se?subject=${subject}"><b>SPORTANNONS ${position}</b><strong>Ditt lokala företag här</strong><small>På DinPuls sportsida · 500 kr/mån</small></a></div>`}
function renderSportAds(){
  document.querySelectorAll("[data-strategic-ad]").forEach(slot=>{const position=Number(slot.dataset.adPosition||1),subject=encodeURIComponent(`Annonsplats sport ${position}`);slot.innerHTML=`<a class="secondary-ad strategic-ad" href="mailto:annonser@dinpuls.se?subject=${subject}"><b>SPORTANNONS ${position}</b><strong>Ditt lokala företag här</strong><small>På DinPuls sportsida · 500 kr/mån</small></a>`});
}
initializeSportPage().catch(error=>{console.error(error);document.querySelector("#sport-view").innerHTML=`<div class="portal-empty">Sporten kunde inte laddas. Försök igen om en liten stund.</div>`});
