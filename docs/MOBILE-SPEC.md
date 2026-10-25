# LMTLSS — Mobile Technical Specification

Status: Draft v1.1 (aligned to LMTLSS 2.0: five-pillar navigation, social/growth entities)
Scope: iOS + Android application, backend, integrations
Companion docs: [PRD.md](PRD.md) · [MOBILE-REQUIREMENTS-PROMPT.md](MOBILE-REQUIREMENTS-PROMPT.md)

---

## 1. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| Mobile app | **React Native + TypeScript** (strict mode) | One codebase; native modules where OS features demand it |
| Build workflow | **Expo prebuild / development builds** | Allowed where appropriate. Never assume native capability inside Expo Go; every native module must be confirmed present in the dev build |
| Navigation | React Navigation (native stack + bottom tabs) | Platform-conventional transitions per OS |
| Server state | TanStack Query (or equivalent) with delta-sync hooks | Cache, retry, background refetch |
| Local state | Zustand (session/UI) + **SQLite** (activities, plan, sync queue) | SQLite is source of truth for offline; MMKV for small prefs; SecureStore/Keychain/Keystore for tokens |
| Backend | TypeScript API (NestJS/Fastify or equivalent) + **PostgreSQL** | Stateless; horizontally scalable |
| AI layer | **Independent orchestration service** | Model-provider-agnostic interface (§9) |
| Push | APNs + FCM via one abstraction | Never load-bearing for data integrity |
| Analytics/crash | Privacy-preserving analytics + crash reporter | No health data, no precise routes in events |
| CI/CD | Lint + typecheck + unit tests on PR; E2E on devices per §12; EAS build pipelines for release | |

Rules: platform-specific code isolated behind defined interfaces; reusable design tokens mirroring `css/tokens.css`; every API type shared between client and server via a typed contract package; documented setup in README (`docs/SETUP.md` at implementation time).

## 2. Application architecture

```
feature modules (home/, train/, progress/, coach/, club/, cards/, onboarding/, settings/)
    │  consume
domain layer (pure TS: plan generation, PRs, trends, insights, coach rules
              — direct ports of the Phase 1 js/domain.js reference)
    │  read/write
local data layer (SQLite repositories + sync queue)  ←→  API client (delta sync)
    │                                                      
platform adapters (location, health, notifications, secure storage,
                   share sheet, background tasks) — interface + iOS/Android impls
```

- **Domain logic stays deterministic and testable** — Phase 1's `domain.js` (plan generation, Epley PRs, weekly series, insight provenance, coach rules) ports as-is and its 50-assertion suite carries over to Jest untouched (modulo storage shim).
- **Navigation** follows 2.0 §13: Home · Train · **Club** · Progress · Profile (bottom tabs / native stack), with the AI coach reachable contextually from every tab rather than occupying a tab itself.
- All platform capabilities sit behind adapters with mock implementations for tests.
- Session engine (start/pause/resume/finish, rest timers) is local-only; it never awaits the network.

## 3. Backend architecture

- Stateless API; PostgreSQL as system of record; object storage (S3-compatible) for share-card renders and export archives.
- Services: **API** (auth, CRUD, sync, import, entitlements), **AI orchestrator** (separate deployable, holds provider keys), **worker** (card rendering, export packaging, import processing, retention jobs, notification scheduling, AI eval runs), **admin console** (thin authenticated UI over read-only aggregate analytics: product health, errors, integration status, AI costs — no unnecessary PII).
- Migrations versioned and forward-only; every release lists required migration versions (§13).
- Environment parity: dev / staging / prod with identical schemas.

## 4. Data model (PostgreSQL)

Sport-engine design: one shared activity foundation, sport-specific data isolated and validated.

