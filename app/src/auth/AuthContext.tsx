/* Auth state for the app shell.
 *
 * The rule this file protects: an account is optional. A phone with no account
 * keeps working exactly as before ("use without an account"), and a phone that
 * already has training data is never forced through a sign-in wall. Signing in
 * is how you get a cloud copy later, not a precondition for using the app.
 *
 * A stored session is applied immediately and re-checked in the background, so
 * a cold start works offline. Only a 401/403 from the server clears it; a
 * network failure does not sign anyone out.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ApiError } from '../services/api';
import {
  clearStoredSession,
  deleteAccount as apiDeleteAccount,
  fetchProviders,
  fetchSession,
  readStoredSession,
  signOut as apiSignOut,
  signOutAll as apiSignOutAll,
  writeStoredSession,
  type AuthProviders,
  type AuthSession,
  type AuthUser,
} from '../services/auth';

const LOCAL_ONLY_KEY = 'lmtlss.localOnly';
const TEMP_ACCOUNT_KEY = 'lmtlss.tempAccount';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  token: string | null;
  providers: AuthProviders | null;
  providersError: string | null;
  localOnly: boolean;
  isTempAccount: boolean;
  /** True when the sign-in screen was opened from inside the app. */
  authOpen: boolean;
  signIn(session: AuthSession): Promise<void>;
  signOut(): Promise<void>;
  signOutAll(): Promise<void>;
  deleteAccount(): Promise<void>;
  useWithoutAccount(): Promise<void>;
  createTempAccount(): Promise<void>;
  leaveLocalMode(): Promise<void>;
  openAuth(): void;
  closeAuth(): void;
  refreshProviders(): Promise<void>;
  refreshSession(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [localOnly, setLocalOnly] = useState(false);
  const [isTempAccount, setIsTempAccount] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refreshProviders = useCallback(async () => {
    try {
      const result = await fetchProviders();
      if (!mounted.current) return;
      setProviders(result);
      setProvidersError(null);
    } catch (error) {
      if (!mounted.current) return;
      setProviders(null);
      setProvidersError(error instanceof Error ? error.message : 'Could not reach the server.');
    }
  }, []);

  const applySession = useCallback(async (session: AuthSession) => {
    await writeStoredSession({ token: session.token, user: session.user });
    try {
      await AsyncStorage.removeItem(LOCAL_ONLY_KEY);
      await AsyncStorage.removeItem(TEMP_ACCOUNT_KEY);
    } catch {
      // The in-memory state below is still correct.
    }
    if (!mounted.current) return;
    setToken(session.token);
    setUser(session.user);
    setStatus('signedIn');
    setLocalOnly(false);
    setIsTempAccount(false);
    setAuthOpen(false);
  }, []);

  const refreshSession = useCallback(async () => {
    const stored = await readStoredSession();
    if (!stored) {
      if (mounted.current) {
        setToken(null);
        setUser(null);
        setStatus('signedOut');
      }
      return;
    }

    if (mounted.current) {
      setToken(stored.token);
      setUser(stored.user);
      setStatus('signedIn');
    }

    try {
      const result = await fetchSession(stored.token);
      if (!mounted.current) return;
      setUser(result.user);
      await writeStoredSession({ token: stored.token, user: result.user });
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await clearStoredSession();
        setToken(null);
        setUser(null);
        setStatus('signedOut');
      }
      // Anything else (offline, 5xx) keeps the cached session: signing the
      // user out because the network is down would be a lie about the account.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let storedLocal = false;
      let storedTemp = false;
      try {
        storedLocal = (await AsyncStorage.getItem(LOCAL_ONLY_KEY)) === '1';
        storedTemp = (await AsyncStorage.getItem(TEMP_ACCOUNT_KEY)) === '1';
      } catch {
        storedLocal = false;
        storedTemp = false;
      }
      if (!cancelled && mounted.current) {
        setLocalOnly(storedLocal);
        setIsTempAccount(storedTemp);
      }
      await Promise.all([refreshSession(), refreshProviders()]);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSession, refreshProviders]);

  const signIn = useCallback(
    async (session: AuthSession) => {
      await applySession(session);
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    if (token) {
      try {
        await apiSignOut(token);
      } catch {
        // The local session is cleared regardless; the server token expires.
      }
    }
    await clearStoredSession();
    try {
      await AsyncStorage.removeItem(LOCAL_ONLY_KEY);
      await AsyncStorage.removeItem(TEMP_ACCOUNT_KEY);
    } catch {}
    if (!mounted.current) return;
    setToken(null);
    setUser(null);
    setStatus('signedOut');
    setLocalOnly(false);
    setIsTempAccount(false);
  }, [token]);

  const signOutAll = useCallback(async () => {
    if (token) {
      try {
        await apiSignOutAll(token);
      } catch {
        // Same as signOut: clear locally even if the network is gone.
      }
    }
    await clearStoredSession();
    try {
      await AsyncStorage.removeItem(LOCAL_ONLY_KEY);
      await AsyncStorage.removeItem(TEMP_ACCOUNT_KEY);
    } catch {}
    if (!mounted.current) return;
    setToken(null);
    setUser(null);
    setStatus('signedOut');
    setLocalOnly(false);
    setIsTempAccount(false);
  }, [token]);

  const deleteAccount = useCallback(async () => {
    if (!token) throw new Error('Not signed in.');
    await apiDeleteAccount(token);
    await clearStoredSession();
    if (!mounted.current) return;
    setToken(null);
    setUser(null);
    setStatus('signedOut');
  }, [token]);

  const useWithoutAccount = useCallback(async () => {
    try {
      await AsyncStorage.setItem(LOCAL_ONLY_KEY, '1');
      await AsyncStorage.removeItem(TEMP_ACCOUNT_KEY);
    } catch {
      // The app still works; the choice just is not remembered.
    }
    if (!mounted.current) return;
    setLocalOnly(true);
    setIsTempAccount(false);
    setAuthOpen(false);
  }, []);

  const createTempAccount = useCallback(async () => {
    try {
      await AsyncStorage.setItem(LOCAL_ONLY_KEY, '1');
      await AsyncStorage.setItem(TEMP_ACCOUNT_KEY, '1');
    } catch {
      // The app still works; the choice just is not remembered.
    }
    if (!mounted.current) return;
    setLocalOnly(true);
    setIsTempAccount(true);
    setUser({
      id: `temp_${Date.now()}`,
      email: `temp_${Date.now()}@local.lmtlss`,
      emailVerified: false,
    } as AuthUser);
    setStatus('signedIn');
    setAuthOpen(false);
  }, []);

  const leaveLocalMode = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(LOCAL_ONLY_KEY);
    } catch {
      // Non-fatal.
    }
    if (mounted.current) setLocalOnly(false);
  }, []);

  const openAuth = useCallback(() => setAuthOpen(true), []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      token,
      providers,
      providersError,
      localOnly,
      authOpen,
      signIn,
      signOut,
      signOutAll,
      deleteAccount,
      useWithoutAccount,
      createTempAccount,
      leaveLocalMode,
      openAuth,
      closeAuth,
      refreshProviders,
      refreshSession,
    }),
    [
      status,
      user,
      token,
      providers,
      providersError,
      localOnly,
      isTempAccount,
      authOpen,
      signIn,
      signOut,
      signOutAll,
      deleteAccount,
      useWithoutAccount,
      createTempAccount,
      leaveLocalMode,
      openAuth,
      closeAuth,
      refreshProviders,
      refreshSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
