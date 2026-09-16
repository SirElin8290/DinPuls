const ALLOWED_ORIGINS = new Set(["https://dinpuls.se", "https://www.dinpuls.se"]);
const MUNICIPALITIES = new Set(municipalityConfig.municipalities.map(item => item.name));
const REQUIRED_CATEGORIES = ["extreme-weather", "missing-people", "important"];
const OPTIONAL_CATEGORIES = new Set(["traffic", "transport", "news", "events", "jobs", "housing", "sport"]);

function isSupportedMunicipality(value) {
  return typeof value === "string" && MUNICIPALITIES.has(value);
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://dinpuls.se",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token, X-Banner-Slot, X-Banner-Municipality, X-Banner-Start, X-Banner-Name, X-Banner-Link",
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
  const existingUserColumns = new Set((userColumns.results || []).map(column => column.name));
  for (const [name, definition] of [
    ["activated_at", "TEXT"],
    ["welcome_sent_at", "TEXT"],
    ["address", "TEXT NOT NULL DEFAULT ''"],
    ["postal_code", "TEXT NOT NULL DEFAULT ''"],
    ["city", "TEXT NOT NULL DEFAULT ''"],
    ["registration_source", "TEXT NOT NULL DEFAULT 'admin'"]
  ]) {
    if (!existingUserColumns.has(name)) await env.DB.prepare(`ALTER TABLE business_users ADD COLUMN ${name} ${definition}`).run();
  }
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS business_users_self_service_org ON business_users(org_no) WHERE registration_source = 'self-service'").run();
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
    ["signature_required", "INTEGER NOT NULL DEFAULT 0"],
    ["customer_signer_name", "TEXT"], ["customer_signer_title", "TEXT"],
    ["dinpuls_signer_name", "TEXT"], ["dinpuls_signer_title", "TEXT"],
    ["customer_signature_object_key", "TEXT"], ["dinpuls_signature_object_key", "TEXT"],
    ["signed_at", "TEXT"], ["contract_snapshot_json", "TEXT"], ["contract_snapshot_hash", "TEXT"],
    ["signed_pdf_object_key", "TEXT"], ["signed_pdf_hash", "TEXT"],
    ["contract_email_sent_at", "TEXT"], ["contract_email_status", "TEXT"], ["contract_email_error", "TEXT"]
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
    "CREATE TABLE IF NOT EXISTS portal_activation_tokens (" +
    "id TEXT PRIMARY KEY, company_user_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, purpose TEXT NOT NULL, " +
    "expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL, " +
    "FOREIGN KEY(company_user_id) REFERENCES business_users(id))"
  ).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS portal_tokens_user_purpose ON portal_activation_tokens (company_user_id, purpose, used_at, expires_at)").run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS ad_banners (" +
    "id TEXT PRIMARY KEY, company_user_id INTEGER NOT NULL, contract_id TEXT NOT NULL, slot_id TEXT NOT NULL, " +
    "object_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, content_type TEXT NOT NULL, file_size INTEGER NOT NULL, " +
    "target_url TEXT NOT NULL DEFAULT '', start_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, " +
    "FOREIGN KEY(company_user_id) REFERENCES business_users(id), FOREIGN KEY(contract_id) REFERENCES ad_contracts(id))"
  ).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS ad_banners_schedule ON ad_banners (contract_id, slot_id, start_at)").run();
  const bannerColumns = await env.DB.prepare("PRAGMA table_info(ad_banners)").all();
  const existingBannerColumns = new Set((bannerColumns.results || []).map(column => column.name));
  for (const [name, definition] of [["published_at", "TEXT"], ["change_period", "INTEGER"], ["municipality", "TEXT"], ["purchase_id", "TEXT"]]) {
    if (!existingBannerColumns.has(name)) await env.DB.prepare(`ALTER TABLE ad_banners ADD COLUMN ${name} ${definition}`).run();
  }
  await env.DB.prepare("CREATE TRIGGER IF NOT EXISTS limit_published_banner_changes BEFORE UPDATE OF published_at ON ad_banners WHEN OLD.published_at IS NULL AND NEW.published_at IS NOT NULL BEGIN SELECT CASE WHEN (SELECT COUNT(*) FROM ad_banners b WHERE b.contract_id=NEW.contract_id AND b.slot_id=NEW.slot_id AND b.change_period=NEW.change_period AND b.published_at IS NOT NULL) >= 4 THEN RAISE(ABORT, 'BANNER_CHANGE_LIMIT') END; END").run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS contract_slot_reservations (contract_id TEXT NOT NULL, municipality TEXT NOT NULL, slot_id TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(contract_id, slot_id), FOREIGN KEY(contract_id) REFERENCES ad_contracts(id))"
  ).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS contract_slot_period ON contract_slot_reservations(municipality, slot_id, start_date, end_date)").run();
  await env.DB.prepare(
    "CREATE TRIGGER IF NOT EXISTS prevent_contract_slot_overlap BEFORE INSERT ON contract_slot_reservations BEGIN SELECT CASE WHEN EXISTS (SELECT 1 FROM contract_slot_reservations r WHERE r.municipality = NEW.municipality AND r.slot_id = NEW.slot_id AND r.start_date <= NEW.end_date AND r.end_date >= NEW.start_date AND r.contract_id <> NEW.contract_id) THEN RAISE(ABORT, 'SLOT_PERIOD_OCCUPIED') END; END"
  ).run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS self_service_orders (id TEXT PRIMARY KEY, company_user_id INTEGER NOT NULL, foundation_contract_id TEXT NOT NULL, billing_type TEXT NOT NULL, snapshot_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL, status TEXT NOT NULL, expires_at TEXT NOT NULL, confirmed_at TEXT, created_at TEXT NOT NULL, FOREIGN KEY(company_user_id) REFERENCES business_users(id), FOREIGN KEY(foundation_contract_id) REFERENCES ad_contracts(id))").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS self_service_orders_company ON self_service_orders(company_user_id, created_at)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS self_service_holds (order_id TEXT NOT NULL, company_user_id INTEGER NOT NULL, municipality TEXT NOT NULL, slot_id TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(order_id, municipality, slot_id), FOREIGN KEY(order_id) REFERENCES self_service_orders(id))").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS self_service_holds_period ON self_service_holds(municipality, slot_id, start_date, end_date, status, expires_at)").run();
  await env.DB.prepare("CREATE TRIGGER IF NOT EXISTS prevent_self_service_hold_overlap BEFORE INSERT ON self_service_holds BEGIN SELECT CASE WHEN EXISTS (SELECT 1 FROM self_service_holds h WHERE h.municipality=NEW.municipality AND h.slot_id=NEW.slot_id AND h.start_date<=NEW.end_date AND h.end_date>=NEW.start_date AND (h.status='committed' OR (h.status='held' AND h.expires_at>NEW.created_at))) OR EXISTS (SELECT 1 FROM contract_slot_reservations r WHERE r.municipality=NEW.municipality AND r.slot_id=NEW.slot_id AND r.start_date<=NEW.end_date AND r.end_date>=NEW.start_date) THEN RAISE(ABORT, 'SLOT_PERIOD_OCCUPIED') END; END").run();
  await env.DB.prepare("CREATE TRIGGER IF NOT EXISTS prevent_contract_self_service_overlap BEFORE INSERT ON contract_slot_reservations BEGIN SELECT CASE WHEN EXISTS (SELECT 1 FROM self_service_holds h WHERE h.municipality=NEW.municipality AND h.slot_id=NEW.slot_id AND h.start_date<=NEW.end_date AND h.end_date>=NEW.start_date AND (h.status='committed' OR (h.status='held' AND h.expires_at>NEW.created_at))) THEN RAISE(ABORT, 'SLOT_PERIOD_OCCUPIED') END; END").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS self_service_purchases (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, company_user_id INTEGER NOT NULL, foundation_contract_id TEXT NOT NULL, municipality TEXT NOT NULL, slot_id TEXT NOT NULL, placement_label TEXT NOT NULL, billing_type TEXT NOT NULL, unit_price INTEGER NOT NULL, vat_amount INTEGER NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, contract_version TEXT NOT NULL, billing_status TEXT NOT NULL DEFAULT 'waiting_for_launch', publication_status TEXT NOT NULL DEFAULT 'waiting_for_launch', confirmation_json TEXT NOT NULL, confirmation_hash TEXT NOT NULL, confirmed_at TEXT NOT NULL, spiris_invoice_id TEXT, FOREIGN KEY(order_id) REFERENCES self_service_orders(id))").run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS self_service_purchases_order_slot ON self_service_purchases(order_id, municipality, slot_id)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS self_service_purchases_company ON self_service_purchases(company_user_id, confirmed_at)").run();
  await env.DB.prepare("CREATE TRIGGER IF NOT EXISTS prevent_invalid_self_service_purchase BEFORE INSERT ON self_service_purchases BEGIN SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM self_service_orders o JOIN self_service_holds h ON h.order_id=o.id WHERE o.id=NEW.order_id AND o.company_user_id=NEW.company_user_id AND o.foundation_contract_id=NEW.foundation_contract_id AND o.status='confirmed' AND o.confirmed_at=NEW.confirmed_at AND h.company_user_id=NEW.company_user_id AND h.municipality=NEW.municipality AND h.slot_id=NEW.slot_id AND h.status='held' AND h.expires_at>NEW.confirmed_at) THEN RAISE(ABORT, 'ORDER_CONFLICT') END; END").run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS ad_daily_stats (" +
    "banner_id TEXT NOT NULL, company_user_id INTEGER NOT NULL, day TEXT NOT NULL, impressions INTEGER NOT NULL DEFAULT 0, clicks INTEGER NOT NULL DEFAULT 0, " +
    "PRIMARY KEY (banner_id, day), FOREIGN KEY(banner_id) REFERENCES ad_banners(id), FOREIGN KEY(company_user_id) REFERENCES business_users(id))"
  ).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS ad_daily_stats_company ON ad_daily_stats (company_user_id, day)").run();
}

const PORTAL_STATUSES = new Set(["Utkast", "Skickat", "Aktivt", "Avslutat"]);
const BILLING_TYPES = new Set(["monthly", "annual", "complimentary", "paid"]);
const RENEWAL_TYPES = new Set(["annual-review", "none"]);
const SESSION_HOURS = 8;
const ACCOUNT_TOKEN_HOURS = 48;
const TOKEN_PURPOSES = new Set(["activate-account", "reset-password"]);
const PUBLIC_PORTAL_URL = "https://dinpuls.se/foretag/konto.html";

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

function validPassword(value) {
  return typeof value === "string" && value.length >= 12 && value.length <= 200 &&
    /[a-zåäö]/.test(value) && /[A-ZÅÄÖ]/.test(value) && /\d/.test(value);
}

function htmlEscape(value) {
  return String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

function isTwelveMonthContract(startDate, endDate) {
  if (!validDate(startDate) || !validDate(endDate)) return false;
  const expectedEnd = new Date(`${startDate}T12:00:00Z`);
  expectedEnd.setUTCFullYear(expectedEnd.getUTCFullYear() + 1);
  expectedEnd.setUTCDate(expectedEnd.getUTCDate() - 1);
  return expectedEnd.toISOString().slice(0, 10) === endDate;
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
    municipality: row.municipality || null, purchaseId: row.purchase_id || null,
    fileSize: Number(row.file_size), targetUrl: row.target_url || "", startAt: row.start_at,
    imageUrl: `/ads/assets/${encodeURIComponent(row.id)}`, createdAt: row.created_at,
    publishedAt: row.published_at || null, changePeriod: row.change_period == null ? null : Number(row.change_period) };
}

async function activeCompanyContract(env, companyUserId) {
  return env.DB.prepare("SELECT id, municipality, placements, start_date, end_date FROM ad_contracts WHERE company_user_id = ? AND status = 'Aktivt' ORDER BY updated_at DESC LIMIT 1")
    .bind(companyUserId).first();
}

function contractHasSlot(contract, slotId) {
  try { return JSON.parse(contract?.placements || "[]").some(item => item.slotId === slotId); } catch { return false; }
}

