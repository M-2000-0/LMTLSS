# Build plan — LMTLSS

Living engineering plan for the web app, shared domain, mobile app, and server. It is the handoff document between planning, implementation, and verification — not a promise that everything here is already built.

## 1. Scope

- Web app: static `index.html` + `css/` + `js/`, no build step, no dependencies.
- Shared domain: `shared/src/` pure TypeScript, ported from `js/domain.js`, used by both web and mobile.
- Mobile app: `app/` Expo + React Native, TypeScript strict; `shared/` as its domain layer.
- Server: `server/` dependency-free Cloudflare Worker + D1; not deployed, not wired from the UI yet.
- Docs: `docs/` is working planning material; `docs/AUDIT-REPORT.md` is the current state-of-truth audit.

## 2. Current state

- Web app is the interactive baseline: onboarding → Today → train / fuel / recovery / coach → profile / admin.
- Shared domain is ported and tested headlessly; parity between `js/domain.js` and `shared/src/domain.ts` is enforced.
- Mobile app is scaffolded to M0/M1: persistent store bound to the shared domain; round-trip, corrupt-payload, and failed-write seams covered; onboarding → Today journey asserted in persisted JSON.
- Server is written and self-tested in-memory; real Cloudflare D1 / workerd not yet run.

## 3. Verification baselines (as of 2026-10-19)

- Browser baseline: 214/214 assertions pass in `tests.html` (sports model, sport-aware tracking/summary/share, schema migration, session-clock math, pricing/entitlement engine, recovery/fuel day boundaries, share cards).
- Headless Jest baseline: the same web suite passes in Jest via `shared/__tests__/web-suite.test.ts`.
- Mobile baseline: root `npm test` → 129 Jest tests in `shared/` (ported domain assertions, storage-shim seam, export-parity guard, browser suite through `node:vm`, and a rendered onboarding → Today journey asserting persisted JSON), plus 21 app tests (schema/migration + quarantine, AsyncStorage adapter, store bindings, onboarding → Today journey).
- Server baseline: root `npm run test:server` → 60 tests pass in `server/` (in-memory SQLite + D1-shaped binding shim). Real D1 / workerd not yet run.

## 4. Test file layout

- Web: `js/tests.js`, run via `tests.html` in a browser (`python serve.py 8123` → `http://127.0.0.1:8123/tests.html`); page title reports `PASS (n)` / `FAIL (n)`; read `window.__TESTS__`.
- Shared Jest: `shared/__tests__/*.test.ts`.
- Server: `server/tests/*.test.js`.

## 5. What is not yet done

- M2 map: adapter contract and acceptance criteria are specified in `docs/MAP-ADAPTER-DECISION.md`, but no map build exists yet.
- Server deploy verification: no test has run on real Cloudflare D1 or in workerd yet.
- Public / paid map launch: gated on the production gate in `docs/MAP-ADAPTER-DECISION.md`, not on the M2 start.

## 6. Rule of thumb for this document

If a section here is a register of verified vendor/pricing reads, treat the cited date as the truth window and re-verify before committing budget. Anything not confirmable from a primary source is listed as *still open*, not guessed.

## 7. Unknowns register (spiked results)

Each value was read from an official vendor or policy page in **October 2026** and is cited inline. Pricing drifts — re-verify before committing budget. Anything not confirmable from a primary source is listed as *still open* rather than guessed.

### 7.1 EAS Build free-tier limits (spike: "EAS minute budgets"; needed for M0–M2 dev builds)

