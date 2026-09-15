const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const cart = new Map();
let apiBase = "", slots = [];
let preparedOrder = null;
let hasFoundation = false, signatureDrawn = false;
let fixedSignatureImageUrl = null;
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
  $("#prepareOrder").disabled = cart.size === 0;
  document.querySelectorAll("[data-remove]").forEach(button => button.onclick = () => { cart.delete(button.dataset.remove); renderCart(); });
}

async function displayOrder(data) {
  preparedOrder = data;
  const snapshot = data.snapshot;
  const foundation = !hasFoundation;
  const lines = snapshot.placements.map(line => `<li><strong>${escapeHtml(line.placementLabel || line.location)}</strong><br>${escapeHtml(line.startDate)} – ${escapeHtml(line.endDate)} · Plats-ID ${escapeHtml(line.slotId)} · ${escapeHtml(snapshot.billingType || snapshot.billing.cadence) === "monthly" ? "Månadsvis" : "Årsvis"}</li>`).join("");
  const net = foundation ? snapshot.billing.invoiceTotal : snapshot.totals.perInvoiceExVat;
  const vat = foundation ? snapshot.billing.invoiceVat : snapshot.totals.perInvoiceVat;
  const total = foundation ? snapshot.billing.invoiceInclVat : snapshot.totals.perInvoiceInclVat;
  const yearly = foundation ? snapshot.billing.annualTotal : snapshot.totals.twelveMonthsExVat;
  $("#orderTitle").textContent = foundation ? "Granska och signera grundavtalet" : "Granska och bekräfta tilläggsköpet";
  $("#foundationSignature").hidden = !foundation;
  if (fixedSignatureImageUrl) { URL.revokeObjectURL(fixedSignatureImageUrl); fixedSignatureImageUrl = null; }
  $("#dinpulsFixedSignature").hidden = true;
  if (foundation && snapshot.dinpulsFixedSignature?.mode === "preapproved-fixed") {
    const imageResponse = await fetch(`${apiBase}/portal/company/foundation/orders/${encodeURIComponent(data.orderId)}/dinpuls-signature`, { headers: { Authorization: `Bearer ${token()}` }, cache: "no-store" });
    if (!imageResponse.ok) throw new Error("DinPuls privata fasta signatur kunde inte verifieras för detta avtal.");
    fixedSignatureImageUrl = URL.createObjectURL(await imageResponse.blob());
    $("#dinpulsSignaturePreview").src = fixedSignatureImageUrl;
    $("#dinpulsFixedSignature").hidden = false;
  }
  $("#confirmOrder").textContent = foundation ? "Signera grundavtal" : "Bekräfta tilläggsköp";
  if (foundation) clearSignature();
  $("#orderSummary").innerHTML = `<p><strong>${escapeHtml(snapshot.company.name)}</strong> · Org.nr ${escapeHtml(snapshot.company.orgNo)}<br>${escapeHtml(snapshot.company.address)}, ${escapeHtml(snapshot.company.postalCode)} ${escapeHtml(snapshot.company.city)}<br>${escapeHtml(snapshot.company.contact)} · ${escapeHtml(snapshot.company.email)} · ${escapeHtml(snapshot.company.phone)}</p><p>${foundation ? `Avtal ${escapeHtml(data.contractId)}` : `Grundavtal ${escapeHtml(snapshot.foundationContractId)}`} · version ${escapeHtml(snapshot.contractVersion)}</p><ul>${lines}</ul><p>Per debitering: ${net.toLocaleString("sv-SE")} kr exkl. moms + ${vat.toLocaleString("sv-SE")} kr moms = <strong>${total.toLocaleString("sv-SE")} kr</strong>. Totalt över 12 månader: ${yearly.toLocaleString("sv-SE")} kr exkl. moms.</p><p>Reservationen gäller till ${escapeHtml(new Date(data.expiresAt).toLocaleString("sv-SE"))}.</p>`;
  $("#orderTerms").innerHTML = snapshot.terms.map(term => `<section><h4>${escapeHtml(term.title)}</h4>${term.paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join("")}</section>`).join("");
  $("#confirmTerms").checked = false; $("#confirmOrder").disabled = true;
  $("#confirmationMessage").textContent = "";
  $("#orderDialog").showModal();
}

