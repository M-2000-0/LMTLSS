# LMTLSS — Platform Blueprint (research-verified)

**Date:** 2026-10-17 · Extends (does not replace) `AUDIT-REPORT.md` (code state-of-truth), `PRD.md`, `MASTER-PROMPT.md`, `MOBILE-SPEC.md`, `BUILD-PLAN.md`.

**Method:** repository audit already completed (see AUDIT-REPORT). External assumptions verified against primary sources on this date. Claims are labeled **[V] verified from primary source**, **[R] reasoned conclusion**, **[H] untested hypothesis**, **[D] decision**.

---

## 1. What exists to build on (from the audit — no re-auditing)

LMTLSS today is a **dependency-free static web app** (6.6k lines, 0 network calls, browser test suite at 109/109 assertions). It is the design-system and interaction reference, **not** the mobile platform. Real, tested assets that carry forward:

| Asset | Location | Carries to mobile as |
|---|---|---|
| Pure domain logic: plan generation, e1RM/PRs, trends, honest insights, coach rules | `js/domain.js` | Shared TypeScript core (~1:1 port) |
| Pure pricing/entitlement engine (precedence, offers, quotas, audit) | `js/pricing.js` | Server-side billing service reference |
| Session clock math + idle-freeze recovery | `Domain.elapsedSec` / `resumeSession` | Recording state-machine core |
| Schema with migration + quarantine (no silent data loss) | `js/store.js` | Migration discipline for server DB |
| Design tokens (black canvas, #61EB1A accent, functional-color rule) | `css/tokens.css` | Shared design system |
| Honesty invariant: unimplemented = "Unavailable", provenance labels on every metric | `AGENTS.md` | Product invariant, keep forever |

**[D]** Nothing in this blueprint requires rewriting the web app. It stays as reference + marketing surface until the native shell lands.

## 2. Verified integration facts (highest-risk assumptions — now verified)

### 2.1 Apple HealthKit / Apple Watch [V]
Reading, watch-side recording, and writing are **three separate capabilities**:
- **Read**: `HKWorkout`, `HKWorkoutRoute` (via `HKWorkoutRouteQuery`), granular per-type read/write authorization, background delivery via `HKObserverQuery`. Note: an app cannot distinguish "denied read" from "no data" — design for empty results. ([HealthKit docs](https://developer.apple.com/documentation/healthkit/hkworkout), [route data](https://developer.apple.com/documentation/healthkit/reading-route-data))
- **Watch recording**: requires a **native watchOS target** (`HKWorkoutSession` + `HKWorkoutBuilder`, Workout-processing background mode). An iPhone-only app **cannot** claim a watch workout app. ([Running workout sessions](https://developer.apple.com/documentation/healthkit/running-workout-sessions), WWDC25 §322)
- **Write**: separate share authorization; use builder APIs so Activity rings update. ([HealthKit setup](https://developer.apple.com/documentation/healthkit/setting-up-healthkit))
- **Compliance**: HealthKit entitlement + usage strings; privacy nutrition labels; Guideline 5.1.3 forbids using health data for advertising/mining. ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/))
- **[D]** No licensing fee, no partner approval. Best data quality per effort. **First integration.**

### 2.2 Google Health Connect (Android) [V]
- On-device API (not cloud): read/write `ExerciseSessionRecord`; routes need extra permissions + user consent dialog; **history limited to 30 days before first grant** unless the extra history permission is requested. ([Health Connect routes](https://developer.android.com/health-and-fitness/health-connect/features/exercise-routes), [read/history](https://developer.android.com/health-and-fitness/health-connect/read-data))
- Play release requires Data Safety + Health Apps declarations per data type. ([publishing](https://developer.android.com/health-and-fitness/health-connect/publish))
- **[D]** Parity with HealthKit on Android; same milestone.

### 2.3 Strava [V]
- OAuth scopes: `activity:read` / `activity:read_all` (adds Only-You + privacy-zone data) / `activity:write` (uploads). Historical fetch supported via date-filtered, paginated athlete-activities endpoint. ([authentication](https://developers.strava.com/docs/authentication/))
- **Rate limits are per application**: 200 req/15 min + 2,000/day (uploads separate); new apps are Single-athlete; capacity upgrade to 10 then **review required**. ([rate limits](https://developers.strava.com/docs/rate-limits/))
- **Webhooks** exist (create/delete/edit/deauth); callback must ACK 200 within 2 s, ≤3 retries. ([webhooks](https://developers.strava.com/docs/webhooks/))
- **Tight data rules** (API Policy, effective 2026-06-01): cache ≤7 days; propagate deletions ≤48 h; deletion on request; **no selling/licensing Strava data**; cannot charge for Strava-provided/substantially duplicative functionality; "View on Strava" attribution; Standard Tier may require Strava subscriptions. ([API policy](https://www.strava.com/legal/api_policy), [brand](https://developers.strava.com/guidelines/))
- **[D]** Compliant as an **import source only**, with `activity:read_all`, 7-day cache discipline, and deletion propagation built in from day one. Never a data resale or account system.

### 2.4 Garmin [V]
- Connect Developer Program is **application/approval-gated** (business use); Health API explicitly says **commercial use requires a license fee** (amounts unpublished). Activity API reads FIT/GPX/TCX activities; Training/Courses APIs **write** workouts/courses to Connect → synced to device. No published numeric rate limits; docs incomplete ("Stay tuned"). ([program](https://developer.garmin.com/gc-developer-program/), [FAQ](https://developer.garmin.com/gc-developer-program/program-faq/), [Health API](https://developer.garmin.com/gc-developer-program/health-api/))
- **[D]** Defer to post-MVP. Apply only after Apple/Android integrations are live and demand is proven. Treat any Garmin-sourced data with its attribution requirements.

### 2.5 Secondary providers [V/R]
- **Fitbit**: legacy Web API shuts down **2026-09-30 (off 2026-10-30)**; successor Google Health API needs privacy/security review, re-consent, no token transfer. **[R]** Skip Fitbit legacy entirely; target Google Health API when stable. ([Google Health](https://developers.google.com/health/about))
- **Polar AccessLink**: self-service OAuth, broad data incl. FIT/GPX, webhooks. **COROS**: partner-gated, workouts + FIT, ~5-min summary webhooks, 1,000 calls/min. **Suunto**: company-gated, free use, docs inconsistent on sleep data. **WHOOP**: self-serve dashboard (≤5 apps), scopes for cycles/sleep/recovery; v1 webhooks removed. **Oura**: OAuth scopes documented; approval thresholds unverified. **[R]** Demand-ranked second wave: WHOOP/Polar (self-serve) before COROS/Suunto (partner-gated), Garmin last.
- **Wear OS Health Services**: on-watch recording SDK for the Android watch story. ([Health Services](https://developer.android.com/health-and-fitness/health-services))

### 2.6 Competitor pricing anchors (verified where noted) [V]
| Product | Price (USD) | Free tier |
|---|---|---|
| Strava | $11.99/mo · $79.99/yr ([pricing](https://www.strava.com/pricing)) | recording + community |
| Runna | $19.99/mo · $119.99/yr ([pricing](https://www.runna.com/pricing)) | beginner plans + tracking |
| TrainingPeaks | $19.95/mo · $134.99/yr | Basic logging/upload |
| Garmin Connect+ | $6.99/mo · $69.99/yr ([press](https://www.garmin.com/en-US/newsroom/press-release/wearables-health/elevate-your-health-and-fitness-goals-with-garmin-connect/)) | all legacy Connect free |
| MyFitnessPal | $19.99/mo · $79.99/yr (2025 guide) | logging |
| Hevy Pro | ~$2.99/mo · $23.99/yr (page not machine-readable; treat as unconfirmed) | unlimited logging (caps on free) |
| WHOOP | $199–$359/yr tiers (page blocked; unconfirmed) | none (membership model) |
- **[R]** The mid-market anchor for a *training-first* subscription is **$8–12/mo or ~$80/yr** (Strava/Garmin zone); coaching-led products charge $20/mo. **[H]** LMTLSS Premium at **$9.99/mo · $79.99/yr** sits in the defensible band — **validate, don't assume** (price-page experiment in §7).

## 3. Recommended architecture [D] (aligned to MOBILE-SPEC, corrected by audit)

Logical domains, **modular monolith backend** (per approved memo) — not microservices:

```
[React Native app (TS)]          [Shared TS core: domain.js + pricing.js ports]
   │ native modules isolated: HealthKit, Health Connect, watchOS target (later)
   ▼
[API: auth · activities · social · clubs · events · rankings · billing entitlements]
   │  server-side authorization on every endpoint; provider secrets server-side
   ├── PostgreSQL (users, profiles, activities + sport extensions, routes,
   │    clubs, events, follows, achievements, consistency, entitlements, audit)
   ├── Object storage (route files, share-card renders)
   └── Provider adapters: Apple Health / Health Connect → Strava → (later wave)
        ingestion: consent → fetch → validate → normalize → dedupe → canonical store
```

**Activity model** [D]: shared core record + **typed sport extensions** (already the web app's shape: session + `exercises[]` for strength, `distanceM` for runs). Canonical fields: id, athleteId, sport, status, timestamps+tz, source (`manual|phone|watch|import`), provenance, visibility, schemaVersion. Raw GPS samples stored separately from derived metrics. **Duplicate detection** uses provider + external id + time-window overlap; provider of record wins by source authority order (manual edit > phone > watch > import).

## 4. Behavioral design decisions [D]

- **Consistency, not daily streaks.** Weekly consistency score (sessions vs. plan) + rolling 4-week trend, rest days recognized, **streak repair after illness/injury** (no punitive resets, no shame copy). Web app already rewards week-over-week consistency — this is the same rule productized. Duolingo-style daily loss-aversion is **rejected** for a training product: it incentivizes junk volume and training through pain. [R]
- **Notifications**: eligibility = user-set goal + meaningful event (planned session, milestone, club event, challenge end, requested weekly summary). Frequency caps, quiet hours, per-category opt-outs, dedupe. Never manufactured urgency. [D]
- **Motivation profiles**: competitive / data / social / private defaults. Private users get full value with zero public surface; rankings have participation and performance tracks kept separate. [D]

## 5. Share cards (priority #1 feature) [D/H]

The single highest-leverage build: activity → recognizable visual card → share → referral. Architecture: **render server-side later, prototype client-side now**. Sport-aware templates: run card (distance/time/pace/route map), strength card (exercises/sets/reps/volume/PR), team card (event/duration/result). Route privacy: **home-zone blur + start/end trim before render**, opt-in raw route. Formats: square post, vertical story, PR card, weekly recap. **[H]** measure: share-creation rate → completion rate → recipient conversion. The web app can prototype the *data→card* pipeline today (pure rendering over `domain.js` output) — no backend needed.

## 6. Integration sequence [D]

1. **Apple Health read + write** (iPhone) — free, no approval, best data. Import workouts+routes; write LMTLSS-recorded workouts back on consent.
2. **Health Connect** (Android) — parity, same milestone; handle 30-day history rule + route consent.
3. **Strava import** — broadest athlete coverage; build the 7-day-cache/deletion-propagation compliance into the adapter contract itself.
4. **Native watch recording** (watchOS target + Wear OS Health Services) — after phone-side reliability is proven (BUILD-PLAN M-conditions).
5. **Second-wave cloud**: WHOOP/Polar (self-serve) by demand; COROS/Suunto (partner) later.
6. **Garmin** — apply post-traction; budget for license fees and approval latency.

All behind one adapter interface (provider → consent → ingest → normalize → dedupe → canonical store) so adding a provider never touches feed/rankings/profile code.

## 7. Roadmap (repo-anchored, reordered from the memo where evidence demands)

- **Phase 0 — done**: audit + baseline (AUDIT-REPORT). Remaining: user interviews (the memo's own requirement — no repo can supply this).
- **Phase 1 — foundation (current)**: ✅ migrations/quarantine, ✅ session math, ⬜ headless test runner + CI (P0-4, needs tooling decision), ⬜ error reporting hook.
- **Phase 2 — activity engine**: recording state machine (idle→recording→paused→saved→synced + failure states) ported from `Domain.resumeSession`; **client-side share-card prototype** over real logged data; privacy zones designed in from the start.
- **Phase 3 — platform shell**: RN app + shared TS core + Postgres + auth; **Apple Health + Health Connect import** as the first vertical slice; server-side entitlement enforcement wired to the existing pricing engine.
- **Phase 4 — social**: profiles → visibility → share cards v2 (server render) → reactions → clubs/events (PRD journeys already specify these) → participation-vs-performance rankings kept separate.
- **Phase 5 — wearables wave 2 + AI coaching**: WHOOP/Polar by demand; AI = summaries/insights over *measured* data with the existing "never fabricate trends" rule; Garmin when approved.

**Production gates** (from memo §9, unchanged): physical-device GPS matrix, no data loss/duplicates, server-side authorization tested, export metrics match persisted activities, entitlements enforced server-side.

## 8. Deliverable L — Decision memo

| Question | Decision |
|---|---|
| What should LMTLSS become? | The platform where **training, progress, and sporting identity** are one loop — multi-sport first (running + strength proven, then sports modules), not a Strava clone. |
| Who first? | **Hybrid athlete** (runs + lifts, today uses 2+ apps). Underserved; matches what Phase 1 already built. [H — validate in interviews] |
| Strongest differentiator? | **Honest, explainable progress** — plans/adaptation/insights that cite measured data and refuse to fabricate; plus multi-sport cards Strava can't do well. |
| Top 3 features? | 1) Share-card system (sport-aware, privacy-safe), 2) Recording reliability + Health imports, 3) Weekly consistency mechanics. |
| First wearable? | **Apple Health** (+ Health Connect same milestone). Strava import third. Garmin last. |
| Shareability? | Activity→card→native share sheet→deep link→web preview; home-zone blur default; no invasive tracking, attribution via referral links. |
| Rankings without unfairness? | Participation track open to all (device-independent); performance track scoped by sport + experience band; personal-improvement ranking always available. No single cross-sport score. |
| Free? | Recording, history, plans, basic insights, clubs, consistency, share cards (core styles). |
| Premium? | Advanced analytics, AI coaching/summaries, extra card styles, club admin tools, organized challenges — enforced **server-side** via the existing entitlement engine. |
| Next 30 days? | See §9. |
| Not yet? | Garmin, live tracking, watchOS/Wear OS apps, marketplace/coach tools, daily streaks, cross-sport composite scores. |

## 9. The next 30 days (this repo, no backend needed)

1. **P0-4**: headless test runner + CI (decision: zero-dep Node shim vs Playwright — first `package.json` in repo; needs founder call).
2. ✅ **Done 2026-10-17** — Share-card system shipped in the web app: `js/sharecards.js` (pure composition for run/strength/PR cards, SVG builder with XML-escaping, route projection + 200 m privacy trim tested on synthetic fixtures and inert until real GPS, PNG export + Web Share), wired into the Progress session sheet. 21 tests; provenance label rendered on the card itself. Next iteration: more card styles + elevation profiles once route data exists.
3. **PWA hardening**: manifest + service worker + icons from the new logo (offline-by-nature app becomes installable).
4. **Interview script + metrics definition** (activation, W1/W4 retention, share rate, plan-started sessions) so Phase 3 starts with evidence, not assumptions.
5. **RN spike** (separate repo or branch): shared TS core compiling `domain.js`+`pricing.js`, Health Connect read of one historical workout — de-risks the Phase 3 vertical slice.

---

*Everything above labeled [V] was verified against primary sources on 2026-10-17 and is cited inline; [R]/[H] are reasoning and hypotheses respectively. No API capability, price, or test result is claimed without a source or an executed check.*
