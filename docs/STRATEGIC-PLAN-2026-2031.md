# LMTLSS Five-Year Strategic Plan

## FY2027-FY2031

**Prepared for:** Founders, prospective investors, club and event partners, and the delivery team  
**Prepared by:** Strategy and delivery office  
**Date:** 23 October 2026  
**Status:** Planning baseline v1.0 - a decision document, not a revenue forecast  
**Planning horizon:** 1 November 2026 to 31 October 2031 (FY2027-FY2031)  
**Companion documents:** `docs/PRD.md`, `docs/MOBILE-SPEC.md`, `docs/BUILD-PLAN.md`, `docs/PLATFORM-BLUEPRINT.md`, `docs/LAUNCH-TRUTH.md`, `docs/AUDIT-REPORT.md`

---

## Document control

### Purpose, scope, and evidence standard

This plan answers four questions: what LMTLSS is becoming, what must be true for it to work, what it costs, and who does what when. It covers the product, commercial model, operating organization, and distribution partnerships. It excludes clinical services, medical diagnosis, insurance billing, and hardware manufacturing.

Every material claim carries one of four labels:

| Label | Meaning | How to treat it |
|---|---|---|
| **[F] Fact** | Verified in the repository or a dated external source | Reliable within the stated date window |
| **[A] Assumption** | A planning input we chose, not yet verified | Must be tested; the plan states the test |
| **[H] Hypothesis** | A belief about user or market behavior | Must be falsified or supported by experiment |
| **[D] Decision** | A recommended choice with an owner and date | Binding once approved; changes need a log entry |

The repository is unusually honest about its own state, and this plan preserves that discipline. There is no user research in the repository, no revenue, no signed club partners, no deployed backend, and no completed store build. Where the plan needs those inputs, it labels them as assumptions rather than smuggling them in as facts.
---

## 1. Executive summary

### 1.1 The one-paragraph version

LMTLSS is a pre-revenue, local-first training product with a working web reference implementation, a partially built React Native app, a tested but undeployed API, and 425 passing assertions across its suites. It has earned the right to build a native product; it has not yet earned the right to claim a business. The opportunity is real but narrow: fitness apps are a large, growing category, and the athletes LMTLSS is designed for - people who lift and run, or train across several disciplines - are poorly served by single-sport incumbents. The strategy is to win that segment with the most trustworthy cross-sport training record on the market, launch natively in the United States, prove retention before scaling spend, and expand into clubs and additional sports only when the core loop is demonstrably working. The five-year base case is 2.1 million cumulative installs, 600,000 monthly active athletes, 55,000 paying subscribers, and $6.3 million of revenue in FY2031, with EBITDA turning positive that year. It requires $9.0 million of staged capital, or a deliberately smaller lean path that reaches sustainability without a Series A.

### 1.2 The strategic thesis

**The category is crowded at the edges and empty in the middle.** Strength loggers are excellent at sets and reps. Endurance platforms are excellent at routes and pace. Social networks are excellent at kudos. Almost nobody treats a heavy squat and a tempo run as two expressions of the same athlete, with one honest record, one progression model, and one identity. The repository already contains the hard part: a 14-sport metric model, sport-specific validation, provenance labeling, Epley-estimated 1RMs labeled as estimates, and a rule that an unimplemented capability must render as unavailable. [F]

**The wedge is the hybrid athlete.** The definition is precise: an adult who strength-trains at least twice a week and runs at least twice a week, or trains three or more disciplines in a structured week. That athlete currently stitches together a strength logger, a run tracker, a spreadsheet, and a notes app. The switching cost is not features; it is rebuilding history and the fear of losing it. LMTLSS already has the migration and quarantine discipline that promise requires. [F]

**The moat is trust plus the cross-sport record, not AI.** Models are a commodity input. A canonical activity record with provenance, a domain model that refuses to compare incompatible metrics, and a brand that will not fabricate a number are not. AI narrates that record; it is not the record. Clubs are the retention and revenue layer - membership, events, capacity, waitlists, attendance, announcements - and the club API already exists and is tested. [F]

### 1.3 Five-year headline targets (base case)

| Metric | FY2027 | FY2028 | FY2029 | FY2030 | FY2031 |
|---|---:|---:|---:|---:|---:|
| Annual installs | 50,000 | 180,000 | 450,000 | 650,000 | 800,000 |
| Cumulative installs | 50,000 | 230,000 | 680,000 | 1,330,000 | 2,130,000 |
| Monthly active athletes (end of year) | 10,000 | 50,000 | 150,000 | 320,000 | 600,000 |
| Paying subscribers (end of year) | 750 | 3,800 | 12,500 | 28,000 | 55,000 |
| Consumer revenue | $60,000 | $300,000 | $1,000,000 | $2,300,000 | $4,600,000 |
| Club revenue | $0 | $100,000 | $350,000 | $750,000 | $1,200,000 |
| Marketplace revenue | $0 | $0 | $50,000 | $250,000 | $500,000 |
| **Total revenue** | **$60,000** | **$400,000** | **$1,400,000** | **$3,300,000** | **$6,300,000** |
| Gross margin | 68% | 72% | 75% | 77% | 78% |
| Headcount (end of year) | 7 | 11 | 17 | 20 | 22 |
| EBITDA | ($1,309,200) | ($1,962,000) | ($2,636,000) | ($2,039,000) | $274,000 |

All figures are **[A] planning assumptions**, derived from the unit-economics model in section 10. They are not forecasts and should not be presented to investors as commitments. The model's inputs - installs, activation, retention, conversion, ARPU, churn, and cost per hire - are stated explicitly so that a reviewer can change one input and see the consequence.

### 1.4 What must be true

The plan rests on six testable propositions. If any two fail at their gate, the strategy narrows rather than doubles down.

| # | Proposition | Test | Gate |
|---|---|---|---|
| 1 | Hybrid athletes want one record badly enough to switch | 40%+ of beta users connect or import history within 7 days; 25%+ log both strength and endurance in the same week | End FY2027 |
| 2 | The product can retain beyond the category baseline | D30 retention at or above 12%, versus a 3-4% health-and-fitness benchmark | End FY2027 |
| 3 | A free-to-premium model works without paywalling history | Install-to-paid at or above 2.5%, trial-to-paid at or above 35%, refunds below 5% | End FY2028 |
| 4 | Clubs will pay for administration, not just exposure | 20 active clubs with 5+ events each and 60%+ monthly admin activity | End FY2028 |
| 5 | Acquisition can be made economical | Blended CAC payback under 12 months; organic share/referral at least 35% of installs | End FY2029 |
| 6 | The platform can add a sport without destabilizing the core | A new sport ships in under 10 weeks with full test coverage and no regression in core crash-free rate | End FY2029 |

### 1.5 Capital requirement and financing options

**Base case:** $2.5 million seed at the start of FY2027 (calendar Q4 2026), followed by an optional $6.5 million Series A early in Q3 FY2028. Cumulative operating need peaks at roughly $7.9 million in FY2030, leaving about six months of runway at the lowest point before the FY2031 turn. The Series A is priced on FY2028 progress, not on promises: revenue tracking to $400,000, at least 2,000 paying subscribers at close, CAC payback under 12 months, and gross margin above 72%. If those are not true, the lean case applies instead.

**Lean case:** no Series A; headcount capped at 12; growth at roughly 45% of the base case; break-even in FY2030 at roughly $1.8 million of revenue. **Upside case:** 1.4x installs and 1.2x conversion, reaching roughly $9.5 million of revenue and a 12% EBITDA margin in FY2031. The lean case is a legitimate outcome, not a failure; the upside comes from clubs and international localization, not a viral feed.

### 1.6 The six decisions that must be made before any of this is executable

The plan recommends an answer for each; the founders must ratify or change them by 15 November 2026.

| ID | Decision | Recommendation | Rationale |
|---|---|---|---|
| DEC-01 | Launch surface | Native iOS and Android, with the web app as acquisition and reference; no web-first PWA as the primary product | Background GPS, HealthKit, Health Connect, push, and store billing only exist natively |
| DEC-02 | Backend and auth in scope | Yes. Deploy the Worker and D1, adopt a managed OIDC provider, enforce authorization server-side | Sync, clubs, events, entitlements, and deletion cannot be honest without a server |
| DEC-03 | GPS and maps in scope | Yes for running, cycling, and swimming, gated on physical-device testing; maps via MapLibre plus a production fallback | The manual-distance fallback is honest, but GPS is table stakes for endurance |
| DEC-04 | AI in scope | Not at launch. Ship rule-based coaching; add AI Tier 1 only after eval gates and a deterministic fallback exist | Logging must never depend on a model; trust is the brand |
| DEC-05 | Definition of production-ready | Signed store builds on both platforms, live backend, tested restore and deletion, monitored crashes, and a documented incident process | "It renders" is not a release criterion |
| DEC-06 | Launch markets | United States first, then Canada, United Kingdom, Australia, Ireland; continental Europe in FY2029 | English-first reduces localization and support load while the loop is unproven |

---

## 2. Baseline: what actually exists, and what it means

### 2.1 The assets that carry forward

LMTLSS is not a blank page. The repository contains a mature domain layer and a set of disciplines most seed-stage fitness apps do not have. The following assets are real, tested, and reusable.

| Asset | What it is | Evidence | Strategic value |
|---|---|---|---|
| Pure domain logic | Plan generation, Epley 1RM estimates, personal records, trends, explainable insights, rule-based coaching, 14-sport metric model | `js/domain.js`, `shared/src/domain.ts`, parity test | The core of the cross-sport record; portable to native |
| Data-integrity discipline | Schema migration chain, quarantine of unreadable payloads, raw-byte preservation, local-day boundaries | `js/store.js`, migration tests | Makes the "bring your history" promise credible |
| Session reliability | Elapsed-time math, pause/resume, 10-minute idle freeze, refresh recovery | `Domain.elapsedSec`, `Domain.resumeSession` | The emotional core of "do not lose my workout" |
| Pricing engine | Entitlements, regional price book, offers, coupons, volume tiers, audit trail, price-versus-permission separation | `js/pricing.js`, 40 pricing assertions | A server-portable reference for Premium and club billing |
| Share-card system | Deterministic composition, route projection and privacy trim, provenance labels, XML escaping, SVG and PNG export | `js/sharecards.js`, share-card assertions | The organic acquisition loop, already privacy-aware |
| Design system | Black canvas, functional green accent, surfaces, typography, components | `css/tokens.css`, `css/app.css` | Brand consistency across web, native, and cards |
| API foundation | Health, identity, communities, membership, roles, bans, posts, events, capacity, waitlists, moderation, notifications, deletion | `server/`, 60 tests against in-memory SQLite | The club and event layer, already modeled |
| Honesty convention | Unimplemented capabilities render as "Unavailable"; provenance labels at point of use; no mock integrations in production paths | `AGENTS.md`, `LAUNCH-TRUTH.md`, audit | The differentiator and a hard-to-copy operating norm |

