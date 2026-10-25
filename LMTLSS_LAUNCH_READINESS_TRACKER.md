# LMTLSS — Launch Readiness Tracker

> Format: Markdown table + per-area task lists with priority and status columns.
> Owner conventions: `PM` = product manager, `TC` = tech lead, `UX` = UX/design, `SEC` = security/compliance, `MKT` = marketing/outreach, `OPS` = ops/reliability.
> Status values: `Not started`, `In progress`, `Blocked`, `In review`, `Done`, `Deferred`.
> Priority: `P0` = must be resolved before any public launch signal, `P1` = must be resolved before GA, `P2` = before scaling/marketing push, `P3` = can be scheduled after GA.
> Scope anchor: this tracker reflects the actual LMTLSS repo state as of the audit/PRD/mobile-spec in `docs/`, not a generic launch template. Tasks that cannot be verified against the existing codebase are explicitly marked as assumptions to confirm.

---

## How to use this list

1. Treat `P0` rows as gating — a `P0` item marked `Done` must have a verification note attached (test, screenshot, deployment check, or explicit manual confirmation).
2. Do not promote an area to "launchable" while any `P0`/`P1` row in that area is still `Not started` or `Blocked`.
3. When an item is marked `Done`, record the evidence inline in the `Verification / evidence` column so a reviewer can re-check it without re-deriving the work.
4. Items marked `Deferred` must carry a reason and, where possible, a time boundary.
5. This list is intended to be filtered by status, priority, and owner. In markdown, that means scrolling by section; if the team adopts a dedicated tool later, the column structure here is meant to map cleanly into it.

---

## Scale note

The brief asked for a list large enough to "cover 50,000 actionable items." For a real tracker, the honest way to think about that number is as a decomposition target, not a fill-in-the-blank row count. A 50k-row tracker is usually the output of taking a validated scope and breaking it into tiny verifiable units per feature, per platform, per locale, per environmental condition, per user segment. This document starts from LMTLSS's current scope and gives that decomposition a real structure so it can grow into that scale without turning into padding. If the team later needs literal numeric scale, the preferred move is to expand the breakdown per real feature, not invent generic items.

---

## 0. Scope and assumptions to confirm before treating this list as current

These are not tasks yet; they are the decisions on which the rest of the list depends.

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| S-01 | Confirm what "launch" means for LMTLSS right now: web app only, iOS/Android build, backend deployment, all three, or a staged sequence. | P0 | PM | Not started | Written decision in `docs/` or pinned team note. | The repo has an unshipped backend stub, a web app, and a mobile app in progress. The launch definition changes which rows are relevant. |
| S-02 | Confirm what backends are actually available at launch time. Today `server/` is a dependency-free Cloudflare Worker + D1 with no live deployment and no network calls from the web app. | P0 | TC | Not started | Confirmation of which environment is live, if any. | AGENTS.md states a configured backend is not an available capability yet. Do not market or UI-label a backend as available until it is. |
| S-03 | Confirm the honest "not implemented yet" surface from the audit and keep marketing/UI from promising those capabilities. | P0 | PM + UX | Not started | Cross-check against `docs/AUDIT-REPORT.md` and the Integrations section in `js/screens-profile.js`. | Honesty is a product invariant here, not a nice-to-have. |
| S-04 | Confirm which devices, OS versions, and network conditions the launch should support on mobile. | P0 | TC | Not started | Written support matrix. | Affects testing scope and the "platforms" rows below. |
| S-05 | Confirm the launch markets/languages and whether localization is in scope. | P1 | PM | Not started | Written decision. | If localization is in scope, it creates many small per-string/per-screen tasks. |

Assumption rule used throughout this document: if a task depends on a capability the repo does not currently show as available, the task is either deferred with a reason or marked as "verify first" rather than assumed done.

---

## 1. Product scope and launch definition

