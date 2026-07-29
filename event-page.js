const EVENT_MUNICIPALITIES=["Åmål","Säffle","Bengtsfors","Mellerud","Årjäng","Arvika","Grums"];
const eventParams=new URLSearchParams(location.search);
let eventMunicipality=eventParams.get("kommun")||localStorage.getItem("dinpuls-municipality")||"Åmål";
if(!EVENT_MUNICIPALITIES.includes(eventMunicipality))eventMunicipality="Åmål";
let fullEventsData;
const escapeEvent=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);

async function initializeEventPage(){
  const select=document.querySelector("#events-municipality");
  select.innerHTML=EVENT_MUNICIPALITIES.map(name=>`<option ${name===eventMunicipality?"selected":""}>${name}</option>`).join("");
  select.addEventListener("change",()=>{eventMunicipality=select.value;localStorage.setItem("dinpuls-municipality",eventMunicipality);history.replaceState(null,"",`${location.pathname}?kommun=${encodeURIComponent(eventMunicipality)}`);renderEventPage()});
  ["#events-category","#events-period"].forEach(id=>document.querySelector(id).addEventListener("change",renderEventPage));
  document.querySelector("#events-search").addEventListener("input",renderEventPage);
  renderStrategicAds("evenemang", "evenemangssida", "#events-page-list");
  const response=await fetch(`data/events.json?version=${Date.now()}`,{cache:"no-store"});if(!response.ok)throw new Error(`Status ${response.status}`);
  fullEventsData=await response.json();renderEventPage();
}

function renderEventPage(){
  if(!fullEventsData)return;
  document.querySelectorAll("[data-events-municipality]").forEach(el=>el.textContent=eventMunicipality);document.title=`Evenemang i ${eventMunicipality} – DinPuls`;
  const data=fullEventsData.municipalities?.[eventMunicipality]||{events:[],sources:[]};const query=document.querySelector("#events-search").value.trim().toLocaleLowerCase("sv-SE");
  const category=document.querySelector("#events-category").value,period=document.querySelector("#events-period").value;const today=new Date();today.setHours(0,0,0,0);
  const items=(data.events||[]).filter(item=>{const start=new Date(item.startDate),end=new Date(item.endDate||item.startDate);end.setHours(23,59,59,999);if(end<today)return false;if(category!=="all"&&item.category!==category)return false;if(query&&![item.title,item.venue,item.sourceName,item.categoryLabel].join(" ").toLocaleLowerCase("sv-SE").includes(query))return false;if(period==="today"&&!(start<=today&&end>=today))return false;if(period==="30"){const limit=new Date(today);limit.setDate(limit.getDate()+30);if(start>limit)return false}if(period==="weekend"){const saturday=new Date(today);saturday.setDate(today.getDate()+((6-today.getDay()+7)%7));const sunday=new Date(saturday);sunday.setDate(saturday.getDate()+1);sunday.setHours(23,59,59,999);if(end<saturday||start>sunday)return false}return true}).sort((a,b)=>new Date(a.startDate)-new Date(b.startDate));
  document.querySelector("#events-page-total").textContent=`${items.length} kommande evenemang`;const updated=new Date(fullEventsData.generatedAt||"");document.querySelector("#events-page-updated").textContent=Number.isNaN(updated.getTime())?"":`Källor kontrollerade ${updated.toLocaleString("sv-SE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}`;
  const list=document.querySelector("#events-page-list");list.innerHTML=items.map(renderEventCard).join("");list.hidden=!items.length;document.querySelector("#events-page-empty").hidden=!!items.length;const healthByUrl=new Map((data.sourceHealth||[]).map(status=>[status.url,status]));document.querySelector("#events-source-list").innerHTML=(data.sources||[]).map(source=>renderEventSource(source,healthByUrl.get(source.url))).join("");if(window.lucide)lucide.createIcons();
}

function renderEventCard(item){const start=new Date(item.startDate),end=new Date(item.endDate||item.startDate),same=start.toDateString()===end.toDateString();const date=Number.isNaN(start.getTime())?"Datum saknas":same?start.toLocaleDateString("sv-SE",{weekday:"short",day:"numeric",month:"short"}):`${start.toLocaleDateString("sv-SE",{day:"numeric",month:"short"})}–${end.toLocaleDateString("sv-SE",{day:"numeric",month:"short"})}`;const icons={culture:"palette",music:"music",family:"baby",church:"church",sport:"trophy",community:"users",motor:"car-front"};return `<article class="portal-card event-message"><span class="portal-card-icon event"><i data-lucide="${icons[item.category]||"calendar-days"}"></i></span><div><span class="event-date">${escapeEvent(date)}${item.time?` · ${escapeEvent(item.time)}`:""}</span><h3>${escapeEvent(item.title)}</h3><p>${escapeEvent(item.venue||eventMunicipality)}</p><div class="portal-tags"><span>${escapeEvent(item.categoryLabel||"Evenemang")}</span><span>${escapeEvent(item.sourceName||"Lokal källa")}</span></div></div><a class="portal-source-button" href="${escapeEvent(item.url)}" target="_blank" rel="noopener noreferrer">Detaljer hos källan <i data-lucide="external-link"></i></a></article>`}
function renderEventSource(source,health){const imported=Number(health?.events)||0;const status=health?.status==="ok"?(imported?`Automatisk källa · ${imported} kommande tillfällen`:"Kontrollerad kalender · öppna för fullständigt program"):health?.status==="error"?"Källan svarade inte vid senaste kontrollen":"Kontrollstatus saknas";return `<a class="event-source" href="${escapeEvent(source.url)}" target="_blank" rel="noopener noreferrer"><span class="portal-card-icon event"><i data-lucide="${escapeEvent(source.icon||"calendar-days")}"></i></span><span><strong>${escapeEvent(source.name)}</strong><small>${escapeEvent(source.type)} · ${escapeEvent(status)}</small></span><i data-lucide="external-link"></i></a>`}
initializeEventPage().catch(error=>{console.error(error);document.querySelector("#events-page-total").textContent="Evenemangen kunde inte laddas";document.querySelector("#events-page-empty").hidden=false});


function renderStrategicAds(category, pageLabel, listSelector) {
  const slots = [...document.querySelectorAll("[data-strategic-ad]")];
  slots.forEach(slot => {
    const position = Number(slot.dataset.adPosition || 1);
    const subject = encodeURIComponent(`Annonsplats ${category} ${position}`);
    slot.innerHTML = `<a class="secondary-ad strategic-ad" href="mailto:annonser@dinpuls.se?subject=${subject}"><b>ANNONSPLATS ${position}</b><strong>Ditt företag här</strong><small>På DinPuls ${pageLabel} · 500 kr/mån</small></a>`;
  });
  const inlineSlot = slots.find(slot => slot.dataset.adPosition === "3");
  const list = document.querySelector(listSelector);
  if (!inlineSlot || !list) return;
  const placeInline = () => {
    const cards = [...list.children].filter(child => child !== inlineSlot);
    if (cards.length < 4) return;
    const anchor = cards[Math.min(cards.length - 1, Math.max(2, Math.floor(cards.length / 2)))];
    if (anchor.previousElementSibling !== inlineSlot) list.insertBefore(inlineSlot, anchor);
  };
  new MutationObserver(placeInline).observe(list, { childList: true });
  queueMicrotask(placeInline);
}
