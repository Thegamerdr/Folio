import { describe, expect, it } from 'vitest';
import { getState, type AppState } from '../../store';
import { buildFinancialPlanFromState } from '../financialPlan';
import { selectMeloFinancialHealth } from './financialHealth';

const now = new Date('2026-09-10T12:00:00Z');
function fixture(): AppState {
  const base = getState();
  return {
    ...base,
    accounts: [],
    incomeSources: [],
    transactions: [],
    subs: [],
    pots: [],
    subPaused: {},
    subOverrides: {},
    spendHold: null,
    whatIfHolds: [],
    reviewQueue: [],
    reviewQueueSpillover: [],
    currentBalance: {
      amount: 1700,
      source: 'user-entered',
      confidence: 'corrected',
      setAt: now.toISOString(),
    },
    onboarding: {
      ...base.onboarding,
      monthlyIncome: 1800,
      payday: 9,
      done: true,
      financialSetupConfirmed: true,
    },
    calendarEvents: [
      { id: 'bundle', title: 'Rent + bills', kind: 'out', date: '2026-09-12', amount: -950 },
      { id: 'phone', title: 'Phone', kind: 'out', date: '2026-09-15', amount: -35 },
    ],
    debts: [
      {
        id: 'card',
        name: 'Evidence card',
        kind: 'card',
        balance: 220,
        apr: 0,
        minPayment: 40,
        dueDom: 19,
        minimumDueDate: '2026-09-19',
        addedAt: '2026-09-10',
      },
    ],
    modeExtras: { reset: 70 },
    bufferAmount: 200,
    cycles: [
      {
        closedAt: '2026-09-10',
        label: 'September',
        spare: 1985,
        tightPoint: 185,
        setAside: 0,
        note: '',
      },
    ],
  };
}
function health(state = fixture()) {
  const plan = buildFinancialPlanFromState(state, { now });
  return { plan, ...selectMeloFinancialHealth(state, plan) };
}

describe('Melo money-health follows canonical current room', () => {
  it('withholds the health score for the £15 shortfall even immediately after a ritual', () => {
    const state = fixture();
    state.whatIfHolds = [
      {
        id: 'weekly',
        amount: 40,
        recurrence: 'weekly',
        label: 'Preview',
        addedAt: now.toISOString(),
      },
    ];
    const result = health(state);
    expect(result.plan.safeToSpendMinor).toBe(-1500);
    expect(
      result.plan.timeline.find((row) => row.date === result.plan.nextIncomeDate)!.closingMinor,
    ).toBeGreaterThan(0);
    expect(result).toMatchObject({ scored: false, dotCount: 0, vitality: 0 });
    expect(result.line).toBe('Gap after bills, essentials and buffer');
    expect(result.caption).toContain('Shortfall: £15.');
    expect(result.caption).not.toMatch(/runway holds|headroom|safe to spend|enough to breathe/i);
  });
  it('never scores incomplete costs despite a positive forecast and recent ritual', () => {
    const state = fixture();
    state.modeExtras = {};
    state.onboarding = { ...state.onboarding, done: false, financialSetupConfirmed: false };
    const result = health(state);
    expect(result.plan.safeToSpendMinor).toBeGreaterThan(0);
    expect(result.scored).toBe(false);
    expect(result.line).toBe('We need your numbers');
  });
  it('keeps positive overdue and pending-review states unscored', () => {
    const state = fixture();
    state.calendarEvents = state.calendarEvents.map((row) =>
      row.id === 'bundle' ? { ...row, date: '2026-09-06' } : row,
    );
    expect(health(state)).toMatchObject({
      scored: false,
      line: 'Overdue commitments need attention',
    });
    const review = fixture();
    review.reviewQueue = [
      {
        id: 'pending',
        source: 'manual',
        merchant: 'Needs review',
        amount: -10,
        addedAt: now.toISOString(),
      },
    ];
    expect(health(review)).toMatchObject({ scored: false, line: 'Some figures need your review' });
  });
  it('retains familiar score bands for confirmed states using £185 safe rather than payday cash', () => {
    const result = health();
    expect(result.plan.safeToSpendMinor).toBe(18500);
    expect(result.vitality).toBeCloseTo((185 / 1800 / 0.4) * 0.65 + 0.15 + 0.08);
    expect(result).toMatchObject({ scored: true, plumage: 'warm', dotCount: 2 });
    expect(result.caption).toContain('£185');
    expect(result.caption).toContain('9 Oct 2026');
  });
  it('does not award the ritual component for reconstructed history', () => {
    const state = fixture();
    state.cycles = state.cycles.map((cycle) => ({ ...cycle, reconstructed: true }));
    expect(health().vitality - health(state).vitality).toBeCloseTo(0.08);
  });
  it('withholds a score when there is no next income and keeps the high-room band available', () => {
    const state = fixture();
    state.onboarding = { ...state.onboarding, monthlyIncome: 0, payday: 0 };
    expect(health(state)).toMatchObject({ scored: false, line: 'No next income date' });
    const funded = fixture();
    funded.currentBalance = { ...funded.currentBalance, amount: 5000 };
    expect(health(funded)).toMatchObject({ scored: true, plumage: 'radiant', dotCount: 4 });
  });
});
