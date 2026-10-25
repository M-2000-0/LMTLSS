# Physical-device GPS test plan

## Scope

This plan is for **real-device validation only**. Mock location, desktop emulators, and simulated GPS are out of scope because the bugs we care about (OEM killed-state behavior, background location throttling, permission dialog timing, battery-saver behavior, system restart recovery) do not reproduce reliably anywhere else.

Two device classes minimum:

- **Android**: one mainstream device (Pixel or recent Samsung) plus one aggressive-OEM device if available (Xiaomi, Huawei, OnePlus, Oppo, Vivo) because battery/background policies differ materially.
- **iOS**: one recent iPhone, ideally on the current or previous major OS version.

Test against the build that is the actual release candidate for the store submission you are validating, not a random local dev build. Record the build identity (version code / version string, build date, exact binary or EAS build ID) next to the result row for every test.

---

## General mechanics for every test

For each scenario below, capture:

1. **Device + OS** (model, Android version / iOS version, carrier if relevant).
2. **App build** (market token if playing from Play Console internal testing, or the exact installed binary id).
3. **Location permission state before the test** (denied, approximate, precise, background allowed / not allowed, “exact” UI state on Android 13+ if applicable).
4. **GPS state before the test** (on/off, Wi-Fi only, battery saver on/off, data saver, airplane mode, reboot state).
5. **What the user did** (step-by-step, exactly).
6. **What the app recorded** (start time, end time, distance, segment coverage, any “signal lost”/quality markers, any resume gap, any saved-vs-live mismatch).
7. **What the platform did** (did the process stay alive? did background location stick? did the OS kill it? did a dialog reappear?).
8. **Pass/fail/blocker** plus a one-line root-cause hypothesis if it failed.

If a test changes device state (permission, battery saver, GPS on/off, reboot), reset to a known baseline before the next test or note the inherited state explicitly. Do not let one test’s leftover state silently contaminate the next.

---

## Baseline setup before the suite

1. Install the build fresh where possible. For Android internal testing that means installing the artifact from the Play Console track; for iOS that means the signed build you intend to submit. If you are validating a side-loadable APK, use that APK, but remember side-loaded builds are **not** the same trust boundary as a store-distributed build.
2. Turn location **on** globally.
3. Decide your permission starting point for the “happy path” tests: **precise + background allowed** on both platforms. You will change it per scenario.
4. Pick a real outdoor route with a mix of open sky and at least one partially blocked stretch (trees, buildings, underpass if safely available). A purely indoor test is its own scenario, not a substitute for the outdoor one.
5. Pre-create a known start point and end point (a loop, an out-and-back, or a straight segment with a recognizable landmark). Avoid relying on “I think I ran about 5k” — use a measured route or a second independent reference (another watch/GPS logger) when you need to validate distance/pace.
6. Agree on the definition of “recording is healthy” for this app before you start: for example, the live activity/session card stays updated, the saved session has a plausible distance and duration, segments are not all collapsed into one blob, and a foreground run and a background run of the same route produce comparable results within an acceptable tolerance.

---

## 1. Foreground outdoor run

**Goal**: the basic case works and is trustworthy before you touch any edge case.

**Steps**:
1. Start from a known point on the route.
2. Grant precise location + background location if the app asks, with the settings the app’s permission flow recommends.
3. Start the activity/session in the app.
4. Run/walk the planned route at a normal pace with the app visible or in a thumb-friendly off-screen-but-recording state the app claims to support.
5. Complete and save the session.
6. Compare recorded distance/duration against the route and, if available, the second reference logger.

**Pass criteria**:
- Session starts promptly after user action.
- Recording updates while the app is in use.
- Saved result is plausible for the route and close enough to the reference that a real user would not conclude the app is broken.
- No crash, no stuck “connecting” UI, no permanently frozen distance.

**Notes to capture**:
- Time to first position fix.
- Whether the UI showed any “GPS accuracy poor” or “signal recovering” state and whether that state was honest.
- Any battery or thermal throttling notice during the run.

**Results**:

| # | Date | Device / OS | Build | Pre-state (perm + GPS + power) | Steps | App recorded | Platform did | Result | Evidence | Hypothesis |
|---|------|-------------|-------|--------------------------------|-------|--------------|-------------|--------|----------|------------|
| 1.1 | | | | | | | | | | |

---

## 2. Locked-screen / background run

**Goal**: confirm the app keeps recording when the screen is off and the app is not the foreground task, on both platforms, with the permission model the app actually requests.

