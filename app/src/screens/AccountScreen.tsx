/* Account: who is signed in, where the session lives, and the controls that
 * must exist for an account to be trustworthy — export, sign out every device,
 * and delete.
 *
 * The cloud copy is deliberately labelled as not implemented until the sync
 * route exists. A green "backed up" badge over a local-only store would be the
 * exact lie this app is built to avoid.
 */

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { Banner, Card, PrimaryButton, SectionLabel } from '../components/ui';
import { messageFor } from '../services/api';
import {
  exportAccount,
  listIdentities,
  listSessions,
  revokeSession,
  type AuthIdentity,
  type AuthSessionInfo,
} from '../services/auth';
import { colors, radius, space, type as typeScale } from '../theme';
import type { RootStackParamList } from '../navigation';

function providerLabel(provider: string): string {
  if (provider === 'password') return 'Email and password';
  if (provider === 'google') return 'Google';
  if (provider === 'apple') return 'Apple';
  return provider;
}

function when(value: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AccountScreen() {
  const auth = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [identities, setIdentities] = useState<AuthIdentity[]>([]);
  const [sessions, setSessions] = useState<AuthSessionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth.token) {
      setIdentities([]);
      setSessions([]);
      return;
    }
    try {
      const [nextIdentities, nextSessions] = await Promise.all([
        listIdentities(auth.token),
        listSessions(auth.token),
      ]);
      setIdentities(nextIdentities);
      setSessions(nextSessions);
      setError(null);
    } catch (caught) {
      setError(messageFor(caught));
    }
  }, [auth.token]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Defer one microtask so the effect body itself does not set state
      // synchronously; the rule exists to stop cascading renders on mount.
      await Promise.resolve();
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const exportData = async () => {
    if (!auth.token) return;
    setBusy('export');
    setError(null);
    setNotice(null);
    try {
      const data = await exportAccount(auth.token);
      const file = new File(Paths.cache, 'lmtlss-export.json');
      file.create({ overwrite: true });
      await file.write(JSON.stringify(data, null, 2));
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error(`Sharing is not available. The export was written to ${file.uri}.`);
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'LMTLSS data export',
      });
      setNotice('Export ready. Choose where to save or send it.');
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (session: AuthSessionInfo) => {
    if (!auth.token) return;
    setBusy(session.id);
    setError(null);
    try {
      await revokeSession(auth.token, session.id);
      if (session.current) {
        await auth.signOut();
      } else {
        await load();
        setNotice(`Signed out ${session.deviceName || 'that device'}.`);
      }
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    setBusy('signout');
    setError(null);
    try {
      await auth.signOut();
    } finally {
      setBusy(null);
    }
  };

  const signOutAll = async () => {
    setBusy('signout-all');
    setError(null);
    try {
      await auth.signOutAll();
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete this account?',
      'This deletes the account and its cloud copy. Training data already on this phone stays until you clear it. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy('delete');
              setError(null);
              try {
                await auth.deleteAccount();
              } catch (caught) {
                setError(messageFor(caught));
              } finally {
                setBusy(null);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Text style={styles.backLabel}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Account</Text>
          <View style={styles.backSpacer} />
        </View>

        {error ? <Banner tone="danger" title="Something went wrong" detail={error} /> : null}
        {notice ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        {auth.status !== 'signedIn' ? (
          <Card>
            <Text style={styles.cardTitle}>Not signed in</Text>
            <Text style={styles.cardNote}>
              Your plan and training log live on this phone only. Signing in creates an account,
              but cloud backup of training data is not implemented yet — this phone stays the only
              copy.
            </Text>
            <View style={styles.actions}>
              <PrimaryButton
                label="Sign in or create an account"
                onPress={() => auth.openAuth()}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void auth.createTempAccount();
                }}
                style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
              >
                <Text style={styles.ghostButtonLabel}>Create temp account (local, for testing)</Text>
              </Pressable>
            </View>
          </Card>
        ) : (
          <>
            <Card>
              <SectionLabel>Signed in</SectionLabel>
              <Text style={styles.email}>{auth.user?.email ?? 'No email on this account'}</Text>
              <Text style={[styles.badge, auth.user?.emailVerified ? styles.badgeOk : styles.badgeWarn]}>
                {auth.isTempAccount ? 'Temp account (local)' : auth.user?.emailVerified ? 'Email verified' : 'Email not verified'}
              </Text>
              <Text style={styles.cardNote}>
                This session is stored in the device keystore. It can be revoked from any device.
              </Text>
            </Card>

            <Banner
              tone="warn"
              title="Cloud backup is not in this build yet"
              detail="The account is real and the server is running, but training data still lives on this phone only. Sync is the next step, and this banner will change only when it is actually on."
            />

            <View style={styles.section}>
              <SectionLabel>Sign-in methods</SectionLabel>
              <Card>
                {identities.length === 0 ? (
                  <Text style={styles.cardNote}>No sign-in methods are linked yet.</Text>
                ) : (
                  identities.map((identity) => (
                    <View key={identity.provider} style={styles.row}>
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle}>{providerLabel(identity.provider)}</Text>
                        <Text style={styles.rowMeta}>
                          {identity.email ?? 'No email'} · last used {when(identity.lastUsedAt)}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
                <Text style={styles.cardNote}>
                  Google and Apple appear here only after you sign in with them and the server has
                  the matching client id.
                </Text>
              </Card>
            </View>

            <View style={styles.section}>
              <SectionLabel>Devices</SectionLabel>
              <Card>
                {sessions.length === 0 ? (
                  <Text style={styles.cardNote}>No active sessions were returned.</Text>
                ) : (
                  sessions.map((session) => (
                    <View key={session.id} style={styles.row}>
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle}>
                          {session.deviceName || 'Unknown device'}
                          {session.current ? '  ·  this device' : ''}
                        </Text>
                        <Text style={styles.rowMeta}>
                          {session.platform || 'unknown'} · last used {when(session.lastUsedAt)}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Sign out ${session.deviceName || 'device'}`}
                        disabled={busy !== null}
                        onPress={() => {
                          void revoke(session);
                        }}
                        style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.smallButtonLabel}>
                          {session.current ? 'Sign out' : 'Revoke'}
                        </Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </Card>
            </View>

            <View style={styles.section}>
              <SectionLabel>Your data</SectionLabel>
              <Card>
                <PrimaryButton
                  label={busy === 'export' ? 'Preparing export…' : 'Export my data'}
                  disabled={busy !== null}
                  onPress={() => {
                    void exportData();
                  }}
                />
                <Text style={styles.cardNote}>
                  The export is the server-side account document: profile, sports, communities,
                  registrations and activities. Training data stored only on this phone is not in
                  it yet.
                </Text>
              </Card>
            </View>

            <View style={styles.section}>
              <SectionLabel>Session</SectionLabel>
              <Card>
                <PrimaryButton
                  label={busy === 'signout' ? 'Signing out…' : 'Sign out'}
                  disabled={busy !== null}
                  onPress={() => {
                    void signOut();
                  }}
                />
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy !== null}
                    onPress={() => {
                      void signOutAll();
                    }}
                    style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.dangerButtonLabel}>
                      {busy === 'signout-all' ? 'Signing out…' : 'Sign out all devices'}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            </View>

            <View style={styles.section}>
              <SectionLabel>Danger zone</SectionLabel>
              <Card>
                <Text style={styles.cardNote}>
                  Deleting the account removes the server record and every session. It cannot be
                  undone.
                </Text>
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy !== null}
                    onPress={confirmDelete}
                    style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.dangerButtonLabel}>
                      {busy === 'delete' ? 'Deleting…' : 'Delete account'}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.bg, flex: 1 },
  content: {
    gap: space.s5,
    paddingBottom: space.s10,
    paddingHorizontal: space.s5,
    paddingTop: space.s3,
  },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  back: { minWidth: 70, paddingVertical: space.s2 },
  backSpacer: { minWidth: 70 },
  backLabel: { ...typeScale.small, color: colors.accent, fontWeight: '600' },
  title: { ...typeScale.title, color: colors.text },
  cardTitle: { ...typeScale.h2, color: colors.text },
  cardNote: { ...typeScale.small, color: colors.textMuted, lineHeight: 18, marginTop: space.s2 },
  ghostButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: space.s3,
  },
  ghostButtonLabel: { ...typeScale.body, color: colors.text, fontWeight: '600' },
  email: { ...typeScale.title, color: colors.text, marginTop: space.s2 },
  badge: {
    ...typeScale.micro,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: space.s2,
    paddingHorizontal: space.s3,
    paddingVertical: space.s1,
  },
  badgeOk: { borderColor: colors.accentLine, color: colors.accent, backgroundColor: colors.accentWash },
  badgeWarn: { borderColor: colors.warn, color: colors.warn, backgroundColor: colors.warnWash },
  section: { gap: space.s2 },
  actions: { gap: space.s2, marginTop: space.s3 },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.s3,
    paddingVertical: space.s3,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...typeScale.body, color: colors.text, fontWeight: '600' },
  rowMeta: { ...typeScale.small, color: colors.textMuted },
  smallButton: {
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
  },
  smallButtonLabel: { ...typeScale.small, color: colors.text, fontWeight: '600' },
  dangerButton: {
    alignItems: 'center',
    borderColor: colors.danger,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: space.s3 + 2,
  },
  dangerButtonLabel: { ...typeScale.body, color: colors.danger, fontWeight: '700' },
  notice: {
    backgroundColor: colors.accentWash,
    borderColor: colors.accentLine,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: space.s3,
  },
  noticeText: { ...typeScale.small, color: colors.textSecondary, lineHeight: 18 },
  pressed: { opacity: 0.7 },
});
