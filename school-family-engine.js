(function(){"use strict";
const DATA_URL="data/school-family.json",SCHOOL_KEY="dinpuls-school-group";let dataPromise;
const esc=value=>String(value??"").replace(/[&<>"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
const municipality=()=>window.DinPulsMunicipality?.getName?.()||window.DinPulsMunicipalityState?.getInitial?.()||new URLSearchParams(location.search).get("kommun")||"Åmål";
const dateKey=(date=new Date())=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Stockholm",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
const load=()=>dataPromise||(dataPromise=fetch(DATA_URL,{cache:"no-cache"}).then(response=>{if(!response.ok)throw new Error("Skoldata kunde inte hämtas");return response.json()}));
async function record(name=municipality()){const payload=await load();return payload.municipalities?.[name]||null}
async function getSchoolMeals(name=municipality()){return(await record(name))?.meals||[]}
async function getSchoolCalendar(name=municipality()){return(await record(name))?.calendar||[]}
async function getSchools(name=municipality()){return(await record(name))?.schools||[]}
async function getSchoolServices(name=municipality()){return(await record(name))?.services||[]}
function selectedGroup(item){const allowed=item?.schoolGroups?.map(group=>group.id)||[];const saved=localStorage.getItem(`${SCHOOL_KEY}:${municipality()}`);return allowed.includes(saved)?saved:(allowed[0]||"")}
function nextEvent(item,today=dateKey()){return(item?.calendar||[]).filter(event=>event.endDate>=today).sort((a,b)=>a.startDate.localeCompare(b.startDate))[0]||null}
function formatDate(value){return new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Stockholm",day:"numeric",month:"long"}).format(new Date(`${value}T12:00:00+02:00`))}
async function renderHome(){const host=document.querySelector("#school-home-content");if(!host)return;const name=municipality();document.querySelector("#school-family-page-link")?.setAttribute("href",`skola-familj.html?kommun=${encodeURIComponent(name)}`);try{const item=await record(name);if(!item){host.innerHTML='<p>Skolinformation är ännu inte ansluten för vald kommun.</p>';return}const group=selectedGroup(item),today=dateKey(),meal=item.meals.find(entry=>entry.schoolGroup===group&&entry.date===today),event=nextEvent(item,today);host.innerHTML=`<strong>${meal?"Dagens skolmat":"Ingen publicerad skolmat för idag"}</strong>${meal?`<ul class="school-home-meals">${meal.options.map(option=>`<li><b>${esc(option.label)}:</b> ${esc(option.meal)}</li>`).join("")}</ul>`:'<p>Öppna sidan för skolgrupp och källinformation.</p>'}${event?`<p class="school-home-next"><b>Nästa skoldatum:</b> ${esc(event.title)} · ${esc(formatDate(event.startDate))}</p>`:""}`;window.lucide?.createIcons()}catch{host.innerHTML='<p>Skolinformationen kunde inte hämtas just nu.</p>'}}
const start=()=>renderHome();document.addEventListener("dinpuls:components-loaded",start);document.addEventListener("dinpuls:municipalitychange",renderHome);if(document.readyState!=="loading")queueMicrotask(start);
window.DinPulsSchoolFamily=Object.freeze({load,record,getSchoolMeals,getSchoolCalendar,getSchools,getSchoolServices,selectedGroup,nextEvent,dateKey,formatDate,escapeHtml:esc,renderHome,SCHOOL_KEY});
})();
