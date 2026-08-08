(function () {
  "use strict";

  function renderStrategicAds(category, pageLabel, listSelector) {
    const slots = [...document.querySelectorAll("[data-strategic-ad]")];
    slots.forEach(slot => {
      const position = Number(slot.dataset.adPosition || 1);
      const subject = encodeURIComponent(`Annonsplats ${category} ${position}`);
      slot.innerHTML = `<a class="secondary-ad strategic-ad" href="mailto:annonser@dinpuls.se?subject=${subject}"><b>ANNONSPLATS ${position}</b><strong>Ditt företag här</strong><small>På DinPuls ${pageLabel} · 500 kr/mån</small></a>`;
    });

    const inlineSlot = slots.find(slot => slot.dataset.adPosition === "3");
    const list = document.querySelector(listSelector);
    if (!inlineSlot || !list) return;

    const placeInline = () => {
      const cards = [...list.children].filter(child => child !== inlineSlot);
      if (cards.length < 4) return;
      const anchorIndex = Math.min(cards.length - 1, Math.max(2, Math.floor(cards.length / 2)));
      const anchor = cards[anchorIndex];
      if (anchor.previousElementSibling !== inlineSlot) list.insertBefore(inlineSlot, anchor);
    };

    new MutationObserver(placeInline).observe(list, { childList: true });
    queueMicrotask(placeInline);
  }

  window.DinPulsAds = Object.freeze({ renderStrategicAds });
  window.renderStrategicAds = renderStrategicAds;
})();
