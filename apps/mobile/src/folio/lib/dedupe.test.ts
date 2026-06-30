// Import de-dupe tests — pure-logic coverage for
// apps/mobile/src/folio/lib/dedupe.ts.
//
// Pins the F1–F10 fixtures from OPEN_BANKING_DEDUPE_RESEARCH.md §6 and the
// negative guarantees in §6/§7: the engine ONLY ever proposes — it never
// auto-merges and never mutates its inputs; F4 never produces a second row; F10
// still links despite a user edit (via originalAmount); F3 and F8 produce zero
// proposals; and the output kinds are a subset of the allowed reversible
// MatchKind set (no destructive "merge"/"remove" verb).
//
// Node-safe: touches only the engine module (no react-native runtime, no DOM),
// so it is a plain `.test.ts` collected by the apps/**/*.test.ts runner with a
// relative import — exactly like subSignals.test.ts / importSheet.test.ts.

import { describe, expect, it } from 'vitest';

import { type MatchKind, type MatchProposal, type MatchableItem, proposeMatches } from './dedupe';

// ---------------------------------------------------------------------------
// Fixture helpers.
// ---------------------------------------------------------------------------

/** A manual item (user typed it; no provider id). Spend negative. */
function manual(
  id: string,
  amount: number,
  merchant: string,
  date: string,
  extra: Partial<MatchableItem> = {},
): MatchableItem {
  return { id, amount, merchant, date, origin: 'manual', ...extra };
}

/** An imported item (csv/ocr/pdf/open-banking). Spend negative. */
function imported(
  id: string,
  amount: number,
  merchant: string,
  date: string,
  extra: Partial<MatchableItem> = {},
): MatchableItem {
  return { id, amount, merchant, date, origin: 'import', ...extra };
}

function kindsOf(proposals: readonly MatchProposal[]): MatchKind[] {
  return proposals.map((p) => p.kind);
}

const ALLOWED_KINDS: ReadonlySet<MatchKind> = new Set<MatchKind>([
  'propose-link',
  'propose-amount-changed',
  'propose-transfer',
  'propose-refund',
  'link-by-provider',
  'expire-pending',
]);

// ---------------------------------------------------------------------------
// F1–F10 — the research fixtures, read as the contract.
// ---------------------------------------------------------------------------

