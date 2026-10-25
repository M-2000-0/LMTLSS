import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, Chip, PrimaryButton, SectionLabel } from '../components/ui';
import { colors, space, type as typeScale } from '../theme';
import { formatElapsed } from '../utils/clock';
import { formatDistanceKm, formatPace } from '../services/runBuffer';
import { getRun, type SavedRun } from '../services/runStorage';
import type { RootStackParamList } from '../navigation';

type RouteT = RouteProp<RootStackParamList, 'RunSummary'>;

function computePaceSecPerKm(run: SavedRun): number | null {
  const km = run.distanceM / 1000;
  if (km <= 0 || run.elapsedMs <= 0) return null;
  if (run.distanceM < 50 || run.elapsedMs < 30_000) return null;
  return (run.elapsedMs / km) / 1000;
}

export default function RunSummaryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteT>();
  const { runId } = route.params;
  const [run, setRun] = useState<SavedRun | null>(null);

  useEffect(() => {
    (async () => {
      const r = await getRun(runId);
      setRun(r);
    })();
  }, [runId]);

  const pace = useMemo(() => (run ? computePaceSecPerKm(run) : null), [run]);

  if (!run) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.brand}>LMTLSS</Text>
            <Text style={styles.date}>Run</Text>
          </View>
          <Card>
            <Text style={styles.empty}>Loading run…</Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.brand}>LMTLSS</Text>
          <Text style={styles.date}>Run Summary</Text>
        </View>

        <SectionLabel>Summary</SectionLabel>
        <Card style={styles.liveCard}>
          <Text style={styles.elapsedLabel}>Time</Text>
          <Text style={styles.elapsedValue}>{formatElapsed(run.elapsedMs)}</Text>

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statValue}>{formatDistanceKm(run.distanceM)} km</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Pace</Text>
              <Text style={styles.statValue}>{formatPace(pace)}</Text>
            </View>
          </View>

          <View style={styles.sampleRow}>
            <Text style={styles.sampleLabel}>Route points</Text>
            <Text style={styles.sampleValue}>{run.points.length}</Text>
          </View>
        </Card>

        <SectionLabel>Share</SectionLabel>
        <Card style={styles.controlsCard}>
          <Text style={styles.helpText}>
            Create a Strava-like share card with distance, time, pace and a route preview.
          </Text>
          <PrimaryButton label="Share run" onPress={() => navigation.navigate('RunShare', { runId: run.id })} />
        </Card>

        <Card style={styles.controlsCard}>
          <PrimaryButton label="Done" onPress={() => navigation.navigate('Today')} />
          <Chip label="Run again" selected={false} onPress={() => navigation.navigate('Run')} />
        </Card>
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
  header: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brand: { ...typeScale.micro, color: colors.text, letterSpacing: 3 },
  date: { ...typeScale.small, color: colors.textMuted },
  liveCard: { gap: space.s3 },
  elapsedLabel: { ...typeScale.small, color: colors.textMuted },
  elapsedValue: { ...typeScale.metric, color: colors.text },
  statRow: { flexDirection: 'row', gap: space.s5 },
  stat: { flex: 1 },
  statLabel: { ...typeScale.small, color: colors.textMuted },
  statValue: { ...typeScale.title, color: colors.text },
  sampleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sampleLabel: { ...typeScale.small, color: colors.textMuted },
  sampleValue: { ...typeScale.small, color: colors.text },
  controlsCard: { gap: space.s3 },
  helpText: { ...typeScale.small, color: colors.textSecondary, lineHeight: 18 },
  empty: { ...typeScale.small, color: colors.textMuted },
});
