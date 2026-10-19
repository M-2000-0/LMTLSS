import { MIGRATIONS, SCHEMA_VERSION, emptyState, migrate } from '../src/store/schema';

describe('persisted schema', () => {
  it('starts a fresh state at the current version with every collection present', () => {
    const state = emptyState();
    expect(state.version).toBe(SCHEMA_VERSION);
    expect(state.profile).toBeNull();
    expect(state.readiness).toEqual([]);
    expect(state.hydration).toEqual([]);
    expect(state.meals).toEqual([]);
    expect(state.activeSession).toBeNull();
    expect(state.settings).toEqual({ unit: 'metric', restSeconds: 90, weekStart: 'mon' });
  });

  it('accepts a current-version payload and fills defaults without dropping stored fields', () => {
    const stored = {
      version: SCHEMA_VERSION,
      readiness: [{ date: '2026-10-19', energy: 4 }],
      profile: { goal: 'strength', sports: ['strength'], experience: 'beginner', daysPerWeek: 3, equipment: ['full-gym'] },
      somethingNewer: { kept: true },
      settings: { restSeconds: 120 },
    };

    const result = migrate(stored);

    expect(result.quarantine).toBeUndefined();
    expect(result.state.readiness).toEqual([{ date: '2026-10-19', energy: 4 }]);
    expect(result.state.profile?.goal).toBe('strength');
    // Unknown-but-parseable fields survive a round trip.
    expect(result.state.somethingNewer).toEqual({ kept: true });
    // Missing collections come from the empty state rather than being undefined.
    expect(result.state.meals).toEqual([]);
    expect(result.state.hydration).toEqual([]);
    // Partial settings keep their defaults.
    expect(result.state.settings).toEqual({ unit: 'metric', restSeconds: 120, weekStart: 'mon' });
  });

  it('quarantines a payload written by a newer version instead of downgrading it', () => {
    const result = migrate({ version: SCHEMA_VERSION + 1, readiness: [{ date: '2026-10-19' }] });
    expect(result.quarantine).toContain('newer version');
    expect(result.state.readiness).toEqual([]);
  });

  it('quarantines non-objects and missing/invalid versions', () => {
    expect(migrate(null).quarantine).toBe('payload is not an object');
    expect(migrate([{ version: 1 }]).quarantine).toBe('payload is not an object');
    expect(migrate({}).quarantine).toBe('missing or invalid version');
    expect(migrate({ version: '1' }).quarantine).toBe('missing or invalid version');
    expect(migrate({ version: 0 }).quarantine).toBe('missing or invalid version');
  });

  it('declares no migration steps while the schema is at v1', () => {
    // A bump without a step here is the failure this test exists to catch.
    expect(SCHEMA_VERSION).toBe(1);
    expect(Object.keys(MIGRATIONS)).toEqual([]);
  });
});
