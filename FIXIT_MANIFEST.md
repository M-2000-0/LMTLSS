# LMTLSS — Fix-It Manifest

> This is a work itemization for the current repo state, not a promise that every
> item can or should be done in one pass. It is organized by what is actually
> fixable from here, what is blocked, and what is a decision before it is a fix.

---

## 1. What "just do it" can mean here

The repo is a real artifact set:
- a static web app in `js/` + `css/` + `index.html`,
- a shared TypeScript domain layer in `shared/`,
- a scaffolded React Native app in `app/`,
- a Cloudflare Worker + D1 backend stub in `server/`,
- a bunch of planning docs in `docs/`,
- and two planning artifacts I just wrote: `LMTLSS_LAUNCH_READINESS_TRACKER.md`
  and `LAUNCH_BUILD_PLAN.md`.

"Just do it" is not one task. It is a set of independent fixes, builds, verifications,
and decisions. Some of them can be done now. Some are blocked by missing environment,
device, account, or scope decisions. This manifest separates those.

---

## 2. Fix-It Register

Each row is: problem, location, what "fixed" means, owner role, status, and whether it
can be started now.

### 2.1 Data integrity and session reliability

| ID | Problem | Location | What "fixed" means | Owner | Startable now? | Status |
|----|---------|----------|---------------------|-------|----------------|--------|
| FI-01 | Schema version bump silently discards stored data | `js/store.js` load/persist path; mirrored in `app/src/store/schema.ts` | Unknown-version payloads are preserved/migrated, never overwritten to empty without a record; corrupt payloads are quarantined | TC | Yes, code + tests | Not started |
| FI-02 | `persist()` can throw if `UI` is not ready | `js/store.js` persist path | Persistence failures are guarded and surfaced, never cause a runtime crash | TC | Yes | Not started |
| FI-03 | Active-session recovery is untested | `js/screens-train.js` session path; domain session math | Session clock math is testable and tested for refresh, pause/resume, and idle freeze | TC | Yes | Not started |

### 2.2 Honesty and capability labeling

| ID | Problem | Location | What "fixed" means | Owner | Startable now? | Status |
|----|---------|----------|---------------------|-------|----------------|--------|
| FI-04 | Some screens/integrations may imply more than they do | `js/screens-profile.js` integrations area and other screen files | Unimplemented capabilities render as "Unavailable," never as working controls | PM + UX + TC | Yes | Not started |
| FI-05 | Provenance may not be labeled everywhere it matters | `js/domain.js`, `js/screens-*` files, mobile screens | Manual distances, estimated 1RMs, and seeded rows are labeled at point of use | UX + TC | Yes | Not started |
| FI-06 | User content must not go through `innerHTML` | `js/ui.js`, any future screen code | `innerHTML` is reserved for static SVG/chart paths only; user content is text nodes or `text:` | TC + SEC | Yes | Not started |

### 2.3 Tests and verification

| ID | Problem | Location | What "fixed" means | Owner | Startable now? | Status |
|----|---------|----------|---------------------|-------|----------------|--------|
| FI-07 | Launch claims are not yet backed by a fresh full-suite run | `tests.html`, `shared/__tests__/`, `server/tests/`, `app/__tests__/` | Each suite is run now and results recorded with numbers, not assumed | TC | Partial | Not started |
| FI-08 | Some verification cannot run in this environment | device tests, real workerd/D1, store builds | Those items are recorded as blocked, not faked green | TC + OPS | No | Not started |

### 2.4 Mobile app consistency and assets

| ID | Problem | Location | What "fixed" means | Owner | Startable now? | Status |
|----|---------|----------|---------------------|-------|----------------|--------|
| FI-09 | Mobile app is scaffolded; some screens are placeholder/partial | `app/src/screens/`, `app/App.tsx`, `app/__tests__/` | Mobile surfaces are intentionally labeled for what they do and do not do; missing features are not faked | TC + UX | Partial | Not started |
| FI-10 | Asset pipeline copies exist but native consumption is not verified here | `app/assets/*`, `logo/gen-assets.js` | Assets exist at expected paths and parse correctly; native build consumption remains a device/build verification | UX + TC | Partial | Not started |

