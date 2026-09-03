(function () {
  "use strict";

  /* Gemensamt färgläge: startsidans sparade val ska gälla på alla publika sidor. */
  (function applySavedTheme() {
    try {
      const savedTheme = localStorage.getItem("dinpuls-theme");
      if (savedTheme === "dark") document.documentElement.dataset.theme = "dark";
      else if (savedTheme === "light") document.documentElement.dataset.theme = "light";
    } catch {}
  })();

  window.addEventListener("storage", event => {
    if (event.key !== "dinpuls-theme") return;
    if (event.newValue === "dark") document.documentElement.dataset.theme = "dark";
    else if (event.newValue === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
  });

  /* Gemensamt säsongstema: privacy-controls.js finns på DinPuls publika sidor,
     så temat följer med även till undersidorna utan duplicerad HTML. */
  (function loadSeasonalTheme() {
    if (document.querySelector('link[data-dinpuls-seasonal-theme]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${location.pathname.includes("/innebandyregler/") ? "../" : ""}seasonal-theme.css?version=0.2.0`;
    link.dataset.dinpulsSeasonalTheme = "autumn";
    (document.head || document.documentElement).appendChild(link);
    document.documentElement.dataset.season = "autumn";
  })();

  const LOCAL_PREFIX = "dinpuls-";
  const CONSENT_KEY = "dinpuls-privacy-consent-v3";
  const ANALYTICS_ID = "G-TVLG1QMX8C";
  const ANALYTICS_SCRIPT_ID = "dinpuls-google-analytics";
  let analyticsStarted = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500
  });

  function selectedMunicipality() {
    return window.DinPulsMunicipality?.getName?.()
      || window.DinPulsMunicipalityState?.getInitial?.()
      || new URLSearchParams(location.search).get("kommun")
      || "Ej vald";
  }

  function safePageLocation() {
    const url = new URL(location.href);
    const municipality = new URLSearchParams(location.search).get("kommun");
    url.search = municipality ? `?kommun=${encodeURIComponent(municipality)}` : "";
    url.hash = "";
    return url.href;
  }

  function sendPageView() {
    if (!analyticsStarted || !analyticsAllowed()) return;
    window.gtag("event", "page_view", {
      page_title: document.title,
      page_location: safePageLocation(),
      municipality: selectedMunicipality()
    });
  }

  function startAnalytics() {
    if (analyticsStarted || !analyticsAllowed()) return;
    analyticsStarted = true;
    window[`ga-disable-${ANALYTICS_ID}`] = false;
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", ANALYTICS_ID, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_flags: "SameSite=Lax;Secure"
    });
    const script = document.createElement("script");
    script.id = ANALYTICS_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ANALYTICS_ID)}`;
    script.addEventListener("load", sendPageView, { once: true });
    (document.head || document.documentElement).appendChild(script);
  }

  function stopAnalytics() {
    window[`ga-disable-${ANALYTICS_ID}`] = true;
    window.gtag("consent", "update", { analytics_storage: "denied" });
    const cookieNames = ["_ga", `_ga_${ANALYTICS_ID.replace(/^G-/, "").replace(/-/g, "_")}`];
    cookieNames.forEach(name => {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.dinpuls.se; SameSite=Lax`;
    });
  }

  function getConsentState() {
    try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
  }

  function saveConsentState(value) {
    try { localStorage.setItem(CONSENT_KEY, value); } catch {}
    if (value === "analytics-accepted") startAnalytics(); else stopAnalytics();
    document.dispatchEvent(new CustomEvent("dinpuls:analytics-consent", { detail: { analytics: value === "analytics-accepted" } }));
  }

  function analyticsAllowed() {
    return getConsentState() === "analytics-accepted";
  }

  function clearLocalSettings() {
    const keys = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && key.startsWith(LOCAL_PREFIX)) keys.push(key);
      }
      keys.forEach(key => localStorage.removeItem(key));
    } catch {}
    stopAnalytics();
    document.querySelectorAll("[data-privacy-status]").forEach(status => {
      status.textContent = "Lokala inställningar och integritetsval har raderats på den här enheten.";
    });
    document.dispatchEvent(new CustomEvent("dinpuls:local-settings-cleared"));
    window.setTimeout(addPrivacyNotice, 50);
  }

  function closePrivacyNotice() {
    const notice = document.querySelector("[data-privacy-notice]");
    if (!notice) return;
    notice.classList.add("is-closing");
    window.setTimeout(() => notice.remove(), 180);
  }

  function chooseConsent(value) {
    saveConsentState(value);
    closePrivacyNotice();
  }

  function addPrivacyNotice(force) {
    if (document.body?.classList.contains("municipality-onboarding-open")) return;
    if ((!force && getConsentState()) || document.querySelector("[data-privacy-notice]")) return;

    if (!document.querySelector("style[data-privacy-notice-style]")) {
      const style = document.createElement("style");
      style.dataset.privacyNoticeStyle = "true";
      style.textContent = `
        .dp-privacy-notice{position:fixed!important;z-index:2147483647!important;left:16px!important;right:16px!important;bottom:16px!important;display:block!important;visibility:visible!important;opacity:1;max-width:760px;margin:auto;padding:18px 20px;border:1px solid #cfd9e8;border-radius:16px;background:#fff;color:#10213e;box-shadow:0 18px 55px rgba(8,38,83,.28);font:500 14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;transition:opacity .18s ease,transform .18s ease}
        .dp-privacy-notice.is-closing{opacity:0;transform:translateY(10px)}
        .dp-privacy-notice strong{display:block;margin:0 0 5px;color:#082653;font-size:16px}
        .dp-privacy-notice p{margin:0;color:#44536b}
        .dp-privacy-notice-actions{display:flex;align-items:center;gap:10px;margin-top:14px;flex-wrap:wrap}
        .dp-privacy-notice button,.dp-privacy-notice a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 15px;border-radius:10px;font:800 14px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-decoration:none;cursor:pointer}
        .dp-privacy-notice button{border:1px solid #0a57c7;background:#0a57c7;color:#fff}
        .dp-privacy-notice button[data-privacy-essential-only]{border-color:#cfd9e8;background:#fff;color:#0a57c7}
        .dp-privacy-notice a{border:0;background:transparent;color:#0a57c7;padding-left:4px;padding-right:4px}
        .dp-privacy-choice{border:0;background:transparent;color:inherit;text-decoration:underline;cursor:pointer;font:inherit}
        @media(max-width:520px){.dp-privacy-notice{left:10px!important;right:10px!important;bottom:10px!important;padding:16px}.dp-privacy-notice-actions>*{flex:1 1 145px}}
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    const notice = document.createElement("aside");
    notice.className = "dp-privacy-notice";
    notice.dataset.privacyNotice = "true";
    notice.setAttribute("role", "dialog");
    notice.setAttribute("aria-live", "polite");
    notice.setAttribute("aria-label", "Integritetsval för DinPuls");
    notice.innerHTML = `
      <strong>DinPuls använder lokal lagring och valfri statistik</strong>
      <p>Nödvändig lokal lagring används för exempelvis vald kommun och dina inställningar. Du kan också tillåta sammanställd besöksstatistik via Google Analytics. Statistik aktiveras inte utan ditt val.</p>
      <div class="dp-privacy-notice-actions">
        <button type="button" data-privacy-accept-analytics>Tillåt statistik</button>
        <button type="button" data-privacy-essential-only>Endast nödvändiga</button>
        <a href="${location.pathname.includes("/innebandyregler/") ? "../" : ""}information.html#integritet">Läs mer</a>
      </div>
    `;
    (document.body || document.documentElement).appendChild(notice);
    notice.querySelector("[data-privacy-accept-analytics]")?.addEventListener("click", () => chooseConsent("analytics-accepted"));
    notice.querySelector("[data-privacy-essential-only]")?.addEventListener("click", () => chooseConsent("essential-only"));
  }

  function bindControls() {
    document.querySelectorAll("[data-clear-local-data]").forEach(button => {
      if (button.dataset.privacyBound) return;
      button.dataset.privacyBound = "true";
      button.addEventListener("click", clearLocalSettings);
    });
    document.querySelectorAll("[data-change-privacy-choice]").forEach(button => {
      if (button.dataset.privacyChoiceBound) return;
      button.dataset.privacyChoiceBound = "true";
      button.addEventListener("click", () => {
        try { localStorage.removeItem(CONSENT_KEY); } catch {}
        addPrivacyNotice(true);
      });
    });
  }

  function ensurePrivacyChoiceControl() {
    if (document.querySelector("[data-change-privacy-choice]")) return;
    const footer = document.querySelector("footer");
    if (!footer) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dp-privacy-choice";
    button.dataset.changePrivacyChoice = "true";
    button.textContent = "Ändra integritetsval";
    footer.appendChild(button);
  }

  function addUtilityFooter() {
    if (document.querySelector("[data-component='footer'], .privacy-utility, body > footer")) return;
    const footer = document.createElement("footer");
    footer.className = "privacy-utility";
    footer.style.cssText = "display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:12px;padding:22px 16px;border-top:1px solid #dfe6ef;background:#fff;color:#52627a;font:600 13px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
    footer.innerHTML = '<a href="information.html#integritet">Integritet, kakor och lokal lagring</a><button type="button" data-change-privacy-choice>Ändra integritetsval</button><button type="button" data-clear-local-data>Rensa lokala inställningar</button><span data-privacy-status role="status" aria-live="polite"></span>';
    document.body.appendChild(footer);
  }

  function initialize() {
    addUtilityFooter();
    ensurePrivacyChoiceControl();
    bindControls();
    addPrivacyNotice(false);
    if (analyticsAllowed()) startAnalytics();
  }

  window.DinPulsPrivacy = {
    clearLocalSettings,
    showNotice: () => addPrivacyNotice(true),
    analyticsAllowed,
    getConsentState
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
  window.addEventListener("pageshow", () => addPrivacyNotice(false));
  document.addEventListener("dinpuls:components-loaded", () => {
    ensurePrivacyChoiceControl();
    bindControls();
  });
  document.addEventListener("dinpuls:municipality-onboarding-complete", () => addPrivacyNotice(false));
  document.addEventListener("dinpuls:municipalitychange", event => {
    if (!analyticsAllowed()) return;
    window.gtag("event", "municipality_change", { municipality: event.detail?.name || selectedMunicipality() });
    sendPageView();
  });
})();
