# LMTLSS — Existing Codebase Audit and Mobile Readiness Assessment

**Date:** 2026-10-17 · **Branch:** `main` · **Method:** full source inspection of the repository, plus execution of the existing test suite in a browser against `serve.py`.

**Verdict up front:** LMTLSS Phase 1 is a **working, dependency-free static web app** (vanilla JS, no build step) with a real training domain, honest data-provenance labeling, and a passing test suite (50/50, actually executed — see §9). It is **not** a mobile app, not a PWA, and has **no backend**. Every capability required for the iOS/Android roadmap (accounts, API, GPS, push, health platforms, sharing, clubs/events) is missing from code — but the UI is already honest about this: unimplemented integrations render as "Unavailable", never as working. The path to production mobile is greenfield on the platform layer while **preserving** `domain.js`, the design tokens, and the interaction patterns.

---

## 1. Current architecture

```
┌────────────────────────── Browser (only runtime) ──────────────────────────┐
│ index.html  (43 lines — shell, script order is the dependency graph)      │
│                                                                            │
│  js/store.js ──────── localStorage "lmtlss:v1" (schema v1, single key)     │
│       │                                                                    │
│  js/domain.js ─────── pure logic: plan generation, e1RM/PRs, weekly        │
│       │              trends, insights, coach rules, formatters             │
│  js/ui.js ─────────── DOM helpers (el/icon/toast/sheet), SVG charts        │
│       │                                                                    │
│  js/onboarding.js    js/screens-{home,train,progress,coach,profile}.js     │
│       │                                                                    │
│  js/app.js ────────── 5-tab router, boot, welcome/onboarding gate          │
│                                                                            │
│  css/tokens.css (65)  →  css/app.css (774): all components & screens       │
└────────────────────────────────────────────────────────────────────────────┘
        ▲ no network at all (verified: no fetch/XHR/WebSocket/geolocation)
        ▼ no accounts, no server, no build, no dependencies
serve.py — 20-line Python static server (no-store cache headers), dev only
tests.html + js/tests.js — browser test harness, 50 assertions, no framework
```

Architecture style: **single-process modular monolith in the browser** — IIFE modules on `window` globals, `UI.el` instead of templates, one state object in `Store` with mutator functions and listener support (`Store.subscribe` exists; no screen currently subscribes, screens re-render via `window.App.rerender()`).

## 2. Technology stack and dependency inventory

| Area | Found in repository | Notes |
|---|---|---|
| Language | ES5/ES6-ish vanilla JavaScript, `"use strict"`, IIFEs | No TypeScript, no type-checking |
| Framework | None (hand-rolled DOM via `UI.el`) | No React/Vue/framework anywhere |
| Package manifest | **None** — no `package.json`, no lockfile | 0 third-party dependencies ⇒ 0 dependency CVEs |
| Build | **None** — files served as-is | No bundler, no minifier, no sourcemaps |
| Persistence | `localStorage`, single key `lmtlss:v1`, `SCHEMA_VERSION = 1` | See §5 for the version-bump data-loss risk |
| Server / API | **None** | App has zero network calls (grep-verified) |
| Database | **None** | All data local to the browser profile |
| Tests | `tests.html` → `js/tests.js` (custom harness, no framework) | 50 assertions; **executed: 50 passed / 0 failed** |
| Lint / CI | **None** — no eslint, no CI config, no workflows | Gap, see §6 |
| Dev server | `serve.py` (Python stdlib) | Runs on `127.0.0.1:8123` |
| Assets | `logo/image-removebg-preview.png` (500×500 RGBA, 88 KB) | Previous emblem PNG was deleted |
| Docs | 5 planning docs in `docs/` (PRD, MASTER-PROMPT, MOBILE-SPEC, MOBILE-REQUIREMENTS-PROMPT, BUILD-PLAN) | Untracked in git (`?? docs/`) |
| Size | 6,558 lines total (11 JS ≈ 3,057; 2 CSS ≈ 839; 5 docs ≈ 2,261) | Small enough to hold in one head |

## 3. Feature status matrix

