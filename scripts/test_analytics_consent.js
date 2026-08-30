const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const privacy = fs.readFileSync(path.join(root, "privacy-controls.js"), "utf8");
const information = fs.readFileSync(path.join(root, "information.html"), "utf8");
const publicPages = fs.readdirSync(root)
  .filter(name => name.endsWith(".html") && name !== "404.html")
  .map(name => path.join(root, name));

assert(privacy.includes('const ANALYTICS_ID = "G-TVLG1QMX8C"'), "Rätt GA4-ID måste användas");
assert(privacy.includes('analytics_storage: "denied"'), "Analytics måste vara nekad som standard");
assert(privacy.indexOf("function startAnalytics") > privacy.indexOf("analytics_storage: \"denied\""), "Samtycke ska sättas före Analytics startas");
assert(privacy.includes("if (analyticsStarted || !analyticsAllowed()) return"), "Google-taggen får inte laddas utan aktivt samtycke");
assert(privacy.includes("googletagmanager.com/gtag/js") && privacy.includes("document.createElement(\"script\")"), "Google-taggen ska laddas först dynamiskt efter samtycke");
assert(privacy.includes("allow_google_signals: false") && privacy.includes("allow_ad_personalization_signals: false"), "Annonsanpassning och Google Signals ska vara avstängda");
assert(privacy.includes("stopAnalytics();") && privacy.includes("Max-Age=0"), "Återkallat samtycke ska stoppa mätning och rensa analyskakor");
assert(privacy.includes("safePageLocation()"), "Sidvisningar får inte skicka godtyckliga frågeparametrar");
assert(information.includes("Valfri besöksstatistik") && information.includes("Google Analytics 4"), "Integritetstexten måste beskriva Analytics");

for (const file of publicPages) {
  const html = fs.readFileSync(file, "utf8");
  assert(html.includes("privacy-controls.js?version=0.25.2"), `${path.basename(file)} saknar aktuell samtyckeskod`);
  assert(!html.includes("googletagmanager.com/gtag/js"), `${path.basename(file)} får inte ladda Google statiskt före samtycke`);
}

for (const privatePage of ["admin/index.html", "foretag/index.html"]) {
  const html = fs.readFileSync(path.join(root, privatePage), "utf8");
  assert(!html.includes("privacy-controls.js") && !html.includes("googletagmanager.com"), `${privatePage} ska inte analyseras`);
}

assert(fs.readFileSync(path.join(root, "innebandyregler/index.html"), "utf8").includes("../privacy-controls.js?version=0.25.2"), "Regelgeneratorn ska ha samma aktiva samtyckesval");

console.log("✓ GA4 laddas endast efter aktivt samtycke och kan återkallas");
