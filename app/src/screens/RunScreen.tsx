// RunScreen — foreground skeleton for starting, stopping, and pausing a
// run, with live elapsed time, live distance, rolling pace, and a local
// route-buffer contract.
//
// Scope for this skeleton:
//  - foreground-first recording with watchPositionAsync,
//  - start / stop / manual pause / resume,
//  - live elapsed time, distance, and pace,
//  - an honest local route-buffer contract for later persistence/upload/
//    route rendering,
//  - no background task, no map, no splits, no finish summary.
//
// Honest-scope rule for this build:
//  - The screen does what it says it does: it can start a foreground
//    recording, show live time/distance/pace, and pause/resume.
//  - Anything not in this skeleton is listed as not available, not
//    pretended to work.
import { useEffect, useRef, useState, useCallback } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Banner, Card, Chip, PrimaryButton, SectionLabel } from '../components/ui';
import { colors, space, type as typeScale } from '../theme';
import {
  addPoint,
  createRunState,
  exportRunSnapshot,
  formatDistanceKm,
  formatPace,
  haversineM,
  pauseRun,
  resumeRun,
  rollingPaceSecPerKm,
  tickRunningClock,
  type CapturedPoint,
  type RunState,
} from '../services/runBuffer';
import { formatElapsed, isMeaningfulDuration } from '../utils/clock';
import { saveRun } from '../services/runStorage';
import type { RootStackParamList } from '../navigation';

type ScreenMode =
  | 'idle'
  | 'permissionNeeded'
  | 'starting'
  | 'recording'
  | 'paused'
  | 'stopped'
  | 'error';

