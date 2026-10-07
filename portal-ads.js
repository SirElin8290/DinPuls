(function () {
  "use strict";
  const CATEGORY_KEYS = Object.freeze({ bio: "BIO", "bostäder": "BOST", drivmedel: "DRIV", evenemang: "EVEN", jobb: "JOBB", lunch: "LUNCH", matkasse: "MAT", authorities: "MYND", myndigheter: "MYND", nyheter: "NYH", service: "SERV", trafik: "TRAF", vard: "VARD", health: "VARD", sport: "SPORT", fritid: "FRIT", "skola-familj": "SKOLA-FAMILJ" });
  const homepageTimers = new Map();
  const measuredImpressions = new Set();
  let apiBasePromise;
  let inventoryPromise;
  let testPreviewPromise;
  const verifiedEmptySlots = new Set();
  let homepageRefresh;
  let homepageRefreshPending = false;
  const inlineObservers = new WeakMap();

  async function testPreview() {
    if (!testPreviewPromise) testPreviewPromise = fetch("data/homepage-test-preview.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
    const config = await testPreviewPromise;
    return config?.enabled === true && Date.parse(config.expiresAt) > Date.now() && /^assets\/[a-z0-9-]+\.png$/i.test(config.imageUrl || "") ? config : null;
  }

  function showTestPreview(module, section, config, group) {
    const frame = document.createElement("div");
    frame.className = "homepage-live-ad";
    const label = document.createElement("p");
    label.textContent = `TESTANNONS · visningsplats ${group} av 3 · ingen riktig verksamhet`;
    const image = document.createElement("img");
    image.src = config.imageUrl;
    image.alt = "DinPuls testföretag – testannons, ingen riktig verksamhet";
    image.loading = "lazy";
    frame.append(label, image);
    module.replaceChildren(frame);
    section.dataset.testBannerPreview = String(group);
    section.hidden = false;
  }

  function municipality() {
    return window.DinPulsMunicipality?.getName?.() || window.DinPulsMunicipalityState?.getInitial?.() || new URLSearchParams(location.search).get("kommun") || "Åmål";
  }

  function inventory() {
    if (Array.isArray(window.DINPULS_AD_INVENTORY)) return Promise.resolve(window.DINPULS_AD_INVENTORY);
    if (!inventoryPromise) inventoryPromise = new Promise(resolve => {
      const script = document.createElement("script");
      script.src = "admin/ad-inventory.js?version=0.26.3";
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
    const key = `${selectedMunicipality}:${slotId}`;
    verifiedEmptySlots.delete(key);
    const base = await apiBase();
    if (!base || !slotId) return null;
    try {
      const url = `${base}/ads/current/${encodeURIComponent(slotId)}?municipality=${encodeURIComponent(selectedMunicipality)}`;
      let response;
      for (let attempt = 0; attempt < 2; attempt++) {
        try { response = await fetch(url, { cache: "no-store", signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined }); if (response.ok) break; }
        catch (error) { if (attempt === 1) throw error; }
      }
      if (!response.ok) return null;
      const data = await response.json();
      if (data.ok === true && data.banner === null) verifiedEmptySlots.add(key);
      return data.banner ? { ...data.banner, imageUrl: `${base}${data.banner.imageUrl}`, targetUrl: safeTarget(data.banner.targetUrl) } : null;
    } catch { return null; }
  }

  async function getCurrentBanners(slots, selectedMunicipality) {
    const base = await apiBase();
    if (!base) return new Map();
    try {
      const ids = slots.map(slot => slot.id);
      const response = await fetch(`${base}/ads/current?municipality=${encodeURIComponent(selectedMunicipality)}&slots=${encodeURIComponent(ids.join(","))}`, { cache: "no-store", signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined });
      const data = response.ok ? await response.json() : null;
      if (data?.ok === true && data.banners && ids.every(id => Object.hasOwn(data.banners, id))) {
        return new Map(ids.map(id => {
          const key = `${selectedMunicipality}:${id}`, banner = data.banners[id];
          verifiedEmptySlots.delete(key);
          if (banner === null) verifiedEmptySlots.add(key);
          return [id, banner ? { ...banner, imageUrl: `${base}${banner.imageUrl}`, targetUrl: safeTarget(banner.targetUrl) } : null];
        }));
      }
    } catch {}
    // Compatible with an older API deployment; failures never count as empty inventory.
    return new Map(await Promise.all(slots.map(async slot => [slot.id, await getCurrentBanner(slot.id, selectedMunicipality)])));
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
    const inlineSlots = slots.filter(slot => !slot.dataset.dynamicAd && (slot.dataset.adPosition === "3" || (category === "bostäder" && ["4", "5", "6"].includes(slot.dataset.adPosition))));
    const list = document.querySelector(listSelector);
    if (inlineSlots.length && list) {
      inlineObservers.get(list)?.disconnect();
      const placeInline = () => {
        const cards = [...list.children].filter(child => !child.hasAttribute("data-strategic-ad"));
        if (cards.length < 2) {
          if (inlineSlots.some(slot => slot.parentElement === list || !slot.isConnected)) list.after(...inlineSlots);
          return;
        }
        const groups = new Map();
        inlineSlots.forEach((slot, index) => {
          const anchor = cards[Math.min(cards.length - 1, Math.max(1, Math.floor(cards.length * (index + 1) / (inlineSlots.length + 1))))];
          if (!groups.has(anchor)) groups.set(anchor, []);
          groups.get(anchor).push(slot);
        });
        for (const [anchor, group] of groups) {
          let next = anchor;
          for (const slot of group.slice().reverse()) {
            if (slot.nextElementSibling !== next) list.insertBefore(slot, next);
            next = slot;
          }
        }
      };
      const observer = new MutationObserver(placeInline);
      observer.observe(list, { childList: true });
      inlineObservers.set(list, observer);
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
    if (section) delete section.dataset.testBannerPreview;
    if (host) host.hidden = true;
    return { host, section, module };
  }

  async function refreshHomepageGroup(group, batch) {
    const selectedMunicipality = municipality();
    const { host, section, module } = clearHomepageGroup(group);
    if (!host || !section || !module) return;
    const catalog = await inventory();
    const groupName = `premium-ad-${group}`;
    const slots = catalog.filter(item => item.group === groupName).sort((a, b) => a.position - b.position);
    const active = slots.map(slot => ({ slot, banner: batch?.municipality === selectedMunicipality ? batch.banners.get(slot.id) : null })).filter(item => item.banner);
    if (selectedMunicipality !== municipality()) return;
    const banners = [...new Map(active.map(item => [item.banner.id, item])).values()];
    if (!banners.length) {
      const config = await testPreview();
      if (selectedMunicipality !== municipality()) return;
      section.dataset.previewCheck = `${Boolean(config)}:${slots.length}:${slots.filter(slot => verifiedEmptySlots.has(`${municipality()}:${slot.id}`)).length}`;
      if (config && slots.length && slots.every(slot => verifiedEmptySlots.has(`${municipality()}:${slot.id}`))) {
        showTestPreview(module, section, config, group);
        host.hidden = false;
      }
      return;
    }
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

  function refreshHomepageAds() {
    homepageRefreshPending = true;
    if (homepageRefresh) return homepageRefresh;
    homepageRefresh = (async () => {
      while (homepageRefreshPending) {
        homepageRefreshPending = false;
        const selectedMunicipality = municipality();
        [1, 2, 3].forEach(clearHomepageGroup);
        const slots = (await inventory()).filter(slot => ["premium-ad-1", "premium-ad-2", "premium-ad-3"].includes(slot.group));
        const banners = await getCurrentBanners(slots, selectedMunicipality);
        if (municipality() !== selectedMunicipality) { homepageRefreshPending = true; continue; }
        await Promise.all([1, 2, 3].map(group => refreshHomepageGroup(group, { municipality: selectedMunicipality, banners })));
      }
    })().finally(() => { homepageRefresh = null; });
    return homepageRefresh;
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
