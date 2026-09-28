const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "admin/ad-inventory.js"), "utf8"), context);
const inventory = Array.from(context.window.DINPULS_AD_INVENTORY || []);

assert.strictEqual(inventory.length, 93, "Inventeringen ska innehålla 30 startsidesplatser och 63 undersidesplatser");
assert.strictEqual(new Set(inventory.map(slot => slot.id)).size, inventory.length, "Alla annons-ID:n måste vara unika");
assert(inventory.every(slot => slot.id && slot.module && slot.page && slot.position && slot.label && slot.location), "Varje annonsplats måste vara fullständigt beskriven");

const byPage = new Map();
for (const slot of inventory.filter(slot => slot.page !== "index.html")) {
  if (!byPage.has(slot.page)) byPage.set(slot.page, []);
  byPage.get(slot.page).push(slot);
}

const dynamicPages = new Set(["sport.html", "fritid.html"]);
for (const [page, slots] of byPage) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  if (dynamicPages.has(page)) {
    assert(html.includes("dynamic-portal-ads.js"), `${page}: dynamisk annonsfördelning saknas`);
    assert(html.includes("portal-ads.js"), `${page}: annonsmotorn saknas`);
    continue;
  }
  const positions = [...html.matchAll(/data-strategic-ad="[^"]+"[^>]*data-ad-position="(\d+)"/g)].map(match => Number(match[1]));
  assert.deepStrictEqual(positions, slots.map(slot => slot.position), `${page}: annonsinventeringen avviker från HTML`);
}

assert.strictEqual(byPage.get("sport.html")?.length, 4, "Idrott & motion ska ha fyra säljbara hubplatser");
assert.strictEqual(byPage.get("fritid.html")?.length, 4, "Fritid ska ha fyra säljbara annonsplatser");
assert.strictEqual(byPage.get("skola-familj.html")?.length, 4, "Skola & familj ska ha fyra fasta annonsplatser");
const dynamicSource = fs.readFileSync(path.join(root, "dynamic-portal-ads.js"), "utf8");
assert(dynamicSource.includes("const expectedSlots = 4"), "Alla sportvyer ska använda de fyra centralt säljbara sportplatserna");
assert(!dynamicSource.includes("`sport-${sportAdKey(sport)}`"), "Sportspecifika vyer får inte skapa plats-ID:n utanför inventeringen");
assert(dynamicSource.includes('makeSlot("sport", index + 1'), "Sportvyer ska mappa till SPORT-01–SPORT-04");
assert(dynamicSource.includes("length: 4"), "Idrotts- och fritidslayouten ska skapa fyra centrala platser");

const publicAdsSource = fs.readFileSync(path.join(root, "portal-ads.js"), "utf8");
assert(publicAdsSource.includes('admin/ad-inventory.js'), "Publik annonsmotor ska läsa det centrala annonsregistret");
assert(publicAdsSource.includes('slot.hidden = false'), "En godkänd aktiv banner ska göras synlig publikt");
assert(publicAdsSource.includes('window.setInterval(show, 30000)'), "Flera aktiva startsidesannonser ska rotera var 30:e sekund");
assert(!publicAdsSource.includes("Ditt företag här"), "Publik annonsmotor får inte skapa bokningsplatshållare");
assert(!dynamicSource.includes("Ditt företag här"), "Dynamiska portaler får inte skapa bokningsplatshållare");

const staticPagesWithAds = fs.readdirSync(root)
  .filter(file => file.endsWith(".html"))
  .filter(file => fs.readFileSync(path.join(root, file), "utf8").includes("data-strategic-ad="));
for (const page of staticPagesWithAds) assert(byPage.has(page), `${page}: annonsplatser saknas i inventeringen`);

const adminSource = fs.readFileSync(path.join(root, "admin/admin.js"), "utf8");
assert(adminSource.includes("data/municipalities.json"), "Admin ska läsa aktiva kommuner centralt");
assert(!adminSource.includes("Dals-Ed") && !adminSource.includes("Karlstad"), "Admin får inte ha en parallell kommunlista");

console.log(`✓ Annonsregistret matchar 93 basplatser och ${byPage.size} undersidor; alla sportvyer använder fyra centrala platser`);
