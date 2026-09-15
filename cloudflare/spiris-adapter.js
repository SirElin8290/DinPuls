// Internal, provider-neutral invoice basis. This module deliberately does not call Spiris.
// A future live adapter must map this basis to the then-current official API schema.
export const SPIRIS_ENABLED = false;

export function buildBillingBasis(customer, purchases) {
  if (!customer?.id || !customer?.orgNo || !customer?.company || !Array.isArray(purchases) || !purchases.length) {
    throw new Error("Ofullständigt fakturaunderlag.");
  }
  const ids = new Set();
  const lines = purchases.map(purchase => {
    if (!purchase.id || ids.has(purchase.id) || !purchase.municipality || !purchase.placementLabel ||
        !["monthly", "annual"].includes(purchase.billingType) || !Number.isInteger(purchase.unitPriceExVat) ||
        purchase.unitPriceExVat < 0 || !purchase.startDate || !purchase.endDate) throw new Error("Ogiltigt köp i fakturaunderlaget.");
    ids.add(purchase.id);
    return {
      purchaseId: purchase.id, municipality: purchase.municipality, slotId: purchase.slotId,
      description: `DinPuls ${purchase.municipality} – ${purchase.placementLabel}`,
      quantity: 1, unitPriceExVat: purchase.unitPriceExVat, vatRate: 0.25,
      billingType: purchase.billingType, startDate: purchase.startDate, endDate: purchase.endDate
    };
  });
  const net = lines.reduce((sum, line) => sum + line.unitPriceExVat, 0);
  return {
    customer: { id: customer.id, orgNo: customer.orgNo, company: customer.company,
      address: customer.address || "", postalCode: customer.postalCode || "", city: customer.city || "",
      contact: customer.contact || "", email: customer.email || "" },
    purchaseIds: [...ids].sort(), lines, net, vat: Math.round(net * 0.25), total: net + Math.round(net * 0.25)
  };
}

export async function requestSpirisInvoice() {
  if (!SPIRIS_ENABLED) throw new Error("Spiris-fakturering är avstängd.");
  throw new Error("Produktionsadaptern är inte konfigurerad.");
}
