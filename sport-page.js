const SPORT_MUNICIPALITIES=["Åmål","Säffle","Bengtsfors","Mellerud","Årjäng","Arvika","Grums"];
const SPORT_ICONS={"Fotboll":"circle-dot","Innebandy":"stick","Ishockey":"snowflake","Handboll":"circle","Bandy":"snowflake","Tennis":"circle-dot","Golf":"flag-triangle-right","Ridsport":"horse","Orientering":"map","Löpning":"activity","Friidrott":"timer","Motorsport":"flag","Travsport":"horse","Kanot":"waves","Volleyboll":"circle-dot","Badminton":"feather","Bordtennis":"circle-dot","Gymnastik":"sparkles","Boxning":"dumbbell","Skytte":"target","Skidor":"mountain-snow","Mountainbike":"bike","Paintball":"target","Båtsport":"sailboat","Alla sporter":"trophy"};
const sportParams=new URLSearchParams(location.search);
let sportMunicipality=sportParams.get("kommun")||localStorage.getItem("dinpuls-municipality")||"Åmål";
if(!SPORT_MUNICIPALITIES.includes(sportMunicipality))sportMunicipality="Åmål";
let sportData=null;
let activeSportTab="overview";
let hideScores=localStorage.getItem("dinpuls-hide-sport-results")==="true";
let favoriteClubs=readFavorites();
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
  document.querySelectorAll("[data-sport-tab]").forEach(button=>button.addEventListener("click",()=>setActiveTab(button.dataset.sportTab)));
  document.querySelector("#sport-spoiler-toggle")?.addEventListener("click",()=>{
    hideScores=!hideScores;
    localStorage.setItem("dinpuls-hide-sport-results",String(hideScores));
    updateSpoilerToggle();
    document.body.classList.toggle("sport-results-hidden",hideScores);
  });
  renderSportAds();
  updateSpoilerToggle();
  renderSportPage();
  window.setInterval(()=>renderSportPage(),60000);
}

function setActiveTab(tab){
  activeSportTab=tab;
  document.querySelectorAll("[data-sport-tab]").forEach(item=>{
    const active=item.dataset.sportTab===tab;
    item.classList.toggle("active",active);
    item.setAttribute("aria-selected",String(active));
  });
  renderSportPage();
}
function getCurrentData(){return sportData?.municipalities?.[sportMunicipality]||{clubs:[],liveSources:[],matches:[]}}
function getSports(data){return [...new Set([...(data.clubs||[]).flatMap(club=>club.sports||[]),...(data.matches||[]).map(match=>match.sport)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"sv"))}
function getSelectedSport(){return document.querySelector("#sport-filter")?.value||"all"}
function getSearchQuery(){return document.querySelector("#sport-search")?.value.trim().toLocaleLowerCase("sv-SE")||""}
function getSportIcon(sport){return SPORT_ICONS[sport]||"medal"}
function readFavorites(){try{return JSON.parse(localStorage.getItem("dinpuls-sport-favorites")||"[]")}catch{return []}}
function saveFavorites(){localStorage.setItem("dinpuls-sport-favorites",JSON.stringify(favoriteClubs))}
function favoriteKey(name){return `${sportMunicipality}::${name}`}
function isFavorite(name){return favoriteClubs.includes(favoriteKey(name))}
function toggleFavorite(name){const key=favoriteKey(name);favoriteClubs=isFavorite(name)?favoriteClubs.filter(item=>item!==key):[...favoriteClubs,key];saveFavorites();renderSportPage()}

function filteredClubs(data){
  const sport=getSelectedSport(),query=getSearchQuery();
  return (data.clubs||[]).filter(club=>(sport==="all"||(club.sports||[]).includes(sport))&&(!query||[club.name,...(club.sports||[]),club.source].join(" ").toLocaleLowerCase("sv-SE").includes(query)));
}
function filteredSources(data){
  const sport=getSelectedSport(),query=getSearchQuery();
  return (data.liveSources||[]).filter(source=>(sport==="all"||source.sport===sport||source.sport==="Alla sporter")&&(!query||[source.title,source.provider,source.sport].join(" ").toLocaleLowerCase("sv-SE").includes(query)));
}
function filteredMatches(data){
  const sport=getSelectedSport(),query=getSearchQuery();
  return (data.matches||[]).filter(match=>(sport==="all"||match.sport===sport)&&(!query||[match.homeTeam,match.awayTeam,match.competition,match.sport,match.venue].join(" ").toLocaleLowerCase("sv-SE").includes(query))).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime));
}
function getMatchGroups(matches){
  const now=Date.now(),dayStart=new Date();dayStart.setHours(0,0,0,0);const dayEnd=new Date(dayStart);dayEnd.setDate(dayEnd.getDate()+1);
  const live=matches.filter(match=>["live","inprogress"].includes(String(match.status).toLowerCase()));
  const upcoming=matches.filter(match=>new Date(match.startTime).getTime()>=now&&!live.includes(match));
  const today=upcoming.filter(match=>{const time=new Date(match.startTime).getTime();return time>=dayStart.getTime()&&time<dayEnd.getTime()});
  const results=matches.filter(match=>["finished","final","ended"].includes(String(match.status).toLowerCase())||Number.isFinite(Number(match.homeScore))&&Number.isFinite(Number(match.awayScore))&&new Date(match.startTime).getTime()<now);
  return {live,upcoming,today,results:results.sort((a,b)=>new Date(b.startTime)-new Date(a.startTime))};
}

