import {
  detectKind,
  parseFit,
  parseGpx,
  parseTcx,
  parseWorkoutFile,
  toExternalWorkouts,
} from '../src/file-import';
import { planImport } from '../src/device-import';

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Morning</name></metadata>
  <trk>
    <name>Morning Run</name>
    <type>running</type>
    <trkseg>
      <trkpt lat="51.5000" lon="-0.1200"><time>2026-10-20T06:00:00Z</time></trkpt>
      <trkpt lat="51.5010" lon="-0.1200"><time>2026-10-20T06:05:00Z</time></trkpt>
      <trkpt lat="51.5020" lon="-0.1200"><time>2026-10-20T06:10:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const TCX = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>2026-10-20T06:00:00Z</Id>
      <Lap StartTime="2026-10-20T06:00:00Z">
        <TotalTimeSeconds>600</TotalTimeSeconds>
        <DistanceMeters>2000</DistanceMeters>
        <Calories>120</Calories>
        <AverageHeartRateBpm><Value>145</Value></AverageHeartRateBpm>
      </Lap>
      <Lap StartTime="2026-10-20T06:10:00Z">
        <TotalTimeSeconds>300</TotalTimeSeconds>
        <DistanceMeters>1000</DistanceMeters>
        <Calories>60</Calories>
        <AverageHeartRateBpm><Value>155</Value></AverageHeartRateBpm>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

/** Minimal but structurally valid FIT file: one session message. */
function buildFit(startSec: number, elapsedMs: number, distanceCm: number, sport = 1): Uint8Array {
  const data: number[] = [
    0x40, 0x00, 0x00, 0x12, 0x00, 0x04,
    0x02, 0x04, 0x86, // start_time, uint32
    0x07, 0x04, 0x86, // total_elapsed_time, uint32 (ms)
    0x09, 0x04, 0x86, // total_distance, uint32 (cm)
    0x05, 0x01, 0x00, // sport, enum
  ];
  data.push(0x00);
  for (const value of [startSec, elapsedMs, distanceCm]) {
    data.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
  }
  data.push(sport);

  const header = [
    12, 0x10, 0x00, 0x00,
    data.length & 0xff, (data.length >>> 8) & 0xff, (data.length >>> 16) & 0xff, (data.length >>> 24) & 0xff,
    0x2e, 0x46, 0x49, 0x54, // .FIT
  ];
  return new Uint8Array([...header, ...data]);
}

/** Minimal FIT file with only record messages (no session summary). */
function buildFitRecords(t1: number, t2: number, d1: number, d2: number): Uint8Array {
  const data: number[] = [
    0x40, 0x00, 0x00, 0x14, 0x00, 0x02,
    0xfd, 0x04, 0x86, // timestamp, uint32
    0x05, 0x04, 0x86, // cumulative distance, uint32 (cm)
  ];
  for (const point of [
    { time: t1, distance: d1 },
    { time: t2, distance: d2 },
  ]) {
    data.push(0x00);
    for (const value of [point.time, point.distance]) {
      data.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
    }
  }

  const header = [
    12, 0x10, 0x00, 0x00,
    data.length & 0xff, (data.length >>> 8) & 0xff, (data.length >>> 16) & 0xff, (data.length >>> 24) & 0xff,
    0x2e, 0x46, 0x49, 0x54, // .FIT
  ];
  return new Uint8Array([...header, ...data]);
}

describe('GPX import', () => {
  it('reads start, duration, distance, and sport from track points', () => {
    const result = parseGpx(GPX);
    expect(result.warnings).toEqual([]);
    expect(result.workouts).toHaveLength(1);
    const workout = result.workouts[0];
    expect(workout.startedAt).toBe('2026-10-20T06:00:00.000Z');
    expect(workout.durationSec).toBe(600);
    expect(workout.sport).toBe('running');
    expect(workout.distanceM).toBeGreaterThan(220);
    expect(workout.distanceM).toBeLessThan(225);
  });

  it('rejects track points without timestamps instead of guessing a duration', () => {
    const undated = GPX.replace(/<time>[^<]+<\/time>/g, '');
    const result = parseGpx(undated);
    expect(result.workouts).toEqual([]);
    expect(result.warnings[0]).toMatch(/no timestamps/i);
  });

  it('rejects a document that is not GPX', () => {
    const result = parseGpx('<foo><bar/></foo>');
    expect(result.workouts).toEqual([]);
    expect(result.warnings[0]).toMatch(/does not look like a GPX/i);
  });
});