```
users(id, email, password_hash|oidc_sub, created_at, deleted_at)
profiles(user_id PK, display_name, goal, experience, days_per_week,
         equipment[], limitations, visibility DEFAULT 'private')
sports(id, key UNIQUE 'strength'|'running'|..., schema_version, active)

plans(id, user_id, name, rationale, source 'ai'|'user'|'seeded')
plan_sessions(id, plan_id, day_of_week, sport_id, title, est_minutes, target_rpe)
plan_exercises(id, plan_session_id, exercise_id, target_sets, target_reps,
               target_load, rest_sec)

exercises(id, name, muscle_group, equipment[], movement_pattern, aliases)
exercise_aliases(exercise_id, alias, sport_id)

activities(id UUID PK,              -- client-generated, idempotency key
           user_id, sport_id, title,
           started_at, ended_at, duration_sec,
           visibility DEFAULT 'private',
           source 'manual'|'gps'|'import', device,
           provenance JSONB,          -- per-field: gps|wearable|manual|estimated|derived
           metrics JSONB,             -- sport-schema-validated (JSON Schema per sport)
           notes, location_ref,       -- geometry stored separately (§7)
           created_at, updated_at, deleted_at)
activity_splits(id, activity_id, index, distance_m, duration_sec, pace)
activity_sets(id, activity_id, exercise_id, idx, reps, load, done, rpe)
activity_locations(activity_id PK, geom GEOGRAPHY, sampled_at)  -- separate table
records(id, user_id, kind 'e1rm'|'pace'|'distance'|..., sport_id,
        exercise_id NULL, value, computed_at, provenance, is_estimated)
goals(id, user_id, sport_id, metric, target, due_date, status)
         -- kind='milestone' variant powers "Your Next Milestone" (editable, derived, never fabricated)
readiness_entries(user_id, date, energy, soreness, note)
weekly_snapshots(user_id, week_start, strength_volume, run_meters, sessions,
                 computed_at)          -- cached aggregates for fast home/progress

clubs(id, name, sport_id NULL, owner_id, visibility, created_at)
club_members(club_id, user_id, role, joined_at)
club_posts(id, club_id, user_id, activity_id NULL, text, created_at, hidden_at)
shares(id, user_id, activity_id, kind 'card', visibility, created_at, revoked_at)
events(id, club_id NULL, user_id, sport_id, title, description,
       starts_at, ends_at, timezone,                -- times stored UTC + tz for display/export
       kind 'lmtlss'|'external', organizer_id, organizer_verified,
       location GEOGRAPHY NULL, location_label, map_ref,
       capacity NULL, waitlist_open, price_cents, currency, registration_url,  -- external link-out
       source_provenance JSONB NULL,                 -- provider + fetched_at for external imports
       visibility, created_at, cancelled_at, cancel_reason)
event_attendance(event_id, user_id, status 'going'|'maybe'|'declined'|'waitlist',
                 waitlist_pos, checked_in_at, consent_to_link_activity, at)
challenges(id, owner_club_id NULL, user_id NULL, sport_id NULL, kind 'distance'|'sessions'|'streak'|'custom',
           rules JSONB, starts_at, ends_at, leaderboard_config JSONB, created_at)
challenge_entries(challenge_id, user_id, activity_id NULL, value, valid, flagged_reason)
training_partner_links(id, requester_id, partner_id, status, sport_id NULL, created_at)
referrals(id, referrer_user_id, code UNIQUE, attributed_user_id NULL, consent_at,
          attribution_window, install_at, signup_at, status, fraud_flags)
reactions(id, post_id, user_id, kind, created_at)
public_profiles(user_id PK, handle UNIQUE, enabled, bio, sports[], achievements JSONB,
                updated_at)   -- opt-in; per-activity visibility enforced at query time

devices(id, user_id, platform, push_token, last_seen)
integrations(id, user_id, provider 'healthkit'|'health_connect', status,
             scopes[], last_sync_at, consent_at, revoked_at)
consents(id, user_id, purpose, version, granted_at, withdrawn_at)
exports(id, user_id, status, archive_url, expires_at)
deletion_requests(id, user_id, requested_at, completed_at, audit JSONB)
ai_recommendations(id, user_id, kind, context JSONB, payload JSONB,
                   confidence, shown_at, accepted_at, rejected_at)
import_batches(id, user_id, source 'file'|'healthkit'|'health_connect'|'provider',
               status 'previewed'|'partial'|'committed'|'rejected',
               total, accepted, rejected, dedup_hits, created_at, committed_at)
import_records(batch_id, external_id, external_source, payload JSONB,
               decision 'accept'|'reject'|'dedup-merge', provenance JSONB)  -- preview-before-accept
entitlements(user_id, plan 'free'|'premium'|'clubs', features JSONB,
             provider 'app_store'|'play'|'manual', renews_at, canceled_at)  -- post demand-validation
audit_log(id, actor, action, entity, at, meta)
```

Indexes: `activities(user_id, started_at DESC)`, partial on `deleted_at IS NULL`, `activity_sets(activity_id)`, `updated_at` on all syncable tables (delta cursor), GIN on `metrics` where queried.

