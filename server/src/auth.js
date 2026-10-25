/* Authentication.
 *
 * Two ways in:
 *   - a session token issued by /api/auth/* ("lmt.<id>.<secret>")
 *   - a provider-signed HS256 JWT (the original seam, still supported)
 *
 * The role is NEVER taken from a token: platform_role is read from the
 * database and can only be changed server-side. A client cannot promote itself.
 *
 * Session tokens are stored only as a SHA-256 hash, so a database read cannot
 * be replayed as a login. They are revocable per device.
 */

import { conflict, forbidden, unauthorized, unavailable } from "./http.js";
import { verifyHs256, bytesToBase64Url } from "./jwt.js";
import { timingSafeEqualHex } from "./email-codes.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SLIDING_REFRESH_MS = 24 * 60 * 60 * 1000;
const encoder = new TextEncoder();

export function authConfig(env) {
  const secret = env && env.AUTH_JWT_SECRET;
  const issuer = (env && env.AUTH_ISSUER) || null;
  const audience = (env && env.AUTH_AUDIENCE) || null;
  return {
    configured: !!(secret && String(secret).length >= 16),
    secret: secret ? String(secret) : null,
    issuer: issuer,
    audience: audience
  };
}

/** HS256 verification with WebCrypto, kept for the provider seam. */
export async function verifyToken(token, cfg, now) {
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

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  const bytes = new Uint8Array(digest);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

function nowMs(value) {
  return value === undefined ? Date.now() : value;
}

function iso(value) {
  return new Date(value).toISOString();
}

/**
 * Create one athlete row plus the profile and location defaults every account
 * needs. Used by password sign-up, OAuth first sight, and the JWT seam.
 */
export async function provisionUser(db, options) {
  const opts = options || {};
  const id = "usr_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const provider = opts.provider || "password";
  const subject = opts.subject ? String(opts.subject) : id;
  const email = opts.email ? String(opts.email).trim().toLowerCase() : null;
  const at = iso(nowMs(opts.now));
  const name = typeof opts.name === "string" ? opts.name.slice(0, 80) : "";

  await db.batch([
    {
      sql: "INSERT INTO users (id, auth_provider, auth_subject, email, email_verified_at, password_hash, platform_role, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, 'athlete', ?)",
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

  return { id: id, role: "athlete", email: email, emailVerified: !!opts.emailVerified, claims: null, sessionId: null };
}

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

/**
 * Find or create the account behind a Google/Apple identity.
 *
 * Linking by email is only allowed when the existing account is verified or
 * has no password. Otherwise an attacker who pre-registered a victim's email
 * with a password would inherit the victim's Google sign-in.
 */
export async function ensureUserForIdentity(db, identity, now) {
  const provider = identity.provider;
  const subject = String(identity.subject);
  const at = iso(nowMs(now));

  const existing = await db.get(
    "SELECT u.* FROM auth_identities i JOIN users u ON u.id = i.user_id " +
    "WHERE i.provider = ? AND i.subject = ?",
    provider, subject
  );
  if (existing) {
    if (existing.deleted_at) throw unauthorized("This account was deleted.");
    await db.run(
      "UPDATE auth_identities SET last_used_at = ?, email = COALESCE(?, email) WHERE provider = ? AND subject = ?",
      at, identity.email || null, provider, subject
    );
    return userFromRow(existing);
  }

  if (identity.email) {
    const byEmail = await db.get(
      "SELECT * FROM users WHERE lower(email) = ? AND deleted_at IS NULL", identity.email
    );
    if (byEmail) {
      if (byEmail.password_hash && !byEmail.email_verified_at) {
        throw conflict("email_taken", "An account with this email already exists. Sign in with your password to link it.");
      }
      try {
        await db.run(
          "INSERT INTO auth_identities (provider, subject, user_id, email, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)",
          provider, subject, byEmail.id, identity.email, at, at
        );
      } catch (err) {
        // A concurrent first sign-in may have linked the same identity.
        const linked = await db.get(
          "SELECT u.* FROM auth_identities i JOIN users u ON u.id = i.user_id WHERE i.provider = ? AND i.subject = ?",
          provider, subject
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
    provider: provider,
    subject: subject,
    email: identity.email,
    name: identity.name,
    emailVerified: identity.emailVerified,
    now: now
  });
}

export async function createSession(db, user, options) {
  const opts = options || {};
  const at = nowMs(opts.now);
  const id = "ses_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const secret = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const token = "lmt." + id + "." + secret;
  const tokenHash = await sha256Hex(id + "." + secret);
  const createdIso = iso(at);
  const expiresIso = iso(at + SESSION_TTL_MS);

  await db.run(
    "INSERT INTO sessions (id, user_id, token_hash, device_name, platform, created_at, last_used_at, expires_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    id, user.id, tokenHash, String(opts.deviceName || "").slice(0, 80),
    String(opts.platform || "").slice(0, 20), createdIso, createdIso, expiresIso
  );

  return { token: token, sessionId: id, expiresAt: expiresIso };
}

async function resolveSession(db, token, now) {
  const parts = String(token).split(".");
  if (parts.length !== 3 || parts[0] !== "lmt") throw unauthorized("Malformed token.");
  const id = parts[1];
  const secret = parts[2];

  const row = await db.get(
    "SELECT s.*, u.platform_role, u.email, u.email_verified_at, u.deleted_at " +
    "FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?",
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
      iso(now), iso(now + SESSION_TTL_MS), id
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

/** Resolve the caller, provisioning a user row on first sight of a JWT subject. */
export async function resolveUser(db, env, request, now) {
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
    provider, String(claims.sub)
  );
  if (existing) {
    if (existing.deleted_at) throw unauthorized("This account was deleted.");
    return userFromRow(existing);
  }
  return await provisionUser(db, {
    provider: provider,
    subject: String(claims.sub),
    email: claims.email,
    name: claims.name,
    emailVerified: false,
    now: at
  });
}

export async function revokeSession(db, sessionId, userId, now) {
  const result = await db.run(
    "UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
    iso(nowMs(now)), sessionId, userId
  );
  return result.changes > 0;
}

export async function revokeAllSessions(db, userId, now, exceptId) {
  const at = iso(nowMs(now));
  if (exceptId) {
    await db.run(
      "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id <> ? AND revoked_at IS NULL",
      at, userId, exceptId
    );
  } else {
    await db.run("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", at, userId);
  }
}

export async function listSessions(db, userId, now) {
  return await db.all(
    "SELECT id, device_name, platform, created_at, last_used_at, expires_at FROM sessions " +
    "WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_used_at DESC",
    userId, iso(nowMs(now))
  );
}

/** Route guard: throws 401 instead of returning null. */
export function requireUser(ctx) {
  if (!ctx.user) throw unauthorized();
  return ctx.user;
}

/** Route guard for platform moderators (reports queue). */
export function requireModerator(ctx) {
  const user = requireUser(ctx);
  if (user.role !== "moderator" && user.role !== "admin") {
    throw forbidden("Moderator access required.");
  }
  return user;
}

export { SESSION_TTL_MS };
