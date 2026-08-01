/* =========================================================
   DINPULS.SE v0.20.9
   Central kommunmotor, komponenter och datamoduler
========================================================= */

const DINPULS_VERSION = "0.20.9";
const DEFAULT_MUNICIPALITY = window.DinPulsMunicipalityState?.DEFAULT_NAME || "Åmål";

const componentNames = [
  "header",
  "quick-strip",
  "navigation",
  "lunch-strip",
  "hero",
  "premium-ad-1",
  "primary-cards",
  "transport",
  "sport",
  "secondary-cards",
  "premium-ad-2",
  "jobs-housing",
  "grocery",
  "premium-ad-3",
  "footer"
];

const DinPulsMunicipality = {
  currentName: DEFAULT_MUNICIPALITY,
  defaultName: DEFAULT_MUNICIPALITY,
  municipalities: new Map(),
  subscribers: new Map(),

  async initialize() {
    const response = await fetch(`data/municipalities.json?version=${DINPULS_VERSION}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Kommunfilen kunde inte laddas: ${response.status}`);
    }

    const data = await response.json();
    const municipalities = Array.isArray(data.municipalities)
      ? data.municipalities
      : [];

    if (municipalities.length === 0) {
      throw new Error("Kommunfilen innehåller inga kommuner.");
    }

    this.municipalities = new Map(
      municipalities
        .filter((item) => item?.name)
        .map((item) => [item.name, Object.freeze({ ...item })])
    );
    this.defaultName = this.municipalities.has(data.defaultMunicipality)
      ? data.defaultMunicipality
      : municipalities[0].name;

    const savedName = window.DinPulsMunicipalityState?.getInitial()
      || this.defaultName;
    this.currentName = this.isValid(savedName) ? savedName : this.defaultName;

    if (savedName && !this.isValid(savedName)) {
      try { localStorage.removeItem("dinpuls-municipality"); } catch {}
    }
  },

  isValid(name) {
    return typeof name === "string" && this.municipalities.has(name);
  },

  getName() {
    return this.currentName;
  },

  getConfig(name = this.currentName) {
    return this.municipalities.get(name) || this.municipalities.get(this.defaultName);
  },

  getAll() {
    return [...this.municipalities.values()];
  },

  subscribe(moduleName, handler) {
    this.subscribers.set(moduleName, handler);
  },

  async setMunicipality(name, { persist = true, force = false } = {}) {
    const validName = this.isValid(name) ? name : this.defaultName;

    if (!force && validName === this.currentName) {
      if (persist) {
        window.DinPulsMunicipalityState?.set(validName, { updateUrl: false, dispatch: false });
      }
      return;
    }

    this.currentName = validName;

    if (persist) {
      window.DinPulsMunicipalityState?.set(validName, { updateUrl: false, dispatch: false });
    }

    const config = this.getConfig();
    applyMunicipality(config);

    const results = await Promise.allSettled(
      [...this.subscribers.entries()].map(async ([moduleName, handler]) => {
        try {
          await handler(config);
        } catch (error) {
          console.error(`Kommunuppdateringen misslyckades i ${moduleName}:`, error);
          throw error;
        }
      })
    );

    updateMunicipalityLinks(config.name);
    document.dispatchEvent(new CustomEvent("dinpuls:municipalitychange", {
      detail: { municipality: config, results }
    }));
  }
};

const WEATHER_SYMBOLS = {
  1:  { emoji: "☀️", text: "Klart" },
  2:  { emoji: "🌤️", text: "Nästan klart" },
  3:  { emoji: "🌤️", text: "Växlande molnighet" },
  4:  { emoji: "⛅", text: "Halvklart" },
  5:  { emoji: "🌥️", text: "Molnigt" },
  6:  { emoji: "☁️", text: "Mulet" },
  7:  { emoji: "🌫️", text: "Dimma" },
  8:  { emoji: "🌦️", text: "Lätta regnskurar" },
  9:  { emoji: "🌦️", text: "Regnskurar" },
  10: { emoji: "🌧️", text: "Kraftiga regnskurar" },
  11: { emoji: "⛈️", text: "Åskskurar" },
  12: { emoji: "🌨️", text: "Lätta byar av snöblandat regn" },
  13: { emoji: "🌨️", text: "Byar av snöblandat regn" },
  14: { emoji: "🌨️", text: "Kraftiga byar av snöblandat regn" },
  15: { emoji: "🌨️", text: "Lätta snöbyar" },
  16: { emoji: "🌨️", text: "Snöbyar" },
  17: { emoji: "❄️", text: "Kraftiga snöbyar" },
  18: { emoji: "🌧️", text: "Lätt regn" },
  19: { emoji: "🌧️", text: "Regn" },
  20: { emoji: "🌧️", text: "Kraftigt regn" },
  21: { emoji: "⛈️", text: "Åska" },
  22: { emoji: "🌨️", text: "Lätt snöblandat regn" },
  23: { emoji: "🌨️", text: "Snöblandat regn" },
  24: { emoji: "🌨️", text: "Kraftigt snöblandat regn" },
  25: { emoji: "🌨️", text: "Lätt snöfall" },
  26: { emoji: "❄️", text: "Snöfall" },
  27: { emoji: "❄️", text: "Kraftigt snöfall" }
};

const WEATHER_REFRESH_INTERVAL = 30 * 60 * 1000;
const WEATHER_CACHE_MAX_AGE = 6 * 60 * 60 * 1000;
const STOCKHOLM_DATE_FORMAT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});


async function loadComponent(name) {
  const target = document.querySelector(`[data-component="${name}"]`);

  if (!target) {
    return;
  }

  const response = await fetch(`components/${name}.html?version=${DINPULS_VERSION}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Kunde inte ladda komponenten ${name}`);
  }

  target.innerHTML = await response.text();
}

async function startDinPuls() {
  try {
    initializeSeasonalTheme();
    await Promise.all(componentNames.map(loadComponent));
    await DinPulsMunicipality.initialize();

    if (window.lucide) {
      lucide.createIcons();
    }

    initializeTabs();
    initializeSearch();
    initializeClock();
    await initializeNameDay();
    initializeTheme();
    initializeSeasonalTheme();
    initializeMobileMenu();
    initializeTrafficCardLink();
    initializeRotatingAds();
    initializeMunicipality();
    initializeWeather();
    await Promise.all([initializeImportant(), initializeTraffic(), initializeNews(), initializeTransport(), initializeSports(), initializeJobs(), initializeHousing(), initializeEvents(), initializeLunch()]);
    initializeNotifications();
    await DinPulsMunicipality.setMunicipality(
      DinPulsMunicipality.getName(),
      { persist: false, force: true }
    );
  } catch (error) {
    console.error("DinPuls kunde inte starta:", error);
  }
}


async function initializeNameDay() {
  const dateParts = Object.fromEntries(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Stockholm",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date()).filter(part => part.type !== "literal").map(part => [part.type, part.value])
  );
  const dateKey = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  const cacheKey = `dinpuls-nameday-${dateKey}`;
  let dayData = null;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) dayData = JSON.parse(cached);
  } catch {}

  try {
    const response = await fetch(
      `https://sholiday.faboul.se/dagar/v2.1/${dateParts.year}/${dateParts.month}/${dateParts.day}`,
      { cache: "no-store" }
    );
    if (!response.ok) throw new Error(`Namnsdags-API svarade ${response.status}`);
    const payload = await response.json();
    dayData = payload?.dagar?.[0] || dayData;
    if (dayData) localStorage.setItem(cacheKey, JSON.stringify(dayData));
  } catch (error) {
    console.warn("Namnsdagen kunde inte uppdateras:", error);
  }

  const names = Array.isArray(dayData?.namnsdag) ? dayData.namnsdag.filter(Boolean) : [];
  const title = names.length ? `Namnsdag: ${names.join(" och ")}` : "Ingen namnsdag i dag";
  const detail = dayData?.veckodag
    ? `${dayData.veckodag} ${Number(dateParts.day)} ${new Intl.DateTimeFormat("sv-SE", { month: "long", timeZone: "Europe/Stockholm" }).format(new Date())}`
    : "Svensk almanacka";

  document.querySelectorAll("[data-nameday-title]").forEach(element => { element.textContent = title; });
  document.querySelectorAll("[data-nameday-detail]").forEach(element => { element.textContent = detail; });
}

function initializeTabs() {
  document.querySelectorAll(".tabs, .text-tabs").forEach((group) => {
    group.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        group.querySelectorAll("button").forEach((item) => {
          item.classList.remove("active");
        });

        button.classList.add("active");
      });
    });
  });
}

function initializeSearch() {
  const form = document.querySelector(".search");

  if (!form) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = form.querySelector("input").value.trim().toLocaleLowerCase("sv-SE");
    if (!value) return;
    const municipality = encodeURIComponent(DinPulsMunicipality.getName());
    const destinations = [
      { terms: ["jobb", "arbete", "lediga jobb"], url: `jobb.html?kommun=${municipality}` },
      { terms: ["bostad", "bostäder", "lägenhet", "hyresrätt"], url: `bostader.html?kommun=${municipality}` },
      { terms: ["lunch", "restaurang", "dagens lunch"], url: `lunch.html?kommun=${municipality}` },
      { terms: ["evenemang", "event", "kalender"], url: `evenemang.html?kommun=${municipality}` },
      { terms: ["sport", "matcher", "resultat", "tabell"], url: `sport.html?kommun=${municipality}` },
      { terms: ["matkasse", "matpriser", "baskasse"], url: `matkasse.html?kommun=${municipality}&kasse=bas` },
      { terms: ["trafik", "vägarbete", "trafikläge"], url: `trafik.html?kommun=${municipality}` },
      { terms: ["buss", "tåg", "avgång", "kollektivtrafik"], url: "#kollektivtrafik" },
      { terms: ["väder", "prognos"], url: "#vader" },
      { terms: ["nyheter", "lokala nyheter"], url: "#nyheter" },
      { terms: ["annonsera", "annons"], url: "information.html#annonsera" },
      { terms: ["kontakt", "feedback", "integritet", "om oss"], url: `information.html#${value.includes("integritet") ? "integritet" : value.includes("feedback") ? "feedback" : value.includes("om ") ? "om" : "kontakt"}` }
    ];
    const match = destinations.find(item => item.terms.some(term => value.includes(term)));
    const feedback = document.querySelector("#search-feedback");
    if (match) {
      window.location.href = match.url;
      return;
    }
    if (feedback) {
      feedback.textContent = "Ingen modul matchade. Prova jobb, bostäder, lunch, evenemang, sport, trafik, buss, väder eller nyheter.";
      feedback.hidden = false;
      window.setTimeout(() => { feedback.hidden = true; }, 7000);
    }
  });
}

function initializeFuelCardLink() {
  const card = document.querySelector("#drivmedel");
  if (!card) return;
  card.classList.add("is-clickable-card");
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", "Öppna tankning och billaddning för vald kommun");

  const openFuelPage = () => {
    const link = document.querySelector("#fuel-page-link");
    window.location.href = link?.href || `drivmedel.html?kommun=${encodeURIComponent(DinPulsMunicipality.getName())}`;
  };

  card.addEventListener("click", event => {
    if (event.target.closest("a, button, input, select, label")) return;
    openFuelPage();
  });
  card.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("a, button, input, select")) return;
    event.preventDefault();
    openFuelPage();
  });
}

