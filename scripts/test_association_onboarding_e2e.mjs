import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { fileURLToPath } from "node:url";

const bundle = await build({
  entryPoints: [fileURLToPath(new URL("../cloudflare/push-worker.js", import.meta.url))], bundle: true, format: "esm", platform: "browser", write: false,
  plugins: [{ name: "stub-web-push", setup(builder) { builder.onResolve({ filter: /^web-push$/ }, () => ({ path: "web-push", namespace: "test-stub" })); builder.onLoad({ filter: /.*/, namespace: "test-stub" }, () => ({ contents: "export default { setVapidDetails() {}, async sendNotification() { return { statusCode: 201 }; } };", loader: "js" })); } }]
});
const mail = [];
const worker = new Miniflare({
  modules: true, script: bundle.outputFiles[0].text, compatibilityDate: "2026-08-06", compatibilityFlags: ["nodejs_compat"],
  bindings: { ADMIN_USERNAME: "localadmin", ADMIN_PASSWORD: "LocalAdmin-Test-2026", PORTAL_PASSWORD_PEPPER: "LocalPepper-Test-2026", RESEND_API_KEY: "local-test-only", PORTAL_EMAIL_FROM: "DinPuls <test@example.invalid>", ASSOCIATION_SIGNUP_ENABLED: "true" },
  outboundService: async request => { assert.equal(request.url, "https://api.resend.com/emails"); mail.push(await request.json()); return new Response(JSON.stringify({ id: `mail-${mail.length}` }), { status: 200, headers: { "Content-Type": "application/json" } }); },
  d1Databases: { DB: "association-test-db" }, r2Buckets: ["AD_ASSETS", "CONTRACT_SIGNATURES"]
});
const send = (path, method = "GET", body, token) => worker.dispatchFetch(`http://dinpuls.test${path}`, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
async function read(path, method, body, token, status = 200) { const response = await send(path, method, body, token); const text = await response.text(); assert.equal(response.status, status, text); return JSON.parse(text); }

try {
  const registration = { municipality: "Åmål", associationSlug: "1643-fightclub-if", associationName: "Ett manipulerat namn", contactName: "Anna Test", statedRole: "Ordförande", email: "anna@example.invalid", phone: "0701234567" };
  await read("/portal/association/register", "POST", registration, null, 201);
  assert.equal(mail.length, 1); assert.equal(mail[0].subject, "DinPuls Föreningar – skapa ditt lösenord");
  const token = /#token=([0-9a-f]{64})&purpose=activate-association/.exec(mail[0].text)?.[1]; assert.ok(token, "Aktiveringsmejlet saknar engångslänk");
  await read("/portal/association/token/verify", "POST", { token });
  const password = "Association-Test-2026!";
  const completed = await read("/portal/association/password", "POST", { token, password, passwordConfirmation: password });
  assert.equal(completed.welcome, "sent"); assert.equal(mail.length, 2); assert.equal(mail[1].subject, "Välkommen till DinPuls Föreningar");
  await read("/portal/association/password", "POST", { token, password, passwordConfirmation: password }, null, 409);
  const accountSession = await read("/portal/auth/association", "POST", { email: registration.email, password });
  const account = await read("/portal/association/me", "GET", null, accountSession.token); assert.equal(account.memberships[0].status, "pending");
  const adminSession = await read("/portal/auth/admin", "POST", { username: "localadmin", password: "LocalAdmin-Test-2026" });
  const claims = await read("/portal/admin/associations/claims", "GET", null, adminSession.token); assert.equal(claims.claims.length, 1); assert.equal(claims.claims[0].association_name, "1643 Fightclub IF");
  await read(`/portal/admin/associations/claims/${claims.claims[0].id}`, "PATCH", { status: "verified" }, adminSession.token);
  const verified = await read("/portal/association/me", "GET", null, accountSession.token); assert.equal(verified.memberships[0].status, "verified");
  const query = "municipality=" + encodeURIComponent("Åmål") + "&slug=1643-fightclub-if";
  const dashboard = await read(`/portal/association/dashboard?${query}`, "GET", null, accountSession.token); assert.equal(dashboard.profile.name, "1643 Fightclub IF");
  await read(`/portal/association/profile?${query}`, "PATCH", { description: "Verifierad testbeskrivning", phone: "0532-100 00", tags: ["boxning", "ungdom"], membershipTitle: "Börja träna", membershipText: "Välkommen till oss.", membershipUrl: "https://example.invalid/medlem" }, accountSession.token);
  await read(`/portal/association/posts?${query}`, "PUT", { posts: [{ title: "Öppet hus", eventAt: "2027-01-10T18:00", place: "Klubblokalen", body: "Välkommen", link: "https://example.invalid/oppet-hus" }] }, accountSession.token);
  const persisted = await read(`/portal/association/dashboard?${query}`, "GET", null, accountSession.token); assert.equal(persisted.profile.description, "Verifierad testbeskrivning"); assert.equal(persisted.profile.posts.length, 1);
  const publicProfile = await read(`/associations/profile?${query}`, "GET"); assert.equal(publicProfile.profile.posts[0].title, "Öppet hus");
  await read(`/portal/association/dashboard?municipality=${encodeURIComponent("Åmål")}&slug=bms-aminton`, "GET", null, accountSession.token, 403);
  const audit = await read(`/portal/admin/associations/audit?${query}`, "GET", null, adminSession.token); assert.ok(audit.entries.some(entry => entry.field_name === "description"));
  const secondAccountSession = await read("/portal/auth/association", "POST", { email: registration.email, password });
  await read("/portal/admin/associations/claims", "GET", null, secondAccountSession.token, 401);
  await read("/portal/association/reset/request", "POST", { email: registration.email });
  assert.equal(mail.at(-1).subject, "DinPuls Föreningar – återställ lösenord");
  const resetToken = /#token=([0-9a-f]{64})&purpose=reset-association-password/.exec(mail.at(-1).text)?.[1]; assert.ok(resetToken);
  await read("/portal/association/reset/verify", "POST", { token: resetToken });
  const newPassword = "Association-New-2026!";
  await read("/portal/association/reset/complete", "POST", { token: resetToken, password: newPassword, passwordConfirmation: newPassword });
  await read("/portal/association/me", "GET", null, accountSession.token, 401);
  await read("/portal/auth/association", "POST", { email: registration.email, password: newPassword });
  console.log("✓ Föreningskonto E2E: registrering, mejl, login, verifiering, persistence, isolering och lösenordsåterställning");
} finally { await worker.dispose(); }
