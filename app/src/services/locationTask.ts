// Background location task — registered once at module scope.
//
// Expo requires TaskManager.defineTask outside any component so the
// background runtime can find it. This file exists so the task is
// registered before any screen renders, and so the recording path can
// be tested independently of the UI.
//
// Architecture note:
//  - The task does not import the app store directly. If the store is
//    not mounted when the task fires, that import path is the wrong
//    boundary for a background task. Instead, the task calls a small
//    storage seam that the app and the task both agree on.
//  - We persist raw batches locally first. Upload / sync is a separate
//    concern and is not part of this initial wiring.
import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';

import { appendLocationBatch, type StoredLocation } from '../storage/locationStorage';

export const LOCATION_TASK_NAME = 'lmtlss-location-task';

export interface TaskLocation extends LocationObject {
  mocked?: boolean;
}

TaskManager.defineTask<{ locations: LocationObject[] }>(
  LOCATION_TASK_NAME,
  async ({ data, error }) => {
    if (error) {
      appendLocationBatch.failure?.(error);
      return;
    }

    if (!data || !Array.isArray(data.locations)) {
      appendLocationBatch.failure?.(new Error('background location task emitted no locations'));
      return;
    }

    const batch: StoredLocation[] = data.locations.map((loc) => ({
      coords: {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude,
        accuracy: loc.coords.accuracy,
        altitudeAccuracy: loc.coords.altitudeAccuracy,
        heading: loc.coords.heading,
        speed: loc.coords.speed,
      },
      timestamp: loc.timestamp,
      mocked: loc.mocked,
    }));

    try {
      await appendLocationBatch.trigger(batch);
    } catch (err) {
      appendLocationBatch.failure?.(err);
    }
  },
);

/** Status probe used by screens before trying to start recording. */
export async function isTaskRegistered(): Promise<boolean> {
  try {
    const tasks = await TaskManager.getRegisteredTasksAsync();
    return tasks.some((task) => task.taskName === LOCATION_TASK_NAME);
  } catch {
    return false;
  }
}
