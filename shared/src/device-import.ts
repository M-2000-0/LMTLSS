/* Turning an external workout into a LMTLSS session log.

   Three rules, each covered by a test:

   1. Never invent data. A watch that reports 42 minutes and 8.1 km produces
      exactly that; a watch that reports strength training produces a session
      with zero exercises, not fabricated sets or loads.
   2. Never mislabel provenance. Imported distance carries the provider name as
      its source, never "GPS" — a treadmill run has distance but no GPS.
   3. Never double-count. The same run often arrives twice (watch + phone, or
      Strava + HealthKit). Dedupe is explicit and reports what it skipped. */

import type { SessionLog } from './types';
import { isProviderId, providerById, type ProviderId } from './devices';

export type CanonicalSport = 'strength' | 'running' | 'cycling' | 'swimming' | 'other';

export interface ExternalWorkout {
  provider: ProviderId;
  /** Provider-scoped identifier; the same id must map to the same workout. */
  externalId: string;
  /** HealthKit activity code (number) or Health Connect / vendor name (string). */
  activityType: string | number;
  /** ISO 8601 timestamp with an explicit offset or Z. */
  startedAt: string;
  /** Seconds. Rejected when not positive and finite. */
  durationSec: number;
  /** Metres, already converted by the adapter. */
  distanceM?: number | null;
  energyKcal?: number | null;
  avgHeartRate?: number | null;
  title?: string;
}

export interface SportMapping {
  sport: CanonicalSport;
  /** False when the provider type was not recognised and fell back to "other". */
  mapped: boolean;
  /** The provider's own name for the activity, kept for display. */
  sourceLabel: string;
}

export interface ImportedSession extends SessionLog {
  /** Always set; the provider id makes the key stable across imports. */
  id: string;
  source: ProviderId;
  externalId: string;
  provenance: 'device';
  importedAt: string;
  sourceActivityType: string | number;
  sportMapped: boolean;
  metrics: {
    deviceDistanceM?: number;
    energyKcal?: number;
    avgHeartRate?: number;
  };
}

export interface DuplicateMatch {
  /** null only when the existing log had no id of its own. */
  matchedId: string | null;
  kind: 'external-id' | 'overlap';
}

export interface ImportPlan {
  accepted: ImportedSession[];
  duplicates: {
    workout: ExternalWorkout;
    matchedId: string | null;
    kind: 'external-id' | 'overlap' | 'in-batch';
  }[];
  invalid: { workout: ExternalWorkout; reasons: string[] }[];
}

/** Same run recorded twice rarely starts more than a few minutes apart. */
export const OVERLAP_START_TOLERANCE_MS = 5 * 60 * 1000;
/** Short sessions need a wider relative tolerance, so allow a two-minute floor. */
export const OVERLAP_DURATION_MIN_SEC = 120;
export const OVERLAP_DURATION_RATIO = 0.1;

/** HealthKit's HKWorkoutActivityType raw values. */
const HEALTHKIT_CODES: Record<number, CanonicalSport> = {
  11: 'other', // cross training
  13: 'cycling',
  15: 'other', // rowing
  16: 'other', // elliptical
  20: 'strength', // functional strength training
  24: 'other', // hiking
  37: 'running',
  46: 'swimming',
  50: 'strength', // traditional strength training
  52: 'other', // walking
  57: 'other', // yoga
  58: 'other', // pilates
  59: 'strength', // core training
  63: 'other', // HIIT — mixed modality, so not claimed as strength
  64: 'other', // jump rope
  65: 'other', // kickboxing
  66: 'other', // martial arts
  68: 'other', // stair climbing
  78: 'other', // flexibility
  3000: 'other', // other
};

/* Keys are normalised: prefixes stripped, camelCase split, uppercase, and
   non-alphanumerics collapsed to "_" (see normaliseTypeKey). */