describe('TCX import', () => {
  it('sums laps and keeps calories and average heart rate', () => {
    const result = parseTcx(TCX);
    expect(result.warnings).toEqual([]);
    expect(result.workouts).toHaveLength(1);
    const workout = result.workouts[0];
    expect(workout.startedAt).toBe('2026-10-20T06:00:00.000Z');
    expect(workout.durationSec).toBe(900);
    expect(workout.distanceM).toBe(3000);
    expect(workout.energyKcal).toBe(180);
    expect(workout.avgHeartRate).toBe(150);
    expect(workout.sport).toBe('running');
  });

  it('skips an activity with no positive lap duration and says why', () => {
    const noDuration = TCX.replace(/<TotalTimeSeconds>[^<]+<\/TotalTimeSeconds>/g, '');
    const result = parseTcx(noDuration);
    expect(result.workouts).toEqual([]);
    expect(result.warnings[0]).toMatch(/no positive lap duration/i);
  });

  it('rejects a document that is not TCX', () => {
    const result = parseTcx('<foo/>');
    expect(result.workouts).toEqual([]);
    expect(result.warnings[0]).toMatch(/does not look like a TCX/i);
  });
});

describe('FIT import', () => {
  const startSec = 1_000_000_000;
  const expectedStart = new Date(Date.UTC(1989, 11, 31) + startSec * 1000).toISOString();

  it('reads a session message, converting ms and centimetres', () => {
    const result = parseFit(buildFit(startSec, 1_800_000, 500_000, 1));
    expect(result.warnings).toEqual([]);
    expect(result.workouts).toHaveLength(1);
    const workout = result.workouts[0];
    expect(workout.startedAt).toBe(expectedStart);
    expect(workout.durationSec).toBe(1800);
    expect(workout.distanceM).toBe(5000);
    expect(workout.sport).toBe('running');
  });

  it('maps a cycling session without inventing distance', () => {
    const result = parseFit(buildFit(startSec, 600_000, 0, 2));
    expect(result.workouts[0].sport).toBe('cycling');
    expect(result.workouts[0].distanceM).toBe(0);
  });

  it('rejects a file without the .FIT signature', () => {
    const broken = buildFit(startSec, 600_000, 0, 1);
    broken[8] = 0x00;
    const result = parseFit(broken);
    expect(result.workouts).toEqual([]);
    expect(result.warnings[0]).toMatch(/signature/i);
  });

  it('rejects a truncated data section', () => {
    const broken = buildFit(startSec, 600_000, 0, 1).slice(0, 20);
    const result = parseFit(broken);
    expect(result.workouts).toEqual([]);
    expect(result.warnings[0]).toMatch(/truncated|invalid/i);
  });

  it('derives a summary from track records when no session message exists', () => {
    const result = parseFit(buildFitRecords(startSec, startSec + 600, 0, 500_000));
    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0].startedAt).toBe(expectedStart);
    expect(result.workouts[0].durationSec).toBe(600);
    expect(result.workouts[0].distanceM).toBe(5000);
    expect(result.workouts[0].sport).toBe('other');
    expect(result.warnings[0]).toMatch(/No session message/i);
  });
});

describe('file dispatch', () => {
  it('detects by extension, FIT magic, and XML root', () => {
    expect(detectKind({ name: 'run.gpx', text: GPX })).toBe('gpx');
    expect(detectKind({ name: 'run.tcx', text: TCX })).toBe('tcx');
    expect(detectKind({ name: 'run.fit', bytes: buildFit(1, 1000, 100, 1) })).toBe('fit');
    expect(detectKind({ name: 'export.bin', bytes: buildFit(1, 1000, 100, 1) })).toBe('fit');
    expect(detectKind({ name: 'export.xml', text: TCX })).toBe('tcx');
  });

  it('refuses unsupported and empty files with a reason', () => {
    expect(parseWorkoutFile({ name: 'notes.txt', text: 'hello' }).warnings[0]).toMatch(/Unsupported file/i);
    expect(parseWorkoutFile({ name: 'empty.gpx', text: '' }).warnings[0]).toMatch(/empty/i);
  });

  it('requires bytes for a FIT file', () => {
    const result = parseWorkoutFile({ name: 'run.fit', text: 'not really a fit file' });
    expect(result.kind).toBe('fit');
    expect(result.warnings[0]).toMatch(/binary/i);
  });

  it('refuses an empty selection before it looks at the extension', () => {
    const result = parseWorkoutFile({ name: 'run.fit' });
    expect(result.kind).toBeNull();
    expect(result.warnings[0]).toMatch(/empty/i);
  });
});

describe('import pipeline', () => {
  it('turns a file into a device-provenance session and dedupes a re-import', () => {
    const parsed = parseGpx(GPX);
    const external = toExternalWorkouts(parsed.workouts);
    expect(external[0].provider).toBe('file_import');

    const first = planImport(external, [], '2026-10-20T07:00:00Z');
    expect(first.accepted).toHaveLength(1);
    expect(first.invalid).toEqual([]);
    expect(first.accepted[0].provenance).toBe('device');
    expect(first.accepted[0].source).toBe('file_import');
    expect(first.accepted[0].distanceSource).toBe('reported by FIT / TCX / GPX file');
    expect(first.accepted[0].exercises).toEqual([]);

    const second = planImport(external, first.accepted, '2026-10-20T07:05:00Z');
    expect(second.accepted).toEqual([]);
    expect(second.duplicates[0].kind).toBe('external-id');
  });
});
