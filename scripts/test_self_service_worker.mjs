import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { normalizeSwedishOrgNumber } from "../cloudflare/swedish-org-number.js";
import { CONTRACT_TERMS as V41_TERMS, CONTRACT_VERSION as V41_VERSION } from "../cloudflare/contract-v4.js";
import { CONTRACT_TERMS as V42_TERMS, CONTRACT_VERSION as V42_VERSION } from "../cloudflare/contract-v4.2.js";

const bundle = await build({
  entryPoints: [fileURLToPath(new URL("../cloudflare/push-worker.js", import.meta.url))],
  bundle: true, format: "esm", platform: "browser", write: false,
  plugins: [{ name: "stub-web-push", setup(builder) {
    builder.onResolve({ filter: /^web-push$/ }, () => ({ path: "web-push", namespace: "test-stub" }));
    builder.onLoad({ filter: /.*/, namespace: "test-stub" }, () => ({ contents: "export default { setVapidDetails() {}, async sendNotification() { return { statusCode: 201 }; } };", loader: "js" }));
  }}]
});
const mail = [];
const signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const fixedBytes = process.env.DINPULS_TEST_SIGNATURE_PATH ? readFileSync(process.env.DINPULS_TEST_SIGNATURE_PATH) : Buffer.from(signature.split(",")[1], "base64");
const fixedHash = createHash("sha256").update(fixedBytes).digest("hex");
const worker = new Miniflare({
  modules: true, script: bundle.outputFiles[0].text,
  compatibilityDate: "2026-08-06", compatibilityFlags: ["nodejs_compat"],
  bindings: { ADMIN_USERNAME: "localadmin", ADMIN_PASSWORD: "LocalAdmin-Test-2026",
    PORTAL_PASSWORD_PEPPER: "LocalPepper-Test-2026", RESEND_API_KEY: "local-test-only",
    PORTAL_EMAIL_FROM: "DinPuls <test@example.invalid>", SELF_SERVICE_SIGNUP_ENABLED: "true",
    SELF_SERVICE_PURCHASE_ENABLED: "true", SELF_SERVICE_FIXED_SIGNATURE_ENABLED: "true",
    SELF_SERVICE_FIXED_SIGNATURE_SHA256: fixedHash },
  outboundService: async request => {
    if (request.url !== "https://api.resend.com/emails") throw new Error("Oväntat externt anrop");
    mail.push(await request.json());
    return new Response(JSON.stringify({ id: `mail-${mail.length}` }), { status: 200, headers: { "Content-Type": "application/json" } });
  },
  d1Databases: { DB: "self-service-test-db" }, r2Buckets: ["AD_ASSETS", "CONTRACT_SIGNATURES"]
});
await (await worker.getR2Bucket("CONTRACT_SIGNATURES")).put("approved/sirelin-ab/v1.png", fixedBytes);
const endpoint = "http://dinpuls.test";
const send = (path, method = "GET", body, token) => worker.dispatchFetch(`${endpoint}${path}`, {
  method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {})
});
async function read(path, method, body, token, status = 200) {
  const response = await send(path, method, body, token);
  if (response.status !== status) assert.equal(response.status, status, await response.text());
  return response.json();
}
function validOrg(nine) {
  for (let digit = 0; digit < 10; digit++) {
    const candidate = nine + digit;
    if (normalizeSwedishOrgNumber(candidate)) return candidate;
  }
  throw new Error("Ingen kontrollsiffra");
}
const orgNo = validOrg("556123456");
const signup = { orgNo, company: "Testföretag AB", address: "Storgatan 1", postalCode: "662 30",
  city: "Åmål", contact: "Anna Test", phone: "0701234567", email: "anna@example.invalid" };