### 2.5 Backend and auth readiness

| ID | Problem | Location | What "fixed" means | Owner | Startable now? | Status |
|----|---------|----------|---------------------|-------|----------------|--------|
| FI-11 | Backend is unshipped and not wired from the UI | `server/`, `js/app.js`, mobile app | If backend is in scope, it is deployed/verified locally first; if not, that is stated explicitly | TC + DATA | Decision-gated | Not started |
| FI-12 | Auth is not available as a capability yet | `server/src/auth.js` and related routes | Auth is either configured and verified, or explicitly deferred; UI does not imply it exists | TC + SEC + DATA | Decision-gated | Not started |

### 2.6 Launch communication and stakeholder readiness

| ID | Problem | Location | What "fixed" means | Owner | Startable now? | Status |
|----|---------|----------|---------------------|-------|----------------|--------|
| FI-13 | No current one-page launch truth | planning docs / tracker | A short launch brief exists with explicit limitations | PM | Yes | Not started |
| FI-14 | Launch copy may outrun the product | marketing copy drafts, if any | All public-facing copy is audited against honest capability labeling | PM + MKT + UX | Yes | Not started |
| FI-15 | Support/ Stakeholder briefing is not current | internal comms, if any | Internal team and support-facing people know what is and is not implemented | PM + MKT | Yes | Not started |

---

## 3. Blocked items

These are real, but they cannot be executed from here until something else exists.

- Real dev build / store build verification for mobile, if that is in scope.
- Physical-device GPS and background behavior testing, if GPS is in scope.
- On-device map verification where relevant, if maps are in scope.
- Live backend deployment verification, if backend is in scope.
- Auth provider, secrets, billing, and external service setup, if those are in scope.
- Any AI feature work that has not been reduced to a concrete scoped capability with
  data boundaries, refusal rules, schemas, eval gates, and fallback behavior.

For all of those, the correct action right now is to record them as blocked with the
blocker named, not to pretend they are in motion.

---

## 4. Decisions that must come before more fixes

- Launch surface: web, mobile, backend, or staged.
- Whether backend/auth is in this launch.
- Whether GPS/maps are in this launch.
- Whether sharing/clubs/events/public profiles are in this launch.
- Whether AI is in this launch, and if so, what exactly it does.
- Which markets/languages are in scope.
- Which capabilities count as "production-ready" for this launch.

Until those are written down, the fix manifest is a collection of independent fix items
and explicit blockers, not a fully ordered build queue.

---

## 5. Suggested execution order for the startable fixes

1. Run the fresh suite sweep and record real results.
2. Do the honesty + provenance + innerHTML audit.
3. Publish the short launch truth and the "can/cannot do yet" note.
4. Finish the data-integrity and session-reliability fixes that protect user data.
5. Align mobile surfaces and assets with honest labeling.
6. Hold the launch-gate review only after the relevant evidence exists.

That order protects trust first, evidence second, then feature polish.

---

## 6. Immediate command-list version

If the team wants a literal next-hour checklist for the startable part, it looks like this:

1. Run the web suite from `tests.html` and record the result.
2. Run the shared and app suites and record the results.
3. Run the server suite and record the result.
4. Audit copy/screens for overstated capability claims.
5. Audit provenance labeling on the relevant screens.
6. Audit `innerHTML` usage for user content.
7. Write the one-page launch truth with explicit limitations.
8. Assign owners to FI-01 through FI-15 and record evidence for any "Done."

Everything beyond that is either a code fix in a specific file or a blocked/deferred item
with a named blocker.

---

## 7. What I will and will not pretend to have done

I will:
- keep this manifest tied to actual files and actual doc claims in the repo,
- treat verification as evidence-anchored, not assumed,
- leave blocked items blocked rather than faking progress.

I will not:
- claim a build, device, backend, or auth item is done without the environment or decision
  that makes that claim meaningful,
- present a generic task dump as if it were the same as executing the real repo's next work.
