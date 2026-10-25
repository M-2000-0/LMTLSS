var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/http.js
var HttpError = class extends Error {
  static {
    __name(this, "HttpError");
  }
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details || null;
  }
};
var badRequest = /* @__PURE__ */ __name(function(code, message, details) {
  return new HttpError(400, code, message, details);
}, "badRequest");
var unauthorized = /* @__PURE__ */ __name(function(message) {
  return new HttpError(401, "unauthorized", message || "Sign in required.");
}, "unauthorized");
var forbidden = /* @__PURE__ */ __name(function(message) {
  return new HttpError(403, "forbidden", message || "Not allowed.");
}, "forbidden");
var notFound = /* @__PURE__ */ __name(function(thing) {
  return new HttpError(404, "not_found", (thing || "Resource") + " not found.");
}, "notFound");
var conflict = /* @__PURE__ */ __name(function(code, message) {
  return new HttpError(409, code, message);
}, "conflict");
var tooMany = /* @__PURE__ */ __name(function(message) {
  return new HttpError(429, "rate_limited", message || "Too many requests \u2014 slow down and try again later.");
}, "tooMany");
var unavailable = /* @__PURE__ */ __name(function(code, message) {
  return new HttpError(503, code, message);
}, "unavailable");
function json(body, status, headers) {
  return {
    status: status || 200,
    body: body === void 0 ? null : body,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, headers || {})
  };
}
__name(json, "json");
function matchRoute(routes5, method, pathname) {
  const parts = pathname.split("/").filter(function(p) {
    return p.length > 0;
  });
  for (const route of routes5) {
    if (route.method !== method) continue;
    const want = route.path.split("/").filter(function(p) {
      return p.length > 0;
    });
    if (want.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < want.length; i++) {
      const w = want[i];
      if (w.charAt(0) === ":") params[w.slice(1)] = decodeURIComponent(parts[i]);
      else if (w !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    return { route, params };
  }
  return null;
}
__name(matchRoute, "matchRoute");
function str(body, field, opts) {
  const o = opts || {};
  const raw = body ? body[field] : void 0;
  if (raw === void 0 || raw === null || raw === "") {
    if (o.required) throw badRequest("invalid_" + field, "Missing required field: " + field);
    return o.default !== void 0 ? o.default : null;
  }
  if (typeof raw !== "string") throw badRequest("invalid_" + field, field + " must be a string");
  const value = raw.trim();
  if (o.required && value.length === 0) throw badRequest("invalid_" + field, "Missing required field: " + field);
  if (o.max && value.length > o.max) throw badRequest("invalid_" + field, field + " must be " + o.max + " characters or fewer");
  if (o.min && value.length < o.min) throw badRequest("invalid_" + field, field + " must be at least " + o.min + " characters");
  if (o.oneOf && o.oneOf.indexOf(value) < 0) throw badRequest("invalid_" + field, field + " must be one of: " + o.oneOf.join(", "));
  return value;
}
__name(str, "str");
function int(body, field, opts) {
  const o = opts || {};
  const raw = body ? body[field] : void 0;
  if (raw === void 0 || raw === null || raw === "") {
    if (o.required) throw badRequest("invalid_" + field, "Missing required field: " + field);
    return o.default !== void 0 ? o.default : null;
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!isFinite(n) || Math.floor(n) !== n) throw badRequest("invalid_" + field, field + " must be a whole number");
  if (o.min !== void 0 && n < o.min) throw badRequest("invalid_" + field, field + " must be at least " + o.min);
  if (o.max !== void 0 && n > o.max) throw badRequest("invalid_" + field, field + " must be at most " + o.max);
  return n;
}
__name(int, "int");
function instant(body, field, opts) {
  const o = opts || {};
  const raw = body ? body[field] : void 0;
  if (raw === void 0 || raw === null || raw === "") {
    if (o.required) throw badRequest("invalid_" + field, "Missing required field: " + field);
    return null;
  }
  const t = Date.parse(raw);
  if (!isFinite(t)) throw badRequest("invalid_" + field, field + " must be an ISO-8601 date-time");
  return new Date(t).toISOString();
}
__name(instant, "instant");
function bool(body, field, def) {
  const raw = body ? body[field] : void 0;
  if (raw === void 0 || raw === null) return def === void 0 ? false : def;
  if (typeof raw === "boolean") return raw;
  if (raw === 1 || raw === "1" || raw === "true") return true;
  if (raw === 0 || raw === "0" || raw === "false") return false;
  throw badRequest("invalid_" + field, field + " must be a boolean");
}
__name(bool, "bool");
function pageParams(query, opts) {
  const o = opts || {};
  const limit = Math.min(Math.max(parseInt(query.get("limit") || String(o.defaultLimit || 20), 10) || 20, 1), o.maxLimit || 50);
  const offset = Math.max(parseInt(query.get("offset") || "0", 10) || 0, 0);
  return { limit, offset };
}
__name(pageParams, "pageParams");
function nowIso(now) {
  return new Date(now).toISOString();
}
__name(nowIso, "nowIso");
function slugify(name) {
  return String(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "community";
}
__name(slugify, "slugify");
function cleanText(value, max) {
  return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max || 400);
}
__name(cleanText, "cleanText");

// src/jwt.js
var encoder = new TextEncoder();
function base64UrlToBytes(text) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(base64UrlToBytes, "base64UrlToBytes");
function base64UrlToJson(text) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(text)));
}
__name(base64UrlToJson, "base64UrlToJson");
function bytesToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(bytesToBase64Url, "bytesToBase64Url");
function decodeJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw unauthorized("Malformed token.");
  return {
    header: base64UrlToJson(parts[0]),
    claims: base64UrlToJson(parts[1]),
    signature: base64UrlToBytes(parts[2]),
    signed: parts[0] + "." + parts[1]
  };
}
__name(decodeJwt, "decodeJwt");
function checkTimes(claims, now) {
  const seconds = Math.floor((now === void 0 ? Date.now() : now) / 1e3);
  if (claims.exp !== void 0 && seconds >= Number(claims.exp)) throw unauthorized("Session expired.");
  if (claims.nbf !== void 0 && seconds < Number(claims.nbf)) throw unauthorized("Token is not valid yet.");
}
__name(checkTimes, "checkTimes");
async function verifyHs256(token, secret, now) {
  const decoded = decodeJwt(token);
  if (decoded.header.alg !== "HS256") throw unauthorized("Unsupported token algorithm.");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    decoded.signature,
    encoder.encode(decoded.signed)
  );
  if (!valid) throw unauthorized("Invalid token signature.");
  checkTimes(decoded.claims, now);
  return decoded.claims;
}
__name(verifyHs256, "verifyHs256");
async function verifyRs256(token, jwks, now) {
  const decoded = decodeJwt(token);
  if (decoded.header.alg !== "RS256") throw unauthorized("Unsupported token algorithm.");
  const keys = Array.isArray(jwks) ? jwks : [];
  const kid = decoded.header.kid;
  const jwk = keys.find(function(key2) {
    return key2 && key2.kid === kid;
  }) || (kid === void 0 ? keys[0] : null);
  if (!jwk) throw unauthorized("Signing key not found.");
  if (jwk.kty !== "RSA" || !jwk.n || !jwk.e) throw unauthorized("Signing key is not an RSA key.");
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decoded.signature,
    encoder.encode(decoded.signed)
  );
  if (!valid) throw unauthorized("Invalid token signature.");
  checkTimes(decoded.claims, now);
  return decoded.claims;
}
__name(verifyRs256, "verifyRs256");
function assertClaims(claims, options) {
  const opts = options || {};
  if (!claims.sub) throw unauthorized("Token carries no subject.");
  if (opts.issuers) {
    const allowed = Array.isArray(opts.issuers) ? opts.issuers : [opts.issuers];
    if (allowed.indexOf(claims.iss) < 0) throw unauthorized("Token issued by an unexpected issuer.");
  }
  if (opts.audiences) {
    const allowed = Array.isArray(opts.audiences) ? opts.audiences : [opts.audiences];
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const matches = aud.some(function(value) {
      return allowed.indexOf(value) >= 0;
    });
    if (!matches) throw unauthorized("Token is not addressed to this API.");
  }
  return claims;
}
__name(assertClaims, "assertClaims");

// src/email-codes.js
var CODE_TTL_SEC = 600;
var MAX_ATTEMPTS = 5;
var encoder2 = new TextEncoder();
function bytesToHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}
__name(bytesToHex, "bytesToHex");
function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
__name(timingSafeEqualHex, "timingSafeEqualHex");
function generateCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1e6;
  return String(value).padStart(6, "0");
}
__name(generateCode, "generateCode");
async function hashCode(email, purpose, code, pepper) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder2.encode(String(pepper || "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder2.encode(email + ":" + purpose + ":" + code)
  );
  return bytesToHex(new Uint8Array(signature));
}
__name(hashCode, "hashCode");
async function issueCode(db, options) {
  const opts = options || {};
  const email = opts.email;
  const purpose = opts.purpose;
  const nowMs2 = opts.now === void 0 ? Date.now() : opts.now;
  const ttlSec = opts.ttlSec || CODE_TTL_SEC;
  const nowIso2 = new Date(nowMs2).toISOString();
  const expiresIso = new Date(nowMs2 + ttlSec * 1e3).toISOString();
  const code = generateCode();
  const hash = await hashCode(email, purpose, code, opts.pepper);
  await db.batch([
    {
      sql: "UPDATE email_codes SET consumed_at = ? WHERE email = ? AND purpose = ? AND consumed_at IS NULL",
      params: [nowIso2, email, purpose]
    },
    {
      sql: "INSERT INTO email_codes (id, email, purpose, code_hash, attempts, created_at, expires_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
      params: [
        "emc_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20),
        email,
        purpose,
        hash,
        nowIso2,
        expiresIso
      ]
    }
  ]);
  return { code, expiresAt: expiresIso };
}
__name(issueCode, "issueCode");
async function consumeCode(db, options) {
  const opts = options || {};
  const email = opts.email;
  const purpose = opts.purpose;
  const code = String(opts.code || "");
  const nowMs2 = opts.now === void 0 ? Date.now() : opts.now;
  const nowIso2 = new Date(nowMs2).toISOString();
  const row = await db.get(
    "SELECT * FROM email_codes WHERE email = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
    email,
    purpose,
    nowIso2
  );
  if (!row) return false;
  const attempts = Number(row.attempts || 0) + 1;
  if (attempts > MAX_ATTEMPTS) {
    await db.run("UPDATE email_codes SET attempts = ?, consumed_at = ? WHERE id = ?", attempts, nowIso2, row.id);
    return false;
  }
  await db.run("UPDATE email_codes SET attempts = ? WHERE id = ?", attempts, row.id);
  const actual = await hashCode(email, purpose, code, opts.pepper);
  if (!timingSafeEqualHex(actual, row.code_hash)) return false;
  await db.run("UPDATE email_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL", nowIso2, row.id);
  return true;
}
__name(consumeCode, "consumeCode");

// src/auth.js
var SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
var SLIDING_REFRESH_MS = 24 * 60 * 60 * 1e3;
var encoder3 = new TextEncoder();
function authConfig(env) {
  const secret = env && env.AUTH_JWT_SECRET;
  const issuer = env && env.AUTH_ISSUER || null;
  const audience = env && env.AUTH_AUDIENCE || null;
  return {
    configured: !!(secret && String(secret).length >= 16),
    secret: secret ? String(secret) : null,
    issuer,
    audience
  };
}
__name(authConfig, "authConfig");
async function verifyToken(token, cfg, now) {
  if (!cfg.configured) throw unavailable("auth_not_configured", "Sign-in is not configured on this server.");
  const claims = await verifyHs256(token, cfg.secret, now);
  if (cfg.issuer && claims.iss !== cfg.issuer) throw unauthorized("Token issued by an unexpected issuer.");
  if (cfg.audience) {
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (aud.indexOf(cfg.audience) < 0) throw unauthorized("Token is not addressed to this API.");
  }
  if (!claims.sub) throw unauthorized("Token carries no subject.");
  return claims;
}
__name(verifyToken, "verifyToken");
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", encoder3.encode(text));
  const bytes = new Uint8Array(digest);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}
