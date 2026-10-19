/* Persisted state schema — a deliberate mirror of js/store.js.

   Same key space, same version number, same migration contract:
     - a version bump MUST add a MIGRATIONS step (data is never discarded to
       make an old payload go away),
     - anything unreadable is quarantined (raw bytes preserved) instead of
       being silently replaced,
     - unknown-but-parseable fields survive, so a newer payload read by an
       older binary loses nothing it understands.

   Keep this file pure: no storage, no React, no platform imports. */

import type { AppState } from '../../../shared/src/types';

export const SCHEMA_VERSION = 1;

export type MigrationStep = (state: Record<string, unknown>) => Record<string, unknown>;

/* MIGRATIONS[n] upgrades a version-n payload to version n+1. */
export const MIGRATIONS: Record<number, MigrationStep> = {};

/** Same shape as js/store.js emptyState(). */
export function emptyState(): AppState {
  return {
    version: SCHEMA_VERSION,
    profile: null,
    plan: { sessions: [] },
    weekPlan: null,
    log: [],
    readiness: [],
    hydration: [],
    meals: [],
    recoveryActions: [],
    activeSession: null,
    coachThread: [],
    settings: { unit: 'metric', restSeconds: 90, weekStart: 'mon' },
    meta: { createdAt: new Date().toISOString() },
  };
}

export interface MigrationResult {
  state: AppState;
  /** Present when the payload could not be used; `state` is then a fresh one. */
  quarantine?: string;
}

/**
 * Pure: parsed payload -> usable state, or a fresh state plus a reason.
 * Never throws, never discards silently. Callers must preserve the raw bytes
 * of anything that comes back with `quarantine` set.
 */
export function migrate(parsed: unknown): MigrationResult {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { state: emptyState(), quarantine: 'payload is not an object' };
  }

  const payload = parsed as Record<string, unknown>;
  const version = payload.version;

  if (typeof version !== 'number' || version < 1) {
    return { state: emptyState(), quarantine: 'missing or invalid version' };
  }
  if (version > SCHEMA_VERSION) {
    return { state: emptyState(), quarantine: 'written by a newer version (v' + version + ')' };
  }

  let current = payload;
  for (let v = version; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) return { state: emptyState(), quarantine: 'no migration path from v' + version };
    current = step(current);
  }

  const withVersion: Record<string, unknown> = { ...current, version: SCHEMA_VERSION };
  const base = emptyState();
  const settings = withVersion.settings;
  return {
    state: {
      ...base,
      ...withVersion,
      settings: {
        ...base.settings,
        ...(settings && typeof settings === 'object' ? settings : {}),
      },
    } as AppState,
  };
}
