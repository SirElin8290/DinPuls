const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const script = fs.readFileSync("script.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

assert(html.includes('id="municipality-onboarding"'), "Startsidan måste ha en första-gångsvy för kommunval");
assert(script.includes("hasExplicitChoice"), "Första-gångsvyn måste hoppas över efter sparat eller länkat kommunval");
assert(script.includes('localeCompare(right.name, "sv-SE")'), "Kommunerna måste visas i svensk alfabetisk ordning");
assert(script.includes("data-onboarding-municipality"), "Kommunvalet måste genereras från kommunregistret");
assert(script.includes('link[href*="first-visit.css"]'), "Den nya väljaren måste neutralisera kvarvarande äldre designkod");
assert(html.includes('role="combobox"'), "Kommunvalet måste vara sökbart och tillgängligt som en kombinationsruta");
assert(script.includes("item.active !== false && item.published !== false"), "Avpublicerade kommuner får inte visas");
assert(script.includes("matchingMunicipalities"), "Kommunväljaren måste kunna filtrera en stor kommunlista");
assert(html.includes("Fortsätt till DinPuls"), "Besökaren måste bekräfta sitt kommunval tydligt");
assert(script.includes("persist: true"), "Första kommunvalet måste sparas lokalt");
assert(styles.includes("linear-gradient(120deg,#075b72 0%,#078aa2 52%,#3b9f68 100%)"), "Introduktionen måste använda DinPuls blågröna headergradient");

console.log("✓ Första besöket kräver ett sparat, alfabetiskt kommunval i DinPuls profil");
