import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const ROOT = new URL("../../", import.meta.url);
const SOURCES_PATH = new URL("data/sport-sources.json", ROOT);
const OUTPUT_PATH = new URL("data/sport-feeds.json", ROOT);
const USER_AGENT = "DinPuls-SportFeed/1.2 (+https://github.com/SirElin8290/DinPuls)";

const decodeEntities = value => String(value ?? "")
  .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'").replace(/&aring;/gi, "å").replace(/&auml;/gi, "ä")
  .replace(/&ouml;/gi, "ö").replace(/&Aring;/g, "Å").replace(/&Auml;/g, "Ä").replace(/&Ouml;/g, "Ö")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const cleanText = html => decodeEntities(String(html ?? "")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<br\s*\/?\s*>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ").trim());

const stableId = parts => createHash("sha1").update(parts.filter(Boolean).join("|").toLowerCase()).digest("hex").slice(0, 20);

function parseDate(value) {
  const text = cleanText(value);
  let match = text.match(/(20\d{2})-(\d{2})-(\d{2})[T\s]+(\d{1,2}):(\d{2})/);
  if (!match) {
    const short = text.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](20\d{2}))?\s+(\d{1,2})[:.](\d{2})\b/);
    if (short) match = [short[0], short[3] || new Date().getFullYear(), short[2], short[1], short[4], short[5]];
  }
  if (!match) return null;
  const wanted = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5])
  ];
  const utcGuess = Date.UTC(wanted[0], wanted[1] - 1, wanted[2], wanted[3], wanted[4]);
  const stockholmParts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(utcGuess)).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = Number(part.value);
    return result;
  }, {});
  const stockholmAtGuess = Date.UTC(
    stockholmParts.year,
    stockholmParts.month - 1,
    stockholmParts.day,
    stockholmParts.hour,
    stockholmParts.minute
  );
  const date = new Date(utcGuess - (stockholmAtGuess - utcGuess));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseGenericClubCalendar(html, source) {
  const blocks = [
    ...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi),
    ...String(html).matchAll(/<(?:article|li)\b[^>]*>([\s\S]*?)<\/(?:article|li)>/gi)
  ].map(hit => cleanText(hit[1])).filter(Boolean);
  const matches = [];
  for (const block of blocks) {
    const date = block.match(/20\d{2}-\d{2}-\d{2}[T\s]+\d{1,2}:\d{2}|\b\d{1,2}[\/.]\d{1,2}(?:[\/.]20\d{2})?\s+\d{1,2}[:.]\d{2}\b/)?.[0];
    if (!date) continue;
    const teamHit = block.match(/([^|]{2,70}?)\s+[–-]\s+([^|]{2,70}?)(?=\s+(?:\d+\s*[–-]\s*\d+|20\d{2}|\d{1,2}[\/.]\d{1,2})|\s*\||$)/);
    if (!teamHit) continue;
    const score = block.match(/\b(\d{1,3})\s*[–-]\s*(\d{1,3})\b/);
    const match = makeMatch(source, date, cleanText(teamHit[1]), cleanText(teamHit[2]), score ? Number(score[1]) : NaN, score ? Number(score[2]) : NaN, "");
    if (match) matches.push(match);
  }
  return [...new Map(matches.map(match => [match.id, match])).values()];
}

function makeMatch(source, dateText, homeTeam, awayTeam, homeScore, awayScore, venue = "") {
  const start = parseDate(dateText);
  const invalidTeam = value => {
    const team = cleanText(value);
    return !team || team.length > 80 || /round date|game result|spectators|venue|undefined|null/i.test(team);
  };
  if (!start || invalidTeam(homeTeam) || invalidTeam(awayTeam) || cleanText(homeTeam) === cleanText(awayTeam)) return null;
  const finished = Number.isFinite(homeScore) && Number.isFinite(awayScore);
  return {
    id: stableId([source.id, start.toISOString(), homeTeam, awayTeam]),
    sourceId: source.id,
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl,
    municipality: source.municipality,
    sport: source.sport,
    competition: source.competition || "",
    startTime: start.toISOString(),
    status: finished ? "finished" : "scheduled",
    homeTeam,
    awayTeam,
    homeScore: finished ? homeScore : null,
    awayScore: finished ? awayScore : null,
    venue,
    updatedAt: new Date().toISOString()
  };
}