__name(sha256Hex, "sha256Hex");
function nowMs(value) {
  return value === void 0 ? Date.now() : value;
}
__name(nowMs, "nowMs");
function iso(value) {
  return new Date(value).toISOString();
}
__name(iso, "iso");
async function provisionUser(db, options) {
  const opts = options || {};
  const id = "usr_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const provider = opts.provider || "password";
  const subject = opts.subject ? String(opts.subject) : id;
  const email = opts.email ? String(opts.email).trim().toLowerCase() : null;
  const at = iso(nowMs(opts.now));
  const name = typeof opts.name === "string" ? opts.name.slice(0, 80) : "";
  await db.batch([
    {
      sql: "INSERT INTO users (id, auth_provider, auth_subject, email, email_verified_at, password_hash, platform_role, created_at) VALUES (?, ?, ?, ?, ?, ?, 'athlete', ?)",
      params: [id, provider, subject, email, opts.emailVerified ? at : null, opts.passwordHash || null, at]
    },
    {
      sql: "INSERT INTO profiles (user_id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)",
      params: [id, name, at, at]
    },
    {
      sql: "INSERT INTO location_prefs (user_id, ghost_mode, audience, updated_at) VALUES (?, 1, 'friends', ?)",
      params: [id, at]
    },
    {
      sql: "INSERT INTO auth_identities (provider, subject, user_id, email, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)",
      params: [provider, subject, id, email, at, at]
    }
  ]);
  return { id, role: "athlete", email, emailVerified: !!opts.emailVerified, claims: null, sessionId: null };
}
__name(provisionUser, "provisionUser");
function userFromRow(row) {
  return {
    id: row.id,
    role: row.platform_role,
    email: row.email || null,
    emailVerified: !!row.email_verified_at,
    claims: null,
    sessionId: null
  };
}
__name(userFromRow, "userFromRow");
async function ensureUserForIdentity(db, identity, now) {
  const provider = identity.provider;
  const subject = String(identity.subject);
  const at = iso(nowMs(now));
  const existing = await db.get(
    "SELECT u.* FROM auth_identities i JOIN users u ON u.id = i.user_id WHERE i.provider = ? AND i.subject = ?",
    provider,
    subject
  );
  if (existing) {
    if (existing.deleted_at) throw unauthorized("This account was deleted.");
    await db.run(
      "UPDATE auth_identities SET last_used_at = ?, email = COALESCE(?, email) WHERE provider = ? AND subject = ?",
      at,
      identity.email || null,
      provider,
      subject
    );
    return userFromRow(existing);
  }
  if (identity.email) {
    const byEmail = await db.get(
      "SELECT * FROM users WHERE lower(email) = ? AND deleted_at IS NULL",
      identity.email
    );
    if (byEmail) {
      if (byEmail.password_hash && !byEmail.email_verified_at) {
        throw conflict("email_taken", "An account with this email already exists. Sign in with your password to link it.");
      }
      try {
        await db.run(
          "INSERT INTO auth_identities (provider, subject, user_id, email, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)",
          provider,
          subject,
          byEmail.id,
          identity.email,
          at,
          at
        );
      } catch (err) {
        const linked = await db.get(
          "SELECT u.* FROM auth_identities i JOIN users u ON u.id = i.user_id WHERE i.provider = ? AND i.subject = ?",
          provider,
          subject
        );
        if (!linked) throw err;
        return userFromRow(linked);
      }
      if (!byEmail.email_verified_at && identity.emailVerified) {
        await db.run("UPDATE users SET email_verified_at = ? WHERE id = ?", at, byEmail.id);
      }
      return userFromRow(byEmail);
    }
  }
  return await provisionUser(db, {
    provider,
    subject,
    email: identity.email,
    name: identity.name,
    emailVerified: identity.emailVerified,
    now
  });
}
__name(ensureUserForIdentity, "ensureUserForIdentity");
async function createSession(db, user, options) {
  const opts = options || {};
  const at = nowMs(opts.now);
  const id = "ses_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const secret = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const token = "lmt." + id + "." + secret;
  const tokenHash = await sha256Hex(id + "." + secret);
  const createdIso = iso(at);
  const expiresIso = iso(at + SESSION_TTL_MS);
  await db.run(
    "INSERT INTO sessions (id, user_id, token_hash, device_name, platform, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    user.id,
    tokenHash,
    String(opts.deviceName || "").slice(0, 80),
    String(opts.platform || "").slice(0, 20),
    createdIso,
    createdIso,
    expiresIso
  );
  return { token, sessionId: id, expiresAt: expiresIso };
}
__name(createSession, "createSession");
async function resolveSession(db, token, now) {
  const parts = String(token).split(".");
  if (parts.length !== 3 || parts[0] !== "lmt") throw unauthorized("Malformed token.");
  const id = parts[1];
  const secret = parts[2];
  const row = await db.get(
    "SELECT s.*, u.platform_role, u.email, u.email_verified_at, u.deleted_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?",
    id
  );
  if (!row) throw unauthorized("Session is not valid.");
  if (row.revoked_at) throw unauthorized("Session was signed out.");
  const expires = Date.parse(row.expires_at);
  if (!isFinite(expires) || now >= expires) throw unauthorized("Session expired.");
  const hash = await sha256Hex(id + "." + secret);
  if (!timingSafeEqualHex(hash, row.token_hash)) throw unauthorized("Session is not valid.");
  if (row.deleted_at) throw unauthorized("This account was deleted.");
  if (now - Date.parse(row.last_used_at) > SLIDING_REFRESH_MS) {
    await db.run(
      "UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE id = ?",
      iso(now),
      iso(now + SESSION_TTL_MS),
      id
    );
  }
  return {
    id: row.user_id,
    role: row.platform_role,
    email: row.email || null,
    emailVerified: !!row.email_verified_at,
    claims: null,
    sessionId: row.id
  };
}
__name(resolveSession, "resolveSession");
async function resolveUser(db, env, request, now) {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) throw unauthorized("Use an Authorization: Bearer <token> header.");
  const token = match[1];
  const at = nowMs(now);
  if (token.indexOf("lmt.") === 0) return await resolveSession(db, token, at);
  const cfg = authConfig(env);
  const claims = await verifyToken(token, cfg, at);
  const provider = claims.iss || cfg.issuer || "hs256";
  const existing = await db.get(
    "SELECT * FROM users WHERE auth_provider = ? AND auth_subject = ?",
    provider,
    String(claims.sub)
  );
  if (existing) {
    if (existing.deleted_at) throw unauthorized("This account was deleted.");
    return userFromRow(existing);
  }
  return await provisionUser(db, {
    provider,
    subject: String(claims.sub),
    email: claims.email,
    name: claims.name,
    emailVerified: false,
    now: at
  });
}
__name(resolveUser, "resolveUser");
async function revokeSession(db, sessionId, userId, now) {
  const result = await db.run(
    "UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
    iso(nowMs(now)),
    sessionId,
    userId
  );
  return result.changes > 0;
}
__name(revokeSession, "revokeSession");
async function revokeAllSessions(db, userId, now, exceptId) {
  const at = iso(nowMs(now));
  if (exceptId) {
    await db.run(
      "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id <> ? AND revoked_at IS NULL",
      at,
      userId,
      exceptId
    );
  } else {
    await db.run("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", at, userId);
  }
}
__name(revokeAllSessions, "revokeAllSessions");
async function listSessions(db, userId, now) {
  return await db.all(
    "SELECT id, device_name, platform, created_at, last_used_at, expires_at FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_used_at DESC",
    userId,
    iso(nowMs(now))
  );
}
__name(listSessions, "listSessions");
function requireUser(ctx) {
  if (!ctx.user) throw unauthorized();
  return ctx.user;
}
__name(requireUser, "requireUser");

// src/db.js
var MAX_BIND = 100;
function assertBindCount(sql, params) {
  if (params.length > MAX_BIND) {
    throw new Error("statement binds " + params.length + " parameters (limit " + MAX_BIND + "): " + sql.slice(0, 60));
  }
}
__name(assertBindCount, "assertBindCount");
function createD1Db(d1) {
  if (!d1) throw new Error("createD1Db: missing D1 binding");
  return {
    kind: "d1",
    async all(sql, ...params) {
      assertBindCount(sql, params);
      const res = await d1.prepare(sql).bind(...params).all();
      return res.results || [];
    },
    async get(sql, ...params) {
      assertBindCount(sql, params);
      const res = await d1.prepare(sql).bind(...params).first();
      return res || null;
    },
    async run(sql, ...params) {
      assertBindCount(sql, params);
      const res = await d1.prepare(sql).bind(...params).run();
      return { changes: res.meta ? res.meta.changes || 0 : 0 };
    },
    async exec(sql) {
      await d1.exec(sql);
    },
    async batch(statements) {
      const prepared = statements.map(function(s) {
        assertBindCount(s.sql, s.params || []);
        return d1.prepare(s.sql).bind(...s.params || []);
      });
      const out = await d1.batch(prepared);
      return out.map(function(r) {
        return { changes: r.meta ? r.meta.changes || 0 : 0, results: r.results || [] };
      });
    }
  };
}
__name(createD1Db, "createD1Db");
var d1Cache = /* @__PURE__ */ new WeakMap();
function dbFromEnv(env) {
  if (env && env.__db) return env.__db;
  if (env && env.DB) {
    let db = d1Cache.get(env.DB);
    if (!db) {
      db = createD1Db(env.DB);
      d1Cache.set(env.DB, db);
    }
    return db;
  }
  throw new Error("no database bound: expected env.DB (D1)");
}
__name(dbFromEnv, "dbFromEnv");

