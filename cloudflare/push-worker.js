const ALLOWED_ORIGINS = new Set(["https://dinpuls.se", "https://www.dinpuls.se"]);
const MUNICIPALITIES = new Set(["Åmål", "Säffle", "Bengtsfors", "Mellerud", "Årjäng", "Arvika", "Grums", "Kil", "Sunne"]);
const REQUIRED_CATEGORIES = ["extreme-weather", "missing-people", "important"];
const OPTIONAL_CATEGORIES = new Set(["traffic", "transport", "news", "events", "jobs", "housing", "sport"]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://dinpuls.se",
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function endpointHash(endpoint) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

async function ensureDatabase(env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS subscriptions (" +
    "endpoint_hash TEXT PRIMARY KEY, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, " +
    "municipality TEXT NOT NULL, categories TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'sv-SE', " +
    "time_zone TEXT NOT NULL DEFAULT 'Europe/Stockholm', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, " +
    "last_success_at TEXT, failure_count INTEGER NOT NULL DEFAULT 0)"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS subscriptions_municipality ON subscriptions (municipality)"
  ).run();
}

function cleanCategories(value) {
  const optional = Array.isArray(value) ? value.filter(category => OPTIONAL_CATEGORIES.has(category)) : [];
  return [...new Set([...REQUIRED_CATEGORIES, ...optional])];
}

async function saveSubscription(request, env) {
  const body = await request.json();
  const subscription = body?.subscription;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  const municipality = body?.municipality;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 4096 ||
      typeof p256dh !== "string" || typeof auth !== "string" || !MUNICIPALITIES.has(municipality)) {
    return json(request, { ok: false, error: "Ogiltig pushprenumeration eller kommun." }, 400);
  }
  const hash = await endpointHash(endpoint);
  const categories = cleanCategories(body.categories);
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO subscriptions (endpoint_hash, endpoint, p256dh, auth, municipality, categories, language, time_zone, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint_hash) DO UPDATE SET " +
    "endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth, municipality = excluded.municipality, " +
    "categories = excluded.categories, language = excluded.language, time_zone = excluded.time_zone, " +
    "updated_at = excluded.updated_at, failure_count = 0"
  ).bind(hash, endpoint, p256dh, auth, municipality, JSON.stringify(categories), "sv-SE", "Europe/Stockholm", now, now).run();
  return json(request, { ok: true, municipality, categories });
}

async function deleteSubscription(request, env) {
  const body = await request.json();
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
    return json(request, { ok: false, error: "Ogiltig pushadress." }, 400);
  }
  await env.DB.prepare("DELETE FROM subscriptions WHERE endpoint_hash = ?").bind(await endpointHash(endpoint)).run();
  return json(request, { ok: true });
}

function configureWebPush(env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    throw new Error("VAPID-inställningarna saknas");
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}

async function sendTestNotification(request, env) {
  if (!env.PUSH_ADMIN_TOKEN || request.headers.get("X-Admin-Token") !== env.PUSH_ADMIN_TOKEN) {
    return json(request, { ok: false, error: "Obehörig testsändning." }, 401);
  }
  const body = await request.json();
  if (!MUNICIPALITIES.has(body?.municipality)) {
    return json(request, { ok: false, error: "Ogiltig kommun." }, 400);
  }
  const row = await env.DB.prepare(
    "SELECT endpoint_hash, endpoint, p256dh, auth FROM subscriptions WHERE municipality = ? ORDER BY updated_at DESC LIMIT 1"
  ).bind(body.municipality).first();
  if (!row) return json(request, { ok: false, error: "Ingen aktiv prenumeration finns för kommunen." }, 404);

  configureWebPush(env);
  try {
    const result = await webpush.sendNotification({
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth }
    }, JSON.stringify({
      title: `Testnotis från DinPuls · ${body.municipality}`,
      body: "Pushnotiser fungerar på den här enheten.",
      tag: `dinpuls-test-${body.municipality}`,
      url: `/?kommun=${encodeURIComponent(body.municipality)}`
    }), { TTL: 60 });
    await env.DB.prepare(
      "UPDATE subscriptions SET last_success_at = ?, failure_count = 0 WHERE endpoint_hash = ?"
    ).bind(new Date().toISOString(), row.endpoint_hash).run();
    return json(request, { ok: true, statusCode: result.statusCode });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 0);
    if (statusCode === 404 || statusCode === 410) {
      await env.DB.prepare("DELETE FROM subscriptions WHERE endpoint_hash = ?").bind(row.endpoint_hash).run();
    } else {
      await env.DB.prepare(
        "UPDATE subscriptions SET failure_count = failure_count + 1 WHERE endpoint_hash = ?"
      ).bind(row.endpoint_hash).run();
    }
    console.error("DinPuls testsändning:", error);
    return json(request, { ok: false, error: "Testnotisen kunde inte levereras.", statusCode }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") {
      if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json(request, { ok: false, error: "Otillåten webbplats." }, 403);
    }
    try {
      await ensureDatabase(env);
      if (request.method === "GET" && url.pathname === "/health") {
        return json(request, {
          ok: true,
          service: "DinPuls Push",
          database: "connected",
          vapidConfigured: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT)
        });
      }
      if (request.method === "GET" && url.pathname === "/config") {
        return json(request, {
          enabled: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT),
          publicKey: env.VAPID_PUBLIC_KEY || ""
        });
      }
      if (request.method === "PUT" && url.pathname === "/subscriptions") return saveSubscription(request, env);
      if (request.method === "DELETE" && url.pathname === "/subscriptions") return deleteSubscription(request, env);
      if (request.method === "POST" && url.pathname === "/admin/test") return sendTestNotification(request, env);
      return json(request, { ok: false, error: "Sökvägen finns inte." }, 404);
    } catch (error) {
      console.error("DinPuls Push:", error);
      return json(request, { ok: false, error: "Servern kunde inte behandla anropet." }, 500);
    }
  }
};
import webpush from "web-push";
