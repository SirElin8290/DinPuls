import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeSwedishOrgNumber, verifyCompanyRegistration } from "../cloudflare/swedish-org-number.js";
import { SPIRIS_ENABLED, buildBillingBasis, requestSpirisInvoice } from "../cloudflare/spiris-adapter.js";

function withCheckDigit(nine) {
  for (let digit = 0; digit < 10; digit++) {
    const candidate = nine + digit;
    if (normalizeSwedishOrgNumber(candidate)) return candidate;
  }
  throw new Error("Ingen kontrollsiffra hittades.");
}
const valid = withCheckDigit("556123456");
assert.equal(normalizeSwedishOrgNumber(`${valid.slice(0, 6)}-${valid.slice(6)}`), valid);
assert.equal(normalizeSwedishOrgNumber(`16${valid}`), valid);
assert.equal(normalizeSwedishOrgNumber(valid.slice(0, 9) + ((Number(valid[9]) + 1) % 10)), null);
assert.equal(normalizeSwedishOrgNumber("1234567890"), null);
assert.equal(normalizeSwedishOrgNumber("0000000000"), null);
assert.deepEqual(await verifyCompanyRegistration(valid), { status: "not_configured", orgNo: valid });
assert.deepEqual(await verifyCompanyRegistration("1234567890"), { status: "invalid", orgNo: null });

const basis = buildBillingBasis({ id: 7, orgNo: valid, company: "Exempel AB", address: "Storgatan 1", postalCode: "66230", city: "Åmål", contact: "Anna", email: "anna@example.se" }, [
  { id: "order-1", municipality: "Åmål", slotId: "P1-04", placementLabel: "Startsidan – övre annonsblocket – plats 4", billingType: "annual", unitPriceExVat: 5000, startDate: "2026-09-15", endDate: "2027-09-14" },
  { id: "order-2", municipality: "Säffle", slotId: "BOST-02", placementLabel: "Bostäder – plats 2", billingType: "monthly", unitPriceExVat: 500, startDate: "2026-10-01", endDate: "2027-09-30" }
]);
assert.equal(basis.lines.length, 2);
assert.deepEqual([basis.net, basis.vat, basis.total], [5500, 1375, 6875]);
assert.deepEqual(basis.purchaseIds, ["order-1", "order-2"]);
assert.throws(() => buildBillingBasis({ id: 7, orgNo: valid, company: "Exempel AB" }, [{ id: "same" }, { id: "same" }]));
assert.equal(SPIRIS_ENABLED, false);
await assert.rejects(requestSpirisInvoice(), /avstängd/);
const registerCss = await readFile(new URL("../foretag/registrera.css", import.meta.url), "utf8");
const buyCss = await readFile(new URL("../foretag/kop.css", import.meta.url), "utf8");
assert.match(registerCss, /@media\(max-width:640px\).*grid-template-columns:minmax\(0,1fr\)/s);
assert.match(buyCss, /@media\(max-width:800px\)/);
assert.match(buyCss, /@media\(max-width:640px\).*\.slot-results\{grid-template-columns:minmax\(0,1fr\)/s);
assert.match(buyCss, /min-width:0/);
console.log("Självservicegrund, organisationsnummer och avstängt Spiris-underlag: OK");
