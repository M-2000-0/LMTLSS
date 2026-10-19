/* Brand tokens, mirrored from css/tokens.css so native screens match the web
   reference app. Accent is functional color only (selection, primary action,
   active state) — never decoration, never a second accent. */

export const colors = {
  bg: '#000000',
  surface: '#111111',
  surface2: '#1a1a1a',
  border: '#262626',
  borderStrong: '#333333',
  text: '#ffffff',
  textSecondary: '#a3a3a3',
  textMuted: '#737373',
  accent: '#61EB1A',
  accentWash: 'rgba(97, 235, 26, 0.12)',
  accentLine: 'rgba(97, 235, 26, 0.35)',
  danger: '#f87171',
  dangerWash: 'rgba(248, 113, 113, 0.12)',
  warn: '#fbbf24',
  warnWash: 'rgba(251, 191, 36, 0.12)',
} as const;

export const space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const type = {
  hero: { fontSize: 34, fontWeight: '800' as const, letterSpacing: 6 },
  metric: { fontSize: 30, fontWeight: '700' as const },
  title: { fontSize: 22, fontWeight: '700' as const },
  h2: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  micro: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 1.2 },
} as const;
