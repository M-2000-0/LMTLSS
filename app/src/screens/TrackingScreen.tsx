// Tracking screen — foreground prototype with the background location
// start path behind it.
//
// Honest-scope rule for this build:
//  - The plan adds the app.json config, the module-scoped background
//    task, and the local location-storage seam.
//  - The screen still reflects that the full run flow is not complete:
//    start recording is available, but maps, splits, pause/resume UI,
//    and upload/sync are not part of this initial wiring. Those render
//    as unavailable, not as fake working controls.
import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Linking,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { Banner, Card, Chip, SectionLabel } from '../components/ui';
import { colors, space, type as typeScale } from '../theme';
import {
  LOCATION_TASK_NAME,
  isTaskRegistered,
  type TaskLocation,
} from '../services/locationTask';
import {
  appendLocationBatch,
  locationStorageFailure,
  resetCaptureBuffer,
  LOCATION_BATCH_KEY,
} from '../storage/locationStorage';

type RecordingState =
  | 'idle'
  | 'foregroundPermissionNeeded'
  | 'backgroundPermissionNeeded'
  | 'starting'
  | 'recording'
  | 'stopped'
  | 'error';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TrackingScreen() {
  const [mode, setMode] = useState<RecordingState>('idle');
  const [permissionSummary, setPermissionSummary] = useState<string | null>(null);
  const [captured, setCaptured] = useState<number>(0);
  const [traceSample, setTraceSample] = useState<string | null>(null);
  const taskRegistered = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const fg = await Location.getForegroundPermissionsAsync();
        const bg = await Location.getBackgroundPermissionsAsync();
        if (!mounted) return;

        const parts: string[] = [];
        if (fg.status === 'granted') parts.push('foreground granted');
        else if (fg.status === 'denied') parts.push('foreground denied');
        else parts.push('foreground: ' + fg.status);

        if (bg.status === 'granted') parts.push('background granted');
        else if (bg.status === 'denied') parts.push('background denied');
        else parts.push('background: ' + bg.status);

        setPermissionSummary(parts.join(' · '));

        if (fg.status === 'granted' && bg.status === 'granted') {
          const registered = await isTaskRegistered();
          taskRegistered.current = registered;
          setMode(registered ? 'idle' : 'foregroundPermissionNeeded');
        } else if (fg.status === 'granted') {
          setMode('backgroundPermissionNeeded');
        } else {
          setMode('foregroundPermissionNeeded');
        }
      } catch (err) {
        if (mounted) {
          setMode('error');
          setPermissionSummary(String(err));
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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

  const requestForeground = async () => {
    setMode('starting');
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      if (result.status !== 'granted') {
        setMode('foregroundPermissionNeeded');
        Alert.alert('Location permission needed', 'This screen needs foreground location to record a run.');
        return;
      }
      setMode('backgroundPermissionNeeded');
    } catch (err) {
      setMode('error');
      Alert.alert('Permission check failed', String(err));
    }
  };

  const requestBackground = async () => {
    // Expo model: request foreground first, then background. On iOS,
    // "Allow Once" can leave the app with When-In-Use only; the next
    // call may silently fail and should be handled by directing the user
    // to Settings.
    setMode('starting');
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== 'granted') {
        const likelyAllowOnce =
          Platform.OS === 'ios' && bg.status === 'denied';
        setMode('backgroundPermissionNeeded');
        if (likelyAllowOnce) {
          Alert.alert(
            'Background location not granted',
            'The app may only have “Allow Once” access. To record with the screen off, open Settings and enable location for this app.',
          );
        } else {
          Alert.alert('Background location needed', 'Recording with the screen off needs background location.');
        }
        return;
      }

      setMode('starting');
      await startRecording();
    } catch (err) {
      setMode('error');
      Alert.alert('Background permission check failed', String(err));
    }
  };

  const startRecording = async () => {
    // Begin a fresh in-memory buffer; any previous in-flight buffer is
    // preserved in the durable store via appendLocationBatch.
    resetCaptureBuffer();

    try {
      const taskName = LOCATION_TASK_NAME;
      await Location.startLocationUpdatesAsync(taskName, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,
        distanceInterval: 5,
        showsBackgroundLocationIndicator: true,
        // Deferred updates can reduce wake-ups while the app is in the
        // background. Keep them conservative for the first cut; tune on
        // device against battery and route detail.
        deferredUpdatesInterval: 5000,
        deferredUpdatesDistance: 10,
      });

      taskRegistered.current = true;
      setMode('recording');

      // Capture a tiny sample from the current session so the screen can
      // show that the recording path is live without pretending to be a
      // full route view.
      const current = await Location.getCurrentPositionAsync({});
      setTraceSample(formatSample(current));

      appendLocationBatch.trigger([]).then((batch) => {
        setCaptured(batch.length);
      });
    } catch (err) {
      setMode('error');
      Alert.alert('Start recording failed', String(err));
    }
  };

  const stopRecording = async () => {
    if (!taskRegistered.current) {
      setMode('stopped');
      return;
    }

    setMode('stopped');
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch {
      // Best-effort stop; the app should tolerate a failed stop request.
    }

    try {
      const batch = await appendLocationBatch.read();
      setCaptured(batch.length);
    } catch {
      // Non-fatal; the screen can still report the in-memory count.
    }

    taskRegistered.current = false;
  };

  const formatSample = (loc: TaskLocation) => {
    const t = new Date(loc.timestamp).toISOString();
    const lat = loc.coords.latitude.toFixed(6);
    const lon = loc.coords.longitude.toFixed(6);
    const acc = loc.coords.accuracy != null ? loc.coords.accuracy.toFixed(1) : 'n/a';
    return `${t} · ${lat},${lon} · ±${acc}m`;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>LMTLSS</Text>
          <Text style={styles.date}>{DAY_NAMES[new Date().getDay()]} run</Text>
        </View>

        {mode === 'error' ? (
          <Banner tone="danger" title="Recording unavailable" detail={permissionSummary ?? locationStorageFailure} />
        ) : null}

        <SectionLabel>Record</SectionLabel>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Start a run</Text>

          <Text style={styles.note}>
            This build adds location permission config, a background task, and local
            storage of captured points. Map rendering, splits, pause/resume, and
            uploads are not wired yet.
          </Text>

          <View style={styles.permissionRow}>
            <Text style={styles.small}>Permissions</Text>
            <Text style={styles.smallMuted}>{permissionSummary ?? 'checking…'}</Text>
          </View>

          {mode === 'idle' || mode === 'stopped' ? (
            <Chip label="Start run" selected={false} onPress={requestForeground} />
          ) : mode === 'foregroundPermissionNeeded' ? (
            <Chip label="Allow foreground location" selected={false} onPress={requestForeground} />
          ) : mode === 'backgroundPermissionNeeded' ? (
            <Chip label="Allow background location" selected={false} onPress={requestBackground} />
          ) : mode === 'starting' ? (
            <Chip label="Starting…" selected={false} onPress={() => {}} disabled />
          ) : mode === 'recording' ? (
            <Chip label="Stop run" selected={false} onPress={stopRecording} />
          ) : null}

          {mode === 'recording' ? (
            <View style={styles.sampleRow}>
              <Text style={styles.small}>Sample fix</Text>
              <Text style={styles.smallMuted}>{traceSample ?? '—'}</Text>
            </View>
          ) : null}

          {mode === 'stopped' && captured > 0 ? (
            <View style={styles.sampleRow}>
              <Text style={styles.small}>Saved points</Text>
              <Text style={styles.smallMuted}>{captured} captured locally</Text>
            </View>
          ) : null}
        </Card>

        <SectionLabel>What is not in this build yet</SectionLabel>
        <Card>
          <Text style={styles.cardNote}>
            {[
              'Render route / map view',
              'Splits and pace',
              'Pause and resume',
              'Upload or sync captured points',
              'Finish-run summary screen',
            ].map((item) => (
              <Text key={item} style={styles.bullet}>• {item}</Text>
            ))}
          </Text>
          <Text style={styles.cardNote}>
            Until those are implemented, the screen is honest about what it can do:
            start recording with permission, persist points locally, and stop.
          </Text>
        </Card>

        <Text style={styles.footer}>
          Local-first: captured points live on this device. They are not sent anywhere yet.
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
  card: { gap: space.s3 },
  cardTitle: { ...typeScale.h2, color: colors.text },
  note: { ...typeScale.small, color: colors.textSecondary, lineHeight: 18 },
  permissionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s3 },
  small: { ...typeScale.small, color: colors.text },
  smallMuted: { ...typeScale.small, color: colors.textMuted },
  sampleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s3 },
  bullet: { ...typeScale.small, color: colors.textSecondary, marginTop: space.s2 },
  cardNote: { ...typeScale.small, color: colors.textMuted, lineHeight: 18, marginTop: space.s2 },
  footer: {
    ...typeScale.small,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  },
});
