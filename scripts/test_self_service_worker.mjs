import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { fileURLToPath } from "node:url";
import { normalizeSwedishOrgNumber } from "../cloudflare/swedish-org-number.js";

const bundle = await build({
  entryPoints: [fileURLToPath(new URL("../cloudflare/push-worker.js", import.meta.url))],
  bundle: true, format: "esm", platform: "browser", write: false,
  plugins: [{ name: "stub-web-push", setup(builder) {
    builder.onResolve({ filter: /^web-push$/ }, () => ({ path: "web-push", namespace: "test-stub" }));
    builder.onLoad({ filter: /.*/, namespace: "test-stub" }, () => ({ contents: "export default { setVapidDetails() {}, async sendNotification() { return { statusCode: 201 }; } };", loader: "js" }));
  }}]
});
const mail = [];
const worker = new Miniflare({
  modules: true, script: bundle.outputFiles[0].text,
  compatibilityDate: "2026-08-06", compatibilityFlags: ["nodejs_compat"],
  bindings: { ADMIN_USERNAME: "localadmin", ADMIN_PASSWORD: "LocalAdmin-Test-2026",
    PORTAL_PASSWORD_PEPPER: "LocalPepper-Test-2026", RESEND_API_KEY: "local-test-only",
    PORTAL_EMAIL_FROM: "DinPuls <test@example.invalid>", SELF_SERVICE_SIGNUP_ENABLED: "true",
    SELF_SERVICE_PURCHASE_ENABLED: "true" },
  outboundService: async request => {
    if (request.url !== "https://api.resend.com/emails") throw new Error("Oväntat externt anrop");
    mail.push(await request.json());
    return new Response(JSON.stringify({ id: `mail-${mail.length}` }), { status: 200, headers: { "Content-Type": "application/json" } });
  },
  d1Databases: { DB: "self-service-test-db" }, r2Buckets: ["AD_ASSETS"]
});
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
  const health = await read("/health");
  assert.equal(health.selfServiceSignupEnabled, true);
  assert.equal(health.selfServicePurchaseEnabled, true);
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
  const start = "2026-09-15", end = "2027-09-14";
  const slots = await read(`/portal/company/available-slots?municipality=%C3%85m%C3%A5l&startDate=${start}&endDate=${end}`, "GET", null, session.token);
  assert.ok(slots.slots.some(slot => slot.id === "P1-04" && /Övre annonsblocket.*Plats 4 av 10/.test(slot.displayLabel)));
  assert.equal(slots.pricing.monthlyExVat, 500);
  assert.equal(slots.pricing.annualExVat, 5000);
  await read(`/portal/company/available-slots?municipality=S%C3%A4ffle&startDate=${start}&endDate=${end}`, "GET", null, session.token);
  await read(`/portal/company/available-slots?municipality=%C3%85m%C3%A5l&startDate=${start}&endDate=${end}`, "GET", null, null, 401);
  const admin = await read("/portal/auth/admin", "POST", { username: "localadmin", password: "LocalAdmin-Test-2026" });
  const contractId = "DP-2026-9911";
  await read("/portal/admin/contracts", "POST", { id: contractId, company: "Adminföretag AB", orgNo: "000000-0000",
    contact: "Admin test", email: "admin@example.invalid", phone: "0700000000", municipality: "Åmål",
    placements: [{ slotId: "P1-04", module: "Startsida", group: "premium-ad-1", label: "Plats 4", location: "Övre annonsblocket", page: "index.html" }],
    startDate: start, endDate: end, billingType: "annual", renewalType: "annual-review", termsReviewed: true
  }, admin.token, 201);
  const signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
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
  assert.equal(reserved.snapshot.totals.perInvoiceExVat, 10000);
  assert.equal(reserved.snapshot.totals.perInvoiceVat, 2500);
  assert.equal(reserved.snapshot.totals.perInvoiceInclVat, 12500);
  await read(`/portal/company/orders/${reserved.orderId}/confirm`, "POST", { explicitConfirmation: true, snapshotHash: "wrong" }, buyer.token, 400);
  const confirmed = await read(`/portal/company/orders/${reserved.orderId}/confirm`, "POST", { explicitConfirmation: true, snapshotHash: reserved.snapshotHash }, buyer.token);
  assert.equal(confirmed.purchaseCount, 2);
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
  assert.equal(first.snapshot.contractVersion, "4.1");
  assert.equal(first.snapshot.placements.length, 2);
  assert.equal(first.snapshot.company.address, signup.address);
  assert.equal(first.snapshot.billing.invoiceVat, 2500);
  await read(`/portal/company/foundation/orders/${first.orderId}/sign`, "POST", { customerSignerName: "Anna Test", customerSignerTitle: "Företrädare", customerSignature: signature, snapshotHash: "fel", explicitConfirmation: true }, session.token, 409);
  const customerSigned = await read(`/portal/company/foundation/orders/${first.orderId}/sign`, "POST", { customerSignerName: "Anna Test", customerSignerTitle: "Företrädare", customerSignature: signature, snapshotHash: first.snapshotHash, explicitConfirmation: true }, session.token);
  assert.equal(customerSigned.status, "waiting_for_dinpuls_signature");
  const coSigned = await read(`/portal/admin/contracts/${first.contractId}/sign`, "POST", { dinpulsSignerName: "DinPuls Test", dinpulsSignerTitle: "Företrädare", dinpulsSignature: signature, snapshotHash: first.snapshotHash }, admin.token);
  assert.equal(coSigned.status, "Aktivt");
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
  assert.equal(bannerResponse.status, 201, await bannerResponse.text());
  const beforeActivation = await read("/ads/current/P3-21?municipality=%C3%85m%C3%A5l");
  assert.equal(beforeActivation.banner, null, "Förlanseringsbanner får inte visas live");
  await read(`/portal/admin/purchases/${amalPurchase.id}/activate`, "POST", { explicitActivation: true }, admin.token);
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
