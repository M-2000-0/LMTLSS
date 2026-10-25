/* Sign in, create an account, verify, reset.
 *
 * Honest by construction:
 *   - the Google button only exists when a Google client id is configured;
 *   - the Apple button only exists on iOS where the OS supports it;
 *   - "use without an account" is always available, and says what it means;
 *   - the server address is visible because a physical test phone cannot guess
 *     the machine running the API.
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { Banner, Card, Logo, PrimaryButton, SectionLabel } from '../components/ui';
import { messageFor } from '../services/api';
import { currentApiUrlSync, getApiUrl, setApiUrl } from '../services/apiConfig';
import {
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signInWithApple,
  signInWithGoogle,
  signInWithPassword,
  signUp,
  verifyEmail,
  type AuthSession,
} from '../services/auth';
import { colors, radius, space, type as typeScale } from '../theme';

type Mode = 'signIn' | 'signUp' | 'verify' | 'forgot' | 'reset';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_CONFIGURED = Boolean(
  GOOGLE_WEB_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID || GOOGLE_IOS_CLIENT_ID,
);

function GoogleSignInButton({
  disabled,
  onToken,
  onError,
}: {
  disabled: boolean;
  onToken: (idToken: string) => void;
  onError: (message: string) => void;
}) {
  const [, response, prompt] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params?.id_token;
      if (typeof idToken === 'string' && idToken) onToken(idToken);
      else onError('Google did not return an identity token.');
    } else if (response.type === 'error') {
      onError(response.error?.message ?? 'Google sign-in failed.');
    }
  }, [response, onToken, onError]);

  return (
    <SecondaryButton
      label="Continue with Google"
      disabled={disabled}
      onPress={() => {
        void prompt();
      }}
    />
  );
}

export default function AuthScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverOpen, setServerOpen] = useState(false);
  const [serverValue, setServerValue] = useState(currentApiUrlSync());
  const [serverSaved, setServerSaved] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    void getApiUrl().then(setServerValue);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const finish = async (session: AuthSession) => {
    await auth.signIn(session);
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  };

  const submitSignIn = () =>
    run(async () => {
      const session = await signInWithPassword(email.trim(), password);
      await finish(session);
    });

  const submitSignUp = () =>
    run(async () => {
      await signUp(email.trim(), password, name.trim());
      setCode('');
      setMode('verify');
      setNotice(`We sent a 6-digit code to ${email.trim()}. It expires in 10 minutes.`);
    });

  const submitVerify = () =>
    run(async () => {
      const session = await verifyEmail(email.trim(), code.trim());
      await finish(session);
    });

  const resend = () =>
    run(async () => {
      await resendVerification(email.trim());
      setNotice('A new code is on its way. The previous code no longer works.');
    });

  const submitForgot = () =>
    run(async () => {
      await requestPasswordReset(email.trim());
      setCode('');
      setMode('reset');
      setNotice(
        'If that email has an account with a password, a reset code is on its way. It expires in 10 minutes.',
      );
    });

  const submitReset = () =>
    run(async () => {
      const session = await resetPassword(email.trim(), code.trim(), newPassword);
      await finish(session);
    });

  const submitGoogle = (idToken: string) =>
    run(async () => {
      const session = await signInWithGoogle(idToken);
      await finish(session);
    });

  const submitApple = () =>
    run(async () => {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token.');
      }
      const session = await signInWithApple(credential.identityToken);
      await finish(session);
    });

  const saveServer = async () => {
    const saved = await setApiUrl(serverValue);
    setServerValue(saved);
    setServerSaved(true);
    setServerOpen(false);
    await auth.refreshProviders();
  };

  const title =
    mode === 'signIn'
      ? 'Sign in'
      : mode === 'signUp'
        ? 'Create your account'
        : mode === 'verify'
          ? 'Check your email'
          : mode === 'forgot'
            ? 'Reset your password'
            : 'Set a new password';

  const subtitle =
    mode === 'signIn'
      ? 'Your plan, your logs, your account.'
      : mode === 'signUp'
        ? 'One account for every device you train on.'
        : mode === 'verify'
          ? 'Enter the 6-digit code we sent you.'
          : mode === 'forgot'
            ? 'We will email you a 6-digit code.'
            : 'Enter the code and choose a new password.';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Logo size={54} />
            <Text style={styles.brand}>LMTLSS</Text>
            <Text style={styles.tagline}>YOUR PERFORMANCE. WITHOUT LIMITS.</Text>
          </View>

          {auth.providersError ? (
            <Banner
              tone="warn"
              title="The server is not reachable"
              detail={`${auth.providersError} Set the server address below if you are testing on a local network.`}
            />
          ) : null}

          <Card>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            {error ? (
              <View style={styles.errorWrap}>
                <Banner tone="danger" title="That did not work" detail={error} />
              </View>
            ) : null}
            {notice ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            {mode === 'signIn' || mode === 'signUp' ? (
              <View style={styles.form}>
                {mode === 'signUp' ? (
                  <Field
                    label="Name"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    textContentType="name"
                    accessibilityLabel="Name"
                  />
                ) : null}
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  accessibilityLabel="Email"
                />
                <Field
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
                  accessibilityLabel="Password"
                />
                {mode === 'signUp' ? (
                  <Text style={styles.hint}>At least 10 characters. Spaces are allowed.</Text>
                ) : null}
                <PrimaryButton
                  label={mode === 'signIn' ? 'Sign in' : 'Create account'}
                  disabled={busy}
                  onPress={() => {
                    void (mode === 'signIn' ? submitSignIn() : submitSignUp());
                  }}
                />
                <LinkButton
                  label={mode === 'signIn' ? 'Create an account' : 'I already have an account'}
                  disabled={busy}
                  onPress={() => {
                    setError(null);
                    setNotice(null);
                    setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                  }}
                />
                {mode === 'signIn' ? (
                  <LinkButton
                    label="Forgot your password?"
                    disabled={busy}
                    onPress={() => {
                      setError(null);
                      setNotice(null);
                      setMode('forgot');
                    }}
                  />
                ) : null}
              </View>
            ) : null}

            {mode === 'verify' ? (
              <View style={styles.form}>
                <Text style={styles.sentTo}>{email.trim()}</Text>
                <Field
                  label="6-digit code"
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/[^0-9]/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  accessibilityLabel="Verification code"
                />
                <PrimaryButton
                  label="Verify and sign in"
                  disabled={busy || code.length !== 6}
                  onPress={() => {
                    void submitVerify();
                  }}
                />
                <LinkButton label="Resend code" disabled={busy} onPress={() => void resend()} />
                <LinkButton
                  label="Use a different email"
                  disabled={busy}
                  onPress={() => {
                    setError(null);
                    setNotice(null);
                    setMode('signUp');
                  }}
                />
              </View>
            ) : null}

            {mode === 'forgot' ? (
              <View style={styles.form}>
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  accessibilityLabel="Email"
                />
                <PrimaryButton
                  label="Send reset code"
                  disabled={busy}
                  onPress={() => {
                    void submitForgot();
                  }}
                />
                <LinkButton
                  label="Back to sign in"
                  disabled={busy}
                  onPress={() => {
                    setError(null);
                    setNotice(null);
                    setMode('signIn');
                  }}
                />
              </View>
            ) : null}

            {mode === 'reset' ? (
              <View style={styles.form}>
                <Text style={styles.sentTo}>{email.trim()}</Text>
                <Field
                  label="6-digit code"
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/[^0-9]/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  accessibilityLabel="Verification code"
                />
                <Field
                  label="New password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType="newPassword"
                  accessibilityLabel="New password"
                />
                <PrimaryButton
                  label="Set password and sign in"
                  disabled={busy || code.length !== 6 || newPassword.length < 10}
                  onPress={() => {
                    void submitReset();
                  }}
                />
                <LinkButton label="Resend code" disabled={busy} onPress={() => void resend()} />
                <LinkButton
                  label="Back to sign in"
                  disabled={busy}
                  onPress={() => {
                    setError(null);
                    setNotice(null);
                    setMode('signIn');
                  }}
                />
              </View>
            ) : null}
          </Card>

          {GOOGLE_CONFIGURED || appleAvailable ? (
            <Card>
              <SectionLabel>Or</SectionLabel>
              <View style={styles.providers}>
                {GOOGLE_CONFIGURED ? (
                  <GoogleSignInButton
                    disabled={busy}
                    onToken={(token) => {
                      void submitGoogle(token);
                    }}
                    onError={(message) => setError(message)}
                  />
                ) : null}
                {appleAvailable ? (
                  <SecondaryButton
                    label="Continue with Apple"
                    disabled={busy}
                    onPress={() => {
                      void submitApple();
                    }}
                  />
                ) : null}
              </View>
            </Card>
          ) : null}

          <View style={styles.footer}>
            {auth.authOpen ? (
              <LinkButton label="Cancel" disabled={busy} onPress={auth.closeAuth} />
            ) : null}
            <LinkButton
              label="Use without an account"
              disabled={busy}
              onPress={() => {
                void auth.useWithoutAccount();
              }}
            />
            <LinkButton
              label="Create temp account (local, for testing)"
              disabled={busy}
              onPress={() => {
                void run(async () => {
                  await auth.createTempAccount();
                });
              }}
            />
            <Text style={styles.footnote}>
              Your training data stays on this phone. You can add an account later.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Server address"
            onPress={() => setServerOpen((open) => !open)}
            style={({ pressed }) => [styles.serverLinkWrap, pressed && styles.pressed]}
          >
            <Text style={styles.serverLink}>
              Server: {serverValue}
              {serverSaved ? '  (saved)' : ''}
            </Text>
          </Pressable>

          {serverOpen ? (
            <Card>
              <SectionLabel>Server address</SectionLabel>
              <Text style={styles.hint}>
                For local testing, use the computer running the Worker, for example
                http://192.168.1.20:8787. The phone and the computer must be on the same network.
              </Text>
              <TextInput
                value={serverValue}
                onChangeText={setServerValue}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="http://192.168.1.20:8787"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                accessibilityLabel="Server URL"
              />
              <PrimaryButton
                label="Save server address"
                onPress={() => {
                  void saveServer();
                }}
              />
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  accessibilityLabel,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  accessibilityLabel?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'url';
  secureTextEntry?: boolean;
  maxLength?: number;
  textContentType?: 'name' | 'emailAddress' | 'password' | 'newPassword' | 'oneTimeCode';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        accessibilityLabel={accessibilityLabel ?? label}
        {...rest}
      />
    </View>
  );
}

function LinkButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.bg, flex: 1 },
  flex: { flex: 1 },
  content: {
    gap: space.s5,
    paddingBottom: space.s10,
    paddingHorizontal: space.s5,
    paddingTop: space.s6,
  },
  hero: { alignItems: 'center', gap: space.s2 },
  brand: { ...typeScale.micro, color: colors.text, letterSpacing: 4, marginTop: space.s1 },
  tagline: { ...typeScale.small, color: colors.textMuted, letterSpacing: 1.2, textAlign: 'center' },
  title: { ...typeScale.title, color: colors.text },
  subtitle: { ...typeScale.small, color: colors.textSecondary, marginTop: space.s1 },
  errorWrap: { marginTop: space.s3 },
  notice: {
    backgroundColor: colors.accentWash,
    borderColor: colors.accentLine,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: space.s3,
    padding: space.s3,
  },
  noticeText: { ...typeScale.small, color: colors.textSecondary, lineHeight: 18 },
  form: { gap: space.s3, marginTop: space.s4 },
  field: { gap: space.s1 },
  fieldLabel: { ...typeScale.micro, color: colors.textMuted, textTransform: 'uppercase' },
  input: {
    ...typeScale.body,
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: space.s3,
    paddingVertical: space.s3,
  },
  hint: { ...typeScale.small, color: colors.textMuted, lineHeight: 18, marginTop: space.s2 },
  sentTo: { ...typeScale.body, color: colors.text, fontWeight: '600' },
  link: { alignItems: 'center', paddingVertical: space.s1 },
  linkText: { ...typeScale.small, color: colors.accent, fontWeight: '600' },
  secondary: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: space.s3 + 2,
  },
  secondaryLabel: { ...typeScale.body, color: colors.text, fontWeight: '600' },
  providers: { gap: space.s2, marginTop: space.s3 },
  footer: { alignItems: 'center', gap: space.s1, paddingTop: space.s2 },
  footnote: {
    ...typeScale.small,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  },
  serverLinkWrap: { alignItems: 'center', paddingVertical: space.s2 },
  serverLink: { ...typeScale.small, color: colors.textMuted, textDecorationLine: 'underline' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
