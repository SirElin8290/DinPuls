(function () {
  "use strict";

  const LOCAL_PREFIX = "dinpuls-";
  const NOTICE_KEY = "dinpuls-privacy-notice-v2";

  function getNoticeState() {
    try { return localStorage.getItem(NOTICE_KEY); } catch { return null; }
  }

  function saveNoticeState() {
    try { localStorage.setItem(NOTICE_KEY, "acknowledged"); } catch {}
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
    document.querySelectorAll("[data-privacy-status]").forEach(status => {
      status.textContent = "Lokala inställningar har raderats på den här enheten.";
    });
    document.dispatchEvent(new CustomEvent("dinpuls:local-settings-cleared"));
    window.setTimeout(addPrivacyNotice, 50);
  }

  function closePrivacyNotice() {
    saveNoticeState();
    const notice = document.querySelector("[data-privacy-notice]");
    if (!notice) return;
    notice.classList.add("is-closing");
    window.setTimeout(() => notice.remove(), 180);
  }

  function addPrivacyNotice() {
    if (getNoticeState() || document.querySelector("[data-privacy-notice]")) return;

    if (!document.querySelector("style[data-privacy-notice-style]")) {
      const style = document.createElement("style");
      style.dataset.privacyNoticeStyle = "true";
      style.textContent = `
        .dp-privacy-notice{position:fixed!important;z-index:2147483647!important;left:16px!important;right:16px!important;bottom:16px!important;display:block!important;visibility:visible!important;opacity:1;max-width:720px;margin:auto;padding:18px 20px;border:1px solid #cfd9e8;border-radius:16px;background:#fff;color:#10213e;box-shadow:0 18px 55px rgba(8,38,83,.28);font:500 14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;transition:opacity .18s ease,transform .18s ease}
        .dp-privacy-notice.is-closing{opacity:0;transform:translateY(10px)}
        .dp-privacy-notice strong{display:block;margin:0 0 5px;color:#082653;font-size:16px}
        .dp-privacy-notice p{margin:0;color:#44536b}
        .dp-privacy-notice-actions{display:flex;align-items:center;gap:10px;margin-top:14px;flex-wrap:wrap}
        .dp-privacy-notice button,.dp-privacy-notice a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 15px;border-radius:10px;font:800 14px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-decoration:none;cursor:pointer}
        .dp-privacy-notice button{border:1px solid #0a57c7;background:#0a57c7;color:#fff}
        .dp-privacy-notice a{border:1px solid #cfd9e8;background:#fff;color:#0a57c7}
        @media(max-width:520px){.dp-privacy-notice{left:10px!important;right:10px!important;bottom:10px!important;padding:16px}.dp-privacy-notice-actions>*{flex:1 1 130px}}
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    const notice = document.createElement("aside");
    notice.className = "dp-privacy-notice";
    notice.dataset.privacyNotice = "true";
    notice.setAttribute("role", "dialog");
    notice.setAttribute("aria-live", "polite");
    notice.setAttribute("aria-label", "Information om lokal lagring");
    notice.innerHTML = `
      <strong>DinPuls sparar vissa val på din enhet</strong>
      <p>DinPuls använder lokal lagring för exempelvis vald kommun och dina inställningar. Vi använder inte spårnings- eller marknadsföringskakor. Informationen stannar i din webbläsare och kan rensas när som helst.</p>
      <div class="dp-privacy-notice-actions">
        <button type="button" data-privacy-notice-ok>Jag förstår</button>
        <a href="information.html#integritet">Läs mer</a>
      </div>
    `;
    (document.body || document.documentElement).appendChild(notice);
    notice.querySelector("[data-privacy-notice-ok]")?.addEventListener("click", closePrivacyNotice);
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

  function initialize() {
    addUtilityFooter();
    bindControls();
    addPrivacyNotice();
  }

  window.DinPulsPrivacy = { clearLocalSettings, showNotice: addPrivacyNotice };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
  window.addEventListener("pageshow", addPrivacyNotice);
  document.addEventListener("dinpuls:components-loaded", bindControls);
})();
