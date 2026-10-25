# LMTLSS — Execution Order for the Launch Trackers

> This doc is the bridge between the planning artifacts and actual work:
>
> - `LMTLSS_LAUNCH_READINESS_TRACKER.md`
> - `LAUNCH_BUILD_PLAN.md`
>
> It does not pretend the team can do everything at once. It picks the items that
> are real to start from this repo and this environment, groups them into parallel
> tracks where they are truly independent, and makes the sequencing constraints
> explicit. Everything else is marked as a decision, blocker, or deferred item with
> a reason.

---

## 1. How to read this

- **Tracks** are only parallel when they are genuinely independent. If two items
  fight over the same artifact, the same decision, or the same review capacity,
  they are not parallel and I have not labeled them that way.
- **Owner labels** are role placeholders, not assigned names. They are there so the
  team can see who needs to be involved, not to pretend people are already committed.
- **"Can start now"** means the item has enough defined scope to begin real work from
  the current repo state. It does not mean it is complete.
- **"Blocked"** means work cannot proceed sensibly until something else is decided or
  delivered. Those items are listed with the blocker named.
- **"Deferred decision"** means the item is real, but the team has not chosen whether it
  is in this launch at all. Until that choice is made, starting detailed work is
  thrash.

---

## 2. What "everything" actually means here

The user said "lets do everything." From a planning standpoint, that is a useful
signal but a dangerous instruction if taken literally, because these two trackers
include items that:

- depend on decisions that have not been made yet (`DEC-01..DEC-06`, plus several
  `Do not launch until` gates),
- require platform or device work that cannot be verified in this environment
  (real dev builds, physical GPS testing, app-store artifacts, a live backend,
  real Cloudflare D1/workerd verification),
- require external accounts, secrets, or outside services that are not present here
  (identity provider, billing, map provider keys if the team goes that route,
  EAS/store publishing if mobile is in scope),
- are explicitly deferred by the product docs for this cycle (extra sports, public
  feed, marketplace, advanced AI, nutrition, recovery, wearables beyond the mobile
  spec, direct social-platform publishing unless an adapter is verified).

So "everything" in a useful sense means: **execute the whole tracker concept, but
only start the pieces that can actually be started, in an order that does not create
avoidable rework, and leave the rest as explicit decisions and blockers instead of
fake progress.**

The next sections are the operational version of that.

---

## 3. The work that can start now

These are the items that do not depend on a missing backend, a live device, a secret,
or an undecided launch surface. They can be carried forward in parallel because they
are independent lines of work.

- Audit and honesty work
- Foundation work on the existing web/shared/mobile code
- Test-automation and verification work
- Documentation and launch-credibility work
- Tracker maintenance and decomposition work

The next subsections break those into startable clusters.

### 3.1 Audit and honesty work

This is the highest-leverage startable work because it protects the product's trust
posture before anything else is marketed or expanded.

Independent items:
- Re-audit visible copy and screens for claims that imply unimplemented features.
- Confirm provenance labels are present where they matter.
- Confirm no screen implies a working backend, GPS, sharing, or AI feature that is
  not available.
- Confirm `innerHTML` is reserved for static icon/chart SVG and not used for user
  content.

Why these can start now:
- They are code + copy + behavior reviews.
- They do not require a live backend, device, or external account.
- They reduce the chance of shipping a launch story that outruns the product.

Sequencing note:
- These are independent of one another, but they all inform the same launch gate:
  honest capability labeling. They should be owned as a set, not as isolated one-offs.

### 3.2 Foundation work

These are the items that strengthen the existing app and shared layer before more
features are layered on top.

Independent items:
- Run the web/shared/mobile/server suites and record actual results.
- Re-confirm migration/quarantine behavior protects stored data.
- Re-confirm session recovery and idle-freeze behavior is tested.
- Re-confirm shared domain parity is intact.
- Re-confirm local-calendar-day handling is used wherever "today" matters.
- If the team wants it, add lint/typecheck/CI scaffolding for the parts that already
  have toolchains.

Why these can start now:
- They operate on existing code and existing test surfaces.
- They are not blocked by launch-surface decisions; they improve confidence whatever
  the launch surface turns out to be.