**Steps**:
1. Start the session in the app.
2. Confirm recording has begun and the first position is fixed.
3. Lock the screen or switch away so the app is no longer foreground.
4. Continue the same route for a meaningful distance — not just a minute in place.
5. Unlock or return to the app near the end and stop/save.
6. If the app exposes a background/audio/widget/complication indicator, note what it showed while locked.

**Pass criteria**:
- Recording continues while locked/backgrounded.
- Final saved result is still plausible for the route.
- The app did not silently drop to “0 distance after unlock” or fork into a second phantom session.
- On iOS specifically: if the app claims background location, the system location indicator behaves as expected and the app’s stated reason for background use matches what you actually tested.

**Failure patterns to watch for**:
- Recording stops shortly after lock.
- Recording resumes but attached to the wrong time window.
- The app reconnects and emits a giant catch-up segment that makes distance meaningless.
- The OS revokes or suspends access without the app noticing.

**Results**:

| # | Date | Device / OS | Build | Pre-state (perm + GPS + power) | Steps | App recorded | Platform did | Result | Evidence | Hypothesis |
|---|------|-------------|-------|--------------------------------|-------|--------------|-------------|--------|----------|------------|
| 2.1 | | | | | | | | | | |

---

## 3. Pause and resume

**Goal**: pause is a real, honest pause — not just “stop logging but keep the session open and pretend nothing happened.”

**Steps**:
1. Start the session on the route.
2. Pause.
3. Stand still or walk away from the route for long enough that a fake pause would be obvious.
4. Resume and continue the route.
5. Stop and save.
6. Inspect the saved session for a clean gap where pause lived, and for correct total active time vs elapsed clock time if the app exposes both.

**Pass criteria**:
- While paused, position is not counted toward distance/active time in the way the app promises.
- After resume, recording continues normally.
- The saved session reflects the pause honestly.
- Resume does not produce a duplicated or spike artifact at the join point.

**Notes to capture**:
- How long resume takes.
- Whether resuming after a long pause behaves differently from resuming after a short one.

**Results**:

| # | Date | Device / OS | Build | Pre-state (perm + GPS + power) | Steps | App recorded | Platform did | Result | Evidence | Hypothesis |
|---|------|-------------|-------|--------------------------------|-------|--------------|-------------|--------|----------|------------|
| 3.1 | | | | | | | | | | |

---

## 4. Poor GPS signal

**Goal**: the app does not lie when GPS is marginal, and it recovers gracefully when signal returns.

**Steps**:
1. Start recording in a spot with weak sky view if you have a safe one, or deliberately include the route’s blocked stretch early.
2. Watch what the app shows during degradation.
3. Move back into open sky and continue.
4. Stop and save.
5. If the app has a “GPS quality” or accuracy indicator, use it; do not invent your own.

**Pass criteria**:
- The app does not present poor-signal data as if it were clean, fixed, centimeter-accurate data.
- It recovers without corrupting the session.
- If it must estimate or wait, it says so honestly.

**Failure patterns to watch for**:
- Distance keeps accumulating while standing still in a tunnel/parking structure/heavy tree cover.
- The track becomes a starburst or zig-zag instead of a deferred-or-marked gap.
- After recovery, the app overwrites earlier good data with bad data, or vice versa, in a way that changes the final result unpredictably.

**Results**:

| # | Date | Device / OS | Build | Pre-state (perm + GPS + power) | Steps | App recorded | Platform did | Result | Evidence | Hypothesis |
|---|------|-------------|-------|--------------------------------|-------|--------------|-------------|--------|----------|------------|
| 4.1 | | | | | | | | | | |

---

## 5. Denied and approximate location permission

**Goal**: the app behaves correctly when it does not have the location it wants, and it tells the user the truth rather than silently fabricating a run.

**Steps for “denied”**:
1. Set location permission to denied for the app.
2. Try to start a GPS-based activity.
3. Observe the app’s response.

**Steps for “approximate only”** (where the platform supports it):
1. Set approximate location.
2. Try the same GPS-based activity.
3. Observe what the app can and cannot do.

**Pass criteria**:
- The app does not claim a GPS-based feature is working when it cannot have the data it needs.
- It guides the user to the real fix (open system permissions) instead of trapping them in a dead end.
- It does not fabricate distance/route/speed from nothing.

**Failure patterns to watch for**:
- The app pretends to record and produces a session that looks real but is not.
- The app crashes or loops when permissions are missing.
- The app demands the permission repeatedly in a way that feels abusive rather than functional.

**Results**:

| # | Date | Device / OS | Build | Pre-state (perm + GPS + power) | Steps | App recorded | Platform did | Result | Evidence | Hypothesis |
|---|------|-------------|-------|--------------------------------|-------|--------------|-------------|--------|----------|------------|
| 5.1 denied | | | | | | | | | | |
| 5.2 approximate | | | | | | | | | | |

