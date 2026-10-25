/* Accounts: sign-up, verification, sign-in, reset, sessions, Google and Apple.
 *
 * The claims pinned here are the ones a breach or a hostile client would try:
 *   - a response never contains the password hash or the email code
 *   - sign-up and forgot never reveal whether an email has an account
 *   - a session token is stored hashed and can be revoked
 *   - an OAuth token is verified against the provider JWKS, not trusted
 *   - linking a provider by email cannot hijack an unverified password account
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeEnv, call, signupAndVerify, lastEmail, codeFromEmail, rsaKey, tokenForRs256
} from "./helper.js";

const PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "a different long passphrase";

function uniqueEmail(prefix) {
  return (prefix || "athlete") + "-" + Math.random().toString(36).slice(2, 9) + "@example.test";
}

test("the provider list is honest about what is configured", async () => {
  const plain = await makeEnv();
  const res = await call(plain, "GET", "/api/auth/providers");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { email: true, password: true, google: false, apple: false });

  const configured = await makeEnv({ googleClientId: "g-client", appleClientId: "com.lmtlss.app" });
  const withProviders = await call(configured, "GET", "/api/auth/providers");
  assert.equal(withProviders.body.google, true);
  assert.equal(withProviders.body.apple, true);
});

test("sign-up refuses instead of pretending when email is not configured", async () => {
  const h = await makeEnv({ emailSink: false });
  const res = await call(h, "POST", "/api/auth/signup", {
    body: { email: "ana@example.test", password: PASSWORD }
  });
  assert.equal(res.status, 503);
  assert.equal(res.body.error.code, "email_not_configured");
});

test("sign-up sends a code but never returns it", async () => {
  const h = await makeEnv();
  const email = uniqueEmail("ana");
  const res = await call(h, "POST", "/api/auth/signup", {
    body: { email: email, password: PASSWORD, name: "Ana" }
  });
  assert.equal(res.status, 202);
  assert.deepEqual(res.body, { sent: true });
  assert.equal(h.env.__emailSink.length, 1);
  assert.equal(h.env.__emailSink[0].to, email);
  const code = codeFromEmail(h.env.__emailSink[0]);
  assert.ok(code && /^\d{6}$/.test(code));
  assert.ok(JSON.stringify(res.body).indexOf(code) < 0, "the code must not be in the response");

  const stored = await h.db.get("SELECT code_hash FROM email_codes WHERE email = ?", email);
  assert.notEqual(stored.code_hash, code, "the code is stored hashed, not in plaintext");
  assert.match(stored.code_hash, /^[0-9a-f]{64}$/);
});

test("a verified account can sign in and reach /api/me", async () => {
  const h = await makeEnv();
  const athlete = await signupAndVerify(h, { email: uniqueEmail("ana"), name: "Ana" });
  assert.equal(athlete.verify.status, 200);
  assert.ok(athlete.token.indexOf("lmt.") === 0);
  const me = await call(h, "GET", "/api/me", { token: athlete.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.displayName, "Ana");
  assert.equal(me.body.userId, athlete.id);
});

test("the password is stored as a salted PBKDF2 hash, never returned", async () => {
  const h = await makeEnv();
  const athlete = await signupAndVerify(h, { email: uniqueEmail("hash") });
  const row = await h.db.get("SELECT password_hash FROM users WHERE id = ?", athlete.id);
  assert.match(row.password_hash, /^pbkdf2-sha256\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.ok(row.password_hash.indexOf(athlete.password) < 0);
  assert.ok(JSON.stringify(athlete.verify.body).indexOf("pbkdf2") < 0);
});

test("a duplicate sign-up answers the same way and does not create a second account", async () => {
  const h = await makeEnv();
  const email = uniqueEmail("dup");
  await call(h, "POST", "/api/auth/signup", { body: { email: email, password: PASSWORD } });
  const again = await call(h, "POST", "/api/auth/signup", {
    body: { email: email, password: PASSWORD, name: "Impostor" }
  });
  assert.equal(again.status, 202);
  assert.deepEqual(again.body, { sent: true });
  const count = await h.db.get("SELECT COUNT(*) AS n FROM users WHERE lower(email) = ?", email);
  assert.equal(Number(count.n), 1);
});

test("email is normalised: signing up with capitals still signs in lower-case", async () => {
  const h = await makeEnv();
  const email = uniqueEmail("case");
  const signup = await call(h, "POST", "/api/auth/signup", {
    body: { email: email.toUpperCase(), password: PASSWORD }
  });
  assert.equal(signup.status, 202);
  const code = codeFromEmail(lastEmail(h));
  const verify = await call(h, "POST", "/api/auth/verify-email", { body: { email: email, code: code } });
  assert.equal(verify.status, 200);
  const login = await call(h, "POST", "/api/auth/login", { body: { email: email, password: PASSWORD } });
  assert.equal(login.status, 200);
});

test("login failures are one generic message, never an account oracle", async () => {
  const h = await makeEnv();
  const email = uniqueEmail("oracle");
  await signupAndVerify(h, { email: email });

  const wrong = await call(h, "POST", "/api/auth/login", { body: { email: email, password: "wrong password here" } });
  const missing = await call(h, "POST", "/api/auth/login", { body: { email: uniqueEmail("ghost"), password: PASSWORD } });
  assert.equal(wrong.status, 401);
  assert.equal(missing.status, 401);
  assert.equal(wrong.body.error.message, "Email or password is incorrect.");
  assert.equal(missing.body.error.message, wrong.body.error.message);
});

test("an unverified account cannot sign in until the code is verified", async () => {
  const h = await makeEnv();
  const email = uniqueEmail("unverified");
  await call(h, "POST", "/api/auth/signup", { body: { email: email, password: PASSWORD } });
  const login = await call(h, "POST", "/api/auth/login", { body: { email: email, password: PASSWORD } });
  assert.equal(login.status, 403);
  assert.equal(login.body.error.code, "email_not_verified");
});

test("a wrong, expired, reused, or exhausted code is refused", async () => {
  const h = await makeEnv();
  const email = uniqueEmail("codes");
  await call(h, "POST", "/api/auth/signup", { body: { email: email, password: PASSWORD } });
  const code = codeFromEmail(lastEmail(h));

  const wrong = await call(h, "POST", "/api/auth/verify-email", {
    body: { email: email, code: code === "000000" ? "111111" : "000000" }
  });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.error.code, "invalid_code");

  const ok = await call(h, "POST", "/api/auth/verify-email", { body: { email: email, code: code } });
  assert.equal(ok.status, 200);
  const reused = await call(h, "POST", "/api/auth/verify-email", { body: { email: email, code: code } });
  assert.equal(reused.status, 400, "a code is single-use");

  const h2 = await makeEnv();
  const email2 = uniqueEmail("expired");
  await call(h2, "POST", "/api/auth/signup", { body: { email: email2, password: PASSWORD } });
  const code2 = codeFromEmail(lastEmail(h2));
  h2.clock.nowMs += 11 * 60 * 1000;
  const expired = await call(h2, "POST", "/api/auth/verify-email", { body: { email: email2, code: code2 } });
  assert.equal(expired.status, 400);

  const h3 = await makeEnv();
  const email3 = uniqueEmail("exhausted");
  await call(h3, "POST", "/api/auth/signup", { body: { email: email3, password: PASSWORD } });
  const code3 = codeFromEmail(lastEmail(h3));
  const bad = code3 === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i += 1) {
    await call(h3, "POST", "/api/auth/verify-email", { body: { email: email3, code: bad } });
  }
  const locked = await call(h3, "POST", "/api/auth/verify-email", { body: { email: email3, code: code3 } });
  assert.equal(locked.status, 400, "five wrong attempts burn the code");
});

test("password reset revokes old sessions and changes the password", async () => {
  const h = await makeEnv();
  const email = uniqueEmail("reset");
  const athlete = await signupAndVerify(h, { email: email, password: PASSWORD });

  const forgot = await call(h, "POST", "/api/auth/password/forgot", { body: { email: email } });
  assert.equal(forgot.status, 202);
  const resetCode = codeFromEmail(lastEmail(h));
  assert.ok(resetCode);

  const reset = await call(h, "POST", "/api/auth/password/reset", {
    body: { email: email, code: resetCode, password: NEW_PASSWORD }
  });
  assert.equal(reset.status, 200);
  assert.ok(reset.body.token);

  const oldSession = await call(h, "GET", "/api/me", { token: athlete.token });
  assert.equal(oldSession.status, 401, "every previous session is revoked");

  const oldPassword = await call(h, "POST", "/api/auth/login", { body: { email: email, password: PASSWORD } });
  assert.equal(oldPassword.status, 401);
  const newPassword = await call(h, "POST", "/api/auth/login", { body: { email: email, password: NEW_PASSWORD } });
  assert.equal(newPassword.status, 200);
});

test("a reset request for an unknown email answers 202 and sends nothing", async () => {
  const h = await makeEnv();
  const before = h.env.__emailSink.length;
  const res = await call(h, "POST", "/api/auth/password/forgot", { body: { email: uniqueEmail("ghost") } });
  assert.equal(res.status, 202);
  assert.equal(h.env.__emailSink.length, before);
});

test("logout revokes the current session; logout-all revokes every device", async () => {
  const h = await makeEnv();
  const email = uniqueEmail("logout");
  const first = await signupAndVerify(h, { email: email });
  const second = await call(h, "POST", "/api/auth/login", { body: { email: email, password: PASSWORD } });
  assert.equal(second.status, 200);

  const out = await call(h, "POST", "/api/auth/logout", { token: first.token });
  assert.equal(out.status, 200);
  assert.equal((await call(h, "GET", "/api/me", { token: first.token })).status, 401);
  assert.equal((await call(h, "GET", "/api/me", { token: second.body.token })).status, 200);

  const all = await call(h, "POST", "/api/auth/logout-all", { token: second.body.token });
  assert.equal(all.status, 200);
  assert.equal((await call(h, "GET", "/api/me", { token: second.body.token })).status, 401);
});

test("sessions are listed and one device can be revoked", async () => {
  const h = await makeEnv();
  const email = uniqueEmail("devices");
  const first = await signupAndVerify(h, { email: email });
  const second = await call(h, "POST", "/api/auth/login", {
    body: { email: email, password: PASSWORD, deviceName: "Tablet", platform: "ios" }
  });

  const list = await call(h, "GET", "/api/auth/sessions", { token: second.body.token });
  assert.equal(list.status, 200);
  assert.equal(list.body.items.length, 2);
  const other = list.body.items.find(function (item) { return item.deviceName !== "Tablet"; });
  assert.ok(other);

  const revoked = await call(h, "DELETE", "/api/auth/sessions/" + other.id, { token: second.body.token });
  assert.equal(revoked.status, 200);
  assert.equal((await call(h, "GET", "/api/me", { token: first.token })).status, 401);
  const after = await call(h, "GET", "/api/auth/sessions", { token: second.body.token });
  assert.equal(after.body.items.length, 1);
});

test("a tampered or expired session token is refused", async () => {
  const h = await makeEnv();
  const athlete = await signupAndVerify(h, { email: uniqueEmail("tamper") });
  const parts = athlete.token.split(".");
  const tampered = parts[0] + "." + parts[1] + "." + (parts[2] === "a" ? "b" : "a");
  const bad = await call(h, "GET", "/api/me", { token: tampered });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error.message, "Session is not valid.");

  h.clock.nowMs += 31 * 24 * 60 * 60 * 1000;
  const expired = await call(h, "GET", "/api/me", { token: athlete.token });
  assert.equal(expired.status, 401);
  assert.equal(expired.body.error.message, "Session expired.");
});

test("a session token is stored hashed, not recoverable from the database", async () => {
  const h = await makeEnv();
  const athlete = await signupAndVerify(h, { email: uniqueEmail("stored") });
  const row = await h.db.get("SELECT token_hash FROM sessions WHERE user_id = ?", athlete.id);
  assert.match(row.token_hash, /^[0-9a-f]{64}$/);
  assert.ok(athlete.token.indexOf(row.token_hash) < 0);
});

test("changing the password revokes other devices but keeps the current one", async () => {
  const h = await makeEnv();
  const email = uniqueEmail("change");
  const current = await signupAndVerify(h, { email: email, password: PASSWORD });
  const other = await call(h, "POST", "/api/auth/login", { body: { email: email, password: PASSWORD } });

  const wrong = await call(h, "POST", "/api/auth/password", {
    token: current.token, body: { currentPassword: "not the password", newPassword: NEW_PASSWORD }
  });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.error.code, "wrong_password");

  const changed = await call(h, "POST", "/api/auth/password", {
    token: current.token, body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }
  });
  assert.equal(changed.status, 200);
  assert.equal((await call(h, "GET", "/api/me", { token: current.token })).status, 200);
  assert.equal((await call(h, "GET", "/api/me", { token: other.body.token })).status, 401);
  assert.equal((await call(h, "POST", "/api/auth/login", { body: { email: email, password: NEW_PASSWORD } })).status, 200);
});

test("deleting the account revokes sessions and erases the credentials", async () => {
  const h = await makeEnv();
  const athlete = await signupAndVerify(h, { email: uniqueEmail("delete") });
  const deleted = await call(h, "DELETE", "/api/me", {
    token: athlete.token, body: { confirm: "delete" }
  });
  assert.equal(deleted.status, 200);
  assert.equal((await call(h, "GET", "/api/me", { token: athlete.token })).status, 401);
  const sessions = await h.db.get("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?", athlete.id);
  assert.equal(Number(sessions.n), 0);
  const identities = await h.db.get("SELECT COUNT(*) AS n FROM auth_identities WHERE user_id = ?", athlete.id);
  assert.equal(Number(identities.n), 0);
  const user = await h.db.get("SELECT email, password_hash FROM users WHERE id = ?", athlete.id);
  assert.equal(user.email, null);
  assert.equal(user.password_hash, null);
});

test("login is rate limited per email", async () => {
  const h = await makeEnv();
  const email = uniqueEmail("limit");
  await signupAndVerify(h, { email: email });
  let last = null;
  for (let i = 0; i < 11; i += 1) {
    last = await call(h, "POST", "/api/auth/login", { body: { email: email, password: "wrong password here" } });
  }
  assert.equal(last.status, 429);
  assert.equal(last.body.error.code, "rate_limited");
});

test("Google sign-in verifies the token and creates one account per subject", async () => {
  const key = rsaKey();
  const h = await makeEnv({
    googleClientId: "test-client",
    jwks: { google: [key.jwk] }
  });
  const token = tokenForRs256("google-sub-1", {
    email: "runner@example.test", email_verified: true, name: "Runner"
  }, {
    privateKey: key.privateKey, audience: "test-client", issuer: "https://accounts.google.com"
  });

  const first = await call(h, "POST", "/api/auth/google", { body: { idToken: token, deviceName: "Pixel" } });
  assert.equal(first.status, 200);
  assert.ok(first.body.token.indexOf("lmt.") === 0);
  const second = await call(h, "POST", "/api/auth/google", { body: { idToken: token } });
  assert.equal(second.status, 200);
  assert.equal(second.body.user.id, first.body.user.id, "the same subject maps to one account");
});

test("a Google token for another audience, or an unverified email, is refused", async () => {
  const key = rsaKey();
  const h = await makeEnv({ googleClientId: "test-client", jwks: { google: [key.jwk] } });

  const wrongAudience = tokenForRs256("google-sub-2", {
    email: "x@example.test", email_verified: true
  }, {
    privateKey: key.privateKey, audience: "someone-else", issuer: "https://accounts.google.com"
  });
  const bad = await call(h, "POST", "/api/auth/google", { body: { idToken: wrongAudience } });
  assert.equal(bad.status, 401);

  const unverified = tokenForRs256("google-sub-3", {
    email: "y@example.test", email_verified: false
  }, {
    privateKey: key.privateKey, audience: "test-client", issuer: "https://accounts.google.com"
  });
  const refused = await call(h, "POST", "/api/auth/google", { body: { idToken: unverified } });
  assert.equal(refused.status, 401);
});

test("Google links to an existing verified account by email", async () => {
  const key = rsaKey();
  const h = await makeEnv({ googleClientId: "test-client", jwks: { google: [key.jwk] } });
  const email = uniqueEmail("link");
  const existing = await signupAndVerify(h, { email: email });

  const token = tokenForRs256("google-sub-link", {
    email: email, email_verified: true
  }, {
    privateKey: key.privateKey, audience: "test-client", issuer: "https://accounts.google.com"
  });
  const linked = await call(h, "POST", "/api/auth/google", { body: { idToken: token } });
  assert.equal(linked.status, 200);
  assert.equal(linked.body.user.id, existing.id);

  const identity = await h.db.get(
    "SELECT provider FROM auth_identities WHERE user_id = ? AND provider = 'google'", existing.id
  );
  assert.ok(identity);
});

test("Google cannot hijack an unverified password account with the same email", async () => {
  const key = rsaKey();
  const h = await makeEnv({ googleClientId: "test-client", jwks: { google: [key.jwk] } });
  const email = uniqueEmail("pre-registered");
  await call(h, "POST", "/api/auth/signup", { body: { email: email, password: PASSWORD } });

  const token = tokenForRs256("google-attacker", {
    email: email, email_verified: true
  }, {
    privateKey: key.privateKey, audience: "test-client", issuer: "https://accounts.google.com"
  });
  const res = await call(h, "POST", "/api/auth/google", { body: { idToken: token } });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, "email_taken");
});

test("Apple sign-in verifies the token and survives later tokens without an email", async () => {
  const key = rsaKey();
  const h = await makeEnv({ appleClientId: "com.lmtlss.app", jwks: { apple: [key.jwk] } });
  const firstToken = tokenForRs256("apple-sub-1", {
    email: "apple@example.test", email_verified: "true"
  }, {
    privateKey: key.privateKey, audience: "com.lmtlss.app", issuer: "https://appleid.apple.com"
  });
  const first = await call(h, "POST", "/api/auth/apple", { body: { identityToken: firstToken } });
  assert.equal(first.status, 200);

  const secondToken = tokenForRs256("apple-sub-1", {}, {
    privateKey: key.privateKey, audience: "com.lmtlss.app", issuer: "https://appleid.apple.com"
  });
  const second = await call(h, "POST", "/api/auth/apple", { body: { identityToken: secondToken } });
  assert.equal(second.status, 200);
  assert.equal(second.body.user.id, first.body.user.id);
});

test("a provider route refuses when its client id is not configured", async () => {
  const h = await makeEnv();
  const google = await call(h, "POST", "/api/auth/google", { body: { idToken: "whatever" } });
  const apple = await call(h, "POST", "/api/auth/apple", { body: { identityToken: "whatever" } });
  assert.equal(google.status, 503);
  assert.equal(google.body.error.code, "provider_not_configured");
  assert.equal(apple.status, 503);
  assert.equal(apple.body.error.code, "provider_not_configured");
});
