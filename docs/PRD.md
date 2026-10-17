# LMTLSS — Product Requirements Document

Status: Draft v2.2 (aligned to LMTLSS 2.0 + platform-systems supplement + "Activity Tracking, Clubs, Events and Sharing" specification)
Owner: Product
Source: [MASTER-PROMPT.md](MASTER-PROMPT.md) (LMTLSS 2.0 incl. Advanced Platform Systems addendum) + "What we're missing before building" + "What I would implement next" memos + original Phase 1 brief
Companion docs: [MOBILE-SPEC.md](MOBILE-SPEC.md) · [MOBILE-REQUIREMENTS-PROMPT.md](MOBILE-REQUIREMENTS-PROMPT.md) · [MASTER-PROMPT.md](MASTER-PROMPT.md)

---

## 1. Product thesis

LMTLSS is the operating system for human performance: **one athlete, every discipline, one performance identity** — a multi-sport performance platform + AI training ecosystem + social athletic club.

The strategy memo's core risk still governs: **building an enormous app before proving people love the core experience.** Every feature must strengthen one of the five pillars (2.0 §3); features that strengthen none are cut. Sports roll out only through the Sport System Specification process (§6), never as generic templates.

| Pillar | Question it answers | MVP expression |
|---|---|---|
| **Train** (A) | What do I do right now? | Discipline-specific training environments: strength + running first |
| **Intelligence** (B) | What should I do next, and why? | Plans, substitutions, explanations, grounded summaries — explainable, sport-routed |
| **Performance** (C) | Am I improving? | Unified records, history, trends, cross-sport insights where data supports them |
| **Club** (D) | Who am I training with, and why come back? | Clubs, events, challenges, training partners, club-led acquisition |
| **Identity** (E) | Who am I becoming? | Athlete profile, sport identity, shareable cards, public profile (opt-in) |

The memo's three-product framing (Performance / Club / Intelligence) nests inside this: Train+Performance, Club, Intelligence — with Identity added as the growth surface.

### The retention loop

The product is judged by whether this loop works — **without social features**. Clubs and sharing amplify a useful training product; they never compensate for a weak one.

1. **Know what to do** — personalized plan, clear next action
2. **Train with minimal friction** — fast logging, reliable tracking, uninterrupted sessions
3. **See something meaningful** — real improvement, useful insight, honest milestone
4. **Connect and share** — share an achievement, join a club *(optional amplifier)*
5. **Return with a reason** — relevant next session, goal, or club activity

---

## 2. Product decisions (binding)

| # | Decision | Requirement |
|---|---|---|
| A | First 60 seconds count | A new user chooses a sport, sets a goal, and starts something useful without a long questionnaire. Collect information gradually, only when it improves the experience. |
| B | Core action is exceptionally fast | Logging the next set is nearly effortless; starting a run is obvious; recording a class takes seconds. Measure each action's step count and latency; eliminate unnecessary steps. |
| C | Every user has a reason to return | Session reminders, club activity, progress summaries, next planned session. Notifications are configurable and tied to user goals — never arbitrary engagement quotas. |
| D | Progress feels real | "Am I improving?" answered against the user's own history, with uncertainty stated. Milestones celebrated; no invented universal scores. |
| E | Users build an identity | "I'm a runner," "I train BJJ," "I lift and play basketball" — reflected in profile, plans, and home. Clubs make identity social without forcing it. |
| F | The app gets out of the way | No mandatory AI conversations, no unnecessary onboarding screens, no intrusive pop-ups, no endless feeds. AI helps complete a task; it is not a task. |
| G | Sport System Specification before sport code | No sport ships UI before its formal specification (§6) exists, its data model is validated, and its essential workflows pass end-to-end. "30 sports in a menu but only two usable" is the failure mode to avoid. |
| H | Honest capability matrix | Every sport/feature is labeled planned / in development / implemented / tested / production-ready. Never represent planned functionality as available (2.0 §15). |

### Quality bar — five premium standards

Premium comes from the whole experience being considered, not from the palette. Every feature is judged against:

