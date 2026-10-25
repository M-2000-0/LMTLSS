/* Shared native primitives. Deliberately tiny: two screens need them today and
   the design language is already fixed by css/tokens.css. */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'react-native';
import { colors, radius, space, type as typeScale } from '../theme';

// Logo source — bundled asset. Metro resolves require('../assets/logo.png')
// at bundle time in production. In the Jest test environment the asset may
// not be on disk, so we guard the require so the module still loads.
let LOGO: unknown = null;

// Try to assign the asset at module scope. If it fails (test env), leave null.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  LOGO = require('../assets/logo.png');
} catch {
  // Asset not present (test env). Leave LOGO null so Logo can fall back.
}

let preloaded = LOGO != null;
export function preloadLogo(): void {
  if (!preloaded && LOGO == null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      LOGO = require('../assets/logo.png');
    } catch {
      // Asset not present (test env).
    }
    preloaded = LOGO != null;
  }
}

export function Logo({ size = 84 }: { size?: number }) {
  if (!preloaded) {
    preloadLogo();
  }
  if (!LOGO) {
    return null;
  }
  return (
    <Image
      source={LOGO}
      style={{ width: size, height: size }}
      accessibilityLabel="LMTLSS"
      resizeMode="contain"
    />
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}
export function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}
export function PrimaryButton({
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
        styles.primary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

/** Honest status surface: every persistence problem is shown, never hidden. */
export function Banner({ tone, title, detail }: { tone: 'danger' | 'warn'; title: string; detail?: string }) {
  const danger = tone === 'danger';
  return (
    <View style={[styles.banner, danger ? styles.bannerDanger : styles.bannerWarn]}>
      <Text style={[styles.bannerTitle, danger ? styles.bannerTitleDanger : styles.bannerTitleWarn]}>
        {title}
      </Text>
      {detail ? <Text style={styles.bannerDetail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.s4,
  },
  sectionLabel: {
    ...typeScale.micro,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  chip: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.s4,
    paddingVertical: space.s2 + 2,
  },
  chipSelected: {
    backgroundColor: colors.accentWash,
    borderColor: colors.accentLine,
  },
  chipLabel: {
    ...typeScale.small,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipLabelSelected: {
    color: colors.accent,
  },
  primary: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: space.s4,
  },
  primaryLabel: {
    ...typeScale.h2,
    color: colors.bg,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
  banner: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: space.s3,
    gap: space.s1,
  },
  bannerDanger: {
    backgroundColor: colors.dangerWash,
    borderColor: colors.danger,
  },
  bannerWarn: {
    backgroundColor: colors.warnWash,
    borderColor: colors.warn,
  },
  bannerTitle: {
    ...typeScale.small,
    fontWeight: '700',
  },
  bannerTitleDanger: {
    color: colors.danger,
  },
  bannerTitleWarn: {
    color: colors.warn,
  },
  bannerDetail: {
    ...typeScale.small,
    color: colors.textSecondary,
  },
});
