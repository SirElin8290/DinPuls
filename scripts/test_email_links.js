const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicFiles = fs.readdirSync(root).filter((name) => /\.(?:html|js)$/.test(name));
const sources = publicFiles.map((name) => [name, fs.readFileSync(path.join(root, name), "utf8")]);
const allPublicSource = sources.map(([, source]) => source).join("\n");

const expected = [
  "kontakt@dinpuls.se",
  "annons@dinpuls.se",
  "tips@dinpuls.se",
  "felrapport@dinpuls.se",
];

for (const address of expected) {
  assert(allPublicSource.includes(`mailto:${address}`), `${address} måste användas av en publik e-postlänk`);
}

assert(!allPublicSource.includes("mailto:annonser@dinpuls.se"), "Den gamla adressen annonser@dinpuls.se får inte användas");
assert(!allPublicSource.includes("dinpuls.se.new"), "Den tillfälliga .new-domänen får inte användas");

console.log("E-postlänkar: godkända för kontakt, annons, tips och felrapport.");
