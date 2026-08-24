(() => {
  "use strict";
  const bank = window.VDK_QUESTIONS;
  if (!Array.isArray(bank)) return;
  const add = q => { if (!bank.some(x => x && x.id === q.id)) bank.push(q); };

  add({
    id:9026, level:"death", c:"Death Mode", n:true,
    q:"Det återstår 1.12 av tredje perioden. Röd leder med 4–3 och Blå har frislag i anfallszon. Innan frislaget hinner utföras begär Blås lagkapten att domarna kontrollerar hooken på Röd 8:s klubba. Röd 8 befinner sig på spelplanen. Domarna bedömer samtidigt att en omedelbar kontroll skulle påverka Blås spelsituation negativt eftersom Blå vill utföra frislaget snabbt. Domarna meddelar därför att kontrollen kommer att genomföras vid nästa avblåsning och låter Blå utföra frislaget. Spelet fortsätter i cirka tio sekunder. Blå skjuter, Röd målvakt räddar och bollen går över sargen. Innan inslaget utförs går Röd 8 självmant till byteszonen och byter klubba. Blås lagkapten påpekar att det är den tidigare klubban som begäran avsåg. Röd hävdar att kontrollen inte längre kan genomföras eftersom spelaren nu har en annan klubba. Hur ska domarna hantera hela situationen?",
    a:[
      "Begäran upphör när Röd 8 byter klubba. Domarna får endast kontrollera den utrustning som spelaren använder vid själva kontrolltillfället. Spelet återupptas därför direkt med Blås inslag.",
      "Domarna gjorde fel redan när de lät frislaget utföras. En begärd kontroll av hook måste alltid genomföras omedelbart när spelet är avblåst. Frislaget skulle därför aldrig ha fått utföras.",
      "Domarna hade rätt att skjuta upp kontrollen eftersom de bedömde att en omedelbar kontroll skulle påverka Blås spelsituation negativt. Vid nästa avblåsning ska den begärda kontrollen genomföras. Att Röd 8 under tiden byter klubba innebär inte i sig att den redan begärda kontrollen ska ignoreras. Efter kontrollen återupptas spelet i enlighet med det som orsakade avblåsningen.",
      "Domarna ska kontrollera både den tidigare och den nya klubban. Eftersom Röd 8 bytt utrustning efter att kontroll begärts ska spelaren dessutom automatiskt ådömas mindre lagstraff för fördröjande av spelet."
    ], x:2,
    r:"Kontrollen genomförs vid nästa avblåsning och spelet återupptas därefter utifrån orsaken till avblåsningen.",
    e:"Lagkaptenen får begära kontroll av hook. Om begäran görs när spelet är avblåst får domarna skjuta fram kontrollen till nästa avblåsning om en omedelbar kontroll skulle påverka motståndarlagets spelsituation negativt. Ett klubbyte gör inte i sig att den redan begärda kontrollen ska ignoreras. Efter kontrollen återupptas spelet i enlighet med det som orsakade avblåsningen.",
    s:"Regelhandbok 2026 – kontroll av utrustning och lagkaptenens rättigheter",
    t:"Håll isär tidpunkten för begäran, domarnas möjlighet att skjuta upp kontrollen och orsaken till nästa avblåsning."
  });

  add({
    id:9027, level:"death", c:"Death Mode", n:true,
    q:"Röd 4 spelar avsiktligt bollen tillbaka till sin egen målvakt. Målvakten befinner sig i målområdet och tar först emot bollen med foten. Blå 9 läser situationen, sätter omedelbart press och är på väg att kunna spela bollen. Innan Blå 9 når fram böjer sig målvakten ner och tar upp samma boll med händerna. Ingen annan spelare har rört bollen efter Röd 4:s passning. Vad ska domarna döma?",
    a:[
      "Frislag till Blå för passning till målvakten. Att målvakten först spelar bollen med foten gör inte att den avsiktliga passningen upphör; när målvakten därefter vidrör samma boll med händerna eller armarna i målområdet är mottagningen fullbordad. Att Blå 9 pressar och att Röd därigenom vinner en stor praktisk fördel ändrar inte i sig grundpåföljden till straffslag eller utvisning.",
      "Straffslag till Blå eftersom målvakten genom den otillåtna handberöringen tar bort en målsituation. Eftersom Blå 9 är på väg att vinna bollen ska passningsförseelsen behandlas som vilken frislag- eller utvisningsbelagd förseelse som helst som avbryter en målsituation.",
      "Frislag och mindre lagstraff på målvakten eftersom laget vinner en betydande fördel när målvakten tar upp bollen under press. Betydande fördel höjer därför automatiskt passning till målvakten från frislag till mindre lagstraff.",
      "Spela vidare. Målvakten får alltid ta emot en avsiktlig passning med foten, och efter den första fotberöringen räknas bollen som spelad av målvakten själv. En senare handberöring av samma boll omfattas därför inte av regeln om passning till målvakten."
    ], x:0,
    r:"Frislag till Blå för passning till målvakten.",
    e:"Regeln om passning till målvakt träffar situationen när en utespelare avsiktligt spelar bollen till sin egen målvakt och målvakten i målområdet tar emot den med händerna eller armarna. En föregående fotberöring av samma passning gör inte i sig den senare handberöringen tillåten. Pressen från Blå 9 gör scenariot svårare, men skapar inte automatiskt en särskild utvisningsnivå eller ett straffslag utöver vad regelboken föreskriver för själva passningsförseelsen.",
    s:"Regel 507.17 – passning till målvakt",
    t:"Skilj den praktiska fördelen i matchsituationen från den påföljd som regelboken faktiskt anger för förseelsen."
  });
})();