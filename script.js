/* =========================================================
   DINPULS.SE – INTERAKTIVITET
========================================================= */

/* Flikar */
document.querySelectorAll(".tabs, .text-tabs").forEach((group) => {
  group.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      group.querySelectorAll("button").forEach((item) => {
        item.classList.remove("active");
      });

      button.classList.add("active");
    });
  });
});

/* Sökfält */
const searchForm = document.querySelector(".search");

if (searchForm) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const value = event.currentTarget.querySelector("input").value.trim();

    if (value) {
      alert(
        `Sökning efter: ${value}\n\nSökfunktionen kopplas till riktiga data i ett senare steg.`
      );
    }
  });
}

/* Liveklocka */
const clockElement = document.querySelector("#live-clock");

function updateClock() {
  if (!clockElement) {
    return;
  }

  const now = new Date();

  clockElement.textContent = now.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

updateClock();
window.setInterval(updateClock, 1000);

/* Demonstration av levande bussnedräkning */
const busCountdownElement = document.querySelector("#next-bus-countdown");
let busMinutes = 3;

function updateBusCountdown() {
  if (!busCountdownElement) {
    return;
  }

  if (busMinutes > 1) {
    busMinutes -= 1;
    busCountdownElement.textContent = `${busMinutes} min`;
  } else if (busMinutes === 1) {
    busMinutes = 0;
    busCountdownElement.textContent = "nu";
  } else {
    busMinutes = 3;
    busCountdownElement.textContent = "3 min";
  }
}

/*
  För prototypen uppdateras nedräkningen var 20:e sekund.
  När vi kopplar riktig trafikdata ersätts detta med verkliga tider.
*/
window.setInterval(updateBusCountdown, 20000);
