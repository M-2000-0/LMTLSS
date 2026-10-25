import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CapturedPoint } from './runBuffer';

export type SavedRun = {
  id: string;
  startedAt: number;
  endedAt: number;
  elapsedMs: number;
  distanceM: number;
  points: CapturedPoint[];
  createdAt: number;
};

const KEY = 'lmtlss:runs:v1';

async function loadAll(): Promise<SavedRun[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedRun[];
  } catch {
    return [];
  }
}

async function saveAll(runs: SavedRun[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(runs));
}

export async function saveRun(run: SavedRun): Promise<void> {
  const runs = await loadAll();
  runs.unshift(run);
  // cap to last 100
  await saveAll(runs.slice(0, 100));
}

export async function getRuns(): Promise<SavedRun[]> {
  return loadAll();
}

export async function getRun(id: string): Promise<SavedRun | null> {
  const runs = await loadAll();
  return runs.find((r) => r.id === id) || null;
}
