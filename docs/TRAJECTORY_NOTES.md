# Trajectory notes — GPS background-location wiring

## What changed my assessment

The requested change is not a small wire-up on top of an existing foreground prototype. It requires native configuration that only takes effect after a prebuild, and it requires a TaskManager task that must be registered at module scope. That shifts the job from “edit a screen” to “configure the app binary and add a background task contract.”

## Implications

- `app.json` changes alone are not testable in Expo Go for the background behavior we care about.
- The foreground prototype assumption in the request is not yet verifiable in this repo: there is no existing run-screen foreground prototype to wire behind.
- The realistic first deliverable is a config + task + screen skeleton that compiles after prebuild and can be exercised on a dev build, not a fully validated recording path.

## What I will do next

1. Add the app.json config-plugin settings for permissions, iOS background mode, and Android background location + foreground service.
2. Add a module-scoped TaskManager task that persists location batches locally.
3. Add the tracking screen's `startLocationUpdatesAsync` path behind a foreground-prototype gate, with honest unavailability handling where the foreground path is not yet in place.
4. Note where prebuild and a dev build are required before any background behavior can be legitimately claimed.

## Honesty constraint

Any statement that background location “works” must be gated on a dev build and on device, not on app.json edits alone.
