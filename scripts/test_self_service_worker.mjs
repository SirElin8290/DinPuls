import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { normalizeSwedishOrgNumber } from "../cloudflare/swedish-org-number.js";

const bundle = await build({
  entryPoints: [new URL("../cloudflare/push-worker.js", import.meta.url).pathname.replace(/^\/(.:)/, "$1")],
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
  console.log("Självservice Worker: registrering, mejl, engångstoken, login, flera kommuner och upptagna platser OK");
} finally { await worker.dispose(); }
