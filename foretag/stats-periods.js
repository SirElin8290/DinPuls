(function () {
  "use strict";

  const TOKEN_KEY = "dp-company-session";
  const PERIODS = [
    ["day", "Dag"],
    ["week", "Vecka"],
    ["month", "Månad"],
    ["year", "År"]
  ];
  let apiBase = "";
  let period = "month";
  let anchor = todayKey();
  let initialized = false;

  function $(selector) { return document.querySelector(selector); }
  function todayKey() {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }
  function dateFromKey(key) {
    const [year, month, day] = String(key).split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  function keyFromDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function moveAnchor(direction) {
    const date = dateFromKey(anchor);
    if (period === "day") date.setDate(date.getDate() + direction);
    if (period === "week") date.setDate(date.getDate() + (7 * direction));
    if (period === "month") date.setMonth(date.getMonth() + direction);
    if (period === "year") date.setFullYear(date.getFullYear() + direction);
    anchor = keyFromDate(date);
  }
  function shortDate(key) {
    return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "numeric" }).format(dateFromKey(key));
  }
  function periodLabel(data) {
    if (period === "day") return shortDate(data.startDate);
    if (period === "week") return `${shortDate(data.startDate)} – ${shortDate(data.endDate)}`;
    if (period === "month") return new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(dateFromKey(data.startDate));
    return String(data.startDate || "").slice(0, 4);
  }
  function ensureUi() {
    if ($("#statsPeriodToolbar")) return;
    const stats = $("#overview .stats");
    if (!stats) return;
    const toolbar = document.createElement("section");
    toolbar.id = "statsPeriodToolbar";
    toolbar.className = "stats-period-toolbar";
    toolbar.innerHTML = `
      <div class="stats-period-tabs" role="group" aria-label="Statistikperiod">
        ${PERIODS.map(([value, label]) => `<button type="button" data-stats-period="${value}" class="${value === period ? "active" : ""}">${label}</button>`).join("")}
      </div>
      <div class="stats-period-nav">
        <button type="button" id="statsPrev" aria-label="Föregående period">←</button>
        <strong id="statsPeriodLabel">Laddar statistik…</strong>
        <button type="button" id="statsNext" aria-label="Nästa period">→</button>
      </div>
      <p id="statsPeriodStatus" class="stats-period-status" role="status"></p>`;
    stats.parentNode.insertBefore(toolbar, stats);

    const style = document.createElement("style");
    style.textContent = `
      .stats-period-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:18px 0 12px;padding:14px 16px;background:#fff;border:1px solid rgba(23,54,77,.12);border-radius:14px;box-shadow:0 6px 20px rgba(23,54,77,.06)}
      .stats-period-tabs,.stats-period-nav{display:flex;align-items:center;gap:8px}.stats-period-tabs button,.stats-period-nav button{border:1px solid rgba(23,54,77,.18);background:#fff;color:#17364d;border-radius:9px;padding:8px 12px;font:inherit;font-weight:700;cursor:pointer}.stats-period-tabs button.active{background:#17364d;color:#fff;border-color:#17364d}.stats-period-nav strong{min-width:185px;text-align:center;text-transform:capitalize}.stats-period-nav button:disabled{opacity:.35;cursor:not-allowed}.stats-period-status{width:100%;margin:0;color:#6c7c87;font-size:.86rem}.stats-period-status:empty{display:none}
      @media(max-width:700px){.stats-period-toolbar{align-items:stretch}.stats-period-tabs{width:100%;display:grid;grid-template-columns:repeat(4,1fr)}.stats-period-tabs button{padding:8px 4px}.stats-period-nav{width:100%;justify-content:space-between}.stats-period-nav strong{min-width:0;flex:1;font-size:.92rem}}
    `;
    document.head.append(style);

    toolbar.querySelectorAll("[data-stats-period]").forEach(button => {
      button.addEventListener("click", () => {
        period = button.dataset.statsPeriod;
        anchor = todayKey();
        toolbar.querySelectorAll("[data-stats-period]").forEach(item => item.classList.toggle("active", item.dataset.statsPeriod === period));
        loadStats();
      });
    });
    $("#statsPrev").addEventListener("click", () => { moveAnchor(-1); loadStats(); });
    $("#statsNext").addEventListener("click", () => { moveAnchor(1); loadStats(); });
  }

  async function loadStats() {
    const token = sessionStorage.getItem(TOKEN_KEY) || "";
    if (!token || !apiBase) return;
    ensureUi();
    const status = $("#statsPeriodStatus");
    if (status) status.textContent = "Hämtar statistik…";
    try {
      const response = await fetch(`${apiBase}/portal/company/stats?period=${encodeURIComponent(period)}&anchor=${encodeURIComponent(anchor)}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Statistiken kunde inte hämtas.");
      $("#activeBanners").textContent = Number(data.activeBanners || 0).toLocaleString("sv-SE");
      $("#bannerViews").textContent = Number(data.impressions || 0).toLocaleString("sv-SE");
      $("#bannerClicks").textContent = Number(data.clicks || 0).toLocaleString("sv-SE");
      $("#bannerCtr").textContent = `${Number(data.ctr || 0).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} %`;
      const label = $("#statsPeriodLabel");
      if (label) label.textContent = periodLabel(data);
      const viewsSmall = $("#bannerViews")?.parentElement?.querySelector("small");
      const clicksSmall = $("#bannerClicks")?.parentElement?.querySelector("small");
      if (viewsSmall) viewsSmall.textContent = "vald period";
      if (clicksSmall) clicksSmall.textContent = "vald period";
      const next = $("#statsNext");
      if (next) next.disabled = String(data.endDate || "") >= todayKey();
      if (status) status.textContent = `Statistik ${data.startDate} – ${data.endDate}. Registreras löpande.`;
    } catch (error) {
      if (status) status.textContent = error.message;
    }
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    try {
      const response = await fetch("../data/business-config.json", { cache: "no-store" });
      const config = await response.json();
      apiBase = String(config.apiBase || "").replace(/\/$/, "");
    } catch { return; }
    const app = $("#appView");
    if (!app) return;
    const activate = () => { if (!app.hidden && sessionStorage.getItem(TOKEN_KEY)) loadStats(); };
    new MutationObserver(activate).observe(app, { attributes: true, attributeFilter: ["hidden"] });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) activate(); });
    activate();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
