import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getState, resetToEmpty, setPartial, togglePaused, type AppState } from '../store';
import { buildFinancialPlanFromState } from './financialPlan';
import {
  buildRecoveryReceipt,
  describeRecoveryAction,
  selectAfterChangePresentation,
} from './recoveryReceipt';

const now = new Date('2026-09-10T12:00:00Z');

function fixture(): AppState {
  const base = getState();
  return {
    ...base,
    accounts: [],
    pots: [],
    debts: [],
    calendarEvents: [],
    incomeSources: [],
    subPaused: {},
    subOverrides: {},
    whatIfHolds: [],
    spendHold: null,
    bufferAmount: 0,
    modeExtras: { reset: 0 },
    reviewQueue: [],
    reviewQueueSpillover: [],
    currentBalance: {
      amount: 1500,
      source: 'user-entered',
      confidence: 'corrected',
      provided: true,
      setAt: now.toISOString(),
    },
    onboarding: {
      ...base.onboarding,
      done: true,
      financialSetupConfirmed: true,
      monthlyIncome: 1800,
      payday: 20,
    },
    transactions: [
      {
        id: 'old-payment',
        merchant: 'Debt payment: Evidence card',
        amount: -100,
        category: 'bills',
        source: 'manual',
        when: '2026-09-09T12:00:00Z',
      },
    ],
    subs: [
      {
        name: 'Rent + bills',
        cost: 1515,
        nextRenewalISO: '2026-09-12',
        obligationAnchorISO: '2026-09-12',
        nextRenewalDaysAway: 2,
        lastUsedDaysAgo: 0,
        usesPerMonth: 0,
      },
      {
        name: 'Evidence streaming',
        cost: 20,
        nextRenewalISO: '2026-09-15',
        obligationAnchorISO: '2026-09-15',
        nextRenewalDaysAway: 5,
        lastUsedDaysAgo: 0,
        usesPerMonth: 0,
      },
    ],
  };
}

function present(state: AppState, receipt?: ReturnType<typeof buildRecoveryReceipt>) {
  return selectAfterChangePresentation(state, buildFinancialPlanFromState(state, { now }), receipt);
}

beforeEach(() => resetToEmpty());

describe('recovery action receipts and current canonical outcome', () => {
  it('reports the actual £20 subscription pause, £1500 cash and £35→£15 gap despite an unrelated £100 debt transaction', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      setPartial(fixture());
      const before = getState();
      togglePaused('Evidence streaming', true);
      const after = getState();
      const receipt = buildRecoveryReceipt(
        before,
        after,
        { kind: 'pause-sub', name: 'Evidence streaming' },
        now,
      );
      expect(receipt.before).toEqual({ cashMinor: 150000, safeMinor: -3500, gapMinor: 3500 });
      expect(receipt.after).toEqual({ cashMinor: 150000, safeMinor: -1500, gapMinor: 1500 });
      const model = present(after, receipt);
      expect(model).toMatchObject({
        amount: 15,
        amountLabel: 'gap remaining',
        headline: 'A gap still needs attention.',
        canReassure: false,
      });
      expect(model.changeTitle).toBe('Paused the next Evidence streaming charge in the forecast');
      expect(model.changeDetail).toContain('Melo has not stopped their payments');
      expect(model.rows).toContainEqual({ label: 'Gap', before: 35, after: 15 });
      expect(JSON.stringify(model)).not.toContain('Debt payment: Evidence card');
      expect(after.transactions).toEqual(before.transactions);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses current figures after a later balance change while retaining the saved comparison honestly', () => {
    const before = fixture();
    const saved = { ...before, currentBalance: { ...before.currentBalance, amount: 1600 } };
    const receipt = buildRecoveryReceipt(
      before,
      saved,
      { kind: 'hold-spend', dailyCap: 5, days: 3 },
      now,
    );
    const current = { ...saved, currentBalance: { ...saved.currentBalance, amount: 1400 } };
    const model = present(current, receipt);
    expect(model.amount).toBe(135);
    expect(model.changedSinceReceipt).toBe(true);
    expect(model.rows).toContainEqual({ label: 'Tracked cash', before: 1500, after: 1600 });
    expect(model.canReassure).toBe(false);
  });

  it('never treats a forecast-only provider change as a confirmed payment cancellation even when it closes the gap', () => {
    const before = fixture();
    const after = { ...before, currentBalance: { ...before.currentBalance, amount: 2000 } };
    const receipt = buildRecoveryReceipt(
      before,
      after,
      { kind: 'move-bill', name: 'Evidence streaming', days: 5 },
      now,
    );
    const model = present(after, receipt);
    expect(model.presentation.canReassure).toBe(true);
    expect(model.canReassure).toBe(false);
    expect(model.changeTitle).toBe('Moved Evidence streaming 5 days later in the forecast');
    expect(model.message).toContain('Check the change with the provider');
  });

  it('withholds a money verdict when setup is incomplete and never guesses a change from transaction history', () => {
    const state = fixture();
    state.onboarding = { ...state.onboarding, done: false, financialSetupConfirmed: false };
    const model = present(state);
    expect(model).toMatchObject({
      amount: null,
      canReassure: false,
      headline: 'Your numbers still need checking.',
      rows: [],
    });
    expect(model.changeDetail).toContain('before-and-after comparison is not available');
    expect(JSON.stringify(model)).not.toContain('Evidence card');
  });

  it('keeps overdue obligations and missing income visible even with positive cash', () => {
    const state = fixture();
    state.currentBalance = { ...state.currentBalance, amount: 5000 };
    state.subs = [
      { ...state.subs[0]!, nextRenewalISO: '2026-09-09', obligationAnchorISO: '2026-09-09' },
    ];
    expect(present(state)).toMatchObject({
      canReassure: false,
      headline: 'Overdue commitments need attention',
    });
    state.subs = [];
    state.onboarding = { ...state.onboarding, monthlyIncome: 0 };
    expect(present(state)).toMatchObject({ canReassure: false, headline: 'No next income date' });
  });

  it('discards receipts from a different workspace and does not mutate either input snapshot', () => {
    const state = fixture();
    const before = JSON.stringify(state);
    const receipt = buildRecoveryReceipt(
      state,
      state,
      { kind: 'hold-spend', dailyCap: 5, days: 3 },
      now,
    );
    const foreign = {
      ...receipt,
      workspaceId: 'another-workspace' as AppState['activeWorkspaceId'],
    };
    expect(present(state, foreign).receipt).toBeUndefined();
    expect(JSON.stringify(state)).toBe(before);
    expect(describeRecoveryAction(receipt.action).title).toBe(
      'Set a 3-day spending hold at £5 a day',
    );
  });

  it('withholds reassurance for pending figures despite a positive canonical amount', () => {
    const state = fixture();
    state.currentBalance = { ...state.currentBalance, amount: 2000 };
    state.reviewQueue = [
      {
        id: 'pending',
        source: 'manual',
        merchant: 'Unconfirmed bill',
        amount: -10,
        addedAt: now.toISOString(),
      },
    ];
    expect(present(state)).toMatchObject({
      amount: 465,
      canReassure: false,
      headline: 'Some figures need your review',
    });
  });
});
