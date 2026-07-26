import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const ROOT = new URL("../../", import.meta.url);
const SOURCES_PATH = new URL("data/sport-sources.json", ROOT);
const OUTPUT_PATH = new URL("data/sport-feeds.json", ROOT);
const USER_AGENT = "DinPuls-SportFeed/1.0 (+https://github.com/SirElin8290/DinPuls)";

const decodeEntities = value => String(value ?? "")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&aring;/gi, "å")
  .replace(/&auml;/gi, "ä")
  .replace(/&ouml;/gi, "ö")
  .replace(/&Aring;/g, "Å")
  .replace(/&Auml;/g, "Ä")
  .replace(/&Ouml;/g, "Ö")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const cleanText = html => decodeEntities(String(html ?? "")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<br\s*\/?\s*>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim());

const stableId = parts => createHash("sha1").update(parts.filter(Boolean).join("|").toLowerCase()).digest("hex").slice(0, 20);

function parseSwedishDate(value, fallbackYear = new Date().getFullYear()) {
  const text = cleanText(value).toLowerCase();
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;
  const months = { jan: 0, januari: 0, feb: 1, februari: 1, mar: 2, mars: 2, apr: 3, april: 3, maj: 4, jun: 5, juni: 5, jul: 6, juli: 6, aug: 7, augusti: 7, sep: 8, september: 8, okt: 9, oktober: 9, nov: 10, november: 10, dec: 11, december: 11 };
  const match = text.match(/(?:mån|tis|ons|tor|fre|lör|sön)?\s*(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?(?:\s+(\d{1,2})[:.](\d{2}))?/i)
    || text.match(/(?:mån|tis|ons|tor|fre|lör|sön)?\s*(\d{1,2})\s+([a-zåäö]+)(?:\s+(\d{4}))?(?:\s+(?:kl\.?\s*)?(\d{1,2})[:.](\d{2}))?/i);
  if (!match) return null;
  let day = Number(match[1]);
  let month;
  let year;
  let hour;
  let minute;
  if (/^\d+$/.test(match[2])) {
    month = Number(match[2]) - 1;
    year = match[3] ? Number(match[3]) : fallbackYear;
    hour = Number(match[4] || 0);
    minute = Number(match[5] || 0);
  } else {
    month = months[match[2]];
    year = match[3] ? Number(match[3]) : fallbackYear;
    hour = Number(match[4] || 0);
    minute = Number(match[5] || 0);
  }
  if (year < 100) year += 2000;
  if (!Number.isInteger(month)) return null;
  const date = new Date(year, month, day, hour, minute, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractRows(html) {
  return [...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row =>
    [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell => cleanText(cell[1]))
  ).filter(cells => cells.length >= 3);
}

function parseScore(value) {
  const match = cleanText(value).match(/(\d+)\s*[-–:]\s*(\d+)/);
  return match ? { homeScore: Number(match[1]), awayScore: Number(match[2]), status: "finished" } : { homeScore: null, awayScore: null, status: "scheduled" };
}

function parseTeams(value) {
  const text = cleanText(value);
  const match = text.match(/^(.+?)\s+[-–]\s+(.+)$/);
  return match ? { homeTeam: match[1].trim(), awayTeam: match[2].trim() } : null;
}

function ibisTeamResultAdapter(html, source) {
  const rows = extractRows(html);
  const matches = [];
  let currentCompetition = "";
  const now = new Date();
  for (const cells of rows) {
    const joined = cells.join(" | ");
    if (/datum|match|resultat/i.test(joined) && /tävling|serie/i.test(joined)) continue;
    if (cells.length === 1) {
      currentCompetition = cells[0];
      continue;
    }
    const teamIndex = cells.findIndex(cell => /\s[-–]\s/.test(cell));
    if (teamIndex < 0) {
      if (cells.length <= 2 && cells.some(cell => cell.length > 3)) currentCompetition = cells.join(" ");
      continue;
    }
    const teams = parseTeams(cells[teamIndex]);
    if (!teams) continue;
    const dateText = cells.slice(0, teamIndex).join(" ");
    const start = parseSwedishDate(dateText, now.getFullYear());
    if (!start) continue;
    const scoreCell = cells.slice(teamIndex + 1).find(cell => /\d+\s*[-–:]\s*\d+/.test(cell)) || "";
    const score = parseScore(scoreCell);
    const venue = cells.slice(teamIndex + 1).find(cell => cell && cell !== scoreCell && !/^\d+$/.test(cell)) || "";
    matches.push({
      id: stableId([source.id, start.toISOString(), teams.homeTeam, teams.awayTeam]),
      sourceId: source.id,
      sourceName: source.sourceName,
      sourceUrl: source.sourceUrl,
      municipality: source.municipality,
      sport: source.sport,
      competition: currentCompetition,
      startTime: start.toISOString(),
      status: score.status,
      homeTeam: teams.homeTeam,
      awayTeam: teams.awayTeam,
      homeScore: score.homeScore,
      awayScore: score.awayScore,
      venue,
      updatedAt: new Date().toISOString()
    });
  }
  return matches;
}

const adapters = {
  "ibis-teamresult-html": ibisTeamResultAdapter
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
    if (!adapter) throw new Error(`Okänd adapter: ${source.adapter}`);
    const html = await fetchText(source.sourceUrl);
    const matches = adapter(html, source);
    return {
      health: { id: source.id, provider: source.sourceName, sport: source.sport, municipality: source.municipality, status: "ok", matchCount: matches.length, checkedAt: new Date().toISOString(), sourceUrl: source.sourceUrl },
      matches
    };
  } catch (error) {
    return {
      health: { id: source.id, provider: source.sourceName, sport: source.sport, municipality: source.municipality, status: "error", matchCount: 0, checkedAt: new Date().toISOString(), sourceUrl: source.sourceUrl, message: String(error?.message || error), startedAt },
      matches: []
    };
  }
}

async function main() {
  const config = JSON.parse(await readFile(SOURCES_PATH, "utf8"));
  const output = { version: 1, generatedAt: new Date().toISOString(), sources: [], municipalities: {} };
  for (const [municipality, sources] of Object.entries(config.municipalities || {})) {
    output.municipalities[municipality] = { matches: [] };
    for (const source of sources.filter(item => item.enabled !== false)) {
      const result = await collectSource({ ...source, municipality: source.municipality || municipality });
      output.sources.push(result.health);
      output.municipalities[municipality].matches.push(...result.matches);
    }
  }
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  const failures = output.sources.filter(source => source.status === "error");
  console.log(`Sportflöde skapat: ${output.sources.length} källor, ${Object.values(output.municipalities).reduce((sum, item) => sum + item.matches.length, 0)} matcher, ${failures.length} fel.`);
  if (failures.length === output.sources.length && output.sources.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
