const fs = require("fs");
const assert = require("assert");

const sports = JSON.parse(fs.readFileSync("data/sports.json", "utf8"));
const leisure = JSON.parse(fs.readFileSync("data/leisure.json", "utf8"));
const registry = JSON.parse(fs.readFileSync("data/municipalities.json", "utf8"));
const names = registry.municipalities.map((item) => item.name);
const key = (value) => String(value || "").toLocaleLowerCase("sv-SE").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const counts = {};

assert.strictEqual(names.length, 21, "Kommunregistret ska innehålla 21 kommuner");
for (const municipality of names) {
  const rows = [
    ...(sports.municipalities?.[municipality]?.clubs || []),
    ...(leisure.municipalities?.[municipality]?.activities || []),
  ];
  assert(rows.length > 0, `${municipality} saknar föreningsdata`);
  assert(rows.every((row) => String(row.name || row.club || "").trim()), `${municipality} har post utan namn`);
  const normalized = rows.map((row) => key(row.name || row.club));
  assert.strictEqual(new Set(normalized).size, normalized.length, `${municipality} har dublettnamn`);
  counts[municipality] = normalized.length;
}

const html = fs.readFileSync("foreningsliv.html", "utf8");
const js = fs.readFileSync("foreningsliv.js", "utf8");
const css = fs.readFileSync("foreningsliv.css", "utf8");
const home = fs.readFileSync("index.html", "utf8");
const sportComponent = fs.readFileSync("components/sport.html", "utf8");
assert(html.includes('id="association-filters"'), "Filterytan saknas");
assert(html.includes('id="association-list-ad" hidden'), "Dold annonsyta saknas");
assert(js.includes("filterTags"), "Taggfilter saknas");
assert(js.includes("const unique=new Map"), "Dublettskydd saknas");
assert(js.includes("forening.html?kommun="), "Kommun saknas i detaljlänk");
assert(css.includes('.association-filters button[aria-pressed="true"]'), "Aktivt filter saknar styling");
assert(css.includes("overflow-x:auto"), "Mobilt filter saknar säker horisontell hantering");
assert(!home.includes("Fritid och föreningsliv"), "Gammalt modulnamn finns kvar");
assert(home.includes('<b>Föreningsliv</b>'), "Föreningsliv saknas i startsidans inställningar");
assert(sportComponent.includes("Föreningsliv i"), "Startsidemodulen har fel namn");
assert(sportComponent.includes('href="foreningsliv.html"'), "Startsidemodulen saknar länk");

const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
console.log(JSON.stringify({ municipalities: counts, total }, null, 2));
console.log("Association hub: PASS");
