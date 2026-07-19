/* =========================================================
   DINPULS.SE v0.7.2
   Central kommunmotor, komponenter och datamoduler
========================================================= */

const DINPULS_VERSION = "0.7.2";
const DEFAULT_MUNICIPALITY = "Åmål";

const componentNames = [
  "header",
  "quick-strip",
  "navigation",
  "hero",
  "primary-cards",
  "transport",
  "secondary-cards",
  "jobs-housing",
  "services",
  "ads",
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

    const savedName = localStorage.getItem("dinpuls-municipality");
    this.currentName = this.isValid(savedName) ? savedName : this.defaultName;

    if (savedName && !this.isValid(savedName)) {
      localStorage.removeItem("dinpuls-municipality");
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
        localStorage.setItem("dinpuls-municipality", validName);
      }
      return;
    }

    this.currentName = validName;

    if (persist) {
      localStorage.setItem("dinpuls-municipality", validName);
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

async function loadComponent(name) {
  const target = document.querySelector(`[data-component="${name}"]`);

  if (!target) {
    return;
  }

  const response = await fetch(`components/${name}.html`);

  if (!response.ok) {
    throw new Error(`Kunde inte ladda komponenten ${name}`);
  }

  target.innerHTML = await response.text();
}

async function startDinPuls() {
  try {
    await Promise.all(componentNames.map(loadComponent));
    await DinPulsMunicipality.initialize();

    if (window.lucide) {
      lucide.createIcons();
    }

    initializeTabs();
    initializeSearch();
    initializeClock();
    initializeTheme();
    initializeMobileMenu();
    initializeMunicipality();
    initializeWeather();
    await Promise.all([initializeNews(), initializeTransport()]);
    await DinPulsMunicipality.setMunicipality(
      DinPulsMunicipality.getName(),
      { persist: false, force: true }
    );
  } catch (error) {
    console.error("DinPuls kunde inte starta:", error);
  }
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
    const value = form.querySelector("input").value.trim();

    if (value) {
      alert(
        `Sökning efter: ${value}\n\nSökfunktionen kopplas till riktiga data i en senare sprint.`
      );
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
}

function renderMunicipalityPlaceholders(config) {
  document.querySelectorAll("[data-quick-placeholder]").forEach((element) => {
    const kind = element.dataset.quickPlaceholder;
    const labels = {
      jobs: [`Jobb i ${config.name}`, "Datakälla ansluts"],
      housing: [`Bostäder i ${config.name}`, "Datakälla ansluts"],
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

  /* Uppdatera prognosen var trettionde minut. */
  window.setInterval(() => {
    loadWeather(DinPulsMunicipality.getConfig());
  }, 30 * 60 * 1000);
}

let weatherRequestController = null;
let weatherRequestNumber = 0;

async function loadWeather(config) {
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

    renderWeather(weatherData, municipality);
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }
    console.error("SMHI-väder kunde inte hämtas:", error);
    if (municipality === DinPulsMunicipality.getName()) {
      showWeatherError(municipality);
    }
  }
}

function showWeatherLoading(municipality) {
  const loading = document.querySelector("#weather-loading");
  const content = document.querySelector("#weather-content");
  const error = document.querySelector("#weather-error");
  const status = document.querySelector("#weather-status");
  const location = document.querySelector("#weather-location");

  if (location) {
    location.textContent = municipality;
  }

  loading.hidden = false;
  content.hidden = true;
  error.hidden = true;

  status.textContent = "Hämtar…";
  status.className = "weather-live-badge";
}

function showWeatherError(municipality) {
  const loading = document.querySelector("#weather-loading");
  const content = document.querySelector("#weather-content");
  const error = document.querySelector("#weather-error");
  const status = document.querySelector("#weather-status");
  const location = document.querySelector("#weather-location");

  if (location) {
    location.textContent = municipality;
  }

  loading.hidden = true;
  content.hidden = true;
  error.hidden = false;

  status.textContent = "Ej tillgängligt";
  status.className = "weather-live-badge is-fallback";

  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderWeather(response, municipality) {
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
  const current =
    entries.find((entry) => new Date(entry.time).getTime() >= now) ||
    entries[0];

  const localToday = new Date().toLocaleDateString("sv-SE");
  const todayEntries = entries.filter(
    (entry) =>
      new Date(entry.time).toLocaleDateString("sv-SE") === localToday
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

  const loading = document.querySelector("#weather-loading");
  const content = document.querySelector("#weather-content");
  const error = document.querySelector("#weather-error");
  const status = document.querySelector("#weather-status");

  loading.hidden = true;
  content.hidden = false;
  error.hidden = true;

  status.textContent = "Live från SMHI";
  status.className = "weather-live-badge is-live";

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


/* =========================================================
   DINPULS v0.7.2 – NYHETSCENTRAL
========================================================= */
let allNewsArticles = [];
let allNewsSources = [];
let activeNewsFilter = "all";
let activeNewsScope = localStorage.getItem("dinpuls-news-scope") || "local";

async function initializeNews() {
  if (!["local", "sweden", "world"].includes(activeNewsScope)) {
    activeNewsScope = "local";
    localStorage.removeItem("dinpuls-news-scope");
  }

  document.querySelectorAll(".news-scope-tab").forEach((button) => {
    button.addEventListener("click", () => {
      activeNewsScope = button.dataset.newsScope || "local";
      localStorage.setItem("dinpuls-news-scope", activeNewsScope);
      updateNewsTabs();
      renderNewsForMunicipality(DinPulsMunicipality.getName());
    });
  });
  document.querySelectorAll(".news-filter").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".news-filter").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      activeNewsFilter = button.dataset.newsFilter || "all";
      renderNewsForMunicipality(DinPulsMunicipality.getName());
    });
  });
  updateNewsTabs();
  DinPulsMunicipality.subscribe("news", (config) => {
    renderNewsForMunicipality(config.name);
  });
  await loadNews();
}

function updateNewsTabs() {
  document.querySelectorAll(".news-scope-tab").forEach((button) => {
    const active = button.dataset.newsScope === activeNewsScope;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  const heading = document.querySelector("#news-heading");
  const subheading = document.querySelector("#news-subheading");
  const municipality = DinPulsMunicipality.getName();
  const labels = {
    local: ["Nyheter nära dig", `Lokalt för ${municipality}`],
    sweden: ["Sverige", "Viktiga nationella nyheter"],
    world: ["Världen", "Internationella händelser med störst betydelse"]
  };
  if (heading) heading.textContent = labels[activeNewsScope][0];
  if (subheading) subheading.textContent = labels[activeNewsScope][1];
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
  updateNewsTabs();
  const loading = document.querySelector("#news-loading");
  const feed = document.querySelector("#news-feed");
  const empty = document.querySelector("#news-empty");
  const count = document.querySelector("#news-count");
  if (!feed || !empty) return;
  const relevant = allNewsArticles
    .filter((article) => article.scope === activeNewsScope)
    .filter((article) => activeNewsScope !== "local" || (article.municipalities || []).includes(municipality) || (article.municipalities || []).includes("Alla"))
    .filter(matchesNewsFilter)
    .sort(compareNewsQuality)
    .slice(0, 12);
  feed.innerHTML = relevant.map(renderNewsArticle).join("");
  loading.hidden = true;
  feed.hidden = relevant.length === 0;
  empty.hidden = relevant.length > 0;
  if (count) count.textContent = `${relevant.length} ${relevant.length === 1 ? "aktuell nyhet" : "aktuella nyheter"}`;
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
  const important=articles.filter(a=>a.important || Number(a.impact)>=95).slice(0,2);
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
  const relevant=allNewsSources.filter(s=>s.scope===activeNewsScope && (activeNewsScope!=="local" || (s.municipalities||[]).includes(municipality)));
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
   DINPULS v0.7.2 – BUSS- OCH TÅGTIDER
========================================================= */
let transportData = null;
let activeTransportMode = "all";

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
  select.innerHTML = stops.map((stop, index) => `<option value="${escapeAttribute(stop.id)}"${index === 0 ? " selected" : ""}>${escapeHtml(stop.name)}</option>`).join("");
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

  const alerts = stop?.alerts || [];
  alertBox.hidden = alerts.length === 0;
  alertBox.innerHTML = alerts.length ? `<i data-lucide="triangle-alert"></i><div><strong>Trafikinformation</strong>${alerts.map((message) => `<span>${escapeHtml(message)}</span>`).join("")}</div>` : "";

  const updated = document.querySelector("#transport-updated");
  if (updated) {
    const timestamp = new Date(transportData.generatedAt);
    updated.innerHTML = `<i data-lucide="refresh-cw"></i>${isDemo ? "Demonstrationsdata" : Number.isNaN(timestamp.getTime()) ? "Tider kontrollerade" : `Uppdaterad ${timestamp.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`}`;
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
    list.innerHTML = "<li><span><strong>Inga aktuella avgångar</strong><small>Kontrollera vald hållplats</small></span></li>";
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
    element.textContent = minutes <= 0 ? "Nästa avgång nu" : `Nästa avgång om ${minutes} min`;
  });

  document.querySelectorAll("[data-quick-transport-detail]").forEach((element) => {
    element.textContent = departure
      ? `${departure.mode === "train" ? "Tåg" : "Buss"} ${departure.line || ""} mot ${departure.direction} · ${departure.stopName}`
      : "Kontrollera tidtabellen";
  });
}

window.setInterval(updateQuickTransport, 60000);
