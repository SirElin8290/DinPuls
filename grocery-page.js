const GROCERY_MUNICIPALITIES = ["Åmål", "Säffle", "Bengtsfors", "Mellerud", "Årjäng", "Arvika", "Grums"];
const groceryParams = new URLSearchParams(location.search);
let groceryMunicipality = groceryParams.get("kommun") || localStorage.getItem("dinpuls-municipality") || "Åmål";
if (!GROCERY_MUNICIPALITIES.includes(groceryMunicipality)) groceryMunicipality = "Åmål";
let groceryBasketId = groceryParams.get("kasse") || "vardag";
let groceryData;

const escapeGrocery = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const basketKey = () => `dinpuls-grocery-${groceryBasketId}`;

async function initializeGrocery() {
  const response = await fetch(`data/grocery.json?version=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Matkassedata kunde inte laddas (${response.status})`);
  groceryData = await response.json();
  if (!groceryData.baskets.some(basket => basket.id === groceryBasketId)) groceryBasketId = groceryData.baskets[0].id;
  const municipalitySelect = document.querySelector("#grocery-municipality");
  municipalitySelect.innerHTML = GROCERY_MUNICIPALITIES.map(name => `<option ${name === groceryMunicipality ? "selected" : ""}>${name}</option>`).join("");
  municipalitySelect.addEventListener("change", () => { groceryMunicipality = municipalitySelect.value; localStorage.setItem("dinpuls-municipality", groceryMunicipality); updateAddress(); renderGrocery(); });
  const basketSelect = document.querySelector("#grocery-basket");
  basketSelect.innerHTML = groceryData.baskets.map(basket => `<option value="${escapeGrocery(basket.id)}" ${basket.id === groceryBasketId ? "selected" : ""}>${escapeGrocery(basket.name)} – ${escapeGrocery(basket.label)}</option>`).join("");
  basketSelect.addEventListener("change", () => { groceryBasketId = basketSelect.value; updateAddress(); renderGrocery(); });
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
  document.querySelector("#grocery-meal-count").textContent = `${basket.meals.length} måltider · 4 portioner per måltid`;
  document.querySelector("#grocery-meals").innerHTML = basket.meals.map(meal => `<article><span>${escapeGrocery(meal.day)}</span><div><h3>${escapeGrocery(meal.name)}</h3><p>${escapeGrocery(meal.detail)}</p></div><b>4 port.</b></article>`).join("");
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

function renderStores(basket) {
  const stores = groceryData.municipalities?.[groceryMunicipality]?.stores || [];
  const published = groceryData.prices?.[groceryMunicipality]?.[basket.id] || {};
  const reports = stores.map(store => {
    const official = published[store.name] || null;
    const local = localPriceReport(store.name);
    return { store, price: local || official || {}, local: Boolean(local) };
  });
  const verifiedTotals = reports.map(entry => Number(entry.price.total)).filter(total => total > 0 && entryIsComplete(total));
  const lowest = verifiedTotals.length ? Math.min(...verifiedTotals) : null;
  document.querySelector("#grocery-updated").textContent = lowest ? "Jämförelse från kontrollerade priser" : "Registrera första prisrundan";
  document.querySelector("#grocery-stores").innerHTML = reports.map(({store, price, local}) => {
    const total = Number(price.total);
    const complete = Number(price.itemCount || basket.items.length) === basket.items.length && total > 0;
    const isLowest = complete && total === lowest;
    const count = Number(price.itemCount || 0);
    return `<article class="grocery-store ${isLowest ? "lowest" : ""}"><span class="portal-card-icon grocery"><i data-lucide="store"></i></span><div><h3>${escapeGrocery(store.name)}</h3><p>${complete ? `${basket.items.length} av ${basket.items.length} varor prissatta` : count ? `${count} av ${basket.items.length} varor registrerade` : `Ingen komplett kontroll för ${escapeGrocery(groceryMunicipality)}`}</p>${price.checkedAt ? `<small>Kontrollerat ${escapeGrocery(new Date(price.checkedAt).toLocaleString("sv-SE",{dateStyle:"short",timeStyle:"short"}))} · ${escapeGrocery(price.source || "manuell prisrunda")}${local ? " · sparat på den här enheten" : ""}</small>` : `<small>Registrera de synliga hyllpriserna utan butikskonto</small>`}</div><div class="grocery-store-price">${isLowest ? `<em>Billigast</em>` : ""}<strong>${complete ? `${new Intl.NumberFormat("sv-SE",{minimumFractionDigits:2,maximumFractionDigits:2}).format(total)} kr` : "Pris saknas"}</strong><button class="grocery-report-button" type="button" data-price-store="${escapeGrocery(store.name)}">Registrera priser</button><a href="${escapeGrocery(store.url)}" target="_blank" rel="noopener noreferrer">Kontrollera hos butiken <i data-lucide="external-link"></i></a></div></article>`;
  }).join("");
  document.querySelectorAll("[data-price-store]").forEach(button => button.addEventListener("click", () => openPriceCollector(button.dataset.priceStore, basket)));
}

function entryIsComplete(total) { return Number(total) > 0; }

function openPriceCollector(storeName, basket) {
  const panel = document.querySelector("#grocery-price-collector");
  const saved = localPriceReport(storeName) || {};
  const values = saved.items || {};
  panel.hidden = false;
  panel.innerHTML = `<div class="grocery-collector-heading"><div><span class="section-kicker">Manuell prisrunda</span><h2>${escapeGrocery(storeName)} · ${escapeGrocery(groceryMunicipality)}</h2><p>Ange kostnaden för den mängd som står på varje rad. Alla ${basket.items.length} rader måste fyllas för en rättvis totalsumma.</p></div><button type="button" class="grocery-collector-close" aria-label="Stäng">×</button></div>
    <form id="grocery-price-form">
      <div class="grocery-price-fields">${basket.items.map((item,index)=>`<label><span><strong>${escapeGrocery(item.name)}</strong><small>${escapeGrocery(item.quantity)}</small></span><span class="grocery-price-input"><input inputmode="decimal" type="number" min="0.01" step="0.01" name="item-${index}" value="${escapeGrocery(values[index] ?? "")}" required><b>kr</b></span></label>`).join("")}</div>
      <div class="grocery-collector-actions"><button type="submit">Spara och jämför</button><button type="button" id="grocery-copy-report" ${saved.total ? "" : "disabled"}>Kopiera prisrapport</button><span id="grocery-form-total">${saved.total ? `Senast: ${new Intl.NumberFormat("sv-SE",{minimumFractionDigits:2}).format(saved.total)} kr` : "Totalsumman räknas automatiskt"}</span></div>
    </form>`;
  panel.scrollIntoView({behavior:"smooth",block:"start"});
  panel.querySelector(".grocery-collector-close").addEventListener("click", () => { panel.hidden = true; });
  panel.querySelector("#grocery-price-form").addEventListener("submit", event => {
    event.preventDefault();
    const fields = [...event.currentTarget.querySelectorAll("input[type=number]")];
    const itemPrices = Object.fromEntries(fields.map((field,index)=>[index,Number(field.value)]));
    const total = Object.values(itemPrices).reduce((sum,value)=>sum+value,0);
    const report = { municipality:groceryMunicipality,basketId:basket.id,basketName:basket.name,store:storeName,itemCount:fields.length,items:itemPrices,total:Number(total.toFixed(2)),checkedAt:new Date().toISOString(),source:"Manuellt kontrollerade hyllpriser" };
    localStorage.setItem(priceStorageKey(storeName),JSON.stringify(report));
    renderStores(basket);
    openPriceCollector(storeName,basket);
  });
  panel.querySelector("#grocery-copy-report").addEventListener("click", async () => {
    const report = localPriceReport(storeName);
    if (!report) return;
    const itemRows = basket.items.map((item,index)=>({name:item.name,quantity:item.quantity,cost:report.items[index]}));
    const exportText = JSON.stringify({...report,itemRows},null,2);
    try {
      await navigator.clipboard.writeText(exportText);
      panel.querySelector("#grocery-form-total").textContent = "Prisrapporten är kopierad – skicka den till DinPuls för publicering.";
    } catch {
      panel.querySelector("#grocery-form-total").textContent = "Kopiering blockerades. Försök igen i en vanlig webbläsare.";
    }
  });
}

function renderAds() {
  document.querySelector("#grocery-ads").innerHTML = `<span class="section-kicker">Lokala annonser</span><h2>Nå kunder inför veckohandlingen</h2>${Array.from({length:4},(_,index)=>`<a class="secondary-ad" href="mailto:annonser@dinpuls.se?subject=Annonsplats%20matkasse%20${index+1}"><b>ANNONSPLATS ${index+1}</b><strong>Ditt företag här</strong><small>På DinPuls matkassesida · 500 kr/mån</small></a>`).join("")}<p class="ad-sales-note">Annonsplatserna kan säljas separat per kommun och kategori.</p>`;
}

initializeGrocery().catch(error => { console.error(error); document.querySelector("#grocery-basket-summary").innerHTML = "<strong>Matkassen kunde inte laddas. Försök igen om en liten stund.</strong>"; });
