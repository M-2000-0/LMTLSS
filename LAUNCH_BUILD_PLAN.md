# LMTLSS — Launch Build Plan

> This is the execution companion to `LMTLSS_LAUNCH_READINESS_TRACKER.md`.
> It turns the tracker into the next concrete build increments, with owners,
> dependencies, status, and verification, and it stops short of pretending the
> product is further along than the repo shows today.
>
> Status values: `Not started`, `In progress`, `Blocked`, `In review`, `Done`, `Deferred`.
> Priority: `P0` = launch gate, `P1` = before GA, `P2` = before scaling/marketing push, `P3` = post-GA.
> Owner conventions: `PM` = product manager, `TC` = tech lead, `UX` = UX/design, `SEC` = security/compliance, `MKT` = marketing/outreach, `OPS` = ops/reliability, `DATA` = data/backend/AI.

---

## 0. Start here: confirm what you are actually building

Before treating any phase below as committed, confirm these scope decisions and write them down. If you do not, every later phase inherits the ambiguity.

| ID | Decision | Priority | Owner | Status | Verification / evidence | Notes |
|----|----------|----------|-------|--------|--------------------------|-------|
| DEC-01 | What is launching: web app, iOS build, Android build, backend, or a staged sequence? | P0 | PM | Not started | Written decision. | The repo currently has a working web app, a scaffolded mobile app, and an unshipped backend. Pick the launch surface explicitly. |
| DEC-02 | What backends/auth are available at launch, if any? | P0 | TC + SEC | Not started | Written decision. | Today `server/` is dependency-free, unshipped, and not wired from the UI. |
| DEC-03 | Which devices/OS versions/network conditions are in scope for the mobile launch? | P0 | TC | Not started | Written device matrix. | Needed before GPS, map, and background behavior can be treated as tested. |
| DEC-04 | Is any AI/LLM feature in the launch scope, or is it deferred? | P0 | PM + DATA | Not started | Written decision. | If deferred, mark all AI rows as Deferred with that reason. |
| DEC-05 | What does "production-ready" mean here: app-store build, backend live, or both? | P0 | PM | Not started | Written definition. | This changes the release-gate row set. |
| DEC-06 | Which launch markets/languages are in scope? | P1 | PM | Not started | Written decision. | Drives the localization section. |

---

## 1. Build sequence overview

The repo already contains a clear build order in `docs/PRD.md` and `docs/BUILD-PLAN.md`. This plan follows that order and makes the next increments concrete.

| Phase | What it delivers | Then unlocks | Launch relevance |
|-------|------------------|--------------|------------------|
| 1. Foundation | Domain integrity, schema migration, test automation, honest UI framing | Everything else | Launch gate for trust/reliability |
| 2. First vertical slice | Onboarding → plan → one activity type → saved activity → progress → shareable card | Retention story, sharing, community | The first thing to prove with real users |
| 3. Sharing & identity | Share Studio, route/strength recap cards, native share fallback, public profile path | Growth, referrals, community | Needed if "share" is part of launch |
| 4. Community | Clubs, events, invitations, moderation basics, seeded partners | Social loop, discovery | Needed if "clubs/events" are in launch |
| 5. Intelligence | AI coaching with gates, fallback to deterministic engine, eval suite | Better recommendations, personalization | Only after core loop is proven |
| 6. Data & backend | Real backend deploy, sync, import, entitlements, admin console | Multi-device, scale, payments | Only if backend is in launch scope |
| 7. Security, privacy, ops | Consent, deletion/export, rate limits, crash/analytics, runbooks | Safer launch, incident response | Launch gate in practice |
| 8. Localization & markets | Strings, locale-sensitive formatting, market-specific privacy/terms | Broader launch | Only if multi-market launch is intended |
| 9. QA, devices, release | Device testing, GPS/map verification, release checklist, rollback | Actual launch confidence | Required before any public signal |

Recommended sequencing rule: do not start a later phase as a way to avoid finishing an earlier gate. In particular, do not start AI or community work until the first vertical slice has a believable retention signal and honest labeling.

---

## 2. Phase 1 — Foundation

Goal: make the existing app trustworthy enough that any later launch is not resting on silent data loss, untested session recovery, or unverified claims.

### 2.1 Web app foundation

