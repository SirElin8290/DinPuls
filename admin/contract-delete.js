(() => {
  "use strict";

  const TOKEN_KEY = "dp-admin-session";
  let apiBase = "";
  let selectedId = "";

  fetch("../data/business-config.json", { cache: "no-store" })
    .then(response => response.ok ? response.json() : Promise.reject(new Error("Konfigurationen kunde inte läsas.")))
    .then(config => { apiBase = String(config.apiBase || "").replace(/\/$/, ""); })
    .catch(() => {});

  async function requestRemoval(id) {
    if (!apiBase) throw new Error("API-konfiguration saknas.");
    const response = await fetch(`${apiBase}/portal/admin/contracts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY) || ""}` },
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Avtalet kunde inte tas bort.");
    return data;
  }

  function installButton() {
    const dialog = document.querySelector("#contractDialog");
    const actions = dialog?.querySelector(".actions");
    if (!dialog?.open || !actions || !selectedId || actions.querySelector(".contract-delete-action")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary contract-delete-action";
    button.textContent = "Ta bort avtal";
    button.style.borderColor = "#b42318";
    button.style.color = "#b42318";
    actions.append(button);

    button.onclick = async () => {
      const id = selectedId;
      if (!confirm(`Ta bort avtal ${id} och frigöra dess annonsplatser?`)) return;
      const typed = prompt(`Skriv avtalsnumret ${id} för att bekräfta.`);
      if (typed !== id) return;

      button.disabled = true;
      button.textContent = "Tar bort…";
      try {
        const result = await requestRemoval(id);
        alert(result.message || "Avtalet har tagits bort.");
        location.reload();
      } catch (error) {
        button.disabled = false;
        button.textContent = "Ta bort avtal";
        alert(error.message || "Avtalet kunde inte tas bort.");
      }
    };
  }

  document.addEventListener("click", event => {
    const row = event.target.closest?.("[data-contract]");
    if (!row) return;
    selectedId = row.dataset.contract || "";
    setTimeout(installButton, 0);
    setTimeout(installButton, 60);
  }, true);

  new MutationObserver(installButton).observe(document.body, { childList: true, subtree: true });
})();
