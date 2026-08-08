(() => {
  "use strict";

  const municipalityState = window.DinPulsMunicipalityState;
  const params = new URLSearchParams(location.search);
  const TEAM_SPORTS = new Set(["Fotboll", "Futsal", "Innebandy", "Ishockey", "Bandy", "Handboll", "Basket"]);
  const RESULT_STATUSES = new Set(["finished", "final", "ended"]);
  let municipality = municipalityState.getInitial();
  let requestedSport = params.get("sport") || "all";
  let sportsData = null;
  let arenaData = null;
  let seasonData = null;
  let activeTab = "matches";
  let hideResults = localStorage.getItem("dinpuls-hide-sport-results") === "true";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const current = () => sportsData?.municipalities?.[municipality] || { clubs: [], liveSources: [], matches: [] };
  const seasons = () => seasonData?.municipalities?.[municipality] || [];
  const arenas = () => arenaData?.municipalities?.[municipality]?.arenas || [];
  const selectedSport = () => document.querySelector("#sport-hub-sport")?.value || "all";
  const identity = match => String(match.id || [match.startTime, match.homeTeam, match.awayTeam].join("::"));
  const validDate = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; };
  const dateTime = value => validDate(value)?.toLocaleString("sv-SE", { timeZone: "Europe/Stockholm", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) || "Tid saknas";
  const hasScore = match => match.homeScore !== null && match.homeScore !== undefined && match.homeScore !== "" && match.awayScore !== null && match.awayScore !== undefined && match.awayScore !== "" && Number.isFinite(Number(match.homeScore)) && Number.isFinite(Number(match.awayScore));
  const matchFinished = match => RESULT_STATUSES.has(String(match.status || "").toLowerCase()) || hasScore(match);
  const matchValid = match => {
    const home = String(match.homeTeam || "").trim();
    const away = String(match.awayTeam || "").trim();
    const forbidden = /round date|game result|spectators|venue|undefined|null/i;
    return home && away && home !== away && home.length <= 80 && away.length <= 80 && !forbidden.test(home) && !forbidden.test(away) && validDate(match.startTime);
  };

  function providersFor(sport) {
    const local = (current().liveSources || []).filter(source => source.sport === sport);
    const national = sportsData?.sportProviders?.[sport];
    if (national && !local.some(source => source.url === national.url)) {
      local.push({ sport, title: national.label, provider: national.provider, url: national.url, kind: TEAM_SPORTS.has(sport) ? "table" : "results" });
    }
    return local;
  }

  function sports() {
    const data = current();
    return [...new Set([
      ...(data.clubs || []).flatMap(club => club.sports || []),
      ...(data.matches || []).filter(matchValid).map(match => match.sport),
      ...seasons().map(item => item.sport),
      ...arenas().flatMap(arena => arena.sports || [])
    ].filter(Boolean))].sort((a, b) => a.localeCompare(b, "sv"));
  }

  function allMatches() {
    const now = Date.now();
    const oldest = now - 240 * 24 * 60 * 60 * 1000;
    const latest = now + 400 * 24 * 60 * 60 * 1000;
    const seasonMatches = seasons().filter(item => {
      const time = validDate(item.nextStart)?.getTime();
      return time && time > now - 12 * 60 * 60 * 1000;
    }).map(item => {
      const teams = String(item.nextMatch || "").split(/\s+[–-]\s+/);
      return {
        id: `season-${municipality}-${item.sport}-${item.nextStart}`,
        sport: item.sport,
        competition: item.competition,
        startTime: item.nextStart,
        status: "scheduled",
        homeTeam: teams[0],
        awayTeam: teams[1],
        venue: item.venue || "",
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        updatedAt: seasonData?.verifiedAt
      };
    });
    const unique = new Map([...(current().matches || []), ...seasonMatches].filter(matchValid).map(match => [identity(match), match]));
    const sport = selectedSport();
    return [...unique.values()].filter(match => {
      const time = validDate(match.startTime)?.getTime();
      return time >= oldest && time <= latest && (sport === "all" || match.sport === sport);
    }).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }

  const ad = position => `<a class="sport-hub-ad" href="mailto:annonser@dinpuls.se?subject=${encodeURIComponent(`Sportannons ${position}, ${municipality}`)}"><span><small>SPORTANNONS ${position}</small><strong>Ditt lokala företag här</strong><span>På DinPuls sportsida · 500 kr/mån</span></span></a>`;
  function pageWithAds(blocks, prefix = "") {
    let html = `${ad(1)}${prefix}`;
    blocks.forEach((block, index) => { html += block; if (index < 6) html += ad(index + 2); });
    for (let index = blocks.length; index < 6; index += 1) html += ad(index + 2);
    return `${html}${ad(8)}`;
  }

  function sourceButtons(sport) {
    return providersFor(sport).map(source => `<a class="sport-hub-source" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title || source.provider || "Officiell källa")} ↗</a>`).join("");
  }

  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll("[data-hub-tab]").forEach(button => {
      const active = button.dataset.hubTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    render();
  }

  function updateControls() {
    document.querySelector("#sport-hub-place").textContent = municipality;
    document.title = `Sportläget i ${municipality} – DinPuls`;
    const select = document.querySelector("#sport-hub-sport");
    const previous = select.value;
    const available = sports();
    select.innerHTML = `<option value="all">Alla sporter</option>${available.map(sport => `<option value="${esc(sport)}">${esc(sport)}</option>`).join("")}`;
    select.value = available.includes(previous) ? previous : (available.includes(requestedSport) ? requestedSport : "all");
    const button = document.querySelector("#sport-hub-spoiler");
    button.classList.toggle("active", hideResults);
    button.setAttribute("aria-pressed", String(hideResults));
    button.innerHTML = `<i data-lucide="${hideResults ? "eye" : "eye-off"}"></i><span>${hideResults ? "Visa resultat" : "Dölj resultat"}</span>`;
    document.body.classList.toggle("results-hidden", hideResults);
    const status = current().dataStatus || {};
    const checked = validDate(status.generatedAt || sportsData?.engine?.feedGeneratedAt || sportsData?.generatedAt);
    const stale = !checked || Date.now() - checked.getTime() > 24 * 60 * 60 * 1000;
    const automatic = (sportsData?.sourceHealth || []).filter(source => source.municipality === municipality && source.status === "ok").length;
    document.querySelector("#sport-hub-freshness").innerHTML = `<i data-lucide="${stale ? "clock-alert" : "shield-check"}"></i> ${checked ? `Kontrollerad ${checked.toLocaleString("sv-SE", { timeZone: "Europe/Stockholm", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Kontrolltid saknas"} · ${automatic ? `${automatic} automatiskt flöde` : "officiella direktlänkar"} · originalkällan gäller`;
  }

  function renderSummary() {
    const matches = allMatches();
    const now = Date.now();
    const finished = matches.filter(matchFinished);
    const upcoming = matches.filter(match => !matchFinished(match) && new Date(match.startTime).getTime() >= now);
    document.querySelector("#sport-hub-summary").innerHTML = `
      <article><i data-lucide="circle-check"></i><div><strong>${finished.length}</strong><span>inlästa resultat</span></div></article>
      <article><i data-lucide="calendar-days"></i><div><strong>${upcoming.length}</strong><span>kommande matcher</span></div></article>
      <article><i data-lucide="trophy"></i><div><strong>${sports().length}</strong><span>lokala sporter</span></div></article>
      <article><i data-lucide="users"></i><div><strong>${(current().clubs || []).length}</strong><span>föreningar</span></div></article>`;
  }

  function matchRow(match) {
    const finished = matchFinished(match);
    const score = finished && hasScore(match) ? `${match.homeScore}–${match.awayScore}` : (new Date(match.startTime) < new Date() ? "Resultat väntar" : "–");
    return `<article class="sport-hub-match"><time>${esc(dateTime(match.startTime))}</time><div><strong>${esc(match.homeTeam)} – ${esc(match.awayTeam)}</strong><small>${esc([match.competition, match.venue].filter(Boolean).join(" · "))}</small></div><span class="sport-hub-result">${esc(score)}</span>${match.sourceUrl ? `<a href="${esc(match.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Öppna originalkällan">↗</a>` : ""}</article>`;
  }

  function sportDirectory(items = sports()) {
    const data = current();
    if (!items.length) return "";
    return `<section class="sport-hub-directory"><header><span class="section-kicker">Hela kommunens sportliv</span><h2>Alla sporter i ${esc(municipality)}</h2><p>Välj en sport för lokala föreningar, matcher, tävlingar och officiella resultat.</p></header><div class="sport-hub-directory-grid">${items.map(sport => {
      const clubs = (data.clubs || []).filter(club => (club.sports || []).includes(sport));
      const count = allMatches().filter(match => match.sport === sport).length;
      return `<button type="button" data-select-sport="${esc(sport)}"><i data-lucide="medal"></i><span><strong>${esc(sport)}</strong><small>${clubs.length} ${clubs.length === 1 ? "förening" : "föreningar"}${count ? ` · ${count} matcher/resultat` : ""}</small></span><i data-lucide="chevron-right"></i></button>`;
    }).join("")}</div></section>`;
  }

  function seasonCards() {
    const selected = selectedSport();
    const items = seasons().filter(item => selected === "all" || item.sport === selected);
    if (!items.length) return "";
    return `<section class="sport-hub-season-overview"><header><span class="section-kicker">Säsongsläge</span><h2>Aktivt och på väg att starta</h2><p>Öppna alltid originalkällan för senast publicerade spelschema.</p></header><div class="sport-hub-season-grid">${items.map(item => {
      const next = validDate(item.nextStart) && new Date(item.nextStart) > new Date() ? `<b>${esc(dateTime(item.nextStart))}: ${esc(item.nextMatch)}</b>` : "";
      return `<a class="sport-hub-season ${esc(item.status)}" href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer"><i data-lucide="${item.status === "active" ? "activity" : "calendar-clock"}"></i><span><small>${esc(item.sport)} · ${esc(item.team)}</small><strong>${esc(item.statusLabel)}</strong><span>${esc(item.competition)}</span>${next}</span><em>Officiell källa ↗</em></a>`;
    }).join("")}</div></section>`;
  }

  function renderMatches() {
    const selected = selectedSport();
    const matches = allMatches();
    const detailedSports = (selected === "all" ? sports().filter(sport => matches.some(match => match.sport === sport) || seasons().some(item => item.sport === sport)) : [selected]).filter(Boolean);
    const sections = detailedSports.map(sport => {
      const clubs = (current().clubs || []).filter(club => (club.sports || []).includes(sport));
      const sportMatches = matches.filter(match => match.sport === sport);
      const upcoming = sportMatches.filter(match => !matchFinished(match) && new Date(match.startTime) >= new Date()).slice(0, 10);
      const played = sportMatches.filter(match => matchFinished(match) || new Date(match.startTime) < new Date()).sort((a, b) => new Date(b.startTime) - new Date(a.startTime)).slice(0, 10);
      return `<section class="sport-hub-section"><header class="sport-hub-section-head"><div><span class="section-kicker">${esc(sport)}</span><h2>${esc(sport)} i ${esc(municipality)}</h2><p>${clubs.map(club => esc(club.name)).join(" · ") || "Lokal verksamhet"}</p></div><div class="sport-hub-source-stack">${sourceButtons(sport)}</div></header>${upcoming.length ? `<h3 class="sport-hub-subtitle">Kommande matcher eller tävlingar</h3><div class="sport-hub-match-list">${upcoming.map(matchRow).join("")}</div>` : ""}${played.length ? `<h3 class="sport-hub-subtitle">Spelade matcher och resultat</h3><div class="sport-hub-match-list">${played.map(matchRow).join("")}</div>` : ""}${!sportMatches.length ? `<div class="sport-hub-empty"><span><strong>Ingen stabil automatisk resultatkälla är ansluten ännu</strong><br>Sporten och föreningarna finns med. Använd länkarna ovan för aktuellt spelschema, tävlingskalender eller resultat.</span></div>` : ""}</section>`;
    });
    return pageWithAds(sections, `${selected === "all" ? sportDirectory() : ""}${seasonCards()}`);
  }

  function renderTables() {
    const selected = selectedSport();
    const items = (selected === "all" ? sports() : [selected]).filter(Boolean);
    const blocks = [];
    for (let index = 0; index < items.length; index += 6) {
      blocks.push(`<section class="sport-hub-section"><div class="sport-hub-result-grid">${items.slice(index, index + 6).map(sport => {
        const provider = sportsData?.sportProviders?.[sport];
        const local = providersFor(sport);
        const primary = local[0] || provider;
        const label = TEAM_SPORTS.has(sport) ? "Tabell, matcher och resultat" : "Tävlingskalender och resultat";
        return `<article class="sport-hub-result-card"><span class="section-kicker">${esc(sport)}</span><h3>${esc(label)}</h3><p>${TEAM_SPORTS.has(sport) ? "Placering och poäng visas hos ansvarigt förbund så att tabellen alltid är aktuell." : "Individuella sporter hänvisar till officiell kalender, resultatlista eller ranking."}</p>${primary ? `<a href="${esc(primary.url)}" target="_blank" rel="noopener noreferrer">Öppna ${esc(primary.provider || "officiell källa")} ↗</a>` : ""}</article>`;
      }).join("")}</div></section>`);
    }
    return pageWithAds(blocks);
  }

  function renderClubs() {
    const selected = selectedSport();
    const items = (selected === "all" ? sports() : [selected]).filter(Boolean);
    const blocks = items.map(sport => {
      const clubs = (current().clubs || []).filter(club => (club.sports || []).includes(sport));
      return `<section class="sport-hub-section"><header class="sport-hub-section-head"><div><span class="section-kicker">${esc(sport)}</span><h2>Föreningar och källor</h2></div><div class="sport-hub-source-stack">${sourceButtons(sport)}</div></header><div class="sport-hub-club-grid">${clubs.map(club => `<a href="${esc(club.url)}" target="_blank" rel="noopener noreferrer"><i data-lucide="shield"></i><span><strong>${esc(club.name)}</strong><small>${esc(club.source || "Föreningen")}</small></span><i data-lucide="external-link"></i></a>`).join("") || `<div class="sport-hub-empty"><span>Ingen namngiven förening har verifierats ännu.</span></div>`}</div></section>`;
    });
    const directory = current().directoryUrl ? `<section class="sport-hub-register"><span><strong>Saknas din förening?</strong><br>Kontrollera kommunens föreningsregister eller tipsa DinPuls.</span><a href="${esc(current().directoryUrl)}" target="_blank" rel="noopener noreferrer">Kommunens föreningsregister ↗</a></section>` : "";
    return pageWithAds(blocks, directory);
  }

  function cardsFor(list, matches) {
    return list.map(arena => {
      const names = [arena.name, ...(arena.aliases || [])].map(name => name.toLocaleLowerCase("sv-SE"));
      const count = matches.filter(match => { const venue = String(match.venue || "").toLocaleLowerCase("sv-SE"); return venue && names.some(name => venue.includes(name) || name.includes(venue)); }).length;
      const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${arena.name}, ${arena.address || municipality}`)}`;
      return `<article class="sport-hub-arena"><span class="section-kicker">${esc(arena.type)}</span><h3>${esc(arena.name)}</h3><p>${esc((arena.sports || []).join(" · "))}</p><p><strong>Adress:</strong> ${esc(arena.address || municipality)}</p>${arena.phone ? `<p><strong>Telefon:</strong> <a href="tel:${esc(arena.phone)}">${esc(arena.phone)}</a></p>` : ""}<p>${count} inlästa matcher på anläggningen</p><div class="sport-hub-arena-links"><a href="${map}" target="_blank" rel="noopener noreferrer">Hitta hit ↗</a><a href="${esc(arena.sourceUrl)}" target="_blank" rel="noopener noreferrer">Officiell information ↗</a></div></article>`;
    }).join("");
  }

  function renderArenas() {
    const selected = selectedSport();
    const list = arenas().filter(arena => selected === "all" || (arena.sports || []).includes(selected));
    const blocks = [];
    for (let index = 0; index < list.length; index += 4) blocks.push(`<section class="sport-hub-section"><div class="sport-hub-arena-grid">${cardsFor(list.slice(index, index + 4), allMatches())}</div></section>`);
    if (!blocks.length) blocks.push(`<section class="sport-hub-section"><div class="sport-hub-empty"><span><strong>Ingen särskild anläggning registrerad för urvalet</strong><br>Kontrollera föreningens eller kommunens sida för tränings- och tävlingsplats.</span></div></section>`);
    return pageWithAds(blocks);
  }

  function attachDynamicEvents() {
    document.querySelectorAll("[data-select-sport]").forEach(button => button.addEventListener("click", () => {
      const select = document.querySelector("#sport-hub-sport");
      select.value = button.dataset.selectSport;
      select.dispatchEvent(new Event("change"));
      document.querySelector(".sport-hub-toolbar")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  function render() {
    updateControls();
    renderSummary();
    const renderers = { matches: renderMatches, tables: renderTables, clubs: renderClubs, arenas: renderArenas };
    document.querySelector("#sport-hub-view").innerHTML = (renderers[activeTab] || renderMatches)();
    attachDynamicEvents();
    if (window.lucide) lucide.createIcons();
  }

  async function init() {
    const [sportsResponse, arenaResponse, seasonResponse] = await Promise.all([
      fetch(`data/sports.json`, { cache: "no-cache" }),
      fetch(`data/arenas.json`, { cache: "no-cache" }),
      fetch(`data/sport-seasons.json`, { cache: "no-cache" })
    ]);
    if (!sportsResponse.ok || !arenaResponse.ok || !seasonResponse.ok) throw new Error("Sportdata kunde inte laddas");
    sportsData = await sportsResponse.json();
    arenaData = await arenaResponse.json();
    seasonData = await seasonResponse.json();
    const municipalitySelect = document.querySelector("#sport-hub-municipality");
    municipalityState.populateSelect(municipalitySelect, municipality);
    municipalitySelect.addEventListener("change", () => {
      municipality = municipalityState.set(municipalitySelect.value);
      const url = new URL(location.href);
      url.searchParams.set("kommun", municipality);
      selectedSport() === "all" ? url.searchParams.delete("sport") : url.searchParams.set("sport", selectedSport());
      history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
      requestedSport = "all";
      render();
    });
    document.querySelector("#sport-hub-sport").addEventListener("change", event => {
      const url = new URL(location.href);
      url.searchParams.set("kommun", municipality);
      event.target.value === "all" ? url.searchParams.delete("sport") : url.searchParams.set("sport", event.target.value);
      history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
      render();
    });
    document.querySelector("#sport-hub-spoiler").addEventListener("click", () => {
      hideResults = !hideResults;
      localStorage.setItem("dinpuls-hide-sport-results", String(hideResults));
      render();
    });
    document.querySelectorAll("[data-hub-tab]").forEach(button => button.addEventListener("click", () => setTab(button.dataset.hubTab)));
    render();
  }

  init().catch(error => {
    console.error(error);
    document.querySelector("#sport-hub-view").innerHTML = '<div class="sport-hub-loading">Sportläget kunde inte laddas. Försök igen om en stund.</div>';
  });
})();