function renderSportPage(){
  const data=getCurrentData(),sports=getSports(data),filter=document.querySelector("#sport-filter"),previous=filter.value;
  filter.innerHTML=`<option value="all">Alla sporter</option>${sports.map(sport=>`<option value="${esc(sport)}">${esc(sport)}</option>`).join("")}`;
  filter.value=sports.includes(previous)?previous:"all";
  document.querySelectorAll("[data-sport-municipality]").forEach(element=>element.textContent=sportMunicipality);
  document.title=`Lokal sport i ${sportMunicipality} – DinPuls`;
  document.body.classList.toggle("sport-results-hidden",hideScores);
  const clubs=filteredClubs(data),sources=filteredSources(data),matches=filteredMatches(data),groups=getMatchGroups(matches);
  renderOverviewStats(sports,clubs,sources,groups);
  const view=document.querySelector("#sport-view");
  if(activeSportTab==="clubs")view.innerHTML=renderClubDirectory(clubs);
  else if(activeSportTab==="overview")view.innerHTML=renderOverview(clubs,sources,sports,groups);
  else if(activeSportTab==="upcoming")view.innerHTML=renderMatchSection("Kommande matcher","Nästa lokala matcher från anslutna källor.","calendar-days",groups.upcoming,sources,"upcoming");
  else if(activeSportTab==="results")view.innerHTML=renderMatchSection("Spelade matcher","Senaste lokala resultaten. Spoilerläget styr om siffrorna syns.","circle-check",groups.results,sources,"results");
  else view.innerHTML=renderSourceSection("tables",sources);
  if(window.lucide)lucide.createIcons();
}

function renderOverviewStats(sports,clubs,sources,groups){
  const grid=document.querySelector("#sport-stat-grid"),selectedSport=getSelectedSport(),visibleLabel=selectedSport==="all"?"Alla sporter":selectedSport;
  grid.innerHTML=`
    <article class="sport-stat-card primary"><span class="sport-stat-icon"><i data-lucide="radio"></i></span><div><strong>${groups.live.length}</strong><span>matcher live</span></div></article>
    <article class="sport-stat-card"><span class="sport-stat-icon"><i data-lucide="calendar-days"></i></span><div><strong>${groups.today.length}</strong><span>matcher idag</span></div></article>
    <article class="sport-stat-card"><span class="sport-stat-icon"><i data-lucide="users"></i></span><div><strong>${clubs.length}</strong><span>föreningar visas</span></div></article>
    <article class="sport-stat-card context"><span class="sport-stat-icon"><i data-lucide="sliders-horizontal"></i></span><div><strong>${esc(visibleLabel)}</strong><span>${sources.length} officiella källor</span></div></article>`;
}

