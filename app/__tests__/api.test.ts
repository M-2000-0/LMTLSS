/* The API client's failure contract: every failure is an ApiError with a stable
 * code, and the server address is normalized before it is stored. */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError, api } from '../src/services/api';
import { defaultApiUrl, getApiUrl, resetApiUrlCache, setApiUrl } from '../src/services/apiConfig';

const API_URL_KEY = 'lmtlss.apiUrl';

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function installFetch(handler: (url: string, init?: RequestInit) => Response): void {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn(async (url: string, init?: RequestInit) => handler(String(url), init)),
  });
}

describe('api client', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetApiUrlCache();
  });

  it('turns a server error body into an ApiError', async () => {
    installFetch(() =>
      response({ error: { code: 'weak_password', message: 'Use at least 10 characters.' } }, 400),
    );

    await expect(api('/api/auth/signup', { method: 'POST', body: {} })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'weak_password',
      message: 'Use at least 10 characters.',
    });
  });

  it('turns a network failure into a readable ApiError', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn(async () => {
        throw new Error('offline');
      }),
    });

    const error = await api('/api/auth/providers').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: 'network_error' });
    expect((error as ApiError).message).toMatch(/Can't reach the server/);
  });

  it('normalizes and persists a server address', async () => {
    expect(await setApiUrl('http://192.168.1.20:8787///')).toBe('http://192.168.1.20:8787');
    expect(await AsyncStorage.getItem(API_URL_KEY)).toBe('http://192.168.1.20:8787');

    resetApiUrlCache();
    expect(await getApiUrl()).toBe('http://192.168.1.20:8787');

    await setApiUrl('');
    expect(await getApiUrl()).toBe(defaultApiUrl());
  });
});
