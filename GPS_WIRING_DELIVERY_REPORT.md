# GPS background-location wiring — delivery report

## What changed

- Added the Expo Location config to `app/app.json`:
  - `expo-location` plugin block with foreground and background permission strings, iOS background location enabled, and Android background location + foreground service enabled.
  - iOS `infoPlist` copies of the same permission strings so the native plist stays in sync.
- Added the background task contract:
  - `app/src/services/locationTask.ts` registers a module-scoped `TaskManager.defineTask` and persists location batches through a local storage seam.
  - `app/src/storage/locationStorage.ts` is the local storage seam for captured points, with debounced durable writes and a recovery-ready snapshot.
- Added the foreground-prototype screen:
  - `app/src/screens/TrackingScreen.tsx` implements permission probing, foreground-then-background permission flow, `startLocationUpdatesAsync`, stop, and a local “saved points” read-back.
  - The screen is honest about gaps: map, splits, pause/resume, upload/sync, and finish-run summary are listed as not-wired rather than rendered as working controls.

## Files changed

- `app/app.json`
- `app/src/services/locationTask.ts` (new)
- `app/src/storage/locationStorage.ts` (new)
- `app/src/screens/TrackingScreen.tsx` (new)

## Companion notes

- `docs/TRAJECTORY_NOTES.md` explains why this was treated as a detoured task: the request assumed a foreground prototype was already in place, and the real wiring has a prebuild + dev build dependency before any background behavior can be legitimately claimed.

## Verification status

### Done
- Static review of the wiring against the request:
  - app.json config-plugin settings for foreground/background permission strings, iOS background mode, Android background location, and foreground service are present.
  - Module-scoped `TaskManager.defineTask` is present and persists location batches locally.
  - Tracking screen has the `startLocationUpdatesAsync` path behind the permission flow.

### Not run / not possible in this environment
- `npx expo prebuild` has not been run, because the native config changes only take effect after a prebuild and this environment is not set up to complete that in a verified way for the app target.
- `expo-location` has not been installed into `app/` yet. The new files import it, so they will not compile or run until `expo-location` is added to the app dependencies.
- `npm --prefix app test` and `npm --prefix app run typecheck` have not been run, because the app does not yet have the Expo Location dependency installed and the app is not prebuilt. Running them now would be meaningless for this change.
- No device or dev build has been used, so no background recording behavior has been validated. The wiring may be syntactically satisfactory and still fail the real behaviors in the device test plan (permission dialogs, background recording, kill/reboot/swipe-away recovery, OEM behavior).

## Known limitations

- This is initial wiring, not a finished run-tracking feature. The screen itself says so.
- The local storage seam persists one running session’s batch with a simple debounce and AsyncStorage. That is reasonable for a first cut, but it is not the same as a tested kill/reboot recovery story.
- The permission strings are app-specific drafts, but they still need review against the actual app behavior and the store-submission checklist before shipping.
- The screen does not yet integrate into navigation; `App.tsx` was read but not edited in this pass because the foreground prototype and navigation integration are still open questions.

## What would need to happen next

1. Install `expo-location` in `app/`.
2. Run a prebuild so the config plugin takes effect.
3. Build/run a dev build and exercise the tracking screen on device with the device test plan scenarios, especially:
   - granted / denied / “Allow Once” flows,
   - foreground recording,
   - background recording while locked or in background,
   - swipe-away / force-quit / reboot recovery,
   - battery saver and OEM restrictions.
4. Decide whether `TrackingScreen` should be added to the navigation stack now or after the foreground prototype is more complete.

## Honesty note

The request asked for the wiring “after the foreground prototype is in place.” That prototype is not yet in place in this repo, so the delivery is the wiring skeleton plus an honest screen that shows what is available now and what is still missing, rather than a fully integrated run-tracking feature.
