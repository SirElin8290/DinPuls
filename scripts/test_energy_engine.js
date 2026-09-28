const assert = require("node:assert/strict");
const fs = require("node:fs");
const engine = require("../energy-engine.js");
const mapping = JSON.parse(fs.readFileSync("data/electricity-areas.json", "utf8"));
const registry = JSON.parse(fs.readFileSync("data/municipalities.json", "utf8"));

assert.equal(registry.municipalities.length, 21);
for (const item of registry.municipalities) assert.match(engine.areaForMunicipality(mapping, item.name) || "", /^SE[1-4]$/, `${item.name}: elområde saknas`);
assert.equal(Object.keys(mapping.municipalities).length, 21);
assert.equal(new Set(Object.values(mapping.municipalities)).size, 1, "Nuvarande 21 kommuner ska ligga i samma verifierade elområde");
const periods = [
  { start: "2026-09-28T10:00:00+02:00", end: "2026-09-28T10:15:00+02:00", orePerKwh: -2.5 },
  { start: "2026-09-28T10:15:00+02:00", end: "2026-09-28T10:30:00+02:00", orePerKwh: 18.2 }
];
const summary = engine.summarize({ periods }, "2026-09-28T10:05:00+02:00");
assert.equal(summary.current.orePerKwh, -2.5); assert.equal(summary.minimum, -2.5); assert.equal(summary.maximum, 18.2);
assert.equal(engine.summarize({ periods }, "2026-09-29T10:05:00+02:00"), null, "Gammal data får inte visas som aktuell");
assert.equal(engine.summarize({ periods: [{ start: "bad", end: "bad", orePerKwh: 1 }] }), null);
console.log("Energy engine: 21/21 kommuner och fel-/negativprisfall PASS");
