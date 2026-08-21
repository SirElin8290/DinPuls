const fs = require("fs");
const assert = require("assert");

const worker = fs.readFileSync("cloudflare/push-worker.js", "utf8");
const config = fs.readFileSync("wrangler.jsonc", "utf8");

const municipalities = JSON.parse(fs.readFileSync("data/municipalities.json", "utf8")).municipalities.map(item => item.name);
for (const municipality of municipalities) {
  assert(worker.includes(`"${municipality}"`), `Kommun saknas i pushservern: ${municipality}`);
}
for (const category of ["extreme-weather", "missing-people", "important"]) {
  assert(worker.includes(`"${category}"`), `Obligatorisk kategori saknas: ${category}`);
}
assert(worker.includes('"https://dinpuls.se"'));
assert(worker.includes('url.pathname === "/health"'));
assert(worker.includes('url.pathname === "/subscriptions"'));
assert(worker.includes('url.pathname === "/config"'));
assert(worker.includes('url.pathname === "/admin/test"'));
assert(worker.includes("webpush.sendNotification"));
assert(config.includes('"binding": "DB"'));
assert(config.includes('"database_name": "dinpuls-push-db"'));
assert(config.includes('"database_id": "2745e92f-51a3-448d-9a49-eb1a89a076c0"'));
assert(config.includes('"nodejs_compat"'));
assert(config.includes('"keep_vars": true'));
console.log("✓ Worker-konfigurationen bevarar D1-bindningen och kommunfiltreringen");
