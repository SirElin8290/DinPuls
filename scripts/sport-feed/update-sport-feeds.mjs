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
  if (!match) {
    const months = { jan: 1, feb: 2, mar: 3, apr: 4, maj: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dec: 12 };
    const swedish = text.toLocaleLowerCase("sv-SE").match(/(?:mån|tis|ons|tor|fre|lör|sön)?\s*(\d{1,2})\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)\s+(20\d{2})(?:,?\s+(\d{1,2}):(\d{2}))?/);
    if (swedish) match = [swedish[0], swedish[3], months[swedish[2]], swedish[1], swedish[4] || 0, swedish[5] || 0];
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

const normalizeTeam = value => cleanText(value).toLocaleLowerCase("sv-SE").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function sourceTeamNames(source) {
  return [source.teamFilter, ...(source.teamAliases || [])].map(normalizeTeam).filter(Boolean);
}

function sourceIncludesTeam(match, source) {
  const wanted = sourceTeamNames(source);
  if (!wanted.length) return true;
  const teams = [normalizeTeam(match.homeTeam), normalizeTeam(match.awayTeam)];
  return wanted.some(alias => teams.includes(alias));
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
    timeTbd: !/\d{1,2}[:.]\d{2}/.test(cleanText(dateText)),
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

function parseLagetDivision(html, source) {
  const tables = [...String(html).matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(hit => hit[1]);
  const matches = [];
  let standings = null;
  for (const table of tables) {
    const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map(row => [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell => cleanText(cell[1])))
      .filter(cells => cells.length);
    if (!rows.length) continue;
    const header = rows[0].map(normalizeTeam);
    if (header.includes("lag") && header.includes("m") && header.includes("p")) {
      const hasGoals = header.includes("+") && header.includes("-");
      const body = rows.slice(1).filter(cells => /^\d+$/.test(cells[0]) && cells[1]);
      if (body.length) {
        standings = {
          id: stableId([source.id, source.competition, "standings"]),
          sourceId: source.id,
          sourceName: source.sourceName,
          sourceUrl: source.standingsUrl || source.sourceUrl,
          municipality: source.municipality,
          sport: source.sport,
          competition: source.competition || "",
          updatedAt: new Date().toISOString(),
          rows: body.map(cells => ({
            position: Number(cells[0]), team: cells[1], played: Number(cells[2]), won: Number(cells[3]), drawn: Number(cells[4]), lost: Number(cells[5]),
            goalsFor: hasGoals ? Number(cells[6]) : null, goalsAgainst: hasGoals ? Number(cells[7]) : null,
            goalDifference: hasGoals ? Number(cells[8]) : null, points: Number(cells[hasGoals ? 9 : 6])
          }))
        };
      }
      continue;
    }
    for (const cells of rows) {
      if (cells.length < 2) continue;
      const dateText = cells[0];
      const teams = cells[1].match(/^(.+?)\s+[–-]\s+(.+)$/);
      if (!teams) continue;
      const score = (cells[2] || "").match(/^(\d{1,3})\s*[–-]\s*(\d{1,3})$/);
      const match = makeMatch(source, dateText, teams[1], teams[2], score ? Number(score[1]) : NaN, score ? Number(score[2]) : NaN, "");
      if (match) matches.push(match);
    }
  }
  return { matches: [...new Map(matches.map(match => [match.id, match])).values()], standings: standings ? [standings] : [] };
}

const adapters = {
  "swehockey-schedule-html": parseSwehockey,
  "club-calendar-html": parseGenericClubCalendar,
  "laget-division-html": parseLagetDivision
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
    const parsed = adapter(await fetchText(source.sourceUrl), source);
    const rawMatches = Array.isArray(parsed) ? parsed : parsed.matches || [];
    const matches = rawMatches.filter(match => sourceIncludesTeam(match, source));
    const standings = Array.isArray(parsed) ? [] : parsed.standings || [];
    if (!matches.length && !standings.length) throw new Error(`Källan hämtades men ingen sportdata matchade ${source.teamFilter || "urvalet"}`);
    return { health: { id: source.id, provider: source.sourceName, sport: source.sport, municipality: source.municipality, status: "ok", matchCount: matches.length, standingCount: standings.length, checkedAt: new Date().toISOString(), sourceUrl: source.sourceUrl }, matches, standings };
  } catch (error) {
    return { health: { id: source.id, provider: source.sourceName, sport: source.sport, municipality: source.municipality, status: "error", matchCount: 0, standingCount: 0, checkedAt: new Date().toISOString(), sourceUrl: source.sourceUrl, message: String(error?.message || error), startedAt }, matches: [], standings: [] };
  }
}

async function main() {
  const config = JSON.parse(await readFile(SOURCES_PATH, "utf8"));
  let previous = { municipalities: {} };
  try { previous = JSON.parse(await readFile(OUTPUT_PATH, "utf8")); } catch {}
  const output = { version: 3, generatedAt: new Date().toISOString(), sources: [], municipalities: {} };
  for (const [municipality, sources] of Object.entries(config.municipalities || {})) {
    output.municipalities[municipality] = { matches: [], standings: [] };
    for (const source of sources.filter(item => item.enabled !== false)) {
      const result = await collectSource({ ...source, municipality: source.municipality || municipality });
      if (result.health.status === "error") {
        const retained = (previous.municipalities?.[municipality]?.matches || []).filter(match => match.sourceId === source.id);
        if (retained.length) {
          result.matches.push(...retained);
          result.health.retainedCount = retained.length;
          result.health.message = `${result.health.message}. ${retained.length} tidigare matcher behölls.`;
        }
        const retainedStandings = (previous.municipalities?.[municipality]?.standings || []).filter(table => table.sourceId === source.id);
        if (retainedStandings.length) {
          result.standings.push(...retainedStandings);
          result.health.retainedStandingCount = retainedStandings.length;
        }
      }
      output.sources.push(result.health);
      output.municipalities[municipality].matches.push(...result.matches);
      output.municipalities[municipality].standings.push(...result.standings);
    }
  }
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  const total = Object.values(output.municipalities).reduce((sum, item) => sum + item.matches.length, 0);
  const failures = output.sources.filter(source => source.status === "error");
  const tables = Object.values(output.municipalities).reduce((sum, item) => sum + item.standings.length, 0);
  console.log(`Sportflöde skapat: ${output.sources.length} aktiva källor, ${total} matcher, ${tables} tabeller, ${failures.length} fel.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
