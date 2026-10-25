/* FIT / TCX / GPX import — pure parsing, no DOM, no dependencies.

   Why this path first: it is the only watch route that needs no vendor
   approval, no OAuth client, and no deployed server. The athlete exports a
   file from Garmin Connect, Polar Flow, COROS, Suunto, Strava, Apple Health,
   or any other tool that writes a standard format, and LMTLSS reads it
   locally. Nothing is uploaded.

   Rules:

   1. Parse only what the file actually says. Missing distance stays missing;
      a GPX with no timestamps cannot produce a duration, so it is rejected
      with a reason instead of being guessed.
   2. Keep provenance explicit. Every workout is `file_import`; the original
      file name and sport label are preserved for display.
   3. Be strict about structure. These are untrusted bytes: header sizes,
      declared lengths, field widths, and timestamps are validated before
      anything becomes a workout. */

import { haversineM } from './geo';
import type { ExternalWorkout } from './device-import';

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

export type WorkoutFileKind = 'fit' | 'tcx' | 'gpx';

export interface FileWorkout {
  /** ISO 8601 with Z. */
  startedAt: string;
  durationSec: number;
  distanceM?: number;
  /** The provider's own sport label, e.g. "Running" or "cycling". */
  sport: string;
  title?: string;
  energyKcal?: number;
  avgHeartRate?: number;
  /** Deterministic across re-imports of the same file. */
  externalId: string;
}

export interface ParseResult {
  kind: WorkoutFileKind | null;
  workouts: FileWorkout[];
  warnings: string[];
}

export interface WorkoutFileInput {
  name: string;
  /** Text formats. Ignored for FIT. */
  text?: string;
  /** FIT (and any binary format) bytes. */
  bytes?: Uint8Array;
}

function emptyResult(kind: WorkoutFileKind | null, warning: string): ParseResult {
  return { kind, workouts: [], warnings: [warning] };
}

