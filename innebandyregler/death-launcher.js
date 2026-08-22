(() => {
  "use strict";

  // Death Mode-frågorna laddas i death-mode.js innan app.js bygger sin frågebank.
  // Den här launchern lägger till ett faktiskt startkort och låser setupen till
  // kategorin "Death Mode" och 10 frågor.
  const grid = document.querySelector(".mode-grid");
  if (!grid) return;

  const button = document.createElement("button");
  button.className = "mode-card dark death-mode-card";
  button.type = "button";
  button.dataset.startMode = "training";
  button.innerHTML = '<span class="mode-icon">☠</span><span class="tag">EXPERT</span><h3>Death Mode</h3><p>10 regeltekniska kombinationsscenarier. Inga gratispoäng.</p><span class="card-link">Starta Death Mode →</span>';
  grid.appendChild(button);

  button.addEventListener("click", () => {
    // app.js öppnar setup-dialogen i sin egen click-handler. Kör direkt efter den.
    setTimeout(() => {
      const deathCategory = [...document.querySelectorAll('input[name="category"]')]
        .find(input => input.value === "Death Mode");
      if (deathCategory) deathCategory.checked = true;

      const ten = document.querySelector('input[name="count"][value="10"]');
      if (ten) ten.checked = true;

      const kicker = document.querySelector("#setup-kicker");
      const title = document.querySelector("#setup-title");
      const copy = document.querySelector("#setup-copy");
      const categoryField = document.querySelector("#category-field");
      if (kicker) kicker.textContent = "DEATH MODE";
      if (title) title.textContent = "10 frågor. Noll marginal.";
      if (copy) copy.textContent = "Endast Death Mode-scenarier används i detta pass.";
      if (categoryField) categoryField.hidden = true;
    }, 0);
  });
})();
