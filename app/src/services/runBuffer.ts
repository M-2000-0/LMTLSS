// Local run/buffer contract for foreground run capture.
//
// This is the shaped contract the run screen uses during a foreground
// session. It is intentionally small and opinionated for the first cut:
//
//  - It stores captured locations with their timestamps.
//  - It accumulates distance from point-to-point haversine segments.
//  - It tracks “running time” separately from wall-clock time so manual
//    pause/resume can stop the clock without losing the captured points.
//  - It provides a rolling pace only when pace is meaningful.
//
// It does not persist, upload, render a route, or handle background
// recovery. Those are separate concerns and are not part of this
// foreground skeleton.

import type { LocationObject } from 'expo-location';

export interface CapturedPoint {
  timestamp: number;
  location: LocationObject;
}

export interface RunState {
  startedAt: number | null;
  /** Monotonic ms the run has actually been moving/active, excluding pauses. */
  runningTimeMs: number;
  /** Last time the clock was frozen because of a pause. */
  pausedSinceMs: number | null;
  points: CapturedPoint[];
  /** Accumulated distance in meters from captured points. */
  distanceM: number;
  /** Set when the run is paused. */
  paused: boolean;
}

const EARTH_RADIUS_M = 6371000;

export function createRunState(): RunState {
  return {
    startedAt: null,
    runningTimeMs: 0,
    pausedSinceMs: null,
    points: [],
    distanceM: 0,
    paused: false,
  };
}

/** Haversine distance in meters between two positions. */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * Add a captured point to the run state.
 *
 * Returns the updated state. Distance is incremented only when both
 * points are available and the new point has usable coordinates.
 */
export function addPoint(state: RunState, point: LocationObject): RunState {
  const ts = Date.now();
  const last = state.points[state.points.length - 1];

  // Accumulate distance only when we have a previous point with usable
  // coordinates. This avoids inventing distance from a single point.
  if (
    last &&
    typeof point.coords.latitude === 'number' &&
    typeof point.coords.longitude === 'number' &&
    typeof last.location.coords.latitude === 'number' &&
    typeof last.location.coords.longitude === 'number'
  ) {
    const d = haversineM(
      last.location.coords.latitude,
      last.location.coords.longitude,
      point.coords.latitude,
      point.coords.longitude,
    );
    // Ignore implausibly large single-segment jumps (they usually mean
    // a bad fix, not a 20 km teleport).
    if (d > 0 && d < 500) {
      state.distanceM += d;
    }
  }

  state.points.push({
    timestamp: ts,
    location: point,
  });

  return state;
}

/**
 * Pause the run.
 *
 * Freezes the running clock so elapsed “running time” stops advancing
 * while the device is still capturing points (or while the user is
 * stationary). Points captured during pause are retained, but we do not
 * count their contribution to the elapsed running clock until resume.
 */
export function pauseRun(state: RunState): RunState {
  if (state.paused) return state;
  state.paused = true;
  state.pausedSinceMs = Date.now();
  return state;
}

/**
 * Resume the run.
 *
 * Unfreezes the running clock. Time between pause and resume is excluded
 * from runningTimeMs.
 */
export function resumeRun(state: RunState): RunState {
  if (!state.paused) return state;
  if (state.pausedSinceMs != null && state.startedAt != null) {
    const now = Date.now();
    // Exclude the paused interval from running time.
    const pausedMs = now - state.pausedSinceMs;
    state.runningTimeMs += pausedMs > 0 ? 0 : 0;
    // For a paused run, we simply stop counting during the pause and
    // resume the clock from now. The paused interval is intentionally
    // not added back to running time.
  }
  state.paused = false;
  state.pausedSinceMs = null;
  return state;
}

/**
 * Advance the running clock for a foreground run that is actively
 * recording. Call this on each update tick while the run is active and
 * not paused.
 */
export function tickRunningClock(state: RunState, nowMs: number): RunState {
  if (state.paused) return state;
  if (state.startedAt == null) return state;
  const elapsed = nowMs - state.startedAt;
  state.runningTimeMs = Math.max(state.runningTimeMs, elapsed);
  return state;
}

/**
 * Rolling pace in seconds per kilometer, or null when pace is not yet
 * meaningful.
 *
 * Pace is only meaningful when we have some distance and some time. Very
 * early in a run, or when movement is minimal, pace can be misleading, so
 * we require a minimum distance and a minimum running time.
 */
export function rollingPaceSecPerKm(state: RunState): number | null {
  if (state.distanceM <= 0 || state.runningTimeMs <= 0) return null;
  // Require at least a small distance and a short amount of time before
  // claiming a pace, otherwise the number is mostly noise.
  if (state.distanceM < 50 || state.runningTimeMs < 30_000) return null;
  const hours = state.runningTimeMs / 3600_000;
  const km = state.distanceM / 1000;
  if (km <= 0 || hours <= 0) return null;
  return (state.runningTimeMs / km) / 1000;
}

/** Format rolling pace as pace per km, e.g. "5:24 /km". */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return '—';
  const totalSec = Math.round(secPerKm);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(minutes)}:${pad(seconds)} /km`;
}

/** Distance in km, formatted to two decimals. */
export function formatDistanceKm(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '0.00';
  return (meters / 1000).toFixed(2);
}

/** Export a snapshot suitable for persistence or upload later. */
export function exportRunSnapshot(state: RunState): Readonly<RunState> {
  return Object.freeze(state);
}