### 1.1 Launch scope

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| SC-01 | Publish a one-page launch brief: what is launching, on which platforms, to which audience, with which limitations clearly listed. | P0 | PM | Not started | Shared doc linked from team channel and repo. | Prevents stakeholders from inferring more than the product does. |
| SC-02 | Define the minimum launch feature set per platform: web, iOS, Android, backend if applicable. | P0 | PM + TC | Not started | Signed-off list. | Must match what the app can actually do, not what the roadmap hopes to ship. |
| SC-03 | Identify launch feature gaps and decide whether each is out of scope, deferred, or must be completed first. | P0 | PM + TC | Not started | Gap list with decision per gap. | AGENTS.md already scopes the web app as static, mobile as M0, backend as unshipped. Use that. |
| SC-04 | Freeze the feature set for launch N, with a clear cut line and a separate backlog for post-launch items. | P0 | PM | Not started | Frozen list + separate backlog. | Avoids "just one more thing" creeping into launch. |
| SC-05 | Decide whether demo/seed data is shown to new users at launch and under what conditions. | P0 | PM | Not started | Decision documented; any seeded data kept in `Store.seedDemo` only with `provenance: "manual"` / `seeded: true` and user-visible labeling. | AEXT.9 rule from AGENTS.md. |
| SC-06 | Confirm whether onboarding generates a plan and whether that path is ready to be the default first-time journey. | P0 | PM + TC | Not started | Verified onboarding → Today journey with persisted JSON. | The repo already has a rendered onboarding → Today journey test; confirm it is the intended launch flow. |

### 1.2 Current-state honesty

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| HO-01 | Audit every public-facing statement about capability and mark unimplemented ones as unavailable, not working. | P0 | PM + UX | Not started | UI and copy pass a "does this imply a working feature we do not have?" check. | Required by the product honesty invariant. |
| HO-02 | Confirm no screen implies a live backend when none is available. | P0 | PM + UX | Not started | Manual walk of screens; network requests verified absent where they should be absent. | Do not add loading spinners, sync labels, or cloud badges unless the capability exists. |
| HO-03 | Confirm provenance labels appear at point of use for manual distances, estimated 1RMs, and seeded rows. | P0 | UX | Not started | Screenshots or verification notes per case. | Manual distances: "manually entered (no GPS connected)". Estimated 1RMs: "estimated (Epley)". Seeded rows: labeled demo. |
| HO-04 | Confirm metrics and goals shown to users are explained at the point of use, not just in a docs folder. | P1 | UX | Not started | Per-screen check. | Users should not rely on doc archaeology to understand numbers they see. |

---

## 2. Web app (`index.html` + `css/` + `js/` + `logo/`)

The web app is the on-ramp in this repo. It is static, local-first, and currently makes no network calls to a live backend.

### 2.1 Landing page and first impression

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| WEB-01 | Define the landing page's single primary action and remove competing calls to action before launch. | P0 | PM + UX | Not started | One primary CTA per screen/state. | A landing page with too many primary actions is a conversion leak. |
| WEB-02 | Make the value proposition legible in the first viewport without requiring scroll or explanation from another human. | P0 | UX | Not started | Fresh-person read test; screenshot of first viewport. | Not "make it pretty"; make it understandable. |
| WEB-03 | Confirm the hero/landing visual uses the current logo master and derivatives, not an old stopgap asset. | P0 | UX | Not started | Asset audit against `logo/README.md` and actual render. | The repo still has an old `logo/image-removebg-preview.png` on disk; verify no live path still leans on it. |
| WEB-04 | Verify logo placement/clear-space rules are consistent across Home, Progress, and Profile headers. | P1 | UX | Not started | Visual check against `css/app.css` `.screen-head` rules. | Rules already exist in CSS; confirm they are actually followed. |
| WEB-05 | Confirm share cards embed the intended logo and that the inline SVG and PNG fallback both exist and render. | P1 | UX + TC | Not started | Open share card in browser; inspect rendered logo. | The repo has `js/sharecards.js` and `logo/lmtlss-sharecard-embed.{svg,png}`. |
| WEB-06 | Check that landing copy does not imply AI/LLM/backend features the product does not have. | P0 | PM + UX | Not started | Copy pass. | Even if the roadmap includes AI later, the launch page must not claim it now. |
| WEB-07 | Check accessibility of the landing experience: focus order, labels, color contrast, keyboard operability. | P1 | UX | Not started | Accessibility check with notes. | Qualitative; record what was checked. |
| WEB-08 | Ensure any animated hero or interactive element does not block the primary action or become unusable on low-end devices. | P2 | UX | Not started | Test on a low-end device or emulated slow CPU. | If there is no animation, this row can be removed. |

