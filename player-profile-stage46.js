/* DinPuls Sport – Sprint 4.6 spelarprofiler */
(() => {
  "use strict";
  const params=new URLSearchParams(location.search);
  const municipality=params.get("kommun")||"Åmål",clubName=params.get("klubb")||"",playerName=params.get("spelare")||"";
  const root=document.querySelector("#player-page");
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const finished=match=>["finished","final","ended"].includes(String(match.status||"").toLowerCase())||(Number.isFinite(Number(match.homeScore))&&Number.isFinite(Number(match.awayScore))&&new Date(match.startTime)<new Date());
  const identity=match=>String(match.id||[match.startTime,match.homeTeam,match.awayTeam].join("::"));
  const belongs=match=>[match.homeTeam,match.awayTeam].some(team=>String(team||"").toLocaleLowerCase("sv-SE").includes(clubName.toLocaleLowerCase("sv-SE"))||clubName.toLocaleLowerCase("sv-SE").includes(String(team||"").toLocaleLowerCase("sv-SE")));
  const playerLabel=item=>String(item?.name||item?.player||item?.fullName||"").trim();
  const samePlayer=item=>playerLabel(item).toLocaleLowerCase("sv-SE")===playerName.toLocaleLowerCase("sv-SE");
  const lineupsOf=match=>(match.lineups||match.rosters||[]).flatMap(team=>(team.players||team.lineup||[]).map(player=>({...player,team:player.team||team.team||team.name||""})));
  const date=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?"Datum saknas":d.toLocaleDateString("sv-SE",{weekday:"short",day:"numeric",month:"short"})};

  function locatePlayer(club,matches){
    const direct=(club.players||club.roster||[]).find(samePlayer);
    const lineup=matches.flatMap(lineupsOf).find(samePlayer);
    return {...(lineup||{}),...(direct||{}),name:playerName,club:clubName,municipality};
  }
  function calculatedStats(player,matches){
    const appearances=matches.filter(match=>lineupsOf(match).some(samePlayer)).length;
    const events=matches.flatMap(match=>match.events||match.timeline||[]).filter(event=>samePlayer(event));
    const goals=events.filter(event=>/goal|mål/i.test(String(event.type||event.description||event.text||""))).length;
    const assists=events.filter(event=>/assist/i.test(String(event.type||event.description||event.text||""))).length;
    const penalties=events.filter(event=>/penalty|utvis/i.test(String(event.type||event.description||event.text||""))).reduce((sum,event)=>sum+Number(event.minutes||event.penaltyMinutes||0),0);
    return {games:Number(player.games??player.matches??appearances)||0,goals:Number(player.goals??goals)||0,assists:Number(player.assists??assists)||0,penaltyMinutes:Number(player.penaltyMinutes??player.pim??penalties)||0};
  }
  function formFor(matches){
    return matches.filter(finished).sort((a,b)=>new Date(b.startTime)-new Date(a.startTime)).slice(0,5).map(match=>{
      const home=String(match.homeTeam||"").toLocaleLowerCase("sv-SE").includes(clubName.toLocaleLowerCase("sv-SE"));
      const own=Number(home?match.homeScore:match.awayScore),other=Number(home?match.awayScore:match.homeScore);
      return own>other?"V":own===other?"O":"F";
    });
  }
  function matchCard(match){
    const score=Number.isFinite(Number(match.homeScore))&&Number.isFinite(Number(match.awayScore))?`${match.homeScore}–${match.awayScore}`:"–";
    return `<a class="player-match-card" href="match.html?kommun=${encodeURIComponent(municipality)}&id=${encodeURIComponent(identity(match))}"><strong>${esc(match.homeTeam)} – ${esc(match.awayTeam)}</strong><span>${esc(date(match.startTime))}${match.venue?` · ${esc(match.venue)}`:""}</span><b>${esc(score)}</b></a>`;
  }
  function seasonRows(player,stats){
    const seasons=Array.isArray(player.seasons)&&player.seasons.length?player.seasons:[{season:player.season||"Aktuell säsong",club:clubName,...stats}];
    return seasons.map(row=>`<tr><td>${esc(row.season||"–")}</td><td>${esc(row.club||clubName)}</td><td>${esc(row.games??row.matches??0)}</td><td>${esc(row.goals??0)}</td><td>${esc(row.assists??0)}</td><td>${esc(row.penaltyMinutes??row.pim??0)}</td></tr>`).join("");
  }
  function render(club,matches){
    const player=locatePlayer(club,matches),stats=calculatedStats(player,matches),form=formFor(matches);
    const upcoming=matches.filter(match=>!finished(match)&&new Date(match.startTime)>=new Date()).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime)).slice(0,6);
    const previous=player.previousClubs||player.formerClubs||[];
    const initials=playerName.split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase();
    document.title=`${playerName} – ${clubName} – DinPuls`;
    document.querySelector("#player-back-link").href=`club.html?kommun=${encodeURIComponent(municipality)}&klubb=${encodeURIComponent(clubName)}`;
    root.innerHTML=`
      <section class="player-hero"><span class="player-avatar">${esc(initials||"?")}</span><div><span class="section-kicker">${esc(municipality)} · ${esc((club.sports||["Sport"])[0])}</span><h1>${esc(playerName)}</h1><p>${esc(player.position||player.role||"Spelare")} · <a href="club.html?kommun=${encodeURIComponent(municipality)}&klubb=${encodeURIComponent(clubName)}">${esc(clubName)}</a></p></div><span class="player-number">${player.number||player.jerseyNumber?`#${esc(player.number||player.jerseyNumber)}`:"–"}</span></section>
      <section class="player-partner"><small>Spelarpartner</small><strong>${esc(playerName)} presenteras av ditt företag</strong><a href="mailto:annonser@dinpuls.se?subject=${encodeURIComponent(`Spelarpartner ${playerName}, ${clubName}`)}">Boka spelarplatsen</a></section>
      <section class="player-stat-grid"><article><strong>${stats.games}</strong><span>Matcher</span></article><article><strong>${stats.goals}</strong><span>Mål</span></article><article><strong>${stats.assists}</strong><span>Assist</span></article><article><strong>${stats.goals+stats.assists}</strong><span>Poäng</span></article><article><strong>${stats.penaltyMinutes}</strong><span>Utvisningsmin.</span></article></section>
      <div class="player-layout"><div class="player-main">
        <section class="player-panel"><span class="section-kicker">Säsong för säsong</span><h2>Spelarstatistik</h2><table class="player-season-table"><thead><tr><th>Säsong</th><th>Klubb</th><th>Matcher</th><th>Mål</th><th>Assist</th><th>Utv.min</th></tr></thead><tbody>${seasonRows(player,stats)}</tbody></table></section>
        <section class="player-panel"><span class="section-kicker">Senaste lagmatcherna</span><h2>Form</h2>${form.length?`<div class="player-form">${form.map(result=>`<span class="${result==="V"?"win":result==="O"?"draw":"loss"}" title="${result==="V"?"Vinst":result==="O"?"Oavgjort":"Förlust"}">${result}</span>`).join("")}</div>`:`<div class="player-empty">Det finns ännu inte tillräckligt med resultat för att visa form.</div>`}</section>
        <section class="player-panel"><span class="section-kicker">Nästa tillfälle</span><h2>Kommande matcher</h2><div class="player-match-list">${upcoming.length?upcoming.map(matchCard).join(""):`<div class="player-empty">Ingen kommande match är inläst för laget.</div>`}</div></section>
      </div><aside class="player-aside">
        <section class="player-info-card"><span class="section-kicker">Profil</span><h2>Spelarinfo</h2><dl><div><dt>Klubb</dt><dd>${esc(clubName)}</dd></div><div><dt>Position</dt><dd>${esc(player.position||player.role||"Saknas")}</dd></div><div><dt>Tröjnummer</dt><dd>${esc(player.number||player.jerseyNumber||"Saknas")}</dd></div><div><dt>Född</dt><dd>${esc(player.birthYear||player.birthDate||"Saknas")}</dd></div></dl><a href="club.html?kommun=${encodeURIComponent(municipality)}&klubb=${encodeURIComponent(clubName)}">Öppna lagets sida <i data-lucide="arrow-right"></i></a></section>
        <section class="player-info-card"><span class="section-kicker">Karriär</span><h2>Tidigare klubbar</h2>${previous.length?`<ul>${previous.map(item=>`<li>${esc(typeof item==="string"?item:item.name)}</li>`).join("")}</ul>`:`<div class="player-empty">Tidigare klubbar finns inte i den anslutna källan.</div>`}</section>
        <p class="match-source-note">Spelaruppgifter visas endast när de finns i anslutna förenings- eller förbundskällor. DinPuls skapar aldrig påhittad statistik.</p>
      </aside></div>`;
    if(window.lucide)lucide.createIcons();
  }
  Promise.all([fetch(`data/sports.json?version=${Date.now()}`,{cache:"no-store"}).then(r=>r.json()),fetch(`data/sport-feeds.json?version=${Date.now()}`,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null)]).then(([data,feeds])=>{
    const local=data.municipalities?.[municipality];
    const normalizedClub=clubName.toLocaleLowerCase("sv-SE");
    const club=local?.clubs?.find(item=>item.name===clubName)||local?.clubs?.find(item=>item.name.toLocaleLowerCase("sv-SE").includes(normalizedClub)||normalizedClub.includes(item.name.toLocaleLowerCase("sv-SE")));
    if(!club||!playerName)throw new Error("Spelaren eller föreningen hittades inte");
    const matches=[...(local.matches||[]),...(feeds?.municipalities?.[municipality]?.matches||[])].filter(belongs);
    render(club,matches);
  }).catch(error=>{console.error(error);root.innerHTML=`<div class="player-error"><strong>Spelarprofilen kunde inte laddas</strong><p>Kontrollera länken eller återvänd till föreningssidan.</p><a href="club.html?kommun=${encodeURIComponent(municipality)}&klubb=${encodeURIComponent(clubName)}">Till föreningen</a></div>`});
})();
