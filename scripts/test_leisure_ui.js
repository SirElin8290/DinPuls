const assert = require("node:assert/strict");
const fs = require("node:fs");
const createLeisureCards = require("../leisure-cards.js");

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const safeExternalUrl = (value) => {
  const url = new URL(value);
  return url.protocol === "https:" ? url.href : "about:blank";
};
const cards = createLeisureCards({ escapeHtml, safeExternalUrl });
const data = JSON.parse(fs.readFileSync("data/leisure.json", "utf8"));

const minimal = {
  name: "Minimiförening",
  category: "gemenskap",
  categoryLabel: "Lokal gemenskap",
  tags: ["gemenskap"],
  type: "Förening",
  url: "https://example.com/",
};
const rich = {
  ...minimal,
  name: "Rik förening",
  description: "En verifierad beskrivning.",
  activityType: "Skapande",
  targetAudience: ["Barn", "Familjer"],
  location: "Åmål",
  calendarUrl: "https://example.com/calendar",
  source: { label: "Officiell källa", url: "https://example.com/source" },
};

const minimalHtml = cards.activityCard(minimal);
assert(minimalHtml.includes("Minimiförening"), "Kort med minimidata ska renderas");
assert(!minimalHtml.includes("leisure-activity-details"), "Saknade frivilliga fält ska inte ge tomma detaljrader");
assert(!minimalHtml.includes("Källa:"), "Saknad källa ska inte visas");

const richHtml = cards.activityCard(rich);
for (const expected of ["En verifierad beskrivning.", "Skapande", "Barn, Familjer", "Åmål", "Aktuell kalender", "Officiell källa"]) {
  assert(richHtml.includes(expected), `Rikt kort saknar ${expected}`);
}
assert(richHtml.includes('target="_blank"') && richHtml.includes('rel="noopener noreferrer"'), "Externa länkar ska öppnas säkert");

const all = Object.values(data.municipalities).flatMap((payload) => payload.activities);
assert(cards.filterActivities(all, { query: "språkstörning" }).some((item) => item.name === "DHB Västra"), "Sökning ska omfatta rikare fält");
assert(cards.filterActivities(all, { query: "Säldebråten" }).some((item) => item.name === "Frykeruds Hembygdsförening"), "Sökning ska omfatta plats");
assert(cards.filterActivities(all, { category: "spel" }).every((item) => item.category === "spel"), "Kategorifilter ska vara strikt");
assert(data.municipalities.Åmål.activities !== data.municipalities.Kil.activities, "Kommunbyte ska använda kommunens egen aktivitetslista");

const css = fs.readFileSync("leisure-hub.css", "utf8");
assert(css.includes("@media(max-width:520px)") && css.includes(".leisure-activity-details{grid-template-columns:1fr}"), "Mobil layout för rika kort saknas");
const hub = fs.readFileSync("leisure-hub.js", "utf8");
assert(hub.includes("Fritidsinformationen kunde inte laddas"), "Fallback när data saknas ska finnas");

console.log("Fritidskort verifierade: sökning, kommun, kategori, minimi-/rik data, länkar, mobil och fallback.");
