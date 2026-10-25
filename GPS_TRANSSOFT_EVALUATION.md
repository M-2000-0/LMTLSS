# TransistorSoft react-native-background-geolocation — evaluation

## Bottom line

For this app's first serious run-tracking implementation, TransistorSoft is likely worth adopting **if** background recording, cross-OEM survivability, and battery-conscious motion-driven tracking are first-class requirements and you are willing to carry a paid, proprietary native SDK.

If the goal were only foreground + simple background location and you wanted the smallest dependency footprint and the most Expo-native path, hand-rolled `expo-location` + `expo-task-manager` is the smaller, fully open/free choice — but you would then own far more of the hard parts yourself: Android foreground service behavior, motion detection, stop detection, reboot/terminate recovery semantics, and the OEM variability that the vendor explicitly points at.

This is a vendor/architecture decision, not just a feature comparison. The SDK's selling point is that it replaces a lot of bespoke native plumbing and a lot of platform-specific edge-case work with a single opinionated engine. The tradeoff is licensing cost, a proprietary native core, and adopting its "philosophy of operation," which is motion-driven rather than callback-every-N-seconds.

---

## What the vendor says about licensing and terms

- The React Native wrapper package is open source under MIT or Apache 2.0. The **native SDK binaries are proprietary** and governed by TransistorSoft's Software License Agreement. This is the key legal nuance: the npm package you install is not the part that costs money; the native iOS/Android SDK inside it is.
- Pricing page currently shows:
  - Starter **$399**, 1 app key
  - Venture **$599**, 5 app keys
  - Pro **$749**, 25 app keys
  - Studio **$999**, 100 app keys
- The license is described as **perpetual**, one application identifier, both iOS and Android included, **unlimited users and devices**, no royalties.
- Each purchase includes **12 months of updates + support**. After that, the key and the version you have continue to work; you can renew maintenance to get newer releases. The FAQ mentions **$199/year** for optional yearly support, but the evaluator should treat that as "the FAQ's stated figure," not a verified current checkout price.
- A **free 30-day trial key** is available for release builds. **Debug builds are fully functional without a key.**
- The license is bound to the app identifier. Development suffixes like `.dev`, `.debug`, `.staging`, etc., are covered automatically for the base app ID; custom suffixes need a request.
- Licenses are **framework-specific**. A React Native license would not cover a future Flutter/Capacitor/native migration without a new license.
- There are separately licensed **add-ons**: polygon geofencing and the Firebase adapter. Circular geofencing is included.
- The vendor states the SDK runs on-device and sends data only to servers you configure; TransistorSoft does not receive app data and license validation is on-device with no network call.

Sources: TransistorSoft purchase page, license page, FAQ, React Native/Expo setup page, GitHub README.

---

## Expo / prebuild / dev-client reality

The SDK ships an **Expo Config Plugin** and the vendor's setup guide says you can:

1. Install with `npx expo install react-native-background-geolocation`
2. Add the plugin and license config to `app.json` / `app.config.js`
3. Run `npx expo prebuild`
4. Build with `npx expo run:ios` / `npx expo run:android`

The plugin is supposed to handle the native configuration automatically — Info.plist, AndroidManifest, background modes, etc. The guide explicitly says manual native edits are not required.

The vendor FAQ says it supports "Expo Go, Expo Dev Client, managed workflow, and bare workflow." **Be careful with the Expo Go claim.** Expo's own Location docs say background location requires a development build and is not supported in Expo Go. Expo's TaskManager docs also say TaskManager is not available on Android in Expo Go and does not support background execution on iOS in Expo Go. So the practical reading is: **this SDK's native background-location functionality should be treated as a development-build feature**, not an Expo Go feature. If the vendor's Expo Go statement means something more limited (for example, foreground-only behavior or JS-side APIs), that should be verified directly with them before relying on it.