function bannerChangePeriod(startDate, startAt) {
  const firstDay = Date.parse(`${startDate}T00:00:00Z`);
  const publishDay = Date.parse(`${stockholmDateKey(startAt)}T00:00:00Z`);
  return Math.max(0, Math.floor((publishDay - firstDay) / 2592000000));
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
  let selectedMunicipality;
  try { selectedMunicipality = cleanText(decodeURIComponent(request.headers.get("X-Banner-Municipality") || ""), 80); }
  catch { return json(request, { ok: false, error: "Kommunen kunde inte läsas." }, 400); }
  const startAt = cleanText(request.headers.get("X-Banner-Start"), 40);
  const fileName = cleanText(decodeURIComponent(request.headers.get("X-Banner-Name") || "banner"), 160);
  const targetUrl = cleanText(decodeURIComponent(request.headers.get("X-Banner-Link") || ""), 500);
  if (!size || size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(contentType)) return json(request, { ok: false, error: "Välj en PNG-, JPG- eller WebP-bild på högst 5 MB." }, 400);
  if (!slotId || !validDateTime(startAt) || !validTargetUrl(targetUrl)) return json(request, { ok: false, error: "Annonsplats, publiceringstid eller länk är ogiltig." }, 400);
  const contract = await activeCompanyContract(env, session.subject_id);
  const scheduledDate = stockholmDateKey(startAt);
  if (!contract) return json(request, { ok: false, error: "Ett aktivt grundavtal krävs." }, 403);
  const municipality = selectedMunicipality || contract.municipality;
  const purchase = isSupportedMunicipality(municipality) ? await env.DB.prepare("SELECT id, start_date, end_date FROM self_service_purchases WHERE company_user_id=? AND foundation_contract_id=? AND municipality=? AND slot_id=? AND start_date<=? AND end_date>=? ORDER BY confirmed_at DESC LIMIT 1").bind(session.subject_id, contract.id, municipality, slotId, scheduledDate, scheduledDate).first() : null;
  const baseSlot = !purchase && contract.municipality === municipality && contractHasSlot(contract, slotId);
  if (!purchase && !baseSlot) return json(request, { ok: false, error: "Annonsplatsen ingår inte i ditt signerade avtal eller köp i vald kommun." }, 403);
  const periodStart = purchase?.start_date || contract.start_date, periodEnd = purchase?.end_date || contract.end_date;
  if (scheduledDate < periodStart || scheduledDate > periodEnd) return json(request, { ok: false, error: "Publiceringsdatumet måste ligga inom annonsperioden." }, 400);
  const buffer = await request.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength !== size || !imageTypeMatches(bytes, contentType)) return json(request, { ok: false, error: "Bildfilen kunde inte verifieras." }, 400);
  const id = crypto.randomUUID();
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const objectKey = `companies/${session.subject_id}/${contract.id}/${encodeURIComponent(municipality)}/${slotId}/${id}.${extension}`;
  await env.AD_ASSETS.put(objectKey, buffer, { httpMetadata: { contentType, cacheControl: "public, max-age=300" } });
  const now = new Date().toISOString();
  try {
    await env.DB.prepare("INSERT INTO ad_banners (id, company_user_id, contract_id, slot_id, municipality, purchase_id, object_key, file_name, content_type, file_size, target_url, start_at, change_period, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, session.subject_id, contract.id, slotId, municipality, purchase?.id || null, objectKey, fileName, contentType, size, targetUrl, startAt, bannerChangePeriod(periodStart, startAt), now, now).run();
  } catch (error) { await env.AD_ASSETS.delete(objectKey); throw error; }
  return json(request, { ok: true, banner: bannerFromRow({ id, slot_id: slotId, municipality, purchase_id: purchase?.id || null, file_name: fileName, content_type: contentType, file_size: size, target_url: targetUrl, start_at: startAt, created_at: now }) }, 201);
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
  if (!isSupportedMunicipality(municipality)) return json(request, { ok: false, error: "Ogiltig kommun." }, 400);
  const now = new Date().toISOString();
  const today = stockholmDateKey(now);
  const predicate = "b.slot_id=? AND c.status='Aktivt' AND ((b.purchase_id IS NULL AND c.municipality=? AND c.start_date<=? AND c.end_date>=?) OR (b.purchase_id IS NOT NULL AND p.municipality=? AND p.publication_status='active' AND p.start_date<=? AND p.end_date>=?))";
  const from = "ad_banners b JOIN ad_contracts c ON c.id=b.contract_id LEFT JOIN self_service_purchases p ON p.id=b.purchase_id AND p.company_user_id=b.company_user_id AND p.foundation_contract_id=b.contract_id";
  const parameters = [slotId, municipality, today, today, municipality, today, today];
  const due = await env.DB.prepare(`SELECT b.id FROM ${from} WHERE ${predicate} AND b.start_at<=? AND b.published_at IS NULL ORDER BY b.start_at ASC`)
    .bind(...parameters, now).all();
  for (const banner of due.results || []) {
    try { await env.DB.prepare("UPDATE ad_banners SET published_at=?, updated_at=? WHERE id=? AND published_at IS NULL").bind(now, now, banner.id).run(); }
    catch (error) { if (!String(error).includes("BANNER_CHANGE_LIMIT")) throw error; }
  }
  const row = await env.DB.prepare(`SELECT b.* FROM ${from} WHERE ${predicate} AND b.published_at IS NOT NULL ORDER BY b.start_at DESC LIMIT 1`)
    .bind(...parameters).first();
  return json(request, { ok: true, banner: row ? bannerFromRow(row) : null });
}

async function recordBannerEvent(request, env) {
  const body = await readBody(request);
  const bannerId = cleanText(body?.bannerId, 40);
  const eventType = cleanText(body?.eventType, 20);
  if (!/^[0-9a-f-]{36}$/i.test(bannerId) || !["impression", "click"].includes(eventType)) {
    return json(request, { ok: false, error: "Ogiltig annonshändelse." }, 400);
  }
  const today = stockholmDateKey(new Date().toISOString());
  const banner = await env.DB.prepare(
    "SELECT b.company_user_id FROM ad_banners b JOIN ad_contracts c ON c.id=b.contract_id LEFT JOIN self_service_purchases p ON p.id=b.purchase_id AND p.company_user_id=b.company_user_id AND p.foundation_contract_id=b.contract_id " +
    "WHERE b.id=? AND b.published_at IS NOT NULL AND c.status='Aktivt' AND ((b.purchase_id IS NULL AND c.start_date<=? AND c.end_date>=?) OR (b.purchase_id IS NOT NULL AND p.publication_status='active' AND p.start_date<=? AND p.end_date>=?))"
  ).bind(bannerId, today, today, today, today).first();
  if (!banner) return json(request, { ok: false, error: "Annonsen är inte aktiv." }, 404);
  const impressions = eventType === "impression" ? 1 : 0;
  const clicks = eventType === "click" ? 1 : 0;
  await env.DB.prepare(
    "INSERT INTO ad_daily_stats (banner_id, company_user_id, day, impressions, clicks) VALUES (?, ?, ?, ?, ?) " +
    "ON CONFLICT(banner_id, day) DO UPDATE SET impressions = impressions + excluded.impressions, clicks = clicks + excluded.clicks"
  ).bind(bannerId, banner.company_user_id, today, impressions, clicks).run();
  return json(request, { ok: true }, 202);
}

async function companyStats(request, env) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);

  const url = new URL(request.url);
  const allowedPeriods = new Set(["day", "week", "month", "year"]);
  const period = allowedPeriods.has(url.searchParams.get("period")) ? url.searchParams.get("period") : "month";
  const today = stockholmDateKey(new Date().toISOString());
  const requestedAnchor = cleanText(url.searchParams.get("anchor"), 10);
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(requestedAnchor) && !Number.isNaN(Date.parse(requestedAnchor + "T12:00:00Z")) ? requestedAnchor : today;

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
    "SELECT COUNT(*) AS count FROM ad_banners b JOIN ad_contracts c ON c.id=b.contract_id LEFT JOIN self_service_purchases p ON p.id=b.purchase_id " +
    "WHERE b.company_user_id=? AND c.status='Aktivt' AND b.start_at<=? AND (b.purchase_id IS NULL OR (p.publication_status='active' AND p.start_date<=? AND p.end_date>=?))"
  ).bind(session.subject_id, new Date().toISOString(), today, today).first();
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
  if (!row || (role && row.role !== role) || Date.parse(row.expires_at) <= Date.now()) {
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

async function createAccountToken(env, companyUserId, purpose) {
  if (!TOKEN_PURPOSES.has(purpose)) throw new Error("Ogiltigt tokenändamål");
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ACCOUNT_TOKEN_HOURS * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("UPDATE portal_activation_tokens SET used_at = ? WHERE company_user_id = ? AND purpose = ? AND used_at IS NULL")
    .bind(now.toISOString(), companyUserId, purpose).run();
  await env.DB.prepare("INSERT INTO portal_activation_tokens (id, company_user_id, token_hash, purpose, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)")
    .bind(crypto.randomUUID(), companyUserId, await sha256(token), purpose, expiresAt, now.toISOString()).run();
  return { token, expiresAt };
}

function accountLink(token, purpose, selfService = false) {
  return `${PUBLIC_PORTAL_URL}#token=${encodeURIComponent(token)}&purpose=${encodeURIComponent(purpose)}${selfService && purpose === "activate-account" ? "&next=kop" : ""}`;
}

async function sendAccountEmail(env, user, token, purpose) {
  if (!env.RESEND_API_KEY || !env.PORTAL_EMAIL_FROM) throw new Error("E-posttjänsten är inte konfigurerad.");
  const activation = purpose === "activate-account";
  const subject = activation ? "Välkommen till DinPuls – skapa ditt företagskonto" : "Återställ lösenordet till DinPuls företagsportal";
  const title = activation ? "Välkommen till DinPuls" : "Återställ ditt lösenord";
  const button = activation ? "Skapa ditt lösenord" : "Välj ett nytt lösenord";
  const link = accountLink(token, purpose, user.registration_source === "self-service");
  const introduction = activation
    ? user.registration_source === "self-service"
      ? `Företagskontot för ${htmlEscape(user.company)} är skapat. Välj ett lösenord för att logga in. Inget annonsavtal har ännu tecknats.`
      : `Avtalet för ${htmlEscape(user.company)} är nu aktiverat. I företagsportalen kan ni hantera banners och schemaläggning samt se statistik och avtalsinformation.`
    : "Vi har fått en begäran om att återställa lösenordet till ert företagskonto.";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.PORTAL_EMAIL_FROM,
      to: [user.email],
      subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#17364d"><h1>${title}</h1><p>Hej ${htmlEscape(user.contact || user.company)},</p><p>${introduction}</p><p style="margin:30px 0"><a href="${link}" style="background:#8d4d24;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:700">${button}</a></p><p>Länken gäller i 48 timmar och kan bara användas en gång.</p><p>Om ni behöver hjälp, kontakta DinPuls genom kontaktuppgifterna på dinpuls.se.</p></div>`,
      text: `Hej ${user.contact || user.company},\n\n${activation ? user.registration_source === "self-service" ? `Företagskontot för ${user.company} är skapat. Inget annonsavtal har ännu tecknats.` : `Avtalet för ${user.company} är nu aktiverat.` : "Vi har fått en begäran om lösenordsåterställning."}\n\n${button}: ${link}\n\nLänken gäller i 48 timmar och kan bara användas en gång.\n\nDinPuls`
    })
  });
  if (!response.ok) throw new Error(`E-postleverantören svarade ${response.status}.`);
}

async function issueAndSendAccountToken(env, user, purpose) {
  const created = await createAccountToken(env, user.id, purpose);
  await sendAccountEmail(env, user, created.token, purpose);
  return created;
}

