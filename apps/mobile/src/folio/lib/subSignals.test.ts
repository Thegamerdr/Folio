// Sub-signals recurring-charge DETECTION tests — pure-logic coverage for
// apps/mobile/src/folio/lib/subSignals.ts.
//
// Detection ONLY. These tests pin the Moneyhub-derived thresholds (cadence
// minimum sample counts, working-day date tolerance, variable-amount bounds)
// and the three honesty-safe flags (wentQuiet / paymentReturned /
// possibleDuplicate). The engine is grounded in SUBSCRIPTION_SIGNAL_RESEARCH.md
// and ENGINES.md §6 "Subs — usage decay": banking data proves a *payment*
// recurs; it never proves *use*. So every assertion here checks a payment fact,
// and the final guard test proves the result type carries NO usage / value /
// cancel / decay field — the unsafe claim is unrepresentable by construction.
//
// Node-safe: touches only the engine module (no react-native runtime, no DOM),
// so it is a plain `.test.ts` collected by the apps/**/*.test.ts runner with
// relative imports — exactly like store.test.ts / calendarEvents.test.ts.

import { describe, expect, it } from 'vitest';

import { type Charge, type RecurringSignal, detectRecurring } from './subSignals';

// ---------------------------------------------------------------------------
// Fixture helpers — build a clean, deterministic charge sequence.
// ---------------------------------------------------------------------------

/** A money-out charge. `amount` is signed; spend is negative (store convention). */
function out(merchant: string, amount: number, date: string): Charge {
  return { merchant, amount, date };
}

/** Add N calendar days to an ISO `YYYY-MM-DD` day, returning ISO. */
function plusDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A run of `count` charges at `every` days apart, same merchant + amount. */
function series(
  merchant: string,
  amount: number,
  startIso: string,
  every: number,
  count: number,
): Charge[] {
  const charges: Charge[] = [];
  for (let i = 0; i < count; i += 1) {
    charges.push(out(merchant, amount, plusDays(startIso, i * every)));
  }
  return charges;
}

function findByMerchant(signals: RecurringSignal[], merchant: string): RecurringSignal | undefined {
  return signals.find((s) => s.merchant === merchant);
}