Sequencing note:
- Test runs and results should be gathered early because they become evidence for
  later launch-gate claims. Do not leave them until the end and hope they still match.

### 3.3 Verification and QA preparation

These are the items that prepare the team to test properly later, even if some of the
actual device/backend verification cannot happen in this environment.

Independent items:
- Write down the device matrix and the GPS/map/background behaviors that must be tested
  when a device and a dev build are available.
- Write the highest-risk failure-mode test list: storage failure, network loss,
  interruption, refresh, corrupted state.
- Prepare the release checklist and rollback/containment checklist as documents, even
  if they cannot be exercised end to end yet.
- Write the support/sales-facing "what is and is not implemented" brief.

Why these can start now:
- They are documentation + test design, not dependent on a live backend or device.
- They make later verification faster and less ad hoc.

Sequencing note:
- These should be ready before any launch-surface decision is turned into a public
  claim, because they shape what the team can responsibly assert.

### 3.4 Documentation and launch credibility

These are the items that make the project legible to stakeholders and avoid the common
failure mode where launch readiness is a vibe in someone's head.

Independent items:
- Publish a one-page launch brief: what is launching, on which platforms, with which
  limitations.
- Write the "what this can and cannot do yet" note.
- Prepare launch copy surfaces per channel, with a claims audit against the honesty
  items above.
- Prepare FAQ/misunderstanding handling for the most likely user questions.
- Schedule the concrete post-launch review.

Why these can start now:
- They depend on scope clarity more than on infrastructure.
- They can be drafted from the current tracker and build plan and refined as scope firms up.

Sequencing note:
- These should be reviewed against the honesty audit before anything is published.

### 3.5 Tracker maintenance and decomposition

These are the items that keep the trackers themselves honest and usable.

Independent items:
- Assign owners and backups to each area.
- Convert "Done" into "Done with evidence" by attaching verification notes.
- Break the highest-ticket items into smaller verifiable units where that adds value.
- Maintain the deferred/out-of-scope register explicitly.

Why these can start now:
- They are process work on the planners themselves.
- They prevent the trackers from becoming decorative.

Sequencing note:
- This work should happen alongside execution, not after it.

---

## 4. What cannot be started yet, and why

These are the big-ticket items the brief implicitly wants done, but they are not
meaningful to start until a decision or capability exists. I am listing them as
blocked or deferred, with the blocker named, because that is the honest way to
include them in an execution order.

### 4.1 Backend, auth, and deployment

Blocked by:
- Whether the backend is in this launch at all.
- If it is in scope, by a local Workers-compatible run and a real D1/workerd
  verification before the team can responsibly call it ready.

Until then:
- Detailed backend feature work is premature.
- Auth, sync, import, entitlements, and admin console work should be treated as
  scoped decisions first, implementation second.

### 4.2 GPS, mapping, and background recording

Blocked by:
- The device matrix and a real development build path.
- Physical-device testing for the behaviors the product docs say are mandatory,
  especially where background behavior and recovery are involved.
- For maps specifically, the adapter and provider decision is already documented as
  chosen for M2, but on-device verification is still unverified in this environment.

Until then:
- The right work now is prepare test plans, acceptance criteria, and honest screen
  framing, not pretend a full run flow is ready.

### 4.3 Sharing, clubs, events, and public profiles

Blocked by:
- Whether those surfaces are in this launch.
- If they are, by the foundation and first vertical slice being real, because the PRD
  is explicit that social/growth surfaces amplify a working training product, not
  compensate for a weak one.

Until then:
- Detailed community feature work should wait on the core loop and on the scope
  decision.

### 4.4 AI coaching, "training the LLM," and "training the database"

Blocked by:
- Whether any AI feature is actually in this launch.
- If it is, by a concrete task list with boundaries, data access rules, refusal rules,
  structured output schemas, eval gates, and cost/latency budgets.
- If it is not, by the explicit decision to defer it.

"Training the LLM" and "training the database" are not single tasks. They are
placeholder phrases. Before any work is started under those names, the team should
replace them with:
- the exact models/services involved,
- the exact data they may read or write,
- the exact user-facing capability they power,
- the exact eval and safety gates,
- the exact fallback when they are unavailable.

Until that is done, detailed AI work should not be started as if the scope were known.

