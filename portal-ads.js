(function () {
  "use strict";
  const CATEGORY_KEYS = Object.freeze({ bio: "BIO", "bostäder": "BOST", drivmedel: "DRIV", evenemang: "EVEN", jobb: "JOBB", lunch: "LUNCH", matkasse: "MAT", authorities: "MYND", myndigheter: "MYND", nyheter: "NYH", service: "SERV", trafik: "TRAF", vard: "VARD" });
  let apiBasePromise;
  const measuredImpressions = new Set();

  function municipality() {
    return window.DinPulsMunicipality?.getName?.() || window.DinPulsMunicipalityState?.getInitial?.() || new URLSearchParams(location.search).get("kommun") || "Åmål";
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
    link.href = banner.targetUrl || "mailto:annonser@dinpuls.se";
    if (banner.targetUrl) { link.target = "_blank"; link.rel = "noopener noreferrer sponsored"; }
    link.setAttribute("aria-label", `${label} – öppna annons`);
    const image = document.createElement("img");
    image.src = banner.imageUrl;
    image.alt = label;
    image.loading = "lazy";
    link.append(image);
    link.addEventListener("click", () => recordEvent(banner.id, "click"), { passive: true });
    slot.replaceChildren(link);
    slot.dataset.scheduledBanner = banner.id;
    measureImpression(slot, banner.id);
  }

  async function recordEvent(bannerId, eventType) {
    const base = await apiBase();
    if (!base || !bannerId) return;
    fetch(`${base}/ads/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bannerId, eventType }), keepalive: true }).catch(() => {});
  }

  function measureImpression(slot, bannerId) {
    if (measuredImpressions.has(bannerId)) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
      measuredImpressions.add(bannerId);
      observer.disconnect();
      recordEvent(bannerId, "impression");
    }, { threshold: 0.5 });
    observer.observe(slot);
  }

  async function enhanceStrategicSlot(slot) {
    const key = CATEGORY_KEYS[slot.dataset.strategicAd];
    const position = Number(slot.dataset.adPosition || 1);
    if (!key || !position) return;
    const banner = await getCurrentBanner(`${key}-${String(position).padStart(2, "0")}`);
    if (banner) showBanner(slot, banner, "Företagsannons");
  }

  async function refreshStrategicAds() {
    await Promise.all([...document.querySelectorAll("[data-strategic-ad]")].map(enhanceStrategicSlot));
  }

  function renderStrategicAds(category, pageLabel, listSelector) {
    const slots = [...document.querySelectorAll("[data-strategic-ad]")];
    slots.forEach(slot => {
      const position = Number(slot.dataset.adPosition || 1);
      const subject = encodeURIComponent(`Annonsplats ${category} ${position}`);
      slot.innerHTML = `<a class="secondary-ad strategic-ad" href="mailto:annonser@dinpuls.se?subject=${subject}"><b>ANNONSPLATS ${position}</b><strong>Ditt företag här</strong><small>På DinPuls ${pageLabel} · 500 kr/månad + moms</small></a>`;
    });
    const inlineSlot = slots.find(slot => slot.dataset.adPosition === "3");
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

  window.DinPulsAds = Object.freeze({ renderStrategicAds, getCurrentBanner, showBanner, refreshStrategicAds });
  window.renderStrategicAds = renderStrategicAds;
  const start = () => queueMicrotask(refreshStrategicAds);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  document.addEventListener("dinpuls:municipalitychange", () => window.setTimeout(refreshStrategicAds, 0));
})();