The test baseline is unusual for this stage: 215 browser assertions, 129 shared Jest tests, 21 app tests, and 60 server tests, all executed on 20 October 2026. [F] That does not prove product-market fit, but it proves the domain logic and data-integrity rules are executable rather than aspirational.

### 2.2 The gaps that define the next 18 months

The same audit is unsparing about the gaps. This is the real starting line.

| Gap | Current state | Consequence | First move |
|---|---|---|---|
| No deployed backend | Worker and D1 are tested locally, never run in workerd or on real D1 | Sync, clubs, events, entitlements, and deletion cannot be offered | Staging deploy with `wrangler dev --local` and real D1 |
| No auth provider | HS256 seam exists; no provider, no sign-in screen, no token can be issued | No athlete can create an account | Select and integrate a managed OIDC provider |
| No completed store build | Expo app runs in Expo Go; no EAS account, no dev or store build | The product cannot reach a real home screen | EAS setup, dev build, TestFlight and internal track |
| GPS unverified on device | Foreground skeleton and background wiring exist; `expo-location` not installed; no prebuild; no device test | Running is manual-distance only: honest but not competitive | Install, prebuild, device matrix, fail loudly |
| No analytics or crash reporting | Console-only today | Cannot measure activation, retention, or crashes | Event taxonomy, crash SDK, consent-aware analytics |
| No support operation | No help center, no ticketing, no response SLA | A public launch would generate unanswered users | Help center, in-app support, 24-hour first response |
| No users, revenue, or partners | Pre-revenue; no signed clubs | Every commercial assumption is unvalidated | Beta cohort and club pilot |
| No named team or ownership | Contributors are not documented as a staffed org | Accountability is ambiguous | RACI and hiring plan in section 13 |

### 2.3 What the tests do and do not prove

The 425 assertions prove the domain logic, data integrity, session clock, pricing precedence, and share-card privacy. They do not prove that a real athlete can complete onboarding on a phone, that background GPS survives a locked screen, or that anyone will pay. Those are the jobs of FY2027. Engineering progress is not commercial progress.

LMTLSS should not spend FY2027 building breadth. It should convert a strong prototype into a reliable native product for one narrow athlete, in one market, with one promise: **your training record will not lie to you, and it will not lose your session.** More sports, AI, clubs at scale, and international expansion are rewards for passing that test.

---

## 3. Market, customer, and competition

### 3.1 Category context, not a market-size fantasy

The global fitness apps market was valued at approximately $12.1 billion in 2025 and is projected to reach $33.6 billion by 2033, a 13.4% compound annual growth rate from 2026 to 2033. [F] Grand View Research, 2026. That describes a large category, not LMTLSS's addressable market, and it is not a revenue forecast.

The useful context is behavioral:

- More than 50 million Americans ran or jogged in 2024, and race participation grew 5% in 2025 after 8% in 2024. [F] SFIA via Running USA; RunSignup, 2025.
- A record 81 million Americans held a gym, studio, or fitness facility membership in 2025. [F] Health & Fitness Association via ABC Fitness, 2026.
- 46% of U.S. adults owned a wearable in 2025, and 83% of owners wore it at least five days a week. [F] Rock Health, 2025.
- Strava reported more than 200 million registered users in July 2026 and approximately $490 million of revenue in 2025, with an estimated 50 million monthly active users. [F] Strava, 2026; Sacra, 2025.
- Health and fitness apps retain roughly 3-4% of installs at day 30; freemium download-to-paid conversion has a median near 2.1%, hard paywalls convert near 12%, and refunds run near 4.7%. [F] Business of Apps, 2026; RevenueCat, 2025-2026.

Demand is large and habitual; retention is brutal. A product that matches category averages will not build a durable business, so the plan targets top-quartile retention and earns the right to paid acquisition before spending.

### 3.2 Bottom-up addressable market

The top-down category number is not actionable. A bottom-up estimate is more honest, provided every input is labeled.

**Definition:** a hybrid athlete is an adult who (a) strength-trains at least twice a week and runs at least twice a week, or (b) trains three or more disciplines in a structured week, and (c) has logged at least one session in an app in the past 90 days.

| Input | Value | Label | Source or reasoning |
|---|---:|---|---|
| U.S. adults who ran or jogged in 2024 | 50 million | [F] | SFIA via Running USA |
| U.S. gym, studio, or facility members in 2025 | 81 million | [F] | HFA via ABC Fitness |
| Overlap assumed to strength-train 2+ times per week | 8-12% of runners | [A] | No public cross-tab; must be validated with survey data |
| Implied U.S. hybrid athletes | 4.0-6.0 million | [A] | 50 million x 8-12% |
| Total serviceable hybrid pool (U.S. x 1.4) | 5.6-8.4 million | [A] | Comparable English-speaking and Western European markets |
| Share structured enough to pay for a training product | 25-35% | [A] | Comparable to paid penetration in focused fitness apps; validate |
| Addressable paying athletes | 1.4-2.9 million | [A] | Pool x paying share |
| Net revenue per paying athlete per year | $84 | [A] | ~$104 gross from a monthly ($9.99) and annual ($79.99) mix with regional pricing, less 15% store fee and 4.7% refunds |
| Addressable revenue pool | $118-244 million | [A] | Paying athletes x net ARPU |
| FY2031 base-case paying subscribers | 55,000 | [A] | 1.9-3.9% of the paying pool |
| FY2031 base-case consumer revenue | $4.6 million | [A] | 55,000 x $84 |

The conclusion is not "this is a $12 billion market." It is that **a focused, well-executed product can reach 55,000 paying athletes without winning the category.** That is a credible seed-to-Series-A story if retention and club economics hold. It is not credible if the product remains a generic logger.

### 3.3 The customer

**Primary segment: the hybrid athlete.** Age 25-40, urban or suburban, disposable income, already paying for one or two fitness subscriptions, owns a phone and often a watch. They lift 2-4 times a week and run 2-3 times a week, or train for a race while maintaining strength work. They are not professionals. They are time-constrained, data-literate, and skeptical of apps that invent scores.

Their workaround is a stack: Hevy or Strong for lifting, Strava or Nike Run Club for running, a spreadsheet for the weekly plan, a notes app for how they felt. The pain is not a missing feature. It is the reconciliation tax: duplicate entries, inconsistent dates, no single answer to "how am I doing," and no way to see that a heavy squat week and a high-mileage week compete for the same recovery budget.

**Secondary segment: the returning competitor.** Age 30-45, formerly competitive, now training for health and occasional events. They want structure, a plan that respects a busy week, and evidence of progress, and they are more likely to pay for coaching-adjacent features and to join a club.

**Tertiary segment: the club athlete.** A member of a run club, strength gym, martial arts academy, or team. They do not choose the app; the club does. Their loyalty is to the group and their data is a by-product of attendance - the bridge to B2B revenue and the most efficient acquisition channel once a club is live.

**B2B buyer: the club operator.** A gym owner, run-club organizer, academy coach, or event director who needs membership administration, event capacity, waitlists, attendance, and announcements. They pay for saved administrative time and retention, not for a social feed.

### 3.4 Competitive landscape

The following matrix is a strategic summary, not a feature-by-feature audit. Where a competitor's capability is uncertain, the table says so rather than guessing.

| Product | Strength | Weakness relevant to LMTLSS | Price anchor | Implication |
|---|---|---|---|---|
| **Strava** | 200M registered users, social graph, routes, segments, brand | Endurance-centric; strength is a bolt-on; social feed can feel performative; privacy concerns around routes | $11.99/mo, $79.99/yr [F] | Do not compete on social graph. Integrate as an import/export source and win the athlete Strava underserves |
| **Hevy** | 17M+ users, excellent strength logging, free tier, social features | Strength-only; limited endurance and cross-sport progression; low-priced Pro | ~$2.99/mo, $23.99/yr (unconfirmed) [F] | Do not compete on price for strength logging. Win on the cross-sport record and club/event layer |
| **Runna** | Strong running plans, acquired by Strava, brand momentum | Running-only; plan-centric; less useful for lifters | $19.99/mo, $119.99/yr [F] | Running plans are table stakes by FY2028; differentiate through strength integration |
| **WHOOP** | Hardware-plus-subscription, recovery narrative, strong brand | Expensive, hardware-dependent, one physiological model, not a training log for all sports | $199-$359/yr (unconfirmed) [F] | Integrate data; do not compete on hardware or recovery scores |
| **Apple Fitness+ / Apple Health** | Distribution, Watch integration, polished content | Content-led, not a cross-sport training record; limited social and club layers | Bundled / subscription [F] | Treat Apple as a platform partner and a constraint, not a direct enemy |
| **LMTLSS (target)** | One truthful cross-sport record, provenance, clubs, privacy-safe sharing | No users, no deployed backend, no store build, no brand yet | Premium $9.99/mo, $79.99/yr [D] | The only defensible position is trust plus cross-sport coherence |

The competitive conclusion is uncomfortable but useful: **LMTLSS cannot win by adding more sports than Strava, more exercises than Hevy, or more AI than a well-funded coaching app.** It can win by being the only product that treats the hybrid athlete's week as one problem, and by being visibly more honest than the alternatives. That is a narrower claim, and a more defensible one.

### 3.5 The counter-case

A serious plan must state why it might be wrong.

- **The hybrid athlete may not exist at scale.** The overlap between regular lifters and regular runners is assumed, not measured. If it is 3% of runners rather than 8-12%, the addressable pool shrinks by more than half. A 1,000-person survey must test this before FY2028 spend.
- **Single-sport apps may be good enough.** Athletes may prefer best-in-class tools and accept the reconciliation tax; "one app" is a convenience, not an urgent pain.
- **Incumbents can bundle.** Strava owns Runna and could deepen strength integration, Hevy could add running, and Apple could make Health a better cross-sport record. The moat must be trust and club relationships, not feature parity.
- **Retention may stay at category averages.** At D30 of 5% rather than 12%, paid acquisition never pays back and the plan must shift to clubs and B2B much earlier.
- **AI may commoditize the coaching layer faster than expected.** If every app has a competent AI coach, the differentiator is the record and the club, not the model.

These are not reasons to stop. They are the experiments that determine which version of the plan gets funded.

---

## 4. Strategy and positioning

### 4.1 Positioning statement

