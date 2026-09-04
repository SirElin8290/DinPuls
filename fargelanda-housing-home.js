(() => {
  "use strict";

  const MUNICIPALITY = "Färgelanda";
  const SUPPLEMENT_URL = "data/housing-fargelanda-supplement.json";
  let supplement = null;
  let applying = false;

  function currentMunicipality() {
    try {
      if (typeof DinPulsMunicipality !== "undefined" && DinPulsMunicipality?.getName) {
        return DinPulsMunicipality.getName();
      }
    } catch {}
    return window.DinPulsMunicipalityState?.getInitial?.() || "";
  }

  function applySupplement() {
    if (applying || !supplement || currentMunicipality() !== MUNICIPALITY) return false;
    try {
      if (typeof housingData === "undefined" || !housingData?.municipalities) return false;
      applying = true;
      housingData.municipalities[MUNICIPALITY] = {
        ...supplement,
        checkedAt: supplement.sourceChecked ? `${supplement.sourceChecked}T12:00:00+02:00` : undefined,
        updatedAt: supplement.sourceChecked ? `${supplement.sourceChecked}T12:00:00+02:00` : undefined
      };
      if (typeof renderHousing === "function") renderHousing();
      return true;
    } catch (error) {
      console.error("Färgelandas bostadstillägg kunde inte visas:", error);
      return false;
    } finally {
      applying = false;
    }
  }

  async function loadSupplement() {
    try {
      const response = await fetch(SUPPLEMENT_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      supplement = await response.json();
      if (!Array.isArray(supplement?.listings) || supplement.listings.length === 0) {
        throw new Error("Bostadstillägget saknar objekt");
      }
      if (!applySupplement()) {
        let attempts = 0;
        const timer = setInterval(() => {
          attempts += 1;
          if (applySupplement() || attempts >= 30) clearInterval(timer);
        }, 200);
      }
    } catch (error) {
      console.error("Färgelandas bostadstillägg kunde inte laddas:", error);
    }
  }

  document.addEventListener("dinpuls:municipalitychange", event => {
    const name = event.detail?.municipality?.name || event.detail?.name || currentMunicipality();
    if (name === MUNICIPALITY) queueMicrotask(applySupplement);
  });

  document.addEventListener("dinpuls:components-loaded", () => {
    if (!supplement) loadSupplement();
  }, { once: true });

  loadSupplement();
})();