async function registerCompany(request, env) {
  // Registration stays disabled until the existing two-party contract flow has a safe owner-approved self-service path.
  if (env.SELF_SERVICE_SIGNUP_ENABLED !== "true") return json(request, { ok: false, error: "Självregistrering är inte aktiverad ännu." }, 503);
  if (!env.RESEND_API_KEY || !env.PORTAL_EMAIL_FROM || !env.PORTAL_PASSWORD_PEPPER) return json(request, { ok: false, error: "Kontotjänsten är inte konfigurerad." }, 503);
  const body = await readBody(request);
  const email = cleanText(body.email, 254).toLowerCase();
  const limit = await checkLoginLimit(request, env, email, "company-registration");
  if (!limit.allowed) return json(request, { ok: false, error: "För många registreringsförsök. Försök igen senare." }, 429);
  await recordLoginFailure(env, limit.key);
  const orgNo = normalizeSwedishOrgNumber(body.orgNo);
  const company = cleanText(body.company), address = cleanText(body.address), postalCode = cleanText(body.postalCode, 20);
  const city = cleanText(body.city), contact = cleanText(body.contact), phone = cleanText(body.phone, 40);
  if (!orgNo || !company || !address || !/^\d{3}\s?\d{2}$/.test(postalCode) || !city || !contact || !phone || !validEmail(email)) {
    return json(request, { ok: false, error: "Fyll i giltigt organisationsnummer och samtliga företags- och kontaktuppgifter." }, 400);
  }
  // One business identity, irrespective of where it later advertises. Never overwrite an admin-created account.
  const accounts = await env.DB.prepare("SELECT id, email, org_no, company, contact, active, registration_source FROM business_users").all();
  const existing = (accounts.results || []).find(account => account.email === email || normalizeSwedishOrgNumber(account.org_no) === orgNo);
  if (existing) {
    if (existing.email === email && normalizeSwedishOrgNumber(existing.org_no) === orgNo && existing.registration_source === "self-service" && !Number(existing.active)) {
      try {
        await issueAndSendAccountToken(env, existing, "activate-account");
        await env.DB.prepare("UPDATE business_users SET welcome_sent_at = ? WHERE id = ?").bind(new Date().toISOString(), existing.id).run();
        return json(request, { ok: true, message: "En ny aktiveringslänk har skickats till företagets e-postadress." });
      } catch { return json(request, { ok: false, error: "Aktiveringsmejlet kunde inte skickas just nu. Försök igen senare." }, 502); }
    }
    return json(request, { ok: false, error: "Företaget eller e-postadressen finns redan. Använd inloggning eller kontakta DinPuls." }, 409);
  }
  const now = new Date().toISOString();
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const unusableHash = await sha256(bytesToHex(crypto.getRandomValues(new Uint8Array(32))));
  let id;
  try {
    const result = await env.DB.prepare("INSERT INTO business_users (email, password_salt, password_hash, password_iterations, company, org_no, contact, phone, municipality, address, postal_code, city, registration_source, active, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, '', ?, ?, ?, 'self-service', 0, ?, ?)")
      .bind(email, salt, unusableHash, company, orgNo, contact, phone, address, postalCode.replace(/\s/g, ""), city, now, now).run();
    id = result.meta.last_row_id;
  } catch { return json(request, { ok: false, error: "Kontot kunde inte skapas. Kontrollera om företaget redan är registrerat." }, 409); }
  try {
    await issueAndSendAccountToken(env, { id, email, company, contact, registration_source: "self-service" }, "activate-account");
    await env.DB.prepare("UPDATE business_users SET welcome_sent_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
  } catch (error) {
    console.error("DinPuls självregistrering – aktiveringsmejl:", error);
    return json(request, { ok: false, error: "Kontot är skapat men aktiveringsmejlet kunde inte skickas. Kontakta DinPuls för en ny länk." }, 502);
  }
  return json(request, { ok: true, message: "Kontot är skapat. Följ aktiveringslänken i mejlet för att välja lösenord." }, 201);
}

async function verifyAccountToken(request, env) {
  const body = await readBody(request);
  const token = String(body?.token || "");
  const purpose = cleanText(body?.purpose, 30);
  if (!/^[0-9a-f]{64}$/i.test(token) || !TOKEN_PURPOSES.has(purpose)) return json(request, { ok: false, state: "invalid", error: "Länken är ogiltig." }, 400);
  const row = await env.DB.prepare("SELECT t.expires_at, t.used_at, u.company FROM portal_activation_tokens t JOIN business_users u ON u.id = t.company_user_id WHERE t.token_hash = ? AND t.purpose = ?")
    .bind(await sha256(token), purpose).first();
  if (!row) return json(request, { ok: false, state: "invalid", error: "Länken är ogiltig." }, 404);
  if (row.used_at) return json(request, { ok: false, state: "used", error: "Länken har redan använts." }, 409);
  if (Date.parse(row.expires_at) <= Date.now()) return json(request, { ok: false, state: "expired", error: "Länken har gått ut." }, 410);
  return json(request, { ok: true, state: "valid", company: row.company, expiresAt: row.expires_at, purpose });
}

async function completeAccountPassword(request, env, expectedPurpose = "") {
  if (!env.PORTAL_PASSWORD_PEPPER) return json(request, { ok: false, error: "Företagsinloggningen är inte konfigurerad." }, 503);
  const body = await readBody(request);
  const token = String(body?.token || "");
  const purpose = expectedPurpose || cleanText(body?.purpose, 30);
  const password = String(body?.password || "");
  const confirmation = String(body?.passwordConfirmation || "");
  if (!/^[0-9a-f]{64}$/i.test(token) || !TOKEN_PURPOSES.has(purpose)) return json(request, { ok: false, state: "invalid", error: "Länken är ogiltig." }, 400);
  if (password !== confirmation) return json(request, { ok: false, error: "Lösenorden är inte likadana." }, 400);
  if (!validPassword(password)) return json(request, { ok: false, error: "Lösenordet måste ha minst 12 tecken samt innehålla stor bokstav, liten bokstav och siffra." }, 400);
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare("SELECT id, company_user_id, expires_at, used_at FROM portal_activation_tokens WHERE token_hash = ? AND purpose = ?").bind(tokenHash, purpose).first();
  if (!row) return json(request, { ok: false, state: "invalid", error: "Länken är ogiltig." }, 404);
  if (row.used_at) return json(request, { ok: false, state: "used", error: "Länken har redan använts." }, 409);
  if (Date.parse(row.expires_at) <= Date.now()) return json(request, { ok: false, state: "expired", error: "Länken har gått ut." }, 410);
  const now = new Date().toISOString();
  const consumed = await env.DB.prepare("UPDATE portal_activation_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?").bind(now, row.id, now).run();
  if (!consumed.meta.changes) return json(request, { ok: false, state: "used", error: "Länken har redan använts eller gått ut." }, 409);
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  await env.DB.prepare("UPDATE business_users SET password_salt = ?, password_hash = ?, password_iterations = 0, active = 1, activated_at = COALESCE(activated_at, ?), updated_at = ? WHERE id = ?")
    .bind(salt, await hashPassword(password, salt, env.PORTAL_PASSWORD_PEPPER), now, now, row.company_user_id).run();
  await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'company' AND subject_id = ?").bind(String(row.company_user_id)).run();
  return json(request, { ok: true, state: "complete", message: purpose === "activate-account" ? "Kontot är aktiverat. Du kan nu logga in." : "Lösenordet är ändrat. Du kan nu logga in." });
}

async function requestPasswordReset(request, env) {
  const body = await readBody(request);
  const email = cleanText(body?.email, 254).toLowerCase();
  const limit = await checkLoginLimit(request, env, email, "password-reset");
  if (!limit.allowed) return json(request, { ok: true, message: "Om adressen finns skickas en återställningslänk." });
  await recordLoginFailure(env, limit.key);
  if (validEmail(email)) {
    const user = await env.DB.prepare("SELECT id, email, company, contact FROM business_users WHERE email = ? AND active = 1").bind(email).first();
    if (user) {
      try { await issueAndSendAccountToken(env, user, "reset-password"); }
      catch (error) { console.error("DinPuls lösenordsåterställning:", error); }
    }
  }
  return json(request, { ok: true, message: "Om adressen finns skickas en återställningslänk." });
}

function snapshotForContract(input, placements, price, version = CONTRACT_VERSION, terms = CONTRACT_TERMS) {
  return {
    document: `DinPuls Annonsavtal v${version}`,
    contractVersion: version,
    contractNumber: input.id,
    company: { name: input.company, orgNo: input.orgNo, contact: input.contact, email: input.email, phone: input.phone, address: input.address || "", postalCode: input.postalCode || "", city: input.city || "" },
    municipality: input.municipality,
    placements,
    period: { startDate: input.startDate, endDate: input.endDate },
    billing: { ...price, placementCount: placements.length, invoiceVat: Math.round(price.invoiceTotal * 0.25), invoiceInclVat: Math.round(price.invoiceTotal * 1.25), twelveMonthsVat: Math.round(price.annualTotal * 0.25), vatRate: 0.25 },
    specialTerms: input.valueNote || "",
    terms
  };
}

function dataUrlBytes(value) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(value || ""));
  if (!match) throw new Error("SIGNATURE_INVALID");
  const binary = atob(match[1]);
  if (binary.length < 60 || binary.length > 300000) throw new Error("SIGNATURE_INVALID");
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function wrapPdfText(font, text, size, maxWidth) {
  const words = String(text).replace(/→/g, " / ").split(/\s+/); const lines = []; let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line); return lines;
}

async function buildSignedPdf(snapshot, signatures, signedAt, snapshotHash) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize = [595.28, 841.89]; const margin = 48; const maxWidth = pageSize[0] - margin * 2;
  let page; let y;
  const newPage = () => { page = pdf.addPage(pageSize); y = pageSize[1] - margin; page.drawText(`DinPuls Annonsavtal v${snapshot.contractVersion}`, { x: margin, y, size: 15, font: bold, color: rgb(0.09, 0.21, 0.30) }); y -= 28; };
  const ensure = height => { if (y - height < margin) newPage(); };
  const drawLines = (text, size = 9.5, font = regular, gap = 13) => { const lines = wrapPdfText(font, text, size, maxWidth); ensure(lines.length * gap + 8); for (const line of lines) { page.drawText(line, { x: margin, y, size, font, color: rgb(0.12, 0.16, 0.18) }); y -= gap; } y -= 5; };
  newPage();
  drawLines(`Avtalsnummer: ${snapshot.contractNumber}`, 11, bold, 15);
  drawLines(`Företag: ${snapshot.company.name} (${snapshot.company.orgNo})`);
  drawLines(`Kontakt: ${snapshot.company.contact}, ${snapshot.company.email}, ${snapshot.company.phone}`);
  if (snapshot.company.address) drawLines(`Adress: ${snapshot.company.address}, ${snapshot.company.postalCode} ${snapshot.company.city}`);
  drawLines(`Kommun och period: ${snapshot.municipality}, ${snapshot.period.startDate} – ${snapshot.period.endDate}`);
  drawLines(`Annonsplatser: ${snapshot.placements.map(item => `${item.slotId} – ${item.location}`).join("; ")}`);
  drawLines(`Betalning: ${snapshot.billing.label}; ${snapshot.billing.unitPrice} kr per plats; ${snapshot.billing.placementCount} plats(er); total debitering ${snapshot.billing.invoiceTotal} kr ${snapshot.billing.interval}; exklusive moms; ${snapshot.billing.paymentTerms}.`);
  drawLines(`Moms 25 %: ${snapshot.billing.invoiceVat} kr; summa inklusive moms: ${snapshot.billing.invoiceInclVat} kr per debitering. Tolv månader totalt exklusive moms: ${snapshot.billing.annualTotal} kr.`);
  if (snapshot.specialTerms) drawLines(`Särskilda villkor: ${snapshot.specialTerms}`);
  for (const term of snapshot.terms) { ensure(40); drawLines(term.title, 10, bold, 14); for (const paragraph of term.paragraphs) drawLines(paragraph); }
  newPage(); drawLines("UNDERSKRIFTER", 13, bold, 18);
  drawLines("Genom att skriva under bekräftar jag att jag har rätt att företräda företaget och att jag godkänner avtalet och dess villkor.");
  if (signatures.dinpuls.mode === "preapproved-fixed") drawLines(`SirElin AB:s fasta förhandsgodkända motpartssignatur ingår i det låsta avtalsunderlaget. Originalets SHA-256: ${snapshot.dinpulsFixedSignature.sha256}. Ingen DinPuls-företrädare har signerat manuellt vid kundens underskrift.`);
  const customerImage = await pdf.embedPng(signatures.customer.bytes);
  const dinpulsImage = await pdf.embedPng(signatures.dinpuls.bytes);
  page.drawImage(customerImage, { x: margin, y: y - 95, width: 210, height: 80 });
  page.drawImage(dinpulsImage, { x: 335, y: y - 95, width: 210, height: 80 }); y -= 110;
  page.drawText(`Företaget: ${signatures.customer.name}`, { x: margin, y, size: 9, font: bold });
  page.drawText(signatures.customer.title, { x: margin, y: y - 13, size: 9, font: regular });
  page.drawText(`DinPuls: ${signatures.dinpuls.name}`, { x: 335, y, size: 9, font: bold });
  page.drawText(signatures.dinpuls.title, { x: 335, y: y - 13, size: 9, font: regular }); y -= 34;
  drawLines(`${signatures.dinpuls.mode === "preapproved-fixed" ? "Kundens signeringstidpunkt" : "Signeringstidpunkt"}: ${signedAt}`);
  drawLines(`Avtalssnapshot SHA-256: ${snapshotHash}`, 8);
  pdf.setTitle(`DinPuls Annonsavtal ${snapshot.contractNumber}`); pdf.setSubject(`Signerad v${snapshot.contractVersion}-avtalskopia, SHA-256 ${snapshotHash}`);
  return pdf.save();
}

function uint8ToBase64(bytes) {
  let value = ""; for (let index = 0; index < bytes.length; index += 0x8000) value += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(value);
}

async function sendSignedContractEmail(env, contract, pdfBytes, snapshotOverride) {
  if (!env.RESEND_API_KEY || !env.PORTAL_EMAIL_FROM) throw new Error("E-posttjänsten är inte konfigurerad.");
  const snapshot = snapshotOverride || JSON.parse(contract.contract_snapshot_json || "null");
  if (!snapshot?.company || !snapshot?.billing || !Array.isArray(snapshot.placements) || !Array.isArray(snapshot.terms)) throw new Error("Avtalets kompletta innehåll saknas.");
  const placementText = snapshot.placements.map(item => `${item.slotId} – ${item.location}`).join("; ");
  const summaryHtml = `<h2>Företagsuppgifter</h2><p><strong>${htmlEscape(snapshot.company.name)}</strong><br>Org.nr: ${htmlEscape(snapshot.company.orgNo)}<br>Kontakt: ${htmlEscape(snapshot.company.contact)}<br>E-post: ${htmlEscape(snapshot.company.email)}<br>Telefon: ${htmlEscape(snapshot.company.phone)}</p><h2>Beställning</h2><p>Kommun: ${htmlEscape(snapshot.municipality)}<br>Annonsplatser: ${htmlEscape(placementText)}</p><h2>Pris och avtalsperiod</h2><p>${htmlEscape(snapshot.period.startDate)} – ${htmlEscape(snapshot.period.endDate)}<br>${htmlEscape(snapshot.billing.label)} · ${snapshot.billing.unitPrice} kr per plats · ${snapshot.billing.invoiceTotal} kr ${htmlEscape(snapshot.billing.interval)}<br>Exklusive moms · ${htmlEscape(snapshot.billing.paymentTerms)}</p>${snapshot.specialTerms ? `<p><strong>Särskilda villkor:</strong> ${htmlEscape(snapshot.specialTerms)}</p>` : ""}`;
  const summaryText = `Företagsuppgifter\n${snapshot.company.name}\nOrg.nr: ${snapshot.company.orgNo}\nKontakt: ${snapshot.company.contact}\nE-post: ${snapshot.company.email}\nTelefon: ${snapshot.company.phone}\n\nBeställning\nKommun: ${snapshot.municipality}\nAnnonsplatser: ${placementText}\n\nPris och avtalsperiod\n${snapshot.period.startDate} – ${snapshot.period.endDate}\n${snapshot.billing.label} · ${snapshot.billing.unitPrice} kr per plats · ${snapshot.billing.invoiceTotal} kr ${snapshot.billing.interval}\nExklusive moms · ${snapshot.billing.paymentTerms}${snapshot.specialTerms ? `\nSärskilda villkor: ${snapshot.specialTerms}` : ""}`;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({
    from: env.PORTAL_EMAIL_FROM, to: [contract.email], subject: "Välkommen till DinPuls – ert signerade annonsavtal",
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#17364d"><h1>Välkommen till DinPuls</h1><p>Hej ${htmlEscape(snapshot.company.contact || snapshot.company.name)},</p><p>Ert avtal är signerat och aktiverat. Uppgifterna nedan kommer från samma låsta avtalsdata som den bifogade PDF-kopian.</p>${summaryHtml}<p><strong>Fullständiga avtalsvillkor</strong><br>Samtliga ${snapshot.terms.length} villkorspunkter i version ${htmlEscape(snapshot.contractVersion)} finns i den bifogade signerade PDF-kopian och i företagsportalen.</p><p>Vänliga hälsningar<br>DinPuls</p></div>`,
    text: `Hej ${snapshot.company.contact || snapshot.company.name},\n\nErt avtal är signerat och aktiverat. Uppgifterna nedan kommer från samma låsta avtalsdata som den bifogade PDF-kopian.\n\n${summaryText}\n\nFullständiga avtalsvillkor\nSamtliga ${snapshot.terms.length} villkorspunkter i version ${snapshot.contractVersion} finns i den bifogade signerade PDF-kopian och i företagsportalen.\n\nVänliga hälsningar\nDinPuls`,
    attachments: [{ filename: `DinPuls-annonsavtal-${contract.id}.pdf`, content: uint8ToBase64(pdfBytes) }]
  }) });
  if (!response.ok) throw new Error(`E-postleverantören svarade ${response.status}.`);
}

