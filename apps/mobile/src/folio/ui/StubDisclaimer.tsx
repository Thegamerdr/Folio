// StubDisclaimer — the faithful 1:1 RN port of the web
// (folio-melo/.claude/worktrees/design-main/src/components/folio/mode/StubDisclaimer.tsx).
//
// @rn-component StubDisclaimer
// @purpose      One honest line under every lens's hero telling the user where the numbers come
//               from. Standardised so voice doesn't drift between modes.
// @copy         FROZEN. "starting from £X · <source>" is the only line ever shown.
// @tokens       muted-ink (muted) · 10.5px · opacity 0.7
//
// FIDELITY DECISION: the web reads `MODE_SHIP_STATUS[mode]` from `@/lib/modes` to decide whether
// to append the "this mode borrows the survival maths for now" caveat. `@/folio/lib/modes/types`
// now exports a real `MODE_SHIP_STATUS` map (types.ts:45) — but every one of the ten `MoneyMode`
// entries is `'shipped'` (each has a real strategy under `strategies/`), so
// `MODE_SHIP_STATUS[mode] === 'shipped'` is always `true` today and the caveat line would never
// render regardless. `shipped` stays an explicit prop (not a direct `MODE_SHIP_STATUS` read) so a
// future mode landing as `'parked'` can flip this without this component needing to know about the
// modes module; callers can keep passing `true`, or switch to `MODE_SHIP_STATUS[mode] === 'shipped'`
// for defense-in-depth against a future non-shipped mode — either is correct while the map is all-shipped.

import { StyleSheet, Text } from 'react-native';

import type { BalanceSource, CurrentBalance, MoneyMode } from '@/folio/store';
import { type Palette, useTheme } from '@/folio/theme';

const BALANCE_SOURCE_LABEL: Record<BalanceSource, string> = {
  'user-entered': 'you set this',
  statement: 'from your last statement',
  'pdf-derived': 'from a statement you added',
  'ocr-derived': 'from a photo you added',
  corrected: 'you corrected this',
  sample: 'sample data',
};

export type StubDisclaimerProps = {
  mode: MoneyMode;
  balance: CurrentBalance;
  /** Whether `mode` has a real derivation today. See FIDELITY DECISION above — defaults to
   *  `true` (no caveat) until `@/folio/lib/modes`'s `MODE_SHIP_STATUS` map is wired in. */
  shipped?: boolean | undefined;
};

export function StubDisclaimer({ mode: _mode, balance, shipped = true }: StubDisclaimerProps) {
  const t = useTheme();
  const s = makeStyles(t);
  const source = BALANCE_SOURCE_LABEL[balance.source] ?? 'sample data';
  const amount = `£${balance.amount.toLocaleString('en-GB')}`;

  return (
    <Text style={s.line}>
      starting from {amount} · {source}
      {!shipped ? ' · this mode borrows the survival maths for now' : null}
    </Text>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    line: {
      fontSize: 10.5,
      color: t.muted,
      opacity: 0.7,
      marginTop: 12,
      textAlign: 'center',
    },
  });
}
