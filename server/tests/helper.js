/* Test harness for the API suite.
 *
 * Runs the real handler against a real SQLite database (node:sqlite, in
 * memory) — the same dialect D1 uses — with real signed tokens. Nothing is
 * stubbed except the clock and the D1 binding itself, so what passes here is
 * the authorization and SQL behaviour that will run in production.
 */

import { DatabaseSync } from "node:sqlite";
import { createHmac, createSign, generateKeyPairSync } from "node:crypto";
import { createNodeDb } from "../src/db.js";
import { handleApi } from "../src/api.js";
import { ensureSchema } from "../src/migrate.js";

export const TEST_SECRET = "test-secret-value-please-do-not-use-in-production";
export const TEST_ISSUER = "https://issuer.test";
export const TEST_PEPPER = "test-pepper-not-for-production";

export async function makeEnv(options) {
  const opts = options || {};
  const raw = new DatabaseSync(":memory:");
  const db = createNodeDb(raw);
  // Most suites start from a migrated database; skipMigrate exercises the
  // pipeline's own migration step instead.
  if (!opts.skipMigrate) await ensureSchema(db);
  const state = { nowMs: opts.nowMs || Date.parse("2026-10-18T18:00:00.000Z") };
  const env = {
    __db: db,
    __raw: raw,
    __now: function () { return state.nowMs; },
    __emailSink: opts.emailSink === false ? undefined : [],
    AUTH_JWT_SECRET: opts.authSecret === null ? undefined : (opts.authSecret || TEST_SECRET),
    AUTH_ISSUER: opts.issuer === null ? undefined : (opts.issuer || TEST_ISSUER),
    AUTH_AUDIENCE: "lmtlss-api",
    AUTH_PEPPER: opts.pepper === null ? undefined : (opts.pepper || TEST_PEPPER),
    GOOGLE_CLIENT_ID: opts.googleClientId || undefined,
    APPLE_CLIENT_ID: opts.appleClientId || undefined,
    __jwks: opts.jwks || undefined,
    LOG_ERRORS: "off"
  };
  if (opts.authSecret === null) delete env.AUTH_JWT_SECRET;
  if (opts.issuer === null) delete env.AUTH_ISSUER;
  if (opts.emailSink === false) delete env.__emailSink;
  return { env: env, db: db, clock: state, raw: raw };
}

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Sign an HS256 JWT exactly the way an identity provider would. */
export function tokenFor(sub, claims, options) {
  const opts = options || {};
  const secret = opts.secret || TEST_SECRET;
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(Object.assign({
    sub: sub,
    iss: opts.issuer || TEST_ISSUER,
    aud: opts.audience === undefined ? "lmtlss-api" : opts.audience,
    iat: Math.floor((opts.now === undefined ? Date.parse("2026-10-18T18:00:00.000Z") : opts.now) / 1000),
    exp: Math.floor(((opts.now === undefined ? Date.parse("2026-10-18T18:00:00.000Z") : opts.now) + (opts.ttlSec === undefined ? 3600 : opts.ttlSec) * 1000) / 1000)
  }, claims || {})));
  const signature = createHmac("sha256", secret).update(header + "." + payload).digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return header + "." + payload + "." + signature;
}

/** Call the API the way a client would, through the real handler. */
export async function call(harness, method, path, options) {
  const opts = options || {};
  const headers = new Headers();
  if (opts.token) headers.set("authorization", "Bearer " + opts.token);
  if (opts.headers) {
    for (const key of Object.keys(opts.headers)) headers.set(key, opts.headers[key]);
  }
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  const request = new Request("https://api.test" + path, {
    method: method,
    headers: headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });
  const result = await handleApi(request, harness.env);
  return { status: result.status, body: result.body, headers: result.headers || {} };
}

/** Convenience: sign in as a fresh athlete and return the token + user id. */
export async function newAthlete(harness, name, options) {
  const sub = (options && options.sub) || "athlete-" + Math.random().toString(36).slice(2, 10);
  const token = tokenFor(sub, { name: name || "Test Athlete" }, options);
  const me = await call(harness, "GET", "/api/me", { token: token });
  return { token: token, sub: sub, id: me.body.userId, me: me.body };
}

export function rows(db, sql, ...params) {
  return db.all(sql, ...params);
}

export function lastEmail(harness) {
  const sink = harness.env.__emailSink || [];
  return sink[sink.length - 1] || null;
}

export function codeFromEmail(message) {
  const match = /(\d{6})/.exec((message && message.text) || "");
  return match ? match[1] : null;
}

/** Sign up, read the code from the test sink, verify, and return the session. */
export async function signupAndVerify(harness, options) {
  const opts = options || {};
  const email = opts.email || "athlete-" + Math.random().toString(36).slice(2, 8) + "@example.test";
  const password = opts.password || "correct horse battery staple";
  const signup = await call(harness, "POST", "/api/auth/signup", {
    body: { email: email, password: password, name: opts.name || "Test Athlete" }
  });
  const message = lastEmail(harness);
  const code = codeFromEmail(message);
  const verify = await call(harness, "POST", "/api/auth/verify-email", {
    body: { email: email, code: code, deviceName: "Test phone", platform: "android" }
  });
  return {
    email: email, password: password, signup: signup, message: message, code: code,
    verify: verify, token: verify.body.token, id: verify.body.user && verify.body.user.id
  };
}

/** An RSA key pair whose public half can be injected as a JWKS. */
export function rsaKey() {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = pair.publicKey.export({ format: "jwk" });
  return {
    privateKey: pair.privateKey,
    jwk: Object.assign({}, jwk, { kid: "test-key", alg: "RS256", use: "sig" })
  };
}

/** Sign an RS256 JWT the way Google or Apple would. */
export function tokenForRs256(sub, claims, options) {
  const opts = options || {};
  const now = opts.now === undefined ? Date.parse("2026-10-18T18:00:00.000Z") : opts.now;
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: opts.kid || "test-key" }));
  const payload = b64url(JSON.stringify(Object.assign({
    sub: sub,
    iss: opts.issuer || "https://accounts.google.com",
    aud: opts.audience || "test-client",
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + (opts.ttlSec === undefined ? 3600 : opts.ttlSec) * 1000) / 1000)
  }, claims || {})));
  const signer = createSign("RSA-SHA256");
  signer.update(header + "." + payload);
  signer.end();
  const signature = signer.sign(opts.privateKey).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return header + "." + payload + "." + signature;
}
