-- LMTLSS server schema, migration 0001.
--
-- Target: Cloudflare D1 (SQLite) and, for local tests, node:sqlite.
-- Both speak the same dialect, so the API is verified against real SQLite in
-- `npm run test:server` and runs unchanged on D1.
--
-- Rules encoded here:
--   * No table stores payment card data. Provider ids only.
--   * Precise athlete coordinates live only in location_shares, only while the
--     athlete has explicitly opted in, always with an expiry.
--   * Anyone can read public communities/events; everything else is scoped by
--     membership or ownership and re-checked server-side on every request.
--   * Sports are an open vocabulary (TEXT), validated against the shared sport
--     model, so adding a sport never needs a migration.

-- The migration ledger exists in the .sql file as well as in migrate.js so a
-- database migrated by `wrangler d1 migrations apply` is recognised by the
-- Worker migrator instead of being re-run.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  auth_provider TEXT NOT NULL,
  auth_subject  TEXT NOT NULL,
  email         TEXT,
  platform_role TEXT NOT NULL DEFAULT 'athlete' CHECK (platform_role IN ('athlete', 'moderator', 'admin')),
  created_at    TEXT NOT NULL,
  deleted_at    TEXT,
  UNIQUE (auth_provider, auth_subject)
);

-- Athlete identity. Visibility is per element, defaulting to "not shared".
CREATE TABLE profiles (
  user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name     TEXT NOT NULL DEFAULT '',
  bio              TEXT NOT NULL DEFAULT '',
  city             TEXT NOT NULL DEFAULT '',
  area_label       TEXT NOT NULL DEFAULT '',
  experience       TEXT,
  avatar_url       TEXT NOT NULL DEFAULT '',
  public_workouts  INTEGER NOT NULL DEFAULT 0,  -- workouts default to private
  show_communities INTEGER NOT NULL DEFAULT 0,
  show_events      INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE athlete_sports (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport      TEXT NOT NULL,
  level      TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'community', 'public')),
  PRIMARY KEY (user_id, sport)
);

-- One training session of any sport. `metrics_json` holds the sport-specific
-- vocabulary (rounds, sets, sets won, holes, score) validated against the sport
-- model in shared/src/domain.ts — a run can never carry rounds.
CREATE TABLE activities (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport        TEXT NOT NULL,
  title        TEXT NOT NULL DEFAULT '',
  started_at   TEXT NOT NULL,
  duration_sec INTEGER,
  distance_m   REAL,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  provenance   TEXT NOT NULL DEFAULT 'manual' CHECK (provenance IN ('manual', 'device', 'imported', 'seeded')),
  visibility   TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'friends', 'community', 'public')),
  notes        TEXT NOT NULL DEFAULT '',
  rpe          INTEGER,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_activities_user_time ON activities(user_id, started_at DESC);
CREATE INDEX idx_activities_public ON activities(visibility, started_at DESC);

CREATE TABLE personal_records (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport      TEXT NOT NULL,
  metric     TEXT NOT NULL,
  value      REAL NOT NULL,
  achieved_at TEXT NOT NULL,
  activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
  UNIQUE (user_id, sport, metric)
);

CREATE TABLE goals (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport       TEXT NOT NULL,
  metric      TEXT NOT NULL,
  target      REAL NOT NULL,
  due_date    TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
  created_at  TEXT NOT NULL
);

-- ---------- Clubs ----------

CREATE TABLE communities (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  sport        TEXT NOT NULL,
  city         TEXT NOT NULL DEFAULT '',
  area_label   TEXT NOT NULL DEFAULT '',
  lat          REAL,
  lon          REAL,
  visibility   TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  join_policy  TEXT NOT NULL CHECK (join_policy IN ('open', 'approval')),
  avatar_url   TEXT NOT NULL DEFAULT '',
  cover_url    TEXT NOT NULL DEFAULT '',
  created_by   TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL,
  archived_at  TEXT
);
CREATE INDEX idx_communities_discovery ON communities(visibility, archived_at, sport, city);

