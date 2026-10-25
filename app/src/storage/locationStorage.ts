// Local storage seam for recorded location batches.
//
// This is intentionally small and isolated:
//  - the background task persists batches here,
//  - the tracking screen reads the current running session's captured
//    points from here,
//  - uploads / sync / route derivation are separate concerns and are not
//    part of this initial wiring.
//
// We store one running session's captured locations in memory plus a
// durable copy in AsyncStorage so a kill/reopen path can recover what
// was captured before the app was terminated. The exact recovery story
// is a device-test question (test plan scenario 7/8/9), not something
// this file can promise on its own.
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredLocation {
  /** Expo LocationObject fields as captured by the background task. */
  coords: {
    latitude: number;
    longitude: number;
    altitude?: number | null;
    accuracy?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp: number;
  mocked?: boolean;
}

export const LOCATION_BATCH_KEY = 'lmtlss:location-batch:v1';

export const locationStorageFailure =
  "Couldn't save recorded location on this device.";

type SerializableBatch = {
  capturedAt: number;
  locations: StoredLocation[];
};

function serialize(batch: StoredLocation[]): string {
  const payload: SerializableBatch = {
    capturedAt: Date.now(),
    locations: batch,
  };
  return JSON.stringify(payload);
}

function deserialize(raw: string): SerializableBatch | null {
  try {
    return JSON.parse(raw) as SerializableBatch;
  } catch {
    return null;
  }
}

let currentBatch: StoredLocation[] = [];
let lastPersistedAt = 0;

function debouncePersist(nowMs: number): boolean {
  // Persist at most every ~2 seconds to avoid turning a run into a
  // write storm. For a first cut this is a reasonable compromise between
  // loss risk and I/O pressure; the real tradeoff should be measured on
  // device for the target hardware.
  return nowMs - lastPersistedAt >= 2000;
}

async function durableWrite(batch: StoredLocation[]): Promise<void> {
  const raw = serialize(batch);
  try {
    await AsyncStorage.setItem(LOCATION_BATCH_KEY, raw);
    lastPersistedAt = Date.now();
  } catch {
    throw new Error(locationStorageFailure);
  }
}

/**
 * Persist a batch of locations captured by the background task.
 *
 * Returns the persisted batch so callers can confirm what actually landed.
 */
export const appendLocationBatch = {
  /** Optional error sink for observability / UI surfacing. */
  failure: null as ((err: unknown) => void) | null,

  async trigger(batch: StoredLocation[]): Promise<StoredLocation[]> {
    if (!Array.isArray(batch) || batch.length === 0) {
      return currentBatch.slice();
    }

    const next: StoredLocation[] = batch.map((loc) => ({
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

    currentBatch = [...currentBatch, ...next];

    const now = Date.now();
    if (debouncePersist(now)) {
      try {
        await durableWrite(currentBatch);
      } catch (err) {
        if (appendLocationBatch.failure) {
          appendLocationBatch.failure(err);
        }
      }
    }

    return currentBatch.slice();
  },

  /** Read the durable copy back. Returns a snapshot; it may be stale. */
  async read(): Promise<StoredLocation[]> {
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(LOCATION_BATCH_KEY);
    } catch {
      return [];
    }
    if (!raw) return [];

    const payload = deserialize(raw);
    if (!payload) return [];

    // Normalize any older payloads that lacked the expected shape.
    return payload.locations.filter(
      (loc): loc is StoredLocation =>
        loc && typeof loc === 'object' && typeof loc.timestamp === 'number',
    );
  },

  /** Clear the stored batch when a run is finished or discarded. */
  async clear(): Promise<void> {
    currentBatch = [];
    try {
      await AsyncStorage.removeItem(LOCATION_BATCH_KEY);
    } catch {
      // Best-effort cleanup; not fatal.
    }
  },
};

/** Start a fresh in-memory capture buffer for a new run. */
export function resetCaptureBuffer(): StoredLocation[] {
  const snapshot = currentBatch.slice();
  currentBatch = [];
  return snapshot;
}
