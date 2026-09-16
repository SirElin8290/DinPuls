import { BILLING, CONTRACT_TERMS as V41_TERMS, calculateContractPrice, stableStringify } from "./contract-v4.js";

export const CONTRACT_VERSION = "4.2";
export { BILLING, calculateContractPrice, stableStringify };

const revised = new Map([
  [1, {
    title: "1. AVTALETS OMFATTNING",
    paragraphs: [
      ...V41_TERMS[0].paragraphs,
      "Det individuella grundavtalet omfattar de företagsuppgifter, annonsplatser med kommun och placering, priser, betalningsform, moms och avtalsperiod som visas tillsammans med dessa fullständiga villkor i företagets låsta avtalsunderlag före företagets elektroniska signering."
    ]
  }],
  [6, {
    title: "6. AVTALSTID, BINDNINGSTID OCH FÖRNYELSE",
    paragraphs: V41_TERMS[5].paragraphs.map((text, index) => index === 13
      ? "Förlängning, nytt pris eller andra ändrade villkor ska godkännas av båda parter och dokumenteras i ett nytt avtal eller en ny skriftlig överenskommelse. Ytterligare annonsplatser under ett gällande grundavtal kan beställas elektroniskt enligt punkt 7."
      : text)
  }],
  [7, {
    title: "7. ÄNDRINGAR EFTER SIGNERING OCH TILLÄGGSBESTÄLLNINGAR",
    paragraphs: [
      "När företaget har elektroniskt signerat det låsta grundavtalet enligt punkt 8 är det bindande för båda parter och får inte ändras ensidigt av någon av parterna.",
      "Ändringar som påverkar pris, avtalsperiod, betalningsform, exklusivitet eller andra väsentliga villkor i redan avtalade annonsplatser ska godkännas av både företaget och DinPuls och dokumenteras skriftligen.",
      "Efter att grundavtalet slutits får företaget genom sitt autentiserade företagskonto köpa ytterligare annonsplatser. Före bekräftelse visas kommun, annonsplats och placering, pris, moms, betalningsmodell, startdatum, bindnings- och avtalsperiod samt tillämplig avtalsversion. Företagets uttryckliga elektroniska bekräftelse utgör en dokumenterad tilläggsbeställning under det gällande grundavtalet. Den kräver inte nytt grundavtal eller ny DinPuls-signatur. Det låsta beställningsunderlaget och bekräftelsen bevaras separat.",
      ...V41_TERMS[6].paragraphs.slice(2, 4),
      "Om parterna kommer överens om en annan väsentlig förändring kan detta dokumenteras genom ett tilläggsavtal eller genom att ett nytt avtal upprättas.",
      "Den ursprungliga signerade avtalskopian ska alltid bevaras oförändrad."
    ]
  }],
  [8, {
    title: "8. ELEKTRONISK UNDERSKRIFT OCH AVTALSKOPIA",
    paragraphs: [
      "SirElin AB/DinPuls har på förhand godkänt denna avtalsmodell och villkoren genom sin fasta elektroniska DinPuls-signatur. Signaturen ingår i det låsta individuella grundavtal som företaget får se innan det signerar, och innebär inte att en DinPuls-företrädare manuellt signerar vid företagets signering.",
      "Företaget får före signering se hela sitt låsta individuella avtal med företagsuppgifter, köpta annonsplatser och kommuner, priser, moms, betalningsform, avtalsperiod och fullständiga villkor samt DinPuls fasta signatur.",
      "Den person som undertecknar avtalet för företagets räkning ansvarar för att ha rätt att företräda företaget och ingå avtalet.",
      "Företaget godkänner och signerar elektroniskt genom DinPuls autentiserade företagstjänst med den signeringsfunktion som DinPuls tillhandahåller, exempelvis med finger eller penna på telefon, surfplatta eller annan kompatibel enhet.",
      "Precis ovanför företagets signaturfält ska följande text visas:",
      "\"Genom att skriva under bekräftar jag att jag har rätt att företräda företaget och att jag godkänner avtalet och dess villkor.\"",
      "Företagets namn, undertecknarens namn och roll, företagets signatur, SirElin AB:s fasta förhandsgodkända signatur, signeringstidpunkt och avtalsunderlagets kontrollsumma bevaras.",
      "Avtalet blir bindande för båda parter när företaget elektroniskt godkänner och signerar det låsta avtalet genom den autentiserade företagstjänsten. Ingen efterföljande manuell motpartssignatur från DinPuls krävs.",
      "När företagets underskrift och det låsta avtalsunderlaget har verifierats ska samma avtalsinnehåll som visades före signeringen bevaras oförändrat i den slutliga signerade avtalskopian.",
      ...V41_TERMS[7].paragraphs.slice(10, 14),
      "Om en teknisk störning gör att företagets signering, den fasta DinPuls-signaturen eller det låsta avtalsunderlaget inte kan verifieras korrekt ska avtalet inte betraktas som färdigsignerat. Signeringen ska då genomföras på nytt.",
      ...V41_TERMS[7].paragraphs.slice(16)
    ]
  }]
]);

export const CONTRACT_TERMS = Object.freeze(V41_TERMS.map((term, index) => {
  const replacement = revised.get(index + 1);
  return replacement ? Object.freeze({ title: replacement.title, paragraphs: Object.freeze(replacement.paragraphs) }) : term;
}));