CREATE TABLE community_members (
  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'banned')),
  joined_at    TEXT NOT NULL,
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX idx_community_members_user ON community_members(user_id, status);
CREATE INDEX idx_community_members_pending ON community_members(community_id, status);

CREATE TABLE community_posts (
  id           TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  author_id    TEXT NOT NULL REFERENCES users(id),
  kind         TEXT NOT NULL DEFAULT 'post' CHECK (kind IN ('post', 'announcement')),
  body         TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  edited_at    TEXT,
  deleted_at   TEXT
);
CREATE INDEX idx_community_posts_feed ON community_posts(community_id, created_at DESC);

-- ---------- Events ----------

CREATE TABLE events (
  id                    TEXT PRIMARY KEY,
  community_id          TEXT REFERENCES communities(id) ON DELETE SET NULL,
  organizer_id          TEXT NOT NULL REFERENCES users(id),
  title                 TEXT NOT NULL,
  sport                 TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  starts_at             TEXT NOT NULL,
  ends_at               TEXT,
  time_zone             TEXT NOT NULL,
  venue_name            TEXT NOT NULL DEFAULT '',
  venue_area            TEXT NOT NULL DEFAULT '',
  area_lat              REAL,
  area_lon              REAL,
  capacity              INTEGER,
  registration_deadline TEXT,
  cost_minor            INTEGER NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'MXN',
  visibility            TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'community', 'private')),
  status                TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'cancelled')),
  rules                 TEXT NOT NULL DEFAULT '',
  cancellation_policy   TEXT NOT NULL DEFAULT '',
  contact               TEXT NOT NULL DEFAULT '',
  created_at            TEXT NOT NULL
);
CREATE INDEX idx_events_discovery ON events(status, visibility, starts_at);
CREATE INDEX idx_events_community ON events(community_id, starts_at);
CREATE INDEX idx_events_organizer ON events(organizer_id, starts_at DESC);

CREATE TABLE event_registrations (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('registered', 'waitlist', 'cancelled', 'checked_in')),
  position   INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, user_id)
);
CREATE INDEX idx_event_registrations_event ON event_registrations(event_id, status, position);

-- Group sessions are community-scoped events; this table only links them for
-- the community feed so the event authority stays in one place.
CREATE TABLE community_sessions (
  id           TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  UNIQUE (community_id, event_id)
);

-- ---------- Coaches ----------

CREATE TABLE coaches (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  headline     TEXT NOT NULL DEFAULT '',
  bio          TEXT NOT NULL DEFAULT '',
  city         TEXT NOT NULL DEFAULT '',
  area_label   TEXT NOT NULL DEFAULT '',
  remote       INTEGER NOT NULL DEFAULT 0,
  in_person    INTEGER NOT NULL DEFAULT 1,
  languages    TEXT NOT NULL DEFAULT '',
  contact      TEXT NOT NULL DEFAULT '',
  verified     INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'suspended')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_coaches_public ON coaches(status, city);

CREATE TABLE coach_specialties (
  coach_id TEXT NOT NULL REFERENCES coaches(user_id) ON DELETE CASCADE,
  sport    TEXT NOT NULL,
  PRIMARY KEY (coach_id, sport)
);

CREATE TABLE coach_qualifications (
  id       TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL REFERENCES coaches(user_id) ON DELETE CASCADE,
  title    TEXT NOT NULL,
  issuer   TEXT NOT NULL DEFAULT '',
  year     INTEGER,
  url      TEXT NOT NULL DEFAULT '',
  verified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE coach_classes (
  id           TEXT PRIMARY KEY,
  coach_id     TEXT NOT NULL REFERENCES coaches(user_id) ON DELETE CASCADE,
  sport        TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  starts_at    TEXT NOT NULL,
  duration_min INTEGER,
  capacity     INTEGER,
  price_minor  INTEGER NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'MXN',
  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'cancelled')),
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_coach_classes_public ON coach_classes(status, starts_at);

