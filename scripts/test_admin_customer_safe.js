const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("admin/index.html", "utf8");
const script = fs.readFileSync("admin/admin.js", "utf8");

assert.match(html, /data-new-contract="1"[^>]*><i>＋<\/i>Nytt avtal/);
assert.match(html, /data-view="overview"><i>⌂<\/i>Kontrollpanel/);
assert.match(html, /data-view="contracts"><i>▤<\/i>CRM \/ Avtal/);
assert.match(html, /<section id="overview" class="view" hidden>/);
assert.match(html, /<section id="new-contract" class="view">/);

const newContractStart = html.indexOf('<section id="new-contract"');
const contractsStart = html.indexOf('<section id="contracts"');
assert(newContractStart >= 0 && contractsStart > newContractStart);
assert(html.slice(newContractStart, contractsStart).includes('id="contractForm"'));
assert(!html.slice(contractsStart, html.indexOf('<section id="companies"')).includes('id="contractForm"'));

assert.match(script, /await Promise\.all\(\[refreshContracts\(\), refreshSystemStatus\(\), refreshOperations\(\)\]\);\s*openNewContract\(\);/);
assert.match(script, /openView\("new-contract"\)/);

console.log("Admin öppnar en kundsäker Nytt avtal-vy och håller KPI/CRM bakom separata menyval");