| Item | Verified value (October 2026) | Source |
|---|---|---|
| Free build quota | **15 Android + 15 iOS builds per month** (30 total) | [expo.dev/pricing](https://expo.dev/pricing) |
| CI/CD Workflows minutes (separate allowance) | **60 min/month** — a workflows allowance, **not** a per-build time budget. Paid per-minute job rates: $0.018 Linux medium · $0.035 Linux large · $0.075 macOS medium · $0.150 macOS large | [expo.dev/pricing](https://expo.dev/pricing), [usage-based pricing](https://docs.expo.dev/billing/usage-based-pricing/) |
| Concurrency (Free) | **5 concurrent jobs total, max 1 macOS** | [expo.dev/pricing.md](https://expo.dev/pricing.md) |
| Build timeout (Free) | **45 minutes per build** | [expo.dev/pricing.md](https://expo.dev/pricing.md) |
| EAS Update (Free) | **Unlimited updates · 1,000 monthly active users · 100 GiB edge bandwidth · 20 GiB storage** | [expo.dev/pricing](https://expo.dev/pricing), [EAS Update docs](https://docs.expo.dev/eas-update/introduction/) |
| Quota reset / exhaustion | Resets the **1st day of each calendar month**; Free **never overages** — builds are blocked until reset (or build locally / upgrade) | [billing FAQ](https://docs.expo.dev/billing/faq/) |
| Next paid tiers | **Starter $19/mo** + usage (adds $45 build credit, updates to 3,000 MAUs) · **Production $199/mo** + usage (adds $225 credit, 15 concurrency, updates to 50,000 MAUs) | [expo.dev/pricing](https://expo.dev/pricing), [billing FAQ](https://docs.expo.dev/billing/faq/) |

*Still open (not confirmable from official pages):* build-artifact retention in days; whether Free workflow minutes are counted differently on Linux vs macOS; what happens when the 60 workflow minutes are exhausted; any separate AI-build minute rule.

**Read:** the binding constraint is the **monthly build count** (≈15 per platform), not minutes — normal M0–M2 iteration pace fits free tier with headroom; schedule device-heavy milestone batches away from month-end-quota exhaustion.

### 7.2 Mapbox vs OSM tile pricing (spike: "map costs"; needed for M2 route rendering)

| Option | Verified price / terms (October 2026) | Source |
|---|---|---|
| **Mapbox Maps SDKs (iOS/Android)** | Billed **per monthly active user** (not per map load): first **25,000 MAU free**, then **$4.00 / 1,000 MAU** (25,001–125k), **$3.20 / 1,000** (125k–250k), **$2.40 / 1,000** (250k+); ≥1.25M = contact sales | [mapbox.com/pricing](https://www.mapbox.com/pricing), MAU definition in [iOS](https://docs.mapbox.com/ios/maps/guides/pricing/) / [Android](https://docs.mapbox.com/android/maps/guides/pricing/) guides |
| Mapbox direct tile APIs (only if bypassing the SDK) | Vector Tiles: first **200,000 requests per billing period free**, then **$0.25 / 1,000**; Static Tiles: 200,000 free, then **$0.50 / 1,000** (both fall to $0.15 / $0.30 at 4M+ requests) | [mapbox.com/pricing](https://www.mapbox.com/pricing), [Static Tiles docs](https://docs.mapbox.com/api/maps/static-tiles/) |
| Mapbox blanket "$100/mo usage credit" | **Not confirmed** — current billing docs describe product-specific free tiers only, no blanket credit | [pay-as-you-go FAQ](https://www.mapbox.com/accounts/faq/how-does-pay-as-you-go-billing-work/) |
| `tile.openstreetmap.org` | **No published numeric request limit and no SLA**; stable `User-Agent` required, cache tiles **≥ 7 days**, **no offline/bulk/prefetch**; access may be blocked or withdrawn. Not a production app API | [OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/) |
| **OpenFreeMap public instance** | **$0 — stated "no limits" on views/requests, no API key, commercial use allowed**; offline downloads ≤ 3,000 tiles / 50 MB each, ≤ 4 parallel requests; provided as-is, may be discontinued at any time (no SLA) | [openfreemap.org](https://openfreemap.org/), [ToS](https://openfreemap.org/tos/) |
| **MapTiler Cloud** (the hosted route OpenMapTiles itself points to) | **Free $0**: 100,000 API requests + 5,000 map sessions/month, **testing / non-commercial use only**. **Flex $30/month**: 500,000 requests + 25,000 sessions; overage **$0.15 / 1,000 requests**, **$2.50 / 1,000 map sessions** (512 px raster tile counts as 4 requests; vector tile = 1) | [MapTiler pricing](https://www.maptiler.com/cloud/pricing/), [sessions vs requests](https://docs.maptiler.com/guides/account/sessions-vs-requests/) |
| OSM US tileservice | Free **non-commercial** Starter tier only; revenue-generating use requires written permission | [usage policy](https://tiles.openstreetmap.us/usage-policy/) |
| Self-hosting reference | Hetzner CX33 **€8.49/mo** (4 vCPU / 8 GB), CPX32 **€35.49/mo** — **instance price only**: excludes dataset build, storage, backups, monitoring and admin time, and does not prove production adequacy | [Hetzner price adjustment, 2026-06-15](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) |

**Decision-relevant read:** Mapbox is **$0 up to ~25k monthly active users** of its mobile SDK — free through pre-launch and early growth, billed per MAU thereafter. OpenFreeMap is $0 with permissive written terms but explicitly no SLA; MapTiler Flex is a keyed **$30/mo** middle ground with published quotas; raw OSMF tiles are explicitly not a production app endpoint. The decision itself is recorded in `docs/MAP-ADAPTER-DECISION.md`; the production gate, not the M2 start, is where the SLA question is settled.

### 7.3 OpenFreeMap public instance — provider viability (spike: "is the free tile source actually usable, or does it disappear next quarter?")

Each value was read from an official OpenFreeMap page in **October 2026** and is cited inline. Treat the source as the truth for the provider's own words; where a fact is not stated on one of those pages, it is listed as *still open* rather than guessed.

| Item | Verified value (October 2026) | Source |
|---|---|---|
| Effective term / renewal | **No contract, per-user nothing** — service is provided free by Hyperknot Software Kft. (Zsolt Ero) and may be discontinued at any time without notice | [openfreemap.org/tos/](https://openfreemap.org/tos/) |
| Termination risk | **High unknown** — a single maintainer, no SLA, no governance body; the homepage states intent to keep renting servers until bandwidth is covered | [openfreemap.org](https://openfreemap.org/), [openfreemap.org/tos/](https://openfreemap.org/tos/) |
| Continuity path | **Exists and documents itself** — the full production setup is MIT and self-hostable; OpenFreeMap itself points to MapTiler Cloud as the hosted fall-back for tiles | [openfreemap.org](https://openfreemap.org/), [maptiler.com/cloud/pricing/](https://www.maptiler.com/cloud/pricing/) |
| Traffic / request transparency | **Not published** — successor rules, daily map view counts, per-user limits, and any abuse-protection attempt are not documented on the official pages | [openfreemap.org](https://openfreemap.org/), [openfreemap.org/tos/](https://openfreemap.org/tos/) |

*Still open (not confirmable from official pages):* concrete successor rules and the exact date the service would give before shutting down; whether there is a per-IP or per-session hidden rate limit in front of nginx; how many map views per day it currently serves.

**Read:** OpenFreeMap is the cheapest vibration-safe tile source for M2 — $0, commercial use allowed, offline downloads permitted within stated bounds, no API key — but it has no SLA and one maintainer, so it is the right choice for M2 development and pilot and the right *first* choice for nothing more. The production gate in `docs/MAP-ADAPTER-DECISION.md` §6 is not bureaucratic pedantry: it is the response to a tile source the provider itself says can go away any time.

### 7.4 Decided 2026-10-19 — map provider for M2

**Decided:** MapLibre React Native `11.5.0` + the OpenFreeMap public instance, behind a provider-swappable adapter in `app/src/map/`, for M2. $0, no API key, commercial use allowed, offline downloads permitted within 3,000 tiles / 50 MB per download — but **no SLA**, one maintainer, and it is **not loadable in Expo Go** (native module → development build). Production is gated on monitoring plus a tested MapTiler Flex / self-host fallback, not granted by this choice.

Full reasoning, costs/risks, adapter contract, acceptance criteria, what the spike did not verify, and reversal triggers are in `docs/MAP-ADAPTER-DECISION.md`.

*Still open:* Snap Kit eligibility; enterprise/region specifics for MapTiler or Mapbox; ODbL attribution implementation (verify the MapLibre attribution control on device).

## 8. Open documents

- `docs/MAP-ADAPTER-DECISION.md` — M2 map adapter decision and production gate.
- `docs/PLATFORM-BLUEPRINT.md` — platform / roadmap context.
- `docs/PRD.md`, `docs/MOBILE-SPEC.md`, `docs/MOBILE-REQUIREMENTS-PROMPT.md` — product and mobile requirements.
- `docs/AUDIT-REPORT.md` — current state-of-truth audit.
