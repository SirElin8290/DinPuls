/* DinPuls Sport – Sprint 2 matchcenter */
let sportFavoritesOnly=localStorage.getItem("dinpuls-sport-favorites-only")==="true";

const baseFilteredClubs=filteredClubs;
const baseFilteredMatches=filteredMatches;
const baseRenderOverview=renderOverview;

function matchIdentity(match){return String(match.id||[match.startTime,match.homeTeam,match.awayTeam].join("::"))}
function isFavoriteMatch(match){return isFavorite(match.homeTeam)||isFavorite(match.awayTeam)}
function normalizedMatches(data){
  return [...(data.matches||data.fixtures||[])].map(match=>({
    id:matchIdentity(match),status:"scheduled",...match,
    sourceUrl:match.sourceUrl||match.url||"",
    sourceName:match.sourceName||match.provider||""
  }));
}

filteredClubs=function(data){
  const clubs=baseFilteredClubs(data);
  return sportFavoritesOnly?clubs.filter(club=>isFavorite(club.name)):clubs;
};
filteredMatches=function(data){
  const clone={...data,matches:normalizedMatches(data)};
  const matches=baseFilteredMatches(clone);
  return sportFavoritesOnly?matches.filter(isFavoriteMatch):matches;
};

function installMatchcenterControls(){
  const toolbar=document.querySelector(".sport-toolbar-panel");
  if(!toolbar||document.querySelector("#sport-matchcenter-controls"))return;
  const controls=document.createElement("div");
  controls.id="sport-matchcenter-controls";
  controls.className="sport-matchcenter-controls";
  controls.innerHTML=`
    <button type="button" id="sport-favorites-only" aria-pressed="${sportFavoritesOnly}"><i data-lucide="star"></i><span>${sportFavoritesOnly?"Visar mina lag":"Visa mina lag"}</span></button>
    <button type="button" id="sport-refresh-data"><i data-lucide="refresh-cw"></i><span>Uppdatera</span></button>
    <span id="sport-data-freshness" class="sport-data-freshness"></span>`;
  toolbar.insertAdjacentElement("afterend",controls);
  document.querySelector("#sport-favorites-only").addEventListener("click",()=>{
    sportFavoritesOnly=!sportFavoritesOnly;
    localStorage.setItem("dinpuls-sport-favorites-only",String(sportFavoritesOnly));
    updateFavoriteFilterButton();
    renderSportPage();
  });
  document.querySelector("#sport-refresh-data").addEventListener("click",refreshSportData);
  updateFavoriteFilterButton();
  updateDataFreshness();
}
function updateFavoriteFilterButton(){
  const button=document.querySelector("#sport-favorites-only");
  if(!button)return;
  button.classList.toggle("active",sportFavoritesOnly);
  button.setAttribute("aria-pressed",String(sportFavoritesOnly));
  button.innerHTML=`<i data-lucide="star"></i><span>${sportFavoritesOnly?"Visar mina lag":"Visa mina lag"}</span>`;
  if(window.lucide)lucide.createIcons();
}
function updateDataFreshness(){
  const element=document.querySelector("#sport-data-freshness");
  if(!element)return;
  const date=new Date(sportData?.generatedAt||"");
  if(Number.isNaN(date.getTime())){element.textContent="Källstatus saknas";return}
  const minutes=Math.max(0,Math.floor((Date.now()-date.getTime())/60000));
  const text=minutes<2?"Uppdaterad nyss":minutes<60?`Uppdaterad för ${minutes} min sedan`:`Källor kontrollerade ${date.toLocaleDateString("sv-SE")}`;
  element.innerHTML=`<i data-lucide="database"></i>${esc(text)}`;
}
async function refreshSportData(){
  const button=document.querySelector("#sport-refresh-data");
  button?.classList.add("loading");
  try{
    const response=await fetch(`data/sports.json?version=${Date.now()}`,{cache:"no-store"});
    if(!response.ok)throw new Error(String(response.status));
    sportData=await response.json();
    renderSportPage();
    updateDataFreshness();
  }catch(error){console.error("Sportdata kunde inte uppdateras",error)}
  finally{button?.classList.remove("loading")}
}

renderOverview=function(clubs,sources,sports,groups){
  const data=getCurrentData();
  const allMatches=normalizedMatches(data).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime));
  const nextFavorite=allMatches.find(match=>isFavoriteMatch(match)&&new Date(match.startTime).getTime()>=Date.now());
  const favoritePanel=nextFavorite?renderNextFavoriteMatch(nextFavorite):"";
  return favoritePanel+baseRenderOverview(clubs,sources,sports,groups);
};
function renderNextFavoriteMatch(match){
  const opponent=isFavorite(match.homeTeam)?match.awayTeam:match.homeTeam;
  return `<section class="sport-next-favorite"><span class="sport-next-favorite-icon"><i data-lucide="star"></i></span><div><small>Nästa match för ett lag du följer</small><strong>${esc(match.homeTeam)} – ${esc(match.awayTeam)}</strong><span>${esc(formatMatchDate(match.startTime))} ${esc(formatMatchTime(match.startTime))}${match.venue?` · ${esc(match.venue)}`:""}</span></div><button type="button" data-calendar-match="${esc(matchIdentity(match))}"><i data-lucide="calendar-plus"></i>Lägg i kalender</button></section>`;
}

