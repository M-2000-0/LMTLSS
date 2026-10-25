# LMTLSS — Launch Truth (2026-10-20)

> One page. What launches, on what, with what limitations. If a sentence here
> is wrong, fix this file — not the marketing.

## What launches

**A dependency-free static web app** — `index.html` + `css/` + `js/` + `logo/` —
served from any static host. No build step, no framework, no npm, no server, no
network calls. Everything lives in the browser's `localStorage` under one key
(`lmtlss:v1`).

It is also the **design-system and interaction reference** for the React Native
mobile app in `app/` and the shared TypeScript domain in `shared/`. Those two
exist, are partially built, and have their own tests — but they are **not the
launch candidate unless we decide they are** (see §1).

## What the web app actually does today

- **Onboarding** — 7-step flow (goal, sports, experience, days/week, equipment,
  limitations, generated plan review). Saves profile + weekly plan to localStorage.
- **Adaptive Home** — today's planned session, one-tap readiness check-in,
  compact week-over-week sparks (sessions / strength volume / distance), one
  sourced insight. "Today" is the athlete's **local** calendar day everywhere.
- **Train** — strength sessions (exercise picker filtered to your equipment,
  history-prefilled loads, set logging, rest timer, substitutions, pause/resume,
  finish-with-summary) and timed endurance sessions (live clock + **manual
  distance entry for run, cycling, and swimming**, with sport-correct pace/speed
  display and honest "no GPS connected" provenance). Every sport in the 14-sport
  model is startable; sports the app can't observe get a manual entry form with
  only their real metrics.
- **Recover** — readiness trend, rest-day planner, recovery-action log.
- **Fuel** — hydration counter, meal logger (estimates labeled as estimates).
- **Progress** — weekly volume/distance charts, personal records with
  Epley-estimated 1RMs (labeled "estimated (Epley)"), explainable "what changed"
  insights, full session history with delete.
- **Coach** — rule-based recommendations with reasoning + confidence, plus
  Q&A that cites your logged data and declines to guess on thin data.
- **Profile** — edit profile, regenerate/edit weekly plan, units + rest-timer
  settings, JSON export, full data deletion (confirmed), **integrations section
  that renders "Unavailable" honestly**, link to the Pricing & Plans admin
  prototype (local, no billing).
- **Pricing & Plans (admin prototype, local only)** — plans, regional price book,
  custom offers, coupons, simulated subscriptions, entitlement simulator, full
  audit trail. **No payment processing.** Entitlement enforcement must move
  server-side when a backend exists.
- **Share cards** — SVG + PNG export of a typographic activity card that renders
  **only what the session recorded**: no GPS = no fabricated route line; manual
  distances keep their provenance label on the card; user strings are XML-escaped.
  Native share-sheet fallback when `navigator.share` isn't available.

## What the web app does NOT do (and will not pretend to)

- No account, no sign-in, no sync, no backend call of any kind.
- No GPS, no route recording, no map. Distance on runs/rides/swims is manual.
- No wearables, no HealthKit, no Health Connect.
- No sharing to social platforms except the native share sheet on the exported
  PNG (which is a device feature, not a service).
- No AI/LLM. Coach is rule-based and says "I don't know" rather than guessing.
- No push notifications, no PWA manifest/service worker (the app is
  offline-by-nature but not installable as a PWA today).
- No clubs, no events, no feed, no public profiles.
- No billing. The pricing prototype simulates subscriptions; it does not charge.

## Test baselines (actually executed 2026-10-23)

| Suite | Command | Result |
|---|---|---|
| Browser | `npm test` → `web-suite.test.ts` (same `js/tests.js` in `node:vm`) | **PASS (215)** — 215/215 assertions, 0 failures |
| Shared + app Jest | `npm test` | **181/181 shared** (11 suites) + **28/28 app** (7 suites) |
| Server | `npm run test:server` | **60/60** (in-memory SQLite, same dialect as D1) |
| Typecheck | `npm run typecheck` | clean (shared + app + `node --check` worker) |
| Lint | `npm run lint` | 0 errors (warnings only) |

The interactive page (`http://127.0.0.1:8123/tests.html`) was opened in a real
browser on 2026-10-24 and its title reported **PASS (215)**; the same 215
assertions also run headlessly through the `node:vm` sandbox. The shared Jest
suite ports the domain assertions 1:1 and runs the real `js/store.js`,
`js/domain.js`, and `js/sharecards.js`, so a browser-only test cannot silently
rot. The server suite drives the real Worker `fetch` handler and a D1-shaped
binding shim against in-memory SQLite.

## Honesty invariants (non-negotiable)

1. A capability not implemented renders as **Unavailable / "not implemented yet"** —
   never as a working control. (Integrations in Profile are the canonical example.)
2. Provenance is labeled at the point of use: manual distances say "manually
   entered (no GPS connected)"; estimated 1RMs say "estimated (Epley)"; seeded
   rows are labeled demo. Seeded data lives in `Store.seedDemo` only, with
   `provenance: "manual"` / `seeded: true`.
