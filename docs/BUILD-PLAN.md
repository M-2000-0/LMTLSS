# LMTLSS — Next Build Cycle Plan: Full iOS + Android App

Status: v1 — decided 2026-10-17
Decisions (owner, this cycle):

1. **Environment** — this repo + AI coding agent (custom development, Windows machine).
2. **Starting point** — working prototype (Phase 1 web app, 50 passing tests) + full spec suite ([PRD](PRD.md) · [MOBILE-SPEC](MOBILE-SPEC.md) · [MASTER-PROMPT](MASTER-PROMPT.md)).
3. **Priority** — the complete iOS and Android app.

This plan answers three questions: what to build in this environment, which capabilities require native code or external services, and what must be tested before calling LMTLSS production-ready.

---

## 0. Environment reality (probed, not assumed)

| Tool | Status on this machine | Consequence |
|---|---|---|
| winget | ✅ present | Node.js installable by the agent (may require one UAC approval) |
| node / npm / npx | ❌ missing | **M0 step 1** — install Node LTS |
| JDK / Android SDK / Gradle | ❌ missing | Local Android emulator optional; heavy install (~GBs) |
| Xcode / macOS | ❌ impossible on Windows | **iOS builds must run on EAS Build (Expo cloud)** |
| Docker | ❌ missing | Local Postgres → use a lightweight alternative or hosted DB for backend work |
| Python 3.12 | ✅ present | Serves the Phase 1 reference app |
| Physical devices | ❌ none verified | **Owner-provided**: an Android phone and an iPhone are mandatory for GPS/background testing |

**Architectural consequence:** the mobile app is built with **Expo prebuild + development builds + EAS Build**, which produces both iOS and Android binaries from this Windows machine. Local Android SDK setup is an optional later accelerator, not a dependency. Platform-specific code stays behind the adapter interfaces defined in [MOBILE-SPEC](MOBILE-SPEC.md) §2.

### Owner-provided prerequisites (flagged up front, per mobile appendix §11)

- Apple Developer Program membership (US$99/yr) — required for TestFlight and iOS distribution
- Google Play developer account (US$25 once)
- Physical devices: Android (API 26+) and iPhone — GPS and background tests cannot pass without them
- Expo account (EAS free tier to start; watch build-minute limits)
- Map provider account (evaluate Mapbox free tier vs. self-hosted OSM tiles — verify costs/licensing, "free library ≠ free map data")
- Later: FCM/APNs credentials, store assets, signing strategy

---

## 1. Target repository layout

```
LMTLSS/
  app/          React Native + TypeScript (Expo prebuild, dev builds) — the product
  shared/       Pure TS domain layer — ported from js/domain.js + js/tests.js (50 tests carry over)
  server/       TypeScript API + PostgreSQL (auth, sync, clubs, events, entitlements) — M3
  web/          Phase 1 reference app (index.html, css/, js/) — kept as design reference + live testbed
  docs/         PRD, specs, prompts, this plan
  tools/        serve.py and dev scripts
```

Rules: `shared/` has zero React Native imports (testable in plain Jest); `app/` never reimplements domain math; the web build remains the fastest way to review design changes; every milestone keeps the whole repo green (typecheck + lint + all tests).

## 2. Capability matrix — native code vs external service vs local

| Capability | Implementation | Native? | External service? | Verified by |
|---|---|---|---|---|
| Session engine, set logging, timers, rest, recovery | Local TS + SQLite | No | No | Unit + E2E (Jest/Maestro) |
| Plan generation, PRs, trends, insights, coach rules | `shared/` TS (ported) | No | No | 50 carried-over tests + new |
| Onboarding, home, progress, profile UI | RN components + design tokens | No | No | E2E both platforms |
| **GPS recording (start/pause/resume/finish, background)** | Platform location services behind adapter (expo-location dev-build config) | **Yes** | No | **Physical devices only** (protocol §5) |
| Distance/pace/splits from points (noise filtering) | Local math on validated points; server recompute on sync | No | No | Fixture tests + device runs |
| Route map rendering | Licensed map SDK/tiles behind adapter | Depends on SDK | **Yes** (tiles/data licensing + costs) | Device + fixture routes; licensing doc |
| Share Studio card generation | Deterministic templates, local render + worker fallback | No | No | Fixture-based image tests |
| Native share sheet | RN Share API | **Yes** | No | Device matrix |
| Snap Kit / Instagram sharing | Per-adapter integration | SDK | **Yes** | Capability matrix per adapter — investigate before building |
| Auth, delta sync, clubs, events, referrals, entitlements | `server/` API + PostgreSQL | No | Postgres (hosted or local) | API integration tests |
| Push notifications (APNs/FCM) | Expo notifications + server | **Yes** | **Yes** | Device tests |
| HealthKit / Health Connect | Native modules behind adapter | **Yes** | Platform services | Device tests + consent flows (M5) |
| Account deletion / export | Server jobs + client UI | No | Object storage for archives | API tests + manual audit |

Rule of thumb (from the memos): **OS behavior → native module; data we don't own → verified adapter with capability matrix; training truth → local-first.**

## 3. Milestones

Each milestone has a real Definition of Done; a screen existing is never completion.

