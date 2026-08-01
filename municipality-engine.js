/* Gemensamt kommunval för startsidan och alla undersidor. */
(() => {
  "use strict";

  const STORAGE_KEY = "dinpuls-municipality";
  const DEFAULT_NAME = "Åmål";
  const MUNICIPALITIES = Object.freeze([
    "Åmål", "Säffle", "Bengtsfors", "Mellerud", "Årjäng", "Arvika", "Grums"
  ]);

  const canonicalNames = new Map(
    MUNICIPALITIES.map(name => [name.toLocaleLowerCase("sv-SE"), name])
  );

  function normalize(value) {
    if (typeof value !== "string") return null;
    return canonicalNames.get(value.trim().toLocaleLowerCase("sv-SE")) || null;
  }

  function readStored() {
    try {
      return normalize(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  function persist(name) {
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      // Kommunvalet fungerar fortfarande under besöket om lagring är blockerad.
    }
  }

  function getInitial() {
    const requested = normalize(new URLSearchParams(location.search).get("kommun"));
    return requested || readStored() || DEFAULT_NAME;
  }

  function updateUrl(name, { replace = true } = {}) {
    const url = new URL(location.href);
    url.searchParams.set("kommun", name);
    const next = `${url.pathname}?${url.searchParams.toString()}${url.hash}`;
    history[replace ? "replaceState" : "pushState"](null, "", next);
  }

  function set(value, options = {}) {
    const name = normalize(value) || DEFAULT_NAME;
    persist(name);
    if (options.updateUrl !== false) updateUrl(name, options);
    if (options.dispatch !== false) {
      document.dispatchEvent(new CustomEvent("dinpuls:municipalitychange", {
        detail: { name }
      }));
    }
    return name;
  }

  function populateSelect(select, selected = getInitial()) {
    if (!select) return;
    select.innerHTML = MUNICIPALITIES
      .map(name => `<option value="${name}">${name}</option>`)
      .join("");
    select.value = normalize(selected) || DEFAULT_NAME;
  }

  window.DinPulsMunicipalityState = Object.freeze({
    STORAGE_KEY,
    DEFAULT_NAME,
    MUNICIPALITIES,
    normalize,
    getInitial,
    set,
    populateSelect,
    updateUrl
  });
})();
