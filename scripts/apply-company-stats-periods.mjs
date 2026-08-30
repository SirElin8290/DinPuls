import fs from 'node:fs';

const htmlPath = 'foretag/index.html';
const workerPath = 'cloudflare/push-worker.js';

let html = fs.readFileSync(htmlPath, 'utf8');
if (!html.includes('./stats-periods.js')) {
  html = html.replace('<script src="./foretag.js?v=10"></script><script src="./banner-preview.js?v=1"></script>', '<script src="./foretag.js?v=10"></script><script src="./stats-periods.js?v=1"></script><script src="./banner-preview.js?v=1"></script>');
  fs.writeFileSync(htmlPath, html);
}

let worker = fs.readFileSync(workerPath, 'utf8');
const replacement = `async function companyStats(request, env) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);

  const url = new URL(request.url);
  const allowedPeriods = new Set(["day", "week", "month", "year"]);
  const period = allowedPeriods.has(url.searchParams.get("period")) ? url.searchParams.get("period") : "month";
  const today = stockholmDateKey(new Date().toISOString());
  const requestedAnchor = cleanText(url.searchParams.get("anchor"), 10);
  const anchor = /^\\d{4}-\\d{2}-\\d{2}$/.test(requestedAnchor) && !Number.isNaN(Date.parse(requestedAnchor + "T12:00:00Z")) ? requestedAnchor : today;

  const fromKey = key => {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12));
  };
  const toKey = date => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  };
  const addDays = (key, days) => {
    const date = fromKey(key);
    date.setUTCDate(date.getUTCDate() + days);
    return toKey(date);
  };

  let startDate = anchor;
  let endDate = anchor;
  const anchorDate = fromKey(anchor);
  if (period === "week") {
    const weekday = anchorDate.getUTCDay() || 7;
    startDate = addDays(anchor, 1 - weekday);
    endDate = addDays(startDate, 6);
  } else if (period === "month") {
    startDate = anchor.slice(0, 7) + "-01";
    const nextMonth = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() + 1, 1, 12));
    nextMonth.setUTCDate(nextMonth.getUTCDate() - 1);
    endDate = toKey(nextMonth);
  } else if (period === "year") {
    startDate = anchor.slice(0, 4) + "-01-01";
    endDate = anchor.slice(0, 4) + "-12-31";
  }

  const totals = await env.DB.prepare(
    "SELECT COALESCE(SUM(impressions), 0) AS impressions, COALESCE(SUM(clicks), 0) AS clicks " +
    "FROM ad_daily_stats WHERE company_user_id = ? AND day BETWEEN ? AND ?"
  ).bind(session.subject_id, startDate, endDate).first();
  const seriesResult = await env.DB.prepare(
    "SELECT day, COALESCE(SUM(impressions), 0) AS impressions, COALESCE(SUM(clicks), 0) AS clicks " +
    "FROM ad_daily_stats WHERE company_user_id = ? AND day BETWEEN ? AND ? GROUP BY day ORDER BY day ASC"
  ).bind(session.subject_id, startDate, endDate).all();
  const active = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM ad_banners b JOIN ad_contracts c ON c.id = b.contract_id " +
    "WHERE b.company_user_id = ? AND c.status = 'Aktivt' AND b.start_at <= ?"
  ).bind(session.subject_id, new Date().toISOString()).first();
  const impressions = Number(totals?.impressions || 0);
  const clicks = Number(totals?.clicks || 0);
  const series = (seriesResult.results || []).map(row => ({
    day: row.day,
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0)
  }));
  return json(request, {
    ok: true,
    period,
    anchor,
    startDate,
    endDate,
    activeBanners: Number(active?.count || 0),
    impressions,
    clicks,
    ctr: impressions ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
    series
  });
}

async function serveBannerAsset`;

const statsPattern = /async function companyStats\(request, env\) \{[\s\S]*?\n\}\n\nasync function serveBannerAsset/;
if (!statsPattern.test(worker)) throw new Error('Kunde inte hitta companyStats i cloudflare/push-worker.js');
worker = worker.replace(statsPattern, replacement);
fs.writeFileSync(workerPath, worker);

console.log('Företagsstatistik uppdaterad med dag/vecka/månad/år.');
