const SPORT_MUNICIPALITIES=["Åmål","Säffle","Bengtsfors","Mellerud","Årjäng","Arvika","Grums"];
const SPORT_ICONS={
  "Fotboll":"circle-dot","Innebandy":"stick","Ishockey":"snowflake","Handboll":"circle","Bandy":"snowflake",
  "Tennis":"circle-dot","Golf":"flag-triangle-right","Ridsport":"horse","Orientering":"map","Löpning":"activity",
  "Friidrott":"timer","Motorsport":"flag","Travsport":"horse","Kanot":"waves","Volleyboll":"circle-dot",
  "Badminton":"feather","Bordtennis":"circle-dot","Gymnastik":"sparkles","Boxning":"dumbbell","Skytte":"target",
  "Skidor":"mountain-snow","Mountainbike":"bike","Paintball":"target","Båtsport":"sailboat","Alla sporter":"trophy"
};
const sportParams=new URLSearchParams(location.search);
let sportMunicipality=sportParams.get("kommun")||localStorage.getItem("dinpuls-municipality")||"Åmål";
if(!SPORT_MUNICIPALITIES.includes(sportMunicipality))sportMunicipality="Åmål";
let sportData=null;
let activeSportTab="overview";
let hideScores=localStorage.getItem("dinpuls-hide-sport-results")==="true";
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

async function initializeSportPage(){
  const response=await fetch(`data/sports.json?version=${Date.now()}`,{cache:"no-store"});
  if(!response.ok)throw new Error(`Sportdata kunde inte laddas (${response.status})`);
  sportData=await response.json();

  const municipality=document.querySelector("#sport-municipality");
  municipality.innerHTML=SPORT_MUNICIPALITIES.map(name=>`<option value="${esc(name)}" ${name===sportMunicipality?"selected":""}>${esc(name)}</option>`).join("");
  municipality.addEventListener("change",()=>{
    sportMunicipality=municipality.value;
    localStorage.setItem("dinpuls-municipality",sportMunicipality);
    history.replaceState(null,"",`${location.pathname}?kommun=${encodeURIComponent(sportMunicipality)}`);
    renderSportPage();
  });

  document.querySelector("#sport-filter")?.addEventListener("change",renderSportPage);
  document.querySelector("#sport-search")?.addEventListener("input",renderSportPage);
  document.querySelector("#sport-search").value=sportParams.get("sok")||"";

  document.querySelectorAll("[data-sport-tab]").forEach(button=>button.addEventListener("click",()=>{
    activeSportTab=button.dataset.sportTab;
    document.querySelectorAll("[data-sport-tab]").forEach(item=>{
      const active=item===button;
      item.classList.toggle("active",active);
      item.setAttribute("aria-selected",String(active));
    });
    renderSportPage();
  }));

  document.querySelector("#sport-spoiler-toggle")?.addEventListener("click",()=>{
    hideScores=!hideScores;
    localStorage.setItem("dinpuls-hide-sport-results",String(hideScores));
    updateSpoilerToggle();
    document.body.classList.toggle("sport-results-hidden",hideScores);
  });

  renderSportAds();
  updateSpoilerToggle();
  renderSportPage();
}

function getCurrentData(){return sportData?.municipalities?.[sportMunicipality]||{clubs:[],liveSources:[]}}
function getSports(data){return [...new Set((data.clubs||[]).flatMap(club=>club.sports||[]))].sort((a,b)=>a.localeCompare(b,"sv"))}
function getSelectedSport(){return document.querySelector("#sport-filter")?.value||"all"}
function getSearchQuery(){return document.querySelector("#sport-search")?.value.trim().toLocaleLowerCase("sv-SE")||""}
function getSportIcon(sport){return SPORT_ICONS[sport]||"medal"}

function filteredClubs(data){
  const sport=getSelectedSport();
  const query=getSearchQuery();
  return (data.clubs||[]).filter(club=>(sport==="all"||(club.sports||[]).includes(sport))&&(!query||[club.name,...(club.sports||[]),club.source].join(" ").toLocaleLowerCase("sv-SE").includes(query)));
}
function filteredSources(data){
  const sport=getSelectedSport();
  const query=getSearchQuery();
  return (data.liveSources||[]).filter(source=>(sport==="all"||source.sport===sport||source.sport==="Alla sporter")&&(!query||[source.title,source.provider,source.sport].join(" ").toLocaleLowerCase("sv-SE").includes(query)));
}

