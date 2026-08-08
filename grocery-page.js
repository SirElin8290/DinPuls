const municipalityState = window.DinPulsMunicipalityState;
const groceryParams = new URLSearchParams(location.search);
let groceryMunicipality = municipalityState.getInitial();
let groceryBasketId = groceryParams.get("kasse") || "bas";
let groceryData;

const escapeGrocery = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const basketKey = () => `dinpuls-grocery-${groceryBasketId}`;

async function initializeGrocery() {
  const response = await fetch(`data/grocery.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Matkassedata kunde inte laddas (${response.status})`);
  groceryData = await response.json();
  if (!groceryData.baskets.some(basket => basket.id === groceryBasketId)) groceryBasketId = groceryData.baskets[0].id;
  const municipalitySelect = document.querySelector("#grocery-municipality");
  municipalityState.populateSelect(municipalitySelect, groceryMunicipality);
  municipalitySelect.addEventListener("change", () => { groceryMunicipality = municipalityState.set(municipalitySelect.value, { updateUrl: false }); updateAddress(); renderGrocery(); });
  const basketSelect = document.querySelector("#grocery-basket");
  if (basketSelect) {
    basketSelect.innerHTML = groceryData.baskets.map(basket => `<option value="${escapeGrocery(basket.id)}" ${basket.id === groceryBasketId ? "selected" : ""}>${escapeGrocery(basket.name)}</option>`).join("");
    basketSelect.addEventListener("change", () => { groceryBasketId = basketSelect.value; updateAddress(); renderGrocery(); });
  }
  document.querySelector("#grocery-reset").addEventListener("click", () => { localStorage.removeItem(basketKey()); renderShoppingList(currentBasket()); });
  renderAds(); renderGrocery();
}

function updateAddress() {
  history.replaceState(null, "", `${location.pathname}?kommun=${encodeURIComponent(groceryMunicipality)}&kasse=${encodeURIComponent(groceryBasketId)}`);
}

function currentBasket() { return groceryData.baskets.find(basket => basket.id === groceryBasketId) || groceryData.baskets[0]; }

function renderGrocery() {
  const basket = currentBasket();
  document.querySelectorAll("[data-grocery-municipality]").forEach(element => element.textContent = groceryMunicipality);
  document.title = `${basket.name} för fyra i ${groceryMunicipality} – DinPuls`;
  document.querySelector("#grocery-basket-summary").innerHTML = `<span class="grocery-home-icon"><i data-lucide="shopping-basket"></i></span><div><small>${escapeGrocery(basket.label)} · alltid fyra personer</small><h2>${escapeGrocery(basket.name)}</h2><p>${escapeGrocery(basket.description)}</p></div><strong>${basket.items.length} varor</strong>`;
  document.querySelector("#grocery-meal-count").textContent = "Fast jämförelsekasse · 4 personer";
  document.querySelector("#grocery-meals").innerHTML = (basket.notes || []).map((note,index) => `<article><span>0${index + 1}</span><div><h3>${escapeGrocery(note.title)}</h3><p>${escapeGrocery(note.detail)}</p></div><b><i data-lucide="badge-check"></i></b></article>`).join("");
  renderShoppingList(basket); renderStores(basket);
  if (window.lucide) lucide.createIcons();
}

function checkedItems() { try { return new Set(JSON.parse(localStorage.getItem(basketKey()) || "[]")); } catch { return new Set(); } }

function renderShoppingList(basket) {
  const checked = checkedItems();
  const categories = [...new Set(basket.items.map(item => item.category))];
  const box = document.querySelector("#grocery-shopping-list");
  box.innerHTML = categories.map(category => `<section><h3>${escapeGrocery(category)}</h3>${basket.items.map((item, index) => ({item, index})).filter(entry => entry.item.category === category).map(({item, index}) => `<label class="${checked.has(index) ? "checked" : ""}"><input type="checkbox" data-item-index="${index}" ${checked.has(index) ? "checked" : ""}><span>${escapeGrocery(item.name)}</span><b>${escapeGrocery(item.quantity)}</b></label>`).join("")}</section>`).join("");
  box.querySelectorAll("input").forEach(input => input.addEventListener("change", () => { const saved = checkedItems(); const index = Number(input.dataset.itemIndex); input.checked ? saved.add(index) : saved.delete(index); localStorage.setItem(basketKey(), JSON.stringify([...saved])); input.closest("label").classList.toggle("checked", input.checked); }));
}

