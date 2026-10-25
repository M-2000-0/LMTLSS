/* Picking and reading a workout file.

   The screen never touches a native module directly: this service owns the
   picker, the byte read, and the parse, and returns either a cancelled result
   or a fully explained failure. A file that cannot be read is never replaced
   by an empty workout.

   `copyToCacheDirectory: true` is required so expo-file-system can read the
   picked file immediately (see the Expo DocumentPicker docs). */

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import {
  MAX_IMPORT_BYTES,
  parseWorkoutFile,
  toExternalWorkouts,
  type ExternalWorkout,
  type ParseResult,
} from '../domain';

export type PickOutcome =
  | { status: 'cancelled' }
  | { status: 'failed'; message: string }
  | {
      status: 'parsed';
      fileName: string;
      sizeBytes: number;
      parse: ParseResult;
      workouts: ExternalWorkout[];
    };

const PICKER_TYPES = [
  'application/vnd.ant.fit',
  'application/gpx+xml',
  'application/xml',
  'text/xml',
  'application/octet-stream',
  '*/*',
];

function parsed(
  fileName: string,
  sizeBytes: number,
  parse: ParseResult,
): PickOutcome {
  return {
    status: 'parsed',
    fileName,
    sizeBytes,
    parse,
    workouts: toExternalWorkouts(parse.workouts),
  };
}

export async function pickWorkoutFile(): Promise<PickOutcome> {
  let result: DocumentPicker.DocumentPickerResult;
  try {
    result = await DocumentPicker.getDocumentAsync({
      type: PICKER_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch {
    return { status: 'failed', message: "The file picker couldn't open on this device." };
  }

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { status: 'cancelled' };
  }

  const asset = result.assets[0];
  const fileName = asset.name && asset.name.trim() ? asset.name : 'workout';
  const declaredSize = asset.size ?? 0;
  if (declaredSize > MAX_IMPORT_BYTES) {
    return {
      status: 'failed',
      message: `${fileName} is larger than ${Math.round(MAX_IMPORT_BYTES / (1024 * 1024))} MB.`,
    };
  }

  try {
    const file = new File(asset.uri);
    if (fileName.toLowerCase().endsWith('.fit')) {
      const bytes = await file.bytes();
      return parsed(fileName, bytes.length, parseWorkoutFile({ name: fileName, bytes }));
    }
    const text = await file.text();
    return parsed(fileName, text.length, parseWorkoutFile({ name: fileName, text }));
  } catch {
    return {
      status: 'failed',
      message: `Couldn't read ${fileName}. Export it again and retry.`,
    };
  }
}
