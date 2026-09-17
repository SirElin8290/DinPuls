import {
  CONTRACT_TERMS as V40_TERMS,
  calculateContractPrice as baseCalculateContractPrice,
  stableStringify
} from "./contract-v4-base.js";

export const CONTRACT_VERSION = "4.1";
export const BILLING = Object.freeze({
  monthly: { label: "Månadsvis", unitPrice: 800, interval: "månad", paymentTerms: "10 dagar netto" },
  annual: { label: "Årsvis i förskott", unitPrice: 8000, interval: "12 månader", paymentTerms: "10 dagar netto" },
  complimentary: { label: "Kostnadsfri", unitPrice: 0, interval: "12 månader", paymentTerms: "Ingen debitering" }
});

const priceTerms = Object.freeze({
  ...V40_TERMS[3],
  paragraphs: Object.freeze([
    "Ordinarie betalningsalternativ är:",
    "A) Månadsvis: 800 kronor per annonsplats och månad exklusive moms.",
    "B) Årsvis i förskott: 8 000 kronor per annonsplats exklusive moms för en avtalsperiod om 12 månader.",
    "C) Kostnadsfri: endast när en annonsplats uttryckligen upplåtits kostnadsfritt.",
    "Månadsbetalning under tolv månader motsvarar: 9 600 kr per plats.",
    "Årsbetalning innebär således 1 600 kr lägre totalpris per plats jämfört med tolv månadsbetalningar.",
    ...V40_TERMS[3].paragraphs.slice(6)
  ])
});

export const CONTRACT_TERMS = Object.freeze([
  ...V40_TERMS.slice(0, 3),
  priceTerms,
  ...V40_TERMS.slice(4),
  Object.freeze({
    title: "15. ÖVERLÅTELSE AV DINPULS VERKSAMHET",
    paragraphs: Object.freeze([
      "Företaget samtycker till att DinPuls får överlåta detta avtal, inklusive de rättigheter och skyldigheter som följer av avtalet, till ett aktiebolag eller annan juridisk person som övertar och fortsätter verksamheten DinPuls.se.",
      "Detta samtycke omfattar särskilt en framtida övergång av DinPuls verksamhet från enskild näringsverksamhet till aktiebolag.",
      "En sådan överlåtelse får inte i sig medföra högre avtalat pris, längre bindningstid eller andra försämringar av företagets materiella rättigheter enligt det signerade avtalet.",
      "Den övertagande juridiska personen inträder som avtalspart från den dag verksamhetsöverlåtelsen träder i kraft och övertar från denna tidpunkt DinPuls skyldigheter enligt avtalet.",
      "DinPuls ska informera företaget om överlåtelsen och ange den nya avtalspartens företagsnamn, organisationsnummer, kontaktuppgifter samt från vilket datum den nya avtalsparten övertar avtalet.",
      "Fakturor och betalningskrav ska hänföras till den juridiska person som enligt gällande övergångsdatum är rätt betalningsmottagare. Redan utställda fakturor och uppkomna fordringar påverkas inte automatiskt av överlåtelsen, om inte annat uttryckligen meddelas.",
      "Överlåtelsen påverkar inte avtalets ursprungliga startdatum, slutdatum, betalningsform, pris per annonsplats eller övriga avtalade villkor.",
      "Företaget får inte överlåta avtalet till annan part utan DinPuls eller den vid tidpunkten gällande avtalspartens skriftliga godkännande."
    ])
  })
]);

export function calculateContractPrice(cadence, placementCount) {
  const billing = BILLING[cadence];
  if (!billing || !Number.isInteger(placementCount) || placementCount < 1 || placementCount > 20) throw new Error("Ogiltig betalningsform eller antal platser.");
  return { cadence, unitPrice: billing.unitPrice, monthlyTotal: cadence === "monthly" ? billing.unitPrice * placementCount : 0, annualTotal: cadence === "monthly" ? billing.unitPrice * placementCount * 12 : billing.unitPrice * placementCount, invoiceTotal: billing.unitPrice * placementCount, label: billing.label, interval: billing.interval, paymentTerms: billing.paymentTerms, vat: "exklusive moms" };
}

export { stableStringify };