3. User content is rendered as text nodes / `text:` only. `innerHTML` is reserved
   for static icon/chart SVG paths in `ui.js` and the static share-card template.
   The `html:` attribute of `UI.el` exists but is never used by app code.
4. No secrets, keys, or tokens anywhere — repo, logs, localStorage, assets.
5. "Today" is the local calendar day (`Store.todayISO` / `todayISO()`). Never
   slice `toISOString()` for a day boundary.

## The mobile app (`app/`) — status

Scaffolded Expo + React Native, TypeScript strict, ESLint, Jest. What works:
onboarding → Today journey (renders and persists, with a journey test asserting
the persisted JSON), store adapter (AsyncStorage, round-trip + corrupt-payload
preservation + failed-write surfacing), shared domain port with a parity guard
against `js/domain.js`.

What's in progress but **not launch-ready**:
- **GPS/run tracking** — a foreground run-screen skeleton (`RunScreen`,
  `runBuffer`, `clock`) plus background-location wiring (`locationTask`,
  `locationStorage`, `TrackingScreen`, `app.json` config plugin) exists.
  `expo-location` and `expo-task-manager` are installed, but **no development
  build has been produced** and **no device test has been performed**. The
  device test plan lives in `GPS_PHYSICAL_DEVICE_TEST_PLAN.md`.
  Foreground-only right now; background recording/recovery is
  wired-but-unverified.
- **Watch import** — `shared/src/file-import.ts` parses FIT, TCX, and GPX with
  no dependencies and no network; `app/src/screens/ImportScreen.tsx` picks a
  file, previews the parse, labels it "source: FIT / TCX / GPX file", and saves
  through `planImport` with `provenance: "device"`. Covered by 15 parser tests
  and an end-to-end screen test. **Not yet exercised against a real export from
  Garmin Connect, Polar Flow, COROS, Suunto, or Strava, and not run on a
  physical device.** Every other watch path still resolves to its real blocker.
- **Session recording, progress charts, share cards, meal entry** on mobile are
  rendered as unavailable, not faked.
- **No EAS account is connected**, no `eas init` has run, no dev/store build
  exists. A local `expo start --go` (Expo Go) is the only runnable path, and
  several native modules won't be in Expo Go without a dev client.

## The backend (`server/`) — status

A dependency-free Cloudflare Worker + D1 (SQLite) with 60 passing tests against
in-memory SQLite. Implements health, identity, clubs, events, moderation,
notifications. **Not deployed. Not wired from the UI.** Auth is a seam — any
HS256 provider plugs in by setting `AUTH_JWT_SECRET` etc.; no provider is
configured, so no athlete can obtain a token today, and no screen implies one
exists.

**Not implemented yet (schema only or not started):** coach subscriptions/Stripe,
store, map/presence endpoints, activity sync (the web app still owns the log
locally), notifications transport, and — critically — **no test has run in
workerd or on real D1**. `wrangler dev --local` is the next verification before
any deploy claim.

## What's missing to call this "launched"

### Decisions that must be written down first (nothing else is meaningful without these)

1. **Launch surface** — web only, iOS, Android, backend, or staged? (`DEC-01`)
2. **Backend/auth in scope?** If yes: deploy + `wrangler dev --local` verification,
   server-side auth on every endpoint, then wire it. If no: say so explicitly. (`DEC-02`)
3. **GPS/maps in scope?** If yes: physical-device testing is mandatory; the
   foreground skeleton is real but incomplete, background is unverified. (`DEC-03`)
4. **Sharing/clubs/events/public profiles in scope?** The club+event API exists but
   is unshipped and unwired; Share Studio editor doesn't exist. (`DEC-01` again)
5. **AI in scope?** If yes: a concrete capability with data boundaries, refusal
   rules, schemas, eval gates, fallback. "Train the LLM" is not a task. (`DEC-04`)
6. **"Production-ready" definition** — app-store build, backend live, or both? (`DEC-05`)

### Startable-now gaps (code/evidence, no missing env)

- **One-page launch brief + "can/cannot do yet" note** — §1–§3 of this doc is the
  start of it; it should be the public-facing truth, reviewed against the honesty
  invariants before anything is published. (FI-13, MKT-01, MKT-05)
- **Launch copy audit** — every public-facing statement checked against what the
  app actually does. (HO-01, HO-02, MKT-04)
- **Suite results recorded as evidence in the trackers** — the numbers above are
  real; the trackers still say "Not started" in many rows. (FI-07, TST-01..03)
- **Data-integrity + session-recovery test coverage** — migrations/quarantine and
  session-clock math are implemented and mostly tested in the browser/Jest, but the
  trackers and the fix-it manifest still list several as not-started. (FI-01..03)
- **Owner assignment** — every area above needs a named owner + backup before
  launch day. (OPS-01, OPS-02)

### Blocked in this environment (not faked — named blockers)

- **Physical-device GPS + background testing** — needs real Android + iOS devices,
  `expo-location` installed, a prebuild, and a dev/store build. The test plan exists;
  the run is not possible here.
