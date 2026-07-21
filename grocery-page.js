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

function renderStores(basket) {
  const stores = groceryData.municipalities?.[groceryMunicipality]?.stores || [];
  const prices = groceryData.prices?.[groceryMunicipality]?.[basket.id] || {};
  const verifiedTotals = stores.map(store => Number(prices[store.name]?.total)).filter(total => total > 0);
  const lowest = verifiedTotals.length ? Math.min(...verifiedTotals) : null;
  document.querySelector("#grocery-updated").textContent = lowest ? "Verifierade butikpriser" : "Inväntar säker prisdata";
  document.querySelector("#grocery-stores").innerHTML = stores.map(store => {
    const price = prices[store.name] || {};
    const total = Number(price.total);
    const isLowest = total > 0 && total === lowest;
    return `<article class="grocery-store ${isLowest ? "lowest" : ""}"><span class="portal-card-icon grocery"><i data-lucide="store"></i></span><div><h3>${escapeGrocery(store.name)}</h3><p>${total > 0 ? `${basket.items.length} av ${basket.items.length} varor prissatta` : `Välj lokal butik för ${escapeGrocery(groceryMunicipality)}`}</p>${price.checkedAt ? `<small>Kontrollerat ${escapeGrocery(new Date(price.checkedAt).toLocaleDateString("sv-SE"))} · ${escapeGrocery(price.source || "butikens webbplats")}</small>` : `<small>Inget verifierat totalpris ännu</small>`}</div><div class="grocery-store-price">${isLowest ? `<em>Billigast</em>` : ""}<strong>${total > 0 ? `${new Intl.NumberFormat("sv-SE").format(total)} kr` : "Pris saknas"}</strong><a href="${escapeGrocery(store.url)}" target="_blank" rel="noopener noreferrer">Kontrollera hos butiken <i data-lucide="external-link"></i></a></div></article>`;
  }).join("");
}

function renderAds() {
  document.querySelector("#grocery-ads").innerHTML = `<span class="section-kicker">Lokala annonser</span><h2>Nå kunder inför veckohandlingen</h2>${Array.from({length:4},(_,index)=>`<a class="secondary-ad" href="mailto:annonser@dinpuls.se?subject=Annonsplats%20matkasse%20${index+1}"><b>ANNONSPLATS ${index+1}</b><strong>Ditt företag här</strong><small>På DinPuls matkassesida · 500 kr/mån</small></a>`).join("")}<p class="ad-sales-note">Annonsplatserna kan säljas separat per kommun och kategori.</p>`;
}

initializeGrocery().catch(error => { console.error(error); document.querySelector("#grocery-basket-summary").innerHTML = "<strong>Matkassen kunde inte laddas. Försök igen om en liten stund.</strong>"; });