1. **Precision** — every metric is accurate; every error is communicated clearly.
2. **Speed** — common actions are immediate and require minimal navigation.
3. **Consistency** — strength, running, martial arts, and events share one design language **without sharing inappropriate workflows**.
4. **Restraint** — no unnecessary notifications, cluttered dashboards, or AI-generated filler.
5. **Reliability** — saved sessions, permissions, synchronization, and integrations behave predictably.

---

## 3. MVP scope

### 3.1 Launch (build and prove)

**Core training**
- Strength training and hypertrophy (sets, reps, load, rest, supersets, substitutions, previous-session references, PRs)
- Running (manual + GPS-supported recording where implemented, splits, pace, structured easy/long work)
- Workout history, goals, fast session experience, session recovery after interruption
- **Your Next Milestone** — a realistic, editable objective derived from goals + recent history; the standing reason to return
- **Data import** — bring years of existing workout history in (supported files/records), review-before-accept, deduplicated, original timestamps and sources preserved; full export always available

**Useful AI**
- Personalized training plans (AI + validated programming rules)
- Exercise substitutions (sport-specific rules + AI)
- Running plan generation
- Explanations and grounded progress summaries (never fabricated history, records, or readings)

**Club and sharing**
- Athlete profiles and sport identity
- Activity card system with formats per 2.0 §7: **route, performance, training recap, race, multi-sport** (deterministic templates; 9:16, 4:5, optional square; export without forcing public posting)
- **Share Studio** — a dedicated post-activity editor (not a share button): original templates for route stories, strength recaps, achievements, weekly recaps, club/event milestones; captions, selective metric visibility, route-privacy options, aspect-ratio export; native share sheet as the guaranteed fallback; **cards must look excellent outside LMTLSS** — subtle optional branding, never giant logos or forced referral text
- Private-by-default activity visibility with explicit sharing controls
- Basic clubs, events, challenges, invitations, and training-partner discovery
- **Find My Training Community** — match on sport, approximate area, availability, experience; **seeded with real partner clubs and useful events in a focused geography before discovery opens broadly** (no empty discovery screens)
- Opt-in public athlete profile at a stable web link (unauthenticated-viewable, fast, mobile-first)
- Third-party sharing via **independent adapters** (Snap Kit / Instagram investigated first, per-adapter capability matrix covering platforms, permissions, data direction, rate limits, costs, and tested/unsupported features); **a social integration failure must never block recording or sharing via export**

