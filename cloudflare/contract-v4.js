import {
  BILLING as BASE_BILLING,
  CONTRACT_TERMS as V40_TERMS,
  calculateContractPrice,
  stableStringify
} from "./contract-v4-base.js";

export const CONTRACT_VERSION = "4.1";
export const BILLING = BASE_BILLING;

export const CONTRACT_TERMS = Object.freeze([
  ...V40_TERMS,
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

export { calculateContractPrice, stableStringify };
