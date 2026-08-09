const assert = require("node:assert/strict");

require("../dp-safety.js");
const core = require("../dp-core.js");

assert.equal(core.stockholmDateKey("2026-08-09T22:30:00Z"), "2026-08-10");
assert.equal(core.cleanNumber("12.5"), 12.5);
assert.ok(Number.isNaN(core.cleanNumber(9999)));
assert.equal(core.formatRelativeTime("2026-08-09T10:00:00Z", Date.parse("2026-08-09T10:30:00Z")), "30 min sedan");
assert.equal(core.formatRelativeTime("inte ett datum"), "Tid saknas");
assert.equal(core.getInitials("Sveriges Radio"), "SR");
assert.equal(core.formatHousingAvailability("nu"), "Tillgänglig nu");
assert.equal(core.formatEventDate("inte ett datum"), "Kommande");
assert.equal(core.stockholmWeekday("2026-08-09T10:00:00Z"), "sunday");
assert.equal(core.safeExternalUrl("javascript:alert(1)"), "#");

console.log("✓ DinPuls kärnhjälpare ger stabila datum, tal, texter och säkra länkar");
