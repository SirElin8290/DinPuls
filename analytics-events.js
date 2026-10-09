(function () {
  "use strict";
  function publicDestination(raw, base) {
    try {
      const url = new URL(raw, base);
      const origin = new URL(base).origin;
      if (url.origin !== origin || !/^https?:$/.test(url.protocol)) return null;
      if (/\/(?:admin|foretag\/index|foreningsadmin)(?:\/|\.|$)/.test(url.pathname)) return null;
      if (!/(?:\/|\.html)$/.test(url.pathname)) return null;
      const result = new URL(url.pathname, origin);
      for (const key of ["kommun", "slug"]) {
        const value = url.searchParams.get(key);
        if (key === "kommun" && value && /^[\p{L} -]{1,40}$/u.test(value)) result.searchParams.set(key, value);
        if (key === "slug" && /\/forening\.html$/.test(result.pathname) && value && /^[a-z0-9-]{1,160}$/.test(value)) result.searchParams.set(key, value);
      }
      return result.pathname + result.search;
    } catch { return null; }
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { publicDestination }; return; }
  function municipality() {
    return window.DinPulsMunicipality?.getName?.()
      || window.DinPulsMunicipalityState?.getInitial?.()
      || new URLSearchParams(location.search).get("kommun") || "Ej vald";
  }
  function recordNavigation(event) {
    if (!window.DinPulsPrivacy?.analyticsAllowed() || typeof window.gtag !== "function") return;
    const link = event.target.closest?.("a[href]");
    const card = event.target.closest?.("article.card, section.card, [data-analytics-module]");
    const cardRoutes = { evenemang: "evenemang.html", drivmedel: "drivmedel.html" };
    if (event.type === "keydown" && (link || event.target.closest?.("button,input,select,label") || !cardRoutes[card?.id])) return;
    if (link && (link.closest("form") || link.hasAttribute("download"))) return;
    if (!link && (!cardRoutes[card?.id] || event.target.closest?.("button,input,select,label"))) return;
    const raw = link?.href || `${cardRoutes[card.id]}?kommun=${encodeURIComponent(municipality())}`;
    const destination = publicDestination(raw, location.href);
    if (!destination) return;
    const current = publicDestination(location.href, location.href);
    if (destination === current) return; // Ignore local anchors and controls.
    const component = event.target.closest?.("[data-component]");
    const moduleId = card?.dataset.analyticsModule || card?.id || component?.dataset.component || "page";
    const params = {
      municipality: municipality(),
      module_id: moduleId.slice(0, 80),
      source_page: current,
      destination_page: destination,
      transport_type: "beacon"
    };
    window.gtag("event", "internal_link_click", params);
    if ((location.pathname === "/" || location.pathname === "/index.html") && (card || component && component.closest("main"))) {
      window.gtag("event", "module_click", params);
    }
  }
  document.addEventListener("click", recordNavigation, true);
  document.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") recordNavigation(event);
  }, true);
})();
