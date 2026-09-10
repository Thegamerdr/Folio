import { describe, expect, it } from 'vitest';
import { getState, type AppState } from '../store';
import { buildPlansScreenPresentation } from './plansScreenModel';
import { buildCanonicalPlanUpcoming } from './planModel';

const now = new Date('2026-09-10T12:00:00Z');
function fixture(): AppState {
  const base = getState();
  return {
    ...base,
    accounts: [],
    currentBalance: {
      amount: 1700,
      source: 'user-entered',
      confidence: 'corrected',
      setAt: now.toISOString(),
    },
    onboarding: {
      ...base.onboarding,
      done: true,
      monthlyIncome: 1800,
      payday: 9,
      financialSetupConfirmed: true,
    },
    incomeSources: [],
    transactions: [],
    calendarEvents: [],
    pots: [],
    whatIfHolds: [],
    spendHold: null,
    subOverrides: {},
    subPaused: {},
    reviewQueue: [],
    reviewQueueSpillover: [],
    subs: [
      {
        name: 'Rent + bills',
        cost: 950,
        nextRenewalDaysAway: 2,
        nextRenewalISO: '2026-09-12',
        obligationAnchorISO: '2026-09-12',
        lastUsedDaysAgo: 0,
        usesPerMonth: 0,
      },
      {
        name: 'Phone',
        cost: 35,
        nextRenewalDaysAway: 9,
        nextRenewalISO: '2026-09-19',
        obligationAnchorISO: '2026-09-19',
        lastUsedDaysAgo: 0,
        usesPerMonth: 0,
      },
    ],
    debts: [
      {
        id: 'card',
        name: 'Evidence card',
        kind: 'card',
        balance: 320,
        apr: 0,
        minPayment: 40,
        dueDom: 19,
        minimumDueDate: '2026-09-19',
        addedAt: '2026-09-10',
      },
    ],
    bufferAmount: 200,
    modeExtras: { reset: 70 },
  };
}