// src/schema-sql.js
var MIGRATIONS = [
  {
    version: 1,
    name: "0001_init",
    file: "0001_init.sql",
    sql: "-- LMTLSS server schema, migration 0001.\n--\n-- Target: Cloudflare D1 (SQLite) and, for local tests, node:sqlite.\n-- Both speak the same dialect, so the API is verified against real SQLite in\n-- `npm run test:server` and runs unchanged on D1.\n--\n-- Rules encoded here:\n--   * No table stores payment card data. Provider ids only.\n--   * Precise athlete coordinates live only in location_shares, only while the\n--     athlete has explicitly opted in, always with an expiry.\n--   * Anyone can read public communities/events; everything else is scoped by\n--     membership or ownership and re-checked server-side on every request.\n--   * Sports are an open vocabulary (TEXT), validated against the shared sport\n--     model, so adding a sport never needs a migration.\n\nCREATE TABLE users (\n  id            TEXT PRIMARY KEY,\n  auth_provider TEXT NOT NULL,\n  auth_subject  TEXT NOT NULL,\n  email         TEXT,\n  platform_role TEXT NOT NULL DEFAULT 'athlete' CHECK (platform_role IN ('athlete', 'moderator', 'admin')),\n  created_at    TEXT NOT NULL,\n  deleted_at    TEXT,\n  UNIQUE (auth_provider, auth_subject)\n);\n\n-- Athlete identity. Visibility is per element, defaulting to \"not shared\".\nCREATE TABLE profiles (\n  user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,\n  display_name     TEXT NOT NULL DEFAULT '',\n  bio              TEXT NOT NULL DEFAULT '',\n  city             TEXT NOT NULL DEFAULT '',\n  area_label       TEXT NOT NULL DEFAULT '',\n  experience       TEXT,\n  avatar_url       TEXT NOT NULL DEFAULT '',\n  public_workouts  INTEGER NOT NULL DEFAULT 0,  -- workouts default to private\n  show_communities INTEGER NOT NULL DEFAULT 0,\n  show_events      INTEGER NOT NULL DEFAULT 0,\n  created_at       TEXT NOT NULL,\n  updated_at       TEXT NOT NULL\n);\n\nCREATE TABLE athlete_sports (\n  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  sport      TEXT NOT NULL,\n  level      TEXT,\n  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'community', 'public')),\n  PRIMARY KEY (user_id, sport)\n);\n\n-- One training session of any sport. `metrics_json` holds the sport-specific\n-- vocabulary (rounds, sets, sets won, holes, score) validated against the sport\n-- model in shared/src/domain.ts \u2014 a run can never carry rounds.\nCREATE TABLE activities (\n  id           TEXT PRIMARY KEY,\n  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  sport        TEXT NOT NULL,\n  title        TEXT NOT NULL DEFAULT '',\n  started_at   TEXT NOT NULL,\n  duration_sec INTEGER,\n  distance_m   REAL,\n  metrics_json TEXT NOT NULL DEFAULT '{}',\n  provenance   TEXT NOT NULL DEFAULT 'manual' CHECK (provenance IN ('manual', 'device', 'imported', 'seeded')),\n  visibility   TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'friends', 'community', 'public')),\n  notes        TEXT NOT NULL DEFAULT '',\n  rpe          INTEGER,\n  created_at   TEXT NOT NULL\n);\nCREATE INDEX idx_activities_user_time ON activities(user_id, started_at DESC);\nCREATE INDEX idx_activities_public ON activities(visibility, started_at DESC);\n\nCREATE TABLE personal_records (\n  id         TEXT PRIMARY KEY,\n  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  sport      TEXT NOT NULL,\n  metric     TEXT NOT NULL,\n  value      REAL NOT NULL,\n  achieved_at TEXT NOT NULL,\n  activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,\n  UNIQUE (user_id, sport, metric)\n);\n\nCREATE TABLE goals (\n  id          TEXT PRIMARY KEY,\n  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  sport       TEXT NOT NULL,\n  metric      TEXT NOT NULL,\n  target      REAL NOT NULL,\n  due_date    TEXT,\n  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),\n  created_at  TEXT NOT NULL\n);\n\n-- ---------- Clubs ----------\n\nCREATE TABLE communities (\n  id           TEXT PRIMARY KEY,\n  slug         TEXT NOT NULL UNIQUE,\n  name         TEXT NOT NULL,\n  description  TEXT NOT NULL DEFAULT '',\n  sport        TEXT NOT NULL,\n  city         TEXT NOT NULL DEFAULT '',\n  area_label   TEXT NOT NULL DEFAULT '',\n  lat          REAL,\n  lon          REAL,\n  visibility   TEXT NOT NULL CHECK (visibility IN ('public', 'private')),\n  join_policy  TEXT NOT NULL CHECK (join_policy IN ('open', 'approval')),\n  avatar_url   TEXT NOT NULL DEFAULT '',\n  cover_url    TEXT NOT NULL DEFAULT '',\n  created_by   TEXT NOT NULL REFERENCES users(id),\n  created_at   TEXT NOT NULL,\n  archived_at  TEXT\n);\nCREATE INDEX idx_communities_discovery ON communities(visibility, archived_at, sport, city);\n\nCREATE TABLE community_members (\n  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,\n  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),\n  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'banned')),\n  joined_at    TEXT NOT NULL,\n  PRIMARY KEY (community_id, user_id)\n);\nCREATE INDEX idx_community_members_user ON community_members(user_id, status);\nCREATE INDEX idx_community_members_pending ON community_members(community_id, status);\n\nCREATE TABLE community_posts (\n  id           TEXT PRIMARY KEY,\n  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,\n  author_id    TEXT NOT NULL REFERENCES users(id),\n  kind         TEXT NOT NULL DEFAULT 'post' CHECK (kind IN ('post', 'announcement')),\n  body         TEXT NOT NULL,\n  created_at   TEXT NOT NULL,\n  edited_at    TEXT,\n  deleted_at   TEXT\n);\nCREATE INDEX idx_community_posts_feed ON community_posts(community_id, created_at DESC);\n\n-- ---------- Events ----------\n\nCREATE TABLE events (\n  id                    TEXT PRIMARY KEY,\n  community_id          TEXT REFERENCES communities(id) ON DELETE SET NULL,\n  organizer_id          TEXT NOT NULL REFERENCES users(id),\n  title                 TEXT NOT NULL,\n  sport                 TEXT NOT NULL,\n  description           TEXT NOT NULL DEFAULT '',\n  starts_at             TEXT NOT NULL,\n  ends_at               TEXT,\n  time_zone             TEXT NOT NULL,\n  venue_name            TEXT NOT NULL DEFAULT '',\n  venue_area            TEXT NOT NULL DEFAULT '',\n  area_lat              REAL,\n  area_lon              REAL,\n  capacity              INTEGER,\n  registration_deadline TEXT,\n  cost_minor            INTEGER NOT NULL DEFAULT 0,\n  currency              TEXT NOT NULL DEFAULT 'MXN',\n  visibility            TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'community', 'private')),\n  status                TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'cancelled')),\n  rules                 TEXT NOT NULL DEFAULT '',\n  cancellation_policy   TEXT NOT NULL DEFAULT '',\n  contact               TEXT NOT NULL DEFAULT '',\n  created_at            TEXT NOT NULL\n);\nCREATE INDEX idx_events_discovery ON events(status, visibility, starts_at);\nCREATE INDEX idx_events_community ON events(community_id, starts_at);\nCREATE INDEX idx_events_organizer ON events(organizer_id, starts_at DESC);\n\nCREATE TABLE event_registrations (\n  id         TEXT PRIMARY KEY,\n  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,\n  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  status     TEXT NOT NULL CHECK (status IN ('registered', 'waitlist', 'cancelled', 'checked_in')),\n  position   INTEGER,\n  created_at TEXT NOT NULL,\n  updated_at TEXT NOT NULL,\n  UNIQUE (event_id, user_id)\n);\nCREATE INDEX idx_event_registrations_event ON event_registrations(event_id, status, position);\n\n-- Group sessions are community-scoped events; this table only links them for\n-- the community feed so the event authority stays in one place.\nCREATE TABLE community_sessions (\n  id           TEXT PRIMARY KEY,\n  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,\n  event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,\n  created_at   TEXT NOT NULL,\n  UNIQUE (community_id, event_id)\n);\n\n-- ---------- Coaches ----------\n\nCREATE TABLE coaches (\n  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,\n  display_name TEXT NOT NULL,\n  headline     TEXT NOT NULL DEFAULT '',\n  bio          TEXT NOT NULL DEFAULT '',\n  city         TEXT NOT NULL DEFAULT '',\n  area_label   TEXT NOT NULL DEFAULT '',\n  remote       INTEGER NOT NULL DEFAULT 0,\n  in_person    INTEGER NOT NULL DEFAULT 1,\n  languages    TEXT NOT NULL DEFAULT '',\n  contact      TEXT NOT NULL DEFAULT '',\n  verified     INTEGER NOT NULL DEFAULT 0,\n  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'suspended')),\n  created_at   TEXT NOT NULL,\n  updated_at   TEXT NOT NULL\n);\nCREATE INDEX idx_coaches_public ON coaches(status, city);\n\nCREATE TABLE coach_specialties (\n  coach_id TEXT NOT NULL REFERENCES coaches(user_id) ON DELETE CASCADE,\n  sport    TEXT NOT NULL,\n  PRIMARY KEY (coach_id, sport)\n);\n\nCREATE TABLE coach_qualifications (\n  id       TEXT PRIMARY KEY,\n  coach_id TEXT NOT NULL REFERENCES coaches(user_id) ON DELETE CASCADE,\n  title    TEXT NOT NULL,\n  issuer   TEXT NOT NULL DEFAULT '',\n  year     INTEGER,\n  url      TEXT NOT NULL DEFAULT '',\n  verified INTEGER NOT NULL DEFAULT 0\n);\n\nCREATE TABLE coach_classes (\n  id           TEXT PRIMARY KEY,\n  coach_id     TEXT NOT NULL REFERENCES coaches(user_id) ON DELETE CASCADE,\n  sport        TEXT NOT NULL,\n  title        TEXT NOT NULL,\n  description  TEXT NOT NULL DEFAULT '',\n  starts_at    TEXT NOT NULL,\n  duration_min INTEGER,\n  capacity     INTEGER,\n  price_minor  INTEGER NOT NULL DEFAULT 0,\n  currency     TEXT NOT NULL DEFAULT 'MXN',\n  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'cancelled')),\n  created_at   TEXT NOT NULL\n);\nCREATE INDEX idx_coach_classes_public ON coach_classes(status, starts_at);\n\n-- Subscription state is written only by verified provider webhooks.\nCREATE TABLE subscriptions (\n  id                       TEXT PRIMARY KEY,\n  user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  product                  TEXT NOT NULL CHECK (product IN ('coach')),\n  provider                 TEXT NOT NULL,\n  provider_customer_id     TEXT,\n  provider_subscription_id TEXT UNIQUE,\n  status                   TEXT NOT NULL CHECK (status IN ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'expired')),\n  price_minor              INTEGER NOT NULL,\n  currency                 TEXT NOT NULL,\n  current_period_end       TEXT,\n  created_at               TEXT NOT NULL,\n  updated_at               TEXT NOT NULL\n);\nCREATE INDEX idx_subscriptions_user ON subscriptions(user_id, status);\n\n-- Webhook idempotency: one row per provider event, processed once.\nCREATE TABLE webhook_events (\n  id                TEXT PRIMARY KEY,\n  provider          TEXT NOT NULL,\n  provider_event_id TEXT NOT NULL,\n  kind              TEXT NOT NULL DEFAULT '',\n  received_at       TEXT NOT NULL,\n  processed_at      TEXT,\n  error             TEXT,\n  UNIQUE (provider, provider_event_id)\n);\n\n-- ---------- Store ----------\n\nCREATE TABLE products (\n  id          TEXT PRIMARY KEY,\n  slug        TEXT NOT NULL UNIQUE,\n  title       TEXT NOT NULL,\n  description TEXT NOT NULL DEFAULT '',\n  category    TEXT NOT NULL,\n  sport       TEXT,\n  currency    TEXT NOT NULL DEFAULT 'MXN',\n  price_minor INTEGER NOT NULL,\n  image_url   TEXT NOT NULL DEFAULT '',\n  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),\n  created_at  TEXT NOT NULL\n);\nCREATE INDEX idx_products_catalog ON products(status, category, sport);\n\nCREATE TABLE product_variants (\n  id              TEXT PRIMARY KEY,\n  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,\n  sku             TEXT NOT NULL UNIQUE,\n  title           TEXT NOT NULL,\n  price_minor     INTEGER,\n  inventory_count INTEGER,\n  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))\n);\nCREATE INDEX idx_product_variants_product ON product_variants(product_id, status);\n\nCREATE TABLE carts (\n  id         TEXT PRIMARY KEY,\n  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  updated_at TEXT NOT NULL,\n  UNIQUE (user_id)\n);\n\nCREATE TABLE cart_items (\n  cart_id    TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,\n  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,\n  quantity   INTEGER NOT NULL CHECK (quantity > 0),\n  added_at   TEXT NOT NULL,\n  PRIMARY KEY (cart_id, variant_id)\n);\n\n-- Totals are recomputed server-side from product_variants; the client never\n-- supplies a price.\nCREATE TABLE orders (\n  id                  TEXT PRIMARY KEY,\n  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),\n  currency            TEXT NOT NULL,\n  subtotal_minor      INTEGER NOT NULL,\n  total_minor         INTEGER NOT NULL,\n  provider            TEXT,\n  provider_payment_id TEXT,\n  shipping_name       TEXT NOT NULL DEFAULT '',\n  shipping_address    TEXT NOT NULL DEFAULT '',\n  created_at          TEXT NOT NULL,\n  updated_at          TEXT NOT NULL\n);\nCREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);\n\nCREATE TABLE order_items (\n  id               TEXT PRIMARY KEY,\n  order_id         TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,\n  variant_id       TEXT REFERENCES product_variants(id) ON DELETE SET NULL,\n  title            TEXT NOT NULL,\n  unit_price_minor INTEGER NOT NULL,\n  quantity         INTEGER NOT NULL,\n  line_total_minor INTEGER NOT NULL\n);\n\n-- ---------- Map: facilities and opt-in presence ----------\n\nCREATE TABLE facilities (\n  id         TEXT PRIMARY KEY,\n  name       TEXT NOT NULL,\n  sport      TEXT NOT NULL,\n  kind       TEXT NOT NULL DEFAULT 'other',\n  city       TEXT NOT NULL DEFAULT '',\n  area_label TEXT NOT NULL DEFAULT '',\n  lat        REAL NOT NULL,\n  lon        REAL NOT NULL,\n  source     TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'official')),\n  verified   INTEGER NOT NULL DEFAULT 0,\n  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,\n  created_at TEXT NOT NULL\n);\nCREATE INDEX idx_facilities_area ON facilities(sport, city);\n\nCREATE TABLE location_prefs (\n  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,\n  ghost_mode    INTEGER NOT NULL DEFAULT 1,  -- sharing OFF until explicitly turned on\n  audience      TEXT NOT NULL DEFAULT 'friends' CHECK (audience IN ('friends', 'community', 'public')),\n  updated_at    TEXT NOT NULL\n);\n\n-- Only ever written on explicit opt-in, always with an expiry \u2264 4 h.\n-- Hotspot aggregation reads this with a minimum-group threshold and grid\n-- coarsening, so no single athlete is ever plotted for the public.\nCREATE TABLE location_shares (\n  id         TEXT PRIMARY KEY,\n  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  lat        REAL NOT NULL,\n  lon        REAL NOT NULL,\n  accuracy_m REAL,\n  audience   TEXT NOT NULL CHECK (audience IN ('friends', 'community', 'public')),\n  started_at TEXT NOT NULL,\n  expires_at TEXT NOT NULL\n);\nCREATE INDEX idx_location_shares_live ON location_shares(expires_at);\n\n-- ---------- Moderation, reports, notifications ----------\n\nCREATE TABLE reports (\n  id          TEXT PRIMARY KEY,\n  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  target_type TEXT NOT NULL CHECK (target_type IN ('community', 'post', 'user', 'event')),\n  target_id   TEXT NOT NULL,\n  reason      TEXT NOT NULL,\n  details     TEXT NOT NULL DEFAULT '',\n  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),\n  created_at  TEXT NOT NULL,\n  reviewed_at TEXT,\n  reviewer_id TEXT REFERENCES users(id)\n);\nCREATE INDEX idx_reports_queue ON reports(status, created_at);\n\nCREATE TABLE moderation_actions (\n  id          TEXT PRIMARY KEY,\n  actor_id    TEXT NOT NULL REFERENCES users(id),\n  action      TEXT NOT NULL,\n  target_type TEXT NOT NULL,\n  target_id   TEXT NOT NULL,\n  reason      TEXT NOT NULL DEFAULT '',\n  created_at  TEXT NOT NULL\n);\n\nCREATE TABLE notifications (\n  id         TEXT PRIMARY KEY,\n  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  kind       TEXT NOT NULL,\n  title      TEXT NOT NULL,\n  body       TEXT NOT NULL DEFAULT '',\n  data_json  TEXT NOT NULL DEFAULT '{}',\n  created_at TEXT NOT NULL,\n  read_at    TEXT\n);\nCREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);\n\n-- ---------- Abuse control ----------\n\nCREATE TABLE rate_counters (\n  bucket_key   TEXT NOT NULL,\n  window_start INTEGER NOT NULL,\n  count        INTEGER NOT NULL,\n  PRIMARY KEY (bucket_key, window_start)\n);\n"
  },
  {
    version: 2,
    name: "0002_auth",
    file: "0002_auth.sql",
    sql: "-- LMTLSS server schema, migration 0002: accounts and sessions.\n--\n-- One person can sign in with a password, Google, or Apple. auth_identities is\n-- the link between a provider subject and one LMTLSS user, so attaching a\n-- second provider never creates a second account.\n--\n-- Sessions are opaque random tokens. Only the SHA-256 of the token is stored,\n-- so a database read cannot be replayed as a login. Email codes are stored the\n-- same way: the six digits are never written in plaintext.\n\nALTER TABLE users ADD COLUMN email_verified_at TEXT;\nALTER TABLE users ADD COLUMN password_hash TEXT;\n\nCREATE UNIQUE INDEX idx_users_email_unique ON users(lower(email)) WHERE email IS NOT NULL AND email <> '';\n\nCREATE TABLE auth_identities (\n  provider     TEXT NOT NULL,\n  subject      TEXT NOT NULL,\n  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  email        TEXT,\n  created_at   TEXT NOT NULL,\n  last_used_at TEXT,\n  PRIMARY KEY (provider, subject)\n);\nCREATE INDEX idx_auth_identities_user ON auth_identities(user_id);\n\nCREATE TABLE sessions (\n  id           TEXT PRIMARY KEY,\n  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  token_hash   TEXT NOT NULL,\n  device_name  TEXT NOT NULL DEFAULT '',\n  platform     TEXT NOT NULL DEFAULT '',\n  created_at   TEXT NOT NULL,\n  last_used_at TEXT NOT NULL,\n  expires_at   TEXT NOT NULL,\n  revoked_at   TEXT\n);\nCREATE INDEX idx_sessions_user ON sessions(user_id, revoked_at, expires_at);\n\nCREATE TABLE email_codes (\n  id          TEXT PRIMARY KEY,\n  email       TEXT NOT NULL,\n  purpose     TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),\n  code_hash   TEXT NOT NULL,\n  attempts    INTEGER NOT NULL DEFAULT 0,\n  created_at  TEXT NOT NULL,\n  expires_at  TEXT NOT NULL,\n  consumed_at TEXT\n);\nCREATE INDEX idx_email_codes_lookup ON email_codes(email, purpose, consumed_at, created_at DESC);\n\nCREATE TABLE consents (\n  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  kind        TEXT NOT NULL,\n  version     TEXT NOT NULL,\n  accepted_at TEXT NOT NULL,\n  PRIMARY KEY (user_id, kind)\n);\n"
  }
];

// src/migrate.js
async function loadMigrationSql(migration) {
  if (!migration || typeof migration.sql !== "string") {
    throw new Error("migration has no inlined SQL: " + (migration && migration.name));
  }
  return migration.sql;
}
__name(loadMigrationSql, "loadMigrationSql");
async function ensureSchema(db, options) {
  const opts = options || {};
  await db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)"
  );
  const rows = await db.all("SELECT version FROM schema_migrations");
  const applied = new Set(rows.map(function(r) {
    return r.version;
  }));
  const done = [];
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    const sql = await loadMigrationSql(m);
    const statements = splitStatements(sql);
    await db.batch(statements.map(function(s) {
      return { sql: s, params: [] };
    }));
    await db.run(
      "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
      m.version,
      m.name,
      opts.now ? opts.now() : (/* @__PURE__ */ new Date()).toISOString()
    );
    done.push(m.name);
  }
  return done;
}
__name(ensureSchema, "ensureSchema");
function splitStatements(sql) {
  const withoutComments = sql.split("\n").map(function(line) {
    return line.replace(/--.*$/, "");
  }).join("\n");
  return withoutComments.split(";").map(function(chunk) {
    return chunk.trim();
  }).filter(function(chunk) {
    return chunk.length > 0;
  });
}
__name(splitStatements, "splitStatements");

// src/access.js
async function getCommunity(db, id) {
  const row = await db.get(
    "SELECT * FROM communities WHERE id = ? OR slug = ?",
    id,
    id
  );
  if (!row || row.archived_at) throw notFound("Community");
  return row;
}
__name(getCommunity, "getCommunity");
async function getMembership(db, communityId, userId) {
  if (!userId) return null;
  return await db.get(
    "SELECT * FROM community_members WHERE community_id = ? AND user_id = ?",
    communityId,
    userId
  );
}
__name(getMembership, "getMembership");
function isAdminRole(role) {
  return role === "owner" || role === "admin";
}
__name(isAdminRole, "isAdminRole");
async function requireActiveMember(db, communityId, user) {
  if (!user) throw forbidden("Join this community to see its content.");
  const m = await getMembership(db, communityId, user.id);
  if (!m || m.status !== "active") throw forbidden("Join this community to see its content.");
  return m;
}
__name(requireActiveMember, "requireActiveMember");
async function requireCommunityAdmin(db, communityId, user) {
  const m = await requireActiveMember(db, communityId, user);
  if (!isAdminRole(m.role)) throw forbidden("Only community admins can do that.");
  return m;
}
__name(requireCommunityAdmin, "requireCommunityAdmin");
async function canReadCommunityContent(db, community, userId) {
  if (community.visibility === "public" && community.join_policy === "open") {
    return true;
  }
  if (!userId) return false;
  const m = await getMembership(db, community.id, userId);
  return !!m && m.status === "active";
}
__name(canReadCommunityContent, "canReadCommunityContent");
function requireAnnouncementRights(membership) {
  if (!membership || !isAdminRole(membership.role)) {
    throw forbidden("Only community admins can post announcements.");
  }
}
__name(requireAnnouncementRights, "requireAnnouncementRights");
async function requireEventOrganizer(db, event, user) {
  if (!user) throw forbidden("Only the organizer can manage this event.");
  if (event.organizer_id === user.id) return true;
  if (event.community_id) {
    const m = await getMembership(db, event.community_id, user.id);
    if (m && m.status === "active" && isAdminRole(m.role)) return true;
  }
  throw forbidden("Only the organizer can manage this event.");
}
__name(requireEventOrganizer, "requireEventOrganizer");
async function notify(db, userId, kind, title, body, data, now) {
  if (!userId) return;
  await db.run(
    "INSERT INTO notifications (id, user_id, kind, title, body, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    "ntf_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20),
    userId,
    kind,
    title,
    body || "",
    JSON.stringify(data || {}),
    now
  );
}
__name(notify, "notify");