| ID | Task | Priority | Owner | Status | Dependencies | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------|--------------------------|-------|
| F-WEB-01 | Run the browser test suite from `tests.html` now and record the actual result. | P0 | TC | Not started | None | Actual `PASS (n)` or `FAIL (n)` plus `window.__TESTS__`. | AGENTS.md warns not to claim a test passed unless executed. |
| F-WEB-02 | Re-confirm the schema-migration/quarantine behavior protects stored data if the version changes. | P0 | TC | Not started | None | Migration + quarantine test notes. | Highest-priority data-integrity rule in `docs/AUDIT-REPORT.md`. |
| F-WEB-03 | Confirm `persist()` no longer depends on `UI` being available at call time. | P0 | TC | Not started | None | Code check + failure-mode note. | AGENTS.md P0-2. |
| F-WEB-04 | Confirm active-session recovery is tested for refresh and idle freeze. | P0 | TC | Not started | None | Session-clock test notes. | The >10 min idle freeze is the core "do not lose my workout" guarantee. |
| F-WEB-05 | Confirm provenance labels appear where they matter: manual distance, estimated 1RM, seeded data. | P0 | UX + TC | Not started | None | Screen-by-screen provenance notes. | Honesty invariant from `AGENTS.md`. |
| F-WEB-06 | Confirm no screen implies a working backend, GPS, sharing, or AI feature that does not exist yet. | P0 | PM + UX | Not started | DEC-01..04 | Copy/behavior audit. | Integrations must render "Unavailable," not working controls. |
| F-WEB-07 | Verify `innerHTML` is only used for static icon/chart SVG, never user content. | P0 | TC + SEC | Not started | None | Code audit. | `AGENTS.md` rule. |
| F-WEB-08 | Add a headless/CI entry point for the existing suite if one does not exist yet. | P1 | TC | Not started | None | A command that runs the same assertions outside a manual browser tab. | CI is the first step toward trustworthy releases. |
| F-WEB-09 | Add lint/typecheck if the team wants them for the web layer; keep the web app dependency-free if that is still the intent. | P2 | TC | Not started | Team decision | Config + clean run notes. | No framework change is justified yet per the audit. |

### 2.2 Shared domain and mobile foundation

| ID | Task | Priority | Owner | Status | Dependencies | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------|--------------------------|-------|
| F-SHM-01 | Confirm parity between `js/domain.js` and `shared/src/domain.ts` is intact. | P0 | TC | Not started | None | Parity test result. | Any domain change must be mirrored; drift test should fail on API differences. |
| F-SHM-02 | Run the shared/mobile test baselines and record actual results. | P0 | TC | Not started | None | Actual test output with numbers. | Do not quote old baselines without re-running. |
| F-SHM-03 | Confirm local calendar day handling is used everywhere "today" matters. | P0 | TC | Not started | None | Date-boundary test notes. | AGENTS.md: never slice `toISOString()` for a day boundary. |
| F-MOB-01 | Decide whether the mobile app is a launch surface this cycle. | P0 | PM + TC | Not started | DEC-01 | Written decision. | If not, defer mobile-specific tasks. |
| F-MOB-02 | If mobile is in scope, verify the app icon/favicon/logo/Android foreground assets are at the paths the build reads. | P0 | UX + TC | Not started | None | Asset existence + metadata check. | The repo already copies these; consumption by a native build is the remaining question. |
| F-MOB-03 | If mobile is in scope, run a real build path and confirm the built artifact starts, not just the dev server. | P0 | TC | Not started | F-MOB-01 | Built-artifact launch notes/screenshots. | A dev render is not a store-bound build. |
| F-MOB-04 | If mobile is in scope, confirm storage adapter round-trip, corrupt-payload preservation, and failed-write surfacing. | P0 | TC | Not started | None | App-store test notes. | Matches the web persistence-failure expectation. |
| F-MOB-05 | If mobile is in scope, confirm the onboarding → Today journey is the intended first-run path and persists as expected. | P0 | PM + TC | Not started | None | Journey test with persisted JSON. | The repo already has this assertion; confirm it matches launch intent. |

### 2.3 Backend/server foundation

