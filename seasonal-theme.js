/* DinPuls – gemensam säsongstema-laddare.
   Gör att samma hösttema används på startsidan och alla publika undersidor
   utan att varje portal behöver en egen kopia av temat. */
(() => {
  const href = "seasonal-theme.css?version=0.1.0";
  if (!document.querySelector('link[data-dinpuls-seasonal-theme]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.dinpulsSeasonalTheme = "autumn";
    document.head.appendChild(link);
  }

  document.documentElement.dataset.season = "autumn";

  const updateBadge = () => {
    const badge = document.querySelector("#seasonal-theme-badge");
    if (!badge) return;
    badge.title = "DinPuls hösttema";
    const label = badge.querySelector("span");
    if (label) label.textContent = "Höst";
    const icon = badge.querySelector("i[data-lucide]");
    if (icon) icon.setAttribute("data-lucide", "leaf");
    if (window.lucide) window.lucide.createIcons();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateBadge, { once: true });
  else updateBadge();
})();
