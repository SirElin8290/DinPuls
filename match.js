(() => {
  const params=new URLSearchParams(location.search),municipality=params.get("kommun")||"Åmål",id=params.get("id")||"";
  const root=document.querySelector("#match-page"),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const identity=m=>String(m.id||[m.startTime,m.homeTeam,m.awayTeam].join("::"));
  const scoreKnown=m=>Number.isFinite(Number(m.homeScore))&&Number.isFinite(Number(m.awayScore));
  const statusText=m=>{const s=String(m.status||"scheduled").toLowerCase();if(["live","inprogress","playing"].includes(s))return `Live${m.clock?` · ${m.clock}`:""}`;if(["finished","final","ended"].includes(s))return "Slut";if(s==="postponed")return "Uppskjuten";if(["cancelled","canceled"].includes(s))return "Inställd";return "Kommande"};
  const dateTime=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"Tid saknas":d.toLocaleString("sv-SE",{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})};
  const list=(items,empty)=>items?.length?`<div class="match-list">${items.map(item=>`<article><time>${esc(item.time||item.clock||"")}</time><span>${esc(item.text||item.description||item.player||item.team||"")}</span><strong>${esc(item.score||item.type||"")}</strong></article>`).join("")}</div>`:`<div class="match-empty">${empty}</div>`;
  function render(match){
    const periods=match.periods||match.periodScores||[],events=match.events||match.timeline||[],lineups=match.lineups||match.rosters||[];
    document.title=`${match.homeTeam} – ${match.awayTeam} – DinPuls`;
    document.querySelector("#match-back-link").href=`sport.html?kommun=${encodeURIComponent(municipality)}`;
    root.innerHTML=`
      <section class="match-hero">
        <div class="match-hero-meta"><span><i data-lucide="trophy"></i>${esc(match.sport||"Sport")}</span><span>${esc(match.competition||match.series||"")}</span></div>
        <div class="match-status-line"><span><i data-lucide="clock-3"></i>${esc(statusText(match))}</span><span>${esc(dateTime(match.startTime))}</span></div>
        <div class="match-scoreboard"><div class="match-team"><small>HEMMA</small><strong>${esc(match.homeTeam||"Hemmalag")}</strong></div><div class="match-score">${scoreKnown(match)?`${esc(match.homeScore)}–${esc(match.awayScore)}`:"–"}<small>${esc(statusText(match))}</small></div><div class="match-team"><small>BORTA</small><strong>${esc(match.awayTeam||"Bortalag")}</strong></div></div>
        <div class="match-actions"><button type="button" id="match-calendar"><i data-lucide="calendar-plus"></i>Lägg i kalender</button>${match.sourceUrl||match.url?`<a href="${esc(match.sourceUrl||match.url)}" target="_blank" rel="noopener noreferrer">Officiell matchinfo <i data-lucide="arrow-up-right"></i></a>`:""}</div>
      </section>
      <div class="match-layout"><div>
        <section class="match-panel"><h2>Matchdetaljer</h2><dl class="match-info-grid"><div><dt>Arena</dt><dd>${esc(match.venue||"Saknas")}</dd></div><div><dt>Domare</dt><dd>${esc(Array.isArray(match.referees)?match.referees.join(", "):match.referee||"Saknas")}</dd></div><div><dt>Publik</dt><dd>${esc(match.attendance??"Saknas")}</dd></div><div><dt>Källa</dt><dd>${esc(match.sourceName||match.provider||"Officiell källa")}</dd></div></dl></section>
        <section class="match-panel"><h2>Perioder och set</h2>${periods.length?`<div class="match-list">${periods.map((p,i)=>`<article><time>${esc(p.name||p.period||`Period ${i+1}`)}</time><span>${esc(p.homeScore??p.home??"")}–${esc(p.awayScore??p.away??"")}</span><strong>${esc(p.status||"")}</strong></article>`).join("")}</div>`:`<div class="match-empty">Period- eller setresultat finns inte i källan ännu.</div>`}</section>
        <section class="match-panel"><h2>Matchhändelser</h2>${list(events,"Mål, utvisningar och andra händelser finns inte i källan ännu.")}</section>
      </div><aside>
        <section class="match-panel"><h2>Laguppställningar</h2>${lineups.length?lineups.map(team=>`<h3>${esc(team.team||team.name||"")}</h3>${list(team.players||team.lineup||[],"Ingen trupp tillgänglig.")}`).join(""):`<div class="match-empty">Laguppställningar finns inte i källan ännu.</div>`}</section>
        <section class="match-sponsor"><small>Matchpartner</small><strong>Presentera den här lokala matchen</strong><a href="mailto:annonser@dinpuls.se?subject=${encodeURIComponent(`Matchpartner ${match.homeTeam} - ${match.awayTeam}`)}">Boka annonsplats</a></section>
        <p class="match-source-note">DinPuls visar endast information som finns i anslutna källor. Originalkällan gäller alltid.</p>
      </aside></div>`;
    document.querySelector("#match-calendar")?.addEventListener("click",()=>downloadCalendar(match));if(window.lucide)lucide.createIcons();
  }
  function downloadCalendar(m){const start=new Date(m.startTime);if(Number.isNaN(start.getTime()))return;const end=new Date(m.endTime||start.getTime()+7200000),stamp=d=>d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z"),clean=v=>String(v||"").replace(/[\\,;]/g,c=>`\\${c}`).replace(/\n/g,"\\n"),ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//DinPuls//Lokalsport//SV","BEGIN:VEVENT",`UID:${clean(identity(m))}@dinpuls.se`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${clean(`${m.homeTeam} – ${m.awayTeam}`)}`,`LOCATION:${clean(m.venue)}`,"END:VEVENT","END:VCALENDAR"].join("\r\n"),blob=new Blob([ics],{type:"text/calendar;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="dinpuls-match.ics";a.click();URL.revokeObjectURL(a.href)}
  Promise.all([fetch(`data/sports.json?version=${Date.now()}`,{cache:"no-store"}).then(r=>r.json()),fetch(`data/sport-feeds.json?version=${Date.now()}`,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null)]).then(([data,feeds])=>{const matches=[...(data.municipalities?.[municipality]?.matches||[]),...(feeds?.municipalities?.[municipality]?.matches||[])],match=matches.find(m=>identity(m)===id);if(!match)throw new Error("Matchen hittades inte");render(match)}).catch(error=>{console.error(error);root.innerHTML=`<div class="match-error"><strong>Matchen kunde inte laddas</strong><p>Matchen saknas eller har fått en ny identifierare.</p><a href="sport.html?kommun=${encodeURIComponent(municipality)}">Till lokalsporten</a></div>`});
})();