| ID | Task | Priority | Owner | Status | Dependencies | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------|--------------------------|-------|
| F-SRV-01 | Decide whether the backend is in this launch at all. | P0 | PM + TC | Not started | DEC-02 | Written decision. | If not, defer most server rows. |
| F-SRV-02 | If backend is in scope, run it locally in a Workers-compatible environment before claiming it is ready. | P0 | TC | Not started | DEC-02 | `wrangler dev --local` or equivalent workerd notes. | AGENTS.md: D1/workerd remain unverified until that happens. |
| F-SRV-03 | If backend is in scope, confirm authorization is enforced server-side on every private endpoint. | P0 | TC + SEC | Not started | F-SRV-02 | Endpoint authorization review. | Scope by `user.sub`, never by client-supplied ID/email. |
| F-SRV-04 | If backend is in scope, confirm no secrets/keys/tokens land in repo, logs, browser storage, or client bundles. | P0 | SEC | Not started | F-SRV-02 | Secret audit. | AGENTS.md rule. |
| F-SRV-05 | If backend is in scope, confirm migration/run strategy for D1 and that schema changes are versioned. | P0 | TC + DATA | Not started | F-SRV-02 | Migration notes + test. | Do not start from an untested migration story. |

---

## 3. Phase 2 — First vertical slice

Goal: one activity works end to end, honestly, on the chosen platform(s). The PRD is explicit that this means strength logging and/or real GPS running with persistence, history, and reliable post-activity summaries — not a visual mock.

### 3.1 Choose and complete one activity vertical

| ID | Task | Priority | Owner | Status | Dependencies | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------|--------------------------|-------|
| S-01 | Pick the first vertical: strength, running, or both. | P0 | PM + TC | Not started | DEC-01 | Written decision. | Doing both at once is a common way to delay the slice indefinitely. |
| S-02 | If strength: make set logging, previous-set references, rest timer, and session finish work end to end. | P0 | TC + UX | Not started | F-WEB-01, F-SHM-01 | Journey notes + test coverage. | Use the existing domain as the acceptance bar. |
| S-03 | If running: make manual + GPS-supported recording work, with honest provenance and time-only fallback. | P0 | TC + UX | Not started | F-WEB-01, MAP decision, device matrix | Device-tested recording notes. | GPS does not accept a visual prototype as sufficient. |
| S-04 | Make the post-activity summary real: what happened, measured from the saved activity, with uncertainty stated. | P0 | TC + UX | Not started | S-02 or S-03 | Summary behavior notes. | No invented history or readings. |
| S-05 | Confirm interrupted session recovery preserves completed work and handles idle time honestly. | P0 | TC | Not started | F-WEB-04 | Recovery test notes. | The app's reliability promise lives here. |
| S-06 | Confirm the activity history list shows sport-appropriate summaries and labels estimates. | P0 | UX + TC | Not started | S-02 or S-03 | Screen notes. | Comparisons must be vs the user's own baseline. |
| S-07 | Make the vertical work offline/local-first to the degree launch requires. | P0 | TC | Not started | S-02 or S-03 | Offline behavior notes. | Depends on launch surface and sync decisions. |

### 3.2 Make the slice observable

| ID | Task | Priority | Owner | Status | Dependencies | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------|--------------------------|-------|
| S-08 | Instrument activation, time-to-first-activity, and first-session completion for the slice. | P0 | DATA + TC | Not started | S-01 | Instrumentation notes. | Start with the questions, not the tooling. |
| S-09 | Confirm crash/error reporting is available if the launch surface needs it. | P1 | TC + OPS | Not started | DEC-01 | Reporting check. | Depends on platform. |

---

## 4. Phase 3 — Sharing and identity

Goal: make an activity worth sharing without overpromising posting, feed, or backend capabilities that are not ready.

