/* Rate limiting — one fixed-window counter per action+identity.
 *
 * Abuse-prone endpoints (creating communities and events, posting, reporting,
 * registering) are limited per user and per window. The counter lives in the
 * database so it holds across Worker isolates.
 */

import { tooMany } from "./http.js";

/**
 * Consume one unit from `bucket` for this user in the current window.
 * Throws 429 when the window is exhausted. The upsert is a single statement,
 * so concurrent requests cannot both slip past the limit.
 */
export async function rateLimit(db, options) {
  const key = options.key;
  const windowSec = options.windowSec || 3600;
  const limit = options.limit;
  const now = options.now === undefined ? Date.now() : options.now;
  if (typeof key !== "string" || !key) throw new Error("rateLimit: key is required");
  if (!limit || limit < 1) throw new Error("rateLimit: limit must be >= 1");

  const windowStart = Math.floor(now / (windowSec * 1000)) * windowSec;
  const row = await db.get(
    "INSERT INTO rate_counters (bucket_key, window_start, count) VALUES (?, ?, 1) " +
    "ON CONFLICT(bucket_key, window_start) DO UPDATE SET count = count + 1 " +
    "RETURNING count",
    key, windowStart
  );
  const used = row ? Number(row.count) : 1;
  if (used > limit) {
    throw tooMany("Too many " + (options.action || "requests") + " — limit is " + limit + " per " + Math.round(windowSec / 60) + " minutes.");
  }
  await db.run("DELETE FROM rate_counters WHERE window_start < ?", windowStart - 86400);
  return { used: used, remaining: Math.max(limit - used, 0) };
}

/** Per-user bucket key. Anonymous callers are limited by IP where available. */
export function userKey(ctx, action) {
  const who = ctx.user ? ctx.user.id : "ip:" + (ctx.clientIp || "unknown");
  return action + ":" + who;
}
