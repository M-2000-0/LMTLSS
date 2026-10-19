import AsyncStorage from '@react-native-async-storage/async-storage';

import { emptyState } from '../src/store/schema';
import {
  QUARANTINE_KEY,
  STORAGE_KEY,
  WRITE_FAILED,
  readState,
  writeState,
} from '../src/store/storage';

beforeEach(async () => {
  jest.restoreAllMocks();
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('storage adapter', () => {
  it('round-trips state through AsyncStorage', async () => {
    const state = emptyState();
    state.readiness = [{ date: '2026-10-19', energy: 4 }];

    await expect(writeState(state)).resolves.toEqual({ ok: true });
    const loaded = await readState();

    expect(loaded.storageError).toBeUndefined();
    expect(loaded.quarantine).toBeUndefined();
    expect(loaded.state.readiness).toEqual([{ date: '2026-10-19', energy: 4 }]);
  });

  it('returns an empty state when nothing has been stored yet', async () => {
    const loaded = await readState();
    expect(loaded.state.profile).toBeNull();
    expect(loaded.state.version).toBe(1);
    expect(loaded.quarantine).toBeUndefined();
  });

  it('quarantines unparseable JSON and keeps the original bytes', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{not json');

    const loaded = await readState();
    expect(loaded.quarantine).toBe('saved data was unreadable');

    const record = JSON.parse((await AsyncStorage.getItem(QUARANTINE_KEY)) ?? '{}');
    expect(record.reason).toBe('unparseable JSON');
    expect(record.payload).toBe('{not json');
    expect(typeof record.at).toBe('string');
  });

  it('quarantines a payload from a newer app version without overwriting it', async () => {
    const future = JSON.stringify({ version: 2, profile: { name: 'from the future' } });
    await AsyncStorage.setItem(STORAGE_KEY, future);

    const loaded = await readState();
    expect(loaded.quarantine).toBe('written by a newer version (v2)');
    expect(loaded.state.profile).toBeNull();

    // The newer payload is preserved twice: untouched at the main key, and
    // copied into quarantine once the app starts writing again.
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(future);
    const record = JSON.parse((await AsyncStorage.getItem(QUARANTINE_KEY)) ?? '{}');
    expect(record.payload).toBe(future);
  });

  it('reports a failed write with a message the UI can show', async () => {
    jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('SQLITE_FULL: no space left'));

    const result = await writeState(emptyState());
    expect(result.ok).toBe(false);
    expect(result.message).toBe(WRITE_FAILED);
  });

  it('reports unavailable storage instead of pretending it is empty', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('no storage backend'));

    const loaded = await readState();
    expect(loaded.state.profile).toBeNull();
    expect(loaded.storageError).toContain('Local storage is unavailable');
  });
});
