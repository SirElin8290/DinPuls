/* =========================================================
   DINPULS.SE v0.24.7
   Central kommunmotor, komponenter och datamoduler
========================================================= */

const DINPULS_VERSION = "0.24.7";
const HERO_VISIT_GAP = 30 * 60 * 1000;
const DEFAULT_MUNICIPALITY = window.DinPulsMunicipalityState?.DEFAULT_NAME || "Åmål";
const STOCKHOLM_TIME_ZONE = "Europe/Stockholm";
const {
  stockholmDateKey,
  cleanNumber,
  formatSwedishTime,
  formatRelativeTime: formatRelativeNewsTime,
  getInitials: getNewsSourceInitials,
  formatEventDate,
  formatJobDate,
  formatHousingNumber,
  formatHousingAvailability,
  stockholmWeekday: getStockholmWeekday,
  setText,
  escapeHtml,
  escapeAttribute,
  safeExternalUrl,
  safeHref
} = window.DinPulsCore;

const componentNames = [
  "header",
  "homepage-guide",
  "google-search",
  "quick-strip",
  "navigation",
  "lunch-strip",
  "hero",
  "missing-people",
  "premium-ad-1",
  "primary-cards",
  "transport",
  "sport",
  "leisure",
  "health",
  "authorities",
  "service",
  "cinema",
  "secondary-cards",
  "premium-ad-2",
  "jobs-housing",
  "premium-ad-3",
  "footer"
];

const DinPulsMunicipality = {
  currentName: DEFAULT_MUNICIPALITY,
  defaultName: DEFAULT_MUNICIPALITY,
  municipalities: new Map(),
  subscribers: new Map(),

  async initialize() {
    const response = await fetch("data/municipalities.json", {
      cache: "no-cache"
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

const WEATHER_REFRESH_INTERVAL = 10 * 60 * 1000;
const WEATHER_CACHE_MAX_AGE = 90 * 60 * 1000;
const WEATHER_LIVE_DATA_URL = "data/weather-live.json";
const STOCKHOLM_DATE_FORMAT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: STOCKHOLM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
async function loadComponent(name) {
  const target = document.querySelector(`[data-component="${name}"]`);

  if (!target) {
    return;
  }

  const response = await fetch(`components/${name}.html?version=${DINPULS_VERSION}`);

  if (!response.ok) {
    throw new Error(`Kunde inte ladda komponenten ${name}`);
  }

  target.innerHTML = await response.text();
}

async function startDinPuls() {
  try {
    initializeSeasonalTheme();
    await Promise.all(componentNames.map(loadComponent));
    document.dispatchEvent(new CustomEvent("dinpuls:components-loaded"));
    await DinPulsMunicipality.initialize();
    await initializeFirstVisitMunicipality();

    if (window.lucide) {
      lucide.createIcons();
    }

    initializeTabs();
    initializeSearch();
    initializeHomepageGuide();
    initializeHomepageCustomization();
    initializeClock();
    await initializeNameDay();
    initializeTheme();
    initializeSeasonalTheme();
    initializeMobileMenu();
    initializeTrafficCardLink();
    initializeRotatingAds();
    initializeMunicipality();
    initializeWeather();
    await Promise.all([initializeImportant(), initializeMissingPeople(), initializeTraffic(), initializeNews(), initializeTransport(), initializeSports(), initializeLeisure(), initializeJobs(), initializeHousing(), initializeEvents(), initializeLunch(), initializeCinemaHome()]);
    initializeNotifications();
    await DinPulsMunicipality.setMunicipality(
      DinPulsMunicipality.getName(),
      { persist: false, force: true }
    );
  } catch (error) {
    console.error("DinPuls kunde inte starta:", error);
  }
}

function initializeHomepageGuide() {
  const dialog = document.querySelector("#homepage-dialog");
  const openButton = document.querySelector("[data-homepage-guide-open]");
  const closeButton = document.querySelector("[data-homepage-guide-close]");
  const instructions = document.querySelector("[data-homepage-instructions]");
  const browserButtons = [...document.querySelectorAll("[data-homepage-browser]")];
  const copyButton = document.querySelector("[data-copy-homepage-url]");
  const copyStatus = document.querySelector("[data-homepage-copy-status]");
  if (!dialog || !openButton || !instructions) return;

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const instructionSets = {
    chrome: isMobile
      ? ["Öppna menyn med de tre punkterna.", "Välj Inställningar och sedan Startsida.", "Välj en anpassad webbadress och skriv https://dinpuls.se."]
      : ["Öppna menyn med de tre punkterna och välj Inställningar.", "Välj Vid start.", "Välj Öppna en särskild sida eller en uppsättning sidor.", "Klicka på Lägg till en ny sida och ange https://dinpuls.se."],
    edge: isMobile
      ? ["Öppna menyn och välj Inställningar.", "Välj Allmänt och sedan Startsida.", "Välj En specifik sida och ange https://dinpuls.se."]
      : ["Öppna menyn med de tre punkterna och välj Inställningar.", "Välj Start, hem och nya flikar.", "Under När Microsoft Edge startar väljer du Öppna dessa sidor.", "Lägg till https://dinpuls.se."],
    firefox: isMobile
      ? ["Öppna menyn och välj Inställningar.", "Välj Startsida.", "Välj en anpassad webbadress och ange https://dinpuls.se. Om valet saknas stöder din mobilversion inte en egen startsida."]
      : ["Öppna menyn och välj Inställningar.", "Välj Hem.", "Vid Startsida och nya fönster väljer du Anpassade webbadresser.", "Ange https://dinpuls.se."],
    safari: isMobile
      ? ["Safari på iPhone och iPad kan inte ställas in så att en bestämd webbplats alltid öppnas när Safari startar.", "DinPuls kan därför inte göras till automatisk startsida i Safari på mobilen."]
      : ["Öppna Safari och välj Safari > Inställningar.", "Välj Allmänt.", "Skriv https://dinpuls.se vid Startsida.", "Välj Startsida vid Nya fönster öppnas med."]
  };

  function detectedBrowser() {
    const agent = navigator.userAgent;
    if (/Edg|EdgiOS|EdgA/i.test(agent)) return "edge";
    if (/Firefox|FxiOS/i.test(agent)) return "firefox";
    if (/Chrome|CriOS/i.test(agent)) return "chrome";
    if (/Safari/i.test(agent)) return "safari";
    return "chrome";
  }

  function showBrowser(browser) {
    const steps = instructionSets[browser] || instructionSets.chrome;
    instructions.innerHTML = `<ol>${steps.map(step => `<li>${step}</li>`).join("")}</ol>`;
    browserButtons.forEach(button => {
      const selected = button.dataset.homepageBrowser === browser;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }

  openButton.addEventListener("click", () => {
    showBrowser(detectedBrowser());
    dialog.showModal();
  });
  closeButton?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  browserButtons.forEach(button => button.addEventListener("click", () => showBrowser(button.dataset.homepageBrowser)));
  copyButton?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("https://dinpuls.se");
      copyStatus.textContent = "Adressen är kopierad.";
    } catch {
      copyStatus.textContent = "Markera och kopiera adressen ovan.";
    }
  });
}

const HOME_MODULE_STORAGE_KEY = "dinpuls-home-modules-v1";
const HOME_OPTIONAL_MODULES = Object.freeze({
  news: ["#nyheter", ".news-sources-section"],
  events: ["#evenemang"],
  lunch: [".lunch-airport-strip"],
  traffic: ["#trafik"],
  transport: ["#buss", "#kollektivtrafik"],
  jobs: ["#jobb"],
  housing: ["#bostader"],
  sport: [".sport-home"],
  leisure: [".leisure-home"],
  cinema: [".cinema-home"],
  health: [".health-home"],
  service: [".service-home"],
  authorities: [".authorities-home"]
});

function readHomepageModulePreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(HOME_MODULE_STORAGE_KEY) || "{}");
    const hidden = Array.isArray(stored.hidden)
      ? stored.hidden.filter(name => Object.hasOwn(HOME_OPTIONAL_MODULES, name))
      : [];
    return new Set(hidden);
  } catch {
    return new Set();
  }
}

