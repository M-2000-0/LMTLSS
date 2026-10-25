/* The deployed artifacts: the Worker entry and the D1 adapter.
 *
 * These are the two files that run in production but are not reached by the
 * route tests, so they get their own coverage:
 *   - worker.js dispatch: /api/* to the API, everything else to ASSETS
 *   - db.js D1 path: the same handlers driven through a D1-shaped binding
 *     (prepare/bind/all/first/run/exec/batch), because the adapter — not the
 *     route code — is the part that could be wrong on D1.
 *
 * A shim is not Cloudflare. It proves the adapter maps onto D1's documented
 * surface; it cannot prove the runtime behaves like D1. Real D1 remains
 * unverified until `wrangler dev --local` has run.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/worker.js";
import { createD1Db } from "../src/db.js";
import { makeEnv, call, newAthlete, tokenFor } from "./helper.js";

/** Minimal D1-shaped binding over node:sqlite, matching D1's documented API. */
function makeD1Shim(raw) {
  function makeStatement(sql, params) {
    const statement = {
      bind: function (...more) { return makeStatement(sql, more); },
      all: async function () {
        return { results: raw.prepare(sql).all(...params), success: true, meta: { changes: 0 } };
      },
      first: async function () {
        return raw.prepare(sql).get(...params) || null;
      },
      run: async function () {
        const res = raw.prepare(sql).run(...params);
        return { success: true, meta: { changes: Number(res.changes || 0) } };
      },
      __sql: sql,
      __params: params
    };
    return statement;
  }
  return {
    prepare: function (sql) { return makeStatement(sql, []); },
    exec: async function (sql) {
      raw.exec(sql);
      return { count: 0, duration: 0 };
    },
    batch: async function (statements) {
      // D1 batches are atomic; mirror that so a mid-batch failure rolls back.
      const out = [];
      raw.exec("BEGIN IMMEDIATE");
      try {
        for (const statement of statements) {
          const res = raw.prepare(statement.__sql).run(...statement.__params);
          out.push({ success: true, results: [], meta: { changes: Number(res.changes || 0) } });
        }
        raw.exec("COMMIT");
      } catch (err) {
        raw.exec("ROLLBACK");
        throw err;
      }
      return out;
    }
  };
}

/**
 * Environment wired the way production is: a D1 binding, nothing else.
 * The database starts empty on purpose — the pipeline migrates it, exactly as
 * it must on a first production request.
 */
async function makeD1Env() {
  const base = await makeEnv({ skipMigrate: true });
  const raw = new DatabaseSync(":memory:");
  const env = Object.assign({}, base.env, { __db: undefined, DB: makeD1Shim(raw) });
  delete env.__db;
  return { env: env, raw: raw, clock: base.clock, db: createD1Db(env.DB) };
}

async function fetchWorker(harness, method, path, options) {
  const opts = options || {};
  const headers = new Headers();
  if (opts.token) headers.set("authorization", "Bearer " + opts.token);
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  const request = new Request("https://app.lmtlss.test" + path, {
    method: method,
    headers: headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });
  return await worker.fetch(request, harness.env);
}

test("the worker routes /api paths into the API and returns JSON", async () => {
  const h = await makeEnv();
  const res = await fetchWorker(h, "GET", "/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.json();
  assert.equal(body.ok, true);
});

test("the worker passes status and error bodies through unchanged", async () => {
  const h = await makeEnv();
  const res = await fetchWorker(h, "GET", "/api/me");
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, "unauthorized");
});

test("the worker delegates non-API paths to the ASSETS binding", async () => {
  const h = await makeEnv();
  let asked = null;
  h.env.ASSETS = {
    fetch: async function (request) {
      asked = new URL(request.url).pathname;
      return new Response("<html>app shell</html>", { status: 200, headers: { "content-type": "text/html" } });
    }
  };
  const res = await fetchWorker(h, "GET", "/index.html");
  assert.equal(res.status, 200);
  assert.equal(asked, "/index.html");
  assert.equal(await res.text(), "<html>app shell</html>");
});

test("without an ASSETS binding the worker answers 404 instead of a broken page", async () => {
  const h = await makeEnv();
  const res = await fetchWorker(h, "GET", "/index.html");
  assert.equal(res.status, 404);
});

test("the API migrates any database it is handed, per connection", async () => {
  // No ensureSchema() call here: the pipeline must do it, and it must do it for
  // each binding independently (a module-level cache would skip the second).
  const first = await makeEnv({ skipMigrate: true });
  const second = await makeEnv({ skipMigrate: true });
  const one = await call(first, "GET", "/api/health");
  const two = await call(second, "GET", "/api/health");
  assert.equal(one.body.schemaMigrations, 2);
  assert.equal(two.body.schemaMigrations, 2);
});