const STRING_TYPES: Record<string, CanonicalSport> = {
  STRENGTH: 'strength',
  STRENGTH_TRAINING: 'strength',
  TRADITIONAL_STRENGTH_TRAINING: 'strength',
  FUNCTIONAL_STRENGTH_TRAINING: 'strength',
  WEIGHT_TRAINING: 'strength',
  WEIGHTLIFTING: 'strength',
  POWERLIFTING: 'strength',
  BODYBUILDING: 'strength',
  CALISTHENICS: 'strength',
  CORE_TRAINING: 'strength',
  RESISTANCE_TRAINING: 'strength',
  RUNNING: 'running',
  RUN: 'running',
  JOGGING: 'running',
  RUNNING_TREADMILL: 'running',
  TREADMILL_RUNNING: 'running',
  INDOOR_RUNNING: 'running',
  TRAIL_RUNNING: 'running',
  TRACK_RUNNING: 'running',
  CYCLING: 'cycling',
  CYCLE: 'cycling',
  BIKING: 'cycling',
  BIKE: 'cycling',
  BIKING_STATIONARY: 'cycling',
  INDOOR_CYCLING: 'cycling',
  STATIONARY_BIKE: 'cycling',
  MOUNTAIN_BIKING: 'cycling',
  HAND_CYCLING: 'cycling',
  SWIMMING: 'swimming',
  SWIM: 'swimming',
  SWIMMING_POOL: 'swimming',
  SWIMMING_OPEN_WATER: 'swimming',
  OPEN_WATER_SWIMMING: 'swimming',
  HIKING: 'other',
  WALKING: 'other',
  ROWING: 'other',
  ROWING_MACHINE: 'other',
  ELLIPTICAL: 'other',
  YOGA: 'other',
  PILATES: 'other',
  HIGH_INTENSITY_INTERVAL_TRAINING: 'other',
  HIIT: 'other',
  JUMP_ROPE: 'other',
  STAIR_CLIMBING: 'other',
  FLEXIBILITY: 'other',
  OTHER: 'other',
  OTHER_WORKOUT: 'other',
};

const DEFAULT_TITLES: Record<CanonicalSport, string> = {
  strength: 'Strength session',
  running: 'Run',
  cycling: 'Ride',
  swimming: 'Swim',
  other: 'Workout',
};

