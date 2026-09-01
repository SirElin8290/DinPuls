import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const bundle = await build({
  entryPoints: [new URL("../cloudflare/push-worker.js", import.meta.url).pathname.replace(/^\/(.:)/, "$1")],
  bundle: true,
  format: "esm",
  platform: "browser",
  plugins: [{
    name: "stub-web-push",
    setup(builder) {
      builder.onResolve({ filter: /^web-push$/ }, () => ({ path: "web-push", namespace: "test-stub" }));
      builder.onLoad({ filter: /.*/, namespace: "test-stub" }, () => ({
        contents: "export default { setVapidDetails() {}, async sendNotification() { return { statusCode: 201 }; } };",
        loader: "js"
      }));
    }
  }],
  write: false
});

const worker = new Miniflare({
  modules: true,
  script: bundle.outputFiles[0].text,
  compatibilityDate: "2026-08-06",
  compatibilityFlags: ["nodejs_compat"],
  bindings: {
    ADMIN_USERNAME: "localadmin",
    ADMIN_PASSWORD: "LocalAdmin-Test-2026",
    PORTAL_PASSWORD_PEPPER: "LocalPepper-Test-2026"
  },
  d1Databases: { DB: "banner-test-db" },
  r2Buckets: ["AD_ASSETS"]
});

const endpoint = "http://dinpuls.test";
const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function request(path, options = {}) {
  return worker.dispatchFetch(`${endpoint}${path}`, options);
}

async function jsonRequest(path, method, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return request(path, { method, headers, body: JSON.stringify(body) });
}

async function responseJson(response, expectedStatus) {
  if (response.status !== expectedStatus) {
    assert.equal(response.status, expectedStatus, await response.text());
  }
  return response.json();
}