// src/rate.js
async function rateLimit(db, options) {
  const key = options.key;
  const windowSec = options.windowSec || 3600;
  const limit = options.limit;
  const now = options.now === void 0 ? Date.now() : options.now;
  if (typeof key !== "string" || !key) throw new Error("rateLimit: key is required");
  if (!limit || limit < 1) throw new Error("rateLimit: limit must be >= 1");
  const windowStart = Math.floor(now / (windowSec * 1e3)) * windowSec;
  const row = await db.get(
    "INSERT INTO rate_counters (bucket_key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(bucket_key, window_start) DO UPDATE SET count = count + 1 RETURNING count",
    key,
    windowStart
  );
  const used = row ? Number(row.count) : 1;
  if (used > limit) {
    throw tooMany("Too many " + (options.action || "requests") + " \u2014 limit is " + limit + " per " + Math.round(windowSec / 60) + " minutes.");
  }
  await db.run("DELETE FROM rate_counters WHERE window_start < ?", windowStart - 86400);
  return { used, remaining: Math.max(limit - used, 0) };
}
__name(rateLimit, "rateLimit");
function userKey(ctx, action) {
  const who = ctx.user ? ctx.user.id : "ip:" + (ctx.clientIp || "unknown");
  return action + ":" + who;
}
__name(userKey, "userKey");

// src/routes/communities.js
function communityView(row, extra) {
  return Object.assign({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sport: row.sport,
    city: row.city,
    areaLabel: row.area_label,
    lat: row.lat,
    lon: row.lon,
    visibility: row.visibility,
    joinPolicy: row.join_policy,
    avatarUrl: row.avatar_url,
    coverUrl: row.cover_url,
    createdAt: row.created_at
  }, extra || {});
}
__name(communityView, "communityView");
function memberView(row) {
  return {
    userId: row.user_id,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    displayName: row.display_name || "",
    city: row.city || ""
  };
}
__name(memberView, "memberView");
async function memberCount(db, communityId) {
  const row = await db.get(
    "SELECT COUNT(*) AS n FROM community_members WHERE community_id = ? AND status = 'active'",
    communityId
  );
  return row ? Number(row.n) : 0;
}
__name(memberCount, "memberCount");
async function slugTaken(db, slug) {
  const row = await db.get("SELECT id FROM communities WHERE slug = ?", slug);
  return !!row;
}
__name(slugTaken, "slugTaken");
var routes = [
  {
    method: "GET",
    path: "/api/communities",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const q = ctx.query;
      const page = pageParams(q, { defaultLimit: 20, maxLimit: 50 });
      const where = ["archived_at IS NULL", "visibility = 'public'"];
      const args = [];
      const sport = str({ sport: q.get("sport") }, "sport", { max: 40 });
      const city = str({ city: q.get("city") }, "city", { max: 80 });
      const text = str({ q: q.get("q") }, "q", { max: 60 });
      if (sport) {
        where.push("sport = ?");
        args.push(sport);
      }
      if (city) {
        where.push("city = ?");
        args.push(city);
      }
      if (text) {
        where.push("(name LIKE ? OR description LIKE ?)");
        args.push("%" + text + "%", "%" + text + "%");
      }
      const rows = await ctx.db.all(
        "SELECT * FROM communities WHERE " + where.join(" AND ") + " ORDER BY created_at DESC LIMIT ? OFFSET ?",
        ...args.concat([page.limit + 1, page.offset])
      );
      const hasMore = rows.length > page.limit;
      const pageRows = rows.slice(0, page.limit);
      const items = [];
      for (const row of pageRows) {
        items.push(communityView(row, {
          memberCount: await memberCount(ctx.db, row.id),
          membership: await membershipState(ctx.db, row.id, ctx.user)
        }));
      }
      return json({ items, limit: page.limit, offset: page.offset, hasMore });
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/communities",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const user = ctx.user;
      await rateLimit(ctx.db, {
        key: userKey(ctx, "community.create"),
        limit: 3,
        windowSec: 86400,
        now: ctx.nowMs,
        action: "community creations"
      });
      const body = ctx.body;
      const name = cleanText(str(body, "name", { required: true, min: 3, max: 60 }), 60);
      const sport = cleanText(str(body, "sport", { required: true, max: 40 }), 40);
      const description = cleanText(str(body, "description", { max: 600 }) || "", 600);
      const city = cleanText(str(body, "city", { max: 80 }) || "", 80);
      const areaLabel = cleanText(str(body, "areaLabel", { max: 120 }) || "", 120);
      const visibility = str(body, "visibility", { oneOf: ["public", "private"], default: "public" });
      const joinPolicy = str(body, "joinPolicy", { oneOf: ["open", "approval"], default: "open" });
      if (visibility === "private" && joinPolicy === "open") {
        throw badRequest("invalid_joinPolicy", "A private community must use an approval join policy.");
      }
      const base = ctx.slugify(name);
      let slug = base;
      for (let i = 2; await slugTaken(ctx.db, slug); i++) {
        slug = base + "-" + i;
        if (i > 50) {
          slug = base + "-" + ctx.newId("x").slice(-4);
          break;
        }
      }
      const id = ctx.newId("com");
      const at = ctx.nowIso();
      await ctx.db.batch([
        {
          sql: "INSERT INTO communities (id, slug, name, description, sport, city, area_label, lat, lon, visibility, join_policy, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          params: [id, slug, name, description, sport, city, areaLabel, null, null, visibility, joinPolicy, user.id, at]
        },
        {
          // The creator is the owner and an active member from the first moment.
          sql: "INSERT INTO community_members (community_id, user_id, role, status, joined_at) VALUES (?, ?, 'owner', 'active', ?)",
          params: [id, user.id, at]
        }
      ]);
      const row = await getCommunity(ctx.db, id);
      return json(communityView(row, { memberCount: 1, membership: { status: "active", role: "owner" } }), 201);
    }, "handler")
  },
  {
    method: "GET",
    path: "/api/communities/:id",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      const membership = await getMembership(ctx.db, row.id, ctx.user && ctx.user.id);
      if (row.visibility !== "public") {
        if (!membership || membership.status !== "active" && membership.status !== "pending") {
          throw notFound("Community");
        }
      }
      const canRead = await canReadCommunityContent(ctx.db, row, ctx.user && ctx.user.id);
      return json(communityView(row, {
        memberCount: await memberCount(ctx.db, row.id),
        membership: membership ? { status: membership.status, role: membership.role } : null,
        canReadFeed: canRead,
        canPost: !!membership && membership.status === "active",
        canModerate: !!membership && membership.status === "active" && isAdminRole(membership.role)
      }));
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/communities/:id/join",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      const existing = await getMembership(ctx.db, row.id, ctx.user.id);
      if (existing && existing.status === "banned") throw forbidden("You cannot join this community.");
      if (existing && existing.status === "active") {
        return json({ status: "active", role: existing.role, changed: false });
      }
      if (existing && existing.status === "pending") {
        return json({ status: "pending", role: existing.role, changed: false });
      }
      await rateLimit(ctx.db, {
        key: userKey(ctx, "community.join"),
        limit: 30,
        windowSec: 3600,
        now: ctx.nowMs,
        action: "join requests"
      });
      const needsApproval = row.join_policy === "approval";
      const status = needsApproval ? "pending" : "active";
      await ctx.db.run(
        "INSERT INTO community_members (community_id, user_id, role, status, joined_at) VALUES (?, ?, 'member', ?, ?) ON CONFLICT(community_id, user_id) DO UPDATE SET status = excluded.status",
        row.id,
        ctx.user.id,
        status,
        ctx.nowIso()
      );
      if (needsApproval) {
        await notifyAdminTeam(ctx, row, ctx.user, "join_request");
      }
      return json({ status, role: "member", changed: true });
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/communities/:id/leave",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      const existing = await getMembership(ctx.db, row.id, ctx.user.id);
      if (!existing) return json({ status: "none", changed: false });
      if (existing.role === "owner") {
        const others = await ctx.db.get(
          "SELECT COUNT(*) AS n FROM community_members WHERE community_id = ? AND role = 'owner' AND status = 'active'",
          row.id
        );
        if (others && Number(others.n) <= 1) {
          throw conflict("last_owner", "Transfer ownership before leaving \u2014 a community cannot be left without an owner.");
        }
      }
      await ctx.db.run("DELETE FROM community_members WHERE community_id = ? AND user_id = ?", row.id, ctx.user.id);
      return json({ status: "left", changed: true });
    }, "handler")
  },
  {
    method: "GET",
    path: "/api/communities/:id/members",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      await requireActiveMember(ctx.db, row.id, ctx.user);
      const page = pageParams(ctx.query, { defaultLimit: 50, maxLimit: 100 });
      const status = str({ status: ctx.query.get("status") }, "status", { oneOf: ["active", "pending"], default: "active" });
      const rows = await ctx.db.all(
        "SELECT m.*, p.display_name, p.city FROM community_members m LEFT JOIN profiles p ON p.user_id = m.user_id WHERE m.community_id = ? AND m.status = ? ORDER BY m.joined_at LIMIT ? OFFSET ?",
        row.id,
        status,
        page.limit,
        page.offset
      );
      return json({ items: rows.map(memberView), limit: page.limit, offset: page.offset });
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/communities/:id/members/:userId/approve",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      await requireCommunityAdmin(ctx.db, row.id, ctx.user);
      const target = await getMembership(ctx.db, row.id, ctx.params.userId);
      if (!target) throw notFound("Join request");
      await ctx.db.run(
        "UPDATE community_members SET status = 'active' WHERE community_id = ? AND user_id = ?",
        row.id,
        ctx.params.userId
      );
      await writeModeration(ctx, "membership.approve", "user", ctx.params.userId, "approved join request", row.id);
      await notify(
        ctx.db,
        ctx.params.userId,
        "community.join.approved",
        "Your request to join " + row.name + " was approved.",
        "",
        { communityId: row.id },
        ctx.nowIso()
      );
      return json({ status: "active" });
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/communities/:id/members/:userId/role",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      const me = await requireCommunityAdmin(ctx.db, row.id, ctx.user);
      if (me.role !== "owner") throw forbidden("Only the owner can change admin roles.");
      const role = str(ctx.body, "role", { required: true, oneOf: ["admin", "member"] });
      const target = await getMembership(ctx.db, row.id, ctx.params.userId);
      if (!target) throw notFound("Member");
      if (target.role === "owner") throw forbidden("The owner's role cannot be changed.");
      await ctx.db.run(
        "UPDATE community_members SET role = ? WHERE community_id = ? AND user_id = ?",
        role,
        row.id,
        ctx.params.userId
      );
      return json({ userId: ctx.params.userId, role });
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/communities/:id/members/:userId/ban",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      const me = await requireCommunityAdmin(ctx.db, row.id, ctx.user);
      const target = await getMembership(ctx.db, row.id, ctx.params.userId);
      if (!target) throw notFound("Member");
      if (target.role === "owner") throw forbidden("The owner cannot be banned.");
      if (target.role === "admin" && me.role !== "owner") throw forbidden("Only the owner can ban an admin.");
      const reason = cleanText(str(ctx.body, "reason", { max: 300 }) || "", 300);
      await ctx.db.run(
        "UPDATE community_members SET status = 'banned' WHERE community_id = ? AND user_id = ?",
        row.id,
        ctx.params.userId
      );
      await writeModeration(ctx, "membership.ban", "user", ctx.params.userId, reason, row.id);
      return json({ userId: ctx.params.userId, status: "banned" });
    }, "handler")
  },
  {
    method: "GET",
    path: "/api/communities/:id/posts",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      const allowed = await canReadCommunityContent(ctx.db, row, ctx.user && ctx.user.id);
      if (!allowed) throw forbidden("Join this community to read its feed.");
      const page = pageParams(ctx.query, { defaultLimit: 20, maxLimit: 50 });
      const rows = await ctx.db.all(
        "SELECT p.*, pr.display_name FROM community_posts p LEFT JOIN profiles pr ON pr.user_id = p.author_id WHERE p.community_id = ? AND p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT ? OFFSET ?",
        row.id,
        page.limit,
        page.offset
      );
      return json({
        items: rows.map(function(r) {
          return {
            id: r.id,
            kind: r.kind,
            body: r.body,
            authorId: r.author_id,
            authorName: r.display_name || "",
            createdAt: r.created_at,
            editedAt: r.edited_at
          };
        }),
        limit: page.limit,
        offset: page.offset
      });
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/communities/:id/posts",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      const membership = await requireActiveMember(ctx.db, row.id, ctx.user);
      const kind = str(ctx.body, "kind", { oneOf: ["post", "announcement"], default: "post" });
      if (kind === "announcement") requireAnnouncementRights(membership);
      const body = cleanText(str(ctx.body, "body", { required: true, min: 1, max: 4e3 }), 4e3);
      await rateLimit(ctx.db, {
        key: userKey(ctx, "community.post"),
        limit: 20,
        windowSec: 3600,
        now: ctx.nowMs,
        action: "posts"
      });
      const id = ctx.newId("pst");
      const at = ctx.nowIso();
      await ctx.db.run(
        "INSERT INTO community_posts (id, community_id, author_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        id,
        row.id,
        ctx.user.id,
        kind,
        body,
        at
      );
      return json({ id, kind, body, authorId: ctx.user.id, createdAt: at }, 201);
    }, "handler")
  },
  {
    method: "DELETE",
    path: "/api/posts/:postId",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const post = await ctx.db.get("SELECT * FROM community_posts WHERE id = ?", ctx.params.postId);
      if (!post || post.deleted_at) throw notFound("Post");
      const membership = await getMembership(ctx.db, post.community_id, ctx.user.id);
      const isAuthor = post.author_id === ctx.user.id;
      const isModerator = !!membership && membership.status === "active" && isAdminRole(membership.role);
      if (!isAuthor && !isModerator) throw forbidden("Only the author or a community admin can delete a post.");
      await ctx.db.run(
        "UPDATE community_posts SET deleted_at = ? WHERE id = ?",
        ctx.nowIso(),
        post.id
      );
      if (!isAuthor) await writeModeration(ctx, "post.delete", "post", post.id, "moderator removal", post.community_id);
      return json({ id: post.id, deleted: true });
    }, "handler")
  },
  {
    method: "GET",
    path: "/api/me/communities",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const rows = await ctx.db.all(
        "SELECT c.*, m.role, m.status FROM community_members m JOIN communities c ON c.id = m.community_id WHERE m.user_id = ? AND c.archived_at IS NULL ORDER BY m.joined_at DESC LIMIT 100",
        ctx.user.id
      );
      const items = [];
      for (const row of rows) {
        items.push(communityView(row, {
          memberCount: await memberCount(ctx.db, row.id),
          membership: { status: row.status, role: row.role }
        }));
      }
      return json({ items });
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/reports",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      await rateLimit(ctx.db, {
        key: userKey(ctx, "report"),
        limit: 10,
        windowSec: 3600,
        now: ctx.nowMs,
        action: "reports"
      });
      const targetType = str(ctx.body, "targetType", { required: true, oneOf: ["community", "post", "user", "event"] });
      const targetId = cleanText(str(ctx.body, "targetId", { required: true, max: 80 }), 80);
      const reason = cleanText(str(ctx.body, "reason", { required: true, max: 60 }), 60);
      const details = cleanText(str(ctx.body, "details", { max: 1e3 }) || "", 1e3);
      const id = ctx.newId("rpt");
      await ctx.db.run(
        "INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)",
        id,
        ctx.user.id,
        targetType,
        targetId,
        reason,
        details,
        ctx.nowIso()
      );
      return json({ id, status: "open" }, 201);
    }, "handler")
  }
];
async function membershipState(db, communityId, user) {
  if (!user) return null;
  const m = await getMembership(db, communityId, user.id);
  return m ? { status: m.status, role: m.role } : null;
}
__name(membershipState, "membershipState");
async function notifyAdminTeam(ctx, community, requester, kind) {
  const admins = await ctx.db.all(
    "SELECT user_id FROM community_members WHERE community_id = ? AND status = 'active' AND role IN ('owner', 'admin')",
    community.id
  );
  for (const admin of admins) {
    await notify(
      ctx.db,
      admin.user_id,
      "community." + kind,
      "New join request in " + community.name,
      "",
      { communityId: community.id, userId: requester.id },
      ctx.nowIso()
    );
  }
}
__name(notifyAdminTeam, "notifyAdminTeam");
async function writeModeration(ctx, action, targetType, targetId, reason, communityId) {
  await ctx.db.run(
    "INSERT INTO moderation_actions (id, actor_id, action, target_type, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ctx.newId("mod"),
    ctx.user.id,
    action,
    targetType,
    targetId,
    (reason || "") + (communityId ? " [" + communityId + "]" : ""),
    ctx.nowIso()
  );
}
__name(writeModeration, "writeModeration");
var communities_default = { routes };

