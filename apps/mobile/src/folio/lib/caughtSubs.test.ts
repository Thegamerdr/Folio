// caughtSubs — pure-logic coverage for findCaughtSubs (lib/caughtSubs.ts).
//
// The bridge that turns the recurring-charge DETECTION engine into SubCaught
// candidates, filtered to merchants the catalog doesn't already hold. These
// tests pin the two load-bearing behaviours from the task brief:
//   • 3+ monthly charges of a non-catalog merchant  → caught
//   • a merchant already in the catalog              → NOT caught
// plus the honesty guarantee (payment facts only — no usage/value/cancel/decay)
// and the field mapping (name/amount/seen/lastDate).
//
// Node-safe: touches only the pure `findCaughtSubs` (no react-native, no DOM,
// no store mutation), so it is a plain `.test.ts` collected by the
// apps/**/*.test.ts runner — exactly like subSignals.test.ts.

import { describe, expect, it } from 'vitest';

import { findCaughtSubs, type CaughtSubCandidate } from './caughtSubs';
import type { Transaction } from '../store';

// ---------------------------------------------------------------------------
// Fixture helpers.
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

function byName(list: CaughtSubCandidate[], name: string): CaughtSubCandidate | undefined {
  return list.find((c) => c.name === name);
}

// ---------------------------------------------------------------------------
// Core vectors from the brief.
// ---------------------------------------------------------------------------
describe('findCaughtSubs — catches real, non-catalog recurring charges', () => {
  it('3 monthly charges of a non-catalog merchant → caught (payment facts mapped)', () => {
    const txns = monthly('Sound+ Studio', 6.99, '2026-04-01', 3);
    const caught = findCaughtSubs(txns, ['Spotify', 'Netflix']);

    const sig = byName(caught, 'Sound+ Studio');
    expect(sig).toBeDefined();
    expect(sig?.seen).toBe(3); // occurrences — a charge-count fact
    expect(sig?.amount).toBeCloseTo(6.99, 2); // the recurring £ amount, a fact
    expect(typeof sig?.lastDate).toBe('string');
    expect(sig?.lastDate.length).toBeGreaterThan(0); // human last-charged label
  });

  it('does NOT catch a merchant already in the subscription catalog', () => {
    // A clean monthly Spotify series that WOULD be detected — but Spotify is
    // already in the catalog, so it must be filtered out (no duplicate add).
    const txns = monthly('Spotify', 11.0, '2026-04-01', 3);
    const caught = findCaughtSubs(txns, ['Spotify', 'Netflix']);
    expect(byName(caught, 'Spotify')).toBeUndefined();
  });

  it('catalog match is case/whitespace-insensitive', () => {
    const txns = monthly('Spotify', 11.0, '2026-04-01', 3);
    // Catalog stores it differently-cased / padded — still a match, still skipped.
    expect(findCaughtSubs(txns, ['  spotify  '])).toHaveLength(0);
  });

  it('catches a non-catalog merchant while skipping a catalog one in the same ledger', () => {
    const txns = [
      ...monthly('Spotify', 11.0, '2026-04-01', 3), // in catalog → skipped
      ...monthly('Calm', 9.99, '2026-04-05', 3), // not in catalog → caught
    ];
    const caught = findCaughtSubs(txns, ['Spotify']);
    expect(byName(caught, 'Spotify')).toBeUndefined();
    expect(byName(caught, 'Calm')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Threshold + scope — only CONFIRMED monthly series surface to this sheet.
// ---------------------------------------------------------------------------
describe('findCaughtSubs — only confirmed monthly series surface', () => {
  it('2 monthly charges (below the ≥3 monthly minimum) → not caught', () => {
    const txns = monthly('Sound+ Studio', 6.99, '2026-04-01', 2);
    expect(findCaughtSubs(txns, [])).toHaveLength(0);
  });

  it('a single isolated charge → nothing', () => {
    expect(findCaughtSubs([spend('OneOff', 42, '2026-05-01')], [])).toHaveLength(0);
  });

  it('empty ledger → empty result', () => {
    expect(findCaughtSubs([], ['Spotify'])).toEqual([]);
  });

  it('a non-monthly confirmed series (weekly) is out of this sheet\'s monthly framing', () => {
    // 8 weekly charges → a confirmed WEEKLY series, not surfaced here.
    const rows: Transaction[] = [];
    const start = new Date('2026-01-05T00:00:00Z');
    for (let i = 0; i < 8; i += 1) {
      const d = new Date(start.getTime() + i * 7 * 86_400_000);
      rows.push(spend('Coffee Club', 3.5, d.toISOString().slice(0, 10)));
    }
    expect(byName(findCaughtSubs(rows, []), 'Coffee Club')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Purity + honesty.
// ---------------------------------------------------------------------------
describe('findCaughtSubs — purity + honesty guarantee', () => {
  it('is pure — same input twice is deeply equal and never mutates the input', () => {
    const txns = monthly('Sound+ Studio', 6.99, '2026-04-01', 3);
    const snapshot = JSON.parse(JSON.stringify(txns));
    const a = findCaughtSubs(txns, ['Spotify']);
    const b = findCaughtSubs(txns, ['Spotify']);
    expect(a).toEqual(b);
    expect(txns).toEqual(snapshot);
  });

  it('candidates carry ONLY payment-fact fields — no usage/value/cancel/decay', () => {
    const caught = findCaughtSubs(monthly('Sound+ Studio', 6.99, '2026-04-01', 3), []);
    const sig = byName(caught, 'Sound+ Studio');
    expect(sig).toBeDefined();

    const allowed = new Set(['name', 'amount', 'seen', 'lastDate', 'category']);
    for (const k of Object.keys(sig as object)) {
      expect(allowed.has(k)).toBe(true);
    }

    const banned = [
      'usage', 'usesPerMonth', 'lastUsedDaysAgo', 'value', 'worthIt',
      'wasted', 'waste', 'cancel', 'shouldCancel', 'decay', 'recommendation',
    ];
    const flat = JSON.stringify(sig);
    for (const b of banned) {
      expect(flat.includes(`"${b}":`)).toBe(false);
    }
    // The category is a neutral placeholder, never a usage/value verdict.
    expect(sig?.category).toBe('other');
  });
});
