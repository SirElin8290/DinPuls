/* DinPuls Sport – Sprint 4.6 spelarlänkar på föreningssidan */
(() => {
  const params=new URLSearchParams(location.search),municipality=params.get("kommun")||"Åmål",clubName=params.get("klubb")||"";
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const playerName=item=>String(item?.name||item?.player||item?.fullName||"").trim();
  const playersFrom=(club,matches)=>{
    const map=new Map();
    [...(club.players||club.roster||[])].forEach(player=>{const name=playerName(player);if(name)map.set(name.toLocaleLowerCase("sv-SE"),player)});
    matches.forEach(match=>(match.lineups||match.rosters||[]).forEach(team=>(team.players||team.lineup||[]).forEach(player=>{const name=playerName(player);if(name&&!map.has(name.toLocaleLowerCase("sv-SE")))map.set(name.toLocaleLowerCase("sv-SE"),{...player,name})})));
    return [...map.values()].sort((a,b)=>playerName(a).localeCompare(playerName(b),"sv"));
  };
  Promise.all([fetch(`data/sports.json?version=${Date.now()}`,{cache:"no-store"}).then(r=>r.json()),fetch(`data/sport-feeds.json?version=${Date.now()}`,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null)]).then(([data,feeds])=>{
    const local=data.municipalities?.[municipality],club=local?.clubs?.find(item=>item.name===clubName);
    if(!club)return;
    const belongs=match=>[match.homeTeam,match.awayTeam].some(team=>String(team||"").toLocaleLowerCase("sv-SE").includes(clubName.toLocaleLowerCase("sv-SE"))||clubName.toLocaleLowerCase("sv-SE").includes(String(team||"").toLocaleLowerCase("sv-SE")));
    const matches=[...(local.matches||[]),...(feeds?.municipalities?.[municipality]?.matches||[])].filter(belongs),players=playersFrom(club,matches);
    const insert=()=>{
      const main=document.querySelector(".club-main");
      if(!main||document.querySelector("#club-players-46"))return false;
      main.insertAdjacentHTML("beforeend",`<section class="club-panel" id="club-players-46"><div class="club-panel-head"><span class="section-kicker">Sprint 4.6</span><h2>Trupp och spelare</h2></div>${players.length?`<div class="club-player-grid-46">${players.map(player=>{const name=playerName(player);return `<a class="club-player-card-46" href="player.html?kommun=${encodeURIComponent(municipality)}&klubb=${encodeURIComponent(clubName)}&spelare=${encodeURIComponent(name)}"><span>${esc(player.number||player.jerseyNumber||"•")}</span><span><strong>${esc(name)}</strong><small>${esc(player.position||player.role||"Spelare")}</small></span><i data-lucide="chevron-right"></i></a>`}).join("")}</div>`:`<div class="club-empty">Spelartruppen finns inte i den anslutna källan ännu. Sektionen fylls automatiskt när förbundet eller föreningen levererar laguppställningar.</div>`}</section>`);
      if(window.lucide)lucide.createIcons();
      return true;
    };
    if(!insert()){const observer=new MutationObserver(()=>{if(insert())observer.disconnect()});observer.observe(document.querySelector("#club-page"),{childList:true,subtree:true})}
  }).catch(error=>console.warn("Spelarlänkar kunde inte laddas",error));
})();