For athletes who refuse to choose one sport, LMTLSS is the training record that treats a heavy squat and a tempo run as parts of the same performance story - and never invents a number to fill a gap. Unlike single-sport loggers, social networks, and AI coaches, LMTLSS keeps one provenance-labeled record across disciplines, explains progress against the athlete's own baseline, and gives clubs a real operating layer instead of a feed.

### 4.2 The five strategic pillars

| Pillar | What it means operationally | What it rules out | How it is measured |
|---|---|---|---|
| **Truth** | Every datum carries provenance; estimates are labeled; the product refuses to guess; migrations never discard; failures are visible | Fake integrations, fabricated trends, vanity composite scores, silent data loss | Zero data-loss events; provenance coverage; insight refusal correctness |
| **One athlete, many sports** | A shared activity core plus typed sport extensions; a sport ships only with a full specification and practitioner validation | Generic workout templates forced onto every sport; "30 sports in a menu, two usable" | Sports shipped with spec; cross-sport weeks per active athlete; regression rate |
| **Progress you can feel** | Plans, next milestones, weekly consistency, explainable insights, own-baseline comparisons | Daily streak pressure, punishment for rest, universal athletic scores | Plan adherence; milestone completion; self-reported progress |
| **Belonging without noise** | Clubs, events, capacity, attendance, moderation; private by default; no infinite feed | Algorithmic feed, engagement quotas, public-by-default profiles | Active clubs; event attendance; notification opt-out rate |
| **Sustainable economics** | Free core, Premium, club SaaS, marketplace; no paywall on history, export, or privacy | Paying to access your own data; advertising-based surveillance; hardware | Gross margin; CAC payback; NRR; refund rate |

### 4.3 What we will do, and what we will not do

| We will | We will not | Why |
|---|---|---|
| Launch native in the U.S. with strength and running | Launch a web-first PWA as the primary product | Background GPS, health stores, push, and billing are native capabilities |
| Keep the free tier genuinely useful | Paywall logging, history, export, deletion, or basic privacy | The athlete's own data is not a hostage; trust depends on this |
| Add sports only with a full Sport System Specification | Add a sport because a competitor has it | Breadth without depth is the category's failure mode |
| Use AI where it narrates verified facts | Let AI compute records, pace, volume, or safety-critical advice | Deterministic calculations must remain deterministic |
| Build clubs with real partners before discovery opens | Launch an empty discovery screen or seed fake clubs | Empty social products feel abandoned and erode trust |
| Grow through share cards, clubs, and content | Buy installs before CAC payback is proven | Paid acquisition amplifies a leaky bucket |
| Publish capability honestly | Market a roadmap item as a shipped feature | The honesty invariant is the brand |

### 4.4 Business model

| Tier | Price | What is included | What is deliberately excluded |
|---|---|---|---|
| **Free** | $0 | Logging, history, plans, basic insights, core share cards, club membership, export, deletion | Advanced analytics, AI coaching, premium card styles, club administration |
| **Premium** | $9.99/mo or $79.99/yr (U.S. list) | Advanced cross-sport analytics, AI Tier 1 and Tier 2, adaptive calendar, premium card styles, priority support | Nothing that gates the athlete's own history or privacy |
| **Clubs** | $99/mo up to 100 members; $249/mo up to 500; custom above 500 | Admin, events, capacity, waitlists, attendance, announcements, moderation tools, club analytics | Member data export is always allowed; no lock-in |
| **Marketplace** | 20% take rate | Verified coach programs, event registration, premium plans | No pay-to-rank; no undisclosed promotion |

The pricing is a **[D] recommendation**, not a validated fact. The repository already contains a pure pricing engine with precedence, grandfathering, coupons, volume tiers, and an audit trail - the reference the server-side billing service must replicate. [F] The first price test runs in FY2028 with three arms ($7.99, $9.99, and $12.99 per month), each with an annual option at roughly 8x the monthly price.

### 4.5 What would make us change the strategy

| Signal | Threshold | Response |
|---|---|---|
| Hybrid behavior is rare | Fewer than 15% of beta users log both strength and endurance in a week | Narrow to a single-sport wedge (strength or running) and revisit cross-sport later |
| Retention stays at category baseline | D30 below 8% after two onboarding iterations | Stop paid acquisition; invest in the core loop or pivot to club software |
| Paid conversion is weak | Install-to-paid below 1.5% after three price tests | Shift revenue toward clubs and marketplace; keep consumer free |
| CAC never pays back | Blended payback above 18 months for two consecutive quarters | Cap growth spend; focus on organic share and partnerships |
| Club pilots do not activate | Fewer than 10 clubs with 5+ events after two quarters | Treat clubs as a feature, not a revenue line; do not build a sales team |
| A platform partner closes the gap | Apple or Strava ships a credible cross-sport record | Compete on clubs, privacy, and depth; or seek partnership/acquisition |

---

## 5. Year 1 (FY2027): Foundation and initial development

**Period:** 1 November 2026 to 31 October 2027  
**Theme:** Earn the right to exist.  
**Primary market:** United States, English only.  
**Product surface:** Native iOS and Android, with the static web app as the marketing, reference, and share-preview surface.

### 5.1 Objectives

1. **Resolve the launch ambiguity.** Ratify `DEC-01` to `DEC-06` and publish a one-page launch brief: what ships, what does not, and what "production-ready" means. No engineering work proceeds against an undefined launch surface.
2. **Make the backend real.** Deploy the Worker and D1 to staging, verify them in `wrangler dev --local` and against real D1, integrate a managed identity provider, and enforce authorization on every private endpoint.
3. **Make the native app real.** Reach parity with the web reference for strength and running: offline session recording, background GPS, HealthKit and Health Connect, share-card export, account deletion.
4. **Prove reliability on devices.** Run the GPS and session-recovery matrix on physical iOS and Android devices, publish the results including failures, and fix them before launch.
5. **Prove the loop with 200 beta athletes.** Instrument activation, time to first activity, D7 and D30 retention, share rate, and plan adherence. Use the evidence to decide whether public launch proceeds in Q3 or slips a quarter.
6. **Establish the operating spine.** Analytics, crash reporting, support, incident response, status page, backup and restore, and a public capability matrix.

### 5.2 Quarterly plan

| Quarter | Primary outcomes | Key deliverables | Accountable | Gate |
|---|---|---|---|---|
| **Q1** (Nov 2026-Jan 2027) | Decisions ratified; backend staging live; native build pipeline | Launch brief and decision log; staging Worker and D1; identity provider integrated; `eas init` and dev builds; CI running all suites; expanded recovery tests | PM, Tech Lead, Security | Staging auth, sync, export, and deletion pass end to end |
| **Q2** (Feb-Apr 2027) | Native parity for strength and running; beta active | Offline session queue; background GPS; HealthKit and Health Connect; share-card export; onboarding parity; analytics taxonomy; crash reporting; 200 beta athletes; help center | Mobile Lead, Product, Growth | 50+ beta athletes complete a strength session and a run on device; zero silent data loss |
| **Q3** (May-Jul 2027) | Public launch in the U.S. | Store listings; onboarding optimization; pricing research; referral experiment; public web previews; incident runbook; status page; first 15,000 installs | Founders, Growth, Mobile Lead | Launch readiness review passes; crash-free >= 99.5%; store review approved |
| **Q4** (Aug-Oct 2027) | Retention iteration; club alpha; Year 2 readiness | Onboarding and notification experiments; Android performance; 10 club partners; Strava import; capability matrix; FY2028 plan | PM, Growth, Backend Lead | D30 >= 12% in the launch cohort; 750 paying; 10 clubs onboarded |

### 5.3 Product scope

FY2027 ships native onboarding, Today, strength sessions, GPS and manual running, history, progress, the rule-based coach, profile, export and deletion, share cards, accounts and sync, HealthKit and Health Connect, Strava import, push notifications, crash reporting, and consent-aware analytics. It does not ship AI coaching, cycling or swimming workflows, consumer clubs beyond a read-only alpha, a marketplace, watch apps, live tracking, a social feed, or localization beyond U.S. English. Unimplemented capabilities render as unavailable.


### 5.4 Engineering milestones and acceptance criteria

| Milestone | Acceptance criteria | Owner | Verification |
|---|---|---|---|
| **M1 - Staging platform** | Auth, profile, activity write and read, export, deletion, rate limits, and error shape work against real D1 | Backend Lead | `wrangler dev --local` plus a staging smoke suite; no stack traces; 401/403/404 correct |
| **M2 - Native recording** | Sessions record offline, survive app kill, resume with correct elapsed time, sync idempotently | Mobile Lead | 100-session device matrix; airplane-mode and kill tests; duplicate-free sync |
| **M3 - GPS** | 5 km measured course within 3% distance error; 45-minute locked-screen run continues; battery under 12% per hour; permission denial degrades to manual entry | Mobile Lead, QA | Physical iOS and Android devices; results published including failures |
| **M4 - Health integration** | Read workouts and routes with consent; write workouts back on consent; revocation does not lose data; duplicate detection works | Mobile Lead | HealthKit and Health Connect matrix; two-account isolation |
| **M5 - Sharing** | Card renders only recorded data; route trim removes start and end; user strings escaped; export works without an account | Product, Mobile Lead | Visual review; privacy fixtures; escaping tests |
| **M6 - Operability** | Crash-free >= 99.5%; p95 API latency < 400 ms; backup and restore tested; on-call documented | Tech Lead, Ops | Monitoring dashboard; restore drill; incident simulation |

The milestones are deliberately narrow. They are the minimum evidence required to put the product in a stranger's hands. They are not a platform roadmap.

### 5.5 Team and budget

FY2027 runs at $1.35 million of operating cost with an average of 6.5 FTE, ending the year at seven: two founders, 1.5 mobile engineers, one backend engineer, one designer, a half-time growth lead, a half-time QA and release engineer, and a half-time support rotation. The line items are in section 10.


### 5.6 Year 1 exit gate

The gate is passed only if all of the following are true:

- D30 retention at or above 12% in the launch cohort, measured on a cohort that has had at least 30 days.
- Activation at or above 40%.
- 750 paying subscribers and $60,000 of revenue, or a documented reason why monetization should start later.
- Zero silent data-loss events in production and in the device matrix.
- Crash-free sessions at or above 99.5%.
- A live backend with tested auth, authorization, export, and deletion.
- Ten club alpha partners, at least three of which have run an event through the product.
- A public capability matrix that matches the product.

If the gate fails on retention but passes on reliability, delay growth by a quarter and fix the loop. If it fails on reliability, stop launching and fix the foundation. Shipping a leaky product to more people is not a strategy.

---

## 6. Year 2 (FY2028): Growth and expansion