function normaliseTypeKey(raw: string): string {
  return raw
    .replace(/^HKWorkoutActivityType/i, '')
    .replace(/^EXERCISE_TYPE_/i, '')
    .replace(/^HC_/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function classifyActivity(activityType: string | number): SportMapping {
  const sourceLabel = String(activityType);

  if (typeof activityType === 'number') {
    const mapped = HEALTHKIT_CODES[activityType] as CanonicalSport | undefined;
    if (mapped === undefined) return { sport: 'other', mapped: false, sourceLabel };
    return { sport: mapped, mapped: true, sourceLabel };
  }

  const key = normaliseTypeKey(activityType);
  const mapped = STRING_TYPES[key] as CanonicalSport | undefined;
  if (mapped === undefined) return { sport: 'other', mapped: false, sourceLabel };
  return { sport: mapped, mapped: true, sourceLabel };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Returns human-readable reasons; an empty array means the workout is valid. */
export function validateWorkout(workout: ExternalWorkout): string[] {
  const reasons: string[] = [];

  if (!isProviderId(workout.provider)) reasons.push('Unknown provider.');
  if (typeof workout.externalId !== 'string' || workout.externalId.trim() === '') {
    reasons.push('Missing provider workout id.');
  }
  if (typeof workout.startedAt !== 'string' || !Number.isFinite(Date.parse(workout.startedAt))) {
    reasons.push('Start time is not a valid ISO timestamp.');
  }
  if (!isFiniteNumber(workout.durationSec) || workout.durationSec <= 0) {
    reasons.push('Duration must be a positive number of seconds.');
  } else if (workout.durationSec > 7 * 24 * 60 * 60) {
    reasons.push('Duration exceeds seven days — likely a unit error.');
  }
  if (workout.distanceM != null) {
    if (!isFiniteNumber(workout.distanceM) || workout.distanceM < 0) {
      reasons.push('Distance must be a non-negative number of metres.');
    } else if (workout.distanceM > 1_000_000) {
      reasons.push('Distance exceeds 1,000 km — likely a unit error.');
    }
  }
  if (workout.energyKcal != null) {
    if (!isFiniteNumber(workout.energyKcal) || workout.energyKcal < 0) {
      reasons.push('Energy must be a non-negative number of kilocalories.');
    } else if (workout.energyKcal > 20_000) {
      reasons.push('Energy exceeds 20,000 kcal — likely a unit error.');
    }
  }
  if (workout.avgHeartRate != null) {
    if (
      !isFiniteNumber(workout.avgHeartRate) ||
      workout.avgHeartRate < 30 ||
      workout.avgHeartRate > 250
    ) {
      reasons.push('Average heart rate is outside 30–250 bpm.');
    }
  }

  return reasons;
}

export function toSessionLog(
  workout: ExternalWorkout,
  importedAt: string,
): ImportedSession {
  const mapping = classifyActivity(workout.activityType);
  const providerLabel = isProviderId(workout.provider)
    ? providerById(workout.provider).label
    : String(workout.provider);
  const title = workout.title?.trim();

  const metrics: ImportedSession['metrics'] = {};
  if (isFiniteNumber(workout.distanceM)) metrics.deviceDistanceM = workout.distanceM;
  if (isFiniteNumber(workout.energyKcal)) metrics.energyKcal = workout.energyKcal;
  if (isFiniteNumber(workout.avgHeartRate)) metrics.avgHeartRate = workout.avgHeartRate;

  const session: ImportedSession = {
    id: `import:${workout.provider}:${workout.externalId}`,
    sport: mapping.sport,
    title: title && title.length > 0 ? title : DEFAULT_TITLES[mapping.sport],
    startedAt: workout.startedAt,
    durationSec: workout.durationSec,
    source: workout.provider,
    externalId: workout.externalId,
    provenance: 'device',
    importedAt,
    sourceActivityType: workout.activityType,
    sportMapped: mapping.mapped,
    metrics,
    exercises: [],
  };

  if (isFiniteNumber(workout.distanceM)) {
    session.distanceM = workout.distanceM;
    /* Provenance, not a transport claim: a treadmill reports distance too. */
    session.distanceSource = `reported by ${providerLabel}`;
  }

  return session;
}

export function findDuplicate(
  workout: ExternalWorkout,
  candidates: readonly SessionLog[],
): DuplicateMatch | null {
  for (const candidate of candidates) {
    if (candidate.source === workout.provider && candidate.externalId === workout.externalId) {
      return { matchedId: candidate.id ?? null, kind: 'external-id' };
    }
  }

  const start = Date.parse(workout.startedAt);
  if (!Number.isFinite(start)) return null;
  const sport = classifyActivity(workout.activityType).sport;

  for (const candidate of candidates) {
    if (classifyActivity(String(candidate.sport)).sport !== sport) continue;

    const candidateStart = Date.parse(candidate.startedAt);
    const candidateDuration = candidate.durationSec;
    if (!Number.isFinite(candidateStart)) continue;
    if (!isFiniteNumber(candidateDuration)) continue;
    if (Math.abs(candidateStart - start) > OVERLAP_START_TOLERANCE_MS) continue;

    const tolerance = Math.max(
      OVERLAP_DURATION_MIN_SEC,
      Math.max(workout.durationSec, candidateDuration) * OVERLAP_DURATION_RATIO,
    );
    if (Math.abs(candidateDuration - workout.durationSec) <= tolerance) {
      return { matchedId: candidate.id ?? null, kind: 'overlap' };
    }
  }

  return null;
}

/* Order is preserved: the caller's list order decides which copy of a
   duplicated workout is kept. Invalid rows are reported, never silently
   dropped and never coerced into something that looks like real data. */
export function planImport(
  workouts: readonly ExternalWorkout[],
  existing: readonly SessionLog[],
  importedAt: string,
): ImportPlan {
  const accepted: ImportedSession[] = [];
  const duplicates: ImportPlan['duplicates'] = [];
  const invalid: ImportPlan['invalid'] = [];

  const seen: SessionLog[] = [...existing];
  const acceptedIds = new Set<string>();

  for (const workout of workouts) {
    const reasons = validateWorkout(workout);
    if (reasons.length > 0) {
      invalid.push({ workout, reasons });
      continue;
    }

    const match = findDuplicate(workout, seen);
    if (match) {
      const kind =
        match.matchedId !== null && acceptedIds.has(match.matchedId)
          ? 'in-batch'
          : match.kind;
      duplicates.push({ workout, matchedId: match.matchedId, kind });
      continue;
    }

    const session = toSessionLog(workout, importedAt);
    accepted.push(session);
    acceptedIds.add(session.id);
    seen.push(session);
  }

  return { accepted, duplicates, invalid };
}
