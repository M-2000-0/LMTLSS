/* HTTP layer: a small router, JSON helpers and one error shape.
 *
 * No framework and no dependencies — the Worker bundle is a handful of plain
 * ES modules. Handlers receive a context and return { status, body } or throw
 * an HttpError; nothing else touches the Response object.
 */

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details || null;
  }
}

export const badRequest = function (code, message, details) { return new HttpError(400, code, message, details); };
export const unauthorized = function (message) { return new HttpError(401, "unauthorized", message || "Sign in required."); };
export const forbidden = function (message) { return new HttpError(403, "forbidden", message || "Not allowed."); };
export const notFound = function (thing) { return new HttpError(404, "not_found", (thing || "Resource") + " not found."); };
export const conflict = function (code, message) { return new HttpError(409, code, message); };
export const tooMany = function (message) { return new HttpError(429, "rate_limited", message || "Too many requests — slow down and try again later."); };
export const unavailable = function (code, message) { return new HttpError(503, code, message); };

export function json(body, status, headers) {
  return {
    status: status || 200,
    body: body === undefined ? null : body,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, headers || {})
  };
}

/* ---------- routing ---------- */

/**
 * Routes are declared as "METHOD /path/:param". Matching is exact on segments;
 * a trailing ":name" captures one segment. No wildcards, no regex — small,
 * predictable, and easy to keep authorized (see api.js: every route declares
 * whether it needs a signed-in user).
 */
export function matchRoute(routes, method, pathname) {
  const parts = pathname.split("/").filter(function (p) { return p.length > 0; });
  for (const route of routes) {
    if (route.method !== method) continue;
    const want = route.path.split("/").filter(function (p) { return p.length > 0; });
    if (want.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < want.length; i++) {
      const w = want[i];
      if (w.charAt(0) === ":") params[w.slice(1)] = decodeURIComponent(parts[i]);
      else if (w !== parts[i]) { ok = false; break; }
    }
    if (!ok) continue;
    return { route: route, params: params };
  }
  return null;
}

/* ---------- input validation ---------- */

export function str(body, field, opts) {
  const o = opts || {};
  const raw = body ? body[field] : undefined;
  if (raw === undefined || raw === null || raw === "") {
    if (o.required) throw badRequest("invalid_" + field, "Missing required field: " + field);
    return o.default !== undefined ? o.default : null;
  }
  if (typeof raw !== "string") throw badRequest("invalid_" + field, field + " must be a string");
  const value = raw.trim();
  if (o.required && value.length === 0) throw badRequest("invalid_" + field, "Missing required field: " + field);
  if (o.max && value.length > o.max) throw badRequest("invalid_" + field, field + " must be " + o.max + " characters or fewer");
  if (o.min && value.length < o.min) throw badRequest("invalid_" + field, field + " must be at least " + o.min + " characters");
  if (o.oneOf && o.oneOf.indexOf(value) < 0) throw badRequest("invalid_" + field, field + " must be one of: " + o.oneOf.join(", "));
  return value;
}

export function int(body, field, opts) {
  const o = opts || {};
  const raw = body ? body[field] : undefined;
  if (raw === undefined || raw === null || raw === "") {
    if (o.required) throw badRequest("invalid_" + field, "Missing required field: " + field);
    return o.default !== undefined ? o.default : null;
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!isFinite(n) || Math.floor(n) !== n) throw badRequest("invalid_" + field, field + " must be a whole number");
  if (o.min !== undefined && n < o.min) throw badRequest("invalid_" + field, field + " must be at least " + o.min);
  if (o.max !== undefined && n > o.max) throw badRequest("invalid_" + field, field + " must be at most " + o.max);
  return n;
}

/** ISO-8601 instant, normalised to UTC text. Rejects anything unparseable. */
export function instant(body, field, opts) {
  const o = opts || {};
  const raw = body ? body[field] : undefined;
  if (raw === undefined || raw === null || raw === "") {
    if (o.required) throw badRequest("invalid_" + field, "Missing required field: " + field);
    return null;
  }
  const t = Date.parse(raw);
  if (!isFinite(t)) throw badRequest("invalid_" + field, field + " must be an ISO-8601 date-time");
  return new Date(t).toISOString();
}

export function bool(body, field, def) {
  const raw = body ? body[field] : undefined;
  if (raw === undefined || raw === null) return def === undefined ? false : def;
  if (typeof raw === "boolean") return raw;
  if (raw === 1 || raw === "1" || raw === "true") return true;
  if (raw === 0 || raw === "0" || raw === "false") return false;
  throw badRequest("invalid_" + field, field + " must be a boolean");
}

/** Page size for any growing collection: bounded, defaulting small. */
export function pageParams(query, opts) {
  const o = opts || {};
  const limit = Math.min(Math.max(parseInt(query.get("limit") || String(o.defaultLimit || 20), 10) || 20, 1), o.maxLimit || 50);
  const offset = Math.max(parseInt(query.get("offset") || "0", 10) || 0, 0);
  return { limit: limit, offset: offset };
}

/* ---------- misc ---------- */

export function newId(prefix) {
  return prefix + "_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

export function nowIso(now) {
  return new Date(now).toISOString();
}

/** Slugs are generated server-side from a name; never trusted from input. */
export function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "community";
}

/** Strip characters that have no business in a display name. */
export function cleanText(value, max) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim()
    .slice(0, max || 400);
}
