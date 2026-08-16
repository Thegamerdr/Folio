// Caught-annual tests — pure-logic coverage for lib/caughtAnnual.ts, plus the store-level
// "confirm adds a dated calendar event" contract AnnualCaughtSheet's confirm() relies on.

import { beforeEach, describe, expect, it } from 'vitest';

import { addCalendarEvent, getState, resetAll, type Transaction } from '../store';
import { expectedMonthLabel, findCaughtAnnual, nextAnnualOccurrenceIso } from './caughtAnnual';

function txn(merchant: string, amountPounds: number, iso: string): Transaction {
  return {
    id: `t-${merchant}-${iso}`,
    merchant,
    amount: -Math.abs(amountPounds),
    when: `${iso}T00:00:00.000Z`,
    category: 'bills',
    source: 'manual',
  };
}

beforeEach(() => {
  resetAll();
});

describe('findCaughtAnnual', () => {
  it('surfaces a merchant with two same-magnitude charges ~365 days apart', () => {
    const transactions = [
      txn('TV Licensing', 159, '2025-04-10'),
      txn('TV Licensing', 159, '2026-04-12'),
    ];
    const candidates = findCaughtAnnual(transactions, []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ merchant: 'TV Licensing', amount: 159, occurrences: 2 });
  });

  it('excludes a dismissed merchant', () => {
    const transactions = [
      txn('TV Licensing', 159, '2025-04-10'),
      txn('TV Licensing', 159, '2026-04-12'),
    ];
    expect(findCaughtAnnual(transactions, ['tv licensing'])).toEqual([]);
  });

  it('no qualifying annual cluster -> empty', () => {
    const transactions = [txn('Coffee Shop', 4, '2026-06-01')];
    expect(findCaughtAnnual(transactions, [])).toEqual([]);
  });

  // ANNUAL-SUBS GUARD (task: mirrors caughtBills.ts's DOUBLE-PROPOSE GUARD) — a merchant already
  // tracked as a Sub is never proposed a second time as a fresh annual find.
  it('excludes a merchant already in the subs catalog (TV Licensing never proposed annually)', () => {
    const transactions = [
      txn('TV Licensing', 159, '2025-04-10'),
      txn('TV Licensing', 159, '2026-04-12'),
    ];
    expect(findCaughtAnnual(transactions, [], ['TV Licensing'])).toEqual([]);
  });

  it('the subs-catalog exclusion is case/whitespace-insensitive, mirroring the dismissed-list guard', () => {
    const transactions = [
      txn('TV Licensing', 159, '2025-04-10'),
      txn('TV Licensing', 159, '2026-04-12'),
    ];
    expect(findCaughtAnnual(transactions, [], ['  tv licensing  '])).toEqual([]);
  });

  it('a DIFFERENT sub in the catalog does not suppress an unrelated annual candidate', () => {
    const transactions = [
      txn('TV Licensing', 159, '2025-04-10'),
      txn('TV Licensing', 159, '2026-04-12'),
    ];
    const candidates = findCaughtAnnual(transactions, [], ['Netflix']);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ merchant: 'TV Licensing' });
  });
});

describe('expectedMonthLabel / nextAnnualOccurrenceIso', () => {
  it('labels the calendar month of the last-seen charge', () => {
    expect(expectedMonthLabel('2026-04-12')).toBe('April');
    expect(expectedMonthLabel('2025-10-01')).toBe('October');
  });

  it('projects the next occurrence one year on, same day-of-month', () => {
    expect(nextAnnualOccurrenceIso('2026-04-12')).toBe('2027-04-12');
  });

  it('clamps into a shorter target month (29 Feb leap-year edge)', () => {
    // 2024 was a leap year (29 Feb exists); 2025 is not, so it clamps to the 28th.
    expect(nextAnnualOccurrenceIso('2024-02-29')).toBe('2025-02-28');
  });
});

describe('AnnualCaughtSheet confirm contract — adds ONE dated calendar event, never a Sub', () => {
  it('confirming an annual candidate appends a kind:"out" CalendarEvent dated the next occurrence', () => {
    const transactions = [
      txn('TV Licensing', 159, '2025-04-10'),
      txn('TV Licensing', 159, '2026-04-12'),
    ];
    const [candidate] = findCaughtAnnual(transactions, []);
    expect(candidate).toBeDefined();

    // The sheet's exact confirm() write (see AnnualCaughtSheet.tsx confirm()).
    const nextIso = nextAnnualOccurrenceIso(candidate!.lastSeen);
    addCalendarEvent({
      date: nextIso,
      kind: 'out',
      title: candidate!.merchant,
      amount: -Math.abs(candidate!.amount),
    });

    const events = getState().calendarEvents;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      date: '2027-04-12',
      kind: 'out',
      title: 'TV Licensing',
      amount: -159,
    });
  });

  it('confirming never touches the subs catalog — a distinct entity from a caught bill', () => {
    const subsBefore = getState().subs;
    const transactions = [
      txn('TV Licensing', 159, '2025-04-10'),
      txn('TV Licensing', 159, '2026-04-12'),
    ];
    const [candidate] = findCaughtAnnual(transactions, []);
    addCalendarEvent({
      date: nextAnnualOccurrenceIso(candidate!.lastSeen),
      kind: 'out',
      title: candidate!.merchant,
      amount: -Math.abs(candidate!.amount),
    });
    // The subs catalog is byte-identical to before confirm — no Sub was added, renamed, or removed.
    expect(getState().subs).toEqual(subsBefore);
    expect(getState().subs.some((s) => s.name === 'TV Licensing')).toBe(false);
  });
});
