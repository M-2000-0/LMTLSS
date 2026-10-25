// ============================================================
// GPS background-location wiring — draft patch
// ============================================================
// This is a draft illustration of the three pieces needed:
//  1. app.json config-plugin settings
//  2. a module-scoped TaskManager.defineTask that persists
//     location batches locally
//  3. the tracking screen's startLocationUpdatesAsync path
//
// It is not a claim that the foreground prototype is already
// in place. The foreground gate and exact screen structure
// still need to be wired first.
// ============================================================

// ------------------------------------------------------------
// 1. app.json config-plugin settings (illustrative)
// ------------------------------------------------------------
//
// Add to app.json under expo.plugins[]:
//
//   [
//     "expo-location",
//     {
//       "locationAlwaysAndWhenInUsePermission":
//         "LMTLSS uses your location to record your run, including
//          when the screen is off or the app is in the background.
//          Distance and route are derived from your location
//          history. You can deny background access and still log a
//          time-only session.",
//       "locationWhenInUsePermission":
//         "LMTLSS uses your location to record your run.",
//       "isIosBackgroundLocationEnabled": true,
//       "isAndroidBackgroundLocationEnabled": true,
//       "isAndroidForegroundServiceEnabled": true,
//       "androidForegroundServiceIcon": "./assets/icon.png"
//     }
//   ]
//
// Notes:
// - These are the Expo config-plugin knobs described in the
//   Expo Location docs for background location and Android
//   foreground-service/location behavior.
// - Permission strings must be app-specific and review-ready, not
//   generic. Replace the examples above with the real copy before
//   any store submission.
// - androidForegroundServiceIcon is the 96x96 all-white-with-
//   transparency PNG the Expo docs describe. The fallback is the
//   notification icon, then the launcher icon.
//
// Important:
// - app.json edits are necessary but not sufficient for a claim
//   that background location works. They take effect on a prebuild,
//   and the actual recording behavior must be validated on a dev
//   build and on device.

// ------------------------------------------------------------
// 2. Module-scoped TaskManager task
// ------------------------------------------------------------
//
// File: src/services/locationTask.ts  (illustrative path)
//
//   import * as TaskManager from 'expo-task-manager';
//   import * as Location from 'expo-location';
//   import { saveLocationBatch } from './storage';
//
//   export const LOCATION_TASK_NAME = 'lmtlss-location-task';
//
//   TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
//     if (error) {
//       // Persist the failure so the UI can surface it later.
//       saveLocationBatch.failure?.(error);
//       return;
//     }
//
//     if (data && Array.isArray(data.locations)) {
//       // Persist the batch synchronously-ish / queued for later
//       // write, depending on your storage seam.
//       saveLocationBatch.trigger(data.locations);
//     }
//   });
//
// Notes:
// - defineTask must be at module scope, not inside a component.
// - data.locations is the shape described by Expo's TaskManager/
//   Location background-task docs.
// - The "persist locally" part is the storage seam you choose:
//   AsyncStorage, a small local DB, or a file-based log. The task
//   should be resilient to write failures and should not assume the
//   UI is mounted.
//
// Important:
// - This task is the background-recording contract. If the app
//   depends on it for a real run, the persistence path must be
//   tested under kill / reboot / battery saver / OEM restrictions
//   on device. app.json + a task definition alone is not that
//   validation.

// ------------------------------------------------------------
// 3. Tracking screen's startLocationUpdatesAsync path
// ------------------------------------------------------------
//
// File: src/screens/TrackingScreen.tsx  (illustrative)
//
//   import { useEffect, useRef, useState } from 'react';
//   import { Platform, Linking } from 'react-native';
//   import * as Location from 'expo-location';
//   import { LOCATION_TASK_NAME } from '../services/locationTask';
//   import { openAppSettings } from '../utils/links';
//
//   function TrackingScreen() {
//     const [status, setStatus] = useState<'idle' | 'foreground' | 'background' | 'error'>('idle');
//     const taskRegistered = useRef(false);
//
//     // Probe background permission state on mount.
//     useEffect(() => {
//       let mounted = true;
//       (async () => {
//         const fg = await Location.getForegroundPermissionsAsync();
//         const bg = await Location.getBackgroundPermissionsAsync();
//         if (mounted) {
//           // Drive UI: denied / when-in-use / always / unknown.
//           setStatus(mountPermissionUI(fg, bg));
//         }
//       })();
//       return () => { mounted = false; };
//     }, []);
//
//     const startBackgroundRecording = async () => {
//       const fg = await Location.requestForegroundPermissionsAsync();
//       if (fg.status !== 'granted') {
//         setStatus('error');
//         return;
//       }
//
//       const bg = await Location.requestBackgroundPermissionsAsync();
//       // iOS: if user chose "Allow Once", this may silently fail.
//       // Expo docs: handle that by directing the user to Settings.
//
//       await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
//         accuracy: Location.Accuracy.BestForNavigation, // or whatever your battery/accuracy tradeoff is
//         timeInterval: 5000,
//         distanceInterval: 5,
//         showsBackgroundLocationIndicator: true,
//         // add deferred / activity / stationary options per your model
//       });
//
//       taskRegistered.current = true;
//       setStatus('background');
//     };
//
//     const stopRecording = async () => {
//       if (taskRegistered.current) {
//         await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
//         taskRegistered.current = false;
//       }
//       setStatus('idle');
//     };
//
//     return (
//       <View>
//         {/* Foreground prototype UI here */}
//         <Button title="Start run (foreground path)" onPress={startBackgroundRecording} />
//         <Button title="Stop" onPress={stopRecording} disabled={status === 'idle'} />
//         {/* Honest state: show permission gaps, "Allow Once" recovery,
//             and any background indicator the OS exposes. */}
//       </View>
//     );
//   }
//
// Notes:
// - This is the foreground-prototype path with the background
//   location call behind it. If the foreground prototype is not yet
//   in place, the screen still needs an honest "not available" state
//   rather than pretending the run flow is done.
// - requestBackgroundPermissionsAsync can be called only after
//   foreground permissions in the Expo model, and "Allow Once" is a
//   real edge case you must handle explicitly (Settings link).
// - showsBackgroundLocationIndicator is the flag the Expo docs
//   describe; on iOS it relates to the system indicator behavior.
//
// Important:
// - startLocationUpdatesAsync is the point where the app transitions
//   from "we have permission" to "we are recording." That transition
//   is exactly where you want the device test plan (scenario 1, 2,
//   5, 11, 12) to apply before you claim the feature is ready.

// ------------------------------------------------------------
// End of draft patch
// ------------------------------------------------------------