**Period:** 1 November 2027 to 31 October 2028  
**Theme:** Prove the loop beyond the beta cohort.  
**Primary markets:** United States, Canada, United Kingdom.  
**Product surface:** Native iOS and Android; web previews; club admin web console.

### 6.1 Objectives

1. **Prove retention at scale.** D30 at or above 15%, week-4 at or above 20%, and six-month retention at or above 30% for the launch cohort. These are top-quartile targets, not category averages.
2. **Launch Premium honestly.** Three price arms, a 14-day trial, and no paywall on logging, history, export, deletion, or basic privacy. Target 3,800 paying subscribers and $300,000 of consumer revenue.
3. **Make clubs a real product.** Fifty clubs onboarded and twenty active with at least five events each: admin console, membership approval, attendance, announcements, moderation. Target $100,000 of club revenue.
4. **Expand the record to cycling and swimming.** Full Sport System Specifications, structured workouts, interval builder, pace and speed models, device-tested GPS. No generic templates.
5. **Ship AI Tier 1 behind gates.** Plan personalization, exercise substitutions, and progress summaries that narrate deterministic facts, each with a schema, a refusal rule, an eval suite, a cost cap, and a fallback.
6. **Open two more markets.** Canada and the U.K., with localized units, date formats, privacy language, pricing, and support hours.

### 6.2 Quarterly plan

| Quarter | Primary outcomes | Key deliverables | Accountable | Gate |
|---|---|---|---|---|
| **Q1** | Premium launch; club pilot at 20; cycling spec approved | Price test live; server-side entitlements; idempotent billing webhooks; club console v1; cycling specification; AI eval harness | PM, Backend Lead, Data | Install-to-paid >= 2.5% in the first cohort; no entitlement bypass |
| **Q2** | Cycling ships; U.K. and Canada launch; referral loop | Cycling workflows, structured intervals, speed and elevation; localized listings; consented referral attribution; share previews; AI personalization beta | Mobile Lead, Growth | Cycling crash-free >= 99.5%; 20 active clubs; referral share >= 15% |
| **Q3** | Swimming ships; club SaaS v1; opt-in public profiles | Swimming workflows and pool-distance entry; club billing; public profile with per-item visibility; AI summaries beta; moderation playbook | Product, Backend Lead, Trust & Safety | 50 clubs onboarded; 20 active; privacy review passes |
| **Q4** | Retention optimization; Series A close or lean decision; FY2029 readiness | Cohort analysis; onboarding iteration; notification caps; marketplace research; FY2029 plan; investor close or documented lean decision | Founders, Data | W4 >= 20%; 3,800 paying; CAC payback < 12 months |

### 6.3 The retention program

Retention is the existential metric. Every athlete is assigned to a cohort (strength-led, run-led, hybrid, or multi-sport) and cohorts are never blended. The first 14 days matter most: a 60-second onboarding that produces a first session, a first week with two sessions and a rest day, a second-session prompt timed to stated availability, and a week-one artifact with one real number and one next step. Every churned payer is invited to a 15-minute interview; the first 100 become the qualitative backbone of the FY2029 roadmap.


### 6.4 Club strategy

The club product is an operating layer, not a feed: join requests and approvals, events with capacity and waitlists, RSVP and attendance, announcements, moderation. The first fifty clubs are selected for at least 40 active members, a real event calendar, and an administrator who will use the console weekly. Pricing is $99 a month for up to 100 members, waived in the first quarter in exchange for a case study. Success is 20 clubs with five or more events each, not 500 clubs with empty calendars.


### 6.5 Sport expansion: cycling and swimming

A sport ships only when its specification is complete and validated with practitioners. The ten required outputs are defined in the PRD: domain definition, athlete profile schema, activity schema, screen-by-screen flow, components and states, AI task map, API requirements, validation and safety rules, acceptance criteria, and test plan. [F]

**Cycling.** Metrics: distance, duration, average and normalized speed, elevation gain, cadence and power only where a sensor provides them, route. Workflows: free ride, interval session, commute, long ride. Safety: no traffic navigation claims, no live collision warnings, no equipment recommendations. Acceptance: 40 km measured course within 2% distance error; interval segments recorded accurately.

**Swimming.** Metrics: pool length, distance, duration, pace per 100 m, stroke type only if the athlete enters it, open-water distance only with GPS. Workflows: pool set, open-water swim, drill set. Safety: no drowning or rescue claims, no medical advice. Acceptance: pool-distance entry is faster than a stopwatch; open-water GPS is honest about accuracy; no fabricated stroke detection.

**The expansion rule.** A sport graduates only if the core loop retention target is met and the sport has a complete specification with practitioner validation. That prevents the "thirty sports in a menu, two usable" failure mode the PRD warns against. [F]

### 6.6 AI Tier 1: the rules

AI is not the product. It is a narration and personalization layer over verified data. The following rules are binding:

1. **Deterministic first.** Pace, volume, records, trends, and plan math are computed by code, never by a model.
2. **Structured output, valid or absent.** Every response is validated against a schema before it is shown or saved. Invalid output triggers a retry, then a deterministic fallback, then a degraded UI - never an error wall. If the data is insufficient, the model says so; it does not guess.
3. **No safety-critical advice.** Injury diagnosis, rehabilitation protocols, supplement dosing, and medical claims are out of scope. The product refers to a qualified professional.
4. **Eval gates.** A versioned suite covers beginners, advanced athletes, conflicting goals, incomplete data, missed sessions, and unsafe requests. It runs in CI and a regression blocks release.
5. **Budgeted and swappable.** Each capability has a per-request cost cap, a p95 latency target, and a kill switch; logging works with AI unavailable. The model provider sits behind an internal gateway, so switching is a configuration change.
6. **Human review.** Martial arts and other technically demanding disciplines require practitioner review before AI-generated content ships.

### 6.7 Budget

FY2028 revenue is $400,000 and operating cost is $2.25 million, with 11 FTE. Consumer revenue is $300,000, club revenue $100,000, gross margin 72%, and EBITDA ($1.96 million).


### 6.8 Year 2 exit gate

- Week-4 retention at or above 20%; D30 at or above 15%.
- 3,800 paying subscribers; $400,000 of revenue.
- 50 clubs onboarded and 20 active with five or more events.
- Install-to-paid at or above 2.5%; trial-to-paid at or above 35%; refunds below 5%.
- CAC payback under 12 months on the blended channel.
- Cycling and swimming shipped with complete specifications and device-tested GPS.
- AI Tier 1 live with eval gates and a deterministic fallback.
- Two additional markets live with localized pricing and support.

If retention passes but club activation fails, the response is to keep clubs as a feature and defer the B2B sales team. If retention fails, the response is to stop paid acquisition and return to the core loop. The plan does not allow a failing retention metric to be hidden behind revenue growth from a small cohort of high-intent users.

---

## 7. Year 3 (FY2029): Scaling and optimization

**Period:** 1 November 2028 to 31 October 2029  
**Theme:** Scale the system without breaking the promise.  
**Primary markets:** United States, Canada, United Kingdom, Australia, Ireland, Germany, France, Spain, Netherlands.  
**Product surface:** Native apps, club console, public profiles, coach tools.

### 7.1 Objectives

1. **Reach $1.4 million of revenue** with 12,500 paying subscribers and 150,000 monthly active athletes.
2. **Scale the platform.** Move beyond the early architecture where the evidence demands it: a Postgres migration trigger, background job queue, object storage for media, observability, and a cost-per-MAU target under $0.12.
3. **Industrialize sport expansion.** Turn the sport specification into a repeatable module pipeline. Ship BJJ and Taekwondo with at least twenty academy partners, reaching six sports.
4. **Launch the marketplace pilot.** 150 verified coaches or programs, 20% take rate, transparent ranking, dispute and refund policy, and no pay-to-rank.
5. **Expand into continental Europe.** Localize German, French, Spanish, and Dutch; complete GDPR and EU AI Act reviews; offer EU data residency.
6. **Prepare the Series A on evidence.** The round is optional and gated on revenue, retention, CAC payback, and gross margin.

### 7.2 Quarterly plan

| Quarter | Primary outcomes | Key deliverables | Accountable | Gate |
|---|---|---|---|---|
| **Q1** | Infrastructure scale review; BJJ specification; EU readiness assessment | Load test at 5x current MAU; Postgres decision memo; queue and object storage; BJJ Sport System Specification; GDPR gap analysis; EU AI Act classification | CTO, Security, Product | Migration decision documented with triggers and rollback; BJJ spec approved by practitioners |
| **Q2** | BJJ ships with academies; marketplace pilot; Germany and France launch | BJJ workflows, belt and rank model, technique library, academy admin; coach verification; marketplace checkout; German and French localization | Product, Mobile Lead, Growth | BJJ crash-free >= 99.5%; 20 academies active; EU privacy review passed |
| **Q3** | Taekwondo ships; Postgres migration if triggered; EU residency | Taekwondo workflows; migration rehearsal; data residency; SOC 2 readiness assessment | CTO, Founders | Migration rehearsal passes with zero data loss; EU privacy review passed |
| **Q4** | Marketplace scale; retention and NRR optimization; FY2030 plan | 150 coaches; coach analytics; club success playbook; annual plan optimization; FY2030 budget | PM, Growth, Finance | $1M+ ARR; gross margin >= 72%; NRR >= 100% |

### 7.3 The infrastructure decision

The repository runs a dependency-free Cloudflare Worker with D1, a SQLite-compatible database. [F] That is right for the first two years: cheap, simple, close to the edge. It is not automatically right at 150,000 monthly active athletes with geospatial queries, event capacity contention, analytics workloads, and EU data residency.

The plan defines explicit migration triggers rather than a date:

| Trigger | Threshold | Consequence |
|---|---|---|
| D1 write contention | p95 write latency above 250 ms at peak, or more than 5% of writes retried | Move the hot transactional path to Postgres |
| Geospatial queries | More than 100,000 route or facility queries per day | Add a spatial database or a dedicated geospatial service |
| Analytics load | Dashboard queries affecting production latency | Move analytics to a warehouse and read replica |
| EU residency requirement | A signed enterprise or club contract requiring EU data storage | Deploy an EU region or a EU-hosted Postgres |
| Team growth | More than three backend engineers | Re-evaluate the operational cost of the modular monolith |

The migration is a one-way door, so it is rehearsed: dual-write, backfill, shadow read, cutover, rollback. The promise is zero data loss, and the migration is tested against a production snapshot, not a synthetic fixture.

### 7.4 The sport plugin pipeline

