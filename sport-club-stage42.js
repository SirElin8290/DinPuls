(() => {
  const params = new URLSearchParams(location.search);
  const municipality = params.get("kommun") || "Åmål";
  const clubName = params.get("klubb") || "";
  const root = document.querySelector("#club-page");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const favoriteKey = name => `${municipality}::${name}`;
  const readFavorites = () => { try { return JSON.parse(localStorage.getItem("dinpuls-sport-favorites") || "[]"); } catch { return []; } };
  const isFavorite = name => readFavorites().includes(favoriteKey(name));
  const toggleFavorite = name => {
    const key = favoriteKey(name), current = readFavorites();
    localStorage.setItem("dinpuls-sport-favorites", JSON.stringify(current.includes(key) ? current.filter(x => x !== key) : [...current, key]));
    render();
  };
  let club, matches = [], sources = [];

  const belongsToClub = match => [match.homeTeam, match.awayTeam].some(team => String(team || "").toLocaleLowerCase("sv-SE").includes(clubName.toLocaleLowerCase("sv-SE")) || clubName.toLocaleLowerCase("sv-SE").includes(String(team || "").toLocaleLowerCase("sv-SE")));
  const dateText = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? "Datum saknas" : d.toLocaleDateString("sv-SE", {weekday:"short", day:"numeric", month:"short"}); };
  const timeText = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("sv-SE", {hour:"2-digit", minute:"2-digit"}); };
  const status = match => String(match.status || "scheduled").toLowerCase();
  const isFinished = match => ["finished","final","ended"].includes(status(match)) || (Number.isFinite(Number(match.homeScore)) && Number.isFinite(Number(match.awayScore)) && new Date(match.startTime) < new Date());
  const matchCard = match => `<article class="club-match-card"><div><small>${esc(match.sport || club.sports?.[0] || "Sport")} · ${esc(match.competition || "")}</small><strong>${esc(match.homeTeam)} – ${esc(match.awayTeam)}</strong><span>${esc(dateText(match.startTime))} ${esc(timeText(match.startTime))}${match.venue ? ` · ${esc(match.venue)}` : ""}</span></div><b>${Number.isFinite(Number(match.homeScore)) && Number.isFinite(Number(match.awayScore)) ? `${esc(match.homeScore)}–${esc(match.awayScore)}` : "–"}</b>${match.sourceUrl ? `<a href="${esc(match.sourceUrl)}" target="_blank" rel="noopener noreferrer">Matchinfo ↗</a>` : ""}</article>`;

  function render() {
    if (!club) return;
    const now = Date.now();
    const upcoming = matches.filter(m => !isFinished(m) && new Date(m.startTime).getTime() >= now).sort((a,b) => new Date(a.startTime)-new Date(b.startTime));
    const results = matches.filter(isFinished).sort((a,b) => new Date(b.startTime)-new Date(a.startTime));
    document.title = `${club.name} – DinPuls`;
    document.querySelector("#club-back-link").href = `sport.html?kommun=${encodeURIComponent(municipality)}`;
    root.innerHTML = `
      <section class="club-hero">
        <span class="club-badge">${esc((club.sports || ["Sport"])[0].slice(0,2).toUpperCase())}</span>
        <div><span class="section-kicker">Förening i ${esc(municipality)}</span><h1>${esc(club.name)}</h1><p>${esc((club.sports || []).join(" · "))}</p></div>
        <button type="button" id="club-favorite" class="${isFavorite(club.name) ? "active" : ""}">★ ${isFavorite(club.name) ? "Följer" : "Följ laget"}</button>
      </section>
      <section class="club-sponsor"><small>Exklusiv sponsorplats</small><strong>${esc(club.name)} presenteras av ditt företag</strong><a href="mailto:annonser@dinpuls.se?subject=${encodeURIComponent(`Sponsor ${club.name}`)}">Boka platsen</a></section>
      <section class="club-stat-grid"><article><strong>${upcoming.length}</strong><span>kommande</span></article><article><strong>${results.length}</strong><span>resultat</span></article><article><strong>${matches.length}</strong><span>matcher totalt</span></article><article><strong>${esc(municipality)}</strong><span>kommun</span></article></section>
      <div class="club-layout">
        <div class="club-main">
          <section class="club-panel"><div class="club-panel-head"><div><span class="section-kicker">Nästa matcher</span><h2>Kommande</h2></div></div>${upcoming.length ? upcoming.slice(0,8).map(matchCard).join("") : `<div class="club-empty">Inga kommande matcher är inlästa ännu.</div>`}</section>
          <section class="club-panel"><div class="club-panel-head"><div><span class="section-kicker">Senast spelat</span><h2>Resultat</h2></div></div>${results.length ? results.slice(0,8).map(matchCard).join("") : `<div class="club-empty">Inga resultat är inlästa ännu.</div>`}</section>
        </div>
        <aside class="club-aside">
          <section class="club-info-card"><span class="section-kicker">Föreningsinfo</span><h2>Om föreningen</h2><dl><div><dt>Kommun</dt><dd>${esc(municipality)}</dd></div><div><dt>Sport</dt><dd>${esc((club.sports || []).join(", "))}</dd></div><div><dt>Källa</dt><dd>${esc(club.source || "Föreningen")}</dd></div></dl><a href="${esc(club.url)}" target="_blank" rel="noopener noreferrer">Officiell sida ↗</a></section>
          <section class="club-info-card"><span class="section-kicker">Datakällor</span><h2>Verifierade länkar</h2>${sources.length ? sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`).join("") : `<p>Ingen särskild matchkälla är ansluten ännu.</p>`}</section>
        </aside>
      </div>`;
    document.querySelector("#club-favorite")?.addEventListener("click", () => toggleFavorite(club.name));
    if (window.lucide) lucide.createIcons();
  }

  Promise.all([
    fetch(`data/sports.json?version=${Date.now()}`, {cache:"no-store"}).then(r => r.json()),
    fetch(`data/sport-feeds.json?version=${Date.now()}`, {cache:"no-store"}).then(r => r.ok ? r.json() : null).catch(() => null)
  ]).then(([data, feeds]) => {
    const local = data.municipalities?.[municipality];
    club = local?.clubs?.find(item => item.name === clubName);
    if (!club) throw new Error("Föreningen hittades inte");
    sources = (local.liveSources || []).filter(source => source.sport === "Alla sporter" || (club.sports || []).includes(source.sport));
    matches = [...(local.matches || []), ...(feeds?.municipalities?.[municipality]?.matches || [])].filter(belongsToClub);
    render();
  }).catch(error => {
    console.error(error);
    root.innerHTML = `<div class="club-error"><strong>Föreningen kunde inte laddas</strong><p>Kontrollera länken eller gå tillbaka till lokalsporten.</p><a href="sport.html?kommun=${encodeURIComponent(municipality)}">Till sportsidan</a></div>`;
  });
})();
