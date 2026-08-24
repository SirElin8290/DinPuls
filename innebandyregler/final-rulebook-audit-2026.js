/* Final runtime consistency pass for VDK Regelgenerator 2026.
   Normerande källa: SIBF Regelhandbok 2026, giltig från 1 juli 2026.
   Syfte: säkerställa att samtliga laddade frågebanker använder 2026 års terminologi
   och att kända äldre regel-/testformuleringar inte kan återintroduceras av senare filer. */
(() => {
  "use strict";

  const pools = [
    window.VDK_QUESTIONS,
    window.VDK_ADVANCED_QUESTIONS,
    window.VDK_DEATH_QUESTIONS,
    window.VDK_DEVELOPMENT_QUESTIONS,
    window.VDK_DEVELOPMENT_LEGACY_QUESTIONS
  ].filter(Array.isArray);

  const clean = value => {
    if (typeof value !== "string") return value;
    return value
      .replace(/den klara målsituationen/gi, "målsituationen")
      .replace(/en klar målsituation/gi, "en målsituation")
      .replace(/klar målsituation/gi, "målsituation")
      .replace(/klara målsituationen/gi, "målsituationen")
      .replace(/målchans/gi, "målsituation")
      .replace(/målchansen/gi, "målsituationen");
  };

  const all = [];
  for (const pool of pools) {
    for (const q of pool) {
      if (!q || typeof q !== "object") continue;
      for (const key of ["q", "r", "e", "t", "s"]) q[key] = clean(q[key]);
      if (Array.isArray(q.a)) q.a = q.a.map(clean);
      if (Array.isArray(q.v)) q.v = q.v.map(clean);

      // 2026: efter fem inledande straffslag får vilken utespelare som helst slå
      // de extra straffslagen och samma spelare får slå flera extra straffslag.
      if (q.id === 61) {
        Object.assign(q, {
          q: "Efter de fem inledande straffslagen är ett straffslagsavgörande fortfarande oavgjort. Vem får utföra de extra straffslagen?",
          a: [
            "Vilken utespelare som helst; samma spelare får utföra flera extra straffslag",
            "Endast de fem spelare som utförde de inledande straffslagen, i samma ordning",
            "Samma spelare får inte slå igen förrän samtliga utespelare har utfört ett straffslag",
            "Endast lagkaptenen får utföra extra straffslag"
          ],
          x: 0,
          r: "Vilken utespelare som helst; samma spelare får utföra flera extra straffslag.",
          e: "Efter de fem inledande straffslagen får de extra straffslagen utföras av vilken utespelare som helst och samma spelare får utföra flera extra straffslag.",
          s: "Regel 204.1"
        });
      }

      q.audit2026 = {
        version: "2026-07-01",
        terminology: true,
        structure: Array.isArray(q.a) && q.a.length === 4 && Number.isInteger(q.x) && q.x >= 0 && q.x < q.a.length && typeof q.s === "string" && q.s.trim().length > 0
      };
      all.push(q);
    }
  }

  // Hårda spärrar mot de fel som tidigare hittats i banken.
  const errors = [];
  for (const q of all) {
    const text = [q.q, q.r, q.e, q.t, ...(q.a || []), ...(q.v || [])].filter(Boolean).join(" ");
    if (/klar målsituation|målchans/i.test(text)) errors.push(`${q.id}: äldre term för målsituation`);
    if (!q.audit2026.structure) errors.push(`${q.id}: ofullständig frågestruktur/facit`);
    if (/vårdslös/i.test(text) && /mindre lagstraff/i.test(text) && !/inte|fel|aldrig|motargument|alternativ/i.test(text)) {
      errors.push(`${q.id}: kontrollera vårdslöst mot större lagstraff`);
    }
  }

  window.VDK_RULEBOOK_AUDIT_2026 = {
    version: "2026-07-01",
    loadedQuestions: all.length,
    errors
  };

  if (errors.length) console.warn("VDK Regelgenerator 2026 – auditvarningar:", errors);
})();