function initializeTrafficCardLink() {
  const card = document.querySelector("#trafik");
  if (!card) return;
  card.classList.add("is-clickable-card");
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", "Öppna trafikläget för vald kommun");
  const openTrafficPage = () => location.href = `trafik.html?kommun=${encodeURIComponent(DinPulsMunicipality.getName())}`;
  card.addEventListener("click", event => { if (!event.target.closest("a,button,input,select,label")) openTrafficPage(); });
  card.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && !event.target.closest("a,button,input,select")) {
      event.preventDefault(); openTrafficPage();
    }
  });
}

function initializeClock() {
  const element = document.querySelector("#live-clock");

  if (!element) {
    return;
  }

  function updateClock() {
    element.textContent = new Date().toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  updateClock();
  window.setInterval(updateClock, 1000);
}

/* =========================================================
   DINPULS v0.17.0 – AUTOMATISKA ÅRSTIDS- OCH HÖGTIDSTEMAN
========================================================= */
function initializeSeasonalTheme() {
  const root = document.documentElement;
  const stockholmParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date()).reduce((parts, part) => {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
    return parts;
  }, {});
  const { year, month, day } = stockholmParts;
  const current = new Date(Date.UTC(year, month - 1, day));
  const season = month >= 3 && month <= 5
    ? "spring"
    : month >= 6 && month <= 8
      ? "summer"
      : month >= 9 && month <= 11
        ? "autumn"
        : "winter";
  const special = resolveSpecialTheme(current);

  root.dataset.season = season;
  if (special) {
    root.dataset.specialTheme = special.id;
  } else {
    delete root.dataset.specialTheme;
  }

  const seasonLabels = {
    spring: { label: "Vår", icon: "sprout" },
    summer: { label: "Sommar", icon: "sun" },
    autumn: { label: "Höst", icon: "leaf" },
    winter: { label: "Vinter", icon: "snowflake" }
  };
  const display = special || seasonLabels[season];
  const badge = document.querySelector("#seasonal-theme-badge");
  if (badge) {
    badge.innerHTML = `<i data-lucide="${escapeAttribute(display.icon)}"></i><span>${escapeHtml(display.label)}</span>`;
    badge.title = special
      ? `${display.label} – tillfälligt DinPuls-tema`
      : `${display.label} – automatiskt årstidstema`;
  }
}

function resolveSpecialTheme(current) {
  const year = current.getUTCFullYear();
  const month = current.getUTCMonth() + 1;
  const day = current.getUTCDate();
  const dayKey = month * 100 + day;
  const daysBetween = (first, second) => Math.round((first - second) / 86400000);
  const lastSunday = (monthIndex) => {
    const date = new Date(Date.UTC(year, monthIndex + 1, 0));
    date.setUTCDate(date.getUTCDate() - date.getUTCDay());
    return date;
  };
  const nthSunday = (monthIndex, nth) => {
    const date = new Date(Date.UTC(year, monthIndex, 1));
    date.setUTCDate(1 + ((7 - date.getUTCDay()) % 7) + (nth - 1) * 7);
    return date;
  };
  const midsummer = new Date(Date.UTC(year, 5, 19));
  midsummer.setUTCDate(19 + ((5 - midsummer.getUTCDay() + 7) % 7));
  const easter = calculateGregorianEaster(year);
  const easterOffset = daysBetween(current, easter);

  if (dayKey === 1231 || dayKey === 101) return { id: "new-year", label: "Nyår", icon: "sparkles" };
  if (dayKey >= 1220 && dayKey <= 1230) return { id: "christmas", label: "Jul", icon: "gift" };
  if (dayKey === 1213) return { id: "lucia", label: "Lucia", icon: "flame" };
  if (dayKey >= 213 && dayKey <= 214) return { id: "valentine", label: "Alla hjärtans dag", icon: "heart" };
  if (easterOffset >= -2 && easterOffset <= 1) return { id: "easter", label: "Påsk", icon: "egg" };
  if (dayKey === 504) return { id: "may-fourth", label: "May the 4th", icon: "orbit" };
  if (current.getTime() === lastSunday(4).getTime()) return { id: "mothers-day", label: "Mors dag", icon: "heart-handshake" };
  if (daysBetween(current, midsummer) >= 0 && daysBetween(current, midsummer) <= 1) return { id: "midsummer", label: "Midsommar", icon: "flower-2" };
  if (dayKey === 1004) return { id: "cinnamon-bun", label: "Kanelbullens dag", icon: "cookie" };
  if (dayKey >= 1029 && dayKey <= 1031) return { id: "halloween", label: "Halloween", icon: "ghost" };
  if (current.getTime() === nthSunday(10, 2).getTime()) return { id: "fathers-day", label: "Fars dag", icon: "heart-handshake" };
  return null;
}

function calculateGregorianEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function initializeTheme() {
  const root = document.documentElement;
  const button = document.querySelector("#theme-toggle");
  const savedTheme = localStorage.getItem("dinpuls-theme");

  if (savedTheme === "dark") {
    root.dataset.theme = "dark";
  }

  function refreshThemeIcon() {
    if (!button) {
      return;
    }

    button.innerHTML =
      root.dataset.theme === "dark"
        ? '<i data-lucide="sun"></i>'
        : '<i data-lucide="moon"></i>';

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  refreshThemeIcon();

  button?.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("dinpuls-theme", root.dataset.theme);
    refreshThemeIcon();
  });
}

/* =========================================================
   DINPULS v0.17.1 – LOKALT NOTISCENTER UTAN INLOGGNING
========================================================= */
let currentNotificationItems = [];

function initializeNotifications() {
  const button = document.querySelector("#notification-button");
  const panel = document.querySelector("#notification-panel");
  const close = document.querySelector("#notification-close");
  const markRead = document.querySelector("#notification-mark-read");
  if (!button || !panel) return;

  const setOpen = (open) => {
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (open && window.lucide) lucide.createIcons();
  };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(panel.hidden);
  });
  close?.addEventListener("click", () => setOpen(false));
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
  markRead?.addEventListener("click", () => {
    saveSeenNotifications(
      DinPulsMunicipality.getName(),
      currentNotificationItems.map((item) => item.key)
    );
    renderNotifications(DinPulsMunicipality.getName());
  });
  panel.addEventListener("click", (event) => {
    const link = event.target.closest("[data-notification-key]");
    if (!link) return;
    saveSeenNotifications(DinPulsMunicipality.getName(), [link.dataset.notificationKey]);
  });

  DinPulsMunicipality.subscribe("notifications", (config) => {
    renderNotifications(config.name);
  });
  renderNotifications(DinPulsMunicipality.getName());
}

function renderNotifications(municipality) {
  const list = document.querySelector("#notification-list");
  const empty = document.querySelector("#notification-empty");
  const badge = document.querySelector("#notification-count");
  if (!list || !empty || !badge) return;

  currentNotificationItems = collectNotifications(municipality).slice(0, 12);
  const seen = getSeenNotifications(municipality);
  const unread = currentNotificationItems.filter((item) => !seen.has(item.key));

  document.querySelectorAll("[data-notification-municipality]").forEach((element) => {
    element.textContent = municipality;
  });
  badge.textContent = unread.length > 9 ? "9+" : String(unread.length);
  badge.hidden = unread.length === 0;
  list.hidden = currentNotificationItems.length === 0;
  empty.hidden = currentNotificationItems.length !== 0;
  list.innerHTML = currentNotificationItems.map((item) => `
    <a class="notification-item ${seen.has(item.key) ? "read" : "unread"}"
       href="${escapeAttribute(item.url)}"
       ${item.external ? 'target="_blank" rel="noopener noreferrer"' : ""}
       data-notification-key="${escapeAttribute(item.key)}">
      <span class="notification-icon ${escapeAttribute(item.kind)}"><i data-lucide="${escapeAttribute(item.icon)}"></i></span>
      <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span>
      ${seen.has(item.key) ? "" : '<i class="notification-unread-dot" aria-label="Oläst"></i>'}
    </a>
  `).join("");

  if (window.lucide) lucide.createIcons();
}

function collectNotifications(municipality) {
  const items = [];
  const priorities = { important: 100, transport: 90, traffic: 80, jobs: 70, housing: 60, events: 55, news: 45, fuel: 35, lunch: 30 };
  const add = (kind, icon, id, title, detail, url, date, external = false) => {
    if (!id || !title) return;
    items.push({
      kind, icon, title, detail: detail || municipality, url,
      external, date: date || "", priority: priorities[kind] || 0,
      key: `${kind}:${municipality}:${id}`
    });
  };
  const isRecent = (value, days = 3) => {
    const timestamp = new Date(value).getTime();
    if (!timestamp) return false;
    const difference = Date.now() - timestamp;
    return difference >= -24 * 60 * 60 * 1000 && difference <= days * 24 * 60 * 60 * 1000;
  };
  const genericNewsTitle = (title) => /^(polisens senaste|lokala nyheter från|senaste nytt från|senaste lokala rubrikerna)/i.test(String(title || ""));

  (importantData?.municipalities?.[municipality]?.items || []).slice(0, 3).forEach((item) =>
    add("important", item.category === "municipal" ? "wrench" : "shield-alert", item.id, item.title, item.source || "Dagens viktigaste", item.url || "#", item.publishedAt, Boolean(item.url))
  );
  (roadTrafficData?.municipalities?.[municipality]?.items || []).slice(0, 2).forEach((item) =>
    add("traffic", "triangle-alert", item.id, item.title, item.location || "Trafikinformation", "trafik.html", item.startTime || item.publishedAt)
  );
  (jobsData?.municipalities?.[municipality]?.jobs || []).filter((item) =>
    isRecent(item.publicationDate, 3)
  ).slice(0, 3).forEach((item) =>
    add("jobs", "briefcase-business", item.id, item.headline, `${item.employer || "Arbetsgivare"} · Nytt jobb`, "jobb.html", item.publicationDate)
  );
  (housingData?.municipalities?.[municipality]?.listings || []).slice(0, 2).forEach((item) =>
    add("housing", "house", item.id, item.address || "Ny ledig bostad", `${item.rooms || ""} ${item.rooms ? "rum · " : ""}${item.provider || "Bostad"}`, "bostader.html", housingData.generatedAt)
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  (eventsData?.municipalities?.[municipality]?.events || []).filter((item) =>
    new Date(item.endDate || item.startDate) >= today
  ).slice(0, 4).forEach((item) => {
    const start = new Date(item.startDate);
    const end = new Date(item.endDate || item.startDate);
    const ongoing = !Number.isNaN(start.getTime()) && start < today && end >= today;
    const dateLabel = ongoing
      ? `Pågår till ${end.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}`
      : item.startDate || "";
    add("events", "calendar-days", item.id, item.title, `${dateLabel} · ${item.venue || municipality}`, "evenemang.html", ongoing ? eventsData.generatedAt : item.startDate);
  });
  allNewsArticles.filter((item) =>
    item.scope === "local" &&
    (item.municipalities || []).includes(municipality) &&
    isRecent(item.publishedAt, 2) &&
    !genericNewsTitle(item.title)
  ).slice(0, 2).forEach((item) =>
    add("news", "newspaper", item.id, item.title, item.source || "Lokal nyhet", item.url, item.publishedAt, true)
  );
  (transportData?.municipalities?.[municipality]?.stops || []).flatMap((stop) =>
    (stop.alerts || []).map((alert, index) => ({ alert, stop, index }))
  ).slice(0, 3).forEach(({ alert, stop, index }) => {
    const title = typeof alert === "string" ? alert : alert.header || alert.title || alert.description;
    const id = typeof alert === "string" ? `${stop.id}-${index}-${alert}` : alert.id || `${stop.id}-${index}-${title}`;
    add("transport", "bus-front", id, title, stop.name, "#kollektivtrafik", transportData.generatedAt);
  });
  (fuelData?.municipalities?.[municipality]?.stations || []).filter((station) =>
    Number(station.price) > 0
  ).slice(0, 3).forEach((station) =>
    add("fuel", station.type === "charging" ? "plug-zap" : "fuel", `${station.id}-${station.price}`, `${station.name}: ${station.price} ${station.unit || ""}`, "Nytt registrerat pris", "drivmedel.html", fuelData.generatedAt)
  );
  const lunchDay = getStockholmWeekday();
  (lunchTickerData?.municipalities?.[municipality]?.restaurants || []).filter((restaurant) =>
    restaurant.status === "current" && (restaurant.days?.[lunchDay] || []).length
  ).slice(0, 4).forEach((restaurant) =>
    add("lunch", "utensils", `${restaurant.id}-${restaurant.weekNumber}-${lunchDay}`, `Dagens lunch hos ${restaurant.name}`, restaurant.days[lunchDay].slice(0, 2).join(" · "), "lunch.html", restaurant.checkedAt)
  );

  return items.sort((first, second) => {
    if (second.priority !== first.priority) return second.priority - first.priority;
    const firstDate = new Date(first.date).getTime() || 0;
    const secondDate = new Date(second.date).getTime() || 0;
    return secondDate - firstDate;
  });
}

function notificationStorageKey(municipality) {
  return `dinpuls-notifications-seen:${municipality}`;
}

function getSeenNotifications(municipality) {
  try {
    return new Set(JSON.parse(localStorage.getItem(notificationStorageKey(municipality)) || "[]"));
  } catch {
    return new Set();
  }
}

function saveSeenNotifications(municipality, keys) {
  const seen = getSeenNotifications(municipality);
  keys.forEach((key) => seen.add(key));
  localStorage.setItem(notificationStorageKey(municipality), JSON.stringify([...seen].slice(-300)));
}

function initializeMobileMenu() {
  const button = document.querySelector("#mobile-menu-button");
  const nav = document.querySelector("#main-nav");

  button?.addEventListener("click", () => {
    nav?.classList.toggle("open");
  });

  nav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
    });
  });
}

