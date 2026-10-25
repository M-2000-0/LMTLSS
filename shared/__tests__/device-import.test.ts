import {
  OVERLAP_START_TOLERANCE_MS,
  classifyActivity,
  findDuplicate,
  planImport,
  toSessionLog,
  validateWorkout,
  type ExternalWorkout,
} from '../src/device-import';
import type { ProviderId } from '../src/devices';
import type { SessionLog } from '../src/types';

const IMPORTED_AT = '2026-10-20T12:00:00.000Z';

function workout(overrides: Partial<ExternalWorkout> = {}): ExternalWorkout {
  return {
    provider: 'apple_health',
    externalId: 'hk-1',
    activityType: 37,
    startedAt: '2026-10-20T06:00:00.000Z',
    durationSec: 2700,
    distanceM: 8100,
    energyKcal: 610,
    avgHeartRate: 148,
    ...overrides,
  };
}

describe('activity classification', () => {
  it('maps HealthKit numeric codes', () => {
    expect(classifyActivity(37)).toEqual({ sport: 'running', mapped: true, sourceLabel: '37' });
    expect(classifyActivity(50).sport).toBe('strength');
    expect(classifyActivity(20).sport).toBe('strength');
    expect(classifyActivity(13).sport).toBe('cycling');
    expect(classifyActivity(46).sport).toBe('swimming');
    expect(classifyActivity(24).sport).toBe('other');
    expect(classifyActivity(24).mapped).toBe(true);
  });

  it('maps Health Connect and vendor strings regardless of casing or prefix', () => {
    expect(classifyActivity('EXERCISE_TYPE_RUNNING').sport).toBe('running');
    expect(classifyActivity('HKWorkoutActivityTypeTraditionalStrengthTraining').sport).toBe(
      'strength',
    );
    expect(classifyActivity('traditional_strength_training').sport).toBe('strength');
    expect(classifyActivity('BIKING_STATIONARY').sport).toBe('cycling');
    expect(classifyActivity('SWIMMING_OPEN_WATER').sport).toBe('swimming');
    expect(classifyActivity('hiit').sport).toBe('other');
    expect(classifyActivity('Pilates').mapped).toBe(true);
  });

  it('never guesses an unknown provider type into strength or running', () => {
    for (const value of [9999, 'SOMETHING_NEW', ''] as const) {
      const mapping = classifyActivity(value);
      expect(mapping.sport).toBe('other');
      expect(mapping.mapped).toBe(false);
      expect(mapping.sourceLabel).toBe(String(value));
    }
  });
});

describe('converting a workout to a session log', () => {
  it('keeps the reported numbers and marks device provenance', () => {
    const session = toSessionLog(workout(), IMPORTED_AT);
    expect(session.id).toBe('import:apple_health:hk-1');
    expect(session.sport).toBe('running');
    expect(session.startedAt).toBe('2026-10-20T06:00:00.000Z');
    expect(session.durationSec).toBe(2700);
    expect(session.distanceM).toBe(8100);
    expect(session.provenance).toBe('device');
    expect(session.source).toBe('apple_health');
    expect(session.externalId).toBe('hk-1');
    expect(session.metrics).toEqual({
      deviceDistanceM: 8100,
      energyKcal: 610,
      avgHeartRate: 148,
    });
  });

  it('labels distance by provider, never as GPS', () => {
    const session = toSessionLog(workout({ provider: 'garmin' }), IMPORTED_AT);
    expect(session.distanceSource).toBe('reported by Garmin');
    expect(session.distanceSource).not.toContain('GPS');
  });

  it('omits distance entirely when the device reported none', () => {
    const session = toSessionLog(
      workout({ distanceM: null, activityType: 50, title: 'Upper body' }),
      IMPORTED_AT,
    );
    expect(session.distanceM).toBeUndefined();
    expect(session.distanceSource).toBeUndefined();
    expect(session.title).toBe('Upper body');
    expect(session.sport).toBe('strength');
    expect(session.exercises).toEqual([]);
  });

  it('uses a neutral title when the provider sends none', () => {
    expect(toSessionLog(workout({ title: '   ' }), IMPORTED_AT).title).toBe('Run');
    expect(toSessionLog(workout({ activityType: 50, title: undefined }), IMPORTED_AT).title).toBe(
      'Strength session',
    );
  });
});

describe('validation', () => {
  it('accepts a well-formed workout', () => {
    expect(validateWorkout(workout())).toEqual([]);
  });

  it('rejects timestamps, durations and units that cannot be real', () => {
    expect(validateWorkout(workout({ startedAt: 'yesterday' }))).toContain(
      'Start time is not a valid ISO timestamp.',
    );
    expect(validateWorkout(workout({ durationSec: 0 }))).toContain(
      'Duration must be a positive number of seconds.',
    );
    expect(validateWorkout(workout({ durationSec: 8 * 24 * 60 * 60 }))).toContain(
      'Duration exceeds seven days — likely a unit error.',
    );
    expect(validateWorkout(workout({ distanceM: -1 }))).toContain(
      'Distance must be a non-negative number of metres.',
    );
    expect(validateWorkout(workout({ distanceM: 2_000_000 }))).toContain(
      'Distance exceeds 1,000 km — likely a unit error.',
    );
    expect(validateWorkout(workout({ avgHeartRate: 300 }))).toContain(
      'Average heart rate is outside 30–250 bpm.',
    );
    expect(validateWorkout(workout({ externalId: '  ' }))).toContain(
      'Missing provider workout id.',
    );
  });

  it('rejects an unknown provider id instead of trusting the payload', () => {
    const unknown = workout({ provider: 'nike_run_club' as unknown as ProviderId });
    expect(validateWorkout(unknown)).toContain('Unknown provider.');
  });
});