- **App-store / dev build verification** — no EAS account, no `eas init`, no JDK/
  Android SDK on this machine. `expo start --go` is the only runnable path.
- **Real Cloudflare D1 / workerd** — server tests use an in-memory SQLite + shim.
  `wrangler dev --local` has not been run; the deployed runtime is unverified.
- **Auth provider / secrets / billing / external services** — none configured. If
  any are in scope, they need accounts + secrets + verification.
- **Share Studio editor, public profiles, clubs/events UI wiring, activity sync to
  backend, coach subscription + Stripe, notifications transport** — all specified
  but not implemented or not wired.

## The honest launch-readiness summary

| Area | Status | Why |
|---|---|---|
| Web app (features) | **Real and working** | All 7 tabs render, log, persist, export, delete. Honest labeling throughout. |
| Web app (tests) | **Green, recorded** | 215 browser + 181 shared + 28 app + 60 server = 484 assertions, all executed. |
| Web app (honesty/integrity) | **Largely done, audit-complete** | innerHTML audit done; provenance labels present; migrations/quarantine implemented; session clock tested. Remaining: record evidence in trackers, write the public brief. |
| Mobile app | **In progress, not launch-ready** | Onboarding→Today works; FIT/TCX/GPX file import is implemented and tested in Jest but has not run on a device; GPS/run tracking is wired-but-unverified; no build, no device test, no EAS account. |
| Backend | **Implemented, unshipped, unwired** | 60 tests pass locally; not in workerd/D1; no auth provider; UI doesn't call it. |
| Launch scope decision | **Not written** | Until §1's six decisions are down, "launch" is undefined. |
| Launch communications | **Not started** | No public brief, no copy audit, no support briefing. |

## Specific bugs fixed in this session (2026-10-20)

1. **Headless sharecard assertion** — the Jest port asserted `not.toContain("<path")`
   which broke when the brand logo SVG pill (with its own decorative `<path>`) was
   added. Fixed to match the browser suite's intent: check for the route-path
   signature `stroke="#61EB1A" stroke-width="10"`, not any `<path>`.
   (`shared/__tests__/web-sharecards.test.ts`)
2. **Cycling/swimming had no distance entry** — they were timed sports with
   `distanceM` in the domain model but the live UI only offered distance for runs.
   Added sport-aware distance card (cycling: km + speed; swimming: meters + pace)
   and a sport-specific finish button ("Finish ride"/"Finish swim"/"Finish run").
   (`js/screens-train.js`)
3. **Live speed display showed duration format for cycling** — `updateRunStats()`
   used `Domain.fmtPace()` for the live AVG SPEED node even on cycling, producing
   "M:SS" instead of "X km/h". Fixed to use `paceValue()` (which returns km/h for
   cycling). (`js/screens-train.js`)
4. **Post-workout summary mislabeled cycling/swimming** — `showSummary`'s "other
   sport" branch said "LMTLSS does not measure this sport" for cycling/swimming,
   which are timed (clock-measured) sports. Added a timed-endurance branch that
   shows time/distance/speed-pace with the correct manual-distance provenance.
   (`js/screens-train.js`)
5. **Home "This week" session count used a rolling 7-day window** that could
   disagree with the Mon-based weekly-volume sparkline. Aligned both to the same
   `Domain.weekStartISO()` basis. (`js/screens-home.js`)
6. **Rest-timer interval leaked on screen teardown** — `TrainScreen.teardown`
   stopped the ticker but not the rest banner interval. Added `stopRest()`.
   (`js/screens-train.js`)
7. **innerHTML annotations** — documented why each `innerHTML` use in `ui.js` is
   static (icon paths, chart paths, progress-ring geometry, sparkline path) and
   confirmed `html:` is never used by app code. (`js/ui.js`)

## Required manual / physical-device testing before any public signal

- Fresh-person walkthrough of onboarding → Today → a strength session → a run →
  Progress → Coach → Profile → export → delete, on Chrome, Safari, and a relevant
  Android browser.
- Cycling + swimming timed session end-to-end (start → enter distance → finish →
  verify summary + history entry + provenance label).
- Adaptive-week proposal apply/revert flow.
- Interrupt a session (refresh mid-activity), confirm resume + idle-freeze behavior.
- Confirm no console errors during a normal first-run and core journey.
- If mobile is in scope: a real dev/store build on real devices, with the GPS device
  test plan exercised (foreground, locked/background, pause/resume, poor signal,
  denied/approximate permission, battery saver, kill/reboot recovery).
- If backend is in scope: `wrangler dev --local` + a full sign-in/callback/
  session/sign-out flow with two accounts and data isolation.

## The next dependency or blocker

**The launch-surface decision (§1, item 1).** Everything else — what to audit, what
to fix, what to test, what to write — forks from that. If web-only, the path is:
finish the launch brief + copy audit, record the suite evidence, ship static. If
mobile or backend are in scope, each carries its own blocked-verification list above.
