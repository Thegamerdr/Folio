import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getState, resetToEmpty, setPartial, togglePaused, type AppState } from '../store';
import { buildFinancialPlanFromState, toFinancialPlanInput } from './financialPlan';
import { reanchorRenewals } from './renewalMath';
import {
  setSubscriptionOccurrenceResolution,
  setDebtMinimumOccurrenceResolution,
  setCalendarObligationResolution,
  preserveDebtMinimumSchedule,
} from './obligationState';
import { createCanonicalAppStateProjection } from './canonicalStateProjection';
import { readCanonicalAppStateMoneyProjection } from './canonicalAppStateReadProjection';

beforeEach(() => resetToEmpty());
afterEach(() => vi.useRealTimers());

function fixture(overrides: Partial<AppState> = {}): AppState {
  const base = getState();
  return {
    ...base,
    accounts: [],
    currentBalance: {
      amount: 1800,
      source: 'user-entered',
      confidence: 'corrected',
      setAt: '2026-09-09T00:00:00.000Z',
    },
    onboarding: { ...base.onboarding, monthlyIncome: 1800, payday: 28 },
    incomeSources: [],
    transactions: [],
    calendarEvents: [],
    pots: [],
    debts: [],
    subs: [
      {
        name: 'Rent and bills',
        cost: 950,
        nextRenewalISO: '2026-09-12',
        nextRenewalDaysAway: 3,
        lastUsedDaysAgo: 0,
        usesPerMonth: 0,
      },
    ],
    subPaused: {},
    subOverrides: {},
    whatIfHolds: [],
    spendHold: null,
    bufferAmount: 200,
    modeExtras: { ...(base.modeExtras ?? {}), reset: 70 },
    ...overrides,
  };
}