### 2.2 Onboarding and first-run

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| WEB-09 | Verify onboarding flow end-to-end on the web: start, inputs, generated plan, and arrival on Today. | P0 | TC + UX | Not started | Manual walkthrough + existing suite coverage. | AGENTS.md mentions an onboarding → Today journey that asserts persisted JSON; confirm it reflects the intended launch flow. |
| WEB-10 | Confirm the onboarding-generated plan is stored and survives a page reload. | P0 | TC | Not started | Reload test with inspection of persisted state. | Local-first persistence must hold across refresh. |
| WEB-11 | Verify that `activeSession` in-flight state is preserved as intended and that the idle-freeze behavior is still in place. | P0 | TC | Not started | Session lifecycle test notes. | AGENTS.md explicitly says not to remove the >10 min idle freeze protection. |
| WEB-12 | Confirm first-run does not discard existing user data without confirmation. | P0 | TC + UX | Not started | Delete/reset path check. | AGENTS.md requires `UI.confirmSheet` for deletes and no silent discard. |
| WEB-13 | Test onboarding with empty state, partially completed state, and interrupted state. | P1 | TC | Not started | Test matrix notes. | Edge cases around interruptions matter for a first-time user. |
| WEB-14 | Confirm onboarding does not prompt for backend accounts/connections unless the backend is actually ready. | P0 | PM + TC | Not started | Screens and prompts audit. | If there is no live backend, do not ask users to connect to it. |

### 2.3 Core screens and navigation

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| WEB-15 | Walk every reachable screen and confirm it renders and does not crash from a cold open. | P0 | TC | Not started | Screen list + pass/fail notes. | At minimum: Home, Train, Progress, Profile, Onboarding. |
| WEB-16 | Confirm navigation state is predictable: back, forward, refresh, and deep revisit each behave sensibly. | P1 | TC | Not started | Navigation test notes. | AGENTS.md script order and module dependencies matter here. |
| WEB-17 | Confirm data integrity for logged activities: no silent overwrite, no data loss on refresh, no accidental reset of unknown schema versions without migration. | P0 | TC + PM | Not started | Persistence tests + migration/quarantine check. | AGENTS.md: do not bump `SCHEMA_VERSION` without a migration; store currently resets unknown versions to empty state. |
| WEB-18 | Verify that manual entries and GPS-derived entries are distinguishable where the UI shows them. | P1 | UX | Not started | Per-screen provenance check. | Users must not confuse a manual distance with a GPS-tracked one. |
| WEB-19 | Confirm each screen degrades gracefully when relevant state is missing or partial. | P1 | TC + UX | Not started | Empty/partial-state screenshots or notes. | "Nothing to show yet" states exist in some screens; confirm they are truly helpful. |
| WEB-20 | Verify there is no `innerHTML` usage with user-supplied content anywhere in the web app. | P0 | TC + SEC | Not started | Code audit for `innerHTML` and `html:` usage. | AGENTS.md reserves `innerHTML` for static icon/chart SVG paths only. |
| WEB-21 | Check iOS Safari, Chrome, and a relevant Android browser for layout/behavior differences. | P1 | UX + TC | Not started | Per-browser notes. | Local-first web apps still live in browsers with quirks. |

### 2.4 Performance and reliability on the web

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| WEB-22 | Measure first-load experience on a throttled/low-bandwidth connection. | P1 | TC | Not started | Timings + notes under throttling. | The app is static, but that does not make it immune to slow networks. |
| WEB-23 | Confirm storage and persistence failures surface visibly and do not silently swallow errors. | P0 | TC | Not started | Forced failure test if feasible; code audit otherwise. | AGENTS.md: `persist()` failures should toast, and `store.js` must guard against `UI` being unavailable. |
| WEB-24 | Confirm there are no console errors during a normal first-run and core journey. | P0 | TC | Not started | Clean console logs from a representative journey. | A launch page should not ship with console noise. |

---

## 3. Mobile app (`app/` — Expo + React Native, TypeScript strict)