---

## 6. Battery saver and power-management interference

**Goal**: learn what battery saver and platform power management do to your recording, because this is where many “it worked on my phone” stories die.

**Steps**:
1. With location and permissions set as needed, start a run.
2. Enable battery saver / low-power mode mid-activity if the platform allows it.
3. Continue for a meaningful distance.
4. Also test the reverse order: start with battery saver already on, then disable it mid-activity.
5. On Android, also try the OEM-specific “put app to sleep / restrict background / blanked-out battery settings” if the device exposes it, because that is often more aggressive than generic battery saver.

**Pass criteria**:
- The app either keeps recording or, if the platform thwarts it, notices and tells the user honestly.
- The saved session is not a half-broken artifact that looks fine at a glance but is actually missing large chunks.

**Failure patterns to watch for**:
- Background recording silently dies under battery saver.
- The app wakes up afterward and reports a nonsense catch-up.
- The OEM kills the process and the app does not recover the in-flight session properly.

**Results**:

| # | Date | Device / OS | Build | Pre-state (perm + GPS + power) | Steps | App recorded | Platform did | Result | Evidence | Hypothesis |
|---|------|-------------|-------|--------------------------------|-------|--------------|-------------|--------|----------|------------|
| 6.1 enable mid-run | | | | | | | | | | |
| 6.2 start with saver on | | | | | | | | | | |
| 6.3 OEM restriction | | | | | | | | | | |

---

## 7. Swipe-away / recent-apps dismissal

**Goal**: understand what happens when the user removes the app from the recent list, because on Android especially this can be indistinguishable from a kill from the app’s point of view.

**Steps**:
1. Start a recording.
2. Go to recents and swipe the app away.
3. Wait.
4. Reopen the app.
5. Continue or stop depending on what the app promises for this state.

**Pass criteria**:
- The app’s behavior is whatever it promises for “user dismissed us,” and it is consistent.
- If it claims to keep recording after swipe-away, that claim is actually true on the device.
- If it cannot, it does not pretend it can.

**Notes to capture**:
- Whether reopening restores the in-flight session.

**Results**:

| # | Date | Device / OS | Build | Pre-state (perm + GPS + power) | Steps | App recorded | Platform did | Result | Evidence | Hypothesis |
|---|------|-------------|-------|--------------------------------|-------|--------------|-------------|--------|----------|------------|
| 7.1 | | | | | | | | | | |

---

## 8. Reboot during an activity

**Goal**: this is rare but high-impact; a phone reboot mid-run must not turn into a completely lost or fabricated session.

**Steps**:
1. Start a recording.
2. Trigger a reboot in a safe way (not by wrecking the phone). On many devices this means a restart command or power-menu reboot; choose the normal user path for “restart phone now.”
3. Let the device come back up.
4. Reopen the app.
5. Inspect what survived.

**Pass criteria**:
- The app recovers what can honestly be recovered.
- It does not present a perfect fake session as if nothing happened.
- It does not lose the whole session silently if the platform gave it something to restore.

**Notes to capture**:
- What the device did to background location through the reboot.

**Results**:

| # | Date | Device / OS | Build | Pre-state (perm + GPS + power) | Steps | App recorded | Platform did | Result | Evidence | Hypothesis |
|---|------|-------------|-------|--------------------------------|-------|--------------|-------------|--------|----------|------------|
| 8.1 | | | | | | | | | | |

---

## 9. Force-quit and relaunch

**Goal**: force-quit is a user action with real consequences; validate both the immediate effect and the recovery path.

**Steps**:
1. Start a recording.
2. Force-quit the app via the system UI the user actually uses (recents/long-press/quit flow).
3. Reopen.
4. Decide whether to resume or start over, consistent with the app’s stated behavior.

**Pass criteria**:
- Force-quit does what the platform says it does.
- The app does not claim a running session still exists when it does not.
- If there is a recovery model, it is invoked deliberately, not accidentally.

**Results**:

| # | Date | Device / OS | Build | Pre-state (perm + GPS + power) | Steps | App recorded | Platform did | Result | Evidence | Hypothesis |
|---|------|-------------|-------|--------------------------------|-------|--------------|-------------|--------|----------|------------|
| 9.1 | | | | | | | | | | |

---

## 10. Android OEM battery behavior

**Goal**: find out whether the app survives the device the user actually has, not just the reference device.

**Steps**:
1. On the aggressive-OEM device, discover the app’s battery/background/autostart permissions in the device’s own settings UI.
2. Test recording under each of these states:
   - app unrestricted
   - app restricted in the OEM’s “background” or “sleeping” controls
   - app excluded from battery optimization if the device offers that