function priceStorageKey(storeName) {
  return `dinpuls-grocery-price:${groceryMunicipality}:${groceryBasketId}:${storeName}`;
}

function localPriceReport(storeName) {
  try { return JSON.parse(localStorage.getItem(priceStorageKey(storeName)) || "null"); }
  catch { return null; }
}

function calculateReportTotals(items) {
  const rows = Object.values(items || {});
  const sum = key => rows.reduce((total,row) => total + Number(row?.[key] || row?.regular || 0),0);
  return {
    regularTotal:Number(sum("regular").toFixed(2)),
    campaignTotal:Number(sum("campaign").toFixed(2)),
    memberTotal:Number(sum("member").toFixed(2))
  };
}

function renderStores(basket) {
  const stores = groceryData.municipalities?.[groceryMunicipality]?.stores || [];
  const published = groceryData.prices?.[groceryMunicipality]?.[basket.id] || {};
  const reports = stores.map(store => {
    const official = published[store.name] || null;
    const local = localPriceReport(store.name);
    return { store, price: local || official || {}, local: Boolean(local) };
  });
  const verifiedTotals = reports.map(entry => Number(entry.price.regularTotal || entry.price.total)).filter(total => total > 0);
  const lowest = verifiedTotals.length ? Math.min(...verifiedTotals) : null;
  document.querySelector("#grocery-updated").textContent = lowest
    ? "Ordinarie pris jämförs"
    : "Inga publicerade priser ännu · egen prisrunda sparas bara på den här enheten";
  document.querySelector("#grocery-stores").innerHTML = reports.map(({store,price,local}) => {
    const regular = Number(price.regularTotal || price.total);
    const campaign = Number(price.campaignTotal);
    const member = Number(price.memberTotal);
    const complete = Number(price.itemCount || 0) === basket.items.length && regular > 0;
    const isLowest = complete && regular === lowest;
    const count = Number(price.itemCount || 0);
    return `<article class="grocery-store ${isLowest ? "lowest" : ""}"><span class="portal-card-icon grocery"><i data-lucide="store"></i></span><div><h3>${escapeGrocery(store.name)}</h3><p>${complete ? `${basket.items.length} av ${basket.items.length} basvaror prissatta` : count ? `${count} av ${basket.items.length} varor registrerade` : `Ingen publicerad baskasse för ${escapeGrocery(groceryMunicipality)}`}</p>${price.checkedAt ? `<small>Kontrollerat ${escapeGrocery(new Date(price.checkedAt).toLocaleString("sv-SE",{dateStyle:"short",timeStyle:"short"}))} · ${escapeGrocery(price.source || "manuell prisrunda")}${local ? " · sparad på den här enheten" : ""}</small>` : `<small>Du kan lägga in en egen manuell prisrunda. Den publiceras inte automatiskt.</small>`}</div><div class="grocery-store-price">${isLowest ? `<em>Billigast ordinarie</em>` : ""}<strong>${complete ? `${formatGroceryPrice(regular)} kr` : "Pris saknas"}</strong>${complete && campaign > 0 && campaign < regular ? `<small class="grocery-offer-total">Kampanj: ${formatGroceryPrice(campaign)} kr</small>` : ""}${complete && member > 0 && member < regular ? `<small class="grocery-member-total">Medlem: ${formatGroceryPrice(member)} kr</small>` : ""}<button class="grocery-report-button" type="button" data-price-store="${escapeGrocery(store.name)}">Lägg in egen prisrunda</button><a href="${escapeGrocery(store.url)}" target="_blank" rel="noopener noreferrer">Kontrollera hos butiken <i data-lucide="external-link"></i></a></div></article>`;
  }).join("");
  document.querySelectorAll("[data-price-store]").forEach(button => button.addEventListener("click", () => openPriceCollector(button.dataset.priceStore,basket)));
}

function formatGroceryPrice(value) {
  return new Intl.NumberFormat("sv-SE",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value));
}