describe('deduplication', () => {
  const existing: SessionLog[] = [
    {
      id: 'import:garmin:g-77',
      source: 'garmin',
      externalId: 'g-77',
      sport: 'running',
      startedAt: '2026-10-20T06:00:00.000Z',
      durationSec: 2700,
      distanceM: 8100,
    },
  ];

  it('matches the same provider id exactly', () => {
    const match = findDuplicate(
      workout({ provider: 'garmin', externalId: 'g-77' }),
      existing,
    );
    expect(match).toEqual({ matchedId: 'import:garmin:g-77', kind: 'external-id' });
  });

  it('does not match the same external id from a different provider at a different time', () => {
    const match = findDuplicate(
      workout({ externalId: 'g-77', startedAt: '2026-10-25T06:00:00.000Z' }),
      existing,
    );
    expect(match).toBeNull();
  });

  it('matches the same run arriving from another source within tolerance', () => {
    const match = findDuplicate(
      workout({ provider: 'strava', externalId: 's-1', startedAt: '2026-10-20T06:03:00.000Z' }),
      existing,
    );
    expect(match?.kind).toBe('overlap');
  });

  it('does not merge runs that start far apart, differ in sport, or differ in length', () => {
    expect(
      findDuplicate(
        workout({
          externalId: 's-2',
          startedAt: new Date(
            Date.parse('2026-10-20T06:00:00.000Z') + OVERLAP_START_TOLERANCE_MS + 1000,
          ).toISOString(),
        }),
        existing,
      ),
    ).toBeNull();

    expect(
      findDuplicate(workout({ externalId: 's-3', activityType: 13 }), existing),
    ).toBeNull();

    expect(
      findDuplicate(workout({ externalId: 's-4', durationSec: 3600 }), existing),
    ).toBeNull();
  });

  it('keeps a strength session separate from a run at the same time', () => {
    expect(
      findDuplicate(workout({ externalId: 's-5', activityType: 50 }), existing),
    ).toBeNull();
  });
});

describe('import planning', () => {
  it('accepts new rows, reports duplicates and rejects invalid rows', () => {
    const existing: SessionLog[] = [
      {
        id: 'import:garmin:g-77',
        source: 'garmin',
        externalId: 'g-77',
        sport: 'running',
        startedAt: '2026-10-20T06:00:00.000Z',
        durationSec: 2700,
      },
    ];

    const plan = planImport(
      [
        workout({ provider: 'garmin', externalId: 'g-77' }),
        workout({ provider: 'health_connect', externalId: 'hc-2', startedAt: '2026-10-21T06:00:00.000Z' }),
        workout({ externalId: 'bad', durationSec: 0 }),
      ],
      existing,
      IMPORTED_AT,
    );

    expect(plan.accepted).toHaveLength(1);
    expect(plan.accepted[0].id).toBe('import:health_connect:hc-2');
    expect(plan.duplicates).toHaveLength(1);
    expect(plan.duplicates[0].kind).toBe('external-id');
    expect(plan.invalid).toHaveLength(1);
    expect(plan.invalid[0].reasons).toContain(
      'Duration must be a positive number of seconds.',
    );
  });

  it('reports a duplicate inside the same batch instead of counting it twice', () => {
    const plan = planImport(
      [
        workout({ provider: 'apple_health', externalId: 'hk-9' }),
        workout({ provider: 'strava', externalId: 'st-9', startedAt: '2026-10-20T06:02:00.000Z' }),
      ],
      [],
      IMPORTED_AT,
    );

    expect(plan.accepted).toHaveLength(1);
    expect(plan.duplicates).toEqual([
      {
        workout: expect.objectContaining({ externalId: 'st-9' }),
        matchedId: 'import:apple_health:hk-9',
        kind: 'in-batch',
      },
    ]);
  });

  it('preserves caller order and never mutates the existing log', () => {
    const existing: SessionLog[] = [];
    const later = workout({ externalId: 'a', startedAt: '2026-10-22T06:00:00.000Z' });
    const earlier = workout({ externalId: 'b', startedAt: '2026-10-21T06:00:00.000Z' });

    const plan = planImport([later, earlier], existing, IMPORTED_AT);
    expect(plan.accepted.map((row) => row.externalId)).toEqual(['a', 'b']);
    expect(existing).toEqual([]);
  });

  it('keeps an unrecognised workout as "other" with the flag set', () => {
    const plan = planImport(
      [workout({ externalId: 'x', activityType: 'MYSTERY_SPORT' })],
      [],
      IMPORTED_AT,
    );
    expect(plan.accepted[0].sport).toBe('other');
    expect(plan.accepted[0].sportMapped).toBe(false);
  });
});