Mobile is in progress (M0). This section assumes the team may want one or both store builds ready around launch; if not, the relevant rows should be deferred with a reason.

### 3.1 Build, tooling, and packages

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| MOB-01 | Confirm Expo tooling and SDK version are what the team intends for launch. | P0 | TC | Not started | `app/app.json` and `app/package.json` reviewed and confirmed. | Do not guess SDK/goals; confirm. |
| MOB-02 | Confirm native asset packing is correct: app icon, favicon, logo, Android adaptive-icon foreground at the paths Expo reads by default. | P0 | UX + TC | Not started | Asset existence + metadata verification at `app/assets/*`. | The repo already places these; consumption by a real native build is the unverified part. |
| MOB-03 | Run a native build path for the target platform(s) and confirm the app starts from the built artifact, not just from dev mode. | P0 | TC | Not started | Built artifact launch notes or screenshots. | A dev-server render is not the same as a store-bound build. |
| MOB-04 | Confirm Expo prebuild/config is what the team wants for deployment, if any. | P1 | TC | Not started | Configuration decision noted. | If the team is not using prebuild, say so explicitly. |
| MOB-05 | Verify Metro/bundling treats the domain layer as shared and portable as intended. | P1 | TC | Not started | Build/bundle notes + shared module check. | The repo has a `shared/` pure TS domain layer that is meant to be portable. |

### 3.2 Mobile UX and screens

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| MOB-06 | Confirm the mobile first-run journey mirrors the intended onboarding → Today path and is coherent with web where they share scope. | P0 | UX + PM | Not started | Rendered journey test with persisted JSON. | The repo already has an onboarding → Today test asserting persisted JSON. |
| MOB-07 | Confirm mobile screens do not imply backend features that are not available. | P0 | PM + UX | Not started | Screen copy/behavior check. | Same honesty invariant as web. |
| MOB-08 | Verify running/tracking screens on mobile match the intended behavior and error states. | P0 | TC + UX | Not started | Screen-level verification notes. | There is active work on GPS/run tracking in the repo; confirm what is launch-ready versus not. |
| MOB-09 | Check mobile accessibility: labels, focus, readable sizing, and touch targets. | P1 | UX | Not started | Accessibility notes. | Mobile accessibility is not optional if the app is public-facing. |
| MOB-10 | Test viewports, orientations, and safe areas the app claims to support. | P1 | UX + TC | Not started | Per-device/orientation notes. | Depends on S-04 support matrix. |

### 3.3 Mobile storage and platform seams

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| MOB-11 | Verify the storage adapter round-trips data correctly. | P0 | TC | Not started | Storage adapter test notes. | The repo references an AsyncStorage adapter test with round-trip and failure surfacing. |
| MOB-12 | Verify failure paths on mobile storage surface appropriately rather than failing silently. | P0 | TC | Not started | Failure-mode test notes. | Matches the web persistence-failure expectation. |
| MOB-13 | Confirm the platform date/time handling uses the athlete's local calendar day, not UTC roll-over slicing. | P0 | TC | Not started | Date boundary tests. | AGENTS.md: "today" is local; never slice `toISOString()` for a day boundary. |
| MOB-14 | Confirm location/GPS behavior, permissions, and failure states are handled explicitly on mobile. | P0 | TC + UX | Not started | Permission + failure notes. | Important if tracking is part of launch scope. |

---

## 4. Shared domain layer (`shared/`) and JS domain parity

The repo treats `js/domain.js` and `shared/src/domain.ts` as a pair that must stay in sync. This is a common source of silent drift.

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| DOM-01 | Confirm any change made to `js/domain.js` is mirrored in `shared/src/domain.ts`, or vice versa. | P0 | TC | Not started | Parity check after any domain change. | AGENTS.md rule; drift test fails on public-API drift. |
| DOM-02 | Run the domain parity test before launch and after any domain change. | P0 | TC | Not started | Parity test result. | The repo has a parity test guarding the JS/TS boundary. |
| DOM-03 | Confirm the domain layer remains pure logic with no DOM or localStorage dependence. | P0 | TC | Not started | Code audit of `shared/src/domain.ts` and `js/domain.js`. | Portability to the mobile domain layer depends on this. |
| DOM-04 | Re-run the shared/Wed suite and confirm the baseline the team currently relies on still holds. | P0 | TC | Not started | Suite result with actual numbers. | AGENTS.md records a browser baseline and a shared Jest baseline; confirm current state rather than quoting old numbers. |
| DOM-05 | Re-run the mobile shared tests and confirm they still pass. | P0 | TC | Not started | Test result with actual numbers. | AGENTS.md records a mobile shared baseline; confirm current state. |