// src/routes/events.js
var LIVE_STATUSES = ["registered", "checked_in"];
function eventView(row, extra) {
  return Object.assign({
    id: row.id,
    communityId: row.community_id,
    organizerId: row.organizer_id,
    title: row.title,
    sport: row.sport,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timeZone: row.time_zone,
    venueName: row.venue_name,
    venueArea: row.venue_area,
    lat: row.area_lat,
    lon: row.area_lon,
    capacity: row.capacity,
    registrationDeadline: row.registration_deadline,
    costMinor: row.cost_minor,
    currency: row.currency,
    visibility: row.visibility,
    status: row.status,
    rules: row.rules,
    cancellationPolicy: row.cancellation_policy,
    contact: row.contact,
    createdAt: row.created_at
  }, extra || {});
}
__name(eventView, "eventView");
async function seatCounts(db, eventId) {
  const rows = await db.all(
    "SELECT status, COUNT(*) AS n FROM event_registrations WHERE event_id = ? GROUP BY status",
    eventId
  );
  const counts = { registered: 0, waitlist: 0, cancelled: 0, checked_in: 0 };
  rows.forEach(function(r) {
    counts[r.status] = Number(r.n);
  });
  counts.seatsTaken = counts.registered + counts.checked_in;
  return counts;
}
__name(seatCounts, "seatCounts");
async function myRegistration(db, eventId, userId) {
  if (!userId) return null;
  const row = await db.get(
    "SELECT status, position, created_at FROM event_registrations WHERE event_id = ? AND user_id = ?",
    eventId,
    userId
  );
  return row || null;
}
__name(myRegistration, "myRegistration");
async function visibleEvent(db, id, user) {
  const row = await db.get("SELECT * FROM events WHERE id = ?", id);
  if (!row) throw notFound("Event");
  if (row.visibility === "public" && row.status !== "draft") return row;
  if (user) {
    if (row.organizer_id === user.id) return row;
    if (row.community_id) {
      const m = await getMembership(db, row.community_id, user.id);
      if (m && m.status === "active") return row;
    }
  }
  throw notFound("Event");
}
__name(visibleEvent, "visibleEvent");
var routes2 = [
  {
    method: "GET",
    path: "/api/events",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const page = pageParams(ctx.query, { defaultLimit: 20, maxLimit: 50 });
      const where = ["status = 'published'"];
      const args = [];
      const scope = str({ scope: ctx.query.get("scope") }, "scope", { oneOf: ["public", "community"], default: "public" });
      if (scope === "community") {
        if (!ctx.user) return json({ items: [], limit: page.limit, offset: page.offset, hasMore: false });
        where.push("community_id IN (SELECT community_id FROM community_members WHERE user_id = ? AND status = 'active')");
        args.push(ctx.user.id);
      } else {
        where.push("visibility = 'public'");
      }
      const sport = cleanText(ctx.query.get("sport") || "", 40);
      const city = cleanText(ctx.query.get("city") || "", 80);
      const from = instant({ from: ctx.query.get("from") }, "from");
      const to = instant({ to: ctx.query.get("to") }, "to");
      if (sport) {
        where.push("sport = ?");
        args.push(sport);
      }
      if (city) {
        where.push("venue_area LIKE ?");
        args.push("%" + city + "%");
      }
      if (from) {
        where.push("starts_at >= ?");
        args.push(from);
      }
      if (to) {
        where.push("starts_at <= ?");
        args.push(to);
      }
      const rows = await ctx.db.all(
        "SELECT * FROM events WHERE " + where.join(" AND ") + " ORDER BY starts_at LIMIT ? OFFSET ?",
        ...args.concat([page.limit + 1, page.offset])
      );
      const hasMore = rows.length > page.limit;
      const items = [];
      for (const row of rows.slice(0, page.limit)) {
        const counts = await seatCounts(ctx.db, row.id);
        items.push(eventView(row, {
          seatsTaken: counts.seatsTaken,
          waitlistCount: counts.waitlist,
          myStatus: (await myRegistration(ctx.db, row.id, ctx.user && ctx.user.id) || {}).status || null
        }));
      }
      return json({ items, limit: page.limit, offset: page.offset, hasMore });
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/events",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      await rateLimit(ctx.db, {
        key: userKey(ctx, "event.create"),
        limit: 10,
        windowSec: 86400,
        now: ctx.nowMs,
        action: "event creations"
      });
      const body = ctx.body;
      const title = cleanText(str(body, "title", { required: true, min: 3, max: 120 }), 120);
      const sport = cleanText(str(body, "sport", { required: true, max: 40 }), 40);
      const description = cleanText(str(body, "description", { max: 4e3 }) || "", 4e3);
      const startsAt = instant(body, "startsAt", { required: true });
      const endsAt = instant(body, "endsAt");
      const timeZone = cleanText(str(body, "timeZone", { required: true, max: 60 }), 60);
      const venueName = cleanText(str(body, "venueName", { max: 120 }) || "", 120);
      const venueArea = cleanText(str(body, "venueArea", { max: 160 }) || "", 160);
      const capacity = int(body, "capacity", { min: 1, max: 1e5 });
      const deadline = instant(body, "registrationDeadline");
      const costMinor = int(body, "costMinor", { min: 0, max: 1e8, default: 0 });
      const currency = cleanText(str(body, "currency", { max: 3, default: "MXN" }) || "MXN", 3).toUpperCase();
      const visibility = str(body, "visibility", { oneOf: ["public", "community", "private"], default: "public" });
      const rules = cleanText(str(body, "rules", { max: 2e3 }) || "", 2e3);
      const cancellationPolicy = cleanText(str(body, "cancellationPolicy", { max: 2e3 }) || "", 2e3);
      const contact = cleanText(str(body, "contact", { max: 200 }) || "", 200);
      let communityId = cleanText(str(body, "communityId", { max: 80 }) || "", 80) || null;
      if (endsAt && Date.parse(endsAt) < Date.parse(startsAt)) {
        throw badRequest("invalid_endsAt", "endsAt cannot be before startsAt.");
      }
      if (deadline && Date.parse(deadline) > Date.parse(startsAt)) {
        throw badRequest("invalid_registrationDeadline", "The registration deadline cannot be after the start time.");
      }
      if (costMinor > 0) {
        throw badRequest(
          "payments_not_configured",
          "Paid events are not available yet: no payment provider is configured on this server. Publish the event free, or wait for the payment integration."
        );
      }
      if (visibility === "community" && !communityId) {
        throw badRequest("invalid_visibility", "A community-only event must belong to a community.");
      }
      if (communityId) {
        const community = await getCommunity(ctx.db, communityId);
        const membership = await getMembership(ctx.db, community.id, ctx.user.id);
        if (!membership || membership.status !== "active" || !isAdminRole(membership.role)) {
          throw forbidden("Only community admins can organize events for a community.");
        }
        communityId = community.id;
      }
      const id = ctx.newId("evt");
      const at = ctx.nowIso();
      await ctx.db.run(
        "INSERT INTO events (id, community_id, organizer_id, title, sport, description, starts_at, ends_at, time_zone, venue_name, venue_area, capacity, registration_deadline, cost_minor, currency, visibility, status, rules, cancellation_policy, contact, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?)",
        id,
        communityId,
        ctx.user.id,
        title,
        sport,
        description,
        startsAt,
        endsAt,
        timeZone,
        venueName,
        venueArea,
        capacity,
        deadline,
        costMinor,
        currency,
        visibility,
        rules,
        cancellationPolicy,
        contact,
        at
      );
      if (communityId) {
        await ctx.db.run(
          "INSERT INTO community_sessions (id, community_id, event_id, created_at) VALUES (?, ?, ?, ?)",
          ctx.newId("ses"),
          communityId,
          id,
          at
        );
      }
      const row = await ctx.db.get("SELECT * FROM events WHERE id = ?", id);
      return json(eventView(row, { seatsTaken: 0, waitlistCount: 0, myStatus: null }), 201);
    }, "handler")
  },
  {
    method: "GET",
    path: "/api/events/:id",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const row = await visibleEvent(ctx.db, ctx.params.id, ctx.user);
      const counts = await seatCounts(ctx.db, row.id);
      const likes = await ctx.db.get(
        "SELECT COUNT(*) AS n FROM event_registrations WHERE event_id = ?",
        row.id
      );
      return json(eventView(row, {
        seatsTaken: counts.seatsTaken,
        seatsRemaining: row.capacity === null ? null : Math.max(row.capacity - counts.seatsTaken, 0),
        waitlistCount: counts.waitlist,
        totalRegistrations: likes ? Number(likes.n) : 0,
        myStatus: (await myRegistration(ctx.db, row.id, ctx.user && ctx.user.id) || {}).status || null,
        isOrganizer: !!ctx.user && row.organizer_id === ctx.user.id
      }));
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/events/:id/register",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const event = await visibleEvent(ctx.db, ctx.params.id, ctx.user);
      if (event.status !== "published") throw conflict("event_not_open", "This event is not open for registration.");
      if (ctx.nowMs > Date.parse(event.starts_at)) {
        throw conflict("event_started", "This event has already started.");
      }
      if (event.registration_deadline && ctx.nowMs > Date.parse(event.registration_deadline)) {
        throw conflict("registration_closed", "Registration for this event has closed.");
      }
      await rateLimit(ctx.db, {
        key: userKey(ctx, "event.register"),
        limit: 60,
        windowSec: 3600,
        now: ctx.nowMs,
        action: "registrations"
      });
      const existing = await ctx.db.get(
        "SELECT status FROM event_registrations WHERE event_id = ? AND user_id = ?",
        event.id,
        ctx.user.id
      );
      if (existing && existing.status !== "cancelled") {
        return json({ status: existing.status, changed: false, waitlistCount: (await seatCounts(ctx.db, event.id)).waitlist });
      }
      const id = ctx.newId("reg");
      const at = ctx.nowIso();
      const claim = await ctx.db.run(
        "INSERT INTO event_registrations (id, event_id, user_id, status, position, created_at, updated_at) SELECT ?, ?, ?, 'registered', NULL, ?, ? WHERE (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = ? AND r.status IN ('registered', 'checked_in'))       < COALESCE((SELECT capacity FROM events WHERE id = ?), 9223372036854775807) ON CONFLICT(event_id, user_id) DO UPDATE SET status = 'registered', position = NULL, updated_at = excluded.updated_at",
        id,
        event.id,
        ctx.user.id,
        at,
        at,
        event.id,
        event.id
      );
      if (claim.changes === 0) {
        const next = await ctx.db.get(
          "SELECT COALESCE(MAX(position), 0) + 1 AS p FROM event_registrations WHERE event_id = ? AND status = 'waitlist'",
          event.id
        );
        const position = next ? Number(next.p) : 1;
        await ctx.db.run(
          "INSERT INTO event_registrations (id, event_id, user_id, status, position, created_at, updated_at) VALUES (?, ?, ?, 'waitlist', ?, ?, ?) ON CONFLICT(event_id, user_id) DO UPDATE SET status = 'waitlist', position = excluded.position, updated_at = excluded.updated_at",
          id,
          event.id,
          ctx.user.id,
          position,
          at,
          at
        );
        await notify(
          ctx.db,
          ctx.user.id,
          "event.waitlisted",
          "Waitlisted for " + event.title,
          "Position " + position + ". We'll tell you if a seat opens.",
          { eventId: event.id, position },
          at
        );
        return json({ status: "waitlist", position, changed: true }, 201);
      }
      await notify(
        ctx.db,
        ctx.user.id,
        "event.registered",
        "You're registered for " + event.title,
        "",
        { eventId: event.id },
        at
      );
      return json({ status: "registered", changed: true }, 201);
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/events/:id/cancel-registration",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const event = await visibleEvent(ctx.db, ctx.params.id, ctx.user);
      const existing = await ctx.db.get(
        "SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?",
        event.id,
        ctx.user.id
      );
      if (!existing || existing.status === "cancelled") {
        return json({ status: "not_registered", changed: false });
      }
      const at = ctx.nowIso();
      await ctx.db.run(
        "UPDATE event_registrations SET status = 'cancelled', position = NULL, updated_at = ? WHERE id = ?",
        at,
        existing.id
      );
      const promotion = await promoteFromWaitlist(ctx, event, at);
      await writeAudit(ctx, "registration.cancel", "event", event.id, "");
      return json({ status: "cancelled", changed: true, promoted: promotion });
    }, "handler")
  },
  {
    method: "GET",
    path: "/api/events/:id/registrations",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const event = await visibleEvent(ctx.db, ctx.params.id, ctx.user);
      await requireEventOrganizer(ctx.db, event, ctx.user);
      const page = pageParams(ctx.query, { defaultLimit: 50, maxLimit: 200 });
      const rows = await ctx.db.all(
        "SELECT r.user_id, r.status, r.position, r.created_at, p.display_name FROM event_registrations r LEFT JOIN profiles p ON p.user_id = r.user_id WHERE r.event_id = ? AND r.status IN ('registered', 'waitlist', 'checked_in') ORDER BY r.status, r.position, r.created_at LIMIT ? OFFSET ?",
        event.id,
        page.limit,
        page.offset
      );
      return json({
        items: rows.map(function(r) {
          return { userId: r.user_id, displayName: r.display_name || "", status: r.status, position: r.position, registeredAt: r.created_at };
        }),
        limit: page.limit,
        offset: page.offset
      });
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/events/:id/check-in",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const event = await visibleEvent(ctx.db, ctx.params.id, ctx.user);
      await requireEventOrganizer(ctx.db, event, ctx.user);
      const userId = cleanText(str(ctx.body, "userId", { required: true, max: 80 }), 80);
      const row = await ctx.db.get(
        "SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?",
        event.id,
        userId
      );
      if (!row || LIVE_STATUSES.indexOf(row.status) < 0) throw notFound("Registration");
      await ctx.db.run(
        "UPDATE event_registrations SET status = 'checked_in', updated_at = ? WHERE id = ?",
        ctx.nowIso(),
        row.id
      );
      return json({ userId, status: "checked_in" });
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/events/:id/cancel",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const event = await visibleEvent(ctx.db, ctx.params.id, ctx.user);
      await requireEventOrganizer(ctx.db, event, ctx.user);
      if (event.status === "cancelled") return json({ status: "cancelled", changed: false });
      const at = ctx.nowIso();
      await ctx.db.run("UPDATE events SET status = 'cancelled' WHERE id = ?", event.id);
      await writeAudit(ctx, "event.cancel", "event", event.id, cleanText(str(ctx.body, "reason", { max: 300 }) || "", 300));
      const rows = await ctx.db.all(
        "SELECT user_id FROM event_registrations WHERE event_id = ? AND status IN ('registered', 'waitlist', 'checked_in')",
        event.id
      );
      for (const r of rows) {
        await notify(ctx.db, r.user_id, "event.cancelled", "Cancelled: " + event.title, "", { eventId: event.id }, at);
      }
      return json({ status: "cancelled", changed: true, notified: rows.length });
    }, "handler")
  }
];
async function promoteFromWaitlist(ctx, event, at) {
  if (event.capacity === null) return null;
  const counts = await seatCounts(ctx.db, event.id);
  if (counts.seatsTaken >= event.capacity) return null;
  const next = await ctx.db.get(
    "SELECT * FROM event_registrations WHERE event_id = ? AND status = 'waitlist' ORDER BY position LIMIT 1",
    event.id
  );
  if (!next) return null;
  await ctx.db.run(
    "UPDATE event_registrations SET status = 'registered', position = NULL, updated_at = ? WHERE id = ?",
    at,
    next.id
  );
  await notify(
    ctx.db,
    next.user_id,
    "event.promoted",
    "A seat opened for " + event.title,
    "You are registered \u2014 the waitlist moved you up.",
    { eventId: event.id },
    at
  );
  return next.user_id;
}
__name(promoteFromWaitlist, "promoteFromWaitlist");
async function writeAudit(ctx, action, targetType, targetId, reason) {
  await ctx.db.run(
    "INSERT INTO moderation_actions (id, actor_id, action, target_type, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ctx.newId("mod"),
    ctx.user.id,
    action,
    targetType,
    targetId,
    reason || "",
    ctx.nowIso()
  );
}
__name(writeAudit, "writeAudit");
var events_default = { routes: routes2 };

