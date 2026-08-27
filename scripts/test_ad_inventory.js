const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "admin/ad-inventory.js"), "utf8"), context);
const inventory = Array.from(context.window.DINPULS_AD_INVENTORY || []);

assert.strictEqual(inventory.length, 81, "Inventeringen ska innehålla 30 startsidesplatser och 51 undersidesplatser");
assert.strictEqual(new Set(inventory.map(slot => slot.id)).size, inventory.length, "Alla annons-ID:n måste vara unika");
assert(inventory.every(slot => slot.id && slot.module && slot.page && slot.position && slot.label && slot.location), "Varje annonsplats måste vara fullständigt beskriven");

const byPage = new Map();
for (const slot of inventory.filter(slot => slot.page !== "index.html")) {
  if (!byPage.has(slot.page)) byPage.set(slot.page, []);
  byPage.get(slot.page).push(slot);
}

for (const [page, slots] of byPage) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  const positions = [...html.matchAll(/data-strategic-ad="[^"]+"[^>]*data-ad-position="(\d+)"/g)].map(match => Number(match[1]));
  assert.deepStrictEqual(positions, slots.map(slot => slot.position), `${page}: annonsinventeringen avviker från HTML`);
}

const pagesWithAds = fs.readdirSync(root)
  .filter(file => file.endsWith(".html"))
  .filter(file => fs.readFileSync(path.join(root, file), "utf8").includes("data-strategic-ad="))
  .sort();
assert.deepStrictEqual([...byPage.keys()].sort(), pagesWithAds, "Alla undersidor med annonsplatser måste finnas i inventeringen");

const adminSource = fs.readFileSync(path.join(root, "admin/admin.js"), "utf8");
assert(adminSource.includes("data/municipalities.json"), "Admin ska läsa aktiva kommuner centralt");
assert(!adminSource.includes("Dals-Ed") && !adminSource.includes("Karlstad"), "Admin får inte ha en parallell kommunlista");

console.log(`✓ Annonsregistret matchar 81 platser på startsidan och ${byPage.size} undersidor`);