try {
  assert.equal(V41_VERSION, "4.1");
  assert.equal(V42_VERSION, "4.2");
  assert.equal(V41_TERMS[7].paragraphs[8], "Avtalet blir bindande när både företaget och DinPuls har undertecknat det.");
  assert.ok(V42_TERMS[7].paragraphs.some(text => text.includes("Ingen efterföljande manuell motpartssignatur")));
  assert.ok(V42_TERMS[6].paragraphs.some(text => text.includes("dokumenterad tilläggsbeställning")));
  const health = await read("/health");
  assert.equal(health.selfServiceSignupEnabled, true);
  assert.equal(health.selfServicePurchaseEnabled, true);
  assert.equal(health.selfServiceFixedSignatureEnabled, true);
  assert.equal(health.spirisEnabled, false);
  await read("/portal/company/register", "POST", { ...signup, orgNo: orgNo.slice(0, 9) + ((Number(orgNo[9]) + 1) % 10) }, null, 400);
  assert.equal(mail.length, 0);
  await read("/portal/company/register", "POST", signup, null, 201);
  assert.equal(mail.length, 1);
  const link = /#token=([0-9a-f]{64})&purpose=activate-account/.exec(mail[0].text);
  assert.ok(link, "Aktiveringsmejlet saknar engångslänk");
  const token = link[1];
  const password = "Company-Test-2026!";
  await read("/portal/account/password", "POST", { token, purpose: "activate-account", password, passwordConfirmation: password });
  await read("/portal/account/password", "POST", { token, purpose: "activate-account", password, passwordConfirmation: password }, null, 409);
  const session = await read("/portal/auth/company", "POST", { email: signup.email, password });
  const me = await read("/portal/company/me", "GET", null, session.token);
  assert.equal(me.profile.address, signup.address);
  assert.equal(me.profile.city, signup.city);
  assert.equal(me.contract, null);
  await read("/portal/company/register", "POST", { ...signup, email: "other@example.invalid" }, null, 409);
  const startDate = new Date();
  const start = startDate.toISOString().slice(0, 10);
  const endDate = new Date(startDate); endDate.setUTCFullYear(endDate.getUTCFullYear() + 1); endDate.setUTCDate(endDate.getUTCDate() - 1);
  const end = endDate.toISOString().slice(0, 10);
  const slots = await read(`/portal/company/available-slots?municipality=%C3%85m%C3%A5l&startDate=${start}&endDate=${end}`, "GET", null, session.token);
  assert.ok(slots.slots.some(slot => slot.id === "P1-04" && /Övre annonsblocket.*Plats 4 av 10/.test(slot.displayLabel)));
  assert.equal(slots.pricing.monthlyExVat, 500);
  assert.equal(slots.pricing.annualExVat, 5000);
  await read(`/portal/company/available-slots?municipality=S%C3%A4ffle&startDate=${start}&endDate=${end}`, "GET", null, session.token);
  await read(`/portal/company/available-slots?municipality=%C3%85m%C3%A5l&startDate=${start}&endDate=${end}`, "GET", null, null, 401);
  const admin = await read("/portal/auth/admin", "POST", { username: "localadmin", password: "LocalAdmin-Test-2026" });
  const contractId = "DP-2026-9911";
  const adminDraft = await read("/portal/admin/contracts", "POST", { id: contractId, company: "Adminföretag AB", orgNo: "000000-0000",
    contact: "Admin test", email: "admin@example.invalid", phone: "0700000000", municipality: "Åmål",
    placements: [{ slotId: "P1-04", module: "Startsida", group: "premium-ad-1", label: "Plats 4", location: "Övre annonsblocket", page: "index.html" }],
    startDate: start, endDate: end, billingType: "annual", renewalType: "annual-review", termsReviewed: true
  }, admin.token, 201);
  assert.equal(adminDraft.snapshot.contractVersion, "4.1", "Administrativt skapade v4.1-avtal får inte byta version");
  await read(`/portal/admin/contracts/${contractId}/sign`, "POST", { customerSignerName: "Kund Test", customerSignerTitle: "Företrädare",
    dinpulsSignerName: "DinPuls Test", dinpulsSignerTitle: "Företrädare", customerSignature: signature, dinpulsSignature: signature
  }, admin.token);
  const after = await read(`/portal/company/available-slots?municipality=%C3%85m%C3%A5l&startDate=${start}&endDate=${end}`, "GET", null, session.token);
  assert.ok(!after.slots.some(slot => slot.id === "P1-04"), "Aktivt upptagen plats får inte visas som ledig");
  const adminActivation = /#token=([0-9a-f]{64})&purpose=activate-account/.exec(mail.at(-1).text);
  assert.ok(adminActivation, "Befintligt avtal ska ge aktiveringsmejl");
  await read("/portal/account/password", "POST", { token: adminActivation[1], purpose: "activate-account", password, passwordConfirmation: password });
  const buyer = await read("/portal/auth/company", "POST", { email: "admin@example.invalid", password });
  const mailBeforePurchases = mail.length;
  const orderLines = [{ municipality: "Åmål", slotId: "P1-05", startDate: start, endDate: end }, { municipality: "Säffle", slotId: "P2-11", startDate: start, endDate: end }];
  const reserved = await read("/portal/company/orders", "POST", { placements: orderLines, billingType: "annual" }, buyer.token, 201);
  assert.equal(reserved.snapshot.placements.length, 2);
  assert.equal(reserved.snapshot.contractVersion, "4.1");
  assert.deepEqual(reserved.snapshot.terms, V41_TERMS);
  assert.equal(reserved.snapshot.totals.perInvoiceExVat, 10000);
  assert.equal(reserved.snapshot.totals.perInvoiceVat, 2500);
  assert.equal(reserved.snapshot.totals.perInvoiceInclVat, 12500);
  await read(`/portal/company/orders/${reserved.orderId}/confirm`, "POST", { explicitConfirmation: true, snapshotHash: "wrong" }, buyer.token, 400);
  const confirmed = await read(`/portal/company/orders/${reserved.orderId}/confirm`, "POST", { explicitConfirmation: true, snapshotHash: reserved.snapshotHash }, buyer.token);
  assert.equal(confirmed.purchaseCount, 2);
  const oldDb = await worker.getD1Database("DB");
  const oldOrder = await oldDb.prepare("SELECT snapshot_json, snapshot_hash, status FROM self_service_orders WHERE id=?").bind(reserved.orderId).first();
  assert.equal(oldOrder.status, "confirmed");
  assert.deepEqual(JSON.parse(oldOrder.snapshot_json), reserved.snapshot);
  assert.equal(createHash("sha256").update(oldOrder.snapshot_json).digest("hex"), reserved.snapshotHash);
  const oldConfirmation = await oldDb.prepare("SELECT confirmation_json, confirmation_hash FROM self_service_purchases WHERE order_id=? LIMIT 1").bind(reserved.orderId).first();
  assert.equal(createHash("sha256").update(oldConfirmation.confirmation_json).digest("hex"), oldConfirmation.confirmation_hash);
  assert.equal(JSON.parse(oldConfirmation.confirmation_json).snapshotHash, reserved.snapshotHash);
  await read(`/portal/company/orders/${reserved.orderId}/confirm`, "POST", { explicitConfirmation: true, snapshotHash: reserved.snapshotHash }, buyer.token);
  const purchases = await read("/portal/company/purchases", "GET", null, buyer.token);
  assert.equal(purchases.purchases.length, 2);
  assert.ok(purchases.purchases.every(item => item.foundation_contract_id === contractId && item.billing_status === "waiting_for_launch"));
  assert.equal((await read("/portal/company/purchases", "GET", null, session.token)).purchases.length, 0);
  await read("/portal/company/orders", "POST", { placements: [orderLines[0]], billingType: "annual" }, buyer.token, 409);
  const noLongerFree = await read(`/portal/company/available-slots?municipality=%C3%85m%C3%A5l&startDate=${start}&endDate=${end}`, "GET", null, buyer.token);
  assert.ok(!noLongerFree.slots.some(slot => slot.id === "P1-05"));
  const monthly = await read("/portal/company/orders", "POST", { placements: [{ municipality: "Åmål", slotId: "P1-06", startDate: start, endDate: end }], billingType: "monthly" }, buyer.token, 201);
  assert.equal(monthly.snapshot.totals.perInvoiceExVat, 500);
  assert.equal(monthly.snapshot.totals.perInvoiceVat, 125);
  assert.equal(monthly.snapshot.totals.twelveMonthsExVat, 6000);
  assert.equal(mail.length, mailBeforePurchases, "Spiris och extra e-post får inte anropas av tilläggsköp");
  const first = await read("/portal/company/foundation/orders", "POST", { placements: [
    { municipality: "Åmål", slotId: "P3-21", startDate: start, endDate: end },
    { municipality: "Säffle", slotId: "P3-21", startDate: start, endDate: end }
  ], billingType: "annual" }, session.token, 201);
  assert.equal(first.snapshot.contractVersion, "4.2");
  assert.deepEqual(first.snapshot.terms, V42_TERMS);
  assert.equal(first.snapshot.dinpulsFixedSignature.mode, "preapproved-fixed");
  assert.equal(first.snapshot.dinpulsFixedSignature.signer, "SirElin AB");
  assert.equal(first.snapshot.dinpulsFixedSignature.sha256, fixedHash);
  assert.equal(first.snapshot.placements.length, 2);
  assert.equal(first.snapshot.company.address, signup.address);
  assert.equal(first.snapshot.billing.invoiceVat, 2500);
  assert.equal((await send(`/portal/company/foundation/orders/${first.orderId}/dinpuls-signature`)).status, 401, "Originalet får inte läcka utan autentisering");
  assert.equal((await send(`/portal/company/foundation/orders/${first.orderId}/dinpuls-signature`, "GET", null, buyer.token)).status, 404, "En annan kund får inte se signaturen i detta avtal");
  const preview = await send(`/portal/company/foundation/orders/${first.orderId}/dinpuls-signature`, "GET", null, session.token);
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get("cache-control"), "private, no-store");
  assert.equal(createHash("sha256").update(Buffer.from(await preview.arrayBuffer())).digest("hex"), fixedHash);
  assert.equal((await send("/ads/assets/approved%2Fsirelin-ab%2Fv1.png")).status, 404, "Originalet får inte vara en publik annonsasset");
  await read(`/portal/company/foundation/orders/${first.orderId}/sign`, "POST", { customerSignerName: "Anna Test", customerSignerTitle: "Företrädare", customerSignature: signature, snapshotHash: "fel", explicitConfirmation: true }, session.token, 409);
  const customerSigned = await read(`/portal/company/foundation/orders/${first.orderId}/sign`, "POST", { customerSignerName: "Anna Test", customerSignerTitle: "Företrädare", customerSignature: signature, snapshotHash: first.snapshotHash, explicitConfirmation: true }, session.token);
  assert.equal(customerSigned.status, "Aktivt");
  assert.equal(customerSigned.signatureMode, "preapproved-fixed");
  const signedDb = await worker.getD1Database("DB");
  const lockedOrder = await signedDb.prepare("SELECT snapshot_json, snapshot_hash, status FROM self_service_orders WHERE id=?").bind(first.orderId).first();
  const lockedContract = await signedDb.prepare("SELECT contract_version, contract_snapshot_json, contract_snapshot_hash, signed_at, status FROM ad_contracts WHERE id=?").bind(first.contractId).first();
  assert.equal(lockedOrder.status, "confirmed");
  assert.equal(lockedContract.contract_version, "4.2");
  assert.equal(lockedContract.status, "Aktivt");
  assert.ok(lockedContract.signed_at);
  assert.equal(lockedOrder.snapshot_json, lockedContract.contract_snapshot_json);
  assert.equal(lockedOrder.snapshot_hash, first.snapshotHash);
  assert.equal(lockedContract.contract_snapshot_hash, first.snapshotHash);
  assert.equal(createHash("sha256").update(lockedOrder.snapshot_json).digest("hex"), first.snapshotHash);
  await read(`/portal/admin/contracts/${first.contractId}/sign`, "POST", { dinpulsSignerName: "DinPuls Test", dinpulsSignerTitle: "Företrädare", dinpulsSignature: signature, snapshotHash: first.snapshotHash }, admin.token, 409);
  const signedCopy = await send(`/portal/company/contracts/${first.contractId}/pdf`, "GET", null, session.token);
  assert.equal(signedCopy.status, 200);
  assert.ok((await signedCopy.arrayBuffer()).byteLength > 2000, "Signerad PDF saknas");
  const firstPurchases = await read("/portal/company/purchases", "GET", null, session.token);
  assert.equal(firstPurchases.purchases.length, 2);
  assert.equal(new Set(firstPurchases.purchases.map(item => item.municipality)).size, 2);
  assert.ok(firstPurchases.purchases.every(item => item.foundation_contract_id === first.contractId));
  const amalPurchase = firstPurchases.purchases.find(item => item.municipality === "Åmål");
  assert.equal(amalPurchase.slot_id, "P3-21");
  assert.equal(amalPurchase.start_date, start);
  const testDbBeforeBanner = await worker.getD1Database("DB");
  const foundPurchase = await testDbBeforeBanner.prepare("SELECT id FROM self_service_purchases WHERE company_user_id=(SELECT company_user_id FROM self_service_orders WHERE id=?) AND foundation_contract_id=? AND municipality='Åmål' AND slot_id='P3-21' AND start_date<=? AND end_date>=?").bind(first.orderId, first.contractId, start, start).first();
  assert.equal(foundPurchase?.id, amalPurchase.id);
  const bannerBytes = Buffer.from(signature.split(",")[1], "base64");
  const bannerTime = new Date(Date.now() - 60_000).toISOString();
  const bannerResponse = await worker.dispatchFetch(`${endpoint}/portal/company/banners`, { method: "POST", headers: {
    Authorization: `Bearer ${session.token}`, "Content-Type": "image/png", "Content-Length": String(bannerBytes.length),
    "X-Banner-Slot": "P3-21", "X-Banner-Municipality": "%C3%85m%C3%A5l", "X-Banner-Start": bannerTime,
    "X-Banner-Name": "test.png", "X-Banner-Link": "https%3A%2F%2Fexample.invalid"
  }, body: bannerBytes });
  const bannerBody = await bannerResponse.json();
  assert.equal(bannerResponse.status, 201, JSON.stringify(bannerBody));
  assert.equal((await send(`/portal/company/banners/${bannerBody.banner.id}`, "DELETE", null, buyer.token)).status, 404, "En annan kund får inte hantera bannern");
  const beforeActivation = await read("/ads/current/P3-21?municipality=%C3%85m%C3%A5l");
  assert.equal(beforeActivation.banner, null, "Ogranskad banner får inte visas live");
  await read(`/portal/admin/banners/${bannerBody.banner.id}/review`, "PATCH", { approvalStatus: "approved", reviewComment: "Pilot godkänd" }, admin.token);
  const db = await worker.getD1Database("DB");
  const companyRow = await db.prepare("SELECT company_user_id FROM self_service_orders WHERE id=?").bind(first.orderId).first();
  const basis = await read(`/portal/admin/billing/basis?companyId=${companyRow.company_user_id}`, "GET", null, admin.token);
  assert.equal(basis.purchaseCount, 1);
  assert.equal(basis.basis.net, 5000);
  assert.equal(basis.spirisEnabled, false);
  const published = await read("/ads/current/P3-21?municipality=%C3%85m%C3%A5l");
  assert.equal(published.banner?.purchaseId, amalPurchase.id);
  assert.equal((await read("/ads/current/P3-21?municipality=S%C3%A4ffle")).banner, null, "Kommunernas banners får inte blandas ihop");
  const firstMe = await read("/portal/company/me", "GET", null, session.token);
  assert.equal(firstMe.contract?.id, first.contractId);
  const extra = await read("/portal/company/orders", "POST", { placements: [{ municipality: "Säffle", slotId: "P3-22", startDate: start, endDate: end }], billingType: "monthly" }, session.token, 201);
  assert.equal(extra.snapshot.contractVersion, "4.2");
  assert.deepEqual(extra.snapshot.terms, V42_TERMS);
  assert.equal(extra.snapshot.placements[0].vatAmount, 125);
  await read(`/portal/company/orders/${extra.orderId}/confirm`, "POST", { explicitConfirmation: true, snapshotHash: extra.snapshotHash }, session.token);
  const extraRecord = await signedDb.prepare("SELECT confirmation_json, confirmation_hash FROM self_service_purchases WHERE order_id=? LIMIT 1").bind(extra.orderId).first();
  assert.equal(JSON.parse(extraRecord.confirmation_json).snapshotHash, extra.snapshotHash);
  assert.equal(createHash("sha256").update(extraRecord.confirmation_json).digest("hex"), extraRecord.confirmation_hash);
  assert.equal((await signedDb.prepare("SELECT COUNT(*) count FROM ad_contracts WHERE company_user_id=(SELECT company_user_id FROM self_service_orders WHERE id=?)").bind(first.orderId).first()).count, 1, "Tilläggsköp får inte skapa nytt grundavtal");
  await read("/portal/company/foundation/orders", "POST", { placements: [{ municipality: "Åmål", slotId: "P3-22", startDate: start, endDate: end }], billingType: "annual" }, session.token, 409);
  const raceLine = [{ municipality: "Åmål", slotId: "P1-07", startDate: start, endDate: end }];
  const buyerHold = await read("/portal/company/orders", "POST", { placements: raceLine, billingType: "annual" }, buyer.token, 201);
  await read("/portal/company/orders", "POST", { placements: raceLine, billingType: "annual" }, session.token, 409);
  await db.prepare("UPDATE self_service_orders SET expires_at='2020-01-01T00:00:00.000Z' WHERE id=?").bind(buyerHold.orderId).run();
  await db.prepare("UPDATE self_service_holds SET expires_at='2020-01-01T00:00:00.000Z' WHERE order_id=?").bind(buyerHold.orderId).run();
  const secondHold = await read("/portal/company/orders", "POST", { placements: raceLine, billingType: "annual" }, session.token, 201);
  await read(`/portal/company/orders/${buyerHold.orderId}/confirm`, "POST", { explicitConfirmation: true, snapshotHash: buyerHold.snapshotHash }, buyer.token, 409);
  await read(`/portal/company/orders/${secondHold.orderId}/confirm`, "POST", { explicitConfirmation: true, snapshotHash: secondHold.snapshotHash }, session.token);
  await read("/portal/company/orders", "POST", { placements: raceLine, billingType: "annual" }, buyer.token, 409);
  const simultaneous = [{ municipality: "Säffle", slotId: "P1-08", startDate: start, endDate: end }];
  const competingResponses = await Promise.all([buyer.token, session.token].map(t => send("/portal/company/orders", "POST", { placements: simultaneous, billingType: "annual" }, t)));
  assert.deepEqual(competingResponses.map(response => response.status).sort(), [201, 409], "Exakt ett av två samtidiga företag får reservera samma plats");
  console.log("Självservice Worker: registrering, mejl, engångstoken, login, flera kommuner och upptagna platser OK");
} finally { await worker.dispose(); }
