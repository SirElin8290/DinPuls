import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatInvoiceBasis } from "../admin/invoice-copy.mjs";

const contract = {
  id: "DP-2026-0001", company: "Exempel AB", orgNo: "556000-0000", contact: "Anna Andersson",
  email: "anna@example.se", phone: "070-123 45 67", municipality: "Åmål", startDate: "2026-09-15",
  endDate: "2027-09-14", billingType: "annual", price: 5000, monthlyTotal: 0, annualTotal: 10000,
  placements: [{ slotId: "P1-01", label: "Företag nära dig · plats 1" }, { slotId: "P1-02", location: "Företag nära dig" }]
};
const basis = formatInvoiceBasis(contract);
for (const expected of ["DINPULS – FAKTURAUNDERLAG", "DP-2026-0001", "556000-0000", "Anna Andersson", "Åmål", "P1-01", "P1-02", "2026-09-15 – 2027-09-14", "Årsvis i förskott", "Antal platser: 2", "Pris per plats: 5 000 kr", "Årsbelopp: 10 000 kr", "10 dagar netto", "exklusive moms"]) assert.ok(basis.includes(expected), `Fakturaunderlaget saknar ${expected}`);
assert.ok(!basis.toLowerCase().includes("momsbelopp"), "DinPuls ska inte räkna fram momsbelopp");

const worker = await readFile(new URL("../cloudflare/push-worker.js", import.meta.url), "utf8");
const admin = await readFile(new URL("../admin/admin.js", import.meta.url), "utf8");
assert.match(worker, /adAssetsConfigured:\s*Boolean\(env\.AD_ASSETS\)/);
assert.match(admin, /Systemstatus/);
assert.match(admin, /Kopiera fakturaunderlag/);
console.log("Kommersiell readiness och Spiris-fakturaunderlag: OK");
