const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadEngine(search = "", stored = null) {
  const storage = new Map(stored ? [["dinpuls-municipality", stored]] : []);
  const events = [];
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
    document: { dispatchEvent: event => events.push(event) },
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
  return { engine: context.DinPulsMunicipalityState, storage, events, location };
}

const expected = JSON.parse(fs.readFileSync("data/municipalities.json", "utf8")).municipalities.map(item => item.name);
const baseline = loadEngine();
assert.deepEqual([...baseline.engine.MUNICIPALITIES], expected);
assert.equal(baseline.engine.getInitial(), "Åmål");

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

console.log(`✓ Kommunmotorn klarar alla ${expected.length} kommuner, lagring, URL och fallback`);