function initializeMunicipality() {
  const dialog = document.querySelector("#municipality-dialog");
  const headerButton = document.querySelector("#municipality-button");
  const inlineButton = document.querySelector("#change-municipality-inline");
  const select = document.querySelector("#municipality-select");
  const save = document.querySelector("#save-municipality");

  if (select) {
    select.innerHTML = DinPulsMunicipality.getAll()
      .map((item) => `<option value="${escapeAttribute(item.name)}">${escapeHtml(item.name)}</option>`)
      .join("");
    select.value = DinPulsMunicipality.getName();
  }

  const openDialog = () => {
    if (select) {
      select.value = DinPulsMunicipality.getName();
    }

    if (typeof dialog?.showModal === "function") {
      dialog.showModal();
    }
  };

  headerButton?.addEventListener("click", openDialog);
  inlineButton?.addEventListener("click", openDialog);

  save?.addEventListener("click", (event) => {
    event.preventDefault();
    DinPulsMunicipality.setMunicipality(select?.value);
    if (typeof dialog?.close === "function") {
      dialog.close();
    }
  });
}

function applyMunicipality(config) {
  const municipality = config.name;

  document.querySelectorAll("[data-municipality-name]").forEach((element) => {
    const uppercase =
      element.closest(".eyebrow") !== null &&
      element.tagName.toLowerCase() === "span";

    element.textContent = uppercase
      ? municipality.toLocaleUpperCase("sv-SE")
      : municipality;
  });

  const headerLabel = document.querySelector("#selected-municipality");

  if (headerLabel) {
    headerLabel.textContent = municipality;
  }

  document.title = `DinPuls.se – ${municipality}`;

  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.content = `DinPuls.se – lokal startsida för ${municipality}.`;
  }

  const version = document.querySelector('meta[name="dinpuls-version"]');
  if (version) {
    version.content = DINPULS_VERSION;
  }

  document.documentElement.dataset.municipality = config.slug;
  const compactWeather = document.querySelector(".weather-compact");
  if (compactWeather) {
    compactWeather.textContent = "Hämtar väder…";
  }
  renderMunicipalityPlaceholders(config);
  updateMunicipalityLinks(config.name);
}

function updateMunicipalityLinks(municipality) {
  const municipalPages = new Set(["jobb.html", "bostader.html", "lunch.html", "evenemang.html", "sport.html", "matkasse.html", "trafik.html"]);
  document.querySelectorAll("a[href]").forEach(link => {
    const raw = link.getAttribute("href");
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) return;
    const url = new URL(raw, window.location.href);
    if (url.origin !== window.location.origin) return;
    const page = url.pathname.split("/").pop();
    if (!municipalPages.has(page)) return;
    url.searchParams.set("kommun", municipality);
    link.href = `${page}?${url.searchParams.toString()}${url.hash}`;
  });
}

function renderMunicipalityPlaceholders(config) {
  document.querySelectorAll("[data-quick-placeholder]").forEach((element) => {
    const kind = element.dataset.quickPlaceholder;
    const labels = {
      jobs: [`Jobb i ${config.name}`, "Datakälla ansluts"],
      events: [`Evenemang i ${config.name}`, "Datakälla ansluts"],
      fuel: [`Drivmedel i ${config.name}`, "Prisdata ansluts"]
    };
    const [title, detail] = labels[kind] || [`Lokalt i ${config.name}`, "Data ansluts"];
    element.querySelector("strong").textContent = title;
    element.querySelector("small").textContent = detail;
  });

  document.querySelectorAll("[data-placeholder-municipality]").forEach((element) => {
    element.textContent = config.name;
  });

  const municipalWebsite = document.querySelector("#municipality-website");
  if (municipalWebsite) {
    municipalWebsite.href = config.website;
    municipalWebsite.textContent = `Besök ${config.name} kommun`;
  }

  const hero = document.querySelector(".hero");
  const heroImage = document.querySelector("#municipality-hero-image");
  if (hero && heroImage) {
    const hasImage = Boolean(config.heroImage);
    hero.classList.toggle("has-generic-background", !hasImage);
    heroImage.hidden = !hasImage;
    if (hasImage) {
      heroImage.src = config.heroImage;
      heroImage.alt = `Vy över ${config.name}`;
    }
  }
}

function initializeWeather() {
  const retryButton = document.querySelector("#weather-retry");

  retryButton?.addEventListener("click", () => {
    loadWeather(DinPulsMunicipality.getConfig());
  });

  DinPulsMunicipality.subscribe("weather", loadWeather);

  /* Uppdatera bara när sidan används; kommunbyte utlöser ett eget anrop. */
  window.setInterval(() => {
    if (!document.hidden) loadWeather(DinPulsMunicipality.getConfig());
  }, WEATHER_REFRESH_INTERVAL);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadWeather(DinPulsMunicipality.getConfig());
  });
}

let weatherRequestController = null;
let weatherRequestNumber = 0;

async function loadWeather(config) {
  if (!config?.name || !Number.isFinite(Number(config.latitude)) || !Number.isFinite(Number(config.longitude))) {
    showWeatherError(config?.name || "vald kommun");
    return;
  }
  const municipality = config.name;
  const requestNumber = ++weatherRequestNumber;
  weatherRequestController?.abort();
  weatherRequestController = new AbortController();
  const url =
    "https://opendata-download-metfcst.smhi.se/api/" +
    "category/snow1g/version/1/geotype/point/" +
    `lon/${config.longitude}/lat/${config.latitude}/data.json` +
    "?timeseries=24&parameters=" +
    [
      "air_temperature",
      "wind_speed",
      "relative_humidity",
      "precipitation_amount_median",
      "symbol_code"
    ].join(",");

  showWeatherLoading(municipality);

  try {
    const response = await fetch(url, {
      signal: weatherRequestController.signal,
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`SMHI svarade med status ${response.status}`);
    }

    const weatherData = await response.json();

    if (requestNumber !== weatherRequestNumber || municipality !== DinPulsMunicipality.getName()) {
      return;
    }

    writeWeatherCache(config.slug || municipality, weatherData);
    renderWeather(weatherData, municipality);
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }
    console.error("SMHI-väder kunde inte hämtas:", error);
    if (municipality === DinPulsMunicipality.getName()) {
      const cached = readWeatherCache(config.slug || municipality);
      if (cached) renderWeather(cached.data, municipality, { cachedAt: cached.savedAt });
      else showWeatherError(municipality);
    }
  }
}

function weatherCacheKey(key) {
  return `dinpuls-weather-${String(key).toLocaleLowerCase("sv-SE")}`;
}

function writeWeatherCache(key, data) {
  try {
    localStorage.setItem(weatherCacheKey(key), JSON.stringify({ savedAt: Date.now(), data }));
  } catch {}
}

function readWeatherCache(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(weatherCacheKey(key)) || "null");
    if (!cached?.data || !Number.isFinite(cached.savedAt) || Date.now() - cached.savedAt > WEATHER_CACHE_MAX_AGE) return null;
    return cached;
  } catch {
    return null;
  }
}

function setWeatherPanel(panel) {
  const panels = {
    loading: document.querySelector("#weather-loading"),
    content: document.querySelector("#weather-content"),
    error: document.querySelector("#weather-error")
  };
  Object.entries(panels).forEach(([name, element]) => {
    if (element) element.hidden = name !== panel;
  });
}

function showWeatherLoading(municipality) {
  const status = document.querySelector("#weather-status");
  const location = document.querySelector("#weather-location");

  if (location) {
    location.textContent = municipality;
  }

  setWeatherPanel("loading");

  if (status) {
    status.textContent = "Hämtar…";
    status.className = "weather-live-badge";
  }
}