// src/routes/identity.js
var SPORT_VISIBILITIES = ["private", "community", "public"];
async function loadProfile(db, userId) {
  const row = await db.get("SELECT * FROM profiles WHERE user_id = ?", userId);
  if (!row) throw notFound("Profile");
  return row;
}
__name(loadProfile, "loadProfile");
function profileView(row, sports, extra) {
  return Object.assign({
    userId: row.user_id,
    displayName: row.display_name,
    bio: row.bio,
    city: row.city,
    areaLabel: row.area_label,
    experience: row.experience,
    avatarUrl: row.avatar_url,
    publicWorkouts: !!row.public_workouts,
    showCommunities: !!row.show_communities,
    showEvents: !!row.show_events,
    sports: sports || []
  }, extra || {});
}
__name(profileView, "profileView");
var routes3 = [
  {
    method: "GET",
    path: "/api/me",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const profile = await loadProfile(ctx.db, ctx.user.id);
      const sports = await ctx.db.all(
        "SELECT sport, level, visibility FROM athlete_sports WHERE user_id = ? ORDER BY sport",
        ctx.user.id
      );
      const counts = await ctx.db.get(
        "SELECT (SELECT COUNT(*) FROM community_members WHERE user_id = ? AND status = 'active') AS communities, (SELECT COUNT(*) FROM event_registrations WHERE user_id = ? AND status IN ('registered', 'waitlist', 'checked_in')) AS events",
        ctx.user.id,
        ctx.user.id
      );
      const sub = await ctx.db.get(
        "SELECT product, status, current_period_end FROM subscriptions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
        ctx.user.id
      );
      return json(profileView(profile, sports.map(function(s) {
        return { sport: s.sport, level: s.level, visibility: s.visibility };
      }), {
        platformRole: ctx.user.role,
        unreadNotifications: await unreadCount(ctx.db, ctx.user.id),
        counts: counts ? { communities: Number(counts.communities), events: Number(counts.events) } : { communities: 0, events: 0 },
        // Entitlement is server-confirmed state, never a client flag.
        entitlement: sub ? {
          product: sub.product,
          active: sub.status === "active" || sub.status === "trialing",
          status: sub.status,
          currentPeriodEnd: sub.current_period_end
        } : null
      }));
    }, "handler")
  },
  {
    method: "PATCH",
    path: "/api/me",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const body = ctx.body;
      const displayName = cleanText(str(body, "displayName", { max: 80 }) || "", 80);
      const bio = cleanText(str(body, "bio", { max: 600 }) || "", 600);
      const city = cleanText(str(body, "city", { max: 80 }) || "", 80);
      const areaLabel = cleanText(str(body, "areaLabel", { max: 120 }) || "", 120);
      const experience = cleanText(str(body, "experience", { max: 40 }) || "", 40) || null;
      const avatarUrl = cleanText(str(body, "avatarUrl", { max: 400 }) || "", 400);
      const publicWorkouts = bool(body, "publicWorkouts", false);
      const showCommunities = bool(body, "showCommunities", false);
      const showEvents = bool(body, "showEvents", false);
      await ctx.db.run(
        "UPDATE profiles SET display_name = ?, bio = ?, city = ?, area_label = ?, experience = ?, avatar_url = ?, public_workouts = ?, show_communities = ?, show_events = ?, updated_at = ? WHERE user_id = ?",
        displayName,
        bio,
        city,
        areaLabel,
        experience,
        avatarUrl,
        publicWorkouts ? 1 : 0,
        showCommunities ? 1 : 0,
        showEvents ? 1 : 0,
        ctx.nowIso(),
        ctx.user.id
      );
      const row = await loadProfile(ctx.db, ctx.user.id);
      return json(profileView(row, []));
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/me/sports",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const sport = cleanText(str(ctx.body, "sport", { required: true, max: 40 }), 40);
      const level = cleanText(str(ctx.body, "level", { max: 40 }) || "", 40) || null;
      const visibility = str(ctx.body, "visibility", { oneOf: SPORT_VISIBILITIES, default: "private" });
      const max = await ctx.db.get("SELECT COUNT(*) AS n FROM athlete_sports WHERE user_id = ?", ctx.user.id);
      if (max && Number(max.n) >= 20 && !await ctx.db.get("SELECT 1 AS x FROM athlete_sports WHERE user_id = ? AND sport = ?", ctx.user.id, sport)) {
        throw badRequest("too_many_sports", "A profile can list up to 20 sports.");
      }
      await ctx.db.run(
        "INSERT INTO athlete_sports (user_id, sport, level, visibility) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, sport) DO UPDATE SET level = excluded.level, visibility = excluded.visibility",
        ctx.user.id,
        sport,
        level,
        visibility
      );
      return json({ sport, level, visibility }, 201);
    }, "handler")
  },
  {
    method: "DELETE",
    path: "/api/me/sports/:sport",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      await ctx.db.run("DELETE FROM athlete_sports WHERE user_id = ? AND sport = ?", ctx.user.id, ctx.params.sport);
      return json({ sport: ctx.params.sport, removed: true });
    }, "handler")
  },
  {
    method: "GET",
    path: "/api/athletes/:id",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const row = await ctx.db.get("SELECT * FROM profiles WHERE user_id = ?", ctx.params.id);
      if (!row) throw notFound("Athlete");
      const isSelf = !!ctx.user && ctx.user.id === row.user_id;
      const sports = await ctx.db.all(
        "SELECT sport, level, visibility FROM athlete_sports WHERE user_id = ? ORDER BY sport",
        row.user_id
      );
      const visible = sports.filter(function(s) {
        return isSelf || s.visibility === "public" || s.visibility === "community";
      }).map(function(s) {
        return { sport: s.sport, level: s.level, visibility: s.visibility };
      });
      const extra = { isSelf };
      if (isSelf || row.show_communities) {
        extra.communities = (await ctx.db.all(
          "SELECT c.id, c.name, c.sport FROM community_members m JOIN communities c ON c.id = m.community_id WHERE m.user_id = ? AND m.status = 'active' AND c.visibility = 'public' AND c.archived_at IS NULL LIMIT 20",
          row.user_id
        )).map(function(c) {
          return { id: c.id, name: c.name, sport: c.sport };
        });
      }
      if (isSelf || row.show_events) {
        extra.upcomingEvents = (await ctx.db.all(
          "SELECT e.id, e.title, e.starts_at FROM event_registrations r JOIN events e ON e.id = r.event_id WHERE r.user_id = ? AND r.status IN ('registered', 'checked_in') AND e.status = 'published' AND e.visibility = 'public' ORDER BY e.starts_at LIMIT 20",
          row.user_id
        )).map(function(e) {
          return { id: e.id, title: e.title, startsAt: e.starts_at };
        });
      }
      const coach = await ctx.db.get("SELECT status FROM coaches WHERE user_id = ?", row.user_id);
      extra.isCoach = !!(coach && coach.status === "published");
      return json(profileView(row, visible, extra));
    }, "handler")
  },
  {
    method: "GET",
    path: "/api/athletes/:id/workouts",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const row = await ctx.db.get("SELECT * FROM profiles WHERE user_id = ?", ctx.params.id);
      if (!row) throw notFound("Athlete");
      const isSelf = !!ctx.user && ctx.user.id === row.user_id;
      if (!isSelf && !row.public_workouts) return json({ items: [] });
      const page = pageParams(ctx.query, { defaultLimit: 20, maxLimit: 50 });
      const rows = await ctx.db.all(
        "SELECT id, sport, title, started_at, duration_sec, distance_m, metrics_json FROM activities WHERE user_id = ? AND visibility IN ('community', 'public') ORDER BY started_at DESC LIMIT ? OFFSET ?",
        row.user_id,
        page.limit,
        page.offset
      );
      return json({
        items: rows.map(function(a) {
          return {
            id: a.id,
            sport: a.sport,
            title: a.title,
            startedAt: a.started_at,
            durationSec: a.duration_sec,
            distanceM: a.distance_m,
            metrics: JSON.parse(a.metrics_json || "{}")
          };
        }),
        limit: page.limit,
        offset: page.offset
      });
    }, "handler")
  },
  {
    method: "GET",
    path: "/api/notifications",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const page = pageParams(ctx.query, { defaultLimit: 20, maxLimit: 50 });
      const rows = await ctx.db.all(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        ctx.user.id,
        page.limit,
        page.offset
      );
      return json({
        items: rows.map(function(n) {
          return { id: n.id, kind: n.kind, title: n.title, body: n.body, data: JSON.parse(n.data_json || "{}"), createdAt: n.created_at, readAt: n.read_at };
        }),
        unread: await unreadCount(ctx.db, ctx.user.id),
        limit: page.limit,
        offset: page.offset
      });
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/notifications/read",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const id = cleanText(str(ctx.body, "id", { max: 80 }) || "", 80);
      if (id) {
        await ctx.db.run("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?", ctx.nowIso(), id, ctx.user.id);
      } else {
        await ctx.db.run("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", ctx.nowIso(), ctx.user.id);
      }
      return json({ unread: await unreadCount(ctx.db, ctx.user.id) });
    }, "handler")
  },
  {
    method: "GET",
    path: "/api/me/export",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const userId = ctx.user.id;
      const [profile, sports, memberships, registrations, activities, notifications] = await Promise.all([
        ctx.db.get("SELECT * FROM profiles WHERE user_id = ?", userId),
        ctx.db.all("SELECT sport, level, visibility FROM athlete_sports WHERE user_id = ?", userId),
        ctx.db.all("SELECT community_id, role, status, joined_at FROM community_members WHERE user_id = ?", userId),
        ctx.db.all("SELECT event_id, status, position, created_at FROM event_registrations WHERE user_id = ?", userId),
        ctx.db.all("SELECT id, sport, title, started_at, duration_sec, distance_m, metrics_json, visibility FROM activities WHERE user_id = ?", userId),
        ctx.db.all("SELECT id, kind, title, body, created_at, read_at FROM notifications WHERE user_id = ?", userId)
      ]);
      return json({
        exportedAt: ctx.nowIso(),
        account: { id: userId, createdVia: "auth" },
        profile: profile ? profileView(profile, []) : null,
        sports,
        communities: memberships,
        eventRegistrations: registrations,
        activities: activities.map(function(a) {
          return Object.assign({}, a, { metrics: JSON.parse(a.metrics_json || "{}") });
        }),
        notifications
      });
    }, "handler")
  },
  {
    method: "DELETE",
    path: "/api/me",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const confirm = str(ctx.body, "confirm", { required: true, max: 20 });
      if (confirm !== "delete") throw badRequest("confirmation_required", 'Send { "confirm": "delete" } to delete the account.');
      await rateLimit(ctx.db, {
        key: userKey(ctx, "account.delete"),
        limit: 3,
        windowSec: 3600,
        now: ctx.nowMs,
        action: "deletion attempts"
      });
      const userId = ctx.user.id;
      const owned = await ctx.db.get(
        "SELECT COUNT(*) AS n FROM communities c WHERE c.created_by = ? AND c.archived_at IS NULL AND (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id AND m.role = 'owner' AND m.status = 'active' AND m.user_id <> c.created_by) = 0",
        userId
      );
      if (owned && Number(owned.n) > 0) {
        throw forbidden("Transfer or archive the communities you own before deleting your account.");
      }
      const at = ctx.nowIso();
      await ctx.db.batch([
        { sql: "DELETE FROM location_shares WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM location_prefs WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM athlete_sports WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM notifications WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM carts WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM sessions WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM auth_identities WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM consents WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM email_codes WHERE email = ?", params: [ctx.user.email || ""] },
        { sql: "UPDATE community_members SET status = 'banned' WHERE user_id = ?", params: [userId] },
        { sql: "UPDATE profiles SET display_name = '', bio = '', city = '', area_label = '', avatar_url = '', public_workouts = 0, show_communities = 0, show_events = 0, updated_at = ? WHERE user_id = ?", params: [at, userId] },
        { sql: "UPDATE activities SET visibility = 'private', notes = '' WHERE user_id = ?", params: [userId] },
        { sql: "UPDATE users SET deleted_at = ?, email = NULL, password_hash = NULL WHERE id = ?", params: [at, userId] }
      ]);
      return json({ deleted: true, deletedAt: at });
    }, "handler")
  },
  {
    method: "GET",
    path: "/api/communities/:id/events",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const community = await getCommunity(ctx.db, ctx.params.id);
      if (community.visibility !== "public") {
        const m = ctx.user ? await ctx.db.get(
          "SELECT status FROM community_members WHERE community_id = ? AND user_id = ?",
          community.id,
          ctx.user.id
        ) : null;
        if (!m || m.status !== "active") throw notFound("Community");
      }
      const rows = await ctx.db.all(
        "SELECT * FROM events WHERE community_id = ? AND status = 'published' ORDER BY starts_at LIMIT 50",
        community.id
      );
      return json({
        items: rows.map(function(e) {
          return {
            id: e.id,
            title: e.title,
            sport: e.sport,
            startsAt: e.starts_at,
            venueName: e.venue_name,
            venueArea: e.venue_area,
            capacity: e.capacity,
            visibility: e.visibility,
            costMinor: e.cost_minor
          };
        })
      });
    }, "handler")
  },
  {
    method: "GET",
    path: "/api/health",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const row = await ctx.db.get("SELECT COUNT(*) AS n FROM schema_migrations");
      return json({
        ok: true,
        schemaMigrations: row ? Number(row.n) : 0,
        time: ctx.nowIso()
      });
    }, "handler")
  }
];
async function unreadCount(db, userId) {
  const row = await db.get("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL", userId);
  return row ? Number(row.n) : 0;
}
__name(unreadCount, "unreadCount");
var identity_default = { routes: routes3 };