---

## 5. Backend and data (`server/` + D1)

Status in the repo: backend is a dependency-free Cloudflare Worker + D1 (SQLite) stub with its own tests, not deployed, and the web app does not yet call it.

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| BE-01 | Decide whether the backend is in scope for this launch at all. | P0 | PM + TC | Not started | Written decision. | If it is not in scope, most backend rows below are Deferred with that reason. |
| BE-02 | If backend is in scope, deploy and run `wrangler dev --local` or equivalent workerd-based verification before calling it ready. | P0 | TC | Not started | Local workerd run notes. | AGENTS.md: no test has run on real Cloudflare D1 or in workerd yet; treat the deployed runtime as unverified until that happens. |
| BE-03 | If backend is in scope, verify the D1 schema migration path and data integrity rules. | P0 | TC + SEC | Not started | Migration + integrity notes. | Do not start from an untested migration story. |
| BE-04 | If backend is in scope, authorize every private endpoint server-side and scope data by user. | P0 | TC + SEC | Not started | Authorization review notes. | Never rely on client-supplied IDs or email for ownership. |
| BE-05 | If backend is in scope, confirm secrets/keys stay server-side and never appear in repo, logs, browser storage, or assets. | P0 | SEC | Not started | Secret audit. | AGENTS.md: no secrets, keys, or tokens in repo/logs/localStorage. |
| BE-06 | If backend is in scope, define what the web or mobile app is allowed to assume about availability and handle outage states honestly. | P1 | PM + TC | Not started | Availability assumptions documented. | Do not UI-label a backend as available until it is. |
| BE-07 | If backend is in scope, test sign-in/session/sign-out flows if auth is involved. | P1 | TC + SEC | Not started | Auth flow test notes. | If auth is enabled via Freebuff, follow the platform auth guidance for the actual site. |

---

## 6. Data integrity, migrations, and storage safety

This area is high-leverage and high-risk because it directly affects user trust.

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| DI-01 | Confirm current schema version handling and whether any schema change needs a migration before launch. | P0 | TC | Not started | Schema/migration audit notes. | AGENTS.md: never change `SCHEMA_VERSION` without a migration; store resets unknown versions to empty state. |
| DI-02 | Verify that user data is not silently discarded or overwritten by any launch-path code. | P0 | TC + PM | Not started | Data-loss scenario review. | Highest priority from AGENTS.md. |
| DI-03 | Confirm seeded/demo data is confined to the intended seed path and labeled to the user. | P0 | PM + TC | Not started | Seed path audit + UI labels. | `Store.seedDemo` only, `provenance: "manual"` / `seeded: true`, demo labeling. |
| DI-04 | Confirm in-flight `activeSession` is preserved across refresh as intended. | P0 | TC | Not started | Refresh test notes. | AGENTS.md explicitly protects this. |
| DI-05 | Confirm persistence failures are surfaced and that store code can run safely if `UI` is unavailable. | P0 | TC | Not started | Failure/audit notes. | AGENTS.md guard rule. |
| DI-06 | Confirm delete paths require explicit confirmation and are not hidden. | P0 | UX + TC | Not started | Delete-flow check. | AGENTS.md: `UI.confirmSheet` for deletes. |
| DI-07 | If a migration is added, verify upgrade and rollback behavior on realistic data. | P1 | TC | Not started | Migration test notes. | Not theoretical — old data matters. |

---

## 7. Security, privacy, and compliance

