const municipalityState=window.DinPulsMunicipalityState;
const LUNCH_DAYS=[
  ["monday","Måndag"],["tuesday","Tisdag"],["wednesday","Onsdag"],
  ["thursday","Torsdag"],["friday","Fredag"],["saturday","Lördag"],["sunday","Söndag"]
];
const lunchParams=new URLSearchParams(location.search);
let lunchMunicipality=municipalityState.getInitial();
let selectedRestaurant=lunchParams.get("restaurang")||"";
let lunchData;
let lunchSelectionScrolled=false;
const escapeLunch = window.DinPulsSecurity.escapeHtml;
const safeLunchUrl = window.DinPulsSecurity.safeExternalUrl;
const stockholmDay=()=>new Intl.DateTimeFormat("en-US",{weekday:"long",timeZone:"Europe/Stockholm"}).format(new Date()).toLowerCase();

function updateLunchPageChrome(){
  document.querySelectorAll('a[href^="index.html"]').forEach(link=>link.href=`index.html?kommun=${encodeURIComponent(lunchMunicipality)}`);
  document.querySelectorAll("[data-lunch-municipality]").forEach(element=>element.textContent=lunchMunicipality);
  document.title=`Dagens lunch i ${lunchMunicipality} – DinPuls`;
}

async function initializeLunchPage(){
  const municipalitySelect=document.querySelector("#lunch-municipality");
  municipalityState.populateSelect(municipalitySelect,lunchMunicipality);
  updateLunchPageChrome();
  const daySelect=document.querySelector("#lunch-day");
  const today=stockholmDay();
  daySelect.innerHTML=LUNCH_DAYS.map(([value,label])=>`<option value="${value}" ${value===today?"selected":""}>${label}</option>`).join("");
  municipalitySelect.addEventListener("change",()=>{
    lunchMunicipality=municipalityState.set(municipalitySelect.value);
    selectedRestaurant="";
    lunchSelectionScrolled=true;
    renderLunchPage();
  });
  daySelect.addEventListener("change",renderLunchPage);
  document.querySelector("#lunch-search").addEventListener("input",renderLunchPage);
  renderStrategicAds("lunch", "lunchsida", "#lunch-page-list");
  const response=await fetch(`data/lunch.json`,{cache:"no-store"});
  if(!response.ok)throw new Error(`Status ${response.status}`);
  lunchData=await response.json();
  renderLunchPage();
}

function renderLunchPage(){
  if(!lunchData)return;
  updateLunchPageChrome();
  const day=document.querySelector("#lunch-day").value;
  const query=document.querySelector("#lunch-search").value.trim().toLocaleLowerCase("sv-SE");
  const restaurants=lunchData.municipalities?.[lunchMunicipality]?.restaurants||[];
  const filtered=restaurants
    .filter(item=>[item.name,item.address,...(item.days?.[day]||[]),...(item.standingDishes||[]),...Object.values(item.upcomingMenu?.days||{}).flat()].join(" ").toLocaleLowerCase("sv-SE").includes(query))
    .sort((a,b)=>{
      const aSelected=a.id===selectedRestaurant?1:0;
      const bSelected=b.id===selectedRestaurant?1:0;
      if(aSelected!==bSelected)return bSelected-aSelected;
      const aVerified=a.status==="current"&&(a.days?.[day]||[]).length?1:0;
      const bVerified=b.status==="current"&&(b.days?.[day]||[]).length?1:0;
      return bVerified-aVerified||a.name.localeCompare(b.name,"sv");
    });
  const dayLabel=LUNCH_DAYS.find(([value])=>value===day)?.[1]||"Vald dag";
  const standingMenus=filtered.filter(item=>item.status==="standing_menu"&&item.standingDishes?.length).length;
  const upcomingMenus=filtered.filter(item=>item.status==="upcoming"&&item.upcomingMenu).length;
  const imageMenus=filtered.filter(item=>item.status==="current"&&item.verifiedMenuImage&&(!item.verifiedMenuImageDays||item.verifiedMenuImageDays.includes(day))).length;
  const verified=filtered.filter(item=>item.status==="current"&&(item.days?.[day]||[]).length).length;
  document.querySelector("#lunch-page-total").textContent=`Lunch i ${lunchMunicipality} · ${dayLabel}`;
  document.querySelector("#lunch-page-summary").innerHTML=`
    <span><strong>${filtered.length}</strong> lunchställen</span>
    <span class="${verified?"verified":""}"><strong>${verified}</strong> verifierade menyer för dagen</span>
    ${imageMenus?`<span><strong>${imageMenus}</strong> verifierade veckomenyer som bild</span>`:""}
    ${standingMenus?`<span><strong>${standingMenus}</strong> fasta lunchmenyer</span>`:""}
    ${upcomingMenus?`<span><strong>${upcomingMenus}</strong> menyer för nästa vecka</span>`:""}
    <span><i data-lucide="${["saturday","sunday"].includes(day)?"calendar-days":"clock-3"}"></i>${["saturday","sunday"].includes(day)?"Helgutbud kan avvika – kontrollera originalkällan":"Verifierade rätter visas först"}</span>`;
  const updated=new Date(lunchData.generatedAt||"");
  document.querySelector("#lunch-page-updated").textContent=Number.isNaN(updated.getTime())?"":`Kontrollerat ${updated.toLocaleString("sv-SE",{timeZone:"Europe/Stockholm",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}`;
  const list=document.querySelector("#lunch-page-list");
  list.innerHTML=filtered.map(item=>renderLunchCard(item,day,item.id===selectedRestaurant)).join("");
  list.hidden=!filtered.length;
  document.querySelector("#lunch-page-empty").hidden=!!filtered.length;
  if(window.lucide)lucide.createIcons();
  if(selectedRestaurant&&!lunchSelectionScrolled){
    document.getElementById(`lunch-${selectedRestaurant}`)?.scrollIntoView({behavior:"smooth",block:"center"});
    lunchSelectionScrolled=true;
  }
}

