/* Account API and the device's session store.
 *
 * The session token lives in the OS keychain/keystore (expo-secure-store), not
 * in AsyncStorage, and never in a log. The cached user is stored beside it so
 * the app can open offline instead of forcing a network round-trip on every
 * cold start; a background check still revokes the session when the server
 * says it is gone.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { api } from './api';

const SESSION_KEY = 'lmtlss.auth.session';

export interface AuthUser {
  id: string;
  email: string | null;
  emailVerified: boolean;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

export interface StoredSession {
  token: string;
  user: AuthUser;
}

export interface AuthProviders {
  email: boolean;
  password: boolean;
  google: boolean;
  apple: boolean;
}

export interface AuthSessionInfo {
  id: string;
  deviceName: string;
  platform: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current?: boolean;
}

export interface AuthIdentity {
  provider: string;
  email: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

function platformName(): string {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

function deviceLabel(): string {
  if (Platform.OS === 'ios') return 'iPhone';
  if (Platform.OS === 'android') return 'Android phone';
  return 'Browser';
}

function sessionBody(): { deviceName: string; platform: string } {
  return { deviceName: deviceLabel(), platform: platformName() };
}

export async function readStoredSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession> | null;
    if (!parsed || typeof parsed.token !== 'string' || !parsed.user) return null;
    if (typeof parsed.user.id !== 'string') return null;
    return { token: parsed.token, user: parsed.user };
  } catch {
    return null;
  }
}

export async function writeStoredSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearStoredSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // Already gone is the desired state.
  }
}

export async function fetchProviders(): Promise<AuthProviders> {
  return api<AuthProviders>('/api/auth/providers');
}

export async function signUp(
  email: string,
  password: string,
  name: string,
): Promise<{ sent: boolean }> {
  return api<{ sent: boolean }>('/api/auth/signup', {
    method: 'POST',
    body: { email, password, name },
  });
}

export async function resendVerification(email: string): Promise<{ sent: boolean }> {
  return api<{ sent: boolean }>('/api/auth/resend-verification', {
    method: 'POST',
    body: { email },
  });
}

export async function verifyEmail(email: string, code: string): Promise<AuthSession> {
  return api<AuthSession>('/api/auth/verify-email', {
    method: 'POST',
    body: { email, code, ...sessionBody() },
  });
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthSession> {
  return api<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: { email, password, ...sessionBody() },
  });
}

export async function requestPasswordReset(email: string): Promise<{ sent: boolean }> {
  return api<{ sent: boolean }>('/api/auth/password/forgot', {
    method: 'POST',
    body: { email },
  });
}

export async function resetPassword(
  email: string,
  code: string,
  password: string,
): Promise<AuthSession> {
  return api<AuthSession>('/api/auth/password/reset', {
    method: 'POST',
    body: { email, code, password, ...sessionBody() },
  });
}

export async function signInWithGoogle(idToken: string): Promise<AuthSession> {
  return api<AuthSession>('/api/auth/google', {
    method: 'POST',
    body: { idToken, ...sessionBody() },
  });
}

export async function signInWithApple(identityToken: string): Promise<AuthSession> {
  return api<AuthSession>('/api/auth/apple', {
    method: 'POST',
    body: { identityToken, ...sessionBody() },
  });
}

export async function fetchSession(
  token: string,
): Promise<{ user: AuthUser; session: AuthSessionInfo | null }> {
  return api<{ user: AuthUser; session: AuthSessionInfo | null }>('/api/auth/session', {
    token,
  });
}

export async function signOut(token: string): Promise<void> {
  await api<{ ok: boolean }>('/api/auth/logout', { method: 'POST', token });
}

export async function signOutAll(token: string): Promise<void> {
  await api<{ ok: boolean }>('/api/auth/logout-all', { method: 'POST', token });
}

export async function listSessions(token: string): Promise<AuthSessionInfo[]> {
  const result = await api<{ items: AuthSessionInfo[] }>('/api/auth/sessions', { token });
  return result.items;
}

export async function revokeSession(token: string, sessionId: string): Promise<void> {
  await api<{ revoked: boolean }>(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    token,
  });
}

export async function listIdentities(token: string): Promise<AuthIdentity[]> {
  const result = await api<{ items: AuthIdentity[] }>('/api/auth/identities', { token });
  return result.items;
}

export async function exportAccount(token: string): Promise<unknown> {
  return api<unknown>('/api/me/export', { token });
}

export async function deleteAccount(token: string): Promise<void> {
  await api<{ deleted: boolean }>('/api/me', {
    method: 'DELETE',
    token,
    body: { confirm: 'delete' },
  });
}