By FY2029, adding a sport must be repeatable: domain research with at least 15 practitioners, a ten-part specification, typed data extensions, a screen-by-screen flow, implementation behind a feature flag, automated and practitioner validation, and a gradual rollout with a kill switch. The target is ten weeks from approved specification to general availability with no regression in core crash-free rate. If a sport takes longer, the pipeline is the problem, not the sport.

### 7.5 Marketplace pilot

The marketplace is deliberately narrow: 150 verified coaches and programs, athletes with at least eight weeks of training and a specific goal, a transparent 20% take rate, no pay-to-rank, and a documented refund and dispute policy. Success is $50,000 of net revenue, client retention at least 10 points above self-guided athletes, and a dispute rate below 2%. If it fails, it remains a small feature or is discontinued.


### 7.6 Budget

FY2029 revenue is $1.4 million and operating cost is $3.686 million, with 17 FTE. Consumer revenue is $1.0 million, clubs $350,000, marketplace $50,000, gross margin 75%, and EBITDA ($2.64 million).


### 7.7 Year 3 exit gate

- Revenue at or above $1.4 million; ARR at or above $1.6 million.
- 12,500 paying subscribers; NRR at or above 100%.
- Gross margin at or above 72%.
- 150,000 MAU; D30 at or above 15%.
- Six sports live with complete specifications.
- BJJ and Taekwondo validated by at least 20 academies and practitioner reviewers.
- EU markets live with GDPR and EU AI Act compliance documentation.
- Infrastructure cost per MAU under $0.12; p95 API latency under 300 ms.
- A documented migration decision with a rehearsed rollback.

If the Series A gate is not met, the correct decision is to stay lean, not to raise on a narrative. The lean path is modeled in section 10 and is a legitimate strategic choice.

---

## 8. Year 4 (FY2030): Maturity and market positioning

**Period:** 1 November 2029 to 31 October 2030  
**Theme:** Own the category position.  
**Primary markets:** Nine markets, with the U.S. and U.K. as the revenue centers.  
**Product surface:** Native apps, watch apps, club console, coach tools, public API.

### 8.1 Objectives

1. **Reach $3.3 million of revenue** with 28,000 paying subscribers and 320,000 monthly active athletes.
2. **Establish the category position.** LMTLSS is known as the honest, cross-sport performance record for athletes who refuse to choose one sport. This is a brand and product reality, not a tagline.
3. **Complete the wearable layer.** WHOOP, Polar, and Garmin integrations where the commercial and technical terms are acceptable; watchOS and Wear OS recording companions; opt-in live tracking for events.
4. **Launch coach tools and a public API.** Verified coaches can program, review, and communicate; clubs can integrate attendance and events; researchers can access consented, aggregated data.
5. **Reach operational maturity.** SOC 2 Type I, annual penetration test, 99.9% uptime, documented disaster recovery, and a security incident process tested twice a year.
6. **Move to positive contribution margin.** Marketing efficiency, support deflection, and infrastructure optimization put the company within one year of EBITDA break-even.

### 8.2 Quarterly plan

| Quarter | Primary outcomes | Key deliverables | Accountable | Gate |
|---|---|---|---|---|
| **Q1** | Wearable wave two; watch app beta | WHOOP and Polar integrations; Garmin application; watchOS and Wear OS recording; battery and sync testing | CTO, Mobile Lead | Two wearable integrations in production with deletion propagation; watch app crash-free >= 99.5% |
| **Q2** | Coach tools and public API; brand campaign | Coach program builder, athlete review, messaging; API keys and rate limits; developer docs; brand campaign and category report | Product, Growth, CTO | 100 coaches active; API p95 < 300 ms; brand recall study |
| **Q3** | Live tracking and event integration; SOC 2 Type I | Opt-in live tracking with privacy controls; race and event integrations; SOC 2 audit; pen test remediation | Security, Product | Privacy review passed; no location leakage; SOC 2 Type I report |
| **Q4** | Profitability path; FY2031 plan | Pricing and packaging optimization; support automation; infrastructure cost review; FY2031 budget | Founders, Finance | Positive contribution margin; EBITDA within 12 months of break-even |

### 8.3 Positioning and brand

The category position is the most trustworthy record in multi-sport training. The proof is concrete: provenance on every metric, estimates labeled as estimates, refusal when data is thin, one-tap export and deletion, trimmed routes by default, and no invented streaks or universal scores. The annual category report, built on consented and aggregated data, becomes the earned-media engine and a public trust exercise.


### 8.4 Wearables and watch apps

The integration sequence is demand-led: Apple Health and Health Connect, Strava import and compliant export, WHOOP and Polar, then Garmin only if demand and terms justify it. Watch apps are a recording surface, not a separate product: start, pause, lap, finish, and a minimal live metric, with correct reconciliation when the phone returns. Live tracking is opt-in per event, time-boxed, limited to approved followers, and stoppable in one tap.


### 8.5 Budget

FY2030 revenue is $3.3 million and operating cost is $4.58 million, with 20 FTE. Consumer revenue is $2.3 million, clubs $750,000, marketplace $250,000, gross margin 77%, and EBITDA ($2.04 million).


### 8.6 Year 4 exit gate

- Revenue at or above $3.3 million; ARR at or above $3.6 million.
- 28,000 paying subscribers; NRR at or above 103%.
- 320,000 MAU; D30 at or above 16%.
- 400 active clubs; 250 marketplace coaches or programs.
- Two additional wearable integrations live with deletion propagation.
- SOC 2 Type I complete; penetration test clean or remediated.
- 99.9% uptime; disaster recovery tested.
- Positive contribution margin in Q4.

---

## 9. Year 5 (FY2031): Sustainability and future outlook

**Period:** 1 November 2030 to 31 October 2031  
**Theme:** Compound the platform, fund the future.  
**Primary markets:** Nine markets; expansion decisions based on unit economics, not vanity.  
**Product surface:** Native apps, watches, club console, coach tools, public API, partner integrations.

### 9.1 Objectives

1. **Reach $6.3 million of revenue** with 55,000 paying subscribers and 600,000 monthly active athletes.
2. **Turn EBITDA positive.** Deliver a modest full-year EBITDA margin of approximately 4%, with positive operating cash flow in the second half.
3. **Diversify revenue.** Consumer 73%, clubs 19%, marketplace 8%. No single customer or partner exceeds 5% of revenue.
4. **Deepen the record.** Eight sports, three languages, nine live markets, and a data model that absorbs new disciplines without a rewrite.
5. **Build strategic optionality.** A public API, coach and club integrations, consented research partnerships, and a governance structure that can support an independent company, a strategic partnership, or an acquisition conversation from a position of strength.
6. **Protect the trust asset.** A clean privacy audit, a published transparency report, and a documented commitment to data portability and no sale of athlete data.

### 9.2 Quarterly plan

| Quarter | Primary outcomes | Key deliverables | Accountable | Gate |
|---|---|---|---|---|
| **Q1** | Pricing and packaging optimization; club expansion | Annual plan mix; club tier redesign; enterprise pilot; support automation | PM, Finance | Gross margin >= 78%; NRR >= 105% |
| **Q2** | Platform API and partner integrations | Public API v1; webhook system; two club-software partners; developer portal | CTO | API adoption by 50 clubs or partners |
| **Q3** | Research and transparency | Consented aggregate research pilot; transparency report; privacy audit; open export format | Security, Product | Independent privacy review passed |
| **Q4** | FY2032 strategy; strategic options review | Three-year outlook; build-versus-partner analysis; acquisition and partnership conversations if initiated by others | Founders, Board | EBITDA positive; clean audit; board-approved FY2032 plan |

### 9.3 The FY2031 business

Revenue is $6.3 million: $4.6 million consumer, $1.2 million clubs, and $500,000 marketplace. Operating cost is $4.64 million with 22 FTE, gross margin is 78%, and EBITDA is $274,000, a 4.3% margin. The full P&L, cash plan, and sensitivity are in section 10.


### 9.4 Year 5 exit gate

- Revenue at or above $6.3 million; EBITDA positive.
- 55,000 paying subscribers; NRR at or above 105%.
- 600,000 MAU; D30 at or above 17%.
- 600 active clubs; 600 marketplace coaches or programs.
- Eight sports with complete specifications; three languages.
- Clean privacy audit; published transparency report.
- A board-approved FY2032 plan with a three-year outlook.

---

## 10. Financial plan

### 10.1 Purpose and status

This is an operating model, not a forecast. It exists to make the consequences of assumptions visible: every input can be challenged, and a change in one variable produces an explainable change in revenue, burn, and runway.

The model has three scenarios. Base is the plan of record; lean is the fallback if retention or conversion does not justify venture spend; upside is what happens if clubs and international expansion outperform.

### 10.2 Core assumptions

| Assumption | FY2027 | FY2028 | FY2029 | FY2030 | FY2031 | Label |
|---|---:|---:|---:|---:|---:|---|
| Annual installs | 50,000 | 180,000 | 450,000 | 650,000 | 800,000 | [A] |
| Registered share of installs | 75% | 75% | 75% | 75% | 75% | [A] |
| Activation (first saved activity within 24h) | 40% | 42% | 44% | 45% | 45% | [A] |
| MAU as share of cumulative registered | 27% | 29% | 29% | 32% | 37% | [A] |
| Paying as share of MAU (end) | 7.5% | 7.6% | 8.3% | 8.8% | 9.2% | [A] |
| Net revenue per paying athlete per year | $80 | $79 | $80 | $82 | $84 | [A] |
| Annual subscriber churn | 45% | 40% | 34% | 30% | 28% | [A] |
| Gross margin | 68% | 72% | 75% | 77% | 78% | [A] |
| Blended CAC (paid channels only) | $25 | $28 | $32 | $35 | $38 | [A] |
| Blended fully loaded cost per FTE | $145,000 | $150,000 | $158,000 | $164,000 | $163,000 | [A] |
| Marketing as share of revenue | 333% | 75% | 39% | 21% | 8% | [A] |

Three assumptions deserve explicit scrutiny:

1. **MAU as a share of cumulative registered users.** The ratio rises from 27% to 37% as the record compounds and clubs bring athletes back weekly. It is not guaranteed: at a flat 26% in FY2031, MAU would be about 415,000 rather than 600,000 and revenue would fall by roughly $1.5 million.
2. **Pay-to-MAU penetration.** A 7.5-9.2% paid penetration is above the freemium median but below a hard paywall. It assumes a genuinely useful free tier and a Premium offer that appeals to committed athletes. At 5%, revenue falls by roughly 40%.
3. **Annual churn.** Falling from 45% to 28% is an improvement narrative, not an observed fact; it depends on annual plans, club attachment, and the record becoming more valuable over time. If churn stays at 40%, LTV falls by about 30% and CAC payback extends by about 40%.

### 10.3 Unit economics

