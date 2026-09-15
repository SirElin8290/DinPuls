const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const cart = new Map();
let apiBase = "", slots = [];
const token = () => sessionStorage.getItem("dp-company-session") || "";

function endDate(start) {
  const date = new Date(`${start}T12:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function renderCart() {
  const billingType = document.querySelector('input[name="billing"]:checked').value;
  const unit = billingType === "annual" ? 5000 : 500;
  $("#buyCart").innerHTML = cart.size ? [...cart.values()].map(item => `<div class="cart-line"><span><strong>${escapeHtml(item.displayLabel)}</strong><br><small>${escapeHtml(item.startDate)} – ${escapeHtml(item.endDate)} · ${escapeHtml(item.id)}</small></span><button type="button" data-remove="${escapeHtml(item.municipality)}|${escapeHtml(item.id)}">Ta bort</button></div>`).join("") : "<p>Varukorgen är tom.</p>";
  const net = cart.size * unit, vat = Math.round(net * 0.25);
  $("#buyTotals").innerHTML = `<p><strong>${cart.size} plats(er)</strong> · ${unit.toLocaleString("sv-SE")} kr/plats ${billingType === "annual" ? "per 12 månader" : "per månad"} exkl. moms</p><p>Pris exkl. moms: ${net.toLocaleString("sv-SE")} kr · Moms 25 %: ${vat.toLocaleString("sv-SE")} kr · <strong>Totalt: ${(net + vat).toLocaleString("sv-SE")} kr</strong></p>`;
  document.querySelectorAll("[data-remove]").forEach(button => button.onclick = () => { cart.delete(button.dataset.remove); renderCart(); });
}

function preview(slot) {
  $("#placementTitle").textContent = slot.displayLabel;
  const labels = slot.page === "index.html" ? ["Övre annonsblocket", "Mellersta annonsblocket", "Nedre annonsblocket"] : [slot.blockLabel];
  $("#placementDiagram").innerHTML = `<div class="placement-preview"><strong>${escapeHtml(slot.page === "index.html" ? "Startsidan" : slot.module)}</strong><div class="placement-block"><b>Sidhuvud och introduktion</b></div>${labels.map(label => `<div class="placement-block ${label === slot.blockLabel ? "placement-highlight" : ""}"><b>${escapeHtml(label)}</b><span>${label === slot.blockLabel ? `Markerad annonsplats ${slot.withinBlock} av ${slot.blockCount}` : "Annat annonsblock"}</span></div>`).join("")}<div class="placement-block"><b>Övrigt sidinnehåll</b></div></div>`;
  $("#placementDetails").textContent = `${slot.location}. Internt plats-ID: ${slot.id}. Illustrationen visar ungefärligt läge och block; den är inte en exakt skärmbild.`;
  $("#placementDialog").showModal();
}

function renderSlots() {
  $("#slotResults").innerHTML = slots.map((slot, index) => `<article class="slot-card"><small>${escapeHtml(slot.municipality)} · ${escapeHtml(slot.module)}</small><h3>${escapeHtml(slot.displayLabel)}</h3><p>${escapeHtml(slot.location)}</p><div class="slot-actions"><button type="button" data-preview="${index}">Visa placering</button><button type="button" data-add="${index}">Lägg till</button></div><small>Plats-ID: ${escapeHtml(slot.id)}</small></article>`).join("");
  document.querySelectorAll("[data-preview]").forEach(button => button.onclick = () => preview(slots[Number(button.dataset.preview)]));
  document.querySelectorAll("[data-add]").forEach(button => button.onclick = () => {
    const slot = slots[Number(button.dataset.add)];
    cart.set(`${slot.municipality}|${slot.id}`, slot); renderCart();
  });
}

async function findSlots() {
  const municipality = $("#buyMunicipality").value, start = $("#buyStart").value;
  if (!start) return void ($("#slotMessage").textContent = "Välj startdatum.");
  $("#slotMessage").textContent = "Kontrollerar lediga platser…";
  try {
    const query = new URLSearchParams({ municipality, startDate: start, endDate: endDate(start) });
    const response = await fetch(`${apiBase}/portal/company/available-slots?${query}`, { headers: { Authorization: `Bearer ${token()}` }, cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Platserna kunde inte hämtas.");
    slots = payload.slots.map(slot => ({ ...slot, startDate: start, endDate: endDate(start) }));
    $("#slotMessage").textContent = `${slots.length} lediga platser. Ledigheten kontrolleras på nytt när ett bindande köp senare blir möjligt.`;
    renderSlots();
  } catch (error) { slots = []; renderSlots(); $("#slotMessage").textContent = error.message; }
}

try {
  const config = await fetch("../data/business-config.json", { cache: "no-store" }).then(response => response.json());
  apiBase = String(config.apiBase || "").replace(/\/$/, "");
  if (!token()) throw new Error("Logga in i företagsportalen först.");
  const health = await fetch(`${apiBase}/health`, { cache: "no-store" }).then(response => response.json());
  if (!health.selfServicePurchaseEnabled) throw new Error("Annonsköp öppnar när avtals- och signeringsflödet är färdigt.");
  const data = await fetch("../data/municipalities.json", { cache: "no-store" }).then(response => response.json());
  $("#buyMunicipality").replaceChildren(...data.municipalities.map(item => new Option(item.name, item.name)));
  $("#buyStart").value = new Date().toISOString().slice(0, 10);
  $("#buyStatus").hidden = true; $("#buyApp").hidden = false;
  renderCart();
  $("#findSlots").onclick = findSlots;
  document.querySelectorAll('input[name="billing"]').forEach(input => input.onchange = renderCart);
  $("#closePlacement").onclick = () => $("#placementDialog").close();
} catch (error) { $("#buyStatus").textContent = error.message; }
