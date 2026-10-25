/* Account routes: sign-up, sign-in, verification, reset, providers, sessions.
 *
 * Rules:
 *   - Sign-up and password-forgot always answer 202, whether or not the email
 *     exists. The response is not an account-enumeration oracle.
 *   - Login failures are one generic message. The server never says which half
 *     was wrong.
 *   - A password is never trimmed: spaces are part of the secret.
 *   - Every email-sending route refuses with 503 when no transport is
 *     configured, instead of claiming a message was sent.
 */

import {
  badRequest, cleanText, HttpError, json, notFound, str,
  unavailable, unauthorized
} from "../http.js";
import {
  createSession, ensureUserForIdentity, listSessions, provisionUser,
  requireUser, revokeAllSessions, revokeSession
} from "../auth.js";
import { hashPassword, validatePassword, verifyPassword } from "../password.js";
import { consumeCode, issueCode } from "../email-codes.js";
import { emailConfigured, resetEmail, sendEmail, verificationEmail } from "../email.js";
import { verifyAppleIdentityToken, verifyGoogleIdToken } from "../oauth.js";
import { rateLimit } from "../rate.js";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function assertEmail(email) {
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw badRequest("invalid_email", "Enter a valid email address.");
  }
  return email;
}

/** Passwords are not trimmed. `str` is for text fields, not secrets. */
function passwordField(body, field) {
  const value = body ? body[field] : undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw badRequest("invalid_" + field, "Missing required field: " + field);
  }
  if (value.length > 200) throw badRequest("invalid_" + field, field + " is too long.");
  return value;
}

function device(body) {
  return {
    deviceName: cleanText(str(body, "deviceName", { max: 80 }) || "", 80),
    platform: cleanText(str(body, "platform", { max: 20 }) || "", 20)
  };
}

function publicUser(user) {
  return { id: user.id, email: user.email || null, emailVerified: !!user.emailVerified };
}

function sessionPayload(session, user) {
  return { token: session.token, expiresAt: session.expiresAt, user: publicUser(user) };
}

function ipKey(ctx, action) {
  return action + ":ip:" + (ctx.clientIp || "unknown");
}

function requireEmailTransport(ctx) {
  if (!emailConfigured(ctx.env)) {
    throw unavailable("email_not_configured", "Email is not configured on this server.");
  }
}

async function sendVerification(ctx, email) {
  const issued = await issueCode(ctx.db, {
    email: email, purpose: "verify_email", now: ctx.nowMs, pepper: ctx.env.AUTH_PEPPER
  });
  const sent = await sendEmail(ctx.env, Object.assign({ to: email }, verificationEmail(issued.code)));
  if (!sent.ok) throw new HttpError(502, "email_send_failed", "We could not send the verification email. Try again.");
  return issued;
}

