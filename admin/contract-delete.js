(() => {
  "use strict";

  const TOKEN_KEY = "dp-admin-session";
  let apiBase = "";
  let selectedId = "";

  fetch("../data/business-config.json", { cache: "no-store" })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("Konfigurationen kunde inte läsas.")))
    .then(config => { apiBase = String(config.apiBase || "").replace(/\/$/, ""); })
    .catch(() => {});

  async function removeContract(id) {
    if (!apiBase) throw new Error("API-konfiguration saknas. Ladda om sidan.");
    const token = sessionStorage.getItem(TOKEN_KEY) || "";
    if (!token) throw new Error("Adminsession saknas. Logga in igen.");
    const response = await fetch(`${apiBase}/portal/admin/contracts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Avtalet kunde inte tas bort.");
    return data;
  }

  function getId(dialog) {
    if (selectedId) return selectedId;
    const match = (dialog?.querySelector("p.muted")?.textContent || "").match(/DP-\d{4}-\d+/i);
    return match ? match[0] : "";
  }

  function installButton() {
    const dialog = document.querySelector("#contractDialog");
    const actions = dialog?.querySelector(".actions");
    if (!dialog?.open || !actions || actions.querySelector(".contract-delete-action")) return;
    const id = getId(dialog);
    if (!id) return;
    selectedId = id;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary contract-delete-action";
    button.textContent = "Ta bort avtal";
    button.style.borderColor = "#b42318";
    button.style.color = "#b42318";
    actions.append(button);

    button.addEventListener("click", async () => {
      if (!confirm(`Ta bort avtal ${id} och frigöra annonsplatserna?`)) return;
      const typed = prompt(`Skriv ${id} för att bekräfta.`);
      if (typed === null) return;
      if (typed.trim() !== id) {
        alert("Avtalsnumret stämde inte. Ingenting ändrades.");
        return;
      }
      button.disabled = true;
      button.textContent = "Tar bort…";
      try {
        await removeContract(id);
        alert(`Avtal ${id} har tagits bort.`);
        location.reload();
      } catch (error) {
        button.disabled = false;
        button.textContent = "Ta bort avtal";
        alert(error.message || "Avtalet kunde inte tas bort.");
      }
    });
  }

  document.addEventListener("click", event => {
    const row = event.target.closest?.("[data-contract]");
    if (!row) return;
    selectedId = row.dataset.contract || "";
    [0, 50, 150].forEach(delay => setTimeout(installButton, delay));
  }, true);

  new MutationObserver(installButton).observe(document.body, { childList: true, subtree: true });
})();