**Sport schema validation:** `metrics` is validated against the sport's JSON Schema (`sports.schema_version`) on write, both client- and server-side. Unknown fields rejected, not silently dropped.

## 5. API contracts (REST/JSON, versioned `/v1`)

- Auth: OIDC-compatible; short-lived access tokens (≤15 min) + rotating refresh tokens; refresh tokens revocable per device.
- All writes accept **client-generated UUIDs**; duplicates return `200` with the canonical record (idempotent).
- Errors: RFC 7807 `application/problem+json` (`type`, `title`, `status`, `detail`, `traceId`).
- Pagination: cursor-based (`?cursor=&limit=`).

| Method & path | Purpose |
|---|---|
| `POST /v1/auth/register` · `/login` · `/refresh` · `/logout` | Auth lifecycle |
| `GET/PATCH /v1/me/profile` | Profile |
| `GET /v1/me/export` → job → archive | Data export (J13) |
| `DELETE /v1/me` | Account deletion workflow (J13) |
| `GET /v1/sync?since=<cursor>` | **Delta pull**: all changed rows across syncable tables, ordered `updated_at`, with `next_cursor` |
| `POST /v1/sync/batch` | **Delta push**: array of upserts `{table, id, op, payload}` → per-row results (`applied` \| `conflict` + server copy \| `rejected` + reason) |
| `GET /v1/plan/active` · `PUT /v1/plan` | Plan read/write |
| `POST /v1/activities` (single + batch) | Activity upserts (also via sync batch) |
| `GET /v1/activities?from&to&sport` | History |
| `GET /v1/records` · `/v1/insights` | Derived data (server recomputes; client cache is advisory) |
| `POST /v1/ai/recommendations/:id/accept` `/reject` | AI acceptance instrumentation |
| `POST /v1/ai/coach/ask` | Coach Q&A — **optional path; logging works without it** |
| `CRUD /v1/clubs` · `/v1/clubs/:id/posts` · `/join` `/leave` | Clubs |
| `POST /v1/shares` | Create shareable card record |
| `POST /v1/cards/render/:activityId` | Queue deterministic card render (worker; formats per 2.0 §7) |
| `CRUD /v1/events` · `POST /v1/events/:id/attendance` · `POST .../check-in` | Hosted + external events: RSVP, waitlist, capacity, calendar export (`.ics`), reminders, cancellation fan-out |
| `CRUD /v1/challenges` · `POST /v1/challenges/:id/entries` | Challenges + validated leaderboard entries |
| `POST /v1/referrals/resolve` · `/v1/referrals/:code/attribute` | Referral links; attribution only with recorded consent |
| `GET /v1/public/profiles/:handle` | Logged-out public athlete profile (cached, mobile-first, no private data) |
| `POST /v1/import/uploads` → `GET /preview` → `POST /commit` | History import: per-record preview-before-accept, dedup report, resumable partial commits |
| `GET /v1/me/entitlements` | Entitlement checks for Premium / Clubs / marketplace — **only after demand validation** |
| `GET /v1/integrations` · `POST .../sync` | Health integrations status/trigger |

## 6. Offline and session integrity

- **Local-first**: every session mutation writes SQLite first; UI reads local. Sync is a background concern.
- Active session row persisted on every mutation (set done, pause, distance edit) with `updatedAt` — same contract as Phase 1, extended with recovery-on-reboot.
- **Sync queue**: outbox table of pending mutations with idempotent UUIDs; exponential backoff; replay on connectivity.
- **Conflict rules**: activities/sets are append-corrected (server accepts newest valid version; sets never merge destructively); profile fields are last-writer-wins with server timestamp; plan writes are whole-document versioned (server keeps `plans.history`).
- **Never silently discard**: rejected rows surface to a "needs attention" state with retry and export escape hatch. Metric: data-loss events = 0.
- Duplicate protection: UUID idempotency + HealthKit dedup keys (`source_id`/`start+duration+type`).
- Elapsed-time integrity: session clock computed from persisted `elapsedBase` + bounded deltas; idle gap > 10 min resumes paused (Phase 1 behavior, asserted by tests).

## 7. GPS and background activity

