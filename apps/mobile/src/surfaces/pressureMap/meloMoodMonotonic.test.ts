import { describe, expect, it } from 'vitest';

import { SPECTRUM, currentPressure, type PressureKey } from './meloPressure.js';
import type { MeloMood } from './melo/meloStates.js';
import type { LocalRouteSummary } from '../../local/localLedger.js';

// Pins FIX 2: Melo's mood is read from the tightest point via a threshold ladder. The ladder must be
// MONOTONIC — as money tightens, the mood may only hold or worsen, never relax to a calmer pose. The
// earlier table put soft-concern on the milder `soft` band and then dropped back from a more-
// concerned `pressured` to soft-concern on `overspent`, so the figure could look calmer at a worse
// balance.

// Concern rank: low number = calmer, high = more concerned. `reassuring` is a positive aside that
// never appears in the money-pressure ladder, but rank it between calm and attentive for safety.
const CONCERN_RANK: Readonly<Record<MeloMood, number>> = {
  calm: 0,
  reassuring: 1,
  attentive: 2,
  'soft-concern': 3,
};

// SPECTRUM is ordered safest -> tightest.
const ORDER_SAFEST_FIRST: readonly PressureKey[] = [
  'safe',
  'calm',
  'soft',
  'pressured',
  'overspent',
];

function routeWithTightest(tightestBalanceMinor: number): LocalRouteSummary {
  // currentPressure only reads tightestBalanceMinor (plus routeHasMeaningfulPath, which is satisfied
  // by a non-empty points list). A single dated point with a real balance is enough.
  return {
    availableNowMinor: tightestBalanceMinor,
    tightestDay: 'D+7',
    tightestBalanceMinor,
    pendingReviewCount: 0,
    protectedItems: [],
    nextPaydayLabel: 'next payday',
    timeline: [],
    points: [
      {
        accessibleLabel: 'point',
        actionLabel: 'Reveal record',
        authorityLabel: 'Confirmed local calculation',
        balanceMinor: tightestBalanceMinor,
        date: '2026-07-05',
        deltaMinor: -1000,
        dependsOn: [],
        explanation: 'A dated move.',
        label: 'D+7',
        pointKind: 'expected',
        provenanceLabel: 'local',
        reviewState: 'already real',
        sourceLabel: 'Local ledger',
        title: 'A bill',
        tone: 'estimated',
      },
    ],
    confirmedTransactionCount: 1,
    lastActionLabel: 'ready',
  } as LocalRouteSummary;
}

describe('Melo mood ladder is monotonic as money tightens', () => {
  it('orders the spectrum moods non-decreasing in concern from safe to overspent', () => {
    const ranks = ORDER_SAFEST_FIRST.map((key) => {
      const band = SPECTRUM.find((entry) => entry.key === key);
      expect(band, key).toBeDefined();
      return CONCERN_RANK[band!.mood];
    });

    for (let index = 1; index < ranks.length; index += 1) {
      expect(
        ranks[index]! >= ranks[index - 1]!,
        `mood at ${ORDER_SAFEST_FIRST[index]} (rank ${ranks[index]}) must be at least as concerned as ${ORDER_SAFEST_FIRST[index - 1]} (rank ${ranks[index - 1]})`,
      ).toBe(true);
    }
  });

  it('never reports a calmer mood at a lower tightest balance', () => {
    // Sweep the tightest point from comfortable down through overdraft. The resolved mood's concern
    // rank must be non-decreasing the whole way down.
    const balances = [50_000, 32_500, 32_499, 18_400, 18_399, 5_000, 4_999, 0, -1, -10_000];
    let previousRank = -1;
    for (const balance of balances) {
      const key = currentPressure(routeWithTightest(balance));
      const band = SPECTRUM.find((entry) => entry.key === key);
      const rank = CONCERN_RANK[band!.mood];
      expect(rank, `balance ${balance} resolved to ${key}/${band!.mood}`).toBeGreaterThanOrEqual(
        previousRank,
      );
      previousRank = rank;
    }
  });
});
