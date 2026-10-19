# LMTLSS ecosystem plan — Phase Zero inspection and phased implementation

Status: Track (all sports) and the server foundation implemented; Clubs and Events have a tested API (not deployed, not yet called by the web app). Remaining modules blocked on provider decisions (see §7).
Date: 2026-10-18 (updated).

## 1. What the codebase actually is

| Layer | Reality |
|---|---|
| Frontend (web) | Static `index.html` + `css/` + `js/`. No build step, no framework, no runtime dependencies. Modules are IIFEs on `window`. |
| Frontend (mobile) | `app/` — Expo + React Native, TypeScript strict. **M0 scaffold only**: one screen, one smoke test. |
| Shared logic | `shared/` — pure TypeScript port of `js/domain.js`, enforced by a parity test that fails on any public-API drift. |
| Persistence | `localStorage` via `js/store.js`. `SCHEMA_VERSION = 1`. **No migration layer** (known backlog P0-1). |
| Backend | **None.** No server, no API, no database, no auth. Grep-verified: zero `fetch`/XHR/WebSocket/geolocation in `js/`. |
| Payments | None. |
| Maps | None. No provider, no tiles, no coordinates. |
| Tests | Browser harness `tests.html` (**214 assertions**), `shared` Jest (**109 tests**), `app` Jest (1 smoke), `server/` node:test (**60 tests**). |

Consequence: modules that require shared state between people (clubs, map, store, events, coach subscriptions) cannot be built honestly in the current architecture. They need a backend. Modules that operate on one athlete's own data can.

## 2. Feature inventory

### Module A — LIMITLESS TRACK
| Capability | State |
|---|---|
| Start/pause/resume/finish session, clock persistence, idle-freeze | **Exists** (strength + running) |
| Manual distance entry with provenance labeling | **Exists** |
| Structured interval runs with recorded segments | **Exists**, but unreachable — no plan or picker creates an interval template |
| Sport-specific metric model (14 sports, per-sport vocabulary, validation) | **Implemented this phase** — see §3 |
| Sport picker → sport-specific logging form | **Missing** — UI still hardcodes strength/running |
| Heart rate, calories, wearables, GPS | **Missing** and not faked anywhere |
| Goals | **Partial** (plan targets only, no goal objects) |
| Records, trends, history, PRs | **Exists** |
| Share an activity | **Engine exists, unwired** — `js/sharecards.js` has compose/render/export/share and a privacy trim, but no screen calls it |
| Per-activity visibility controls | **Missing** |

### Module B — CLUBS
Missing entirely: no community entity, membership, posts, roles, moderation, or reporting. Requires backend + auth + moderation tooling.

### Module C — MAP
Missing entirely: no coordinates in the schema, no provider, no location permissions, no presence model. `js/sharecards.js` contains route geometry (`projectRoute`, `trimRoute`) that is deliberately inert until real GPS exists.

### Module D — COACH
Missing entirely: no coach profiles, no subscription, no entitlement checks. The repo contains a pricing/entitlement engine (`js/pricing.js`) and money primitives (integer minor units) that a coach subscription would reuse.

### Module E — STORE
Missing entirely: no products, cart, orders, inventory or fulfilment. Requires payments and a server-side order authority.

### Module F — EVENTS
Missing entirely: no event entity, registration, capacity or waitlist. Requires backend for capacity correctness.

### Cross-cutting
Profiles exist for a single athlete (name, goal, sports, experience, equipment). Achievements derive from logs. Notifications, moderation, and data export do not exist.

## 3. What this phase implemented

**Sport and activity model** — the foundation every other module filters on.

- `js/domain.js`: `METRICS`, `SPORTS` (14 sports across endurance / strength / combat / racket / precision / team), `sportById`, `sportsInGroup`, `metricDefs`, `formatMetric`, `activityMetrics`, `validateActivity`.
- `shared/src/domain.ts`: identical port with `MetricDef`, `SportDef`, `ActivityInput`, `ActivityError` types. Parity test passes, so web and mobile cannot drift.
- Tests: **18 new browser assertions** (209 total) and **14 new Jest tests** (109 total).

