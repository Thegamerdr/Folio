/**
 * Safe Zone math — the single source of truth for "how much can I spend
 * without breaking a commitment?".
 *
 * RN port of folio-melo (design-main) `src/lib/modes/safeZone.ts`, verbatim.
 * Fed by the same `ModeInputs` snapshot every strategy sees, so Today, the
 * Bills Shield sheet, the Before-You-Spend verdict, and the Melo chat tool
 * all agree on the number and the reasons behind it.
 *
 * Contract:
 *   - `total`   signed £; the Safe Zone amount. Rounded DOWN to the pound
 *               so we never over-promise headroom.
 *   - `perDay`  £ / day between now and payday (or the tightest date).
 *   - `lines`   the honest decomposition. Each line is either fixed
 *               ("bills shield") or editable ("buffer"), so tapping the
 *               Safe Zone number can open a sheet that shows exactly what
 *               makes it up and lets the user tune what's tunable.
 *   - `until`   ISO date the Safe Zone runs to. `null` when unknown.
 *
 * Never returns NaN. Missing inputs collapse to £0 lines, not hidden ones —
 * the user should see a zero-line rather than wonder where the money went.
 */
import type { ModeInputs } from './types';

/** The one shared "getting dangerous" floor (£), used anywhere a mode-agnostic ladder needs a
 *  single number to compare Safe Zone spare against. Mirrors melo-engine's own
 *  `DANGER_FLOOR_PENCE` (packages/melo-engine/src/states.ts, £10 in pence) — kept as one exported
 *  constant here (rather than duplicated per call site) since the UI engine had no equivalent
 *  constant of its own before this. Notifications (`lib/notifyState.ts`) import this rather than
 *  hardcoding their own copy of the same number. */
export const DANGER_FLOOR = 10;

export type SafeZoneLine = {
  key: string;
  label: string;
  amount: number;
  editable: boolean;
  hint?: string;
};

export type SafeZoneMath = {
  total: number;
  perDay: number;
  daysLeft: number;
  until: string | null;
  lines: SafeZoneLine[];
  /** True when a component is a projection, not an actual known figure. */
  estimating: boolean;
};

function floorPound(n: number): number {
  return Math.floor(Math.max(0, n));
}

function daysBetween(fromISO: string | null, toISO: string | null): number {
  if (!toISO) return 0;
  const from = fromISO ? new Date(fromISO) : new Date();
  const to = new Date(toISO);
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

/** Reserved for bills / subs that will renew before the tight-point date.
 *  Subs are keyed by name (same key `subPaused` uses). Kept cheap: the
 *  strategies already pay for the tightest-point walk. */
function shieldedBills(inputs: ModeInputs): number {
  const daysToPayday = (() => {
    if (!inputs.tightestDate) return 0;
    const ms = new Date(inputs.tightestDate).getTime() - Date.now();
    return Math.max(0, Math.round(ms / 86_400_000));
  })();
  if (daysToPayday <= 0) return 0;
  return inputs.subs.reduce((sum, s) => {
    if (inputs.subPaused[s.name]) return sum;
    if (s.nextRenewalDaysAway < 0 || s.nextRenewalDaysAway > daysToPayday) return sum;
    return sum + Math.max(0, s.cost);
  }, 0);
}

export function safeZoneMath(inputs: ModeInputs): SafeZoneMath {
  const balance = Math.max(0, inputs.currentBalance?.amount ?? 0);
  const buffer = Math.max(0, inputs.bufferAmount ?? 100);
  const shield = shieldedBills(inputs);

  const lines: SafeZoneLine[] = [
    { key: 'balance', label: 'In your account', amount: balance, editable: false },
    {
      key: 'shield',
      label: 'Bills Shield',
      amount: -shield,
      editable: false,
      hint: 'Reserved for bills before payday',
    },
    {
      key: 'buffer',
      label: 'Your buffer',
      amount: -buffer,
      editable: true,
      hint: "The cushion you'd rather not touch",
    },
  ];

  const total = floorPound(balance - shield - buffer);
  const daysLeft = daysBetween(null, inputs.tightestDate);
  const perDay = floorPound(daysLeft > 0 ? total / daysLeft : total);

  return {
    total,
    perDay,
    daysLeft,
    until: inputs.tightestDate ?? null,
    lines,
    estimating: shield > 0,
  };
}