async function resendSignedContractEmail(request, env, id) {
  if (!await requireSession(request, env, "admin")) return json(request, { ok: false, error: "Obehörig." }, 401);
  if (!env.AD_ASSETS) return json(request, { ok: false, error: "Avtalsarkivet i R2 är inte konfigurerat." }, 503);
  const contract = await env.DB.prepare(`${CONTRACT_SELECT} WHERE c.id = ?`).bind(id).first();
  if (!contract) return json(request, { ok: false, error: "Avtalet finns inte." }, 404);
  if (!contract.signed_at || !contract.signed_pdf_object_key || contract.status !== "Aktivt") {
    return json(request, { ok: false, error: "Avtalet är inte färdigsignerat eller saknar arkiverad PDF." }, 409);
  }
  const object = await env.AD_ASSETS.get(contract.signed_pdf_object_key);
  if (!object) return json(request, { ok: false, error: "Den signerade PDF-filen saknas i avtalsarkivet." }, 404);
  const pdfBytes = new Uint8Array(await object.arrayBuffer());
  try {
    await sendSignedContractEmail(env, contract, pdfBytes, JSON.parse(contract.contract_snapshot_json));
    const sentAt = new Date().toISOString();
    await env.DB.prepare("UPDATE ad_contracts SET contract_email_status='sent', contract_email_sent_at=?, contract_email_error=NULL WHERE id=?").bind(sentAt, id).run();
    return json(request, { ok: true, message: "Den signerade avtalskopian har skickats igen.", sentAt });
  } catch (error) {
    await env.DB.prepare("UPDATE ad_contracts SET contract_email_status='failed', contract_email_error=? WHERE id=?").bind(cleanText(error?.message || "Okänt e-postfel", 300), id).run();
    return json(request, { ok: false, error: "Avtalskopian kunde inte skickas. Det signerade avtalet och PDF-filen ligger kvar oförändrade." }, 502);
  }
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
    status: row.status, activatedAt: row.activated_at || null, welcomeSentAt: row.welcome_sent_at || null,
    customerSignerName: row.customer_signer_name || null, customerSignerTitle: row.customer_signer_title || null,
    dinpulsSignerName: row.dinpuls_signer_name || null, dinpulsSignerTitle: row.dinpuls_signer_title || null,
    signedAt: row.signed_at || null, snapshotHash: row.contract_snapshot_hash || null,
    hasCustomerSignature: Boolean(row.customer_signature_object_key),
    pdfHash: row.signed_pdf_hash || null, hasSignedPdf: Boolean(row.signed_pdf_object_key),
    contractEmailStatus: row.contract_email_status || null, contractEmailSentAt: row.contract_email_sent_at || null,
    created: row.created_at, updated: row.updated_at
  };
}

const CONTRACT_SELECT = "SELECT c.*, u.company, u.org_no, u.contact, u.email, u.phone, u.activated_at, u.welcome_sent_at FROM ad_contracts c JOIN business_users u ON u.id = c.company_user_id";

async function listContracts(request, env) {
  if (!await requireSession(request, env, "admin")) return json(request, { ok: false, error: "Obehörig." }, 401);
  const result = await env.DB.prepare(`${CONTRACT_SELECT} ORDER BY c.created_at DESC`).all();
  return json(request, { ok: true, contracts: (result.results || []).map(contractFromRow) });
}

async function createContract(request, env) {
  if (!await requireSession(request, env, "admin")) return json(request, { ok: false, error: "Obehörig." }, 401);
  const body = await readBody(request);
  const email = cleanText(body.email, 254).toLowerCase();
  const company = cleanText(body.company), orgNo = cleanText(body.orgNo, 30), contact = cleanText(body.contact);
  const phone = cleanText(body.phone, 40), municipality = cleanText(body.municipality, 80);
  const billingType = cleanText(body.billingType, 30);
  const renewalType = cleanText(body.renewalType, 30) || "annual-review";
  const valueNote = cleanText(body.valueNote, 240);
  const placements = Array.isArray(body.placements) ? body.placements.slice(0, 20).map(item => ({
    slotId: cleanText(item.slotId, 40), module: cleanText(item.module, 100), group: cleanText(item.group, 100),
    label: cleanText(item.label, 160), location: cleanText(item.location, 240), page: cleanText(item.page, 100)
  })) : [];
  if (!company || !orgNo || !contact || !validEmail(email) || !phone || !isSupportedMunicipality(municipality) || !placements.length || !validDate(body.startDate) || !validDate(body.endDate) || !["monthly", "annual", "complimentary"].includes(billingType) || !RENEWAL_TYPES.has(renewalType) || body.termsReviewed !== true) {
    return json(request, { ok: false, error: "Avtalet innehåller ogiltiga eller ofullständiga uppgifter." }, 400);
  }
  if (!isTwelveMonthContract(body.startDate, body.endDate)) {
    return json(request, { ok: false, error: "Avtalsperioden måste vara exakt 12 månader från startdatum, med slutdatum dagen före motsvarande datum följande år." }, 400);
  }
  const now = new Date().toISOString();
  let user = await env.DB.prepare("SELECT id FROM business_users WHERE email = ?").bind(email).first();
  if (!user) {
    const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    const unusableHash = await sha256(bytesToHex(crypto.getRandomValues(new Uint8Array(32))));
    const result = await env.DB.prepare("INSERT INTO business_users (email, password_salt, password_hash, password_iterations, company, org_no, contact, phone, municipality, active, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, 0, ?, ?)")
      .bind(email, salt, unusableHash, company, orgNo, contact, phone, municipality, now, now).run();
    user = { id: result.meta.last_row_id };
  } else {
    await env.DB.prepare("UPDATE business_users SET company = ?, org_no = ?, contact = ?, phone = ?, municipality = ?, updated_at = ? WHERE id = ?")
      .bind(company, orgNo, contact, phone, municipality, now, user.id).run();
  }
  const id = cleanText(body.id, 40);
  if (!/^DP-\d{4}-\d{4}$/.test(id)) return json(request, { ok: false, error: "Ogiltigt avtalsnummer." }, 400);
  const price = calculateContractPrice(billingType, placements.length);
  const snapshot = snapshotForContract({ id, company, orgNo, contact, email, phone, municipality, startDate: body.startDate, endDate: body.endDate, valueNote }, placements, price);
  const snapshotJson = stableStringify(snapshot);
  const snapshotHash = await sha256(snapshotJson);
  try {
    await env.DB.prepare("INSERT INTO ad_contracts (id, company_user_id, contract_version, municipality, placements, price, annual_price, monthly_total, annual_total, billing_type, value_note, renewal_type, signature_required, start_date, end_date, included_changes, used_changes, status, contract_snapshot_json, contract_snapshot_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 4, 0, 'Utkast', ?, ?, ?, ?)")
      .bind(id, user.id, CONTRACT_VERSION, municipality, JSON.stringify(placements), price.unitPrice, billingType === "annual" ? price.unitPrice : 0, price.monthlyTotal, price.annualTotal, billingType, valueNote, renewalType, body.startDate, body.endDate, snapshotJson, snapshotHash, now, now).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) return json(request, { ok: false, error: "Avtalsnumret finns redan." }, 409);
    throw error;
  }
  return json(request, { ok: true, id, snapshot, snapshotHash }, 201);
}

