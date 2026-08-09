(function initializeDinPulsSecurity(root) {
  "use strict";

  const HTML_ENTITIES = Object.freeze({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  });
  const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:"]);
  const SAFE_HREF_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
  const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
  const ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => HTML_ENTITIES[character]);
  }

  function normalizeUrl(value, { protocols, allowRelative, fallback }) {
    const candidate = String(value ?? "").trim();
    if (!candidate || CONTROL_CHARACTERS.test(candidate)) return fallback;

    try {
      const base = "https://dinpuls.se/";
      const parsed = new URL(candidate, base);
      const relative = !/^[a-z][a-z0-9+.-]*:/i.test(candidate) && !candidate.startsWith("//");
      if (relative && !allowRelative) return fallback;
      if (!protocols.has(parsed.protocol)) return fallback;
      if (["http:", "https:"].includes(parsed.protocol) && !parsed.hostname) return fallback;
      return candidate;
    } catch {
      return fallback;
    }
  }

  function safeExternalUrl(value, fallback = "#") {
    return normalizeUrl(value, {
      protocols: SAFE_EXTERNAL_PROTOCOLS,
      allowRelative: false,
      fallback
    });
  }

  function safeHref(value, fallback = "#") {
    return normalizeUrl(value, {
      protocols: SAFE_HREF_PROTOCOLS,
      allowRelative: true,
      fallback
    });
  }

  function safeIconName(value, fallback = "circle-dot") {
    const candidate = String(value ?? "").trim().toLowerCase();
    return ICON_NAME.test(candidate) ? candidate : fallback;
  }

  const api = Object.freeze({
    escapeHtml,
    escapeAttribute: escapeHtml,
    safeExternalUrl,
    safeHref,
    safeIconName
  });

  root.DinPulsSecurity = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
