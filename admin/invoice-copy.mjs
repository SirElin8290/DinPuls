function money(value) { return `${Number(value || 0).toLocaleString("sv-SE")} kr`; }
function clean(value) { return String(value ?? "").replace(/[\r\n]+/g, " ").trim() || "–"; }

export function formatInvoiceBasis(contract) {
  const placements = Array.isArray(contract.placements) ? contract.placements : [];
  const cadence = contract.billingType;
  const billingLabel = cadence === "complimentary" ? "Kostnadsfri" : cadence === "annual" ? "Årsvis i förskott" : "Månadsvis";
  const unitPrice = cadence === "complimentary" ? 0 : Number(contract.price || (cadence === "annual" ? 5000 : 500));
  const invoiceAmount = cadence === "monthly" ? Number(contract.monthlyTotal || 0) : Number(contract.annualTotal || 0);
  const placementLines = placements.length ? placements.map(item => `${clean(item.slotId)} – ${clean(item.label || item.location)}`).join("\n") : "–";
  return [
    "DINPULS – FAKTURAUNDERLAG", "", `Avtal: ${clean(contract.id)}`, `Företag: ${clean(contract.company)}`,
    `Org.nr: ${clean(contract.orgNo)}`, `Kontakt: ${clean(contract.contact)}`, `E-post: ${clean(contract.email)}`,
    `Telefon: ${clean(contract.phone)}`, "", `Kommun: ${clean(contract.municipality)}`, "", "Annonsplatser:", placementLines,
    "", "Avtalsperiod:", `${clean(contract.startDate)} – ${clean(contract.endDate)}`, "", `Betalningsform: ${billingLabel}`,
    `Antal platser: ${placements.length}`, `Pris per plats: ${money(unitPrice)}`,
    cadence === "monthly" ? `Månadsbelopp: ${money(contract.monthlyTotal)}` : null,
    cadence === "annual" ? `Årsbelopp: ${money(contract.annualTotal)}` : null,
    `Total avtalssumma: ${money(contract.annualTotal)}`, `Att fakturera: ${money(invoiceAmount)} exklusive moms`,
    "Betalningsvillkor: 10 dagar netto"
  ].filter(line => line !== null).join("\n");
}
