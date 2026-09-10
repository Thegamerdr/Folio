import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addCycle,
  getPersistBlob,
  getState,
  resetToEmpty,
  setPartial,
  type AppState,
} from '../store';
import { buildFinancialPlanFromState } from './financialPlan';
import { previewRitualCompletion } from './ritualCompletion';

const now = new Date('2026-09-10T09:45:00Z');
function fixture(): AppState {
  const base = getState();
  return {
    ...base,
    accounts: [],
    transactions: [],
    pots: [],
    subPaused: {},
    subOverrides: {},
    spendHold: null,
    whatIfHolds: [],
    currentBalance: {
      amount: 1700,
      source: 'user-entered',
      confidence: 'corrected',
      setAt: now.toISOString(),
      provided: true,
    },
    onboarding: {
      ...base.onboarding,
      done: true,
      monthlyIncome: 1800,
      payday: 10,
      financialSetupConfirmed: true,
    },
    incomeSources: [
      {
        id: 'pay',
        label: 'Pay',
        amount: 1800,
        cadence: 'monthly',
        dayOfMonth: 10,
        source: 'manual',
      },
    ],
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
    ],
    calendarEvents: [{ id: 'phone', date: '2026-09-15', kind: 'out', title: 'Phone', amount: -35 }],
    debts: [
      {
        id: 'card',
        name: 'Card',
        kind: 'card',
        balance: 220,
        minPayment: 40,
        dueDom: 19,
        apr: 19.9,
        addedAt: now.toISOString(),
      },
    ],
    bufferAmount: 200,
    modeExtras: { reset: 70 },
    cycles: [],
    tinyWins: [],
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  resetToEmpty();
});
afterEach(() => {
  vi.useRealTimers();
  resetToEmpty();
});

describe('ritual completion discloses the existing forecast cleanup', () => {
  it('previews weekly What If holds reserving £200 clearing from −£15 to £185 without changing recorded cash', () => {
    const state = fixture();
    state.whatIfHolds = [
      { id: 'preview', amount: 40, recurrence: 'weekly', addedAt: now.toISOString() },
    ];
    setPartial(state);
    const before = buildFinancialPlanFromState(getState(), { now });
    expect(before.safeToSpendMinor).toBe(-1500);
    const saved = getPersistBlob();
    const preview = previewRitualCompletion(getState(), before, now);
    expect(preview.scope).toContain('clears your What If previews');
    expect(preview.effect).toContain('Your tracked cash stays £1,700');
    expect(preview.effect).toContain('−£15 now → £185 after finishing');
    expect(getPersistBlob()).toEqual(saved);
    addCycle({
      closedAt: '2026-09-10',
      label: 'September',
      spare: 1975,
      tightPoint: 185,
      setAside: 0,
      note: '',
    });
    const after = buildFinancialPlanFromState(getState(), { now });
    expect(preview.afterPlan).toEqual(after);
    expect(after.safeToSpendMinor).toBe(18500);
    expect(getState().whatIfHolds).toEqual([]);
    expect(getState().currentBalance.amount).toBe(1700);
  });
  it('names temporary bill-date changes and matches the actual finish transition', () => {
    const state = fixture();
    state.subOverrides = { 'Rent + bills': 28 };
    setPartial(state);
    const before = buildFinancialPlanFromState(getState(), { now });
    const preview = previewRitualCompletion(getState(), before, now);
    expect(preview.scope).toContain('temporary bill-date changes');
    expect(preview.afterPlan.safeToSpendMinor).toBeLessThan(before.safeToSpendMinor);
    addCycle({
      closedAt: '2026-09-10',
      label: 'September',
      spare: 1,
      tightPoint: 1,
      setAside: 0,
      note: '',
    });
    expect(preview.afterPlan).toEqual(buildFinancialPlanFromState(getState(), { now }));
  });
  it('does not imply a forecast change when no temporary previews are active', () => {
    const state = fixture();
    const before = buildFinancialPlanFromState(state, { now });
    const preview = previewRitualCompletion(state, before, now);
    expect(preview.clearsForecastChanges).toBe(false);
    expect(preview.effect).toBeNull();
    expect(preview.afterPlan).toBe(before);
  });
});