const routes = [
  {
    method: "GET",
    path: "/api/auth/providers",
    handler: async function (ctx) {
      return json({
        email: emailConfigured(ctx.env),
        password: emailConfigured(ctx.env),
        google: !!(ctx.env && ctx.env.GOOGLE_CLIENT_ID),
        apple: !!(ctx.env && ctx.env.APPLE_CLIENT_ID)
      });
    }
  },

  {
    method: "POST",
    path: "/api/auth/signup",
    handler: async function (ctx) {
      requireEmailTransport(ctx);
      const email = assertEmail(normalizeEmail(str(ctx.body, "email", { required: true, max: 254 })));
      const password = passwordField(ctx.body, "password");
      validatePassword(password, email);
      const name = cleanText(str(ctx.body, "name", { max: 80 }) || "", 80);

      await rateLimit(ctx.db, {
        key: ipKey(ctx, "auth.signup"), limit: 30, windowSec: 3600, now: ctx.nowMs, action: "sign-ups"
      });
      await rateLimit(ctx.db, {
        key: "auth.signup:email:" + email, limit: 5, windowSec: 3600, now: ctx.nowMs,
        action: "sign-ups for this email"
      });

      const existing = await ctx.db.get(
        "SELECT * FROM users WHERE lower(email) = ? AND deleted_at IS NULL", email
      );
      if (existing) {
        // Never confirm or deny that the address has an account.
        if (!existing.email_verified_at && existing.password_hash) await sendVerification(ctx, email);
        return json({ sent: true }, 202);
      }

      const passwordHash = await hashPassword(password, ctx.env.AUTH_PEPPER);
      try {
        await provisionUser(ctx.db, {
          provider: "password", email: email, name: name, emailVerified: false,
          passwordHash: passwordHash, now: ctx.nowMs
        });
      } catch (err) {
        // A concurrent sign-up won the unique email index. Same answer.
        const raced = await ctx.db.get("SELECT 1 AS x FROM users WHERE lower(email) = ?", email);
        if (raced) return json({ sent: true }, 202);
        throw err;
      }

      await sendVerification(ctx, email);
      return json({ sent: true }, 202);
    }
  },

  {
    method: "POST",
    path: "/api/auth/verify-email",
    handler: async function (ctx) {
      const email = assertEmail(normalizeEmail(str(ctx.body, "email", { required: true, max: 254 })));
      const code = str(ctx.body, "code", { required: true, min: 6, max: 6 });

      await rateLimit(ctx.db, {
        key: ipKey(ctx, "auth.verify"), limit: 30, windowSec: 900, now: ctx.nowMs, action: "verification attempts"
      });
      await rateLimit(ctx.db, {
        key: "auth.verify:email:" + email, limit: 10, windowSec: 900, now: ctx.nowMs,
        action: "verification attempts for this email"
      });

      const ok = await consumeCode(ctx.db, {
        email: email, purpose: "verify_email", code: code, now: ctx.nowMs, pepper: ctx.env.AUTH_PEPPER
      });
      if (!ok) throw badRequest("invalid_code", "That code is invalid or has expired.");

      const user = await ctx.db.get(
        "SELECT * FROM users WHERE lower(email) = ? AND deleted_at IS NULL", email
      );
      if (!user) throw badRequest("invalid_code", "That code is invalid or has expired.");

      if (!user.email_verified_at) {
        await ctx.db.run("UPDATE users SET email_verified_at = ? WHERE id = ?", ctx.nowIso(), user.id);
      }
      const session = await createSession(ctx.db, user, Object.assign(device(ctx.body), { now: ctx.nowMs }));
      return json(sessionPayload(session, Object.assign({}, user, { emailVerified: true })));
    }
  },

  {
    method: "POST",
    path: "/api/auth/resend-verification",
    handler: async function (ctx) {
      requireEmailTransport(ctx);
      const email = assertEmail(normalizeEmail(str(ctx.body, "email", { required: true, max: 254 })));

      await rateLimit(ctx.db, {
        key: ipKey(ctx, "auth.resend"), limit: 10, windowSec: 3600, now: ctx.nowMs, action: "resend requests"
      });
      await rateLimit(ctx.db, {
        key: "auth.resend:email:" + email, limit: 3, windowSec: 900, now: ctx.nowMs,
        action: "resend requests for this email"
      });

      const user = await ctx.db.get(
        "SELECT * FROM users WHERE lower(email) = ? AND deleted_at IS NULL", email
      );
      if (user && !user.email_verified_at && user.password_hash) await sendVerification(ctx, email);
      return json({ sent: true }, 202);
    }
  },

  {
    method: "POST",
    path: "/api/auth/login",
    handler: async function (ctx) {
      const email = assertEmail(normalizeEmail(str(ctx.body, "email", { required: true, max: 254 })));
      const password = passwordField(ctx.body, "password");

      await rateLimit(ctx.db, {
        key: ipKey(ctx, "auth.login"), limit: 100, windowSec: 900, now: ctx.nowMs, action: "sign-in attempts"
      });
      await rateLimit(ctx.db, {
        key: "auth.login:email:" + email, limit: 10, windowSec: 900, now: ctx.nowMs,
        action: "sign-in attempts for this email"
      });

      const user = await ctx.db.get(
        "SELECT * FROM users WHERE lower(email) = ? AND deleted_at IS NULL", email
      );
      if (!user || !user.password_hash) {
        // Equalise the work so a missing account is not obviously faster.
        await hashPassword(password, ctx.env.AUTH_PEPPER);
        throw unauthorized("Email or password is incorrect.");
      }
      const valid = await verifyPassword(password, user.password_hash, ctx.env.AUTH_PEPPER);
      if (!valid) throw unauthorized("Email or password is incorrect.");
      if (!user.email_verified_at) {
        throw new HttpError(403, "email_not_verified", "Verify your email before signing in.");
      }

      const session = await createSession(ctx.db, user, Object.assign(device(ctx.body), { now: ctx.nowMs }));
      return json(sessionPayload(session, Object.assign({}, user, { emailVerified: true })));
    }
  },

  {
    method: "POST",
    path: "/api/auth/password/forgot",
    handler: async function (ctx) {
      requireEmailTransport(ctx);
      const email = assertEmail(normalizeEmail(str(ctx.body, "email", { required: true, max: 254 })));

      await rateLimit(ctx.db, {
        key: ipKey(ctx, "auth.forgot"), limit: 10, windowSec: 3600, now: ctx.nowMs, action: "reset requests"
      });
      await rateLimit(ctx.db, {
        key: "auth.forgot:email:" + email, limit: 3, windowSec: 900, now: ctx.nowMs,
        action: "reset requests for this email"
      });

      const user = await ctx.db.get(
        "SELECT * FROM users WHERE lower(email) = ? AND deleted_at IS NULL AND password_hash IS NOT NULL",
        email
      );
      if (user) {
        const issued = await issueCode(ctx.db, {
          email: email, purpose: "reset_password", now: ctx.nowMs, pepper: ctx.env.AUTH_PEPPER
        });
        await sendEmail(ctx.env, Object.assign({ to: email }, resetEmail(issued.code)));
      }
      return json({ sent: true }, 202);
    }
  },

  {
    method: "POST",
    path: "/api/auth/password/reset",
    handler: async function (ctx) {
      requireEmailTransport(ctx);
      const email = assertEmail(normalizeEmail(str(ctx.body, "email", { required: true, max: 254 })));
      const code = str(ctx.body, "code", { required: true, min: 6, max: 6 });
      const password = passwordField(ctx.body, "password");
      validatePassword(password, email);

      await rateLimit(ctx.db, {
        key: ipKey(ctx, "auth.reset"), limit: 30, windowSec: 900, now: ctx.nowMs, action: "password resets"
      });
      await rateLimit(ctx.db, {
        key: "auth.reset:email:" + email, limit: 10, windowSec: 900, now: ctx.nowMs,
        action: "password resets for this email"
      });

      const ok = await consumeCode(ctx.db, {
        email: email, purpose: "reset_password", code: code, now: ctx.nowMs, pepper: ctx.env.AUTH_PEPPER
      });
      if (!ok) throw badRequest("invalid_code", "That code is invalid or has expired.");

      const user = await ctx.db.get(
        "SELECT * FROM users WHERE lower(email) = ? AND deleted_at IS NULL AND password_hash IS NOT NULL",
        email
      );
      if (!user) throw badRequest("invalid_code", "That code is invalid or has expired.");

      const passwordHash = await hashPassword(password, ctx.env.AUTH_PEPPER);
      await ctx.db.run("UPDATE users SET password_hash = ? WHERE id = ?", passwordHash, user.id);
      await revokeAllSessions(ctx.db, user.id, ctx.nowMs);

      const session = await createSession(ctx.db, user, Object.assign(device(ctx.body), { now: ctx.nowMs }));
      return json(sessionPayload(session, Object.assign({}, user, { emailVerified: true })));
    }
  },

  {
    method: "POST",
    path: "/api/auth/password",
    auth: true,
    handler: async function (ctx) {
      const user = requireUser(ctx);
      const newPassword = passwordField(ctx.body, "newPassword");
      validatePassword(newPassword, user.email || "");

      const row = await ctx.db.get("SELECT * FROM users WHERE id = ?", user.id);
      if (!row) throw unauthorized();
      if (row.password_hash) {
        const current = passwordField(ctx.body, "currentPassword");
        const valid = await verifyPassword(current, row.password_hash, ctx.env.AUTH_PEPPER);
        if (!valid) throw badRequest("wrong_password", "Current password is incorrect.");
      }

      const passwordHash = await hashPassword(newPassword, ctx.env.AUTH_PEPPER);
      await ctx.db.run("UPDATE users SET password_hash = ? WHERE id = ?", passwordHash, user.id);
      await revokeAllSessions(ctx.db, user.id, ctx.nowMs, user.sessionId || null);
      return json({ ok: true });
    }
  },

  {
    method: "POST",
    path: "/api/auth/google",
    handler: async function (ctx) {
      if (!ctx.env || !ctx.env.GOOGLE_CLIENT_ID) {
        throw unavailable("provider_not_configured", "Google sign-in is not configured.");
      }
      const idToken = str(ctx.body, "idToken", { required: true, max: 12000 });
      const identity = await verifyGoogleIdToken(idToken, ctx.env, ctx.nowMs);
      const user = await ensureUserForIdentity(ctx.db, identity, ctx.nowMs);
      const session = await createSession(ctx.db, user, Object.assign(device(ctx.body), { now: ctx.nowMs }));
      return json(sessionPayload(session, user));
    }
  },

  {
    method: "POST",
    path: "/api/auth/apple",
    handler: async function (ctx) {
      if (!ctx.env || !ctx.env.APPLE_CLIENT_ID) {
        throw unavailable("provider_not_configured", "Apple sign-in is not configured.");
      }
      const identityToken = str(ctx.body, "identityToken", { required: true, max: 12000 });
      const identity = await verifyAppleIdentityToken(identityToken, ctx.env, ctx.nowMs);
      const user = await ensureUserForIdentity(ctx.db, identity, ctx.nowMs);
      const session = await createSession(ctx.db, user, Object.assign(device(ctx.body), { now: ctx.nowMs }));
      return json(sessionPayload(session, user));
    }
  },

  {
    method: "GET",
    path: "/api/auth/session",
    auth: true,
    handler: async function (ctx) {
      const user = requireUser(ctx);
      let session = null;
      if (user.sessionId) {
        const row = await ctx.db.get(
          "SELECT id, device_name, platform, created_at, last_used_at, expires_at " +
          "FROM sessions WHERE id = ? AND user_id = ?",
          user.sessionId, user.id
        );
        if (row) {
          session = {
            id: row.id, deviceName: row.device_name, platform: row.platform,
            createdAt: row.created_at, lastUsedAt: row.last_used_at, expiresAt: row.expires_at
          };
        }
      }
      return json({ user: publicUser(user), session: session });
    }
  },

  {
    method: "GET",
    path: "/api/auth/identities",
    auth: true,
    handler: async function (ctx) {
      const user = requireUser(ctx);
      const rows = await ctx.db.all(
        "SELECT provider, email, created_at, last_used_at FROM auth_identities WHERE user_id = ? ORDER BY created_at",
        user.id
      );
      return json({
        items: rows.map(function (row) {
          return {
            provider: row.provider, email: row.email || null,
            createdAt: row.created_at, lastUsedAt: row.last_used_at
          };
        })
      });
    }
  },

  {
    method: "POST",
    path: "/api/auth/logout",
    auth: true,
    handler: async function (ctx) {
      const user = requireUser(ctx);
      if (user.sessionId) await revokeSession(ctx.db, user.sessionId, user.id, ctx.nowMs);
      return json({ ok: true });
    }
  },

  {
    method: "POST",
    path: "/api/auth/logout-all",
    auth: true,
    handler: async function (ctx) {
      const user = requireUser(ctx);
      await revokeAllSessions(ctx.db, user.id, ctx.nowMs);
      return json({ ok: true });
    }
  },

  {
    method: "GET",
    path: "/api/auth/sessions",
    auth: true,
    handler: async function (ctx) {
      const user = requireUser(ctx);
      const rows = await listSessions(ctx.db, user.id, ctx.nowMs);
      return json({
        items: rows.map(function (row) {
          return {
            id: row.id, deviceName: row.device_name, platform: row.platform,
            createdAt: row.created_at, lastUsedAt: row.last_used_at, expiresAt: row.expires_at,
            current: row.id === user.sessionId
          };
        })
      });
    }
  },

  {
    method: "DELETE",
    path: "/api/auth/sessions/:id",
    auth: true,
    handler: async function (ctx) {
      const user = requireUser(ctx);
      const revoked = await revokeSession(ctx.db, ctx.params.id, user.id, ctx.nowMs);
      if (!revoked) throw notFound("Session");
      return json({ revoked: true, current: ctx.params.id === user.sessionId });
    }
  }
];

export default { routes: routes };
