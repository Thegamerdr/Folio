// Secondary-surface kit.
//
// Shared primitives for the secondary screens (More, Timeline, Calendar, Plans, What-if, Recovery,
// add-bill / add-debt) so they match the accepted Quiet Paper Luxury direction the core slice
// already uses. These compose the same `paper` palette and `serif` type from kit.tsx — a back
// header, a Melo line, a small section label, and a calm row list. Nothing here talks to the
// engine; screens pass real model data in.

import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ChevronRight, gap, paper, pressed, serif } from './kit';
import { MeloFigure } from './melo/MeloFigure';
import type { MeloMood } from './melo/meloStates';

// Lovable expresses Melo moods as calm | soft | alert; the figure runtime uses the canonical
// MeloMood set. Map between them in one place so every secondary screen stays consistent.
export type MeloTone = 'calm' | 'soft' | 'alert';
export function meloMoodFor(tone: MeloTone): MeloMood {
  if (tone === 'alert') return 'attentive';
  if (tone === 'soft') return 'soft-concern';
  return 'calm';
}

function ChevronLeft({ color = paper.secondary }: { color?: string | undefined }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M15 6l-6 6 6 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** The calm secondary-screen header: a back chevron, a centred quiet label, and a balancing spacer. */
export function ScreenHeader({
  label,
  onBack,
}: {
  label: string;
  onBack?: (() => void) | undefined;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          accessibilityHint="Goes back."
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBack}
          style={({ pressed: isPressed }) => [styles.headerBack, isPressed ? pressed : undefined]}
        >
          <ChevronLeft />
        </Pressable>
      ) : (
        <View style={styles.headerSpacer} />
      )}
      <Text style={styles.headerLabel}>{label}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

/** A small uppercase group label that sits above a card or list. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

/** The italic serif kicker above a heading (e.g. "The quiet hub", "Before next payday"). */
export function Kicker({ children }: { children: ReactNode }) {
  return <Text style={styles.kicker}>{children}</Text>;
}

/** Melo speaks quietly on a screen: the figure beside a single italic line, always in quotes. */
export function MeloLine({ text, tone = 'calm' }: { text: string; tone?: MeloTone | undefined }) {
  return (
    <View accessibilityRole="text" style={styles.meloLine}>
      <MeloFigure mood={meloMoodFor(tone)} size={34} />
      <Text style={styles.meloText}>{`“${text}”`}</Text>
    </View>
  );
}

export type HubRowTone = 'plain' | 'negative';

/** One calm navigation row: a label, a quiet hint, and a forward chevron. */
export function HubRow({
  label,
  hint,
  tone,
  first,
  onPress,
  accessibilityHint,
}: {
  label: string;
  hint: string;
  tone?: HubRowTone | undefined;
  // The first row in a card has no separator above it (the card edge is the boundary).
  first?: boolean | undefined;
  onPress: () => void;
  accessibilityHint?: string | undefined;
}) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.row,
        first ? styles.rowFirst : undefined,
        isPressed ? pressed : undefined,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, tone === 'negative' ? styles.rowLabelNegative : undefined]}>
          {label}
        </Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <ChevronRight />
    </Pressable>
  );
}

/** A card that groups HubRows with hairline separators between them. */
export function RowCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle> | undefined;
}) {
  return <View style={[styles.rowCard, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: gap.xs,
  },
  headerBack: {
    width: 28,
    height: 28,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSpacer: { width: 28 },
  headerLabel: {
    color: paper.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  sectionLabel: {
    color: paper.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: gap.sm,
    marginLeft: gap.xs,
  },
  kicker: {
    color: paper.muted,
    fontFamily: serif.displayItalic,
    fontSize: 14,
    lineHeight: 19,
  },

  meloLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: gap.sm,
  },
  meloText: {
    flex: 1,
    color: paper.muted,
    fontFamily: serif.displayItalic,
    fontSize: 14,
    lineHeight: 20,
    paddingTop: 4,
  },

  rowCard: {
    backgroundColor: paper.surface,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairlineStrong,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: gap.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.hairline,
  },
  rowFirst: { borderTopWidth: 0 },
  rowText: { flex: 1 },
  rowLabel: { color: paper.ink, fontSize: 15, fontWeight: '600' },
  rowLabelNegative: { color: paper.repairInk },
  rowHint: { color: paper.muted, fontSize: 12, marginTop: 2 },
});

export { styles as secondaryStyles };
