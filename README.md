<p align="center">
  <img src="logo/image-removebg-preview.png" alt="LMTLSS emblem" width="120" />
</p>

<h1 align="center">LMTLSS</h1>
<p align="center"><strong>YOUR PERFORMANCE. WITHOUT LIMITS.</strong></p>
<p align="center">The operating system for human performance — one place to train, understand your performance, and improve across sports.</p>

---

LMTLSS is a premium, intelligent, multi-sport performance platform. Phase 1 ships two excellent sports — **strength training** and **running** — on a modular activity model designed to grow to more disciplines without a rewrite.

## What's in Phase 1

- **Adaptive Home** — today's session, readiness check-in, compact week-over-week progress, one sourced insight. No wall of statistics.
- **Train** — strength sessions (exercise picker filtered to your equipment, history-prefilled loads, set logging, rest timer, substitutions, pause/resume) and running sessions (live timer, manual distance with explicit provenance, computed pace).
- **Progress** — weekly volume and distance charts, personal records with Epley-estimated 1RMs (labeled as estimates), explainable "what changed" insights, full history.
- **Coach** — recommendation cards with reasoning and confidence, plus rule-based Q&A that cites your own logged data and declines to guess when data is thin.
- **Profile** — goals, weekly plan editing, units and rest-timer settings, JSON export, full data deletion.

Everything persists locally in your browser (`localStorage`). No account, no tracking, no network calls.

## Quick start

No build step, no dependencies.

```bash
# Option A — any static server
python serve.py 8123
# open http://127.0.0.1:8123/index.html

# Option B — just open the file
open index.html
```

On first launch you can run the onboarding flow or load clearly-labeled demo data.

## Mobile app (Expo — milestone M0)

The native iOS + Android app lives in `app/` (Expo SDK, TypeScript strict, ESLint, Jest, React Navigation); `shared/` is the pure TypeScript port of `js/domain.js` used by it. Requires **Node.js LTS** (installed via winget on this machine).

```bash
npm --prefix app install   # first run only
npm test                   # Jest: shared domain (63) + app smoke test (1)
npm run typecheck          # strict TS across shared/ + app/
npm run lint               # ESLint across shared/ + app/
npm --prefix app start     # Expo dev server
```

The web app keeps its zero-build contract — the two codebases live in parallel, and a parity test fails if `js/domain.js` and `shared/src/domain.ts` ever drift apart on their public API.

## Documentation

| Doc | What it is |
|---|---|
| [docs/PLATFORM-BLUEPRINT.md](docs/PLATFORM-BLUEPRINT.md) | **Research-verified platform blueprint**: wearable/provider integration facts with citations (Apple, Health Connect, Strava, Garmin, others), integration sequence, behavioral-design decisions, decision memo, 30-day plan |
| [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md) | **Next build cycle: full iOS + Android app** — probed environment reality, native/external/local capability matrix, milestones M0–M6, production-readiness gate, device test protocol |
| [docs/MASTER-PROMPT.md](docs/MASTER-PROMPT.md) | **LMTLSS 2.0 — the canonical master brief**: five pillars, sport engineering framework, activity cards, club & growth mechanics, AI architecture, build order |
| [docs/PRD.md](docs/PRD.md) | Product requirements (Draft v2.2, aligned to 2.0 + platform-systems + activity/clubs/events/sharing specs): pillars, retention loop, MVP scope and exclusions, 17 user journeys with acceptance criteria, Sport System Specification, day-one metrics, build order, ten platform systems, events & Share Studio |
| [docs/MOBILE-SPEC.md](docs/MOBILE-SPEC.md) | Mobile technical specification: React Native + PostgreSQL architecture, data model, API contracts, offline sync, GPS/background, HealthKit & Health Connect, security, AI orchestration, performance budgets, testing, release plan, first vertical slice |
| [docs/MOBILE-REQUIREMENTS-PROMPT.md](docs/MOBILE-REQUIREMENTS-PROMPT.md) | Copy-paste appendix for the master prompt — binding iOS + Android implementation requirements |

The Phase 1 web app in this repo is the **design-system and interactive-prototype deliverable**: the reference implementation for flows, tokens, and interaction quality that the native build must match.

## Tests

```bash
python serve.py 8123
# open http://127.0.0.1:8123/tests.html
```

The suite (130 assertions) covers plan generation across equipment/experience combinations, PR and Epley math, weekly trends, insight honesty, coach rules, formatting, schema-migration/data-quarantine behavior, the live-session clock math (refresh resume + idle freeze), the pricing/entitlement engine (price precedence, custom offers, regional pricing, coupons, volume tiers, quota enforcement, audit trail), and the share-card system (composition, provenance labels, route projection + privacy trim, XML-escaping security). The page title reports `PASS (n)` or `FAIL (n)`.

The **domain-test sections are also ported to Jest** in `shared/__tests__/` (63 tests, run by `npm test`) — same assertion names as the browser suite, plus a storage-shim seam test and the js/domain ↔ shared/domain export-parity guard. Store-migration, pricing, share-card and UI assertions remain browser-only for now.

## Structure

```
index.html        app shell
tests.html        test harness
package.json      root scripts: npm test / typecheck / lint (delegates to app/ + shared/)
app/              Expo + React Native app (TypeScript strict; the product)
shared/           pure TS domain layer — Jest-tested port of js/domain.js
admin.html        Pricing & Plans admin prototype (local, no billing)
serve.py          dev static server (no-store caching)
css/tokens.css    brand + design tokens
css/app.css       components & screens
js/store.js       schema, persistence, export, delete, demo seed
js/domain.js      plan generation, PRs, trends, insights, coach rules
js/pricing.js     pure pricing/entitlement engine (plans, price book, offers, discounts, audit)
js/admin.js       Pricing & Plans prototype UI (localStorage-backed)
js/sharecards.js  share-card system: composition, route projection + privacy trim, SVG, PNG export
js/ui.js          DOM helpers, icons, charts, sheets, toasts
js/onboarding.js  first-run flow
js/screens-*.js   Home / Train / Progress / Coach / Profile
js/app.js         router & boot
js/tests.js       domain + pricing tests
logo/             brand marks
```

The **Pricing & Plans admin prototype** (`admin.html`, linked from Profile) implements plan management, a regional price book, custom negotiated offers, coupons, simulated subscriptions, and an entitlement simulator — all resolved by the pure engine in `js/pricing.js` with a full audit trail. **No payment processing is integrated**; entitlement enforcement must move server-side when a backend exists.

## Brand

| Token | Value | Role |
|---|---|---|
| Canvas | `#000000` | Pure black background |
| Accent | `#61EB1A` | Electric green — actions, active states, key metrics, progress |
| Text | `#FFFFFF` / `#A3A3A3` / `#737373` | Primary / secondary / muted |
| Surfaces | `#111111` elevated, `#262626` borders | Hierarchy without color noise |

Green is a functional color, never decoration. No second accent color.

## Status & roadmap

- **Phase 1 (this repo)** — foundation: brand system, onboarding, adaptive home, strength + running, logging, history, basic analytics, responsive + accessible components, tests.
- **Phase 2** — training intelligence: adaptive calendar, deeper coach, recovery and nutrition foundations, more sport workflows.
- **Phase 3** — connected ecosystem: wearable integrations, expanded sports, community and discovery.

Integrations (GPS, wearables, health platforms) are shown as **Unavailable** until they are genuinely implemented and tested — the product never presents a mock capability as working.

## License

All rights reserved (add a LICENSE when you pick one).