export default function RunScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [mode, setMode] = useState<ScreenMode>('idle');
  const [permissionSummary, setPermissionSummary] = useState<string | null>(null);
  const runRef = useRef<RunState>(createRunState());
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep one durable snapshot for the stop path, so the screen can show
  // what was captured before any later persistence/upload step.
  const lastSnapshotRef = useRef<ReturnType<typeof exportRunSnapshot> | null>(null);

  // The mutable engine lives in a ref; the screen renders from this small
  // immutable snapshot so React sees every tick without reading refs in render.
  interface RunView {
    paused: boolean;
    elapsedMs: number;
    distanceM: number;
    points: number;
    pace: number | null;
    accuracy: number | null;
  }
  const [view, setView] = useState<RunView>({
    paused: false,
    elapsedMs: 0,
    distanceM: 0,
    points: 0,
    pace: null,
    accuracy: null,
  });

  const syncView = useCallback(() => {
    const state = runRef.current;
    const elapsed = state.paused
      ? Math.max(0, state.runningTimeMs)
      : state.startedAt != null
        ? Date.now() - state.startedAt
        : 0;
    const last = state.points[state.points.length - 1];
    setView({
      paused: state.paused,
      elapsedMs: elapsed,
      distanceM: state.distanceM,
      points: state.points.length,
      pace: rollingPaceSecPerKm(state),
      accuracy: last ? last.location.coords.accuracy : null,
    });
  }, []);

  const refreshPermissionStatus = useCallback(async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status === 'granted') return 'granted';
      if (permission.status === 'denied') return 'denied';
      return permission.status;
    } catch (err) {
      return String(err);
    }
  }, []);

  const statusToSummary = useCallback(
    (status: string) => {
      if (status === 'granted') return 'foreground location granted';
      if (status === 'denied') return 'foreground location denied';
      return `foreground location: ${status}`;
    },
    [],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const status = await refreshPermissionStatus();
      if (!mounted) return;
      setPermissionSummary(statusToSummary(status));
      if (status === 'granted') {
        setMode('idle');
      } else {
        setMode('permissionNeeded');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshPermissionStatus, statusToSummary]);

  const requestForeground = async () => {
    setMode('starting');
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      if (result.status !== 'granted') {
        setMode('permissionNeeded');
        Alert.alert('Location permission needed', 'Start a run needs foreground location access.');
        return;
      }
      setPermissionSummary(statusToSummary('granted'));
      await startRecording();
    } catch (err) {
      setMode('error');
      Alert.alert('Permission check failed', String(err));
    }
  };

  const startRecording = async () => {
    runRef.current = createRunState();
    lastSnapshotRef.current = null;

    const now = Date.now();
    runRef.current.startedAt = now;
    runRef.current.runningTimeMs = 0;
    runRef.current.paused = false;
    runRef.current.pausedSinceMs = null;

    try {
      const watch = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 5,
        },
        (loc) => {
          // Keep the watch callback small. The heavy lifting lives in
          // runBuffer so the screen and the buffer stay decoupled.
          if (watchRef.current == null) return;
          const state = runRef.current;
          if (state.paused) return;
          addPoint(state, loc);
          tickRunningClock(state, Date.now());
          syncView();
        },
      );
      watchRef.current = watch;
      syncView();
      setMode('recording');
    } catch (err) {
      setMode('error');
      Alert.alert('Start recording failed', String(err));
    }
  };

  const stopRecording = useCallback(async () => {
    if (watchRef.current) {
      try {
        await watchRef.current.remove();
      } catch {
        // Best-effort.
      }
      watchRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    runRef.current.paused = false;
    runRef.current.pausedSinceMs = null;

    tickRunningClock(runRef.current, Date.now());

    const snapshot = exportRunSnapshot(runRef.current);
    lastSnapshotRef.current = snapshot;

    const endedAt = Date.now();
    const state = runRef.current;
    const elapsedMs = state.startedAt != null ? endedAt - state.startedAt : Math.max(0, state.runningTimeMs);

    const id = `${endedAt}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await saveRun({
        id,
        startedAt: snapshot.startedAt ?? endedAt - elapsedMs,
        endedAt,
        elapsedMs: Math.max(0, elapsedMs),
        distanceM: Math.max(0, snapshot.distanceM),
        points: snapshot.points,
        createdAt: endedAt,
      });
      setMode('stopped');
      navigation.navigate('RunSummary', { runId: id });
    } catch (err) {
      setMode('stopped');
      Alert.alert('Run saved locally with error', String(err));
      navigation.navigate('RunSummary', { runId: id });
    }
  }, [navigation, syncView]);

  const togglePause = useCallback(() => {
    const state = runRef.current;
    if (state.paused) {
      resumeRun(state);
      setMode('recording');
    } else {
      pauseRun(state);
      setMode('paused');
    }
    syncView();
  }, [syncView]);

  // Live clock + derived stats tick while recording or paused.
  useEffect(() => {
    if (mode !== 'recording' && mode !== 'paused') {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    tickRef.current = setInterval(() => {
      const state = runRef.current;
      if (state.startedAt == null) return;
      if (!state.paused) {
        tickRunningClock(state, Date.now());
        syncView();
      }
    }, 250);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [mode, syncView]);

  const effectiveRunningMs = view.elapsedMs;
  const pace = view.pace;

  const openSettings = async () => {
    try {
      const supported = await Linking.canOpenURL('app-settings:');
      if (supported) {
        await Linking.openURL('app-settings:');
      } else {
        Alert.alert('Open Settings', 'Open the device settings app to change location permissions.');
      }
    } catch (err) {
      Alert.alert('Opening Settings failed', String(err));
    }
  };

  const lastAccuracy = view.accuracy;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>LMTLSS</Text>
          <Text style={styles.date}>Run</Text>
        </View>

        {mode === 'error' ? (
          <Banner tone="danger" title="Recording unavailable" detail={permissionSummary ?? 'Unknown error'} />
        ) : null}

        <SectionLabel>Live</SectionLabel>
        <Card style={styles.liveCard}>
          <Text style={styles.elapsedLabel}>Elapsed</Text>
          <Text style={styles.elapsedValue}>{formatElapsed(effectiveRunningMs)}</Text>

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statValue}>{formatDistanceKm(view.distanceM)} km</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Pace</Text>
              <Text style={styles.statValue}>{formatPace(pace)}</Text>
            </View>
          </View>

          {view.points > 0 ? (
            <View style={styles.sampleRow}>
              <Text style={styles.sampleLabel}>Points</Text>
              <Text style={styles.sampleValue}>{view.points}</Text>
            </View>
          ) : null}

          {lastAccuracy != null && view.points > 0 ? (
            <View style={styles.sampleRow}>
              <Text style={styles.sampleLabel}>Last fix accuracy</Text>
              <Text style={styles.sampleValue}>
                {`±${lastAccuracy.toFixed(1)}m`}
              </Text>
            </View>
          ) : null}
        </Card>

        <SectionLabel>Controls</SectionLabel>
        <Card style={styles.controlsCard}>
          {mode === 'idle' || mode === 'permissionNeeded' || mode === 'stopped' ? (
            <PrimaryButton
              label="Start run"
              onPress={requestForeground}
              disabled={mode === 'stopped'}
            />
          ) : mode === 'starting' ? (
            <PrimaryButton label="Starting…" onPress={() => {}} disabled />
          ) : mode === 'recording' ? (
            <>
              <PrimaryButton label="Pause" onPress={togglePause} />
              <Chip label="Stop" selected={false} onPress={stopRecording} />
            </>
          ) : mode === 'paused' ? (
            <>
              <PrimaryButton label="Resume" onPress={togglePause} />
              <Chip label="Stop" selected={false} onPress={stopRecording} />
            </>
          ) : null}
        </Card>

        {mode === 'permissionNeeded' ? (
          <Card style={styles.helpCard}>
            <Text style={styles.helpText}>
              Start a run needs foreground location. If the button above did not ask, open 
              Settings and enable location for this app.
            </Text>
            <Chip label="Open Settings" selected={false} onPress={openSettings} />
          </Card>
        ) : null}

        <SectionLabel>What is not in this skeleton yet</SectionLabel>
        <Card>
          <Text style={styles.missingText}>
            {[
              'Map / route rendering',
              'Splits',
              'Save / persist the finished run',
              'Upload or sync the run',
              'Finish-run summary screen',
              'Background recording',
            ].map((item) => (
              <Text key={item} style={styles.missingBullet}>• {item}</Text>
            ))}
          </Text>
          <Text style={styles.missingNote}>
            This skeleton is foreground first. Pause here is manual and only stops the
            running clock and pace contribution; it does not hand the session off to a
            background task.
          </Text>
        </Card>

        <Text style={styles.footer}>
          Local-first: while running, captured points live in memory and are not sent anywhere.
        </Text>
      </View>
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
  helpCard: { gap: space.s3 },
  helpText: { ...typeScale.small, color: colors.textSecondary, lineHeight: 18 },
  missingText: { ...typeScale.small, color: colors.textSecondary, lineHeight: 18 },
  missingBullet: { ...typeScale.small, color: colors.textSecondary, marginTop: space.s2 },
  missingNote: { ...typeScale.small, color: colors.textMuted, lineHeight: 18, marginTop: space.s2 },
  footer: {
    ...typeScale.small,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  },
});
