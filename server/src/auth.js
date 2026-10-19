/* Authentication seam.
 *
 * WHAT THIS IS: the server half of authentication — bearer-token verification,
 * just-in-time user provisioning, and the identity every route authorizes
 * against. It is provider-agnostic: any identity provider that can sign an
 * HS256 JWT (or your own login service) plugs in via AUTH_JWT_SECRET,
 * AUTH_ISSUER and AUTH_AUDIENCE.
 *
 * WHAT THIS IS NOT: a sign-in experience. No provider is wired up, so until
 * those variables are set every request that needs a user gets
 * 503 auth_not_configured. That is deliberate — AGENTS.md forbids presenting a
 * capability as working when it is not, and there is nothing honest to fake
 * here. The test suite exercises the real verification path with tokens it
 * signs itself.
 *
 * Never store a token or a secret in the database or in a response body.
 */

import { forbidden, unauthorized, unavailable } from "./http.js";

const decoder = new TextEncoder();

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

function base64UrlToBytes(text) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlToJson(text) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(text)));
}

/** HS256 verification with WebCrypto — available in Workers and in Node 24. */
export async function verifyToken(token, cfg, now) {
  if (!cfg.configured) throw unavailable("auth_not_configured", "Sign-in is not configured on this server.");
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw unauthorized("Malformed token.");
  const header = base64UrlToJson(parts[0]);
  if (header.alg !== "HS256") throw unauthorized("Unsupported token algorithm.");
  const key = await crypto.subtle.importKey(
    "raw", decoder.encode(cfg.secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC", key, base64UrlToBytes(parts[2]), decoder.encode(parts[0] + "." + parts[1])
  );
  if (!valid) throw unauthorized("Invalid token signature.");
  const claims = base64UrlToJson(parts[1]);
  const seconds = Math.floor((now === undefined ? Date.now() : now) / 1000);
  if (claims.exp !== undefined && seconds >= Number(claims.exp)) throw unauthorized("Session expired.");
  if (claims.nbf !== undefined && seconds < Number(claims.nbf)) throw unauthorized("Token is not valid yet.");
  if (cfg.issuer && claims.iss !== cfg.issuer) throw unauthorized("Token issued by an unexpected issuer.");
  if (cfg.audience) {
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (aud.indexOf(cfg.audience) < 0) throw unauthorized("Token is not addressed to this API.");
  }
  if (!claims.sub) throw unauthorized("Token carries no subject.");
  return claims;
}

/**
 * Resolve the caller, provisioning a user row on first sight of a subject.
 *
 * The role is NEVER taken from the token: platform_role is read from the
 * database and can only be changed server-side. A client cannot promote itself.
 */
export async function resolveUser(db, env, request, now) {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) throw unauthorized("Use an Authorization: Bearer <token> header.");
  const cfg = authConfig(env);
  const claims = await verifyToken(match[1], cfg, now);
  const provider = claims.iss || cfg.issuer || "hs256";
  const existing = await db.get(
    "SELECT * FROM users WHERE auth_provider = ? AND auth_subject = ?",
    provider, String(claims.sub)
  );
  if (existing) {
    if (existing.deleted_at) throw unauthorized("This account was deleted.");
    return { id: existing.id, role: existing.platform_role, email: existing.email || null, claims: claims };
  }
  const id = "usr_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const at = new Date(now === undefined ? Date.now() : now).toISOString();
  const email = typeof claims.email === "string" ? claims.email : null;
  await db.run(
    "INSERT INTO users (id, auth_provider, auth_subject, email, platform_role, created_at) VALUES (?, ?, ?, ?, 'athlete', ?)",
    id, provider, String(claims.sub), email, at
  );
  await db.run(
    "INSERT INTO profiles (user_id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)",
    id, typeof claims.name === "string" ? claims.name.slice(0, 80) : "", at, at
  );
  await db.run(
    "INSERT INTO location_prefs (user_id, ghost_mode, audience, updated_at) VALUES (?, 1, 'friends', ?)",
    id, at
  );
  return { id: id, role: "athlete", email: email, claims: claims };
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
