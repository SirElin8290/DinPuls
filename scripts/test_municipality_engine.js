const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadEngine(search = "", stored = null) {
  const storage = new Map(stored ? [["dinpuls-municipality", stored]] : []);
  const events = [];
  const listeners = {};
  const location = {
    href: `https://example.test/DinPuls/lunch.html${search}`,
    pathname: "/DinPuls/lunch.html",
    search,
    hash: ""
  };
  const context = {
    URL,
    URLSearchParams,
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    document: { dispatchEvent: event => events.push(event), addEventListener: (type, callback) => { listeners[type] = callback; } },
    history: {
      replaceState: (_state, _title, next) => { location.replaced = next; },
      pushState: (_state, _title, next) => { location.pushed = next; }
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    },
    location
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync("municipality-engine.js", "utf8"), context);
  return { engine: context.DinPulsMunicipalityState, storage, events, location, listeners };
}

const expected = JSON.parse(fs.readFileSync("data/municipalities.json", "utf8")).municipalities.map(item => item.name);
const baseline = loadEngine();
assert.deepEqual([...baseline.engine.MUNICIPALITIES], expected);
assert.equal(baseline.engine.getInitial(), "Åmål");
assert.equal(baseline.engine.hasExplicitChoice(), false);
assert.equal(loadEngine("", "Sunne").engine.hasExplicitChoice(), true);
assert.equal(loadEngine("?kommun=Kil").engine.hasExplicitChoice(), true);

for (const name of expected) {
  const test = loadEngine(`?kommun=${encodeURIComponent(name)}&sport=Fotboll`, "Grums");
  assert.equal(test.engine.getInitial(), name);
  assert.equal(test.engine.set(name), name);
  assert.equal(test.storage.get("dinpuls-municipality"), name);
  assert.match(test.location.replaced, /sport=Fotboll/);
  assert.equal(test.events.at(-1).detail.name, name);
}

assert.equal(loadEngine("?kommun=Okänd", "Arvika").engine.getInitial(), "Arvika");
assert.equal(loadEngine("?kommun=grums").engine.getInitial(), "Grums");
assert.equal(loadEngine().engine.set("Ogiltig", { updateUrl: false }), "Åmål");

const select = {};
baseline.engine.populateSelect(select);
const renderedNames = [...select.innerHTML.matchAll(/value="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(renderedNames, [...expected].sort((left, right) => left.localeCompare(right, "sv-SE")));

console.log(`✓ Kommunmotorn klarar alla ${expected.length} kommuner, lagring, URL och fallback`);

for (const municipality of ["Hammarö", "Forshaga"]) {
  const test = loadEngine(`?kommun=${encodeURIComponent(municipality)}`, "Åmål");
  for (const href of ["evenemang.html", "index.html", "vard.html?kategori=all#kontakt"]) {
    const link = { href };
    test.listeners.click({ target: { closest: () => link } });
    const result = new URL(link.href);
    assert.equal(result.searchParams.get("kommun"), municipality);
    if (href.includes("#kontakt")) {
      assert.equal(result.hash, "#kontakt");
      assert.equal(result.searchParams.get("kategori"), "all");
    }
  }
  for (const href of ["https://example.org/program.html", "tel:1177", "evenemang.html?kommun=Kil"]) {
    const link = { href };
    test.listeners.click({ target: { closest: () => link } });
    assert.equal(link.href, href);
  }
  test.listeners.click({ target: { closest: () => null } });
}
console.log("✓ Interna länkar bevarar kommunval, filter och ankare utan att ändra externa eller explicita kommunlänkar");
