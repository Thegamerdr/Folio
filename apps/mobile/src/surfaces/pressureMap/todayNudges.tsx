// TodayNudges — at most two calm "pills" at the top of Today.
//
// Faithful RN port of the web TodayNudges (src/components/folio/screens/TodayNudges.tsx): a small
// stack of tappable nudge rows. The container decides which nudges exist (onboarding, a Melo line,
// an insights pointer) and hands them down already-shaped, so this component stays presentation-only
// — it renders at most the first two and never computes business logic of its own.
//
// Visual parity with the web pills:
//   • accent — a terracotta-soft well with a faint accent ring + a small accent dot, accent CTA.
//   • melo   — a white surface with the Melo figure on the left, ink CTA (Melo is speaking).
//   • ink    — a plain white surface with a muted dot, muted CTA.

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MeloPresence } from './melo';
import { ChevronRight, elevation, gap, pressed, radius, useTheme, type Palette } from './kit';

export type TodayNudgeTone = 'accent' | 'melo' | 'ink';

export type TodayNudge = Readonly<{
  key: string;
  tone: TodayNudgeTone;
  label: string;
  cta: string;
  onPress: () => void;
}>;

export function TodayNudges({ nudges }: { nudges: readonly TodayNudge[] }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  if (nudges.length === 0) return null;
  return (
    <View style={layout.stack}>
      {nudges.slice(0, 2).map((nudge) => (
        <Pressable
          accessibilityHint={nudge.cta}
          accessibilityRole="button"
          key={nudge.key}
          onPress={nudge.onPress}
          style={({ pressed: isPressed }) => [
            layout.pill,
            nudge.tone === 'accent' ? s.pillAccent : s.pillSurface,
            isPressed ? pressed : undefined,
          ]}
        >
          {nudge.tone === 'melo' ? (
            <MeloPresence size="sm" state="melo_idle" style={layout.meloMark} withCopy={false} />
          ) : (
            <View style={[layout.dot, nudge.tone === 'accent' ? s.dotAccent : s.dotMuted]} />
          )}
          <Text numberOfLines={2} style={s.label}>
            {nudge.label}
          </Text>
          <View style={layout.ctaRow}>
            <Text
              style={[
                layout.cta,
                nudge.tone === 'accent'
                  ? s.ctaAccent
                  : nudge.tone === 'melo'
                    ? s.ctaInk
                    : s.ctaMuted,
              ]}
            >
              {nudge.cta}
            </Text>
            <ChevronRight
              color={
                nudge.tone === 'accent' ? t.calmStrong : nudge.tone === 'melo' ? t.ink : t.muted
              }
            />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// Colour-free styles — shared across light and dark.
const layout = StyleSheet.create({
  stack: { gap: gap.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.md,
    borderRadius: radius.xl,
    paddingVertical: 12,
    paddingHorizontal: gap.lg,
  },
  meloMark: { width: 22 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cta: { fontSize: 12, fontWeight: '600' },
});

// Colour-bearing styles, resolved against the active palette.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    pillAccent: {
      backgroundColor: t.calmSoft,
      borderWidth: 1,
      borderColor: t.calm,
    },
    pillSurface: {
      backgroundColor: t.surface,
      ...elevation.card,
    },
    dotAccent: { backgroundColor: t.calm },
    dotMuted: { backgroundColor: t.muted },
    label: { flex: 1, color: t.ink, fontSize: 13, lineHeight: 18 },
    ctaAccent: { color: t.calmStrong },
    ctaInk: { color: t.ink },
    ctaMuted: { color: t.muted },
  });
}