| Metric | FY2027 | FY2028 | FY2029 | FY2030 | FY2031 |
|---|---:|---:|---:|---:|---:|
| Net ARPU per paying athlete | $80 | $79 | $80 | $82 | $84 |
| Gross margin | 68% | 72% | 75% | 77% | 78% |
| Annual churn | 45% | 40% | 34% | 30% | 28% |
| Gross-profit LTV | $121 | $142 | $176 | $210 | $234 |
| Blended CAC | $25 | $28 | $32 | $35 | $38 |
| LTV / CAC | 4.8x | 5.1x | 5.5x | 6.0x | 6.2x |
| CAC payback (months) | 5.5 | 5.9 | 6.4 | 6.6 | 7.0 |
| Contribution after CAC (first year) | $29 | $29 | $28 | $28 | $28 |

The model uses gross-profit LTV, not revenue LTV, and excludes organic installs from CAC, which makes payback look better than a fully loaded calculation. The operating rule is stricter: **blended payback, including organic and paid, must stay under 12 months.** The 5.5-7.0 month paid payback leaves room for the organic share to decline without breaching that rule. First-year contribution stays flat at about $28 because CAC rises with ARPU; the economics come from retention, not from first-year margin.

### 10.4 Profit and loss

| Line | FY2027 | FY2028 | FY2029 | FY2030 | FY2031 |
|---|---:|---:|---:|---:|---:|
| Consumer revenue | $60,000 | $300,000 | $1,000,000 | $2,300,000 | $4,600,000 |
| Club revenue | $0 | $100,000 | $350,000 | $750,000 | $1,200,000 |
| Marketplace revenue | $0 | $0 | $50,000 | $250,000 | $500,000 |
| **Total revenue** | **$60,000** | **$400,000** | **$1,400,000** | **$3,300,000** | **$6,300,000** |
| Cost of revenue (store fees, refunds, hosting) | $19,200 | $112,000 | $350,000 | $759,000 | $1,386,000 |
| **Gross profit** | **$40,800** | **$288,000** | **$1,050,000** | **$2,541,000** | **$4,914,000** |
| People | $945,000 | $1,650,000 | $2,686,000 | $3,280,000 | $3,590,000 |
| Marketing | $200,000 | $300,000 | $550,000 | $700,000 | $500,000 |
| Infrastructure and AI | $55,000 | $90,000 | $150,000 | $220,000 | $250,000 |
| G&A, legal, security | $150,000 | $210,000 | $300,000 | $380,000 | $300,000 |
| **Total operating cost** | **$1,350,000** | **$2,250,000** | **$3,686,000** | **$4,580,000** | **$4,640,000** |
| **EBITDA** | **($1,309,200)** | **($1,962,000)** | **($2,636,000)** | **($2,039,000)** | **$274,000** |
| EBITDA margin | n/a | n/a | n/a | n/a | 4.3% |
| Revenue per FTE | $8,600 | $36,400 | $82,400 | $165,000 | $286,400 |

The model turns EBITDA positive in FY2031 with 22 FTE. A 30-person company at $6.3 million would spend roughly $210,000 of revenue per employee, which is thin for a consumer subscription business carrying store fees. The leaner organization protects the margin and forces prioritization; if clubs and marketplace outperform, roles are added in FY2032.

### 10.5 Funding and cash

| Item | FY2027 | FY2028 | FY2029 | FY2030 | FY2031 |
|---|---:|---:|---:|---:|---:|
| Opening cash | $0 | $1,191,000 | $5,729,000 | $3,093,000 | $1,054,000 |
| Seed round | $2,500,000 | $0 | $0 | $0 | $0 |
| Series A | $0 | $6,500,000 | $0 | $0 | $0 |
| EBITDA | ($1,309,200) | ($1,962,000) | ($2,636,000) | ($2,039,000) | $274,000 |
| **Closing cash** | **$1,190,800** | **$5,729,000** | **$3,093,000** | **$1,054,000** | **$1,328,000** |
| Months of runway at current burn | 10.9 | 35.0 | 14.1 | 6.2 | n/a |

The table treats EBITDA as a proxy for operating cash flow. That is a simplification: capital expenditure is immaterial at this stage apart from the device lab, deferred revenue is small because store subscriptions are billed monthly, and no financing costs are modeled. If capex or working capital moves, closing cash moves by the same amount.

The Series A is assumed to close early in Q3 FY2028, on trailing FY2028 metrics rather than a full year. That is a financing assumption, not a guarantee. If the round slips two quarters, the company must either cut $400,000 of FY2028 operating cost or raise a $1.5 million bridge. The plan pre-authorizes the cut, not the bridge, because a bridge at a flat or lower valuation is more dilutive than discipline.

The seed round is $2.5 million. At the FY2027 burn rate it funds the year and roughly seven months of FY2028 - the planned Series A window - leaving almost no buffer. That is why the cost cut is pre-authorized rather than negotiated under stress. The use of funds is:

| Allocation | Share | What it buys |
|---|---:|---|
| Engineering and product | 55% | Native parity, GPS, backend, sync, security, share cards |
| Design and research | 15% | Native UX, onboarding, beta research, accessibility |
| Growth and club partnerships | 15% | Beta recruitment, club alpha, content, share experiments |
| Legal, privacy, security | 10% | Entity, terms, privacy policy, DPIA, pen test, insurance |
| Buffer | 5% | Device lab, store fees, contingencies |

### 10.6 Scenarios

| Scenario | Trigger | FY2031 revenue | FY2031 EBITDA | Capital | Strategic meaning |
|---|---|---:|---:|---:|---|
| **Base** | Plan of record | $6,300,000 | $274,000 | $9,000,000 | Independent, marginally profitable, optionality intact |
| **Lean** | Retention passes but paid conversion or CAC fails the FY2028 gate | $2,600,000 | $300,000 | $4,000,000 | Default-alive; smaller team; clubs and Premium only; no marketplace scale |
| **Upside** | Retention and club activation exceed targets; international outperforms | $9,500,000 | $1,140,000 | $12,000,000 | Category leader in cross-sport training; optional Series B or strategic partnership |

**Lean case assumptions.** Seed and extension total $4.0 million, headcount peaks at 12, growth is 45% of the base case, and marketing is capped at $250,000 a year. Clubs reach 250, paying subscribers reach 24,000, and the marketplace is not scaled. Break-even occurs in FY2030 at roughly $1.8 million of revenue. That is a viable business and a credible fallback, but it does not create the category position the base case targets.

**Upside case assumptions.** Installs are 1.4x base, install-to-paid is 1.2x base, clubs reach 900, and the marketplace reaches 600 coaches. Revenue is $9.5 million at 78% gross margin with $6.3 million of operating cost. The upside needs a further $3.0 million of growth capital in FY2030, raised only if CAC payback stays under 10 months.

### 10.7 Sensitivity

| Variable | Base | Downside | Revenue impact (FY2031) | EBITDA impact | Response |
|---|---:|---:|---:|---:|---|
| D30 retention | 17% | 12% | -12% | -$0.5M | Slow hiring; prioritize onboarding and second-session |
| Install-to-paid | 2.5% | 1.5% | -40% | -$1.8M | Shift to clubs; reduce consumer marketing |
| Net ARPU | $84 | $70 | -17% | -$0.8M | Repackage Premium; test annual-only |
| Annual churn | 28% | 40% | -12% | -$0.6M | Invest in clubs and the cross-sport record |
| Blended CAC | $38 | $50 | 0% | -$0.4M | Cap paid spend; grow share and referrals |
| Club count | 600 | 300 | -$0.6M | -$0.4M | Narrow to fewer, deeper club partners |
| Gross margin | 78% | 70% | 0% | -$0.5M | Renegotiate store fees where lawful; reduce AI cost |

The sensitivity table is the honest core of the plan: **install-to-paid and retention dominate the outcome**, while infrastructure and G&A are second-order. That is why FY2027 is spent on the loop, not on scale.

## 11. Risk assessment and mitigation

### 11.1 Risk method

Risks are scored on likelihood (1-5) and impact (1-5). A score of 15 or above is a **red** risk requiring a board-level mitigation plan. A score of 8-14 is **amber**, owned by a functional lead and reviewed monthly. A score below 8 is **green**, monitored quarterly. The score is the product of likelihood and impact, not a substitute for judgment; a low-probability, catastrophic risk still gets a contingency plan.

### 11.2 Risk register

| ID | Risk | Category | L | I | Score | Mitigation | Owner | Early trigger |
|---|---|---|---:|---:|---:|---|---|---|
| R1 | The hybrid-athlete segment is smaller than assumed | Market | 3 | 5 | 15 | Survey 1,000 athletes; beta cohort analysis; narrow to one sport if needed | CEO | Fewer than 15% of beta users log both strength and endurance in a week |
| R2 | Retention stays at category averages | Product | 4 | 5 | 20 | Onboarding, second-session, club attachment, weekly consistency; no paid scaling until D30 >= 12% | Product | D7 < 15% in two consecutive cohorts |
| R3 | Silent data loss or sync conflict | Technical | 2 | 5 | 10 | Local-first writes, idempotency, conflict UI, migration tests, restore drills, zero-loss SLO | CTO | Any user report of a missing session; sync error rate > 0.5% |
| R4 | GPS is inaccurate or background recording fails | Technical | 3 | 4 | 12 | Device matrix, smoothing, outlier rejection, honest manual fallback, battery budget | Mobile Lead | Distance error > 5% on measured course; background stops under 30 minutes |
| R5 | Security breach exposes health or location data | Security | 2 | 5 | 10 | Encryption, least privilege, secret management, pen test, incident response, insurance | Security Lead | Anomalous access; dependency CVE; lost device |
| R6 | Privacy or regulatory breach (GDPR, EU AI Act, HIPAA boundary) | Regulatory | 2 | 5 | 10 | DPIA, data map, retention policy, EU residency, AI classification, counsel review | Security Lead | New market; new data type; new AI capability |
| R7 | App Store or Play policy rejection or change | Platform | 3 | 4 | 12 | Pre-review audit, clear purpose strings, HealthKit and Health Connect compliance, fallback build | Mobile Lead | Review rejection; policy update affecting health or location |
| R8 | AI produces unsafe or fabricated training advice | Product / AI | 3 | 5 | 15 | Deterministic core, schemas, refusal rules, eval gates, human review, kill switch | Data Lead | Eval regression; user report of unsafe advice |
| R9 | Vendor dependence (maps, auth, AI, payments) | Vendor | 3 | 3 | 9 | Adapter interfaces, exit clauses, secondary provider tested, cost caps | CTO | Price increase; SLA breach; acquisition of vendor |
| R10 | Incumbent bundles the cross-sport record | Competitive | 4 | 3 | 12 | Trust brand, club relationships, sport depth, privacy, speed of execution | CEO | Strava or Apple ships a credible cross-sport record |
| R11 | CAC rises or funding markets tighten | Financial | 3 | 5 | 15 | 12-month runway floor, lean case pre-approved, organic loops, hiring freeze trigger | CEO / Finance | CAC payback > 15 months; runway < 12 months |
| R12 | Club channel fails to activate | Commercial | 3 | 4 | 12 | Select clubs with real calendars; admin console; partner success; keep clubs as a feature if B2B fails | Growth | Fewer than 10 clubs with 5+ events after two quarters |
| R13 | Key-person dependency and burnout | People | 3 | 4 | 12 | Pairing, documentation, backups, equity, realistic scope, forced time off | CEO | One person owns more than two critical systems |
| R14 | Infrastructure cost or reliability degrades at scale | Technical | 2 | 4 | 8 | Load tests, cost per MAU target, Postgres triggers, caching, observability | CTO | p95 latency > 400 ms; cost per MAU > $0.15 |
| R15 | Honesty failure damages trust | Reputational | 2 | 5 | 10 | Capability matrix, copy audits, launch truth, provenance tests, public corrections | Product | Any claim not backed by a shipped capability |
| R16 | Intellectual property or trademark conflict | Legal | 2 | 4 | 8 | Trademark search, assignment agreements, open-source review, counsel opinion | CEO | Cease-and-desist; app store IP claim |
| R17 | Accessibility or consumer-protection complaint | Legal | 2 | 3 | 6 | WCAG 2.2 AA, auto-renew disclosures, cancellation flow, refund policy | Product | Complaint; regulator inquiry |
| R18 | Payment, tax, or subscription compliance failure | Financial | 2 | 4 | 8 | Store billing first, tax review per market, refund reserve, audit trail | Finance | New market; tax nexus; refund spike |