function showWeatherError(municipality) {
  const status = document.querySelector("#weather-status");
  const location = document.querySelector("#weather-location");

  if (location) {
    location.textContent = municipality;
  }

  setWeatherPanel("error");

  if (status) {
    status.textContent = "Ej tillgängligt";
    status.className = "weather-live-badge is-fallback";
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderWeather(response, municipality, options = {}) {
  if (!Array.isArray(response.timeSeries) || response.timeSeries.length === 0) {
    throw new Error("SMHI-svaret saknar tidsserier.");
  }

  const entries = response.timeSeries
    .map(normalizeWeatherEntry)
    .filter((entry) => entry.time && Number.isFinite(entry.temperature));

  if (entries.length === 0) {
    throw new Error("SMHI-svaret saknar användbara temperaturvärden.");
  }

  const now = Date.now();
  const current = entries.reduce((closest, entry) => {
    const distance = Math.abs(new Date(entry.time).getTime() - now);
    return !closest || distance < closest.distance ? { entry, distance } : closest;
  }, null).entry;

  const localToday = STOCKHOLM_DATE_FORMAT.format(new Date(now));
  const todayEntries = entries.filter(
    (entry) =>
      STOCKHOLM_DATE_FORMAT.format(new Date(entry.time)) === localToday
  );

  const temperatures = (todayEntries.length ? todayEntries : entries)
    .map((entry) => entry.temperature)
    .filter(Number.isFinite);

  const high = Math.max(...temperatures);
  const low = Math.min(...temperatures);
  const symbol = getWeatherSymbol(current.symbolCode);
  const forecastEntries = chooseForecastEntries(entries, now, 4);

  setText("#weather-location", municipality);
  setText("#weather-temperature", `${Math.round(current.temperature)}°C`);
  setText("#weather-description", symbol.text);
  setText("#weather-high", `${Math.round(high)}°`);
  setText("#weather-low", `${Math.round(low)}°`);
  setText(
    "#weather-wind",
    Number.isFinite(current.windSpeed)
      ? `${current.windSpeed.toFixed(1)} m/s`
      : "Saknas"
  );
  setText(
    "#weather-humidity",
    Number.isFinite(current.humidity)
      ? `${Math.round(current.humidity)} %`
      : "Saknas"
  );
  setText(
    "#weather-precipitation",
    Number.isFinite(current.precipitation)
      ? `${current.precipitation.toFixed(1)} mm`
      : "0,0 mm"
  );
  setText("#weather-symbol", symbol.emoji);

  const updatedTime = response.createdTime || response.referenceTime;

  setText(
    "#weather-updated",
    updatedTime
      ? `Uppdaterad ${formatSwedishTime(updatedTime)}`
      : "Uppdaterad av SMHI"
  );

  renderHourlyForecast(forecastEntries);

  const status = document.querySelector("#weather-status");

  setWeatherPanel("content");

  if (status) {
    status.textContent = options.cachedAt ? "Senast hämtad prognos" : "SMHI-prognos";
    status.className = `weather-live-badge ${options.cachedAt ? "is-fallback" : "is-live"}`;
  }

  updateHeaderWeather(current.temperature, symbol.emoji);
}

function normalizeWeatherEntry(entry) {
  const data = entry.data || {};

  return {
    time: entry.time || entry.validTime,
    temperature: cleanNumber(
      data.air_temperature ??
      findLegacyParameter(entry, "t")
    ),
    windSpeed: cleanNumber(
      data.wind_speed ??
      findLegacyParameter(entry, "ws")
    ),
    humidity: cleanNumber(
      data.relative_humidity ??
      findLegacyParameter(entry, "r")
    ),
    precipitation: cleanNumber(
      data.precipitation_amount_median ??
      data.precipitation_amount_mean ??
      findLegacyParameter(entry, "pmedian") ??
      findLegacyParameter(entry, "pmean")
    ),
    symbolCode: cleanNumber(
      data.symbol_code ??
      findLegacyParameter(entry, "Wsymb2") ??
      findLegacyParameter(entry, "Wsymb")
    )
  };
}

function findLegacyParameter(entry, name) {
  const parameter = entry.parameters?.find(
    (item) => item.name === name
  );

  return parameter?.values?.[0];
}

function cleanNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number === 9999) {
    return NaN;
  }

  return number;
}

function chooseForecastEntries(entries, now, count) {
  const futureEntries = entries.filter(
    (entry) => new Date(entry.time).getTime() >= now
  );

  if (futureEntries.length <= count) {
    return futureEntries.slice(0, count);
  }

  const result = [];
  const interval = Math.max(
    1,
    Math.floor((futureEntries.length - 1) / (count - 1))
  );

  for (let index = 0; index < futureEntries.length; index += interval) {
    result.push(futureEntries[index]);

    if (result.length === count) {
      break;
    }
  }

  return result;
}

function renderHourlyForecast(entries) {
  const container = document.querySelector("#weather-forecast");

  if (!container) {
    return;
  }

  container.innerHTML = entries
    .map((entry, index) => {
      const symbol = getWeatherSymbol(entry.symbolCode);
      const label =
        index === 0
          ? "Nu"
          : new Date(entry.time).toLocaleTimeString("sv-SE", {
              hour: "2-digit",
              minute: "2-digit"
            });

      return `
        <div>
          <span>${label}</span>
          <b title="${symbol.text}">${symbol.emoji}</b>
          <strong>${Math.round(entry.temperature)}°</strong>
        </div>
      `;
    })
    .join("");
}

function getWeatherSymbol(code) {
  return WEATHER_SYMBOLS[Math.round(code)] || {
    emoji: "🌤️",
    text: "Växlande väder"
  };
}

function updateHeaderWeather(temperature, emoji) {
  const compact = document.querySelector(".weather-compact");

  if (!compact) {
    return;
  }

  compact.innerHTML =
    `<span aria-hidden="true">${emoji}</span>` +
    `<span>${Math.round(temperature)}°C</span>`;
}

function formatSwedishTime(value) {
  return new Date(value).toLocaleString("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short"
  });
}

function setText(selector, value) {
  const element = document.querySelector(selector);

  if (element) {
    element.textContent = value;
  }
}

startDinPuls();


   DINPULS v0.8.0 – NYHETSCENTRAL
========================================================= */
let allNewsArticles = [];
let allNewsSources = [];
let activeNewsFilter = "all";

async function initializeNews() {
  document.querySelectorAll(".news-filter").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".news-filter").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      activeNewsFilter = button.dataset.newsFilter || "all";
      renderNewsForMunicipality(DinPulsMunicipality.getName());
    });
  });
  DinPulsMunicipality.subscribe("news", (config) => {
    renderNewsForMunicipality(config.name);
  });
  await loadNews();
}

function updateNewsHeading(municipality) {
  const heading = document.querySelector("#news-heading");
  const subheading = document.querySelector("#news-subheading");
  if (heading) heading.textContent = "Lokala nyheter";
  if (subheading) subheading.textContent = `Viktiga händelser i ${municipality}`;
}

