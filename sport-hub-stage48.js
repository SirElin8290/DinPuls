(() => {
  "use strict";
  const state = window.DinPulsMunicipalityState;
  const params = new URLSearchParams(location.search);
  const esc = window.DinPulsSecurity.escapeHtml;
  const safeUrl = window.DinPulsSecurity.safeExternalUrl;
  const META = {
    Fotboll:["circle-dot","green"],Futsal:["circle-dot","green"],Innebandy:["target","purple"],Ishockey:["disc-3","blue"],Bandy:["goal","cyan"],Handboll:["circle-dot","orange"],Basket:["circle-dot","orange"],Bowling:["circle","violet"],Golf:["flag-triangle-right","green"],Ridsport:["trophy","rose"],Motorsport:["flag","red"],Orientering:["compass","green"],Löpning:["person-standing","orange"],Skidor:["mountain-snow","cyan"],Mountainbike:["bike","green"],Cykel:["bike","green"],Tennis:["circle-dot","yellow"],Badminton:["activity","yellow"],Bordtennis:["circle-dot","red"],Boule:["circle","blue"],Kampsport:["shield","red"],Boxning:["badge","red"],Bågskytte:["target","green"],Simning:["waves","blue"],Gymnastik:["sparkles","purple"],Skytte:["target","slate"],Kanot:["waves","blue"],Travsport:["trophy","orange"],Parasport:["accessibility","blue"],Sportfiske:["fish","cyan"]
  };
  let municipality = state.getInitial();
  let requested = params.get("kategori") || params.get("sport") || "all";
  let data;
  const current = () => data?.municipalities?.[municipality] || {clubs:[],liveSources:[],matches:[]};
  const sports = () => [...new Set((current().clubs||[]).flatMap(club=>club.sports||[]))].sort((a,b)=>a.localeCompare(b,"sv"));
  const normalize = value => String(value||"").toLocaleLowerCase("sv-SE").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const meta = sport => META[sport] || ["users","blue"];
  const validMatch = match => match?.sport && match.homeTeam && match.awayTeam && !Number.isNaN(new Date(match.startTime).getTime());
  const finished = match => ["finished","final","ended"].includes(String(match.status||"").toLowerCase()) || (Number.isFinite(Number(match.homeScore)) && Number.isFinite(Number(match.awayScore)));
  const dateTime = value => new Date(value).toLocaleString("sv-SE",{timeZone:"Europe/Stockholm",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

  function providers(sport){
    const items=(current().liveSources||[]).filter(source=>source.sport===sport).map(source=>({...source,local:true}));
    const national=data?.sportProviders?.[sport];
    if(national&&!items.some(item=>item.url===national.url))items.push({title:national.label,...national,local:false});
    return items;
  }

  function sourceLinks(sport){
    const links=providers(sport);
    return links.length?'<div class="activity-links">'+links.map((source,index)=>`<a class="${index===0?"primary":""}" href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer"><i data-lucide="${source.local?"external-link":"landmark"}"></i><span><strong>${esc(source.title||source.label||"Resultat och kalender")}</strong><small>${source.local?"Lokalt lag eller förening":esc(source.provider||"Ansvarigt förbund")}</small></span></a>`).join("")+"</div>":"";
  }

  function clubAliases(club,sport){
    const aliases=[club.name];
    (club.teams||[]).filter(team=>team.sport===sport).forEach(team=>aliases.push(team.name,`${club.name} ${team.name}`));
    return aliases.map(normalize).filter(Boolean);
  }

  function belongsToClub(match,club,sport){
    const aliases=clubAliases(club,sport);
    const home=normalize(match.homeTeam);
    const away=normalize(match.awayTeam);
    return aliases.some(alias=>home.includes(alias)||away.includes(alias)||alias.includes(home)||alias.includes(away));
  }

  function clubMatches(club,sport){
    return (current().matches||[])
      .filter(match=>validMatch(match)&&match.sport===sport&&belongsToClub(match,club,sport))
      .sort((a,b)=>new Date(a.startTime)-new Date(b.startTime));
  }

  function clubMatchSummary(club,sport){
    const now=Date.now();
    const matches=clubMatches(club,sport);
    const previous=[...matches].filter(match=>finished(match)||new Date(match.startTime).getTime()<now).sort((a,b)=>new Date(b.startTime)-new Date(a.startTime))[0];
    const next=matches.find(match=>!finished(match)&&new Date(match.startTime).getTime()>=now);
    if(!previous&&!next)return '';
    const previousHtml=previous?`<span><small>Senaste match</small><strong>${esc(previous.homeTeam)} ${Number.isFinite(Number(previous.homeScore))?esc(previous.homeScore):"–"}–${Number.isFinite(Number(previous.awayScore))?esc(previous.awayScore):"–"} ${esc(previous.awayTeam)}</strong><em>${esc(dateTime(previous.startTime))}${previous.competition?` · ${esc(previous.competition)}`:""}</em></span>`:'';
    const nextHtml=next?`<span><small>Nästa match</small><strong>${esc(next.homeTeam)} – ${esc(next.awayTeam)}</strong><em>${esc(dateTime(next.startTime))}${next.competition?` · ${esc(next.competition)}`:""}</em></span>`:'';
    return `<div class="activity-club-form">${previousHtml}${nextHtml}</div>`;
  }

  function matchRows(sport){
    const oldest=Date.now()-180*86400000;
    const matches=(current().matches||[]).filter(match=>validMatch(match)&&match.sport===sport&&new Date(match.startTime).getTime()>oldest).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime));
    if(!matches.length)return '<div class="activity-data-missing"><i data-lucide="link"></i><span><strong>Automatisk matchdata saknas</strong><small>Använd länken till lagets eller förbundets aktuella resultat- och matchsida.</small></span></div>';
    return '<div class="activity-matches">'+matches.slice(-5).map(match=>`<article><time>${esc(dateTime(match.startTime))}</time><span><strong>${esc(match.homeTeam)} – ${esc(match.awayTeam)}</strong><small>${esc(match.competition||match.venue||"Match")}</small></span><b>${finished(match)?`${esc(match.homeScore)}–${esc(match.awayScore)}`:"Kommande"}</b>${match.sourceUrl?`<a href="${esc(safeUrl(match.sourceUrl))}" target="_blank" rel="noopener noreferrer" aria-label="Öppna originalkällan">↗</a>`:""}</article>`).join("")+"</div>";
  }

  function sportModule(sport, query=""){
    const [icon,accent]=meta(sport);
    const clubs=(current().clubs||[]).filter(club=>(club.sports||[]).includes(sport)).filter(club=>!query||normalize([sport,club.name,...(club.teams||[]).map(team=>team.name)].join(" ")).includes(query));
    const clubLinks=clubs.map(club=>{
      const teams=(club.teams||[]).filter(team=>team.sport===sport);
      const teamLinks=teams.length?`<div class="activity-teams" aria-label="Lag i ${esc(club.name)}">${teams.map(team=>`<a href="${esc(safeUrl(team.url||club.url))}" target="_blank" rel="noopener noreferrer"><span>${esc(team.name)}</span><small>Matcher, resultat och tabell</small><i data-lucide="external-link"></i></a>`).join("")}</div>`:"";
      const summary=clubMatchSummary(club,sport);
      return `<section class="activity-club"><a class="activity-club-main" href="${esc(safeUrl(club.url))}" target="_blank" rel="noopener noreferrer"><i data-lucide="shield"></i><span><strong>${esc(club.name)}</strong><small>${teams.length?`${teams.length} ${teams.length===1?"lag":"lag"} · ${esc(club.source||"Föreningen")}`:esc(club.source||"Föreningen")}</small></span><i data-lucide="external-link"></i></a>${summary}${teamLinks}</section>`;
    }).join("");
    return `<article class="activity-module" data-accent="${accent}"><header><span class="activity-icon"><i data-lucide="${icon}"></i></span><div><span class="section-kicker">Idrott</span><h2>${esc(sport)}</h2><p>${clubs.length} ${clubs.length===1?"lokal förening":"lokala föreningar"}</p></div></header><div class="activity-clubs">${clubLinks}</div>${matchRows(sport)}${sourceLinks(sport)}</article>`;
  }

  function updateControls(){
    document.querySelector("#sport-hub-place").textContent=municipality;
    document.title=`Idrott & motion i ${municipality} – DinPuls`;
    const select=document.querySelector("#sport-hub-sport");
    const options=[...sports()];
    select.innerHTML='<option value="all">Alla aktiviteter</option>'+options.map(item=>`<option value="${esc(item)}">${esc(item)}</option>`).join("");
    select.value=options.includes(requested)?requested:"all";
    document.querySelector("#sport-hub-freshness").innerHTML=`<i data-lucide="shield-check"></i> ${sports().length} idrotter · officiella källor och kommunens föreningsregister`;
  }

  function render(){
    const selected=document.querySelector("#sport-hub-sport")?.value||"all";
    const query=normalize(document.querySelector("#sport-hub-search")?.value);
    const shownSports=(selected==="all"?sports():sports().filter(sport=>sport===selected)).filter(sport=>!query||(current().clubs||[]).some(club=>(club.sports||[]).includes(sport)&&normalize([sport,club.name,...(club.teams||[]).map(team=>team.name)].join(" ")).includes(query)));
    const clubs=current().clubs||[];
    document.querySelector("#sport-hub-summary").innerHTML=`<article><strong>${clubs.length}</strong><span>verifierade idrottsföreningar</span></article><article><strong>${sports().length}</strong><span>idrotter med egen modul</span></article><article><strong>${shownSports.length}</strong><span>${query?"sökresultat":"visas just nu"}</span></article>`;
    document.querySelector("#sport-hub-search-status").textContent=query?`${shownSports.length} idrott${shownSports.length===1?"":"er"} matchar sökningen i ${municipality}`:"";
    document.querySelector("#sport-hub-view").innerHTML=shownSports.length?shownSports.map(sport=>sportModule(sport,query)).join(""):`<article class="sport-search-empty"><i data-lucide="search-x"></i><h2>Ingen träff i ${esc(municipality)}</h2><p>Prova ett annat ord eller välj Alla aktiviteter.</p></article>`;
    if(window.lucide)window.lucide.createIcons();
  }

  async function init(){
    const response=await fetch("data/sports.json",{cache:"no-cache"});
    if(!response.ok)throw new Error(`Föreningsdata kunde inte laddas: ${response.status}`);
    data=await response.json();
    municipality=state.getInitial();
    const municipalitySelect=document.querySelector("#sport-hub-municipality");
    municipalitySelect.innerHTML=state.MUNICIPALITIES.map(item=>`<option value="${esc(item)}">${esc(item)}</option>`).join("");
    municipalitySelect.value=municipality;
    updateControls();render();
    municipalitySelect.addEventListener("change",event=>{municipality=event.target.value;requested="all";state.set(municipality);document.querySelector("#sport-leisure-link").href=`fritid.html?kommun=${encodeURIComponent(municipality)}`;updateControls();render();});
    document.querySelector("#sport-hub-sport").addEventListener("change",render);
    const search=document.querySelector("#sport-hub-search");
    search.value=params.get("q")||"";
    search.addEventListener("input",render);
    document.querySelector("#sport-hub-clear").addEventListener("click",()=>{search.value="";search.focus();render();});
    document.querySelector("#sport-leisure-link").href=`fritid.html?kommun=${encodeURIComponent(municipality)}`;
  }

  init().catch(error=>{console.error(error);document.querySelector("#sport-hub-view").innerHTML='<div class="sport-hub-loading">Föreningar och idrott kunde inte laddas. Försök igen om en stund.</div>';});
})();
