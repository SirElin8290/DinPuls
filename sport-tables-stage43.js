/* DinPuls Sport – Sprint 4.3 tabeller och form */
(() => {
  const baseRenderSportPage43 = renderSportPage;

  const finishedStatuses43 = new Set(["finished", "final", "ended"]);
  const num43 = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const clean43 = value => String(value || "").trim();

  function completedMatches43(data) {
    const now = Date.now();
    return normalizedMatches(data).filter(match => {
      const home = num43(match.homeScore), away = num43(match.awayScore);
      if (home === null || away === null) return false;
      const status = clean43(match.status).toLowerCase();
      const start = new Date(match.startTime).getTime();
      return finishedStatuses43.has(status) || (Number.isFinite(start) && start < now);
    });
  }

  function competitionKey43(match) {
    return [clean43(match.sport) || "Sport", clean43(match.competition || match.series) || "Serie saknas"].join("::");
  }

  function buildStandings43(matches) {
    const rows = new Map();
    const ensure = team => {
      if (!rows.has(team)) rows.set(team, {team, played:0, wins:0, draws:0, losses:0, goalsFor:0, goalsAgainst:0, points:0, form:[]});
      return rows.get(team);
    };

    [...matches].sort((a,b) => new Date(a.startTime) - new Date(b.startTime)).forEach(match => {
      const homeName = clean43(match.homeTeam), awayName = clean43(match.awayTeam);
      const homeScore = num43(match.homeScore), awayScore = num43(match.awayScore);
      if (!homeName || !awayName || homeScore === null || awayScore === null) return;
      const home = ensure(homeName), away = ensure(awayName);
      home.played++; away.played++;
      home.goalsFor += homeScore; home.goalsAgainst += awayScore;
      away.goalsFor += awayScore; away.goalsAgainst += homeScore;
      if (homeScore > awayScore) {
        home.wins++; home.points += 3; away.losses++;
        home.form.push("W"); away.form.push("L");
      } else if (homeScore < awayScore) {
        away.wins++; away.points += 3; home.losses++;
        away.form.push("W"); home.form.push("L");
      } else {
        home.draws++; away.draws++; home.points++; away.points++;
        home.form.push("D"); away.form.push("D");
      }
    });

    return [...rows.values()].map(row => ({...row, goalDifference:row.goalsFor-row.goalsAgainst, form:row.form.slice(-5)})).sort((a,b) =>
      b.points-a.points || b.goalDifference-a.goalDifference || b.goalsFor-a.goalsFor || a.team.localeCompare(b.team,"sv")
    );
  }

  function getTables43() {
    const data = getCurrentData();
    const sport = getSelectedSport();
    const query = getSearchQuery();
    const matches = completedMatches43(data).filter(match =>
      (sport === "all" || match.sport === sport) &&
      (!query || [match.homeTeam, match.awayTeam, match.competition, match.series, match.sport].join(" ").toLocaleLowerCase("sv-SE").includes(query))
    );
    const groups = new Map();
    matches.forEach(match => {
      const key = competitionKey43(match);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(match);
    });
    return [...groups.entries()].map(([key, groupMatches]) => {
      const [sportName, competition] = key.split("::");
      return {sport:sportName, competition, matches:groupMatches, rows:buildStandings43(groupMatches)};
    }).filter(table => table.rows.length >= 2).sort((a,b) => a.sport.localeCompare(b.sport,"sv") || a.competition.localeCompare(b.competition,"sv"));
  }

  function formDots43(form) {
    if (!form.length) return `<span class="sport-form-empty">–</span>`;
    return `<span class="sport-form-dots" aria-label="Form senaste ${form.length} matcher">${form.map(result => `<i class="is-${result.toLowerCase()}" title="${result === "W" ? "Vinst" : result === "D" ? "Oavgjort" : "Förlust"}">${result === "W" ? "V" : result === "D" ? "O" : "F"}</i>`).join("")}</span>`;
  }

  function renderTable43(table, index) {
    const localClubNames = new Set((getCurrentData().clubs || []).map(club => club.name));
    const source = filteredSources(getCurrentData()).find(item => item.sport === table.sport || item.sport === "Alla sporter");
    return `<article class="sport-standing-card">
      <header class="sport-standing-head">
        <span class="sport-standing-icon"><i data-lucide="${getSportIcon(table.sport)}"></i></span>
        <div><span class="section-kicker">${esc(table.sport)}</span><h3>${esc(table.competition)}</h3><p>Beräknad från ${table.matches.length} färdigspelade matcher i DinPuls anslutna flöden.</p></div>
        ${source ? `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Officiell tabell <i data-lucide="arrow-up-right"></i></a>` : ""}
      </header>
      <div class="sport-standing-scroll">
        <table class="sport-standing-table">
          <thead><tr><th>#</th><th>Lag</th><th title="Spelade">S</th><th title="Vunna">V</th><th title="Oavgjorda">O</th><th title="Förlorade">F</th><th title="Målskillnad">Mål</th><th title="Poäng">P</th><th>Form</th></tr></thead>
          <tbody>${table.rows.map((row, position) => {
            const isLocal = localClubNames.has(row.team) || [...localClubNames].some(name => row.team.includes(name) || name.includes(row.team));
            const club = [...localClubNames].find(name => row.team.includes(name) || name.includes(row.team));
            return `<tr class="${isLocal ? "is-local-team" : ""}"><td><strong>${position+1}</strong></td><td>${club ? `<a href="club.html?kommun=${encodeURIComponent(sportMunicipality)}&klubb=${encodeURIComponent(club)}">${esc(row.team)}</a>` : `<strong>${esc(row.team)}</strong>`}${isLocal ? `<small>Lokalt lag</small>` : ""}</td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.goalsFor}–${row.goalsAgainst}<small>${row.goalDifference > 0 ? "+" : ""}${row.goalDifference}</small></td><td><b>${row.points}</b></td><td>${formDots43(row.form)}</td></tr>`;
          }).join("")}</tbody>
        </table>
      </div>
      ${index === 0 ? `<footer class="sport-standing-note"><i data-lucide="info"></i><span>Tabellen använder tre poäng för vinst och en poäng för oavgjort. Originalförbundets tabell gäller alltid.</span></footer>` : ""}
    </article>`;
  }

  function renderTables43() {
    const tables = getTables43();
    const sources = filteredSources(getCurrentData());
    return `<section class="sport-tables-43">
      <header class="sport-tables-43-intro"><div><span class="section-kicker">Lokala serietabeller</span><h2>Tabeller och form</h2><p>Placering, poäng, målskillnad och de fem senaste resultaten – beräknat enbart från verifierade matcher som DinPuls har läst in.</p></div><span><strong>${tables.length}</strong> tabell${tables.length === 1 ? "" : "er"}</span></header>
      ${tables.length ? `<div class="sport-standing-list">${tables.map(renderTable43).join("")}</div>` : `<div class="sport-table-empty"><i data-lucide="list-ordered"></i><div><strong>Inte tillräckligt med matchdata för en tabell ännu</strong><p>En tabell visas först när minst två lag har färdigspelade matcher med verifierade resultat.</p></div></div>`}
      ${sources.length ? `<section class="sport-table-sources"><div><span class="section-kicker">Originaltabeller</span><h3>Kontrollera hos förbunden</h3></div>${renderSourceCards(sources,"Öppna officiell tabell")}</section>` : ""}
    </section>`;
  }

  renderSportPage = function renderSportPage43() {
    baseRenderSportPage43();
    if (activeSportTab !== "tables") return;
    const view = document.querySelector("#sport-view");
    if (!view) return;
    view.innerHTML = renderTables43();
    if (window.lucide) lucide.createIcons();
  };
})();