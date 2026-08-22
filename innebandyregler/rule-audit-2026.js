(() => {
  "use strict";
  const bank = window.VDK_QUESTIONS;
  if (!Array.isArray(bank)) return;
  const patch = (id, data) => { const q = bank.find(x => x.id === id); if (q) Object.assign(q, data); };

  // Korrigeringar efter kontroll mot Svenska IBF:s Regelhandbok 2026.
  patch(54,{s:"Regel 401.1"});

  patch(58,{
    q:"Målvakten kastar bollen. Den studsar i golvet på egen planhalva innan den passerar mittlinjen och går därefter direkt i motståndarnas mål. Ingen annan förseelse sker. Domslut?",
    a:["Mål","Frislag för felaktigt utkast","Tekning","Inte mål eftersom målvakten kastade bollen"],x:0,
    r:"Mål.",
    e:"Mål kan göras efter att bollen kastats av målvakten, men utkastet får inte passera mittlinjen direkt. Här har bollen först rört golvet på egen planhalva, så 507.14 är uppfylld och målet kan godkännas enligt 702.1.",
    s:"Regel 507.14 och 702.1",t:"Läs hela bollbanan. Ett direkt utkast över mittlinjen är frislag; en tillåten beröring före mittlinjen ändrar bedömningen."
  });

  patch(60,{
    q:"Ett skott lämnar klubban före slutsignalen men hela bollen passerar mållinjen först efter att slutsignalen har börjat ljuda. Domslut?",
    a:["Inte mål","Mål eftersom skottet avlossades före signalen","Mål om mindre än en sekund skiljer","Domarna avgör efter fördel"],x:0,
    r:"Inte mål.",
    e:"Perioden eller matchen är slut när slutsignalen börjar ljuda. Ett mål är felaktigt om bollen passerar mållinjen under eller efter signalen.",
    s:"Regel 201.1 och 703",t:"Det avgörande är när bollen passerar mållinjen, inte när skottet lämnar klubban."
  });

  patch(61,{
    q:"Inför de fem inledande straffarna i ett straffslagsavgörande: vad ska lagkaptenen eller en ledare göra?",
    a:["Skriftligen lämna numren på skyttarna och ordningen till domarna och sekretariatet","Ingenting; skyttarna behöver inte anges i förväg","Endast lämna fem namn utan ordning","Muntligen ange första skytten"],x:0,
    r:"Nummer och ordning ska lämnas skriftligen.",
    e:"Fem olika utespelare ska slå de inledande straffarna. Lagkaptenen eller en ledare ska skriftligen informera domarna och sekretariatet om spelarnas nummer och i vilken ordning de ska slå.",
    s:"Regel 204.1",t:"Detta var fel i den tidigare frågebanken och är nu korrigerat mot 2026-boken."
  });

  patch(64,{s:"Regel 306.1 samt 608"});

  patch(126,{
    q:"Målvakten kastar bollen så att den först träffar en motståndare på egen planhalva. Bollen fortsätter därefter över mittlinjen och går direkt i motståndarnas mål. Ingen förseelse sker. Domslut?",
    a:["Mål","Frislag för felaktigt utkast","Tekning","Inte mål eftersom målvakten kastade bollen"],x:0,
    r:"Mål.",
    e:"Begränsningen i 507.14 gäller när hela bollen passerar mittlinjen utan att först röra golv, sarg, spelare eller utrustning. Här har bollen rört en spelare före mittlinjen. Ett mål får göras efter att bollen kastats av målvakten om ingen förseelse föregår målet.",
    s:"Regel 507.14 och 702.1",t:"Målvaktens kast kan leda till mål, men bara om utkastet i sig är korrekt."
  });

  // Spårbarhetsmarkör för den granskade banken. Frågor ska alltid ha fyra svar,
  // ett giltigt facitindex och en uttrycklig regelkälla.
  bank.forEach(q => {
    q.audit2026 = Array.isArray(q.a) && q.a.length === 4 && Number.isInteger(q.x) && q.x >= 0 && q.x < q.a.length && typeof q.s === "string" && q.s.trim().length > 0;
  });
})();