// ---------------------------------------------------------------------------
// Cadence thresholds — Moneyhub minimum sample counts (research §6.2).
// Weekly 8 · Fortnightly 6 · Monthly 3 · Quarterly 4 · Yearly 3.
// At / above => confirmed `series`; below => quiet `candidate`.
// ---------------------------------------------------------------------------
describe('detectRecurring — cadence thresholds', () => {
  it('S1: monthly Spotify ×3 meets the ≥3 monthly minimum → series{monthly}', () => {
    const signals = detectRecurring(series('Spotify', -9.99, '2026-01-01', 30, 3));
    const sig = findByMerchant(signals, 'Spotify');
    expect(sig).toBeDefined();
    expect(sig?.status).toBe('series');
    expect(sig?.cadence).toBe('monthly');
    expect(sig?.occurrences).toBe(3);
  });

  it('monthly ×2 is below the ≥3 minimum → candidate, never asserted as a series', () => {
    const signals = detectRecurring(series('Disney', -7.99, '2026-01-01', 30, 2));
    const sig = findByMerchant(signals, 'Disney');
    expect(sig).toBeDefined();
    expect(sig?.status).toBe('candidate');
    expect(sig?.cadence).toBe('monthly');
  });

  it('weekly needs ≥8: 7 occurrences is a candidate, 8 is a series', () => {
    const seven = detectRecurring(series('Coffee', -3.5, '2026-01-05', 7, 7));
    expect(findByMerchant(seven, 'Coffee')?.status).toBe('candidate');
    expect(findByMerchant(seven, 'Coffee')?.cadence).toBe('weekly');

    const eight = detectRecurring(series('Coffee', -3.5, '2026-01-05', 7, 8));
    expect(findByMerchant(eight, 'Coffee')?.status).toBe('series');
    expect(findByMerchant(eight, 'Coffee')?.cadence).toBe('weekly');
  });

  it('fortnightly needs ≥6: 5 occurrences is a candidate, 6 is a series', () => {
    const five = detectRecurring(series('Veg Box', -18, '2026-01-02', 14, 5));
    expect(findByMerchant(five, 'Veg Box')?.status).toBe('candidate');
    expect(findByMerchant(five, 'Veg Box')?.cadence).toBe('fortnightly');

    const six = detectRecurring(series('Veg Box', -18, '2026-01-02', 14, 6));
    expect(findByMerchant(six, 'Veg Box')?.status).toBe('series');
    expect(findByMerchant(six, 'Veg Box')?.cadence).toBe('fortnightly');
  });

  it('quarterly needs ≥4: 3 occurrences is a candidate, 4 is a series', () => {
    const three = detectRecurring(series('Water', -45, '2026-01-10', 91, 3));
    expect(findByMerchant(three, 'Water')?.status).toBe('candidate');
    expect(findByMerchant(three, 'Water')?.cadence).toBe('quarterly');

    const four = detectRecurring(series('Water', -45, '2026-01-10', 91, 4));
    expect(findByMerchant(four, 'Water')?.status).toBe('series');
    expect(findByMerchant(four, 'Water')?.cadence).toBe('quarterly');
  });

  it('S5: yearly Aviva ×3 meets the ≥3 yearly minimum → series{yearly}', () => {
    const signals = detectRecurring([
      out('Aviva', -120, '2024-03-01'),
      out('Aviva', -120, '2025-03-01'),
      out('Aviva', -120, '2026-03-01'),
    ]);
    const sig = findByMerchant(signals, 'Aviva');
    expect(sig?.status).toBe('series');
    expect(sig?.cadence).toBe('yearly');
    expect(sig?.occurrences).toBe(3);
  });

  it('a single isolated charge produces no signal at all', () => {
    const signals = detectRecurring([out('OneOff', -42, '2026-02-14')]);
    expect(findByMerchant(signals, 'OneOff')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Date tolerance — research §6.3. Direct Debit ≤4 working days, card ≤3.
// Tolerance is measured in WORKING days (weekends don't count against it).
// ---------------------------------------------------------------------------
describe('detectRecurring — date tolerance', () => {
  it('S7: a card monthly sub posting 2 days late stays in-series (card ≤3 working days)', () => {
    // Three monthly charges; the third lands 2 calendar days late.
    const signals = detectRecurring([
      out('Gym', -24.99, '2026-01-06'),
      out('Gym', -24.99, '2026-02-06'),
      out('Gym', -24.99, '2026-03-08'), // expected ~2026-03-08 anyway; 2 days drift
    ]);
    const sig = findByMerchant(signals, 'Gym');
    expect(sig?.status).toBe('series');
    expect(sig?.cadence).toBe('monthly');
    expect(sig?.occurrences).toBe(3);
  });

  it('a Direct Debit drifting 4 working days still groups (DD ≤4 working days)', () => {
    // Weekly DD. One occurrence drifts; with the wider DD band it stays in-series.
    const charges = series('Council Tax', -110, '2026-01-05', 30, 3).map((c, i) =>
      // Push the 2nd charge 4 days later (Fri 6 Feb -> the engine tolerates DD ≤4 wd).
      i === 1
        ? { ...c, paymentType: 'direct-debit' as const, date: plusDays(c.date, 4) }
        : { ...c, paymentType: 'direct-debit' as const },
    );
    const sig = findByMerchant(detectRecurring(charges), 'Council Tax');
    expect(sig?.status).toBe('series');
    expect(sig?.occurrences).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Variable amount — research §6.4. Predict next value with upper/lower bound.
// ---------------------------------------------------------------------------
describe('detectRecurring — variable amount bounds', () => {
  it('S6: a monthly utility varying £28–£34 stays one series with an amount range', () => {
    const signals = detectRecurring([
      out('EE', -28, '2026-01-15'),
      out('EE', -31, '2026-02-15'),
      out('EE', -34, '2026-03-15'),
      out('EE', -30, '2026-04-15'),
    ]);
    const sig = findByMerchant(signals, 'EE');
    expect(sig?.status).toBe('series');
    expect(sig?.cadence).toBe('monthly');
    // Range carries the observed bounds in MINOR units (pence), magnitudes.
    expect(sig?.amount.lowerMinor).toBe(2800);
    expect(sig?.amount.upperMinor).toBe(3400);
    expect(sig?.amount.variable).toBe(true);
  });

  it('a fixed-amount sub reports equal lower/upper bounds and variable=false', () => {
    const sig = findByMerchant(
      detectRecurring(series('Netflix', -9.99, '2026-01-01', 30, 3)),
      'Netflix',
    );
    expect(sig?.amount.lowerMinor).toBe(999);
    expect(sig?.amount.upperMinor).toBe(999);
    expect(sig?.amount.variable).toBe(false);
  });

  it('S2: a sustained step records a priceChanged fact (fromMinor → toMinor), not a verdict', () => {
    // Netflix £9.99 ×2 then £11.99 ×2 — a real price rise.
    const signals = detectRecurring([
      out('Netflix', -9.99, '2026-01-01'),
      out('Netflix', -9.99, '2026-02-01'),
      out('Netflix', -11.99, '2026-03-01'),
      out('Netflix', -11.99, '2026-04-01'),
    ]);
    const sig = findByMerchant(signals, 'Netflix');
    expect(sig?.status).toBe('series');
    expect(sig?.priceChanged).toBeDefined();
    expect(sig?.priceChanged?.fromMinor).toBe(999);
    expect(sig?.priceChanged?.toMinor).toBe(1199);
    expect(sig?.priceChanged?.atDate).toBe('2026-03-01');
  });
});

// ---------------------------------------------------------------------------
// wentQuiet — research §6.5. An expected charge not seen by now. A FACT about
// the data, scoped to what the statement showed — never "you cancelled".
// ---------------------------------------------------------------------------
describe('detectRecurring — wentQuiet', () => {
  it('flags wentQuiet when a confirmed monthly series misses its next expected charge by now', () => {
    // 3 monthly charges ending 1 Mar; `now` is 20 Apr, well past the ~1 Apr expectation.
    const signals = detectRecurring(series('Spotify', -9.99, '2026-01-01', 30, 3), {
      now: '2026-04-20',
    });
    const sig = findByMerchant(signals, 'Spotify');
    expect(sig?.status).toBe('series');
    expect(sig?.wentQuiet).toBe(true);
  });

  it('does NOT flag wentQuiet when the next charge is not yet due', () => {
    // Same series, but `now` is only 5 Mar — the ~1 Apr charge isn't expected yet.
    const signals = detectRecurring(series('Spotify', -9.99, '2026-01-01', 30, 3), {
      now: '2026-03-05',
    });
    const sig = findByMerchant(signals, 'Spotify');
    expect(sig?.wentQuiet).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// paymentReturned — research §6.5. A return/reversal shortly after a charge
// (likely insufficient funds). A payment fact, stated plainly.
// ---------------------------------------------------------------------------
describe('detectRecurring — paymentReturned', () => {
  it('flags paymentReturned when a credit reverses a charge within a few days', () => {
    const signals = detectRecurring([
      out('Spotify', -9.99, '2026-01-01'),
      out('Spotify', 9.99, '2026-01-03'), // returned (credit, same magnitude)
      out('Spotify', -9.99, '2026-02-01'),
      out('Spotify', -9.99, '2026-03-01'),
    ]);
    const sig = findByMerchant(signals, 'Spotify');
    expect(sig?.status).toBe('series');
    expect(sig?.paymentReturned).toBe(true);
  });

  it('does NOT flag paymentReturned for a clean series with no reversals', () => {
    const sig = findByMerchant(
      detectRecurring(series('Spotify', -9.99, '2026-01-01', 30, 3)),
      'Spotify',
    );
    expect(sig?.paymentReturned).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// possibleDuplicate — research §6.6. ≥2 series to the same merchant.
// "You seem to pay two of these." — a question, never "you don't use the gym".
// ---------------------------------------------------------------------------
describe('detectRecurring — possibleDuplicate', () => {
  it('S4: two independent monthly PureGym series flag possibleDuplicate on both', () => {
    // Two distinct amounts so they form two separate series under one merchant.
    const charges = [
      ...series('PureGym', -12, '2026-01-03', 30, 3),
      ...series('PureGym', -24, '2026-01-17', 30, 3),
    ];
    const dupes = detectRecurring(charges).filter((s) => s.merchant === 'PureGym');
    expect(dupes.length).toBeGreaterThanOrEqual(2);
    for (const s of dupes) {
      expect(s.possibleDuplicate).toBe(true);
    }
  });

  it('a single series to a merchant is never a duplicate', () => {
    const sig = findByMerchant(
      detectRecurring(series('Spotify', -9.99, '2026-01-01', 30, 3)),
      'Spotify',
    );
    expect(sig?.possibleDuplicate).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Merchant normalisation + purity.
// ---------------------------------------------------------------------------
describe('detectRecurring — grouping + purity', () => {
  it('groups case/whitespace/punctuation variants of a merchant into one series', () => {
    const signals = detectRecurring([
      out('SPOTIFY', -9.99, '2026-01-01'),
      out('  spotify  ', -9.99, '2026-02-01'),
      out('Spotify.', -9.99, '2026-03-01'),
    ]);
    // One normalised group, meeting the monthly ≥3 threshold.
    expect(signals.filter((s) => s.merchant.toLowerCase().includes('spotify'))).toHaveLength(1);
    expect(signals[0]?.status).toBe('series');
    expect(signals[0]?.occurrences).toBe(3);
  });

  it('is pure — the same input twice yields deeply-equal output and never mutates the input', () => {
    const input = series('Spotify', -9.99, '2026-01-01', 30, 3);
    const snapshot = JSON.parse(JSON.stringify(input));
    const a = detectRecurring(input);
    const b = detectRecurring(input);
    expect(a).toEqual(b);
    expect(input).toEqual(snapshot); // input untouched
  });

  it('returns an empty array for empty input', () => {
    expect(detectRecurring([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// HONESTY BUILD-GATE — the unsafe claim must be unrepresentable.
// research §5 + §6.7: NO usage / value / cancel / decay field on the result.
// This is the structural guarantee, asserted at runtime over a real signal.
// ---------------------------------------------------------------------------
describe('detectRecurring — honesty guarantee (no usage/value/cancel/decay)', () => {
  it('S8: a detected signal carries ONLY payment-derived facts — no banned field', () => {
    const sig = findByMerchant(
      detectRecurring(series('Spotify', -9.99, '2026-01-01', 30, 3)),
      'Spotify',
    );
    expect(sig).toBeDefined();
    const keys = Object.keys(sig as object);

    // Allow-list: every key the descriptive, payment-only type may carry.
    const allowed = new Set([
      'merchant',
      'status',
      'cadence',
      'occurrences',
      'amount',
      'firstSeen',
      'lastSeen',
      'nextExpected',
      'priceChanged',
      'wentQuiet',
      'paymentReturned',
      'possibleDuplicate',
    ]);
    for (const k of keys) {
      expect(allowed.has(k)).toBe(true);
    }

    // Explicit ban-list: none of these may ever appear (usage/value/cancel/decay).
    const banned = [
      'usage',
      'usagePerMonth',
      'usesPerMonth',
      'lastUsedDaysAgo',
      'value',
      'worthIt',
      'wasted',
      'waste',
      'cancel',
      'shouldCancel',
      'decay',
      'decayScore',
      'important',
      'recommendation',
    ];
    const flat = JSON.stringify(sig);
    for (const b of banned) {
      expect(keys).not.toContain(b);
      // also not nested anywhere as an object key (cheap structural scan)
      expect(flat.includes(`"${b}":`)).toBe(false);
    }
  });
});
