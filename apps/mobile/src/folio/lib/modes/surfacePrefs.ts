/**
 * @rn-lib       modeSurfacePrefs
 * @purpose      Per-mode default sort / emphasis for list surfaces
 *               (Subs, Pots, Calendar). No copy — just what the user
 *               sees FIRST when they land on a screen, so the list
 *               already matches how they're living with money.
 *
 *               Optimizer opens Subs sorted by biggest cost. Debt sees
 *               it sorted by next renewal. Growth opens Pots sorted by
 *               "furthest from goal" so pace-feeding is one glance.
 *               Same list, same sort options — just a smarter default.
 * @notes        RN port of folio-melo (design-main)
 *               `src/lib/modes/surfacePrefs.ts`, kept verbatim — use in the
 *               equivalent list screens.
 */
import type { MoneyMode } from './types';

/* ─────────────────────────── Subs ─────────────────────────── */

export type SubsSort = 'value' | 'cost' | 'next';

const SUBS_SORT: Record<MoneyMode, SubsSort> = {
  survival: 'next', // what's about to hit before payday
  stability: 'value', // is anything not earning its place
  growth: 'cost', // biggest ticket to trim first
  debt: 'next', // near-term commitments squeeze the paydown
  irregular: 'next', // what runway do fixed costs eat next
  household: 'cost', // biggest shared cost first
  planning: 'cost', // what could I redirect to the goal
  optimizer: 'cost', // sweep biggest to smallest
  reset: 'value', // find one thing that's clearly quiet
  lowVis: 'next', // "here's what's coming" is honest
};

export function subsDefaultSort(mode: MoneyMode): SubsSort {
  return SUBS_SORT[mode] ?? 'value';
}

/* ─────────────────────────── Pots ─────────────────────────── */

/** How Pots orders and emphasises the list per mode.
 *  - `progress`   → nearest to goal first (celebratory, Stability/Planning)
 *  - `gap`        → furthest from goal first (Growth — feed the laggard)
 *  - `pace`       → biggest £/wk contribution first (Debt — repayment first)
 *  - `saved-desc` → most cash first (Survival/Irregular — what can I lean on)
 *  - `saved-asc`  → least cash first (Reset — one small pot, that's enough)
 *  - `alpha`      → name (Low-Vis, Household — no ranking implied)
 */
export type PotsSort = 'progress' | 'gap' | 'pace' | 'saved-desc' | 'saved-asc' | 'alpha';

const POTS_SORT: Record<MoneyMode, PotsSort> = {
  survival: 'saved-desc',
  stability: 'progress',
  growth: 'gap',
  debt: 'pace',
  irregular: 'saved-desc',
  household: 'alpha',
  planning: 'progress',
  optimizer: 'pace',
  reset: 'saved-asc',
  lowVis: 'alpha',
};

export function potsDefaultSort(mode: MoneyMode): PotsSort {
  return POTS_SORT[mode] ?? 'progress';
}

export type PotLite = { id: string; name: string; saved: number; goal: number; perWeek: number };

/** Pure sorter — same list, mode-shaped order. Stable across renders. */
export function sortPots<T extends PotLite>(pots: T[], sort: PotsSort): T[] {
  const arr = pots.slice();
  switch (sort) {
    case 'progress':
      return arr.sort((a, b) => b.saved / Math.max(1, b.goal) - a.saved / Math.max(1, a.goal));
    case 'gap':
      return arr.sort((a, b) => b.goal - b.saved - (a.goal - a.saved));
    case 'pace':
      return arr.sort((a, b) => b.perWeek - a.perWeek);
    case 'saved-desc':
      return arr.sort((a, b) => b.saved - a.saved);
    case 'saved-asc':
      return arr.sort((a, b) => a.saved - b.saved);
    case 'alpha':
      return arr.sort((a, b) => a.name.localeCompare(b.name));
  }
}

/* ─────────────────────────── Calendar ─────────────────────────── */

/** Which day matters most, per mode. The Calendar highlights it with a
 *  jump-pill and a tinted line — same data, mode-shaped priority.
 *  - `tightest`  → the lowest-spare day (Survival, Stability, LowVis)
 *  - `nextIn`    → the next money-in event (Irregular — runway anchor)
 *  - `nextOut`   → the next money-out event (Debt — repayment anchor,
 *                                            Optimizer — next renewal to cut)
 *  - `payday`    → the payday itself (Planning — countdown to the goal,
 *                                     Reset — just get to the next one,
 *                                     Growth — pot-feed moment,
 *                                     Household — shared drop)
 */
export type CalendarAnchor = 'tightest' | 'nextIn' | 'nextOut' | 'payday';

const CAL_ANCHOR: Record<MoneyMode, CalendarAnchor> = {
  survival: 'tightest',
  stability: 'tightest',
  growth: 'payday',
  debt: 'nextOut',
  irregular: 'nextIn',
  household: 'payday',
  planning: 'payday',
  optimizer: 'nextOut',
  reset: 'payday',
  lowVis: 'tightest',
};

export function calendarDefaultAnchor(mode: MoneyMode): CalendarAnchor {
  return CAL_ANCHOR[mode] ?? 'tightest';
}

/** Short label for the jump-pill by anchor. Kept here so voice doesn't
 *  drift between the calendar and the framing banner. */
export function calendarAnchorLabel(anchor: CalendarAnchor): string {
  switch (anchor) {
    case 'tightest':
      return 'Lowest point';
    case 'nextIn':
      return 'Next in';
    case 'nextOut':
      return 'Next out';
    case 'payday':
      return 'Next payday';
  }
}