3. Also test the “recent apps whitelist/cleaner” behavior if the OEM has one.

**Pass criteria**:
- The app either works under the OEM policy or it detects the limitation and tells the user how to change it.
- The app does not depend on a hidden assumption that only Pixel-like behavior exists.

**Notes to capture**:
- Exact menu paths you used, because they differ by OEM and by OS rev.
- Whether the user would realistically find and change the setting based on the app’s guidance.

**Results**:

| # | Date | Device / OS | Build | Pre-state (perm + GPS + power) | Steps | App recorded | Platform did | Result | Evidence | Hypothesis |
|---|------|-------------|-------|--------------------------------|-------|--------------|-------------|--------|----------|------------|
| 10.1 unrestricted | | | | | | | | | | |
| 10.2 OEM restricted | | | | | | | | | | |
| 10.3 battery optimization excluded | | | | | | | | | | |

---

## 11. iOS background location behavior

**Goal**: validate the iOS side honestly, including the fact that background location is a permission with a purpose and Apple reviews it.

**Steps**:
1. With background location allowed, start a session and go background/locked as in test 2.
2. With background location denied but normal location allowed, repeat and confirm the app does not pretend it still has background access.
3. If the app has a backgroundmode-driven feature (audio, widget, complication, always-on display piece), test whether it remains useful or merely decorative when location access is constrained.

**Pass criteria**:
- Background behavior matches the permission model.
- The app does not claim always-on tracking unless the platform actually gave it that capability and the user granted it.
- The app’s stated reason for background location is reflected in what it actually does.

**Results**:

| # | Date | Device / OS | Build | Pre-state (perm + GPS + power) | Steps | App recorded | Platform did | Result | Evidence | Hypothesis |
|---|------|-------------|-------|--------------------------------|-------|--------------|-------------|--------|----------|------------|
| 11.1 background allowed | | | | | | | | | | |
| 11.2 background denied | | | | | | | | | | |

---

## 12. Location service state changes

**Goal**: the app reacts correctly when the user flips the global location switch during a session.

**Steps**:
1. Start recording.
2. Turn location services off globally mid-activity.
3. Turn them back on.
4. Stop and save.

**Pass criteria**:
- Honest handling of the gap.
- No permanent corruption.
- No silent assumption that GPS was always on.

**Results**:

| # | Date | Device / OS | Build | Pre-state (perm + GPS + power) | Steps | App recorded | Platform did | Result | Evidence | Hypothesis |
|---|------|-------------|-------|--------------------------------|-------|--------------|-------------|--------|----------|------------|
| 12.1 | | | | | | | | | | |

---

## 13. Indoor vs outdoor and “stationary” edge cases

**Goal**: make sure start/stop logic is not confused by being indoors, standing still, or starting with a weak fix.

**Steps**:
1. Start a session indoors with poor sky view, then move outdoors.
2. Start a session outdoors, then go indoors.
3. Start a session while essentially stationary, then begin moving.
4. For each, stop and save and inspect whether the beginning of the track is sensible.

**Pass criteria**:
- Initial poor-fix behavior is handled without inventing movement.
- Transition indoor/outdoor does not create a fake segment.

**Results**:

| # | Date | Device / OS | Build | Pre-state (perm + GPS + power) | Steps | App recorded | Platform did | Result | Evidence | Hypothesis |
|---|------|-------------|-------|--------------------------------|-------|--------------|-------------|--------|----------|------------|
| 13.1 indoor→outdoor | | | | | | | | | | |
| 13.2 outdoor→indoor | | | | | | | | | | |
| 13.3 stationary start | | | | | | | | | | |

---

## 14. Session integrity under stress

**Goal**: stress the recording path a little so the app’s “we saved it” claim is believable.

**Steps**:
1. Do a longer activity than the minimal test, with pause/resume, a poor-signal stretch, and a background/locked stretch if the app supports it.
2. Save.
3. Reload the saved session from storage and confirm it reads back the way the app claims it was recorded.

**Pass criteria**:
- The saved and reloaded session is internally consistent.
- Distance, duration, and segments are not obviously corrupted.

**Results**:

| # | Date | Device / OS | Build | Pre-state (perm + GPS + power) | Steps | App recorded | Platform did | Result | Evidence | Hypothesis |
|---|------|-------------|-------|--------------------------------|-------|--------------|-------------|--------|----------|------------|
| 14.1 | | | | | | | | | | |

---

## 15. Play Console and App Store readiness checklist for background location

Use this as a pre-submission checklist, not as a substitute for the device tests above.

