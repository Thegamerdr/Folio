// MeloPresence — Melo as an embodied guide in the core slice.
//
// Presentational ONLY. It takes a state, shows the figure + one short line, and that is all. It has
// no callbacks that change anything — Melo cannot add, ignore, classify, or move Today. That rule is
// enforced by the shape of these props (there is nothing here that mutates), not just by convention.

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { MeloFigure } from './MeloFigure';
import { meloLine, meloMood, type MeloState } from './meloStates';
import { gap, paper } from '../kit';

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
        <Text style={styles.primary}>{copy.primary}</Text>
        {copy.supporting ? <Text style={styles.supporting}>{copy.supporting}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: gap.md },
  stack: { flexDirection: 'column', alignItems: 'center', gap: gap.sm },
  copyRow: { flex: 1, gap: 1 },
  copyStack: { alignItems: 'center', gap: 1, maxWidth: 320 },
  primary: { color: paper.ink, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  supporting: { color: paper.muted, fontSize: 13, lineHeight: 18 },
});
