/* Today — the read/write half of the M1 slice.

   Every number on this screen comes from the shared domain reading the live
   store state (nextPlannedSession, fuelSummary, insights). The two writes go
   back through the store and survive a restart.

   Deliberately absent: a start-session button and meal entry. They are not
   implemented yet, and an unimplemented capability renders as unavailable
   rather than as a control that does nothing. */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  effectivePlanDay,
  fmtDateFull,
  fmtDur,
  fuelSummary,
  insights,
  nextPlannedSession,
  todayISO,
} from '../domain';
import { useAuth } from '../auth/AuthContext';
import { Banner, Card, Chip, Logo, SectionLabel, preloadLogo } from '../components/ui';
import { appStore, useAppStore } from '../store/appStore';
import { colors, radius, space, type as typeScale } from '../theme';
import type { RootStackParamList } from '../navigation';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TodayScreen() {
  const { state, quarantine, storageError } = useAppStore();
  const auth = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const profile = state.profile;
  const today = todayISO();
  const dayName = DAY_NAMES[new Date().getDay()];
  const session = nextPlannedSession(state);
  const readiness = (state.readiness ?? []).find((row) => row.date === today) ?? null;
  const fuel = fuelSummary(state);
  const insight = insights(state)[0] ?? null;
  const planned = (state.plan && state.plan.sessions) || [];
  const sessionIsToday = session ? effectivePlanDay(session, state) === dayName : false;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Logo size={48} />
          <View style={styles.headerText}>
            <Text style={styles.brand}>LMTLSS</Text>
            <Text style={styles.tagline}>TRAINING LOG</Text>
          </View>
          <Text style={styles.date}>{fmtDateFull(today)}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account"
          onPress={() => navigation.navigate('Account')}
          style={({ pressed }) => [styles.accountStrip, pressed && styles.devicesPressed]}
        >
          <View style={styles.accountText}>
            <Text style={styles.accountTitle}>
              {auth.status === 'signedIn' ? 'Account' : 'Local only'}
            </Text>
            <Text style={styles.accountSub}>
              {auth.status === 'signedIn'
                ? `${auth.user?.email ?? 'Signed in'}${auth.isTempAccount ? ' (temp)' : ''} · cloud backup is not in this build yet`
                : 'Your data stays on this phone. Sign in to create an account.'}
            </Text>
          </View>
          <Text style={styles.accountChevron}>→</Text>
        </Pressable>

        {storageError ? (
          <Banner
            tone="danger"
            title="Not saved to this device"
            detail={storageError}
          />
        ) : null}

        {quarantine ? (
          <Banner
            tone="warn"
            title="Saved data couldn't be read"
            detail={`${quarantine}. A copy is kept on this device; nothing was deleted.`}
          />
        ) : null}

        <View>
          <Text style={styles.greeting}>
            {profile && profile.name ? `Hi, ${profile.name}.` : 'Your day.'}
          </Text>
          <Text style={styles.sub}>
            {profile ? `${profile.daysPerWeek} sessions this week` : 'Set up your plan to begin'}
          </Text>
        </View>

        <View style={styles.section}>
          <SectionLabel>Next session</SectionLabel>
          {session ? (
            <Card>
              <View style={styles.sessionTop}>
                <Text style={styles.sessionDay}>{sessionIsToday ? 'TODAY' : session.day}</Text>
                <Text style={styles.sessionMeta}>
                  {fmtDur(session.estMinutes * 60)} · {session.exercises.length} exercises
                </Text>
              </View>
              <Text style={styles.sessionTitle}>{session.title}</Text>
              <Text style={styles.sessionSport}>
                {session.sport === 'running' ? 'Running' : 'Strength'} · target RPE{' '}
                {session.targetRPE}
              </Text>
              {session.exercises.length ? (
                <View style={styles.exerciseList}>
                  {session.exercises.slice(0, 4).map((exercise) => (
                    <Text key={exercise.name} style={styles.exercise}>
                      {exercise.name} · {exercise.targetSets} × {exercise.targetReps}
                    </Text>
                  ))}
                  {session.exercises.length > 4 ? (
                    <Text style={styles.exerciseMore}>
                      +{session.exercises.length - 4} more
                    </Text>
                  ) : null}
                </View>
              ) : null}
              <Text style={styles.unavailable}>
                Session logging isn&apos;t in this build yet — the plan is real, recording a
                session arrives next.
              </Text>
            </Card>
          ) : (
            <Card>
              <Text style={styles.empty}>No session planned. Finish setup to generate your week.</Text>
            </Card>
          )}
        </View>

        <View style={styles.section}>
          <SectionLabel>Run</SectionLabel>
          <Card>
            <Text style={styles.cardTitle}>Start a run</Text>
            <Text style={styles.cardSub}>
              Record distance, time, pace, route with GPS. Save and share a Strava-like card.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start run"
              onPress={() => navigation.navigate('Run')}
              style={({ pressed }) => [styles.runButton, pressed && styles.runButtonPressed]}
            >
              <Text style={styles.runButtonText}>Start Run</Text>
            </Pressable>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionLabel>Readiness</SectionLabel>
          <Card>
            <Text style={styles.cardTitle}>How&apos;s your energy today?</Text>
            <View style={styles.chips}>
              {[1, 2, 3, 4, 5].map((level) => (
                <Chip
                  key={level}
                  label={String(level)}
                  selected={readiness?.energy === level}
                  onPress={() => setReadiness(level)}
                />
              ))}
            </View>
            <Text style={styles.cardNote}>
              {readiness
                ? `Logged today: energy ${readiness.energy}/5. Tap another number to correct it.`
                : '1 is drained, 5 is fresh. This only drives your own plan adjustments.'}
            </Text>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionLabel>Hydration</SectionLabel>
          <Card>
            <View style={styles.hydrationRow}>
              <Text style={styles.metric}>{fuel.hydrationMl}</Text>
              <Text style={styles.metricUnit}>ml today</Text>
            </View>
            <View style={styles.chips}>
              <Chip label="+250 ml" selected={false} onPress={() => addWater(250)} />
              <Chip label="+500 ml" selected={false} onPress={() => addWater(500)} />
            </View>
            <Text style={styles.cardNote}>
              {fuel.hydrationLogged
                ? 'Recorded on this device for your local calendar day.'
                : 'Nothing logged today yet. No daily target is set — this records what you log.'}
            </Text>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionLabel>Fuel</SectionLabel>
          <Card>
            <Text style={styles.cardNote}>
              Meal entry isn&apos;t part of this build yet, so no calorie or protein totals are
              shown — an empty total would look like a tracked zero, which it wouldn&apos;t be.
            </Text>
          </Card>
        </View>

        {insight ? (
          <View style={styles.section}>
            <SectionLabel>Insight</SectionLabel>
            <Card>
              <Text style={styles.cardTitle}>{insight.text}</Text>
              <Text style={styles.cardNote}>{insight.source}</Text>
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionLabel>Your week</SectionLabel>
          <Card>
            {planned.length ? (
              planned.map((item) => (
                <View key={item.id ?? item.title + item.day} style={styles.planRow}>
                  <Text style={styles.planDay}>{item.day}</Text>
                  <Text style={styles.planTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.planMeta}>{item.estMinutes}m</Text>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>No plan stored yet.</Text>
            )}
          </Card>
        </View>

        <Text style={styles.footer}>
          Local-first: this week and today&apos;s entries live on this device only.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Devices and watches"
          onPress={() => navigation.navigate('Devices')}
          style={({ pressed }) => [styles.devicesLink, pressed && styles.devicesPressed]}
        >
          <Text style={styles.devicesLabel}>Devices &amp; watches</Text>
          <Text style={styles.devicesSub}>What this build can and can&apos;t read →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/* Actions live in the store; these thin wrappers keep the JSX readable. */
preloadLogo();

function setReadiness(level: number) {
  appStore.logReadiness({ energy: level });
}

function addWater(ml: number) {
  appStore.addHydration(ml);
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.bg, flex: 1 },
  content: {
    gap: space.s6,
    paddingBottom: space.s10,
    paddingHorizontal: space.s5,
    paddingTop: space.s3,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerText: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  brand: { ...typeScale.micro, color: colors.text, letterSpacing: 3 },
  tagline: { ...typeScale.small, color: colors.textMuted, letterSpacing: 1.5 },
  date: { ...typeScale.small, color: colors.textMuted, alignSelf: 'flex-end' },
  accountStrip: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: space.s3,
    padding: space.s3,
  },
  accountText: { flex: 1, gap: 2 },
  accountTitle: { ...typeScale.small, color: colors.text, fontWeight: '700' },
  accountSub: { ...typeScale.small, color: colors.textMuted },
  accountChevron: { ...typeScale.h2, color: colors.accent },
  greeting: { ...typeScale.title, color: colors.text },
  sub: { ...typeScale.small, color: colors.textSecondary, marginTop: space.s1 },
  section: { gap: space.s2 },
  sessionTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionDay: { ...typeScale.micro, color: colors.accent, letterSpacing: 2 },
  sessionMeta: { ...typeScale.small, color: colors.textMuted },
  sessionTitle: { ...typeScale.title, color: colors.text, marginTop: space.s2 },
  sessionSport: { ...typeScale.small, color: colors.textSecondary, marginTop: space.s1 },
  exerciseList: { gap: space.s1, marginTop: space.s3 },
  exercise: { ...typeScale.small, color: colors.textSecondary },
  exerciseMore: { ...typeScale.small, color: colors.textMuted },
  unavailable: {
    ...typeScale.small,
    color: colors.textMuted,
    marginTop: space.s3,
    paddingTop: space.s3,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cardTitle: { ...typeScale.h2, color: colors.text },
  cardNote: { ...typeScale.small, color: colors.textMuted, lineHeight: 18, marginTop: space.s2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s3 },
  hydrationRow: { alignItems: 'baseline', flexDirection: 'row', gap: space.s2 },
  metric: { ...typeScale.metric, color: colors.text },
  metricUnit: { ...typeScale.small, color: colors.textMuted },
  planRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.s3,
    paddingVertical: space.s2 + 2,
  },
  planDay: { ...typeScale.small, color: colors.textMuted, width: 40 },
  planTitle: { ...typeScale.body, color: colors.text, flex: 1 },
  planMeta: { ...typeScale.small, color: colors.textMuted },
  runButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: space.s3,
    alignItems: 'center',
    marginTop: space.s3,
  },
  runButtonPressed: {
    opacity: 0.8,
  },
  runButtonText: {
    ...typeScale.small,
    color: colors.bg,
    fontWeight: '700',
  },
});
  footer: {
    ...typeScale.small,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  },
  devicesLink: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: space.s1,
    padding: space.s4,
  },
  devicesPressed: { opacity: 0.7 },
  devicesLabel: { ...typeScale.h2, color: colors.text },
  devicesSub: { ...typeScale.small, color: colors.textMuted },
});
