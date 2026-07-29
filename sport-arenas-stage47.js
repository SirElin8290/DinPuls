(() => {
  const esc47=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  let arenaData47=null;
  async function loadArenas(){try{const response=await fetch(`data/arenas.json?version=${Date.now()}`,{cache:"no-store"});if(response.ok)arenaData47=await response.json()}catch(error){console.error("Arenor kunde inte laddas",error)}}
  function selectedArenas(){
    const data=arenaData47?.municipalities?.[sportMunicipality]?.arenas||[],sport=document.querySelector("#sport-filter")?.value||"all",query=document.querySelector("#sport-search")?.value.trim().toLocaleLowerCase("sv-SE")||"";
    return data.filter(arena=>(sport==="all"||arena.sports?.includes(sport))&&(!query||[arena.name,arena.type,...(arena.sports||[])].join(" ").toLocaleLowerCase("sv-SE").includes(query)));
  }
  function render(){
    const arenas=selectedArenas(),view=document.querySelector("#sport-view");
    view.innerHTML=`<section class="arena-directory"><div class="sport-section-heading"><div><span class="section-kicker">Arenor & idrottsanläggningar</span><h2>Spelplatser i ${esc47(sportMunicipality)}</h2><p>Praktisk information, hemmalag och matcher. Uppgifterna länkar alltid vidare till originalkällan.</p></div><small>${arenas.length} visas</small></div><div class="arena-grid">${arenas.map((arena,index)=>`${index===3&&typeof sportAdMarkup==="function"?sportAdMarkup(9):""}<a class="arena-card" href="arena.html?kommun=${encodeURIComponent(sportMunicipality)}&arena=${encodeURIComponent(arena.id)}"><span class="arena-card-icon"><i data-lucide="${arena.type==="Ishall"?"snowflake":arena.type==="Travbana"?"horse":"map-pin"}"></i></span><small>${esc47(arena.type)}</small><strong>${esc47(arena.name)}</strong><div class="arena-card-tags">${(arena.sports||[]).slice(0,3).map(s=>`<span>${esc47(s)}</span>`).join("")}</div><b>Öppna anläggningen <i data-lucide="arrow-right"></i></b></a>`).join("")||`<div class="portal-empty sport-empty"><strong>Inga anläggningar matchar urvalet</strong><span>Byt sport eller rensa sökningen.</span></div>`}</div></section>`;
    if(window.lucide)lucide.createIcons();
  }
  function patch(){
    const tabs=document.querySelector(".sport-tabs");if(!tabs||tabs.querySelector('[data-sport-tab="arenas"]'))return;
    const button=document.createElement("button");button.dataset.sportTab="arenas";button.setAttribute("role","tab");button.setAttribute("aria-selected","false");button.innerHTML='<i data-lucide="map-pin"></i>Arenor';tabs.append(button);button.addEventListener("click",()=>setActiveTab("arenas"));
  }
  const baseRender=window.renderSportPage;
  window.renderSportPage=function(){if(activeSportTab==="arenas"){render();return}baseRender()};
  loadArenas().then(()=>{patch();if(window.lucide)lucide.createIcons()});
})();
