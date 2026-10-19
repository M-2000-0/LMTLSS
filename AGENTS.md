# AGENTS.md — binding engineering rules for LMTLSS

These rules apply to every agent and contributor working in this repository. They exist because the app's value is **trust**: honest data, no lost workouts, no fake capabilities.

## Project shape

- Static web app: `index.html` + `css/` + `js/` + `logo/`. **No build step, no dependencies, no framework.**
- Mobile packages (milestone M0): `app/` (Expo + React Native, TypeScript strict) and `shared/` (pure TS domain layer, ported from `js/domain.js`). These two have npm dependencies and their own `package.json`; the web app still has none. Root `npm test` / `npm run typecheck` / `npm run lint` delegate to both.
- `server/` is the API: a **dependency-free** Cloudflare Worker + D1 (SQLite) with its own tests (`npm run test:server`, Node's built-in `node:sqlite`). It is **not deployed** and the web app makes no network calls to it yet — a configured backend is not an available capability, so nothing in the UI may imply otherwise.
- Modules are IIFEs on `window` globals; script order in `index.html` is the dependency graph (`store → domain → ui → onboarding → screens → app`). Never rely on a module that loads later.
- `domain.js` is **pure logic** (no DOM, no localStorage). Keep it that way — its portability to the future mobile app depends on it.
- Tests live in `js/tests.js`, executed via `tests.html` in a browser: `python serve.py 8123` → `http://127.0.0.1:8123/tests.html`. The page title reports `PASS (n)` / `FAIL (n)`; read `window.__TESTS__`.

## Read before you edit

- Read the existing file and its callers first. Reuse `UI.el`, `UI.icon`, `Domain.fmt*`, and the existing screen/panel/badge patterns instead of introducing new helpers or markup styles.
- Small, focused changes only. No unrelated refactors, no framework swaps, no dependency additions without an explicit, documented reason.
- Keep every screen working after each change — the app must run from `index.html` with no build step at all times.

## Data integrity (highest priority)

- **Never change `SCHEMA_VERSION` without a migration.** `store.js` currently resets unknown versions to empty state; adding a migration (backlog P0-1) is required before any schema change. Stored user data must never be silently discarded or overwritten.
- Never replace real activity data with mock values in production paths. Demo data must stay in `Store.seedDemo` only, keep `provenance: "manual"` / `seeded: true`, and be labeled to the user.
- Preserve the in-flight `activeSession` across refresh; don't remove the idle-freeze (>10 min) protection in `screens-train.js`.
- Never run destructive operations against user storage without explicit confirmation (`UI.confirmSheet` for deletes).
- Handle persistence failures visibly (`persist()` → toast), and guard against `UI` being unavailable when `store.js` runs.

## Honesty in the UI (product invariant)

- A capability that is not implemented must render as **Unavailable / "not implemented yet"** — never as a working control. (See the Integrations section in `screens-profile.js`.)
- Label data provenance at the point of use: manual distances say "manually entered (no GPS connected)", estimated 1RMs say "estimated (Epley)", seeded rows say demo.
- Never claim a test passed unless it was actually executed; report untested paths as unverified.

## Security & privacy

- All data stays local today; **no secrets, keys, or tokens ever go in this repo**, logs, or `localStorage`.
- Render user content with `text:` / text nodes only. **Never pass user input through the `html:` attribute of `UI.el` or any `innerHTML`** — `innerHTML` is reserved for static icon/chart SVG paths in `ui.js`.
- When a backend arrives: enforce authorization **server-side** on every endpoint; keep provider secrets server-side; validate data at every boundary; sensitive health/location data never in plaintext storage.

## Testing & verification

- Add or extend tests in `js/tests.js` for any new domain behavior and for fixed regressions.
- Run the suite in the browser before claiming done; if a check cannot run (no toolchain exists for it), report it as **not run**, never as passed.
- Do not weaken, skip, or delete assertions to make the suite green. Fix the cause.
- Browser baseline as of 2026-10-19: **214/214 assertions pass** in `tests.html` (sports model, sport-aware tracking/summary/share, schema migration, session-clock math, pricing/entitlement engine, recovery/fuel day boundaries, share cards) **and the same suite passes headlessly in Jest** via `shared/__tests__/web-suite.test.ts`. If you add an assertion to `js/tests.js`, it is covered by `npm test` automatically.
- Mobile baseline as of 2026-10-19: root `npm test` → **129 Jest tests in `shared/`** — ported domain assertions, storage-shim seam, export-parity guard, **and the browser suite**: store migration/quarantine/weekPlan, pricing, share cards, recovery/fuel are ported assertion-by-assertion and drive the real `js/` modules through a `node:vm` sandbox (`shared/test-support/browser.ts`); one drift guard runs all 214 browser assertions headlessly. Plus **21 app tests**: schema/migration + quarantine, the AsyncStorage adapter (round trip, corrupt payload preserved, write failure), the store (onboarding-generated plan, restart restore, domain bindings, failed-write surfacing), and a rendered onboarding → Today journey that asserts the persisted JSON. `tests.html` remains the interactive oracle, not the only place a browser assertion runs.
- Server baseline as of 2026-10-18: root `npm run test:server` → **60 tests pass** (`server/`, in-memory SQLite + a D1-shaped binding shim). The D1 adapter is exercised through that shim, but **no test has run on real Cloudflare D1 or in workerd** — treat the deployed runtime as unverified until `wrangler dev --local` has been run.
- **Date handling:** "today" is the athlete's **local** calendar day (`Store.todayISO` / `todayISO()` in `shared/src/platform.ts`). Never slice `toISOString()` for a day boundary — in UTC-6 that rolls the day over at 18:00 and files evening entries under tomorrow.
- **If you change `js/domain.js`, mirror it in `shared/src/domain.ts`** (or vice versa) — the parity test fails on any public-API drift, and behavior must stay identical.

## Delivery report format

After each task, report:

1. What changed.
2. Which files changed.
3. Which tests were executed and their actual results.
4. Known limitations.
5. Required manual / physical-device testing.
6. The next dependency or blocker.

A feature is not complete because the screen renders — its data, permissions, failure states, and primary user journey must work.

## Docs & brand

- Planning docs in `docs/` are source material; `docs/AUDIT-REPORT.md` is the current state-of-truth audit. Keep them in sync when architecture decisions change.
- Brand: canvas `#000000`, accent `#61EB1A` (functional color only — never decoration, never a second accent), surfaces `#111111` / borders `#262626`. Logo asset: `logo/image-removebg-preview.png`.
