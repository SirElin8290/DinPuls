const ALLOWED_ORIGINS = new Set(["https://dinpuls.se", "https://www.dinpuls.se"]);
const MUNICIPALITIES = new Set(["Åmål", "Säffle", "Bengtsfors", "Mellerud", "Årjäng", "Arvika", "Grums", "Kil", "Sunne"]);
const REQUIRED_CATEGORIES = ["extreme-weather", "missing-people", "important"];
const OPTIONAL_CATEGORIES = new Set(["traffic", "transport", "news", "events", "jobs", "housing", "sport"]);

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
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS business_users (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, password_iterations INTEGER NOT NULL DEFAULT 10000, " +
    "company TEXT NOT NULL, org_no TEXT NOT NULL, contact TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', municipality TEXT NOT NULL, " +
    "active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"
  ).run();
  const userColumns = await env.DB.prepare("PRAGMA table_info(business_users)").all();
  if (!(userColumns.results || []).some(column => column.name === "password_iterations")) {
    await env.DB.prepare("ALTER TABLE business_users ADD COLUMN password_iterations INTEGER NOT NULL DEFAULT 10000").run();
  }
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS ad_contracts (" +
    "id TEXT PRIMARY KEY, company_user_id INTEGER NOT NULL, contract_version TEXT NOT NULL, municipality TEXT NOT NULL, " +
    "placements TEXT NOT NULL, price REAL NOT NULL, annual_price REAL NOT NULL, monthly_total REAL NOT NULL, annual_total REAL NOT NULL, " +
    "billing_type TEXT NOT NULL DEFAULT 'paid', value_note TEXT NOT NULL DEFAULT '', renewal_type TEXT NOT NULL DEFAULT 'annual-review', signature_required INTEGER NOT NULL DEFAULT 0, " +
    "start_date TEXT NOT NULL, end_date TEXT NOT NULL, included_changes INTEGER NOT NULL DEFAULT 4, used_changes INTEGER NOT NULL DEFAULT 0, " +
    "status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, " +
    "FOREIGN KEY(company_user_id) REFERENCES business_users(id))"
  ).run();
  const contractColumns = await env.DB.prepare("PRAGMA table_info(ad_contracts)").all();
  const existingContractColumns = new Set((contractColumns.results || []).map(column => column.name));
  for (const [name, definition] of [
    ["billing_type", "TEXT NOT NULL DEFAULT 'paid'"],
    ["value_note", "TEXT NOT NULL DEFAULT ''"],
    ["renewal_type", "TEXT NOT NULL DEFAULT 'annual-review'"],
    ["signature_required", "INTEGER NOT NULL DEFAULT 0"]
  ]) {
    if (!existingContractColumns.has(name)) await env.DB.prepare(`ALTER TABLE ad_contracts ADD COLUMN ${name} ${definition}`).run();
  }
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS ad_contracts_company ON ad_contracts (company_user_id, status)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS portal_sessions (" +
    "token_hash TEXT PRIMARY KEY, role TEXT NOT NULL, subject_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS login_attempts (" +
    "attempt_key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at TEXT NOT NULL)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS ad_banners (" +
    "id TEXT PRIMARY KEY, company_user_id INTEGER NOT NULL, contract_id TEXT NOT NULL, slot_id TEXT NOT NULL, " +
    "object_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, content_type TEXT NOT NULL, file_size INTEGER NOT NULL, " +
    "target_url TEXT NOT NULL DEFAULT '', start_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, " +
    "FOREIGN KEY(company_user_id) REFERENCES business_users(id), FOREIGN KEY(contract_id) REFERENCES ad_contracts(id))"
  ).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS ad_banners_schedule ON ad_banners (contract_id, slot_id, start_at)").run();
}

const PORTAL_STATUSES = new Set(["Utkast", "Skickat", "Aktivt", "Avslutat"]);
const BILLING_TYPES = new Set(["paid", "complimentary"]);
const RENEWAL_TYPES = new Set(["annual-review", "none"]);
const SESSION_HOURS = 8;

function bytesToHex(bytes) {
  return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value) {
  if (!/^[0-9a-f]+$/i.test(value || "") || value.length % 2) return new Uint8Array();
  return new Uint8Array(value.match(/.{2}/g).map(part => Number.parseInt(part, 16)));
}

