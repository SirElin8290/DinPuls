const assert = require("node:assert/strict");
const fs = require("node:fs");
const data = JSON.parse(fs.readFileSync("data/practical.json", "utf8"));
const home = fs.readFileSync("components/primary-cards.html", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const page = fs.readFileSync("praktiskt.html", "utf8");
const engine = fs.readFileSync("practical-engine.js", "utf8");
const ui = fs.readFileSync("practical-page.js", "utf8");
const css = fs.readFileSync("practical.css", "utf8");
assert(home.includes('id="praktiskt"') && home.includes('id="practical-page-link"'));
assert(index.includes("practical-engine.js"));
assert(engine.includes("encodeURIComponent(name)"));
assert.equal(Object.keys(data.municipalities).length, 21);
assert(data.municipalities.Åmål);
const amal = data.municipalities.Åmål;
assert(amal.settlements.length >= 6 && amal.settlements[0].id === "all");
for (const type of ["map", "information", "hybrid"]) assert(amal.categories.some(x => x.presentationType === type));
assert(amal.places.every(x => x.primaryUrl && x.source && x.verifiedAt && x.coordinates.length === 2));
assert(amal.information.every(x => x.externalUrl && x.source && x.verifiedAt));
assert(page.includes('id="practical-settlement"') && page.includes('id="practical-category"'));
assert(page.includes('id="practical-flip"') && page.includes('id="practical-map"') && page.includes('id="practical-info"'));
assert(ui.includes('next==="information"') && ui.includes('if(next===currentSide)return'));
assert(ui.includes('p.categories.includes(category.id)') && ui.includes('p.settlement===settlement'));
assert(ui.includes('if(c.presentationType!=="information")renderMap(c)'));
assert(ui.includes("if(!record)") && ui.includes("Vi visar aldrig information från en annan kommun"));
assert(css.includes("prefers-reduced-motion:reduce") && css.includes("@media(max-width:760px)"));
for (const [name, record] of Object.entries(data.municipalities)) {
  assert(record.settlements[0]?.id === "all", `${name}: Hela kommunen saknas`);
  assert(record.categories.length >= 1, `${name}: kategorier saknas`);
  const categoryIds = new Set(record.categories.map(x => x.id));
  const settlementIds = new Set(record.settlements.map(x => x.id));
  assert.equal(categoryIds.size, record.categories.length, `${name}: duplicerade kategori-ID`);
  assert.equal(settlementIds.size, record.settlements.length, `${name}: duplicerade områdes-ID`);
  assert(record.categories.every(x => ["map", "information", "hybrid"].includes(x.presentationType) && x.source?.url && x.verifiedAt), `${name}: ogiltig kategori`);
  assert(record.places.every(x => x.primaryUrl && x.source && x.verifiedAt && x.coordinates.length === 2), `${name}: ogiltig plats`);
  assert(record.information.every(x => x.externalUrl && x.source && x.verifiedAt), `${name}: ogiltig information`);
  assert.equal(new Set(record.places.map(x => x.id)).size, record.places.length, `${name}: duplicerade plats-ID`);
  assert.equal(new Set(record.information.map(x => x.id)).size, record.information.length, `${name}: duplicerade informations-ID`);
  assert(record.information.every(x => categoryIds.has(x.category)), `${name}: information pekar på okänd kategori`);
  assert(record.places.every(x => x.categories.every(id => categoryIds.has(id)) && settlementIds.has(x.settlement)), `${name}: plats pekar på okänd kategori eller ort`);
  assert(record.places.every(x => Math.abs(x.coordinates[0]) <= 90 && Math.abs(x.coordinates[1]) <= 180), `${name}: koordinat utanför giltigt intervall`);
}
assert(data.municipalities.Bengtsfors.categories.length >= 7, "Bengtsfors: för smal kategoritäckning");
assert(data.municipalities.Bengtsfors.places.length >= 9, "Bengtsfors: verifierade kartplatser saknas");
assert(data.municipalities.Mellerud.categories.length >= 9, "Mellerud: för smal kategoritäckning");
assert(data.municipalities.Mellerud.information.length >= 9, "Mellerud: informationsposter saknas");
for (const name of ["Arvika", "Grums", "Säffle", "Dals-Ed", "Eda"]) {
  assert(data.municipalities[name], `${name}: data saknas`);
  assert(data.municipalities[name].categories.length >= 8, `${name}: för smal kategoritäckning`);
  assert.equal(data.municipalities[name].information.length, data.municipalities[name].categories.length, `${name}: informationspost saknas`);
}
for (const name of ["Filipstad", "Forshaga", "Färgelanda", "Hagfors", "Hammarö", "Karlstad", "Kil", "Kristinehamn", "Munkfors", "Storfors", "Sunne", "Torsby"]) {
  assert(data.municipalities[name], `${name}: data saknas`);
  assert(data.municipalities[name].categories.length >= 7, `${name}: för smal kategoritäckning`);
  assert.equal(data.municipalities[name].information.length, data.municipalities[name].categories.length, `${name}: informationspost saknas`);
}
console.log(`Praktiskt verifierat för ${Object.keys(data.municipalities).length} kommuner.`);