### 4.5 App-store publishing, secrets, and external services

Blocked by:
- Accounts, secrets, provider configurations, and deployment settings that are not in
  this environment.
- For mobile, by the build/deployment path the team intends to use.
- For auth/backend, by the actual deployment environment and provider setup.

Until then, this is not a "go faster" item. It is a dependency cluster that has to be
provisioned and verified in the right environment.

---

## 5. Parallel tracks that are actually parallel

These are the tracks that can proceed in parallel without stepping on each other,
assuming the team has the people to own them.

### Track A — Trust and honesty
Owners: PM + UX + TC + SEC
Work:
- Honesty audit of copy and screens
- Provenance label audit
- `innerHTML`/user-content audit
- "What is and is not implemented" brief

### Track B — Foundation and verification
Owners: TC + DATA
Work:
- Real suite runs and result recording
- Migration/session/parity/date-handling re-checks
- CI/headless and lint/typecheck readiness if wanted
- Failure-mode test design

### Track C — Launch story and stakeholder readiness
Owners: PM + MKT + UX
Work:
- One-page launch brief
- "Can and cannot do yet" note
- Channel copy drafts with claims audit
- FAQ/misunderstanding brief
- Support briefing

### Track D — Tracker operations
Owners: PM
Work:
- Owner assignment
- Evidence attachment to "Done" items
- Deferred/out-of-scope register maintenance
- Decomposition of the biggest items where useful

These four tracks can run in parallel because they touch different artifacts and review
buckets. They converge at the launch-gate review, where Track B supplies evidence, Track A
supplies honesty assurance, Track C supplies the public-facing story, and Track D supplies
the status picture.

---

## 6. Sequencing constraints that are real

These are the constraints that should shape the order, even within parallel tracks.

1. Do not finalize public launch copy until Track A has audited it.
2. Do not claim launch readiness until Track B has real test results to point at.
3. Do not start AI/community/backend feature work as if scope were settled until the
   relevant scope decisions are made.
4. Do not publish a launch story that implies capabilities the team has not verified on
   the actual launch surface.
5. Do not use the trackers as decoration; every "Done" needs evidence, every "Deferred"
   needs a reason.

---

## 7. A realistic "start everything that can be started" plan

If the team really wants to move on all startable fronts now, the usable interpretation is:

- Start all four tracks above in parallel.
- Run the actual suites immediately and record results.
- Finish the honesty audit before any launch copy is finalized.
- Keep backend/GPS/map/AI/publishing work in a blocked-or-deferred state until the
  relevant decisions and environment capabilities exist.
- Hold a weekly launch-gate checkpoint where each area owner reports evidence, blockers,
  and decisions needed.

That is the honest way to "do everything" without turning the trackers into a fantasy
list or the team into a thrash machine.

---

## 8. Explicit decisions still needed before this becomes a true build queue

- Launch surface and scope: web only, mobile, backend, or staged.
- Which backends/auth are available at launch.
- Which devices/OS/network conditions are in scope.
- Whether AI is in this launch.
- Which markets/languages are in scope.
- Which launch capabilities are actually "production-ready" by the team's definition.

Until those are written down, the execution order remains a startable-work queue with
real blockers and deferred items, not a fully committed build plan.

---

## 9. Suggested owner map

This is a role map, not a commitment list. Fill in actual names after the team agrees
the scope decisions above.

- PM: launch scope, launch story, tracker ownership, area sign-off.
- TC: foundation, verification, platform feasibility, device/build questions.
- UX: honesty audit, provenance/labels, launch copy review, screen-level claims.
- SEC: privacy/terms/consent, secrets posture, authorization posture, sensitive-data
  handling.
- MKT: launch copy, channel assets, FAQ, support brief.
- OPS: release checklist, rollback, monitoring, incident response.
- DATA: backend/auth/sync/import/AI scope and implementation, once those are in scope.

---

## 10. What to do first

1. Write the scope decisions in section 8.
2. Spin up the four tracks in section 5.
3. Run the actual test suites and record real results before making any launch claim.
4. Finish the honesty audit before finalizing any public-facing launch wording.
5. Keep every blocked/deferred item named with its blocker or decision, instead of
   pretending it is already in motion.