Design rules encoded:
- A sport declares the metrics it *can* record; an activity renders only those it *has*. A run can never show rounds; a golf round can never show pace.
- Derived metrics (pace, speed) appear only when both inputs exist — never a placeholder number.
- Validation rejects impossible values (negative duration, fractional reps, implausible maxima) and names the failing field, but ignores metrics the sport does not record rather than erroring on them.
- Absent means absent: nothing is defaulted or fabricated.

## 4. Sequencing

| Phase | Scope | Depends on | Test gate |
|---|---|---|---|
| **P1 (done)** | Sport model | — | parity + both suites green |
| **P2 (done)** | Sport picker and per-sport logging UI; manual entry for every sport | P1 | browser assertions on validation paths |
| **P3 (done)** | Share card wired to the post-workout summary, for every sport | — | card composition + provenance assertions |
| **P4** | Activity visibility controls (client) + activity sync endpoint | P3 | composition tests for hidden fields |
| **P5 (done)** | Backend foundation: Worker + D1 schema/migrations, auth seam, rate limiting, error shape, identity endpoints | decision | 60 server tests (`npm run test:server`) |
| **P6 (API done)** | Clubs: discovery, membership + approval, posts, roles, bans, reports | P5 | permission-matrix tests in `server/tests/communities.test.js` |
| **P7 (API done)** | Events: capacity, duplicate prevention, waitlist + auto-promotion, deadlines, cancellation, check-in | P5 | capacity/waitlist tests in `server/tests/events.test.js` |
| **P7b** | Web client for Clubs/Events (Discover surface) + hosting that serves app and API together | P6, P7 | browser assertions |
| **P8** | Coach profiles + $29/mo subscription with signed webhooks | P5 + payments | entitlement + replay/idempotency tests |
| **P9** | Map (facilities and public events first; presence last) | P5 + provider | privacy-threshold tests |
| **P10** | Store (curated catalog, cart, checkout) | P5 + payments | order integrity tests |

Server code lives in `server/` with its own README: `npm run test:server` runs the real handlers against in-memory SQLite (the same dialect D1 uses) with real signed tokens. Nothing is deployed, no provider keys exist, and the web app makes no network calls yet — so no screen may claim a backend-backed capability works.

## 5. Privacy and honesty constraints that shape the architecture

- **No fabricated data, ever.** No demo communities, facilities, events, athletes, inventory or live counts in production paths. Empty states must say what is missing.
- **Location is opt-in, temporary by default, and revocable.** Aggregated hotspots require a minimum group size plus spatial and temporal coarsening, computed server-side. Start/finish buffers already exist in the card renderer.
- **Payments are server-authoritative.** Entitlement is granted only on a verified webhook, never on a client flag. Card data never touches this codebase.
- **Communities are free.** Business/academy profiles are a separate concept from athlete-created communities.
- Client-side checks are UX only; every privileged operation needs server-side authorization.

## 6. Known debt that will bite during this work

- **`SCHEMA_VERSION` has no migration path.** `store.js` resets unknown versions to empty state. Adding new persisted entities (clubs, events, orders) *requires* the migration layer first, or a version bump will silently discard user data.
- `js/screens-progress.js` and the mockup page are fine, but the interval UI is unreachable (see inventory), and the Recover screen prints `3.0 / 3.0 soreness` where energy and soreness should be separately labeled.
- The Expo app is a scaffold: every mobile screen in these modules is new work, not a port.

## 7. Decisions required before P5

These cannot be guessed, and the spec explicitly forbids assuming them. Each needs the user's accounts, credentials, or a cost commitment.

1. **Hosting and backend shape** — serverless (Workers/Functions + D1/Postgres) versus a managed BaaS (auth + database + storage in one).
2. **Authentication** — the provider determines session model, deep-link callbacks, and mobile configuration.
3. **Payments** — coach subscriptions and store checkout both need a provider with signed webhooks, plus tax handling; the $29 figure is a configurable assumption, not an approved price.
4. **Map provider** — needed for P9 only; meaningless before GPS capture and facilities data exist.
5. **Push notifications** — provider choice affects both platforms' credential setup.

Until those are settled, P2 and P3 are the only work that can ship without inventing infrastructure.