### 11.3 Risk governance

- **Monthly risk review** by the leadership team; red risks reviewed weekly.
- **Quarterly board review** of the top ten risks and the mitigation budget.
- **Incident severity:** SEV1 (data loss, security breach, widespread outage), SEV2 (major feature unavailable), SEV3 (degraded experience). SEV1 triggers a written postmortem within 24 hours and customer communication within 72.
- **Insurance:** cyber liability, technology errors and omissions, and general liability before public launch.
- **Accepted risks** are recorded with an owner, a rationale, and an expiry date.

---

## 12. Performance metrics and governance

### 12.1 The North Star

**Weekly Active Athletes with at least two logged sessions in the past seven days (WAA-2).** This is chosen over daily active users deliberately. Training is not a daily behavior for every sport; a strength athlete may train three times a week and a runner four. A daily-active target would reward notifications and streak pressure, which the product rejects. WAA-2 measures whether the product is part of a real routine.

The North Star is supported by a metric tree, not a dashboard of unrelated numbers: every metric has a definition, a data source, an owner, and a decision it informs. Analytics are consent-aware and pseudonymous, never carry raw health or location data, and every event must inform a decision or be removed; revenue, entitlements, and deletion are measured server-side.

### 12.2 Metric tree

| Layer | Metric | Definition | Owner | Decision it informs |
|---|---|---|---|---|
| Acquisition | Qualified installs | Installs from a target market that complete app open | Growth | Channel investment |
| Activation | Activation rate | Onboarding complete plus first saved activity within 24 hours | Product | Onboarding redesign |
| Retention | D7 / D30 / W4 | Active on day 7, day 30, or in week 4 after install | Product | Loop health |
| Engagement | Cross-sport weeks | Share of active athletes logging two or more sports in a week | Product | Wedge validation |
| Monetization | Install-to-paid | Paying within 35 days divided by installs | Growth | Paywall and pricing |
| Monetization | Net ARPU | Revenue net of store fees and refunds per paying athlete | Finance | Packaging |
| Monetization | CAC payback | Months to recover CAC from gross profit | Finance | Paid spend |
| Trust | Silent data-loss events | Confirmed losses of a saved session without recovery | CTO | Reliability investment |
| Trust | Crash-free sessions | Sessions without a crash or ANR | CTO | Release gate |
| Trust | Provenance coverage | Share of displayed metrics with a visible source label | Product | Honesty invariant |
| Community | Active clubs | Clubs with 5+ events and 60%+ admin monthly activity | Growth | Club investment |
| AI | Eval pass rate | Share of versioned eval cases passing | Data | Release gate |

### 12.3 Targets by year

| Metric | FY2027 | FY2028 | FY2029 | FY2030 | FY2031 |
|---|---:|---:|---:|---:|---:|
| Activation | 40% | 42% | 44% | 45% | 45% |
| D30 retention | 12% | 15% | 15% | 16% | 17% |
| W4 retention | 18% | 20% | 22% | 23% | 24% |
| Cross-sport weeks | 15% | 20% | 25% | 28% | 30% |
| Install-to-paid | 1.5% | 2.5% | 2.8% | 3.0% | 3.1% |
| NRR | n/a | 90% | 100% | 103% | 105% |
| CAC payback | 12 mo | 11 mo | 10 mo | 9 mo | 9 mo |
| Crash-free sessions | 99.5% | 99.6% | 99.7% | 99.8% | 99.8% |
| Active clubs | 10 | 20 | 200 | 400 | 600 |

### 12.4 Guardrail metrics

Targets can be gamed. These guardrails are reviewed alongside growth metrics, and a deterioration blocks the related initiative even if the headline metric improves.

| Guardrail | Threshold | Why it matters |
|---|---:|---|
| Notification opt-out rate | < 10% per quarter | High opt-outs signal manufactured urgency |
| Refund rate | < 5% | High refunds signal broken promises or aggressive paywalls |
| Support tickets per 1,000 MAU | < 8 | Rising tickets signal quality debt |
| Data export completion | > 99% | Export is a trust promise |
| Deletion completion within 30 days | 100% | Legal and ethical requirement |
| AI refusal correctness | > 95% on eval set | Unsafe advice is a brand-ending risk |
| Route privacy incidents | 0 | Location data is uniquely sensitive |
| Rest-day recognition | > 60% of plans include a rest day | Prevents overtraining incentives |
| Notification-driven sessions | < 35% of sessions | The product should be pull, not push |
| Revenue from users under 18 | 0% | The product is 16+ and does not target minors |

### 12.5 Operating cadence and decision rights

| Forum | Frequency | Participants | Decisions |
|---|---|---|---|
| Weekly product review | Weekly | Founders, product, design, engineering | Scope, quality, release readiness |
| Weekly metrics review | Weekly | Founders, growth, product | Experiment readouts, funnel fixes |
| Monthly business review | Monthly | Leadership | Budget, hiring, risk, KPI trends |
| Quarterly planning | Quarterly | Leadership plus board observer | OKRs, roadmap, stage gate |
| Annual strategy review | Annual | Board and leadership | Five-year plan revision, capital plan |
| Incident review | Within 5 days of SEV1/SEV2 | Incident owner, leadership | Root cause, remediation, communication |

**Decision rights.** The CEO owns strategy, capital, and final product scope. The CTO owns architecture, security, and technical hiring. The product lead owns roadmap and prioritization; the growth lead owns acquisition and partnerships; the security lead owns privacy, compliance, and incident response. The board approves the annual budget, any financing, any acquisition, and any change to the privacy commitments. A decision that changes the five-year plan is logged with the date, the evidence, and the owner.

## 13. Organization and technology

### 13.1 Organization by year

| Function | FY2027 | FY2028 | FY2029 | FY2030 | FY2031 |
|---|---:|---:|---:|---:|---:|
| Leadership (CEO, CTO) | 2 | 2 | 2 | 2 | 2 |
| Product and design | 1 | 2 | 3 | 3 | 3.5 |
| Mobile engineering | 1.5 | 2.5 | 4 | 4 | 4.5 |
| Backend and platform | 1 | 1.5 | 2 | 3 | 3.5 |
| Data and AI | 0 | 0.5 | 1 | 2 | 2.5 |
| QA and release | 0.5 | 0.5 | 1 | 1 | 1 |
| Growth and content | 0.5 | 1 | 1 | 1 | 1 |
| Club success and partnerships | 0 | 0.5 | 1 | 2 | 2 |
| Support and operations | 0.5 | 0.5 | 1 | 1 | 1 |
| Finance, legal, security | 0 | 0 | 1 | 1 | 1 |
| **Total** | **7** | **11** | **17** | **20** | **22** |

Totals are full-time equivalents; fractional entries denote part-time or shared roles in the early years. The financial model uses these same totals. Headcount grows more slowly than revenue in every year, and the FY2031 organization is deliberately small for a $6.3 million business because the product is self-serve and support is largely automated.

### 13.2 Hiring sequence

**First five hires (FY2027):** mobile engineer, backend engineer, product designer, QA and release engineer, growth and community generalist. The founders cover product, architecture, and customer research. Mobile comes first because the native app is the critical path; backend comes second because sync, auth, and entitlements are the trust layer.

**Next five (FY2028):** second mobile engineer, data analyst, club success lead, support lead, content and SEO lead. The club success lead is hired before any club sales team, because activation is the constraint, not lead generation.

**FY2029:** data and AI engineer, SRE and platform engineer, international growth lead, second club success lead, finance and ops lead. The SRE hire precedes the Postgres migration; the migration is not attempted without operational ownership.

**FY2030-FY2031:** security engineer, partnerships lead, localization producer, marketplace operations, support automation. Every hire has a written scope, a 90-day outcome, and a budget line before the requisition opens.

### 13.3 Culture

Honesty is a product requirement: a demo that hides a failure is a bug, and so is a flattering metric. Every system has one owner and one backup. Decisions, assumptions, and incident reviews are written down. Crunch is treated as a planning failure.


### 13.4 Technology principles

Local-first and server-authoritative; one canonical activity model with typed sport extensions; deterministic calculations with AI only as narration; boring infrastructure until evidence demands otherwise; validation at every boundary; observability before scale; feature flags, kill switches, and migration rollback; no secrets in the client.


### 13.5 Current to target architecture

