import worker from "./push-worker.js";

const ALLOWED_ORIGINS = new Set(["https://dinpuls.se", "https://www.dinpuls.se"]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://dinpuls.se",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token, X-Banner-Slot, X-Banner-Start, X-Banner-Name, X-Banner-Link",
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

async function sha256(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || ""))));
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function requireAdmin(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) return false;
  const tokenHash = await sha256(match[1]);
  const now = new Date().toISOString();
  const session = await env.DB.prepare(
    "SELECT token_hash FROM portal_sessions WHERE token_hash = ? AND role = 'admin' AND expires_at > ? LIMIT 1"
  ).bind(tokenHash, now).first();
  return Boolean(session);
}

async function deleteContract(request, env, id) {
  if (!await requireAdmin(request, env)) return json(request, { ok: false, error: "Obehörig." }, 401);

  const contract = await env.DB.prepare(
    "SELECT id, company_user_id, customer_signature_object_key, dinpuls_signature_object_key, signed_pdf_object_key FROM ad_contracts WHERE id = ?"
  ).bind(id).first();
  if (!contract) return json(request, { ok: false, error: "Avtalet finns inte." }, 404);

  const banners = await env.DB.prepare("SELECT id, object_key FROM ad_banners WHERE contract_id = ?").bind(id).all();

  try {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM ad_daily_stats WHERE banner_id IN (SELECT id FROM ad_banners WHERE contract_id = ?)").bind(id),
      env.DB.prepare("DELETE FROM ad_banners WHERE contract_id = ?").bind(id),
      env.DB.prepare("DELETE FROM contract_slot_reservations WHERE contract_id = ?").bind(id),
      env.DB.prepare("DELETE FROM ad_contracts WHERE id = ?").bind(id)
    ]);
  } catch (error) {
    console.error("Kunde inte radera annonsavtal:", id, error);
    return json(request, { ok: false, error: "Avtalet kunde inte tas bort." }, 500);
  }

  const objectKeys = new Set([
    ...(banners.results || []).map(row => row.object_key),
    contract.customer_signature_object_key,
    contract.dinpuls_signature_object_key,
    contract.signed_pdf_object_key
  ].filter(Boolean));

  if (env.AD_ASSETS) {
    await Promise.allSettled([...objectKeys].map(key => env.AD_ASSETS.delete(key)));
  }

  return json(request, {
    ok: true,
    deletedContractId: id,
    message: `Avtal ${id} har tagits bort och dess annonsplatser har frigjorts.`
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS" && origin && !ALLOWED_ORIGINS.has(origin)) {
      return new Response(null, { status: 403 });
    }

    const contractMatch = /^\/portal\/admin\/contracts\/([^/]+)$/.exec(url.pathname);
    if (request.method === "DELETE" && contractMatch) {
      return deleteContract(request, env, decodeURIComponent(contractMatch[1]));
    }

    return worker.fetch(request, env, ctx);
  }
};