async function loadNews() {
  const loading = document.querySelector("#news-loading");
  const feed = document.querySelector("#news-feed");
  if (loading) loading.hidden = false;
  if (feed) feed.hidden = true;
  try {
    const response = await fetch(`data/news.json?version=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    allNewsArticles = Array.isArray(data.articles) ? data.articles : [];
    allNewsSources = Array.isArray(data.sources) ? data.sources : [];
    updateNewsTimestamp(data.generatedAt);
    renderNewsForMunicipality(DinPulsMunicipality.getName());
  } catch (error) {
    console.error("Nyheter kunde inte laddas:", error);
    if (loading) loading.hidden = true;
    const empty = document.querySelector("#news-empty");
    if (empty) { empty.hidden = false; empty.querySelector("strong").textContent = "Nyheterna kunde inte laddas"; empty.querySelector("span").textContent = "Öppna sidan via Live Server och försök igen."; }
  }
}

function renderNewsForMunicipality(municipality) {
  updateNewsHeading(municipality);
  const loading = document.querySelector("#news-loading");
  const feed = document.querySelector("#news-feed");
  const empty = document.querySelector("#news-empty");
  const count = document.querySelector("#news-count");
  const pageLink = document.querySelector("#news-page-link");
  if (!feed || !empty) return;
  if (pageLink) pageLink.href = `nyheter.html?kommun=${encodeURIComponent(municipality)}`;
  const scoped = allNewsArticles
    .filter((article) => article.scope === "local")
    .filter((article) => (article.municipalities || []).includes(municipality) || (article.municipalities || []).includes("Alla"))
    .filter(matchesNewsFilter);
  const exactLocal = scoped.filter((article) => isLocallyRelevantNews(article, municipality));
  const usesRegionalFallback = exactLocal.length === 0;
  const relevant = (usesRegionalFallback
    ? scoped.map((article) => ({ ...article, category: `Regionalt · ${article.region || "nära dig"}` }))
    : exactLocal)
    .sort(compareNewsQuality)
    .slice(0, 5);
  feed.innerHTML = relevant.map(renderNewsArticle).join("");
  loading.hidden = true;
  feed.hidden = relevant.length === 0;
  empty.hidden = relevant.length > 0;
  if (count) count.textContent = usesRegionalFallback
    ? `${relevant.length} regionala nyheter – inga nya kommunträffar`
    : `${relevant.length} ${relevant.length === 1 ? "aktuell nyhet" : "aktuella nyheter"}`;
  const subheading = document.querySelector("#news-subheading");
  if (subheading && usesRegionalFallback) {
    subheading.textContent = `Regionalt urval för ${municipality}`;
  }
  renderImportantNews(relevant);
  renderNewsSources(municipality);
  if (window.lucide) lucide.createIcons();
}

function isLocallyRelevantNews(article, municipality) {
  if (article.sourceType === "municipality") return true;
  const localTerms = {
    "Åmål": ["åmål", "tösse", "fengersfors", "edsleskog", "dalsland"],
    "Säffle": ["säffle", "svanskog", "värmlandsnäs", "värmlandsbro"],
    "Bengtsfors": ["bengtsfors", "billingsfors", "dals långed", "bäckefors"],
    "Mellerud": ["mellerud", "dals rostock", "åsensbruk", "brålanda"],
    "Årjäng": ["årjäng", "töcksfors", "sillerud", "holmedal"],
    "Arvika": ["arvika", "gunnarskog", "edane", "klässbol"],
    "Grums": ["grums", "slottsbron", "segelmon", "vålberg"]
  };
  const haystack = `${article.title || ""} ${article.summary || ""} ${article.region || ""}`.toLocaleLowerCase("sv-SE");
  return (localTerms[municipality] || [municipality.toLocaleLowerCase("sv-SE")])
    .some((term) => haystack.includes(term));
}

function matchesNewsFilter(article) {
  if (activeNewsFilter === "all") return true;
  if (activeNewsFilter === "free") return article.access === "free";
  if (activeNewsFilter === "subscription") return article.access === "subscription";
  if (activeNewsFilter === "authority") return ["authority","municipality"].includes(article.sourceType);
  if (activeNewsFilter === "media") return article.sourceType === "media";
  return true;
}
function compareNewsQuality(a,b) { return calculateNewsScore(b)-calculateNewsScore(a) || new Date(b.publishedAt)-new Date(a.publishedAt); }
function calculateNewsScore(article) {
  const quality=Number(article.quality)||70, impact=Number(article.impact)||40;
  const age=Math.max(0,(Date.now()-new Date(article.publishedAt).getTime())/3600000);
  const freshness=Math.max(0,40-age/4);
  return quality*.45+impact*.35+freshness*.20+(article.important?15:0);
}
function renderImportantNews(articles) {
  const box=document.querySelector("#important-news"); if(!box)return;
  const important=articles.filter(a=>a.important || Number(a.impact)>=85).slice(0,2);
  box.hidden=!important.length;
  box.innerHTML=important.length?`<div class="important-news-title"><i data-lucide="triangle-alert"></i><strong>Viktiga händelser</strong></div>${important.map(a=>`<a href="${escapeAttribute(a.url)}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(a.source)}</span><b>${escapeHtml(a.title)}</b><i data-lucide="arrow-up-right"></i></a>`).join("")}`:"";
}
function renderNewsArticle(article) {
  const access=article.access==="subscription"?'<span class="news-access subscription"><i data-lucide="lock"></i>Prenumeration</span>':'<span class="news-access free"><i data-lucide="unlock"></i>Fri</span>';
  const sourceClass=article.sourceType==="authority"?"authority":article.sourceType==="municipality"?"municipality":"media";
  const score=Math.round(calculateNewsScore(article));
  return `<a class="news-item" href="${escapeAttribute(article.url)}" target="_blank" rel="noopener noreferrer"><span class="news-source-mark ${sourceClass}">${getNewsSourceInitials(article.source)}</span><span class="news-item-content"><span class="news-meta"><strong>${escapeHtml(article.source)}</strong><span>•</span><time datetime="${escapeAttribute(article.publishedAt)}">${formatRelativeNewsTime(article.publishedAt)}</time></span><b class="news-title">${escapeHtml(article.title)}</b><span class="news-summary">${escapeHtml(article.summary||"")}</span><span class="news-labels">${access}<span class="news-region">${escapeHtml(article.category||article.region||"Nyheter")}</span><span class="news-score" title="DinPuls-index">DP ${score}</span></span></span><i class="news-open-icon" data-lucide="arrow-up-right"></i></a>`;
}
function renderNewsSources(municipality) {
  const grid=document.querySelector("#news-source-grid"); if(!grid)return;
  const relevant=allNewsSources.filter(s=>s.scope==="local" && (s.municipalities||[]).includes(municipality));
  grid.innerHTML=relevant.map(source=>`<a class="news-source-card" href="${escapeAttribute(source.url)}" target="_blank" rel="noopener noreferrer"><span class="news-source-logo">${getNewsSourceInitials(source.name)}</span><span><strong>${escapeHtml(source.name)}</strong><small>${escapeHtml(source.type)}</small></span><span class="source-access ${source.access==='subscription'?'subscription':'free'}"><i data-lucide="${source.access==='subscription'?'lock':'check'}"></i>${source.access==='subscription'?'Delvis låst':'Fri'}</span></a>`).join("");
  if(window.lucide)lucide.createIcons();
}
function updateNewsTimestamp(value) {
  const el=document.querySelector("#news-updated"); if(!el)return; const date=new Date(value);
  el.innerHTML=`<i data-lucide="refresh-cw"></i>${Number.isNaN(date.getTime())?'Källor kontrollerade':`Uppdaterad ${date.toLocaleString('sv-SE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`}`;
}
function formatRelativeNewsTime(value) { const d=new Date(value); if(Number.isNaN(d.getTime()))return"Tid saknas"; const m=Math.max(0,Math.floor((Date.now()-d)/60000)); if(m<2)return"nyss"; if(m<60)return`${m} min sedan`; const h=Math.floor(m/60); if(h<24)return`${h} tim sedan`; const days=Math.floor(h/24); if(days===1)return"igår"; if(days<7)return`${days} dagar sedan`; return d.toLocaleDateString('sv-SE',{day:'numeric',month:'short'}); }
function getNewsSourceInitials(source){return String(source||"DP").split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join("").toLocaleUpperCase('sv-SE');}
function escapeHtml(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function escapeAttribute(value){return escapeHtml(value);}

/* =========================================================

/* =========================================================
   DINPULS v0.14.0 – VÄGTRAFIK
========================================================= */
let roadTrafficData = null;
let roadTrafficRefreshTimer = null;

async function initializeTraffic() {
  DinPulsMunicipality.subscribe("road-traffic", renderTrafficCard);
  await loadRoadTraffic();
  clearInterval(roadTrafficRefreshTimer);
  roadTrafficRefreshTimer = setInterval(() => {
    if (!document.hidden) loadRoadTraffic();
  }, 15 * 60 * 1000);
}

async function loadRoadTraffic() {
  try {
    const response = await fetch(`data/road-traffic.json?version=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    roadTrafficData = await response.json();
  } catch (error) {
    console.error("Vägtrafiken kunde inte laddas:", error);
    roadTrafficData = null;
  }
  renderTrafficCard();
}

function renderTrafficCard(config = DinPulsMunicipality.getConfig()) {
  const list = document.querySelector("#traffic-compact-list");
  const total = document.querySelector("#traffic-total");
  const status = document.querySelector("#traffic-status");
  const link = document.querySelector("#traffic-page-link");
  if (!list || !total || !status || !config) return;
  if (link) link.href = `trafik.html?kommun=${encodeURIComponent(config.name)}`;
  const municipality = roadTrafficData?.municipalities?.[config.name];
  const items = Array.isArray(municipality?.items) ? municipality.items : [];
  const generatedAt = new Date(roadTrafficData?.generatedAt || "");
  const isStale = !Number.isNaN(generatedAt.getTime()) && Date.now() - generatedAt.getTime() > 40 * 60 * 1000;
  total.textContent = String(items.length);
  if (!roadTrafficData) {
    status.textContent = "Ej tillgänglig";
    list.innerHTML = '<div class="traffic-empty"><i data-lucide="cloud-off"></i><span>Trafikdata kunde inte laddas.</span></div>';
  } else if (!roadTrafficData.active) {
    status.textContent = "Ej tillgänglig";
    list.innerHTML = '<div class="traffic-empty"><i data-lucide="cloud-off"></i><span>Trafikläget kunde inte kontrolleras. Öppna Trafikverkets vägkarta.</span></div>';
  } else if (isStale) {
    status.textContent = "Försenad uppdatering";
    list.innerHTML = items.length
      ? items.slice(0, 3).map(renderTrafficCompactItem).join("")
      : '<div class="traffic-empty"><i data-lucide="clock-alert"></i><span>Senaste trafikuppdateringen är äldre än 40 minuter.</span></div>';
  } else if (!items.length) {
    status.textContent = "Inga störningar";
    list.innerHTML = `<div class="traffic-empty ok"><i data-lucide="circle-check"></i><span>Lugnt trafikläge nära ${escapeHtml(config.name)}. Inga aktuella vägmeddelanden hittades inom ${Number(roadTrafficData.radiusKm || 35)} km.</span></div>`;
  } else {
    status.textContent = Number.isNaN(generatedAt.getTime()) ? "Aktuellt" : `Kontrollerad ${generatedAt.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`;
    list.innerHTML = items.slice(0, 3).map(renderTrafficCompactItem).join("");
  }
  if (window.lucide) lucide.createIcons();
}

function renderTrafficCompactItem(item) {
  return `<a href="${escapeAttribute(item.sourceUrl || "https://www.trafikverket.se/trafikinformation/vag/")}" target="_blank" rel="noopener noreferrer"><span class="traffic-kind ${escapeAttribute(item.severity || "info")}"><i data-lucide="${trafficIcon(item.category)}"></i></span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.road || item.location || "Nära vald kommun")} · ${escapeHtml(formatRelativeNewsTime(item.updatedAt))}</small></span><i data-lucide="arrow-up-right"></i></a>`;
}

function trafficIcon(category) {
  return ({ accident: "triangle-alert", roadwork: "construction", congestion: "traffic-cone", obstacle: "shield-alert", weather: "cloud-snow" })[category] || "car-front";
}

/* =========================================================
   DINPULS v0.13.0 – DAGENS VIKTIGASTE
========================================================= */
let importantData = null;

async function initializeImportant() {
  DinPulsMunicipality.subscribe("important", renderImportant);
  try {
    const response = await fetch(`data/important.json?version=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    importantData = await response.json();
  } catch (error) {
    console.error("Dagens viktigaste kunde inte laddas:", error);
    importantData = null;
  }
}

function renderImportant(config = DinPulsMunicipality.getConfig()) {
  const list = document.querySelector("#important-list");
  const status = document.querySelector("#important-status");
  if (!list || !status || !config) return;

  const municipality = importantData?.municipalities?.[config.name];
  const items = Array.isArray(municipality?.items)
    ? municipality.items.filter(item => Number(item.priority || 0) >= 70).sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)).slice(0, 3)
    : [];
  const generatedAt = new Date(importantData?.generatedAt || "");
  const isStale = !Number.isNaN(generatedAt.getTime()) && Date.now() - generatedAt.getTime() > 45 * 60 * 1000;

  if (!importantData) {
    status.textContent = "Kunde inte uppdateras";
    list.innerHTML = renderImportantEmpty(
      "Aktuell information kunde inte hämtas",
      "Försök igen om en stund eller öppna kommunens webbplats."
    );
  } else if (items.length === 0) {
    status.textContent = isStale
      ? "Senast kontrollerad information"
      : Number.isNaN(generatedAt.getTime())
      ? "Kontrollerad"
      : `Kontrollerad ${generatedAt.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`;
    list.innerHTML = renderImportantCalm(config.name, municipality?.sourceHealth || importantData.sources || [], isStale);
  } else {
    status.textContent = isStale ? `${items.length} – uppdateringen är försenad` : `${items.length} aktuell${items.length === 1 ? "" : "a"}`;
    list.innerHTML = items.map(renderImportantItem).join("");
  }

  if (window.lucide) lucide.createIcons();
}

function renderImportantEmpty(title, detail) {
  return `<article class="important-empty"><i class="status-icon success" data-lucide="circle-check"></i><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div></article>`;
}

function renderImportantCalm(municipality, sources, isStale = false) {
  const selectedSources = (sources || [])
    .filter(source => source.status !== "error" && source.automated !== false)
    .slice(0, 4);
  const sourceLinks = selectedSources.map(source =>
    `<a href="${escapeAttribute(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.name)}<i data-lucide="arrow-up-right"></i></a>`
  ).join("");
  return `<article class="important-calm">
    <i class="status-icon success" data-lucide="circle-check"></i>
    <div><strong>${isStale ? "Ingen ny kontroll har kommit in" : `Lugnt läge i ${escapeHtml(municipality)}`}</strong><small>${isStale ? "Informationen är äldre än 45 minuter. Öppna en officiell källa vid osäkerhet." : "Inga prioriterade varningar eller akuta händelser har hittats."}</small></div>
  </article>
  <div class="important-sources"><span>Kontrollerade källor</span>${sourceLinks}</div>`;
}

function renderImportantItem(item) {
  const severity = ["danger", "warning", "info"].includes(item.severity) ? item.severity : "info";
  const icons = { crisis: "triangle-alert", police: "shield-alert", traffic: "bus-front", road: "car-front", weather: "cloud-lightning", municipal: "wrench" };
  const icon = icons[item.category] || "info";
  const published = formatRelativeNewsTime(item.publishedAt);
  const source = item.source || "Officiell källa";
  const body = `<i class="status-icon ${severity}" data-lucide="${icon}"></i><div><strong>${escapeHtml(item.title || "Viktig information")}</strong><small>${escapeHtml(source)} · ${escapeHtml(published)}</small></div>`;
  return item.url
    ? `<article class="important-item">${body}<a href="${escapeAttribute(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="Läs mer hos ${escapeAttribute(source)}"><i data-lucide="arrow-up-right"></i></a></article>`
    : `<article class="important-item">${body}</article>`;
}


   DINPULS v0.8.0 – BUSS- OCH TÅGTIDER
========================================================= */
let transportData = null;
let activeTransportMode = "all";
let transportRefreshTimer = null;

async function initializeTransport() {
  document.querySelectorAll(".transport-tab").forEach((button) => {
    button.addEventListener("click", () => {
      activeTransportMode = button.dataset.transportMode || "all";
      document.querySelectorAll(".transport-tab").forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });
      renderTransport();
    });
  });

  document.querySelector("#transport-stop")?.addEventListener("change", renderTransport);
  DinPulsMunicipality.subscribe("transport", refreshTransportForMunicipality);
  await loadTransport();
  clearInterval(transportRefreshTimer);
  transportRefreshTimer = window.setInterval(() => {
    if (!document.hidden) loadTransport();
  }, 15 * 60 * 1000);
}

async function loadTransport() {
  const loading = document.querySelector("#transport-loading");
  if (loading) loading.hidden = false;
  try {
    const response = await fetch(`data/transport.json?version=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    transportData = await response.json();
    populateTransportStops();
    renderTransport();
  } catch (error) {
    console.error("Kollektivtrafiken kunde inte laddas:", error);
    if (loading) loading.hidden = true;
    const empty = document.querySelector("#transport-empty");
    if (empty) {
      empty.hidden = false;
      empty.querySelector("strong").textContent = "Tiderna kunde inte laddas";
      empty.querySelector("span").textContent = "Öppna sidan via Live Server och försök igen.";
    }
  }
}

function populateTransportStops() {
  const select = document.querySelector("#transport-stop");
  if (!select || !transportData) return;
  const municipality = DinPulsMunicipality.getName();
  const stops = transportData.municipalities?.[municipality]?.stops || [];
  const previousSelection = select.value;
  select.innerHTML = stops.map((stop) => `<option value="${escapeAttribute(stop.id)}">${escapeHtml(stop.name)}</option>`).join("");
  if (stops.some((stop) => stop.id === previousSelection)) select.value = previousSelection;
  const place = document.querySelector("#transport-place");
  if (place) place.textContent = municipality;
}

function renderTransport() {
  const board = document.querySelector("#departure-board");
  const loading = document.querySelector("#transport-loading");
  const empty = document.querySelector("#transport-empty");
  const alertBox = document.querySelector("#transport-alert");
  const select = document.querySelector("#transport-stop");
  if (!board || !transportData || !select) return;

  const municipality = DinPulsMunicipality.getName();
  const municipalityData = transportData.municipalities?.[municipality];
  const stop = municipalityData?.stops?.find((item) => item.id === select.value) || municipalityData?.stops?.[0];
  const isDemo = transportData.source === "demo";
  const now = Date.now();
  const departures = (stop?.departures || [])
    .filter((item) => activeTransportMode === "all" || item.mode === activeTransportMode)
    .filter((item) => isDemo || new Date(item.realtime || item.scheduled).getTime() >= now - 30000)
    .slice(0, 10);

  board.innerHTML = departures.map((item) => renderDeparture(item, isDemo)).join("");
  loading.hidden = true;
  board.hidden = departures.length === 0;
  empty.hidden = departures.length > 0;
  if (!departures.length) {
    const modeLabel = activeTransportMode === "train" ? "tåg" : activeTransportMode === "bus" ? "bussar" : "avgångar";
    empty.querySelector("strong").textContent = `Inga kommande ${modeLabel} hittades`;
    empty.querySelector("span").textContent = stop?.error
      ? "Trafiklab kunde inte nås. Senast sparade tider visas när de fortfarande gäller."
      : "Nästa tidtabellsfönster kontrolleras automatiskt.";
  }

  const alerts = stop?.alerts || [];
  alertBox.hidden = alerts.length === 0;
  alertBox.innerHTML = alerts.length ? `<i data-lucide="triangle-alert"></i><div><strong>Trafikinformation</strong>${alerts.map((message) => `<span>${escapeHtml(message)}</span>`).join("")}</div>` : "";

  const updated = document.querySelector("#transport-updated");
  if (updated) {
    const timestamp = new Date(transportData.generatedAt);
    const stale = !isDemo && !Number.isNaN(timestamp.getTime()) && Date.now() - timestamp.getTime() > 35 * 60 * 1000;
    updated.classList.toggle("stale", stale);
    updated.innerHTML = `<i data-lucide="${stale ? "triangle-alert" : "refresh-cw"}"></i>${isDemo ? "Demonstrationsdata" : Number.isNaN(timestamp.getTime()) ? "Tider kontrollerade" : stale ? `Senast hämtad ${timestamp.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}` : `Uppdaterad ${timestamp.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`}`;
  }

  updateTransportSource(isDemo);
  renderCompactTransport(departures, isDemo);
  updateQuickTransport();
  if (window.lucide) lucide.createIcons();
}

function renderDeparture(item, isDemo = false) {
  const realtime = item.realtime || item.scheduled;
  const scheduled = new Date(item.scheduled);
  const actual = new Date(realtime);
  const delayMinutes = Number(item.delayMinutes) || 0;
  const modeIcon = item.mode === "train" ? "train-front" : "bus-front";
  const status = isDemo
    ? '<span class="departure-status planned">Demodata</span>'
    : item.canceled
    ? '<span class="departure-status canceled">Inställd</span>'
    : delayMinutes > 0
      ? `<span class="departure-status delayed">+${delayMinutes} min</span>`
      : item.stale
        ? '<span class="departure-status planned">Sparad tidtabell</span>'
      : item.isRealtime
        ? '<span class="departure-status realtime">Realtid</span>'
        : '<span class="departure-status planned">Tidtabell</span>';
  const time = Number.isNaN(actual.getTime()) ? "--:--" : actual.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  const scheduledTime = Number.isNaN(scheduled.getTime()) ? "" : scheduled.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  return `<article class="departure-row${item.canceled ? " is-canceled" : ""}">
    <span class="departure-mode ${item.mode}"><i data-lucide="${modeIcon}"></i></span>
    <span class="departure-line">${escapeHtml(item.line || item.operator || "–")}</span>
    <span class="departure-destination"><strong>${escapeHtml(item.direction || "Destination saknas")}</strong><small>${escapeHtml(item.operator || "")}${item.platform ? ` · Läge ${escapeHtml(item.platform)}` : ""}</small></span>
    <span class="departure-time"><strong>${time}</strong>${delayMinutes > 0 && scheduledTime ? `<small>${scheduledTime}</small>` : ""}</span>
    ${status}
  </article>`;
}

function updateTransportSource(isDemo) {
  const note = document.querySelector("#transport-source-note");
  const link = document.querySelector("#transport-source-link");
  if (note) {
    note.textContent = isDemo
      ? "Exempeltider – inte liveinformation"
      : transportData.partial
        ? "Trafiklab – vissa hållplatser kunde inte uppdateras"
        : "Aktuella avgångar från Trafiklab";
  }
  if (link) {
    link.hidden = isDemo;
  }
}

function renderCompactTransport(departures, isDemo) {
  const list = document.querySelector("#compact-transport-list");
  const label = document.querySelector("#compact-transport-label");
  if (!list) return;

  if (label) {
    label.textContent = isDemo ? "Demonstrationsdata" : "Aktuella avgångar";
  }

  if (departures.length === 0) {
    list.innerHTML = '<li><span><strong>Inga aktuella avgångar</strong><small>Tiderna uppdateras automatiskt</small></span></li>';
    return;
  }

  list.innerHTML = departures.slice(0, 4).map((item) => {
    const time = new Date(item.realtime || item.scheduled);
    const displayTime = Number.isNaN(time.getTime())
      ? "--:--"
      : time.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    return `<li><i data-lucide="${item.mode === "train" ? "train-front" : "bus-front"}"></i><time>${displayTime}</time><span><strong>${escapeHtml(item.direction || "Destination saknas")}</strong><small>${escapeHtml(item.line || item.operator || "")}${isDemo ? " · demo" : ""}</small></span></li>`;
  }).join("");
}

function refreshTransportForMunicipality() {
  if (!transportData) return;
  activeTransportMode = "all";
  document.querySelectorAll(".transport-tab").forEach((button) => {
    const active = button.dataset.transportMode === "all";
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  populateTransportStops();
  renderTransport();
}

function updateQuickTransport() {
  if (!transportData) return;
  const municipality = DinPulsMunicipality.getName();
  const municipalityData = transportData.municipalities?.[municipality];

  if (transportData.source === "demo") {
    document.querySelectorAll("[data-quick-transport-title]").forEach((element) => {
      element.textContent = `Buss & tåg i ${municipality}`;
    });
    document.querySelectorAll("[data-quick-transport-detail]").forEach((element) => {
      element.textContent = "Demonstrationsdata – inte live";
    });
    return;
  }

  const departure = municipalityData?.stops?.flatMap((stop) =>
    (stop.departures || []).map((item) => ({ ...item, stopName: stop.name }))
  ).filter((item) => !item.canceled && new Date(item.realtime || item.scheduled).getTime() >= Date.now() - 30000)
   .sort((a, b) => new Date(a.realtime || a.scheduled) - new Date(b.realtime || b.scheduled))[0];

  document.querySelectorAll("[data-quick-transport-title]").forEach((element) => {
    if (!departure) {
      element.textContent = `Inga avgångar i ${municipality}`;
      return;
    }
    const departureTime = new Date(departure.realtime || departure.scheduled);
    const minutes = Math.max(0, Math.round((departureTime.getTime() - Date.now()) / 60000));
    const now = new Date();
    const sameDate = departureTime.toLocaleDateString("sv-SE") === now.toLocaleDateString("sv-SE");
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = departureTime.toLocaleDateString("sv-SE") === tomorrow.toLocaleDateString("sv-SE");
    const clock = departureTime.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    element.textContent = minutes <= 0
      ? "Nästa avgång nu"
      : minutes < 120 && sameDate
        ? `Nästa avgång om ${minutes} min`
        : isTomorrow
          ? `Nästa avgång i morgon ${clock}`
          : sameDate
            ? `Nästa avgång ${clock}`
            : `Nästa avgång ${departureTime.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" })} ${clock}`;
  });

  document.querySelectorAll("[data-quick-transport-detail]").forEach((element) => {
    element.textContent = departure
      ? `${departure.mode === "train" ? "Tåg" : "Buss"} ${departure.line || ""} mot ${departure.direction} · ${departure.stopName}`
      : "Kontrollera tidtabellen";
  });
}

window.setInterval(updateQuickTransport, 60000);

/* =========================================================

/* =========================================================
   DINPULS v0.15.0 – EVENEMANG
========================================================= */
let eventsData = null;

async function initializeEvents() {
  const card = document.querySelector("#evenemang");
  const openPage = () => location.href = `evenemang.html?kommun=${encodeURIComponent(DinPulsMunicipality.getName())}`;
  card?.addEventListener("click", event => { if (!event.target.closest("a,button,input,select,label")) openPage(); });
  card?.addEventListener("keydown", event => { if ((event.key === "Enter" || event.key === " ") && !event.target.closest("a,button,input,select")) { event.preventDefault(); openPage(); } });
  DinPulsMunicipality.subscribe("events", renderEvents);
  try {
    const response = await fetch(`data/events.json?version=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    eventsData = await response.json();
    renderEvents();
  } catch (error) {
    console.error("Evenemang kunde inte laddas:", error);
    document.querySelector("#events-loading")?.setAttribute("hidden", "");
    const empty = document.querySelector("#events-empty"); if (empty) empty.hidden = false;
  }
}

function renderEvents() {
  if (!eventsData) return;
  const municipality = DinPulsMunicipality.getName();
  const data = eventsData.municipalities?.[municipality] || { events: [], sources: [] };
  const now = new Date(); now.setHours(0,0,0,0);
  const events = (data.events || []).filter(item => new Date(item.endDate || item.startDate).getTime() >= now.getTime()).sort((a,b) => new Date(a.startDate) - new Date(b.startDate));
  const visible = events.slice(0, 4);
  const list = document.querySelector("#events-list");
  const loading = document.querySelector("#events-loading");
  const empty = document.querySelector("#events-empty");
  if (loading) loading.hidden = true;
  if (list) { list.innerHTML = visible.map(renderEventPreview).join(""); list.hidden = !visible.length; }
  if (empty) empty.hidden = !!visible.length;
  const total = document.querySelector("#events-total"); if (total) total.textContent = events.length ? `${events.length} kommande · ${data.sources?.length || 0} källor` : `${data.sources?.length || 0} lokala källor`;
  const link = document.querySelector("#events-page-link"); if (link) link.href = `evenemang.html?kommun=${encodeURIComponent(municipality)}`;
  document.querySelectorAll("[data-quick-events-title]").forEach(el => el.textContent = events.length ? `${events.length} evenemang i ${municipality}` : `Evenemang i ${municipality}`);
  document.querySelectorAll("[data-quick-events-detail]").forEach(el => el.textContent = events[0] ? `${formatEventShortDate(events[0].startDate)} · ${events[0].title}` : `${data.sources?.length || 0} lokala kalendrar samlade`);
  if (window.lucide) lucide.createIcons();
}

function renderEventPreview(item) {
  const date = new Date(item.startDate); const month = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("sv-SE", { month: "short" }).replace(".", "");
  const day = Number.isNaN(date.getTime()) ? "–" : date.getDate();
  return `<li><time><b>${day}</b>${escapeHtml(month)}</time><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml([item.time, item.venue, item.sourceName].filter(Boolean).join(" · "))}</small></span></li>`;
}

function formatEventShortDate(value) {
  const date = new Date(value); return Number.isNaN(date.getTime()) ? "Kommande" : date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

/* =========================================================
   DINPULS v0.8.0 – LEDIGA JOBB
========================================================= */
let jobsData = null;
let activeJobsQuery = "";

async function initializeJobs() {
  document.querySelector("#jobs-search")?.addEventListener("input", (event) => {
    activeJobsQuery = event.target.value.trim().toLocaleLowerCase("sv-SE");
    renderJobs();
  });

  DinPulsMunicipality.subscribe("jobs", refreshJobsForMunicipality);
  await loadJobs();
}

async function loadJobs() {
  const loading = document.querySelector("#jobs-loading");
  if (loading) loading.hidden = false;

  try {
    const response = await fetch(`data/jobs.json?version=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    if (!data?.municipalities || typeof data.municipalities !== "object") {
      throw new Error("Jobbfilen saknar kommuner");
    }
    jobsData = data;
    renderJobs();
  } catch (error) {
    console.error("Lediga jobb kunde inte laddas:", error);
    showJobsError();
  }
}

function refreshJobsForMunicipality() {
  activeJobsQuery = "";
  const search = document.querySelector("#jobs-search");
  if (search) search.value = "";
  renderJobs();
}

function renderJobs() {
  const list = document.querySelector("#jobs-list");
  const loading = document.querySelector("#jobs-loading");
  const empty = document.querySelector("#jobs-empty");
  if (!list || !empty || !jobsData) return;

  const municipality = DinPulsMunicipality.getName();
  const municipalityData = jobsData.municipalities?.[municipality] || { total: 0, jobs: [] };
  const allJobs = Array.isArray(municipalityData.jobs) ? municipalityData.jobs : [];
  const relevant = allJobs.filter((job) => {
    if (!activeJobsQuery) return true;
    return [job.headline, job.employer, job.occupation, job.workingHours]
      .some((value) => String(value || "").toLocaleLowerCase("sv-SE").includes(activeJobsQuery));
  });
  const visible = relevant.slice(0, 8);

  list.innerHTML = visible.map(renderJob).join("");
  if (loading) loading.hidden = true;
  list.hidden = visible.length === 0;
  empty.hidden = visible.length > 0;

  const total = document.querySelector("#jobs-total");
  if (total) total.textContent = String(Number(municipalityData.total) || allJobs.length);

  const showing = document.querySelector("#jobs-showing");
  if (showing) {
    showing.textContent = activeJobsQuery
      ? `${relevant.length} träffar i hämtade annonser`
      : `Visar ${visible.length} av ${Number(municipalityData.total) || allJobs.length}`;
  }

  const updated = document.querySelector("#jobs-updated");
  if (updated) {
    const timestamp = new Date(municipalityData.updatedAt || jobsData.generatedAt);
    updated.innerHTML = `<i data-lucide="refresh-cw"></i>${Number.isNaN(timestamp.getTime()) ? "Annonser kontrollerade" : `Uppdaterad ${timestamp.toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}`;
  }

  const sourceLink = document.querySelector("#jobs-source-link");
  if (sourceLink) {
    sourceLink.href = `jobb.html?kommun=${encodeURIComponent(municipality)}`;
  }

  updateQuickJobs(municipalityData, municipality);
  if (window.lucide) lucide.createIcons();
}

function renderJob(job) {
  const published = formatJobDate(job.publicationDate, "Publicerad");
  const deadline = formatJobDate(job.applicationDeadline, "Sök senast");
  const meta = [job.workingHours, job.duration].filter(Boolean).slice(0, 2);
  const detailUrl = `jobb.html?kommun=${encodeURIComponent(DinPulsMunicipality.getName())}&annons=${encodeURIComponent(job.id || "")}`;
  return `<a class="job-item" href="${escapeAttribute(detailUrl)}">
    <span class="job-icon"><i data-lucide="briefcase-business"></i></span>
    <span class="job-content">
      <strong>${escapeHtml(job.headline || "Ledigt jobb")}</strong>
      <span class="job-employer">${escapeHtml(job.employer || "Arbetsgivare saknas")} · ${escapeHtml(job.workplace || job.municipality || "")}</span>
      <span class="job-tags">${meta.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</span>
      <small>${published}${deadline ? ` · ${deadline}` : ""}${Number(job.vacancies) > 1 ? ` · ${Number(job.vacancies)} platser` : ""}</small>
    </span>
    <i class="job-open" data-lucide="arrow-up-right"></i>
  </a>`;
}

function formatJobDate(value, prefix) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${prefix} ${date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}`;
}

function updateQuickJobs(municipalityData, municipality) {
  const total = Number(municipalityData?.total) || 0;
  const latest = municipalityData?.jobs?.[0];
  document.querySelectorAll("[data-quick-jobs-title]").forEach((element) => {
    element.textContent = `${total} lediga jobb i ${municipality}`;
  });
  document.querySelectorAll("[data-quick-jobs-detail]").forEach((element) => {
    element.textContent = latest?.headline || "Se aktuella annonser från Platsbanken";
  });
}

function showJobsError() {
  document.querySelector("#jobs-loading")?.setAttribute("hidden", "");
  document.querySelector("#jobs-list")?.setAttribute("hidden", "");
  const empty = document.querySelector("#jobs-empty");
  if (empty) {
    empty.hidden = false;
    empty.querySelector("strong").textContent = "Jobben kunde inte laddas";
    empty.querySelector("span").textContent = "Försök igen när sidan har uppdaterats.";
  }
  document.querySelectorAll("[data-quick-jobs-title]").forEach((element) => {
    element.textContent = `Jobb i ${DinPulsMunicipality.getName()}`;
  });
  document.querySelectorAll("[data-quick-jobs-detail]").forEach((element) => {
    element.textContent = "Jobbdata är tillfälligt otillgänglig";
  });
  if (window.lucide) lucide.createIcons();
}

/* =========================================================
   DINPULS v0.9.0 – LEDIGA BOSTÄDER
========================================================= */
let housingData = null;

async function initializeHousing() {
  DinPulsMunicipality.subscribe("housing", renderHousing);
  const loading = document.querySelector("#housing-loading");
  if (loading) loading.hidden = false;
  try {
    const response = await fetch(`data/housing.json?version=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    if (!data?.municipalities || typeof data.municipalities !== "object") {
      throw new Error("Bostadsfilen saknar kommuner");
    }
    housingData = data;
    renderHousing();
  } catch (error) {
    console.error("Lediga bostäder kunde inte laddas:", error);
    showHousingError();
  }
}

function renderHousing() {
  const list = document.querySelector("#housing-list");
  const empty = document.querySelector("#housing-empty");
  const loading = document.querySelector("#housing-loading");
  const providersBox = document.querySelector("#housing-providers");
  if (!list || !empty || !providersBox || !housingData) return;

  const municipality = DinPulsMunicipality.getName();
  const municipalityData = housingData.municipalities?.[municipality] || { listings: [], providers: [] };
  const listings = Array.isArray(municipalityData.listings) ? municipalityData.listings : [];
  const providers = Array.isArray(municipalityData.providers) ? municipalityData.providers : [];
  const visible = listings.slice(0, 8);

  list.innerHTML = visible.map(renderHousingItem).join("");
  list.hidden = visible.length === 0;
  empty.hidden = visible.length > 0;
  if (loading) loading.hidden = true;

  const total = document.querySelector("#housing-total");
  if (total) total.textContent = String(listings.length);

  const updated = document.querySelector("#housing-updated");
  if (updated) {
    const timestamp = new Date(municipalityData.updatedAt || housingData.generatedAt);
    const label = Number.isNaN(timestamp.getTime())
      ? "Källor kontrollerade"
      : `Kontrollerad ${timestamp.toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
    updated.innerHTML = `<i data-lucide="refresh-cw"></i>${label}`;
  }

  providersBox.innerHTML = providers.map((provider) => `<a class="housing-provider" href="${escapeAttribute(provider.url)}" target="_blank" rel="noopener noreferrer"><span><i data-lucide="building-2"></i><strong>${escapeHtml(provider.name)}</strong></span><small>Officiell bostadskö <i data-lucide="arrow-up-right"></i></small></a>`).join("");

  const sourceLink = document.querySelector("#housing-source-link");
  if (sourceLink) {
    sourceLink.hidden = providers.length === 0;
    sourceLink.href = `bostader.html?kommun=${encodeURIComponent(municipality)}`;
  }

  updateQuickHousing(municipalityData, municipality);
  if (window.lucide) lucide.createIcons();
}

function renderHousingItem(item) {
  const attributes = [
    Number(item.rooms) > 0 ? `${formatHousingNumber(item.rooms)} rum` : "",
    Number(item.size) > 0 ? `${formatHousingNumber(item.size)} m²` : "",
    Number(item.rent) > 0 ? `${new Intl.NumberFormat("sv-SE").format(Number(item.rent))} kr/mån` : ""
  ].filter(Boolean);
  const detailUrl = `bostader.html?kommun=${encodeURIComponent(DinPulsMunicipality.getName())}&annons=${encodeURIComponent(item.url || item.address || "")}`;
  return `<a class="housing-item" href="${escapeAttribute(detailUrl)}">
    <span class="housing-item-icon"><i data-lucide="house"></i></span>
    <span class="housing-item-content">
      <strong>${escapeHtml(item.address || "Ledig bostad")}</strong>
      <span>${escapeHtml(item.area || item.provider || "")}</span>
      <span class="housing-tags">${attributes.map((value) => `<span>${escapeHtml(value)}</span>`).join("")}</span>
      <small>${escapeHtml(formatHousingAvailability(item.available))} · ${escapeHtml(item.provider || "Officiell hyresvärd")}</small>
    </span>
    <i class="housing-open" data-lucide="arrow-up-right"></i>
  </a>`;
}

function formatHousingNumber(value) {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(Number(value));
}

function formatHousingAvailability(value) {
  if (!value) return "Tillgänglighet hos hyresvärden";
  if (String(value).toLocaleLowerCase("sv-SE") === "nu") return "Tillgänglig nu";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? `Tillgänglig ${value}`
    : `Tillgänglig ${date.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}`;
}

function updateQuickHousing(municipalityData, municipality) {
  const listings = Array.isArray(municipalityData?.listings) ? municipalityData.listings : [];
  const provider = municipalityData?.providers?.[0];
  document.querySelectorAll("[data-quick-housing-title]").forEach((element) => {
    element.textContent = listings.length > 0
      ? `${listings.length} lediga bostäder i ${municipality}`
      : `Bostäder i ${municipality}`;
  });
  document.querySelectorAll("[data-quick-housing-detail]").forEach((element) => {
    element.textContent = listings[0]?.address || (provider ? `Sök hos ${provider.name}` : "Se officiella bostadsköer");
  });
}

function showHousingError() {
  document.querySelector("#housing-loading")?.setAttribute("hidden", "");
  document.querySelector("#housing-list")?.setAttribute("hidden", "");
  const empty = document.querySelector("#housing-empty");
  if (empty) {
    empty.hidden = false;
    empty.querySelector("strong").textContent = "Bostäderna kunde inte laddas";
    empty.querySelector("span").textContent = "Öppna den officiella bostadskön eller försök igen senare.";
  }
  document.querySelectorAll("[data-quick-housing-title]").forEach((element) => {
    element.textContent = `Bostäder i ${DinPulsMunicipality.getName()}`;
  });
  document.querySelectorAll("[data-quick-housing-detail]").forEach((element) => {
    element.textContent = "Bostadsdata är tillfälligt otillgänglig";
  });
  if (window.lucide) lucide.createIcons();
}

/* =========================================================
   DINPULS v0.11.0 – TANKNING OCH BILLADDNING
========================================================= */
let fuelData = null;

async function initializeFuel() {
  DinPulsMunicipality.subscribe("fuel", renderFuel);
  try {
    const response = await fetch(`data/fuel.json?version=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    fuelData = await response.json();
    renderFuel();
  } catch (error) {
    console.error("Tank- och laddstationer kunde inte laddas:", error);
    const list = document.querySelector("#fuel-compact-list");
    if (list) list.innerHTML = `<span class="fuel-empty">Stationsdata är tillfälligt otillgänglig.</span>`;
  }
}

function renderFuel() {
  if (!fuelData) return;
  const municipality = DinPulsMunicipality.getName();
  const stations = fuelData.municipalities?.[municipality]?.stations || [];
  const priced = stations.filter(station => Number(station.price) > 0);
  const visible = [...stations].sort((a, b) => {
    if (Number(a.price) > 0 && Number(b.price) <= 0) return -1;
    if (Number(b.price) > 0 && Number(a.price) <= 0) return 1;
    return Number(a.distanceKm) - Number(b.distanceKm);
  }).slice(0, 3);
  const total = document.querySelector("#fuel-station-total");
  if (total) total.textContent = String(stations.length);
  const list = document.querySelector("#fuel-compact-list");
  if (list) {
    list.innerHTML = visible.length ? visible.map(station => `<a href="drivmedel.html?kommun=${encodeURIComponent(municipality)}">
      <span class="fuel-compact-icon ${station.type}"><i data-lucide="${station.type === "charging" ? "plug-zap" : "fuel"}"></i></span>
      <span><strong>${escapeHtml(station.name)}</strong><small>${escapeHtml(station.type === "charging" ? "Billaddning" : "Tankstation")} · ${Number(station.distanceKm) > 0 ? `${formatHousingNumber(station.distanceKm)} km` : `i ${escapeHtml(municipality)}`}</small></span>
      <b class="${Number(station.price) > 0 ? "has-price" : "missing-price"}">${Number(station.price) > 0 ? `${formatHousingNumber(station.price)} ${escapeHtml(station.unit)}` : "Pris saknas"}</b>
    </a>`).join("") : `<span class="fuel-empty">Inga registrerade stationer hittades inom 15 km.</span>`;
  }
  const pageLink = document.querySelector("#fuel-page-link");
  if (pageLink) pageLink.href = `drivmedel.html?kommun=${encodeURIComponent(municipality)}`;
  document.querySelectorAll("[data-quick-fuel-title]").forEach(element => element.textContent = `${stations.length} tank- och laddstationer i ${municipality}`);
  document.querySelectorAll("[data-quick-fuel-detail]").forEach(element => element.textContent = priced.length ? `${priced.length} med verifierat operatörspris` : "Se stationer, utbud och vägbeskrivning");
  if (window.lucide) lucide.createIcons();
}

/* =========================================================
   DINPULS v0.16.0 – DAGENS LUNCH I DEN RULLANDE REMSAN
========================================================= */
let lunchTickerData = null;

async function initializeLunch() {
  DinPulsMunicipality.subscribe("lunch", () => {
    renderLunchTicker(DinPulsMunicipality.getName());
  });

  try {
    const response = await fetch(`data/lunch.json?version=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Lunchdata kunde inte laddas: ${response.status}`);
    lunchTickerData = await response.json();
  } catch (error) {
    console.error(error);
    lunchTickerData = null;
  }

  renderLunchTicker(DinPulsMunicipality.getName());
}

function getStockholmWeekday() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Europe/Stockholm"
  }).format(new Date()).toLowerCase();
}

function renderLunchTicker(municipality) {
  const restaurants = lunchTickerData?.municipalities?.[municipality]?.restaurants || [];
  const weekday = getStockholmWeekday();
  const todayRestaurants = restaurants
    .map((restaurant) => ({
      ...restaurant,
      todayDishes: restaurant.status === "current"
        ? (restaurant.days?.[weekday] || [])
        : []
    }))
    .filter((restaurant) => restaurant.todayDishes.length);
  const fallback = [{
    id: "lunch",
    name: weekday === "saturday" || weekday === "sunday"
      ? `Helgens restaurangutbud i ${municipality}`
      : `Dagens menyer uppdateras för ${municipality}`,
    todayDishes: [weekday === "saturday" || weekday === "sunday"
      ? "Se öppna restauranger och kontrollera helgens meny"
      : "Se lunchställen och deras aktuella originalmenyer"]
  }];
  const dayNames = {
    monday: "MÅNDAG", tuesday: "TISDAG", wednesday: "ONSDAG",
    thursday: "TORSDAG", friday: "FREDAG", saturday: "LÖRDAG", sunday: "SÖNDAG"
  };

  const markup = (todayRestaurants.length ? todayRestaurants : fallback).map((restaurant) => {
    const detail = restaurant.todayDishes.slice(0, 3).join(" · ");
    const restaurantQuery = restaurant.id && restaurant.id !== "lunch"
      ? `&restaurang=${encodeURIComponent(restaurant.id)}`
      : "";

    return `<a class="lunch-airport-item" href="lunch.html?kommun=${encodeURIComponent(municipality)}${restaurantQuery}">
      <strong>${escapeHtml(restaurant.name)}</strong>
      <span>${escapeHtml(detail)}</span>
      <b>SE MENY <i data-lucide="chevron-right"></i></b>
    </a>`;
  }).join("");

  document.querySelectorAll("[data-lunch-ticker]").forEach((container) => {
    container.innerHTML = markup;
  });
  document.querySelectorAll("[data-lunch-strip-day]").forEach((element) => {
    element.textContent = dayNames[weekday] || "I DAG";
  });

  if (window.lucide) lucide.createIcons();
}

/* =========================================================
   DINPULS v0.10.0 – TRE ROTERANDE PREMIUMANNONSGRUPPER
========================================================= */
function initializeRotatingAds() {
  document.querySelectorAll("[data-ad-dice]").forEach((module, moduleIndex) => {
    const startNumber = moduleIndex * 10 + 1;
    module.innerHTML = `<span class="ad-dice-label">Annonsgrupp ${moduleIndex + 1}</span>
      ${Array.from({ length: 10 }, (_, faceIndex) => {
        const slot = startNumber + faceIndex;
        return `<a class="ad-face" data-ad-face href="mailto:annonser@dinpuls.se?subject=Annonsplats%20${slot}" ${faceIndex ? "hidden" : ""}>
          <span class="ad-slot">PREMIUM ${slot}</span>
          <strong>Din verksamhet kan synas här</strong>
          <small>Lokalt i <span data-municipality-name>${escapeHtml(DinPulsMunicipality.getName())}</span> · 1 500 kr/mån</small>
          <b>Boka plats <i data-lucide="arrow-right"></i></b>
        </a>`;
      }).join("")}
      <div class="ad-navigation">
        <button type="button" data-ad-previous aria-label="Föregående annons"><i data-lucide="chevron-left"></i></button>
        <div class="ad-dots" aria-hidden="true">${Array.from({ length: 10 }, (_, index) => `<span data-ad-dot class="${index === moduleIndex ? "active" : ""}"></span>`).join("")}</div>
        <button type="button" data-ad-next aria-label="Nästa annons"><i data-lucide="chevron-right"></i></button>
      </div>`;
    const faces = [...module.querySelectorAll("[data-ad-face]")];
    const dots = [...module.querySelectorAll("[data-ad-dot]")];
    if (!faces.length) return;
    let current = moduleIndex % faces.length;

    const show = (index) => {
      current = (index + faces.length) % faces.length;
      faces.forEach((face, faceIndex) => face.hidden = faceIndex !== current);
      dots.forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === current));
      module.dataset.activeAd = String(current + 1);
    };

    show(current);
    let timer = window.setInterval(() => show(current + 1), 6000 + moduleIndex * 700);
    const restart = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => show(current + 1), 6000 + moduleIndex * 700);
    };
    module.querySelector("[data-ad-previous]")?.addEventListener("click", () => {
      show(current - 1);
      restart();
    });
    module.querySelector("[data-ad-next]")?.addEventListener("click", () => {
      show(current + 1);
      restart();
    });
  });
}

/* =========================================================
   DINPULS v0.18.0 – LOKAL SPORT
========================================================= */
let sportsData = null;

async function initializeSports() {
  const response = await fetch(`data/sports.json?version=${DINPULS_VERSION}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Sportdata kunde inte laddas: ${response.status}`);
  sportsData = await response.json();
  DinPulsMunicipality.subscribe("sport", renderSportsHome);
  renderSportsHome(DinPulsMunicipality.getConfig());
}

function renderSportsHome(config) {
  const municipality = sportsData?.municipalities?.[config.name] || { clubs: [], liveSources: [] };
  const clubs = Array.isArray(municipality.clubs) ? municipality.clubs : [];
  const sources = Array.isArray(municipality.liveSources) ? municipality.liveSources : [];
  const matches = Array.isArray(municipality.matches) ? municipality.matches : [];
  const matchCount = matches.length;
  const sports = [...new Set(clubs.flatMap((club) => club.sports || []))];
  const summary = document.querySelector("#sport-home-summary");
  const list = document.querySelector("#sport-home-list");
  const link = document.querySelector("#sport-home-link");
  if (summary) summary.innerHTML = `<strong>${clubs.length} föreningar</strong><span>${sports.length} sporter · ${matchCount ? `${matchCount} inlästa matcher` : `inga matcher inlästa just nu`} · ${sources.length} officiella källor</span>`;
  const featured = sports.slice(0, 4).map((sport) => ({
    sport,
    clubs: clubs.filter((club) => (club.sports || []).includes(sport)),
    matches: matches.filter((match) => match.sport === sport)
  }));
  if (list) list.innerHTML = featured.map((item) => `<a href="sport.html?kommun=${encodeURIComponent(config.name)}&sport=${encodeURIComponent(item.sport)}">
    <span class="sport-home-icon"><i data-lucide="medal"></i></span>
    <span><strong>${escapeHtml(item.sport)}</strong><small>${item.matches.length ? `${item.matches.length} inlästa matcher` : `${item.clubs.length} lokala föreningar`}</small></span>
    <i data-lucide="chevron-right"></i>
  </a>`).join("");
  if (link) link.href = `sport.html?kommun=${encodeURIComponent(config.name)}`;
  if (window.lucide) lucide.createIcons();
}
