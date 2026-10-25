/* Inline the SQL migrations into a Worker-safe module.
 *
 * A Cloudflare Worker has no filesystem, so the migration runner cannot import
 * node:fs. This script reads server/schema/*.sql and writes src/schema-sql.js
 * with the same text as string literals. schema.test.js fails if the generated
 * file drifts from the .sql sources.
 *
 *   node scripts/build-schema.mjs     (from server/)
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(here, "..", "schema");
const outFile = join(here, "..", "src", "schema-sql.js");

const files = (await readdir(schemaDir))
  .filter(function (name) { return /^\d{4}_.+\.sql$/.test(name); })
  .sort();

const entries = [];
for (const file of files) {
  const sql = (await readFile(join(schemaDir, file), "utf8")).replace(/\r\n/g, "\n");
  entries.push({
    version: Number(file.slice(0, 4)),
    name: file.replace(/\.sql$/, ""),
    file: file,
    sql: sql
  });
}

const body = entries.map(function (entry) {
  return "  {\n" +
    "    version: " + entry.version + ",\n" +
    "    name: " + JSON.stringify(entry.name) + ",\n" +
    "    file: " + JSON.stringify(entry.file) + ",\n" +
    "    sql: " + JSON.stringify(entry.sql) + "\n" +
    "  }";
}).join(",\n");

const out = "/* GENERATED FILE - do not edit by hand.\n" +
  " * Source: server/schema/*.sql\n" +
  " * Regenerate from server/: node scripts/build-schema.mjs\n" +
  " *\n" +
  " * The SQL is inlined because a Cloudflare Worker has no filesystem and the\n" +
  " * migration runner must not import node:fs. schema.test.js fails if this file\n" +
  " * drifts from the .sql sources.\n" +
  " */\n\n" +
  "export const MIGRATIONS = [\n" + body + "\n];\n";

await writeFile(outFile, out, "utf8");
console.log("wrote " + outFile + " (" + entries.length + " migrations)");