| Concern | Requirement |
|---|---|
| Permissions | Foreground-first: request `when-in-use` (iOS) / fine location (Android) at run start with in-context rationale. Background (`always` / foreground service) requested only after user enables background tracking |
| Android background | Foreground service with persistent notification (type `location`/`fitness`), compliant with background-start restrictions |
| iOS background | `background-modes: location`; significant-change/pause APIs used appropriately |
| Degradation | UI states one of: `GPS active` / `GPS weak (n fixes/min)` / `time only`. Permission denied or revoked → time-only mode with explanation, session continues |
| Battery | Auto-pause when stationary; adaptive sampling; no high-accuracy mode when route recording is off |
| Recording service | Shared interface + platform impls; **local point buffering during the run** (network loss must not destroy it); noise/invalid-point filtering before distance/pace math; dedupe keys prevent duplicate activity records on sync retries |
| Route rendering | Licensed mapping solution behind a documented adapter (verify tile/data costs and licensing — "free library ≠ free map data"); routes render **only actual recorded coordinates** — never fabricated. **Decided 2026-10-19: MapLibre RN + OpenFreeMap** — see [MAP-ADAPTER-DECISION](MAP-ADAPTER-DECISION.md) |
| Validation | Timestamps monotonic; coordinates sanity-checked (speed/altitude bounds); distance recomputed server-side from track; mismatch flags record for review |
| Honesty | Never promise uninterrupted tracking on every device/OS setting |

Location geometry lives in `activity_locations`, never in analytics/logs; card sharing uses a generalized track (simplify algorithm) and excludes start/end radius by default.

## 8. Health and wearable integrations

| | iOS HealthKit | Android Health Connect |
|---|---|---|
| MVP read | workouts, active energy, steps, sleep (if granted) | same type set |
| MVP write | completed LMTLSS workouts (type, duration, distance, energy) | same |
| Consent | In-app education screen → system prompt; scopes stored in `integrations` with `consent_at` | same |
| Dedup | `sourceId` persisted; round-trip re-imports ignored by key | equivalent metadata key |
| Conflicts | Health store wins for its types when both exist; UI marks merged rows `source: health` | same |

Rules: minimum-necessary permissions; import/export behavior and provenance documented per type in-app; revocation tolerated (app fully functional, integration screen shows disconnected). Third-party providers (Garmin/Fitbit/WHOOP) only after verifying API access, licensing, auth, and platform background constraints — **not in MVP**.

**General third-party adapters (Snapchat, Instagram, mapping, fitness platforms):** independent adapter per service with a documented capability matrix — supported platforms, auth/permissions, available API/SDK capabilities, data types and sync direction, rate limits/costs, error handling, privacy implications, integration tests, and explicitly listed **unsupported** features. Investigate before implementing (Snap Kit, Instagram share mechanisms); never promise direct publishing or friend-graph access without verified support; the native share sheet remains the guaranteed fallback. **Failure of any social adapter must never block recording, saving, or export of an activity.**

## 9. AI orchestration

- All model calls go through the orchestrator; the mobile client never holds provider keys.
- **Deterministic first** (PRD §9 table): metrics/PRs/timers never invoke a model.
- **Evaluation gates**: each capability carries a versioned eval suite run as a CI gate (beginners, advanced, conflicting goals, incomplete data, missed sessions, unsafe requests); a capability cannot ship or widen scope while its evals fail — see PRD §9 "AI trust and evaluation".
- Structured outputs: JSON Schema per feature (plan patch, substitution suggestion, explanation), validated before persistence; invalid output → retry → fallback (cached/rule-based) → degraded UI, never an error wall.
- Budgets: coach answer p95 < 2.5 s (streamed where possible); plan generation < 8 s with progressive UI; per-user daily token quotas; global cost dashboard (usage, latency, error rate, $/DAU) with alerting.
- Reliability: timeouts (8 s), one retry with jitter, provider failover across ≥2 model vendors behind the same interface, circuit breaker.
- **Logging and workout flows must function fully with AI unavailable** (PRD J11).
- Prompts pin user context from validated stores only (recent activities, plan, profile) — never free-text assumptions; every recommendation persisted with `context` snapshot for auditability.

## 10. Notifications

- Categories: training reminder, club activity, weekly progress summary, coaching follow-up. All opt-in, granular, quiet-hours aware (platform-supported), capped (no more than 1 scheduled training reminder/day unless user raises it).
- Local notifications for session timing (do not depend on push delivery); push (APNs/FCM) for club/social and cross-device events.
- Never used for data integrity or session persistence. Token lifecycle: register/rotate/invalidate per device on logout.

## 11. Security