function initializeHomepageCustomization() {
  const dialog = document.querySelector("#homepage-customize-dialog");
  const openButton = document.querySelector("#homepage-customize-button");
  const closeButton = dialog?.querySelector(".homepage-customize-close");
  const resetButton = document.querySelector("#homepage-customize-reset");
  const controls = [...document.querySelectorAll("[data-home-module]")];
  const status = document.querySelector("#homepage-customize-status");
  if (!dialog || !openButton || controls.length === 0) return;

  let hiddenModules = readHomepageModulePreferences();

  function applyPreferences({ save = false } = {}) {
    Object.entries(HOME_OPTIONAL_MODULES).forEach(([name, selectors]) => {
      const hidden = hiddenModules.has(name);
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => { element.hidden = hidden; });
      });
    });

    controls.forEach(control => { control.checked = !hiddenModules.has(control.dataset.homeModule); });
    document.querySelectorAll(".grid.three,.grid.lower,.primary-service-grid").forEach(grid => {
      const children = [...grid.children];
      const visibleChildren = children.filter(child => !child.hidden);
      grid.hidden = visibleChildren.length === 0;
      grid.classList.toggle("personalized-grid", visibleChildren.length !== children.length && visibleChildren.length > 0);
    });

    if (status) {
      status.textContent = hiddenModules.size === 0
        ? "Alla valbara moduler visas"
        : `${hiddenModules.size} ${hiddenModules.size === 1 ? "modul är dold" : "moduler är dolda"}`;
    }
    openButton.classList.toggle("has-custom-home", hiddenModules.size > 0);
    if (save) {
      try {
        localStorage.setItem(HOME_MODULE_STORAGE_KEY, JSON.stringify({ hidden: [...hiddenModules] }));
      } catch {
        if (status) status.textContent = "Valet gäller under det här besöket";
      }
    }
  }

  controls.forEach(control => control.addEventListener("change", () => {
    const name = control.dataset.homeModule;
    if (control.checked) hiddenModules.delete(name);
    else hiddenModules.add(name);
    applyPreferences({ save: true });
  }));

  openButton.addEventListener("click", () => {
    openButton.setAttribute("aria-expanded", "true");
    dialog.showModal();
  });
  closeButton?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => openButton.setAttribute("aria-expanded", "false"));
  resetButton?.addEventListener("click", () => {
    hiddenModules = new Set();
    applyPreferences({ save: true });
  });
  window.addEventListener("storage", event => {
    if (event.key !== HOME_MODULE_STORAGE_KEY) return;
    hiddenModules = readHomepageModulePreferences();
    applyPreferences();
  });

  applyPreferences();
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
  let dayData = null;

  try {
    const response = await fetch(
      `https://sholiday.faboul.se/dagar/v2.1/${dateParts.year}/${dateParts.month}/${dateParts.day}`,
      { cache: "no-cache" }
    );
    if (!response.ok) throw new Error(`Namnsdags-API svarade ${response.status}`);
    const payload = await response.json();
    dayData = payload?.dagar?.[0] || dayData;
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

  const input = form.querySelector("input");
  const feedback = document.querySelector("#search-feedback");
  input?.addEventListener("input", () => {
    if (feedback) feedback.hidden = true;
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim().toLocaleLowerCase("sv-SE");
    if (!value) return;
    const municipality = encodeURIComponent(DinPulsMunicipality.getName());
    const destinations = [
      { terms: ["jobb", "arbete", "lediga jobb", "platsbanken"], url: `jobb.html?kommun=${municipality}` },
      { terms: ["bostad", "bostäder", "lägenhet", "hyresrätt", "ledig bostad"], url: `bostader.html?kommun=${municipality}` },
      { terms: ["lunch", "restaurang", "dagens lunch"], url: `lunch.html?kommun=${municipality}` },
      { terms: ["bio", "biograf", "film", "filmer", "filmprogram"], url: `bio.html?kommun=${municipality}` },
      { terms: ["evenemang", "event", "kalender", "festival", "konsert"], url: `evenemang.html?kommun=${municipality}` },
      { terms: ["sport", "idrott", "motion", "matcher", "resultat", "tabell", "fotboll", "innebandy", "ishockey", "golf", "ridning"], url: `sport.html?kommun=${municipality}` },
      { terms: ["fritid", "förening", "scouter", "kör", "musik", "dans", "teater", "brädspel", "gaming", "hund", "natur", "hembygd", "bygdegård"], url: `fritid.html?kommun=${municipality}` },
      { terms: ["vård", "hälsa", "vårdcentral", "1177", "apotek", "tandläkare", "fysioterapeut", "fysioterapi", "kiropraktor", "naprapat", "massage", "fotvård", "psykolog"], url: `vard.html?kommun=${municipality}` },
      { terms: ["myndighet", "myndigheter", "samhällsservice", "socialen", "socialtjänst", "försäkringskassan", "vab", "sjukpenning", "pension", "skatt", "deklaration", "folkbokföring", "arbetsförmedlingen", "csn", "kronofogden", "skuld", "polisen", "körkort", "transportstyrelsen", "trafikverket", "bygglov", "god man"], url: `myndigheter.html?kommun=${municipality}` },
      { terms: ["service", "hantverk", "verkstad", "bilverkstad", "däck", "däckbyte", "snickare", "rörmokare", "vvs", "elektriker", "målare", "golvläggare", "byggvaruhus", "byggmax", "optimera", "jem och fix", "städ", "flytt", "låssmed"], url: `service.html?kommun=${municipality}` },
      { terms: ["trafik", "vägarbete", "trafikläge"], url: `trafik.html?kommun=${municipality}` },
      { terms: ["buss", "tåg", "avgång", "avgångar", "kollektivtrafik", "hållplats"], url: "#kollektivtrafik" },
      { terms: ["väder", "prognos"], url: "#vader" },
      { terms: ["nyheter", "lokala nyheter", "senaste nytt"], url: "#nyheter" },
      { terms: ["notis", "notiser", "uppdateringar"], action: () => document.querySelector("#notification-button")?.click() },
      { terms: ["annonsera", "annons"], url: "information.html#annonsera" },
      { terms: ["källor", "ansvar", "rättelse"], url: "information.html#kallor" },
      { terms: ["kontakt", "feedback", "integritet", "om oss"], url: `information.html#${value.includes("integritet") ? "integritet" : value.includes("feedback") ? "feedback" : value.includes("om ") ? "om" : "kontakt"}` }
    ];
    const match = destinations.find(item => item.terms.some(term => value.includes(term)));
    if (match) {
      if (match.action) match.action();
      else window.location.href = match.url;
      return;
    }
    if (feedback) {
      feedback.textContent = "Ingen träff. Prova jobb, bostäder, vård, myndigheter, service, hantverk, lunch, evenemang, sport, trafik, buss, väder, nyheter eller notiser.";
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
      timeZone: STOCKHOLM_TIME_ZONE,
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
    if (open) {
      if (window.lucide) lucide.createIcons();
      close?.focus();
    } else if (document.activeElement && panel.contains(document.activeElement)) {
      button.focus();
    }
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
  document.querySelector("#notification-button")?.setAttribute(
    "aria-label",
    unread.length ? `Öppna notiser, ${unread.length} olästa` : "Öppna notiser"
  );
  list.hidden = currentNotificationItems.length === 0;
  empty.hidden = currentNotificationItems.length !== 0;
  const markRead = document.querySelector("#notification-mark-read");
  if (markRead) markRead.hidden = unread.length === 0;
  list.innerHTML = currentNotificationItems.map((item) => `
    <a class="notification-item ${seen.has(item.key) ? "read" : "unread"}"
       href="${escapeAttribute(safeHref(item.url))}"
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
  const priorities = { important: 100, transport: 90, traffic: 80, sport: 75, jobs: 70, housing: 60, events: 55, news: 45, fuel: 35, lunch: 30 };
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
      ? `Pågår till ${end.toLocaleDateString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, day: "numeric", month: "short" })}`
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
  (sportsData?.municipalities?.[municipality]?.matches || []).filter((match) => {
    const start = new Date(match.startTime).getTime();
    if (!start) return false;
    const difference = start - Date.now();
    const finished = ["finished", "final", "ended"].includes(String(match.status || "").toLowerCase());
    return finished ? difference >= -2 * 86400000 : difference >= 0 && difference <= 7 * 86400000;
  }).slice(0, 3).forEach((match) => {
    const finished = ["finished", "final", "ended"].includes(String(match.status || "").toLowerCase());
    const score = finished && match.homeScore !== null && match.homeScore !== undefined && match.awayScore !== null && match.awayScore !== undefined && Number.isFinite(Number(match.homeScore)) && Number.isFinite(Number(match.awayScore))
      ? ` · ${match.homeScore}–${match.awayScore}` : "";
    add("sport", "trophy", match.id, `${match.homeTeam} – ${match.awayTeam}${score}`, match.competition || match.sport || "Lokalsport", `sport.html?kommun=${encodeURIComponent(municipality)}&sport=${encodeURIComponent(match.sport || "")}`, match.startTime);
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
  const setOpen = (open) => {
    nav?.classList.toggle("open", open);
    button?.setAttribute("aria-expanded", String(open));
    button?.setAttribute("aria-label", open ? "Stäng meny" : "Öppna meny");
  };

  button?.addEventListener("click", () => {
    setOpen(!nav?.classList.contains("open"));
  });

  nav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      setOpen(false);
    });
  });
  document.addEventListener("click", (event) => {
    if (!nav?.classList.contains("open") || nav.contains(event.target) || button?.contains(event.target)) return;
    setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
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
      .sort((left, right) => left.name.localeCompare(right.name, "sv-SE"))
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

function initializeFirstVisitMunicipality() {
  const onboarding = document.querySelector("#municipality-onboarding");
  const options = document.querySelector("#municipality-onboarding-options");
  if (!onboarding || !options || window.DinPulsMunicipalityState?.hasExplicitChoice?.()) {
    return Promise.resolve();
  }

  const municipalities = DinPulsMunicipality.getAll()
    .sort((left, right) => left.name.localeCompare(right.name, "sv-SE"));
  options.innerHTML = municipalities.map((item) => `
    <button type="button" data-first-municipality="${escapeAttribute(item.name)}" role="listitem">
      <span><i data-lucide="map-pin"></i></span>
      <strong>${escapeHtml(item.name)}</strong>
      <small>${escapeHtml(item.county || "")}</small>
      <i data-lucide="arrow-right"></i>
    </button>`).join("");
  onboarding.hidden = false;
  document.body.classList.add("municipality-onboarding-open");
  if (window.lucide) lucide.createIcons();

  return new Promise((resolve) => {
    options.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-first-municipality]");
      if (!button || button.disabled) return;
      options.querySelectorAll("button").forEach((item) => { item.disabled = true; });
      await DinPulsMunicipality.setMunicipality(button.dataset.firstMunicipality, { persist: true, force: true });
      onboarding.hidden = true;
      document.body.classList.remove("municipality-onboarding-open");
      resolve();
    });
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
  const municipalPages = new Set(["jobb.html", "bostader.html", "lunch.html", "evenemang.html", "bio.html", "sport.html", "fritid.html", "matkasse.html", "trafik.html", "vard.html", "myndigheter.html", "service.html"]);
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
    const selectedHeroImage = selectHeroImageForVisit(config);
    const hasImage = Boolean(selectedHeroImage);
    hero.classList.toggle("has-generic-background", !hasImage);
    heroImage.hidden = !hasImage;
    if (hasImage) {
      heroImage.alt = `Vy över ${config.name}`;
      if (heroImage.getAttribute("src") !== selectedHeroImage) {
        heroImage.classList.add("is-changing");
        const preload = new Image();
        preload.onload = () => {
          heroImage.src = selectedHeroImage;
          requestAnimationFrame(() => heroImage.classList.remove("is-changing"));
        };
        preload.onerror = () => heroImage.classList.remove("is-changing");
        preload.src = selectedHeroImage;
      } else {
        heroImage.classList.remove("is-changing");
      }
    }
  }
}

function selectHeroImageForVisit(config) {
  const images = Array.isArray(config.heroImages) && config.heroImages.length
    ? config.heroImages
    : config.heroImage
      ? [config.heroImage]
      : [];

  if (images.length < 2) return images[0] || null;

  const storageKey = `dinpuls-hero-rotation:${config.slug || config.name}`;
  const now = Date.now();
  let state = { index: 0, lastSeen: 0 };

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && Number.isInteger(saved.index) && Number.isFinite(saved.lastSeen)) {
      state = saved;
    }

    if (state.lastSeen > 0 && now - state.lastSeen >= HERO_VISIT_GAP) {
      state.index = (state.index + 1) % images.length;
    }

    state.index = ((state.index % images.length) + images.length) % images.length;
    state.lastSeen = now;
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    state.index = 0;
  }

  return images[state.index];
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
  const forecastUrl =
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

  const fetchJson = async (url, label) => {
    const response = await fetch(url, {
      signal: weatherRequestController.signal,
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`${label} svarade med status ${response.status}`);
    return response.json();
  };

  try {
    const [forecastResult, liveResult] = await Promise.allSettled([
      fetchJson(forecastUrl, "SMHI"),
      fetchJson(WEATHER_LIVE_DATA_URL, "Väderläget")
    ]);
    if (requestNumber !== weatherRequestNumber || municipality !== DinPulsMunicipality.getName()) return;

    let forecastData = forecastResult.status === "fulfilled" ? forecastResult.value : null;
    const liveData = liveResult.status === "fulfilled"
      ? liveResult.value?.municipalities?.[municipality]
      : null;
    const liveGeneratedAt = liveResult.status === "fulfilled" ? liveResult.value?.generatedAt : null;

    if (forecastData) writeWeatherCache(config.slug || municipality, forecastData);
    if (!forecastData) forecastData = readWeatherCache(config.slug || municipality)?.data || null;
    if (!forecastData && !liveData?.nowcast?.current) {
      throw forecastResult.reason || liveResult.reason || new Error("Väderdata saknas");
    }
    renderWeather(forecastData, municipality, {
      live: liveData,
      liveGeneratedAt,
      forecastCached: forecastResult.status !== "fulfilled"
    });
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error("Väderläget kunde inte hämtas:", error);
    if (municipality === DinPulsMunicipality.getName()) showWeatherError(municipality);
  }
}

const weatherMemoryCache = new Map();

function writeWeatherCache(key, data) {
  weatherMemoryCache.set(String(key).toLocaleLowerCase("sv-SE"), { savedAt: Date.now(), data });
}

function readWeatherCache(key) {
  const cached = weatherMemoryCache.get(String(key).toLocaleLowerCase("sv-SE"));
  if (!cached?.data || !Number.isFinite(cached.savedAt) || Date.now() - cached.savedAt > WEATHER_CACHE_MAX_AGE) return null;
  return cached;
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
  const entries = (response?.timeSeries || [])
    .map(normalizeWeatherEntry)
    .filter((entry) => entry.time && Number.isFinite(entry.temperature));
  const now = Date.now();
  const forecastCurrent = entries.reduce((closest, entry) => {
    const distance = Math.abs(new Date(entry.time).getTime() - now);
    return !closest || distance < closest.distance ? { entry, distance } : closest;
  }, null)?.entry;
  const liveCurrent = normalizeLiveWeatherEntry(options.live?.nowcast?.current);
  const current = liveCurrent || forecastCurrent;
  if (!current || !Number.isFinite(current.temperature)) {
    throw new Error("Väderdata saknar användbara temperaturvärden.");
  }

  const localToday = STOCKHOLM_DATE_FORMAT.format(new Date(now));
  const todayEntries = entries.filter(
    (entry) =>
      STOCKHOLM_DATE_FORMAT.format(new Date(entry.time)) === localToday
  );

  const temperatures = (todayEntries.length ? todayEntries : entries)
    .map((entry) => entry.temperature)
    .filter(Number.isFinite);

  const high = temperatures.length ? Math.max(...temperatures) : current.temperature;
  const low = temperatures.length ? Math.min(...temperatures) : current.temperature;
  const symbol = liveCurrent
    ? getMetWeatherSymbol(current.symbolCode)
    : getWeatherSymbol(current.symbolCode);
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
    Number.isFinite(current.precipitationRate)
      ? `${current.precipitationRate.toFixed(1)} mm/h`
      : Number.isFinite(current.precipitation)
        ? `${current.precipitation.toFixed(1)} mm`
      : "0,0 mm"
  );
  setText("#weather-precipitation-label", Number.isFinite(current.precipitationRate) ? "Regnintensitet nu" : "Prognos nederbörd");
  setText("#weather-symbol", symbol.emoji);

  const updatedTime = options.live?.nowcast?.updatedAt || options.liveGeneratedAt || response?.createdTime || response?.referenceTime;

  setText(
    "#weather-updated",
    updatedTime
      ? `Uppdaterad ${formatSwedishTime(updatedTime)}`
      : "Väderläget är hämtat"
  );

  renderNowcastTimeline(options.live?.nowcast?.timeline || []);
  renderWeatherAlert(options.live, current, municipality);
  renderHourlyForecast(forecastEntries);

  const status = document.querySelector("#weather-status");

  setWeatherPanel("content");

  if (status) {
    status.textContent = liveCurrent && !options.live?.nowcast?.stale ? "Radarbaserat nuläge" : "Senast hämtad prognos";
    status.className = `weather-live-badge ${liveCurrent && !options.live?.nowcast?.stale ? "is-live" : "is-fallback"}`;
  }

  updateHeaderWeather(current.temperature, symbol.emoji);
}

function normalizeLiveWeatherEntry(entry) {
  if (!entry) return null;
  const temperature = cleanNumber(entry.temperature);
  if (!Number.isFinite(temperature)) return null;
  return {
    time: entry.time,
    temperature,
    windSpeed: cleanNumber(entry.windSpeed),
    humidity: cleanNumber(entry.humidity),
    precipitationRate: cleanNumber(entry.precipitationRate),
    precipitation: cleanNumber(entry.precipitationAmount),
    symbolCode: String(entry.symbolCode || "")
  };
}

function getMetWeatherSymbol(code) {
  const value = String(code || "").toLowerCase();
  if (value.includes("thunder")) return { emoji: "⛈️", text: value.includes("heavy") ? "Kraftiga åskskurar" : "Åska eller åskskurar" };
  if (value.includes("heavyrain")) return { emoji: "🌧️", text: "Kraftigt regn" };
  if (value.includes("rainshowers")) return { emoji: "🌦️", text: "Regnskurar" };
  if (value.includes("rain")) return { emoji: "🌧️", text: "Regn" };
  if (value.includes("sleet")) return { emoji: "🌨️", text: "Snöblandat regn" };
  if (value.includes("snow")) return { emoji: "❄️", text: "Snöfall" };
  if (value.includes("fog")) return { emoji: "🌫️", text: "Dimma" };
  if (value.includes("cloudy")) return { emoji: value.includes("partly") ? "⛅" : "☁️", text: value.includes("partly") ? "Halvklart" : "Mulet" };
  if (value.includes("fair")) return { emoji: "🌤️", text: "Nästan klart" };
  if (value.includes("clear")) return { emoji: "☀️", text: "Klart" };
  return { emoji: "🌤️", text: "Växlande väder" };
}

function selectNowcastEntries(entries) {
  const valid = entries.map((entry) => ({
    time: entry?.time,
    precipitationRate: cleanNumber(entry?.precipitationRate),
    precipitation: cleanNumber(entry?.precipitationAmount)
  })).filter((entry) => entry.time && Number.isFinite(entry.precipitationRate));
  if (!valid.length) return [];
  const firstTime = new Date(valid[0].time).getTime();
  return [0, 15, 30, 60].map((minutes) => valid.reduce((closest, entry) => {
    const distance = Math.abs(new Date(entry.time).getTime() - (firstTime + minutes * 60000));
    return !closest || distance < closest.distance ? { entry, distance } : closest;
  }, null)?.entry).filter((entry, index, list) => entry && list.indexOf(entry) === index);
}

function renderNowcastTimeline(entries) {
  const container = document.querySelector("#weather-nowcast");
  if (!container) return;
  const selected = selectNowcastEntries(entries);
  if (!selected.length) {
    container.innerHTML = '<span class="weather-nowcast-missing">Radarbaserat regnläge är tillfälligt otillgängligt.</span>';
    return;
  }
  container.innerHTML = selected.map((entry, index) => {
    const rate = Number.isFinite(entry.precipitationRate) ? entry.precipitationRate : 0;
    const level = rate >= 4 ? "heavy" : rate >= 1 ? "moderate" : rate > 0 ? "light" : "dry";
    const label = index === 0 ? "Nu" : new Date(entry.time).toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
    return `<div data-rain="${level}"><span>${label}</span><i></i><strong>${rate > 0 ? `${rate.toFixed(1)} mm/h` : "Uppehåll"}</strong></div>`;
  }).join("");
}

function renderWeatherAlert(live, current, municipality) {
  const alert = document.querySelector("#weather-alert");
  const lightning = document.querySelector("#weather-lightning");
  if (!alert || !lightning) return;
  const lightningData = live?.lightning;
  const strikes = lightningData?.available ? Number(lightningData.count || 0) : 0;
  const nearest = cleanNumber(lightningData?.nearestKm);
  const symbol = String(current.symbolCode || "").toLowerCase();
  const rate = Number.isFinite(current.precipitationRate) ? current.precipitationRate : 0;
  const thunder = symbol.includes("thunder") || strikes > 0;
  const severeRain = rate >= 4;

  alert.hidden = !thunder && !severeRain;
  if (!alert.hidden) {
    alert.dataset.level = thunder ? "thunder" : "rain";
    setText("#weather-alert-title", thunder ? `Åska nära ${municipality}` : `Kraftigt regn i ${municipality}`);
    setText("#weather-alert-detail", strikes
      ? `${strikes} registrerade blixtar senaste fem minuterna${Number.isFinite(nearest) ? ` · närmaste cirka ${nearest.toFixed(1)} km` : ""}`
      : `Radarbaserad regnintensitet cirka ${rate.toFixed(1)} mm/h`);
  }

  lightning.hidden = !lightningData?.available || strikes <= 0;
  if (!lightning.hidden) {
    setText("#weather-lightning-text", `${strikes} blixtar registrerade inom 40 km senaste fem minuterna${Number.isFinite(nearest) ? ` · närmaste ${nearest.toFixed(1)} km` : ""}`);
  }
  if (window.lucide) lucide.createIcons();
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

function chooseForecastEntries(entries, now, count) {
  const futureEntries = entries.filter(
    (entry) => new Date(entry.time).getTime() >= now
  );
  return futureEntries.slice(0, count);
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
              timeZone: STOCKHOLM_TIME_ZONE,
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

startDinPuls();

/* =========================================================
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
    const response = await fetch(`data/news.json`, { cache: "no-cache" });
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
  let relevant = scoped
    .sort(compareNewsQuality)
    .slice(0, 5);
  const sourceFallback = relevant.length === 0;
  if (sourceFallback) {
    relevant = allNewsSources
      .filter((source) => source.scope === "local" && (source.municipalities || []).includes(municipality))
      .slice(0, 5)
      .map((source, index) => ({
        id: `local-source-${municipality}-${index}`,
        scope: "local", source: source.name,
        sourceType: source.type?.includes("Kommun") ? "municipality" : "media",
        quality: 80, impact: 40, category: "Lokal källa", region: municipality,
        municipalities: [municipality],
        title: `Senaste nytt från ${source.name}`,
        summary: `Öppna ${source.name} för de senaste lokala nyheterna från ${municipality}.`,
        access: source.access, publishedAt: new Date().toISOString(), url: source.url,
        important: false, sourceFallback: true,
      }));
  }
  feed.innerHTML = relevant.map(renderNewsArticle).join("");
  loading.hidden = true;
  feed.hidden = relevant.length === 0;
  empty.hidden = relevant.length > 0;
  if (count) count.textContent = sourceFallback ? `${relevant.length} lokala källor` : `${relevant.length} ${relevant.length === 1 ? "lokal nyhet" : "lokala nyheter"}`;
  const subheading = document.querySelector("#news-subheading");
  if (subheading) subheading.textContent = sourceFallback ? `Lokala källor för ${municipality} medan nya artiklar hämtas` : `Artiklar som handlar om ${municipality}`;
  const emptyStrong = empty.querySelector("strong");
  const emptyText = empty.querySelector("span");
  if (emptyStrong) emptyStrong.textContent = `Inga nya lokala artiklar från ${municipality}`;
  if (emptyText) emptyText.textContent = "Öppna nyhetssidan för att gå till kommunens lokala källor.";
  document.querySelectorAll("[data-quick-news-title]").forEach((element) => {
    element.textContent = sourceFallback ? `Lokala nyhetskällor` : `${relevant.length} lokala nyheter`;
  });
  document.querySelectorAll("[data-quick-news-detail]").forEach((element) => {
    element.textContent = relevant[0]?.title || "Öppna den lokala nyhetssidan";
  });
  renderImportantNews(relevant);
  renderNewsSources(municipality);
  if (window.lucide) lucide.createIcons();
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
  box.innerHTML=important.length?`<div class="important-news-title"><i data-lucide="triangle-alert"></i><strong>Viktiga händelser</strong></div>${important.map(a=>`<a href="${escapeAttribute(safeExternalUrl(a.url))}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(a.source)}</span><b>${escapeHtml(a.title)}</b><i data-lucide="arrow-up-right"></i></a>`).join("")}`:"";
}
function renderNewsArticle(article) {
  const access=article.access==="subscription"?'<span class="news-access subscription"><i data-lucide="lock"></i>Prenumeration</span>':'<span class="news-access free"><i data-lucide="unlock"></i>Fri</span>';
  const sourceClass=article.sourceType==="authority"?"authority":article.sourceType==="municipality"?"municipality":"media";
  const score=Math.round(calculateNewsScore(article));
  return `<a class="news-item" href="${escapeAttribute(safeExternalUrl(article.url))}" target="_blank" rel="noopener noreferrer" aria-label="Läs ${escapeAttribute(article.title)} hos ${escapeAttribute(article.source)}"><span class="news-source-mark ${sourceClass}">${getNewsSourceInitials(article.source)}</span><span class="news-item-content"><span class="news-meta"><strong>${escapeHtml(article.source)}</strong><span>•</span><time datetime="${escapeAttribute(article.publishedAt)}">${formatRelativeNewsTime(article.publishedAt)}</time></span><b class="news-title">${escapeHtml(article.title)}</b><span class="news-summary">${escapeHtml(article.summary||"")}</span><span class="news-labels">${access}<span class="news-region">${escapeHtml(article.category||article.region||"Lokal nyhet")}</span><span class="news-score" title="DinPuls-index">DP ${score}</span><span class="news-direct-link">Läs originalartikeln</span></span></span><i class="news-open-icon" data-lucide="arrow-up-right"></i></a>`;
}
function renderNewsSources(municipality) {
  const grid=document.querySelector("#news-source-grid"); if(!grid)return;
  const relevant=allNewsSources.filter(s=>s.scope==="local" && (s.municipalities||[]).includes(municipality));
  grid.innerHTML=relevant.map(source=>`<a class="news-source-card" href="${escapeAttribute(safeExternalUrl(source.url))}" target="_blank" rel="noopener noreferrer"><span class="news-source-logo">${getNewsSourceInitials(source.name)}</span><span><strong>${escapeHtml(source.name)}</strong><small>${escapeHtml(source.type)}</small></span><span class="source-access ${source.access==='subscription'?'subscription':'free'}"><i data-lucide="${source.access==='subscription'?'lock':'check'}"></i>${source.access==='subscription'?'Delvis låst':'Fri'}</span></a>`).join("");
  if(window.lucide)lucide.createIcons();
}
function updateNewsTimestamp(value) {
  const el=document.querySelector("#news-updated"); if(!el)return; const date=new Date(value);
  el.innerHTML=`<i data-lucide="refresh-cw"></i>${Number.isNaN(date.getTime())?'Källor kontrollerade':`Uppdaterad ${date.toLocaleString('sv-SE',{timeZone:STOCKHOLM_TIME_ZONE,day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`}`;
}
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
    const response = await fetch(`data/road-traffic.json`, { cache: "no-cache" });
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
  const isStale = !Number.isNaN(generatedAt.getTime()) && Date.now() - generatedAt.getTime() > 60 * 60 * 1000;
  total.textContent = String(items.length);
  if (!roadTrafficData) {
    status.textContent = "Ej tillgänglig";
    list.innerHTML = '<div class="traffic-empty"><i data-lucide="cloud-off"></i><span>Trafikdata kunde inte laddas.</span></div>';
  } else if (!roadTrafficData.active) {
    status.textContent = "Ej tillgänglig";
    list.innerHTML = '<div class="traffic-empty"><i data-lucide="cloud-off"></i><span>Trafikläget kunde inte kontrolleras. Öppna Trafikverkets vägkarta.</span></div>';
  } else if (isStale) {
    status.textContent = `Senast kontrollerad ${generatedAt.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" })}`;
    list.innerHTML = items.length
      ? items.slice(0, 3).map(renderTrafficCompactItem).join("")
      : `<div class="traffic-empty ok"><i data-lucide="circle-check"></i><span>Inga vägmeddelanden hittades i den senaste lyckade kontrollen nära ${escapeHtml(config.name)}.</span></div>`;
  } else if (!items.length) {
    status.textContent = "Inga störningar";
    list.innerHTML = `<div class="traffic-empty ok"><i data-lucide="circle-check"></i><span>Lugnt trafikläge nära ${escapeHtml(config.name)}. Inga aktuella vägmeddelanden hittades inom ${Number(roadTrafficData.radiusKm || 35)} km.</span></div>`;
  } else {
    status.textContent = Number.isNaN(generatedAt.getTime()) ? "Aktuellt" : `Kontrollerad ${generatedAt.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" })}`;
    list.innerHTML = items.slice(0, 3).map(renderTrafficCompactItem).join("");
  }
  if (window.lucide) lucide.createIcons();
}

function renderTrafficCompactItem(item) {
  return `<a href="${escapeAttribute(safeExternalUrl(item.sourceUrl || "https://www.trafikverket.se/trafikinformation/vag/"))}" target="_blank" rel="noopener noreferrer"><span class="traffic-kind ${escapeAttribute(item.severity || "info")}"><i data-lucide="${trafficIcon(item.category)}"></i></span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.road || item.location || "Nära vald kommun")} · ${escapeHtml(formatTrafficCompactTiming(item))}</small></span><i data-lucide="arrow-up-right"></i></a>`;
}

function formatTrafficCompactTiming(item) {
  const options = { timeZone: STOCKHOLM_TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
  const start = new Date(item.startTime || "");
  const end = new Date(item.endTime || "");
  if (item.status === "planned" && !Number.isNaN(start.getTime())) return `Planerad från ${start.toLocaleString("sv-SE", options)}`;
  if (!Number.isNaN(end.getTime()) && end.getTime() > Date.now()) return `Gäller till ${end.toLocaleString("sv-SE", options)}`;
  return `Händelsen ändrad ${formatRelativeNewsTime(item.updatedAt)}`;
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
    const response = await fetch(`data/important.json`, { cache: "no-cache" });
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
  const isStale = !Number.isNaN(generatedAt.getTime()) && Date.now() - generatedAt.getTime() > 60 * 60 * 1000;

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
      : `Kontrollerad ${generatedAt.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" })}`;
    list.innerHTML = renderImportantCalm(config.name, municipality?.sourceHealth || importantData.sources || [], isStale);
  } else {
    status.textContent = isStale
      ? `${items.length} · senast kontrollerad ${generatedAt.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" })}`
      : `${items.length} aktuell${items.length === 1 ? "" : "a"}`;
    list.innerHTML = items.map(item => renderImportantItem(item, config.name)).join("");
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
    `<a href="${escapeAttribute(safeExternalUrl(source.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.name)}<i data-lucide="arrow-up-right"></i></a>`
  ).join("");
  return `<article class="important-calm">
    <i class="status-icon success" data-lucide="circle-check"></i>
    <div><strong>${isStale ? "Inga nya prioriterade händelser" : `Lugnt läge i ${escapeHtml(municipality)}`}</strong><small>${isStale ? "Visar resultatet från den senaste lyckade kontrollen. Källorna kontrolleras automatiskt igen." : "Inga prioriterade varningar eller akuta händelser har hittats."}</small></div>
  </article>
  <div class="important-sources"><span>Kontrollerade källor</span>${sourceLinks}</div>`;
}

function renderImportantItem(item, municipality) {
  const severity = ["danger", "warning", "info"].includes(item.severity) ? item.severity : "info";
  const icons = { crisis: "triangle-alert", police: "shield-alert", traffic: "bus-front", road: "car-front", weather: "cloud-lightning", municipal: "wrench" };
  const icon = icons[item.category] || "info";
  const published = formatRelativeNewsTime(item.publishedAt);
  const source = item.source || "Officiell källa";
  const body = `<i class="status-icon ${severity}" data-lucide="${icon}"></i><div><strong>${escapeHtml(item.title || "Viktig information")}</strong><small>${escapeHtml(source)} · ${escapeHtml(published)}</small></div>`;
  const roadEventId = item.category === "road" && String(item.id || "").startsWith("road-")
    ? String(item.id).slice(5)
    : "";
  const detailUrl = roadEventId
    ? `trafik.html?kommun=${encodeURIComponent(municipality)}&event=${encodeURIComponent(roadEventId)}`
    : item.url;
  const opensNewTab = !roadEventId;
  return detailUrl
    ? `<article class="important-item">${body}<a href="${escapeAttribute(safeHref(detailUrl))}"${opensNewTab ? ' target="_blank" rel="noopener noreferrer"' : ""} aria-label="${roadEventId ? "Visa trafikhändelsen" : `Läs mer hos ${escapeAttribute(source)}`}"><i data-lucide="arrow-up-right"></i></a></article>`
    : `<article class="important-item">${body}</article>`;
}

/* =========================================================
   MISSING PEOPLE – REKLAMFRI SAMHÄLLSINFORMATION
========================================================= */
const MISSING_PEOPLE_SOURCE_URL = "https://www.missingpeople.se/efterlysningar/";
let missingPeopleData = null;

async function initializeMissingPeople() {
  DinPulsMunicipality.subscribe("missing-people", renderMissingPeople);
  try {
    const response = await fetch("data/missing-people.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    missingPeopleData = await response.json();
  } catch (error) {
    console.error("Missing People-modulen kunde inte laddas:", error);
    missingPeopleData = null;
  }
}

function renderMissingPeople(config = DinPulsMunicipality.getConfig()) {
  const list = document.querySelector("#missing-people-list");
  const status = document.querySelector("#missing-people-status");
  if (!list || !status || !config) return;

  const generatedAt = new Date(missingPeopleData?.generatedAt || "");
  const maxAgeMinutes = Number(missingPeopleData?.maxAgeMinutes || 90);
  const isVerified = missingPeopleData
    && !Number.isNaN(generatedAt.getTime())
    && Date.now() - generatedAt.getTime() <= maxAgeMinutes * 60 * 1000;

  if (!isVerified) {
    status.textContent = "Aktuella uppgifter kunde inte verifieras";
    list.innerHTML = `<div class="missing-people-unverified"><i data-lucide="shield-alert"></i><span><strong>Öppna Missing Peoples officiella lista</strong><small>DinPuls visar inga personuppgifter när den senaste kontrollen är för gammal.</small></span><a href="${MISSING_PEOPLE_SOURCE_URL}" target="_blank" rel="noopener noreferrer">Kontrollera hos Missing People <i data-lucide="arrow-up-right"></i></a></div>`;
  } else {
    const items = Array.isArray(missingPeopleData?.municipalities?.[config.name]?.items)
      ? missingPeopleData.municipalities[config.name].items.slice(0, 4)
      : [];
    status.textContent = `Kontrollerad ${generatedAt.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" })}`;
    list.innerHTML = items.length
      ? items.map(renderMissingPerson).join("")
      : `<div class="missing-people-empty"><i data-lucide="circle-check"></i><span><strong>Inga publicerade efterlysningar i området</strong><small>Den officiella listan är kontrollerad för ${escapeHtml(config.name)} och angränsande DinPuls-kommuner.</small></span></div>`;
  }
  if (window.lucide) lucide.createIcons();
}

function renderMissingPerson(item) {
  const local = item.scope === "local";
  const scopeLabel = local ? "I din kommun" : `Grannkommun · ${item.originMunicipality || "närområdet"}`;
  const published = new Date(item.publishedAt || "");
  const dateLabel = Number.isNaN(published.getTime())
    ? "Publicerad hos Missing People"
    : `Publicerad ${published.toLocaleDateString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, day: "numeric", month: "short", year: "numeric" })}`;
  return `<article class="missing-person-card${local ? " local" : " neighbor"}">
    <span class="missing-person-icon" aria-hidden="true"><i data-lucide="search"></i></span>
    <div class="missing-person-content">
      <span class="missing-person-scope">${escapeHtml(scopeLabel)}</span>
      <h3>${escapeHtml(item.name || "Försvunnen person")}</h3>
      <div class="missing-person-meta"><span><i data-lucide="map-pin"></i>${escapeHtml(item.location || item.originMunicipality || "Plats anges hos Missing People")}</span><span><i data-lucide="calendar-days"></i>${escapeHtml(dateLabel)}</span></div>
      <p>${escapeHtml(item.summary || "Missing People har publicerat en efterlysning med koppling till området.")}</p>
      <a href="${escapeAttribute(safeExternalUrl(item.url || MISSING_PEOPLE_SOURCE_URL))}" target="_blank" rel="noopener noreferrer">Öppna officiell efterlysning <i data-lucide="arrow-up-right"></i></a>
    </div>
  </article>`;
}

/* =========================================================
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
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadTransport();
  });
  window.addEventListener("online", loadTransport);
}

async function loadTransport() {
  const loading = document.querySelector("#transport-loading");
  if (loading) loading.hidden = false;
  try {
    const response = await fetch(`data/transport.json`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    transportData = await response.json();
    populateTransportStops();
    renderTransport();
  } catch (error) {
    console.error("Kollektivtrafiken kunde inte laddas:", error);
    if (loading) loading.hidden = true;
    if (transportData) {
      renderTransport();
      const updated = document.querySelector("#transport-updated");
      if (updated) {
        updated.classList.add("stale");
        updated.innerHTML = '<i data-lucide="wifi-off"></i>Visar senast fungerande tider';
      }
      if (window.lucide) lucide.createIcons();
      return;
    }
    const empty = document.querySelector("#transport-empty");
    if (empty) {
      empty.hidden = false;
      empty.querySelector("strong").textContent = "Tiderna kunde inte laddas";
      empty.querySelector("span").textContent = "Ett nytt försök görs automatiskt när anslutningen är tillbaka.";
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
    const stale = !isDemo && !Number.isNaN(timestamp.getTime()) && Date.now() - timestamp.getTime() > 50 * 60 * 1000;
    updated.classList.toggle("stale", stale);
    updated.innerHTML = `<i data-lucide="${stale ? "clock-3" : "refresh-cw"}"></i>${isDemo ? "Demonstrationsdata" : Number.isNaN(timestamp.getTime()) ? "Tider kontrollerade" : stale ? `Senast fungerande kontroll ${timestamp.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" })}` : `Uppdaterad ${timestamp.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" })}`}`;
  }

  updateTransportSource(isDemo, stop, departures);
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
        ? '<span class="departure-status planned">Senast verifierad</span>'
      : item.isRealtime
        ? '<span class="departure-status realtime">Realtid</span>'
        : '<span class="departure-status planned">Tidtabell</span>';
  const time = Number.isNaN(actual.getTime()) ? "--:--" : actual.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const scheduledTime = Number.isNaN(scheduled.getTime()) ? "" : scheduled.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  return `<article class="departure-row${item.canceled ? " is-canceled" : ""}">
    <span class="departure-mode ${item.mode}"><i data-lucide="${modeIcon}"></i></span>
    <span class="departure-line">${escapeHtml(item.line || item.operator || "–")}</span>
    <span class="departure-destination"><strong>${escapeHtml(item.direction || "Destination saknas")}</strong><small>${escapeHtml(item.operator || "")}${item.platform ? ` · Läge ${escapeHtml(item.platform)}` : ""}</small></span>
    <span class="departure-time"><strong>${time}</strong>${delayMinutes > 0 && scheduledTime ? `<small>${scheduledTime}</small>` : ""}</span>
    ${status}
  </article>`;
}

function updateTransportSource(isDemo, stop, departures) {
  const note = document.querySelector("#transport-source-note");
  const link = document.querySelector("#transport-source-link");
  const retained = Boolean(stop?.retained) || departures.some((item) => item.stale);
  if (note) {
    note.textContent = isDemo
      ? "Exempeltider – inte liveinformation"
      : retained
        ? "Trafiklab – visar senast verifierade framtida avgångar medan nya tider hämtas"
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
    const retained = departures.some((item) => item.stale);
    label.textContent = isDemo ? "Demonstrationsdata" : retained ? "Senast verifierade avgångar" : "Aktuella avgångar";
  }

  if (departures.length === 0) {
    list.innerHTML = '<li><span><strong>Inga aktuella avgångar</strong><small>Tiderna uppdateras automatiskt</small></span></li>';
    return;
  }

  list.innerHTML = departures.slice(0, 4).map((item) => {
    const time = new Date(item.realtime || item.scheduled);
    const displayTime = Number.isNaN(time.getTime())
      ? "--:--"
      : time.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
    return `<li><i data-lucide="${item.mode === "train" ? "train-front" : "bus-front"}"></i><time>${displayTime}</time><span><strong>${escapeHtml(item.direction || "Destination saknas")}</strong><small>${escapeHtml(item.line || item.operator || "")}${isDemo ? " · demo" : item.stale ? " · senast verifierad" : ""}</small></span></li>`;
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
    const sameDate = stockholmDateKey(departureTime) === stockholmDateKey(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = stockholmDateKey(departureTime) === stockholmDateKey(tomorrow);
    const clock = departureTime.toLocaleTimeString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
    element.textContent = minutes <= 0
      ? "Nästa avgång nu"
      : minutes < 120 && sameDate
        ? `Nästa avgång om ${minutes} min`
        : isTomorrow
          ? `Nästa avgång i morgon ${clock}`
          : sameDate
            ? `Nästa avgång ${clock}`
            : `Nästa avgång ${departureTime.toLocaleDateString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, weekday: "short", day: "numeric", month: "short" })} ${clock}`;
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
let eventsRefreshTimer = null;

async function initializeEvents() {
  const card = document.querySelector("#evenemang");
  const openPage = () => location.href = `evenemang.html?kommun=${encodeURIComponent(DinPulsMunicipality.getName())}`;
  card?.addEventListener("click", event => { if (!event.target.closest("a,button,input,select,label")) openPage(); });
  card?.addEventListener("keydown", event => { if ((event.key === "Enter" || event.key === " ") && !event.target.closest("a,button,input,select")) { event.preventDefault(); openPage(); } });
  DinPulsMunicipality.subscribe("events", renderEvents);
  await loadEvents();
  clearInterval(eventsRefreshTimer);
  eventsRefreshTimer = setInterval(() => { if (!document.hidden) loadEvents(); }, 6 * 60 * 60 * 1000);
}

async function loadEvents() {
  try {
    const response = await fetch(`data/events.json`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    if (!data?.municipalities || typeof data.municipalities !== "object") throw new Error("Ogiltig evenemangsdata");
    eventsData = data;
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
  const today = stockholmDateKey();
  const events = (data.events || []).filter(item => String(item.endDate || item.startDate).slice(0,10) >= today).sort((a,b) => String(a.startDate).localeCompare(String(b.startDate)));
  const visible = events.slice(0, 4);
  const list = document.querySelector("#events-list");
  const loading = document.querySelector("#events-loading");
  const empty = document.querySelector("#events-empty");
  if (loading) loading.hidden = true;
  if (list) { list.innerHTML = visible.map(renderEventPreview).join(""); list.hidden = !visible.length; }
  if (empty) empty.hidden = !!visible.length;
  const total = document.querySelector("#events-total");
  if (total) total.textContent = events.length ? `${events.length} kommande · ${data.sources?.length || 0} källor` : `Inga datum just nu · ${data.sources?.length || 0} källor`;
  const link = document.querySelector("#events-page-link"); if (link) link.href = `evenemang.html?kommun=${encodeURIComponent(municipality)}`;
  document.querySelectorAll("[data-quick-events-title]").forEach(el => el.textContent = events.length ? `${events.length} evenemang i ${municipality}` : `Evenemang i ${municipality}`);
  document.querySelectorAll("[data-quick-events-detail]").forEach(el => el.textContent = events[0] ? `${formatEventShortDate(events[0])} · ${events[0].title}` : `${data.sources?.length || 0} lokala kalendrar samlade`);
  if (window.lucide) lucide.createIcons();
}

function renderEventPreview(item) {
  const start = String(item.startDate || "").slice(0,10);
  const end = String(item.endDate || item.startDate || "").slice(0,10);
  const ongoing = start < stockholmDateKey() && end >= stockholmDateKey();
  const date = new Date(item.startDate);
  const month = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, month: "short" }).replace(".", "");
  const day = Number.isNaN(date.getTime()) ? "–" : new Intl.DateTimeFormat("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, day: "numeric" }).format(date);
  const dateBox = ongoing
    ? `<time><b>Nu</b>${escapeHtml(`till ${formatEventDate(item.endDate || item.startDate)}`)}</time>`
    : `<time><b>${day}</b>${escapeHtml(month)}</time>`;
  return `<li>${dateBox}<span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml([item.time, item.venue, item.sourceName].filter(Boolean).join(" · "))}</small></span></li>`;
}

function formatEventShortDate(item) {
  const start = String(item?.startDate || "").slice(0,10);
  const end = String(item?.endDate || item?.startDate || "").slice(0,10);
  return start < stockholmDateKey() && end >= stockholmDateKey()
    ? `Pågår till ${formatEventDate(item.endDate || item.startDate)}`
    : formatEventDate(item?.startDate);
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
    const response = await fetch(`data/jobs.json`, { cache: "no-cache" });
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
    updated.innerHTML = `<i data-lucide="refresh-cw"></i>${Number.isNaN(timestamp.getTime()) ? "Annonser kontrollerade" : `Uppdaterad ${timestamp.toLocaleString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}`;
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
    const response = await fetch(`data/housing.json`, { cache: "no-cache" });
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
    const timestamp = new Date(municipalityData.checkedAt || municipalityData.updatedAt || housingData.generatedAt);
    const label = Number.isNaN(timestamp.getTime())
      ? "Källor kontrollerade"
      : `${municipalityData.stale ? "Senaste data · kontrollfel" : "Kontrollerad"} ${timestamp.toLocaleString("sv-SE", { timeZone: STOCKHOLM_TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
    updated.innerHTML = `<i data-lucide="refresh-cw"></i>${label}`;
  }

  providersBox.innerHTML = providers.map((provider) => `<a class="housing-provider" href="${escapeAttribute(safeExternalUrl(provider.url))}" target="_blank" rel="noopener noreferrer"><span><i data-lucide="building-2"></i><strong>${escapeHtml(provider.name)}</strong></span><small>Officiell bostadskö <i data-lucide="arrow-up-right"></i></small></a>`).join("");

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
   DINPULS v0.21.11 – BIO PÅ STARTSIDAN
========================================================= */
let cinemaHomeData = null;

async function initializeCinemaHome() {
  DinPulsMunicipality.subscribe("cinema-home", renderCinemaHome);
  try {
    const response = await fetch("data/cinemas.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    cinemaHomeData = await response.json();
    renderCinemaHome();
  } catch (error) {
    console.error("Biomodulen kunde inte laddas:", error);
    const grid = document.querySelector("#cinema-home-grid");
    if (grid) grid.innerHTML = `<span class="cinema-home-empty">Bioinformationen är tillfälligt otillgänglig.</span>`;
  }
}

function renderCinemaHome() {
  if (!cinemaHomeData) return;
  const municipality = DinPulsMunicipality.getName();
  const cinemas = cinemaHomeData.municipalities?.[municipality] || [];
  const localFilms = cinemas.flatMap(cinema => (cinema.films || []).map(film => ({
    ...film,
    cinema: cinema.name,
    url: cinema.programUrl,
    verifiedLocal: true
  })));
  const fallbackUrl = cinemas[0]?.programUrl || `bio.html?kommun=${encodeURIComponent(municipality)}`;
  const films = (localFilms.length ? localFilms : (cinemaHomeData.featuredFilms || []).map(film => ({
    ...film,
    cinema: cinemas[0]?.name || `Bio i ${municipality}`,
    url: fallbackUrl,
    verifiedLocal: false
  }))).slice(0, 4);

  const subtitle = document.querySelector("#cinema-home-subtitle");
  if (subtitle) {
    subtitle.textContent = localFilms.length
      ? `${localFilms.length} publicerade filmer hos ${cinemas.map(cinema => cinema.name).join(" och ")}.`
      : cinemas.length
        ? `Aktuella biotitlar – kontrollera vilka som visas hos ${cinemas.map(cinema => cinema.name).join(" och ")}.`
        : "Aktuella biotitlar – kontrollera lokal visning och bokning.";
  }

  const grid = document.querySelector("#cinema-home-grid");
  if (grid) {
    grid.innerHTML = films.length ? films.map((film, index) => `<a class="cinema-home-film" href="${escapeAttribute(safeExternalUrl(film.url))}" target="_blank" rel="noopener noreferrer">
      <span class="cinema-home-number">${String(index + 1).padStart(2, "0")}</span>
      <span><small>${escapeHtml(film.verifiedLocal ? film.cinema : "Filmer på bio just nu")}</small><strong>${escapeHtml(film.title)}</strong><em>${escapeHtml(film.label || "Se program och visningstider")}</em></span>
      <i data-lucide="ticket"></i>
    </a>`).join("") : `<span class="cinema-home-empty">Inga aktuella filmtitlar är publicerade. Öppna biografens program för senaste uppgifterna.</span>`;
  }

  const link = document.querySelector("#cinema-home-link");
  if (link) link.href = `bio.html?kommun=${encodeURIComponent(municipality)}`;
  if (window.lucide) lucide.createIcons();
}

/* =========================================================
   DINPULS v0.11.0 – TANKNING OCH BILLADDNING
========================================================= */
let fuelData = null;

async function initializeFuel() {
  DinPulsMunicipality.subscribe("fuel", renderFuel);
  try {
    const response = await fetch(`data/fuel.json`, { cache: "no-cache" });
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

/* Dagens lunch i den rullande remsan. */
let lunchTickerData = null;

async function initializeLunch() {
  DinPulsMunicipality.subscribe("lunch", () => {
    renderLunchTicker(DinPulsMunicipality.getName());
  });

  await refreshLunchTicker();
  window.setInterval(refreshLunchTicker, 2 * 60 * 60 * 1000);
}

async function refreshLunchTicker() {
  try {
    const response = await fetch(`data/lunch.json`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Lunchdata kunde inte laddas: ${response.status}`);
    lunchTickerData = await response.json();
  } catch (error) {
    console.error(error);
  }
  renderLunchTicker(DinPulsMunicipality.getName());
}

function renderLunchTicker(municipality) {
  const restaurants = lunchTickerData?.municipalities?.[municipality]?.restaurants || [];
  const weekday = getStockholmWeekday();
  const isWeekend = weekday === "saturday" || weekday === "sunday";
  const tickerRestaurants = restaurants
    .map((restaurant) => ({
      ...restaurant,
      todayDishes: restaurant.status === "current"
        ? (restaurant.days?.[weekday] || [])
        : []
    }))
    .filter((restaurant) => restaurant.url)
    .sort((first, second) => {
      const firstPriority = first.todayDishes.length ? 0 : first.seasonal ? 2 : 1;
      const secondPriority = second.todayDishes.length ? 0 : second.seasonal ? 2 : 1;
      return firstPriority - secondPriority || first.name.localeCompare(second.name, "sv");
    });
  const fallback = [{
    id: "lunch",
    name: weekday === "saturday" || weekday === "sunday"
      ? `Helgens restaurangutbud i ${municipality}`
      : `Dagens lunch i ${municipality}`,
    todayDishes: [weekday === "saturday" || weekday === "sunday"
      ? "Se öppna restauranger och kontrollera helgens meny"
      : "Ingen verifierad dagsmeny är publicerad ännu – se restaurangernas originalmenyer"]
  }];
  const dayNames = {
    monday: "MÅNDAG", tuesday: "TISDAG", wednesday: "ONSDAG",
    thursday: "TORSDAG", friday: "FREDAG", saturday: "LÖRDAG", sunday: "SÖNDAG"
  };

  const markup = (tickerRestaurants.length ? tickerRestaurants : fallback).map((restaurant) => {
    const detail = restaurant.todayDishes.length
      ? restaurant.todayDishes.slice(0, 3).join(" · ")
      : restaurant.seasonal
        ? "Säsongsöppet – kontrollera aktuell meny och öppettid"
        : isWeekend
          ? "Se restaurangens helgmeny och aktuella öppettider"
          : "Veckomenyn finns hos restaurangen – öppna och kontrollera dagens rätter";
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
    const track = container.closest(".lunch-airport-track");
    if (track) {
      const itemCount = Math.max(1, tickerRestaurants.length || fallback.length);
      track.style.setProperty("--lunch-roll-desktop", `${Math.max(24, itemCount * 11)}s`);
      track.style.setProperty("--lunch-roll-mobile", `${Math.max(10, itemCount * 6)}s`);
    }
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
        return `<a class="ad-face" data-ad-face href="mailto:annons@dinpuls.se?subject=Annonsplats%20${slot}" ${faceIndex ? "hidden" : ""}>
          <span class="ad-slot">PREMIUM ${slot}</span>
          <strong>Din verksamhet kan synas här</strong>
          <small>Lokalt i <span data-municipality-name>${escapeHtml(DinPulsMunicipality.getName())}</span> · 500 kr/månad + moms</small>
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
    faces.forEach(face => { face.dataset.fallbackHtml = face.innerHTML; face.dataset.fallbackHref = face.getAttribute("href") || ""; });
    const refreshScheduledFaces = async () => {
      if (!window.DinPulsAds) return;
      await Promise.all(faces.map(async (face, faceIndex) => {
        const banner = await window.DinPulsAds.getCurrentBanner(`P${moduleIndex + 1}-${String(startNumber + faceIndex).padStart(2, "0")}`, DinPulsMunicipality.getName());
        if (!banner) {
          if (face.dataset.scheduledBanner) { face.innerHTML = face.dataset.fallbackHtml; face.href = face.dataset.fallbackHref; face.removeAttribute("target"); face.removeAttribute("rel"); face.classList.remove("scheduled-homepage-ad"); delete face.dataset.scheduledBanner; }
          return;
        }
        face.classList.add("scheduled-homepage-ad");
        face.href = banner.targetUrl || "mailto:annons@dinpuls.se";
        if (banner.targetUrl) { face.target = "_blank"; face.rel = "noopener noreferrer sponsored"; }
        face.innerHTML = `<img src="${escapeAttribute(banner.imageUrl)}" alt="Företagsannons" loading="lazy">`;
        face.dataset.scheduledBanner = banner.id;
      }));
    };
    refreshScheduledFaces();
    document.addEventListener("dinpuls:municipalitychange", refreshScheduledFaces);
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
    const pause = () => window.clearInterval(timer);
    module.querySelector("[data-ad-previous]")?.addEventListener("click", () => {
      show(current - 1);
      restart();
    });
    module.querySelector("[data-ad-next]")?.addEventListener("click", () => {
      show(current + 1);
      restart();
    });
    module.addEventListener("mouseenter", pause);
    module.addEventListener("mouseleave", restart);
    module.addEventListener("focusin", pause);
    module.addEventListener("focusout", (event) => {
      if (!module.contains(event.relatedTarget)) restart();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pause();
      else restart();
    });
  });
}

/* =========================================================
   DINPULS v0.18.0 – LOKAL SPORT
========================================================= */
let sportsData = null;

async function initializeSports() {
  const response = await fetch("data/sports.json", { cache: "no-cache" });
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
  if (summary) summary.innerHTML = `<strong>${clubs.length} idrottsföreningar · ${sports.length} aktiviteter</strong><span>Lag, motion, matcher och direkta föreningslänkar</span>`;
  document.querySelectorAll("[data-quick-sport-title]").forEach((element) => {
    element.textContent = `Idrott & motion i ${config.name}`;
  });
  document.querySelectorAll("[data-quick-sport-detail]").forEach((element) => {
    element.textContent = `${clubs.length} föreningar · ${sports.length} idrotter`;
  });
  const withMatches = sports.filter((sport) => matches.some((match) => match.sport === sport));
  const withoutMatches = sports.filter((sport) => !withMatches.includes(sport));
  const dayOffset = withoutMatches.length ? Math.floor(Date.now() / 86400000) % withoutMatches.length : 0;
  const rotating = [...withoutMatches.slice(dayOffset), ...withoutMatches.slice(0, dayOffset)];
  const selected = [...withMatches.slice(0, 2), ...rotating].filter((sport, index, list) => list.indexOf(sport) === index).slice(0, 4);
  const iconMap = { Fotboll: ["circle-dot", "green"], Innebandy: ["target", "purple"], Ishockey: ["disc-3", "blue"], Bowling: ["circle", "violet"], Golf: ["flag-triangle-right", "green"], Ridsport: ["trophy", "rose"], Motorsport: ["flag", "red"], Orientering: ["compass", "green"] };
  const featured = selected.slice(0, 3).map((sport) => ({
    sport,
    clubs: clubs.filter((club) => (club.sports || []).includes(sport)),
    matches: matches.filter((match) => match.sport === sport)
  }));
  if (list) list.innerHTML = featured.map((item) => {
    const visual = iconMap[item.sport] || ["users", "blue"];
    const target = encodeURIComponent(item.sport);
    return `<a data-accent="${visual[1]}" href="sport.html?kommun=${encodeURIComponent(config.name)}&kategori=${target}">
    <span class="sport-home-icon"><i data-lucide="${visual[0]}"></i></span>
    <span><strong>${escapeHtml(item.sport)}</strong><small>${item.matches.length ? `${item.matches.length} matcher/resultat` : `${item.clubs.length} lokala föreningar · officiella länkar`}</small></span>
    <i data-lucide="chevron-right"></i>
  </a>`;
  }).join("");
  if (link) link.href = `sport.html?kommun=${encodeURIComponent(config.name)}`;
  if (window.lucide) lucide.createIcons();
}

async function initializeLeisure() {
  const response = await fetch("data/leisure.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`Fritidsdata kunde inte laddas: ${response.status}`);
  const data = await response.json();
  const render = (config) => {
    const municipality = data.municipalities?.[config.name] || { activities: [] };
    const activities = Array.isArray(municipality.activities) ? municipality.activities : [];
    const categories = new Set(activities.map((item) => item.category));
    const summary = document.querySelector("#leisure-home-summary");
    const link = document.querySelector("#leisure-home-link");
    if (summary) summary.textContent = activities.length
      ? `${activities.length} verifierade verksamheter inom ${categories.size} områden`
      : "Sök i kommunens föreningsliv och lokala aktiviteter";
    document.querySelectorAll("#leisure-home-grid a").forEach((element) => {
      const url = new URL(element.getAttribute("href"), window.location.href);
      url.searchParams.set("kommun", config.name);
      element.href = `${url.pathname.split("/").pop()}?${url.searchParams.toString()}`;
    });
    if (link) link.href = `fritid.html?kommun=${encodeURIComponent(config.name)}`;
  };
  DinPulsMunicipality.subscribe("leisure", render);
  render(DinPulsMunicipality.getConfig());
}