async function sha256(value) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

async function hashPassword(password, saltHex, pepper) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const message = new Uint8Array([...hexToBytes(saltHex), ...new TextEncoder().encode(password)]);
  return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, message)));
}

function safeEqual(left, right) {
  const a = new TextEncoder().encode(String(left || ""));
  const b = new TextEncoder().encode(String(right || ""));
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

function cleanText(value, maximum = 200) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

function validDateTime(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function validTargetUrl(value) {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

function stockholmDateKey(value) {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = type => parts.find(item => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function bannerFromRow(row) {
  return { id: row.id, slotId: row.slot_id, fileName: row.file_name, contentType: row.content_type,
    fileSize: Number(row.file_size), targetUrl: row.target_url || "", startAt: row.start_at,
    imageUrl: `/ads/assets/${encodeURIComponent(row.id)}`, createdAt: row.created_at };
}

async function activeCompanyContract(env, companyUserId) {
  return env.DB.prepare("SELECT id, placements, start_date, end_date FROM ad_contracts WHERE company_user_id = ? AND status = 'Aktivt' ORDER BY updated_at DESC LIMIT 1")
    .bind(companyUserId).first();
}

function contractHasSlot(contract, slotId) {
  try { return JSON.parse(contract?.placements || "[]").some(item => item.slotId === slotId); } catch { return false; }
}

async function listCompanyBanners(request, env) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);
  const contract = await activeCompanyContract(env, session.subject_id);
  if (!contract) return json(request, { ok: true, banners: [] });
  const result = await env.DB.prepare("SELECT * FROM ad_banners WHERE company_user_id = ? AND contract_id = ? ORDER BY start_at ASC")
    .bind(session.subject_id, contract.id).all();
  return json(request, { ok: true, banners: (result.results || []).map(bannerFromRow) });
}

function imageTypeMatches(bytes, declaredType) {
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return (png && declaredType === "image/png") || (jpeg && declaredType === "image/jpeg") || (webp && declaredType === "image/webp");
}

async function uploadCompanyBanner(request, env) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);
  if (!env.AD_ASSETS) return json(request, { ok: false, error: "Bannerlagringen är inte aktiverad." }, 503);
  const size = Number(request.headers.get("Content-Length") || 0);
  const contentType = cleanText(request.headers.get("Content-Type"), 80).split(";")[0].toLowerCase();
  const slotId = cleanText(request.headers.get("X-Banner-Slot"), 40);
  const startAt = cleanText(request.headers.get("X-Banner-Start"), 40);
  const fileName = cleanText(decodeURIComponent(request.headers.get("X-Banner-Name") || "banner"), 160);
  const targetUrl = cleanText(decodeURIComponent(request.headers.get("X-Banner-Link") || ""), 500);
  if (!size || size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(contentType)) return json(request, { ok: false, error: "Välj en PNG-, JPG- eller WebP-bild på högst 5 MB." }, 400);
  if (!slotId || !validDateTime(startAt) || !validTargetUrl(targetUrl)) return json(request, { ok: false, error: "Annonsplats, publiceringstid eller länk är ogiltig." }, 400);
  const contract = await activeCompanyContract(env, session.subject_id);
  if (!contract || !contractHasSlot(contract, slotId)) return json(request, { ok: false, error: "Annonsplatsen ingår inte i ditt aktiva avtal." }, 403);
  const scheduledDate = stockholmDateKey(startAt);
  if (scheduledDate < contract.start_date || scheduledDate > contract.end_date) return json(request, { ok: false, error: "Publiceringsdatumet måste ligga inom avtalsperioden." }, 400);
  const upcoming = await env.DB.prepare("SELECT COUNT(*) AS count FROM ad_banners WHERE company_user_id = ? AND contract_id = ? AND slot_id = ? AND start_at > ?")
    .bind(session.subject_id, contract.id, slotId, new Date().toISOString()).first();
  if (Number(upcoming?.count || 0) >= 4) return json(request, { ok: false, error: "Du kan ha högst fyra kommande banners per annonsplats." }, 409);
  const buffer = await request.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength !== size || !imageTypeMatches(bytes, contentType)) return json(request, { ok: false, error: "Bildfilen kunde inte verifieras." }, 400);
  const id = crypto.randomUUID();
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const objectKey = `companies/${session.subject_id}/${contract.id}/${slotId}/${id}.${extension}`;
  await env.AD_ASSETS.put(objectKey, buffer, { httpMetadata: { contentType, cacheControl: "public, max-age=300" } });
  const now = new Date().toISOString();
  try {
    await env.DB.prepare("INSERT INTO ad_banners (id, company_user_id, contract_id, slot_id, object_key, file_name, content_type, file_size, target_url, start_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, session.subject_id, contract.id, slotId, objectKey, fileName, contentType, size, targetUrl, startAt, now, now).run();
  } catch (error) { await env.AD_ASSETS.delete(objectKey); throw error; }
  return json(request, { ok: true, banner: bannerFromRow({ id, slot_id: slotId, file_name: fileName, content_type: contentType, file_size: size, target_url: targetUrl, start_at: startAt, created_at: now }) }, 201);
}

async function deleteCompanyBanner(request, env, id) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);
  const banner = await env.DB.prepare("SELECT object_key, start_at FROM ad_banners WHERE id = ? AND company_user_id = ?").bind(id, session.subject_id).first();
  if (!banner) return json(request, { ok: false, error: "Bannern finns inte." }, 404);
  if (Date.parse(banner.start_at) <= Date.now()) return json(request, { ok: false, error: "En redan publicerad banner kan inte tas bort här. Kontakta DinPuls." }, 409);
  await env.DB.prepare("DELETE FROM ad_banners WHERE id = ? AND company_user_id = ?").bind(id, session.subject_id).run();
  if (env.AD_ASSETS) await env.AD_ASSETS.delete(banner.object_key);
  return json(request, { ok: true });
}