function renderSportPage(){
  const data=getCurrentData();
  const sports=getSports(data);
  const filter=document.querySelector("#sport-filter");
  const previous=filter.value;
  filter.innerHTML=`<option value="all">Alla sporter</option>${sports.map(sport=>`<option value="${esc(sport)}">${esc(sport)}</option>`).join("")}`;
  filter.value=sports.includes(previous)?previous:"all";

  document.querySelectorAll("[data-sport-municipality]").forEach(element=>element.textContent=sportMunicipality);
  document.title=`Lokal sport i ${sportMunicipality} – DinPuls`;
  document.body.classList.toggle("sport-results-hidden",hideScores);

  const clubs=filteredClubs(data);
  const sources=filteredSources(data);
  renderOverviewStats(data,sports,clubs,sources);

  const view=document.querySelector("#sport-view");
  if(activeSportTab==="clubs")view.innerHTML=renderClubDirectory(clubs);
  else if(activeSportTab==="overview")view.innerHTML=renderOverview(data,clubs,sources,sports);
  else view.innerHTML=renderSourceSection(activeSportTab,sources);

  if(window.lucide)lucide.createIcons();
}

function renderOverviewStats(data,sports,clubs,sources){
  const grid=document.querySelector("#sport-stat-grid");
  const selectedSport=getSelectedSport();
  const visibleLabel=selectedSport==="all"?"Alla sporter":selectedSport;
  grid.innerHTML=`
    <article class="sport-stat-card primary"><span class="sport-stat-icon"><i data-lucide="users"></i></span><div><strong>${clubs.length}</strong><span>föreningar visas</span></div></article>
    <article class="sport-stat-card"><span class="sport-stat-icon"><i data-lucide="medal"></i></span><div><strong>${sports.length}</strong><span>sporter i kommunen</span></div></article>
    <article class="sport-stat-card"><span class="sport-stat-icon"><i data-lucide="radio"></i></span><div><strong>${sources.length}</strong><span>officiella sportkällor</span></div></article>
    <article class="sport-stat-card context"><span class="sport-stat-icon"><i data-lucide="sliders-horizontal"></i></span><div><strong>${esc(visibleLabel)}</strong><span>aktivt urval</span></div></article>`;
}

function renderOverview(data,clubs,sources,sports){
  return `
    <section class="sport-dashboard-grid">
      <div class="sport-dashboard-main">
        <div class="sport-section-heading">
          <div><span class="section-kicker">Lokalt just nu</span><h2>Din sportöversikt</h2><p>Snabbaste vägen till officiella matcher, resultat och tabeller.</p></div>
          <small>Kontrollerad ${formatGeneratedDate()}</small>
        </div>
        ${renderSportChips(sports)}
        ${renderSourceCards(sources,"Öppna sportkälla")}
      </div>
      <aside class="sport-dashboard-aside">
        <div class="sport-guide-card">
          <span class="sport-guide-icon"><i data-lucide="compass"></i></span>
          <div><small>Så fungerar DinPuls Sport</small><h3>En lokal ingång – officiella uppgifter</h3><p>Vi samlar länkar till förbund, resultatservice och föreningar. När direktdata blir tillgänglig visas den här utan att du behöver leta vidare.</p></div>
        </div>
        <div class="sport-guide-card subtle">
          <span class="sport-guide-icon"><i data-lucide="eye-off"></i></span>
          <div><small>Spoilerläge</small><h3>${hideScores?"Resultat är dolda":"Resultat visas"}</h3><p>Inställningen sparas på den här enheten och kommer användas när matchresultat kopplas in.</p></div>
        </div>
      </aside>
    </section>
    ${renderClubDirectory(clubs.slice(0,6),true)}`;
}

function renderSportChips(sports){
  if(!sports.length)return "";
  return `<div class="sport-chip-row" aria-label="Sporter i kommunen">${sports.map(sport=>`<button type="button" data-chip-sport="${esc(sport)}"><i data-lucide="${getSportIcon(sport)}"></i>${esc(sport)}</button>`).join("")}</div>`;
}

function renderSourceSection(tab,sources){
  const labels={
    upcoming:["Kommande matcher","Öppna rätt officiell matchkalender för ditt lag eller din sport.","calendar-days","Öppna matcher"],
    results:["Spelade matcher","Verifierade slutresultat hämtas eller öppnas från ansvarigt förbund.","circle-check","Öppna resultat"],
    tables:["Tabeller","Aktuella serietabeller öppnas hos respektive specialförbund.","list-ordered","Öppna tabell"]
  };
  const [title,text,icon,action]=labels[tab];
  return `<section class="sport-focus-section"><div class="sport-focus-head"><span><i data-lucide="${icon}"></i></span><div><span class="section-kicker">Verifierad sportdata</span><h2>${title}</h2><p>${text}</p></div></div>${renderSourceCards(sources,action)}</section>`;
}