test("the D1 adapter serves a full club + event flow through a D1-shaped binding", async () => {
  const h = await makeD1Env();
  const ana = await newAthlete(h, "Ana");

  const community = await call(h, "POST", "/api/communities", {
    token: ana.token, body: { name: "Running Mexico City", sport: "running" }
  });
  assert.equal(community.status, 201);

  const event = await call(h, "POST", "/api/events", {
    token: ana.token,
    body: {
      title: "Long run", sport: "running", communityId: community.body.id, visibility: "community",
      startsAt: "2026-11-01T14:00:00.000Z", timeZone: "America/Mexico_City", capacity: 1
    }
  });
  assert.equal(event.status, 201);

  // A community-only event needs membership, so joining runs through the D1
  // adapter too.
  const luis = await newAthlete(h, "Luis");
  const join = await call(h, "POST", "/api/communities/" + community.body.id + "/join", { token: luis.token });
  assert.equal(join.body.status, "active");
  const registered = await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: luis.token });
  assert.equal(registered.body.status, "registered");

  const sara = await newAthlete(h, "Sara");
  await call(h, "POST", "/api/communities/" + community.body.id + "/join", { token: sara.token });
  const waitlisted = await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: sara.token });
  assert.equal(waitlisted.body.status, "waitlist", "capacity holds through the D1 adapter too");

  // The rate limiter's INSERT ... RETURNING is D1-specific surface; confirm it.
  const counters = h.raw.prepare("SELECT COUNT(*) AS n FROM rate_counters").get();
  assert.ok(Number(counters.n) > 0, "rate counters were written through the D1 path");

  const detail = await call(h, "GET", "/api/events/" + event.body.id, { token: luis.token });
  assert.equal(detail.body.seatsTaken, 1);
  assert.equal(detail.body.waitlistCount, 1);
});

test("a failed migration is retried on the next request, not cached as failed", async () => {
  const h = await makeEnv({ skipMigrate: true });
  // A colliding table makes the first migration attempt fail.
  h.raw.exec("CREATE TABLE users (id TEXT PRIMARY KEY)");
  const failed = await call(h, "GET", "/api/health");
  assert.equal(failed.status, 500, "a database that cannot be migrated is a server fault, never a silent success");
  assert.equal(failed.body.error.code, "server_error");

  // The same connection must be retried once the conflict is gone — a cached
  // failure would leave this database permanently broken.
  h.raw.exec(`DROP TABLE users`);
  const healed = await call(h, "GET", "/api/health");
  assert.equal(healed.status, 200);
  assert.equal(healed.body.schemaMigrations, 2);

  // The retry must have actually run through the D1 adapter, not skipped via a
  // cached failure. The canonical proof is the schema_migrations table in the
  // same connection — a cached failure would leave it empty and keep returning
  // 500 forever.
  const appliedVersions = h.raw.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
  assert.equal(appliedVersions.length, 2, "the same connection remembers the migrations succeeded after the retry");
  assert.equal(appliedVersions[0].version, 1, "the retried connection applied migration 1");
  assert.equal(appliedVersions[1].version, 2, "and migration 2");

  const healthy = await makeEnv();
  const ok = await call(healthy, "GET", "/api/health");
  assert.equal(ok.status, 200);
  assert.equal(ok.body.schemaMigrations, 2);
});

test("a token for a deleted account can no longer act", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const deleted = await call(h, "DELETE", "/api/me", { token: ana.token, body: { confirm: "delete" } });
  assert.equal(deleted.body.deleted, true);
  const after = await call(h, "GET", "/api/me", { token: ana.token });
  assert.equal(after.status, 401);
  const profile = await h.db.get("SELECT display_name, bio, city FROM profiles WHERE user_id = ?", ana.id);
  assert.equal(profile.display_name, "", "profile identifiers are wiped");
  const shares = await h.db.all("SELECT * FROM location_shares WHERE user_id = ?", ana.id);
  assert.deepEqual(shares, [], "presence data is deleted");
});

test("the working token still works after an unrelated token is rejected", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const forged = await call(h, "GET", "/api/me", { token: tokenFor("x", {}, { secret: "wrong-secret-wrong-secret" }) });
  assert.equal(forged.status, 401);
  const stillFine = await call(h, "GET", "/api/me", { token: ana.token });
  assert.equal(stillFine.status, 200);
});
