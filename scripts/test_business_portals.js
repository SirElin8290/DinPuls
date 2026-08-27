const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin/admin.js"), "utf8");
const company = fs.readFileSync(path.join(root, "foretag/foretag.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "cloudflare/push-worker.js"), "utf8");
const config = JSON.parse(fs.readFileSync(path.join(root, "data/business-config.json"), "utf8"));

for (const [name, source] of [["admin", admin], ["företag", company]]) {
  assert(!source.includes("localStorage"), `${name}: verkliga portaldata får inte lagras i localStorage`);
  assert(!/PASSWORD\s*=|EXPECTED_PASSWORD|DEMO_PASSWORD|ADMIN_USER/.test(source), `${name}: klientkoden får inte innehålla inloggningsuppgifter`);
  assert(source.includes("Authorization"), `${name}: API-anrop måste använda behörig session`);
  assert(source.includes("business-config.json"), `${name}: API-adressen ska läsas centralt`);
}

assert(worker.includes('name: "PBKDF2"') && worker.includes("PASSWORD_ITERATIONS = 120000"), "Företagslösenord måste använda PBKDF2");
assert(worker.includes("crypto.getRandomValues(new Uint8Array(32))"), "Sessioner måste använda kryptografiskt slumpade nycklar");
assert(worker.includes("login_attempts") && worker.includes("attempts) >= 8"), "Inloggning måste begränsa upprepade försök");
assert(worker.includes("portal_sessions") && worker.includes("await sha256(token)"), "Endast hashade sessionsnycklar får lagras");
assert(worker.includes("env.ADMIN_USERNAME") && worker.includes("env.ADMIN_PASSWORD"), "Adminuppgifter ska komma från Cloudflare-secrets");
assert(worker.includes('/portal/auth/admin') && worker.includes('/portal/auth/company'), "Båda säkra inloggningsvägarna måste finnas");
assert(worker.includes('/portal/admin/contracts') && worker.includes('/portal/company/me'), "Rollseparerade portalvägar måste finnas");
assert(config.enabled === true && /^https:\/\//.test(config.apiBase), "Företagsportalen måste ha en säker API-adress");

console.log("✓ Admin- och företagsportalen saknar klientlösenord och använder rollseparerad Worker/D1-auth");