| Layer | Today | FY2027 | FY2029 | FY2031 |
|---|---|---|---|---|
| Web | Static reference app, no network | Marketing site plus share previews | Public profiles and club pages | Partner and coach portal |
| Mobile | Expo scaffold, partial M1 | Native parity for strength and running | Six sports, watch companions | Eight sports, offline-first everywhere |
| Shared domain | TypeScript port with parity guard | Same, used by mobile | Versioned domain package | Public schema and export format |
| API | Worker plus D1, tested locally | Deployed staging and production, auth, sync, entitlements | Postgres if triggered, queues, object storage | Multi-region, public API, webhooks |
| Data and AI | Local storage; rule-based coach | Event pipeline; no AI in production | Warehouse, experiments, AI Tier 1 with eval gates | Research-grade aggregates; AI Tier 2 behind a provider gateway |
| Payments | Simulated pricing engine | Store billing plus server entitlements | Web billing where lawful, club invoicing | Marketplace payouts and tax |

### 13.6 Technical debt and reliability targets

The known debt is documented rather than hidden: the server has not run in workerd or on real D1; the interval UI is unreachable; the Recover screen has a labeling bug; the schema migration path is tested but the version has not been bumped in production; the web app has no PWA manifest; the mobile app has no store build. [F] Each item has an owner and a quarter in the delivery plan.

| Reliability target | FY2027 | FY2029 | FY2031 |
|---|---:|---:|---:|
| API availability | 99.5% | 99.9% | 99.9% |
| p95 API latency | 400 ms | 300 ms | 250 ms |
| Crash-free sessions | 99.5% | 99.7% | 99.8% |
| Recovery point objective | 1 hour | 15 minutes | 15 minutes |
| Recovery time objective | 8 hours | 4 hours | 4 hours |
| Deployment frequency | Weekly | Daily | On demand |
| Change failure rate | < 15% | < 10% | < 5% |

---

## 14. Privacy, security, and regulatory roadmap

### 14.1 Data classes and handling

| Data class | Examples | Sensitivity | Storage | Retention | Access |
|---|---|---|---|---|---|
| Account | Email, display name, auth identifier | Medium | Encrypted database | Deletion plus 30 days | User; support with consent |
| Training | Sessions, sets, distances, notes | High | Encrypted database | Until deletion | User; coach with consent |
| Health | Heart rate, sleep, recovery, body metrics | Very high | Encrypted, separate key | Until deletion | User; consent per provider |
| Location | Routes, start and end points, live tracking | Very high | Encrypted, trimmed by default | 24 months raw; aggregates longer | User; invited followers for live tracking |
| Payment | Store transaction identifiers, entitlement status | High | Payment provider plus minimal records | 7 years for tax | Finance, auditors |
| Analytics | Pseudonymous events | Low to medium | Analytics provider, no raw health or location | 24 months | Product, growth |

### 14.2 Legal and regulatory commitments

- **GDPR and UK GDPR.** Lawful basis documented per processing purpose; DPIA before EU launch; processor agreements with every vendor; data subject rights handled within 30 days; EU representative appointed where required.
- **CCPA/CPRA.** No sale of personal information; opt-out of sharing where it applies; access and deletion rights; annual policy review.
- **HIPAA boundary.** A direct-to-consumer fitness product, not a covered entity or business associate: no medical records, no insurance billing, no diagnosis or treatment. A clinical partnership would require a separate compliance review and a business associate agreement before any data flows.
- **EU AI Act.** AI capabilities are classified before launch and kept to limited-risk uses: narration and personalization, no medical-device claims, no high-risk decision-making. Transparency obligations, logging, and human oversight apply to anything that shapes a training recommendation.
- **FDA general wellness.** Messaging stays within general wellness and fitness; the product does not claim to diagnose, treat, cure, or prevent disease. Anything closer to a medical claim goes to counsel before release.
- **App store rules.** Apple HealthKit guidelines, Health Connect declarations, privacy nutrition labels, account deletion, auto-renew disclosure, and background location justification are reviewed before every release.
- **Accessibility and consumer law.** WCAG 2.2 AA with manual VoiceOver and TalkBack testing; the European Accessibility Act and ADA treated as product requirements; clear pricing, trial terms, renewal disclosure, cancellation path, and refund policy in every market. No dark patterns.

### 14.3 Security program

| Control | FY2027 | FY2029 | FY2031 |
|---|---|---|---|
| Encryption in transit | TLS 1.3 | TLS 1.3 | TLS 1.3 |
| Encryption at rest | Provider-managed | Customer-managed keys | Customer-managed keys, field-level for health |
| Authentication | Managed OIDC, MFA optional | Passkeys, MFA default for clubs | SSO for club and enterprise |
| Authorization | Server-side, tested per endpoint | Policy-as-code, automated tests | Continuous authorization tests |
| Secrets | Managed secret store | Rotation, least privilege | Hardware-backed keys |
| Penetration test | Before launch | Annual | Annual plus continuous scanning |
| Vulnerability management | Weekly dependency review | 7-day critical patch | 24-hour critical patch |
| Incident response | Documented, one drill | Tested twice a year | Tested quarterly |
| Audit logging | Auth and admin actions | All privileged actions | Immutable audit trail |
| Certifications | None | SOC 2 readiness | SOC 2 Type I, then Type II |

### 14.4 Transparency commitments

LMTLSS publishes an annual transparency report: government and legal requests, accounts affected, exports and deletions, security incidents and remediation, AI capabilities in production with their eval results, and the data-retention schedule. The report is a trust asset and a discipline, because it makes the honesty invariant auditable.

---

## 15. Conclusion and next steps

### 15.1 The long-term vision

By 2031, LMTLSS should be the record an athlete trusts when no single sport defines them. It should know that a heavy squat week and a high-mileage week compete for the same recovery budget, that a personal best is real because the data is real, and that a club event is worth attending because the people are real. It should be profitable, independent, and honest enough that an athlete can export everything and leave without penalty.

That is a narrower ambition than "the operating system for human performance," and a more credible one. The grand phrase is a direction, not a claim; the five-year plan is the sequence of evidence that earns the right to use it.

### 15.2 The next 90 days

| Date | Action | Owner | Evidence of completion |
|---|---|---|---|
| 31 Oct 2026 | Ratify `DEC-01` to `DEC-06`; publish the launch brief | CEO / Product | Signed decision log; one-page brief |
| 7 Nov 2026 | Select identity provider; document session and token model | CTO | Architecture decision record |
| 15 Nov 2026 | Run `wrangler dev --local`; deploy staging Worker and D1 | Backend Lead | Staging smoke suite passes |
| 30 Nov 2026 | Complete authorization review on every private endpoint | CTO / Security | Endpoint matrix with tests |
| 15 Dec 2026 | Set up EAS, produce iOS and Android dev builds | Mobile Lead | Build artifacts installed on two devices |
| 15 Jan 2027 | Native strength session with offline queue and sync | Mobile Lead | 100-session device test; zero duplicates |
| 31 Jan 2027 | Background GPS and HealthKit/Health Connect slice | Mobile Lead | Device matrix results, including failures |
| 15 Feb 2027 | Recruit 200 beta athletes from 3 clubs and 3 gyms | Growth | Cohort list; consent records |
| 15 Mar 2027 | First beta retention readout (D7) | Product | Cohort dashboard; interview notes |
| 31 Mar 2027 | Go/no-go for public launch in Q3 | Founders | Written decision with evidence |

### 15.3 Decisions requested from the reader

1. **Approve the wedge.** Confirm the hybrid athlete as the primary segment for FY2027-FY2028, with single-sport narrowing as the explicit fallback.
2. **Approve the launch surface.** Native iOS and Android first, web as reference and share preview, no PWA as the primary product.
3. **Approve the honesty invariant as a release gate.** No capability ships to the public UI as working until it has been tested on a real device and labeled with provenance.
4. **Approve the capital plan.** $2.5 million seed now, with the $6.5 million Series A gated on the FY2028 metrics and the lean case pre-approved as the fallback.
5. **Approve the stage gates.** No growth spend before retention; no sports expansion before the core loop; no AI before eval gates; no international expansion before EU compliance.

### 15.4 Closing

The repository already contains the hardest cultural asset a fitness company can have: a habit of telling the truth about what works. It has a tested domain, a migration path that does not discard data, a share-card engine that refuses to invent a route, and a team that wrote "Unavailable" instead of a fake integration. Those are not marketing points. They are the foundation of a product athletes can trust with years of training.

The next five years are not about adding more features than Strava or Hevy. They are about making one promise real for one athlete at a time: your training record will be accurate, portable, and yours. If the plan delivers that, the commercial outcomes follow. If it does not, no amount of AI or sport expansion will save it. The work starts with six decisions and a staging deploy.

---

## Appendix A. References and evidence log

External sources cited in this document, with the date accessed (October 2026):

1. Grand View Research, *Fitness Apps Market Size, Share and Trends Report, 2026-2033*. https://www.grandviewresearch.com/industry-analysis/fitness-app-market
2. Business of Apps, *Health and Fitness App Benchmarks*. https://www.businessofapps.com/data/health-fitness-app-benchmarks
3. RevenueCat, *State of Subscription Apps 2025* and *2026*. https://www.revenuecat.com/state-of-subscription-apps
4. Strava, *Year in Sport 2025* and July 2026 press release. https://press.strava.com
5. Sacra, *Strava revenue, valuation and funding*. https://sacra.com/c/strava
6. Sports and Fitness Industry Association, *2026 Topline Participation Report*; Running USA, *2025 Top Races* and *2025 Global Runner Survey*; RunSignup, *2025 Race Trends Report*. https://sfia.org; https://www.runningusa.org; https://info.runsignup.com
7. Rock Health, *2025 Consumer Adoption of Digital Health Survey*. https://rockhealth.com
8. Hevy, public site and press center. https://www.hevyapp.com
9. Apple, *App Store Small Business Program* and App Review Guidelines; Google, *Health Connect* documentation. https://developer.apple.com/app-store/small-business-program; https://developer.android.com/health-and-fitness/health-connect
10. Mapbox, MapTiler, OpenFreeMap, and OpenStreetMap tile policies; Expo, *EAS pricing and billing FAQ* - both as verified in `docs/BUILD-PLAN.md` in October 2026.

Repository sources:

- `docs/AUDIT-REPORT.md` - codebase audit and state of truth.
- `docs/LAUNCH-TRUTH.md` - what launches, what does not, and the test baselines.
- `docs/PRD.md` - product requirements, sport system specification, journeys.
- `docs/MOBILE-SPEC.md` - mobile architecture, data model, API contracts.
- `docs/PLATFORM-BLUEPRINT.md` - verified integration facts and competitor pricing.
- `docs/BUILD-PLAN.md` - verified vendor pricing and build constraints.
- `docs/ECOSYSTEM-PLAN.md` - phased module plan and dependencies.
- `AGENTS.md` - binding engineering and honesty rules.

---

*This plan is a working document. It will be revised annually and whenever a stage gate fails. Revisions are recorded in the change log, not silently overwritten. Facts are dated; assumptions are labeled; decisions are owned.*

