/* Import a workout from a file — the one watch route that needs no vendor
   approval, no OAuth client, and no deployed server.

   What this screen refuses to do:
     - save anything before the athlete has seen what was parsed;
     - show a distance without saying it came from the file, not from GPS;
     - hide skipped rows. Duplicates and invalid files are counted on screen;
     - claim a connection. The row in Devices says "Ready to connect" only
       because this importer exists, and nothing is read until a file is picked. */

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner, Card, PrimaryButton, SectionLabel } from '../components/ui';
import { fmtDate, fmtDist, fmtDurHuman, type ExternalWorkout, type ImportPlan } from '../domain';
import type { RootStackParamList } from '../navigation';
import { pickWorkoutFile, type PickOutcome } from '../services/importFile';
import { appStore, useAppStore } from '../store/appStore';
import { colors, space, type as typeScale } from '../theme';

function sportLabel(sport: string): string {
  if (!sport) return 'Workout';
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

function workoutMeta(workout: ExternalWorkout): string {
  const parts = [fmtDate(workout.startedAt), fmtDurHuman(workout.durationSec)];
  if (workout.distanceM != null && workout.distanceM > 0) parts.push(fmtDist(workout.distanceM));
  return parts.join(' · ');
}

function WorkoutRow({ workout }: { workout: ExternalWorkout }) {
  const extras: string[] = [];
  if (typeof workout.avgHeartRate === 'number' && workout.avgHeartRate > 0) {
    extras.push(`${Math.round(workout.avgHeartRate)} bpm average`);
  }
  if (typeof workout.energyKcal === 'number' && workout.energyKcal > 0) {
    extras.push(`${Math.round(workout.energyKcal)} kcal`);
  }

  return (
    <View style={styles.workout}>
      <Text style={styles.workoutSport}>{sportLabel(String(workout.activityType))}</Text>
      <Text style={styles.workoutMeta}>{workoutMeta(workout)}</Text>
      {workout.distanceM != null && workout.distanceM > 0 ? (
        <Text style={styles.workoutProvenance}>
          Distance as reported by the file — no GPS is connected.
        </Text>
      ) : null}
      {extras.length > 0 ? <Text style={styles.workoutMeta}>{extras.join(' · ')}</Text> : null}
    </View>
  );
}

export default function ImportScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { storageError } = useAppStore();

  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<PickOutcome | null>(null);
  const [saved, setSaved] = useState<ImportPlan | null>(null);

  async function choose(): Promise<void> {
    setBusy(true);
    setSaved(null);
    const next = await pickWorkoutFile();
    setOutcome(next);
    setBusy(false);
  }

  function save(): void {
    if (!outcome || outcome.status !== 'parsed' || outcome.workouts.length === 0) return;
    setSaved(appStore.importWorkouts(outcome.workouts));
  }

  const parsedWorkouts =
    outcome?.status === 'parsed' && outcome.workouts.length > 0 ? outcome.workouts : [];
  const warnings =
    outcome?.status === 'parsed' ? outcome.parse.warnings : outcome?.status === 'failed' ? [outcome.message] : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Devices"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backLabel}>‹ Devices</Text>
        </Pressable>

        <View>
          <Text style={styles.title}>Import a workout</Text>
          <Text style={styles.subtitle}>
            Choose a FIT, TCX, or GPX file exported from a watch or training app. The file is
            parsed on this device; nothing is uploaded.
          </Text>
        </View>

        {storageError ? <Banner tone="danger" title="Couldn't save to this device" detail={storageError} /> : null}

        <Card>
          <Text style={styles.stepLabel}>1. Choose the export</Text>
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.busyLabel}>Reading the file…</Text>
            </View>
          ) : (
            <PrimaryButton label={outcome ? 'Choose another file' : 'Choose a file'} onPress={choose} />
          )}
          <Text style={styles.helper}>
            Garmin Connect, Polar Flow, COROS, Suunto, and Strava can all export one of these.
          </Text>
        </Card>

        {outcome?.status === 'cancelled' ? (
          <Text style={styles.cancelled}>No file chosen. Nothing was read.</Text>
        ) : null}

        {warnings.length > 0 ? (
          <Banner
            tone="warn"
            title={outcome?.status === 'failed' ? 'That file could not be imported' : 'Read with warnings'}
            detail={warnings.join(' ')}
          />
        ) : null}

        {outcome?.status === 'parsed' && parsedWorkouts.length === 0 && warnings.length === 0 ? (
          <Banner tone="warn" title="No workouts found" detail="The file parsed, but it contains no session to import." />
        ) : null}

        {parsedWorkouts.length > 0 && outcome?.status === 'parsed' ? (
          <View style={styles.section}>
            <SectionLabel>2. What was found</SectionLabel>
            <Card>
              {parsedWorkouts.map((workout, index) => (
                <View key={workout.externalId} style={index > 0 ? styles.divider : undefined}>
                  <WorkoutRow workout={workout} />
                </View>
              ))}
              <Text style={styles.source}>
                From {outcome.fileName} · parsed locally · source: FIT / TCX / GPX file
              </Text>
            </Card>
          </View>
        ) : null}

        {parsedWorkouts.length > 0 && !saved ? (
          <View style={styles.section}>
            <SectionLabel>3. Save</SectionLabel>
            <PrimaryButton
              label={`Save ${parsedWorkouts.length} workout${parsedWorkouts.length === 1 ? '' : 's'}`}
              onPress={save}
            />
            <Text style={styles.helper}>
              Saved workouts are marked as device data. If the file has no sets, reps, or load,
              those stay empty — LMTLSS does not invent them.
            </Text>
          </View>
        ) : null}

        {saved ? (
          <Card>
            <Text style={styles.savedTitle}>
              Saved {saved.accepted.length} workout{saved.accepted.length === 1 ? '' : 's'}.
            </Text>
            {saved.duplicates.length > 0 ? (
              <Text style={styles.savedDetail}>
                Skipped {saved.duplicates.length} duplicate
                {saved.duplicates.length === 1 ? '' : 's'} already in your log.
              </Text>
            ) : null}
            {saved.invalid.length > 0 ? (
              <Text style={styles.savedDetail}>
                Rejected {saved.invalid.length} row{saved.invalid.length === 1 ? '' : 's'}:{' '}
                {saved.invalid[0].reasons.join(' ')}
              </Text>
            ) : null}
            <Text style={styles.savedDetail}>
              Imported sessions are marked &quot;device&quot; so they are never presented as manual
              entries.
            </Text>
          </Card>
        ) : null}

        <Text style={styles.footer}>
          Only a completed parse can be saved. Files that lack timestamps or a duration are
          refused rather than guessed, and re-importing the same file is reported as a duplicate.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.bg, flex: 1 },
  content: {
    gap: space.s6,
    paddingBottom: space.s10,
    paddingHorizontal: space.s5,
    paddingTop: space.s3,
  },
  back: { alignSelf: 'flex-start', paddingVertical: space.s2 },
  pressed: { opacity: 0.7 },
  backLabel: { ...typeScale.small, color: colors.textSecondary, fontWeight: '600' },
  title: { ...typeScale.hero, color: colors.text },
  subtitle: {
    ...typeScale.body,
    color: colors.textSecondary,
    marginTop: space.s2,
    maxWidth: 520,
  },
  stepLabel: { ...typeScale.h2, color: colors.text, marginBottom: space.s3 },
  busyRow: { alignItems: 'center', flexDirection: 'row', gap: space.s3 },
  busyLabel: { ...typeScale.small, color: colors.textSecondary },
  helper: { ...typeScale.small, color: colors.textMuted, marginTop: space.s3 },
  cancelled: { ...typeScale.small, color: colors.textMuted },
  section: { gap: space.s2 },
  workout: { gap: space.s1, paddingVertical: space.s2 },
  workoutSport: { ...typeScale.h2, color: colors.text },
  workoutMeta: { ...typeScale.small, color: colors.textSecondary },
  workoutProvenance: { ...typeScale.small, color: colors.textMuted },
  divider: { borderTopColor: colors.border, borderTopWidth: 1 },
  source: { ...typeScale.small, color: colors.textMuted, marginTop: space.s3 },
  savedTitle: { ...typeScale.h2, color: colors.accent },
  savedDetail: { ...typeScale.small, color: colors.textSecondary, marginTop: space.s2 },
  footer: { ...typeScale.small, color: colors.textMuted, lineHeight: 19 },
});
