import { normalizeSwedishOrgNumber } from "../cloudflare/swedish-org-number.js";

const card = document.querySelector("#authCard");
const loginPanel = document.querySelector("#loginPanel");
const registrationPanel = document.querySelector("#registrationPanel");
const loginForm = document.querySelector("#companyEntryLogin");
const loginMessage = document.querySelector("#entryLoginMessage");
const registrationForm = document.querySelector("#registrationForm");
const registrationUnavailable = document.querySelector("#registrationUnavailable");
const registrationResult = document.querySelector("#registrationResult");
let apiBase = "";

function showRegistration({ focus = true } = {}) {
  card.classList.add("is-flipped");
  loginPanel.setAttribute("aria-hidden", "true");
  loginPanel.inert = true;
  registrationPanel.removeAttribute("aria-hidden");
  registrationPanel.inert = false;
  history.replaceState(null, "", location.pathname + "?mode=register");
  if (focus) window.setTimeout(() => document.querySelector("#orgNo").focus(), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650);
}
function showLogin({ focus = true } = {}) {
  card.classList.remove("is-flipped");
  registrationPanel.setAttribute("aria-hidden", "true");
  registrationPanel.inert = true;
  loginPanel.removeAttribute("aria-hidden");
  loginPanel.inert = false;
  history.replaceState(null, "", location.pathname);
  if (focus) window.setTimeout(() => document.querySelector("#loginEmail").focus(), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650);
}
document.querySelector("#showRegistration").addEventListener("click", event => { event.preventDefault(); showRegistration(); });
document.querySelector("#showLogin").addEventListener("click", () => showLogin());

try {
  const config = await fetch("../data/business-config.json", { cache: "no-store" }).then(response => response.json());
  apiBase = String(config.apiBase || "").replace(/\/$/, "");
  if (!apiBase) throw new Error("Företagstjänsten saknas.");
  const health = await fetch(apiBase + "/health", { cache: "no-store" }).then(response => response.json());
  if (!health.selfServiceSignupEnabled) throw new Error("Självregistreringen är inte tillgänglig just nu.");
  registrationUnavailable.hidden = true;
  registrationForm.hidden = false;
} catch (error) { registrationUnavailable.textContent = error.message; }

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true; loginMessage.hidden = false; loginMessage.textContent = "Loggar in…";
  try {
    if (!apiBase) throw new Error("Företagsinloggningen är inte tillgänglig just nu.");
    const data = Object.fromEntries(new FormData(loginForm));
    const response = await fetch(apiBase + "/portal/auth/company", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.token) throw new Error(result.error || "Inloggningen misslyckades.");
    sessionStorage.setItem("dp-company-session", result.token);
    loginForm.querySelector('[name="password"]').value = "";
    location.assign("./");
  } catch (error) { loginMessage.textContent = error.message; button.disabled = false; }
});

registrationForm.addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(registrationForm));
  registrationResult.hidden = false;
  if (!normalizeSwedishOrgNumber(data.orgNo)) { registrationResult.textContent = "Ange ett formellt giltigt svenskt organisationsnummer."; return; }
  const button = registrationForm.querySelector('button[type="submit"]');
  button.disabled = true; registrationResult.textContent = "Skapar kontot…";
  try {
    const response = await fetch(apiBase + "/portal/company/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Kontot kunde inte skapas.");
    registrationForm.reset();
    registrationResult.textContent = payload.message + " När lösenordet är valt loggar du in och fortsätter till Välj annonsplatser.";
  } catch (error) { registrationResult.textContent = error.message; }
  finally { button.disabled = false; }
});
if (new URLSearchParams(location.search).get("mode") === "register") showRegistration({ focus: false });
