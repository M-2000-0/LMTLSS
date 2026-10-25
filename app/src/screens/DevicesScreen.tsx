/* Devices & watches — the honest capability surface.

   Every watch path is listed, including the ones that cannot work yet, because
   a missing row is indistinguishable from a forgotten one. Each row states the
   mechanism's real blocker: native module, deployed backend, partner approval,
   or an adapter that does not exist. There is deliberately no "Connect" button
   until a path resolves to "available" and a real handler exists behind it.

   The matrix itself lives in shared/src/devices.ts and is unit-tested there;
   this screen only renders it. */

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  STATUS_LABELS,
  providersByMechanism,
  resolveProviders,
  summarizeProviders,
  type ProviderResolution,
  type ProviderStatus,
} from '../domain';
import { Card, SectionLabel } from '../components/ui';
import { colors, radius, space, type as typeScale } from '../theme';
import type { RootStackParamList } from '../navigation';
import { deviceContext, platformName } from '../services/devices/build';

const STATUS_TONE: Record<ProviderStatus, 'good' | 'pending' | 'blocked' | 'bad'> = {
  connected: 'good',
  available: 'pending',
  needs_build: 'blocked',
  needs_backend: 'blocked',
  needs_partner: 'blocked',
  not_implemented: 'blocked',
  sync_error: 'bad',
  unsupported: 'blocked',
};

export default function DevicesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const platform = platformName(Platform.OS);
  const context = useMemo(() => deviceContext({ platform }), [platform]);
  const resolutions = useMemo(() => resolveProviders(context), [context]);
  const summary = summarizeProviders(resolutions);
  const byId = useMemo(
    () => new Map(resolutions.map((row) => [row.id, row])),
    [resolutions],
  );
  const groups = providersByMechanism();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Today"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backLabel}>‹ Today</Text>
        </Pressable>

        <View>
          <Text style={styles.title}>Devices &amp; watches</Text>
          <Text style={styles.subtitle}>
            Every way a watch workout can reach LMTLSS, with its real status in this build.
          </Text>
        </View>

        <Card>
          <Text style={styles.summary}>
            {summary.connected === 0
              ? 'Nothing is connected yet.'
              : `${summary.connected} connected.`}{' '}
            {summary.available > 0
              ? `${summary.available} ready to connect.`
              : `${summary.blocked} of ${summary.total} paths are unavailable in this build.`}
          </Text>
          <Text style={styles.summaryNote}>
            A path is only listed as connected after a handshake actually succeeds. File import
            reads only the file you pick; nothing else on this device is read.
          </Text>
        </Card>

        {groups.map((group) => (
          <View key={group.mechanism} style={styles.section}>
            <SectionLabel>{group.label}</SectionLabel>
            <Card>
              {group.providers.map((spec, index) => {
                const resolution = byId.get(spec.id);
                if (!resolution) return null;
                return (
                  <View
                    key={spec.id}
                    style={[styles.row, index > 0 ? styles.rowDivider : null]}
                  >
                    <View style={styles.rowTop}>
                      <Text style={styles.rowLabel}>{spec.label}</Text>
                      <StatusPill status={resolution.status} />
                    </View>
                    <Text style={styles.rowDetail}>{resolution.detail}</Text>
                    <Text style={styles.rowMeta}>{spec.covers}</Text>
                    <Text style={styles.rowNote}>{spec.note}</Text>
                    {resolution.status === 'available' && spec.id === 'file_import' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Choose a FIT, TCX, or GPX file"
                        onPress={() => navigation.navigate('Import')}
                        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                      >
                        <Text style={styles.actionLabel}>Choose a file</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          </View>
        ))}

        <Text style={styles.footer}>
          Unimplemented capabilities are shown as unavailable — never as a control that does
          nothing. Data stays on this device; nothing is uploaded to connect a watch.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusPill({ status }: { status: ProviderStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <View
      style={[
        styles.pill,
        tone === 'good' && styles.pillGood,
        tone === 'bad' && styles.pillBad,
      ]}
    >
      <Text
        style={[
          styles.pillLabel,
          tone === 'good' && styles.pillLabelGood,
          tone === 'pending' && styles.pillLabelPending,
          tone === 'bad' && styles.pillLabelBad,
        ]}
      >
        {STATUS_LABELS[status]}
      </Text>
    </View>
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
  summary: { ...typeScale.h2, color: colors.text },
  summaryNote: {
    ...typeScale.small,
    color: colors.textMuted,
    marginTop: space.s2,
  },
  section: { gap: space.s2 },
  row: { gap: space.s1, paddingVertical: space.s4 },
  rowDivider: { borderTopColor: colors.border, borderTopWidth: 1 },
  rowTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.s3,
    justifyContent: 'space-between',
  },
  rowLabel: { ...typeScale.h2, color: colors.text, flexShrink: 1 },
  rowDetail: { ...typeScale.small, color: colors.textSecondary },
  rowMeta: { ...typeScale.small, color: colors.textMuted },
  rowNote: {
    ...typeScale.small,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  action: {
    alignSelf: 'flex-start',
    borderColor: colors.accentLine,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: space.s2,
    paddingHorizontal: space.s4,
    paddingVertical: space.s2,
  },
  actionLabel: { ...typeScale.small, color: colors.accent, fontWeight: '700' },
  pill: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.s3,
    paddingVertical: space.s1,
  },
  pillGood: { backgroundColor: colors.accentWash, borderColor: colors.accentLine },
  pillBad: { backgroundColor: colors.dangerWash, borderColor: colors.danger },
  pillLabel: { ...typeScale.micro, color: colors.textMuted },
  pillLabelGood: { color: colors.accent },
  pillLabelPending: { color: colors.textSecondary },
  pillLabelBad: { color: colors.danger },
  footer: { ...typeScale.small, color: colors.textMuted, lineHeight: 19 },
});
