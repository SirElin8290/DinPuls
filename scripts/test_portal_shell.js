const assert = require("node:assert/strict");
const fs = require("node:fs");

const pages = ["bio", "bostader", "drivmedel", "evenemang", "fritid", "jobb", "lunch", "matkasse", "myndigheter", "nyheter", "service", "sport", "trafik", "vard", "information"];
const css = fs.readFileSync("portal-pages.css", "utf8");
const brandRule = css.match(/\.portal-brand img\{([^}]*)\}/)?.[1] || "";
assert(!/filter\s*:/.test(brandRule), "Portalens logotyp får inte färgfiltreras");
assert(/object-fit\s*:\s*contain/.test(brandRule), "Portalens logotyp ska visas utan beskärning");

for (const page of pages) {
  const html = fs.readFileSync(`${page}.html`, "utf8");
  assert(/<header class="portal-header">/.test(html), `${page}: gemensam portalheader saknas`);
  assert(/<picture>/.test(html) && /logo-mobile\.svg\?version=0\.26\.0/.test(html), `${page}: responsiv mobillogotyp saknas`);
  assert(/logo\.svg\?version=0\.26\.0/.test(html), `${page}: desktoplogotyp eller cacheversion saknas`);
  assert(/<footer class="portal-footer">/.test(html), `${page}: gemensam sidfot saknas`);
}

const leisure = fs.readFileSync("fritid.html", "utf8");
assert(!/<style>[\s\S]*leisure-show-more/.test(leisure), "Fritidsknappens CSS ska ligga i leisure-hub.css");
assert(/\.leisure-show-more\{/.test(fs.readFileSync("leisure-hub.css", "utf8")), "Fritidsknappens CSS saknas");

const health = fs.readFileSync("health-page.js", "utf8");
assert(/selectedCategory/.test(health) && /health-group/.test(health), "Vårdens kategorifilter saknar funktionell koppling");
assert(/categorySelect\.addEventListener\("change", renderHealthPage\)/.test(health), "Vårdens kategoribyte renderar inte om resultatet");

console.log(`Portalstruktur verifierad för ${pages.length} publika undersidor.`);
