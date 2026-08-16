// caughtBills — pure-logic coverage for findCaughtBills (lib/caughtBills.ts).
//
// The bridge that turns the recurring-charge DETECTION engine into BillCaught candidates, mirroring
// caughtSubs.ts's own test shape. Pins the load-bearing behaviours from the task brief:
//   • min-occurrences-per-cadence catch, same engine as subs
//   • a merchant already in the sub catalog -> NOT caught as a bill
//   • the merchant SubCaughtSheet is currently offering -> NOT caught as a bill (subs win the tie)
//   • a dismissed merchant -> NOT caught
// plus the honesty guarantee (payment facts only) and the field mapping.
//
// IMPORTANT FIXTURE NOTE: `detectRecurring` has no subscription-vs-bill distinction, so ANY single
// qualifying non-catalog merchant is, by construction, findCaughtSubs's one candidate (`caught[0]`)
// — and the double-propose guard excludes exactly that merchant (see lib/caughtBills.ts's module
// header). A test ledger containing only ONE qualifying merchant therefore always ends up excluded.
// Tests that want to prove a positive catch use a two-merchant ledger: a fixed "sink" merchant
// (`SINK`) that always sorts first and absorbs the sub-tie exclusion, plus the merchant under test.
//
// Node-safe: touches only the pure `findCaughtBills` (no react-native, no DOM, no store mutation), so
// it is a plain `.test.ts` collected by the apps/**/*.test.ts runner — exactly like caughtSubs.test.ts.

import { describe, expect, it } from 'vitest';

import { findCaughtBills, type CaughtBillCandidate } from './caughtBills';
import { findCaughtSubs } from './caughtSubs';
import type { Transaction } from '../store';

// ---------------------------------------------------------------------------
// Fixture helpers — identical shape to caughtSubs.test.ts's own helpers.
// ---------------------------------------------------------------------------

/** A spend transaction (negative amount, store convention). */
function spend(merchant: string, pounds: number, isoDate: string): Transaction {
  return {
    id: `t-${merchant}-${isoDate}`.toLowerCase().replace(/\s+/g, '-'),
    when: `${isoDate}T09:00:00.000Z`,
    merchant,
    amount: -pounds,
    category: 'bills',
    source: 'seed',
  };
}

/** N monthly charges (~30d apart) of one merchant at a fixed amount. */
function monthly(merchant: string, pounds: number, startIso: string, count: number): Transaction[] {
  const rows: Transaction[] = [];
  const start = new Date(`${startIso}T00:00:00Z`);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(start.getTime() + i * 30 * 86_400_000);
    rows.push(spend(merchant, pounds, d.toISOString().slice(0, 10)));
  }
  return rows;
}

/** N weekly charges (~7d apart) of one merchant at a fixed amount — matches
 *  subSignals.ts's own CADENCE_MIN_OCCURRENCES.weekly (8) when count >= 8. */
function weekly(merchant: string, pounds: number, startIso: string, count: number): Transaction[] {
  const rows: Transaction[] = [];
  const start = new Date(`${startIso}T00:00:00Z`);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(start.getTime() + i * 7 * 86_400_000);
    rows.push(spend(merchant, pounds, d.toISOString().slice(0, 10)));
  }
  return rows;
}

function byName(list: CaughtBillCandidate[], name: string): CaughtBillCandidate | undefined {
  return list.find((c) => c.name === name);
}

// A dedicated "sink" merchant, always present alongside the merchant under test, that exists purely
// to absorb findCaughtSubs's one-candidate double-propose exclusion — see the file header note.
// Its own cadence/amount are irrelevant to the assertions; only its presence in the ledger matters.
const SINK_BILLS: Transaction[] = monthly('Zzz Sink Co', 5, '2026-01-01', 3);

/** True when `merchant` is NOT the one findCaughtSubs currently offers for this ledger (i.e. it is
 *  free of the double-propose exclusion, whatever SINK/detection ordering produced it). */
