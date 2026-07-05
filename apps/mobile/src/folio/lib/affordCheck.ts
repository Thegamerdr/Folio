/**
 * @rn-lib affordCheck — "Before You Spend" engine.
 *
 * Faithful 1:1 RN port of the web design source
 * (folio-melo/.claude/worktrees/design-main/src/lib/affordCheck/index.ts).
 *
 * Uses `safeZoneMath(ModeInputs)` — now ported verbatim at `./modes/safeZone` — so the "Can I
 * afford this?" verdict agrees byte-for-byte with the web's Safe Zone-now figure and with Today's
 * own headline number (both read the same `safeZoneMath` output). This replaces an earlier
 * route-engine re-derivation that computed its own `perDay`/`tightestSpare` shape independently of
 * `safeZoneMath` and so could disagree with Today's Safe Zone number — see PARITY_GAPS.md Group 1.
 *
 * Never judges the purchase; always celebrates the check (COPY_LINT discipline, PORT_BIBLE §6).
 */
import type { ModeInputs } from './modes/types';
import { safeZoneMath } from './modes/safeZone';

export type AffordVerdict = {
  state: 'safe' | 'tight' | 'not-now' | 'safe-later';
  headline: string;
  /** Safe Zone total after this spend (may be negative — honesty over comfort). */
  after: number;
  perDayAfter: number;
  /** ISO date the amount would become safe (only set for safe-later). */
  safeOn: string | null;
};

/** "Tuesday" for the safe-later headline — matches the web's weekday-only rendering. */
function formatDayShort(iso: string): string {
  const d = new Date(`${iso}${iso.length === 10 ? 'T00:00:00' : ''}`);
  return d.toLocaleDateString('en-GB', { weekday: 'long' });
}

/** The single honest verdict every surface calls — byte-faithful to the web's checkAfford(). */
export function checkAfford(amount: number, inputs: ModeInputs): AffordVerdict {
  const ask = Math.max(0, Math.round(amount));
  const zone = safeZoneMath(inputs);
  const after = zone.total - ask;
  const daysLeft = Math.max(1, zone.daysLeft);
  const perDayAfter = Math.max(0, Math.floor(after / daysLeft));

  // Not-now: pushes Safe Zone under zero. If a payday date is known, offer
  // "safe on <weekday>" instead of a hard "no" — the same hedge the web makes.
  if (after < 0) {
    if (zone.until) {
      return {
        state: 'safe-later',
        headline: `Safe on ${formatDayShort(zone.until)}`,
        after,
        perDayAfter,
        safeOn: zone.until,
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
  if (perDayAfter < Math.floor(zone.perDay / 2)) {
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
