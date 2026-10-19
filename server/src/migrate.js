/* Migration runner.
 *
 * AGENTS.md rule for the client ("never change SCHEMA_VERSION without a
 * migration") applied to the server: every schema change is a numbered .sql
 * file, applied once, recorded in schema_migrations, and never edited after it
 * has run. Statements in a migration are applied in one batch, so a failure
 * leaves no half-applied version.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMA_DIR = join(HERE, "..", "schema");

/** Inlined migrations for Workers, where the filesystem does not exist. */
export const MIGRATIONS = [
  { version: 1, name: "0001_init", file: "0001_init.sql" }
];

export async function loadMigrationSql(migration, readText) {
  const read = readText || (async function (p) { return readFile(p, "utf8"); });
  return read(join(SCHEMA_DIR, migration.file));
}

export async function ensureSchema(db, options) {
  const opts = options || {};
  await db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (" +
    "version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)"
  );
  const rows = await db.all("SELECT version FROM schema_migrations");
  const applied = new Set(rows.map(function (r) { return r.version; }));
  const done = [];
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    const sql = await loadMigrationSql(m, opts.readText);
    // One batch per migration: all of it, or none of it.
    const statements = splitStatements(sql);
    await db.batch(statements.map(function (s) { return { sql: s, params: [] }; }));
    await db.run(
      "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
      m.version, m.name, (opts.now ? opts.now() : new Date().toISOString())
    );
    done.push(m.name);
  }
  return done;
}

/**
 * Split a migration file into statements.
 *
 * Comments are removed before splitting, because a semicolon inside a comment
 * ("...public communities; everything else...") would otherwise cut a
 * statement in half. That leaves one convention to keep: no `--` inside a
 * string literal in a migration file — asserted by schema.test.js.
 */
export function splitStatements(sql) {
  const withoutComments = sql
    .split("\n")
    .map(function (line) { return line.replace(/--.*$/, ""); })
    .join("\n");
  return withoutComments
    .split(";")
    .map(function (chunk) { return chunk.trim(); })
    .filter(function (chunk) { return chunk.length > 0; });
}
