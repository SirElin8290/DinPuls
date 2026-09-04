(() => {
  const MUNICIPALITY = "Färgelanda";
  const SUPPLEMENT_URL = "data/events-fargelanda-supplement.json";
  let supplement = null;

  const escapeHtml = window.DinPulsCore?.escapeHtml || (value => String(value ?? ""));
  const stockholmDateKey = window.DinPulsCore?.stockholmDateKey || (() => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date()));

  function selectedMunicipality() {
    return window.DinPulsMunicipalityState?.getInitial?.() || "";
  }

  function formatDateBox(item) {
    const startKey = String(item.startDate || "").slice(0, 10);
    const endKey = String(item.endDate || item.startDate || "").slice(0, 10);
    const today = stockholmDateKey();
    const ongoing = startKey < today && endKey >= today;
    const date = new Date(`${startKey}T12:00:00`);
    const endDate = new Date(`${endKey}T12:00:00`);

    if (ongoing) {
      const endLabel = Number.isNaN(endDate.getTime()) ? endKey : endDate.toLocaleDateString("sv-SE", {
        timeZone: "Europe/Stockholm",
        day: "numeric",
        month: "short"
      });
      return `<time><b>Nu</b>${escapeHtml(`till ${endLabel}`)}</time>`;
    }

    const day = Number.isNaN(date.getTime()) ? "–" : date.toLocaleDateString("sv-SE", {
      timeZone: "Europe/Stockholm",
      day: "numeric"
    });
    const month = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("sv-SE", {
      timeZone: "Europe/Stockholm",
      month: "short"
    }).replace(".", "");
    return `<time><b>${escapeHtml(day)}</b>${escapeHtml(month)}</time>`;
  }

  function renderPreview(item) {
    return `<li>${formatDateBox(item)}<span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml([item.time, item.venue, item.sourceName].filter(Boolean).join(" · "))}</small></span></li>`;
  }

  function render() {
    if (!supplement || selectedMunicipality() !== MUNICIPALITY) return;

    const today = stockholmDateKey();
    const events = (supplement.events || [])
      .filter(item => String(item.endDate || item.startDate || "").slice(0, 10) >= today)
      .sort((a, b) => String(a.startDate || "").localeCompare(String(b.startDate || "")));
    if (!events.length) return;

    const list = document.querySelector("#events-list");
    const loading = document.querySelector("#events-loading");
    const empty = document.querySelector("#events-empty");
    const total = document.querySelector("#events-total");
    const pageLink = document.querySelector("#events-page-link");

    if (!list || !empty) return;

    if (loading) loading.hidden = true;
    list.innerHTML = events.slice(0, 4).map(renderPreview).join("");
    list.hidden = false;
    empty.hidden = true;
    if (total) total.textContent = `${events.length} kommande · verifierad kommunkälla`;
    if (pageLink) pageLink.href = `evenemang.html?kommun=${encodeURIComponent(MUNICIPALITY)}`;

    document.querySelectorAll("[data-quick-events-title]").forEach(element => {
      element.textContent = `${events.length} evenemang i ${MUNICIPALITY}`;
    });
    document.querySelectorAll("[data-quick-events-detail]").forEach(element => {
      element.textContent = `${events[0].startDate} · ${events[0].title}`;
    });

    if (window.lucide) window.lucide.createIcons();
  }

  async function load() {
    try {
      const response = await fetch(SUPPLEMENT_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      supplement = await response.json();
      render();
    } catch (error) {
      console.error("Färgelandas evenemangskomplettering kunde inte laddas:", error);
    }
  }

  document.addEventListener("dinpuls:components-loaded", render);
  document.addEventListener("dinpuls:municipalitychange", () => queueMicrotask(render));
  load();
})();