| ID | Task | Priority | Owner | Status | Dependencies | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------|--------------------------|-------|
| SH-01 | Define the card formats that exist at launch and which are deterministic vs not. | P0 | PM + UX | Not started | Phase 2 | Format list with status. | Per PRD 2.0 §7: route, performance, training recap, race, multi-sport. |
| SH-02 | Implement Share Studio as a post-activity editor, not a magic share button. | P0 | TC + UX | Not started | SH-01, Phase 2 | Editor flow notes. | Captions, metric visibility, route privacy, aspect ratios. |
| SH-03 | Make export work without posting publicly and without forcing an account. | P0 | TC | Not started | SH-02 | Export path notes. | Native share sheet remains the guaranteed fallback. |
| SH-04 | Ensure a social integration failure never blocks recording or export. | P0 | TC + SEC | Not started | SH-02 | Failure-mode notes. | PRD explicit requirement. |
| SH-05 | Decide whether public athlete profiles are in launch scope and, if so, what is public by default. | P0 | PM + UX | Not started | DEC-01 | Decision + profile visibility rules. | Private by default; public only by explicit choice. |
| SH-06 | If public profiles are in scope, make the public web link fast and useful to a logged-out visitor. | P1 | TC + UX | Not started | SH-05 | Public-link test notes. | Must survive being seen by someone who never installs the app. |
| SH-07 | Confirm cards look good outside the app and do not force referral text or giant logos. | P1 | UX | Not started | SH-02 | Visual review notes. | Optional subtle branding only. |
| SH-08 | Verify sharing behavior on the actual platform(s) where sharing will be used. | P1 | TC + MKT | Not started | SH-02 | Platform sharing notes. | Do not rely on assumed share-sheet behavior. |

---

## 5. Phase 4 — Community

Goal: real clubs and events with real partners, not empty discovery screens.

| ID | Task | Priority | Owner | Status | Dependencies | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------|--------------------------|-------|
| CM-01 | Decide whether clubs/events are in this launch. | P0 | PM | Not started | DEC-01 | Written decision. | If not, defer this phase. |
| CM-02 | If in scope, define the first club/event features exactly: join/leave, RSVP, visibility, moderation basics. | P0 | PM + TC | Not started | CM-01 | Feature list with status. | J10/J14 journeys are the reference. |
| CM-03 | If in scope, seed with real partner clubs and useful events in a focused geography before discovery opens. | P0 | PM + MKT | Not started | CM-02 | Seeding plan + partner list. | No empty discovery screens. |
| CM-04 | If in scope, implement membership permissions and enforce them on every read/write server-side, if a backend exists. | P0 | TC + SEC | Not started | CM-02, backend decision | Authorization review. | Never trust client-supplied membership. |
| CM-05 | If in scope, implement block/report and club admin permissions. | P1 | TC + SEC | Not started | CM-02 | Feature notes. | Required for a public-facing community. |
| CM-06 | If in scope, make RSVP, waitlist, capacity, and calendar export honest and testable. | P1 | TC | Not started | CM-02 | Flow notes. | External events must keep source provenance. |
| CM-07 | If in scope, define challenge/leaderboard behavior and its anti-abuse rules before launch. | P2 | PM + TC | Not started | CM-02 | Rules doc. | Leaderboards must be sport-appropriate and transparent. |

---

## 6. Phase 5 — Intelligence

Goal: only add AI where it improves a real task, with gates, fallbacks, and honest framing.

| ID | Task | Priority | Owner | Status | Dependencies | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------|--------------------------|-------|
| AI-01 | Decide whether AI coaching is in this launch. | P0 | PM + DATA | Not started | DEC-04 | Written decision. | If not, defer this phase. |
| AI-02 | If in scope, define the exact AI tasks: plan generation, substitutions, explanations, summaries, adaptation. | P0 | DATA + PM | Not started | AI-01 | Task list with boundaries. | Deterministic work stays deterministic. |
| AI-03 | If in scope, define what data each AI task may read and what it may not do. | P0 | SEC + DATA | Not started | AI-02 | Data boundary doc. | Health/activity data needs explicit treatment. |
| AI-04 | If in scope, build structured output schemas and validate before save/show. | P0 | DATA + TC | Not started | AI-02 | Schema + validation notes. | Invalid output → retry → fallback → degraded UI, not an error wall. |
| AI-05 | If in scope, define refusal rules for thin data, unsafe requests, and tasks that need a human coach. | P0 | DATA + SEC | Not started | AI-02 | Refusal rules doc. | Confidence is not authority. |
| AI-06 | If in scope, create versioned eval suites as CI gates before expanding AI capabilities. | P0 | DATA + TC | Not started | AI-02 | Eval suite + CI notes. | Evals must cover beginners, advanced, conflicting goals, incomplete data, missed sessions, unsafe requests. |
| AI-07 | If in scope, ensure logging and workout flows work fully with AI unavailable. | P0 | TC | Not started | AI-02 | Unavailable-mode test notes. | PRD J11. |
| AI-08 | If in scope, add cost/latency/availability budgets and fallbacks. | P1 | DATA + OPS | Not started | AI-02 | Budget doc. | PRD §9. |
| AI-09 | If in scope, get domain review for technically demanding disciplines before they ship. | P1 | PM + DATA | Not started | AI-02, sport spec | Review note. | Martial arts and similar need practitioner review. |

