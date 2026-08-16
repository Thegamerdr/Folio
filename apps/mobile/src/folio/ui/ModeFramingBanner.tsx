// ModeFramingBanner — the faithful 1:1 RN port of the web's ModeFramingBanner
// (folio-melo/.claude/worktrees/design-main/src/components/folio/mode/ModeFramingBanner.tsx).
//
// @rn-component ModeFramingBanner
// @purpose      Tiny mode chip + one-line framing shown above secondary surfaces (Pots, Subs,
//               Calendar, Cycle Close). Tells the user *why* this list looks different in their
//               current Money Mode.
// @copy         Sourced from `getFraming(mode, surface)` — '@/folio/lib/modes/framing'.
// @tokens       inset · muted · calm(accent) · ink — all from '@/folio/theme'. No new token.
//
// FIDELITY: the web renders nothing for `survival` (the shipped default — "no need to shout about
// it"). Ported verbatim: this component returns null for survival too.

import { StyleSheet, Text, View } from 'react-native';

import { useAppStore } from '@/folio/store';
import { getFraming, type FramingSurface } from '@/folio/lib/modes/framing';
import { gap, radius, useTheme } from '@/folio/theme';

export function ModeFramingBanner({ surface }: { surface: FramingSurface }) {
  const t = useTheme();
  const s = makeStyles();
  const mode = useAppStore((st) => st.moneyMode ?? 'survival');

  // Survival is the shipped default — no need to shout about it (web parity).
  if (mode === 'survival') return null;

  const framing = getFraming(mode, surface);

  return (
    <View
      accessibilityRole="text"
      style={[s.pill, { backgroundColor: t.inset, borderColor: t.hairline }]}
    >
      <View style={[s.dot, { backgroundColor: t.calm }]} />
      <Text style={[s.eyebrow, { color: t.muted }]}>{framing.eyebrow}</Text>
      <Text style={[s.sep, { color: t.muted }]}>·</Text>
      <Text style={[s.sublabel, { color: t.ink }]}>{framing.sublabel}</Text>
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    pill: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      columnGap: gap.xs,
      flexDirection: 'row',
      marginTop: gap.md,
      paddingHorizontal: gap.md,
      paddingVertical: 6,
    },
    dot: {
      borderRadius: 3,
      height: 6,
      width: 6,
    },
    eyebrow: {
      fontSize: 11,
      letterSpacing: 1.3,
      textTransform: 'uppercase',
    },
    sep: {
      fontSize: 11,
    },
    sublabel: {
      fontSize: 11,
    },
  });
}
