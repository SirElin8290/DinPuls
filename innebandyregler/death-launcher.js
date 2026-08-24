(() => {
  "use strict";

  const grid = document.querySelector(".mode-grid");
  if (!grid) return;

  const button = document.createElement("button");
  button.className = "mode-card dark death-mode-card";
  button.type = "button";
  button.innerHTML = '<span class="mode-icon">☠</span><span class="tag">EXPERT</span><h3>Death Mode</h3><p>Välj 10, 25 eller 35 regeltekniska kombinationsscenarier. Inga gratispoäng.</p><span class="card-link">Starta Death Mode →</span>';
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
      const countOptions = document.querySelector("#count-options");
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

      // Death Mode har en egen passlängd: 10, 25 eller hela banken (35).
      // app.js läser det valda input[name="count"] när passet startas, så vi
      // kan använda den ordinarie sessionsmotorn och dess slumpning oförändrad.
      if (countOptions) {
        countOptions.innerHTML = [10, 25, 35].map((count, index) =>
          `<label><input type="radio" name="count" value="${count}" ${index === 0 ? "checked" : ""}><span>${count}</span></label>`
        ).join("");
      }

      if (kicker) kicker.textContent = "DEATH MODE";
      if (title) title.textContent = "Välj hur hårt du vill köra.";
      if (copy) copy.textContent = "Välj 10, 25 eller alla 35 Death Mode-scenarier. Frågorna slumpas på nytt för varje pass.";
      if (categoryField) categoryField.hidden = true;
    });
  });
})();