**M0 — Environment & scaffold** *(agent-doable now)*
- ✅ Install Node LTS via winget (v24.20.0); scaffold `app/` (Expo SDK 58 / RN 0.88, TypeScript strict, ESLint flat config, Jest, React Navigation).
- ✅ Port `js/domain.js` + `js/tests.js` → `shared/` with storage shim; **63 Jest tests green** (57 domain assertions + 5 shim tests + 1 export-parity guard; browser suite untouched at 130).
- ✅ Typecheck/lint across `shared/` + `app/` green; README setup section updated. Structure §1 partial: `app/`, `shared/`, root scripts done; the `web/` + `tools/` folder moves are **deferred** (they rewrite every documented path in README/AGENTS/tests links — take as its own change).
- DoD: ✅ `npm test` green on this machine (64 tests: 63 shared + 1 app); ⏳ app boots in Expo dev build on at least one device or emulator — **no device/emulator on this machine** (owner hardware or an Android emulator behind the still-missing Android SDK); local proxy `npx expo export --platform android` run as bundle verification.

**M1 — Vertical slice** (spec §14, unchanged)
- Onboarding → personalized plan → strength session → time-only run → saved activity → progress summary → shareable card.
- Offline-first local persistence; interruption recovery (Phase 1 behavior preserved: idle-gap pause, never discard).
- DoD: spec §14 acceptance (1–7) passing on **both** platforms via dev builds.

**M2 — GPS running + Share Studio** (owner's steps 1–2)
- Activity Recording Service per [MASTER-PROMPT](MASTER-PROMPT.md) addendum §1: background tracking, point buffering, noise filtering, dedupe, provenance labels; route visualization behind licensed adapter (§2); Share Studio editor (templates, captions, metric hiding, route-privacy masks, aspect ratios, export fallback).
- Physical-device test protocol executed and logged (§5).
- DoD: J6 + J9 acceptance criteria met on real iOS and Android devices.

**M3 — Backend & accounts** (Foundation completion)
- `server/`: auth (short-lived tokens, rotation), delta sync with idempotent UUIDs, export, deletion audit, monitoring.
- DoD: MOBILE-SPEC §5 contract tests; two-account isolation test; signed-out 401s; no private data on public endpoints.

**M4 — Clubs & events** (owner's step 3)
- Club profiles, roles, announcements, events (hosted + external listings), RSVP/waitlist/calendar, moderation; **seeded with real partner organizers before discovery opens** (no empty screens).
- DoD: J10/J14/J17 acceptance; permission matrix enforced server-side.

**M5 — Integrations, one at a time** (owner's step 4)
- HealthKit/Health Connect first (MVP type set), then mapping vendor finalized, then Snap Kit / Instagram **each behind an adapter with its documented capability matrix**; wearables only after API verification.
- DoD: no integration shown as working before it passes its own test plan; revocation tolerated everywhere.

**M6 — Release candidates**
- Performance budgets, accessibility audit, crash-free ≥99.5%, capability matrix final, TestFlight + Play internal tracks, then store submission prep.
- DoD: the gate below, signed off item by item.

## 4. Production-readiness gate (what "production-ready" means here)

Consolidated from [MOBILE-SPEC](MOBILE-SPEC.md) §12, [PRD](PRD.md) §5.1, and the MASTER-PROMPT acceptance tests:

**Functional** — every PRD journey J1–J17 passes on both platforms; run record/pause/resume/finish works; data survives supported interruptions; offline core remains usable.
**Data** — provenance on every datum; no duplicate activities under sync retries; import preview-before-accept; export complete; **zero silent data loss events**.
**Platform** — permission grant/deny/revoke paths handled; background GPS validated on devices; push degrades gracefully; safe areas, dynamic type, reduced motion, screen readers checked.
**External** — each integration has a capability matrix with tested vs unsupported listed honestly; map licensing documented; partnership claims accurate.
**Security** — authz negative tests; tokens in Keychain/Keystore; no secrets/PHI/precise routes in logs; deletion + export audited.
**Performance** — budgets met (cold start ≤2.5 s, log-set ≤100 ms, run-start ≤1 s, battery ≤8%/h GPS reference).
**Honesty** — capability matrix shows planned/in-dev/implemented/tested/production-ready; no mock feature presented as working; AI evals green with deterministic fallbacks.

**Cannot be verified from this machine (owner + device required):** physical GPS accuracy and background behavior · iOS build/signing (EAS + Apple account) · push delivery · HealthKit/Health Connect on-device · store submission · real-club seeding.

## 5. Physical-device test protocol (M2 gate)

For each of iOS and Android: fresh install → permission grant → 20+ min outdoor run with screen lock → pause/resume ×2 → weak-signal segment (urban/indoor edge) → force-quit and relaunch → complete → verify distance/pace vs reference (watch/app) → route renders from actual points only → background never shows false "recording" → permission denied path → time-only path labeled → share card from the real activity → battery delta recorded. Any failure = M2 not done.

## 6. Working agreement

- Milestones are strictly ordered; integrations (M5) never precede the core loop demonstrating retention (M1–M2).
- Every PR: typecheck + lint + full test suite; every milestone: updated capability matrix and README.
- The agent reads existing code and design system before changes, reuses components, creates migrations, and runs regression tests — never blind generation (Product Builder principle).
- Unknowns (map costs, Snap Kit eligibility, EAS minute budgets) are spiked early in the milestone that needs them and recorded here.
