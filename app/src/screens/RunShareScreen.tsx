import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import Svg, { Polyline } from 'react-native-svg';
import MapLibreGL from '@maplibre/maplibre-react-native';

import { Card, Chip, PrimaryButton, SectionLabel } from '../components/ui';
import { colors, space, type as typeScale } from '../theme';
import { formatElapsed } from '../utils/clock';
import { formatDistanceKm, formatPace } from '../services/runBuffer';
import { getRun, type SavedRun } from '../services/runStorage';
import type { RootStackParamList } from '../navigation';

MapLibreGL.setAccessToken(null);

type RouteT = RouteProp<RootStackParamList, 'RunShare'>;

function computePaceSecPerKm(run: SavedRun): number | null {
  const km = run.distanceM / 1000;
  if (km <= 0 || run.elapsedMs <= 0) return null;
  if (run.distanceM < 50 || run.elapsedMs < 30_000) return null;
  return (run.elapsedMs / km) / 1000;
}

function projectToSvg(points: Array<{ lon: number; lat: number }>, width = 280, height = 160) {
  if (points.length === 0) return { d: '', bounds: null };
  let minLon = points[0].lon,
    maxLon = points[0].lon,
    minLat = points[0].lat,
    maxLat = points[0].lat;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  const lonSpan = Math.max(1e-9, maxLon - minLon);
  const latSpan = Math.max(1e-9, maxLat - minLat);
  const pad = 10;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const path: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const x = pad + (p.lon - minLon) / lonSpan * w;
    const y = pad + (maxLat - p.lat) / latSpan * h; // flip y
    path.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return { d: path.join(' '), bounds: { minLon, maxLon, minLat, maxLat } };
}

export default function RunShareScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteT>();
  const { runId } = route.params;
  const [run, setRun] = useState<SavedRun | null>(null);
  const shotRef = useRef<ViewShot>(null);

  useEffect(() => {
    (async () => {
      const r = await getRun(runId);
      setRun(r);
    })();
  }, [runId]);

  const coords = useMemo(() => {
    if (!run) return [];
    return run.points
      .map((p) => ({ lon: p.location.coords.longitude, lat: p.location.coords.latitude }))
      .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
  }, [run]);

  const svg = useMemo(() => projectToSvg(coords), [coords]);
  const pace = useMemo(() => (run ? computePaceSecPerKm(run) : null), [run]);
  const hasMap = coords.length >= 2;

  const share = async () => {
    try {
      const uri = await shotRef.current?.capture?.();
      if (!uri) {
        Alert.alert('Share', 'Could not capture image.');
        return;
      }
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Share', 'Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share run' });
    } catch (e) {
      Alert.alert('Share failed', String(e));
    }
  };

  if (!run) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.brand}>LMTLSS</Text>
            <Text style={styles.date}>Share</Text>
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
          <Text style={styles.date}>Share Card</Text>
        </View>

        <SectionLabel>Preview</SectionLabel>
        <ViewShot ref={shotRef} options={{ format: 'png', quality: 0.9 }} style={styles.shot}>
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>LMTLSS RUN</Text>
              <Text style={styles.cardMeta}>{new Date(run.startedAt).toLocaleDateString()}</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statBig}>{formatDistanceKm(run.distanceM)}</Text>
                <Text style={styles.statUnit}>km</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBig}>{formatElapsed(run.elapsedMs)}</Text>
                <Text style={styles.statUnit}>time</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBig}>{formatPace(pace).replace(' /km', '')}</Text>
                <Text style={styles.statUnit}>/km</Text>
              </View>
            </View>

            {hasMap ? (
              <View style={styles.mapWrap}>
                <MapLibreGL.MapView
                  style={styles.map}
                  logoEnabled={false}
                  attributionEnabled={false}
                  compassEnabled={false}
                  zoomEnabled={false}
                  scrollEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <MapLibreGL.Camera
                    bounds={{
                      ne: [svg.bounds!.maxLon, svg.bounds!.maxLat],
                      sw: [svg.bounds!.minLon, svg.bounds!.minLat],
                      paddingTop: 20,
                      paddingRight: 20,
                      paddingBottom: 20,
                      paddingLeft: 20,
                    }}
                    animationDuration={0}
                  />
                  <MapLibreGL.ShapeSource
                    id="routeSource"
                    shape={{
                      type: 'Feature',
                      properties: {},
                      geometry: {
                        type: 'LineString',
                        coordinates: coords.map((c) => [c.lon, c.lat]),
                      },
                    }}
                  >
                    <MapLibreGL.LineLayer
                      id="routeLine"
                      style={{
                        lineColor: '#61EB1A',
                        lineWidth: 3,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    />
                  </MapLibreGL.ShapeSource>
                </MapLibreGL.MapView>
              </View>
            ) : (
              <View style={styles.svgWrap}>
                <Svg width={280} height={160}>
                  <Polyline points={svg.d.replace(/M|L/g, ' ').trim().replace(/\s+/g, ',').replace(/,/g, ' ')} fill="none" stroke="#61EB1A" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
            )}

            <Text style={styles.footer}>lmtlss.app</Text>
          </Card>
        </ViewShot>

        <SectionLabel>Actions</SectionLabel>
        <Card style={styles.controlsCard}>
          <PrimaryButton label="Share image" onPress={share} />
          <Chip label="Back to summary" selected={false} onPress={() => navigation.goBack()} />
          <Chip label="Done" selected={false} onPress={() => navigation.navigate('Today')} />
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
  shot: { alignSelf: 'stretch' },
  card: {
    backgroundColor: '#000000',
    borderColor: '#262626',
    borderWidth: 1,
    borderRadius: 12,
    padding: space.s4,
    gap: space.s4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  cardTitle: { ...typeScale.micro, color: '#FFFFFF', letterSpacing: 4 },
  cardMeta: { ...typeScale.small, color: '#A3A3A3' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.s3,
  },
  statBox: { flex: 1, alignItems: 'flex-start' },
  statBig: { ...typeScale.title, color: '#FFFFFF', fontSize: 28 },
  statUnit: { ...typeScale.small, color: '#737373', marginTop: 2 },
  mapWrap: {
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#262626',
  },
  map: {
    flex: 1,
  },
  svgWrap: {
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
  },
  footer: { ...typeScale.micro, color: '#737373', textAlign: 'center', letterSpacing: 2 },
  controlsCard: { gap: space.s3 },
  empty: { ...typeScale.small, color: colors.textMuted },
});
