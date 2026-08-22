(() => {
  "use strict";

  const questions = () => window.VDK_QUESTIONS || [];
  const ADVANCED_CATEGORIES = new Set(["Matchstraff","Straffslag","Straffslagsavgörande","Ledare och personliga straff","Klubbförseelser","Målvaktsområdet","Målvakt","Utvisningar","Mål"]);

  function difficulty(q) {
    if (q.level) return q.level;
    if (q.n || ADVANCED_CATEGORIES.has(q.c)) return "advanced";
    return "development";
  }

  function poolFor(level) {
    const all = questions();
    if (level === "development") return all.filter(q => difficulty(q) === "development");
    if (level === "advanced") return all.filter(q => difficulty(q) === "advanced");
    return all;
  }

  function shuffle(items) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function chooseBalanced(level, count = 20) {
    let pool = poolFor(level);
    if (level === "hybrid") {
      const dev = shuffle(poolFor("development")).slice(0, 10);
      const adv = shuffle(poolFor("advanced")).slice(0, 10);
      pool = [...dev, ...adv];
    }
    const byCategory = new Map();
    shuffle(pool).forEach(q => {
      if (!byCategory.has(q.c)) byCategory.set(q.c, []);
      byCategory.get(q.c).push(q);
    });
    const selected = [];
    const categories = shuffle([...byCategory.keys()]);
    while (selected.length < count && categories.some(c => byCategory.get(c).length)) {
      for (const category of categories) {
        const bucket = byCategory.get(category);
        if (bucket.length && selected.length < count) selected.push(bucket.pop());
      }
    }
    if (selected.length < count) {
      const used = new Set(selected.map(q => q.id));
      selected.push(...shuffle(pool).filter(q => !used.has(q.id)).slice(0, count - selected.length));
    }
    return shuffle(selected).slice(0, count);
  }

  function levelLabel(level) {
    return level === "development" ? "Utveckling" : level === "advanced" ? "Avancerad" : "Hybrid";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>\"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  }

  function generatePrintableTest(level) {
    const picked = chooseBalanced(level, 20);
    if (picked.length < 20) {
      alert("Frågebanken innehåller ännu inte 20 frågor för den valda nivån.");
      return;
    }
    const testId = `VDK-2026-${level.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const rows = picked.map((q, index) => {
      const answers = q.a.map((answer, ai) => `<div class="answer"><span>${String.fromCharCode(65 + ai)}.</span> ${escapeHtml(answer)}</div>`).join("");
      return `<article class="question"><h3>${index + 1}. ${escapeHtml(q.q)}</h3>${answers}</article>`;
    }).join("");
    const key = picked.map((q, i) => `<tr><td>${i + 1}</td><td>${String.fromCharCode(65 + q.x)}</td><td>${escapeHtml(q.s)}</td></tr>`).join("");
    const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><title>VDK Regelprov – ${levelLabel(level)}</title><style>
      @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;font-size:11pt}header{border-bottom:3px solid #111;padding-bottom:10px;margin-bottom:16px}h1{font-size:22pt;margin:0 0 4px}header p{margin:3px 0}.fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}.field{border-bottom:1px solid #333;height:28px}.question{break-inside:avoid;margin:0 0 15px}.question h3{font-size:11pt;line-height:1.35;margin:0 0 6px}.answer{margin:3px 0 3px 10px}.answer span{display:inline-block;width:22px;font-weight:bold}.footer-note{margin-top:20px;font-size:9pt;color:#555}.screen-actions{position:fixed;right:16px;top:16px;display:flex;gap:8px}.screen-actions button{padding:10px 14px;font-weight:bold}.answer-key{page-break-before:always}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:6px;text-align:left}@media print{.screen-actions{display:none}.answer-key{display:none}}@media screen{body{max-width:900px;margin:30px auto;padding:20px}.answer-key{display:block}}
    </style></head><body><div class="screen-actions"><button onclick="window.print()">Skriv ut / Spara som PDF</button><button onclick="document.querySelector('.answer-key').style.display='block';window.print()">Skriv ut facit</button></div><header><h1>VDK Regelprov 2026</h1><p><strong>Nivå:</strong> ${levelLabel(level)} · <strong>20 frågor</strong></p><p><strong>Prov-ID:</strong> ${testId}</p></header><div class="fields"><div>Namn:<div class="field"></div></div><div>Datum:<div class="field"></div></div><div>Distrikt/förening:<div class="field"></div></div><div>Resultat: ____ / 20<div class="field"></div></div></div>${rows}<p class="footer-note">Tränings- och provmaterial från Värmlands Domarkollektiv. Regelhandboken 2026 är styrande vid tveksamhet.</p><section class="answer-key"><h1>Facit – ${levelLabel(level)}</h1><p>Prov-ID: ${testId}</p><table><thead><tr><th>Fråga</th><th>Rätt svar</th><th>Regel</th></tr></thead><tbody>${key}</tbody></table></section></body></html>`;
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) { alert("Tillåt popup-fönster för att generera regelprovet."); return; }
    win.document.open(); win.document.write(html); win.document.close();
  }

  function addLevelAndPrintUI() {
    const modeGrid = document.querySelector(".mode-grid");
    if (!modeGrid || document.querySelector("[data-vdk-level-tools]")) return;
    const section = document.createElement("section");
    section.dataset.vdkLevelTools = "true";
    section.className = "mode-section";
    section.innerHTML = `<div class="section-heading"><div><span class="eyebrow">NIVÅ & REGELPROV</span><h2>Träna på rätt nivå</h2></div><p>Utveckling ger tydligare scenarier. Avancerad prioriterar svårare bedömningar och curve balls.</p></div><div class="mode-grid"><button class="mode-card white" data-vdk-train="development"><span class="mode-icon">1</span><span class="tag">UTVECKLING</span><h3>Utvecklingsläge</h3><p>Tydliga matchsituationer för nya och utvecklande domare.</p><span class="card-link">Starta utveckling →</span></button><button class="mode-card dark" data-vdk-train="advanced"><span class="mode-icon">★</span><span class="tag">AVANCERAD</span><h3>Avancerat läge</h3><p>Mer komplexa situationer, fler detaljer och högre krav på regelbedömningen.</p><span class="card-link">Starta avancerat →</span></button><button class="mode-card yellow" data-vdk-print><span class="mode-icon">▤</span><span class="tag">20 FRÅGOR</span><h3>Generera regelprov</h3><p>Skapa ett slumpat utskriftsprov för Utveckling, Hybrid eller Avancerad.</p><span class="card-link">Välj provnivå →</span></button></div>`;
    modeGrid.closest(".mode-section").after(section);

    section.querySelectorAll("[data-vdk-train]").forEach(btn => btn.addEventListener("click", () => {
      const level = btn.dataset.vdkTrain;
      window.VDK_ACTIVE_LEVEL = level;
      const original = window.VDK_QUESTIONS;
      window.VDK_QUESTIONS = poolFor(level);
      const trigger = document.querySelector('[data-start-mode="training"]');
      trigger?.click();
      setTimeout(() => { window.VDK_QUESTIONS = original; }, 0);
    }));

    section.querySelector("[data-vdk-print]")?.addEventListener("click", () => {
      const choice = prompt("Välj provnivå: 1 = Utveckling, 2 = Hybrid, 3 = Avancerad", "2");
      if (!choice) return;
      generatePrintableTest(choice === "1" ? "development" : choice === "3" ? "advanced" : "hybrid");
    });
  }

  window.VDK_LEVELS = { difficulty, poolFor, generatePrintableTest };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addLevelAndPrintUI, { once:true }); else addLevelAndPrintUI();
})();
