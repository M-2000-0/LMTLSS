/* Database adapter — one interface, two engines.
 *
 * D1 (production, Cloudflare Workers) and node:sqlite (local + tests) are both
 * SQLite, but their JavaScript surfaces differ. Everything above this file
 * speaks the small interface below, so route code is identical in both places
 * and the test suite exercises the real SQL that D1 will run.
 *
 *   all(sql, ...params)  -> rows[]
 *   get(sql, ...params)  -> row | null
 *   run(sql, ...params)  -> { changes }
 *   exec(sql)            -> void            (multi-statement, migrations only)
 *   batch(statements[])  -> rows[]          (atomic; rolls back on any error)
 */

const MAX_BIND = 100; // D1 statement parameter limit

function assertBindCount(sql, params) {
  if (params.length > MAX_BIND) {
    throw new Error("statement binds " + params.length + " parameters (limit " + MAX_BIND + "): " + sql.slice(0, 60));
  }
}

/** Cloudflare D1 binding (env.DB). */
export function createD1Db(d1) {
  if (!d1) throw new Error("createD1Db: missing D1 binding");
  return {
    kind: "d1",
    async all(sql, ...params) {
      assertBindCount(sql, params);
      const res = await d1.prepare(sql).bind(...params).all();
      return res.results || [];
    },
    async get(sql, ...params) {
      assertBindCount(sql, params);
      const res = await d1.prepare(sql).bind(...params).first();
      return res || null;
    },
    async run(sql, ...params) {
      assertBindCount(sql, params);
      const res = await d1.prepare(sql).bind(...params).run();
      return { changes: res.meta ? res.meta.changes || 0 : 0 };
    },
    async exec(sql) {
      await d1.exec(sql);
    },
    async batch(statements) {
      // D1 batches are atomic: any failure rolls the whole group back.
      const prepared = statements.map(function (s) {
        assertBindCount(s.sql, s.params || []);
        return d1.prepare(s.sql).bind(...(s.params || []));
      });
      const out = await d1.batch(prepared);
      return out.map(function (r) { return { changes: r.meta ? r.meta.changes || 0 : 0, results: r.results || [] }; });
    }
  };
}

/** node:sqlite DatabaseSync (tests, local CLI). */
export function createNodeDb(db) {
  if (!db) throw new Error("createNodeDb: missing DatabaseSync instance");
  db.exec("PRAGMA foreign_keys = ON");
  return {
    kind: "node:sqlite",
    async all(sql, ...params) {
      assertBindCount(sql, params);
      return db.prepare(sql).all(...params);
    },
    async get(sql, ...params) {
      assertBindCount(sql, params);
      return db.prepare(sql).get(...params) || null;
    },
    async run(sql, ...params) {
      assertBindCount(sql, params);
      const res = db.prepare(sql).run(...params);
      return { changes: Number(res.changes || 0) };
    },
    async exec(sql) {
      db.exec(sql);
    },
    async batch(statements) {
      const out = [];
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const s of statements) {
          assertBindCount(s.sql, s.params || []);
          const stmt = db.prepare(s.sql);
          const res = stmt.run(...(s.params || []));
          out.push({ changes: Number(res.changes || 0), results: [] });
        }
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
      return out;
    }
  };
}

/** Resolve whichever binding the environment provides (D1 in prod, sqlite in tests). */
export function dbFromEnv(env) {
  if (env && env.__db) return env.__db; // test seam
  if (env && env.DB) return createD1Db(env.DB);
  throw new Error("no database bound: expected env.DB (D1)");
}

export { MAX_BIND };
