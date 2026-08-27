(function () {
  "use strict";

  const TOKEN_KEY = "dp-company-session";
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  let apiBase = "";
  let account = null;

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  function token() { return sessionStorage.getItem(TOKEN_KEY) || ""; }

  async function api(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const response = await fetch(`${apiBase}${path}`, { ...options, headers, cache: "no-store" });
    const data = await response.json().catch(() => ({ ok: false, error: "Servern gav ett ogiltigt svar." }));
    if (response.status === 401 && path !== "/portal/auth/company") {
      sessionStorage.removeItem(TOKEN_KEY);
      showLogin();
    }
    if (!response.ok) throw new Error(data.error || "Begäran misslyckades.");
    return data;
  }

  async function loadConfiguration() {
    const response = await fetch("../data/business-config.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Företagsportalens konfiguration kunde inte läsas.");
    const config = await response.json();
    if (!config.enabled || !config.apiBase) throw new Error("Företagsportalen är inte aktiverad.");
    apiBase = config.apiBase.replace(/\/$/, "");
  }

  function showLogin(message = "") {
    $("#appView").hidden = true;
    $("#loginView").hidden = false;
    if (message) { $("#loginError").textContent = message; $("#loginError").hidden = false; }
  }

  async function showApp() {
    account = await api("/portal/company/me");
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
    renderCompany();
  }

  function showView(id) {
    $$(".view").forEach(view => view.hidden = view.id !== id);
    $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === id));
  }

  function monthsLeft(end) {
    if (!end) return 0;
    return Math.max(0, Math.ceil((new Date(`${end}T23:59:59`) - new Date()) / (1000 * 60 * 60 * 24 * 30.44)));
  }

  function renderCompany() {
    const profile = account.profile || {};
    const contract = account.contract;
    const placements = contract?.placements || [];
    $("#accountName").textContent = profile.company || "Företagskonto";
    $("#companyMunicipality").textContent = `⌖ ${profile.municipality || "–"}`;
    $("#contractSummary").innerHTML = contract ? `<p>Avtalsperiod<br><strong>${escapeHtml(contract.startDate)} – ${escapeHtml(contract.endDate)}</strong></p><p>Månader kvar<br><strong class="months">${monthsLeft(contract.endDate)} månader</strong></p><p>Annonsplatser<br><strong>${placements.map(item => escapeHtml(item.slotId)).join(", ") || "–"}</strong></p><p>Avtalspris<br><strong>${Number(contract.monthlyTotal || 0).toLocaleString("sv-SE")} kr / månad exkl. moms</strong></p>` : "<p>Inget aktivt avtal hittades.</p>";
    $("#companyBannerRows").innerHTML = placements.length ? placements.map(placement => `<div class="banner-row"><b>${escapeHtml(placement.slotId)}<br><small>${escapeHtml(placement.location)}</small></b><div class="demo-banner">Din banner</div><span class="status">Avtalad</span><span>–</span><span>–</span><span>–</span><button class="change-banner" data-slot="${escapeHtml(placement.slotId)}">Byt banner</button></div>`).join("") : '<p class="muted">Inga annonsplatser i ett aktivt avtal.</p>';
    $("#bannerSlot").innerHTML = placements.map(placement => `<option value="${escapeHtml(placement.slotId)}">${escapeHtml(placement.slotId)} · ${escapeHtml(placement.location)}</option>`).join("");
    const included = Number(contract?.includedChanges || 0);
    const used = Number(contract?.usedChanges || 0);
    $("#includedChanges").textContent = included;
    $("#usedChanges").textContent = used;
    $("#remainingChanges").textContent = Math.max(0, included - used);
    $("#companyContractDetail").innerHTML = contract ? `<article class="panel"><h3>${monthsLeft(contract.endDate)} månader kvar</h3><dl class="contract-list"><div><dt>Avtalsnummer</dt><dd>${escapeHtml(contract.id)}</dd></div><div><dt>Version</dt><dd>${escapeHtml(contract.contractVersion)}</dd></div><div><dt>Startdatum</dt><dd>${escapeHtml(contract.startDate)}</dd></div><div><dt>Slutdatum</dt><dd>${escapeHtml(contract.endDate)}</dd></div><div><dt>Annonsplatser</dt><dd>${placements.length}</dd></div></dl></article><article class="panel"><h3>Platser i avtalet</h3><p>${placements.map(item => `<b>${escapeHtml(item.slotId)}</b> – ${escapeHtml(item.location)}`).join("<br>")}</p><p><b>${included} annonsbyten</b> ingår under avtalsperioden.</p></article>` : '<article class="panel"><h3>Inget aktivt avtal</h3><p>Kontakta DinPuls om du förväntar dig att se ett aktivt avtal.</p></article>';
    $("#profileCompany").value = profile.company || "";
    $("#profileOrg").value = profile.orgNo || "";
    $("#profileContact").value = profile.contact || "";
    $("#profileEmail").value = profile.email || "";
    $("#profilePhone").value = profile.phone || "";
    $$(".change-banner").forEach(button => button.onclick = () => { showView("banners"); $("#bannerSlot").value = button.dataset.slot; });
  }

  async function init() {
    try { await loadConfiguration(); }
    catch (error) { showLogin(error.message); return; }
    $("#loginForm").onsubmit = async event => {
      event.preventDefault();
      try {
        const data = await api("/portal/auth/company", { method: "POST", body: JSON.stringify({ email: $("#email").value.trim(), password: $("#password").value }) });
        sessionStorage.setItem(TOKEN_KEY, data.token);
        $("#password").value = "";
        $("#loginError").hidden = true;
        await showApp();
      } catch (error) { showLogin(error.message); }
    };
    $("#forgot").onclick = event => { event.preventDefault(); alert("Kontakta DinPuls för säker återställning av företagskontot."); };
    $("#logout").onclick = async () => { try { await api("/portal/auth/logout", { method: "POST" }); } catch {} sessionStorage.removeItem(TOKEN_KEY); account = null; showLogin(); };
    $$(".nav-item").forEach(item => item.onclick = () => showView(item.dataset.view));
    $$('[data-open]').forEach(button => button.onclick = () => showView(button.dataset.open));
    $("#bannerUpload").onchange = () => {
      const file = $("#bannerUpload").files?.[0];
      if (!file) return;
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return void ($("#uploadStatus").textContent = "Välj PNG, JPG eller WebP.");
      if (file.size > 5 * 1024 * 1024) return void ($("#uploadStatus").textContent = "Filen är för stor. Max 5 MB.");
      const reader = new FileReader();
      reader.onload = () => { const image = document.createElement("img"); image.src = String(reader.result); image.alt = "Förhandsvisning"; $("#bannerPreview").replaceChildren(image); $("#uploadStatus").textContent = `${file.name} är vald för ${$("#bannerSlot").value}. Filen är endast förhandsvisad.`; };
      reader.readAsDataURL(file);
    };
    $("#saveProfile").onclick = async () => {
      try {
        await api("/portal/company/profile", { method: "PATCH", body: JSON.stringify({ contact: $("#profileContact").value, phone: $("#profilePhone").value }) });
        await showApp();
        alert("Kontaktuppgifterna är uppdaterade.");
      } catch (error) { alert(error.message); }
    };
    if (token()) { try { await showApp(); } catch (error) { showLogin(error.message); } } else showLogin();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
