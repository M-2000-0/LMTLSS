/* Auth behaviour that must never regress:
 *   - creating an account is a real round-trip and lands on the verify step;
 *   - a successful sign-in writes the session to the secure store;
 *   - a 401 from the server clears the cached session instead of pretending;
 *   - "use without an account" persists and leaves the app usable;
 *   - Google/Apple never render as working controls when unconfigured.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import AuthScreen from '../src/screens/AuthScreen';

const SESSION_KEY = 'lmtlss.auth.session';
const LOCAL_ONLY_KEY = 'lmtlss.localOnly';

const PROVIDERS = { email: true, password: true, google: false, apple: false };

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function mockFetch(routes: (url: string, init?: RequestInit) => Response | undefined): void {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn(async (url: string, init?: RequestInit) => {
      const result = routes(String(url), init);
      if (!result) throw new Error(`unexpected request: ${url}`);
      return result;
    }),
  });
}

function Probe() {
  const auth = useAuth();
  return (
    <View>
      <Text testID="status">{auth.status}</Text>
      <Text testID="email">{auth.user?.email ?? 'none'}</Text>
      <Text testID="local">{auth.localOnly ? 'local' : 'account'}</Text>
    </View>
  );
}

describe('auth', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('creates an account and moves to the verification step', async () => {
    mockFetch((url) => {
      if (url.includes('/api/auth/providers')) return response(PROVIDERS);
      if (url.includes('/api/auth/signup')) return response({ sent: true }, 202);
      return undefined;
    });

    await render(
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>,
    );

    expect(await screen.findByText('Use without an account')).toBeTruthy();
    await fireEvent.press(screen.getByText('Create an account'));

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Pat');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'pat@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'correct horse battery');
    await fireEvent.press(screen.getByText('Create account'));

    expect(await screen.findByText('Check your email')).toBeTruthy();
    expect(screen.getByText(/We sent a 6-digit code to pat@example.com/)).toBeTruthy();
  });

  it('signs in and stores the session in the secure store', async () => {
    mockFetch((url) => {
      if (url.includes('/api/auth/providers')) return response(PROVIDERS);
      if (url.includes('/api/auth/login')) {
        return response({
          token: 'lmt.session.secret',
          expiresAt: '2026-11-23T00:00:00.000Z',
          user: { id: 'u1', email: 'pat@example.com', emailVerified: true },
        });
      }
      return undefined;
    });

    await render(
      <AuthProvider>
        <AuthScreen />
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText('Use without an account')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'pat@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'correct horse battery');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signedIn');
    });
    expect(screen.getByTestId('email').props.children).toBe('pat@example.com');

    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    expect(raw).toContain('lmt.session.secret');
    expect(raw).toContain('pat@example.com');
  });

  it('clears a cached session when the server rejects it', async () => {
    await SecureStore.setItemAsync(
      SESSION_KEY,
      JSON.stringify({
        token: 'expired.token',
        user: { id: 'u1', email: 'pat@example.com', emailVerified: true },
      }),
    );

    mockFetch((url) => {
      if (url.includes('/api/auth/providers')) return response(PROVIDERS);
      if (url.includes('/api/auth/session')) {
        return response({ error: { code: 'invalid_session', message: 'Session expired.' } }, 401);
      }
      return undefined;
    });

    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signedOut');
    });
    expect(await SecureStore.getItemAsync(SESSION_KEY)).toBeNull();
  });

  it('keeps a cached session when the server is unreachable', async () => {
    await SecureStore.setItemAsync(
      SESSION_KEY,
      JSON.stringify({
        token: 'offline.token',
        user: { id: 'u1', email: 'pat@example.com', emailVerified: true },
      }),
    );

    mockFetch((url) => {
      if (url.includes('/api/auth/providers')) return response(PROVIDERS);
      if (url.includes('/api/auth/session')) throw new Error('offline');
      return undefined;
    });

    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signedIn');
    });
    expect(await SecureStore.getItemAsync(SESSION_KEY)).toContain('offline.token');
  });

  it('persists "use without an account" and hides unconfigured providers', async () => {
    mockFetch((url) => {
      if (url.includes('/api/auth/providers')) return response(PROVIDERS);
      return undefined;
    });

    await render(
      <AuthProvider>
        <AuthScreen />
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText('Use without an account')).toBeTruthy();
    expect(screen.queryByText('Continue with Google')).toBeNull();
    expect(screen.queryByText('Continue with Apple')).toBeNull();

    await fireEvent.press(screen.getByText('Use without an account'));

    await waitFor(() => {
      expect(screen.getByTestId('local').props.children).toBe('local');
    });
    expect(await AsyncStorage.getItem(LOCAL_ONLY_KEY)).toBe('1');
  });
});

