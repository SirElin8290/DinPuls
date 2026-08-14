(() => {
  "use strict";
  const state = window.DinPulsMunicipalityState;
  const params = new URLSearchParams(location.search);
  const esc = window.DinPulsSecurity.escapeHtml;
  const safeUrl = window.DinPulsSecurity.safeExternalUrl;
  const META = {
    Fotboll:["circle-dot","green"],Futsal:["circle-dot","green"],Innebandy:["target","purple"],Ishockey:["disc-3","blue"],Bandy:["goal","cyan"],Handboll:["circle-dot","orange"],Basket:["circle-dot","orange"],Bowling:["circle","violet"],Golf:["flag-triangle-right","green"],Ridsport:["trophy","rose"],Motorsport:["flag","red"],Orientering:["compass","green"],Löpning:["person-standing","orange"],Skidor:["mountain-snow","cyan"],Mountainbike:["bike","green"],Cykel:["bike","green"],Tennis:["circle-dot","yellow"],Badminton:["activity","yellow"],Bordtennis:["circle-dot","red"],Boule:["circle","blue"],Kampsport:["shield","red"],Boxning:["badge","red"],Bågskytte:["target","green"],Simning:["waves","blue"],Gymnastik:["sparkles","purple"],Skytte:["target","slate"],Kanot:["waves","blue"],Travsport:["trophy","orange"],Parasport:["accessibility","blue"],Sportfiske:["fish","cyan"]
  };
  const DISCOVERY = [
    {id:"Scouter",icon:"compass",accent:"green",title:"Scouter & friluftsliv",text:"Kårer, friluftsaktiviteter och gemenskap för barn och unga."},
    {id:"Dans",icon:"music-2",accent:"purple",title:"Dans",text:"Dansföreningar, kurser och lokala dansaktiviteter."},
    {id:"Musik & barnkör",icon:"mic-2",accent:"rose",title:"Musik & barnkör",text:"Körer, musikföreningar och skapande verksamhet."},
    {id:"Barn & unga",icon:"sparkles",accent:"orange",title:"Barn & unga",text:"Övriga föreningar och fritidsaktiviteter för barn och ungdomar."}
  ];
  let municipality = state.getInitial();
  let requested = params.get("kategori") || params.get("sport") || "all";
  let data;
  const current = () => data?.municipalities?.[municipality] || {clubs:[],liveSources:[],matches:[]};
  const sports = () => [...new Set((current().clubs||[]).flatMap(club=>club.sports||[]))].sort((a,b)=>a.localeCompare(b,"sv"));
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
  function matchRows(sport){
    const oldest=Date.now()-180*86400000;
    const matches=(current().matches||[]).filter(match=>validMatch(match)&&match.sport===sport&&new Date(match.startTime).getTime()>oldest).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime));
    if(!matches.length)return '<div class="activity-data-missing"><i data-lucide="link"></i><span><strong>Automatisk matchdata saknas</strong><small>Använd länken till lagets eller förbundets aktuella resultat- och matchsida.</small></span></div>';
    return '<div class="activity-matches">'+matches.slice(-5).map(match=>`<article><time>${esc(dateTime(match.startTime))}</time><span><strong>${esc(match.homeTeam)} – ${esc(match.awayTeam)}</strong><small>${esc(match.competition||match.venue||"Match")}</small></span><b>${finished(match)?`${esc(match.homeScore)}–${esc(match.awayScore)}`:"Kommande"}</b>${match.sourceUrl?`<a href="${esc(safeUrl(match.sourceUrl))}" target="_blank" rel="noopener noreferrer" aria-label="Öppna originalkällan">↗</a>`:""}</article>`).join("")+"</div>";
  }
  function sportModule(sport){
    const [icon,accent]=meta(sport);
    const clubs=(current().clubs||[]).filter(club=>(club.sports||[]).includes(sport));
    const clubLinks=clubs.map(club=>{
      const teams=(club.teams||[]).filter(team=>team.sport===sport);
      const teamLinks=teams.length?`<div class="activity-teams" aria-label="Lag i ${esc(club.name)}">${teams.map(team=>`<a href="${esc(safeUrl(team.url||club.url))}" target="_blank" rel="noopener noreferrer"><span>${esc(team.name)}</span><small>Matcher, resultat och tabell</small><i data-lucide="external-link"></i></a>`).join("")}</div>`:"";
      return `<section class="activity-club"><a class="activity-club-main" href="${esc(safeUrl(club.url))}" target="_blank" rel="noopener noreferrer"><i data-lucide="shield"></i><span><strong>${esc(club.name)}</strong><small>${teams.length?`${teams.length} ${teams.length===1?"lag":"lag"} · ${esc(club.source||"Föreningen")}`:esc(club.source||"Föreningen")}</small></span><i data-lucide="external-link"></i></a>${teamLinks}</section>`;
    }).join("");
    return `<article class="activity-module" data-accent="${accent}"><header><span class="activity-icon"><i data-lucide="${icon}"></i></span><div><span class="section-kicker">Idrott</span><h2>${esc(sport)}</h2><p>${clubs.length} ${clubs.length===1?"lokal förening":"lokala föreningar"}</p></div></header><div class="activity-clubs">${clubLinks}</div>${matchRows(sport)}${sourceLinks(sport)}</article>`;
  }
  function discoveryModule(item){
    const directory=current().directoryUrl;
    return `<article class="activity-module activity-discovery" data-accent="${item.accent}"><header><span class="activity-icon"><i data-lucide="${item.icon}"></i></span><div><span class="section-kicker">Föreningsliv</span><h2>${esc(item.title)}</h2><p>${esc(item.text)}</p></div></header><div class="activity-data-missing"><i data-lucide="search"></i><span><strong>Se vilka verksamheter som finns i ${esc(municipality)}</strong><small>Utbud och kontaktuppgifter kan ändras. Kommunens föreningsregister är originalkällan.</small></span></div>${directory?`<div class="activity-links"><a class="primary" href="${esc(safeUrl(directory))}" target="_blank" rel="noopener noreferrer"><i data-lucide="list-tree"></i><span><strong>Öppna kommunens föreningsregister</strong><small>Scouter, kultur, barn, unga och övrig fritid</small></span></a></div>`:""}</article>`;
  }
  function updateControls(){
    document.querySelector("#sport-hub-place").textContent=municipality;
    document.title=`Föreningar & fritid i ${municipality} – DinPuls`;
    const select=document.querySelector("#sport-hub-sport");
    const options=[...sports(),...DISCOVERY.map(item=>item.id)];
    select.innerHTML='<option value="all">Alla aktiviteter</option>'+options.map(item=>`<option value="${esc(item)}">${esc(item)}</option>`).join("");
    select.value=options.includes(requested)?requested:"all";
    document.querySelector("#sport-hub-freshness").innerHTML=`<i data-lucide="shield-check"></i> ${sports().length} idrotter · officiella källor och kommunens föreningsregister`;
  }
  function render(){
    const selected=document.querySelector("#sport-hub-sport")?.value||"all";
    const shownSports=selected==="all"?sports():sports().filter(sport=>sport===selected);
    const shownDiscovery=selected==="all"?DISCOVERY:DISCOVERY.filter(item=>item.id===selected);
    const clubs=current().clubs||[];
    document.querySelector("#sport-hub-summary").innerHTML=`<article><strong>${clubs.length}</strong><span>verifierade idrottsföreningar</span></article><article><strong>${sports().length}</strong><span>idrotter med egen modul</span></article><article><strong>${DISCOVERY.length}</strong><span>ingångar till övrigt föreningsliv</span></article>`;
    document.querySelector("#sport-hub-view").innerHTML=shownSports.map(sportModule).join("")+shownDiscovery.map(discoveryModule).join("");
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
    municipalitySelect.addEventListener("change",event=>{municipality=event.target.value;requested="all";state.set(municipality);updateControls();render();});
    document.querySelector("#sport-hub-sport").addEventListener("change",render);
  }
  init().catch(error=>{console.error(error);document.querySelector("#sport-hub-view").innerHTML='<div class="sport-hub-loading">Föreningar och fritid kunde inte laddas. Försök igen om en stund.</div>';});
})();
