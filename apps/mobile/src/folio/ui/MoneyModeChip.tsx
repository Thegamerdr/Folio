// MoneyModeChip — the faithful 1:1 RN port of the web's MoneyModeChip (defined inline in
// folio-melo/.claude/worktrees/design-main/src/components/folio/clarity.tsx, the "Melo Fenice"
// clarity-primitives file — the source has no standalone MoneyModeChip.tsx; this is the same
// component, ported to its own RN file per the ui/ directory convention).
//
// @rn-component MoneyModeChip
// @purpose      Subtle top-right lens (Money Mode) marker — a pill chip with a small glow dot,
//               active or dimmed.
// @copy         MODE_LABEL strings ported verbatim (see MODE_LABEL below).
// @tokens       calm (accent) · calmSoft · hairline · muted-ink (muted) · ink
//
// FIDELITY DECISION: the web types `mode: MoneyMode` from `@/lib/modes/types` (the ten-lens
// engine). `@/folio/store` already exports a real `MoneyMode` union (ported 1:1 from the same
// web source) so this chip types against THAT rather than duplicating the union — the only piece
// still missing from RN is the standalone `@/folio/lib/modes` label/strategy module (confirmed:
// no such file exists yet, no `MODE_LABEL` export anywhere in this app). `MODE_LABEL` below is
// therefore ported locally, matching the web copy verbatim; once `@/folio/lib/modes` ships its
// own `MODE_LABEL`, drop the local copy in favour of that import.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MoneyMode } from '@/folio/store';
import { gap, pressed, radius, type Palette, useTheme } from '@/folio/theme';

export type { MoneyMode };

const MODE_LABEL: Record<MoneyMode, string> = {
  survival: 'Survival',
  stability: 'Stability',
  growth: 'Growth',
  debt: 'Debt',
  irregular: 'Irregular',
  household: 'Household',
  planning: 'Planning',
  reset: 'Reset',
  lowVis: 'Low visibility',
  optimizer: 'Optimizer',
};

export type MoneyModeChipProps = {
  mode: MoneyMode;
  active?: boolean | undefined;
  onPress?: (() => void) | undefined;
};

export function MoneyModeChip({ mode, active = true, onPress }: MoneyModeChipProps) {
  const t = useTheme();
  const s = makeStyles(t);
  const label = MODE_LABEL[mode] ?? mode;

  const content = (
    <View style={[s.chip, active ? s.chipActive : s.chipInactive]}>
      <Dot active={active} t={t} />
      <Text style={[s.label, active ? s.labelActive : s.labelInactive]}>{label}</Text>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Money mode: ${label}`}
      onPress={onPress}
      style={({ pressed: isPressed }) => (isPressed ? pressed : undefined)}
    >
      {content}
    </Pressable>
  );
}

function Dot({ active, t }: { active: boolean; t: Palette }) {
  const s = makeStyles(t);
  return <View style={[s.dot, active ? s.dotActive : s.dotInactive]} />;
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: gap.xs,
      paddingVertical: 4,
      paddingHorizontal: gap.sm,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
    },
    chipActive: {
      backgroundColor: t.calmSoft,
      borderColor: t.calm,
    },
    chipInactive: {
      backgroundColor: 'transparent',
      borderColor: t.hairline,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    labelActive: {
      color: t.ink,
    },
    labelInactive: {
      color: t.muted,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    dotActive: {
      backgroundColor: t.calm,
    },
    dotInactive: {
      backgroundColor: t.muted,
    },
  });
}
