(() => {
  "use strict";

  function installLoginFeedback() {
    const form = document.querySelector("#loginForm");
    const button = form?.querySelector(".login-button[type='submit']");
    const error = document.querySelector("#loginError");
    const loginView = document.querySelector("#loginView");
    if (!form || !button) return;

    const original = button.innerHTML;
    let safetyTimer = null;

    const reset = () => {
      if (safetyTimer) window.clearTimeout(safetyTimer);
      safetyTimer = null;
      button.disabled = false;
      button.classList.remove("is-login-loading");
      button.removeAttribute("aria-busy");
      button.innerHTML = original;
    };

    const start = () => {
      if (button.classList.contains("is-login-loading")) return;
      button.disabled = true;
      button.classList.add("is-login-loading");
      button.setAttribute("aria-busy", "true");
      button.innerHTML = '<span class="login-spinner" aria-hidden="true"></span><span>Loggar in…</span>';
      safetyTimer = window.setTimeout(() => {
        if (!loginView || !loginView.hidden) reset();
      }, 20000);
    };

    form.addEventListener("submit", start);

    if (error) {
      new MutationObserver(() => {
        if (!error.hidden) reset();
      }).observe(error, { attributes: true, attributeFilter: ["hidden"] });
    }

    if (loginView) {
      new MutationObserver(() => {
        if (!loginView.hidden && error && !error.hidden) reset();
      }).observe(loginView, { attributes: true, attributeFilter: ["hidden"] });
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    .login-button{transition:transform .14s ease,filter .14s ease,box-shadow .14s ease,opacity .14s ease}
    .login-button:active:not(:disabled){transform:translateY(2px) scale(.985);filter:brightness(.94)}
    .login-button.is-login-loading{display:flex;align-items:center;justify-content:center;gap:10px;cursor:wait;opacity:.92;box-shadow:inset 0 0 0 1px rgba(255,255,255,.16)}
    .login-button.is-login-loading:disabled{cursor:wait}
    .login-spinner{width:17px;height:17px;border:2px solid rgba(255,255,255,.38);border-top-color:#fff;border-radius:50%;animation:dinpuls-login-spin .72s linear infinite}
    @keyframes dinpuls-login-spin{to{transform:rotate(360deg)}}
    @media (prefers-reduced-motion:reduce){.login-button{transition:none}.login-spinner{animation-duration:1.4s}}
  `;
  document.head.appendChild(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installLoginFeedback);
  else installLoginFeedback();
})();
