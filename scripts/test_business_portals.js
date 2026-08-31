const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin/admin.js"), "utf8");
const company = fs.readFileSync(path.join(root, "foretag/foretag.js"), "utf8");
const account = fs.readFileSync(path.join(root, "foretag/konto.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "cloudflare/push-worker.js"), "utf8");
const contractV4 = fs.readFileSync(path.join(root, "cloudflare/contract-v4.js"), "utf8");
const config = JSON.parse(fs.readFileSync(path.join(root, "data/business-config.json"), "utf8"));

for (const [name, source] of [["admin", admin], ["företag", company]]) {
  assert(!source.includes("localStorage"), `${name}: verkliga portaldata får inte lagras i localStorage`);
  assert(!/PASSWORD\s*=|EXPECTED_PASSWORD|DEMO_PASSWORD|ADMIN_USER/.test(source), `${name}: klientkoden får inte innehålla inloggningsuppgifter`);
  assert(source.includes("Authorization"), `${name}: API-anrop måste använda behörig session`);
  assert(source.includes("business-config.json"), `${name}: API-adressen ska läsas centralt`);
}

assert(worker.includes('name: "HMAC"') && worker.includes('hash: "SHA-256"') && worker.includes("env.PORTAL_PASSWORD_PEPPER"), "Företagslösenord måste använda saltad HMAC-SHA-256 med separat serverhemlighet");
assert(worker.includes("crypto.getRandomValues(new Uint8Array(32))"), "Sessioner måste använda kryptografiskt slumpade nycklar");
assert(worker.includes("login_attempts") && worker.includes("attempts) >= 8"), "Inloggning måste begränsa upprepade försök");
assert(worker.includes("portal_sessions") && worker.includes("await sha256(token)"), "Endast hashade sessionsnycklar får lagras");
assert(worker.includes("env.ADMIN_USERNAME") && worker.includes("env.ADMIN_PASSWORD"), "Adminuppgifter ska komma från Cloudflare-secrets");
assert(worker.includes('/portal/auth/admin') && worker.includes('/portal/auth/company'), "Båda säkra inloggningsvägarna måste finnas");
assert(worker.includes('/portal/admin/contracts') && worker.includes('/portal/company/me'), "Rollseparerade portalvägar måste finnas");
assert(worker.includes('billing_type') && worker.includes('signature_required') && worker.includes('renewal_type'), "Avtal måste stödja debitering, signaturval och förnyelse");
assert(worker.includes('portalAuthVersion: "hmac-sha256-v1"'), "Worker-hälsan måste ange portalens autentiseringsversion");
assert(worker.includes("portal_activation_tokens") && worker.includes("activate-account") && worker.includes("reset-password"), "Aktivering och återställning måste använda permanenta engångstoken i D1");
assert(worker.includes("await sha256(token)") && !account.includes("RESEND_API_KEY") && !account.includes("PORTAL_PASSWORD_PEPPER"), "Token ska hash-lagras och inga hemligheter får finnas i frontend");
assert(worker.includes("ACCOUNT_TOKEN_HOURS = 48") && worker.includes("used_at IS NULL"), "Kontolänkar ska gälla 48 timmar och vara engångslänkar");
assert(worker.includes("RESEND_API_KEY") && worker.includes("PORTAL_EMAIL_FROM"), "Transaktionell e-post ska använda Cloudflare-miljövariabler/secrets");
assert((contractV4.match(/"title": "\d+\./g) || []).length === 14 && contractV4.includes("Fyra gånger per påbörjad 30-dagarsperiod") === false && contractV4.includes("upp till fyra gånger per påbörjad 30-dagarsperiod"), "v4 måste innehålla alla 14 beslutade villkorspunkter");
assert(worker.includes("contract_snapshot_hash") && worker.includes("signed_pdf_hash") && worker.includes("prevent_contract_slot_overlap"), "v4 ska hash-låsas, PDF-arkiveras och skyddas mot platskrockar");
assert(worker.includes("Välkommen till DinPuls – ert signerade annonsavtal") && worker.includes("attachments"), "Det signerade avtalet ska skickas i ett separat PDF-mejl");
assert(worker.includes("resendSignedContractEmail") && worker.includes("contractEmailMatch") && admin.includes("Skicka avtalskopia igen"), "Admin måste kunna skicka om den signerade avtalskopian utan att ändra avtalet");
assert(worker.includes("isTwelveMonthContract") && worker.includes("Avtalsperioden måste vara exakt 12 månader"), "Backend måste validera exakt 12 månaders avtalsperiod");
assert(!admin.includes("temporaryPassword") && !fs.readFileSync(path.join(root, "admin/index.html"), "utf8").includes("temporaryPassword"), "Admin ska inte tilldela företagslösenord");
assert(fs.readFileSync(path.join(root, "foretag/index.html"), "utf8").includes('href="konto.html"') && account.includes('/portal/account/reset/request'), "Glömt lösenord ska använda det riktiga återställningsflödet");
assert(admin.includes('Aktivera utan signatur'), "Admin måste kunna aktivera avtal som inte kräver signatur");
assert(company.includes('Kostnadsfri annonsplats'), "Företagsportalen måste visa kostnadsfria avtal korrekt");
assert(worker.includes("CREATE TABLE IF NOT EXISTS ad_banners"), "Bannerplanering måste lagras centralt i D1");
assert(worker.includes("env.AD_ASSETS.put") && worker.includes("imageTypeMatches"), "Bannerbilder måste verifieras och lagras i privat R2");
assert(worker.includes('/portal/company/banners') && worker.includes('currentBanner(request, env'), "Företags- och publik banner-API måste finnas");
assert(worker.includes("CREATE TABLE IF NOT EXISTS ad_daily_stats") && worker.includes('/portal/company/stats') && worker.includes('/ads/events'), "Daglig annonsstatistik måste lagras centralt och visas för företaget");
assert(company.includes('/pdf') && company.includes('Avtalet förnyas inte automatiskt'), "Företaget måste kunna hämta den signerade PDF-kopian");
for (const id of [...company.matchAll(/\$\("#([A-Za-z][\w-]*)"\)/g)].map(match => match[1])) {
  assert(fs.readFileSync(path.join(root, "foretag/index.html"), "utf8").includes(`id="${id}"`), `Företagsportalen hänvisar till ett HTML-fält som saknas: ${id}`);
}
assert(company.includes('X-Banner-Start') && company.includes('Europe/Stockholm'), "Företagsportalen måste schemalägga och visa svensk tid");
assert(worker.includes('BANNER_CHANGE_LIMIT'), "Högst fyra verkliga bannerbyten ska tillåtas per annonsplats och period");
assert(config.enabled === true && /^https:\/\//.test(config.apiBase), "Företagsportalen måste ha en säker API-adress");

console.log("✓ Admin- och företagsportalen saknar klientlösenord och använder rollseparerad Worker/D1-auth");