**Events (first-class)**
- Two categories in one system: **LMTLSS-hosted events** (meetups, community workouts, martial-arts workshops, tournaments, challenges, sponsored experiences) and **external event listings** (races/tournaments/classes from organizers or supported providers)
- Full event model: name, sport, description, organizer, date **with time zone**, location + map, capacity, waitlist, RSVP status, free/paid metadata, public / club-only / invitation-only visibility, calendar export, reminders, cancellation and change notifications, organizer verification and reporting, attendance/check-in
- Three integration patterns, in rollout order: **external listing** (link to organizer's registration) → **API import** behind provider-specific adapters with preserved provenance → **native registration** where organizer + payments support it
- Never scrape private event data; never imply a partnership that does not exist
- Club↔event↔activity connection through transparent eligibility rules and user consent only (e.g., club Saturday 5K → RSVP → members record in LMTLSS → eligible activities associated after confirmation → recap → club collective achievement)

**Mobile reliability**
- Persistent, recoverable sessions (offline-first logging)
- Account security, analytics eventing, crash reporting
- Essential device integrations: iOS HealthKit, Android Health Connect (per platform spec)

### 3.2 Explicit exclusions for the MVP

These are deferred **on purpose**, not forgotten. The data model anticipates them (see MOBILE-SPEC §4 sport engine); the product does not ship them until retention is validated.

- Additional sports: BJJ, Taekwondo, Krav Maga, basketball, pickleball, racket/combat/team sports generally
- Public social feed, leaderboards, challenges, discovery marketplace, coach booking
- Nutrition (Fuel) and full recovery/sleep tracking — Phase 2 after the loop is proven
- Third-party wearable services beyond Apple Health / Health Connect (Garmin, Fitbit, WHOOP deferred pending API/licensing verification)
- Direct Snapchat/Instagram publishing or friend-graph access — only verified Snap Kit / Instagram capabilities, each behind a documented adapter with a capability matrix; the native share sheet is the guaranteed path until an integration is proven
- Video-based technique assessment, any computer-vision feature
- Gamification that overwhelms training (streak pressure, arbitrary scores)
- AI chat as the primary interface (coaching is contextual, not a mandatory conversation)

### 3.3 Expansion rule

A sport graduates from the sport-engine backlog into build only when: (a) Week-1 and Week-4 retention on the core loop meets baseline targets, and (b) it has a complete Sport System Specification (§6) with schema, workflows, AI task map, safety rules, and acceptance criteria at the same depth as strength and running — validated with practitioners of that sport.

### 3.4 Build order (2.0 §15 — authoritative sequence)

| Phase | Scope | This PRD's coverage |
|---|---|---|
| 1. Foundation | Design system, authentication, athlete profiles, data architecture, privacy | Design system ✅ (Phase 1); auth/profiles/privacy → MOBILE-SPEC |
| 2. Core training | Strength + muscle development, running, workout history | **Shipped as Phase 1 prototype + native build per spec** |
| 3. Social identity | Activity cards, athlete profiles, clubs, challenges, invitations | §3.1 scope; J9–J10, J14 |
| 4. AI coaching | Training plans, substitutions, progress summaries, adaptive scheduling | §9 / AI subsystems |
| 5. Martial arts | BJJ, Taekwondo, Krav Maga, then more disciplines | §6 backlog — spec first |
| 6. Court and team sports | Basketball, pickleball, tennis, football, … | §6 backlog — spec first |
| 7. Connected ecosystem | Wearables, advanced analytics, coach tools, more sports | Excluded from MVP (§3.2) |

Monetization (2.0 §14): validate willingness to pay before building; basic activity ownership and privacy controls are never paywalled. Supported commercial shapes: **LMTLSS Premium** (advanced AI coaching, deeper analytics, specialized plans, verified integrations) · **LMTLSS Clubs** (paid admin tools for gyms, academies, teams, coaches) · **Training marketplace** (expert programs, coaching services — payments, commissions, refunds, coach verification, disputes, and app-store billing rules planned before launch). The user's own historical data is never paywalled.

### 3.5 Development-cycle order (next cycle — authoritative)

The supplement's checklist refines §3.4's phases into the order for the next development cycle:

1. **Foundation** — core data model and mobile reliability: activity schemas, persistent sessions, offline behavior, account security, iOS/Android build validation.
2. **Retention** — daily training loop: adaptive home, fast logging, training calendar, progress history, next milestones.
3. **Growth** — shareable activities and athlete profiles: running maps, strength recaps, privacy controls, public profile previews, native sharing.
4. **Community** — real clubs and training partners: club administration, events, invitations, moderation, launch partners.
5. **Intelligence** — AI evaluation and progression: validated plans, grounded insights, sport-aware recommendations, cost controls, safety tests.
6. **Expansion** — sport plugin framework, then validated martial-arts / court / endurance modules.
7. **Business** — premium entitlements, club tools, cohort analytics, measured pricing experiments.

Gate rule (2.0 §15 + supplement acceptance): **a screen existing is not completion.** A capability is complete when its behavior works, its data is reliable, its permissions are correct, and its user journey passes on both platforms.

**Execution refinement (do not build it all at once):** (1) make **one activity** work perfectly — strength logging + real GPS running with persistence, history, reliable post-workout summaries; (2) make the activity **worth sharing** — Share Studio, route cards, achievements, native sharing; (3) **connect the real world** — club profiles, event creation, RSVP, calendar integration with a small group of actual organizers; (4) **connect external platforms** — Snapchat, Instagram, wearables, mapping, fitness platforms, each validated individually; (5) **expand the ecosystem** — more sports, advanced AI, club tools, monetization, once the core demonstrates retention. GPS running specifically **does not accept a visual prototype as sufficient**: physical-device testing is mandatory.

---

## 4. Success metrics (instrumented from day one)

Targets are set **after** establishing a baseline with real users. Do not optimize daily-active usage for sports whose natural cadence is lower.

| Metric | Definition | Tells us | Guardrail |
|---|---|---|---|
| Activation rate | % of new users completing a meaningful first action (first logged set or saved run) within 24h | Does onboarding deliver value | — |
| Time to first activity | Median seconds from install to first saved activity | Value speed (Decision A/B) | Target after baseline |
| Week-1 / Week-4 retention | % of activated users returning in windows | Do reasons to return exist | Primary success metric |
| Sessions logged per active user | Per week, by sport | Is it part of a real routine | Not inflated by notifications |
| Plan adherence | Planned sessions completed / planned | Are recommendations practical | Explained misses ≠ failures |
| Share-to-visit conversion | Visits from shared cards / cards shared | Do shared artifacts attract users | Spam-free: max 1 card/session |
| AI recommendation acceptance | Accepted / shown recommendations | Is AI genuinely useful | Rejection is a first-class signal |
| Share rate | % of active users producing ≥1 shared artifact / period | Does Identity travel organically (2.0 growth) | Shared ≠ posted; export counts |
| Invitation acceptance | Accepted / sent | Partner & club invite quality | Easy to decline; no spam affordances |
| Club activation | % of club joiners reaching a first meaningful club action; weekly participation | Do clubs organize through LMTLSS | Solo value must precede network ask |
| Referred-user retention | Referred vs organic W1/W4 retention | Do referrals bring invested users | Attribution only with consent |
| Referred activation | Referred users completing first meaningful activity | Is the low-friction join path real | Denominator: attributed installs only |
| Onboarding completion | % starting → generated plan (J2) | Does cold start deliver | Drop-off per step instrumented |
| Second-session rate | % of activated users logging session 2 within 7 days | Habit formation beyond first try | — |
| Plan adoption | Planned sessions started / plans created | Are plans practical, not decorative | Misses explained ≠ failures |
| Subscription conversion | Trial/paid signups / eligible users | Willingness to pay (after demand validation) | Never gates logging/privacy/history |
| Cancellation reasons | Structured exit feedback | Why value breaks | Qualitative + quantitative |
| Crash-free sessions | % sessions without crash/ANR | Reliability floor | Block releases below threshold |

Retention is analyzed **by sport cohort** (runners vs lifters vs academy-scheduled martial artists return on different cadences); do not blend them into one misleading curve.
| Sync failures / data loss events | Count of failed syncs, discarded records | Trust | **Target: zero silent data loss** |

---

## 5. User journeys and acceptance criteria

### 5.1 Definition of done (every journey)

Ships only when: it works end-to-end on **both iOS and Android**, has loading/empty/error/success states, passes its acceptance criteria on a real device (not simulator alone), is covered by automated tests per MOBILE-SPEC §12, and is honestly labeled (no mock integrations).

### 5.2 Journeys

**J1 — Sign up / sign in**
- Criteria: account created or restored within one screen of intent; tokens stored in platform secure storage; signed-out state never exposes private data; deletion reachable from settings.

**J2 — Onboarding (cold start, Decision A)**
- Criteria: ≤ 60 seconds to first useful screen; sport + goal + availability collectable in ≤ 3 taps each; all nonessential questions skippable; generated plan explains its assumptions and is editable; volume never set from ambition alone.

**J3 — Choose and configure sports**
- Criteria: each selected sport gets its own metrics and workflows (no generic template forced on a sport); changing sports later re-plans without touching history.

**J4 — Start / pause / resume / finish a workout (Decision B)**
- Criteria: from Home to first set logged ≤ 2 taps; pause/resume is one tap; finish produces a summary with volume/time and an explicit next step; interrupted session (kill, crash, restart) resumes or offers recovery with data intact.

**J5 — Log strength sets**
- Criteria: log a set (reps + load + done) without leaving the session screen; inputs prefilled from history; rest timer starts on completion and survives backgrounding; single-hand operation with ≥ 44pt targets.

**J6 — Record a run**
- Criteria: start run in one tap from Train; timer independent of network; when GPS is active the UI states it, when it is time-only the UI states that; permission denial degrades gracefully and says so; distance provenance (GPS vs manual) recorded per activity; **recording persists through background/screen-lock where the platform permits; noisy/invalid points filtered; the rendered route uses only actually recorded coordinates; sign-off requires physical-device testing on both platforms; mapping provider licensing and costs verified before ship**

**J7 — Recover an interrupted session**
- Criteria: active-session state persisted locally at every mutation; after suspension/reboot-feasible recovery, session offered back with elapsed-time integrity (idle time not counted while app closed > 10 min, per Phase 1 behavior); completed work never silently discarded.

**J8 — Activity history and progress**
- Criteria: history lists all activities with sport-appropriate summaries; records labeled as estimates where estimated (Epley 1RM etc.); every insight carries its data source; comparisons are vs the user's own baseline.

**J9 — Share Studio (activity sharing)**
- Criteria: after an eligible activity, relevant designs are generated deterministically from the validated record (no AI in the path) — route, performance, training recap, race, or multi-sport per 2.0 §7, plus strength recaps and club/event achievements; 9:16 and 4:5 (optional square); excludes sensitive data by default (generalized route, no exact home start/end); private activity stays private unless explicitly shared; referral link included only with consent; editor supports captions, metric hiding, and route-privacy choices; export works without posting publicly and **without an account**; native share sheet is the guaranteed fallback when platform integrations are unavailable; the card must be worth sharing even with all promotional text removed.

**J10 — Join a club and interact**
- Criteria: user can join/leave, view club activity, and post a card without an infinite feed; cold start is valuable before any club exists (solo loop must work first); block/report available on every user-facing surface.

**J11 — AI coach**
- Criteria: every recommendation shows why + confidence; refuses or defers when data is thin instead of guessing; deterministic calculations never routed through a model; a coach outage never blocks logging; acceptance/rejection of each recommendation is instrumented.

**J12 — Notifications, privacy, integrations**
- Criteria: all notifications opt-in, grouped by category, quiet-hours aware where platform supports; location sharing private by default; HealthKit/Health Connect use minimum-necessary permissions with in-app permission education; revocation handled without data loss.

**J13 — Export and delete account**
- Criteria: export produces a complete, portable machine-readable file (JSON + documented schema); deletion removes personal data across systems with an auditable record and states retention exceptions honestly.

**J14 — Club event or challenge**
- Criteria: join/leave an event or challenge in ≤3 taps; progress and attendance surface to the club feed without an infinite-scroll dependency; leaderboards are configurable, sport-appropriate, transparent about rules, and resistant to duplicate/invalid activity manipulation; leaving or deleting participation leaves others' data intact.

**J15 — Public athlete profile and referral path**
- Criteria: profile is private by default; making it public is an explicit choice per item (sports, achievements, activities); the public web link renders fast and mobile-first for logged-out visitors with an unobtrusive sign-up path; referral attribution is recorded only with consent; stable link, revocable at any time. The stored profile must be able to survive being seen by someone who never installs the app.

**J16 — Import existing training history**
- Criteria: user uploads/links supported sources and previews every record **before accepting**; duplicates detected across device, manual, and health sources with merge options; original timestamps and sources preserved as provenance; partial imports resumable; individual records rejectable; import never silently overwrites existing data; export remains available throughout.

**J17 — RSVP to an event**
- Criteria: join/waitlist in ≤3 taps with live capacity status; calendar export and reminders; cancellation and schedule changes notify attendees; check-in respects organizer permissions; external events keep source provenance and link out honestly; club-activity association only through transparent eligibility rules with user consent; event visibility (public / club-only / invitation-only) enforced on every read.

---

## 6. Sport System Specification (2.0 §4 — the most important architectural requirement)

No sport is implemented through a generic workout builder. Before writing any UI or business logic for a sport, produce a formal Sport System Specification covering eight areas:

1. **Domain definition** — what the sport is; disciplines/subdisciplines; typical practitioner profiles; how people train; what improvement means in this discipline.
2. **Athlete profile schema** — experience/skill level; ranks, belts, grades, competitive categories where applicable; goals; frequency/availability; equipment/facilities; relevant history; optional coach/club/team/competition affiliations. **Only collect information that serves a real product purpose.**
3. **Training ontology** — the discipline's core concepts (strength: exercises, sets, reps, loads, rest, movement patterns · running: routes, splits, pace, intervals, elevation, race goals · BJJ: techniques, positions, transitions, escapes, submissions, drilling, rolling, comp prep · basketball: skills sessions, shooting practice, conditioning, practice, game stats, position development).
4. **Metrics and scoring** — what is reliably measurable / manually entered / estimated / sensor-dependent; which comparisons are meaningful; **which metrics must never be compared across unrelated sports**. No invented universal athletic scores.
5. **Training workflows** — onboarding → baseline → goals → plan → session prep → live session → completion/logging → analysis → progression → social sharing.
6. **AI task map** — which tasks need AI, which are deterministic, which require a qualified human coach.
7. **Social layer** — how practitioners of this discipline connect, train together, share, discover clubs, celebrate progress.
8. **Safety and quality** — sport-specific risks, data limitations, inappropriate-recommendation classes, required tests before release.

### Required outputs (all ten, before a sport is "done")

1. Sport system specification
2. Athlete profile schema
3. Activity and performance data schema
4. Screen-by-screen UX flow
5. Design components and interaction states
6. AI task specification
7. API and integration requirements
8. Validation and safety rules
9. Acceptance criteria (journeys J4–J8 restated with sport-specific numbers)
10. Automated and manual test plan

**Completion bar:** a sport is never marked complete until its essential workflows work end to end, and its model is validated with practitioners of that discipline (2.0 §15: "validate usability with practitioners of that sport"). Generic AI output must not author a martial arts curriculum without expert review.

**Status:** strength and running are fully specified (Phase 1 code is the reference implementation of the framework). All other sports — BJJ, Taekwondo, Krav Maga, basketball, pickleball, and the wider backlog — exist as schema sketches only until they enter their build phase (§3.4) and pass this specification process. The repeatable five-step process: define the sport → model the data → design the experience → add intelligence → validate with athletes.

---

## 7. Data quality requirements (non-negotiable)

- Single normalized activity foundation; sport-specific fields isolated behind typed schemas (JSONB + validated columns)
- **Provenance on every datum**: GPS | wearable | manual | estimated | derived — visible in UI where it matters
- Idempotent writes (client-generated UUIDs) so retries and queue replays cannot duplicate
- Validation at the boundary (client and server) before a record is considered saved
- Deduplication rules for HealthKit/Health Connect round-trips
- Imports: preview-before-accept, per-record rejection, dedup keys across device/manual/health sources, original timestamps preserved as provenance (J16)
- Export includes provenance; deletion includes audit trail
- Insight generation must state uncertainty and refuse when inputs are insufficient (asserted by tests, per Phase 1 suite)

---

## 8. Privacy, safety, trust

| Requirement | MVP behavior |
|---|---|
| Location | Requested only when needed; background access explained; private by default; share controls per activity; shared routes generalized with **start/end-point masking** |
| Health data | Minimum-necessary permissions; consent recorded; never logged; never sold |
| Profiles | Private by default; public only by explicit action |
| Community | Block, report, anti-spam; club administrator permissions; moderation for harassment **and dangerous training advice**; age-appropriate defaults and protections |
| Retention | Transparent, published data-retention policies; deletion windows stated honestly |
| Training guidance | General guidance, not medical advice; injury-specific deferral to professionals; no fabricated evidence |
| Account rights | Full export + deletion, settings-deep, honest about retention windows |
| Secrets | Never in the client; never in logs (see MOBILE-SPEC §11) |

---

## 9. AI policy (selective intelligence)

Deterministic by default; AI only where it materially improves the experience.

| Capability | Implementation |
|---|---|
| Pace, distance, totals, PRs | Deterministic |
| Timers, set logging | Local application logic |
| Plan personalization | AI + validated programming rules, structured output, validated before save |
| Exercise substitutions | Sport rules first, AI to fill gaps |
| Progress explanations | Analytics generates facts; AI narrates them (no invented facts) |
| Route recording | GPS / platform location services |
| Clubs, membership | Conventional application logic |
| Activity cards | Deterministic templates + graphics |
| Moderation | Automated screening + user reporting + escalation |

Cost/latency/availability budgets and fallbacks: MOBILE-SPEC §9. Workout logging must never depend on AI availability (J11).

### Architecture alignment (2.0 §10–§11)

The orchestrator from MOBILE-SPEC §9 implements the ten subsystems of 2.0 §10: **A** Athlete Context Engine (structured, provenance-stamped user state) · **B** Sport Router (routes requests to per-sport logic without erasing it) · **C** Plan Generator (validated rules → structured, editable plans) · **D** Session Adaptation (never auto-increases intensity after a missed session) · **E** Performance Analyst (deterministic metrics, AI narration) · **F** Conversational Coach (curated-source retrieval, stated uncertainty) · **G** Technique & Learning Assistant (no video-assessment claims until validated) · **H** Nutrition Assistant (validated data, no unsafe prescriptions) · **I** Community Assistant (no fabricated engagement, no unauthorized posting) · **J** Safety & Quality Layer (deterministic guardrails, professional escalation).

Implementation tiers: **Tier 1** (plan generation, coach NLU, substitutions, summaries, context-aware adjustments) ships with the AI-coaching phase; **Tier 2** (cross-sport calendar, longitudinal insights, adaptive recommendations, discovery assistance) follows validated retention; **Tier 3** (video technique analysis, CV movement feedback, predictive modeling) is validation-dependent and **never a prerequisite for launching a useful product**.

### AI trust and evaluation (supplement — required before expanding AI agents)

Every AI capability ships with, and is gated by:

- **Declared scope** — what it may access, what tasks it may perform, what data must be present before it can answer at all.
- **Strict output schemas** — validated before anything is saved or shown; deterministic validation on every recommendation that affects training.
- **Refusal rules** — when to refuse, clarify, or refer to a qualified professional; confidence never equals authority.
- **Versioned eval suites** — test cases covering beginners, advanced athletes, conflicting goals, incomplete data, missed sessions, and unsafe requests; evals run as CI gates alongside unit tests.
- **Observability** — accuracy/usefulness measures, latency, error rate, and cost monitored per capability; deterministic fallbacks for essential operations.
- **Domain review** — qualified practitioners review content for martial arts and other technically demanding disciplines before it ships.

---

## 10. Platform systems (supplement — ten systems + product builder)

From "What I would implement next." Each system must have documented ownership, data requirements, permissions, failure behavior, tests, and measurable completion criteria before it counts as done.

| # | System | Core requirement | Where specified |
|---|---|---|---|
| 1 | **Athlete Operating System** | Shared athlete context (goals, schedule, history, preferences, equipment) with sport-specific models; unified training calendar incl. competitions and recovery days; **conflict detection** (time clashes, incompatible demands); priority-preserving adjustments; explanations; manual overrides — the athlete stays in control | §1 pillars · §3.1 · AI Tier-2 calendar ([MOBILE-SPEC](MOBILE-SPEC.md) §9) |
| 2 | **Sport plugin architecture** | Sports as independent validated modules (domain model, profile fields, metrics/calculation rules, skill libraries, logging, analysis, AI tasks/restrictions, social, integrations, tests); platform supplies auth, navigation, profiles, clubs, notifications, security | §6 · [MASTER-PROMPT](MASTER-PROMPT.md) §4 |
| 3 | **Progression engine** | Four distinct layers: **activity** (what was done) → **performance** (what was achieved) → **development** (change over time) → **recommendation** (what next); discipline-specific measures vs own baseline; **Your Next Milestone** (realistic, editable); never one universal score | §4 metrics · §5 journeys · §9 AI |
| 4 | **Social graph** | Athletes, clubs, events, partners, challenges, membership permissions; public/private/invite-only groups; RSVP/attendance; coach/organizer roles; moderation + anti-spam; **Find My Training Community**; seeded with real partner clubs before discovery opens | §3.1 · J10/J14 · §8 |
| 5 | **Activity-to-content engine** | Auto card generation after eligible sessions; multiple layouts, editable captions; native sharing; export attractive **without an account**; optional attribution/referral; public web previews; route/stat privacy controls | J9 · §3.1 · [MOBILE-SPEC](MOBILE-SPEC.md) §5 |
| 6 | **Training data & import** | Import supported files/records; wearable connections only where verified; export in practical formats; dedup across sources; original timestamps/provenance; review before accepting | J16 · §7 · [MOBILE-SPEC](MOBILE-SPEC.md) §5/§8 |
| 7 | **AI trust & evaluation** | Versioned evals per capability as CI gates; schemas, refusal rules, cost/latency/error monitoring; practitioner content review | §9 (subsection above) |
| 8 | **Safety, privacy, moderation** | Architectural requirement from day one: consent, route masking, visibility controls, deletion/export, reporting/blocking, club admin permissions, moderation incl. dangerous advice, age-appropriate defaults, retention policies | §8 · [MOBILE-SPEC](MOBILE-SPEC.md) §11 |
| 9 | **Monetization & marketplace** | Premium, Clubs, marketplace via modular entitlements + payment interfaces; validate demand first; never paywall logging, privacy, or historical data; marketplace needs payments/commissions/refunds/verification/disputes/billing rules | §3.4/§3.5 · [MOBILE-SPEC](MOBILE-SPEC.md) §4/§5 |
| 10 | **Product analytics & experimentation** | Full-journey instrumentation (acquisition → cancellation); aggregate internal admin console (health, errors, integration status, AI costs) with no unnecessary PII; sport-cohort retention analysis; controlled experiments on onboarding/reminders/subscription — **never optimize engagement at the expense of healthy training habits** | §4 (metrics above) · [MOBILE-SPEC](MOBILE-SPEC.md) §3 |
| 11 | **Product builder** (internal workflow) | Repeatable pipeline: new sport → generated spec package (domain, profile, screens, metrics, AI/safety, tests) → reviewed, tested module integrated without breaking other sports; reads the existing codebase and design system first, reuses components, creates migrations, runs regression tests — **not** one enormous prompt, not blind generation | [MASTER-PROMPT](MASTER-PROMPT.md) §15 · §6 of this PRD |

Four reasons to exist (the supplement's summary): athletes use it because it makes training easier; return because it helps them improve; invite people because clubs and partners are there; share it because achievements look good and mean something. **When those four work, more sports become a growth strategy rather than an endless engineering project.**

## 11. Deliverable status

| # | Deliverable | Status |
|---|---|---|
| 0 | Canonical master brief (LMTLSS 2.0) | [MASTER-PROMPT.md](MASTER-PROMPT.md) |
| 1 | This PRD | **Draft v2.1 — this document** (v1: three-pillar framing · v2: 2.0 alignment · v2.1: platform-systems supplement, dev-cycle order, J16) |
| 2 | Mobile technical specification | [MOBILE-SPEC.md](MOBILE-SPEC.md) |
| 3 | Design system + interactive prototype | **Shipped as Phase 1** (black/`#61EB1A` web reference implementation: tokens, flows, workout screens, progress). Covers 2.0 pillars Train + Performance; **cards, club, public profiles not yet built** |
| — | Mobile engineering prompt appendix | [MOBILE-REQUIREMENTS-PROMPT.md](MOBILE-REQUIREMENTS-PROMPT.md) |
| 4 | First vertical slice: onboarding → plan → workout/run → saved activity → progress summary → shareable card | Next build increment, spec'd in MOBILE-SPEC §14 |
| — | Capability matrix (planned / in dev / implemented / tested / production-ready) | Owned by the build; this table is its product-level seed (2.0 §15) |

Phase 1 remains the canonical interaction reference: what it does today (fast set logging, session recovery, provenance labels, explainable insights, equipment-aware planning) is the acceptance bar for the native build — not a prototype to be reinterpreted.
