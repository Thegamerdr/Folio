// TodayNudges — payday-ritual nudge gate (screens/today/TodayNudges.tsx, `shouldOfferRitual`).
//
// Companion to TodayNudges.test.ts (review-queue nudge) and TodayNudges.collapse.test.ts
// (shortfall nudge + collapse contract). This file pins the RITUAL nudge's gate: offered when
// onboarding is done and payday is within 2 days, UNLESS a cycle already closed recently (within
// 3 days) OR a cycle already closed in the current CALENDAR MONTH. The calendar-month cap is the
// fix under test — without it, a weekly/fortnightly/four-weekly earner's `daysToPayday <= 2`
// condition fires on every pay cycle, re-offering the same monthly ceremony several times a month.
//
// Node-safe by design: TodayNudges.tsx imports react-native and JSX and so cannot load under the
// Node test runner (the repo's vitest glob is `apps/**/*.test.ts`, .tsx is never collected — see
// this component's own TodayNudges.test.ts / TodayNudges.collapse.test.ts headers for the same
// constraint). The gate is plain, deterministic, and free of any react-native dependency, so it is
// restated here 1:1 from the component's exported `shouldOfferRitual` predicate.

import { describe, expect, it } from 'vitest';

import { latestLivedCycle } from '../../lib/historyCycles';
import type { CycleRecord } from '../../store';

const RECENT_CLOSE_WINDOW_MS = 3 * 86_400_000;

// 1:1 restatement of TodayNudges.tsx's exported `shouldOfferRitual` — see that function's doc
// comment for the full rationale. Kept in sync manually (react-native import boundary prevents
// importing it directly under Node — same constraint every sibling test file in this directory
// documents).
function shouldOfferRitual(params: {
  onboardingDone: boolean;
  daysToPayday: number | null;
  lastClosedAt: string | null;
  now: Date;
}): boolean {
  const { onboardingDone, daysToPayday, lastClosedAt, now } = params;
  if (!onboardingDone || daysToPayday === null || daysToPayday > 2) return false;

  const closedRecently =
    lastClosedAt !== null &&
    now.getTime() - new Date(`${lastClosedAt}T00:00:00`).getTime() < RECENT_CLOSE_WINDOW_MS;
  if (closedRecently) return false;

  const closedThisCalendarMonth =
    lastClosedAt !== null &&
    (() => {
      const closed = new Date(`${lastClosedAt}T00:00:00`);
      return closed.getFullYear() === now.getFullYear() && closed.getMonth() === now.getMonth();
    })();
  if (closedThisCalendarMonth) return false;

  return true;
}

