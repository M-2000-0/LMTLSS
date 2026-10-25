/* Google and Apple identity-token verification.
 *
 * Both providers publish a JWKS. The token's `kid` selects the key; the
 * signature, issuer, audience and expiry are all checked here, server-side.
 * The client's word that "Google said so" is never trusted.
 *
 * The JWKS is cached per isolate for an hour. Tests inject `env.__jwks` so the
 * suite never touches the network.
 */

import { assertClaims, verifyRs256 } from "./jwt.js";
import { unavailable, unauthorized } from "./http.js";

const JWKS_URLS = {
  google: "https://www.googleapis.com/oauth2/v3/certs",
  apple: "https://appleid.apple.com/auth/keys"
};
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map();

function clientIds(env, key) {
  const raw = env && env[key];
  if (!raw) return [];
  return String(raw).split(",").map(function (value) { return value.trim(); }).filter(Boolean);
}

async function loadJwks(provider, env, now) {
  if (env && env.__jwks && Array.isArray(env.__jwks[provider])) return env.__jwks[provider];
  const url = JWKS_URLS[provider];
  const cached = cache.get(url);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.keys;
  const fetchFn = (env && env.__fetch) || fetch;
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
  cache.set(url, { keys: keys, fetchedAt: now });
  return keys;
}

function normalizeEmail(value) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

function isVerified(value) {
  return value === true || value === "true";
}

export async function verifyGoogleIdToken(token, env, now) {
  const audiences = clientIds(env, "GOOGLE_CLIENT_ID");
  if (audiences.length === 0) throw unavailable("provider_not_configured", "Google sign-in is not configured.");
  const keys = await loadJwks("google", env, now);
  const claims = assertClaims(await verifyRs256(token, keys, now), {
    issuers: ["accounts.google.com", "https://accounts.google.com"],
    audiences: audiences
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

export async function verifyAppleIdentityToken(token, env, now) {
  const audiences = clientIds(env, "APPLE_CLIENT_ID");
  if (audiences.length === 0) throw unavailable("provider_not_configured", "Apple sign-in is not configured.");
  const keys = await loadJwks("apple", env, now);
  const claims = assertClaims(await verifyRs256(token, keys, now), {
    issuers: ["https://appleid.apple.com"],
    audiences: audiences
  });
  return {
    provider: "apple",
    subject: String(claims.sub),
    email: normalizeEmail(claims.email),
    emailVerified: isVerified(claims.email_verified),
    name: null
  };
}
