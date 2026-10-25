# RunScreen foreground tracking skeleton — delivery report

## What changed

- Added a new foreground run/tracking screen: `app/src/screens/RunScreen.tsx`.
- Added a local route/buffer contract: `app/src/services/runBuffer.ts` for in-memory route capture, distance accumulation, rolling pace, paused-state clock handling, and structured export for later persistence/upload/route rendering.
- Added a tiny time helper: `app/src/utils/clock.ts` for elapsed-time formatting and a stopped-clock invariant under pause.

## Files changed

- `app/src/screens/RunScreen.tsx` (new)
- `app/src/services/runBuffer.ts` (new)
- `app/src/utils/clock.ts` (new)
- `GPS_RUN_SCREEN_DELIVERY_REPORT.md` (new)

## What the screen does

- Foreground-first: uses `Location.hasPermission()` and `Location.requestForegroundPermissionsAsync()` before starting.
- Starts foreground position watching with `Location.watchPositionAsync()` using a conservative accuracy/distance/time policy.
- Shows:
  - live elapsed time,
  - live distance (meters and km),
  - rolling pace (pace per km, when pace is meaningful),
  - current location accuracy as an honesty signal,
  - manual pause/resume toggle,
  - start/stop control.
- Maintains a local route buffer contract via `runBuffer.ts` so the captured points, distance, and time state are in one place and can be persisted/uploaded/rendered later.
- Is honest about gaps: map rendering, splits, finish summary, and background recovery are not part of this skeleton.

## Architecture notes

- The screen owns the foreground recording lifecycle. `runBuffer` is the contract for route state, not a second UI state shape.
- Pause/resume is implemented as “stop counting time and location contribution while paused,” not as a background handoff. This is intentional for a foreground-first skeleton.
- Distance and pace are computed from the captured points and timestamps in `runBuffer`, with the usual caveats: very short runs or nearly stationary movement can make pace noisy or misleading, so the screen treats pace as “meaningful only when we have distance and time.”
- The screen does not claim background recording, kill/reboot recovery, or upload. Those remain separate concerns and are called out as not-in-scope here.

## Verification status

### Done
- Static review of the new files against the request:
  - start/stop/pause UI is present,
  - live elapsed time is present,
  - live distance is present,
  - rolling pace is present (with a meaningfulness guard),
  - manual pause/resume is present,
  - local route-buffer contract exists and is used by the screen,
  - foreground `watchPositionAsync` path is used first.

### Not run
- `expo-location` is not installed in `app/` yet in this pass, so the new imports will not compile/run until that dependency is present.
- `npx expo prebuild`, `npm --prefix app test`, and `npm --prefix app run typecheck` are out of scope for this report and were not executed here.
- No device run was performed, so permission flow, live updates, pause resume behavior, and distance/pace noise were not validated on device.

## Known limitations

- This is a foreground skeleton, not a complete run tracker. It is scoped to the requested pieces and explicitly does not include background task wiring, route rendering, splits, or finish summary.
- Pace is derived from point-to-point motion and can be unstable early, during pauses, or when movement is minimal; the screen labels pace accordingly.
- The local route buffer is in-memory with a structured export path; durable persistence is not wired here.
- Any statement that the run flow is “complete” would be false; the screen itself says what is missing.

## Next steps

1. Install or confirm `expo-location` in `app/`.
2. Add `RunScreen` into navigation if desired, behind the same honest-unavailable rules as the rest of the app.
3. On device, validate foreground permission flow, live time/distance/pace updates, and pause/resume behavior.
4. Later: add durable persistence for the run buffer, then route rendering and splits/summary when those are ready.
