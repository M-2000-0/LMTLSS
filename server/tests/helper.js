/* Test harness for the API suite.
 *
 * Runs the real handler against a real SQLite database (node:sqlite, in
 * memory) — the same dialect D1 uses — with real signed tokens. Nothing is
 * stubbed except the clock and the D1 binding itself, so what passes here is
 * the authorization and SQL behaviour that will run in production.
 */

import { DatabaseSync } from "node:sqlite";
import { createHmac } from "node:crypto";
import { createNodeDb } from "../src/db.js";
import { handleApi } from "../src/api.js";
import { ensureSchema } from "../src/migrate.js";

export const TEST_SECRET = "test-secret-value-please-do-not-use-in-production";
export const TEST_ISSUER = "https://issuer.test";

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
    AUTH_JWT_SECRET: opts.authSecret === null ? undefined : (opts.authSecret || TEST_SECRET),
    AUTH_ISSUER: opts.issuer === null ? undefined : (opts.issuer || TEST_ISSUER),
    AUTH_AUDIENCE: "lmtlss-api",
    LOG_ERRORS: "off"
  };
  if (opts.authSecret === null) delete env.AUTH_JWT_SECRET;
  if (opts.issuer === null) delete env.AUTH_ISSUER;
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