function isNotCurrentSubCandidate(txns: Transaction[], merchant: string): boolean {
  const first = findCaughtSubs(txns, [])[0];
  return (first?.name ?? '').trim().toLowerCase() !== merchant.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Core catch behaviour — same engine as subs, cadence-tagged.
// ---------------------------------------------------------------------------
describe('findCaughtBills — catches real, non-catalog recurring outflows', () => {
  it('3 monthly charges of a non-catalog merchant → caught, tagged cadence: monthly', () => {
    const txns = [...SINK_BILLS, ...monthly('Octopus Energy', 118.4, '2026-04-01', 3)];
    expect(isNotCurrentSubCandidate(txns, 'Octopus Energy')).toBe(true); // fixture sanity check
    const caught = findCaughtBills(txns, []);

    const sig = byName(caught, 'Octopus Energy');
    expect(sig).toBeDefined();
    expect(sig?.seen).toBe(3);
    expect(sig?.amount).toBeCloseTo(118.4, 2);
    expect(sig?.cadence).toBe('monthly');
    expect(typeof sig?.lastDate).toBe('string');
  });

  it('a confirmed WEEKLY series (≥8 occurrences) → caught, tagged cadence: weekly', () => {
    const txns = [...SINK_BILLS, ...weekly('Cleaner', 25, '2026-01-05', 8)];
    expect(isNotCurrentSubCandidate(txns, 'Cleaner')).toBe(true);
    const sig = byName(findCaughtBills(txns, []), 'Cleaner');
    expect(sig).toBeDefined();
    expect(sig?.cadence).toBe('weekly');
  });

  it('does NOT catch a merchant already in the subscription catalog', () => {
    const txns = [...SINK_BILLS, ...monthly('Netflix', 11.0, '2026-04-01', 3)];
    const caught = findCaughtBills(txns, ['Netflix']);
    expect(byName(caught, 'Netflix')).toBeUndefined();
  });

  it('catalog match is case/whitespace-insensitive', () => {
    const txns = [...SINK_BILLS, ...monthly('Netflix', 11.0, '2026-04-01', 3)];
    const caught = findCaughtBills(txns, ['  netflix  ']);
    expect(byName(caught, 'Netflix')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Double-propose guard — subs take precedence, but ONLY over the one merchant
// SubCaughtSheet is currently showing (findCaughtSubs's first/`caught[0]`
// candidate — see lib/caughtBills.ts's module-header "DOUBLE-PROPOSE GUARD"
// note for why this can't be "every merchant findCaughtSubs could classify as
// a sub": detectRecurring has no subscription-vs-bill distinction, so every
// qualifying non-catalog merchant clears findCaughtSubs's filter by
// construction — excluding the FULL set would make findCaughtBills permanently
// empty.
// ---------------------------------------------------------------------------
describe('findCaughtBills — subs take precedence over the ONE currently-offered sub candidate', () => {
  it('a single qualifying merchant (findCaughtSubs’s only candidate) is excluded from bills entirely', () => {
    const txns = monthly('Sound+ Studio', 6.99, '2026-04-01', 3);
    expect(findCaughtSubs(txns, [])[0]?.name).toBe('Sound+ Studio'); // it IS the sub candidate
    expect(findCaughtBills(txns, [])).toHaveLength(0); // so bills has nothing left to offer
  });

  it('a second qualifying merchant, not the current sub candidate, still surfaces as a bill', () => {
    const txns = [
      ...monthly('Sound+ Studio', 6.99, '2026-04-01', 3),
      ...monthly('Octopus Energy', 118.4, '2026-04-05', 3),
    ];
    const excludedName = findCaughtSubs(txns, [])[0]?.name ?? '';
    const bills = findCaughtBills(txns, []);

    // Whichever of the two merchants the engine currently offers as the sub candidate is absent
    // from bills; the OTHER one still surfaces — proving the guard doesn't starve every candidate.
    expect(byName(bills, excludedName)).toBeUndefined();
    const other = ['Sound+ Studio', 'Octopus Energy'].find((n) => n !== excludedName);
    expect(byName(bills, other as string)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Dismissal — mirrors caughtIncome.ts's dismissed-list gating.
// ---------------------------------------------------------------------------
describe('findCaughtBills — dismissed merchants stay quiet', () => {
  it('does NOT catch a merchant the user already dismissed', () => {
    const txns = [...SINK_BILLS, ...monthly('Council Tax', 162, '2026-04-01', 3)];
    const caught = findCaughtBills(txns, [], ['council tax']);
    expect(byName(caught, 'Council Tax')).toBeUndefined();
  });

  it('dismissed-match is case/whitespace-insensitive', () => {
    const txns = [...SINK_BILLS, ...monthly('Council Tax', 162, '2026-04-01', 3)];
    const caught = findCaughtBills(txns, [], ['  COUNCIL TAX  ']);
    expect(byName(caught, 'Council Tax')).toBeUndefined();
  });

  it('an undeclared, non-dismissed merchant still catches alongside a dismissed one', () => {
    const txns = [
      ...SINK_BILLS,
      ...monthly('Council Tax', 162, '2026-04-01', 3), // dismissed -> skipped
      ...monthly('BT Broadband', 38, '2026-04-03', 3), // not dismissed -> caught
    ];
    const caught = findCaughtBills(txns, [], ['council tax']);
    expect(byName(caught, 'Council Tax')).toBeUndefined();
    expect(byName(caught, 'BT Broadband')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Threshold + scope — mirrors caughtSubs.ts's own scope tests.
// ---------------------------------------------------------------------------
describe('findCaughtBills — only confirmed in-scope-cadence series surface', () => {
  it('2 monthly charges (below the ≥3 monthly minimum) → not caught', () => {
    const txns = [...SINK_BILLS, ...monthly('Rent', 540, '2026-04-01', 2)];
    expect(byName(findCaughtBills(txns, []), 'Rent')).toBeUndefined();
  });

  it('a single isolated charge → nothing', () => {
    const txns = [...SINK_BILLS, spend('OneOff', 42, '2026-05-01')];
    expect(byName(findCaughtBills(txns, []), 'OneOff')).toBeUndefined();
  });

  it('empty ledger → empty result', () => {
    expect(findCaughtBills([], ['Netflix'])).toEqual([]);
  });

  it("a confirmed QUARTERLY series stays out of this sheet's cadence scope", () => {
    const rows: Transaction[] = [];
    const start = new Date('2026-01-05T00:00:00Z');
    for (let i = 0; i < 4; i += 1) {
      const d = new Date(start.getTime() + i * 91 * 86_400_000);
      rows.push(spend('Insurance Co', 120, d.toISOString().slice(0, 10)));
    }
    const txns = [...SINK_BILLS, ...rows];
    expect(byName(findCaughtBills(txns, []), 'Insurance Co')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Purity + honesty.
// ---------------------------------------------------------------------------
describe('findCaughtBills — purity + honesty guarantee', () => {
  it('is pure — same input twice is deeply equal and never mutates the inputs', () => {
    const txns = [...SINK_BILLS, ...monthly('Octopus Energy', 118.4, '2026-04-01', 3)];
    const snapshot = JSON.parse(JSON.stringify(txns));
    const a = findCaughtBills(txns, ['Netflix'], ['gym']);
    const b = findCaughtBills(txns, ['Netflix'], ['gym']);
    expect(a).toEqual(b);
    expect(txns).toEqual(snapshot);
  });

  it('candidates carry ONLY payment-fact fields — no usage/value/cancel/decay', () => {
    const txns = [...SINK_BILLS, ...monthly('Octopus Energy', 118.4, '2026-04-01', 3)];
    const caught = findCaughtBills(txns, []);
    const sig = byName(caught, 'Octopus Energy');
    expect(sig).toBeDefined();

    const allowed = new Set([
      'name',
      'amount',
      'seen',
      'lastDate',
      'lastDateIso',
      'category',
      'cadence',
    ]);
    for (const k of Object.keys(sig as object)) {
      expect(allowed.has(k)).toBe(true);
    }

    const banned = [
      'usage',
      'usesPerMonth',
      'lastUsedDaysAgo',
      'value',
      'worthIt',
      'wasted',
      'waste',
      'cancel',
      'shouldCancel',
      'decay',
      'recommendation',
    ];
    const flat = JSON.stringify(sig);
    for (const b of banned) {
      expect(flat.includes(`"${b}":`)).toBe(false);
    }
    expect(sig?.category).toBe('other');
  });
});
