(function () {
  "use strict";
  const CATEGORY_KEYS = Object.freeze({ bio: "BIO", "bostäder": "BOST", drivmedel: "DRIV", evenemang: "EVEN", jobb: "JOBB", lunch: "LUNCH", matkasse: "MAT", authorities: "MYND", myndigheter: "MYND", nyheter: "NYH", service: "SERV", trafik: "TRAF", vard: "VARD", sport: "SPORT", fritid: "FRIT", "skola-familj": "SKOLA-FAMILJ" });
  const homepageTimers = new Map();
  const measuredImpressions = new Set();
  let apiBasePromise;
  let inventoryPromise;

  function municipality() {
    return window.DinPulsMunicipality?.getName?.() || window.DinPulsMunicipalityState?.getInitial?.() || new URLSearchParams(location.search).get("kommun") || "Åmål";
  }

  function inventory() {
    if (Array.isArray(window.DINPULS_AD_INVENTORY)) return Promise.resolve(window.DINPULS_AD_INVENTORY);
    if (!inventoryPromise) inventoryPromise = new Promise(resolve => {
      const script = document.createElement("script");
      script.src = "admin/ad-inventory.js?version=0.26.0";
      script.onload = () => resolve(window.DINPULS_AD_INVENTORY || []);
      script.onerror = () => resolve([]);
      document.head.append(script);
    });
    return inventoryPromise;
  }

  async function apiBase() {
    if (!apiBasePromise) apiBasePromise = fetch("data/business-config.json", { cache: "no-store" }).then(response => response.ok ? response.json() : Promise.reject()).then(config => String(config.apiBase || "").replace(/\/$/, "")).catch(() => "");
    return apiBasePromise;
  }

  function safeTarget(value) {
    try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
  }

  async function getCurrentBanner(slotId, selectedMunicipality = municipality()) {
    const base = await apiBase();
    if (!base || !slotId) return null;
    try {
      const response = await fetch(`${base}/ads/current/${encodeURIComponent(slotId)}?municipality=${encodeURIComponent(selectedMunicipality)}`, { cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json();
      return data.banner ? { ...data.banner, imageUrl: `${base}${data.banner.imageUrl}`, targetUrl: safeTarget(data.banner.targetUrl) } : null;
    } catch { return null; }
  }

  function showBanner(slot, banner, label = "Annons") {
    if (!slot || !banner) return;
    const link = document.createElement("a");
    link.className = "secondary-ad strategic-ad scheduled-public-ad";
    if (banner.targetUrl) { link.href = banner.targetUrl; link.target = "_blank"; link.rel = "noopener noreferrer sponsored"; }
    else { link.removeAttribute("href"); link.setAttribute("role", "img"); }
    link.setAttribute("aria-label", banner.targetUrl ? `${label} – öppna annons` : label);
    const image = document.createElement("img");
    image.src = banner.imageUrl;
    image.alt = label;
    image.loading = "lazy";
    link.append(image);
    if (banner.targetUrl) link.addEventListener("click", () => recordEvent(banner.id, "click"), { passive: true });
    slot.replaceChildren(link);
    slot.dataset.scheduledBanner = banner.id;
    slot.hidden = false;
    measureImpression(slot, banner.id);
  }

  async function recordEvent(bannerId, eventType) {
    const base = await apiBase();
    if (!base || !bannerId) return;
    fetch(`${base}/ads/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bannerId, eventType }), keepalive: true }).catch(() => {});
  }

  function measureImpression(slot, bannerId) {
    if (measuredImpressions.has(bannerId)) return;
    if (!("IntersectionObserver" in window)) { measuredImpressions.add(bannerId); recordEvent(bannerId, "impression"); return; }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
      measuredImpressions.add(bannerId);
      observer.disconnect();
      recordEvent(bannerId, "impression");
    }, { threshold: 0.5 });
    observer.observe(slot);
  }

  async function resolveSlotId(slot) {
    const catalog = await inventory();
    const explicit = String(slot?.dataset?.slotId || "").toUpperCase();
    const category = String(slot?.dataset?.strategicAd || "").toLocaleLowerCase("sv-SE");
    const prefix = CATEGORY_KEYS[category];
    const position = Number(slot?.dataset?.adPosition || 0);
    const candidate = explicit || (prefix && position > 0 ? `${prefix}-${String(position).padStart(2, "0")}` : "");
    return catalog.some(item => item.id === candidate) ? candidate : "";
  }

  function updateDynamicRow(slot) {
    const row = slot.closest("[data-dynamic-ad-row]");
    if (row) row.hidden = ![...row.querySelectorAll("[data-strategic-ad]")].some(item => !item.hidden);
  }

  async function enhanceStrategicSlot(slot) {
    if (!slot) return;
    slot.hidden = true;
    slot.replaceChildren();
    delete slot.dataset.scheduledBanner;
    const slotId = await resolveSlotId(slot);
    const banner = slotId ? await getCurrentBanner(slotId) : null;
    if (banner) showBanner(slot, banner, `Annons i ${municipality()}`);
    updateDynamicRow(slot);
  }

  async function refreshStrategicAds() {
    await Promise.all([...document.querySelectorAll("[data-strategic-ad]")].map(enhanceStrategicSlot));
  }

  function renderStrategicAds(category, pageLabel, listSelector) {
    const slots = [...document.querySelectorAll("[data-strategic-ad]")];
    slots.forEach(slot => { slot.hidden = true; slot.replaceChildren(); });
    const inlineSlot = slots.find(slot => slot.dataset.adPosition === "3" && !slot.dataset.dynamicAd);
    const list = document.querySelector(listSelector);
    if (inlineSlot && list) {
      const placeInline = () => {
        const cards = [...list.children].filter(child => child !== inlineSlot);
        if (cards.length < 4) return;
        const anchor = cards[Math.min(cards.length - 1, Math.max(2, Math.floor(cards.length / 2)))];
        if (anchor.previousElementSibling !== inlineSlot) list.insertBefore(inlineSlot, anchor);
      };
      new MutationObserver(placeInline).observe(list, { childList: true });
      queueMicrotask(placeInline);
    }
    queueMicrotask(refreshStrategicAds);
  }

  function clearHomepageGroup(group) {
    const timer = homepageTimers.get(group);
    if (timer) window.clearInterval(timer);
    homepageTimers.delete(group);
    const host = document.querySelector(`[data-component="premium-ad-${group}"]`);
    const section = host?.querySelector(".premium-ads");
    const module = host?.querySelector("[data-ad-dice]");
    if (module) module.replaceChildren();
    if (section) section.hidden = true;
    if (host) host.hidden = true;
    return { host, section, module };
  }

  async function refreshHomepageGroup(group) {
    const { host, section, module } = clearHomepageGroup(group);
    if (!host || !section || !module) return;
    const catalog = await inventory();
    const groupName = `premium-ad-${group}`;
    const slots = catalog.filter(item => item.group === groupName).sort((a, b) => a.position - b.position);
    const active = (await Promise.all(slots.map(async slot => ({ slot, banner: await getCurrentBanner(slot.id) })))).filter(item => item.banner);
    const banners = [...new Map(active.map(item => [item.banner.id, item])).values()];
    if (!banners.length) return;
    const frame = document.createElement("div");
    frame.className = "homepage-live-ad";
    module.append(frame);
    let index = banners.length > 1 ? Math.floor(Math.random() * banners.length) : 0;
    const show = () => {
      const item = banners[index];
      showBanner(frame, item.banner, `Annons från lokalt företag i ${municipality()}`);
      index = (index + 1) % banners.length;
    };
    host.hidden = false;
    section.hidden = false;
    show();
    if (banners.length > 1) homepageTimers.set(group, window.setInterval(show, 30000));
  }

  async function refreshHomepageAds() {
    await Promise.all([1, 2, 3].map(refreshHomepageGroup));
  }

  function initializeHomepageAds() {
    if (!document.querySelector('[data-component="premium-ad-1"]')) return;
    document.addEventListener("dinpuls:components-loaded", refreshHomepageAds);
    window.setTimeout(refreshHomepageAds, 100);
  }

  window.DinPulsAds = Object.freeze({ renderStrategicAds, getCurrentBanner, showBanner, refreshStrategicAds, refreshHomepageAds, resolveSlotId, enhanceStrategicSlot });
  window.renderStrategicAds = renderStrategicAds;
  const start = () => { inventory().then(refreshStrategicAds); initializeHomepageAds(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  document.addEventListener("dinpuls:municipalitychange", () => window.setTimeout(() => { refreshStrategicAds(); refreshHomepageAds(); }, 0));
  window.addEventListener("pagehide", () => homepageTimers.forEach(timer => window.clearInterval(timer)), { once: true });
})();
