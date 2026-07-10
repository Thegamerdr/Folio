// TrialCountdownChip — the faithful 1:1 RN port of the web
// (folio-melo/.claude/worktrees/design-main/src/components/folio/TrialCountdownChip.tsx).
//
// @rn-component TrialCountdownChip
// @purpose      Ambient "N days left of trial" chip. Renders only while a one-cycle trial is
//               active AND the user hasn't upgraded. Tap -> paywall so the user can convert
//               without hunting.
// @reads        useLens (trialDaysLeft, trialCycleId, plusUnlocked, proUnlocked)
// @writes       — (nav only)
// @copy         FROZEN. "N days left · trial" / "Last day · trial".
// @tokens       surface · hairline · calm (accent) · calmSoft · muted-ink (muted)
//
// FIDELITY DECISION: the web reads `useLens()` for `trialDaysLeft`/`trialCycleId`/`plusUnlocked`/
// `proUnlocked`. `@/folio/store` already carries a real `LensState` (`trialCycleId`/
// `plusUnlocked`/`proUnlocked` — confirmed present) that this chip types against directly, but
// `trialDaysLeft` is a DERIVED value (days remaining from `trialCycleId`'s anchor date to cycle
// close) that no `@/folio/lib/lens` hook computes yet in this app (grepped before writing — no
// such module exists). Per RN_PORT.md's loop discipline this port does not fabricate that
// derivation. `trialDaysLeft` is passed as an explicit separate prop instead of being derived
// inline; once `@/folio/lib/lens`'s `useLens()` ships the real day-count, callers can compute it
// there and pass it straight through — no chip-internal change needed. Reported as a
// wiringNeeds dependency.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LensState } from '@/folio/store';
import { gap, pressed, radius, type Palette, useTheme } from '@/folio/theme';

export type TrialCountdownChipLensState = Pick<
  LensState,
  'trialCycleId' | 'plusUnlocked' | 'proUnlocked'
> & {
  /** Days remaining in the trial. See FIDELITY DECISION above — not yet derivable from the store
   *  alone; pass the computed value from the caller. */
  trialDaysLeft: number | null;
};

export type TrialCountdownChipProps = {
  /** The four lens/trial fields the web reads from `useLens()`. See FIDELITY DECISION above —
   *  pass these from whatever holds trial state today; swap for a real `useLens()` hook once
   *  `@/folio/lib/lens` ships. */
  lens: TrialCountdownChipLensState;
  onPress: () => void;
};

export function TrialCountdownChip({ lens, onPress }: TrialCountdownChipProps) {
  const t = useTheme();
  const s = makeStyles(t);

  if (!lens.trialCycleId || lens.plusUnlocked || lens.proUnlocked) return null;
  if (lens.trialDaysLeft === null) return null;

  const label =
    lens.trialDaysLeft <= 0
      ? 'Last day · trial'
      : lens.trialDaysLeft === 1
        ? '1 day left · trial'
        : `${lens.trialDaysLeft} days left · trial`;

  // Truth pass (2026-07-10): the relock enforces this chip's own countdown end date
  // (payday-anchored with a 21-day floor) — "at payday" over-promised for weekly earners.
  const coverage = 'Every paid lens (Plus + Pro) unlocked. Locks itself when the countdown ends.';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} — ${coverage} Tap to see plans.`}
      onPress={onPress}
      style={({ pressed: isPressed }) => [s.chip, isPressed ? pressed : undefined]}
    >
      <View style={s.dot} />
      <Text style={s.label}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: gap.xs,
      height: 28,
      paddingHorizontal: gap.sm,
      borderRadius: radius.pill,
      backgroundColor: t.calmSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: t.calm,
    },
    label: {
      fontSize: 10.5,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: t.calm,
      fontVariant: ['tabular-nums'],
    },
  });
}