This is a launch-readiness area, not an afterthought. The repo's AGENTS.md is explicit about local-only data and no secrets today.

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| SEC-01 | Confirm no secrets, keys, tokens, or credentials are present in repo, logs, localStorage, or assets. | P0 | SEC | Not started | Secret scan + manual audit notes. | AGENTS.md rule. |
| SEC-02 | Confirm user content is rendered as text nodes / `text:` only, with no `innerHTML` from user input. | P0 | TC + SEC | Not started | Code audit. | AGENTS.md rule; `innerHTML` reserved for static SVG paths. |
| SEC-03 | If a backend or auth is enabled, enforce authorization server-side on every private endpoint. | P0 | TC + SEC | Not started | Endpoint-by-endpoint authorization review. | Do not trust client-supplied identity or ownership. |
| SEC-04 | Confirm sensitive health/location data is not stored in plaintext where that would be inappropriate for the launch's legal context. | P0 | SEC + PM | Not started | Storage/privacy review notes. | Depends on launch markets and data types. |
| SEC-05 | Determine what privacy policy, terms, and consent language are required for launch markets. | P0 | PM + SEC | Not started | Document list + status. | This is often a launch gate, not a post-launch nice-to-have. |
| SEC-06 | If the product handles health, fitness, GPS, or personal data, confirm it does not make unsupported claims about what it does with that data. | P0 | PM + SEC | Not started | Claims audit. | Honesty extends to data handling claims. |
| SEC-07 | Confirm platform-specific store/app policies relevant to launch are understood and addressed. | P1 | PM + TC | Not started | Policy checklist notes. | App stores and hosting providers have their own rules. |

---

## 8. AI, LLM, and data-related work

The prompt asks about "training our LLM and databases." For LMTLSS as it currently exists in this repo, that is not an obviously available capability. The honest treatment is to turn that into concrete decisions and tasks rather than assume a generic AI pipeline.

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| AI-01 | Decide whether the product actually ships any LLM/AI feature at launch, and if so, which exact user-facing capability it is. | P0 | PM + TC | Not started | Written decision. | If the answer is "none at launch," many AI rows below become Deferred with that reason. |
| AI-02 | If an AI feature is in scope, define its inputs, outputs, failure modes, and on-device vs server split precisely. | P0 | TC + PM | Not started | Feature spec with boundaries. | Vague AI scope creates vague tasks; this row is meant to prevent that. |
| AI-03 | If an AI feature is in scope, verify what data it may read or write and ensure that is protected appropriately. | P0 | SEC + TC | Not started | Data boundary review. | Health/activity data deserves explicit treatment. |
| AI-04 | If an AI feature is in scope, design the honest UI framing so the product does not overclaim. | P0 | UX + PM | Not started | Copy/UI review notes. | Matches the honesty invariant. |
| AI-05 | If an AI feature is in scope, define evaluation criteria and a way to know whether it is good enough to launch. | P0 | PM + TC | Not started | Eval criteria documented. | "Trained" is not a launch criterion by itself. |
| AI-06 | If any "database training" phrasing refers to preparing real data, define what data is involved, where it comes from, and what consent/privacy applies. | P0 | PM + SEC | Not started | Data sourcing review. | Do not treat "training the database" as a magical task; make it concrete. |
| AI-07 | If no AI feature is in scope, remove or defer all AI-related launch tasks and make that explicit for stakeholders. | P0 | PM | Not started | Deferred/AIX rows marked with reason. | Reducing scope deliberately is a valid and useful launch decision. |

---

## 9. Marketing, outreach, and launch communications

