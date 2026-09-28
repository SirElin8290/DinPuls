const fs = require("fs");

const read = (path) => fs.readFileSync(path, "utf8");
const footer = read("components/footer.html");
const associations = read("foreningsliv.js");
const info = read("foreningar-konto.html");
const account = read("foreningskonto.html");
const accountScript = read("foreningskonto.js");
const accountStyles = read("foreningskonto.css");

const checks = [
  [footer.includes('href="foretag/valkommen.html"') && footer.includes('href="foreningar-konto.html"'), "footer keeps Företag and adds Föreningar"],
  [associations.includes('foreningar-konto.html?kommun=') && associations.includes('&forening='), "association CTA opens the shared information page with context"],
  [info.includes('id="loginCta"') && info.includes('id="registerCta"'), "information page exposes both account routes"],
  [!info.includes('id="loginBottom"') && !info.includes('id="registerBottom"'), "information page contains only one CTA set"],
  [!info.includes('class="hero-placeholder"'), "the full hero section is reserved for the future image"],
  [info.includes('assets/foreningskonto-hero.webp') && accountStyles.includes('url("assets/foreningskonto-hero.webp")'), "approved hero image is preloaded and covers the hero section"],
  [info.includes("15 %") && info.includes("verifierad förening"), "information page explains the verified 15 percent model"],
  [account.indexOf('id="associationLogin"') < account.indexOf('id="associationRegistration"'), "login is the default card face"],
  [account.includes('id="associationSearch"') && account.includes("Bekräfta lösenord"), "registration layout contains the requested fields"],
  [accountScript.includes('params.get("mode")==="register"') && accountScript.includes("showRegister") && accountScript.includes("showLogin"), "query mode and both flip directions are wired"],
  [accountScript.includes('p.set("kommun",municipality)') && accountScript.includes('p.set("forening",association)'), "municipality and association context are preserved"]
];

const failures = checks.filter(([passed]) => !passed);
checks.forEach(([passed, label]) => console.log(`${passed ? "PASS" : "FAIL"}: ${label}`));
if (failures.length) process.exit(1);
