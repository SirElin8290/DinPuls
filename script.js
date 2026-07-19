/* =========================================================
   DINPULS.SE – SPRINT 2
   Komponenter, interaktivitet och SMHI-väder
========================================================= */

const componentNames = [
  "header",
  "quick-strip",
  "navigation",
  "hero",
  "primary-cards",
  "secondary-cards",
  "jobs-housing",
  "services",
  "ads",
  "footer"
];

const MUNICIPALITIES = {
  "Åmål": { latitude: 59.052, longitude: 12.704 },
  "Säffle": { latitude: 59.132, longitude: 12.929 },
  "Bengtsfors": { latitude: 59.029, longitude: 12.232 },
  "Mellerud": { latitude: 58.699, longitude: 12.453 },
  "Årjäng": { latitude: 59.392, longitude: 12.133 },
  "Grums": { latitude: 59.351, longitude: 13.111 },
  "Arvika": { latitude: 59.655, longitude: 12.585 }
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

    if (window.lucide) {
      lucide.createIcons();
    }

    initializeTabs();
    initializeSearch();
    initializeClock();
    initializeBusCountdown();
    initializeTheme();
    initializeMobileMenu();
    initializeMunicipality();
    initializeWeather();
  } catch (error) {
    console.error(error);
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

function initializeBusCountdown() {
  const element = document.querySelector("#next-bus-countdown");

  if (!element) {
    return;
  }

  let minutes = 3;

  window.setInterval(() => {
    minutes = minutes > 0 ? minutes - 1 : 3;
    element.textContent = minutes === 0 ? "nu" : `${minutes} min`;
  }, 20000);
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
  const headerLabel = document.querySelector("#selected-municipality");
  const save = document.querySelector("#save-municipality");
  const savedMunicipality =
    localStorage.getItem("dinpuls-municipality") || "Åmål";

  applyMunicipality(savedMunicipality);

  if (select) {
    select.value = savedMunicipality;
  }

  const openDialog = () => {
    if (select) {
      select.value =
        localStorage.getItem("dinpuls-municipality") || "Åmål";
    }

    dialog?.showModal();
  };

  headerButton?.addEventListener("click", openDialog);
  inlineButton?.addEventListener("click", openDialog);

  save?.addEventListener("click", (event) => {
    event.preventDefault();

    const municipality = select.value;
    localStorage.setItem("dinpuls-municipality", municipality);

    applyMunicipality(municipality);

    if (headerLabel) {
      headerLabel.textContent = municipality;
    }

    dialog.close();
    loadWeather(municipality);
  });
}

function applyMunicipality(municipality) {
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
}

function initializeWeather() {
  const retryButton = document.querySelector("#weather-retry");
  const municipality =
    localStorage.getItem("dinpuls-municipality") || "Åmål";

  retryButton?.addEventListener("click", () => {
    loadWeather(
      localStorage.getItem("dinpuls-municipality") || "Åmål"
    );
  });

  loadWeather(municipality);

  /* Uppdatera prognosen var trettionde minut. */
  window.setInterval(() => {
    loadWeather(
      localStorage.getItem("dinpuls-municipality") || "Åmål"
    );
  }, 30 * 60 * 1000);
}

async function loadWeather(municipality) {
  const location = MUNICIPALITIES[municipality] || MUNICIPALITIES["Åmål"];
  const url =
    "https://opendata-download-metfcst.smhi.se/api/" +
    "category/snow1g/version/1/geotype/point/" +
    `lon/${location.longitude}/lat/${location.latitude}/data.json` +
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
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`SMHI svarade med status ${response.status}`);
    }

    const weatherData = await response.json();
    renderWeather(weatherData, municipality);
  } catch (error) {
    console.error("SMHI-väder kunde inte hämtas:", error);
    showWeatherError(municipality);
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