function renderOverview(clubs,sources,sports,groups){
  const favorites=clubs.filter(club=>isFavorite(club.name));
  return `
    ${groups.live.length?`<section class="sport-live-center"><div class="sport-live-head"><span><i data-lucide="radio"></i> LIVE JUST NU</span><small>${groups.live.length} pågående</small></div>${renderMatchGrid(groups.live,"live")}</section>`:""}
    <section class="sport-dashboard-grid">
      <div class="sport-dashboard-main">
        <div class="sport-section-heading"><div><span class="section-kicker">Matchcenter</span><h2>${groups.today.length?"Dagens lokala matcher":"Lokala matcher"}</h2><p>${groups.today.length?"Allt som spelas idag i ditt aktuella urval.":"Matchdata visas här så snart en källa är ansluten."}</p></div><button class="sport-text-button" data-open-tab="upcoming">Visa alla kommande <i data-lucide="arrow-right"></i></button></div>
        ${groups.today.length?renderMatchGrid(groups.today.slice(0,6),"upcoming"):renderMatchEmpty(sources,"Inga matcher är inlästa för idag")}
        <div class="sport-section-heading sport-sources-heading"><div><span class="section-kicker">Officiella källor</span><h2>Matcher, resultat och tabeller</h2></div><small>Kontrollerad ${formatGeneratedDate()}</small></div>
        ${renderSportChips(sports)}${renderSourceCards(sources,"Öppna sportkälla")}
      </div>
      <aside class="sport-dashboard-aside">
        <div class="sport-guide-card favorite-panel"><span class="sport-guide-icon"><i data-lucide="star"></i></span><div><small>Mina lag</small><h3>${favorites.length?`${favorites.length} favorit${favorites.length===1?"":"er"}`:"Följ dina lokala lag"}</h3><p>${favorites.length?favorites.map(club=>esc(club.name)).join(" · "):"Tryck på stjärnan vid en förening. Favoriterna sparas på den här enheten."}</p></div></div>
        <div class="sport-guide-card subtle"><span class="sport-guide-icon"><i data-lucide="eye-off"></i></span><div><small>Spoilerläge</small><h3>${hideScores?"Resultat är dolda":"Resultat visas"}</h3><p>Du bestämmer om slutresultat ska synas direkt.</p></div></div>
      </aside>
    </section>
    ${renderClubDirectory(clubs.slice(0,6),true)}`;
}

function renderMatchSection(title,text,icon,matches,sources,type){
  return `<section class="sport-focus-section"><div class="sport-focus-head"><span><i data-lucide="${icon}"></i></span><div><span class="section-kicker">Lokalt matchcenter</span><h2>${title}</h2><p>${text}</p></div></div>${matches.length?renderDatedMatches(matches,type):renderMatchEmpty(sources,type==="results"?"Inga resultat är inlästa ännu":"Inga kommande matcher är inlästa ännu")}${renderSourceFallback(sources,type==="results"?"Öppna resultatkälla":"Öppna matchkalender")}</section>`;
}
function renderDatedMatches(matches,type){
  const groups=new Map();
  matches.forEach(match=>{const key=formatMatchDate(match.startTime);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(match)});
  return [...groups.entries()].map(([date,items])=>`<section class="sport-date-group"><h3>${esc(date)}</h3>${renderMatchGrid(items,type)}</section>`).join("");
}
function renderMatchGrid(matches,type){return `<div class="sport-match-grid">${matches.map(match=>renderMatchCard(match,type)).join("")}</div>`}
function renderMatchCard(match,type){
  const live=["live","inprogress"].includes(String(match.status).toLowerCase()),finished=type==="results"||["finished","final","ended"].includes(String(match.status).toLowerCase());
  const scoreKnown=Number.isFinite(Number(match.homeScore))&&Number.isFinite(Number(match.awayScore));
  const time=formatMatchTime(match.startTime),sourceUrl=match.sourceUrl||match.url||"";
  return `<article class="sport-match-card ${live?"is-live":""} ${finished?"is-finished":""}">
    <div class="sport-match-meta"><span><i data-lucide="${getSportIcon(match.sport)}"></i>${esc(match.sport||"Sport")}</span><small>${esc(match.competition||match.series||"")}</small></div>
    <div class="sport-match-status">${live?`<b><i data-lucide="radio"></i>LIVE${match.clock?` · ${esc(match.clock)}`:""}</b>`:`<time datetime="${esc(match.startTime||"")}">${esc(time)}</time>`}</div>
    <div class="sport-match-teams"><span><strong>${esc(match.homeTeam||"Hemmalag")}</strong>${favoriteTeamButton(match.homeTeam)}</span><span><strong>${esc(match.awayTeam||"Bortalag")}</strong>${favoriteTeamButton(match.awayTeam)}</span></div>
    <div class="sport-match-score ${scoreKnown?"sport-score":""}">${scoreKnown?`<strong>${esc(match.homeScore)}</strong><strong>${esc(match.awayScore)}</strong>`:`<span>${finished?"Resultat saknas":"Ej startad"}</span>`}</div>
    <div class="sport-match-footer"><span>${esc([match.venue,match.sourceName].filter(Boolean).join(" · ")||"Officiell källa")}</span>${sourceUrl?`<a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Matchinfo <i data-lucide="arrow-up-right"></i></a>`:""}</div>
  </article>`;
}
function favoriteTeamButton(name){if(!name)return "";return `<button type="button" class="sport-team-star ${isFavorite(name)?"active":""}" data-favorite-club="${esc(name)}" aria-label="${isFavorite(name)?"Ta bort":"Lägg till"} ${esc(name)} som favorit"><i data-lucide="star"></i></button>`}
function renderMatchEmpty(sources,title){return `<div class="sport-match-empty"><i data-lucide="calendar-search"></i><div><strong>${esc(title)}</strong><span>Matchcentret är färdigbyggt och fylls automatiskt när matchflöden kopplas in.</span></div>${sources[0]?`<a href="${esc(sources[0].url)}" target="_blank" rel="noopener noreferrer">Se officiell källa <i data-lucide="arrow-up-right"></i></a>`:""}</div>`}
function renderSourceFallback(sources,action){return sources.length?`<div class="sport-source-fallback"><div><strong>Hittar du inte matchen?</strong><span>Öppna ansvarigt förbund eller förening.</span></div>${renderSourceCards(sources,action)}</div>`:""}

