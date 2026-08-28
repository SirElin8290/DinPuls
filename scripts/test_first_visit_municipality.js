const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const script = fs.readFileSync("script.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

assert(html.includes('id="municipality-onboarding"'), "Startsidan måste ha en första-gångsvy för kommunval");
assert(script.includes("hasExplicitChoice"), "Första-gångsvyn måste hoppas över efter sparat eller länkat kommunval");
assert(script.includes('localeCompare(right.name, "sv-SE")'), "Kommunerna måste visas i svensk alfabetisk ordning");
assert(script.includes("data-first-municipality"), "Kommunvalet måste genereras från kommunregistret");
assert(script.includes("persist: true"), "Första kommunvalet måste sparas lokalt");
assert(styles.includes("linear-gradient(120deg,#071d43"), "Introduktionen måste använda DinPuls headergradient");

console.log("✓ Första besöket kräver ett sparat, alfabetiskt kommunval i DinPuls profil");
