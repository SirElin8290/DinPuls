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
    try {
      const status = await fetch(`${apiBase}/health`, { cache: "no-store" }).then(response => response.json());
      $("#registerEntry").hidden = !status.selfServiceSignupEnabled;
      $("#buyEntry").hidden = !status.selfServicePurchaseEnabled;
    } catch { $("#registerEntry").hidden = true; $("#buyEntry").hidden = true; }
  }

  function showLogin(message = "") {
    $("#appView").hidden = true;
    $("#loginView").hidden = false;
    if (message) { $("#loginError").textContent = message; $("#loginError").hidden = false; }
  }

  async function showApp() {
    const details = await api("/portal/company/me");
    let schedule = { banners: [] }, stats = null, purchaseData = { purchases: [] }, bannerScheduleReady = true;
    try { schedule = await api("/portal/company/banners"); }
    catch { bannerScheduleReady = false; }
    try { stats = await api("/portal/company/stats"); }
    catch { stats = null; }
    try { purchaseData = await api("/portal/company/purchases"); }
    catch { purchaseData = { purchases: [] }; }
    account = { ...details, banners: schedule.banners || [], purchases: purchaseData.purchases || [], stats, bannerScheduleReady };
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
    const bannerPlacements = [
      ...(contract?.hasCustomerSignature ? [] : placements).map(item => ({ key: `base:${item.slotId}`, slotId: item.slotId, municipality: contract.municipality, location: item.location, purchaseId: null, status: "Avtalad" })),
      ...(account.purchases || []).map(item => ({ key: `purchase:${item.id}`, slotId: item.slot_id, municipality: item.municipality, location: item.placement_label, purchaseId: item.id, status: item.publication_status === "active" ? "Aktiv" : "Väntar på lansering" }))
    ];
    account.bannerPlacements = bannerPlacements;
    $("#accountName").textContent = profile.company || "Företagskonto";
    const municipalities = [...new Set([profile.municipality, ...(account.purchases || []).map(item => item.municipality)].filter(Boolean))];
    $("#companyMunicipality").textContent = `⌖ ${municipalities.join(", ") || "–"}`;
    $("#companyPurchaseRows").innerHTML = account.purchases.length ? account.purchases.map(item => `<article class="purchase-row"><strong>${escapeHtml(item.placement_label)}</strong><span>Plats-ID: ${escapeHtml(item.slot_id)} · Order ${escapeHtml(item.order_id)}</span><span>${escapeHtml(item.start_date)} – ${escapeHtml(item.end_date)} · ${escapeHtml(item.billing_type === "annual" ? "Årsvis i förskott" : "Månadsvis")}</span><span>${Number(item.unit_price).toLocaleString("sv-SE")} kr exkl. moms + ${Number(item.vat_amount).toLocaleString("sv-SE")} kr moms · Status: ${escapeHtml(item.billing_status === "waiting_for_launch" ? "Väntar på lansering" : item.billing_status)}</span></article>`).join("") : '<p class="muted">Inga tilläggsköp har registrerats ännu. Platser i det ursprungliga signerade avtalet visas under Avtal.</p>';
    const stats = account.stats || { activeBanners: 0, impressions: 0, clicks: 0, ctr: 0 };
    $("#activeBanners").textContent = Number(stats.activeBanners || 0).toLocaleString("sv-SE");
    $("#bannerViews").textContent = Number(stats.impressions || 0).toLocaleString("sv-SE");
    $("#bannerClicks").textContent = Number(stats.clicks || 0).toLocaleString("sv-SE");
    $("#bannerCtr").textContent = `${Number(stats.ctr || 0).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} %`;
    const priceLabel = contract?.billingType === "complimentary" ? "Kostnadsfri annonsplats" : contract?.billingType === "annual" ? `${Number(contract?.annualTotal || 0).toLocaleString("sv-SE")} kr / 12 månader exkl. moms` : `${Number(contract?.monthlyTotal || 0).toLocaleString("sv-SE")} kr / månad exkl. moms`;
    $("#contractSummary").innerHTML = contract ? `<p>Avtalsperiod<br><strong>${escapeHtml(contract.startDate)} – ${escapeHtml(contract.endDate)}</strong></p><p>Månader kvar<br><strong class="months">${monthsLeft(contract.endDate)} månader</strong></p><p>Annonsplatser<br><strong>${placements.map(item => escapeHtml(item.slotId)).join(", ") || "–"}</strong></p><p>Avtalspris<br><strong>${priceLabel}</strong></p>` : "<p>Inget aktivt avtal hittades.</p>";
    const banners = account.banners || [];
    $("#companyBannerRows").innerHTML = bannerPlacements.length ? bannerPlacements.map(placement => {
      const slotBanners = banners.filter(item => placement.purchaseId ? item.purchaseId === placement.purchaseId : !item.purchaseId && item.slotId === placement.slotId).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
      const current = slotBanners.filter(item => item.publishedAt).at(-1);
      const next = slotBanners.find(item => !item.publishedAt && item.approvalStatus !== "rejected");
      const preview = current ? `<div class="demo-banner company-banner-thumb" style="background-image:url('${escapeHtml(apiBase + current.imageUrl)}')"></div>` : '<div class="demo-banner">Ingen publicerad banner</div>';
      return `<div class="banner-row"><b>${escapeHtml(placement.municipality)} · ${escapeHtml(placement.slotId)}<br><small>${escapeHtml(placement.location)}</small></b>${preview}<span class="status">${current ? "Visas nu" : next ? (next.approvalStatus === "approved" ? "Godkänd" : "Väntar på granskning") : placement.status}</span><span>${next ? formatSwedishDateTime(next.startAt) : "–"}</span><span>–</span><span>–</span><button class="change-banner" data-key="${escapeHtml(placement.key)}">Planera</button></div>`;
    }).join("") : '<p class="muted">Inga annonsplatser i ett aktivt avtal.</p>';
    $("#bannerSlot").innerHTML = bannerPlacements.map(placement => `<option value="${escapeHtml(placement.key)}">${escapeHtml(placement.municipality)} · ${escapeHtml(placement.location)}</option>`).join("");
    const included = Number(contract?.includedChanges || 0);
    $("#companyContractDetail").innerHTML = contract ? `<article class="panel contract-document"><h3>Annonsavtal ${escapeHtml(contract.id)}</h3><dl class="contract-list"><div><dt>Företag</dt><dd>${escapeHtml(profile.company)}</dd></div><div><dt>Organisationsnummer</dt><dd>${escapeHtml(profile.orgNo)}</dd></div><div><dt>Avtalsversion</dt><dd>${escapeHtml(contract.contractVersion)}</dd></div><div><dt>Avtalsperiod</dt><dd>${escapeHtml(contract.startDate)} – ${escapeHtml(contract.endDate)}</dd></div><div><dt>Pris</dt><dd>${priceLabel}</dd></div><div><dt>Förnyelse</dt><dd>${contract.renewalType === "annual-review" ? "Prövas gemensamt efter 12 månader" : "Avslutas vid periodens slut"}</dd></div><div><dt>Signatur</dt><dd>${contract.signedAt ? `Signerades ${escapeHtml(new Date(contract.signedAt).toLocaleString("sv-SE"))}` : "Ej färdigsignerat"}</dd></div></dl>${contract.valueNote ? `<p><b>Särskild notering:</b> ${escapeHtml(contract.valueNote)}</p>` : ""}</article><article class="panel contract-terms"><h3>Sammanfattning av avtalet</h3><p><b>Annonsplatser:</b><br>${placements.map(item => `${escapeHtml(item.slotId)} – ${escapeHtml(item.location)}`).join("<br>")}</p><ol><li>DinPuls visar företagets material på de annonsplatser och under den period som anges ovan.</li><li>Företaget ansvarar för att bilder, texter, länkar och rättigheter till materialet är korrekta.</li><li>Fyra faktiska bannerbyten ingår per annonsplats och påbörjad 30-dagarsperiod. Framtida schemaläggning räknas först vid publicering. Publicerat material kan stoppas av DinPuls om det är olagligt, vilseledande eller tekniskt skadligt.</li><li>Statistik i portalen är en teknisk mätning och garanterar inte ett visst antal visningar, klick eller affärer.</li><li>Fyra bannerbyten per plats återställs för varje ny 30-dagarsperiod. Avtalet förnyas inte automatiskt utan den förnyelseprövning som anges ovan.</li></ol><p class="contract-copy-date">Detta är en portalöversikt. Den signerade originalkopian finns som PDF och är den låsta avtalsversionen.</p></article>` : '<article class="panel"><h3>Inget aktivt avtal</h3><p>Kontakta DinPuls om du förväntar dig att se ett aktivt avtal.</p></article>';
    $("#printContract").hidden = !contract;
    $("#profileCompany").value = profile.company || "";
    $("#profileOrg").value = profile.orgNo || "";
    $("#profileContact").value = profile.contact || "";
    $("#profileEmail").value = profile.email || "";
    $("#profilePhone").value = profile.phone || "";
    $$(".change-banner").forEach(button => button.onclick = () => { showView("banners"); $("#bannerSlot").value = button.dataset.key; renderBannerSchedule(); });
    renderBannerSchedule();
  }

  function formatSwedishDateTime(value) {
    return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Stockholm" }).format(new Date(value));
  }

  function renderBannerSchedule() {
    const container = $("#bannerSchedule");
    if (!container || !account) return;
    const placement = (account.bannerPlacements || []).find(item => item.key === $("#bannerSlot").value);
    const banners = (account.banners || []).filter(item => placement && (placement.purchaseId ? item.purchaseId === placement.purchaseId : !item.purchaseId && item.slotId === placement.slotId)).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
    const currentId = banners.filter(item => item.publishedAt).at(-1)?.id;
    const pendingCount = banners.filter(item => !item.publishedAt).length;
    const latestPeriod = Math.max(-1, ...banners.filter(item => item.publishedAt).map(item => Number(item.changePeriod)));
    const publishedThisPeriod = banners.filter(item => item.publishedAt && Number(item.changePeriod) === latestPeriod).length;
    $("#scheduleCount").textContent = account.bannerScheduleReady ? `${publishedThisPeriod} av 4 publicerade · ${Math.max(0, 4 - publishedThisPeriod)} kvar · ${pendingCount} under granskning/planerade` : "Schema kunde inte läsas";
    container.innerHTML = !account.bannerScheduleReady
      ? '<p class="muted">Det befintliga bannerschemat kunde inte läsas. Du kan fortfarande prova att planera en ny banner; om servern stoppar uppladdningen visas det riktiga felet.</p>'
      : banners.length ? banners.map(item => {
      const state = item.publishedAt ? (item.id === currentId ? "Publicerad" : "Tidigare publicerad") : item.approvalStatus === "approved" ? "Godkänd" : item.approvalStatus === "rejected" ? "Avvisad" : "Väntar på granskning";
      const image = item.approvalStatus === "approved" ? `<img src="${escapeHtml(apiBase + item.imageUrl)}" alt="">` : '<span class="banner-review-placeholder">Bild inskickad</span>';
      return `<article class="scheduled-banner">${image}<div><strong>${escapeHtml(state)}</strong><span>${escapeHtml(formatSwedishDateTime(item.startAt))}</span><small>${escapeHtml(item.fileName)}${item.reviewComment ? ` · ${escapeHtml(item.reviewComment)}` : ""}</small></div>${!item.publishedAt ? `<button type="button" class="remove-banner" data-banner-id="${escapeHtml(item.id)}">Ta bort</button>` : ""}</article>`;
    }).join("") : '<p class="muted">Inga banners är planerade för den här annonsplatsen ännu.</p>';
    $$(".remove-banner").forEach(button => button.onclick = async () => {
      if (!confirm("Ta bort den planerade bannern?")) return;
      try { await api(`/portal/company/banners/${encodeURIComponent(button.dataset.bannerId)}`, { method: "DELETE" }); await showApp(); showView("banners"); }
      catch (error) { alert(error.message); }
    });
    updateBannerButton();
  }

  function updateBannerButton() {
    $("#saveBanner").disabled = !(selectedBannerFile && $("#bannerStart").value && $("#bannerSlot").value);
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
        if (new URLSearchParams(location.search).get("next") === "kop") { location.assign("kop.html"); return; }
        await showApp();
      } catch (error) { showLogin(error.message); }
    };
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
        const placement = (account.bannerPlacements || []).find(item => item.key === $("#bannerSlot").value);
        if (!placement) throw new Error("Välj en annonsplats som tillhör ditt företag.");
        const headers = { Authorization: `Bearer ${token()}`, "Content-Type": selectedBannerFile.type,
          "X-Banner-Slot": placement.slotId, "X-Banner-Municipality": encodeURIComponent(placement.municipality), "X-Banner-Start": startDate.toISOString(),
          "X-Banner-Name": encodeURIComponent(selectedBannerFile.name), "X-Banner-Link": encodeURIComponent(link) };
        const response = await fetch(`${apiBase}/portal/company/banners`, { method: "POST", headers, body: selectedBannerFile });
        const data = await response.json().catch(() => ({ error: "Servern gav ett ogiltigt svar." }));
        if (!response.ok) throw new Error(data.error || "Bannern kunde inte sparas.");
        selectedBannerFile = null; $("#bannerUpload").value = ""; $("#bannerLink").value = "";
        $("#bannerPreview").innerHTML = "<span>Din bild visas här</span>"; $("#uploadStatus").textContent = "Bannern är inskickad och väntar på granskning. Ett byte räknas först när den publiceras.";
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
    $("#printContract").onclick = async () => {
      const id = account?.contract?.id;
      if (!id || !account.contract.hasSignedPdf) return alert("Det finns ännu ingen signerad PDF-kopia.");
      const response = await fetch(`${apiBase}/portal/company/contracts/${encodeURIComponent(id)}/pdf`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!response.ok) return alert((await response.json().catch(() => ({}))).error || "PDF-filen kunde inte hämtas.");
      const link = document.createElement("a"); link.href = URL.createObjectURL(await response.blob()); link.download = `DinPuls-annonsavtal-${id}.pdf`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    };
    if (token()) { try { await showApp(); } catch (error) { showLogin(error.message); } } else showLogin();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
