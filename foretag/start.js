const form = document.querySelector("#companyEntryLogin");
const message = document.querySelector("#entryLoginMessage");
form.addEventListener("submit", async event => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true; message.hidden = false; message.textContent = "Loggar in…";
  try {
    const config = await fetch("../data/business-config.json", { cache: "no-store" }).then(response => response.json());
    if (!config.enabled || !config.apiBase) throw new Error("Företagsinloggningen är inte tillgänglig just nu.");
    const data = Object.fromEntries(new FormData(form));
    const response = await fetch(`${String(config.apiBase).replace(/\/$/, "")}/portal/auth/company`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.token) throw new Error(result.error || "Inloggningen misslyckades.");
    sessionStorage.setItem("dp-company-session", result.token);
    form.querySelector('[name="password"]').value = "";
    location.assign("./");
  } catch (error) { message.textContent = error.message; button.disabled = false; }
});
