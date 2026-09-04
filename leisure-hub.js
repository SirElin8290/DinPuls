(() => {
  "use strict";
  const state = window.DinPulsMunicipalityState;
  const esc = window.DinPulsSecurity.escapeHtml;
  const safeUrl = window.DinPulsSecurity.safeExternalUrl;
  const cards = window.DinPulsLeisureCards;
  const params = new URLSearchParams(location.search);
  const META = {
    natur:{title:"Scouter, natur & friluftsliv",icon:"compass",accent:"green",text:"Scouter, fåglar, odling och upplevelser utomhus."},
    musik:{title:"Musik, kör & scen",icon:"music-2",accent:"rose",text:"Körer, musikgrupper och lokala scenaktiviteter."},
    skapande:{title:"Konst, hantverk & skapande",icon:"palette",accent:"purple",text:"Måla, skriva, forma och skapa tillsammans."},
    spel:{title:"Spel, gaming & cosplay",icon:"gamepad-2",accent:"blue",text:"Brädspel, rollspel, gaming och fantasifulla möten."},
    djur:{title:"Djur, hund & häst",icon:"paw-print",accent:"orange",text:"Hundklubbar, djurföreningar och andra aktiviteter med djur."},
    kultur:{title:"Kultur & berättande",icon:"theater",accent:"violet",text:"Litteratur, lokal kultur och möten mellan människor."},
    gemenskap:{title:"Hembygd, byalag & gemenskap",icon:"heart-handshake",accent:"cyan",text:"Mötesplatser, lokalhistoria och föreningar som håller bygden levande."}
  };
  let data;
  let municipality = state.getInitial();
  const ALL_MUNICIPALITIES = "Alla kommuner";
  const expandedCategories = new Set();
  const INITIAL_ROWS = 6;
  const normalize = value => String(value || "").toLocaleLowerCase("sv-SE").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const current = () => municipality === ALL_MUNICIPALITIES
    ? {activities:Object.entries(data?.municipalities||{}).flatMap(([name,payload])=>(payload.activities||[]).map(item=>({...item,municipality:name}))),directoryUrl:""}
    : data?.municipalities?.[municipality] || {activities:[],directoryUrl:""};
  function render(){
    const query = normalize(document.querySelector("#leisure-search")?.value);
    const requested = normalize(params.get("kategori"));
    let items = current().activities || [];
    items = cards.filterActivities(items,{query,category:requested && META[requested] ? requested : ""});
    const groups = Object.entries(META).map(([id,meta]) => ({id,meta,items:items.filter(item=>item.category===id)})).filter(group=>group.items.length);
    const view = document.querySelector("#leisure-view");
    const status = document.querySelector("#leisure-search-status");
    if (status) status.textContent = query ? `${items.length} träff${items.length===1?"":"ar"} i ${municipality}` : `${(current().activities||[]).length} verifierade verksamheter i registret`;
    if (!groups.length) {
      view.innerHTML = `<article class="leisure-empty"><span><i data-lucide="search-x"></i></span><h2>${query ? "Ingen exakt träff ännu" : "Kartläggningen pågår"}</h2><p>${query ? `Vi hittade inget på ”${esc(document.querySelector("#leisure-search").value)}” i ${esc(municipality)}.` : `Fler lokala verksamheter i ${esc(municipality)} läggs till efter verifiering.`}</p>${current().directoryUrl?`<a href="${esc(safeUrl(current().directoryUrl))}" target="_blank" rel="noopener noreferrer">Sök vidare i kommunens föreningsregister <i data-lucide="external-link"></i></a>`:""}</article>`;
    } else {
      view.innerHTML = groups.map(group=>{
        const key = `${municipality}:${group.id}`;
        const expanded = query || expandedCategories.has(key);
        const visible = expanded ? group.items : group.items.slice(0,INITIAL_ROWS);
        const more = group.items.length - visible.length;
        return `<article class="leisure-module" data-accent="${group.meta.accent}"><header><span class="leisure-module-icon"><i data-lucide="${group.meta.icon}"></i></span><div><span class="section-kicker">Fritid nära dig</span><h2>${esc(group.meta.title)}</h2><p>${esc(group.meta.text)}</p></div><b>${group.items.length}</b></header><div class="leisure-activities">${visible.map(cards.activityCard).join("")}${more>0?`<button class="leisure-show-more" type="button" data-expand="${esc(key)}">Visa ${more} till <i data-lucide="chevron-down"></i></button>`:""}</div></article>`;
      }).join("") + (current().directoryUrl?`<aside class="leisure-register"><span><i data-lucide="list-tree"></i></span><div><strong>Saknas något?</strong><p>DinPuls kartläggning bygger på kommunala register och verifierade direkta länkar och växer löpande. Kommunens register kan innehålla fler verksamheter.</p></div><a href="${esc(safeUrl(current().directoryUrl))}" target="_blank" rel="noopener noreferrer">Öppna föreningsregistret <i data-lucide="external-link"></i></a></aside>`:"");
      view.querySelectorAll("[data-expand]").forEach(button=>button.addEventListener("click",()=>{expandedCategories.add(button.dataset.expand);render();}));
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function mergeFargelandaSupplement(supplement){
    if (!supplement?.activities?.length) return;
    data.municipalities = data.municipalities || {};
    const target = data.municipalities.Färgelanda || (data.municipalities.Färgelanda = {activities:[],directoryUrl:""});
    const seen = new Set((target.activities || []).map(item => normalize(item.name)));
    supplement.activities.forEach(item => {
      const key = normalize(item.name);
      if (!key || seen.has(key)) return;
      seen.add(key);
      target.activities.push(item);
    });
    if (supplement.directoryUrl) target.directoryUrl = supplement.directoryUrl;
  }

  async function init(){
    const [response, fargelandaResponse] = await Promise.all([
      fetch("data/leisure.json",{cache:"no-cache"}),
      fetch("data/leisure-fargelanda-supplement.json",{cache:"no-cache"}).catch(()=>null)
    ]);
    if(!response.ok) throw new Error(`Fritidsdata kunde inte laddas: ${response.status}`);
    data = await response.json();
    if (fargelandaResponse?.ok) mergeFargelandaSupplement(await fargelandaResponse.json());
    const select = document.querySelector("#leisure-municipality");
    select.innerHTML = `<option value="${ALL_MUNICIPALITIES}">Alla kommuner</option>` + state.MUNICIPALITIES.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join("");
    select.value = municipality;
    document.querySelector("#leisure-place").textContent = municipality;
    document.querySelector("#leisure-sport-link").href = `sport.html?kommun=${encodeURIComponent(municipality)}`;
    const input = document.querySelector("#leisure-search");
    input.value = params.get("q") || "";
    input.addEventListener("input",()=>{params.delete("kategori");render();});
    document.querySelector("#leisure-clear").addEventListener("click",()=>{input.value="";params.delete("kategori");input.focus();render();});
    document.querySelectorAll("[data-query]").forEach(button=>button.addEventListener("click",()=>{input.value=button.dataset.query;params.delete("kategori");render();}));
    select.addEventListener("change",event=>{municipality=event.target.value;if(municipality!==ALL_MUNICIPALITIES)state.set(municipality);document.querySelector("#leisure-place").textContent=municipality;document.querySelector("#leisure-sport-link").href=municipality===ALL_MUNICIPALITIES?"sport.html":`sport.html?kommun=${encodeURIComponent(municipality)}`;render();});
    render();
  }
  init().catch(error=>{console.error(error);document.querySelector("#leisure-view").innerHTML='<div class="leisure-loading">Fritidsinformationen kunde inte laddas. Försök igen om en stund.</div>';});
})();
