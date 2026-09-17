const assert = require("assert"), fs = require("fs"), path = require("path"), root = path.resolve(__dirname, "..");
const hero = fs.readFileSync(path.join(root, "components", "hero.html"), "utf8"), script = fs.readFileSync(path.join(root, "script.js"), "utf8"), styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
assert.match(hero, /id="deviation-open"[^>]*hidden/); assert.match(hero, /id="deviation-back"/);
assert.match(script, /municipalities\?\.\[config\.code\]/); assert.match(script, /setDeviationCardSide\(false\)/);
assert.match(styles, /prefers-reduced-motion:reduce[^}]*important-flip-inner\{transition:none/s); assert.match(styles, /@media\(max-width:760px\).*deviation-open/s);
console.log("deviation UI: ok");
