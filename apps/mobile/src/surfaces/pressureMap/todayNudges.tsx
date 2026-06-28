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

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MeloPresence } from './melo';
import { ChevronRight, elevation, gap, paper, pressed, radius } from './kit';

export type TodayNudgeTone = 'accent' | 'melo' | 'ink';

export type TodayNudge = Readonly<{
  key: string;
  tone: TodayNudgeTone;
  label: string;
  cta: string;
  onPress: () => void;
}>;

export function TodayNudges({ nudges }: { nudges: readonly TodayNudge[] }) {
  if (nudges.length === 0) return null;
  return (
    <View style={styles.stack}>
      {nudges.slice(0, 2).map((nudge) => (
        <Pressable
          accessibilityHint={nudge.cta}
          accessibilityRole="button"
          key={nudge.key}
          onPress={nudge.onPress}
          style={({ pressed: isPressed }) => [
            styles.pill,
            nudge.tone === 'accent' ? styles.pillAccent : styles.pillSurface,
            isPressed ? pressed : undefined,
          ]}
        >
          {nudge.tone === 'melo' ? (
            <MeloPresence size="sm" state="melo_idle" style={styles.meloMark} withCopy={false} />
          ) : (
            <View
              style={[styles.dot, nudge.tone === 'accent' ? styles.dotAccent : styles.dotMuted]}
            />
          )}
          <Text numberOfLines={2} style={styles.label}>
            {nudge.label}
          </Text>
          <View style={styles.ctaRow}>
            <Text
              style={[
                styles.cta,
                nudge.tone === 'accent'
                  ? styles.ctaAccent
                  : nudge.tone === 'melo'
                    ? styles.ctaInk
                    : styles.ctaMuted,
              ]}
            >
              {nudge.cta}
            </Text>
            <ChevronRight
              color={
                nudge.tone === 'accent'
                  ? paper.calmStrong
                  : nudge.tone === 'melo'
                    ? paper.ink
                    : paper.muted
              }
            />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: gap.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.md,
    borderRadius: radius.xl,
    paddingVertical: 12,
    paddingHorizontal: gap.lg,
  },
  pillAccent: {
    backgroundColor: paper.calmSoft,
    borderWidth: 1,
    borderColor: paper.calm,
  },
  pillSurface: {
    backgroundColor: paper.surface,
    ...elevation.card,
  },
  meloMark: { width: 22 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotAccent: { backgroundColor: paper.calm },
  dotMuted: { backgroundColor: paper.muted },
  label: { flex: 1, color: paper.ink, fontSize: 13, lineHeight: 18 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cta: { fontSize: 12, fontWeight: '600' },
  ctaAccent: { color: paper.calmStrong },
  ctaInk: { color: paper.ink },
  ctaMuted: { color: paper.muted },
});