For this app, that is not a blocker, because the plan is already a dev-client / prebuild build for native features. But it does mean "works in Expo Go" is not a useful proof point for the background behavior you actually care about.

Sources: TransistorSoft Expo setup docs; Expo Location, TaskManager, and BackgroundFetch docs; Expo FAQ.

---

## What it removes from your plate

This is the strongest reason to consider it. Compared with hand-rolling, the SDK appears to take ownership of a lot of things that are genuinely annoying in this space:

- **Motion-detection-driven tracking** — it uses accelerometer/gyro/magnetometer to decide moving vs stationary, and turns location services down when stationary. That is exactly the kind of battery-versus-accuracy tradeoff that is easy to get wrong yourself.
- **Stop detection and trip modeling** — configurable stopTimeout and activity stop-detection delay, which matters for run tracking because you do not want every pause at a traffic light or water fountain to fragment the activity in ugly ways.
- **Distance filter and accuracy policy** as a managed concept, not just "start updates and hope."
- **Background execution semantics** that the vendor describes as deliberately opinionated:
  - iOS: on terminate, register a stationary geofence; when the device moves ~200 m, iOS relaunches the app in the background and tracking resumes.
  - Android: native background service keeps recording/uploading after the JS/UI process is gone; `enableHeadless` is for custom headless JS logic, not required for recording + uploading.
- **Reboot resilience** — `startOnBoot: true` maps to BOOT_COMPLETED on Android; on iOS the stationary-geofence mechanism is described as the path back to tracking.
- **HTTP autoSync** to your own REST endpoint, so the SDK can be the capture + upload engine rather than you building your own background upload scheduler from scratch.
- **Expo config plugin** so the native wiring for background modes/permissions can be expressed in app config rather than maintained by hand after every prebuild.

If you bought into the SDK fully, your run-tracking architecture would shift from "build and defend a platform location pipeline" to "configure and operate a motion-aware tracking SDK."

---

## What it does **not** override or solve

This is where the evaluation has to stay honest.

- **It does not remove store permission/justification work.** You still need foreground vs background location permissions, and you still need the right purpose strings / justification. Expo docs emphasize that background location requires the "Always" path on iOS and both foreground + background permissions on Android. The vendor's own example strings are generic; you would still need app-specific, review-ready language.
- **It does not remove platform policy risk or OEM variability.** The vendor FAQ even points users at `dontkillmyapp.com` for Android OEM differences. In other words, the SDK is not a force-field against the exact Android OEM/recent-apps/battery behavior this GPS test plan is built to find.
- **It does not remove the need for a server to receive locations if you want uploads.** The SDK includes HTTP upload, but your endpoint and your auth/sync/conflict handling still exist.
- **It does not remove the need to validate behavior on real devices.** A paid SDK can reduce some uncertainty, but the vendor's own FAQ is explicit that behavior differs by platform and that stationary detection / background relaunch behavior is OS-mediated. The physical-device test plan remains necessary.
- **It may not match your feature expectations if you expect "record everywhere all the time regardless of motion."** The vendor frames the product around motion detection. If your model is "continuous background pings whether moving or not," you need to read the docs carefully and test the stationary behavior, because that is a deliberate design choice rather than a missing feature.
- **It does not make the app free of native-module constraints in Expo Go.** Again, the background behavior you care about is in the dev-client/prebuild path.
- **It does not avoid licensing commitment for release builds.** Debug/trial is lenient; production is not.

---

## What hand-rolled Expo Location + TaskManager would still require

If you stay with the Expo-native path, you get:

- A free, Expo-maintained module set with clear config-plugin support for permissions and background modes.
- `expo-location` background location and geofencing via `TaskManager.defineTask`.
- Transparent platform documentation and the usual Expo upgrade path.

But you would still need to design and defend:

