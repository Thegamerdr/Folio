import { describe, expect, it } from 'vitest';

import { detectRecurringChargeCandidate } from './recurringChargeDetection.js';
import type { LocalLedgerTransaction } from './localLedger';

// detectRecurringChargeCandidate is the pure heuristic behind the SubCaught sheet. It must catch a
// merchant that charges a similar amount about once a month, ignore one-offs, and never re-flag a
// merchant the user already tracks as a subscription. It is a SUGGESTION ("looks like"), never a
// claim of certainty.

function spend(
  title: string,
  amountMinor: number,
  date: string,
  overrides: Partial<LocalLedgerTransaction> = {},
): LocalLedgerTransaction {
  return {
    id: `${title}-${date}`,
    title,
    amountMinor,
    date,
    source: 'manual',
    status: 'confirmed',
    protected: false,
    ...overrides,
  };
}

describe('detectRecurringChargeCandidate', () => {
  it('returns null for an empty ledger', () => {
    expect(detectRecurringChargeCandidate([], [])).toBeNull();
  });

  it('catches a clearly-recurring merchant (3 monthly charges, similar amounts)', () => {
    const transactions = [
      spend('Sound+ Studio', -699, '2026-04-12'),
      spend('Sound+ Studio', -699, '2026-05-12'),
      spend('Sound+ Studio', -699, '2026-06-12'),
    ];

    const candidate = detectRecurringChargeCandidate(transactions, []);
    expect(candidate).not.toBeNull();
    expect(candidate?.name).toBe('Sound+ Studio');
    expect(candidate?.amountMinor).toBe(699);
    expect(candidate?.seen).toBe(3);
    expect(candidate?.lastDateLabel).toBe('12 Jun');
  });

  it('tolerates small amount drift within ~10%', () => {
    const transactions = [
      spend('Gym', -3000, '2026-04-03'),
      spend('Gym', -3100, '2026-05-03'),
      spend('Gym', -2950, '2026-06-03'),
    ];
    expect(detectRecurringChargeCandidate(transactions, [])).not.toBeNull();
  });

  it('does not flag a one-off purchase', () => {
    const transactions = [spend('Argos', -8499, '2026-06-10')];
    expect(detectRecurringChargeCandidate(transactions, [])).toBeNull();
  });

  it('does not flag merchant seen only twice', () => {
    const transactions = [
      spend('Maybe Sub', -500, '2026-05-10'),
      spend('Maybe Sub', -500, '2026-06-10'),
    ];
    expect(detectRecurringChargeCandidate(transactions, [])).toBeNull();
  });

  it('does not flag weekly groceries (gaps too short for monthly)', () => {
    const transactions = [
      spend('Tesco', -3000, '2026-06-01'),
      spend('Tesco', -3000, '2026-06-08'),
      spend('Tesco', -3000, '2026-06-15'),
      spend('Tesco', -3000, '2026-06-22'),
    ];
    expect(detectRecurringChargeCandidate(transactions, [])).toBeNull();
  });

  it('excludes a merchant already tracked as a subscription (by name)', () => {
    const transactions = [
      spend('Sound+ Studio', -699, '2026-04-12'),
      spend('Sound+ Studio', -699, '2026-05-12'),
      spend('Sound+ Studio', -699, '2026-06-12'),
    ];
    const candidate = detectRecurringChargeCandidate(transactions, [{ name: 'sound+ studio' }]);
    expect(candidate).toBeNull();
  });

  it('ignores incomes and needs-review rows', () => {
    const transactions = [
      spend('Salary', 184_000, '2026-04-26'),
      spend('Salary', 184_000, '2026-05-26'),
      spend('Salary', 184_000, '2026-06-26'),
      spend('Pending', -699, '2026-04-12', { status: 'needs_review' }),
      spend('Pending', -699, '2026-05-12', { status: 'needs_review' }),
      spend('Pending', -699, '2026-06-12', { status: 'needs_review' }),
    ];
    expect(detectRecurringChargeCandidate(transactions, [])).toBeNull();
  });

  it('picks the most-recent candidate when several qualify', () => {
    const transactions = [
      spend('Old Sub', -500, '2026-01-05'),
      spend('Old Sub', -500, '2026-02-05'),
      spend('Old Sub', -500, '2026-03-05'),
      spend('New Sub', -800, '2026-04-12'),
      spend('New Sub', -800, '2026-05-12'),
      spend('New Sub', -800, '2026-06-12'),
    ];
    expect(detectRecurringChargeCandidate(transactions, [])?.name).toBe('New Sub');
  });
});
