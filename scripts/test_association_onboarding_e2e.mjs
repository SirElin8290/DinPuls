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
  const db = await worker.getD1Database("DB"), now = "2026-09-28T10:00:00.000Z", future = "2027-09-28T10:00:00.000Z";
  await db.prepare("INSERT INTO business_users(id,email,password_salt,password_hash,company,org_no,contact,phone,municipality,active,created_at,updated_at) VALUES(1,'pilot@example.invalid','s','h','Pilotbolaget','559999-0001','Pilot','','Åmål',1,?,?)").bind(now,now).run();
  await db.prepare("INSERT INTO ad_contracts(id,company_user_id,contract_version,municipality,placements,price,annual_price,monthly_total,annual_total,billing_type,start_date,end_date,status,created_at,updated_at) VALUES('contract-test',1,'4.2','Åmål','[]',800,8000,800,8000,'monthly','2026-09-01','2027-08-31','Aktivt',?,?)").bind(now,now).run();
  for(const [orderId,purchaseId,slotId,price] of [["order-month","purchase-month","FA-1-1643-fightclub-if",800],["order-year","purchase-year","FA-2-1643-fightclub-if",8000]]){
    await db.prepare("INSERT INTO self_service_orders(id,company_user_id,foundation_contract_id,billing_type,snapshot_json,snapshot_hash,status,expires_at,confirmed_at,created_at) VALUES(?,1,'contract-test','monthly','{}','hash','confirmed',?,?,?)").bind(orderId,future,now,now).run();
    await db.prepare("INSERT INTO self_service_holds(order_id,company_user_id,municipality,slot_id,start_date,end_date,status,expires_at,created_at) VALUES(?,1,'Åmål',?,'2026-09-01','2027-08-31','held',?,?)").bind(orderId,slotId,future,now).run();
    await db.prepare("INSERT INTO billing_approvals(order_id,company_user_id,foundation_contract_id,basis_json,basis_hash,status,approved_by,approved_at,idempotency_key,created_at,updated_at) VALUES(?,1,'contract-test','{}','basis','approved','admin',?, ?,?,?)").bind(orderId,now,`approval-${orderId}`,now,now).run();
    await db.prepare("INSERT INTO self_service_purchases(id,order_id,company_user_id,foundation_contract_id,municipality,slot_id,placement_label,billing_type,unit_price,vat_amount,start_date,end_date,contract_version,billing_status,publication_status,confirmation_json,confirmation_hash,confirmed_at) VALUES(?,?,1,'contract-test','Åmål',?,'Föreningsannons','monthly',?,0,'2026-09-01','2027-08-31','4.2','ready_for_invoice','active','{}','confirmation',?)").bind(purchaseId,orderId,slotId,price,now).run();
  }
  const monthlyPayment=await read('/portal/admin/associations/payments','POST',{paymentId:'pay-month',invoiceId:'inv-month',orderId:'order-month',paidExVatOre:80000,paidAt:now,source:'sandbox'},adminSession.token,201);assert.equal(monthlyPayment.shareOre,12000);
  const annualPayment=await read('/portal/admin/associations/payments','POST',{paymentId:'pay-year',invoiceId:'inv-year',orderId:'order-year',paidExVatOre:800000,paidAt:now,source:'sandbox'},adminSession.token,201);assert.equal(annualPayment.shareOre,120000);
  const duplicatePayment=await read('/portal/admin/associations/payments','POST',{paymentId:'pay-year',invoiceId:'inv-year',orderId:'order-year',paidExVatOre:800000,paidAt:now,source:'sandbox'},adminSession.token);assert.equal(duplicatePayment.idempotent,true);
  let economy=await read('/portal/admin/associations/ledger','GET',null,adminSession.token);let fightclub=economy.associations.find(item=>item.association_slug==='1643-fightclub-if');assert.equal(Number(fightclub.balance_ore),132000);
  await read('/portal/admin/associations/payouts','POST',{municipality:'Åmål',associationSlug:'1643-fightclub-if',amountOre:10000,occurredAt:now,reference:'Testutbetalning'},adminSession.token);
  economy=await read('/portal/admin/associations/ledger','GET',null,adminSession.token);fightclub=economy.associations.find(item=>item.association_slug==='1643-fightclub-if');assert.equal(Number(fightclub.balance_ore),122000);
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
  const invited = await read(`/portal/association/admins?${query}`, "POST", { name: "Bertil Test", email: "bertil@example.invalid", role: "Kassör" }, accountSession.token, 201); assert.equal(invited.status, "pending");
  const invitedAgain = await read(`/portal/association/admins?${query}`, "POST", { name: "Bertil Test", email: "bertil@example.invalid", role: "Kassör" }, accountSession.token); assert.equal(invitedAgain.idempotent, true);
  const invitedClaims = await read("/portal/admin/associations/claims", "GET", null, adminSession.token); assert.equal(invitedClaims.claims.length, 2);
  const change = await read(`/portal/association/change-requests?${query}`, "POST", { field: "name", value: "1643 Fightclub IF Åmål" }, accountSession.token, 201);
  let unchanged = await read(`/associations/profile?${query}`, "GET"); assert.equal(unchanged.profile.name, "1643 Fightclub IF");
  const changes = await read("/portal/admin/associations/change-requests", "GET", null, adminSession.token); assert.equal(changes.requests[0].id, change.id);
  await read(`/portal/admin/associations/change-requests/${change.id}`, "PATCH", { status: "approved", comment: "Verifierat" }, adminSession.token);
  const changed = await read(`/associations/profile?${query}`, "GET"); assert.equal(changed.profile.name, "1643 Fightclub IF Åmål");
  const report = await read(`/portal/association/sport-reports?${query}`, "POST", { type: "Tabell", subject: "Fel placering", comment: "Tabellen visar fel rad", proposedValue: "Kontrollera serien" }, accountSession.token, 201);
  const reports = await read("/portal/admin/associations/sport-reports", "GET", null, adminSession.token); assert.equal(reports.reports[0].id, report.id);
  await read(`/portal/admin/associations/sport-reports/${report.id}`, "PATCH", { status: "resolved", comment: "Rättad" }, adminSession.token);
  const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
  const mediaResponse = await worker.dispatchFetch(`http://dinpuls.test/portal/association/media?${query}`, { method: "POST", headers: { Authorization: `Bearer ${accountSession.token}`, "Content-Type": "image/png", "Content-Length": String(png.length), "X-Association-Media-Type": "logo", "X-Association-File-Name": "logo.png" }, body: png });
  const mediaText = await mediaResponse.text(); assert.equal(mediaResponse.status, 201, mediaText); const media = JSON.parse(mediaText);
  await read(`/portal/admin/associations/media/${media.id}/review`, "PATCH", { status: "approved", comment: "Godkänd" }, adminSession.token);
  assert.equal((await worker.dispatchFetch(`http://dinpuls.test/associations/media/${media.id}`)).status, 200);
  await read(`/portal/association/media/${media.id}`, "DELETE", null, accountSession.token);
  assert.equal((await worker.dispatchFetch(`http://dinpuls.test/associations/media/${media.id}`)).status, 404);
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
  console.log("✓ Föreningskonto E2E: registrering, flera administratörer, moderering, media, sportfel, persistence, isolering och lösenordsåterställning");
} finally { await worker.dispose(); }