async function currentBanner(request, env, slotId, municipality) {
  if (!MUNICIPALITIES.has(municipality)) return json(request, { ok: false, error: "Ogiltig kommun." }, 400);
  const now = new Date().toISOString();
  const today = stockholmDateKey(now);
  const row = await env.DB.prepare("SELECT b.* FROM ad_banners b JOIN ad_contracts c ON c.id = b.contract_id WHERE b.slot_id = ? AND c.municipality = ? AND c.status = 'Aktivt' AND b.start_at <= ? AND c.start_date <= ? AND c.end_date >= ? ORDER BY b.start_at DESC LIMIT 1")
    .bind(slotId, municipality, now, today, today).first();
  return json(request, { ok: true, banner: row ? bannerFromRow(row) : null });
}

async function serveBannerAsset(request, env, id) {
  if (!env.AD_ASSETS || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const row = await env.DB.prepare("SELECT object_key FROM ad_banners WHERE id = ?").bind(id).first();
  if (!row) return new Response("Not found", { status: 404 });
  const object = await env.AD_ASSETS.get(row.object_key);
  if (!object?.body) return new Response("Not found", { status: 404 });
  const headers = new Headers({ "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" });
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { headers });
}

async function readBody(request) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 100000) throw new Error("För stor begäran");
  return request.json();
}

async function checkLoginLimit(request, env, identity, role) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = await sha256(`${ip}|${role}|${String(identity).toLowerCase()}`);
  const now = Date.now();
  const row = await env.DB.prepare("SELECT attempts, reset_at FROM login_attempts WHERE attempt_key = ?").bind(key).first();
  if (row && Date.parse(row.reset_at) > now && Number(row.attempts) >= 8) return { allowed: false, key };
  if (!row || Date.parse(row.reset_at) <= now) {
    await env.DB.prepare("INSERT INTO login_attempts (attempt_key, attempts, reset_at) VALUES (?, 0, ?) ON CONFLICT(attempt_key) DO UPDATE SET attempts = 0, reset_at = excluded.reset_at")
      .bind(key, new Date(now + 15 * 60 * 1000).toISOString()).run();
  }
  return { allowed: true, key };
}

async function recordLoginFailure(env, key) {
  await env.DB.prepare("UPDATE login_attempts SET attempts = attempts + 1 WHERE attempt_key = ?").bind(key).run();
}

async function clearLoginFailures(env, key) {
  await env.DB.prepare("DELETE FROM login_attempts WHERE attempt_key = ?").bind(key).run();
}

