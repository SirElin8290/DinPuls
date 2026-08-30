(function initializeDinPulsCore(root) {
  "use strict";

  const TIME_ZONE = "Europe/Stockholm";
  const DATE_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const ONE_DECIMAL_FORMAT = new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 1
  });

  const SEASONS = Object.freeze({
    spring: Object.freeze({ id: "spring", label: "Vår", icon: "sprout" }),
    summer: Object.freeze({ id: "summer", label: "Sommar", icon: "sun" }),
    autumn: Object.freeze({ id: "autumn", label: "Höst", icon: "leaf" }),
    winter: Object.freeze({ id: "winter", label: "Vinter", icon: "snowflake" })
  });

  function stockholmDateKey(value = new Date()) {
    const parts = Object.fromEntries(
      DATE_KEY_FORMAT.formatToParts(new Date(value))
        .map(part => [part.type, part.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function stockholmDateParts(value = new Date()) {
    const [year, month, day] = stockholmDateKey(value).split("-").map(Number);
    return { year, month, day };
  }

  function seasonForDate(value = new Date()) {
    const { month } = stockholmDateParts(value);
    if (month >= 3 && month <= 5) return SEASONS.spring;
    if (month >= 6 && month <= 8) return SEASONS.summer;
    if (month >= 9 && month <= 11) return SEASONS.autumn;
    return SEASONS.winter;
  }

  function loadSeasonStyles() {
    if (!root.document || root.document.querySelector('link[data-dinpuls-season-theme]')) return;
    const link = root.document.createElement("link");
    link.rel = "stylesheet";
    link.href = "season-theme.css?version=1.0.0";
    link.dataset.dinpulsSeasonTheme = "true";
    root.document.head.appendChild(link);
  }

  function updateSeasonBadge(season) {
    const badge = root.document?.querySelector("#seasonal-theme-badge");
    if (!badge) return false;
    badge.innerHTML = `<i data-lucide="${season.icon}"></i><span>${season.label}</span>`;
    badge.title = `DinPuls ${season.label.toLocaleLowerCase("sv-SE")}tema`;
    if (root.lucide) root.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
    return true;
  }

  function applySeason(value = new Date()) {
    const season = seasonForDate(value);
    if (!root.document) return season;
    root.document.documentElement.dataset.season = season.id;
    root.document.documentElement.dataset.seasonLabel = season.label;
    loadSeasonStyles();
    if (!updateSeasonBadge(season) && root.MutationObserver && root.document.body) {
      const observer = new root.MutationObserver(() => {
        if (updateSeasonBadge(season)) observer.disconnect();
      });
      observer.observe(root.document.body, { childList: true, subtree: true });
      root.setTimeout?.(() => observer.disconnect(), 10000);
    }
    return season;
  }

  function scheduleSeasonRefresh() {
    if (!root.document || !root.setInterval) return;
    root.setInterval(() => applySeason(new Date()), 60000);
  }

  function cleanNumber(value) {
    const number = Number(value);
    return !Number.isFinite(number) || number === 9999 ? NaN : number;
  }

  function formatSwedishTime(value) {
    return new Date(value).toLocaleString("sv-SE", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short"
    });
  }

  function formatRelativeTime(value, now = Date.now()) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Tid saknas";
    const minutes = Math.max(0, Math.floor((Number(now) - date.getTime()) / 60000));
    if (minutes < 2) return "nyss";
    if (minutes < 60) return `${minutes} min sedan`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} tim sedan`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "igår";
    if (days < 7) return `${days} dagar sedan`;
    return date.toLocaleDateString("sv-SE", {
      timeZone: TIME_ZONE,
      day: "numeric",
      month: "short"
    });
  }

  function getInitials(value, fallback = "DP") {
    return String(value || fallback)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join("")
      .toLocaleUpperCase("sv-SE");
  }

  function formatEventDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Kommande"
      : date.toLocaleDateString("sv-SE", {
          timeZone: TIME_ZONE,
          day: "numeric",
          month: "short"
        });
  }

  function formatJobDate(value, prefix) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${prefix} ${date.toLocaleDateString("sv-SE", {
      timeZone: TIME_ZONE,
      day: "numeric",
      month: "short"
    })}`;
  }

  function formatHousingNumber(value) {
    return ONE_DECIMAL_FORMAT.format(Number(value));
  }

  function formatHousingAvailability(value) {
    if (!value) return "Tillgänglighet hos hyresvärden";
    if (String(value).toLocaleLowerCase("sv-SE") === "nu") return "Tillgänglig nu";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? `Tillgänglig ${value}`
      : `Tillgänglig ${date.toLocaleDateString("sv-SE", {
          timeZone: TIME_ZONE,
          day: "numeric",
          month: "short",
          year: "numeric"
        })}`;
  }

  function stockholmWeekday(value = new Date()) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: TIME_ZONE
    }).format(new Date(value)).toLowerCase();
  }

  function setText(selector, value) {
    const element = root.document?.querySelector(selector);
    if (element) element.textContent = value;
  }

  if (!root.DinPulsSecurity) {
    throw new Error("DinPulsSecurity måste laddas före DinPulsCore.");
  }

  const api = Object.freeze({
    TIME_ZONE,
    SEASONS,
    stockholmDateKey,
    stockholmDateParts,
    seasonForDate,
    applySeason,
    cleanNumber,
    formatSwedishTime,
    formatRelativeTime,
    getInitials,
    formatEventDate,
    formatJobDate,
    formatHousingNumber,
    formatHousingAvailability,
    stockholmWeekday,
    setText,
    escapeHtml: root.DinPulsSecurity.escapeHtml,
    escapeAttribute: root.DinPulsSecurity.escapeAttribute,
    safeExternalUrl: root.DinPulsSecurity.safeExternalUrl,
    safeHref: root.DinPulsSecurity.safeHref
  });

  root.DinPulsCore = api;
  applySeason(new Date());
  scheduleSeasonRefresh();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
