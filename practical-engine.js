(function(){"use strict";
const DATA_URL="data/practical.json";let dataPromise;
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const municipality=()=>new URLSearchParams(location.search).get("kommun")||window.DinPulsMunicipality?.getName?.()||window.DinPulsMunicipalityState?.getInitial?.()||"Åmål";
const load=()=>dataPromise||(dataPromise=fetch(DATA_URL,{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error("Praktiskt-data kunde inte hämtas");return r.json()}));
async function record(name=municipality()){return (await load()).municipalities?.[name]||null}
async function renderHome(){const host=document.querySelector("#practical-home-content"),link=document.querySelector("#practical-page-link");if(!host&&!link)return;const name=municipality();if(link)link.href=`praktiskt.html?kommun=${encodeURIComponent(name)}`;try{const item=await record(name);if(!host)return;if(!item){host.innerHTML=`<p>Praktisk vardagsinformation är ännu inte ansluten för ${esc(name)}.</p>`;return}host.innerHTML=`<p>Återvinning, sophämtning, parkering, vatten och annan lokal vardagsinformation.</p><span class="practical-home-count">${item.categories.length} verifierade områden</span>`}catch{if(host)host.innerHTML="<p>Informationen kunde inte hämtas just nu.</p>"}}
const start=()=>renderHome();document.addEventListener("dinpuls:components-loaded",start);document.addEventListener("dinpuls:municipalitychange",renderHome);if(document.readyState!=="loading")queueMicrotask(start);
window.DinPulsPractical=Object.freeze({load,record,municipality,escapeHtml:esc,renderHome});
})();
