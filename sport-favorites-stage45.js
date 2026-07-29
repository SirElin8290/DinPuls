/* DinPuls Sport – Sprint 4.5 Mina lag */
(() => {
  const baseRenderSportPage45 = renderSportPage;

  function allFavoriteEntries45() {
    return favoriteClubs.map(key => {
      const split = key.indexOf("::");
      return { municipality: split >= 0 ? key.slice(0, split) : sportMunicipality, name: split >= 0 ? key.slice(split + 2) : key };
    }).filter(item => item.name);
  }

  function clubForFavorite45(entry) {
    return sportData?.municipalities?.[entry.municipality]?.clubs?.find(club => club.name === entry.name) || null;
  }

  function matchesForFavorite45(entry) {
    const data = sportData?.municipalities?.[entry.municipality] || {};
    return normalizedMatches(data).filter(match => [match.homeTeam, match.awayTeam].some(team => String(team || "").toLocaleLowerCase("sv-SE").includes(entry.name.toLocaleLowerCase("sv-SE")) || entry.name.toLocaleLowerCase("sv-SE").includes(String(team || "").toLocaleLowerCase("sv-SE"))));
  }

  function renderFavoriteClub45(entry) {
    const club = clubForFavorite45(entry);
    const matches = matchesForFavorite45(entry).sort((a,b) => new Date(a.startTime) - new Date(b.startTime));
    const now = Date.now();
    const next = matches.find(match => new Date(match.startTime).getTime() >= now && !["finished","final","ended"].includes(String(match.status || "").toLowerCase()));
    const last = [...matches].reverse().find(match => ["finished","final","ended"].includes(String(match.status || "").toLowerCase()) || (Number.isFinite(Number(match.homeScore)) && Number.isFinite(Number(match.awayScore)) && new Date(match.startTime).getTime() < now));
    const sports = club?.sports || [...new Set(matches.map(match => match.sport).filter(Boolean))];
    const clubUrl = `club.html?kommun=${encodeURIComponent(entry.municipality)}&klubb=${encodeURIComponent(entry.name)}`;
    return `<article class="sport-favorite-team-card">
      <div class="sport-favorite-team-head">
        <span class="sport-favorite-team-icon"><i data-lucide="star"></i></span>
        <div><small>${esc(entry.municipality)} · ${esc(sports.join(" · ") || "Lokalt lag")}</small><h3><a href="${clubUrl}">${esc(entry.name)}</a></h3></div>
        <button type="button" data-remove-favorite-45="${esc(`${entry.municipality}::${entry.name}`)}" aria-label="Sluta följa ${esc(entry.name)}"><i data-lucide="x"></i></button>
      </div>
      <div class="sport-favorite-team-matches">
        ${next ? `<a class="sport-favorite-match next" href="match.html?kommun=${encodeURIComponent(entry.municipality)}&id=${encodeURIComponent(matchIdentity(next))}"><small>Nästa match</small><strong>${esc(next.homeTeam)} – ${esc(next.awayTeam)}</strong><span>${esc(formatMatchDate(next.startTime))} ${esc(formatMatchTime(next.startTime))}${next.venue ? ` · ${esc(next.venue)}` : ""}</span></a>` : `<div class="sport-favorite-match empty"><small>Nästa match</small><span>Ingen kommande match är inläst.</span></div>`}
        ${last ? `<a class="sport-favorite-match result" href="match.html?kommun=${encodeURIComponent(entry.municipality)}&id=${encodeURIComponent(matchIdentity(last))}"><small>Senaste resultat</small><strong>${esc(last.homeTeam)} – ${esc(last.awayTeam)}</strong><span class="sport-favorite-score">${Number.isFinite(Number(last.homeScore)) && Number.isFinite(Number(last.awayScore)) ? `${esc(last.homeScore)}–${esc(last.awayScore)}` : "Resultat saknas"}</span></a>` : `<div class="sport-favorite-match empty"><small>Senaste resultat</small><span>Inget resultat är inläst.</span></div>`}
      </div>
      <footer><a href="${clubUrl}">Öppna föreningssidan <i data-lucide="arrow-right"></i></a>${club?.url ? `<a href="${esc(club.url)}" target="_blank" rel="noopener noreferrer">Officiell sida <i data-lucide="arrow-up-right"></i></a>` : ""}</footer>
    </article>`;
  }

  function renderFavoritesDashboard45() {
    const entries = allFavoriteEntries45();
    const withNext = entries.filter(entry => matchesForFavorite45(entry).some(match => new Date(match.startTime).getTime() >= Date.now()));
    return `<section class="sport-favorites-45">
      <header class="sport-favorites-45-head">
        <div><span class="section-kicker">Personlig lokalsport</span><h2>Mina lag</h2><p>Samla lokala föreningar från alla DinPuls-kommuner och se nästa match och senaste resultat direkt.</p></div>
        <div class="sport-favorites-45-stats"><span><strong>${entries.length}</strong> lag följs</span><span><strong>${withNext.length}</strong> med kommande match</span></div>
      </header>
      ${entries.length ? `<div class="sport-favorites-team-grid">${entries.map(renderFavoriteClub45).join("")}</div>` : `<div class="sport-favorites-empty"><i data-lucide="star"></i><h3>Du följer inga lag ännu</h3><p>Öppna fliken Föreningar och tryck på stjärnan vid ett lag. Dina val sparas på den här enheten.</p><button type="button" data-open-tab="clubs">Hitta lokala lag</button></div>`}
      <section class="sport-favorites-info"><i data-lucide="smartphone"></i><div><strong>Sparas lokalt på din enhet</strong><span>Ingen inloggning krävs. Favoriterna följer inte automatiskt med till en annan webbläsare eller enhet.</span></div></section>
    </section>`;
  }

  renderSportPage = function renderSportPage45() {
    baseRenderSportPage45();
    if (activeSportTab !== "favorites") return;
    const view = document.querySelector("#sport-view");
    if (!view) return;
    view.innerHTML = renderFavoritesDashboard45();
    if (window.lucide) lucide.createIcons();
  };

  document.addEventListener("click", event => {
    const remove = event.target.closest("[data-remove-favorite-45]");
    if (!remove) return;
    event.preventDefault();
    favoriteClubs = favoriteClubs.filter(key => key !== remove.dataset.removeFavorite45);
    saveFavorites();
    renderSportPage();
  });
})();