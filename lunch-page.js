const LUNCH_MUNICIPALITIES=["Åmål","Säffle","Bengtsfors","Mellerud","Årjäng","Arvika","Grums"];
const LUNCH_DAYS=[
  ["monday","Måndag"],["tuesday","Tisdag"],["wednesday","Onsdag"],
  ["thursday","Torsdag"],["friday","Fredag"],["saturday","Lördag"],["sunday","Söndag"]
];
const lunchParams=new URLSearchParams(location.search);
let lunchMunicipality=lunchParams.get("kommun")||localStorage.getItem("dinpuls-municipality")||"Åmål";
if(!LUNCH_MUNICIPALITIES.includes(lunchMunicipality))lunchMunicipality="Åmål";
let lunchData;
const escapeLunch=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
const stockholmDay=()=>new Intl.DateTimeFormat("en-US",{weekday:"long",timeZone:"Europe/Stockholm"}).format(new Date()).toLowerCase();

async function initializeLunchPage(){
  const municipalitySelect=document.querySelector("#lunch-municipality");
  municipalitySelect.innerHTML=LUNCH_MUNICIPALITIES.map(name=>`<option ${name===lunchMunicipality?"selected":""}>${name}</option>`).join("");
  const daySelect=document.querySelector("#lunch-day");
  const today=stockholmDay();
  daySelect.innerHTML=LUNCH_DAYS.map(([value,label])=>`<option value="${value}" ${value===today?"selected":""}>${label}</option>`).join("");
  municipalitySelect.addEventListener("change",()=>{
    lunchMunicipality=municipalitySelect.value;
    localStorage.setItem("dinpuls-municipality",lunchMunicipality);
    history.replaceState(null,"",`${location.pathname}?kommun=${encodeURIComponent(lunchMunicipality)}`);
    renderLunchPage();
  });
  daySelect.addEventListener("change",renderLunchPage);
  document.querySelector("#lunch-search").addEventListener("input",renderLunchPage);
  document.querySelector("#lunch-ads").innerHTML=`<span class="section-kicker">Lokala annonser</span><h2>Syns vid lunchbeslutet</h2>${Array.from({length:4},(_,index)=>`<a class="secondary-ad" href="mailto:annonser@dinpuls.se?subject=Annonsplats%20lunch%20${index+1}"><b>ANNONSPLATS ${index+1}</b><strong>Ditt företag här</strong><small>På DinPuls lunchsida · 500 kr/mån</small></a>`).join("")}<p class="ad-sales-note">Annonsplatser säljs separat per kommun.</p>`;
  const response=await fetch(`data/lunch.json?version=${Date.now()}`,{cache:"no-store"});
  if(!response.ok)throw new Error(`Status ${response.status}`);
  lunchData=await response.json();
  renderLunchPage();
}

function renderLunchPage(){
  if(!lunchData)return;
  document.querySelectorAll("[data-lunch-municipality]").forEach(element=>element.textContent=lunchMunicipality);
  document.title=`Dagens lunch i ${lunchMunicipality} – DinPuls`;
  const day=document.querySelector("#lunch-day").value;
  const query=document.querySelector("#lunch-search").value.trim().toLocaleLowerCase("sv-SE");
  const restaurants=lunchData.municipalities?.[lunchMunicipality]?.restaurants||[];
  const filtered=restaurants.filter(item=>![item.name,item.address,...(item.days?.[day]||[])].join(" ").toLocaleLowerCase("sv-SE").includes(query)?false:true);
  const dayLabel=LUNCH_DAYS.find(([value])=>value===day)?.[1]||"Vald dag";
  document.querySelector("#lunch-page-total").textContent=`${filtered.length} lunchställen · ${dayLabel}`;
  const updated=new Date(lunchData.generatedAt||"");
  document.querySelector("#lunch-page-updated").textContent=Number.isNaN(updated.getTime())?"":`Kontrollerat ${updated.toLocaleString("sv-SE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}`;
  const list=document.querySelector("#lunch-page-list");
  list.innerHTML=filtered.map(item=>renderLunchCard(item,day)).join("");
  list.hidden=!filtered.length;
  document.querySelector("#lunch-page-empty").hidden=!!filtered.length;
  if(window.lucide)lucide.createIcons();
}

function renderLunchCard(item,day){
  const dishes=item.status==="current"?(item.days?.[day]||[]):[];
  const status=dishes.length?"Dagens rätter verifierade":item.status==="outdated"?"Veckomenyn är inte aktuell":item.status==="unavailable"?"Källan kunde inte nås":"Aktuell meny hos restaurangen";
  const menu=dishes.length?`<ul class="lunch-dishes">${dishes.map(dish=>`<li>${escapeLunch(dish)}</li>`).join("")}</ul>`:`<p class="lunch-source-note">Öppna restaurangens sida för aktuell meny och eventuella ändringar.</p>`;
  return `<article class="portal-card lunch-card">
    <span class="portal-card-icon lunch"><i data-lucide="utensils"></i></span>
    <div><span class="lunch-status ${dishes.length?"verified":""}">${escapeLunch(status)}</span><h3>${escapeLunch(item.name)}</h3><p>${escapeLunch(item.address)} · ${escapeLunch(item.hours)}</p>${menu}</div>
    <a class="portal-source-button" href="${escapeLunch(item.url)}" target="_blank" rel="noopener noreferrer">Veckomeny <i data-lucide="external-link"></i></a>
  </article>`;
}

initializeLunchPage().catch(error=>{
  console.error(error);
  document.querySelector("#lunch-page-total").textContent="Luncherna kunde inte laddas";
  document.querySelector("#lunch-page-empty").hidden=false;
});
