(function () {
  "use strict";

  const TOKEN_KEY = "dp-company-session";
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  let apiBase = "";
  let account = null;
  let selectedBannerFile = null;

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
    const details = await api("/portal/company/me");
    let schedule = { banners: [] }, stats = null, bannerBackendReady = true;
    try { [schedule, stats] = await Promise.all([api("/portal/company/banners"), api("/portal/company/stats")]); } catch { bannerBackendReady = false; }
    account = { ...details, banners: schedule.banners || [], stats, bannerBackendReady };
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
    const stats = account.stats || { activeBanners: 0, impressions: 0, clicks: 0, ctr: 0 };
    $("#activeBanners").textContent = Number(stats.activeBanners || 0).toLocaleString("sv-SE");
    $("#bannerViews").textContent = Number(stats.impressions || 0).toLocaleString("sv-SE");
    $("#bannerClicks").textContent = Number(stats.clicks || 0).toLocaleString("sv-SE");
    $("#bannerCtr").textContent = `${Number(stats.ctr || 0).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} %`;
    const priceLabel = contract?.billingType === "complimentary" ? "Kostnadsfri annonsplats" : `${Number(contract?.monthlyTotal || 0).toLocaleString("sv-SE")} kr / månad exkl. moms`;
    $("#contractSummary").innerHTML = contract ? `<p>Avtalsperiod<br><strong>${escapeHtml(contract.startDate)} – ${escapeHtml(contract.endDate)}</strong></p><p>Månader kvar<br><strong class="months">${monthsLeft(contract.endDate)} månader</strong></p><p>Annonsplatser<br><strong>${placements.map(item => escapeHtml(item.slotId)).join(", ") || "–"}</strong></p><p>Avtalspris<br><strong>${priceLabel}</strong></p>` : "<p>Inget aktivt avtal hittades.</p>";
    const banners = account.banners || [];
    $("#companyBannerRows").innerHTML = placements.length ? placements.map(placement => {
      const slotBanners = banners.filter(item => item.slotId === placement.slotId).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
      const current = slotBanners.filter(item => Date.parse(item.startAt) <= Date.now()).at(-1);
      const next = slotBanners.find(item => Date.parse(item.startAt) > Date.now());
      const preview = current ? `<div class="demo-banner company-banner-thumb" style="background-image:url('${escapeHtml(apiBase + current.imageUrl)}')"></div>` : '<div class="demo-banner">Ingen publicerad banner</div>';
      return `<div class="banner-row"><b>${escapeHtml(placement.slotId)}<br><small>${escapeHtml(placement.location)}</small></b>${preview}<span class="status">${current ? "Visas nu" : "Avtalad"}</span><span>${next ? formatSwedishDateTime(next.startAt) : "–"}</span><span>–</span><span>–</span><button class="change-banner" data-slot="${escapeHtml(placement.slotId)}">Planera</button></div>`;
    }).join("") : '<p class="muted">Inga annonsplatser i ett aktivt avtal.</p>';
    $("#bannerSlot").innerHTML = placements.map(placement => `<option value="${escapeHtml(placement.slotId)}">${escapeHtml(placement.slotId)} · ${escapeHtml(placement.location)}</option>`).join("");
    const included = Number(contract?.includedChanges || 0);
    $("#companyContractDetail").innerHTML = contract ? `<article class="panel contract-document"><h3>Annonsavtal ${escapeHtml(contract.id)}</h3><dl class="contract-list"><div><dt>Företag</dt><dd>${escapeHtml(profile.company)}</dd></div><div><dt>Organisationsnummer</dt><dd>${escapeHtml(profile.orgNo)}</dd></div><div><dt>Avtalsversion</dt><dd>${escapeHtml(contract.contractVersion)}</dd></div><div><dt>Avtalsperiod</dt><dd>${escapeHtml(contract.startDate)} – ${escapeHtml(contract.endDate)}</dd></div><div><dt>Pris</dt><dd>${priceLabel}</dd></div><div><dt>Förnyelse</dt><dd>${contract.renewalType === "annual-review" ? "Prövas gemensamt efter 12 månader" : "Avslutas vid periodens slut"}</dd></div><div><dt>Signatur</dt><dd>${contract.signatureRequired ? "Krävs" : "Krävs inte"}</dd></div></dl>${contract.valueNote ? `<p><b>Särskild notering:</b> ${escapeHtml(contract.valueNote)}</p>` : ""}</article><article class="panel contract-terms"><h3>Omfattning och villkor</h3><p><b>Annonsplatser:</b><br>${placements.map(item => `${escapeHtml(item.slotId)} – ${escapeHtml(item.location)}`).join("<br>")}</p><ol><li>DinPuls visar företagets material på de annonsplatser och under den period som anges ovan.</li><li>Företaget ansvarar för att bilder, texter, länkar och rättigheter till materialet är korrekta.</li><li>Upp till fyra kommande banners kan planeras per annonsplats. Publicerat material kan stoppas av DinPuls om det är olagligt, vilseledande eller tekniskt skadligt.</li><li>Statistik i portalen är en teknisk mätning och garanterar inte ett visst antal visningar, klick eller affärer.</li><li>${included} bannerbyten ingår under avtalsperioden. Avtalet förnyas inte automatiskt utan den förnyelseprövning som anges ovan.</li></ol><p class="contract-copy-date">Avtalskopian skapades ${escapeHtml(new Intl.DateTimeFormat("sv-SE", { dateStyle: "long" }).format(new Date()))}.</p></article>` : '<article class="panel"><h3>Inget aktivt avtal</h3><p>Kontakta DinPuls om du förväntar dig att se ett aktivt avtal.</p></article>';
    $("#printContract").hidden = !contract;
    $("#profileCompany").value = profile.company || "";
    $("#profileOrg").value = profile.orgNo || "";
    $("#profileContact").value = profile.contact || "";
    $("#profileEmail").value = profile.email || "";
    $("#profilePhone").value = profile.phone || "";
    $$(".change-banner").forEach(button => button.onclick = () => { showView("banners"); $("#bannerSlot").value = button.dataset.slot; renderBannerSchedule(); });
    renderBannerSchedule();
  }

  function formatSwedishDateTime(value) {
    return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Stockholm" }).format(new Date(value));
  }

  function renderBannerSchedule() {
    const container = $("#bannerSchedule");
    if (!container || !account) return;
    if (!account.bannerBackendReady) {
      container.innerHTML = '<p class="muted">Bannerverktyget aktiveras just nu. Dina avtalsuppgifter och resten av portalen fungerar som vanligt.</p>';
      $("#scheduleCount").textContent = "Aktivering pågår";
      return;
    }
    const slotId = $("#bannerSlot").value;
    const banners = (account.banners || []).filter(item => item.slotId === slotId).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
    const past = banners.filter(item => Date.parse(item.startAt) <= Date.now());
    const currentId = past.at(-1)?.id;
    const futureCount = banners.filter(item => Date.parse(item.startAt) > Date.now()).length;
    $("#scheduleCount").textContent = `${futureCount} av 4 kommande`;
    container.innerHTML = banners.length ? banners.map(item => {
      const future = Date.parse(item.startAt) > Date.now();
      const state = future ? "Planerad" : item.id === currentId ? "Visas nu" : "Tidigare";
      return `<article class="scheduled-banner"><img src="${escapeHtml(apiBase + item.imageUrl)}" alt=""><div><strong>${escapeHtml(state)}</strong><span>${escapeHtml(formatSwedishDateTime(item.startAt))}</span><small>${escapeHtml(item.fileName)}</small></div>${future ? `<button type="button" class="remove-banner" data-banner-id="${escapeHtml(item.id)}">Ta bort</button>` : ""}</article>`;
    }).join("") : '<p class="muted">Inga banners är planerade för den här annonsplatsen ännu.</p>';
    $$(".remove-banner").forEach(button => button.onclick = async () => {
      if (!confirm("Ta bort den planerade bannern?")) return;
      try { await api(`/portal/company/banners/${encodeURIComponent(button.dataset.bannerId)}`, { method: "DELETE" }); await showApp(); showView("banners"); }
      catch (error) { alert(error.message); }
    });
  }

  function updateBannerButton() {
    $("#saveBanner").disabled = !(account?.bannerBackendReady && selectedBannerFile && $("#bannerStart").value && $("#bannerSlot").value);
  }

  function defaultScheduleTime() {
    const date = new Date(Date.now() + 5 * 60 * 1000);
    date.setSeconds(0, 0);
    const offset = date.getTimezoneOffset() * 60000;
    $("#bannerStart").min = new Date(Date.now() - offset).toISOString().slice(0, 16);
    if (!$("#bannerStart").value) $("#bannerStart").value = new Date(date.getTime() - offset).toISOString().slice(0, 16);
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
    defaultScheduleTime();
    $("#bannerSlot").onchange = renderBannerSchedule;
    $("#bannerStart").oninput = updateBannerButton;
    $("#bannerUpload").onchange = () => {
      const file = $("#bannerUpload").files?.[0];
      if (!file) return;
      selectedBannerFile = null;
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return void ($("#uploadStatus").textContent = "Välj PNG, JPG eller WebP.");
      if (file.size > 5 * 1024 * 1024) return void ($("#uploadStatus").textContent = "Filen är för stor. Max 5 MB.");
      selectedBannerFile = file;
      const reader = new FileReader();
      reader.onload = () => { const image = document.createElement("img"); image.src = String(reader.result); image.alt = "Förhandsvisning"; $("#bannerPreview").replaceChildren(image); $("#uploadStatus").textContent = `${file.name} är klar att planeras.`; updateBannerButton(); };
      reader.readAsDataURL(file);
    };
    $("#saveBanner").onclick = async () => {
      if (!selectedBannerFile) return;
      const startValue = $("#bannerStart").value;
      const startDate = new Date(startValue);
      if (!startValue || Number.isNaN(startDate.getTime())) return alert("Välj datum och klockslag.");
      const button = $("#saveBanner");
      button.disabled = true; button.textContent = "Sparar…";
      try {
        const link = $("#bannerLink").value.trim();
        const headers = { Authorization: `Bearer ${token()}`, "Content-Type": selectedBannerFile.type,
          "X-Banner-Slot": $("#bannerSlot").value, "X-Banner-Start": startDate.toISOString(),
          "X-Banner-Name": encodeURIComponent(selectedBannerFile.name), "X-Banner-Link": encodeURIComponent(link) };
        const response = await fetch(`${apiBase}/portal/company/banners`, { method: "POST", headers, body: selectedBannerFile });
        const data = await response.json().catch(() => ({ error: "Servern gav ett ogiltigt svar." }));
        if (!response.ok) throw new Error(data.error || "Bannern kunde inte sparas.");
        selectedBannerFile = null; $("#bannerUpload").value = ""; $("#bannerLink").value = "";
        $("#bannerPreview").innerHTML = "<span>Din bild visas här</span>"; $("#uploadStatus").textContent = "Bannern är planerad och byts automatiskt vid vald tid.";
        await showApp(); showView("banners");
      } catch (error) { alert(error.message); }
      finally { button.textContent = "Planera bannern"; updateBannerButton(); }
    };
    $("#saveProfile").onclick = async () => {
      try {
        await api("/portal/company/profile", { method: "PATCH", body: JSON.stringify({ contact: $("#profileContact").value, phone: $("#profilePhone").value }) });
        await showApp();
        alert("Kontaktuppgifterna är uppdaterade.");
      } catch (error) { alert(error.message); }
    };
    $("#printContract").onclick = () => window.print();
    if (token()) { try { await showApp(); } catch (error) { showLogin(error.message); } } else showLogin();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