function openPriceCollector(storeName,basket) {
  const panel=document.querySelector("#grocery-price-collector");
  const saved=localPriceReport(storeName)||{};
  const values=saved.items||{};
  panel.hidden=false;
  panel.innerHTML=`<div class="grocery-collector-heading"><div><span class="section-kicker">DinPuls Baskasse</span><h2>${escapeGrocery(storeName)} · ${escapeGrocery(groceryMunicipality)}</h2><p>Ordinarie pris är obligatoriskt. Kampanj- och medlemspris fylls bara i när de finns. Ange kostnaden för exakt den mängd som står på raden.</p></div><button type="button" class="grocery-collector-close" aria-label="Stäng">×</button></div>
    <form id="grocery-price-form">
      <div class="grocery-price-columns"><span>Vara och mängd</span><span>Ordinarie</span><span>Kampanj</span><span>Medlem</span></div>
      <div class="grocery-price-fields">${basket.items.map((item,index)=>{const row=values[index]||{};return `<label><span><strong>${escapeGrocery(item.name)}</strong><small>${escapeGrocery(item.quantity)}</small></span><span class="grocery-price-input"><input aria-label="Ordinarie pris för ${escapeGrocery(item.name)}" inputmode="decimal" type="number" min="0.01" step="0.01" name="regular-${index}" value="${escapeGrocery(row.regular ?? row ?? "")}" required><b>kr</b></span><span class="grocery-price-input"><input aria-label="Kampanjpris för ${escapeGrocery(item.name)}" inputmode="decimal" type="number" min="0.01" step="0.01" name="campaign-${index}" value="${escapeGrocery(row.campaign ?? "")}"><b>kr</b></span><span class="grocery-price-input"><input aria-label="Medlemspris för ${escapeGrocery(item.name)}" inputmode="decimal" type="number" min="0.01" step="0.01" name="member-${index}" value="${escapeGrocery(row.member ?? "")}"><b>kr</b></span></label>`}).join("")}</div>
      <div class="grocery-collector-actions"><button type="submit">Spara och jämför</button><button type="button" id="grocery-copy-report" ${saved.regularTotal ? "" : "disabled"}>Kopiera prisrapport</button><span id="grocery-form-total">${saved.regularTotal ? `Ordinarie: ${formatGroceryPrice(saved.regularTotal)} kr` : "Totalsummorna räknas automatiskt"}</span></div>
    </form>`;
  panel.scrollIntoView({behavior:"smooth",block:"start"});
  panel.querySelector(".grocery-collector-close").addEventListener("click",()=>{panel.hidden=true});
  panel.querySelector("#grocery-price-form").addEventListener("submit",event=>{
    event.preventDefault();
    const itemPrices={};
    basket.items.forEach((item,index)=>{
      const regular=Number(event.currentTarget.elements[`regular-${index}`].value);
      const campaign=Number(event.currentTarget.elements[`campaign-${index}`].value)||null;
      const member=Number(event.currentTarget.elements[`member-${index}`].value)||null;
      itemPrices[index]={regular,campaign,member};
    });
    const totals=calculateReportTotals(itemPrices);
    const report={municipality:groceryMunicipality,basketId:basket.id,basketName:basket.name,store:storeName,itemCount:basket.items.length,items:itemPrices,...totals,checkedAt:new Date().toISOString(),source:"Manuellt kontrollerade hyllpriser"};
    localStorage.setItem(priceStorageKey(storeName),JSON.stringify(report));
    renderStores(basket);openPriceCollector(storeName,basket);
  });
  panel.querySelector("#grocery-copy-report").addEventListener("click",async()=>{
    const report=localPriceReport(storeName);if(!report)return;
    const itemRows=basket.items.map((item,index)=>({name:item.name,quantity:item.quantity,...report.items[index]}));
    const exportText=JSON.stringify({...report,itemRows},null,2);
    try{await navigator.clipboard.writeText(exportText);panel.querySelector("#grocery-form-total").textContent="Prisrapporten är kopierad – skicka den till DinPuls för publicering."}
    catch{panel.querySelector("#grocery-form-total").textContent="Kopiering blockerades. Försök igen i en vanlig webbläsare."}
  });
}

function renderAds() {
  renderStrategicAds("matkasse", "matkassesida", "#grocery-shopping-list");
}

initializeGrocery().catch(error => { console.error(error); document.querySelector("#grocery-basket-summary").innerHTML = "<strong>Matkassen kunde inte laddas. Försök igen om en liten stund.</strong>"; });
