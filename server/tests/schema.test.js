/* Schema and migration runner.
 *
 * The migration path is the one piece that silently destroys data when it is
 * wrong, so it gets its own tests: applying twice is a no-op, every table the
 * API expects exists, foreign keys are enforced, and the statement splitter
 * survives comments that contain semicolons.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { createNodeDb } from "../src/db.js";
import { ensureSchema, splitStatements, MIGRATIONS } from "../src/migrate.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "schema");

const EXPECTED_TABLES = [
  "users", "profiles", "athlete_sports", "activities", "personal_records", "goals",
  "communities", "community_members", "community_posts", "community_sessions",
  "events", "event_registrations",
  "coaches", "coach_specialties", "coach_qualifications", "coach_classes",
  "subscriptions", "webhook_events",
  "products", "product_variants", "carts", "cart_items", "orders", "order_items",
  "facilities", "location_prefs", "location_shares",
  "reports", "moderation_actions", "notifications", "rate_counters",
  "auth_identities", "sessions", "email_codes", "consents"
];

async function freshDb() {
  const db = createNodeDb(new DatabaseSync(":memory:"));
  return db;
}

test("migrations apply once and applying them again is a no-op", async () => {
  const db = await freshDb();
  const first = await ensureSchema(db);
  assert.deepEqual(first, ["0001_init", "0002_auth"]);
  const second = await ensureSchema(db);
  assert.deepEqual(second, [], "a second boot must not re-run anything");
  const rows = await db.all("SELECT version FROM schema_migrations ORDER BY version");
  assert.deepEqual(rows.map(function (r) { return r.version; }), [1, 2]);
});

test("the inlined SQL matches the .sql sources", async () => {
  // The Worker has no filesystem, so migrations are inlined at build time.
  // If this fails, run `node scripts/build-schema.mjs` from server/.
  for (const migration of MIGRATIONS) {
    const text = (await readFile(join(SCHEMA_DIR, migration.file), "utf8")).replace(/\r\n/g, "\n");
    assert.equal(migration.sql, text, migration.file + " has drifted from src/schema-sql.js");
  }
});

test("every table the API depends on exists after migration", async () => {
  const db = await freshDb();
  await ensureSchema(db);
  const rows = await db.all("SELECT name FROM sqlite_master WHERE type = 'table'");
  const names = rows.map(function (r) { return r.name; });
  for (const table of EXPECTED_TABLES) {
    assert.ok(names.indexOf(table) >= 0, "missing table: " + table);
  }
});

test("foreign keys are enforced, so orphan rows cannot be written", async () => {
  const db = await freshDb();
  await ensureSchema(db);
  await assert.rejects(
    () => db.run(
      "INSERT INTO communities (id, slug, name, sport, visibility, join_policy, created_by, created_at) " +
      "VALUES ('c1', 'c1', 'Ghost Club', 'running', 'public', 'open', 'usr_does_not_exist', '2026-10-18T00:00:00.000Z')"
    ),
    /FOREIGN KEY|constraint/i
  );
});

test("uniqueness constraints hold: one registration per athlete per event", async () => {
  const db = await freshDb();
  await ensureSchema(db);
  await seedUser(db, "usr_a");
  await seedUser(db, "usr_b");
  await db.run(
    "INSERT INTO events (id, organizer_id, title, sport, starts_at, time_zone, created_at) " +
    "VALUES ('evt_1', 'usr_a', 'Meet', 'running', '2026-11-01T14:00:00.000Z', 'UTC', '2026-10-18T00:00:00.000Z')"
  );
  await db.run(
    "INSERT INTO event_registrations (id, event_id, user_id, status, created_at, updated_at) " +
    "VALUES ('r1', 'evt_1', 'usr_b', 'registered', '2026-10-18T00:00:00.000Z', '2026-10-18T00:00:00.000Z')"
  );
  await assert.rejects(
    () => db.run(
      "INSERT INTO event_registrations (id, event_id, user_id, status, created_at, updated_at) " +
      "VALUES ('r2', 'evt_1', 'usr_b', 'registered', '2026-10-18T00:00:00.000Z', '2026-10-18T00:00:00.000Z')"
    ),
    /UNIQUE|constraint/i
  );
});

test("status columns reject values outside their allowed set", async () => {
  const db = await freshDb();
  await ensureSchema(db);
  await seedUser(db, "usr_a");
  await assert.rejects(
    () => db.run(
      "INSERT INTO communities (id, slug, name, sport, visibility, join_policy, created_by, created_at) " +
      "VALUES ('c9', 'c9', 'Bad Club', 'running', 'secret', 'open', 'usr_a', '2026-10-18T00:00:00.000Z')"
    ),
    /CHECK|constraint/i
  );
});

test("the statement splitter keeps statements whole across semicolons in comments", () => {
  const sql = [
    "-- a comment mentioning communities; everything else",
    "CREATE TABLE a (id TEXT);",
    "CREATE TABLE b (id TEXT); -- trailing note; with a semicolon",
    ""
  ].join("\n");
  const parts = splitStatements(sql);
  assert.equal(parts.length, 2);
  assert.ok(parts[0].indexOf("CREATE TABLE a") === 0);
  assert.ok(parts[1].indexOf("CREATE TABLE b") === 0);
});

test("no migration file hides a double dash inside a string literal", async () => {
  // The splitter strips `--` to end of line, which would corrupt a literal
  // containing it. Keep the convention, and fail loudly if it is broken.
  for (const migration of MIGRATIONS) {
    const text = await readFile(join(SCHEMA_DIR, migration.file), "utf8");
    const stringLiterals = text.match(/'[^']*'/g) || [];
    for (const literal of stringLiterals) {
      assert.ok(literal.indexOf("--") < 0, migration.file + " has `--` inside " + literal);
    }
  }
});

async function seedUser(db, id) {
  await db.run(
    "INSERT INTO users (id, auth_provider, auth_subject, created_at) VALUES (?, 'test', ?, '2026-10-18T00:00:00.000Z')",
    id, id
  );
}
