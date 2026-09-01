import assert from "node:assert/strict";

if (process.argv.includes("--full")) {
  console.error("Full-läget är avsiktligt inte automatiserat. Följ docs/FORSTA-KUND-ACCEPTANS.md för en säker manuell acceptanstest.");
  process.exit(2);
}

const site = (process.env.DINPULS_SITE_URL || "https://dinpuls.se").replace(/\/$/, "");
const configResponse = await fetch(`${site}/data/business-config.json`, { headers: { "Cache-Control": "no-cache" } });
assert.equal(configResponse.status, 200, "business-config.json svarar inte med HTTP 200");
const config = await configResponse.json();
assert.equal(config.enabled, true, "Företagsportalen är inte aktiverad");
assert.match(config.apiBase || "", /^https:\/\//, "Worker-URL saknas");
const apiBase = config.apiBase.replace(/\/$/, "");

const healthResponse = await fetch(`${apiBase}/health`, { headers: { "Cache-Control": "no-cache" } });
assert.equal(healthResponse.status, 200, "Worker /health svarar inte med HTTP 200");
const health = await healthResponse.json();
assert.equal(health.ok, true);
assert.equal(health.database, "connected");
assert.equal(health.portalConfigured, true);
assert.equal(health.portalEmailConfigured, true);
assert.equal(health.adAssetsConfigured, true);
const forbidden = /password|secret|token|api.?key|username|private/i;
assert.deepEqual(Object.keys(health).filter(key => forbidden.test(key)), [], "Health-svaret exponerar ett hemlighetsfält");

const bannerResponse = await fetch(`${apiBase}/ads/current/P1-01?municipality=${encodeURIComponent("Åmål")}`, { headers: { Origin: site, "Cache-Control": "no-cache" } });
assert.equal(bannerResponse.status, 200, "Publik bannerendpoint svarar inte med HTTP 200");
const banner = await bannerResponse.json();
assert.equal(banner.ok, true);
assert.ok(Object.hasOwn(banner, "banner"), "Bannerendpoint saknar bannerfält (null är tillåtet)");
console.log(`Produktion smoke-test godkänt: ${site} → ${apiBase}`);