describe('unpaid occurrence financial release regressions', () => {
  it('a skipped future cycle stays resolved after resume, while undo before due restores it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));
    setPartial(fixture());
    togglePaused('Rent and bills', true);
    expect(getState().subs[0]?.obligationOccurrences?.['2026-09-12']).toEqual({
      status: 'cancelled',
      reason: 'paused',
    });
    togglePaused('Rent and bills', false);
    expect(getState().subs[0]?.obligationOccurrences?.['2026-09-12']).toBeUndefined();
    togglePaused('Rent and bills', true);
    vi.setSystemTime(new Date('2026-09-13T12:00:00Z'));
    togglePaused('Rent and bills', false);
    expect(
      toFinancialPlanInput(getState(), { now: new Date(), horizonDays: 35 }).commitments?.map(
        (item) => item.date,
      ),
    ).toEqual(['2026-10-12']);
  });
  it('protects the exact £950 overdue-rent reproduction: £500 safe on September 13', () => {
    const plan = buildFinancialPlanFromState(fixture(), {
      now: new Date('2026-09-13T12:00:00Z'),
      horizonDays: 45,
    });
    expect(plan.safeToSpendMinor).toBe(50_000);
    expect(plan.protectedBeforeIncomeMinor).toBe(110_000);
  });

  it('a one-cycle pause and late resume retain all subsequent unpaid cycles', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));
    setPartial(fixture());
    togglePaused('Rent and bills', true);
    expect(
      toFinancialPlanInput(getState(), { now: new Date(), horizonDays: 70 }).commitments?.map(
        (item) => item.date,
      ),
    ).toEqual(['2026-10-12', '2026-11-12']);
    vi.setSystemTime(new Date('2026-12-09T12:00:00Z'));
    togglePaused('Rent and bills', false);
    expect(
      toFinancialPlanInput(getState(), { now: new Date(), horizonDays: 35 }).commitments?.map(
        (item) => item.date,
      ),
    ).toEqual(['2026-10-12', '2026-11-12', '2026-12-12', '2027-01-12']);
    expect(Object.keys(getState().subs[0]!.obligationOccurrences!)).toEqual(['2026-09-12']);
  });

  it('retains the original unpaid occurrence through hydration/foreground date rolling', () => {
    const initial = fixture();
    const hydrated = { ...initial, subs: reanchorRenewals(initial.subs, '2026-09-13').items };
    const plan = buildFinancialPlanFromState(hydrated, {
      now: new Date('2026-09-13T12:00:00Z'),
      horizonDays: 45,
    });
    expect(plan.safeToSpendMinor).toBe(50_000);
    expect(hydrated.subs[0]?.obligationAnchorISO).toBe('2026-09-12');
  });

  it('retains this month’s debt minimum after its due date', () => {
    const state = fixture({
      subs: [],
      debts: [
        {
          id: 'card',
          name: 'Card',
          kind: 'card',
          balance: 1000,
          apr: 0,
          minPayment: 80,
          dueDom: 12,
          addedAt: '2026-09-01',
        },
      ],
    });
    const plan = buildFinancialPlanFromState(state, {
      now: new Date('2026-09-13T12:00:00Z'),
      horizonDays: 45,
    });
    expect(plan.debtMinimumMinor).toBe(8_000);
    expect(plan.safeToSpendMinor).toBe(137_000);
  });

  it('retains each overdue recurring bill exactly once, alongside its next occurrence', () => {
    const state = fixture();
    const input = toFinancialPlanInput(state, {
      now: new Date('2026-10-13T12:00:00Z'),
      horizonDays: 35,
    });
    expect(
      input.commitments
        ?.filter((item) => item.id.startsWith('subscription:'))
        .map((item) => item.date),
    ).toEqual(['2026-09-12', '2026-10-12', '2026-11-12']);
    expect(new Set(input.commitments?.map((item) => item.id)).size).toBe(input.commitments?.length);
  });

  it('paid/settled/cancelled occurrences release only their own protection', () => {
    for (const status of ['paid', 'settled', 'cancelled'] as const) {
      const state = fixture();
      state.subs[0]!.obligationOccurrences = { '2026-09-12': { status } };
      const input = toFinancialPlanInput(state, {
        now: new Date('2026-09-13T12:00:00Z'),
        horizonDays: 35,
      });
      expect(input.commitments?.map((item) => item.date)).toEqual(['2026-10-12']);
      expect(
        buildFinancialPlanFromState(state, { now: new Date('2026-09-13T12:00:00Z') })
          .safeToSpendMinor,
      ).toBe(145_000);
    }
    expect(
      buildFinancialPlanFromState(fixture({ subs: [] }), { now: new Date('2026-09-13T12:00:00Z') })
        .safeToSpendMinor,
    ).toBe(145_000);
  });

  it('partial payments preserve the unpaid remainder without charging current cash again', () => {
    const state = fixture();
    state.currentBalance.amount = 1_400; // £400 payment already reflected in current cash.
    state.subs[0]!.obligationOccurrences = {
      '2026-09-12': { status: 'partial', paidMinor: 40_000 },
    };
    const plan = buildFinancialPlanFromState(state, { now: new Date('2026-09-13T12:00:00Z') });
    expect(plan.currentBalanceMinor).toBe(140_000);
    expect(plan.safeToSpendMinor).toBe(50_000);
  });

  it('a prospective pause retains overdue and due-today bills', () => {
    for (const today of ['2026-09-12', '2026-09-13']) {
      const state = fixture({ subPaused: { 'Rent and bills': true } });
      state.subs[0]!.pausedAt = today;
      const input = toFinancialPlanInput(state, {
        now: new Date(`${today}T12:00:00Z`),
        horizonDays: 45,
      });
      expect(input.commitments?.map((item) => item.date)).toEqual(['2026-09-12', '2026-10-12']);
    }
  });

  it('bill date nudges retain stable occurrence identity and cannot resurrect a paid cycle', () => {
    const state = fixture({ subOverrides: { 'Rent and bills': 2 } });
    state.subs[0]!.obligationOccurrences = { '2026-09-12': { status: 'paid' } };
    const input = toFinancialPlanInput(state, {
      now: new Date('2026-09-13T12:00:00Z'),
      horizonDays: 35,
    });
    expect(input.commitments?.map((item) => [item.id, item.date])).toEqual([
      ['subscription:Rent and bills:2026-10-12', '2026-10-14'],
    ]);
  });

  it('explicit confirmations are idempotent and reversible without changing cash or debt', () => {
    const state = fixture({
      debts: [
        {
          id: 'card',
          name: 'Card',
          kind: 'card',
          balance: 1000,
          apr: 0,
          minPayment: 80,
          dueDom: 12,
          addedAt: '2026-09-01',
          minimumDueDate: '2026-09-12',
        },
      ],
      calendarEvents: [
        { id: 'one-off', title: 'One-off bill', date: '2026-09-11', amount: -10, kind: 'out' },
      ],
    });
    setPartial(state);
    setSubscriptionOccurrenceResolution('Rent and bills', '2026-09-12', { status: 'paid' });
    const paid = getState();
    setSubscriptionOccurrenceResolution('Rent and bills', '2026-09-12', { status: 'paid' });
    expect(getState()).toBe(paid);
    setDebtMinimumOccurrenceResolution('card', '2026-09-12', { status: 'paid' });
    setCalendarObligationResolution('one-off', { status: 'paid' });
    expect(getState().currentBalance.amount).toBe(1800);
    expect(getState().debts?.[0]?.balance).toBe(1000);
    setSubscriptionOccurrenceResolution('Rent and bills', '2026-09-12', { status: 'unpaid' });
    setDebtMinimumOccurrenceResolution('card', '2026-09-12', { status: 'unpaid' });
    setCalendarObligationResolution('one-off', { status: 'unpaid' });
    const plan = buildFinancialPlanFromState(getState(), { now: new Date('2026-09-13T12:00:00Z') });
    expect(plan.safeToSpendMinor).toBe(41_000);
  });

  it('retains bill/debt/calendar occurrence state through canonical repository serialization and restart projection', () => {
    const state = fixture({
      calendarEvents: [
        {
          id: 'bill',
          title: 'One-off bill',
          date: '2026-09-11',
          amount: -50,
          kind: 'out',
          obligationStatus: 'partial',
          obligationPaidMinor: 2_000,
        },
      ],
      debts: [
        {
          id: 'card',
          name: 'Card',
          kind: 'card',
          balance: 1000,
          apr: 0,
          minPayment: 80,
          dueDom: 12,
          addedAt: '2026-09-01',
          minimumDueDate: '2026-09-12',
          minimumOccurrences: { '2026-09-12': { status: 'partial', paidMinor: 2_000 } },
        },
      ],
    });
    state.subs[0]!.obligationAnchorISO = '2026-09-12';
    state.subs[0]!.obligationOccurrences = { '2026-09-12': { status: 'paid' } };
    const workspace = state.workspaces[0]!;
    const canonical = createCanonicalAppStateProjection(state, workspace, '2026-10-13T12:00:00Z');
    const persisted = JSON.parse(JSON.stringify(canonical.repositorySnapshot));
    const read = readCanonicalAppStateMoneyProjection(
      persisted,
      String(workspace.id),
      '2026-10-13',
    );
    expect(read.subs[0]?.obligationAnchorISO).toBe('2026-09-12');
    expect(read.subs[0]?.obligationOccurrences).toEqual(state.subs[0]?.obligationOccurrences);
    expect(read.debts[0]?.minimumDueDate).toBe('2026-09-12');
    expect(read.debts[0]?.minimumOccurrences).toEqual(state.debts?.[0]?.minimumOccurrences);
    expect(read.calendarEvents[0]).toMatchObject({
      obligationStatus: 'partial',
      obligationPaidMinor: 2_000,
    });
    const before = buildFinancialPlanFromState(state, { now: new Date('2026-10-13T12:00:00Z') });
    const after = buildFinancialPlanFromState(
      { ...state, ...read },
      { now: new Date('2026-10-13T12:00:00Z') },
    );
    expect(after.safeToSpendMinor).toBe(before.safeToSpendMinor);
    expect(after.protectedBeforeIncomeMinor).toBe(before.protectedBeforeIncomeMinor);
  });

  it('debt due-day and minimum edits preserve accrued debt obligations without duplicating this cycle', () => {
    const original = {
      id: 'card',
      name: 'Card',
      kind: 'card' as const,
      balance: 1000,
      apr: 0,
      minPayment: 80,
      dueDom: 12,
      addedAt: '2026-09-01',
      minimumDueDate: '2026-09-12',
    };
    const patch = preserveDebtMinimumSchedule(
      original,
      { dueDom: 18, minPayment: 50 },
      new Date('2026-10-13T12:00:00Z'),
    );
    expect(patch.minimumDueDate).toBe('2026-11-18');
    const edited = { ...original, dueDom: 18, minPayment: 50, ...patch };
    const input = toFinancialPlanInput(fixture({ subs: [], debts: [edited] }), {
      now: new Date('2026-10-13T12:00:00Z'),
      horizonDays: 40,
    });
    expect(input.debts?.[0]?.minimumOccurrences).toEqual([
      { date: '2026-09-12', amountMinor: 8_000 },
      { date: '2026-10-12', amountMinor: 8_000 },
      { date: '2026-11-18', amountMinor: 5_000 },
    ]);
  });

  it('a future debt due-day correction moves the unaccrued cycle and preserves partial accrued payments', () => {
    const original = {
      id: 'card',
      name: 'Card',
      kind: 'card' as const,
      balance: 1000,
      apr: 0,
      minPayment: 80,
      dueDom: 12,
      addedAt: '2026-09-01',
      minimumDueDate: '2026-09-12',
    };
    expect(
      preserveDebtMinimumSchedule(original, { dueDom: 15 }, new Date('2026-09-09T12:00:00Z'))
        .minimumDueDate,
    ).toBe('2026-09-15');
    const partial = {
      ...original,
      minimumOccurrences: { '2026-09-12': { status: 'partial' as const, paidMinor: 3_000 } },
    };
    const patch = preserveDebtMinimumSchedule(
      partial,
      { minPayment: 50 },
      new Date('2026-09-13T12:00:00Z'),
    );
    const input = toFinancialPlanInput(
      fixture({ subs: [], debts: [{ ...partial, minPayment: 50, ...patch }] }),
      { now: new Date('2026-09-13T12:00:00Z'), horizonDays: 35 },
    );
    expect(input.debts?.[0]?.minimumOccurrences).toEqual([
      { date: '2026-09-12', amountMinor: 5_000 },
      { date: '2026-10-12', amountMinor: 5_000 },
    ]);
  });

  it('partial/paid/unpaid confirmations preserve original accrued amounts after a schedule edit', () => {
    const debt = {
      id: 'card',
      name: 'Card',
      kind: 'card' as const,
      balance: 1000,
      apr: 0,
      minPayment: 50,
      dueDom: 12,
      addedAt: '2026-09-01',
      minimumDueDate: '2026-10-12',
      minimumOccurrences: { '2026-09-12': { status: 'unpaid' as const, amountMinor: 8_000 } },
    };
    setPartial(fixture({ subs: [], debts: [debt] }));
    setDebtMinimumOccurrenceResolution('card', '2026-09-12', {
      status: 'partial',
      paidMinor: 3_000,
    });
    expect(
      toFinancialPlanInput(getState(), { now: new Date('2026-09-13T12:00:00Z'), horizonDays: 0 })
        .debts?.[0]?.minimumOccurrences,
    ).toEqual([{ date: '2026-09-12', amountMinor: 5_000 }]);
    setDebtMinimumOccurrenceResolution('card', '2026-09-12', { status: 'paid' });
    setDebtMinimumOccurrenceResolution('card', '2026-09-12', { status: 'unpaid' });
    expect(
      toFinancialPlanInput(getState(), { now: new Date('2026-09-13T12:00:00Z'), horizonDays: 0 })
        .debts?.[0]?.minimumOccurrences,
    ).toEqual([{ date: '2026-09-12', amountMinor: 8_000 }]);
    setPartial(
      fixture({
        subs: [],
        debts: [{ ...debt, minPayment: 80, minimumDueDate: '2026-09-12', minimumOccurrences: {} }],
      }),
    );
    setDebtMinimumOccurrenceResolution('card', '2026-09-12', { status: 'paid' });
    const paidDebt = getState().debts![0]!;
    const futureSchedule = preserveDebtMinimumSchedule(
      paidDebt,
      { minPayment: 50 },
      new Date('2026-09-13T12:00:00Z'),
    );
    setPartial({ debts: [{ ...paidDebt, minPayment: 50, ...futureSchedule }] });
    setDebtMinimumOccurrenceResolution('card', '2026-09-12', { status: 'unpaid' });
    expect(
      toFinancialPlanInput(getState(), { now: new Date('2026-09-13T12:00:00Z'), horizonDays: 0 })
        .debts?.[0]?.minimumOccurrences,
    ).toEqual([{ date: '2026-09-12', amountMinor: 8_000 }]);
  });
});