---

## 7. Phase 6 — Data, backend, and sync

Goal: if the product needs accounts, sync, import, or payments, make those real and honest before relying on them.

| ID | Task | Priority | Owner | Status | Dependencies | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------|--------------------------|-------|
| DB-01 | Decide which backend capabilities are in scope for launch. | P0 | PM + TC | Not started | DEC-02 | Written scope. | Accounts, sync, import, entitlements, marketplace are separate decisions. |
| DB-02 | If accounts/auth are in scope, implement sign-up/sign-in with server-side authorization and secure token storage. | P0 | TC + SEC | Not started | DB-01, F-SRV-02 | Auth flow notes. | Mobile secure storage for tokens. |
| DB-03 | If sync is in scope, define conflict rules and never silently discard rejected rows. | P0 | TC + DATA | Not started | DB-01, DB-02 | Conflict doc + test notes. | Rejected rows need a "needs attention" state and export escape hatch. |
| DB-04 | If import is in scope, implement preview-before-accept, per-record rejection, and provenance preservation. | P0 | DATA + UX | Not started | DB-01 | Import flow notes. | J16. |
| DB-05 | If export/deletion are in scope, make them complete, portable, and honest about retention windows. | P0 | TC + SEC | Not started | DB-01 | Export/deletion notes. | J13. |
| DB-06 | If monetization is in scope, validate willingness to pay before building billing. | P0 | PM + MKT | Not started | DB-01 | Validation notes. | Never paywall logging, privacy, or historical data. |
| DB-07 | If marketplace/payments are in scope, plan payments, commissions, refunds, coach verification, disputes, and store-billing rules before launch. | P1 | PM + DATA + SEC | Not started | DB-06 | Plan doc. | Do not launch payments on assumptions. |

---

## 8. Phase 7 — Security, privacy, and launch operations

Goal: make the launch defensible and operable, not just feature-complete.

| ID | Task | Priority | Owner | Status | Dependencies | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------|--------------------------|-------|
| SEC-01 | Complete the privacy/terms/consent package required for launch markets. | P0 | PM + SEC | Not started | DEC-01, DEC-06 | Document set + status. | Often a launch gate, not post-launch. |
| SEC-02 | Confirm sensitive data handling is appropriate for the launch's actual data types and markets. | P0 | SEC + PM | Not started | DEC-01, DB-01 | Privacy review notes. | Health/location data needs explicit treatment. |
| SEC-03 | Confirm no secrets/credentials are in repo, logs, localStorage, or client bundles. | P0 | SEC | Not started | All | Secret scan + audit notes. | AGENTS.md rule. |
| SEC-04 | If auth/backend exist, confirm authorization, rate limits, and error handling are reviewed per endpoint. | P0 | TC + SEC | Not started | DB-02 | Endpoint review notes. | No stack/SQL leakage to clients. |
| SEC-05 | Define incident roles, rollback, and a launch-day checklist. | P0 | OPS + PM | Not started | DEC-01 | Runbook + checklist. | Even local-first apps can ship a bad build. |
| SEC-06 | Set up enough analytics/crash monitoring to triage the first week without overengineering. | P1 | OPS + DATA | Not started | DEC-01 | Monitoring notes. | Do not collect sensitive data just because it is easy. |
| SEC-07 | Brief support-facing people on what is and is not implemented. | P0 | PM + MKT | Not started | HO-01, HO-02 | Briefing notes. | Support is where honesty is tested first. |
| SEC-08 | Schedule a concrete post-launch review. | P1 | PM | Not started | DEC-01 | Review on calendar. | Makes launch a bounded event. |

---

## 9. Phase 8 — Localization and market readiness

Goal: only do this if the launch is actually multi-market.