Classification key: **[I]** implemented-and-verified · **[IU]** implemented but unverified (code exists, not exercised by tests or this audit's manual pass) · **[P]** partially implemented · **[M]** missing · **[N]** requires native iOS/Android work.

| Feature | Status | Evidence / limitation |
|---|---|---|
| Onboarding (goal → sports → experience → days → equipment → limitations → plan) | [IU] | `onboarding.js` 7 steps; no automated coverage |
| Adaptive home (today's session, readiness check-in, sparklines, one insight) | [IU] | `screens-home.js`; renders from real state only |
| Weekly plan generation (equipment/experience-aware) | **[I]** | `Domain.planFor` covered by ~15 assertions incl. bodyweight/outdoor/1–6 day edge cases |
| Strength logging (set table, RPE field, rest timer, add/sub/remove exercise, pause/resume) | [IU] | `screens-train.js` 745 lines; logic untested (DOM-bound) |
| Active-session recovery across refresh (idle >10 min ⇒ clock frozen + paused) | [IU] | Implemented in `screens-train.js` render(); **no test** — highest-risk untested path |
| Running timer with manual distance + explicit provenance labels | [IU] | Saves `distanceSource: "manual"`; UI states "No GPS is connected" |
| GPS / route recording | **[M]** | Zero `geolocation` references in codebase |
| PRs, Epley est. 1RM, weekly volume/distance trends | **[I** partly**]** | Math covered by tests; chart rendering [IU] |
| Explainable insights ("what changed") | **[I]** | Tests assert real numbers, singular/plural correctness, and no fabricated trends on thin data |
| Coach recommendations + Q&A | [P] | Works, but **rule-based only** (`Domain.coachRecommendations`); docs specify AI services — none exist |
| Coach chat thread persistence | [IU] | `coachThread` in store, used by `screens-coach.js` |
| History list + session detail sheet | [IU] | `screens-progress.js` |
| Profile edit, plan regenerate, per-session plan edit | [IU] | `screens-profile.js` |
| Units (metric/imperial) + rest-timer settings | [IU] | Settings row wired to `Store.updateSettings` |
| JSON export / full delete with confirm | [IU] | `exportJSON()` / `resetAll()`; UI confirms with danger sheet |
| Demo data seed (10 weeks, clearly labeled) | [IU] | `Store.seedDemo`, `provenance: "manual"`, `seeded: true` |
| Hydration logging API | **dead code** | `Store.addHydration` has **zero callers** in any screen |
| `Store.subscribe` listeners | **dead code** | Defined, never used by screens |
| Integrations UI (GPS / wearables / health) | honest stub | Renders badge **"Unavailable"** with "not implemented yet" copy — correct behavior |
| Accounts / auth / authorization | **[M]** | Nothing exists |
| Backend API / PostgreSQL / sync | **[M]** | Nothing exists |
| Notifications (push or local) | **[M]** / **[N]** | Nothing exists |
| Native share, media/route-card export, Share Studio | **[M]** | Nothing exists |
| Feed, athlete profiles-as-social, clubs, events, referrals | **[M]** | Nothing exists (planned in PRD/MASTER-PROMPT only) |
| HealthKit / Health Connect, wearables | **[M]** / **[N]** | Nothing exists |
| PWA (manifest, service worker, offline shell) | **[M]** | No manifest, no SW — though the app is already offline-by-nature |
| Schema migrations (future) | **[M]** | Version mismatch silently resets to empty state — see §5 |

## 4. iOS and Android compatibility matrix

Current architecture classified: **web application** (not native, not React Native, not hybrid, not PWA).

| Capability | Retained as-is? | What it requires |
|---|---|---|
| Design system, tokens, interaction patterns | ✅ Yes | `css/tokens.css` + `app.css` translate directly; the app is the reference implementation per README |
| Domain logic (plans, PRs, trends, insights, coach rules) | ✅ Mostly | `domain.js` is pure and framework-free — portable to TypeScript/RN with minimal change |
| Data model (`lmtlss:v1` shape) | ✅ Yes | Portable to a server schema; needs migrations + sync when a backend exists |
| Reliable background GPS recording | ❌ No | Requires native modules (`react-native-maps`/background location, iOS Always-on + Android foreground service); impossible in this architecture |
| Interrupted-session recovery | ⚠️ Partial | The *logic* (elapsedBase/paused/idle-freeze) ports; background execution does not |
| Push / local notifications | ❌ No | Native or a real backend push service |
| HealthKit / Health Connect | ❌ No | Native modules only |
| Secure auth + platform keychain storage | ❌ No | Needs a backend + native secure storage |
| Native device sharing | ❌ No | Web Share API is a stopgap; proper export = native share sheet |
| App Store / Play builds | ❌ No | Needs a native or RN shell (React Native per `docs/MOBILE-SPEC.md`) |

**Recommendation:** no rewrite of what works. Keep the web app as the design/interaction reference, port `domain.js` + tokens into the mobile stack, and build the platform layer (auth, API, GPS, sync) new — per the roadmap in `docs/BUILD-PLAN.md`. A Capacitor-style wrap is *not* sufficient for background GPS.

## 5. Critical bugs and security concerns

**Data integrity (highest priority):**

1. **Version bump = silent data loss.** `store.js load()`: `if (parsed.version !== SCHEMA_VERSION) return emptyState()`. The next time `SCHEMA_VERSION` changes, every existing user's profile, plan, and history is discarded on load and **overwritten on the next persist**. There is no migration path. This must be fixed before any schema change (Backlog P0-1).
2. **`Store.persist()` failure depends on script order.** `persist()` calls `UI.toast(...)`, but `store.js` loads before `ui.js`. If a persist ever throws before `ui.js` evaluates (or in the test harness), it's a `ReferenceError`. Guard with `typeof UI !== "undefined"` (P0-2).
3. **Active-session recovery is untested.** The idle-freeze branch (`gap > 10 min`) is the app's core "don't lose my workout" guarantee and has zero automated coverage (P0-3).
4. **Corrupt storage → fresh state, old data never cleared until next write.** Acceptable, but worth a loud in-app notice (P2).

**Security:**

- ✅ **No network attack surface**: grep-verified zero `fetch`/`XMLHttpRequest`/`WebSocket`/`navigator.geolocation` in `js/`. No secrets exist, none are printed anywhere.
- ✅ **XSS**: all user content flows through `el(..., {text: ...})` / text nodes → `textContent`. `innerHTML` is used only for static icon/chart SVG paths. Caveat: `UI.el` supports an `html:` attribute — a footgun for future code; policy goes in `AGENTS.md`.
- ⚠️ **Plaintext `localStorage`**: fine for the current local-only threat model; **not acceptable** once accounts/health/location arrive — auth tokens and sensitive data must move to server-side sessions + native secure storage.
- ⚠️ **No authorization boundaries exist yet** — because there is no server. The rule "enforce authorization server-side" (see `AGENTS.md`) applies from the first API commit.
- ✅ **Privacy copy is honest**: distance provenance labeled on every save; "Training tool, not a medical device" footer; integrations show "Unavailable".
- ⚠️ Sensitive-data posture (location, health) is **entirely future** — no collection happens today.

## 6. Missing infrastructure and external dependencies

- No `package.json` / lockfile / dependency management of any kind.
- No CI, no lint, no type-check, no automated test runner (tests require a browser tab; **no headless/CI entry point**).
- No backend, no database, no migrations framework, no auth provider.
- No PWA manifest / service worker (app is offline-capable only while the origin is cached).
- No error monitoring or crash reporting (console-only today).
- No LICENSE file (README: "All rights reserved (add a LICENSE when you pick one)").
- `docs/` is **untracked in git** — five planning documents, including the canonical master brief, are not version-controlled (P1 housekeeping: `git add docs/`).
- Git status at audit time: `M README.md`, `D logo/Neon Green Isometric Emblem.png`, `M logo/image-removebg-preview.png`, `?? docs/`.

## 7. Recommended architecture (with reasons)

1. **Keep the stack; fix the foundation first.** No framework change is justified — 6.5k lines with zero deps and passing tests has no technical debt pressure. *(Reason: memo rule — preserve working functionality; no documented limitation requires change.)*
2. **Make schema migration a first-class function** in `store.js` before anything else touches stored data. *(Reason: §5.1 is a guaranteed data-loss bug on first schema change; data integrity outranks features.)*
3. **Keep the modular-monolith boundary, both web and server.** When a backend arrives, one service with clear module boundaries (training, social, clubs, events, AI, integrations) — not premature microservices. *(Reason: team size and current scale justify it; matches the approved memo.)*
4. **Mobile: React Native + shared TypeScript domain layer**, per `docs/MOBILE-SPEC.md`, extracting `domain.js` as the shared core; native modules isolated behind a small interface for background location, health, and notifications. *(Reason: domain.js is already pure; RN matches the existing spec doc rather than introducing a competing choice.)*
5. **Backend: PostgreSQL + a modular API** with typed contracts and versioned migrations; privileged operations and any provider secrets server-side only. *(Reason: clubs/events/sync/authorization cannot exist client-side.)*
6. **Keep the honesty convention as an architectural invariant**: any capability not yet implemented must render as "Unavailable", never mocked-as-working. *(Reason: it's already the product's stated rule; tests should enforce it.)*
7. **Do not add a build step until it earns its place** (TypeScript or a shared domain package will be the trigger). *(Reason: avoid unnecessary dependencies.)*

## 8. Prioritized implementation backlog

**P0 — data integrity & reliability (do before features)**
1. ✅ **Done 2026-10-17** — Migration framework in `js/store.js`: `MIGRATIONS[n]` chain; unreadable payloads (newer version, corrupt JSON, no path) are **quarantined** under `lmtlss:v1:quarantine`, never discarded. `Store.migrate` / `Store.reload` exposed; end-to-end tests in `js/tests.js`.
2. ✅ **Done 2026-10-17** — `persist()` error toast guarded with `typeof UI !== "undefined"`.
3. ✅ **Done 2026-10-17** — Session clock math extracted to pure `Domain.elapsedSec` / `Domain.resumeSession` (`SESSION_IDLE_FREEZE_MS`), `js/screens-train.js` now delegates; regression tests cover live/paused elapsed, short-gap resume, >10-min idle freeze, and no-`updatedAt` cases. Verified end-to-end in the browser (short refresh-resume, simulated 15-min idle, finish-and-save with frozen duration).
4. Headless test entry point so tests can run outside a browser tab (Node shim or Playwright) — prerequisite for CI.

**P1 — engineering hygiene**
5. CI running the full suite on every push.
6. `git add docs/`; add LICENSE; restore README logo reference to `logo/image-removebg-preview.png`.
7. Remove or wire up dead store APIs (`addHydration`, `subscribe`) — decide, don't leave orphans.
8. Lint (eslint, zero-config) — no rules beyond correctness at this stage.

**P2 — product surface that's local-only**
9. PWA manifest + service worker offline shell + `logo/image-removebg-preview.png` icons (the app already works offline by nature; make it installable).
10. In-app notice when stored data is corrupt/reset rather than silent fresh state.
11. Session detail: edit/delete an already-saved session (delete exists in store; expose it in `screens-progress.js`).

**P3 — platform (per `docs/BUILD-PLAN.md` milestones M0–M6)**
12. Auth + backend API + schema migration to PostgreSQL (server-side authorization from day one).
13. Real GPS recording with background behavior and interrupted-session recovery on physical devices.
14. Social: athlete profiles, feed, Share Studio exports; then clubs/events with membership permissions.
15. AI coach (structured output validation + fallback to the current rule-based engine); HealthKit/Health Connect; push notifications.

## 8b. Pricing & monetization (added 2026-10-17, local prototype)

Built as a pure, backend-portable engine plus an honestly-labeled local prototype (no payment processing exists or is claimed):

- **`js/pricing.js`** — pure module (no DOM/storage, like `domain.js`): plans with explicit feature entitlements, price book by currency/region/interval (integer minor units only), custom offers (flat + per-member with volume tiers), coupons, subscriptions with status policy, and **deterministic price precedence** (custom offer → regional → plan default → coupon; coupons never stack on negotiated offers; offers survive book changes = grandfathering). `resolveEntitlements` never reads price — permissions come only from subscription/offer/plan relationships, enforced by `checkEntitlement` (quota + status).
- **`admin.html` + `js/admin.js`** — "Pricing & Plans" admin prototype (linked from Profile, `noindex`): plan builder, price book editor, offer assignment, coupon management, simulated subscriptions (past_due/canceled model provider webhooks), an entitlement simulator with a visible precedence trace, JSON export, and a full audit history (who/what/when/before/after on every mutation). Data in separate localStorage key `lmtlss:pricing:v1`; banner states "no billing is connected".
- **Production gaps (documented, not faked):** server-side entitlement enforcement, store billing (Apple/Google rules), webhook verification/idempotency, admin authentication, invoice records. The engine is the reference implementation the backend must replicate.
- **Tests:** 40 pricing assertions (precedence, grandfathering, per-member/volume tiers, quota exhaustion, past_due/canceled/expired access, price≠permissions, boundary validation, audit completeness).

## 9. Testing and deployment requirements (what was actually executed)

Executed during this audit (2026-10-17, from this repo):

| Command / action | Result |
|---|---|
| `python serve.py 8123` (background) | Started, PID 10396 |
| `curl http://127.0.0.1:8123/index.html` | **HTTP 200** |
| `curl http://127.0.0.1:8123/tests.html` | **HTTP 200** |
| Open `http://127.0.0.1:8123/tests.html` in browser, read `window.__TESTS__` | **50 / 50 passed, 0 failed** (page title `PASS (50)`) |
| Re-run after P0 fixes (migrations, quarantine, session math) | **69 / 69 passed, 0 failed** (page title `PASS (69)`) |
| E2E browser smoke: demo seed → planned session → mark set → refresh resume → simulated 15-min idle (frozen at 102 s) → finish & save | **All passed** — 41st log entry saved with `durationSec: 102`, `provenance: "manual"`, `activeSession` cleared |
| Grep for network/geo/SW/DB APIs in `js/` + `index.html` | **0 matches** — no network surface |
| Type-check / lint | **Cannot run — no toolchain exists** (not a pass; a gap) |
| E2E UI flows, physical-device GPS, store builds | **Not run** — manual/device testing required per §10 |

Test coverage measured by assertions: plan generation (~15), e1RM/PRs (~6), trends (~5), insights honesty (~7), coach rules (~4), formatting (~12), misc (~1). **Not covered:** every screen render, session lifecycle, storage failure paths, seed data.

**Deployment:** static hosting only, today (`index.html` + `css/` + `js/` + `logo/`). No build artifact, no release pipeline. Any store release requires the mobile track in `docs/BUILD-PLAN.md`.

## 10. First three implementation tasks (with exact files)

1. **Fix silent data loss on schema version change** — `js/store.js` (`load()` / `persist()`), assertions in `js/tests.js`: unknown-version payloads must be preserved and migrated, never discarded; corrupt payloads must not be overwritten before the user is told. *(Why first: it gates every future schema change and protects user data.)*
2. **Make the session engine testable and tested** — extract elapsed/pause/idle-freeze math from `js/screens-train.js` (`liveElapsed`, resume branch of `render()`, `finishStrength`/`finishRunning` record shaping) into `js/domain.js` (or a new pure module), then add regression tests in `js/tests.js` for: refresh-resume, >10-min idle freeze, pause/resume arithmetic, and distance-provenance labeling on save. *(Why second: "a session must never be lost" is the product's core reliability promise and currently has zero coverage.)*
3. **Headless test runner + CI** — add `package.json` with a zero-dependency Node harness (or Playwright) that executes the same `js/tests.js` assertions outside a browser, plus a CI workflow that fails on any red assertion. *(Why third: everything after this is only trustworthy if the suite runs automatically; this is the first appearance of a build manifest, kept dependency-free.)*

**Files most likely touched across the roadmap:** `js/store.js`, `js/domain.js`, `js/screens-train.js`, `js/tests.js`, `index.html`, `css/tokens.css`.

---

*Audit rule applied throughout: features were classified by code evidence, not by screen presence; nothing was run destructively; no capability is reported as working unless it was executed in this session.*