async function createSession(env, role, subjectId) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToHex(tokenBytes);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO portal_sessions (token_hash, role, subject_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(await sha256(token), role, String(subjectId), expiresAt, now.toISOString()).run();
  return { token, expiresAt };
}

function bearerToken(request) {
  const match = /^Bearer\s+([0-9a-f]{64})$/i.exec(request.headers.get("Authorization") || "");
  return match?.[1] || "";
}

async function requireSession(request, env, role) {
  const token = bearerToken(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare("SELECT role, subject_id, expires_at FROM portal_sessions WHERE token_hash = ?").bind(tokenHash).first();
  if (!row || row.role !== role || Date.parse(row.expires_at) <= Date.now()) {
    await env.DB.prepare("DELETE FROM portal_sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }
  return { ...row, tokenHash };
}

async function logoutPortal(request, env) {
  const token = bearerToken(request);
  if (token) await env.DB.prepare("DELETE FROM portal_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return json(request, { ok: true });
}

async function adminLogin(request, env) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) return json(request, { ok: false, error: "Admininloggningen är inte konfigurerad." }, 503);
  const body = await readBody(request);
  const username = cleanText(body?.username, 100);
  const password = String(body?.password || "");
  const limit = await checkLoginLimit(request, env, username, "admin");
  if (!limit.allowed) return json(request, { ok: false, error: "För många inloggningsförsök. Försök igen om 15 minuter." }, 429);
  if (!safeEqual(username, env.ADMIN_USERNAME) || !safeEqual(password, env.ADMIN_PASSWORD)) {
    await recordLoginFailure(env, limit.key);
    return json(request, { ok: false, error: "Fel användarnamn eller lösenord." }, 401);
  }
  await clearLoginFailures(env, limit.key);
  return json(request, { ok: true, ...(await createSession(env, "admin", username)) });
}

async function companyLogin(request, env) {
  if (!env.PORTAL_PASSWORD_PEPPER) return json(request, { ok: false, error: "Företagsinloggningen är inte konfigurerad." }, 503);
  const body = await readBody(request);
  const email = cleanText(body?.email, 254).toLowerCase();
  const password = String(body?.password || "");
  const limit = await checkLoginLimit(request, env, email, "company");
  if (!limit.allowed) return json(request, { ok: false, error: "För många inloggningsförsök. Försök igen om 15 minuter." }, 429);
  const user = validEmail(email) ? await env.DB.prepare("SELECT id, password_salt, password_hash, active FROM business_users WHERE email = ?").bind(email).first() : null;
  const candidateHash = user ? await hashPassword(password, user.password_salt, env.PORTAL_PASSWORD_PEPPER) : await hashPassword(password, "00".repeat(16), env.PORTAL_PASSWORD_PEPPER);
  if (!user || !Number(user.active) || !safeEqual(candidateHash, user.password_hash)) {
    await recordLoginFailure(env, limit.key);
    return json(request, { ok: false, error: "Fel e-post eller lösenord." }, 401);
  }
  await clearLoginFailures(env, limit.key);
  return json(request, { ok: true, ...(await createSession(env, "company", user.id)) });
}

function contractFromRow(row) {
  return {
    id: row.id, contractVersion: row.contract_version, company: row.company, orgNo: row.org_no,
    contact: row.contact, email: row.email, phone: row.phone, municipality: row.municipality,
    placements: JSON.parse(row.placements || "[]"), price: Number(row.price), annualPrice: Number(row.annual_price),
    monthlyTotal: Number(row.monthly_total), annualTotal: Number(row.annual_total), startDate: row.start_date,
    endDate: row.end_date, includedChanges: Number(row.included_changes), usedChanges: Number(row.used_changes),
    billingType: row.billing_type || "paid", valueNote: row.value_note || "",
    renewalType: row.renewal_type || "annual-review", signatureRequired: Boolean(Number(row.signature_required)),
    status: row.status, created: row.created_at, updated: row.updated_at
  };
}

const CONTRACT_SELECT = "SELECT c.*, u.company, u.org_no, u.contact, u.email, u.phone FROM ad_contracts c JOIN business_users u ON u.id = c.company_user_id";

async function listContracts(request, env) {
  if (!await requireSession(request, env, "admin")) return json(request, { ok: false, error: "Obehörig." }, 401);
  const result = await env.DB.prepare(`${CONTRACT_SELECT} ORDER BY c.created_at DESC`).all();
  return json(request, { ok: true, contracts: (result.results || []).map(contractFromRow) });
}

async function createContract(request, env) {
  if (!await requireSession(request, env, "admin")) return json(request, { ok: false, error: "Obehörig." }, 401);
  if (!env.PORTAL_PASSWORD_PEPPER) return json(request, { ok: false, error: "Företagsinloggningen är inte konfigurerad." }, 503);
  const body = await readBody(request);
  const email = cleanText(body.email, 254).toLowerCase();
  const password = String(body.temporaryPassword || "");
  const company = cleanText(body.company), orgNo = cleanText(body.orgNo, 30), contact = cleanText(body.contact);
  const phone = cleanText(body.phone, 40), municipality = cleanText(body.municipality, 80);
  const billingType = cleanText(body.billingType, 30) || "paid";
  const renewalType = cleanText(body.renewalType, 30) || "annual-review";
  const valueNote = cleanText(body.valueNote, 240);
  const signatureRequired = body.signatureRequired === true ? 1 : 0;
  const placements = Array.isArray(body.placements) ? body.placements.slice(0, 20).map(item => ({
    slotId: cleanText(item.slotId, 40), module: cleanText(item.module, 100), group: cleanText(item.group, 100),
    label: cleanText(item.label, 160), location: cleanText(item.location, 240), page: cleanText(item.page, 100)
  })) : [];
  if (!company || !orgNo || !contact || !validEmail(email) || !phone || !MUNICIPALITIES.has(municipality) || !placements.length || password.length < 12 || password.length > 200 || !validDate(body.startDate) || !validDate(body.endDate) || !BILLING_TYPES.has(billingType) || !RENEWAL_TYPES.has(renewalType)) {
    return json(request, { ok: false, error: "Avtalet innehåller ogiltiga eller ofullständiga uppgifter. Företagslösenordet måste ha minst 12 tecken." }, 400);
  }
  const now = new Date().toISOString();
  let user = await env.DB.prepare("SELECT id FROM business_users WHERE email = ?").bind(email).first();
  if (!user) {
    const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    const result = await env.DB.prepare("INSERT INTO business_users (email, password_salt, password_hash, password_iterations, company, org_no, contact, phone, municipality, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(email, salt, await hashPassword(password, salt, env.PORTAL_PASSWORD_PEPPER), 0, company, orgNo, contact, phone, municipality, now, now).run();
    user = { id: result.meta.last_row_id };
  } else {
    const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    await env.DB.prepare("UPDATE business_users SET password_salt = ?, password_hash = ?, password_iterations = ?, company = ?, org_no = ?, contact = ?, phone = ?, municipality = ?, active = 1, updated_at = ? WHERE id = ?")
      .bind(salt, await hashPassword(password, salt, env.PORTAL_PASSWORD_PEPPER), 0, company, orgNo, contact, phone, municipality, now, user.id).run();
  }
  const id = cleanText(body.id, 40);
  if (!/^DP-\d{4}-\d{4}$/.test(id)) return json(request, { ok: false, error: "Ogiltigt avtalsnummer." }, 400);
  try {
    await env.DB.prepare("INSERT INTO ad_contracts (id, company_user_id, contract_version, municipality, placements, price, annual_price, monthly_total, annual_total, billing_type, value_note, renewal_type, signature_required, start_date, end_date, included_changes, used_changes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Utkast', ?, ?)")
      .bind(id, user.id, "3.0", municipality, JSON.stringify(placements), Number(body.price), Number(body.annualPrice), Number(body.monthlyTotal), Number(body.annualTotal), billingType, valueNote, renewalType, signatureRequired, body.startDate, body.endDate, 4, now, now).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) return json(request, { ok: false, error: "Avtalsnumret finns redan." }, 409);
    throw error;
  }
  return json(request, { ok: true, id }, 201);
}

async function updateContractStatus(request, env, id) {
  if (!await requireSession(request, env, "admin")) return json(request, { ok: false, error: "Obehörig." }, 401);
  const body = await readBody(request);
  const status = cleanText(body.status, 20);
  if (!PORTAL_STATUSES.has(status)) return json(request, { ok: false, error: "Ogiltig avtalsstatus." }, 400);
  const result = await env.DB.prepare("UPDATE ad_contracts SET status = ?, updated_at = ? WHERE id = ?").bind(status, new Date().toISOString(), id).run();
  return result.meta.changes ? json(request, { ok: true }) : json(request, { ok: false, error: "Avtalet finns inte." }, 404);
}

async function companyAccount(request, env) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);
  const user = await env.DB.prepare("SELECT id, email, company, org_no, contact, phone, municipality FROM business_users WHERE id = ? AND active = 1").bind(session.subject_id).first();
  if (!user) return json(request, { ok: false, error: "Företagskontot är inte aktivt." }, 403);
  const result = await env.DB.prepare(`${CONTRACT_SELECT} WHERE c.company_user_id = ? AND c.status = 'Aktivt' ORDER BY c.updated_at DESC LIMIT 1`).bind(user.id).first();
  return json(request, { ok: true, profile: { company: user.company, orgNo: user.org_no, contact: user.contact, email: user.email, phone: user.phone, municipality: user.municipality }, contract: result ? contractFromRow(result) : null });
}

