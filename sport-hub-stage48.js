(() => {
  "use strict";
  const MUNICIPALITIES=["Åmål","Säffle","Bengtsfors","Mellerud","Årjäng","Arvika","Grums"];
  const params=new URLSearchParams(location.search);
  let municipality=params.get("kommun")||localStorage.getItem("dinpuls-municipality")||"Åmål";
  if(!MUNICIPALITIES.includes(municipality))municipality="Åmål";
  let sportsData=null,arenaData=null,activeTab="matches",hideResults=localStorage.getItem("dinpuls-hide-sport-results")==="true";
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const sourceFor=(data,sport)=>(data.liveSources||[]).find(source=>source.sport===sport)||(data.liveSources||[])[0];
  const matchFinished=match=>["finished","final","ended"].includes(String(match.status||"").toLowerCase())||(Number.isFinite(Number(match.homeScore))&&Number.isFinite(Number(match.awayScore))&&new Date(match.startTime)<new Date());
  const matchValid=match=>{
    const home=String(match.homeTeam||"").trim(),away=String(match.awayTeam||"").trim(),date=new Date(match.startTime);
    const forbidden=/round date|game result|spectators|venue|undefined|null/i;
    return home&&away&&home!==away&&home.length<=80&&away.length<=80&&!forbidden.test(home)&&!forbidden.test(away)&&!Number.isNaN(date.getTime());
  };
  const identity=match=>String(match.id||[match.startTime,match.homeTeam,match.awayTeam].join("::"));
  const selectedSport=()=>document.querySelector("#sport-hub-sport")?.value||"all";
  const current=()=>sportsData?.municipalities?.[municipality]||{clubs:[],liveSources:[],matches:[]};
  const arenas=()=>arenaData?.municipalities?.[municipality]?.arenas||[];
  const matches=()=>{
    const sport=selectedSport();
    return (current().matches||[]).filter(matchValid).filter(match=>sport==="all"||match.sport===sport).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime));
  };
  const sports=()=>{
    const data=current();
    return [...new Set([...(data.clubs||[]).flatMap(club=>club.sports||[]),...(data.matches||[]).filter(matchValid).map(match=>match.sport),...(arenas()).flatMap(arena=>arena.sports||[])].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"sv"));
  };
  const dateTime=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?"Tid saknas":date.toLocaleString("sv-SE",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})};
  const ad=position=>`<a class="sport-hub-ad" href="mailto:annonser@dinpuls.se?subject=${encodeURIComponent(`Sportannons ${position}, ${municipality}`)}"><span><small>SPORTANNONS ${position}</small><strong>Ditt lokala företag här</strong><span>På DinPuls sportsida · 500 kr/mån</span></span></a>`;
  const ads=(...positions)=>`<div class="sport-hub-ad-pair">${positions.map(ad).join("")}</div>`;
  function setTab(tab){
    activeTab=tab;
    document.querySelectorAll("[data-hub-tab]").forEach(button=>{const active=button.dataset.hubTab===tab;button.classList.toggle("active",active);button.setAttribute("aria-selected",String(active))});
    render();
  }
  function updateControls(){
    document.querySelector("#sport-hub-place").textContent=municipality;
    document.title=`Sportläget i ${municipality} – DinPuls`;
    const sportSelect=document.querySelector("#sport-hub-sport"),previous=sportSelect.value,available=sports();
    sportSelect.innerHTML=`<option value="all">Alla sporter</option>${available.map(sport=>`<option value="${esc(sport)}">${esc(sport)}</option>`).join("")}`;
    sportSelect.value=available.includes(previous)?previous:"all";
    const button=document.querySelector("#sport-hub-spoiler");button.classList.toggle("active",hideResults);button.setAttribute("aria-pressed",String(hideResults));button.innerHTML=`<i data-lucide="${hideResults?"eye":"eye-off"}"></i><span>${hideResults?"Visa resultat":"Dölj resultat"}</span>`;
    document.body.classList.toggle("results-hidden",hideResults);
  }
  function renderSummary(){
    const all=matches(),now=Date.now(),finished=all.filter(matchFinished),upcoming=all.filter(match=>!matchFinished(match)&&new Date(match.startTime).getTime()>=now);
    const competitions=new Set(all.map(match=>match.competition).filter(Boolean));
    document.querySelector("#sport-hub-summary").innerHTML=`
      <article><i data-lucide="circle-check"></i><div><strong>${finished.length}</strong><span>spelade matcher</span></div></article>
      <article><i data-lucide="calendar-days"></i><div><strong>${upcoming.length}</strong><span>kommande matcher</span></div></article>
      <article><i data-lucide="trophy"></i><div><strong>${competitions.size}</strong><span>aktuella serier</span></div></article>
      <article><i data-lucide="map-pin"></i><div><strong>${arenas().length}</strong><span>arenor och hallar</span></div></article>`;
  }
  function matchRow(match,finished){
    const result=finished&&Number.isFinite(Number(match.homeScore))&&Number.isFinite(Number(match.awayScore))?`${match.homeScore}–${match.awayScore}`:"–";
    return `<article class="sport-hub-match"><time>${esc(dateTime(match.startTime))}</time><div><strong>${esc(match.homeTeam)} – ${esc(match.awayTeam)}</strong><small>${esc([match.competition,match.venue].filter(Boolean).join(" · "))}</small></div><span class="sport-hub-result">${esc(result)}</span></article>`;
  }
  function emptyState(sport,source){
    return `<div class="sport-hub-empty"><span><strong>Inga matcher är publicerade just nu</strong><br>Säsongen kan ha uppehåll eller nästa spelschema kan saknas.</span>${source?`<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Kontrollera officiell källa ↗</a>`:""}</div>`;
  }
  function renderMatches(){
    const data=current(),selected=selectedSport(),list=sports().filter(sport=>selected==="all"||sport===selected),all=matches(),now=Date.now();
    const sections=list.map((sport,index)=>{
      const source=sourceFor(data,sport),sportMatches=all.filter(match=>match.sport===sport),played=sportMatches.filter(matchFinished).sort((a,b)=>new Date(b.startTime)-new Date(a.startTime)),upcoming=sportMatches.filter(match=>!matchFinished(match)&&new Date(match.startTime).getTime()>=now);
      return `<section class="sport-hub-section"><header class="sport-hub-section-head"><div><span class="section-kicker">${esc(sport)}</span><h2>${esc(sport)} i ${esc(municipality)}</h2><p>${(data.clubs||[]).filter(club=>(club.sports||[]).includes(sport)).map(club=>esc(club.name)).join(" · ")||"Lokala föreningar"}</p></div>${source?`<a class="sport-hub-source" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Officiell sportkälla ↗</a>`:""}</header>${upcoming.length?`<h3 class="sport-hub-subtitle">Kommande matcher</h3><div class="sport-hub-match-list">${upcoming.slice(0,12).map(match=>matchRow(match,false)).join("")}</div>`:""}${played.length?`<h3 class="sport-hub-subtitle">Spelade matcher och resultat</h3><div class="sport-hub-match-list">${played.slice(0,12).map(match=>matchRow(match,true)).join("")}</div>`:""}${!sportMatches.length?emptyState(sport,source):""}</section>${index<6?ad(index+2):""}`;
    });
    return `${ad(1)}${sections.join("")}${sections.length<6?ads(...Array.from({length:6-sections.length},(_,i)=>sections.length+i+2)):""}${ad(8)}`;
  }
  function standings(competitionMatches){
    const teams=new Map(),ensure=name=>{if(!teams.has(name))teams.set(name,{name,played:0,wins:0,draws:0,losses:0,gf:0,ga:0,points:0});return teams.get(name)};
    competitionMatches.filter(matchFinished).forEach(match=>{if(!Number.isFinite(Number(match.homeScore))||!Number.isFinite(Number(match.awayScore)))return;const home=ensure(match.homeTeam),away=ensure(match.awayTeam),hs=Number(match.homeScore),as=Number(match.awayScore);home.played++;away.played++;home.gf+=hs;home.ga+=as;away.gf+=as;away.ga+=hs;if(hs>as){home.wins++;away.losses++;home.points+=3}else if(hs<as){away.wins++;home.losses++;away.points+=3}else{home.draws++;away.draws++;home.points++;away.points++}});
    return [...teams.values()].sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf);
  }
  function renderTables(){
    const data=current(),all=matches().filter(matchFinished),groups=new Map();
    all.forEach(match=>{const key=`${match.sport}::${match.competition||"Aktuell serie"}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(match)});
    const sections=[...groups.entries()].map(([key,items],index)=>{const [sport,competition]=key.split("::"),rows=standings(items),source=sourceFor(data,sport);return `<section class="sport-hub-section"><header class="sport-hub-section-head"><div><span class="section-kicker">${esc(sport)}</span><h2>${esc(competition)}</h2><p>Tabell beräknad enbart från ${items.length} verifierade matcher som DinPuls har läst in.</p></div>${source?`<a class="sport-hub-source" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Se officiell tabell ↗</a>`:""}</header><div class="sport-hub-table-wrap"><table class="sport-hub-table"><thead><tr><th>#</th><th>Lag</th><th>S</th><th>V</th><th>O</th><th>F</th><th>Mål</th><th>+/-</th><th>P</th></tr></thead><tbody>${rows.map((row,i)=>`<tr><td>${i+1}</td><td class="${row.name.toLocaleLowerCase("sv-SE").includes(municipality.toLocaleLowerCase("sv-SE"))?"local-team":""}">${esc(row.name)}</td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.gf}–${row.ga}</td><td>${row.gf-row.ga>0?"+":""}${row.gf-row.ga}</td><td><strong>${row.points}</strong></td></tr>`).join("")}</tbody></table></div><p class="sport-hub-note">DinPuls-tabellen kan vara ofullständig. Den officiella källan gäller alltid.</p></section>${index<6?ad(index+2):""}`});
    if(!sections.length){const available=sports().filter(sport=>selectedSport()==="all"||selectedSport()===sport);sections.push(...available.map((sport,index)=>{const source=sourceFor(data,sport);return `<section class="sport-hub-section"><header class="sport-hub-section-head"><div><span class="section-kicker">${esc(sport)}</span><h2>Aktuell tabell</h2><p>Ingen komplett serietabell är inläst i DinPuls ännu.</p></div>${source?`<a class="sport-hub-source" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Se officiell tabell ↗</a>`:""}</header></section>${index<6?ad(index+2):""}`}))}
    return `${ad(1)}${sections.join("")}${sections.length<6?ads(...Array.from({length:6-sections.length},(_,i)=>sections.length+i+2)):""}${ad(8)}`;
  }
  function renderArenas(){
    const selected=selectedSport(),list=arenas().filter(arena=>selected==="all"||(arena.sports||[]).includes(selected)),allMatches=matches();
    const chunks=[];for(let i=0;i<list.length;i+=4)chunks.push(`<section class="sport-hub-section"><div class="sport-hub-arena-grid">${cardsFor(list.slice(i,i+4),allMatches)}</div></section>${i/4<7?ad(i/4+2):""}`);
    return `${ad(1)}${chunks.join("")}${chunks.length<6?ads(...Array.from({length:6-chunks.length},(_,i)=>chunks.length+i+2)):""}${ad(8)}`;
  }
  function cardsFor(list,allMatches){return list.map(arena=>{const arenaNames=[arena.name,...(arena.aliases||[])].map(name=>name.toLocaleLowerCase("sv-SE")),count=allMatches.filter(match=>{const venue=String(match.venue||"").toLocaleLowerCase("sv-SE");return venue&&arenaNames.some(name=>venue.includes(name)||name.includes(venue))}).length,map=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${arena.name}, ${arena.address||municipality}`)}`;return `<article class="sport-hub-arena"><span class="section-kicker">${esc(arena.type)}</span><h3>${esc(arena.name)}</h3><p>${esc((arena.sports||[]).join(" · "))}</p><p><strong>Adress:</strong> ${esc(arena.address||municipality)}</p>${arena.phone?`<p><strong>Telefon:</strong> <a href="tel:${esc(arena.phone)}">${esc(arena.phone)}</a></p>`:""}<p>${count} inlästa matcher på anläggningen</p><div class="sport-hub-arena-links"><a href="${map}" target="_blank" rel="noopener noreferrer">Hitta hit ↗</a><a href="${esc(arena.sourceUrl)}" target="_blank" rel="noopener noreferrer">Officiell information ↗</a></div></article>`}).join("")}
  function render(){updateControls();renderSummary();document.querySelector("#sport-hub-view").innerHTML=activeTab==="tables"?renderTables():activeTab==="arenas"?renderArenas():renderMatches();if(window.lucide)lucide.createIcons()}
  async function init(){
    const [sportsResponse,arenaResponse]=await Promise.all([fetch(`data/sports.json?version=${Date.now()}`,{cache:"no-store"}),fetch(`data/arenas.json?version=${Date.now()}`,{cache:"no-store"})]);
    if(!sportsResponse.ok||!arenaResponse.ok)throw new Error("Sportdata kunde inte laddas");
    sportsData=await sportsResponse.json();arenaData=await arenaResponse.json();
    const municipalitySelect=document.querySelector("#sport-hub-municipality");municipalitySelect.innerHTML=MUNICIPALITIES.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join("");municipalitySelect.value=municipality;
    municipalitySelect.addEventListener("change",()=>{municipality=municipalitySelect.value;localStorage.setItem("dinpuls-municipality",municipality);history.replaceState(null,"",`${location.pathname}?kommun=${encodeURIComponent(municipality)}`);render()});
    document.querySelector("#sport-hub-sport").addEventListener("change",render);
    document.querySelector("#sport-hub-spoiler").addEventListener("click",()=>{hideResults=!hideResults;localStorage.setItem("dinpuls-hide-sport-results",String(hideResults));render()});
    document.querySelectorAll("[data-hub-tab]").forEach(button=>button.addEventListener("click",()=>setTab(button.dataset.hubTab)));
    render();
  }
  init().catch(error=>{console.error(error);document.querySelector("#sport-hub-view").innerHTML='<div class="sport-hub-loading">Sportläget kunde inte laddas. Försök igen om en stund.</div>'});
})();
