/**
 * @rn-lib affordCheck — "Before You Spend" engine.
 *
 * Faithful RE-DERIVATION (not a literal line-for-line port) of the web design source
 * (folio-melo/.claude/worktrees/design-main/src/lib/affordCheck/index.ts). The web version reads
 * `safeZoneMath(ModeInputs)` — a lens/mode-strategy engine (survival/stability/growth/…) that does
 * NOT exist in this RN app. RN's Today instead derives its headline number from the money-path
 * route engine (`computeRoute` / `routeFromStore` / `useRoute` in ./moneyPath + ./storeRoute),
 * which is what `TodayScreen.tsx` already reads for its own "tightest spare" figure. This module
 * re-expresses the SAME verdict shape (safe / tight / not-now / safe-later) and the SAME headline
 * copy against THAT engine's output, so the "Can I afford this?" verdict agrees byte-for-byte with
 * Today's own low-point number — the web's core invariant ("uses safeZoneMath so the answer agrees
 * with Today's headline") is preserved, just anchored to the RN route engine instead of the
 * unported mode-strategy system.
 *
 * DEVIATION (flagged per instructions): the web's `tight` branch compares against `zone.perDay / 2`
 * (a per-day budget derived from the mode strategy). RN's route engine does not expose a `perDay`
 * figure independent of the tightest-spare point, so `perDay` here is computed the same way
 * `TodayScreen` derives its own daily figure: tightestSpare / daysLeft (floor, never negative). This
 * is the closest honest equivalent available in the ported engine set — flag for reconciliation if/
 * when a lens/mode engine lands in RN.
 *
 * Never judges the purchase; always celebrates the check (COPY_LINT discipline, PORT_BIBLE §6).
 */

export type AffordInputs = {
  /** The lowest projected balance across the route window (RouteResult.tightPoint.amount) — RN's
   *  equivalent of the web's `safeZoneMath(...).total`. */
  tightestSpare: number;
  /** ISO date the tightest point falls on (RouteResult.tightPoint.date), or null when unknown. */
  tightestDate: string | null;
  /** Whole calendar days from today to payday (RouteResult.daysToPayday). Used to derive a
   *  per-day figure the same way TodayScreen does (tightestSpare / daysLeft). */
  daysToPayday: number;
};

export type AffordVerdict = {
  state: 'safe' | 'tight' | 'not-now' | 'safe-later';
  headline: string;
  /** Safe Zone total after this spend (may be negative — honesty over comfort). */
  after: number;
  perDayAfter: number;
  /** ISO date the amount would become safe (only set for safe-later). */
  safeOn: string | null;
};

/** "Tuesday" for the safe-later headline. Byte-faithful weekday-only rendering (the web's
 *  formatDayShort used the same locale weekday format; RN mirrors it without a date-fns dep). */
function formatDayShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'long' });
}

/** The single honest verdict every surface calls — RN's re-derivation of the web checkAfford(). */
export function checkAfford(amount: number, inputs: AffordInputs): AffordVerdict {
  const ask = Math.max(0, Math.round(amount));
  const daysLeft = Math.max(1, Math.round(inputs.daysToPayday));
  const perDayBefore = Math.max(0, Math.floor(inputs.tightestSpare / daysLeft));
  const after = inputs.tightestSpare - ask;
  const perDayAfter = Math.max(0, Math.floor(after / daysLeft));

  // Not-now: pushes the tightest point under zero. If a tight-point date is known, offer
  // "safe on <weekday>" instead of a hard "no" — the same hedge the web makes.
  if (after < 0) {
    if (inputs.tightestDate) {
      return {
        state: 'safe-later',
        headline: `Safe on ${formatDayShort(inputs.tightestDate)}`,
        after,
        perDayAfter,
        safeOn: inputs.tightestDate,
      };
    }
    return {
      state: 'not-now',
      headline: 'Not now — but the check still counts',
      after,
      perDayAfter,
      safeOn: null,
    };
  }

  // Tight: fits, but eats into daily headroom.
  if (perDayAfter < Math.floor(perDayBefore / 2)) {
    return {
      state: 'tight',
      headline: 'Tight, but the path holds',
      after,
      perDayAfter,
      safeOn: null,
    };
  }

  return { state: 'safe', headline: 'Safe — plenty of room', after, perDayAfter, safeOn: null };
}

/** Colour tone token — surfaces read this to keep the verdict calm and consistent (never a warning
 *  colour on `tight`, never a positive colour on `not-now`). Maps 1:1 to the web's affordTone. */
export function affordTone(
  state: AffordVerdict['state'],
): 'positive' | 'accent' | 'muted' | 'caution' {
  switch (state) {
    case 'safe':
      return 'positive';
    case 'tight':
      return 'accent';
    case 'safe-later':
      return 'caution';
    case 'not-now':
      return 'muted';
  }
}
