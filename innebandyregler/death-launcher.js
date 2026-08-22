(() => {
  "use strict";

  const grid = document.querySelector(".mode-grid");
  if (!grid) return;

  const button = document.createElement("button");
  button.className = "mode-card dark death-mode-card";
  button.type = "button";
  button.innerHTML = '<span class="mode-icon">☠</span><span class="tag">EXPERT</span><h3>Death Mode</h3><p>10 regeltekniska kombinationsscenarier. Inga gratispoäng.</p><span class="card-link">Starta Death Mode →</span>';
  grid.appendChild(button);

  button.addEventListener("click", () => {
    // Death-kortet skapas dynamiskt efter att app.js har registrerat sina
    // klicklyssnare. Därför använder vi den ordinarie träningsknappen för att
    // öppna och bygga setup-dialogen, och låser därefter setupen till Death Mode.
    const normalTrainingButton = document.querySelector('.hero-actions [data-start-mode="training"]');
    if (!normalTrainingButton) {
      console.error("VDK Death Mode: ordinarie träningsknapp saknas.");
      return;
    }

    normalTrainingButton.click();

    requestAnimationFrame(() => {
      const deathCategory = [...document.querySelectorAll('input[name="category"]')]
        .find(input => input.value === "Death Mode");
      const ten = document.querySelector('input[name="count"][value="10"]');
      const kicker = document.querySelector("#setup-kicker");
      const title = document.querySelector("#setup-title");
      const copy = document.querySelector("#setup-copy");
      const categoryField = document.querySelector("#category-field");

      if (!deathCategory) {
        console.error("VDK Death Mode: kategorin Death Mode finns inte i setupen.");
        return;
      }

      deathCategory.checked = true;
      deathCategory.dispatchEvent(new Event("change", { bubbles: true }));
      if (ten) {
        ten.checked = true;
        ten.dispatchEvent(new Event("change", { bubbles: true }));
      }

      if (kicker) kicker.textContent = "DEATH MODE";
      if (title) title.textContent = "10 frågor. Noll marginal.";
      if (copy) copy.textContent = "Endast Death Mode-scenarier används i detta pass.";
      if (categoryField) categoryField.hidden = true;
    });
  });
})();
