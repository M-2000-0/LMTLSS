/* Import screen: the athlete sees exactly what was parsed, saves once, and the
   session lands in the persisted document with device provenance.

   The native picker is mocked — a Jest run cannot open a system dialog. The
   parser, the import planner, and the store are the real ones. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ImportScreen from '../src/screens/ImportScreen';
import { pickWorkoutFile, type PickOutcome } from '../src/services/importFile';
import { STORAGE_KEY } from '../src/store/storage';

jest.mock('../src/services/importFile', () => ({
  pickWorkoutFile: jest.fn(),
}));

const mockedPick = pickWorkoutFile as jest.MockedFunction<typeof pickWorkoutFile>;

const PARSED: PickOutcome = {
  status: 'parsed',
  fileName: 'morning-run.gpx',
  sizeBytes: 480,
  parse: {
    kind: 'gpx',
    warnings: [],
    workouts: [
      {
        startedAt: '2026-10-20T06:00:00.000Z',
        durationSec: 600,
        distanceM: 222.4,
        sport: 'running',
        externalId: 'gpx:1792485600:600:0.22',
      },
    ],
  },
  workouts: [
    {
      provider: 'file_import',
      externalId: 'gpx:1792485600:600:0.22',
      activityType: 'running',
      startedAt: '2026-10-20T06:00:00.000Z',
      durationSec: 600,
      distanceM: 222.4,
    },
  ],
};

describe('Import screen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockedPick.mockReset();
  });

  it('previews the parse, labels provenance, and saves it to device storage', async () => {
    mockedPick.mockResolvedValue(PARSED);
    await render(
      <NavigationContainer>
        <ImportScreen />
      </NavigationContainer>,
    );

    expect(screen.getByText('Import a workout')).toBeTruthy();

    await fireEvent.press(screen.getByText('Choose a file'));

    expect(await screen.findByText('Running')).toBeTruthy();
    expect(
      screen.getByText('Distance as reported by the file — no GPS is connected.'),
    ).toBeTruthy();
    expect(screen.getByText(/parsed locally · source: FIT \/ TCX \/ GPX file/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Save 1 workout'));

    expect(await screen.findByText('Saved 1 workout.')).toBeTruthy();

    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      expect(raw).toContain('"source":"file_import"');
      expect(raw).toContain('"provenance":"device"');
    });
  });

  it('shows why a file was refused and offers no save control', async () => {
    mockedPick.mockResolvedValue({
      status: 'parsed',
      fileName: 'undated.gpx',
      sizeBytes: 120,
      parse: {
        kind: 'gpx',
        workouts: [],
        warnings: ['GPX track points have no timestamps, so duration cannot be known.'],
      },
      workouts: [],
    });

    await render(
      <NavigationContainer>
        <ImportScreen />
      </NavigationContainer>,
    );

    await fireEvent.press(screen.getByText('Choose a file'));

    expect(await screen.findByText('Read with warnings')).toBeTruthy();
    expect(screen.getByText(/no timestamps/i)).toBeTruthy();
    expect(screen.queryByText(/^Save /)).toBeNull();
  });
});