This area should reflect what the product can actually do. If the product is local-first and backend-less at launch, marketing should say that clearly rather than imply cloud/AI/sync capabilities.

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| MKT-01 | Write a launch narrative that matches the actual launch scope and limitations. | P0 | PM + MKT | Not started | Draft approved by PM and TC. | The launch story must not outrun the product. |
| MKT-02 | Define the primary audience and the one problem the launch page/announcement leads with. | P0 | PM + MKT | Not started | Audience + message doc. | One clear message beats five clever ones. |
| MKT-03 | Prepare launch copy for each surface that will run it: landing page, app store listing if applicable, social posts, email if any. | P0 | MKT + UX | Not started | Copy set per surface. | Each surface needs its own length and policy constraints. |
| MKT-04 | Audit all launch copy for claims that imply unimplemented features. | P0 | PM + MKT | Not started | Claims audit against SC/HO rows. | This is where marketing usually breaks the honesty invariant. |
| MKT-05 | Prepare a short "what this can and cannot do yet" note for launch day. | P1 | PM + MKT | Not started | Public-facing note. | Being explicit up front reduces trust damage later. |
| MKT-06 | Decide launch channel mix and what "success" means for launch communications. | P1 | MKT | Not started | Channel plan + success metrics. | Be specific about what is being measured. |
| MKT-07 | Prepare support/faq materials for the most likely user questions and misunderstandings. | P1 | PM + MKT | Not started | FAQ draft. | Especially important if the product has limitations at launch. |
| MKT-08 | If app store listings are involved, prepare screenshots, descriptions, and assets that are accurate to the build. | P1 | MKT + UX | Not started | Asset + copy review. | Do not use aspirational screenshots for a launch build. |

---

## 10. Analytics, monitoring, and feedback loops

Even a local-first launch benefits from knowing what users experience and where they get stuck.

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| AN-01 | Decide what the team needs to observe at launch and what must not be collected. | P0 | PM + TC | Not started | Observation plan with privacy review. | Do not collect sensitive data just because instrumentation is easy. |
| AN-02 | If any telemetry is added, ensure it does not leak secrets, tokens, or sensitive health/location data. | P0 | SEC + TC | Not started | Telemetry audit notes. | AGENTS.md data rules apply here too. |
| AN-03 | Add enough instrumentation to answer the first-week questions without building a full observability platform first. | P1 | TC + PM | Not started | Minimal instrumentation set. | Start with the questions, not the tooling. |
| AN-04 | Define how the team will receive and triage user reports and bug reports at launch. | P0 | PM + TC | Not started | Triage process documented. | A launch without a feedback loop is an accident while it happens. |
| AN-05 | Decide how crashes or persistent failures are reported and who gets alerted. | P1 | TC + OPS | Not started | Alerting/repro notes. | Depends on launch scale and platform. |

---

## 11. Testing, verification, and release gates

The repo already has a strong test culture and explicit baselines. Do not weaken or skip them to make the release feel ready.

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| TST-01 | Run the web browser test suite and record the actual result, not an assumed one. | P0 | TC | Not started | Actual suite result with numbers. | AGENTS.md warns not to claim a test passed unless actually executed. |
| TST-02 | Run the shared/Wed/mobile test suites that the team relies on and record actual results. | P0 | TC | Not started | Actual suite results. | Same rule: report untested paths as untested. |
| TST-03 | Re-run any suite after meaningful changes rather than trusting a previous green run. | P0 | TC | Not started | Post-change run notes. | Earlier passes do not cover later edits. |
| TST-04 | Confirm the launch candidate is verified through the actual user journey, not only the build/exit code. | P0 | PM + TC + UX | Not started | Journey verification notes/screenshots. | AGENTS.md: a successful build is not proof the feature works. |
| TST-05 | Test the highest-risk flows in realistic conditions: network interruptions, low storage, interruptions, refresh, permissions denied, etc. | P0 | TC + UX | Not started | Edge-case notes. | Launch day tends to expose the cases you tested lazily. |
| TST-06 | Confirm no launch task is marked done based on a skipped or weakened assertion. | P0 | TC | Not started | Assertion integrity check. | AGENTS.md rule. |
| TST-07 | If any check genuinely cannot run because the toolchain is unavailable, record it as not run rather than passed. | P0 | TC | Not started | "Not run" notes where applicable. | Honesty in verification, not just product behavior. |

---