function renderLunchCard(item,day,isSelected=false){
  const dishes=item.status==="current"?(item.days?.[day]||[]):[];
  const image=item.status==="current"&&item.verifiedMenuImage&&(!item.verifiedMenuImageDays||item.verifiedMenuImageDays.includes(day))?safeLunchUrl(item.verifiedMenuImage):null;
  const standing=item.status==="standing_menu"?(item.standingDishes||[]):[];
  const upcoming=item.status==="upcoming"?item.upcomingMenu:null;
  const status=standing.length?"Fast lunchmeny från restaurangen – ingen veckomeny":upcoming?`Publicerad meny för vecka ${upcoming.weekNumber}, från ${upcoming.validFrom}`:item.availabilityNotice?item.availabilityNotice:image?(item.menuImageDate?`Verifierad lunchbild för ${item.menuImageDate}`:"Verifierad veckomeny som bild"):item.closureNotice?item.closureNotice:dishes.length?"Verifierad meny för vald dag":item.status==="outdated"?"Ingen verifierad meny för aktuell vecka":item.status==="unavailable"?"Källan kunde inte nås vid senaste kontrollen":item.status==="seasonally_closed"?"Säsongsstängt":item.status==="active"?"Öppet för säsongen – kontrollera dagens rätt":item.seasonal?"Säsongsöppet lunchställe":"Lunch serveras – kontrollera dagens utbud";
  const retainedNotice=item.fetchWarning?`<p class="lunch-source-note">Menyn verifierades ${escapeLunch(item.checkedAt)}. Källan kunde inte nås vid senaste hämtningen. Den bevarade menyn gäller bara denna vecka.</p>`:"";
  const standingMenu=standing.length?`${item.standingNotice?`<p class="lunch-source-note">${escapeLunch(item.standingNotice)}</p>`:""}<ul class="lunch-dishes">${standing.map(dish=>`<li>${escapeLunch(dish)}</li>`).join("")}</ul>`:"";
  const upcomingImage=upcoming?.image?safeLunchUrl(upcoming.image):null;
  const upcomingMenu=upcoming?`<p class="lunch-source-note">Nästa veckas utbud. Gäller inte aktuell vecka.</p>${upcomingImage?`<a href="${escapeLunch(upcomingImage)}" target="_blank" rel="noopener noreferrer"><img src="${escapeLunch(upcomingImage)}" alt="${escapeLunch(item.name)} – vecka ${escapeLunch(upcoming.weekNumber)}" loading="lazy" style="display:block;width:100%;max-width:560px;height:auto;margin-top:12px"></a>`:""}${LUNCH_DAYS.filter(([key])=>upcoming.days?.[key]?.length).map(([key,label])=>`<h4>${escapeLunch(label)}</h4><ul class="lunch-dishes">${upcoming.days[key].map(dish=>`<li>${escapeLunch(dish)}</li>`).join("")}</ul>`).join("")}`:"";
  const menu=standingMenu||upcomingMenu||(image?`<a href="${escapeLunch(image)}" target="_blank" rel="noopener noreferrer"><img src="${escapeLunch(image)}" alt="${escapeLunch(item.name)} – ${item.menuImageDate?escapeLunch(item.menuImageDate):`veckomeny ${escapeLunch(item.weekNumber)}`}" loading="lazy" style="display:block;width:100%;max-width:560px;height:auto;margin-top:12px"></a>`:dishes.length?`<ul class="lunch-dishes">${dishes.map(dish=>`<li>${escapeLunch(dish)}</li>`).join("")}</ul>`:`<p class="lunch-source-note">Öppna originalkällan för dagens utbud och eventuella ändringar.</p>`);
  return `<article class="portal-card lunch-card ${isSelected?"selected":""}" id="lunch-${escapeLunch(item.id)}">
    <span class="portal-card-icon lunch"><i data-lucide="utensils"></i></span>
    <div><span class="lunch-status ${dishes.length?"verified":""}">${escapeLunch(status)}</span><h3>${escapeLunch(item.name)}</h3><p>${escapeLunch(item.address)} · ${escapeLunch(item.hours)}</p>${retainedNotice}${menu}</div>
    <a class="portal-source-button" href="${escapeLunch(safeLunchUrl(item.url))}" target="_blank" rel="noopener noreferrer">${dishes.length?"Kontrollera menyn":"Öppna menyn"} <i data-lucide="external-link"></i></a>
  </article>`;
}

initializeLunchPage().catch(error=>{
  console.error(error);
  document.querySelector("#lunch-page-total").textContent="Luncherna kunde inte laddas";
  document.querySelector("#lunch-page-empty").hidden=false;
});
