(function(){"use strict";
const DATA_URL="data/family-places.json";let dataPromise;
const esc=value=>String(value??"").replace(/[&<>"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
const municipality=()=>new URLSearchParams(location.search).get("kommun")||window.DinPulsMunicipality?.getName?.()||window.DinPulsMunicipalityState?.getInitial?.()||"Åmål";
const load=()=>dataPromise||(dataPromise=fetch(DATA_URL,{cache:"no-cache"}).then(response=>{if(!response.ok)throw new Error("Familjedata kunde inte hämtas");return response.json()}));
async function record(name=municipality()){const payload=await load();return payload.municipalities?.[name]||null}
async function getCategories(){return(await load()).categories||[]}
async function getFamilyPlaces(name=municipality()){return(await record(name))?.places||[]}
async function renderHome(){const host=document.querySelector("#family-home-content");if(!host)return;const name=municipality();try{const item=await record(name);if(!item?.places?.length){host.innerHTML=`<h3 id="family-home-title">Vad kan vi göra idag?</h3><p>Familjeplatser är ännu inte anslutna för ${esc(name)}.</p>`;return}host.innerHTML=`<h3 id="family-home-title">Vad kan vi göra idag?</h3><p>Hitta lekplatser, bad, utflykter och andra aktiviteter för barn och familj i ${esc(name)}.</p><span class="family-home-count">${item.places.length} verifierade platser</span><a href="skola-familj.html?kommun=${encodeURIComponent(name)}#family-section">Utforska familjeaktiviteter <span aria-hidden="true">→</span></a>`}catch{host.innerHTML='<h3 id="family-home-title">Vad kan vi göra idag?</h3><p>Familjeplatserna kunde inte hämtas just nu.</p>'}}
const start=()=>renderHome();document.addEventListener("dinpuls:components-loaded",start);document.addEventListener("dinpuls:municipalitychange",renderHome);if(document.readyState!=="loading")queueMicrotask(start);
window.DinPulsFamily=Object.freeze({load,record,getCategories,getFamilyPlaces,municipality,escapeHtml:esc,renderHome});
})();