## 12. Team readiness, support, and launch operations

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| OPS-01 | Assign an owner for each area above before launch, with a backup owner where relevant. | P0 | PM | Not started | Owner assignment visible in this tracker. | Unowned launch tasks are orphaned launch tasks. |
| OPS-02 | Define launch roles: who can halt launch, who signs off each area, who responds to incidents. | P0 | PM | Not started | Role list. | Launch without a decision maker is a slow decision. |
| OPS-03 | Prepare a launch-day checklist and a rollback/containment plan if something goes wrong. | P0 | TC + OPS | Not started | Checklist + rollback notes. | Even local-first apps can ship a bad build. |
| OPS-04 | Make sure the team can reproduce and diagnose the most likely failure modes quickly. | P1 | TC | Not started | Runbook notes. | "We think it is fixed" is not enough at launch. |
| OPS-05 | Confirm the team has a way to communicate status internally during launch day without relying on ad hoc chat. | P1 | PM + OPS | Not started | Comms plan. | Launch day gets noisy; structure helps. |
| OPS-06 | Brief support-facing people on what is and is not implemented so they do not overpromise. | P0 | PM + MKT | Not started | Briefing notes. | Support is where honesty is tested first. |
| OPS-07 | Schedule a post-launch review at a concrete time, not vaguely "later." | P1 | PM | Not started | Review on calendar. | Makes launch a bounded event, not a mood. |

---

## 13. Deferred and out-of-scope items to manage explicitly

Launch readiness is partly about saying what is not happening now.

| ID | Task | Priority | Owner | Status | Verification / evidence | Notes |
|----|------|----------|-------|--------|--------------------------|-------|
| DF-01 | Document backend deployment as Deferred if it is not in this launch. | P0 if in scope, else Deferred | PM + TC | Not started | Decision + reason. | Prevents stakeholders from assuming the backend launch when it is not happening. |
| DF-02 | Document any AI/LLM feature as Deferred if it is not in this launch. | P0 if in scope, else Deferred | PM + TC | Not started | Decision + reason. | Keeps "training our LLM" from becoming a vague pressure item. |
| DF-03 | Document localization, advanced analytics, and scale-out work as Deferred if not required for launch. | P1/P2 | PM | Not started | Decision + reason. | Explicit deferral is better than silent scope creep. |
| DF-04 | Document any feature that is "almost ready" but not actually launch-ready, and remove it from launch promises. | P0 | PM + TC | Not started | Deferred list. | "Almost" is not a launch state. |

---

## Completion status tracking mechanism

Use the `Status` column per row, plus a per-area gate at the bottom of each section.

Area gate rule:
- An area is **not launch-ready** if any `P0` or `P1` row in it is `Not started`, `Blocked`, or `In progress` without a clear path to done.
- An area may be **conditionally launch-ready** if all `P0` rows are `Done` with evidence and remaining items are `P2`/`P3` or `Deferred` with reasons.
- An area is **launch-ready for launch** only when the PM and the relevant lead both agree and the evidence column supports it.

Suggested roll-up columns for a summary view:

| Area | P0 remaining | P1 remaining | Area status | Launch-ready? |
|------|--------------|--------------|-------------|---------------|
| 0. Scope/assumptions |  |  |  | No by default until S-01..S-05 clarified |
| 1. Product scope/launch definition |  |  |  |  |
| 2. Web app |  |  |  |  |
| 3. Mobile app |  |  |  |  |
| 4. Shared domain/parity |  |  |  |  |
| 5. Backend/data |  |  |  |  |
| 6. Data integrity/migrations |  |  |  |  |
| 7. Security/privacy/compliance |  |  |  |  |
| 8. AI/LLM/data work |  |  |  |  |
| 9. Marketing/outreach |  |  |  |  |
| 10. Analytics/monitoring/feedback |  |  |  |  |
| 11. Testing/release gates |  |  |  |  |
| 12. Team readiness/ops |  |  |  |  |
| 13. Deferred/out-of-scope |  |  |  |  |

The honest way to reach "50,000 items" scale, if the team ever needs it, is to decompose each `P0` row above into its real checklists: per screen, per platform, per locale, per browser, per device class, per permission state, per failure mode, per data shape, per supported OS version, per store listing asset, per copy surface, per integration, per rollout segment. That decomposition should be driven by the actual product, not by padding this table. If you want, I can expand any one section below into that kind of granular sub-checklist.

---

## Immediate next actions

1. Confirm S-01 through S-05 so the tracker reflects what is actually launching.
2. Pick one area owner to own status updates for each section above.
3. Run the actual test suites and fill in the real results in TST-01..TST-07 before using this list to declare readiness.
4. Revisit HO-01 and HO-02 before any launch copy or public-facing wording is finalized.