### For both stores

- [ ] The app’s actual behavior matches the permission rationale you present to users.
- [ ] The app does not request background location unless a real feature needs it while the app is not in use.
- [ ] The app does not request precise location unless a real feature needs it.
- [ ] The app degrades gracefully when permission is denied or reduced to approximate.
- [ ] The app has a visible, honest explanation of what background location is used for and what the user gives up if they deny it.
- [ ] You have evidence from real devices for the claims you plan to make in store listing, onboarding, or help text.

### Play Console / Android

- [ ] The permission you declare matches the feature set. If you use foreground-only location for the main activity, do not advertise background behavior you do not have.
- [ ] If you use background location, your disclosure and in-app justification are ready for review.
- [ ] If the app targets recent Android versions, the runtime permission flow is tested on the OS versions you plan to support, including the “allow all the time” path if you need it.
- [ ] You have tested the exact permission states a reviewer or user might hit: denied, allowed while using, allowed all the time, approximate, precise.
- [ ] If your app depends on background location being “allowed all the time,” you have a clear path for the user to enable it and you have verified it on at least one device where that setting is non-trivial to find.
- [ ] You have considered whether battery optimization, OEM restrictions, and the platform’s background location limitations affect the feature you are submitting.
- [ ] Your store listing, screenshots, and description do not imply GPS capabilities the app cannot deliver on the devices and OS versions you support.

### App Store / iOS

- [ ] The Info.plist purpose string is present, specific, and matches the feature. Do not reuse a generic string if the feature is specific.
- [ ] If you use background location, the purpose string for background use is present and accurate, and the app actually uses background location only for that stated purpose.
- [ ] You have tested the permission dialog flow on device, including what the user sees when they choose “Allow Once,” “Allow While Using,” and “Don’t Allow,” and when they later change it in Settings.
- [ ] If your app offers background location, you are ready to explain that use in review if asked, with a concrete user-facing workflow.
- [ ] The app does not rely on background location for a feature that can be done with foreground location only, unless there is a real need.
- [ ] If you show a live activity, complication, widget, or other out-of-app indicator, its behavior is consistent with the permission state and the actual recording state.
- [ ] Your screenshots and marketing do not overstate background tracking on devices or OS versions where it is conditional.

---

## Reporting format

For each scenario, submit a short block like this:

- **Scenario**: one-line name.
- **Device/OS**: …
- **Build**: …
- **Pre-state**: permissions, battery saver, GPS, app fresh/relaunch/recents.
- **Steps**: numbered.
- **Result**: pass/fail/blocked.
- **Evidence**: what was recorded, what the platform did, any logs/screenshots captured.
- **Hypothesis**: one line if it failed.

Then a final row per device summarizing:

- Known regressions.
- Store-submission blockers.
- Recommended follow-ups before you call the GPS path “validated on device.”

---

## Per-device summary

Fill one block per physical device used in the run.

### Device A

- Model / OS:
- Build tested:
- Devices used for this summary:
- Scenarios tested:
- Pass / fail / blocked:
- Known regressions:
- Store-submission blockers:
- Recommended follow-ups:

### Device B

- Model / OS:
- Build tested:
- Devices used for this summary:
- Scenarios tested:
- Pass / fail / blocked:
- Known regressions:
- Store-submission blockers:
- Recommended follow-ups:

### Device C

- Model / OS:
- Build tested:
- Devices used for this summary:
- Scenarios tested:
- Pass / fail / blocked:
- Known regressions:
- Store-submission blockers:
- Recommended follow-ups:

---

## Sign-off

- **Tester**:
- **Devices used**:
- **Build(s) validated**:
- **Date**:
- **Validation statement**: I ran the scenarios above on real devices and the GPS behavior matches the app’s stated permission model and capability claims for the build under test.
- **Blockers still open**:
- **Approved to proceed to store submission review**: yes / no / only after the open items above are resolved
- **Reviewer** (if different from tester):

---

## Exit criteria

The GPS path is ready for the device-validation sign-off when:

1. Foreground outdoor run is reliable on both platforms on at least one device each.
2. Locked/background behavior matches the permission model you actually ship.
3. Pause/resume is honest and does not corrupt the session.
4. Poor signal and permission-denied states are handled without fabrication.
5. You have at least one data point for battery saver and for one aggressive OEM behavior on Android.
6. You have exercised reboot, force-quit, and swipe-away enough to know what the app recovers and what it cannot.
7. The store checklist is complete against the behavior you actually observed, not against the behavior you hoped to observe.

If any of those is missing, the GPS feature is not “tested on device” yet — it is only partly tested.
