(function () {
  "use strict";

  const SETTINGS_KEY = "dinpuls-push-settings-v1";
  const REQUIRED_CATEGORIES = ["extreme-weather", "missing-people", "important"];
  const CONFIG_URL = "data/push-config.json";
  let config = null;

  function readSettings() {
    try {
      const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return {
        categories: Array.isArray(value.categories) ? value.categories : ["traffic", "transport"]
      };
    } catch {
      return { categories: ["traffic", "transport"] };
    }
  }

  function municipality() {
    return window.DinPulsMunicipality?.getName?.() || "Åmål";
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  }

  function supported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  function applicationServerKey(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const bytes = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bytes, character => character.charCodeAt(0));
  }

  async function loadConfig() {
    if (config) return config;
    try {
      const response = await fetch(CONFIG_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("Konfigurationen kunde inte hämtas");
      config = await response.json();
    } catch {
      config = { enabled: false, apiBase: "", publicKey: "" };
    }
    return config;
  }

  async function currentSubscription() {
    if (!supported()) return null;
    const registration = await navigator.serviceWorker.getRegistration("/");
    return registration?.pushManager.getSubscription() || null;
  }

  async function activeServiceWorkerRegistration() {
    await navigator.serviceWorker.register("/push-service-worker.js", { scope: "/" });
    return navigator.serviceWorker.ready;
  }

  function selectedCategories() {
    return [...document.querySelectorAll("[data-push-category]:checked")].map(input => input.dataset.pushCategory);
  }

  function payload(subscription) {
    return {
      subscription: subscription.toJSON(),
      municipality: municipality(),
      categories: [...REQUIRED_CATEGORIES, ...selectedCategories()],
      language: "sv-SE",
      timeZone: "Europe/Stockholm"
    };
  }

  async function saveAtServer(subscription) {
    const current = await loadConfig();
    const response = await fetch(`${current.apiBase.replace(/\/$/, "")}/subscriptions`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload(subscription))
    });
    if (!response.ok) throw new Error("Prenumerationen kunde inte sparas");
  }

  async function removeAtServer(subscription) {
    const current = await loadConfig();
    if (!current.enabled || !current.apiBase) return;
    await fetch(`${current.apiBase.replace(/\/$/, "")}/subscriptions`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    });
  }

  function setStatus(kind, title, detail) {
    const status = document.querySelector("#push-status");
    if (!status) return;
    status.dataset.state = kind;
    status.querySelector("strong").textContent = title;
    status.querySelector("small").textContent = detail;
  }

  async function refreshUi() {
    const enable = document.querySelector("#push-enable");
    const disable = document.querySelector("#push-disable");
    const help = document.querySelector("#push-help");
    if (!enable || !disable || !help) return;

    const current = await loadConfig();
    if (!supported()) {
      enable.disabled = true;
      setStatus("unsupported", "Push stöds inte i den här webbläsaren", "Du kan fortfarande använda notiscentret på sidan.");
      return;
    }
    if (isIos() && !isStandalone()) {
      enable.disabled = true;
      setStatus("install", "Lägg först DinPuls på hemskärmen", "På iPhone och iPad fungerar push från en hemskärmsinstallerad webbapp.");
      help.textContent = "Öppna Dela-menyn i Safari och välj Lägg till på hemskärmen. Öppna sedan DinPuls därifrån.";
      return;
    }
    if (Notification.permission === "denied") {
      enable.disabled = true;
      setStatus("blocked", "Notiser är blockerade", "Tillåt notiser för dinpuls.se i webbläsarens webbplatsinställningar.");
      return;
    }
    if (!current.enabled || !current.apiBase || !current.publicKey) {
      enable.disabled = true;
      setStatus("setup", "Pushnotiser förbereds", "Tekniken finns på plats. Serverkopplingen aktiveras efter Cloudflare-konfigurationen.");
      help.textContent = "Dina val kan göras nu och sparas på enheten.";
      return;
    }
    const subscription = await currentSubscription();
    enable.hidden = Boolean(subscription);
    disable.hidden = !subscription;
    enable.disabled = false;
    setStatus(subscription ? "active" : "inactive", subscription ? "Pushnotiser är aktiverade" : "Pushnotiser är inte aktiverade", subscription ? `Du följer ${municipality()} på den här enheten.` : "Ingen app och inget konto behövs.");
    help.textContent = "";
  }

  async function enablePush() {
    const button = document.querySelector("#push-enable");
    try {
      button.disabled = true;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Du valde att inte tillåta notiser.");
      const current = await loadConfig();
      const registration = await activeServiceWorkerRegistration();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(current.publicKey)
      });
      await saveAtServer(subscription);
      await refreshUi();
    } catch (error) {
      setStatus("error", "Push kunde inte aktiveras", error.message || "Försök igen om en stund.");
      button.disabled = false;
    }
  }

  async function disablePush() {
    const subscription = await currentSubscription();
    if (subscription) {
      await removeAtServer(subscription);
      await subscription.unsubscribe();
    }
    await refreshUi();
  }

  async function syncSettings() {
    const categories = selectedCategories();
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ categories })); } catch {}
    const subscription = await currentSubscription();
    if (subscription && config?.enabled) await saveAtServer(subscription);
  }

  async function initialize() {
    const container = document.querySelector("#push-settings");
    if (!container) return;
    const settings = readSettings();
    document.querySelectorAll("[data-push-category]").forEach(input => {
      input.checked = settings.categories.includes(input.dataset.pushCategory);
      input.addEventListener("change", () => syncSettings().catch(() => setStatus("error", "Valet sparades på enheten", "Servern kunde inte uppdateras just nu.")));
    });
    document.querySelector("#push-enable")?.addEventListener("click", enablePush);
    document.querySelector("#push-disable")?.addEventListener("click", () => disablePush().catch(() => setStatus("error", "Push kunde inte stängas av", "Försök igen om en stund.")));
    document.addEventListener("dinpuls:municipalitychange", () => syncSettings().then(refreshUi).catch(() => refreshUi()));
    document.addEventListener("dinpuls:local-settings-cleared", () => disablePush().catch(() => {}));
    await refreshUi();
    if (window.lucide) lucide.createIcons();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", initialize) : initialize();
})();
