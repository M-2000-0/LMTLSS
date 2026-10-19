/* Persistence adapter — AsyncStorage, one JSON document, same keys as the web
   store (js/store.js). Everything here is async because the platform API is;
   the domain stays synchronous by reading the in-memory state it is given.

   Failure policy (matches the web store):
     - a write that fails is reported to the UI, never swallowed; the caller
       keeps the change in memory so a workout is not lost,
     - an unreadable payload is copied to the quarantine key *before* the app
       starts writing again, so the bytes remain recoverable,
     - storage that cannot be opened at all still yields a usable empty state. */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppState } from '../../../shared/src/types';
import { emptyState, migrate } from './schema';

export const STORAGE_KEY = 'lmtlss:v1';
export const QUARANTINE_KEY = 'lmtlss:v1:quarantine';

export const STORAGE_UNAVAILABLE =
  "Local storage is unavailable on this device, so nothing can be saved. Changes stay in memory only.";
export const WRITE_FAILED =
  "Couldn't save to this device — storage may be full. Your last change is held in memory only.";

export interface LoadResult {
  state: AppState;
  /** Set when stored bytes existed but could not be used. */
  quarantine?: string;
  /** Set when storage itself failed (distinct from unreadable payload). */
  storageError?: string;
}

export interface WriteResult {
  ok: boolean;
  message?: string;
}

/** Seam the app store depends on; tests use an in-memory implementation. */
export interface StoreStorage {
  read(): Promise<LoadResult>;
  write(state: AppState): Promise<WriteResult>;
}

/** Preserve the raw bytes of an unusable payload. Returns an error note if it fails. */
async function quarantinePayload(raw: string, reason: string): Promise<string | undefined> {
  try {
    await AsyncStorage.setItem(
      QUARANTINE_KEY,
      JSON.stringify({ reason, at: new Date().toISOString(), payload: raw }),
    );
    return undefined;
  } catch {
    return "The saved data couldn't be set aside, so it may be overwritten on the next change.";
  }
}

export async function readState(): Promise<LoadResult> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return { state: emptyState(), storageError: STORAGE_UNAVAILABLE };
  }

  if (!raw) return { state: emptyState() };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const note = await quarantinePayload(raw, 'unparseable JSON');
    return { state: emptyState(), quarantine: 'saved data was unreadable', storageError: note };
  }

  const result = migrate(parsed);
  if (!result.quarantine) return { state: result.state };

  const note = await quarantinePayload(raw, result.quarantine);
  return { state: result.state, quarantine: result.quarantine, storageError: note };
}

export async function writeState(state: AppState): Promise<WriteResult> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch {
    return { ok: false, message: WRITE_FAILED };
  }
}

export function asyncStorageAdapter(): StoreStorage {
  return { read: readState, write: writeState };
}