function parseSwehockey(html, source) {
  const text = cleanText(html);
  const matches = [];
  const pattern = /(20\d{2}-\d{2}-\d{2}\s+\d{1,2}:\d{2})\s+(.+?)\s+-\s+(.+?)\s+(\d+)\s+-\s+(\d+)(?:\s+\([^)]*\))?(?:\s+\d+)?\s+([^\d][^]*?)(?=(?:20\d{2}-\d{2}-\d{2}\s+\d{1,2}:\d{2})|$)/g;
  for (const hit of text.matchAll(pattern)) {
    const match = makeMatch(source, hit[1], hit[2].trim(), hit[3].trim(), Number(hit[4]), Number(hit[5]), hit[6].trim().split(/\s{2,}/)[0]);
    if (match) matches.push(match);
  }
  if (!matches.length) {
    const rows = [...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map(row => [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell => cleanText(cell[1])))
      .filter(cells => cells.length >= 3);
    for (const cells of rows) {
      const joined = cells.join(" | ");
      const date = joined.match(/20\d{2}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/)?.[0];
      const teams = joined.match(/([^|]+?)\s+-\s+([^|]+?)(?=\s+\d+\s+-\s+\d+|\s*\|)/);
      const score = joined.match(/(\d+)\s+-\s+(\d+)/);
      if (!date || !teams) continue;
      const match = makeMatch(source, date, teams[1].trim(), teams[2].trim(), score ? Number(score[1]) : NaN, score ? Number(score[2]) : NaN, cells.at(-1) || "");
      if (match) matches.push(match);
    }
  }
  const seen = new Map(matches.map(match => [match.id, match]));
  return [...seen.values()];
}

const adapters = {
  "swehockey-schedule-html": parseSwehockey,
  "club-calendar-html": parseGenericClubCalendar
};

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function collectSource(source) {
  const startedAt = new Date().toISOString();
  try {
    const adapter = adapters[source.adapter];
    if (!adapter) throw new Error(`Okänd eller ej verifierad adapter: ${source.adapter}`);
    const rawMatches = adapter(await fetchText(source.sourceUrl), source);
    const matches = rawMatches.filter(match => !source.teamFilter || [match.homeTeam, match.awayTeam].some(team => team.toLowerCase().includes(source.teamFilter.toLowerCase())));
    if (!matches.length) throw new Error(`Källan hämtades men inga matcher matchade ${source.teamFilter || "urvalet"}`);
    return { health: { id: source.id, provider: source.sourceName, sport: source.sport, municipality: source.municipality, status: "ok", matchCount: matches.length, checkedAt: new Date().toISOString(), sourceUrl: source.sourceUrl }, matches };
  } catch (error) {
    return { health: { id: source.id, provider: source.sourceName, sport: source.sport, municipality: source.municipality, status: "error", matchCount: 0, checkedAt: new Date().toISOString(), sourceUrl: source.sourceUrl, message: String(error?.message || error), startedAt }, matches: [] };
  }
}

async function main() {
  const config = JSON.parse(await readFile(SOURCES_PATH, "utf8"));
  let previous = { municipalities: {} };
  try { previous = JSON.parse(await readFile(OUTPUT_PATH, "utf8")); } catch {}
  const output = { version: 2, generatedAt: new Date().toISOString(), sources: [], municipalities: {} };
  for (const [municipality, sources] of Object.entries(config.municipalities || {})) {
    output.municipalities[municipality] = { matches: [] };
    for (const source of sources.filter(item => item.enabled !== false)) {
      const result = await collectSource({ ...source, municipality: source.municipality || municipality });
      if (result.health.status === "error") {
        const retained = (previous.municipalities?.[municipality]?.matches || []).filter(match => match.sourceId === source.id);
        if (retained.length) {
          result.matches.push(...retained);
          result.health.retainedCount = retained.length;
          result.health.message = `${result.health.message}. ${retained.length} tidigare matcher behölls.`;
        }
      }
      output.sources.push(result.health);
      output.municipalities[municipality].matches.push(...result.matches);
    }
  }
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  const total = Object.values(output.municipalities).reduce((sum, item) => sum + item.matches.length, 0);
  const failures = output.sources.filter(source => source.status === "error");
  console.log(`Sportflöde skapat: ${output.sources.length} aktiva källor, ${total} matcher, ${failures.length} fel.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
