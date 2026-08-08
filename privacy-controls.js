(function () {
  "use strict";
  const LOCAL_PREFIX = "dinpuls-";

  function clearLocalSettings() {
    const keys = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && key.startsWith(LOCAL_PREFIX)) keys.push(key);
      }
      keys.forEach(key => localStorage.removeItem(key));
    } catch {}
    document.querySelectorAll("[data-privacy-status]").forEach(status => {
      status.textContent = "Lokala inställningar har raderats på den här enheten.";
    });
    document.dispatchEvent(new CustomEvent("dinpuls:local-settings-cleared"));
  }

  function bindControls() {
    document.querySelectorAll("[data-clear-local-data]").forEach(button => {
      if (button.dataset.privacyBound) return;
      button.dataset.privacyBound = "true";
      button.addEventListener("click", clearLocalSettings);
    });
  }

  function addUtilityFooter() {
    if (document.querySelector("[data-component='footer'], .privacy-utility, body > footer")) return;
    const footer = document.createElement("footer");
    footer.className = "privacy-utility";
    footer.style.cssText = "display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:12px;padding:22px 16px;border-top:1px solid #dfe6ef;background:#fff;color:#52627a;font:600 13px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
    footer.innerHTML = '<a href="information.html#integritet">Integritet, kakor och lokal lagring</a><button type="button" data-clear-local-data>Rensa lokala inställningar</button><span data-privacy-status role="status" aria-live="polite"></span>';
    document.body.appendChild(footer);
  }

  function initialize() { addUtilityFooter(); bindControls(); }
  window.DinPulsPrivacy = { clearLocalSettings };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", initialize) : initialize();
  document.addEventListener("dinpuls:components-loaded", bindControls);
})();
