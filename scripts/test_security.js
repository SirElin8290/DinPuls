const assert = require("node:assert/strict");
const security = require("../dp-safety.js");

assert.equal(security.escapeHtml(`<img src=x onerror="alert('x')">`), "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;");
assert.equal(security.safeExternalUrl("https://www.svt.se/nyheter"), "https://www.svt.se/nyheter");
assert.equal(security.safeExternalUrl("http://example.com"), "http://example.com");
assert.equal(security.safeExternalUrl("/lokal-sida"), "#");
assert.equal(security.safeExternalUrl("javascript:alert(1)"), "#");
assert.equal(security.safeExternalUrl("data:text/html,<script>alert(1)</script>"), "#");
assert.equal(security.safeExternalUrl("java\nscript:alert(1)"), "#");
assert.equal(security.safeHref("information.html#integritet"), "information.html#integritet");
assert.equal(security.safeHref("mailto:kontakt@dinpuls.se"), "mailto:kontakt@dinpuls.se");
assert.equal(security.safeHref("tel:+4653212345"), "tel:+4653212345");
assert.equal(security.safeHref("vbscript:msgbox(1)"), "#");
assert.equal(security.safeIconName("arrow-up-right"), "arrow-up-right");
assert.equal(security.safeIconName('x" onload="alert(1)'), "circle-dot");

console.log("✓ Den centrala HTML-, länk- och ikonsäkerheten blockerar osäkra värden");
