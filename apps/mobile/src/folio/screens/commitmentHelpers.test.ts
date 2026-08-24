import { describe, expect, it } from 'vitest';

import {
  formatAvailableAfterSetAside,
  subscriptionCadence,
  subscriptionAnnualCost,
  subscriptionConfidence,
  subscriptionStatusLine,
  summarisePotLedger,
} from './commitmentHelpers';

describe('commitment copy', () => {
  it('keeps the set-aside effect signed and readable', () => {
    expect(formatAvailableAfterSetAside(1820)).toBe('£1,820');
    expect(formatAvailableAfterSetAside(-42.4)).toBe('−£42');
  });

  it('describes the native renewal cadence without value claims', () => {
    expect(subscriptionCadence({ renewalPeriodDays: 7 })).toBe('Repeats weekly');
    expect(subscriptionCadence({ renewalPeriodDays: 14 })).toBe('Repeats fortnightly');
    expect(subscriptionCadence({ renewalPeriodDays: 365 })).toBe('Repeats yearly');
    expect(subscriptionCadence({})).toBe('Repeats monthly');
  });

  it('makes a pause consequence explicit while preserving the payment fact', () => {
    const sub = { renewalPeriodDays: 30, cost: 12.5 } as const;
    expect(subscriptionStatusLine(sub, false)).toBe('Repeats monthly');
    expect(subscriptionStatusLine(sub, true)).toBe('Paused · £12.50 back this month');
  });

  it('annualises the stored cadence without inventing usage', () => {
    expect(subscriptionAnnualCost({ renewalPeriodDays: 7, cost: 5 })).toBe(260);
    expect(subscriptionAnnualCost({ renewalPeriodDays: 14, cost: 10 })).toBe(260);
    expect(subscriptionAnnualCost({ renewalPeriodDays: 365, cost: 100 })).toBe(100);
    expect(subscriptionAnnualCost({ cost: 12.5 })).toBe(150);
  });

  it('labels date confidence from the durable renewal anchor', () => {
    expect(subscriptionConfidence({ nextRenewalISO: '2026-09-01' })).toBe('date anchored');
    expect(subscriptionConfidence({})).toBe('estimated');
  });

  it('keeps canonical pot ledger signs and excludes repayment from available cash', () => {
    expect(
      summarisePotLedger([
        { id: 'a', potId: 'holiday', at: '', kind: 'deposit', amount: 100, source: 'manual' },
        {
          id: 'b',
          potId: 'holiday',
          at: '',
          kind: 'borrow',
          amount: 25,
          source: 'shortfall-borrow',
        },
        { id: 'c', potId: 'holiday', at: '', kind: 'repay', amount: 10, source: 'manual' },
        { id: 'd', potId: 'holiday', at: '', kind: 'withdraw', amount: 5, source: 'manual' },
      ]),
    ).toEqual({ contributed: 100, borrowed: 25, repaid: 10, withdrawn: 5, availableEffect: -70 });
  });
});