describe('proposeMatches — research fixtures F1–F10', () => {
  it('F1: amount-exact, within 5d, payee match -> propose-link', () => {
    const existing = [manual('m1', -12.0, 'Tesco', '2026-06-20')];
    const incoming = [imported('i1', -12.0, 'TESCO STORES 2913', '2026-06-21')];

    const out = proposeMatches(existing, incoming);

    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe('propose-link');
    expect(out[0]?.existingId).toBe('m1');
    expect(out[0]?.incomingId).toBe('i1');
  });

  it('F2: posted > pending, payee high, amount differs -> propose-amount-changed', () => {
    const existing = [manual('m1', -40.0, 'Shell', '2026-06-18')];
    const incoming = [imported('i1', -46.5, 'SHELL FUEL', '2026-06-20')];

    const out = proposeMatches(existing, incoming);

    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe('propose-amount-changed');
    expect(out[0]?.existingId).toBe('m1');
  });

  it('F3: same amount + date but payee mismatch -> keep-both-silent (no proposal)', () => {
    const existing = [manual('m1', -9.99, 'Spotify', '2026-06-01')];
    const incoming = [imported('i1', -9.99, 'Netflix', '2026-06-01')];

    const out = proposeMatches(existing, incoming);

    expect(out).toHaveLength(0);
  });

  it('F4: provider id link -> single link-by-provider, never a second row', () => {
    const existing = [imported('p1', -25.0, 'BAR', '2026-06-19', { providerId: 'p1' })];
    const incoming = [imported('i1', -25.0, 'BAR', '2026-06-20', { pendingTransactionId: 'p1' })];

    const out = proposeMatches(existing, incoming);

    expect(out).toHaveLength(1); // exactly one — replace in place, not a second row
    expect(out[0]?.kind).toBe('link-by-provider');
    expect(out[0]?.confidence).toBe('high');
    expect(out[0]?.existingId).toBe('p1');
  });

  it('F5: one pending -> two postings (PENDING_IDS list), both link p2, never 1:1', () => {
    const existing = [imported('p2', -60.0, 'STORE', '2026-06-19', { providerId: 'p2' })];
    const incoming = [
      imported('i1', -35.0, 'STORE', '2026-06-20', { pendingIds: ['p2'] }),
      imported('i2', -25.0, 'STORE', '2026-06-20', { pendingIds: ['p2'] }),
    ];

    const out = proposeMatches(existing, incoming);

    const links = out.filter((p) => p.kind === 'link-by-provider');
    expect(links).toHaveLength(2); // a split map: both bookings link the pending
    expect(links.every((p) => p.existingId === 'p2')).toBe(true);
    expect(new Set(links.map((p) => p.incomingId))).toEqual(new Set(['i1', 'i2']));
    // p2 is referenced by both, never duplicated as a *row* (it is the existing item).
    expect(out.filter((p) => p.kind === 'link-by-provider' && p.existingId === 'p2')).toHaveLength(
      2,
    );
  });

  it('F6: equal-and-opposite across own accounts, same date -> propose-transfer', () => {
    const existing = [manual('m1', -500, 'rent', '2026-06-25')];
    const incoming = [imported('i1', 500, 'transfer', '2026-06-25')];

    const out = proposeMatches(existing, incoming);

    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe('propose-transfer');
    expect(out[0]?.existingId).toBe('m1');
  });

  it('F7: opposite sign, same merchant, incoming later -> propose-refund', () => {
    const existing = [manual('m1', -80, 'ASOS', '2026-06-10')];
    const incoming = [imported('i1', 80, 'ASOS REFUND', '2026-06-24')];

    const out = proposeMatches(existing, incoming);

    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe('propose-refund');
    expect(out[0]?.existingId).toBe('m1');
  });

  it('F8: same amount + payee but outside ±5d -> keep-both-silent (no proposal)', () => {
    const existing = [manual('m1', -12.0, 'Tesco', '2026-06-10')];
    const incoming = [imported('i1', -12.0, 'TESCO', '2026-06-20')];

    const out = proposeMatches(existing, incoming);

    expect(out).toHaveLength(0);
  });

  it('F9: pending older than the auth-hold window with no posting -> expire-pending', () => {
    const existing = [imported('p3', -18, 'BAR TAB', '2026-06-01', { providerId: 'p3' })];
    const incoming: MatchableItem[] = []; // no posting arrived

    const out = proposeMatches(existing, incoming, { now: '2026-06-20' });

    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe('expire-pending');
    expect(out[0]?.existingId).toBe('p3');
    expect(out[0]?.incomingId).toBe('p3'); // same id — no posting exists
    expect(out[0]?.reasonCode).toBe('auth-hold-expired');
  });

  it('F9b: a pending still inside the auth-hold window does NOT expire', () => {
    const existing = [imported('p3', -18, 'BAR TAB', '2026-06-15', { providerId: 'p3' })];
    const out = proposeMatches(existing, [], { now: '2026-06-20' }); // 5 days old < 14
    expect(out).toHaveLength(0);
  });

  it('F9c: without `now`, expire-pending is never emitted', () => {
    const existing = [imported('p3', -18, 'BAR TAB', '2026-06-01', { providerId: 'p3' })];
    const out = proposeMatches(existing, []);
    expect(out).toHaveLength(0);
  });

  it('F10: user edited the existing item, but originalAmount preserves the link', () => {
    // The user added −12, later edited it to −14 (so amount = −14), but the
    // pre-edit import amount −12 is carried on originalAmount. De-dupe matches
    // the incoming −12 against that payload, not the −14 surface.
    const existing = [manual('m1', -14.0, 'Tesco', '2026-06-20', { originalAmount: -12.0 })];
    const incoming = [imported('i1', -12.0, 'TESCO', '2026-06-21')];

    const out = proposeMatches(existing, incoming);

    expect(out).toHaveLength(1); // nothing double-counts
    expect(out[0]?.kind).toBe('propose-link');
    expect(out[0]?.existingId).toBe('m1');
    expect(out[0]?.incomingId).toBe('i1');
  });

  it('F10-control: WITHOUT originalAmount the −14 surface would miss the −12 link', () => {
    // Documents WHY originalAmount exists: matching the user-edited −14 against
    // an incoming −12 yields nothing (proving the engine compares the payload).
    const existing = [manual('m1', -14.0, 'Tesco', '2026-06-20')];
    const incoming = [imported('i1', -12.0, 'TESCO', '2026-06-21')];

    const out = proposeMatches(existing, incoming);

    expect(out).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Negative guarantees (research §6 / §7).
// ---------------------------------------------------------------------------

describe('proposeMatches — negative guarantees', () => {
  it('only ever proposes — every output kind is in the reversible MatchKind set', () => {
    // Run a mixed batch covering every branch and assert no destructive verb.
    const existing = [
      manual('m1', -12.0, 'Tesco', '2026-06-20'),
      manual('m2', -40.0, 'Shell', '2026-06-18'),
      manual('m3', -500, 'rent', '2026-06-25'),
      manual('m4', -80, 'ASOS', '2026-06-10'),
      imported('p3', -18, 'BAR TAB', '2026-06-01', { providerId: 'p3' }),
      imported('p1', -25.0, 'BAR', '2026-06-19', { providerId: 'p1' }),
    ];
    const incoming = [
      imported('i1', -12.0, 'TESCO STORES 2913', '2026-06-21'),
      imported('i2', -46.5, 'SHELL FUEL', '2026-06-20'),
      imported('i3', 500, 'transfer', '2026-06-25'),
      imported('i4', 80, 'ASOS REFUND', '2026-06-24'),
      imported('i5', -25.0, 'BAR', '2026-06-20', { pendingTransactionId: 'p1' }),
    ];

    const out = proposeMatches(existing, incoming, { now: '2026-06-20' });

    for (const p of out) {
      expect(ALLOWED_KINDS.has(p.kind)).toBe(true);
    }
    // Belt-and-braces: the kind strings carry no destructive verb.
    for (const k of kindsOf(out)) {
      expect(k).not.toMatch(/merge|remove|delete|destroy/i);
    }
  });

  it('mutates neither the existing nor the incoming inputs', () => {
    const existing = [manual('m1', -12.0, 'Tesco', '2026-06-20')];
    const incoming = [imported('i1', -12.0, 'TESCO STORES 2913', '2026-06-21')];
    const existingSnapshot = structuredClone(existing);
    const incomingSnapshot = structuredClone(incoming);

    proposeMatches(existing, incoming);

    expect(existing).toEqual(existingSnapshot);
    expect(incoming).toEqual(incomingSnapshot);
  });

  it('is deterministic — same input yields an identical result', () => {
    const existing = [
      manual('m1', -12.0, 'Tesco', '2026-06-20'),
      manual('m2', -40.0, 'Shell', '2026-06-18'),
    ];
    const incoming = [
      imported('i1', -12.0, 'TESCO STORES 2913', '2026-06-21'),
      imported('i2', -46.5, 'SHELL FUEL', '2026-06-20'),
    ];

    const a = proposeMatches(existing, incoming);
    const b = proposeMatches(existing, incoming);

    expect(a).toEqual(b);
  });

  it('one-match guard: an existing item links to at most one incoming item', () => {
    // Two near-identical incoming imports compete for the same manual item.
    const existing = [manual('m1', -12.0, 'Tesco', '2026-06-20')];
    const incoming = [
      imported('i1', -12.0, 'TESCO', '2026-06-21'),
      imported('i2', -12.0, 'TESCO', '2026-06-22'),
    ];

    const out = proposeMatches(existing, incoming);

    const forM1 = out.filter((p) => p.existingId === 'm1');
    expect(forM1).toHaveLength(1);
  });

  it('two genuine same-amount/day/merchant charges -> proposes at most one, never auto-merges both', () => {
    // Two coffees: the honest default the user picks is "keep both"; the engine
    // must not silently collapse them. It proposes a single link (one-match
    // guard) and leaves the rest as visible duplicates.
    const existing = [manual('m1', -3.5, 'Cafe Nero', '2026-06-20')];
    const incoming = [
      imported('i1', -3.5, 'CAFE NERO', '2026-06-20'),
      imported('i2', -3.5, 'CAFE NERO', '2026-06-20'),
    ];

    const out = proposeMatches(existing, incoming);

    expect(out.filter((p) => p.existingId === 'm1')).toHaveLength(1);
    expect(out.every((p) => ALLOWED_KINDS.has(p.kind))).toBe(true);
  });

  it('empty inputs yield no proposals', () => {
    expect(proposeMatches([], [])).toEqual([]);
    expect(proposeMatches([manual('m1', -10, 'X', '2026-06-20')], [])).toEqual([]);
    expect(proposeMatches([], [imported('i1', -10, 'X', '2026-06-20')])).toEqual([]);
  });
});
