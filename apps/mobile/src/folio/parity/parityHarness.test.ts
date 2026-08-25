import { describe, expect, it } from 'vitest';

import { getState, hasConfiguredMoneyPicture } from '../store';
import { activateParityHarness, type ParityFixtureId } from './parityHarness';

function activate(fixture: ParityFixtureId) {
  activateParityHarness({
    fixture,
    nowISO: '2026-08-18T08:00:00.000Z',
    screen: 'today',
    sheet: null,
    theme: 'light',
  });
  return getState();
}

describe('visual parity fixture harness', () => {
  it('builds the confirmed, provisional, pressured and negative personal states', () => {
    expect(activate('confirmed-safe')).toMatchObject({
      currentBalance: { amount: 1480, confidence: 'corrected' },
      onboarding: { done: true, payday: 28, monthlyIncome: 2600 },
    });
    expect(getState().transactions).toHaveLength(1);
    expect(getState().subs).toHaveLength(2);

    expect(activate('provisional-low-confidence').currentBalance).toMatchObject({
      amount: 680,
      confidence: 'rough',
    });
    expect(activate('pressured').subs.reduce((sum, item) => sum + item.cost, 0)).toBe(440);
    expect(activate('negative-shortfall').subs.reduce((sum, item) => sum + item.cost, 0)).toBe(730);
  });

  it('builds commitments and pending Review through their public authorities', () => {
    const commitments = activate('populated-commitments');
    expect(commitments.pots).toHaveLength(2);
    expect(commitments.debts).toHaveLength(1);
    expect(commitments.plans).toHaveLength(1);

    const pending = activate('pending-review');
    expect(pending.evidenceDocuments).toHaveLength(1);
    expect(pending.reviewQueue).toHaveLength(2);
    expect(pending.reviewQueue?.map((item) => item.merchant)).toEqual([
      'Railcard',
      'Freelance payment',
    ]);
  });

  it('keeps empty and first-run states distinct and unconfigured', () => {
    const empty = activate('empty');
    expect(empty.onboarding.done).toBe(true);
    expect(hasConfiguredMoneyPicture(empty)).toBe(false);

    const firstRun = activate('first-run');
    expect(firstRun.onboarding.done).toBe(false);
    expect(hasConfiguredMoneyPicture(firstRun)).toBe(false);
  });

  it('builds populated Sole Trader and Ltd partitions from business-engine fixtures', () => {
    const sole = activate('business-sole-trader');
    expect(sole.business?.entity?.kind).toBe('sole-trader');
    expect(sole.business?.invoices).toHaveLength(3);
    expect(sole.accounts?.[0]?.balanceMinor).toBe(600_000);

    const ltd = activate('business-ltd');
    expect(ltd.business?.entity?.kind).toBe('ltd');
    expect(ltd.business?.payrollRuns).toHaveLength(1);
    expect(ltd.accounts?.[0]?.balanceMinor).toBe(1_400_000);
  });
});