async function signContract(request, env, id) {
  if (!await requireSession(request, env, "admin")) return json(request, { ok: false, error: "Obehörig." }, 401);
  if (!env.AD_ASSETS) return json(request, { ok: false, error: "Avtalsarkivet i R2 är inte konfigurerat." }, 503);
  const body = await readBody(request);
  const dinpulsName = cleanText(body.dinpulsSignerName), dinpulsTitle = cleanText(body.dinpulsSignerTitle);
  if (!dinpulsName || !dinpulsTitle) return json(request, { ok: false, error: "DinPuls namn och befattning krävs." }, 400);
  let dinpulsBytes;
  try { dinpulsBytes = dataUrlBytes(body.dinpulsSignature); }
  catch { return json(request, { ok: false, error: "DinPuls underskrift måste vara ritad och giltig." }, 400); }
  const contract = await env.DB.prepare(`${CONTRACT_SELECT} WHERE c.id = ?`).bind(id).first();
  if (!contract) return json(request, { ok: false, error: "Avtalet finns inte." }, 404);
  const foundationOrder = await env.DB.prepare("SELECT * FROM self_service_orders WHERE foundation_contract_id=? AND company_user_id=? AND status='customer_signed'").bind(id, contract.company_user_id).first();
  if (contract.contract_snapshot_json && JSON.parse(contract.contract_snapshot_json).dinpulsFixedSignature) return json(request, { ok: false, error: "Detta självserviceavtal använder en låst förhandsgodkänd motpartssignatur och kan inte manuellt motundertecknas." }, 409);
  if (contract.customer_signature_object_key && !foundationOrder) return json(request, { ok: false, error: "Det självsignerade avtalet saknar en giltig väntande motunderskrift och får inte signeras om." }, 409);
  const customerName = foundationOrder ? cleanText(contract.customer_signer_name) : cleanText(body.customerSignerName);
  const customerTitle = foundationOrder ? cleanText(contract.customer_signer_title) : cleanText(body.customerSignerTitle);
  let customerBytes;
  if (foundationOrder) {
    const customerObject = contract.customer_signature_object_key && await env.AD_ASSETS.get(contract.customer_signature_object_key);
    if (!customerObject || foundationOrder.expires_at <= new Date().toISOString()) return json(request, { ok: false, error: "Kundens underskrift saknas eller reservationen har gått ut." }, 409);
    customerBytes = new Uint8Array(await customerObject.arrayBuffer());
  } else {
    try { customerBytes = dataUrlBytes(body.customerSignature); }
    catch { return json(request, { ok: false, error: "Kundens underskrift måste vara ritad och giltig." }, 400); }
  }
  if (!customerName || !customerTitle) return json(request, { ok: false, error: "Kundens namn och befattning saknas." }, 400);
  if (contract.contract_version !== CONTRACT_VERSION) return json(request, { ok: false, error: "Endast v4-avtal kan signeras i detta flöde." }, 409);
  if (contract.signed_at || contract.status === "Aktivt") return json(request, { ok: false, error: "Avtalet är redan signerat och låst." }, 409);
  const calculatedHash = await sha256(contract.contract_snapshot_json || "");
  if (!contract.contract_snapshot_json || !safeEqual(calculatedHash, contract.contract_snapshot_hash)) return json(request, { ok: false, error: "Avtalets låsta innehåll kunde inte verifieras." }, 409);
  if (body.snapshotHash && !safeEqual(body.snapshotHash, calculatedHash)) return json(request, { ok: false, error: "Förhandsgranskningen matchar inte avtalet som ska signeras." }, 409);
  const placements = JSON.parse(contract.placements);
  if (foundationOrder) {
    const lines = placements.map(item => ({ municipality: item.municipality, slotId: item.slotId, startDate: item.startDate, endDate: item.endDate }));
    if (await oldContractConflict(env, lines)) return json(request, { ok: false, error: "En plats är redan upptagen av ett annat aktivt avtal." }, 409);
    const now = new Date().toISOString();
    for (const line of lines) {
      const hold = await env.DB.prepare("SELECT 1 FROM self_service_holds WHERE order_id=? AND company_user_id=? AND municipality=? AND slot_id=? AND status='held' AND expires_at>?").bind(foundationOrder.id, contract.company_user_id, line.municipality, line.slotId, now).first();
      const competing = await env.DB.prepare("SELECT 1 FROM self_service_holds WHERE order_id<>? AND municipality=? AND slot_id=? AND start_date<=? AND end_date>=? AND (status='committed' OR (status='held' AND expires_at>?)) LIMIT 1").bind(foundationOrder.id, line.municipality, line.slotId, line.endDate, line.startDate, now).first();
      if (!hold || competing) return json(request, { ok: false, error: "En platsreservation är inte längre giltig." }, 409);
    }
  } else {
    const overlap = await env.DB.prepare(`SELECT r.contract_id, r.slot_id FROM contract_slot_reservations r WHERE r.municipality = ? AND r.start_date <= ? AND r.end_date >= ? AND r.contract_id <> ? AND r.slot_id IN (${placements.map(() => "?").join(",")}) LIMIT 1`)
      .bind(contract.municipality, contract.end_date, contract.start_date, id, ...placements.map(item => item.slotId)).first();
    if (overlap) return json(request, { ok: false, error: `Annonsplats ${overlap.slot_id} är redan reserverad under perioden.` }, 409);
    if (await oldContractConflict(env, placements.map(item => ({ municipality: contract.municipality, slotId: item.slotId, startDate: contract.start_date, endDate: contract.end_date })))) return json(request, { ok: false, error: "En plats är redan upptagen av ett aktivt befintligt avtal." }, 409);
  }
  const signedAt = new Date().toISOString();
  const snapshot = JSON.parse(contract.contract_snapshot_json);
  const pdfBytes = await buildSignedPdf(snapshot, { customer: { name: customerName, title: customerTitle, bytes: customerBytes }, dinpuls: { name: dinpulsName, title: dinpulsTitle, bytes: dinpulsBytes } }, signedAt, calculatedHash);
  const pdfHash = bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", pdfBytes)));
  const baseKey = `contracts/${id}/${calculatedHash}`;
  const customerKey = `${baseKey}/customer-signature.png`, dinpulsKey = `${baseKey}/dinpuls-signature.png`, pdfKey = `${baseKey}/signed-contract.pdf`;
  if (await env.AD_ASSETS.head(pdfKey)) return json(request, { ok: false, error: "En signerad avtalskopia finns redan och får inte skrivas över." }, 409);
  if (!foundationOrder) await env.AD_ASSETS.put(customerKey, customerBytes, { httpMetadata: { contentType: "image/png", cacheControl: "private, no-store" }, customMetadata: { contractId: id, snapshotHash: calculatedHash } });
  await env.AD_ASSETS.put(dinpulsKey, dinpulsBytes, { httpMetadata: { contentType: "image/png", cacheControl: "private, no-store" }, customMetadata: { contractId: id, snapshotHash: calculatedHash } });
  await env.AD_ASSETS.put(pdfKey, pdfBytes, { httpMetadata: { contentType: "application/pdf", contentDisposition: `attachment; filename="DinPuls-annonsavtal-${id}.pdf"`, cacheControl: "private, no-store" }, customMetadata: { contractId: id, snapshotHash: calculatedHash, pdfHash } });
  const statements = foundationOrder ? [] : placements.map(item => env.DB.prepare("INSERT INTO contract_slot_reservations(contract_id, municipality, slot_id, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, contract.municipality, item.slotId, contract.start_date, contract.end_date, signedAt));
  if (foundationOrder) {
    const confirmation = stableStringify({ orderId: foundationOrder.id, companyId: contract.company_user_id, foundationContractId: id, snapshotHash: calculatedHash, confirmedAt: signedAt, customerSignerName: customerName, customerSignerTitle: customerTitle, dinpulsSignerName: dinpulsName, explicitConfirmation: true, channel: "two-party-foundation-signature" });
    const confirmationHash = await sha256(confirmation);
    statements.push(env.DB.prepare("UPDATE self_service_orders SET status='confirmed', confirmed_at=? WHERE id=? AND status='customer_signed' AND expires_at>?").bind(signedAt, foundationOrder.id, signedAt));
    for (const item of placements) statements.push(env.DB.prepare("INSERT INTO self_service_purchases (id,order_id,company_user_id,foundation_contract_id,municipality,slot_id,placement_label,billing_type,unit_price,vat_amount,start_date,end_date,contract_version,confirmation_json,confirmation_hash,confirmed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), foundationOrder.id, contract.company_user_id, id, item.municipality, item.slotId, item.location, contract.billing_type, contract.price, Math.round(contract.price * 0.25), item.startDate, item.endDate, CONTRACT_VERSION, confirmation, confirmationHash, signedAt));
    statements.push(env.DB.prepare("UPDATE self_service_holds SET status='committed' WHERE order_id=? AND status='held' AND expires_at>?").bind(foundationOrder.id, signedAt));
  }
  statements.push(env.DB.prepare("UPDATE ad_contracts SET customer_signer_name=?, customer_signer_title=?, dinpuls_signer_name=?, dinpuls_signer_title=?, customer_signature_object_key=?, dinpuls_signature_object_key=?, signed_at=?, signed_pdf_object_key=?, signed_pdf_hash=?, status='Aktivt', updated_at=? WHERE id=? AND status='Utkast' AND signed_at IS NULL").bind(customerName, customerTitle, dinpulsName, dinpulsTitle, customerKey, dinpulsKey, signedAt, pdfKey, pdfHash, signedAt, id));
  try { await env.DB.batch(statements); }
  catch (error) { console.error("DinPuls avtalslåsning:", error); await Promise.all((foundationOrder ? [dinpulsKey, pdfKey] : [customerKey, dinpulsKey, pdfKey]).map(key => env.AD_ASSETS.delete(key))); return json(request, { ok: false, error: String(error).includes("SLOT_PERIOD_OCCUPIED") ? "Annonsplatsen hann reserveras av ett annat avtal. Avtalet aktiverades inte." : "Avtalet kunde inte låsas i databasen." }, 409); }
  let emailStatus = "sent";
  try { await sendSignedContractEmail(env, { ...contract, id }, pdfBytes, snapshot); await env.DB.prepare("UPDATE ad_contracts SET contract_email_status='sent', contract_email_sent_at=?, contract_email_error=NULL WHERE id=?").bind(new Date().toISOString(), id).run(); }
  catch (error) { emailStatus = "failed"; await env.DB.prepare("UPDATE ad_contracts SET contract_email_status='failed', contract_email_error=? WHERE id=?").bind(cleanText(error.message, 300), id).run(); }
  let onboarding = "unchanged";
  if (!contract.activated_at && !contract.welcome_sent_at) {
    const claimed = await env.DB.prepare("UPDATE business_users SET welcome_sent_at=?, updated_at=? WHERE id=? AND welcome_sent_at IS NULL AND activated_at IS NULL").bind(signedAt, signedAt, contract.company_user_id).run();
    if (claimed.meta.changes) try { await issueAndSendAccountToken(env, { ...contract, id: contract.company_user_id }, "activate-account"); onboarding = "sent"; } catch { onboarding = "failed"; await env.DB.prepare("UPDATE business_users SET welcome_sent_at=NULL WHERE id=? AND activated_at IS NULL").bind(contract.company_user_id).run(); }
  }
  return json(request, { ok: true, status: "Aktivt", snapshotHash: calculatedHash, pdfHash, emailStatus, onboarding });
}

async function downloadContractPdf(request, env, id) {
  const session = await requireSession(request, env);
  if (!session || !["admin", "company"].includes(session.role)) return json(request, { ok: false, error: "Obehörig." }, 401);
  const row = await env.DB.prepare("SELECT company_user_id, signed_pdf_object_key FROM ad_contracts WHERE id=?").bind(id).first();
  if (!row || !row.signed_pdf_object_key || (session.role === "company" && String(row.company_user_id) !== String(session.subject_id))) return json(request, { ok: false, error: "Den signerade avtalskopian finns inte eller tillhör inte kontot." }, 404);
  const object = await env.AD_ASSETS.get(row.signed_pdf_object_key);
  if (!object?.body) return json(request, { ok: false, error: "PDF-filen saknas i avtalsarkivet." }, 404);
  return new Response(object.body, { headers: { ...corsHeaders(request), "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="DinPuls-annonsavtal-${id}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

async function updateContractStatus(request, env, id) {
  if (!await requireSession(request, env, "admin")) return json(request, { ok: false, error: "Obehörig." }, 401);
  const body = await readBody(request);
  const status = cleanText(body.status, 20);
  if (!PORTAL_STATUSES.has(status)) return json(request, { ok: false, error: "Ogiltig avtalsstatus." }, 400);
  const contract = await env.DB.prepare("SELECT c.status, c.company_user_id, u.email, u.company, u.contact, u.activated_at, u.welcome_sent_at FROM ad_contracts c JOIN business_users u ON u.id = c.company_user_id WHERE c.id = ?").bind(id).first();
  if (!contract) return json(request, { ok: false, error: "Avtalet finns inte." }, 404);
  const versionRow = await env.DB.prepare("SELECT contract_version FROM ad_contracts WHERE id=?").bind(id).first();
  if (versionRow?.contract_version === CONTRACT_VERSION && status === "Aktivt") return json(request, { ok: false, error: "v4-avtal aktiveras endast automatiskt efter två giltiga signaturer och skapad PDF." }, 409);
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE ad_contracts SET status = ?, updated_at = ? WHERE id = ?").bind(status, now, id).run();
  if (status === "Avslutat") await env.DB.prepare("DELETE FROM contract_slot_reservations WHERE contract_id = ?").bind(id).run();
  let onboarding = "unchanged";
  if (contract.status !== "Aktivt" && status === "Aktivt" && !contract.activated_at && !contract.welcome_sent_at) {
    const claim = await env.DB.prepare("UPDATE business_users SET welcome_sent_at = ?, updated_at = ? WHERE id = ? AND welcome_sent_at IS NULL AND activated_at IS NULL").bind(now, now, contract.company_user_id).run();
    if (claim.meta.changes) {
      try {
        await issueAndSendAccountToken(env, { ...contract, id: contract.company_user_id }, "activate-account");
        onboarding = "sent";
      } catch (error) {
        await env.DB.prepare("UPDATE business_users SET welcome_sent_at = NULL WHERE id = ? AND welcome_sent_at = ?").bind(contract.company_user_id, now).run();
        console.error("DinPuls välkomstmejl:", error);
        onboarding = "email-not-configured";
      }
    }
  }
  return json(request, { ok: true, onboarding });
}

async function resendActivation(request, env, contractId) {
  if (!await requireSession(request, env, "admin")) return json(request, { ok: false, error: "Obehörig." }, 401);
  const contract = await env.DB.prepare("SELECT u.id, u.email, u.company, u.contact, u.activated_at FROM ad_contracts c JOIN business_users u ON u.id = c.company_user_id WHERE c.id = ?").bind(contractId).first();
  if (!contract) return json(request, { ok: false, error: "Avtalet finns inte." }, 404);
  if (contract.activated_at) return json(request, { ok: false, error: "Företagskontot är redan aktiverat." }, 409);
  try {
    await issueAndSendAccountToken(env, contract, "activate-account");
    const now = new Date().toISOString();
    await env.DB.prepare("UPDATE business_users SET welcome_sent_at = ?, updated_at = ? WHERE id = ?").bind(now, now, contract.id).run();
    return json(request, { ok: true, message: "En ny aktiveringslänk har skickats." });
  } catch (error) {
    console.error("DinPuls ny aktiveringslänk:", error);
    return json(request, { ok: false, error: "Aktiveringsmejlet kunde inte skickas. Kontrollera e-postinställningarna." }, 502);
  }
}

async function companyAccount(request, env) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);
  const user = await env.DB.prepare("SELECT id, email, company, org_no, contact, phone, municipality, address, postal_code, city FROM business_users WHERE id = ? AND active = 1").bind(session.subject_id).first();
  if (!user) return json(request, { ok: false, error: "Företagskontot är inte aktivt." }, 403);
  const result = await env.DB.prepare(`${CONTRACT_SELECT} WHERE c.company_user_id = ? AND c.status = 'Aktivt' ORDER BY c.updated_at DESC LIMIT 1`).bind(user.id).first();
  return json(request, { ok: true, profile: { company: user.company, orgNo: user.org_no, contact: user.contact, email: user.email, phone: user.phone, municipality: user.municipality, address: user.address, postalCode: user.postal_code, city: user.city }, contract: result ? contractFromRow(result) : null });
}

function slotDisplay(slot, municipality) {
  const home = /^P([123])-\d{2}$/.exec(slot.id);
  if (home) {
    const block = Number(home[1]);
    const withinBlock = slot.position - (block - 1) * 10;
    const blockLabel = ["Övre annonsblocket", "Mellersta annonsblocket", "Nedre annonsblocket"][block - 1];
    return { ...slot, municipality, blockLabel, withinBlock, blockCount: 10,
      displayLabel: `${municipality} → Startsidan → ${blockLabel} → Plats ${withinBlock} av 10` };
  }
  const blockCount = globalThis.DINPULS_AD_INVENTORY.filter(item => item.page === slot.page).length;
  return { ...slot, municipality, blockLabel: slot.module, withinBlock: slot.position, blockCount,
    displayLabel: `${municipality} → ${slot.module} → Annonsplats ${slot.position} av ${blockCount}` };
}

async function listAvailableCompanySlots(request, env, url) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);
  if (env.SELF_SERVICE_PURCHASE_ENABLED !== "true") return json(request, { ok: false, error: "Annonsköp öppnar när avtals- och signeringsflödet är färdigt." }, 503);
  const municipality = cleanText(url.searchParams.get("municipality"), 80);
  const startDate = cleanText(url.searchParams.get("startDate"), 10);
  const endDate = cleanText(url.searchParams.get("endDate"), 10);
  if (!isSupportedMunicipality(municipality) || !isTwelveMonthContract(startDate, endDate)) {
    return json(request, { ok: false, error: "Välj en kommun och en avtalsperiod om 12 månader." }, 400);
  }
  const reservations = await env.DB.prepare("SELECT slot_id FROM contract_slot_reservations WHERE municipality = ? AND start_date <= ? AND end_date >= ?")
    .bind(municipality, endDate, startDate).all();
  const occupied = new Set((reservations.results || []).map(row => row.slot_id));
  const otherOrders = await env.DB.prepare("SELECT slot_id FROM self_service_holds WHERE municipality=? AND start_date<=? AND end_date>=? AND (status='committed' OR (status='held' AND expires_at>?))")
    .bind(municipality, endDate, startDate, new Date().toISOString()).all();
  for (const row of otherOrders.results || []) occupied.add(row.slot_id);
  // Older active contracts may predate the reservation table.
  const legacy = await env.DB.prepare("SELECT placements FROM ad_contracts WHERE municipality = ? AND status = 'Aktivt' AND start_date <= ? AND end_date >= ?")
    .bind(municipality, endDate, startDate).all();
  for (const row of legacy.results || []) {
    try { for (const item of JSON.parse(row.placements || "[]")) occupied.add(item.slotId); }
    catch { return json(request, { ok: false, error: "Äldre avtalsdata kunde inte verifieras. Lediga platser visas inte." }, 503); }
  }
  return json(request, { ok: true, municipality, startDate, endDate,
    slots: globalThis.DINPULS_AD_INVENTORY.filter(slot => !occupied.has(slot.id)).map(slot => slotDisplay(slot, municipality)),
    pricing: { monthlyExVat: BILLING.monthly.unitPrice, annualExVat: BILLING.annual.unitPrice, vatRate: 0.25 } });
}

const FIXED_SIGNATURE_KEY = "approved/sirelin-ab/v1.png";
const FIXED_SIGNATURE_SHA256 = "3055a756094c8bcc6166517a61d3deb484a85ac43d5dd2043b82b1b23b9a38f1";
async function preapprovedSignature(env) {
  if (!env.CONTRACT_SIGNATURES) throw new Error("FIXED_SIGNATURE_UNAVAILABLE");
  const object = await env.CONTRACT_SIGNATURES.get(FIXED_SIGNATURE_KEY);
  if (!object) throw new Error("FIXED_SIGNATURE_UNAVAILABLE");
  const bytes = new Uint8Array(await object.arrayBuffer());
  const digest = bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
  if (!safeEqual(digest, env.SELF_SERVICE_FIXED_SIGNATURE_SHA256 || FIXED_SIGNATURE_SHA256)) throw new Error("FIXED_SIGNATURE_MISMATCH");
  return { bytes, digest, snapshot: { mode: "preapproved-fixed", signer: "SirElin AB", role: "Förhandsgodkänd fast motpartssignatur för DinPuls", signatureId: "sirelin-ab-v1", sha256: digest } };
}

async function foundationSignatureImage(request, env, orderId) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);
  const order = await env.DB.prepare("SELECT snapshot_json, snapshot_hash, status, expires_at FROM self_service_orders WHERE id=? AND company_user_id=?").bind(orderId, session.subject_id).first();
  if (!order || order.status !== "held" || order.expires_at <= new Date().toISOString()) return json(request, { ok: false, error: "Avtalsutkastet finns inte." }, 404);
  if (!safeEqual(await sha256(order.snapshot_json), order.snapshot_hash)) return json(request, { ok: false, error: "Avtalsutkastet kunde inte verifieras." }, 409);
  const signature = JSON.parse(order.snapshot_json).dinpulsFixedSignature;
  if (signature?.mode !== "preapproved-fixed") return json(request, { ok: false, error: "Detta avtal saknar fast signatur." }, 404);
  let fixed;
  try { fixed = await preapprovedSignature(env); } catch { return json(request, { ok: false, error: "Den privata signaturen kunde inte verifieras." }, 503); }
  if (!safeEqual(signature.sha256, fixed.digest)) return json(request, { ok: false, error: "Signaturen matchar inte det låsta avtalet." }, 409);
  return new Response(fixed.bytes, { headers: { ...corsHeaders(request), "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

async function getContractSnapshot(request, env, id) {
  const session = await requireSession(request, env);
  if (!session || !["admin", "company"].includes(session.role)) return json(request, { ok: false, error: "Obehörig." }, 401);
  const row = await env.DB.prepare("SELECT company_user_id, contract_snapshot_json, contract_snapshot_hash, status FROM ad_contracts WHERE id=?").bind(id).first();
  if (!row || (session.role === "company" && String(row.company_user_id) !== String(session.subject_id))) return json(request, { ok: false, error: "Avtalet finns inte." }, 404);
  if (!row.contract_snapshot_json || !safeEqual(await sha256(row.contract_snapshot_json), row.contract_snapshot_hash)) return json(request, { ok: false, error: "Avtalsinnehållet kunde inte verifieras." }, 409);
  return json(request, { ok: true, snapshot: JSON.parse(row.contract_snapshot_json), snapshotHash: row.contract_snapshot_hash, status: row.status });
}

function checkedOrderLines(value) {
  if (!Array.isArray(value) || !value.length || value.length > 20) return null;
  const lines = value.map(item => ({ municipality: cleanText(item.municipality, 80), slotId: cleanText(item.slotId, 40), startDate: cleanText(item.startDate, 10), endDate: cleanText(item.endDate, 10) }));
  if (lines.some(item => !isSupportedMunicipality(item.municipality) || !isTwelveMonthContract(item.startDate, item.endDate) || !globalThis.DINPULS_AD_INVENTORY.some(slot => slot.id === item.slotId) || item.startDate < new Date().toISOString().slice(0, 10))) return null;
  if (new Set(lines.map(item => `${item.municipality}|${item.slotId}|${item.startDate}|${item.endDate}`)).size !== lines.length) return null;
  return lines;
}

async function prepareFoundationOrder(request, env) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);
  if (env.SELF_SERVICE_PURCHASE_ENABLED !== "true") return json(request, { ok: false, error: "Annonsköp är inte aktiverade." }, 503);
  const body = await readBody(request);
  const lines = checkedOrderLines(body?.placements), billingType = cleanText(body?.billingType, 20);
  if (!lines || !["monthly", "annual"].includes(billingType) || lines.some(line => line.startDate !== lines[0].startDate || line.endDate !== lines[0].endDate)) return json(request, { ok: false, error: "Första grundavtalet kräver giltiga platser med samma tolvmånadersperiod och betalningsmodell." }, 400);
  const user = await env.DB.prepare("SELECT id, company, org_no, contact, email, phone, address, postal_code, city, registration_source FROM business_users WHERE id=? AND active=1").bind(session.subject_id).first();
  if (!user || user.registration_source !== "self-service") return json(request, { ok: false, error: "Ett aktiverat självregistrerat konto krävs." }, 403);
  const expired = await env.DB.prepare("SELECT id, foundation_contract_id FROM self_service_orders WHERE company_user_id=? AND status IN ('held','customer_signed') AND expires_at<=?").bind(user.id, new Date().toISOString()).all();
  for (const row of expired.results || []) await env.DB.batch([
    env.DB.prepare("UPDATE self_service_orders SET status='expired' WHERE id=? AND status IN ('held','customer_signed')").bind(row.id),
    env.DB.prepare("UPDATE self_service_holds SET status='expired' WHERE order_id=? AND status='held'").bind(row.id),
    env.DB.prepare("UPDATE ad_contracts SET status='Avslutat', updated_at=? WHERE id=? AND company_user_id=? AND status='Utkast' AND signed_at IS NULL").bind(new Date().toISOString(), row.foundation_contract_id, user.id)
  ]);
  const old = await env.DB.prepare("SELECT id FROM ad_contracts WHERE company_user_id=? AND status<>'Avslutat' LIMIT 1").bind(user.id).first();
  if (old) return json(request, { ok: false, error: "Ett grundavtal finns redan. Använd tilläggsköp eller kontakta DinPuls om avtalsutkastet behöver avslutas." }, 409);
  if (await oldContractConflict(env, lines)) return json(request, { ok: false, error: "En plats är redan upptagen under vald period." }, 409);
  const placements = lines.map(line => {
    const slot = globalThis.DINPULS_AD_INVENTORY.find(item => item.id === line.slotId);
    const display = slotDisplay(slot, line.municipality);
    return { slotId: line.slotId, municipality: line.municipality, module: slot.module, group: slot.group, label: slot.label, location: display.displayLabel, page: slot.page, startDate: line.startDate, endDate: line.endDate };
  });
  const id = `DP-${new Date().getUTCFullYear()}-${String(crypto.getRandomValues(new Uint16Array(1))[0] % 10000).padStart(4, "0")}`;
  const now = new Date().toISOString(), expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString(), orderId = crypto.randomUUID();
  const price = calculateContractPrice(billingType, placements.length), municipality = [...new Set(lines.map(line => line.municipality))].join(", ");
  if (env.SELF_SERVICE_FIXED_SIGNATURE_ENABLED !== "true") return json(request, { ok: false, error: "Den fasta signaturen för v4.2 är inte aktiverad." }, 503);
  const snapshot = snapshotForContract({ id, company: user.company, orgNo: user.org_no, contact: user.contact, email: user.email, phone: user.phone, address: user.address, postalCode: user.postal_code, city: user.city, municipality, startDate: lines[0].startDate, endDate: lines[0].endDate }, placements, price, SELF_SERVICE_CONTRACT_VERSION, SELF_SERVICE_CONTRACT_TERMS);
  try { snapshot.dinpulsFixedSignature = (await preapprovedSignature(env)).snapshot; }
  catch { return json(request, { ok: false, error: "Den godkända privata DinPuls-signaturen saknas eller matchar inte originalet." }, 503); }
  const snapshotJson = stableStringify(snapshot), snapshotHash = await sha256(snapshotJson);
  const statements = [env.DB.prepare("INSERT INTO ad_contracts (id, company_user_id, contract_version, municipality, placements, price, annual_price, monthly_total, annual_total, billing_type, renewal_type, signature_required, start_date, end_date, status, contract_snapshot_json, contract_snapshot_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'annual-review',1,?,?,'Utkast',?,?,?,?)").bind(id, user.id, SELF_SERVICE_CONTRACT_VERSION, municipality, JSON.stringify(placements), price.unitPrice, billingType === "annual" ? price.unitPrice : 0, price.monthlyTotal, price.annualTotal, billingType, lines[0].startDate, lines[0].endDate, snapshotJson, snapshotHash, now, now), env.DB.prepare("INSERT INTO self_service_orders (id, company_user_id, foundation_contract_id, billing_type, snapshot_json, snapshot_hash, status, expires_at, created_at) VALUES (?,?,?,?,?,?,'held',?,?)").bind(orderId, user.id, id, billingType, snapshotJson, snapshotHash, expiresAt, now)];
  for (const line of lines) statements.push(env.DB.prepare("INSERT INTO self_service_holds (order_id,company_user_id,municipality,slot_id,start_date,end_date,status,expires_at,created_at) VALUES (?,?,?,?,?,?,'held',?,?)").bind(orderId, user.id, line.municipality, line.slotId, line.startDate, line.endDate, expiresAt, now));
  try { await env.DB.batch(statements); }
  catch (error) { return json(request, { ok: false, error: String(error).includes("SLOT_PERIOD_OCCUPIED") ? "En plats hann reserveras av någon annan." : "Avtalsutkastet kunde inte skapas. Försök igen." }, 409); }
  return json(request, { ok: true, orderId, contractId: id, snapshot, snapshotHash, expiresAt }, 201);
}

async function finalizePreapprovedFoundation(request, env, order, contract, name, title, customerBytes, snapshot, signedAt) {
  if (env.SELF_SERVICE_FIXED_SIGNATURE_ENABLED !== "true") return json(request, { ok: false, error: "Den fasta signaturvägen är inte aktiverad." }, 503);
  let fixed;
  try { fixed = await preapprovedSignature(env); } catch { return json(request, { ok: false, error: "DinPuls privata signatur kunde inte verifieras." }, 503); }
  if (snapshot.dinpulsFixedSignature?.signatureId !== fixed.snapshot.signatureId || !safeEqual(snapshot.dinpulsFixedSignature.sha256, fixed.digest)) return json(request, { ok: false, error: "Den fasta signaturen matchar inte det låsta avtalet." }, 409);
  const placements = JSON.parse(contract.placements || "[]");
  const lines = placements.map(item => ({ municipality: item.municipality, slotId: item.slotId, startDate: item.startDate, endDate: item.endDate }));
  if (await oldContractConflict(env, lines)) return json(request, { ok: false, error: "En plats är redan upptagen av ett aktivt avtal." }, 409);
  for (const line of lines) {
    const hold = await env.DB.prepare("SELECT 1 FROM self_service_holds WHERE order_id=? AND company_user_id=? AND municipality=? AND slot_id=? AND status='held' AND expires_at>?").bind(order.id, contract.company_user_id, line.municipality, line.slotId, signedAt).first();
    const other = await env.DB.prepare("SELECT 1 FROM self_service_holds WHERE order_id<>? AND municipality=? AND slot_id=? AND start_date<=? AND end_date>=? AND (status='committed' OR (status='held' AND expires_at>?)) LIMIT 1").bind(order.id, line.municipality, line.slotId, line.endDate, line.startDate, signedAt).first();
    if (!hold || other) return json(request, { ok: false, error: "En platsreservation är inte längre giltig." }, 409);
  }
  const keyBase = `contracts/${contract.id}/${order.snapshot_hash}`;
  const customerKey = `${keyBase}/customer-signature.png`, pdfKey = `${keyBase}/signed-contract.pdf`;
  if (await env.AD_ASSETS.head(customerKey) || await env.AD_ASSETS.head(pdfKey)) return json(request, { ok: false, error: "En signerad avtalsfil finns redan och får inte ersättas." }, 409);
  const claim = await env.DB.prepare("UPDATE self_service_orders SET status='signing' WHERE id=? AND company_user_id=? AND status='held' AND expires_at>?").bind(order.id, contract.company_user_id, signedAt).run();
  if (claim.meta.changes !== 1) return json(request, { ok: false, error: "Avtalet signeras redan eller reservationen har gått ut." }, 409);
  let pdfBytes, pdfHash;
  try {
    pdfBytes = await buildSignedPdf(snapshot, { customer: { name, title, bytes: customerBytes }, dinpuls: { name: "SirElin AB", title: "Fast förhandsgodkänd signatur", mode: "preapproved-fixed", bytes: fixed.bytes } }, signedAt, order.snapshot_hash);
    pdfHash = bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", pdfBytes)));
    await env.AD_ASSETS.put(customerKey, customerBytes, { httpMetadata: { contentType: "image/png", cacheControl: "private, no-store" }, customMetadata: { contractId: contract.id, snapshotHash: order.snapshot_hash } });
    await env.AD_ASSETS.put(pdfKey, pdfBytes, { httpMetadata: { contentType: "application/pdf", cacheControl: "private, no-store" }, customMetadata: { contractId: contract.id, snapshotHash: order.snapshot_hash, pdfHash } });
    const confirmation = stableStringify({ orderId: order.id, companyId: contract.company_user_id, foundationContractId: contract.id, snapshotHash: order.snapshot_hash, confirmedAt: signedAt, customerSignerName: name, customerSignerTitle: title, dinpulsSignatureId: fixed.snapshot.signatureId, dinpulsSignatureHash: fixed.digest, explicitConfirmation: true, channel: "preapproved-fixed-foundation-signature" });
    const confirmationHash = await sha256(confirmation);
    const statements = [env.DB.prepare("UPDATE self_service_orders SET status='confirmed', confirmed_at=? WHERE id=? AND status='signing' AND expires_at>?").bind(signedAt, order.id, signedAt)];
    for (const item of placements) statements.push(env.DB.prepare("INSERT INTO self_service_purchases (id,order_id,company_user_id,foundation_contract_id,municipality,slot_id,placement_label,billing_type,unit_price,vat_amount,start_date,end_date,contract_version,confirmation_json,confirmation_hash,confirmed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), order.id, contract.company_user_id, contract.id, item.municipality, item.slotId, item.location, contract.billing_type, contract.price, Math.round(contract.price * 0.25), item.startDate, item.endDate, contract.contract_version, confirmation, confirmationHash, signedAt));
    statements.push(env.DB.prepare("UPDATE self_service_holds SET status='committed' WHERE order_id=? AND status='held' AND expires_at>?").bind(order.id, signedAt));
    statements.push(env.DB.prepare("UPDATE ad_contracts SET customer_signer_name=?, customer_signer_title=?, dinpuls_signer_name='SirElin AB', dinpuls_signer_title='Fast förhandsgodkänd signatur', customer_signature_object_key=?, dinpuls_signature_object_key=?, signed_at=?, signed_pdf_object_key=?, signed_pdf_hash=?, status='Aktivt', updated_at=? WHERE id=? AND company_user_id=? AND status='Utkast' AND signed_at IS NULL AND contract_snapshot_hash=?").bind(name, title, customerKey, `r2:dinpuls-contract-signatures/${FIXED_SIGNATURE_KEY}`, signedAt, pdfKey, pdfHash, signedAt, contract.id, contract.company_user_id, order.snapshot_hash));
    await env.DB.batch(statements);
  } catch (error) {
    console.error("DinPuls fast avtalssignering:", error);
    await Promise.all([customerKey, pdfKey].map(key => env.AD_ASSETS.delete(key)));
    await env.DB.prepare("UPDATE self_service_orders SET status='held' WHERE id=? AND status='signing'").bind(order.id).run();
    return json(request, { ok: false, error: "Avtalet kunde inte låsas. Den privata fasta signaturen och reservationen har inte förbrukats." }, 409);
  }
  let emailStatus = "sent";
  try { await sendSignedContractEmail(env, contract, pdfBytes, snapshot); await env.DB.prepare("UPDATE ad_contracts SET contract_email_status='sent', contract_email_sent_at=?, contract_email_error=NULL WHERE id=?").bind(new Date().toISOString(), contract.id).run(); }
  catch (error) { emailStatus = "failed"; await env.DB.prepare("UPDATE ad_contracts SET contract_email_status='failed', contract_email_error=? WHERE id=?").bind(cleanText(error.message, 300), contract.id).run(); }
  return json(request, { ok: true, contractId: contract.id, orderId: order.id, status: "Aktivt", purchaseCount: placements.length, snapshotHash: order.snapshot_hash, pdfHash, emailStatus, signatureMode: "preapproved-fixed" });
}

async function signFoundationByCompany(request, env, orderId) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);
  if (env.SELF_SERVICE_PURCHASE_ENABLED !== "true") return json(request, { ok: false, error: "Signeringen är inte aktiverad." }, 503);
  if (!env.AD_ASSETS) return json(request, { ok: false, error: "Avtalsarkivet saknas." }, 503);
  const body = await readBody(request);
  const name = cleanText(body?.customerSignerName), title = cleanText(body?.customerSignerTitle);
  let bytes;
  try { bytes = dataUrlBytes(body?.customerSignature); } catch { return json(request, { ok: false, error: "Rita en giltig underskrift." }, 400); }
  if (!name || !title || body?.explicitConfirmation !== true) return json(request, { ok: false, error: "Namn, roll och uttryckligt godkännande krävs." }, 400);
  const order = await env.DB.prepare("SELECT * FROM self_service_orders WHERE id=? AND company_user_id=? AND status='held'").bind(orderId, session.subject_id).first();
  if (!order) return json(request, { ok: false, error: "Avtalsbeställningen finns inte eller har redan signerats." }, 404);
  const now = new Date().toISOString();
  if (order.expires_at <= now) return json(request, { ok: false, error: "Platsreservationen har gått ut. Börja om." }, 409);
  if (!safeEqual(order.snapshot_hash, body?.snapshotHash) || !safeEqual(await sha256(order.snapshot_json), order.snapshot_hash)) return json(request, { ok: false, error: "Avtalet som visas matchar inte det låsta underlaget." }, 409);
  const contract = await env.DB.prepare(`${CONTRACT_SELECT} WHERE c.id=? AND c.company_user_id=?`).bind(order.foundation_contract_id, session.subject_id).first();
  if (!contract || contract.status !== "Utkast" || contract.customer_signature_object_key || !safeEqual(contract.contract_snapshot_hash, order.snapshot_hash)) return json(request, { ok: false, error: "Avtalet är inte längre oförändrat och signeringsbart." }, 409);
  const snapshot = JSON.parse(order.snapshot_json);
  if (snapshot.dinpulsFixedSignature) {
    if (contract.contract_version !== snapshot.contractVersion || ![CONTRACT_VERSION, SELF_SERVICE_CONTRACT_VERSION].includes(contract.contract_version)) return json(request, { ok: false, error: "Avtalsversionen matchar inte det låsta grundavtalet." }, 409);
    if (!safeEqual(await sha256(contract.contract_snapshot_json || ""), order.snapshot_hash)) return json(request, { ok: false, error: "Avtalets låsta innehåll matchar inte beställningen." }, 409);
    return finalizePreapprovedFoundation(request, env, order, contract, name, title, bytes, snapshot, now);
  }
  const key = `contracts/${contract.id}/${order.snapshot_hash}/customer-signature.png`;
  if (await env.AD_ASSETS.head(key)) return json(request, { ok: false, error: "En kundsignatur finns redan och får inte ersättas." }, 409);
  await env.AD_ASSETS.put(key, bytes, { httpMetadata: { contentType: "image/png", cacheControl: "private, no-store" }, customMetadata: { contractId: contract.id, snapshotHash: order.snapshot_hash } });
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  try { await env.DB.batch([env.DB.prepare("UPDATE ad_contracts SET customer_signer_name=?, customer_signer_title=?, customer_signature_object_key=?, updated_at=? WHERE id=? AND company_user_id=? AND status='Utkast' AND customer_signature_object_key IS NULL").bind(name, title, key, now, contract.id, session.subject_id), env.DB.prepare("UPDATE self_service_orders SET status='customer_signed', expires_at=? WHERE id=? AND status='held'").bind(expiresAt, orderId), env.DB.prepare("UPDATE self_service_holds SET expires_at=? WHERE order_id=? AND status='held'").bind(expiresAt, orderId)]); }
  catch { await env.AD_ASSETS.delete(key); return json(request, { ok: false, error: "Underskriften kunde inte låsas. Försök igen." }, 409); }
  return json(request, { ok: true, contractId: contract.id, orderId, status: "waiting_for_dinpuls_signature", expiresAt, message: "Din underskrift är låst. Avtalet blir bindande först när DinPuls också har undertecknat det." });
}

async function currentFoundationOrder(request, env) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);
  const row = await env.DB.prepare("SELECT id, foundation_contract_id, status, expires_at, snapshot_json, snapshot_hash FROM self_service_orders WHERE company_user_id=? AND status IN ('held','customer_signed') ORDER BY created_at DESC LIMIT 1").bind(session.subject_id).first();
  if (!row || row.expires_at <= new Date().toISOString()) return json(request, { ok: true, order: null });
  if (!safeEqual(await sha256(row.snapshot_json), row.snapshot_hash)) return json(request, { ok: false, error: "Avtalsutkastet kunde inte verifieras." }, 409);
  return json(request, { ok: true, order: { orderId: row.id, contractId: row.foundation_contract_id, status: row.status, expiresAt: row.expires_at, snapshot: JSON.parse(row.snapshot_json), snapshotHash: row.snapshot_hash } });
}

async function oldContractConflict(env, lines) {
  for (const line of lines) {
    const legacy = await env.DB.prepare("SELECT placements FROM ad_contracts WHERE municipality=? AND status='Aktivt' AND start_date<=? AND end_date>=?")
      .bind(line.municipality, line.endDate, line.startDate).all();
    for (const row of legacy.results || []) {
      let placements;
      try { placements = JSON.parse(row.placements || "[]"); } catch { return true; }
      if (placements.some(item => item.slotId === line.slotId)) return true;
    }
  }
  return false;
}

async function foundationForCompany(env, companyId) {
  return env.DB.prepare("SELECT id, contract_version FROM ad_contracts WHERE company_user_id=? AND status='Aktivt' AND signed_at IS NOT NULL AND signed_pdf_object_key IS NOT NULL ORDER BY signed_at DESC LIMIT 1").bind(companyId).first();
}

async function prepareCompanyOrder(request, env) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);
  if (env.SELF_SERVICE_PURCHASE_ENABLED !== "true") return json(request, { ok: false, error: "Annonsköp är inte aktiverade." }, 503);
  const body = await readBody(request);
  const lines = checkedOrderLines(body?.placements), billingType = cleanText(body?.billingType, 20);
  if (!lines || !["monthly", "annual"].includes(billingType)) return json(request, { ok: false, error: "Välj giltiga platser, en tolvmånadersperiod och en betalningsmodell." }, 400);
  const user = await env.DB.prepare("SELECT id, company, org_no, contact, email, phone, address, postal_code, city FROM business_users WHERE id=? AND active=1").bind(session.subject_id).first();
  if (!user) return json(request, { ok: false, error: "Företagskontot är inte aktivt." }, 403);
  const foundation = await foundationForCompany(env, user.id);
  if (!foundation) return json(request, { ok: false, error: "Ett färdigsignerat grundavtal krävs före ett tilläggsköp." }, 409);
  if (await oldContractConflict(env, lines)) return json(request, { ok: false, error: "En plats är redan upptagen under vald period." }, 409);
  const price = calculateContractPrice(billingType, lines.length);
  const placements = lines.map(line => {
    const slot = globalThis.DINPULS_AD_INVENTORY.find(item => item.id === line.slotId);
    const display = slotDisplay(slot, line.municipality);
    return { ...line, placementLabel: display.displayLabel, module: slot.module, page: slot.page, unitPrice: price.unitPrice, vatAmount: Math.round(price.unitPrice * 0.25) };
  });
  const id = crypto.randomUUID(), now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  const snapshot = { orderId: id, companyId: user.id, company: { name: user.company, orgNo: user.org_no, contact: user.contact, email: user.email, phone: user.phone, address: user.address, postalCode: user.postal_code, city: user.city }, foundationContractId: foundation.id, contractVersion: foundation.contract_version, billingType, placements, totals: { perInvoiceExVat: price.invoiceTotal, perInvoiceVat: Math.round(price.invoiceTotal * 0.25), perInvoiceInclVat: Math.round(price.invoiceTotal * 1.25), twelveMonthsExVat: price.annualTotal, twelveMonthsVat: Math.round(price.annualTotal * 0.25) }, terms: foundation.contract_version === SELF_SERVICE_CONTRACT_VERSION ? SELF_SERVICE_CONTRACT_TERMS : CONTRACT_TERMS, createdAt: now, expiresAt };
  const snapshotJson = stableStringify(snapshot), snapshotHash = await sha256(snapshotJson);
  const statements = [env.DB.prepare("INSERT INTO self_service_orders (id, company_user_id, foundation_contract_id, billing_type, snapshot_json, snapshot_hash, status, expires_at, created_at) VALUES (?,?,?,?,?,?,'held',?,?)").bind(id, user.id, foundation.id, billingType, snapshotJson, snapshotHash, expiresAt, now)];
  for (const line of placements) statements.push(env.DB.prepare("INSERT INTO self_service_holds (order_id, company_user_id, municipality, slot_id, start_date, end_date, status, expires_at, created_at) VALUES (?,?,?,?,?,?,'held',?,?)").bind(id, user.id, line.municipality, line.slotId, line.startDate, line.endDate, expiresAt, now));
  try { await env.DB.batch(statements); }
  catch (error) { return json(request, { ok: false, error: String(error).includes("SLOT_PERIOD_OCCUPIED") ? "En plats hann reserveras av någon annan. Välj en annan plats." : "Beställningen kunde inte reserveras." }, 409); }
  return json(request, { ok: true, orderId: id, expiresAt, snapshot, snapshotHash }, 201);
}

