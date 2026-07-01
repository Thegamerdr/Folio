// MeloPresence — Melo as an embodied guide in the core slice.
//
// Presentational ONLY. It takes a state, shows the figure + one short line, and that is all. It has
// no callbacks that change anything — Melo cannot add, ignore, classify, or move Today. That rule is
// enforced by the shape of these props (there is nothing here that mutates), not just by convention.

import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { MeloFigure } from './MeloFigure';
import { meloLine, meloMood, type MeloState } from './meloStates';
import { gap, serif, useTheme, type Palette } from '../kit';

const SIZES = { sm: 28, md: 40, lg: 54 } as const;

export function MeloPresence({
  state,
  size = 'md',
  line,
  withCopy = true,
  align = 'row',
  reduceMotion,
  style,
}: {
  state: MeloState;
  size?: keyof typeof SIZES;
  /** Optional context-specific line (e.g. the tapped route point). Still kept to one short line. */
  line?: string | undefined;
  withCopy?: boolean | undefined;
  align?: 'row' | 'stack' | undefined;
  reduceMotion?: boolean | undefined;
  style?: StyleProp<ViewStyle> | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const copy = meloLine(state, line);
  const figure = (
    <MeloFigure mood={meloMood(state)} reduceMotion={reduceMotion} size={SIZES[size]} />
  );

  if (!withCopy) {
    return (
      <View accessibilityLabel={`Melo. ${copy.primary}`} accessibilityRole="image" style={style}>
        {figure}
      </View>
    );
  }

  const a11y = `Melo says: ${copy.primary}${copy.supporting ? ` ${copy.supporting}` : ''}`;
  return (
    <View
      accessible
      accessibilityLabel={a11y}
      style={[align === 'stack' ? styles.stack : styles.row, style]}
    >
      {figure}
      <View style={align === 'stack' ? styles.copyStack : styles.copyRow}>
        {/* Melo speaks — the line is Folio's voice, so it is set in the serif italic and wrapped in
            quotes (matching the secondary-surface MeloLine), never a bold app label. */}
        <Text style={[styles.primary, s.primary]}>{`“${copy.primary}”`}</Text>
        {copy.supporting ? (
          <Text style={[styles.supporting, s.supporting]}>{copy.supporting}</Text>
        ) : null}
      </View>
    </View>
  );
}

// Layout-only — theme-invariant, so it stays module-level static.
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: gap.md },
  stack: { flexDirection: 'column', alignItems: 'center', gap: gap.sm },
  copyRow: { flex: 1, gap: 2 },
  copyStack: { alignItems: 'center', gap: 2, maxWidth: 320 },
  // Melo's voice: serif italic — calm, not a bold UI label. Colour lives in makeStyles.
  primary: { fontFamily: serif.displayItalic, fontSize: 14, lineHeight: 20 },
  supporting: { fontSize: 13, lineHeight: 18 },
});

// Colour-bearing styles — rebuilt when the active palette changes.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    // Melo's voice reads warm-muted on both grounds.
    primary: { color: t.muted },
    supporting: { color: t.muted },
  });
}
