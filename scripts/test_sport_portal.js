const assert = require("node:assert/strict");
const fs = require("node:fs");

const sports = JSON.parse(fs.readFileSync("data/sports.json", "utf8"));
const feeds = JSON.parse(fs.readFileSync("data/sport-feeds.json", "utf8"));
const arenas = JSON.parse(fs.readFileSync("data/arenas.json", "utf8"));
const normalize = value => String(value || "").toLocaleLowerCase("sv-SE").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const aliases = club => [...new Set([club.name, ...(club.aliases || []), ...(club.teams || []).flatMap(team => [...(team.aliases || []), `${club.name} ${team.name}`])].map(normalize))];
const belongs = (match, club) => aliases(club).some(alias => [normalize(match.homeTeam), normalize(match.awayTeam)].includes(alias));
const club = (municipality, name) => sports.municipalities[municipality].clubs.find(item => item.name === name);
const matches = municipality => feeds.municipalities[municipality]?.matches || [];

let clubCount = 0;
for (const [municipality, payload] of Object.entries(sports.municipalities)) {
  const seen = new Set();
  for (const item of payload.clubs) {
    clubCount += 1;
    const key = normalize(item.name);
    assert(!seen.has(key), `${municipality}: dubblerad förening ${item.name}`);
    seen.add(key);
    assert(/^https:\/\//.test(item.url), `${municipality}: ogiltig föreningslänk för ${item.name}`);
    assert(item.sports?.length, `${municipality}: sport saknas för ${item.name}`);
  }
}
assert(!Object.values(sports.municipalities).flatMap(item => item.clubs).some(item => item.name === "Aziz Muradi"), "Privatpersonen Aziz Muradi får inte ligga som klubb");
assert(club("Åmål", "Karate Shotokan JSKA Åmål"), "Den verifierade karateföreningen saknas");

const viken = club("Åmål", "IF Viken");
const vikenMatches = matches("Åmål").filter(match => belongs(match, viken));
assert(vikenMatches.some(match => match.status === "finished"), "IF Viken saknar senaste avslutade match");
assert(vikenMatches.some(match => match.status === "scheduled"), "IF Viken saknar nästa match");
const ifkAmal = club("Åmål", "IFK Åmål");
assert(!vikenMatches.some(match => belongs(match, ifkAmal)), "IFK Åmål får inte ärva IF Vikens matcher");
const ifkMatches = matches("Åmål").filter(match => belongs(match, ifkAmal));
assert(ifkMatches.some(match => match.status === "finished"), "IFK Åmål saknar egen senaste match");
assert(ifkMatches.some(match => match.status === "scheduled"), "IFK Åmål saknar egen nästa match");
assert(!ifkMatches.some(match => belongs(match, viken)), "IF Viken får inte ärva IFK Åmåls matcher");

const vikenTable = (feeds.municipalities.Åmål.standings || []).find(table => table.rows.some(row => normalize(row.team) === normalize(viken.name)));
assert(vikenTable, "IF Viken saknar kopplad tabell");
const vikenRow = vikenTable.rows.find(row => normalize(row.team) === normalize(viken.name));
assert(Number.isInteger(vikenRow.position) && Number.isFinite(vikenRow.points), "IF Vikens position och poäng saknas");
assert(vikenTable.competition && /^https:\/\//.test(vikenTable.sourceUrl), "IF Vikens serie eller tabellänk saknas");
assert((feeds.municipalities.Åmål.standings || []).some(table => table.rows.some(row => normalize(row.team) === normalize(ifkAmal.name))), "IFK Åmål saknar egen kopplad tabell");

const amalsIbk = club("Åmål", "Åmåls IBK");
assert(amalsIbk && /innebandy\.se/.test(amalsIbk.url), "Åmåls IBK ska ha kvar officiell iBIS-länk även när flödet fallerar");
const grums = club("Grums", "Grums IK Hockey");
assert(matches("Grums").some(match => belongs(match, grums) && match.sport === "Ishockey"), "Grums IK Hockey saknar korrekt klubbkopplad ishockeymatch");
assert(!matches("Grums").some(match => belongs(match, viken)), "En annan lagidrott får inte kopplas till IF Viken");

const individualSports = new Set(["Golf", "Orientering", "Motorsport", "Skytte", "Bågskytte"]);
for (const table of Object.values(feeds.municipalities).flatMap(item => item.standings || [])) assert(!individualSports.has(table.sport), `${table.sport} ska inte få konstgjord ligatabell`);

const clubNames = new Set(Object.values(sports.municipalities).flatMap(item => item.clubs).map(item => normalize(item.name)));
for (const [municipality, payload] of Object.entries(arenas.municipalities)) {
  for (const arena of payload.arenas) {
    assert(!clubNames.has(normalize(arena.name)), `${municipality}: anläggningen ${arena.name} ligger även som förening`);
    assert(/^https:\/\//.test(arena.sourceUrl), `${municipality}: anläggningen ${arena.name} saknar källänk`);
  }
}

const health = fs.readFileSync("vard.html", "utf8");
const leisure = fs.readFileSync("fritid.html", "utf8");
assert(!/Karate Shotokan JSKA|IF Viken|Åmåls IBK/.test(health), "Vård & hälsa får inte innehålla sportkatalogen");
assert(leisure.includes("Gå till Idrott &amp; motion"), "Fritid & föreningsliv ska länka vidare utan att blanda katalogerna");
console.log(`Sportportal verifierad: ${clubCount} föreningar, strikt klubbmatchning, ${Object.values(feeds.municipalities).flatMap(item => item.standings || []).length} tabeller och separata anläggningar.`);