/* ---------- shared helpers ---------- */

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeXml(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    return XML_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Matches an optionally namespace-prefixed tag, case-insensitively. */
function tagPattern(name: string, flags = 'i'): RegExp {
  return new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${name}\\b([^>]*)>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${name}\\s*>`, flags);
}

function firstTag(xml: string, name: string): { attrs: string; body: string } | null {
  const match = tagPattern(name).exec(xml);
  if (!match) return null;
  return { attrs: match[1], body: match[2] };
}

function allTags(xml: string, name: string): { attrs: string; body: string }[] {
  const out: { attrs: string; body: string }[] = [];
  const re = tagPattern(name, 'gi');
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) out.push({ attrs: match[1], body: match[2] });
  return out;
}

function firstText(xml: string, name: string): string | null {
  const tag = firstTag(xml, name);
  return tag ? decodeXml(tag.body).trim() : null;
}

function attr(attrs: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(attrs);
  if (!match) return null;
  return decodeXml(match[2] ?? match[3] ?? '').trim();
}

function parseIsoMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function positive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function externalId(kind: WorkoutFileKind, startMs: number, durationSec: number, distanceM: number | null): string {
  const km = distanceM == null ? 'nodist' : round(distanceM / 1000, 2).toFixed(2);
  return `${kind}:${Math.round(startMs / 1000)}:${Math.round(durationSec)}:${km}`;
}

function sportKey(raw: string | null | undefined): string {
  if (!raw) return 'other';
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
}

/* ---------- GPX ---------- */

export function parseGpx(xml: string): ParseResult {
  if (!/<gpx\b/i.test(xml)) {
    return emptyResult('gpx', 'This does not look like a GPX file (no <gpx> root).');
  }

  const points = allTags(xml, 'trkpt').map((point) => {
    const lat = Number.parseFloat(attr(point.attrs, 'lat') ?? '');
    const lon = Number.parseFloat(attr(point.attrs, 'lon') ?? '');
    const time = parseIsoMs(firstText(point.body, 'time'));
    return { lat, lon, time };
  });

  if (points.length < 2) {
    return emptyResult('gpx', 'GPX has fewer than two track points, so no route can be read.');
  }

  const timed = points.filter((p) => p.time !== null);
  if (timed.length < 2) {
    return emptyResult('gpx', 'GPX track points have no timestamps, so duration cannot be known.');
  }

  const startMs = timed[0].time as number;
  const endMs = timed[timed.length - 1].time as number;
  const durationSec = (endMs - startMs) / 1000;
  if (!(durationSec > 0)) {
    return emptyResult('gpx', 'GPX start and end timestamps do not span a positive duration.');
  }

  let distanceM = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon) || !Number.isFinite(b.lat) || !Number.isFinite(b.lon)) {
      continue;
    }
    distanceM += haversineM(a.lat, a.lon, b.lat, b.lon);
  }

  const type = firstText(xml, 'type');
  const name = firstText(xml, 'name');
  const sport = sportKey(type);

  return {
    kind: 'gpx',
    workouts: [
      {
        startedAt: iso(startMs),
        durationSec: round(durationSec, 3),
        distanceM: round(distanceM, 1),
        sport,
        title: name && name.length > 0 ? name : undefined,
        externalId: externalId('gpx', startMs, durationSec, distanceM),
      },
    ],
    warnings: [],
  };
}

/* ---------- TCX ---------- */

export function parseTcx(xml: string): ParseResult {
  if (!/<TrainingCenterDatabase\b/i.test(xml)) {
    return emptyResult('tcx', 'This does not look like a TCX file (no TrainingCenterDatabase root).');
  }

  const activities = allTags(xml, 'Activity');
  if (activities.length === 0) {
    return emptyResult('tcx', 'TCX has no <Activity> element.');
  }

  const workouts: FileWorkout[] = [];
  const warnings: string[] = [];

  activities.forEach((activity, index) => {
    const sportRaw = attr(activity.attrs, 'Sport') ?? 'other';
    const laps = allTags(activity.body, 'Lap');

    let startMs: number | null = null;
    let durationSec = 0;
    let distanceM = 0;
    let calories = 0;
    let hrSum = 0;
    let hrCount = 0;
    let sawLapData = false;

    laps.forEach((lap) => {
      const lapStart = parseIsoMs(attr(lap.attrs, 'StartTime'));
      if (startMs === null && lapStart !== null) startMs = lapStart;

      const lapDuration = Number.parseFloat(firstText(lap.body, 'TotalTimeSeconds') ?? '');
      const lapDistance = Number.parseFloat(firstText(lap.body, 'DistanceMeters') ?? '');
      const lapCalories = Number.parseFloat(firstText(lap.body, 'Calories') ?? '');
      const hrTag = firstTag(lap.body, 'AverageHeartRateBpm');
      const lapHr = hrTag ? Number.parseFloat(firstText(hrTag.body, 'Value') ?? '') : Number.NaN;

      if (Number.isFinite(lapDuration) && lapDuration > 0) {
        durationSec += lapDuration;
        sawLapData = true;
      }
      if (Number.isFinite(lapDistance) && lapDistance >= 0) distanceM += lapDistance;
      if (Number.isFinite(lapCalories) && lapCalories > 0) calories += lapCalories;
      if (Number.isFinite(lapHr) && lapHr >= 30 && lapHr <= 250) {
        hrSum += lapHr;
        hrCount += 1;
      }
    });

    if (startMs === null) {
      const firstTrackpoint = firstText(activity.body, 'Time');
      startMs = parseIsoMs(firstTrackpoint);
    }

    if (startMs === null) {
      warnings.push(`TCX activity ${index + 1} has no start time; skipped.`);
      return;
    }
    if (!sawLapData) {
      warnings.push(`TCX activity ${index + 1} has no positive lap duration; skipped.`);
      return;
    }

    const avgHeartRate = hrCount > 0 ? round(hrSum / hrCount, 0) : undefined;

    workouts.push({
      startedAt: iso(startMs),
      durationSec: round(durationSec, 3),
      distanceM: distanceM > 0 ? round(distanceM, 1) : undefined,
      sport: sportKey(sportRaw),
      energyKcal: calories > 0 ? round(calories, 0) : undefined,
      avgHeartRate,
      externalId: externalId('tcx', startMs, durationSec, distanceM > 0 ? distanceM : null),
    });
  });

  if (workouts.length === 0) {
    return { kind: 'tcx', workouts: [], warnings: warnings.length ? warnings : ['TCX contained no importable activity.'] };
  }
  return { kind: 'tcx', workouts, warnings };
}

/* ---------- FIT ---------- */

const FIT_EPOCH_MS = Date.UTC(1989, 11, 31, 0, 0, 0);
const FIT_HEADER_SIZE = 12;
const FIT_HEADER_SIZE_WITH_CRC = 14;

interface FitFieldDef {
  number: number;
  size: number;
  baseType: number;
}

interface FitDefinition {
  littleEndian: boolean;
  globalMessage: number;
  fields: FitFieldDef[];
}

interface FitSession {
  startTime?: number;
  elapsedSec?: number;
  timerSec?: number;
  distanceM?: number;
  sport?: number;
  subSport?: number;
  calories?: number;
  avgHeartRate?: number;
}

interface FitRecordSummary {
  firstTime?: number;
  lastTime?: number;
  distanceM?: number;
}

function readUInt(bytes: Uint8Array, offset: number, size: number, littleEndian: boolean): number {
  if (size < 1 || size > 8) return 0;
  let value = 0;
  if (littleEndian) {
    for (let i = size - 1; i >= 0; i -= 1) value = value * 256 + bytes[offset + i];
  } else {
    for (let i = 0; i < size; i += 1) value = value * 256 + bytes[offset + i];
  }
  return value;
}

function readSInt(bytes: Uint8Array, offset: number, size: number, littleEndian: boolean): number {
  const raw = readUInt(bytes, offset, size, littleEndian);
  const bits = size * 8;
  const max = 2 ** (bits - 1);
  return raw >= max ? raw - 2 ** bits : raw;
}

function readFitValue(bytes: Uint8Array, offset: number, field: FitFieldDef, littleEndian: boolean): number | null {
  const base = field.baseType & 0x1f;
  const invalid =
    base === 0x00 || base === 0x02 || base === 0x0a
      ? 0xff
      : base === 0x84 || base === 0x8b
        ? 0xffff
        : base === 0x86 || base === 0x8c
          ? 0xffffffff
          : base === 0x01
            ? 0x7f
            : base === 0x83
              ? 0x7fff
              : base === 0x85
                ? 0x7fffffff
                : null;

  if (base === 0x07 || base === 0x0d) return null; // string / byte: not numeric
  if (field.size > 4) {
    // uint64 / sint64 are not used by the fields we read.
    return null;
  }

  const signed = base === 0x01 || base === 0x83 || base === 0x85;
  const value = signed
    ? readSInt(bytes, offset, field.size, littleEndian)
    : readUInt(bytes, offset, field.size, littleEndian);

  if (invalid !== null && value === invalid) return null;
  return value;
}

function fitSportLabel(sport: number | undefined): string {
  const labels: Record<number, string> = {
    0: 'other',
    1: 'running',
    2: 'cycling',
    3: 'transition',
    4: 'other',
    5: 'swimming',
    6: 'basketball',
    7: 'soccer',
    8: 'tennis',
    9: 'american football',
    10: 'training',
    11: 'walking',
    12: 'cross-country skiing',
    13: 'alpine skiing',
    14: 'snowboarding',
    15: 'rowing',
    16: 'mountaineering',
    17: 'hiking',
    18: 'multisport',
    19: 'paddling',
    25: 'golf',
    31: 'rock climbing',
    35: 'snowshoeing',
    37: 'stand up paddleboarding',
    44: 'kitesurfing',
    47: 'boxing',
    49: 'baseball',
  };
  return labels[sport ?? 0] ?? 'other';
}
export function parseFit(bytes: Uint8Array): ParseResult {
  if (bytes.length < FIT_HEADER_SIZE) {
    return emptyResult('fit', 'FIT file is shorter than its 12-byte header.');
  }

  const headerSize = bytes[0];
  if (headerSize !== FIT_HEADER_SIZE && headerSize !== FIT_HEADER_SIZE_WITH_CRC) {
    return emptyResult('fit', `FIT header size ${headerSize} is not 12 or 14.`);
  }
  if (bytes.length < headerSize) {
    return emptyResult('fit', 'FIT file ends inside its header.');
  }

  const magic = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (magic !== '.FIT') {
    return emptyResult('fit', 'FIT signature is missing (expected ".FIT").');
  }

  const dataSize = readUInt(bytes, 4, 4, true);
  const dataStart = headerSize;
  const dataEnd = dataStart + dataSize;
  if (dataSize <= 0 || dataEnd > bytes.length) {
    return emptyResult('fit', 'FIT data size is invalid or truncated.');
  }

  const definitions = new Map<number, FitDefinition>();
  const sessions: FitSession[] = [];
  const record: FitRecordSummary = {};
  const warnings: string[] = [];

  let offset = dataStart;
  let lastTimestamp: number | null = null;

  while (offset < dataEnd) {
    const header = bytes[offset];
    offset += 1;

    if (header & 0x80) {
      // Compressed timestamp header: local message type + 5-bit offset.
      const localType = (header >> 5) & 0x03;
      const definition = definitions.get(localType);
      if (!definition) {
        warnings.push('FIT compressed-timestamp record has no definition; stopped reading.');
        break;
      }
      const timeOffset = header & 0x1f;
      if (lastTimestamp !== null) {
        let candidate: number = (lastTimestamp & ~0x1f) + timeOffset;
        if (candidate < lastTimestamp) candidate += 0x20;
        lastTimestamp = candidate;
      }
      const size = definition.fields.reduce((sum, field) => sum + field.size, 0);
      if (offset + size > dataEnd) {
        warnings.push('FIT record overruns the declared data size; stopped reading.');
        break;
      }
      offset += size;
      continue;
    }

    const isDefinition = (header & 0x40) !== 0;
    const hasDeveloperFields = (header & 0x20) !== 0;
    const localType = header & 0x0f;

    if (isDefinition) {
      if (offset + 5 > dataEnd) {
        warnings.push('FIT definition is truncated; stopped reading.');
        break;
      }
      const architecture = bytes[offset + 1];
      const littleEndian = architecture === 0;
      const globalMessage = readUInt(bytes, offset + 2, 2, littleEndian);
      const fieldCount = bytes[offset + 4];
      offset += 5;

      const fields: FitFieldDef[] = [];
      for (let i = 0; i < fieldCount; i += 1) {
        if (offset + 3 > dataEnd) {
          warnings.push('FIT field definition is truncated; stopped reading.');
          return { kind: 'fit', workouts: [], warnings };
        }
        fields.push({
          number: bytes[offset],
          size: bytes[offset + 1],
          baseType: bytes[offset + 2],
        });
        offset += 3;
      }

      if (hasDeveloperFields) {
        if (offset >= dataEnd) break;
        const devCount = bytes[offset];
        offset += 1 + devCount * 3;
      }

      definitions.set(localType, { littleEndian, globalMessage, fields });
      continue;
    }

    const definition = definitions.get(localType);
    if (!definition) {
      warnings.push('FIT data message has no matching definition; stopped reading.');
      break;
    }

    const size = definition.fields.reduce((sum, field) => sum + field.size, 0);
    if (offset + size > dataEnd) {
      warnings.push('FIT data message overruns the declared data size; stopped reading.');
      break;
    }

    const values = new Map<number, number>();
    let cursor = offset;
    for (const field of definition.fields) {
      const value = readFitValue(bytes, cursor, field, definition.littleEndian);
      if (value !== null) values.set(field.number, value);
      cursor += field.size;
    }
    offset += size;

    const timestamp = values.get(253);
    if (timestamp !== undefined) lastTimestamp = timestamp;

    if (definition.globalMessage === 18) {
      sessions.push({
        startTime: values.get(2),
        elapsedSec: values.get(7) !== undefined ? values.get(7)! / 1000 : undefined,
        timerSec: values.get(8) !== undefined ? values.get(8)! / 1000 : undefined,
        distanceM: values.get(9) !== undefined ? values.get(9)! / 100 : undefined,
        sport: values.get(5),
        subSport: values.get(6),
        calories: values.get(11),
        avgHeartRate: values.get(16),
      });
    } else if (definition.globalMessage === 20) {
      const time = values.get(253);
      const distance = values.get(5) !== undefined ? values.get(5)! / 100 : undefined;
      if (time !== undefined) {
        if (record.firstTime === undefined) record.firstTime = time;
        record.lastTime = time;
      }
      if (distance !== undefined) record.distanceM = distance;
    }
  }

  const workouts: FileWorkout[] = [];
  for (const session of sessions) {
    const startSec = session.startTime ?? record.firstTime;
    if (startSec === undefined) continue;

    let durationSec = session.elapsedSec ?? session.timerSec ?? undefined;
    if ((durationSec === undefined || durationSec <= 0) && record.firstTime !== undefined && record.lastTime !== undefined) {
      durationSec = record.lastTime - record.firstTime;
    }
    if (durationSec === undefined || durationSec <= 0) continue;

    const startMs = FIT_EPOCH_MS + startSec * 1000;
    const distanceM = session.distanceM ?? record.distanceM;
    const sport = fitSportLabel(session.sport);

    workouts.push({
      startedAt: iso(startMs),
      durationSec: round(durationSec, 3),
      distanceM: distanceM !== undefined && distanceM >= 0 ? round(distanceM, 1) : undefined,
      sport,
      energyKcal: positive(session.calories) ?? undefined,
      avgHeartRate:
        session.avgHeartRate !== undefined && session.avgHeartRate >= 30 && session.avgHeartRate <= 250
          ? session.avgHeartRate
          : undefined,
      externalId: externalId('fit', startMs, durationSec, distanceM ?? null),
    });
  }

  /* Some exports carry only track records. A start and end timestamp plus a
     cumulative distance is a real summary; the sport is not stated, so it stays
     "other" and the warning says where the numbers came from. */
  if (workouts.length === 0 && record.firstTime !== undefined && record.lastTime !== undefined) {
    const durationSec = record.lastTime - record.firstTime;
    if (durationSec > 0) {
      const startMs = FIT_EPOCH_MS + record.firstTime * 1000;
      workouts.push({
        startedAt: iso(startMs),
        durationSec: round(durationSec, 3),
        distanceM:
          record.distanceM !== undefined && record.distanceM > 0
            ? round(record.distanceM, 1)
            : undefined,
        sport: 'other',
        externalId: externalId('fit', startMs, durationSec, record.distanceM ?? null),
      });
      warnings.push(
        'No session message in this FIT file; duration and distance were derived from its track records.',
      );
    }
  }

  if (workouts.length === 0) {
    return {
      kind: 'fit',
      workouts: [],
      warnings: warnings.length ? warnings : ['FIT contained no session with a start time and duration.'],
    };
  }
  return { kind: 'fit', workouts, warnings };
}

/* ---------- dispatch ---------- */

export function detectKind(input: WorkoutFileInput): WorkoutFileKind | null {
  const name = input.name.toLowerCase();
  if (name.endsWith('.fit')) return 'fit';
  if (name.endsWith('.tcx')) return 'tcx';
  if (name.endsWith('.gpx')) return 'gpx';

  if (input.bytes && input.bytes.length >= 12) {
    const magic = String.fromCharCode(input.bytes[8], input.bytes[9], input.bytes[10], input.bytes[11]);
    if (magic === '.FIT') return 'fit';
  }
  if (input.text) {
    if (/<TrainingCenterDatabase\b/i.test(input.text)) return 'tcx';
    if (/<gpx\b/i.test(input.text)) return 'gpx';
  }
  return null;
}

export function parseWorkoutFile(input: WorkoutFileInput): ParseResult {
  const byteLength = input.bytes?.length ?? (input.text ? input.text.length : 0);
  if (byteLength === 0) {
    return emptyResult(null, 'The selected file is empty.');
  }
  if (byteLength > MAX_IMPORT_BYTES) {
    return emptyResult(null, `The selected file is larger than ${Math.round(MAX_IMPORT_BYTES / (1024 * 1024))} MB.`);
  }

  const kind = detectKind(input);
  if (kind === null) {
    return emptyResult(null, 'Unsupported file. Choose a .fit, .tcx, or .gpx export.');
  }

  if (kind === 'fit') {
    if (!input.bytes) {
      return emptyResult('fit', 'FIT is binary; read the file as bytes before parsing.');
    }
    return parseFit(input.bytes);
  }

  if (!input.text) {
    return emptyResult(kind, 'The selected file could not be read as text.');
  }
  return kind === 'tcx' ? parseTcx(input.text) : parseGpx(input.text);
}

/** Bridge from a parsed file to the same import pipeline used by HealthKit /
    Health Connect. The provider is always `file_import`, so provenance and
    dedupe keys stay stable across re-imports. */
export function toExternalWorkouts(workouts: readonly FileWorkout[]): ExternalWorkout[] {
  return workouts.map((workout) => ({
    provider: 'file_import',
    externalId: workout.externalId,
    activityType: workout.sport,
    startedAt: workout.startedAt,
    durationSec: workout.durationSec,
    distanceM: workout.distanceM ?? null,
    energyKcal: workout.energyKcal ?? null,
    avgHeartRate: workout.avgHeartRate ?? null,
    title: workout.title,
  }));
}