async function prepareOrder() {
  $("#orderMessage").textContent = "Reserverar och kontrollerar platserna…";
  $("#prepareOrder").disabled = true;
  try {
    const placements = [...cart.values()].map(item => ({ municipality: item.municipality, slotId: item.id, startDate: item.startDate, endDate: item.endDate }));
    const billingType = $('input[name="billing"]:checked').value;
    if (!hasFoundation && new Set(placements.map(item => `${item.startDate}|${item.endDate}`)).size !== 1) throw new Error("Det första grundavtalet behöver samma startdatum för alla platser. Justera urvalet och försök igen.");
    const path = hasFoundation ? "/portal/company/orders" : "/portal/company/foundation/orders";
    const response = await fetch(`${apiBase}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ placements, billingType }), cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Beställningen kunde inte reserveras.");
    await displayOrder(data);
    $("#orderMessage").textContent = "Platserna är reserverade i 20 minuter. Granska hela beställningen före bekräftelse.";
  } catch (error) { $("#orderMessage").textContent = error.message; }
  finally { $("#prepareOrder").disabled = cart.size === 0; }
}

async function confirmOrder() {
  if (!preparedOrder || !$("#confirmTerms").checked) return;
  $("#confirmOrder").disabled = true; $("#confirmationMessage").textContent = "Låser beställningen…";
  try {
    if (!hasFoundation && (!signatureDrawn || !$("#signerName").value.trim() || !$("#signerTitle").value.trim())) throw new Error("Ange ditt namn och din roll och rita din underskrift.");
    const foundation = !hasFoundation;
    const path = foundation ? `/portal/company/foundation/orders/${preparedOrder.orderId}/sign` : `/portal/company/orders/${preparedOrder.orderId}/confirm`;
    const body = foundation ? { explicitConfirmation: true, snapshotHash: preparedOrder.snapshotHash, customerSignerName: $("#signerName").value.trim(), customerSignerTitle: $("#signerTitle").value.trim(), customerSignature: $("#signaturePad").toDataURL("image/png") } : { explicitConfirmation: true, snapshotHash: preparedOrder.snapshotHash };
    const response = await fetch(`${apiBase}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Beställningen kunde inte slutföras.");
    $("#confirmationMessage").innerHTML = foundation ? (data.status === "Aktivt" ? `Grundavtal ${escapeHtml(data.contractId)} är låst med kundens underskrift och SirElin AB:s förhandsgodkända signatur. ${escapeHtml(data.purchaseCount)} plats(er) är registrerade. <a href="./">Se dina köp och avtalskopian i portalen</a>.` : `Din underskrift är låst i avtal ${escapeHtml(data.contractId)}. DinPuls behöver underteckna separat innan avtalet blir bindande. Du får tillgång till avtalskopian i portalen efter båda underskrifterna.`) : `Beställning ${escapeHtml(data.orderId)} är registrerad. ${escapeHtml(data.purchaseCount)} annonsplats(er) väntar på lansering och fakturering. <a href="./">Se dina köp i företagsportalen</a>.`;
    cart.clear(); renderCart(); preparedOrder = null;
  } catch (error) { $("#confirmationMessage").textContent = error.message; $("#confirmOrder").disabled = false; }
}

function clearSignature() {
  const canvas = $("#signaturePad"), context = canvas.getContext("2d");
  context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#17364d"; context.lineWidth = 2.5; context.lineCap = "round";
  signatureDrawn = false;
}

function enableSignature() {
  const canvas = $("#signaturePad"), context = canvas.getContext("2d");
  let drawing = false;
  const point = event => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; };
  canvas.onpointerdown = event => { canvas.setPointerCapture(event.pointerId); drawing = true; const p = point(event); context.beginPath(); context.moveTo(p.x, p.y); };
  canvas.onpointermove = event => { if (!drawing) return; const p = point(event); context.lineTo(p.x, p.y); context.stroke(); signatureDrawn = true; };
  canvas.onpointerup = () => { drawing = false; };
  canvas.onpointercancel = () => { drawing = false; };
  $("#clearSignature").onclick = clearSignature;
  clearSignature();
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
    $("#slotMessage").textContent = `${slots.length} lediga platser. Slutlig tillgänglighet kontrolleras när beställningen reserveras.`;
    renderSlots();
  } catch (error) { slots = []; renderSlots(); $("#slotMessage").textContent = error.message; }
}

try {
  const config = await fetch("../data/business-config.json", { cache: "no-store" }).then(response => response.json());
  apiBase = String(config.apiBase || "").replace(/\/$/, "");
  if (!token()) throw new Error("Logga in i företagsportalen först.");
  const health = await fetch(`${apiBase}/health`, { cache: "no-store" }).then(response => response.json());
  if (!health.selfServicePurchaseEnabled) throw new Error("Annonsköp öppnar när avtals- och signeringsflödet är färdigt.");
  const meResponse = await fetch(`${apiBase}/portal/company/me`, { headers: { Authorization: `Bearer ${token()}` }, cache: "no-store" });
  if (!meResponse.ok) throw new Error("Logga in i företagsportalen på nytt.");
  const me = await meResponse.json();
  hasFoundation = Boolean(me.contract?.signedAt);
  const data = await fetch("../data/municipalities.json", { cache: "no-store" }).then(response => response.json());
  $("#buyMunicipality").replaceChildren(...data.municipalities.map(item => new Option(item.name, item.name)));
  $("#buyStart").value = new Date().toISOString().slice(0, 10);
  $("#buyStatus").hidden = true; $("#buyApp").hidden = false;
  renderCart();
  $("#findSlots").onclick = findSlots;
  document.querySelectorAll('input[name="billing"]').forEach(input => input.onchange = renderCart);
  $("#closePlacement").onclick = () => $("#placementDialog").close();
  $("#prepareOrder").onclick = prepareOrder;
  $("#closeOrder").onclick = () => { $("#orderDialog").close(); if (fixedSignatureImageUrl) { URL.revokeObjectURL(fixedSignatureImageUrl); fixedSignatureImageUrl = null; } };
  $("#confirmTerms").onchange = () => $("#confirmOrder").disabled = !$("#confirmTerms").checked;
  $("#confirmOrder").onclick = confirmOrder;
  enableSignature();
  if (!hasFoundation) {
    const currentResponse = await fetch(`${apiBase}/portal/company/foundation/current`, { headers: { Authorization: `Bearer ${token()}` }, cache: "no-store" });
    if (currentResponse.ok) {
      const current = await currentResponse.json();
      if (current.order?.status === "held") {
        $("#orderMessage").textContent = `Du har ett reserverat avtalsutkast till ${new Date(current.order.expiresAt).toLocaleString("sv-SE")}. Fortsätt det innan du väljer nya platser.`;
        $("#resumeFoundation").hidden = false;
        $("#resumeFoundation").onclick = () => displayOrder(current.order);
      } else if (current.order?.status === "customer_signed") {
        $("#buyApp").hidden = true; $("#buyStatus").hidden = false;
        $("#buyStatus").textContent = `Ditt avtal ${current.order.contractId} är undertecknat av dig och väntar på DinPuls separata underskrift. Det blir bindande först efter båda underskrifterna.`;
      }
    }
  }
} catch (error) { $("#buyStatus").textContent = error.message; }