-- Subscription state is written only by verified provider webhooks.
CREATE TABLE subscriptions (
  id                       TEXT PRIMARY KEY,
  user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product                  TEXT NOT NULL CHECK (product IN ('coach')),
  provider                 TEXT NOT NULL,
  provider_customer_id     TEXT,
  provider_subscription_id TEXT UNIQUE,
  status                   TEXT NOT NULL CHECK (status IN ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'expired')),
  price_minor              INTEGER NOT NULL,
  currency                 TEXT NOT NULL,
  current_period_end       TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL
);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id, status);

-- Webhook idempotency: one row per provider event, processed once.
CREATE TABLE webhook_events (
  id                TEXT PRIMARY KEY,
  provider          TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  kind              TEXT NOT NULL DEFAULT '',
  received_at       TEXT NOT NULL,
  processed_at      TEXT,
  error             TEXT,
  UNIQUE (provider, provider_event_id)
);

-- ---------- Store ----------

CREATE TABLE products (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL,
  sport       TEXT,
  currency    TEXT NOT NULL DEFAULT 'MXN',
  price_minor INTEGER NOT NULL,
  image_url   TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_products_catalog ON products(status, category, sport);

CREATE TABLE product_variants (
  id              TEXT PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku             TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  price_minor     INTEGER,
  inventory_count INTEGER,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))
);
CREATE INDEX idx_product_variants_product ON product_variants(product_id, status);

CREATE TABLE carts (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id)
);

CREATE TABLE cart_items (
  cart_id    TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  added_at   TEXT NOT NULL,
  PRIMARY KEY (cart_id, variant_id)
);

-- Totals are recomputed server-side from product_variants; the client never
-- supplies a price.
CREATE TABLE orders (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
  currency            TEXT NOT NULL,
  subtotal_minor      INTEGER NOT NULL,
  total_minor         INTEGER NOT NULL,
  provider            TEXT,
  provider_payment_id TEXT,
  shipping_name       TEXT NOT NULL DEFAULT '',
  shipping_address    TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);

CREATE TABLE order_items (
  id               TEXT PRIMARY KEY,
  order_id         TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id       TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  unit_price_minor INTEGER NOT NULL,
  quantity         INTEGER NOT NULL,
  line_total_minor INTEGER NOT NULL
);

-- ---------- Map: facilities and opt-in presence ----------

CREATE TABLE facilities (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  sport      TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'other',
  city       TEXT NOT NULL DEFAULT '',
  area_label TEXT NOT NULL DEFAULT '',
  lat        REAL NOT NULL,
  lon        REAL NOT NULL,
  source     TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'official')),
  verified   INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_facilities_area ON facilities(sport, city);

CREATE TABLE location_prefs (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ghost_mode    INTEGER NOT NULL DEFAULT 1,  -- sharing OFF until explicitly turned on
  audience      TEXT NOT NULL DEFAULT 'friends' CHECK (audience IN ('friends', 'community', 'public')),
  updated_at    TEXT NOT NULL
);

-- Only ever written on explicit opt-in, always with an expiry ≤ 4 h.
-- Hotspot aggregation reads this with a minimum-group threshold and grid
-- coarsening, so no single athlete is ever plotted for the public.
CREATE TABLE location_shares (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat        REAL NOT NULL,
  lon        REAL NOT NULL,
  accuracy_m REAL,
  audience   TEXT NOT NULL CHECK (audience IN ('friends', 'community', 'public')),
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_location_shares_live ON location_shares(expires_at);

-- ---------- Moderation, reports, notifications ----------

CREATE TABLE reports (
  id          TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('community', 'post', 'user', 'event')),
  target_id   TEXT NOT NULL,
  reason      TEXT NOT NULL,
  details     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at  TEXT NOT NULL,
  reviewed_at TEXT,
  reviewer_id TEXT REFERENCES users(id)
);
CREATE INDEX idx_reports_queue ON reports(status, created_at);

CREATE TABLE moderation_actions (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  reason      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  data_json  TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  read_at    TEXT
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

-- ---------- Abuse control ----------

CREATE TABLE rate_counters (
  bucket_key   TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL,
  PRIMARY KEY (bucket_key, window_start)
);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (1, '0001_init', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
