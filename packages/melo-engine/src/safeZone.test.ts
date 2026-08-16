import { describe, expect, it } from 'vitest';

import { addDays, daysBetween, floorToPounds, formatPounds } from './core.js';
import {
  billsInCycle,
  checkAfford,
  computeSafeZone,
  type Bill,
  type SafeZoneInputs,
} from './safeZone.js';

const bill = (over: Pick<Bill, 'id' | 'amountPence' | 'dueDate'> & Partial<Bill>): Bill => ({
  name: over.id,
  kind: 'bill',
  ...over,
});

const base: SafeZoneInputs = {
  balancePence: 124_000,
  today: '2026-06-30',
  payday: '2026-07-12',
  bills: [bill({ id: 'rent', amountPence: 82_800, dueDate: '2026-07-05' })],
  essentialsPerDayPence: 1_400,
  savingsCommittedPence: 4_000,
  bufferPence: 2_000,
};

describe('date primitives', () => {
  it('counts days between ISO dates across month boundaries', () => {
    expect(daysBetween('2026-06-30', '2026-07-12')).toBe(12);
  });

  it('adds days across year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('throws on malformed dates instead of guessing', () => {
    expect(() => daysBetween('30/06/2026', '2026-07-12')).toThrow(/invalid ISO date/);
  });
});

describe('display rounding — always in the user’s favour', () => {
  it('rounds safe amounts down to whole pounds', () => {
    expect(floorToPounds(18_499)).toBe(184);
    expect(formatPounds(18_499)).toBe('£184');
  });

  it('rounds shortfalls up (worse), never down', () => {
    expect(floorToPounds(-2_301)).toBe(-24);
    expect(formatPounds(-2_301)).toBe('−£24');
  });
});

describe('computeSafeZone', () => {
  it('computes the blueprint example: £1,240 balance → £184 safe until payday', () => {
    const r = computeSafeZone(base);

    expect(r.daysToPayday).toBe(12);
    expect(r.shieldedBillsPence).toBe(82_800);
    expect(r.essentialsPence).toBe(16_800); // £14/day × 12 days
    expect(r.safeZonePence).toBe(18_400); // £184
  });

  it('derives per-day by flooring the spare across remaining days', () => {
    const r = computeSafeZone(base);
    expect(r.perDayPence).toBe(1_533); // floor(18400 / 12)
  });

  it('breakdown rows sum exactly to the safe zone — the show-the-math invariant', () => {
    const r = computeSafeZone(base);
    const sum = r.breakdown.reduce((acc, row) => acc + row.amountPence, 0);
    expect(sum).toBe(r.safeZonePence);
  });

  it('breakdown invariant holds when the safe zone is negative', () => {
    const r = computeSafeZone({ ...base, balancePence: 10_000 });
    expect(r.safeZonePence).toBeLessThan(0);
    const sum = r.breakdown.reduce((acc, row) => acc + row.amountPence, 0);
    expect(sum).toBe(r.safeZonePence);
  });

  it('a bill due ON payday belongs to the next cycle and is not shielded', () => {
    const r = computeSafeZone({
      ...base,
      bills: [...base.bills, bill({ id: 'on-payday', amountPence: 5_000, dueDate: '2026-07-12' })],
    });
    expect(r.shieldedBillsPence).toBe(82_800);
  });

  it('paid bills are no longer shielded', () => {
    const r = computeSafeZone({
      ...base,
      bills: [bill({ id: 'rent', amountPence: 82_800, dueDate: '2026-07-05', paid: true })],
    });
    expect(r.shieldedBillsPence).toBe(0);
    expect(r.safeZonePence).toBe(101_200);
  });

  it('bills already past due date are not double-reserved', () => {
    const r = computeSafeZone({
      ...base,
      bills: [bill({ id: 'gone', amountPence: 9_900, dueDate: '2026-06-29' })],
    });
    expect(r.shieldedBillsPence).toBe(0);
  });

  it('BNPL installments and debt payments are bills (§13 risk 11)', () => {
    const r = computeSafeZone({
      ...base,
      bills: [
        ...base.bills,
        bill({ id: 'klarna-1', amountPence: 26_700, dueDate: '2026-07-08', kind: 'bnpl' }),
        bill({ id: 'loan', amountPence: 6_000, dueDate: '2026-07-10', kind: 'debt' }),
      ],
    });
    expect(r.shieldedBillsPence).toBe(82_800 + 26_700 + 6_000);
  });

  it('allows a negative safe zone — honesty over comfort — with per-day clamped to 0', () => {
    const r = computeSafeZone({ ...base, balancePence: 50_000 });
    expect(r.safeZonePence).toBe(-55_600);
    expect(r.perDayPence).toBe(0);
  });

  it('on payday itself there are no remaining days, essentials or per-day', () => {
    const r = computeSafeZone({ ...base, today: '2026-07-12' });
    expect(r.daysToPayday).toBe(0);
    expect(r.essentialsPence).toBe(0);
    expect(r.perDayPence).toBe(0);
  });

  it('rejects fractional pence — money is integers or it is bugs', () => {
    expect(() => computeSafeZone({ ...base, balancePence: 1_240.5 })).toThrow(/integer pence/);
  });
});

describe('billsInCycle', () => {
  it('keeps only unpaid bills due within [today, payday)', () => {
    const bills = [
      bill({ id: 'in', amountPence: 1_000, dueDate: '2026-07-01' }),
      bill({ id: 'today', amountPence: 1_000, dueDate: '2026-06-30' }),
      bill({ id: 'past', amountPence: 1_000, dueDate: '2026-06-29' }),
      bill({ id: 'payday', amountPence: 1_000, dueDate: '2026-07-12' }),
      bill({ id: 'paid', amountPence: 1_000, dueDate: '2026-07-02', paid: true }),
    ];
    const kept = billsInCycle(bills, '2026-06-30', '2026-07-12').map((b) => b.id);
    expect(kept).toEqual(['in', 'today']);
  });
});

describe('checkAfford', () => {
  it('verdicts Safe well inside the zone, with no Shelf needed', () => {
    const r = checkAfford(18_400, 6_000);
    expect(r.verdict).toBe('safe');
    expect(r.leftAfterPence).toBe(12_400);
    expect(r.shelfEligible).toBe(false);
  });

  it('verdicts Tight near the edge and offers the Shelf', () => {
    const r = checkAfford(18_400, 10_000);
    expect(r.verdict).toBe('tight');
    expect(r.shelfEligible).toBe(true);
  });

  it('verdicts Not now beyond the zone and still offers the Shelf', () => {
    const r = checkAfford(18_400, 20_000);
    expect(r.verdict).toBe('notNow');
    expect(r.leftAfterPence).toBe(-1_600);
    expect(r.shelfEligible).toBe(true);
  });

  it('rejects non-positive amounts', () => {
    expect(() => checkAfford(18_400, 0)).toThrow(/positive/);
  });
});
