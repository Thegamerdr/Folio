// TrialEndedRow — the trial-ended acknowledgement moment (plumbing existed, nothing rendered it).
//
// @rn-component TrialEndedRow
// @purpose      The one-cycle lens trial auto-relocks when it ends. `useLens()` already computes
//               `trialEndPending` (trial ended, user not yet told) and `acknowledgeTrialEnd()`, but
//               nothing consumed either — a user sitting on a free lens when the trial expired never
//               learned why the paid lenses relocked (silent take-away; see plans/106). This row is
//               that acknowledgement: a calm, honest "here's what happened" note with a door to Plans
//               and a plain dismiss — never a forced sell (doctrine: acknowledging must not require
//               routing to a sales surface).
// @reads        `trialEndPending` via useLens() (derived from lens.trialEndedCycleId /
//               trialEndAcknowledged / plusUnlocked / proUnlocked — see lib/lens.ts).
// @writes       `acknowledgeTrialEnd()` — on either action (Plans or OK); Plans additionally
//               navigates to the paywall.
// @tokens       inset · hairline · calm · ink · muted — all from the kit, no new token.

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLens } from '@/folio/lib/lens';
import { copy } from '@/folio/copy/copy';
import { gap, pressed, radius, useTheme, type Palette } from '@/folio/theme';
import type { Nav } from '@/folio/types';

export function TrialEndedRow({ nav }: { nav: Nav }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { trialEndPending, acknowledgeTrialEnd } = useLens();

  if (!trialEndPending) return null;

  return (
    <View style={s.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${copy.plans.trial.ended.head}. ${copy.plans.trial.ended.body}`}
        onPress={() => {
          acknowledgeTrialEnd();
          nav.go('paywall');
        }}
        style={({ pressed: isPressed }) => [s.mainRow, isPressed ? pressed : undefined]}
      >
        <View style={s.dot} />
        <View style={s.textCol}>
          <Text style={s.title}>{copy.plans.trial.ended.head}</Text>
          <Text style={s.body}>{copy.plans.trial.ended.body}</Text>
        </View>
        <Text style={s.plansLink}>Plans →</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={8}
        onPress={() => acknowledgeTrialEnd()}
        style={({ pressed: isPressed }) => [s.okButton, isPressed ? pressed : undefined]}
      >
        <Text style={s.okText}>OK</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    container: {
      alignItems: 'stretch',
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      marginTop: gap.md,
      minHeight: 44,
      paddingHorizontal: gap.md,
      paddingVertical: gap.sm,
    },
    mainRow: {
      alignItems: 'center',
      columnGap: gap.sm,
      flex: 1,
      flexDirection: 'row',
    },
    dot: {
      backgroundColor: t.calm,
      borderRadius: 999,
      height: 6,
      width: 6,
    },
    textCol: {
      flex: 1,
      rowGap: 1,
    },
    title: {
      color: t.ink,
      fontSize: 12,
      fontWeight: '500',
    },
    body: {
      color: t.muted,
      fontSize: 12,
    },
    plansLink: {
      color: t.calmStrong,
      fontSize: 12,
    },
    okButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: gap.sm,
    },
    okText: {
      color: t.muted,
      fontSize: 12,
      fontWeight: '500',
    },
  });
}