describe('alternate Plans route canonical finance', () => {
  it('reproduces the runtime three-obligation state after adding the extra Phone bill', () => {
    const model = buildPlansScreenPresentation(fixture(), now);
    expect(model.upcoming).toHaveLength(3);
    expect(model.totalMinor).toBe(102500);
    expect(model.plan.safeToSpendMinor).toBe(18500);
    expect(model.tightPoint).toEqual({ date: '2026-10-08', amountMinor: 38500 });
    expect(model.plan.nextIncomeDate).toBe('2026-10-09');
    expect(model.paydayLabel).toBe('Next payday · 9 Oct 2026');
    expect(model.upcoming).toEqual(buildCanonicalPlanUpcoming(model.plan));
  });
  it('preserves the verified same-day payday £350 boundary instead of ending the list today', () => {
    const state = fixture();
    state.currentBalance = { ...state.currentBalance, amount: 1800 };
    state.subs = state.subs.slice(0, 1);
    state.debts = [];
    const model = buildPlansScreenPresentation(state, new Date('2026-09-09T12:00:00Z'));
    expect(model.plan.safeToSpendMinor).toBe(35000);
    expect(model.plan.nextIncomeDate).toBe('2026-10-09');
    expect(model.upcoming.map((row) => row.name)).toEqual(['Rent + bills']);
    expect(model.totalMinor).toBe(95000);
  });
  it('keeps overdue bills visible at their original date and suppresses safety reassurance', () => {
    const state = fixture();
    state.subOverrides = { 'Rent + bills': -6 };
    const model = buildPlansScreenPresentation(state, now);
    expect(model.upcoming[0]).toMatchObject({
      name: 'Rent + bills',
      date: '2026-09-06',
      amount: 950,
      note: 'overdue · still unpaid',
    });
    expect(model.presentation.overdueCount).toBe(1);
    expect(model.presentation.canReassure).toBe(false);
    // Moving the schedule also brings the next 6 October occurrence before 9 October income.
    expect(model.totalMinor).toBe(197500);
    expect(
      model.upcoming.filter((row) => row.name === 'Rent + bills').map((row) => row.date),
    ).toEqual(['2026-09-06', '2026-10-06']);
  });
  it('removes a confirmed-paid bill and shows the exact partial debt remainder without changing cash', () => {
    const state = fixture();
    state.subs = state.subs.map((sub) =>
      sub.name === 'Rent + bills'
        ? { ...sub, obligationOccurrences: { '2026-09-12': { status: 'paid' } } }
        : sub,
    );
    state.debts = [
      {
        ...state.debts![0]!,
        minimumOccurrences: { '2026-09-19': { status: 'partial', paidMinor: 1500 } },
      },
    ];
    const model = buildPlansScreenPresentation(state, now);
    expect(model.upcoming.map((row) => row.amount)).toEqual([25, 35]);
    expect(model.totalMinor).toBe(6000);
    expect(model.plan.currentBalanceMinor).toBe(170000);
  });
  it('does not include an obligation on the next income boundary in the pre-income total', () => {
    const state = fixture();
    state.calendarEvents = [
      { id: 'payday-bill', kind: 'out', title: 'On payday', date: '2026-10-09', amount: -10 },
    ];
    const model = buildPlansScreenPresentation(state, now);
    expect(model.totalMinor).toBe(102500);
    expect(model.upcoming.some((row) => row.name === 'On payday')).toBe(false);
    expect(model.plan.events.some((row) => row.label === 'On payday')).toBe(true);
  });
  it('publishes added or edited bill pennies in the same headline, rows and canonical result', () => {
    const state = fixture();
    state.subs = state.subs.map((sub) => (sub.name === 'Phone' ? { ...sub, cost: 35.45 } : sub));
    const model = buildPlansScreenPresentation(state, now);
    expect(model.totalMinor).toBe(102545);
    expect(model.upcoming.find((row) => row.name === 'Phone')?.amount).toBe(35.45);
    expect(model.plan.safeToSpendMinor).toBe(18455);
  });
  it('names an unknown payday and keeps incomplete or pending-review states unconfirmed', () => {
    const state = fixture();
    state.onboarding = {
      ...state.onboarding,
      done: false,
      monthlyIncome: 0,
      payday: 0,
      financialSetupConfirmed: false,
    };
    state.modeExtras = {};
    const partial = buildPlansScreenPresentation(state, now);
    expect(partial.plan.nextIncomeDate).toBeNull();
    expect(partial.paydayLabel).toBe('Next payday · Not set');
    expect(partial.presentation.complete).toBe(false);
    expect(partial.presentation.canReassure).toBe(false);
    expect(partial.upcoming.length).toBeGreaterThan(0);
    const reviewed = fixture();
    reviewed.reviewQueue = [
      {
        id: 'pending',
        source: 'manual',
        merchant: 'Needs review',
        amount: -10,
        addedAt: now.toISOString(),
      },
    ];
    expect(buildPlansScreenPresentation(reviewed, now).presentation.canReassure).toBe(false);
  });
  it('does not fabricate commitments or a spending verdict for a fresh profile', () => {
    const state = fixture();
    state.currentBalance = {
      amount: 0,
      source: 'user-entered',
      confidence: 'rough',
      setAt: now.toISOString(),
    };
    state.onboarding = {
      ...state.onboarding,
      done: false,
      monthlyIncome: 0,
      payday: 0,
      financialSetupConfirmed: false,
    };
    state.subs = [];
    state.debts = [];
    state.modeExtras = {};
    state.bufferAmount = 0;
    const model = buildPlansScreenPresentation(state, now);
    expect(model.upcoming).toEqual([]);
    expect(model.totalMinor).toBe(0);
    expect(model.presentation.complete).toBe(false);
    expect(model.presentation.canReassure).toBe(false);
    expect(model.emptyMessage).toContain('within this forecast');
  });
});
