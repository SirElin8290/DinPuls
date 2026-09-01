(function () {
  "use strict";

  const CONTRACT_VERSION = "4.0";
  const TOKEN_KEY = "dp-admin-session";
  const AD_SLOTS = window.DINPULS_AD_INVENTORY || [];
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  let municipalities = [];
  let contractCache = [];
  let apiBase = "";

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  function token() { return sessionStorage.getItem(TOKEN_KEY) || ""; }
  function money(value) { return `${Number(value || 0).toLocaleString("sv-SE")} kr`; }
  function slotById(id) { return AD_SLOTS.find(slot => slot.id === id); }

  async function api(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const response = await fetch(`${apiBase}${path}`, { ...options, headers, cache: "no-store" });
    const data = await response.json().catch(() => ({ ok: false, error: "Servern gav ett ogiltigt svar." }));
    if (response.status === 401 && path !== "/portal/auth/admin") {
      sessionStorage.removeItem(TOKEN_KEY);
      showLogin();
    }
    if (!response.ok) throw new Error(data.error || "Begäran misslyckades.");
    return data;
  }

  async function loadConfiguration() {
    const [businessResponse, municipalityResponse] = await Promise.all([
      fetch("../data/business-config.json", { cache: "no-store" }),
      fetch("../data/municipalities.json", { cache: "no-store" })
    ]);
    if (!businessResponse.ok || !municipalityResponse.ok) throw new Error("Portalens konfiguration kunde inte läsas.");
    const business = await businessResponse.json();
    const municipalityData = await municipalityResponse.json();
    if (!business.enabled || !business.apiBase) throw new Error("Den säkra portalservern är inte aktiverad.");
    apiBase = business.apiBase.replace(/\/$/, "");
    municipalities = (municipalityData.municipalities || []).map(item => item.name).filter(Boolean).sort((a, b) => a.localeCompare(b, "sv"));
    if (!municipalities.length) throw new Error("Kommunregistret är tomt.");
    municipalities.forEach(name => {
      $("#municipality").add(new Option(name, name));
      $("#inventoryMunicipality").add(new Option(name, name));
    });
  }

  function showLogin(message = "") {
    $("#loginView").hidden = false;
    $("#appView").hidden = true;
    if (message) { $("#loginError").textContent = message; $("#loginError").hidden = false; }
  }

  async function showApp() {
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
    scrollTo(0, 0);
    await Promise.all([refreshContracts(), refreshSystemStatus()]);
  }

  function installSystemStatus() {
    const panel = document.querySelector(".status-panel");
    if (!panel) return;
    panel.innerHTML = `<div class="panel-heading"><div><h2>Systemstatus</h2><p>Kommersiell infrastruktur för företagskunder.</p></div><button id="refreshSystemStatus" class="text-button" type="button">Kontrollera igen</button></div><div id="systemStatus" class="status-list" aria-live="polite"><p class="muted">Kontrollerar systemet…</p></div>`;
    $("#refreshSystemStatus").onclick = refreshSystemStatus;
  }

  async function refreshSystemStatus() {
    const target = $("#systemStatus");
    if (!target || !apiBase) return;
    target.innerHTML = '<p class="muted">Kontrollerar systemet…</p>';
    try {
      const response = await fetch(`${apiBase}/health`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const health = await response.json();
      const checks = [
        ["Portalserver", health.ok === true, "Aktiv", "Fel"],
        ["Databas", health.database === "connected", "Ansluten", "Fel"],
        ["Admin/företagsauth", health.portalConfigured === true, "Konfigurerad", "Saknas"],
        ["Företagsmejl", health.portalEmailConfigured === true, "Konfigurerat", "Saknas"],
        ["Bannerlagring/R2", health.adAssetsConfigured === true, "Konfigurerad", "Saknas"]
      ];
      target.innerHTML = checks.map(([label, ready, yes, no]) => `<div><span class="check" style="${ready ? "" : "background:var(--danger)"}" aria-hidden="true">${ready ? "✓" : "!"}</span><p><b>${escapeHtml(label)}</b><small>${ready ? yes : no}</small></p></div>`).join("");
    } catch {
      target.innerHTML = '<div><span class="check" style="background:var(--danger)" aria-hidden="true">!</span><p><b>Portalserver</b><small>Fel – kunde inte nås</small></p></div>';
    }
  }

  function contractNumber() {
    const year = new Date().getFullYear();
    const numbers = contractCache.map(contract => String(contract.id || "")).filter(id => id.startsWith(`DP-${year}-`)).map(id => Number(id.split("-").pop()) || 0);
    return `DP-${year}-${String(Math.max(0, ...numbers) + 1).padStart(4, "0")}`;
  }

  function endDateFrom(start) {
    if (!start) return "";
    const date = new Date(`${start}T12:00:00`);
    date.setFullYear(date.getFullYear() + 1);
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  }

  function occupiedMap() {
    const map = new Map();
    contractCache.filter(contract => contract.status === "Aktivt").forEach(contract => (contract.placements || []).forEach(placement => {
      if (slotById(placement.slotId)) map.set(`${contract.municipality}|${placement.slotId}`, contract);
    }));
    return map;
  }

  function availableSlots(municipality, excludedRows = []) {
    const occupied = occupiedMap();
    const selected = new Set(excludedRows.map(row => row.querySelector(".slot")?.value).filter(Boolean));
    return AD_SLOTS.filter(slot => !occupied.has(`${municipality}|${slot.id}`) && !selected.has(slot.id));
  }

  async function refreshContracts() {
    const data = await api("/portal/admin/contracts");
    contractCache = data.contracts || [];
    render();
  }

  function statusActions(contract) {
    if (contract.contractVersion === "4.0" && contract.status === "Utkast") return `<span class="badge draft">Väntar på båda underskrifterna</span>`;
    if (contract.status === "Utkast" && !contract.signatureRequired) return `<button class="primary contract-action" data-id="${escapeHtml(contract.id)}" data-status="Aktivt">Aktivera utan signatur</button>`;
    if (contract.status === "Utkast") return `<button class="secondary contract-action" data-id="${escapeHtml(contract.id)}" data-status="Skickat">Markera skickat</button>`;
    if (contract.status === "Skickat") return `<button class="primary contract-action" data-id="${escapeHtml(contract.id)}" data-status="Aktivt">Markera signerat</button>`;
    if (contract.status === "Aktivt") return `<button class="secondary invoice-copy-action" data-id="${escapeHtml(contract.id)}">Kopiera fakturaunderlag</button>${contract.hasSignedPdf ? `<button class="secondary pdf-action" data-id="${escapeHtml(contract.id)}">Hämta signerad PDF</button><button class="secondary contract-email-action" data-id="${escapeHtml(contract.id)}">Skicka avtalskopia igen</button>` : ""}${!contract.activatedAt ? `<button class="primary activation-action" data-id="${escapeHtml(contract.id)}">Skicka ny aktiveringslänk</button>` : ""}<button class="secondary contract-action" data-id="${escapeHtml(contract.id)}" data-status="Avslutat">Avsluta</button>`;
    return "";
  }

  function render() {
    const active = contractCache.filter(contract => contract.status === "Aktivt");
    const drafts = contractCache.filter(contract => contract.status === "Utkast");
    const mrr = active.reduce((sum, contract) => sum + Number(contract.monthlyTotal || 0), 0);
    $("#activeContracts").textContent = active.length;
    $("#mrr").textContent = money(mrr);
    $("#arr").textContent = money(active.reduce((sum, contract) => sum + Number(contract.annualTotal || 0), 0));
    $("#drafts").textContent = drafts.length;
    $("#contractList").innerHTML = contractCache.length ? `<div class="contract-row"><strong>Avtal</strong><strong>Företag</strong><strong>Kommun / plats</strong><strong>Status</strong></div>${contractCache.map(contract => `
      <div class="contract-row contract-click" data-contract="${escapeHtml(contract.id)}">
        <span><b>${escapeHtml(contract.id)}</b><small>v${escapeHtml(contract.contractVersion)}</small></span>
        <span><b>${escapeHtml(contract.company)}</b><small>${escapeHtml(contract.contact)}</small></span>
        <span>${escapeHtml(contract.municipality)} · ${(contract.placements || []).map(item => escapeHtml(item.slotId)).join(", ")}<small>${escapeHtml(contract.startDate)} – ${escapeHtml(contract.endDate)}</small></span>
        <span><span class="badge ${contract.status === "Utkast" ? "draft" : ""}">${escapeHtml(contract.status)}</span></span>
      </div>`).join("")}` : '<div class="empty-state">Inga avtal ännu.</div>';
    $("#recentContracts").innerHTML = contractCache.length ? contractCache.slice(0, 5).map(contract => `<div class="recent-row"><span><b>${escapeHtml(contract.company)}</b><small>${escapeHtml(contract.municipality)}</small></span><span class="badge">${escapeHtml(contract.status)}</span><small>${new Date(contract.created).toLocaleDateString("sv-SE")}</small></div>`).join("") : '<div class="empty-state">När du skapar avtal visas de senaste här.</div>';
    renderCompanies();
    renderInventory();
    $$('[data-contract]').forEach(row => row.onclick = () => openContract(row.dataset.contract));
  }

  async function changeStatus(id, status) {
    const result = await api(`/portal/admin/contracts/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await refreshContracts();
    if (status === "Aktivt" && result.onboarding === "sent") alert("Avtalet är aktivt och välkomstmejlet har skickats.");
    if (status === "Aktivt" && result.onboarding === "email-not-configured") alert("Avtalet är aktivt, men mejlet kunde inte skickas. Kontrollera e-postinställningarna och välj sedan Skicka ny aktiveringslänk.");
  }

  async function resendActivation(id) {
    const result = await api(`/portal/admin/contracts/${encodeURIComponent(id)}/activation`, { method: "POST" });
    await refreshContracts();
    alert(result.message || "En ny aktiveringslänk har skickats.");
  }

  async function resendContractCopy(id) {
  const result = await api(`/portal/admin/contracts/${encodeURIComponent(id)}/email`, { method: "POST" });
  await refreshContracts();
  alert(result.message || "Den signerade avtalskopian har skickats igen.");
}

function openContract(id) {
    const contract = contractCache.find(item => item.id === id);
    if (!contract) return;
    let dialog = $("#contractDialog");
    if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "contractDialog"; dialog.className = "company-dialog"; document.body.append(dialog); }
    const billingLabel = contract.billingType === "complimentary" ? "Kostnadsfri" : contract.billingType === "annual" ? "Årsvis i förskott" : "Månadsvis";
    const renewalLabel = contract.renewalType === "annual-review" ? "Årlig förnyelseprövning" : "Ingen uppföljning";
    dialog.innerHTML = `<button class="dialog-x" type="button">×</button><span class="eyebrow">ANNONSAVTAL v${escapeHtml(contract.contractVersion)}</span><h2>${escapeHtml(contract.company)}</h2><p class="muted">${escapeHtml(contract.id)} · ${escapeHtml(contract.status)}</p><div class="contact-details"><div><small>Kommun</small><strong>${escapeHtml(contract.municipality)}</strong></div><div><small>Period</small><strong>${escapeHtml(contract.startDate)} – ${escapeHtml(contract.endDate)}</strong></div><div><small>Månadspris</small><strong>${money(contract.monthlyTotal)}</strong></div><div><small>Avtalsvärde</small><strong>${money(contract.annualTotal)}</strong></div><div><small>Debitering</small><strong>${billingLabel}</strong></div><div><small>Signering</small><strong>${contract.signedAt ? escapeHtml(new Date(contract.signedAt).toLocaleString("sv-SE")) : "Ej slutförd"}</strong></div><div><small>Kund</small><strong>${escapeHtml(contract.customerSignerName || "–")}<br>${escapeHtml(contract.customerSignerTitle || "")}</strong></div><div><small>DinPuls</small><strong>${escapeHtml(contract.dinpulsSignerName || "–")}<br>${escapeHtml(contract.dinpulsSignerTitle || "")}</strong></div><div><small>PDF/mejl</small><strong>${contract.hasSignedPdf ? "Arkiverad" : "Saknas"} · ${escapeHtml(contract.contractEmailStatus || "ej skickat")}</strong></div></div>${contract.valueNote ? `<p><b>Avtalsnotering:</b> ${escapeHtml(contract.valueNote)}</p>` : ""}<h3>Annonsplatser</h3><p>${(contract.placements || []).map(item => `<b>${escapeHtml(item.slotId)}</b> – ${escapeHtml(item.location)}`).join("<br>")}</p><div class="actions">${statusActions(contract)}</div>`;
    dialog.querySelector(".dialog-x").onclick = () => dialog.close();
    dialog.querySelectorAll(".contract-action").forEach(button => button.onclick = async () => { await changeStatus(button.dataset.id, button.dataset.status); dialog.close(); });
    dialog.querySelectorAll(".activation-action").forEach(button => button.onclick = async () => { await resendActivation(button.dataset.id); dialog.close(); });
    dialog.querySelectorAll(".contract-email-action").forEach(button => button.onclick = async () => { await resendContractCopy(button.dataset.id); dialog.close(); });
    dialog.querySelectorAll(".invoice-copy-action").forEach(button => button.onclick = async () => { try { await copyInvoiceBasis(button.dataset.id); } catch { alert("Fakturaunderlaget kunde inte kopieras. Kontrollera webbläsarens urklippsbehörighet."); } });
  dialog.querySelectorAll(".pdf-action").forEach(button => button.onclick = () => downloadPdf(button.dataset.id));
    dialog.showModal();
  }

  async function copyInvoiceBasis(id) {
    const contract = contractCache.find(item => item.id === id);
    if (!contract) return;
    const { formatInvoiceBasis } = await import("./invoice-copy.mjs");
    await navigator.clipboard.writeText(formatInvoiceBasis(contract));
    alert("Fakturaunderlaget är kopierat och kan klistras in i Spiris.");
  }

  function renderCompanies() {
    const map = new Map();
    contractCache.filter(contract => contract.status === "Aktivt").forEach(contract => { const key = contract.orgNo || contract.email; if (!map.has(key)) map.set(key, contract); });
    const companies = [...map.values()].sort((a, b) => a.company.localeCompare(b.company, "sv"));
    $("#companyList").innerHTML = companies.length ? companies.map((company, index) => `<button type="button" class="company-row" data-company-index="${index}"><span><b>${escapeHtml(company.company)}</b><small>${escapeHtml(company.orgNo)}</small></span><span>${escapeHtml(company.municipality)}</span><span>${escapeHtml(company.contact)}</span><span class="company-arrow">→</span></button>`).join("") : '<div class="company-empty"><span>◉</span><h3>Inga aktiva företag ännu</h3><p>När ett avtal får status <b>Aktivt</b> visas företaget automatiskt här.</p></div>';
    $$('[data-company-index]').forEach(button => button.onclick = () => openCompany(companies[Number(button.dataset.companyIndex)]));
  }

  function openCompany(company) {
    $("#companyDialogName").textContent = company.company;
    $("#companyDialogOrg").textContent = `Organisationsnummer ${company.orgNo}`;
    $("#companyDialogContact").textContent = company.contact;
    $("#companyDialogPhone").textContent = company.phone;
    $("#companyDialogPhone").href = `tel:${company.phone.replace(/\s/g, "")}`;
    $("#companyDialogEmail").textContent = company.email;
    $("#companyDialogEmail").href = `mailto:${company.email}`;
    $("#companyDialogMunicipality").textContent = company.municipality;
    $("#companyDialog").showModal();
  }

  function renderInventory() {
    const municipality = $("#inventoryMunicipality").value || municipalities[0];
    const occupied = occupiedMap();
    let occupiedCount = 0;
    $("#inventoryList").innerHTML = AD_SLOTS.map(slot => {
      const contract = occupied.get(`${municipality}|${slot.id}`);
      if (contract) occupiedCount++;
      return `<div class="inventory-row"><b>${escapeHtml(slot.id)}</b><span><b>${escapeHtml(slot.label)}</b><small>${escapeHtml(slot.page)}</small></span><small>${escapeHtml(slot.location)}</small><span class="badge ${contract ? "occupied" : "free"}">${contract ? "Upptagen" : "Ledig"}</span><span>${contract ? escapeHtml(contract.company) : "–"}</span></div>`;
    }).join("");
    $("#inventoryTotal").textContent = AD_SLOTS.length;
    $("#inventoryFree").textContent = AD_SLOTS.length - occupiedCount;
    $("#inventoryOccupied").textContent = occupiedCount;
  }

  function refreshPlacementOptions() {
    const municipality = $("#municipality").value;
    $$(".placement").forEach(row => {
      const select = row.querySelector(".slot");
      const current = select.value;
      const choices = availableSlots(municipality, $$(".placement").filter(item => item !== row));
      select.innerHTML = choices.map(slot => `<option value="${escapeHtml(slot.id)}">${escapeHtml(slot.id)} · ${escapeHtml(slot.label)}</option>`).join("");
      if (choices.some(slot => slot.id === current)) select.value = current;
    });
  }

  function addPlacement() {
    const choices = availableSlots($("#municipality").value, $$(".placement"));
    if (!choices.length) return alert("Det finns inga fler lediga annonsplatser i vald kommun.");
    const row = document.createElement("div");
    row.className = "placement";
    row.innerHTML = `<label>Annonsplats<select class="slot">${choices.map(slot => `<option value="${escapeHtml(slot.id)}">${escapeHtml(slot.id)} · ${escapeHtml(slot.label)}</option>`).join("")}</select></label><label>Placering<input class="slot-location" value="${escapeHtml(choices[0].location)}" disabled></label><button type="button" class="secondary">Ta bort</button>`;
    const select = row.querySelector(".slot");
    select.onchange = () => { row.querySelector(".slot-location").value = slotById(select.value)?.location || ""; refreshPlacementOptions(); };
    row.querySelector("button").onclick = () => { row.remove(); refreshPlacementOptions(); };
    $("#placements").append(row);
    refreshPlacementOptions();
  }

  function openView(id) {
    $$(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.view === id));
    $$(".view").forEach(view => view.hidden = view.id !== id);
    if (id === "inventory") renderInventory();
    scrollTo(0, 0);
  }

  function openNewContract() {
    openView("contracts");
    $("#contractForm").hidden = false;
    $("#contractForm").reset();
    $("#placements").innerHTML = "";
    const today = new Date().toISOString().slice(0, 10);
    $("#startDate").value = today;
    $("#endDate").value = endDateFrom(today);
    addPlacement();
  }

  function installContractTermsFields() {
    const grid = $("#contractForm .grid2");
    if (!grid || grid.querySelector('[name="billingType"]')) return;
    grid.insertAdjacentHTML("beforeend", `<label>Betalningsform<select name="billingType" required><option value="monthly">Månadsvis – 500 kr/plats/månad</option><option value="annual">Årsvis – 5 000 kr/plats/12 månader</option><option value="complimentary">Kostnadsfri</option></select></label><label>Förnyelse<select name="renewalType"><option value="annual-review">Ingen automatisk förnyelse</option><option value="none">Ingen uppföljning</option></select></label><label>Avtalsnotering<input name="valueNote" maxlength="240" placeholder="Eventuella särskilda individuella villkor"></label>`);
  }

  async function downloadPdf(id) {
    const response = await fetch(`${apiBase}/portal/admin/contracts/${encodeURIComponent(id)}/pdf`, { headers: { Authorization: `Bearer ${token()}` } });
    if (!response.ok) return alert((await response.json().catch(() => ({}))).error || "PDF-filen kunde inte hämtas.");
    const link = document.createElement("a"); link.href = URL.createObjectURL(await response.blob()); link.download = `DinPuls-annonsavtal-${id}.pdf`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function submitContract(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    const municipality = form.get("municipality");
    const ids = $$(".placement").map(row => row.querySelector(".slot").value);
    if (!ids.length || new Set(ids).size !== ids.length) return alert("Välj minst en unik annonsplats.");
    const placements = ids.map(id => { const slot = slotById(id); return { slotId: id, module: slot.module, group: slot.group, label: slot.label, location: slot.location, page: slot.page }; });
    const startDate = form.get("startDate");
    const billingType = form.get("billingType");
    const signatures = window.DinPulsContractWizard?.signatures();
    if (!signatures?.valid) return alert("Fyll i namn och befattning och skriv båda underskrifterna.");
    const id = contractNumber();
    const payload = { id, contractVersion: CONTRACT_VERSION, company: form.get("company"), orgNo: form.get("orgNo"), contact: form.get("contact"), email: form.get("email"), phone: form.get("phone"), municipality, placements, billingType, valueNote: form.get("valueNote"), renewalType: form.get("renewalType"), termsReviewed: true, startDate, endDate: endDateFrom(startDate) };
    try {
      const created = await api("/portal/admin/contracts", { method: "POST", body: JSON.stringify(payload) });
      const signed = await api(`/portal/admin/contracts/${encodeURIComponent(id)}/sign`, { method: "POST", body: JSON.stringify({ ...signatures, snapshotHash: created.snapshotHash }) });
      event.target.reset(); $("#placements").innerHTML = ""; $("#contractForm").hidden = true;
      await refreshContracts();
      alert(`Avtalet är signerat, låst och aktiverat. PDF: ${signed.pdfHash.slice(0, 12)}…${signed.emailStatus === "failed" ? "\nAvtalsmejlet kunde inte skickas, men signeringen och PDF-filen är bevarade." : ""}`);
    } catch (error) { alert(error.message); }
  }

  async function init() {
    try { await loadConfiguration(); }
    catch (error) { showLogin(error.message); return; }
    installContractTermsFields();
    installSystemStatus();
    $("#loginForm").onsubmit = async event => {
      event.preventDefault();
      try {
        const data = await api("/portal/auth/admin", { method: "POST", body: JSON.stringify({ username: $("#username").value.trim(), password: $("#password").value }) });
        sessionStorage.setItem(TOKEN_KEY, data.token);
        $("#password").value = "";
        $("#loginError").hidden = true;
        await showApp();
      } catch (error) { showLogin(error.message); }
    };
    $("#logout").onclick = async () => { try { await api("/portal/auth/logout", { method: "POST" }); } catch {} sessionStorage.removeItem(TOKEN_KEY); showLogin(); };
    $$(".tab").forEach(button => button.onclick = () => openView(button.dataset.view));
    $$('[data-open]').forEach(button => button.onclick = () => button.dataset.new ? openNewContract() : openView(button.dataset.open));
    $("#closeCompanyDialog").onclick = () => $("#companyDialog").close();
    $("#inventoryMunicipality").onchange = renderInventory;
    $("#municipality").onchange = () => { $("#placements").innerHTML = ""; addPlacement(); };
    $("#startDate").onchange = () => $("#endDate").value = endDateFrom($("#startDate").value);
    $("#addPlacement").onclick = addPlacement;
    $("#newContract").onclick = openNewContract;
    $("#cancelContract").onclick = () => $("#contractForm").hidden = true;
    $("#contractForm").onsubmit = submitContract;
    if (token()) { try { await showApp(); } catch (error) { showLogin(error.message); } } else showLogin();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
