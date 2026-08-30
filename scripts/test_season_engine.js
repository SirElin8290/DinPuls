"use strict";

global.DinPulsSecurity = require("../dp-safety.js");
const core = require("../dp-core.js");

const cases = [
  ["2026-02-28T23:59:59+01:00", "winter"],
  ["2026-03-01T00:00:00+01:00", "spring"],
  ["2026-05-31T23:59:59+02:00", "spring"],
  ["2026-06-01T00:00:00+02:00", "summer"],
  ["2026-08-31T23:59:59+02:00", "summer"],
  ["2026-09-01T00:00:00+02:00", "autumn"],
  ["2026-11-30T23:59:59+01:00", "autumn"],
  ["2026-12-01T00:00:00+01:00", "winter"],
  ["2027-01-15T12:00:00+01:00", "winter"]
];

for (const [value, expected] of cases) {
  const actual = core.seasonForDate(new Date(value)).id;
  if (actual !== expected) throw new Error(`${value}: väntade ${expected}, fick ${actual}`);
}

if (core.TIME_ZONE !== "Europe/Stockholm") throw new Error("Säsongsmotorn måste använda Europe/Stockholm.");
if (core.SEASONS.autumn.icon !== "leaf") throw new Error("Hösttemat ska använda lövikon.");
if (core.SEASONS.summer.icon !== "sun") throw new Error("Sommartemat ska använda solikon.");

console.log("Säsongsmotorn godkänd: vår 1 mars, sommar 1 juni, höst 1 september, vinter 1 december i Europe/Stockholm.");