try {
  const health = await responseJson(await request("/health"), 200);
  assert.equal(health.database, "connected");
  assert.equal(health.portalConfigured, true);
  assert.equal(health.adAssetsConfigured, true);
  assert.equal(health.portalEmailConfigured, false);
  assert.deepEqual(Object.keys(health).filter(key => /password|secret|token|api.?key|username|private/i.test(key)), [], "Health får inte exponera hemlighetsfält");
  assert.ok(!JSON.stringify(health).includes("LocalAdmin-Test-2026"));

  const admin = await responseJson(await jsonRequest("/portal/auth/admin", "POST", {
    username: "localadmin",
    password: "LocalAdmin-Test-2026"
  }), 200);

  const today = new Date().toISOString().slice(0, 10);
  const contractEnd = new Date(`${today}T12:00:00Z`);
  contractEnd.setUTCFullYear(contractEnd.getUTCFullYear() + 1);
  contractEnd.setUTCDate(contractEnd.getUTCDate() - 1);
  const nextYear = contractEnd.toISOString().slice(0, 10);
  const companyPassword = "Company-Test-2026!";
  const contractId = `DP-${today.slice(0, 4)}-9001`;
  await responseJson(await jsonRequest("/portal/admin/contracts", "POST", {
    id: contractId,
    company: "Åslanda bannerkedjetest",
    orgNo: "000000-0000",
    contact: "Lokalt test",
    email: "banner-test@example.invalid",
    phone: "0000000000",
    municipality: "Årjäng",
    placements: [{ slotId: "SERV-01", module: "Service", group: "Service och hantverk", label: "Test", location: "Service och hantverk", page: "service.html" }],
    billingType: "complimentary",
    valueNote: "Lokalt automatiskt test",
    renewalType: "annual-review",
    termsReviewed: true,
    startDate: today,
    endDate: nextYear
  }, admin.token), 201);

  const signature = `data:image/png;base64,${pngBase64}`;
  const signed = await responseJson(await jsonRequest(`/portal/admin/contracts/${contractId}/sign`, "POST", { customerSignerName: "Kund Test", customerSignerTitle: "Behörig företrädare", dinpulsSignerName: "DinPuls Test", dinpulsSignerTitle: "Företrädare", customerSignature: signature, dinpulsSignature: signature }, admin.token), 200);
  assert.equal(signed.status, "Aktivt");
  assert.match(signed.snapshotHash, /^[0-9a-f]{64}$/);
  assert.match(signed.pdfHash, /^[0-9a-f]{64}$/);
  const adminPdf = await request(`/portal/admin/contracts/${contractId}/pdf`, { headers: { Authorization: `Bearer ${admin.token}` } });
  assert.equal(adminPdf.status, 200); assert.equal(adminPdf.headers.get("content-type"), "application/pdf");
  const adminPdfBytes = Buffer.from(await adminPdf.arrayBuffer());
  assert.equal(adminPdfBytes.subarray(0, 4).toString(), "%PDF");
  if (process.env.DINPULS_TEST_PDF_PATH) await writeFile(process.env.DINPULS_TEST_PDF_PATH, adminPdfBytes);
  assert.equal((await request(`/portal/admin/contracts/${contractId}/pdf`)).status, 401, "PDF får aldrig vara publik");
  const conflictingId = `DP-${today.slice(0, 4)}-9002`;
  await responseJson(await jsonRequest("/portal/admin/contracts", "POST", { id: conflictingId, company: "Krocktest", orgNo: "111111-1111", contact: "Krock", email: "collision@example.invalid", phone: "000", municipality: "Årjäng", placements: [{ slotId: "SERV-01", module: "Service", group: "Service och hantverk", label: "Test", location: "Service och hantverk", page: "service.html" }], billingType: "monthly", valueNote: "", renewalType: "annual-review", termsReviewed: true, startDate: today, endDate: nextYear }, admin.token), 201);
  await responseJson(await jsonRequest(`/portal/admin/contracts/${conflictingId}/sign`, "POST", { customerSignerName: "Krock", customerSignerTitle: "VD", dinpulsSignerName: "DinPuls Test", dinpulsSignerTitle: "Företrädare", customerSignature: signature, dinpulsSignature: signature }, admin.token), 409);
  const database = await worker.getD1Database("DB");
  const serverPriced = await database.prepare("SELECT price, monthly_total, annual_total, status FROM ad_contracts WHERE id=?").bind(conflictingId).first();
  assert.deepEqual([Number(serverPriced.price), Number(serverPriced.monthly_total), Number(serverPriced.annual_total), serverPriced.status], [500, 500, 6000, "Utkast"], "Månadspris och totalsummor ska räknas på servern och krockande avtal får inte aktiveras");
  const user = await database.prepare("SELECT id, active FROM business_users WHERE email = ?").bind("banner-test@example.invalid").first();
  assert.equal(Number(user.active), 0, "Nya konton ska inte vara aktiva innan lösenordet valts");
  const tokenCount = await database.prepare("SELECT COUNT(*) AS count FROM portal_activation_tokens WHERE company_user_id = ? AND purpose = 'activate-account' AND used_at IS NULL").bind(user.id).first();
  assert.equal(Number(tokenCount.count), 1, "Aktivering ska skapa exakt en aktiv token");
  await jsonRequest(`/portal/admin/contracts/${contractId}/sign`, "POST", { customerSignerName: "Kund Test", customerSignerTitle: "Behörig företrädare", dinpulsSignerName: "DinPuls Test", dinpulsSignerTitle: "Företrädare", customerSignature: signature, dinpulsSignature: signature }, admin.token);
  const tokenCountAfterDuplicate = await database.prepare("SELECT COUNT(*) AS count FROM portal_activation_tokens WHERE company_user_id = ? AND purpose = 'activate-account' AND used_at IS NULL").bind(user.id).first();
  assert.equal(Number(tokenCountAfterDuplicate.count), 1, "Dubbel statusuppdatering får inte skapa flera aktiveringstoken");

  const activationToken = "a".repeat(64);
  const activationHash = createHash("sha256").update(activationToken).digest("hex");
  await database.prepare("UPDATE portal_activation_tokens SET token_hash = ? WHERE company_user_id = ? AND purpose = 'activate-account' AND used_at IS NULL").bind(activationHash, user.id).run();
  await responseJson(await jsonRequest("/portal/account/token/verify", "POST", { token: activationToken, purpose: "activate-account" }), 200);
  await responseJson(await jsonRequest("/portal/account/password", "POST", { token: activationToken, purpose: "activate-account", password: companyPassword, passwordConfirmation: companyPassword }), 200);
  await responseJson(await jsonRequest("/portal/account/password", "POST", { token: activationToken, purpose: "activate-account", password: companyPassword, passwordConfirmation: companyPassword }), 409);
  await responseJson(await jsonRequest("/portal/account/token/verify", "POST", { token: "f".repeat(64), purpose: "activate-account" }), 404);

  let company = await responseJson(await jsonRequest("/portal/auth/company", "POST", {
    email: "banner-test@example.invalid",
    password: companyPassword
  }), 200);

  const expiredToken = "b".repeat(64);
  await database.prepare("INSERT INTO portal_activation_tokens (id, company_user_id, token_hash, purpose, expires_at, used_at, created_at) VALUES (?, ?, ?, 'reset-password', ?, NULL, ?)")
    .bind(crypto.randomUUID(), user.id, createHash("sha256").update(expiredToken).digest("hex"), new Date(Date.now() - 1000).toISOString(), new Date(Date.now() - 3600000).toISOString()).run();
  await responseJson(await jsonRequest("/portal/account/token/verify", "POST", { token: expiredToken, purpose: "reset-password" }), 410);

  const resetRequest = await responseJson(await jsonRequest("/portal/account/reset/request", "POST", { email: "banner-test@example.invalid" }), 200);
  assert.match(resetRequest.message, /Om adressen finns/);
  const resetToken = "c".repeat(64);
  await database.prepare("UPDATE portal_activation_tokens SET token_hash = ? WHERE company_user_id = ? AND purpose = 'reset-password' AND used_at IS NULL AND expires_at > ?").bind(createHash("sha256").update(resetToken).digest("hex"), user.id, new Date().toISOString()).run();
  const resetPassword = "Changed-Company-2026!";
  await responseJson(await jsonRequest("/portal/account/reset/complete", "POST", { token: resetToken, password: resetPassword, passwordConfirmation: resetPassword }), 200);
  company = await responseJson(await jsonRequest("/portal/auth/company", "POST", { email: "banner-test@example.invalid", password: resetPassword }), 200);
  const companyPdf = await request(`/portal/company/contracts/${contractId}/pdf`, { headers: { Authorization: `Bearer ${company.token}` } });
  assert.equal(companyPdf.status, 200, "Företaget ska kunna hämta samma signerade PDF");

  const png = Buffer.from(pngBase64, "base64");
  const upload = async (name, startAt, targetUrl) => responseJson(await request("/portal/company/banners", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${company.token}`,
      "Content-Type": "image/png",
      "Content-Length": String(png.byteLength),
      "X-Banner-Slot": "SERV-01",
      "X-Banner-Start": startAt,
      "X-Banner-Name": encodeURIComponent(name),
      "X-Banner-Link": encodeURIComponent(targetUrl)
    },
    body: png
  }), 201);

  const first = await upload("gammal-banner.png", new Date(Date.now() - 60_000).toISOString(), "https://example.com/gammal");
  const switchTime = new Date(Date.now() + 1_500).toISOString();
  const second = await upload("ny-banner.png", switchTime, "https://example.com/ny");

  const beforeSwitch = await responseJson(await request("/ads/current/SERV-01?municipality=%C3%85rj%C3%A4ng"), 200);
  assert.equal(beforeSwitch.banner.id, first.banner.id, "Den gamla bannern ska ligga kvar före bytestiden");
  assert.equal(beforeSwitch.banner.targetUrl, "https://example.com/gammal");

  await new Promise(resolve => setTimeout(resolve, 1_700));
  const afterSwitch = await responseJson(await request("/ads/current/SERV-01?municipality=%C3%85rj%C3%A4ng"), 200);
  assert.equal(afterSwitch.banner.id, second.banner.id, "Den nya bannern ska visas efter bytestiden");
  assert.equal(afterSwitch.banner.targetUrl, "https://example.com/ny");

  const third = await upload("tre.png", new Date(Date.now() - 900).toISOString(), "https://example.com/tre");
  const fourth = await upload("fyra.png", new Date(Date.now() - 800).toISOString(), "https://example.com/fyra");
  const fifth = await upload("fem.png", new Date(Date.now() - 700).toISOString(), "https://example.com/fem");
  await responseJson(await request("/ads/current/SERV-01?municipality=%C3%85rj%C3%A4ng"), 200);
  const publicationRows = await database.prepare("SELECT id, published_at FROM ad_banners WHERE contract_id=? AND slot_id='SERV-01' ORDER BY start_at").bind(contractId).all();
  assert.equal(publicationRows.results.filter(row => row.published_at).length, 4, "Bara fyra byten får publiceras i samma 30-dagarsperiod");
  assert.equal(publicationRows.results.find(row => row.id === fifth.banner.id).published_at, null, "Det femte materialet ska förbli opublicerat");

  const asset = await request(second.banner.imageUrl);
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await asset.arrayBuffer()), png);

  await responseJson(await jsonRequest("/ads/events", "POST", { bannerId: second.banner.id, eventType: "impression" }), 202);
  await responseJson(await jsonRequest("/ads/events", "POST", { bannerId: second.banner.id, eventType: "click" }), 202);
  const stats = await responseJson(await request("/portal/company/stats", { headers: { Authorization: `Bearer ${company.token}` } }), 200);
  assert.equal(stats.impressions, 1);
  assert.equal(stats.clicks, 1);
  assert.equal(stats.ctr, 100);

  console.log("Onboarding och bannerkedja godkända: engångstoken, aktivering, återställning, inloggning, R2, schemabyte och statistik.");
} finally {
  await worker.dispose();
}