// src/password.js
var PBKDF2_ITERATIONS = 1e5;
var SALT_BYTES = 16;
var KEY_BITS = 256;
var encoder4 = new TextEncoder();
function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
__name(bytesToBase64, "bytesToBase64");
function base64ToBytes(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(base64ToBytes, "base64ToBytes");
function timingSafeEqualBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
__name(timingSafeEqualBytes, "timingSafeEqualBytes");
async function derive(password, salt, iterations, pepper) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder4.encode(password + "\0" + (pepper || "")),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    KEY_BITS
  );
  return new Uint8Array(bits);
}
__name(derive, "derive");
async function hashPassword(password, pepper) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS, pepper);
  return "pbkdf2-sha256$" + PBKDF2_ITERATIONS + "$" + bytesToBase64(salt) + "$" + bytesToBase64(hash);
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, stored, pepper) {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = Number(parts[1]);
  if (!isFinite(iterations) || iterations < 1e3 || iterations > 1e6) return false;
  let salt;
  let expected;
  try {
    salt = base64ToBytes(parts[2]);
    expected = base64ToBytes(parts[3]);
  } catch {
    return false;
  }
  const actual = await derive(password, salt, iterations, pepper);
  return timingSafeEqualBytes(actual, expected);
}
__name(verifyPassword, "verifyPassword");
var BLOCKLIST = [
  "password12",
  "password123",
  "1234567890",
  "qwertyuiop",
  "letmein123",
  "iloveyou12",
  "admin12345",
  "welcome123",
  "lmtlss1234"
];
function validatePassword(password, email) {
  if (typeof password !== "string") throw badRequest("invalid_password", "Password is required.");
  if (password.length < 10) throw badRequest("weak_password", "Use at least 10 characters.");
  if (password.length > 200) throw badRequest("invalid_password", "Password is too long.");
  if (password.trim().length === 0) throw badRequest("weak_password", "Use at least 10 characters.");
  const normalized = password.toLowerCase();
  const mail = String(email || "").toLowerCase();
  const local = mail.split("@")[0];
  if (mail && (normalized === mail || local && normalized === local)) {
    throw badRequest("weak_password", "Do not use your email address as your password.");
  }
  if (BLOCKLIST.indexOf(normalized) >= 0) {
    throw badRequest("weak_password", "That password is too common. Choose another one.");
  }
  return password;
}
__name(validatePassword, "validatePassword");

// src/email.js
function emailConfigured(env) {
  return !!(env && (env.RESEND_API_KEY || env.__emailSink));
}
__name(emailConfigured, "emailConfigured");
function fromAddress(env) {
  return env && env.EMAIL_FROM || "LMTLSS <no-reply@lmtlss.app>";
}
__name(fromAddress, "fromAddress");
async function sendEmail(env, message) {
  const to = message && message.to;
  if (!to) return { ok: false, reason: "missing_recipient" };
  if (env && Array.isArray(env.__emailSink)) {
    env.__emailSink.push({
      to,
      subject: message.subject,
      text: message.text,
      html: message.html || null
    });
    return { ok: true, transport: "test" };
  }
  if (!env || !env.RESEND_API_KEY) return { ok: false, reason: "email_not_configured" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: "Bearer " + env.RESEND_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: fromAddress(env),
        to: [to],
        subject: message.subject,
        text: message.text,
        html: message.html || void 0
      })
    });
    if (!response.ok) return { ok: false, reason: "provider_error", status: response.status };
    return { ok: true, transport: "resend" };
  } catch {
    return { ok: false, reason: "provider_unreachable" };
  }
}
__name(sendEmail, "sendEmail");
function wrap(title, body) {
  return '<div style="background:#000;color:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:32px"><div style="max-width:480px;margin:0 auto"><p style="color:#61EB1A;font-weight:700;letter-spacing:1px;margin:0 0 24px">LMTLSS</p><h1 style="font-size:22px;margin:0 0 12px">' + title + '</h1><div style="color:#a3a3a3;font-size:15px;line-height:1.6">' + body + '</div><p style="color:#525252;font-size:12px;margin-top:32px">If you did not request this, you can ignore this email.</p></div></div>';
}
__name(wrap, "wrap");
function verificationEmail(code) {
  return {
    subject: "Your LMTLSS verification code",
    text: "Your LMTLSS verification code is " + code + ". It expires in 10 minutes.\n\nIf you did not create an account, you can ignore this email.",
    html: wrap(
      "Verify your email",
      '<p>Enter this code in the app:</p><p style="font-size:32px;letter-spacing:8px;color:#f5f5f5;font-weight:700">' + code + "</p><p>It expires in 10 minutes.</p>"
    )
  };
}
__name(verificationEmail, "verificationEmail");
function resetEmail(code) {
  return {
    subject: "Reset your LMTLSS password",
    text: "Your LMTLSS password reset code is " + code + ". It expires in 10 minutes.\n\nIf you did not ask for this, your password has not changed.",
    html: wrap(
      "Reset your password",
      '<p>Enter this code in the app:</p><p style="font-size:32px;letter-spacing:8px;color:#f5f5f5;font-weight:700">' + code + "</p><p>It expires in 10 minutes. If you did not ask for this, nothing has changed.</p>"
    )
  };
}
__name(resetEmail, "resetEmail");

// src/oauth.js
var JWKS_URLS = {
  google: "https://www.googleapis.com/oauth2/v3/certs",
  apple: "https://appleid.apple.com/auth/keys"
};
var CACHE_TTL_MS = 60 * 60 * 1e3;
var cache = /* @__PURE__ */ new Map();
function clientIds(env, key) {
  const raw = env && env[key];
  if (!raw) return [];
  return String(raw).split(",").map(function(value) {
    return value.trim();
  }).filter(Boolean);
}
__name(clientIds, "clientIds");
async function loadJwks(provider, env, now) {
  if (env && env.__jwks && Array.isArray(env.__jwks[provider])) return env.__jwks[provider];
  const url = JWKS_URLS[provider];
  const cached = cache.get(url);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.keys;
  const fetchFn = env && env.__fetch || fetch;
  let response;
  try {
    response = await fetchFn(url);
  } catch {
    throw unavailable("provider_unavailable", "Could not reach the sign-in provider.");
  }
  if (!response.ok) throw unavailable("provider_unavailable", "Could not reach the sign-in provider.");
  const body = await response.json();
  const keys = body && Array.isArray(body.keys) ? body.keys : [];
  if (keys.length === 0) throw unavailable("provider_unavailable", "The sign-in provider returned no keys.");
  cache.set(url, { keys, fetchedAt: now });
  return keys;
}
__name(loadJwks, "loadJwks");
function normalizeEmail(value) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}
__name(normalizeEmail, "normalizeEmail");
function isVerified(value) {
  return value === true || value === "true";
}
__name(isVerified, "isVerified");
async function verifyGoogleIdToken(token, env, now) {
  const audiences = clientIds(env, "GOOGLE_CLIENT_ID");
  if (audiences.length === 0) throw unavailable("provider_not_configured", "Google sign-in is not configured.");
  const keys = await loadJwks("google", env, now);
  const claims = assertClaims(await verifyRs256(token, keys, now), {
    issuers: ["accounts.google.com", "https://accounts.google.com"],
    audiences
  });
  if (!isVerified(claims.email_verified)) throw unauthorized("Google has not verified this email address.");
  return {
    provider: "google",
    subject: String(claims.sub),
    email: normalizeEmail(claims.email),
    emailVerified: true,
    name: typeof claims.name === "string" ? claims.name : null
  };
}
__name(verifyGoogleIdToken, "verifyGoogleIdToken");
async function verifyAppleIdentityToken(token, env, now) {
  const audiences = clientIds(env, "APPLE_CLIENT_ID");
  if (audiences.length === 0) throw unavailable("provider_not_configured", "Apple sign-in is not configured.");
  const keys = await loadJwks("apple", env, now);
  const claims = assertClaims(await verifyRs256(token, keys, now), {
    issuers: ["https://appleid.apple.com"],
    audiences
  });
  return {
    provider: "apple",
    subject: String(claims.sub),
    email: normalizeEmail(claims.email),
    emailVerified: isVerified(claims.email_verified),
    name: null
  };
}
__name(verifyAppleIdentityToken, "verifyAppleIdentityToken");

