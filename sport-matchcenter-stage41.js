/* DinPuls Sport – Sprint 4.1 komplett lokalt matchcenter */
(() => {
  const baseRenderSportPage41 = renderSportPage;

  function renderMatchcenter41() {
    const data = getCurrentData();
    const matches = filteredMatches(data);
    const sources = filteredSources(data);
    const groups = getMatchGroups(matches);
    const upcoming = groups.upcoming.filter(match => !groups.today.includes(match));

    return `
      <section class="sport-matchcenter-41" aria-labelledby="matchcenter-title">
        <header class="sport-matchcenter-41-head">
          <div>
            <span class="section-kicker">Lokalt matchcenter</span>
            <h2 id="matchcenter-title">All sport i ${esc(sportMunicipality)}</h2>
            <p>Live, dagens matcher, kommande matcher och de senaste resultaten i samma vy.</p>
          </div>
          <div class="sport-matchcenter-41-summary" aria-label="Matchöversikt">
            <span><strong>${groups.live.length}</strong> live</span>
            <span><strong>${groups.today.length}</strong> idag</span>
            <span><strong>${upcoming.length}</strong> kommande</span>
            <span><strong>${groups.results.length}</strong> resultat</span>
          </div>
        </header>

        <nav class="sport-matchcenter-41-jumps" aria-label="Gå till del av matchcenter">
          <a href="#sport-live-41"><i data-lucide="radio"></i>Live</a>
          <a href="#sport-today-41"><i data-lucide="calendar-clock"></i>Idag</a>
          <a href="#sport-upcoming-41"><i data-lucide="calendar-days"></i>Kommande</a>
          <a href="#sport-results-41"><i data-lucide="circle-check"></i>Resultat</a>
        </nav>

        ${renderMatchcenterBlock41({
          id: "sport-live-41",
          kicker: "Pågår nu",
          title: "Live just nu",
          icon: "radio",
          matches: groups.live,
          type: "live",
          empty: "Inga lokala matcher pågår just nu.",
          className: "is-live-block"
        })}

        ${renderMatchcenterBlock41({
          id: "sport-today-41",
          kicker: "Dagens program",
          title: "Matcher idag",
          icon: "calendar-clock",
          matches: groups.today,
          type: "upcoming",
          empty: "Inga matcher är inlästa för idag."
        })}

        ${renderMatchcenterBlock41({
          id: "sport-upcoming-41",
          kicker: "Nästa på tur",
          title: "Kommande matcher",
          icon: "calendar-days",
          matches: upcoming.slice(0, 18),
          type: "upcoming",
          empty: "Inga kommande matcher är inlästa ännu."
        })}

        ${renderMatchcenterBlock41({
          id: "sport-results-41",
          kicker: "Senast avgjort",
          title: "Senaste resultat",
          icon: "circle-check",
          matches: groups.results.slice(0, 18),
          type: "results",
          empty: "Inga resultat är inlästa ännu."
        })}

        ${sources.length ? `<footer class="sport-matchcenter-41-footer"><i data-lucide="shield-check"></i><span>Data hämtas från ${sources.length} officiell${sources.length === 1 ? "" : "a"} källa${sources.length === 1 ? "" : "or"}. Originalkällan gäller alltid.</span></footer>` : ""}
      </section>`;
  }

  function renderMatchcenterBlock41({ id, kicker, title, icon, matches, type, empty, className = "" }) {
    return `
      <section id="${id}" class="sport-matchcenter-41-block ${className}">
        <div class="sport-matchcenter-41-block-head">
          <span class="sport-matchcenter-41-block-icon"><i data-lucide="${icon}"></i></span>
          <div><span class="section-kicker">${kicker}</span><h3>${title}</h3></div>
          <strong class="sport-matchcenter-41-count">${matches.length}</strong>
        </div>
        ${matches.length ? renderDatedMatches(matches, type) : `<div class="sport-matchcenter-41-empty"><i data-lucide="calendar-x"></i><p>${empty}</p></div>`}
      </section>`;
  }

  renderSportPage = function renderSportPage41() {
    baseRenderSportPage41();
    if (activeSportTab !== "matchcenter") return;
    const view = document.querySelector("#sport-view");
    if (!view) return;
    view.innerHTML = renderMatchcenter41();
    if (window.lucide) lucide.createIcons();
  };

  document.addEventListener("click", event => {
    const link = event.target.closest(".sport-matchcenter-41-jumps a");
    if (!link) return;
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
