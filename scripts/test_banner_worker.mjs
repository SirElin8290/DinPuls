import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const bundle = await build({
  entryPoints: ["cloudflare/push-worker.js"],
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
  workers: [{
    name: "dinpuls-banner-test",
    config: {
      type: "worker",
      name: "dinpuls-banner-test",
      compatibilityDate: "2026-08-21"
    },
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: "2026-08-21",
    compatibilityFlags: ["nodejs_compat"],
    bindings: {
      ADMIN_USERNAME: "localadmin",
      ADMIN_PASSWORD: "LocalAdmin-Test-2026",
      PORTAL_PASSWORD_PEPPER: "LocalPepper-Test-2026"
    },
    d1Databases: { DB: "banner-test-db" },
    r2Buckets: ["AD_ASSETS"]
  }]
});

const endpoint = "http://dinpuls.test";

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

  const admin = await responseJson(await jsonRequest("/portal/auth/admin", "POST", {
    username: "localadmin",
    password: "LocalAdmin-Test-2026"
  }), 200);

  const today = new Date().toISOString().slice(0, 10);
  const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
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
    price: 0,
    annualPrice: 0,
    monthlyTotal: 0,
    annualTotal: 0,
    billingType: "complimentary",
    valueNote: "Lokalt automatiskt test",
    renewalType: "annual-review",
    signatureRequired: false,
    startDate: today,
    endDate: nextYear,
    temporaryPassword: companyPassword
  }, admin.token), 201);

  await responseJson(await jsonRequest(`/portal/admin/contracts/${contractId}`, "PATCH", { status: "Aktivt" }, admin.token), 200);

  const company = await responseJson(await jsonRequest("/portal/auth/company", "POST", {
    email: "banner-test@example.invalid",
    password: companyPassword
  }), 200);

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
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

  console.log("Bannerkedjan godkänd: R2-uppladdning, schemabyte, gammal banner, klicklänk, visning, klick och CTR.");
} finally {
  await worker.dispose();
}
