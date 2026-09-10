const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("admin/index.html", "utf8");
const script = fs.readFileSync("admin/admin.js", "utf8");
const css = fs.readFileSync("admin/admin.css", "utf8");
const health = JSON.parse(fs.readFileSync("data/system-health.json", "utf8"));

assert.match(html, /data-view="operations"/);
assert.match(html, /id="operationsContent"/);
assert.match(script, /system-health\.json/);
assert.match(script, /Aktiva problem/);
assert.match(css, /@media\(max-width:430px\)/);
assert.match(css, /municipality-health-grid/);
assert.equal(Object.keys(health.municipalities).length, 21);
assert.equal(Object.values(health.summary).reduce((sum, count) => sum + count, 0), 231);

console.log("Admin kan läsa 21 kommuners driftstatus och har mobilanpassade kort");
