/* JWT decoding and signature verification.
 *
 * Two algorithms are used:
 *   HS256  the legacy provider seam (AUTH_JWT_SECRET); kept so an external
 *          identity provider can still plug in.
 *   RS256  Google and Apple identity tokens, verified against their published
 *          JWKS. The key is selected by `kid` and never trusted from the token.
 *
 * No dependency: WebCrypto is available in Workers and in Node 24.
 */

import { unauthorized } from "./http.js";

const encoder = new TextEncoder();

export function base64UrlToBytes(text) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function base64UrlToJson(text) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(text)));
}

export function bytesToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw unauthorized("Malformed token.");
  return {
    header: base64UrlToJson(parts[0]),
    claims: base64UrlToJson(parts[1]),
    signature: base64UrlToBytes(parts[2]),
    signed: parts[0] + "." + parts[1]
  };
}

function checkTimes(claims, now) {
  const seconds = Math.floor((now === undefined ? Date.now() : now) / 1000);
  if (claims.exp !== undefined && seconds >= Number(claims.exp)) throw unauthorized("Session expired.");
  if (claims.nbf !== undefined && seconds < Number(claims.nbf)) throw unauthorized("Token is not valid yet.");
}

/** HS256 verification, used by the provider seam. */
export async function verifyHs256(token, secret, now) {
  const decoded = decodeJwt(token);
  if (decoded.header.alg !== "HS256") throw unauthorized("Unsupported token algorithm.");
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC", key, decoded.signature, encoder.encode(decoded.signed)
  );
  if (!valid) throw unauthorized("Invalid token signature.");
  checkTimes(decoded.claims, now);
  return decoded.claims;
}

/** RS256 verification against a JWKS key set. */
export async function verifyRs256(token, jwks, now) {
  const decoded = decodeJwt(token);
  if (decoded.header.alg !== "RS256") throw unauthorized("Unsupported token algorithm.");
  const keys = Array.isArray(jwks) ? jwks : [];
  const kid = decoded.header.kid;
  const jwk = keys.find(function (key) { return key && key.kid === kid; }) ||
    (kid === undefined ? keys[0] : null);
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
    "RSASSA-PKCS1-v1_5", key, decoded.signature, encoder.encode(decoded.signed)
  );
  if (!valid) throw unauthorized("Invalid token signature.");
  checkTimes(decoded.claims, now);
  return decoded.claims;
}

/** Issuer/audience checks shared by every provider. */
export function assertClaims(claims, options) {
  const opts = options || {};
  if (!claims.sub) throw unauthorized("Token carries no subject.");
  if (opts.issuers) {
    const allowed = Array.isArray(opts.issuers) ? opts.issuers : [opts.issuers];
    if (allowed.indexOf(claims.iss) < 0) throw unauthorized("Token issued by an unexpected issuer.");
  }
  if (opts.audiences) {
    const allowed = Array.isArray(opts.audiences) ? opts.audiences : [opts.audiences];
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const matches = aud.some(function (value) { return allowed.indexOf(value) >= 0; });
    if (!matches) throw unauthorized("Token is not addressed to this API.");
  }
  return claims;
}