describe('TodayNudges — payday ritual nudge gate', () => {
  it('offers the ritual when payday is within 2 days and no cycle has closed yet', () => {
    expect(
      shouldOfferRitual({
        onboardingDone: true,
        daysToPayday: 1,
        lastClosedAt: null,
        now: new Date('2026-06-24T09:00:00'),
      }),
    ).toBe(true);
  });

  it('does not offer the ritual before onboarding is done', () => {
    expect(
      shouldOfferRitual({
        onboardingDone: false,
        daysToPayday: 0,
        lastClosedAt: null,
        now: new Date('2026-06-25T09:00:00'),
      }),
    ).toBe(false);
  });

  it('does not offer the ritual when there is no known payday', () => {
    expect(
      shouldOfferRitual({
        onboardingDone: true,
        daysToPayday: null,
        lastClosedAt: null,
        now: new Date('2026-06-25T09:00:00'),
      }),
    ).toBe(false);
  });

  it('does not offer the ritual when payday is more than 2 days away', () => {
    expect(
      shouldOfferRitual({
        onboardingDone: true,
        daysToPayday: 3,
        lastClosedAt: null,
        now: new Date('2026-06-22T09:00:00'),
      }),
    ).toBe(false);
  });

  it('suppresses the ritual for 3 days after a close, even across a month boundary', () => {
    // Close on the last day of June; still within the 3-day recent-close window on July 1st
    // even though that is a new calendar month.
    expect(
      shouldOfferRitual({
        onboardingDone: true,
        daysToPayday: 1,
        lastClosedAt: '2026-06-30',
        now: new Date('2026-07-01T09:00:00'),
      }),
    ).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // The monthly-cap fix: weekly/fortnightly/four-weekly earners hit
  // `daysToPayday <= 2` several times a month. Once a cycle has closed in the
  // CURRENT calendar month, the ritual must not be offered again that month even
  // once the 3-day recent-close window has elapsed.
  // ---------------------------------------------------------------------------
  it('suppresses the ritual for a weekly earner whose cycle already closed earlier this calendar month', () => {
    // Closed June 4th; now June 25th (>3 days later, but same calendar month) and a new weekly
    // payday is 1 day away. Must stay suppressed until July.
    expect(
      shouldOfferRitual({
        onboardingDone: true,
        daysToPayday: 1,
        lastClosedAt: '2026-06-04',
        now: new Date('2026-06-25T09:00:00'),
      }),
    ).toBe(false);
  });

  it('offers the ritual again once the calendar month has rolled over, even for a weekly earner', () => {
    // Closed June 4th; now July 2nd, new calendar month, payday 1 day away.
    expect(
      shouldOfferRitual({
        onboardingDone: true,
        daysToPayday: 1,
        lastClosedAt: '2026-06-04',
        now: new Date('2026-07-02T09:00:00'),
      }),
    ).toBe(true);
  });

  it('offers the ritual only once per calendar month for a weekly earner across ~4 weekly windows', () => {
    // Simulates a weekly earner hitting daysToPayday<=2 on four different Fridays within June.
    // Only the first offer (no prior close this month) should return true; once closed, the rest
    // of the month is suppressed.
    const fridaysInJune = ['2026-06-05', '2026-06-12', '2026-06-19', '2026-06-26'];
    let lastClosedAt: string | null = null;
    const offers: boolean[] = [];
    for (const dateIso of fridaysInJune) {
      const now = new Date(`${dateIso}T09:00:00`);
      const offered = shouldOfferRitual({
        onboardingDone: true,
        daysToPayday: 0,
        lastClosedAt,
        now,
      });
      offers.push(offered);
      if (offered) {
        // Simulate the user completing the ritual, closing the cycle today.
        lastClosedAt = dateIso;
      }
    }
    expect(offers).toEqual([true, false, false, false]);
  });

  // ---------------------------------------------------------------------------
  // DATA_INTELLIGENCE.md phase ④ — the component derives `lastClosedAt` via
  // `latestLivedCycle(cycles)`, NOT `cycles[0]`, so a reconstructed (bulk-import
  // synthesized) cycle can never suppress or otherwise stand in for the real
  // ritual-offer gate. Pinned here (not just in historyCycles.test.ts) because
  // this is the exact call site the component wires it into.
  // ---------------------------------------------------------------------------
  it('a reconstructed cycle sitting ahead of the array does not become lastClosedAt', () => {
    const livedMay: CycleRecord = {
      closedAt: '2026-05-25',
      label: 'May (lived)',
      spare: 1,
      tightPoint: 1,
      setAside: 0,
      note: 'ritual-sealed',
    };
    const reconstructedJune: CycleRecord = {
      closedAt: '2026-06-30',
      label: 'June 2026',
      spare: 0,
      tightPoint: 0,
      setAside: 0,
      note: 'estimate',
      reconstructed: true,
    };
    // Array order mirrors a real post-backfill cycles[]: the reconstructed month sits first.
    const cycles = [reconstructedJune, livedMay];
    const lastClosedAt = latestLivedCycle(cycles)?.closedAt ?? null;
    expect(lastClosedAt).toBe('2026-05-25');

    // And with that honest lastClosedAt, the ritual is offered again once the calendar month
    // has moved on from the lived close — proving the reconstructed cycle never suppressed it.
    expect(
      shouldOfferRitual({
        onboardingDone: true,
        daysToPayday: 1,
        lastClosedAt,
        now: new Date('2026-07-02T09:00:00'),
      }),
    ).toBe(true);
  });

  it('an all-reconstructed cycles[] (no lived cycle yet) yields a null lastClosedAt', () => {
    const reconstructed: CycleRecord = {
      closedAt: '2026-06-30',
      label: 'June 2026',
      spare: 0,
      tightPoint: 0,
      setAside: 0,
      note: 'estimate',
      reconstructed: true,
    };
    const lastClosedAt = latestLivedCycle([reconstructed])?.closedAt ?? null;
    expect(lastClosedAt).toBeNull();

    // With no lived close recorded, the ritual is offered on its own merits (payday-proximity gate).
    expect(
      shouldOfferRitual({
        onboardingDone: true,
        daysToPayday: 0,
        lastClosedAt,
        now: new Date('2026-07-02T09:00:00'),
      }),
    ).toBe(true);
  });
});
