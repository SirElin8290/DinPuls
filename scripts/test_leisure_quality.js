const assert = require("node:assert/strict");
const fs = require("node:fs");

const leisure = JSON.parse(fs.readFileSync("data/leisure.json", "utf8"));
const sports = JSON.parse(fs.readFileSync("data/sports.json", "utf8"));
const municipalityConfig = JSON.parse(fs.readFileSync("data/municipalities.json", "utf8"));
const validCategories = new Set(["djur", "gemenskap", "kultur", "musik", "natur", "skapande", "spel"]);
const obviousSportEntries = new Set([
  "Åmål Airsoftförening",
  "Säffle IBF",
  "Västra Götalands Parasportförbund",
  "Melleruds Båtklubb",
  "Melleruds Paintballförening",
  "Arvika Padelsällskap",
  "Grums Skateboardförening",
  "Grums skolidrottsförening",
  "Ryttarsällskapet Grums",
  "Kils Brukshundklubb",
]);

const expectedMunicipalities = municipalityConfig.municipalities.map((item) => item.name);
assert.deepEqual(Object.keys(leisure.municipalities), expectedMunicipalities, "Alla kommuner ska kunna laddas i rätt ordning");

for (const [municipality, payload] of Object.entries(leisure.municipalities)) {
  assert.doesNotThrow(() => new URL(payload.directoryUrl), `${municipality}: ogiltig registerlänk`);
  assert.equal(new URL(payload.directoryUrl).protocol, "https:", `${municipality}: registerlänken ska använda HTTPS`);
  assert(Array.isArray(payload.activities), `${municipality}: activities ska vara en lista`);

  const names = new Set();
  const sportNames = new Set(
    (sports.municipalities[municipality]?.clubs || []).map((club) => club.name.trim().toLocaleLowerCase("sv-SE")),
  );
  for (const activity of payload.activities) {
    const normalizedName = activity.name.trim().toLocaleLowerCase("sv-SE");
    assert(!names.has(normalizedName), `${municipality}: exakt dubblett av ${activity.name}`);
    names.add(normalizedName);
    assert(!sportNames.has(normalizedName), `${municipality}/${activity.name}: exakt dubblett mellan Fritid och Idrott`);
    assert(validCategories.has(activity.category), `${municipality}/${activity.name}: ogiltig kategori ${activity.category}`);
    assert(!obviousSportEntries.has(activity.name), `${municipality}/${activity.name}: uppenbar idrottspost ligger i Fritid`);
    assert(Array.isArray(activity.tags) && activity.tags.length > 0, `${municipality}/${activity.name}: taggar saknas`);
    assert.doesNotThrow(() => new URL(activity.url), `${municipality}/${activity.name}: ogiltig URL`);
    assert.equal(new URL(activity.url).protocol, "https:", `${municipality}/${activity.name}: URL ska använda HTTPS`);
  }

  // Samma datastruktur används av leisure-hub.js; denna projektion ska alltid kunna renderas.
  assert.doesNotThrow(() => payload.activities.map((item) => `${item.name}|${item.category}|${item.tags.join(" ")}`));
}

assert.equal(
  leisure.municipalities.Åmål.directoryUrl,
  "https://amal.se/uppleva-och-gora/foreningsliv",
  "Åmål får inte länka till Säffles föreningsregister",
);
assert.equal(
  JSON.stringify(leisure.municipalities.Åmål).includes("saffle.ibgo.se"),
  false,
  "Åmåls fritidsdata får inte innehålla Säffles registerlänk",
);

console.log(`Fritidsdata verifierad för ${expectedMunicipalities.length} kommuner.`);