- **Foreground service / background location behavior on Android**, including notification/foreground-service requirements where applicable, and the Android 14+ foreground-service-location nuance that Expo's config plugin already exposes.
- **Termination and reboot behavior** yourself, including the fact that Expo Location docs say a terminated app does not automatically restart on Android for location/geofence events, while iOS does relaunch on a geofence event. That is exactly the kind of asymmetry that eats engineering time.
- **Battery-conscious update policy** — accuracy, distance filter, deferred updates, when to pause, when to resume, when stationary.
- **Trip segmentation / pause handling** logic if you want clean run records rather than a noisy stream of points.
- **Upload/retry/sync** for captured locations, or acceptance that the app only persists locally and uploads later.
- **OEM testing** across at least one aggressive Android OEM device, because recent-apps dismissal and background restrictions vary.

In short: hand-rolled is more "fully in your control and fully your responsibility."

---

## Fit for this app's run tracking

For the use case as I understand it — outdoor run recording, likely with background/locked-screen tracking, pause/resume, poor-signal handling, and a real store-submission path — the SDK is a strong match structurally, because run tracking is exactly where motion detection, stop handling, and background survivability matter most.

The main reasons to say **yes**:

- It targets the hardest part of run tracking: reliable background capture with battery-conscious behavior and termination/reboot resilience.
- It reduces bespoke native work, which is attractive if the team's core product is the training experience, not the GPS pipeline.
- It has an explicit Expo config-plugin path, so it can fit into a prebuild-based Expo app without manual native-file gardening for the common case.
- It can be evaluated before buying because debug builds work without a key and there is a 30-day release-build trial.

The main reasons to say **no or not yet**:

- It is a paid proprietary dependency for the native core, and the cheapest plan is $399 for one app. That may be perfectly reasonable, but it is not nothing, and it is a per-framework license if you ever pivot.
- It is opinionated. If your run-tracking model differs from its motion-driven philosophy, you may spend time fighting the SDK's defaults.
- If you only need a thinner slice of background location, the SDK may be more engine than you need.
- You still need the device test plan, the store-purpose-string readiness work, and the server side if you want uploads; the SDK is not a substitute for those.

---

## A practical way to decide

Use a **trial-build-first** gate, because the vendor's own guidance is that debug builds are fully functional and there is a 30-day release trial:

1. Wire the SDK into the app in debug mode via prebuild.
2. Implement one real run-tracking flow: start/stop, foreground recording, background/locked recording, pause/resume, and uploading or persisting captured points.
3. Test on at least one Android device and one iOS device with the exact permission states the app will ship: foreground-only, background allowed, denied, approximate where relevant.
4. Validate the behaviors you actually care about rather than assuming the marketing claims: stationary behavior during a run, behavior when the app is swiped away, behavior after reboot, and behavior under battery saver / OEM restrictions.
5. If after that the SDK materially improves reliability or cuts native work you would otherwise have to own, the Starter license is the natural entry point for a single app.

If the trial shows you are fighting the SDK more than being helped by it, the fallback is hand-rolled Expo Location + TaskManager plus whatever native glue you are willing to write and maintain.

---

## Open items to verify before committing

- Confirm the current pricing and plan details on the vendor's purchase page; the figures above are what those pages displayed when checked.
- Confirm the current renewal/support cost and terms in the vendor's license/FAQ material; the $199/year figure is from the FAQ, not verified as the current checkout price.
- Resolve the Expo Go inconsistency directly if any workflow depends on it. For background location, plan on a development build regardless.
- If the app will ever ship more than one distinct app identifier, map that to the right license tier now rather than retrofitting.
- If you care about polygon geofencing or Firebase sync, confirm whether those are needed; both are separate add-ons.
- Treat the vendor's stationary/motion behavior as a product requirement to validate, not just a feature bullet.

---

## Sources

- TransistorSoft: Plans & Pricing, Software License Agreement, React Native/Expo setup, FAQ, GitHub README.
- Expo: Location, TaskManager, and BackgroundFetch docs; Expo FAQ.