function renderSportChips(sports){return sports.length?`<div class="sport-chip-row" aria-label="Sporter i kommunen">${sports.map(sport=>`<button type="button" data-chip-sport="${esc(sport)}"><i data-lucide="${getSportIcon(sport)}"></i>${esc(sport)}</button>`).join("")}</div>`:""}
function renderSourceSection(tab,sources){const labels={tables:["Tabeller","Aktuella serietabeller öppnas hos respektive specialförbund.","list-ordered","Öppna tabell"]};const [title,text,icon,action]=labels[tab];return `<section class="sport-focus-section"><div class="sport-focus-head"><span><i data-lucide="${icon}"></i></span><div><span class="section-kicker">Verifierad sportdata</span><h2>${title}</h2><p>${text}</p></div></div>${renderSourceCards(sources,action)}</section>`}
function renderSourceCards(sources,action){if(!sources.length)return `<div class="portal-empty sport-empty"><i data-lucide="search-x"></i><strong>Ingen särskild sportkälla hittades</strong><span>Prova Alla sporter eller ändra sökningen.</span></div>`;return `<div class="sport-source-grid">${sources.map((source,index)=>`${index===2?sportAdMarkup(3):""}<a class="sport-source-card" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer"><span class="sport-source-icon"><i data-lucide="${getSportIcon(source.sport)}"></i></span><div><small>${esc(source.sport)}</small><strong>${esc(source.title)}</strong><span>${esc(source.provider)}</span></div><b>${esc(action)} <i data-lucide="arrow-up-right"></i></b></a>`).join("")}</div>`}
function renderClubDirectory(clubs,compact=false){return `<section class="sport-clubs"><div class="sport-section-heading"><div><span class="section-kicker">${compact?"Lokala lag och föreningar":"Föreningsregister"}</span><h2>${compact?"Föreningar att följa":"Alla hittade föreningar"}</h2><p>${compact?"Stjärnmarkera dina lag för snabbare åtkomst.":"Sök, filtrera och öppna föreningens officiella sida eller registerpost."}</p></div><small>${clubs.length} visas</small></div><div class="sport-club-grid">${clubs.map((club,index)=>`${index===3?sportAdMarkup(4):""}${index===7?sportAdMarkup(5):""}${index===11?sportAdMarkup(6):""}<article class="sport-club-card ${isFavorite(club.name)?"is-favorite":""}"><span class="sport-club-icon"><i data-lucide="${getSportIcon(club.sports?.[0])}"></i></span><span class="sport-club-copy"><strong>${esc(club.name)}</strong><small>${(club.sports||[]).map(esc).join(" · ")}</small><em><i data-lucide="database"></i>${esc(club.source)}</em></span><button type="button" class="sport-favorite-button ${isFavorite(club.name)?"active":""}" data-favorite-club="${esc(club.name)}" aria-label="${isFavorite(club.name)?"Ta bort":"Lägg till"} ${esc(club.name)} som favorit"><i data-lucide="star"></i></button><a class="sport-club-open" href="${esc(club.url)}" target="_blank" rel="noopener noreferrer" aria-label="Öppna ${esc(club.name)}"><i data-lucide="arrow-up-right"></i></a></article>`).join("")||`<div class="portal-empty sport-empty"><i data-lucide="users"></i><strong>Inga föreningar matchar urvalet</strong><span>Byt sport eller rensa sökfältet.</span></div>`}</div></section>`}

function updateSpoilerToggle(){const button=document.querySelector("#sport-spoiler-toggle");if(!button)return;button.setAttribute("aria-pressed",String(hideScores));button.classList.toggle("active",hideScores);button.innerHTML=`<i data-lucide="${hideScores?"eye":"eye-off"}"></i><span>${hideScores?"Visa resultat":"Dölj resultat"}</span>`;if(window.lucide)lucide.createIcons()}
function formatGeneratedDate(){const date=new Date(sportData?.generatedAt||"");return Number.isNaN(date.getTime())?"nyligen":date.toLocaleDateString("sv-SE",{day:"numeric",month:"short",year:"numeric"})}
function formatMatchTime(value){const date=new Date(value);return Number.isNaN(date.getTime())?"Tid saknas":date.toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit"})}
function formatMatchDate(value){const date=new Date(value);if(Number.isNaN(date.getTime()))return "Datum saknas";const today=new Date(),tomorrow=new Date();tomorrow.setDate(today.getDate()+1);const key=date.toLocaleDateString("sv-SE"),todayKey=today.toLocaleDateString("sv-SE"),tomorrowKey=tomorrow.toLocaleDateString("sv-SE");if(key===todayKey)return "Idag";if(key===tomorrowKey)return "Imorgon";return date.toLocaleDateString("sv-SE",{weekday:"long",day:"numeric",month:"long"})}
function sportAdMarkup(position){const subject=encodeURIComponent(`Annonsplats sport ${position}`);return `<div class="strategic-ad-slot sport-inline-ad"><a class="secondary-ad strategic-ad" href="mailto:annonser@dinpuls.se?subject=${subject}"><b>SPORTANNONS ${position}</b><strong>Ditt lokala företag här</strong><small>På DinPuls sportsida · 500 kr/mån</small></a></div>`}
function renderSportAds(){document.querySelectorAll("[data-strategic-ad]").forEach(slot=>{const position=Number(slot.dataset.adPosition||1),subject=encodeURIComponent(`Annonsplats sport ${position}`);slot.innerHTML=`<a class="secondary-ad strategic-ad" href="mailto:annonser@dinpuls.se?subject=${subject}"><b>SPORTANNONS ${position}</b><strong>Ditt lokala företag här</strong><small>På DinPuls sportsida · 500 kr/mån</small></a>`})}

document.addEventListener("click",event=>{
  const chip=event.target.closest("[data-chip-sport]");
  if(chip){const filter=document.querySelector("#sport-filter");filter.value=chip.dataset.chipSport;renderSportPage();document.querySelector("#sport-view")?.scrollIntoView({behavior:"smooth",block:"start"});return}
  const favorite=event.target.closest("[data-favorite-club]");
  if(favorite){event.preventDefault();toggleFavorite(favorite.dataset.favoriteClub);return}
  const tabButton=event.target.closest("[data-open-tab]");
  if(tabButton){setActiveTab(tabButton.dataset.openTab);document.querySelector(".sport-tabs")?.scrollIntoView({behavior:"smooth",block:"center"})}
});

initializeSportPage().catch(error=>{console.error(error);const view=document.querySelector("#sport-view");if(view)view.innerHTML=`<div class="portal-empty sport-empty"><i data-lucide="triangle-alert"></i><strong>Sporten kunde inte laddas</strong><span>Försök igen om en liten stund.</span></div>`;if(window.lucide)lucide.createIcons()});
