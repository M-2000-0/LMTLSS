-- LMTLSS server schema, migration 0002: accounts and sessions.
--
-- One person can sign in with a password, Google, or Apple. auth_identities is
-- the link between a provider subject and one LMTLSS user, so attaching a
-- second provider never creates a second account.
--
-- Sessions are opaque random tokens. Only the SHA-256 of the token is stored,
-- so a database read cannot be replayed as a login. Email codes are stored the
-- same way: the six digits are never written in plaintext.

ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN password_hash TEXT;

CREATE UNIQUE INDEX idx_users_email_unique ON users(lower(email)) WHERE email IS NOT NULL AND email <> '';

CREATE TABLE auth_identities (
  provider     TEXT NOT NULL,
  subject      TEXT NOT NULL,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email        TEXT,
  created_at   TEXT NOT NULL,
  last_used_at TEXT,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX idx_auth_identities_user ON auth_identities(user_id);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  device_name  TEXT NOT NULL DEFAULT '',
  platform     TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  revoked_at   TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id, revoked_at, expires_at);

CREATE TABLE email_codes (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  purpose     TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  code_hash   TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT
);
CREATE INDEX idx_email_codes_lookup ON email_codes(email, purpose, consumed_at, created_at DESC);

CREATE TABLE consents (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  version     TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  PRIMARY KEY (user_id, kind)
);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (2, '0002_auth', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
