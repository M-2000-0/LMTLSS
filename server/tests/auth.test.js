/* Authentication and authorization boundary.
 *
 * The claims that matter: a token's own claims can never grant a role, an
 * unconfigured server refuses protected routes instead of inventing an
 * identity, and a public read still works without sign-in.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, call, tokenFor, newAthlete, TEST_SECRET } from "./helper.js";

test("health endpoint reports the applied schema version", async () => {
  const h = await makeEnv();
  const res = await call(h, "GET", "/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.schemaMigrations, 1);
});

test("public discovery works without a token", async () => {
  const h = await makeEnv();
  const res = await call(h, "GET", "/api/communities");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.items, []);
});

test("protected routes reject an anonymous caller", async () => {
  const h = await makeEnv();
  const res = await call(h, "GET", "/api/me");
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, "unauthorized");
});

test("an unconfigured auth seam refuses protected routes instead of guessing", async () => {
  const h = await makeEnv({ authSecret: null });
  const health = await call(h, "GET", "/api/health");
  assert.equal(health.status, 200, "public reads still answer");
  const me = await call(h, "GET", "/api/me", { token: tokenFor("someone") });
  assert.equal(me.status, 503);
  assert.equal(me.body.error.code, "auth_not_configured");
});

test("a token signed with the wrong secret is rejected", async () => {
  const h = await makeEnv();
  const forged = tokenFor("attacker", {}, { secret: "not-the-server-secret-at-all" });
  const res = await call(h, "GET", "/api/me", { token: forged });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.message, "Invalid token signature.");
});

test("an expired token is rejected", async () => {
  const h = await makeEnv();
  const expired = tokenFor("someone", {}, { now: h.clock.nowMs - 7200 * 1000, ttlSec: 60 });
  const res = await call(h, "GET", "/api/me", { token: expired });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.message, "Session expired.");
});

test("tokens from another issuer or audience are rejected", async () => {
  const h = await makeEnv();
  const wrongIssuer = await call(h, "GET", "/api/me", { token: tokenFor("a", {}, { issuer: "https://evil.test" }) });
  assert.equal(wrongIssuer.status, 401);
  const wrongAudience = await call(h, "GET", "/api/me", { token: tokenFor("a", {}, { audience: "another-api" }) });
  assert.equal(wrongAudience.status, 401);
});

test("first sight of a subject provisions the athlete with sharing off", async () => {
  const h = await makeEnv();
  const athlete = await newAthlete(h, "Ana");
  assert.ok(athlete.id.startsWith("usr_"));
  assert.equal(athlete.me.displayName, "Ana");
  const prefs = await h.db.get("SELECT * FROM location_prefs WHERE user_id = ?", athlete.id);
  assert.equal(prefs.ghost_mode, 1, "location sharing is off until explicitly enabled");
  assert.equal(athlete.me.entitlement, null, "no subscription is invented");
});

test("a token cannot grant itself a platform role", async () => {
  const h = await makeEnv();
  const token = tokenFor("climber", { role: "admin", platform_role: "admin", email: "x@y.z" });
  const res = await call(h, "GET", "/api/me", { token: token });
  assert.equal(res.status, 200);
  assert.equal(res.body.platformRole, "athlete", "role comes from the database, never the token");
  const row = await h.db.get("SELECT platform_role FROM users WHERE id = ?", res.body.userId);
  assert.equal(row.platform_role, "athlete");
});

test("a malformed authorization header is refused", async () => {
  const h = await makeEnv();
  const res = await call(h, "GET", "/api/me", { headers: { authorization: "Basic " + TEST_SECRET } });
  assert.equal(res.status, 401);
});

test("profile updates are scoped to the caller", async () => {
  const h = await makeEnv();
  const athlete = await newAthlete(h, "Before");
  const patched = await call(h, "PATCH", "/api/me", {
    token: athlete.token,
    body: { displayName: "Ana Lucía", city: "Mexico City", showEvents: true }
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.displayName, "Ana Lucía");
  const other = await newAthlete(h, "Other");
  const otherProfile = await call(h, "GET", "/api/athletes/" + athlete.id, { token: other.token });
  assert.equal(otherProfile.body.displayName, "Ana Lucía");
  assert.equal(otherProfile.body.userId, athlete.id);
});

test("an unknown endpoint answers 404 with the same error shape", async () => {
  const h = await makeEnv();
  const res = await call(h, "GET", "/api/nope");
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, "not_found");
});

test("cross-origin requests are not answered unless explicitly allowed", async () => {
  const h = await makeEnv();
  const blocked = await call(h, "GET", "/api/communities", { headers: { origin: "https://evil.test" } });
  assert.equal(blocked.headers["access-control-allow-origin"], undefined);
  h.env.ALLOWED_ORIGIN = "https://app.lmtlss.test";
  const allowed = await call(h, "GET", "/api/communities", { headers: { origin: "https://app.lmtlss.test" } });
  assert.equal(allowed.headers["access-control-allow-origin"], "https://app.lmtlss.test");
});
