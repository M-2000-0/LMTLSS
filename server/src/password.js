/* Password hashing.
 *
 * PBKDF2-HMAC-SHA256 with a per-password salt, stored as
 *   pbkdf2-sha256$<iterations>$<salt base64>$<hash base64>
 *
 * The iteration count is deliberately explicit in the stored value so it can
 * be raised later without invalidating existing hashes: verification reads the
 * count from the record. A pepper (AUTH_PEPPER) is mixed into the password
 * before derivation, so a database-only leak is not enough to start cracking.
 *
 * A Cloudflare Worker can afford 100k iterations; this is not a free-plan
 * CPU budget. Auth routes require the Workers paid plan or an equivalent
 * runtime, which is stated in server/README.md.
 */

import { badRequest } from "./http.js";

export const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const KEY_BITS = 256;
const encoder = new TextEncoder();

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqualBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function derive(password, salt, iterations, pepper) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password + "\u0000" + (pepper || "")),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
    material,
    KEY_BITS
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password, pepper) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS, pepper);
  return "pbkdf2-sha256$" + PBKDF2_ITERATIONS + "$" + bytesToBase64(salt) + "$" + bytesToBase64(hash);
}

export async function verifyPassword(password, stored, pepper) {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = Number(parts[1]);
  if (!isFinite(iterations) || iterations < 1000 || iterations > 1000000) return false;
  let salt;
  let expected;
  try {
    salt = base64ToBytes(parts[2]);
    expected = base64ToBytes(parts[3]);
  } catch {
    return false;
  }
  const actual = await derive(password, salt, iterations, pepper);
  return timingSafeEqualBytes(actual, expected);
}

const BLOCKLIST = [
  "password12", "password123", "1234567890", "qwertyuiop", "letmein123",
  "iloveyou12", "admin12345", "welcome123", "lmtlss1234"
];

/** Minimum rules only. Composition rules make passwords worse, not better. */
export function validatePassword(password, email) {
  if (typeof password !== "string") throw badRequest("invalid_password", "Password is required.");
  if (password.length < 10) throw badRequest("weak_password", "Use at least 10 characters.");
  if (password.length > 200) throw badRequest("invalid_password", "Password is too long.");
  if (password.trim().length === 0) throw badRequest("weak_password", "Use at least 10 characters.");
  const normalized = password.toLowerCase();
  const mail = String(email || "").toLowerCase();
  const local = mail.split("@")[0];
  if (mail && (normalized === mail || (local && normalized === local))) {
    throw badRequest("weak_password", "Do not use your email address as your password.");
  }
  if (BLOCKLIST.indexOf(normalized) >= 0) {
    throw badRequest("weak_password", "That password is too common. Choose another one.");
  }
  return password;
}