function renderSourceCards(sources,action){
  if(!sources.length)return `<div class="portal-empty sport-empty"><i data-lucide="search-x"></i><strong>Ingen särskild sportkälla hittades</strong><span>Prova Alla sporter eller ändra sökningen.</span></div>`;
  return `<div class="sport-source-grid">${sources.map((source,index)=>`${index===2?sportAdMarkup(3):""}<a class="sport-source-card" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer"><span class="sport-source-icon"><i data-lucide="${getSportIcon(source.sport)}"></i></span><div><small>${esc(source.sport)}</small><strong>${esc(source.title)}</strong><span>${esc(source.provider)}</span></div><b>${esc(action)} <i data-lucide="arrow-up-right"></i></b></a>`).join("")}</div>`;
}

function renderClubDirectory(clubs,compact=false){
  return `<section class="sport-clubs"><div class="sport-section-heading"><div><span class="section-kicker">${compact?"Lokala lag och föreningar":"Föreningsregister"}</span><h2>${compact?"Föreningar att följa":"Alla hittade föreningar"}</h2><p>${compact?"Ett urval från kommunen.":"Sök, filtrera och öppna föreningens officiella sida eller registerpost."}</p></div><small>${clubs.length} visas</small></div><div class="sport-club-grid">${clubs.map((club,index)=>`${index===3?sportAdMarkup(4):""}${index===7?sportAdMarkup(5):""}${index===11?sportAdMarkup(6):""}<a class="sport-club-card" href="${esc(club.url)}" target="_blank" rel="noopener noreferrer"><span class="sport-club-icon"><i data-lucide="${getSportIcon(club.sports?.[0])}"></i></span><span class="sport-club-copy"><strong>${esc(club.name)}</strong><small>${(club.sports||[]).map(esc).join(" · ")}</small><em><i data-lucide="database"></i>${esc(club.source)}</em></span><span class="sport-club-open"><i data-lucide="arrow-up-right"></i></span></a>`).join("")||`<div class="portal-empty sport-empty"><i data-lucide="users"></i><strong>Inga föreningar matchar urvalet</strong><span>Byt sport eller rensa sökfältet.</span></div>`}</div></section>`;
}

function updateSpoilerToggle(){
  const button=document.querySelector("#sport-spoiler-toggle");
  if(!button)return;
  button.setAttribute("aria-pressed",String(hideScores));
  button.classList.toggle("active",hideScores);
  button.innerHTML=`<i data-lucide="${hideScores?"eye":"eye-off"}"></i><span>${hideScores?"Visa resultat":"Dölj resultat"}</span>`;
  if(window.lucide)lucide.createIcons();
}

function formatGeneratedDate(){
  const date=new Date(sportData?.generatedAt||"");
  return Number.isNaN(date.getTime())?"nyligen":date.toLocaleDateString("sv-SE",{day:"numeric",month:"short",year:"numeric"});
}

function sportAdMarkup(position){
  const subject=encodeURIComponent(`Annonsplats sport ${position}`);
  return `<div class="strategic-ad-slot sport-inline-ad"><a class="secondary-ad strategic-ad" href="mailto:annonser@dinpuls.se?subject=${subject}"><b>SPORTANNONS ${position}</b><strong>Ditt lokala företag här</strong><small>På DinPuls sportsida · 500 kr/mån</small></a></div>`;
}
function renderSportAds(){
  document.querySelectorAll("[data-strategic-ad]").forEach(slot=>{
    const position=Number(slot.dataset.adPosition||1);
    const subject=encodeURIComponent(`Annonsplats sport ${position}`);
    slot.innerHTML=`<a class="secondary-ad strategic-ad" href="mailto:annonser@dinpuls.se?subject=${subject}"><b>SPORTANNONS ${position}</b><strong>Ditt lokala företag här</strong><small>På DinPuls sportsida · 500 kr/mån</small></a>`;
  });
}

document.addEventListener("click",event=>{
  const chip=event.target.closest("[data-chip-sport]");
  if(!chip)return;
  const filter=document.querySelector("#sport-filter");
  filter.value=chip.dataset.chipSport;
  renderSportPage();
  document.querySelector("#sport-view")?.scrollIntoView({behavior:"smooth",block:"start"});
});

initializeSportPage().catch(error=>{
  console.error(error);
  const view=document.querySelector("#sport-view");
  if(view)view.innerHTML=`<div class="portal-empty sport-empty"><i data-lucide="triangle-alert"></i><strong>Sporten kunde inte laddas</strong><span>Försök igen om en liten stund.</span></div>`;
  if(window.lucide)lucide.createIcons();
});