renderMatchCard=function(match,type){
  const status=String(match.status||"scheduled").toLowerCase();
  const live=["live","inprogress","playing"].includes(status);
  const finished=type==="results"||["finished","final","ended"].includes(status);
  const postponed=["postponed","cancelled","canceled"].includes(status);
  const scoreKnown=Number.isFinite(Number(match.homeScore))&&Number.isFinite(Number(match.awayScore));
  const sourceUrl=match.sourceUrl||match.url||"";
  const statusText=postponed?(status==="postponed"?"Uppskjuten":"Inställd"):finished?"Slut":formatMatchTime(match.startTime);
  return `<article class="sport-match-card ${live?"is-live":""} ${finished?"is-finished":""} ${postponed?"is-postponed":""}" data-match-id="${esc(matchIdentity(match))}">
    <div class="sport-match-meta"><span><i data-lucide="${getSportIcon(match.sport)}"></i>${esc(match.sport||"Sport")}</span><small>${esc(match.competition||match.series||"")}</small></div>
    <div class="sport-match-status">${live?`<b><i data-lucide="radio"></i>LIVE${match.clock?` · ${esc(match.clock)}`:""}</b>`:`<time datetime="${esc(match.startTime||"")}">${esc(statusText)}</time>`}</div>
    <div class="sport-match-teams"><span><strong>${esc(match.homeTeam||"Hemmalag")}</strong>${favoriteTeamButton(match.homeTeam)}</span><span><strong>${esc(match.awayTeam||"Bortalag")}</strong>${favoriteTeamButton(match.awayTeam)}</span></div>
    <div class="sport-match-score ${scoreKnown?"sport-score":""}">${scoreKnown?`<strong>${esc(match.homeScore)}</strong><strong>${esc(match.awayScore)}</strong>`:`<span>${postponed?esc(statusText):finished?"Resultat saknas":"Ej startad"}</span>`}</div>
    <div class="sport-match-actions">
      ${!finished&&!postponed?`<button type="button" data-calendar-match="${esc(matchIdentity(match))}"><i data-lucide="calendar-plus"></i>Kalender</button>`:""}
      ${sourceUrl?`<a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Matchinfo <i data-lucide="arrow-up-right"></i></a>`:""}
    </div>
    <div class="sport-match-footer"><span><i data-lucide="map-pin"></i>${esc(match.venue||"Arena saknas")}</span><span><i data-lucide="database"></i>${esc(match.sourceName||"Officiell källa")}</span></div>
  </article>`;
};

function findMatchById(id){
  return Object.values(sportData?.municipalities||{}).flatMap(normalizedMatches).find(match=>matchIdentity(match)===id);
}
function downloadMatchCalendar(match){
  if(!match)return;
  const start=new Date(match.startTime);
  if(Number.isNaN(start.getTime()))return;
  const end=new Date(match.endTime||start.getTime()+2*60*60*1000);
  const stamp=date=>date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
  const clean=value=>String(value||"").replace(/[\\,;]/g,char=>`\\${char}`).replace(/\n/g,"\\n");
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//DinPuls//Lokalsport//SV","BEGIN:VEVENT",`UID:${clean(matchIdentity(match))}@dinpuls.se`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${clean(`${match.homeTeam} – ${match.awayTeam}`)}`,`LOCATION:${clean(match.venue)}`,`DESCRIPTION:${clean([match.sport,match.competition,match.sourceUrl].filter(Boolean).join(" · "))}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");
  const blob=new Blob([ics],{type:"text/calendar;charset=utf-8"});
  const link=document.createElement("a");
  link.href=URL.createObjectURL(blob);
  link.download=`${String(match.homeTeam||"match").replace(/[^a-z0-9åäö]+/gi,"-")}-${String(match.awayTeam||"").replace(/[^a-z0-9åäö]+/gi,"-")}.ics`;
  document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(link.href);
}

document.addEventListener("click",event=>{
  const calendarButton=event.target.closest("[data-calendar-match]");
  if(calendarButton){event.preventDefault();downloadMatchCalendar(findMatchById(calendarButton.dataset.calendarMatch))}
});

installMatchcenterControls();
renderSportPage();
updateDataFreshness();
window.setInterval(updateDataFreshness,60000);
