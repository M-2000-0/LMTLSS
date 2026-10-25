/* Where the API lives.
 *
 * The value is resolved in this order:
 *   1. an address saved in the app (the "Server" field on the sign-in screen)
 *   2. EXPO_PUBLIC_API_URL, inlined at build time
 *   3. the Android emulator loopback, which is the only address that works
 *      without configuration on a development machine
 *
 * A physical phone cannot reach 10.0.2.2. That is why the sign-in screen has a
 * visible server field: a tester can point the build at the machine running
 * the Worker without rebuilding the APK.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lmtlss.apiUrl';
const FALLBACK = 'http://10.0.2.2:8787';

function normalize(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function fromEnv(): string {
  const value = process.env.EXPO_PUBLIC_API_URL;
  return typeof value === 'string' && value.trim() ? normalize(value) : FALLBACK;
}

let cached: string | null = null;

export function defaultApiUrl(): string {
  return fromEnv();
}

export function currentApiUrlSync(): string {
  return cached ?? defaultApiUrl();
}

export async function getApiUrl(): Promise<string> {
  if (cached) return cached;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    cached = stored && stored.trim() ? normalize(stored) : defaultApiUrl();
  } catch {
    cached = defaultApiUrl();
  }
  return cached;
}

export async function setApiUrl(value: string): Promise<string> {
  const clean = normalize(value);
  cached = clean || defaultApiUrl();
  if (clean) {
    await AsyncStorage.setItem(STORAGE_KEY, cached);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
  return cached;
}

export function resetApiUrlCache(): void {
  cached = null;
}
