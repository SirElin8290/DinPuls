(() => {
  "use strict";
  const bank = window.VDK_QUESTIONS;
  if (!Array.isArray(bank)) return;
  if (bank.some(q => q && q.id === 9026)) return;
  bank.push({
    id:9026, level:"death", c:"Death Mode", n:true,
    q:"Det återstår 1.12 av tredje perioden. Röd leder med 4–3 och Blå har frislag i anfallszon. Innan frislaget hinner utföras begär Blås lagkapten att domarna kontrollerar hooken på Röd 8:s klubba. Röd 8 befinner sig på spelplanen. Domarna bedömer samtidigt att en omedelbar kontroll skulle påverka Blås spelsituation negativt eftersom Blå vill utföra frislaget snabbt. Domarna meddelar därför att kontrollen kommer att genomföras vid nästa avblåsning och låter Blå utföra frislaget. Spelet fortsätter i cirka tio sekunder. Blå skjuter, Röd målvakt räddar och bollen går över sargen. Innan inslaget utförs går Röd 8 självmant till byteszonen och byter klubba. Blås lagkapten påpekar att det är den tidigare klubban som begäran avsåg. Röd hävdar att kontrollen inte längre kan genomföras eftersom spelaren nu har en annan klubba. Hur ska domarna hantera hela situationen?",
    a:[
      "Begäran upphör när Röd 8 byter klubba. Domarna får endast kontrollera den utrustning som spelaren använder vid själva kontrolltillfället. Spelet återupptas därför direkt med Blås inslag.",
      "Domarna gjorde fel redan när de lät frislaget utföras. En begärd kontroll av hook måste alltid genomföras omedelbart när spelet är avblåst. Frislaget skulle därför aldrig ha fått utföras.",
      "Domarna hade rätt att skjuta upp kontrollen eftersom de bedömde att en omedelbar kontroll skulle påverka Blås spelsituation negativt. Vid nästa avblåsning ska den begärda kontrollen genomföras. Att Röd 8 under tiden byter klubba innebär inte i sig att den redan begärda kontrollen ska ignoreras. Efter kontrollen återupptas spelet i enlighet med det som orsakade avblåsningen.",
      "Domarna ska kontrollera både den tidigare och den nya klubban. Eftersom Röd 8 bytt utrustning efter att kontroll begärts ska spelaren dessutom automatiskt ådömas mindre lagstraff för fördröjande av spelet."
    ],
    x:2,
    r:"Kontrollen genomförs vid nästa avblåsning och spelet återupptas därefter utifrån orsaken till avblåsningen.",
    e:"Lagkaptenen får begära kontroll av hook. Om begäran görs när spelet är avblåst får domarna skjuta fram kontrollen till nästa avblåsning om en omedelbar kontroll skulle påverka motståndarlagets spelsituation negativt. Ett klubbyte gör inte i sig att den redan begärda kontrollen ska ignoreras. Efter kontrollen återupptas spelet i enlighet med det som orsakade avblåsningen.",
    s:"Regelhandbok 2026 – kontroll av utrustning och lagkaptenens rättigheter",
    t:"Håll isär tidpunkten för begäran, domarnas möjlighet att skjuta upp kontrollen och orsaken till nästa avblåsning."
  });
})();