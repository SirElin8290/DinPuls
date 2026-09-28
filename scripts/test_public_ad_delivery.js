const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

class Element {
  constructor(tag = "div") { this.tagName = tag.toUpperCase(); this.dataset = {}; this.children = []; this.attributes = {}; this.hidden = false; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener() {}
  closest() { return null; }
}

const requests = [];
const context = {
  URL,
  URLSearchParams,
  console,
  queueMicrotask,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  addEventListener() {},
  location: { search: "?kommun=Årjäng" },
  document: {
    readyState: "loading",
    head: new Element("head"),
    createElement: tag => new Element(tag),
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  },
  fetch: async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (url === "data/business-config.json") return { ok: true, json: async () => ({ apiBase: "https://ads.test" }) };
    if (String(url).includes("/ads/current/SERV-01")) return { ok: true, json: async () => ({ banner: { id: "approved-1", imageUrl: "/ads/assets/approved-1", targetUrl: "https://example.com" } }) };
    return { ok: true, json: async () => ({ ok: true }) };
  },
  IntersectionObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback([{ isIntersecting: true, intersectionRatio: 1 }]); } disconnect() {} }
};
context.window = context;
context.window.DINPULS_AD_INVENTORY = [{ id: "SERV-01", group: "subpage-serv", position: 1 }];
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "portal-ads.js"), "utf8"), context);

(async () => {
  const slot = new Element();
  slot.dataset.strategicAd = "service";
  slot.dataset.adPosition = "1";
  await context.window.DinPulsAds.enhanceStrategicSlot(slot);
  assert.equal(await context.window.DinPulsAds.resolveSlotId(slot), "SERV-01");
  assert.equal(slot.hidden, false, "Aktiv godkänd banner ska visas");
  assert.equal(slot.dataset.scheduledBanner, "approved-1");
  assert.equal(slot.children[0].children[0].src, "https://ads.test/ads/assets/approved-1");
  assert(requests.some(item => item.url.includes("/ads/current/SERV-01?municipality=%C3%85rj%C3%A4ng")), "Publik fråga ska innehålla exakt plats och kommun");
  assert(requests.some(item => item.url.endsWith("/ads/events")), "Synlig banner ska registrera visning");
  console.log("✓ Publik annonsrendering använder central plats, kommun, bannerasset och visningsmätning");
})().catch(error => { console.error(error); process.exitCode = 1; });