// src/routes/auth.js
function normalizeEmail2(value) {
  return String(value || "").trim().toLowerCase();
}
__name(normalizeEmail2, "normalizeEmail");
function assertEmail(email) {
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw badRequest("invalid_email", "Enter a valid email address.");
  }
  return email;
}
__name(assertEmail, "assertEmail");
function passwordField(body, field) {
  const value = body ? body[field] : void 0;
  if (typeof value !== "string" || value.length === 0) {
    throw badRequest("invalid_" + field, "Missing required field: " + field);
  }
  if (value.length > 200) throw badRequest("invalid_" + field, field + " is too long.");
  return value;
}
__name(passwordField, "passwordField");
function device(body) {
  return {
    deviceName: cleanText(str(body, "deviceName", { max: 80 }) || "", 80),
    platform: cleanText(str(body, "platform", { max: 20 }) || "", 20)
  };
}
__name(device, "device");
function publicUser(user) {
  return { id: user.id, email: user.email || null, emailVerified: !!user.emailVerified };
}
__name(publicUser, "publicUser");
function sessionPayload(session, user) {
  return { token: session.token, expiresAt: session.expiresAt, user: publicUser(user) };
}
__name(sessionPayload, "sessionPayload");
function ipKey(ctx, action) {
  return action + ":ip:" + (ctx.clientIp || "unknown");
}
__name(ipKey, "ipKey");
function requireEmailTransport(ctx) {
  if (!emailConfigured(ctx.env)) {
    throw unavailable("email_not_configured", "Email is not configured on this server.");
  }
}
__name(requireEmailTransport, "requireEmailTransport");
async function sendVerification(ctx, email) {
  const issued = await issueCode(ctx.db, {
    email,
    purpose: "verify_email",
    now: ctx.nowMs,
    pepper: ctx.env.AUTH_PEPPER
  });
  const sent = await sendEmail(ctx.env, Object.assign({ to: email }, verificationEmail(issued.code)));
  if (!sent.ok) throw new HttpError(502, "email_send_failed", "We could not send the verification email. Try again.");
  return issued;
}
__name(sendVerification, "sendVerification");
var routes4 = [
  {
    method: "GET",
    path: "/api/auth/providers",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      return json({
        email: emailConfigured(ctx.env),
        password: emailConfigured(ctx.env),
        google: !!(ctx.env && ctx.env.GOOGLE_CLIENT_ID),
        apple: !!(ctx.env && ctx.env.APPLE_CLIENT_ID)
      });
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/auth/signup",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      requireEmailTransport(ctx);
      const email = assertEmail(normalizeEmail2(str(ctx.body, "email", { required: true, max: 254 })));
      const password = passwordField(ctx.body, "password");
      validatePassword(password, email);
      const name = cleanText(str(ctx.body, "name", { max: 80 }) || "", 80);
      await rateLimit(ctx.db, {
        key: ipKey(ctx, "auth.signup"),
        limit: 30,
        windowSec: 3600,
        now: ctx.nowMs,
        action: "sign-ups"
      });
      await rateLimit(ctx.db, {
        key: "auth.signup:email:" + email,
        limit: 5,
        windowSec: 3600,
        now: ctx.nowMs,
        action: "sign-ups for this email"
      });
      const existing = await ctx.db.get(
        "SELECT * FROM users WHERE lower(email) = ? AND deleted_at IS NULL",
        email
      );
      if (existing) {
        if (!existing.email_verified_at && existing.password_hash) await sendVerification(ctx, email);
        return json({ sent: true }, 202);
      }
      const passwordHash = await hashPassword(password, ctx.env.AUTH_PEPPER);
      try {
        await provisionUser(ctx.db, {
          provider: "password",
          email,
          name,
          emailVerified: false,
          passwordHash,
          now: ctx.nowMs
        });
      } catch (err) {
        const raced = await ctx.db.get("SELECT 1 AS x FROM users WHERE lower(email) = ?", email);
        if (raced) return json({ sent: true }, 202);
        throw err;
      }
      await sendVerification(ctx, email);
      return json({ sent: true }, 202);
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/auth/verify-email",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const email = assertEmail(normalizeEmail2(str(ctx.body, "email", { required: true, max: 254 })));
      const code = str(ctx.body, "code", { required: true, min: 6, max: 6 });
      await rateLimit(ctx.db, {
        key: ipKey(ctx, "auth.verify"),
        limit: 30,
        windowSec: 900,
        now: ctx.nowMs,
        action: "verification attempts"
      });
      await rateLimit(ctx.db, {
        key: "auth.verify:email:" + email,
        limit: 10,
        windowSec: 900,
        now: ctx.nowMs,
        action: "verification attempts for this email"
      });
      const ok = await consumeCode(ctx.db, {
        email,
        purpose: "verify_email",
        code,
        now: ctx.nowMs,
        pepper: ctx.env.AUTH_PEPPER
      });
      if (!ok) throw badRequest("invalid_code", "That code is invalid or has expired.");
      const user = await ctx.db.get(
        "SELECT * FROM users WHERE lower(email) = ? AND deleted_at IS NULL",
        email
      );
      if (!user) throw badRequest("invalid_code", "That code is invalid or has expired.");
      if (!user.email_verified_at) {
        await ctx.db.run("UPDATE users SET email_verified_at = ? WHERE id = ?", ctx.nowIso(), user.id);
      }
      const session = await createSession(ctx.db, user, Object.assign(device(ctx.body), { now: ctx.nowMs }));
      return json(sessionPayload(session, Object.assign({}, user, { emailVerified: true })));
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/auth/resend-verification",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      requireEmailTransport(ctx);
      const email = assertEmail(normalizeEmail2(str(ctx.body, "email", { required: true, max: 254 })));
      await rateLimit(ctx.db, {
        key: ipKey(ctx, "auth.resend"),
        limit: 10,
        windowSec: 3600,
        now: ctx.nowMs,
        action: "resend requests"
      });
      await rateLimit(ctx.db, {
        key: "auth.resend:email:" + email,
        limit: 3,
        windowSec: 900,
        now: ctx.nowMs,
        action: "resend requests for this email"
      });
      const user = await ctx.db.get(
        "SELECT * FROM users WHERE lower(email) = ? AND deleted_at IS NULL",
        email
      );
      if (user && !user.email_verified_at && user.password_hash) await sendVerification(ctx, email);
      return json({ sent: true }, 202);
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/auth/login",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const email = assertEmail(normalizeEmail2(str(ctx.body, "email", { required: true, max: 254 })));
      const password = passwordField(ctx.body, "password");
      await rateLimit(ctx.db, {
        key: ipKey(ctx, "auth.login"),
        limit: 100,
        windowSec: 900,
        now: ctx.nowMs,
        action: "sign-in attempts"
      });
      await rateLimit(ctx.db, {
        key: "auth.login:email:" + email,
        limit: 10,
        windowSec: 900,
        now: ctx.nowMs,
        action: "sign-in attempts for this email"
      });
      const user = await ctx.db.get(
        "SELECT * FROM users WHERE lower(email) = ? AND deleted_at IS NULL",
        email
      );
      if (!user || !user.password_hash) {
        await hashPassword(password, ctx.env.AUTH_PEPPER);
        throw unauthorized("Email or password is incorrect.");
      }
      const valid = await verifyPassword(password, user.password_hash, ctx.env.AUTH_PEPPER);
      if (!valid) throw unauthorized("Email or password is incorrect.");
      if (!user.email_verified_at) {
        throw new HttpError(403, "email_not_verified", "Verify your email before signing in.");
      }
      const session = await createSession(ctx.db, user, Object.assign(device(ctx.body), { now: ctx.nowMs }));
      return json(sessionPayload(session, Object.assign({}, user, { emailVerified: true })));
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/auth/password/forgot",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      requireEmailTransport(ctx);
      const email = assertEmail(normalizeEmail2(str(ctx.body, "email", { required: true, max: 254 })));
      await rateLimit(ctx.db, {
        key: ipKey(ctx, "auth.forgot"),
        limit: 10,
        windowSec: 3600,
        now: ctx.nowMs,
        action: "reset requests"
      });
      await rateLimit(ctx.db, {
        key: "auth.forgot:email:" + email,
        limit: 3,
        windowSec: 900,
        now: ctx.nowMs,
        action: "reset requests for this email"
      });
      const user = await ctx.db.get(
        "SELECT * FROM users WHERE lower(email) = ? AND deleted_at IS NULL AND password_hash IS NOT NULL",
        email
      );
      if (user) {
        const issued = await issueCode(ctx.db, {
          email,
          purpose: "reset_password",
          now: ctx.nowMs,
          pepper: ctx.env.AUTH_PEPPER
        });
        await sendEmail(ctx.env, Object.assign({ to: email }, resetEmail(issued.code)));
      }
      return json({ sent: true }, 202);
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/auth/password/reset",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      requireEmailTransport(ctx);
      const email = assertEmail(normalizeEmail2(str(ctx.body, "email", { required: true, max: 254 })));
      const code = str(ctx.body, "code", { required: true, min: 6, max: 6 });
      const password = passwordField(ctx.body, "password");
      validatePassword(password, email);
      await rateLimit(ctx.db, {
        key: ipKey(ctx, "auth.reset"),
        limit: 30,
        windowSec: 900,
        now: ctx.nowMs,
        action: "password resets"
      });
      await rateLimit(ctx.db, {
        key: "auth.reset:email:" + email,
        limit: 10,
        windowSec: 900,
        now: ctx.nowMs,
        action: "password resets for this email"
      });
      const ok = await consumeCode(ctx.db, {
        email,
        purpose: "reset_password",
        code,
        now: ctx.nowMs,
        pepper: ctx.env.AUTH_PEPPER
      });
      if (!ok) throw badRequest("invalid_code", "That code is invalid or has expired.");
      const user = await ctx.db.get(
        "SELECT * FROM users WHERE lower(email) = ? AND deleted_at IS NULL AND password_hash IS NOT NULL",
        email
      );
      if (!user) throw badRequest("invalid_code", "That code is invalid or has expired.");
      const passwordHash = await hashPassword(password, ctx.env.AUTH_PEPPER);
      await ctx.db.run("UPDATE users SET password_hash = ? WHERE id = ?", passwordHash, user.id);
      await revokeAllSessions(ctx.db, user.id, ctx.nowMs);
      const session = await createSession(ctx.db, user, Object.assign(device(ctx.body), { now: ctx.nowMs }));
      return json(sessionPayload(session, Object.assign({}, user, { emailVerified: true })));
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/auth/password",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const user = requireUser(ctx);
      const newPassword = passwordField(ctx.body, "newPassword");
      validatePassword(newPassword, user.email || "");
      const row = await ctx.db.get("SELECT * FROM users WHERE id = ?", user.id);
      if (!row) throw unauthorized();
      if (row.password_hash) {
        const current = passwordField(ctx.body, "currentPassword");
        const valid = await verifyPassword(current, row.password_hash, ctx.env.AUTH_PEPPER);
        if (!valid) throw badRequest("wrong_password", "Current password is incorrect.");
      }
      const passwordHash = await hashPassword(newPassword, ctx.env.AUTH_PEPPER);
      await ctx.db.run("UPDATE users SET password_hash = ? WHERE id = ?", passwordHash, user.id);
      await revokeAllSessions(ctx.db, user.id, ctx.nowMs, user.sessionId || null);
      return json({ ok: true });
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/auth/google",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      if (!ctx.env || !ctx.env.GOOGLE_CLIENT_ID) {
        throw unavailable("provider_not_configured", "Google sign-in is not configured.");
      }
      const idToken = str(ctx.body, "idToken", { required: true, max: 12e3 });
      const identity = await verifyGoogleIdToken(idToken, ctx.env, ctx.nowMs);
      const user = await ensureUserForIdentity(ctx.db, identity, ctx.nowMs);
      const session = await createSession(ctx.db, user, Object.assign(device(ctx.body), { now: ctx.nowMs }));
      return json(sessionPayload(session, user));
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/auth/apple",
    handler: /* @__PURE__ */ __name(async function(ctx) {
      if (!ctx.env || !ctx.env.APPLE_CLIENT_ID) {
        throw unavailable("provider_not_configured", "Apple sign-in is not configured.");
      }
      const identityToken = str(ctx.body, "identityToken", { required: true, max: 12e3 });
      const identity = await verifyAppleIdentityToken(identityToken, ctx.env, ctx.nowMs);
      const user = await ensureUserForIdentity(ctx.db, identity, ctx.nowMs);
      const session = await createSession(ctx.db, user, Object.assign(device(ctx.body), { now: ctx.nowMs }));
      return json(sessionPayload(session, user));
    }, "handler")
  },
  {
    method: "GET",
    path: "/api/auth/session",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const user = requireUser(ctx);
      let session = null;
      if (user.sessionId) {
        const row = await ctx.db.get(
          "SELECT id, device_name, platform, created_at, last_used_at, expires_at FROM sessions WHERE id = ? AND user_id = ?",
          user.sessionId,
          user.id
        );
        if (row) {
          session = {
            id: row.id,
            deviceName: row.device_name,
            platform: row.platform,
            createdAt: row.created_at,
            lastUsedAt: row.last_used_at,
            expiresAt: row.expires_at
          };
        }
      }
      return json({ user: publicUser(user), session });
    }, "handler")
  },
  {
    method: "GET",
    path: "/api/auth/identities",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const user = requireUser(ctx);
      const rows = await ctx.db.all(
        "SELECT provider, email, created_at, last_used_at FROM auth_identities WHERE user_id = ? ORDER BY created_at",
        user.id
      );
      return json({
        items: rows.map(function(row) {
          return {
            provider: row.provider,
            email: row.email || null,
            createdAt: row.created_at,
            lastUsedAt: row.last_used_at
          };
        })
      });
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/auth/logout",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const user = requireUser(ctx);
      if (user.sessionId) await revokeSession(ctx.db, user.sessionId, user.id, ctx.nowMs);
      return json({ ok: true });
    }, "handler")
  },
  {
    method: "POST",
    path: "/api/auth/logout-all",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const user = requireUser(ctx);
      await revokeAllSessions(ctx.db, user.id, ctx.nowMs);
      return json({ ok: true });
    }, "handler")
  },
  {
    method: "GET",
    path: "/api/auth/sessions",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const user = requireUser(ctx);
      const rows = await listSessions(ctx.db, user.id, ctx.nowMs);
      return json({
        items: rows.map(function(row) {
          return {
            id: row.id,
            deviceName: row.device_name,
            platform: row.platform,
            createdAt: row.created_at,
            lastUsedAt: row.last_used_at,
            expiresAt: row.expires_at,
            current: row.id === user.sessionId
          };
        })
      });
    }, "handler")
  },
  {
    method: "DELETE",
    path: "/api/auth/sessions/:id",
    auth: true,
    handler: /* @__PURE__ */ __name(async function(ctx) {
      const user = requireUser(ctx);
      const revoked = await revokeSession(ctx.db, ctx.params.id, user.id, ctx.nowMs);
      if (!revoked) throw notFound("Session");
      return json({ revoked: true, current: ctx.params.id === user.sessionId });
    }, "handler")
  }
];
var auth_default = { routes: routes4 };

// src/api.js
var ROUTES = [].concat(auth_default.routes, communities_default.routes, events_default.routes, identity_default.routes);
var MAX_BODY_BYTES = 64 * 1024;
var schemaReady = /* @__PURE__ */ new WeakMap();
async function ensureSchemaOnce(db) {
  let pending = schemaReady.get(db);
  if (!pending) {
    pending = ensureSchema(db).catch(function(err) {
      schemaReady.delete(db);
      throw err;
    });
    schemaReady.set(db, pending);
  }
  return pending;
}
__name(ensureSchemaOnce, "ensureSchemaOnce");
async function readJsonBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw badRequest("body_too_large", "Request body is too large.");
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw badRequest("invalid_body", "Request body must be a JSON object.");
    }
    return parsed;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw badRequest("invalid_json", "Request body must be valid JSON.");
  }
}
__name(readJsonBody, "readJsonBody");
function corsHeaders(request, env) {
  const origin = request.headers.get("origin");
  const allowed = env && env.ALLOWED_ORIGIN;
  if (!origin || !allowed || origin !== allowed) return {};
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "vary": "origin"
  };
}
__name(corsHeaders, "corsHeaders");
async function handleApi(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const cors = corsHeaders(request, env);
  if (method === "OPTIONS") {
    return { status: 204, body: null, headers: Object.assign({ "access-control-max-age": "600" }, cors) };
  }
  const db = dbFromEnv(env);
  const nowMs2 = env && typeof env.__nowMs === "number" ? env.__nowMs : Date.now();
  const clock = env && typeof env.__now === "function" ? env.__now : function() {
    return nowMs2;
  };
  try {
    await ensureSchemaOnce(db);
    const matched = matchRoute(ROUTES, method, url.pathname);
    if (!matched) {
      return Object.assign(json({ error: { code: "not_found", message: "No such endpoint." } }, 404), { headers: Object.assign({}, cors) });
    }
    let user = null;
    try {
      user = await resolveUser(db, env, request, clock());
    } catch (err) {
      if (err instanceof HttpError && err.code === "auth_not_configured") {
        if (matched.route.auth) throw err;
      } else {
        throw err;
      }
    }
    if (matched.route.auth && !user) {
      throw new HttpError(401, "unauthorized", "Sign in required.");
    }
    const nowValue = clock();
    const ctx = {
      db,
      env,
      request,
      user,
      params: matched.params,
      query: url.searchParams,
      body: await readJsonBody(request),
      nowMs: typeof nowValue === "number" ? nowValue : Date.parse(nowValue),
      nowIso: /* @__PURE__ */ __name(function() {
        return nowIso(clock());
      }, "nowIso"),
      clientIp: request.headers.get("cf-connecting-ip") || null,
      newId: /* @__PURE__ */ __name(function(prefix) {
        return prefix + "_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
      }, "newId"),
      slugify
    };
    const result = await matched.route.handler(ctx);
    const out = result && result.body !== void 0 ? result : json(result || null);
    return Object.assign(out, { headers: Object.assign({}, out.headers || {}, cors) });
  } catch (err) {
    if (err instanceof HttpError) {
      return Object.assign(
        json({ error: { code: err.code, message: err.message, details: err.details || null } }, err.status),
        { headers: Object.assign({}, cors) }
      );
    }
    if (env && env.LOG_ERRORS !== "off") {
      console.error("api_error", method, url.pathname, err && err.stack ? err.stack : err);
    }
    return Object.assign(
      json({ error: { code: "server_error", message: "Something went wrong on the server." } }, 500),
      { headers: Object.assign({}, cors) }
    );
  }
}
__name(handleApi, "handleApi");

// src/worker.js
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.indexOf("/api/") === 0) {
      const result = await handleApi(request, env);
      const headers = new Headers(result.headers || {});
      const body = result.body === null || result.body === void 0 ? null : typeof result.body === "string" ? result.body : JSON.stringify(result.body);
      return new Response(result.status === 204 ? null : body, { status: result.status, headers });
    }
    if (env && env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
