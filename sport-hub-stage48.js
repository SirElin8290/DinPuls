(() => {
  "use strict";
  const MUNICIPALITIES=["Åmål","Säffle","Bengtsfors","Mellerud","Årjäng","Arvika","Grums"];
  const params=new URLSearchParams(location.search);
  let municipality=params.get("kommun")||localStorage.getItem("dinpuls-municipality")||"Åmål";
  const requestedSport=params.get("sport")||"all";
  if(!MUNICIPALITIES.includes(municipality))municipality="Åmål";
  let sportsData=null,arenaData=null,seasonData=null,activeTab="matches",hideResults=localStorage.getItem("dinpuls-hide-sport-results")==="true";
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const sourceFor=(data,sport)=>(data.liveSources||[]).find(source=>source.sport===sport)||(data.liveSources||[]).find(source=>source.sport==="Alla sporter")||null;
  const matchFinished=match=>["finished","final","ended"].includes(String(match.status||"").toLowerCase())||(Number.isFinite(Number(match.homeScore))&&Number.isFinite(Number(match.awayScore))&&new Date(match.startTime)<new Date());
  const matchValid=match=>{
    const home=String(match.homeTeam||"").trim(),away=String(match.awayTeam||"").trim(),date=new Date(match.startTime);
    const forbidden=/round date|game result|spectators|venue|undefined|null/i;
    return home&&away&&home!==away&&home.length<=80&&away.length<=80&&!forbidden.test(home)&&!forbidden.test(away)&&!Number.isNaN(date.getTime());
  };
  const identity=match=>String(match.id||[match.startTime,match.homeTeam,match.awayTeam].join("::"));
  const selectedSport=()=>document.querySelector("#sport-hub-sport")?.value||"all";
  const current=()=>sportsData?.municipalities?.[municipality]||{clubs:[],liveSources:[],matches:[]};
  const seasons=()=>seasonData?.municipalities?.[municipality]||[];
  const arenas=()=>arenaData?.municipalities?.[municipality]?.arenas||[];
  const matches=()=>{
    const sport=selectedSport();
    const seasonMatches=seasons().filter(item=>item.nextStart&&item.nextMatch).map(item=>{const teams=item.nextMatch.split(/\s+[–-]\s+/);return{id:`season-${municipality}-${item.sport}-${item.nextStart}`,sport:item.sport,competition:item.competition,startTime:item.nextStart,status:"scheduled",homeTeam:teams[0],awayTeam:teams[1],venue:item.venue||"",sourceName:item.sourceName,sourceUrl:item.sourceUrl,updatedAt:seasonData?.verifiedAt}});
    const unique=new Map([...(current().matches||[]),...seasonMatches].filter(matchValid).map(match=>[identity(match),match]));
    return [...unique.values()].filter(match=>sport==="all"||match.sport===sport).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime));
  };
  const sports=()=>{
    const data=current();
    return [...new Set([...(data.clubs||[]).flatMap(club=>club.sports||[]),...(data.matches||[]).filter(matchValid).map(match=>match.sport),...seasons().map(item=>item.sport),...(arenas()).flatMap(arena=>arena.sports||[])].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"sv"));
  };
  const dateTime=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?"Tid saknas":date.toLocaleString("sv-SE",{timeZone:"Europe/Stockholm",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})};
  const ad=position=>`<a class="sport-hub-ad" href="mailto:annonser@dinpuls.se?subject=${encodeURIComponent(`Sportannons ${position}, ${municipality}`)}"><span><small>SPORTANNONS ${position}</small><strong>Ditt lokala företag här</strong><span>På DinPuls sportsida · 500 kr/mån</span></span></a>`;
  const ads=(...positions)=>`<div class="sport-hub-ad-pair">${positions.map(ad).join("")}</div>`;
  function pageWithAds(blocks,prefix=""){
    let html=`${ad(1)}${prefix}`;
    blocks.forEach((block,index)=>{html+=block;if(index<6)html+=ad(index+2)});
    for(let index=blocks.length;index<6;index++)html+=ad(index+2);
    return `${html}${ad(8)}`;
  }
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
    sportSelect.value=available.includes(previous)?previous:(available.includes(requestedSport)?requestedSport:"all");
    const button=document.querySelector("#sport-hub-spoiler");button.classList.toggle("active",hideResults);button.setAttribute("aria-pressed",String(hideResults));button.innerHTML=`<i data-lucide="${hideResults?"eye":"eye-off"}"></i><span>${hideResults?"Visa resultat":"Dölj resultat"}</span>`;
    document.body.classList.toggle("results-hidden",hideResults);
    const freshness=document.querySelector("#sport-hub-freshness"),status=current().dataStatus||{};
    const feedChecked=new Date(status.generatedAt||sportsData?.generatedAt||0),seasonChecked=new Date(seasonData?.verifiedAt||0);
    const checked=seasonChecked>feedChecked?seasonChecked:feedChecked;
    const checkedLabel=Number.isNaN(checked.getTime())?"Kontrolltid saknas":`Kontrollerad ${checked.toLocaleString("sv-SE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}`;
    const stale=Number.isNaN(checked.getTime())||Date.now()-checked.getTime()>14*24*60*60*1000;
    const matchCount=matches().length;
    const activeSources=(sportsData?.sourceHealth||[]).filter(source=>source.municipality===municipality&&source.status==="ok").length;
    if(freshness)freshness.innerHTML=`<i data-lucide="${stale?"clock-alert":"shield-check"}"></i> ${esc(checkedLabel)} · ${matchCount} matcher inlästa · ${activeSources?`${activeSources} automatiskt sportflöde`:"officiella länkar"} · ${stale?"kontrollera källan":"originalkällan gäller"}`;
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
    return `<div class="sport-hub-empty"><span><strong>Inga matcher har kunnat läsas in just nu</strong><br>Det kan bero på serieuppehåll, att spelschemat ännu inte är publicerat eller att källan saknar maskinläsbar data.</span>${source?`<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Kontrollera officiell källa ↗</a>`:""}</div>`;
  }
  function seasonCards(){
    const selected=selectedSport(),items=seasons().filter(item=>selected==="all"||item.sport===selected);
    if(!items.length)return "";
    const icons={active:"activity",upcoming:"calendar-clock",paused:"pause-circle"};
    const verified=new Date(seasonData.verifiedAt).toLocaleDateString("sv-SE",{day:"numeric",month:"long",year:"numeric"});
    return `<section class="sport-hub-season-overview"><header><span class="section-kicker">Säsongsläge</span><h2>Aktivt och på väg att starta</h2><p>Verifierat ${esc(verified)}. Originalkällan gäller alltid.</p></header><div class="sport-hub-season-grid">${items.map(item=>`<a class="sport-hub-season ${esc(item.status)}" href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer"><i data-lucide="${icons[item.status]||"circle"}"></i><span><small>${esc(item.sport)} · ${esc(item.team)}</small><strong>${esc(item.statusLabel)}</strong><span>${esc(item.competition)}</span>${item.nextStart?`<b>${esc(dateTime(item.nextStart))}: ${esc(item.nextMatch)}</b>`:""}</span><em>Officiell källa ↗</em></a>`).join("")}</div></section>`;
  }
  function otherSportsSection(items,data){
    if(!items.length)return "";
    return `<section class="sport-hub-other"><header><span class="section-kicker">Övrig lokalsport</span><h2>Föreningar utan publicerat matchprogram</h2><p>De här sporterna finns lokalt men visas kompakt tills en verifierad tävlingskalender är ansluten.</p></header><div>${items.map(sport=>{const clubs=(data.clubs||[]).filter(club=>(club.sports||[]).includes(sport));const source=sourceFor(data,sport)||clubs[0];return `<a href="${esc(source?.url||"#")}" ${source?.url?'target="_blank" rel="noopener noreferrer"':""}><strong>${esc(sport)}</strong><span>${clubs.map(club=>esc(club.name)).join(" · ")||"Lokal verksamhet"}</span></a>`}).join("")}</div></section>`;
  }
  function renderMatches(){
    const data=current(),selected=selectedSport(),allSports=sports(),all=matches(),now=Date.now();
    const list=allSports.filter(sport=>(selected==="all"||sport===selected)&&(selected!=="all"||all.some(match=>match.sport===sport)||seasons().some(item=>item.sport===sport)));
    const other=selected==="all"?allSports.filter(sport=>!list.includes(sport)):[];
    const sections=list.map((sport,index)=>{
      const source=sourceFor(data,sport),sportMatches=all.filter(match=>match.sport===sport),played=sportMatches.filter(matchFinished).sort((a,b)=>new Date(b.startTime)-new Date(a.startTime)),upcoming=sportMatches.filter(match=>!matchFinished(match)&&new Date(match.startTime).getTime()>=now);
      const sourceLabel=source?`<a class="sport-hub-source" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Officiell ${esc(sport.toLocaleLowerCase("sv-SE"))}källa ↗</a>`:"";
      if(!sportMatches.length&&seasons().some(item=>item.sport===sport))return "";
      return `<section class="sport-hub-section"><header class="sport-hub-section-head"><div><span class="section-kicker">${esc(sport)}</span><h2>${esc(sport)} i ${esc(municipality)}</h2><p>${(data.clubs||[]).filter(club=>(club.sports||[]).includes(sport)).map(club=>esc(club.name)).join(" · ")||"Lokala föreningar"}</p></div>${sourceLabel}</header>${upcoming.length?`<h3 class="sport-hub-subtitle">Kommande matcher</h3><div class="sport-hub-match-list">${upcoming.slice(0,12).map(match=>matchRow(match,false)).join("")}</div>`:""}${played.length?`<h3 class="sport-hub-subtitle">Spelade matcher och resultat</h3><div class="sport-hub-match-list">${played.slice(0,12).map(match=>matchRow(match,true)).join("")}</div>`:""}${!sportMatches.length?emptyState(sport,source):""}</section>`;
    });
    const visible=sections.filter(Boolean);
    return pageWithAds(visible,`${seasonCards()}${otherSportsSection(other,data)}`);
  }
  function renderTables(){
    const selected=selectedSport();
    const activeSeries=seasons().filter(item=>(selected==="all"||item.sport===selected)&&item.competition&&!/lokal verksamhet|klubbtävlingar/i.test(item.competition));
    const sections=activeSeries.map(item=>`<section class="sport-hub-section sport-hub-series-card"><header class="sport-hub-section-head"><div><span class="section-kicker">${esc(item.sport)} · ${esc(item.team)}</span><h2>${esc(item.competition)}</h2><p>${esc(item.statusLabel)}. Tabellen visas hos ansvarigt förbund eller förening så att placering och poäng alltid är aktuella.</p></div><a class="sport-hub-source" href="${esc(item.tableUrl||item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Öppna officiell tabell ↗</a></header></section>`);
    if(!sections.length)sections.push(`<section class="sport-hub-section"><div class="sport-hub-empty"><span><strong>Ingen aktuell serietabell för urvalet</strong><br>Sporten kan vara individuell, sakna publicerad serie eller befinna sig mellan två säsonger.</span></div></section>`);
    return pageWithAds(sections);
  }
  function renderArenas(){
    const selected=selectedSport(),list=arenas().filter(arena=>selected==="all"||(arena.sports||[]).includes(selected)),allMatches=matches();
    const chunks=[];for(let i=0;i<list.length;i+=4)chunks.push(`<section class="sport-hub-section"><div class="sport-hub-arena-grid">${cardsFor(list.slice(i,i+4),allMatches)}</div></section>`);
    return pageWithAds(chunks);
  }
  function cardsFor(list,allMatches){return list.map(arena=>{const arenaNames=[arena.name,...(arena.aliases||[])].map(name=>name.toLocaleLowerCase("sv-SE")),count=allMatches.filter(match=>{const venue=String(match.venue||"").toLocaleLowerCase("sv-SE");return venue&&arenaNames.some(name=>venue.includes(name)||name.includes(venue))}).length,map=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${arena.name}, ${arena.address||municipality}`)}`;return `<article class="sport-hub-arena"><span class="section-kicker">${esc(arena.type)}</span><h3>${esc(arena.name)}</h3><p>${esc((arena.sports||[]).join(" · "))}</p><p><strong>Adress:</strong> ${esc(arena.address||municipality)}</p>${arena.phone?`<p><strong>Telefon:</strong> <a href="tel:${esc(arena.phone)}">${esc(arena.phone)}</a></p>`:""}<p>${count} inlästa matcher på anläggningen</p><div class="sport-hub-arena-links"><a href="${map}" target="_blank" rel="noopener noreferrer">Hitta hit ↗</a><a href="${esc(arena.sourceUrl)}" target="_blank" rel="noopener noreferrer">Officiell information ↗</a></div></article>`}).join("")}
  function render(){updateControls();renderSummary();document.querySelector("#sport-hub-view").innerHTML=activeTab==="tables"?renderTables():activeTab==="arenas"?renderArenas():renderMatches();if(window.lucide)lucide.createIcons()}
  async function init(){
    const [sportsResponse,arenaResponse,seasonResponse]=await Promise.all([fetch(`data/sports.json?version=${Date.now()}`,{cache:"no-store"}),fetch(`data/arenas.json?version=${Date.now()}`,{cache:"no-store"}),fetch(`data/sport-seasons.json?version=${Date.now()}`,{cache:"no-store"})]);
    if(!sportsResponse.ok||!arenaResponse.ok||!seasonResponse.ok)throw new Error("Sportdata kunde inte laddas");
    sportsData=await sportsResponse.json();arenaData=await arenaResponse.json();seasonData=await seasonResponse.json();
    const municipalitySelect=document.querySelector("#sport-hub-municipality");municipalitySelect.innerHTML=MUNICIPALITIES.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join("");municipalitySelect.value=municipality;
    municipalitySelect.addEventListener("change",()=>{municipality=municipalitySelect.value;localStorage.setItem("dinpuls-municipality",municipality);const url=new URL(location.href);url.searchParams.set("kommun",municipality);const sport=selectedSport();sport==="all"?url.searchParams.delete("sport"):url.searchParams.set("sport",sport);history.replaceState(null,"",`${url.pathname}?${url.searchParams.toString()}`);render()});
    const sportSelect=document.querySelector("#sport-hub-sport");
    sportSelect.addEventListener("change",()=>{const sport=sportSelect.value;const url=new URL(location.href);sport==="all"?url.searchParams.delete("sport"):url.searchParams.set("sport",sport);url.searchParams.set("kommun",municipality);history.replaceState(null,"",`${url.pathname}?${url.searchParams.toString()}`);render()});
    document.querySelector("#sport-hub-spoiler").addEventListener("click",()=>{hideResults=!hideResults;localStorage.setItem("dinpuls-hide-sport-results",String(hideResults));render()});
    document.querySelectorAll("[data-hub-tab]").forEach(button=>button.addEventListener("click",()=>setTab(button.dataset.hubTab)));
    render();
  }
  init().catch(error=>{console.error(error);document.querySelector("#sport-hub-view").innerHTML='<div class="sport-hub-loading">Sportläget kunde inte laddas. Försök igen om en stund.</div>'});
})();
