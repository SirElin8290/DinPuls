const assert = require("assert");
const fs = require("fs");

const feedback = fs.readFileSync("login-feedback.js", "utf8");
const admin = fs.readFileSync("admin/index.html", "utf8");
const company = fs.readFileSync("foretag/index.html", "utf8");

for (const [name, html] of [["admin", admin], ["företag", company]]) {
  assert(html.includes('id="loginForm"'), `${name}: loginForm saknas`);
  assert(html.includes('class="login-button"'), `${name}: login-button saknas`);
  assert(html.includes('../login-feedback.js?v=1'), `${name}: gemensam inloggningsfeedback laddas inte`);
}

assert(feedback.includes("is-login-loading"), "Laddningsklass saknas");
assert(feedback.includes("Loggar in…"), "Tydlig laddningstext saknas");
assert(feedback.includes("aria-busy"), "Tillgänglig laddningsstatus saknas");
assert(feedback.includes("login-spinner"), "Laddningsanimation saknas");
assert(feedback.includes("button.disabled = true"), "Dubbelklick ska blockeras under inloggning");
assert(feedback.includes("MutationObserver"), "Knappen ska återställas när ett inloggningsfel visas");

console.log("✓ Admin och företagsportal ger tydlig återkoppling under inloggning");