async function confirmCompanyOrder(request, env, id) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);
  if (env.SELF_SERVICE_PURCHASE_ENABLED !== "true") return json(request, { ok: false, error: "Annonsköp är inte aktiverade." }, 503);
  const body = await readBody(request);
  const order = await env.DB.prepare("SELECT * FROM self_service_orders WHERE id=? AND company_user_id=?").bind(id, session.subject_id).first();
  if (!order) return json(request, { ok: false, error: "Beställningen finns inte." }, 404);
  if (order.status === "confirmed") return json(request, { ok: true, orderId: id, status: "confirmed" });
  const now = new Date().toISOString();
  if (order.status !== "held" || order.expires_at <= now) return json(request, { ok: false, error: "Reservationen har gått ut. Välj plats på nytt." }, 409);
  if (body?.explicitConfirmation !== true || !safeEqual(body?.snapshotHash, order.snapshot_hash)) return json(request, { ok: false, error: "Bekräfta den oförändrade beställningen och villkoren uttryckligen." }, 400);
  if (!await foundationForCompany(env, session.subject_id)) return json(request, { ok: false, error: "Grundavtalet är inte längre giltigt." }, 409);
  const snapshot = JSON.parse(order.snapshot_json);
  const confirmation = { orderId: id, companyId: Number(session.subject_id), foundationContractId: order.foundation_contract_id, snapshotHash: order.snapshot_hash, confirmedAt: now, explicitConfirmation: true, channel: "authenticated-company-portal" };
  const confirmationJson = stableStringify(confirmation), confirmationHash = await sha256(confirmationJson);
  const statements = [env.DB.prepare("UPDATE self_service_orders SET status='confirmed', confirmed_at=? WHERE id=? AND company_user_id=? AND status='held' AND expires_at>?").bind(now, id, session.subject_id, now)];
  for (const line of snapshot.placements) statements.push(env.DB.prepare("INSERT INTO self_service_purchases (id,order_id,company_user_id,foundation_contract_id,municipality,slot_id,placement_label,billing_type,unit_price,vat_amount,start_date,end_date,contract_version,confirmation_json,confirmation_hash,confirmed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), id, session.subject_id, order.foundation_contract_id, line.municipality, line.slotId, line.placementLabel, order.billing_type, line.unitPrice, line.vatAmount, line.startDate, line.endDate, snapshot.contractVersion, confirmationJson, confirmationHash, now));
  statements.push(env.DB.prepare("UPDATE self_service_holds SET status='committed' WHERE order_id=? AND company_user_id=? AND status='held' AND expires_at>?").bind(id, session.subject_id, now));
  try { await env.DB.batch(statements); }
  catch { return json(request, { ok: false, error: "Beställningen kunde inte låsas. Kontrollera reservationen och försök igen." }, 409); }
  return json(request, { ok: true, orderId: id, status: "confirmed", purchaseCount: snapshot.placements.length, billingStatus: "waiting_for_launch", confirmationHash });
}

async function listCompanyPurchases(request, env) {
  const session = await requireSession(request, env, "company");
  if (!session) return json(request, { ok: false, error: "Obehörig." }, 401);
  const rows = await env.DB.prepare("SELECT id, order_id, foundation_contract_id, municipality, slot_id, placement_label, billing_type, unit_price, vat_amount, start_date, end_date, contract_version, billing_status, publication_status, confirmed_at FROM self_service_purchases WHERE company_user_id=? ORDER BY confirmed_at DESC").bind(session.subject_id).all();
  return json(request, { ok: true, purchases: rows.results || [] });
}

async function activatePurchaseForPublication(request, env, id) {
  if (!await requireSession(request, env, "admin")) return json(request, { ok: false, error: "Obehörig." }, 401);
  const body = await readBody(request);
  if (body?.explicitActivation !== true) return json(request, { ok: false, error: "Bekräfta kommunens och annonsplatsens aktivering uttryckligen." }, 400);
  const purchase = await env.DB.prepare("SELECT p.id, p.municipality, p.slot_id, p.publication_status, c.status contract_status, c.signed_at FROM self_service_purchases p JOIN ad_contracts c ON c.id=p.foundation_contract_id WHERE p.id=?").bind(id).first();
  if (!purchase) return json(request, { ok: false, error: "Köpet finns inte." }, 404);
  if (purchase.contract_status !== "Aktivt" || !purchase.signed_at) return json(request, { ok: false, error: "Grundavtalet är inte färdigsignerat och aktivt." }, 409);
  if (purchase.publication_status === "active") return json(request, { ok: true, status: "active" });
  if (purchase.publication_status !== "waiting_for_launch") return json(request, { ok: false, error: "Köpet kan inte aktiveras från nuvarande status." }, 409);
  await env.DB.prepare("UPDATE self_service_purchases SET publication_status='active', billing_status='ready_for_invoice' WHERE id=? AND publication_status='waiting_for_launch'").bind(id).run();
  return json(request, { ok: true, status: "active", billingStatus: "ready_for_invoice", municipality: purchase.municipality, slotId: purchase.slot_id, spirisEnabled: false });
}

async function readBillingBasis(request, env, url) {
  if (!await requireSession(request, env, "admin")) return json(request, { ok: false, error: "Obehörig." }, 401);
  const companyId = Number(url.searchParams.get("companyId"));
  if (!Number.isSafeInteger(companyId) || companyId < 1) return json(request, { ok: false, error: "Ange ett giltigt företags-ID." }, 400);
  const user = await env.DB.prepare("SELECT id, company, org_no, address, postal_code, city, contact, email FROM business_users WHERE id=?").bind(companyId).first();
  if (!user) return json(request, { ok: false, error: "Företaget finns inte." }, 404);
  const rows = await env.DB.prepare("SELECT id, municipality, slot_id, placement_label, billing_type, unit_price, start_date, end_date FROM self_service_purchases WHERE company_user_id=? AND billing_status='ready_for_invoice' AND spiris_invoice_id IS NULL ORDER BY start_date, id").bind(companyId).all();
  if (!(rows.results || []).length) return json(request, { ok: true, basis: null, purchaseCount: 0, spirisEnabled: false });
  const basis = buildBillingBasis({ id: user.id, company: user.company, orgNo: user.org_no, address: user.address, postalCode: user.postal_code, city: user.city, contact: user.contact, email: user.email }, rows.results.map(row => ({ id: row.id, municipality: row.municipality, slotId: row.slot_id, placementLabel: row.placement_label, billingType: row.billing_type, unitPriceExVat: row.unit_price, startDate: row.start_date, endDate: row.end_date })));
  return json(request, { ok: true, basis, purchaseCount: rows.results.length, spirisEnabled: false });
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
      typeof p256dh !== "string" || typeof auth !== "string" || !isSupportedMunicipality(municipality)) {
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
  if (!isSupportedMunicipality(body?.municipality)) {
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
          portalEmailConfigured: Boolean(env.RESEND_API_KEY && env.PORTAL_EMAIL_FROM),
          adAssetsConfigured: Boolean(env.AD_ASSETS),
          portalAuthVersion: "hmac-sha256-v1",
          selfServiceSignupEnabled: env.SELF_SERVICE_SIGNUP_ENABLED === "true",
          selfServicePurchaseEnabled: env.SELF_SERVICE_PURCHASE_ENABLED === "true",
          selfServiceFixedSignatureEnabled: env.SELF_SERVICE_FIXED_SIGNATURE_ENABLED === "true",
          spirisEnabled: false
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
      if (request.method === "POST" && url.pathname === "/portal/company/register") return registerCompany(request, env);
      if (request.method === "POST" && url.pathname === "/portal/auth/logout") return logoutPortal(request, env);
      if (request.method === "POST" && url.pathname === "/portal/account/token/verify") return verifyAccountToken(request, env);
      if (request.method === "POST" && url.pathname === "/portal/account/password") return completeAccountPassword(request, env);
      if (request.method === "POST" && url.pathname === "/portal/account/reset/request") return requestPasswordReset(request, env);
      if (request.method === "POST" && url.pathname === "/portal/account/reset/complete") return completeAccountPassword(request, env, "reset-password");
      if (request.method === "GET" && url.pathname === "/portal/admin/contracts") return listContracts(request, env);
      if (request.method === "POST" && url.pathname === "/portal/admin/contracts") return createContract(request, env);
      const signContractMatch = /^\/portal\/admin\/contracts\/([^/]+)\/sign$/.exec(url.pathname);
      if (request.method === "POST" && signContractMatch) return signContract(request, env, decodeURIComponent(signContractMatch[1]));
      const pdfContractMatch = /^\/portal\/(?:admin|company)\/contracts\/([^/]+)\/pdf$/.exec(url.pathname);
      if (request.method === "GET" && pdfContractMatch) return downloadContractPdf(request, env, decodeURIComponent(pdfContractMatch[1]));
      const snapshotContractMatch = /^\/portal\/(?:admin|company)\/contracts\/([^/]+)\/snapshot$/.exec(url.pathname);
      if (request.method === "GET" && snapshotContractMatch) return getContractSnapshot(request, env, decodeURIComponent(snapshotContractMatch[1]));
      const contractMatch = /^\/portal\/admin\/contracts\/([^/]+)$/.exec(url.pathname);
      if (request.method === "PATCH" && contractMatch) return updateContractStatus(request, env, decodeURIComponent(contractMatch[1]));
      const activationMatch = /^\/portal\/admin\/contracts\/([^/]+)\/activation$/.exec(url.pathname);
      if (request.method === "POST" && activationMatch) return resendActivation(request, env, decodeURIComponent(activationMatch[1]));
      const contractEmailMatch = /^\/portal\/admin\/contracts\/([^/]+)\/email$/.exec(url.pathname);
      if (request.method === "POST" && contractEmailMatch) return resendSignedContractEmail(request, env, decodeURIComponent(contractEmailMatch[1]));
      if (request.method === "GET" && url.pathname === "/portal/company/me") return companyAccount(request, env);
      if (request.method === "GET" && url.pathname === "/portal/company/available-slots") return listAvailableCompanySlots(request, env, url);
      if (request.method === "POST" && url.pathname === "/portal/company/orders") return prepareCompanyOrder(request, env);
      if (request.method === "POST" && url.pathname === "/portal/company/foundation/orders") return prepareFoundationOrder(request, env);
      const fixedSignatureMatch = /^\/portal\/company\/foundation\/orders\/([^/]+)\/dinpuls-signature$/.exec(url.pathname);
      if (request.method === "GET" && fixedSignatureMatch) return foundationSignatureImage(request, env, decodeURIComponent(fixedSignatureMatch[1]));
      if (request.method === "GET" && url.pathname === "/portal/company/foundation/current") return currentFoundationOrder(request, env);
      if (request.method === "GET" && url.pathname === "/portal/company/purchases") return listCompanyPurchases(request, env);
      if (request.method === "GET" && url.pathname === "/portal/admin/billing/basis") return readBillingBasis(request, env, url);
      const foundationSignMatch = /^\/portal\/company\/foundation\/orders\/([0-9a-f-]{36})\/sign$/i.exec(url.pathname);
      if (request.method === "POST" && foundationSignMatch) return signFoundationByCompany(request, env, foundationSignMatch[1]);
      const companyOrderMatch = /^\/portal\/company\/orders\/([0-9a-f-]{36})\/confirm$/i.exec(url.pathname);
      if (request.method === "POST" && companyOrderMatch) return confirmCompanyOrder(request, env, companyOrderMatch[1]);
      const activatePurchaseMatch = /^\/portal\/admin\/purchases\/([0-9a-f-]{36})\/activate$/i.exec(url.pathname);
      if (request.method === "POST" && activatePurchaseMatch) return activatePurchaseForPublication(request, env, activatePurchaseMatch[1]);
      if (request.method === "PATCH" && url.pathname === "/portal/company/profile") return updateCompanyProfile(request, env);
      if (request.method === "GET" && url.pathname === "/portal/company/banners") return listCompanyBanners(request, env);
      if (request.method === "GET" && url.pathname === "/portal/company/stats") return companyStats(request, env);
      if (request.method === "POST" && url.pathname === "/portal/company/banners") return uploadCompanyBanner(request, env);
      const companyBannerMatch = /^\/portal\/company\/banners\/([0-9a-f-]{36})$/i.exec(url.pathname);
      if (request.method === "DELETE" && companyBannerMatch) return deleteCompanyBanner(request, env, companyBannerMatch[1]);
      const currentBannerMatch = /^\/ads\/current\/([A-Z0-9-]{4,40})$/.exec(url.pathname);
      if (request.method === "GET" && currentBannerMatch) return currentBanner(request, env, currentBannerMatch[1], cleanText(url.searchParams.get("municipality"), 80));
      if (request.method === "POST" && url.pathname === "/ads/events") return recordBannerEvent(request, env);
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
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { BILLING, CONTRACT_TERMS, CONTRACT_VERSION, calculateContractPrice, stableStringify } from "./contract-v4.js";
import { CONTRACT_TERMS as SELF_SERVICE_CONTRACT_TERMS, CONTRACT_VERSION as SELF_SERVICE_CONTRACT_VERSION } from "./contract-v4.2.js";
import municipalityConfig from "../data/municipalities.json";
import { normalizeSwedishOrgNumber } from "./swedish-org-number.js";
import { buildBillingBasis } from "./spiris-adapter.js";
import "../admin/ad-inventory.js";