| ID | Task | Priority | Owner | Status | Dependencies | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------|--------------------------|-------|
| LOC-01 | Confirm which locales are in scope. | P0 | PM | Not started | DEC-06 | Written locale list. | If single-market, defer this phase. |
| LOC-02 | Extract and localize the strings each in-scope screen actually shows. | P1 | UX + DATA | Not started | LOC-01 | String list + status. | Do not localize copy that does not exist yet. |
| LOC-03 | Localize locale-sensitive formatting: dates, numbers, units, pace/distance. | P1 | TC + UX | Not started | LOC-01 | Formatting notes. | Units already exist in the domain; locale may expand them. |
| LOC-04 | Adapt privacy/terms/copy per market where required. | P1 | SEC + MKT | Not started | LOC-01, SEC-01 | Market-specific doc set. | Market rules differ. |

---

## 10. Phase 9 — QA, devices, maps, and release

Goal: prove the launch candidate on the actual targets, not only in development.

| ID | Task | Priority | Owner | Status | Dependencies | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------|--------------------------|-------|
| QA-01 | Run the full test suites that the team relies on and record actual results. | P0 | TC | Not started | None | Actual suite output with numbers. | Do not weaken/skip assertions to look ready. |
| QA-02 | If GPS is in scope, test on physical devices: permission grant/deny/revoke, signal loss, background behavior, recovery. | P0 | TC + OPS | Not started | DEC-03, GPS work | Device test notes. | GPS requires physical-device testing. |
| QA-03 | If maps are in scope, verify attribution, offline degradation, and that missing coordinates never fabricate a route. | P0 | TC + UX | Not started | MAP decision, device matrix | Map acceptance notes. | The map decision doc already lists these checks. |
| QA-04 | If app-store builds are in scope, validate store assets/copy against the actual build. | P0 | MKT + UX + TC | Not started | DEC-01, mobile build | Store asset review notes. | No aspirational screenshots for the launch build. |
| QA-05 | Verify the launch journey end to end on each launch surface. | P0 | PM + TC + UX | Not started | DEC-01 | Journey verification notes/screenshots. | A successful build is not proof the feature works. |
| QA-06 | Test the highest-risk failure modes: storage failure, network loss, interruption, refresh, corrupted state. | P0 | TC | Not started | None | Failure-mode notes. | Launch day exposes the cases you tested lazily. |
| QA-07 | Final release gate review: every P0/P1 area owner confirms their area with evidence. | P0 | PM | Not started | All relevant areas | Signed area confirmations. | Launch is a decision, not a vibe. |

---

## 11. Launch gates

Do not make a public launch claim until these are true for the chosen launch surface.

| Gate | What it means | Owner | Status |
|------|---------------|-------|--------|
| G1 | The launch scope is written down and approved: what is launching, on which platforms, with which limitations. | PM | Not started |
| G2 | Every `P0` item in the chosen areas of `LMTLSS_LAUNCH_READINESS_TRACKER.md` is `Done` with evidence, or explicitly Deferred with a reason. | PM + area owners | Not started |
| G3 | Honest capability labeling is verified: no screen or copy implies a feature that is not actually available. | PM + UX | Not started |
| G4 | Data integrity and session recovery are tested for the launch surface. | TC | Not started |
| G5 | The actual test suites, device tests, and release checklist for the launch surface have been run and recorded. | TC + OPS | Not started |
| G6 | Security/privacy/consent requirements for the launch markets are met, or the launch is explicitly scoped around their absence. | SEC + PM | Not started |
| G7 | Support and internal teams know what is and is not implemented. | PM + MKT | Not started |
| G8 | There is a rollback/containment plan and a named decision maker for launch day. | OPS + PM | Not started |

---

## 12. What this plan deliberately does not assume

- It does not assume a live backend, auth, GPS, map, sharing, clubs, or AI are available unless the team marks them in scope and verifies them.
- It does not assume the mobile app is launch-ready without a real build and device verification.
- It does not assume "training the LLM" or "training the database" are single tasks; it treats them as scope decisions plus concrete implementation work.
- It does not invent a 50,000-item list by padding. If the team wants that scale, the right move is to expand a real section below into granular per-screen/per-platform/per-device/per-locale/per-failure-mode checks.

---

## 13. First concrete actions

1. Confirm `DEC-01` through `DEC-06` and write them down.
2. Run the actual web/shared/mobile/server suites and fill in the real results in `F-WEB-01`, `F-SHM-02`, and `QA-01`.
3. Pick the first vertical in `S-01` and finish it end to end before starting sharing or community work.
4. Re-audit all visible copy and screens against `HO-01` and `HO-02` before any launch marketing is finalized.
5. Assign an owner to each phase above and a backup owner for the P0 rows.
