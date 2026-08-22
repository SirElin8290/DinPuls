(() => {
  "use strict";
  const bank = window.VDK_QUESTIONS;
  if (!Array.isArray(bank)) return;
  const patch = (id, data) => { const q = bank.find(x => x.id === id); if (q) Object.assign(q, data); };

  // Endast Svenska IBF:s Regelhandbok 2026, giltig från 1 juli 2026, är normerande.
  // Ingen äldre regelbok eller testregel får användas som facit.
  patch(54,{s:"Regel 401.1"});

  patch(58,{
    q:"Målvakten kastar bollen. Den studsar i golvet på egen planhalva innan den passerar mittlinjen och går därefter direkt i motståndarnas mål. Ingen annan förseelse sker. Domslut?",
    a:["Mål","Frislag för felaktigt utkast","Tekning","Inte mål eftersom målvakten kastade bollen"],x:0,
    r:"Mål.",
    e:"Mål kan göras efter att bollen kastats av målvakten, men utkastet får inte passera mittlinjen direkt. Här har bollen först rört golvet på egen planhalva, så utkastet är korrekt och målet kan godkännas.",
    s:"Regel 507.14 och 702.1",t:"Läs hela bollbanan. Ett direkt utkast över mittlinjen är frislag; en tillåten beröring före mittlinjen ändrar bedömningen."
  });

  patch(60,{
    q:"Ett skott lämnar klubban före slutsignalen men hela bollen passerar mållinjen först efter att slutsignalen har börjat ljuda. Domslut?",
    a:["Inte mål","Mål eftersom skottet avlossades före signalen","Mål om mindre än en sekund skiljer","Domarna avgör efter fördel"],x:0,
    r:"Inte mål.",
    e:"Perioden eller matchen är slut omedelbart när slutsignalen börjar ljuda. Det avgörande är därför om hela bollen passerat mållinjen innan signalen började.",
    s:"Regel 201.1 och 703",t:"Det avgörande är när bollen passerar mållinjen, inte när skottet lämnar klubban."
  });

  patch(61,{
    q:"Efter de fem inledande straffslagen är ett straffslagsavgörande fortfarande oavgjort. Vem får slå lagets extra straffslag?",
    a:["Vilken utespelare som helst; samma spelare får slå flera extra straffslag","Endast de fem första skyttarna i samma ordning","En spelare får inte slå igen förrän alla noterade utespelare har slagit","Endast lagkaptenen får välja bland de fem första skyttarna"],x:0,
    r:"Vilken utespelare som helst; samma spelare får slå flera extra straffslag.",
    e:"Regel 204 anger att fem olika utespelare slår de fem inledande straffarna. Om avgörandet därefter fortsätter kan de extra straffslagen slås av vilken utespelare som helst och en spelare får slå flera straffar.",
    s:"Regel 204.1",t:"2026-regeln har inget krav på en förhandsinlämnad skyttelista eller fast ordning för de extra straffarna."
  });

  patch(64,{s:"Regel 306.1 samt 608"});

  patch(126,{
    q:"Målvakten kastar bollen så att den först träffar en motståndare på egen planhalva. Bollen fortsätter därefter över mittlinjen och går direkt i motståndarnas mål. Ingen förseelse sker. Domslut?",
    a:["Mål","Frislag för felaktigt utkast","Tekning","Inte mål eftersom målvakten kastade bollen"],x:0,
    r:"Mål.",
    e:"Begränsningen i 507.14 gäller när hela bollen passerar mittlinjen utan att först röra golv, sarg, spelare eller utrustning. Här har bollen rört en spelare före mittlinjen och utkastet är därför korrekt.",
    s:"Regel 507.14 och 702.1",t:"Målvaktens kast kan leda till mål, men bara om utkastet i sig är korrekt."
  });

  // Teknisk integritetskontroll. Detta betyder INTE att regelinnehållet är verifierat;
  // endast att frågan har fyra svar, giltigt facitindex och angiven regelkälla.
  bank.forEach(q => {
    q.auditStructure2026 = Array.isArray(q.a) && q.a.length === 4 && Number.isInteger(q.x) && q.x >= 0 && q.x < q.a.length && typeof q.s === "string" && q.s.trim().length > 0;
    delete q.audit2026;
  });
})();