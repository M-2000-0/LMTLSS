import type { AppState } from '../../shared/src/types';
import { fuelSummary, nextPlannedSession } from '../src/domain';
import { createAppStore } from '../src/store/appStore';
import { migrate } from '../src/store/schema';
import type { LoadResult, StoreStorage, WriteResult } from '../src/store/storage';

const DAY = '2026-10-19';

interface MemoryStorage extends StoreStorage {
  raw(): string | null;
  failNextWrite(message?: string): void;
  quarantineOnRead(reason: string): void;
}

/* Same contract as the AsyncStorage adapter, in memory: it stores the JSON
   document, and reads run through the real migration so the tests exercise
   the same code path a cold start does. */
function memoryStorage(): MemoryStorage {
  let raw: string | null = null;
  let failMessage: string | null = null;
  let pendingQuarantine: string | null = null;

  return {
    async read(): Promise<LoadResult> {
      if (pendingQuarantine) {
        const reason = pendingQuarantine;
        pendingQuarantine = null;
        return { state: migrate(undefined).state, quarantine: reason };
      }
      if (!raw) return { state: migrate(undefined).state };
      return { state: migrate(JSON.parse(raw)).state };
    },
    async write(state: AppState): Promise<WriteResult> {
      if (failMessage) {
        const message = failMessage;
        failMessage = null;
        return { ok: false, message };
      }
      raw = JSON.stringify(state);
      return { ok: true };
    },
    raw: () => raw,
    failNextWrite(message = 'device storage is full') {
      failMessage = message;
    },
    quarantineOnRead(reason: string) {
      pendingQuarantine = reason;
    },
  };
}

const PROFILE = {
  name: 'Patri',
  goal: 'strength' as const,
  sports: ['strength', 'running'],
  experience: 'intermediate' as const,
  daysPerWeek: 4,
  equipment: ['full-gym'],
};

describe('app store', () => {
  it('hydrates empty storage into a usable, current-version state', async () => {
    const store = createAppStore(memoryStorage(), () => DAY);
    const snapshot = await store.hydrate();

    expect(snapshot.ready).toBe(true);
    expect(snapshot.state.version).toBe(1);
    expect(snapshot.state.profile).toBeNull();
    expect(snapshot.quarantine).toBeNull();
    expect(snapshot.storageError).toBeNull();
  });

  it('generates a real plan from onboarding and persists it', async () => {
    const storage = memoryStorage();
    const store = createAppStore(storage, () => DAY);
    await store.hydrate();

    store.completeOnboarding(PROFILE);
    await store.whenIdle();

    const state = store.getSnapshot().state;
    expect(state.profile?.name).toBe('Patri');
    expect(state.profile?.daysPerWeek).toBe(4);
    expect(state.plan?.sessions).toHaveLength(4);
    // Every session came from the domain, not from the screen.
    expect(state.plan?.sessions.every((s) => !!s.title && !!s.day)).toBe(true);
    expect(state.plan?.sessions.some((s) => s.sport === 'running')).toBe(true);

    const saved = JSON.parse(storage.raw() ?? '{}');
    expect(saved.version).toBe(1);
    expect(saved.profile.goal).toBe('strength');
    expect(saved.plan.sessions).toHaveLength(4);
  });

  it('restores profile, readiness and hydration after a restart', async () => {
    const storage = memoryStorage();
    const first = createAppStore(storage, () => DAY);
    await first.hydrate();
    first.completeOnboarding(PROFILE);
    first.logReadiness({ energy: 4 });
    first.addHydration(500);
    await first.whenIdle();

    // A fresh store over the persisted document is what a cold start does.
    const persisted = storage.raw();
    const second = createAppStore(
      {
        read: async () => ({ state: migrate(JSON.parse(persisted ?? '{}')).state }),
        write: async () => ({ ok: true }),
      },
      () => DAY,
    );
    const snapshot = await second.hydrate();

    expect(snapshot.state.profile?.name).toBe('Patri');
    expect(snapshot.state.readiness).toEqual([{ date: DAY, energy: 4 }]);
    expect(snapshot.state.hydration).toEqual([{ date: DAY, ml: 500 }]);
  });

  it('wires the domain to the live store state', async () => {
    const store = createAppStore(memoryStorage(), () => DAY);
    await store.hydrate();
    store.completeOnboarding(PROFILE);
    store.addHydration(250);
    store.addHydration(500);
    await store.whenIdle();

    // These read through getPlatformBindings().getState(), i.e. the store.
    expect(nextPlannedSession(store.getSnapshot().state)).not.toBeNull();
    const fuel = fuelSummary(store.getSnapshot().state);
    expect(fuel.date).toBe(DAY);
    expect(fuel.hydrationMl).toBe(750);
    expect(fuel.hydrationLogged).toBe(true);
  });

  it('upserts readiness for the local day instead of appending duplicates', async () => {
    const store = createAppStore(memoryStorage(), () => DAY);
    await store.hydrate();

    store.logReadiness({ energy: 2 });
    store.logReadiness({ energy: 4, soreness: 3 });
    await store.whenIdle();

    const rows = store.getSnapshot().state.readiness ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ date: DAY, energy: 4, soreness: 3 });
  });

  it('keeps one hydration row per day and sums additions', async () => {
    const store = createAppStore(memoryStorage(), () => DAY);
    await store.hydrate();

    store.addHydration(250);
    store.addHydration(250);
    store.addHydration(-100); // rejected: hydration is only ever added
    store.addHydration(Number.NaN); // rejected
    await store.whenIdle();

    expect(store.getSnapshot().state.hydration).toEqual([{ date: DAY, ml: 500 }]);
  });

  it('keeps the change in memory and reports a failed write', async () => {
    const storage = memoryStorage();
    const store = createAppStore(storage, () => DAY);
    await store.hydrate();

    storage.failNextWrite('device storage is full');
    store.addHydration(500);
    await store.whenIdle();

    const snapshot = store.getSnapshot();
    // The athlete's entry is never lost to a failed write…
    expect(snapshot.state.hydration).toEqual([{ date: DAY, ml: 500 }]);
    // …and the failure is surfaced rather than swallowed.
    expect(snapshot.storageError).toBe('device storage is full');

    // A later successful write clears the banner.
    store.addHydration(250);
    await store.whenIdle();
    expect(store.getSnapshot().storageError).toBeNull();
    expect(storage.raw()).toContain('"ml":750');
  });

  it('surfaces quarantined storage instead of pretending it is empty', async () => {
    const storage = memoryStorage();
    storage.quarantineOnRead('written by a newer version (v2)');
    const store = createAppStore(storage, () => DAY);

    const snapshot = await store.hydrate();
    expect(snapshot.ready).toBe(true);
    expect(snapshot.quarantine).toBe('written by a newer version (v2)');
  });
});