- Transport TLS 1.2+ (1.3 preferred); DB encrypted at rest (provider KMS); sensitive fields (routes before generalization, integration tokens) additional field-level encryption.
- Tokens: access in memory; refresh in Keychain/Keystore (expo-secure-store); rotation with reuse detection → session revocation.
- Server: authorization per row (`user_id` scoping; club membership checks on every club read/write); rate limits on auth and AI endpoints; parameterized queries only; schema validation on every write.
- Secrets server-side only (managed secret store, documented env vars); no secrets in client builds, logs, or crash reports.
- Logging policy: no health data, no precise routes, no tokens/PII in logs; log sampling for request bodies.
- Account deletion: soft-delete → purge job across primary + analytics + object storage within stated window; `deletion_requests` audit retained; export available before deletion.
- App threats: screenshot-sensitive screens flagged, jailbreak/root detection advisory-only, certificate pinning for auth endpoints (with documented rotation plan).

## 12. Performance budgets & testing

**Budgets** (measured on low-end reference Android + base iPhone):

| Interaction | Budget |
|---|---|
| Cold start → interactive Home | ≤ 2.5 s |
| Screen transition | ≤ 300 ms (p95) |
| Log set (tap → persisted in UI) | ≤ 100 ms local |
| Start run → timer visible | ≤ 1 s |
| API list reads (cached) | ≤ 500 ms (p95) |
| Battery (1 h GPS run) | ≤ 8%/h reference device |
| Crash-free sessions | ≥ 99.5% |

**Test layers:** domain unit tests (Phase 1 suite carried over) · API integration tests (contract + authz matrix) · DB migration tests · E2E on real devices via Maestro/Detox covering every PRD journey on **both** platforms · accessibility checks (contrast, labels, dynamic type/large font, screen-reader traversal, touch target ≥44pt) · GPS simulation tests (permission grant/deny/revoke, signal loss, background 30 min) · session-recovery tests (kill, reboot-feasible state, clock integrity) · sync tests (offline queue, duplicate replay, conflict, partial failure) · security checks (authz negative tests, secrets scan, dependency audit) · performance budget CI gates · regression suite per release.

**Device matrix:** iOS current + previous major (iPhone SE-class low end, one iPad if universal), Android API 26+ with low-RAM reference device. Simulator runs never alone qualify a feature (PRD §5.1).

## 13. Release and delivery

Deliverables with the first release candidate:

1. Complete mobile source + monorepo layout (`app/`, `server/`, `ai/`, `shared/`, `docs/`)
2. Reproducible setup (`docs/SETUP.md`): tool versions, `.env.example` per service, emulator/device steps
3. Build instructions: dev build, staging, production (EAS profiles for iOS/Android; signing documented)
4. Environment-variable documentation (names, purpose, which are owner-provided: Apple Developer account, signing certs, FCM/APNs creds, DB, model-provider keys)
5. Database migrations + rollback notes; backend configuration
6. Automated test results (CI dashboard) incl. the carried-over domain suite
7. **Feature-by-platform compatibility matrix** (feature × iOS × Android: supported/limited/unsupported + notes)
8. Known limitations and unresolved issues list — living document
9. TestFlight internal track + Android internal track (beta) before any public submission
10. Store metadata, privacy nutrition labels, permission strings (user-facing, plain-language), data-retention policy page

Account/enrollment prerequisites flagged for the product owner up front: Apple Developer Program, Google Play developer account, push certs, Health Connect listing requirements.

## 14. First vertical slice (next build increment)

**Onboarding → personalized plan → workout or run → saved activity → progress summary → shareable card.**

Scope: strength + running only; local-first with sync behind a flag; no clubs, no AI chat (plan generation may use AI behind the orchestrator with rule-based fallback); design system ported from Phase 1 tokens.

Acceptance (Definition of Done for the slice):

1. New user reaches a generated plan in ≤ 60 s (J2) on both platforms
2. Full strength session logged with rest timer; app killed mid-session → recovered intact (J4/J5/J7)
3. Full run recorded; GPS-granted and GPS-denied paths both complete; provenance labeled (J6)
4. Activity appears in history + progress with record/insight provenance; domain suite green in CI (J8)
5. Shareable card generated deterministically, excludes sensitive location by default (J9)
6. All performance budgets met on reference devices; E2E happy paths green on iOS + Android
7. Honest-state audit: no visible feature that isn't implemented; integrations screen truthful

The slice is the proof of the product's core value, technical foundation, visual quality, and growth loop — before any sport beyond strength and running is scheduled.
