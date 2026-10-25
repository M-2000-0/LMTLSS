/* Short-lived email codes.
 *
 * A six-digit code is generated with a cryptographic RNG, sent by email, and
 * stored only as an HMAC. Ten minutes, five attempts, one use. Issuing a new
 * code invalidates the previous one for the same email and purpose, so a user
 * who taps "resend" cannot end up with two valid codes.
 */

const CODE_TTL_SEC = 600;
const MAX_ATTEMPTS = 5;
const encoder = new TextEncoder();

function bytesToHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

export function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function generateCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(value).padStart(6, "0");
}

export async function hashCode(email, purpose, code, pepper) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(String(pepper || "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC", key, encoder.encode(email + ":" + purpose + ":" + code)
  );
  return bytesToHex(new Uint8Array(signature));
}

export async function issueCode(db, options) {
  const opts = options || {};
  const email = opts.email;
  const purpose = opts.purpose;
  const nowMs = opts.now === undefined ? Date.now() : opts.now;
  const ttlSec = opts.ttlSec || CODE_TTL_SEC;
  const nowIso = new Date(nowMs).toISOString();
  const expiresIso = new Date(nowMs + ttlSec * 1000).toISOString();
  const code = generateCode();
  const hash = await hashCode(email, purpose, code, opts.pepper);

  await db.batch([
    {
      sql: "UPDATE email_codes SET consumed_at = ? WHERE email = ? AND purpose = ? AND consumed_at IS NULL",
      params: [nowIso, email, purpose]
    },
    {
      sql: "INSERT INTO email_codes (id, email, purpose, code_hash, attempts, created_at, expires_at) " +
        "VALUES (?, ?, ?, ?, 0, ?, ?)",
      params: [
        "emc_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20),
        email, purpose, hash, nowIso, expiresIso
      ]
    }
  ]);

  return { code: code, expiresAt: expiresIso };
}

export async function consumeCode(db, options) {
  const opts = options || {};
  const email = opts.email;
  const purpose = opts.purpose;
  const code = String(opts.code || "");
  const nowMs = opts.now === undefined ? Date.now() : opts.now;
  const nowIso = new Date(nowMs).toISOString();

  const row = await db.get(
    "SELECT * FROM email_codes WHERE email = ? AND purpose = ? AND consumed_at IS NULL " +
    "AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
    email, purpose, nowIso
  );
  if (!row) return false;

  const attempts = Number(row.attempts || 0) + 1;
  if (attempts > MAX_ATTEMPTS) {
    await db.run("UPDATE email_codes SET attempts = ?, consumed_at = ? WHERE id = ?", attempts, nowIso, row.id);
    return false;
  }
  await db.run("UPDATE email_codes SET attempts = ? WHERE id = ?", attempts, row.id);

  const actual = await hashCode(email, purpose, code, opts.pepper);
  if (!timingSafeEqualHex(actual, row.code_hash)) return false;

  await db.run("UPDATE email_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL", nowIso, row.id);
  return true;
}

export { CODE_TTL_SEC, MAX_ATTEMPTS };
