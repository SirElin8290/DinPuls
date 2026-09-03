(() => {
  "use strict";

  function makeSlot(category, position, pageLabel) {
    const slot = document.createElement("div");
    slot.className = "strategic-ad-slot dynamic-strategic-ad";
    slot.dataset.strategicAd = category;
    slot.dataset.adPosition = String(position);
    slot.dataset.dynamicAd = "true";
    const subject = encodeURIComponent(`Annonsplats ${category} ${position}`);
    slot.innerHTML = `<a class="secondary-ad strategic-ad" href="mailto:annons@dinpuls.se?subject=${subject}"><b>ANNONSPLATS ${position}</b><strong>Ditt företag här</strong><small>På DinPuls ${pageLabel} · 500 kr/månad + moms</small></a>`;
    return slot;
  }

  function refresh() {
    window.DinPulsAds?.refreshStrategicAds?.();
  }

  function sportAdKey(sport) {
    return String(sport || "sport")
      .toLocaleLowerCase("sv-SE")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  let sportSignature = "";
  function placeSportAds() {
    const main = document.querySelector("main.sport-hub");
    const view = document.querySelector("#sport-hub-view");
    const summary = document.querySelector("#sport-hub-summary");
    if (!main || !view || !summary) return;
    const modules = [...view.querySelectorAll(":scope > .activity-module")];
    if (!modules.length) return;

    const sports = modules.map(module => module.querySelector("h2")?.textContent?.trim() || "").filter(Boolean);
    const isSingleSport = modules.length === 1 && sports.length === 1;
    const expectedSlots = isSingleSport ? 3 : 4;
    const signature = `${sports.join("|")}::${isSingleSport ? "single" : "hub"}`;
    if (signature === sportSignature && document.querySelectorAll('[data-dynamic-page="sport"]').length === expectedSlots) return;
    sportSignature = signature;

    document.querySelectorAll('[data-dynamic-page="sport"]').forEach(slot => slot.remove());

    if (isSingleSport) {
      const sport = sports[0];
      const municipality = document.querySelector("#sport-hub-place")?.textContent?.trim();
      const pageLabel = municipality ? `${sport} i ${municipality}` : sport;
      const category = `sport-${sportAdKey(sport)}`;
      const slots = Array.from({ length: 3 }, (_, index) => {
        const slot = makeSlot(category, index + 1, pageLabel);
        slot.dataset.dynamicPage = "sport";
        slot.dataset.sportAd = sport;
        return slot;
      });

      summary.after(slots[0]);
      modules[0].after(slots[1]);
      view.after(slots[2]);
      refresh();
      return;
    }

    const slots = Array.from({ length: 4 }, (_, index) => {
      const slot = makeSlot("sport", index + 1, "Idrott & motion");
      slot.dataset.dynamicPage = "sport";
      return slot;
    });

    summary.after(slots[0]);
    const firstIndex = Math.max(0, Math.round((modules.length - 1) * 0.33));
    const secondIndex = Math.max(firstIndex + 1, Math.round((modules.length - 1) * 0.67));
    modules[Math.min(firstIndex, modules.length - 1)].after(slots[1]);
    modules[Math.min(secondIndex, modules.length - 1)].after(slots[2]);
    view.after(slots[3]);
    refresh();
  }

  let leisureSignature = "";
  function placeLeisureAds() {
    const view = document.querySelector("#leisure-view");
    const crosslink = document.querySelector(".leisure-crosslink");
    if (!view || !crosslink) return;

    const modules = [...view.querySelectorAll(":scope > .leisure-module")];
    const signature = modules.map(module => module.querySelector("h2")?.textContent || "").join("|");
    if (!modules.length || (signature === leisureSignature && document.querySelectorAll('[data-dynamic-page="fritid"]').length === 4)) return;
    leisureSignature = signature;

    document.querySelectorAll('[data-dynamic-page="fritid"]').forEach(slot => slot.remove());
    document.querySelectorAll('[data-dynamic-ad-row="fritid"]').forEach(row => row.remove());

    view.classList.toggle("leisure-view-single", modules.length === 1);

    const slots = Array.from({ length: 4 }, (_, index) => {
      const slot = makeSlot("fritid", index + 1, "Fritid & föreningsliv");
      slot.dataset.dynamicPage = "fritid";
      return slot;
    });

    const topRow = document.createElement("section");
    topRow.className = "leisure-ad-row leisure-ad-row-top";
    topRow.dataset.dynamicAdRow = "fritid";
    topRow.setAttribute("aria-label", "Annonsplatser");
    topRow.append(slots[0], slots[1]);

    const bottomRow = document.createElement("section");
    bottomRow.className = "leisure-ad-row leisure-ad-row-bottom";
    bottomRow.dataset.dynamicAdRow = "fritid";
    bottomRow.setAttribute("aria-label", "Annonsplatser");
    bottomRow.append(slots[2], slots[3]);

    crosslink.after(topRow);
    view.after(bottomRow);
    refresh();
  }

  function observe(selector, callback) {
    const target = document.querySelector(selector);
    if (!target) return;
    new MutationObserver(callback).observe(target, { childList: true });
    callback();
  }

  const start = () => {
    if (document.documentElement.dataset.portal === "sport") observe("#sport-hub-view", placeSportAds);
    if (document.documentElement.dataset.portal === "leisure") observe("#leisure-view", placeLeisureAds);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