async function updateCompanyProfile(request, env) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);
  const body = await readBody(request);
  const contact = cleanText(body.contact), phone = cleanText(body.phone, 40);
  if (!contact || !phone) return json(request, { ok: false, error: "Kontaktperson och telefon krävs." }, 400);
  await env.DB.prepare("UPDATE business_users SET contact = ?, phone = ?, updated_at = ? WHERE id = ?").bind(contact, phone, new Date().toISOString(), session.subject_id).run();
  return json(request, { ok: true });
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
          vapidConfigured: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT),
          portalConfigured: Boolean(env.ADMIN_USERNAME && env.ADMIN_PASSWORD && env.PORTAL_PASSWORD_PEPPER),
          portalAuthVersion: "hmac-sha256-v1"
        });
      }
      if (request.method === "GET" && url.pathname === "/config") {
        return json(request, {
          enabled: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT),
          publicKey: env.VAPID_PUBLIC_KEY || ""
        });
      }
      if (request.method === "POST" && url.pathname === "/portal/auth/admin") return adminLogin(request, env);
      if (request.method === "POST" && url.pathname === "/portal/auth/company") return companyLogin(request, env);
      if (request.method === "POST" && url.pathname === "/portal/auth/logout") return logoutPortal(request, env);
      if (request.method === "GET" && url.pathname === "/portal/admin/contracts") return listContracts(request, env);
      if (request.method === "POST" && url.pathname === "/portal/admin/contracts") return createContract(request, env);
      const contractMatch = /^\/portal\/admin\/contracts\/([^/]+)$/.exec(url.pathname);
      if (request.method === "PATCH" && contractMatch) return updateContractStatus(request, env, decodeURIComponent(contractMatch[1]));
      if (request.method === "GET" && url.pathname === "/portal/company/me") return companyAccount(request, env);
      if (request.method === "PATCH" && url.pathname === "/portal/company/profile") return updateCompanyProfile(request, env);
      if (request.method === "GET" && url.pathname === "/portal/company/banners") return listCompanyBanners(request, env);
      if (request.method === "POST" && url.pathname === "/portal/company/banners") return uploadCompanyBanner(request, env);
      const companyBannerMatch = /^\/portal\/company\/banners\/([0-9a-f-]{36})$/i.exec(url.pathname);
      if (request.method === "DELETE" && companyBannerMatch) return deleteCompanyBanner(request, env, companyBannerMatch[1]);
      const currentBannerMatch = /^\/ads\/current\/([A-Z0-9-]{4,40})$/.exec(url.pathname);
      if (request.method === "GET" && currentBannerMatch) return currentBanner(request, env, currentBannerMatch[1], cleanText(url.searchParams.get("municipality"), 80));
      const bannerAssetMatch = /^\/ads\/assets\/([0-9a-f-]{36})$/i.exec(url.pathname);
      if (request.method === "GET" && bannerAssetMatch) return serveBannerAsset(request, env, bannerAssetMatch[1]);
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
