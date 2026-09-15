import { normalizeSwedishOrgNumber } from "../cloudflare/swedish-org-number.js";

const form = document.querySelector("#registrationForm");
const unavailable = document.querySelector("#registrationUnavailable");
const result = document.querySelector("#registrationResult");
let apiBase = "";

try {
  const config = await fetch("../data/business-config.json", { cache: "no-store" }).then(response => response.json());
  apiBase = String(config.apiBase || "").replace(/\/$/, "");
  if (!apiBase) throw new Error("Företagstjänsten saknas.");
  const health = await fetch(`${apiBase}/health`, { cache: "no-store" }).then(response => response.json());
  if (!health.selfServiceSignupEnabled) throw new Error("Självregistrering öppnar när köp- och avtalsflödet är färdigt.");
  unavailable.hidden = true;
  form.hidden = false;
} catch (error) { unavailable.textContent = error.message; }

form.addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  result.hidden = false;
  if (!normalizeSwedishOrgNumber(data.orgNo)) {
    result.textContent = "Ange ett formellt giltigt svenskt organisationsnummer.";
    return;
  }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  result.textContent = "Skapar kontot…";
  try {
    const response = await fetch(`${apiBase}/portal/company/register`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), cache: "no-store"
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Kontot kunde inte skapas.");
    form.reset(); result.textContent = payload.message;
  } catch (error) { result.textContent = error.message; }
  finally { button.disabled = false; }
});
