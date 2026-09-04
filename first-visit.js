/* DinPuls first-visit municipality selector v1 */
(() => {
  "use strict";

  /* Håll URL-parametern i synk med det kommunval som faktiskt visas.
     Startsidan kan annars ha kvar t.ex. ?kommun=Forshaga efter att användaren
     bytt till Färgelanda. Vid refresh vinner URL-parametern över localStorage
     och sidan hoppar då tillbaka till den gamla kommunen. */
  document.addEventListener("dinpuls:municipalitychange", event => {
    const name = event.detail?.municipality?.name || event.detail?.name;
    if (!name) return;
    window.DinPulsMunicipalityState?.updateUrl?.(name);
  });

  const onboarding = document.getElementById("municipality-onboarding");
  const options = document.getElementById("municipality-onboarding-options");
  if (!onboarding || !options) return;

  let enhanced = false;
  const enhance = () => {
    if (enhanced || !options.querySelector("[data-first-municipality]")) return;
    enhanced = true;
    const card = onboarding.querySelector(".municipality-onboarding-card");
    const note = onboarding.querySelector(".municipality-onboarding-note");
    if (!card || !note) return;

    const label = document.createElement("label");
    label.className = "first-visit-label";
    label.textContent = "Välj kommun";
    const combo = document.createElement("div");
    combo.className = "first-visit-combobox";
    combo.innerHTML = `<button class="first-visit-trigger" type="button" aria-expanded="false"><span aria-hidden="true">⌕</span><span class="first-visit-trigger-text">Sök eller välj kommun</span><span class="chevron" aria-hidden="true">⌄</span></button><div class="first-visit-panel" hidden><div class="first-visit-search-wrap"><span aria-hidden="true">⌕</span><input class="first-visit-search" type="search" autocomplete="off" placeholder="Sök kommun" aria-label="Sök kommun"><button class="first-visit-clear" type="button" aria-label="Rensa sökning">×</button></div></div>`;
    const panel = combo.querySelector(".first-visit-panel");
    panel.appendChild(options);
    const availability = document.createElement("p");
    availability.className = "first-visit-availability";
    availability.textContent = "Endast kommuner som finns på DinPuls visas.";
    const proceed = document.createElement("button");
    proceed.className = "first-visit-continue";
    proceed.type = "button";
    proceed.disabled = true;
    proceed.textContent = "Fortsätt till DinPuls";
    card.insertBefore(label, note);
    label.after(combo);
    combo.after(availability, proceed);

    const trigger = combo.querySelector(".first-visit-trigger");
    const triggerText = combo.querySelector(".first-visit-trigger-text");
    const search = combo.querySelector(".first-visit-search");
    const clear = combo.querySelector(".first-visit-clear");
    let selected = null;
    let confirming = false;
    const setOpen = open => { panel.hidden = !open; trigger.setAttribute("aria-expanded", String(open)); if (open) requestAnimationFrame(() => search.focus()); };
    const filter = () => {
      const query = search.value.trim().toLocaleLowerCase("sv-SE");
      options.querySelectorAll("[data-first-municipality]").forEach(button => { button.hidden = !button.dataset.firstMunicipality.toLocaleLowerCase("sv-SE").includes(query); });
    };
    trigger.addEventListener("click", () => setOpen(panel.hidden));
    search.addEventListener("input", filter);
    clear.addEventListener("click", () => { search.value = ""; filter(); search.focus(); });
    options.addEventListener("click", event => {
      if (confirming) return;
      const button = event.target.closest("[data-first-municipality]");
      if (!button) return;
      event.stopImmediatePropagation();
      selected = button;
      options.querySelectorAll("[data-first-municipality]").forEach(item => item.classList.toggle("is-selected", item === button));
      triggerText.textContent = button.dataset.firstMunicipality;
      proceed.disabled = false;
      setOpen(false);
    }, true);
    proceed.addEventListener("click", () => {
      if (!selected) return;
      confirming = true;
      selected.click();
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !panel.hidden) setOpen(false); });
  };
  const observer = new MutationObserver(enhance);
  observer.observe(options, { childList: true });
  enhance();
})();
