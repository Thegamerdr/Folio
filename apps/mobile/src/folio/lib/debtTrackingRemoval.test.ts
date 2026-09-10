import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import {
  addDebt,
  getFinancialResetGeneration,
  getPersistBlob,
  getState,
  hydrateFromBlob,
  logDebtPayment,
  removeDebt,
  resetToEmpty,
  restoreDebtTracking,
  setCurrentBalance,
  subscribeStore,
  togglePaused,
  type Debt,
  type AppState,
} from '../store';
import { buildFinancialPlanFromState } from './financialPlan';
import { selectDebtTrackingPresentation } from './debtTrackingPresentation';
import { buildTimelineRows } from './timelineEvents';
import { buildDecisionHistoryRows, historyDestination } from './reviewHistory';
import { createCanonicalAppStateProjection } from './canonicalStateProjection';
import { readCanonicalAppStateMoneyProjection } from './canonicalAppStateReadProjection';
import { LOCAL_HISTORY_KINDS } from '../../local/localLedger';

function presentation() {
  const state = getState();
  return selectDebtTrackingPresentation({
    debts: state.debts ?? [],
    transactions: state.transactions,
    timelineEvents: state.timelineEvents ?? [],
  });
}

const now = new Date('2026-09-09T12:00:00Z');
const record: Omit<Debt, 'id' | 'addedAt'> & { id: string; addedAt: string } = {
  id: 'tracked-card',
  name: 'Evidence card',
  kind: 'card',
  balance: 320,
  apr: 19.9,
  aprKnown: true,
  minPayment: 40,
  dueDom: 19,
  minimumDueDate: '2026-09-19',
  minimumOccurrences: { '2026-08-19': { status: 'paid' } },
  promoUntil: '2026-12-31',
  arrears: false,
  addedAt: '2026-09-09T10:00:00Z',
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  resetToEmpty();
  setCurrentBalance({ amount: 1800, source: 'user-entered', confidence: 'rough' });
  addDebt(record);
});
afterEach(() => vi.useRealTimers());

describe('independent debt tracking removal and scoped Undo', () => {
  it('preserves posted payments and cash through removal/restart, then restores the exact debt metadata', () => {
    expect(logDebtPayment(record.id, 40).applied).toBe(true);
    const debt = getState().debts![0]!;
    const cash = getState().currentBalance;
    const payments = getState().transactions;
    const safe = buildFinancialPlanFromState(getState(), { now }).safeToSpendMinor;
    const workspace = getState().activeWorkspaceId;
    const generation = getFinancialResetGeneration();
    removeDebt(debt.id);
    expect(getState().debts).toEqual([]);
    expect(getState().currentBalance).toEqual(cash);
    expect(getState().transactions).toEqual(payments);
    hydrateFromBlob(getPersistBlob());
    expect(getState().debts).toEqual([]);
    expect(getState().transactions).toEqual(payments);
    expect(restoreDebtTracking(debt, 0, workspace, generation)).toBe(true);
    expect(getState().debts).toEqual([debt]);
    expect(getState().currentBalance).toEqual(cash);
    expect(buildFinancialPlanFromState(getState(), { now }).safeToSpendMinor).toBe(safe);
    expect(restoreDebtTracking(debt, 0, workspace, generation)).toBe(false);
  });
  it('keeps unrelated new debts when restoring the removed row in its original position', () => {
    const debt = getState().debts![0]!;
    const workspace = getState().activeWorkspaceId;
    const generation = getFinancialResetGeneration();
    removeDebt(debt.id);
    addDebt({ ...record, id: 'later-card', name: 'Another card' });
    const later = getState().debts![0]!;
    expect(restoreDebtTracking(debt, 0, workspace, generation)).toBe(true);
    expect(getState().debts).toEqual([debt, later]);
  });
  it('cannot resurrect a removed debt after a financial reset', () => {
    const debt = getState().debts![0]!;
    const workspace = getState().activeWorkspaceId;
    const generation = getFinancialResetGeneration();
    removeDebt(debt.id);
    resetToEmpty();
    expect(restoreDebtTracking(debt, 0, workspace, generation)).toBe(false);
    expect(getState().debts).toEqual([]);
  });
  it('refuses an Undo belonging to another workspace', () => {
    const debt = getState().debts![0]!;
    const generation = getFinancialResetGeneration();
    removeDebt(debt.id);
    expect(
      restoreDebtTracking(
        debt,
        0,
        `${getState().activeWorkspaceId}:other` as AppState['activeWorkspaceId'],
        generation,
      ),
    ).toBe(false);
    expect(getState().debts).toEqual([]);
  });
  it('publishes the removed state and receipt together, and the restored state in one Undo publication', () => {
    const debt = getState().debts![0]!;
    const workspace = getState().activeWorkspaceId;
    const generation = getFinancialResetGeneration();
    const seen: { status: string; event: string | undefined }[] = [];
    const unsubscribe = subscribeStore(() =>
      seen.push({
        status: presentation().status,
        event: getState().timelineEvents?.[0]?.kind,
      }),
    );
    removeDebt(debt.id);
    expect(seen).toEqual([{ status: 'removed', event: 'debt-removed' }]);
    expect(restoreDebtTracking(debt, 0, workspace, generation)).toBe(true);
    expect(seen).toEqual([
      { status: 'removed', event: 'debt-removed' },
      { status: 'active', event: 'debt-restored' },
    ]);
    unsubscribe();
  });
  it('distinguishes never declared, active, cleared, and removed after restart and clean reset', () => {
    expect(presentation().status).toBe('active');
    const payment = logDebtPayment(record.id, 320);
    expect(payment.applied).toBe(true);
    expect(presentation()).toMatchObject({
      status: 'cleared',
      title: 'All recorded debts cleared',
      lastPaymentAt: now.toISOString(),
    });
    expect(presentation().active).toHaveLength(0);
    hydrateFromBlob(getPersistBlob());
    expect(presentation().status).toBe('cleared');
    removeDebt(record.id);
    expect(presentation()).toMatchObject({
      status: 'removed',
      removed: [{ id: record.id, name: record.name, removedAt: now.toISOString() }],
    });
    hydrateFromBlob(getPersistBlob());
    expect(presentation().status).toBe('removed');
    resetToEmpty();
    hydrateFromBlob(getPersistBlob());
    expect(presentation().status).toBe('never');
    expect(getState().timelineEvents).toEqual([]);
    expect(getState().transactions).toEqual([]);
  });
  it('retains a removal without payment history after more than 200 unrelated decisions', () => {
    removeDebt(record.id);
    for (let index = 0; index < 205; index += 1) togglePaused('Later bill');
    hydrateFromBlob(getPersistBlob());
    expect(presentation().status).toBe('removed');
    expect(presentation().removed[0]?.id).toBe(record.id);
    expect(
      getState().timelineEvents?.filter((event) => event.kind === 'debt-removed'),
    ).toHaveLength(1);
  });
  it('round-trips identity and truthful removal/restore history through canonical storage projection', () => {
    const debt = getState().debts![0]!;
    const workspace = getState().workspaces.find((row) => row.id === getState().activeWorkspaceId)!;
    const generation = getFinancialResetGeneration();
    removeDebt(record.id);
    restoreDebtTracking(debt, 0, workspace.id, generation);
    const state = getState();
    const projection = createCanonicalAppStateProjection(state, workspace, now.toISOString());
    const read = readCanonicalAppStateMoneyProjection(
      projection.repositorySnapshot,
      String(workspace.id),
    );
    expect(read.timelineEvents).toEqual(state.timelineEvents);
    expect(read.timelineEvents.every((event) => event.entityId === record.id)).toBe(true);
    const rows = buildTimelineRows({ transactions: [], edits: [], events: read.timelineEvents });
    expect(rows.map((row) => row.verb)).toEqual(['Tracking restored', 'Removed from tracking']);
    const decisions = buildDecisionHistoryRows({
      transactions: [],
      edits: [],
      events: read.timelineEvents,
    });
    expect(new Set(decisions.map((row) => row.kind))).toEqual(
      new Set(['debt-restored', 'debt-removed']),
    );
    expect(decisions.map((row) => historyDestination(row, []))).toEqual([
      { kind: 'debts', label: 'View debt tracking and history' },
      { kind: 'debts', label: 'View debt tracking and history' },
    ]);
    expect(LOCAL_HISTORY_KINDS).toContain('debt_tracking_removed');
    expect(LOCAL_HISTORY_KINDS).toContain('debt_tracking_restored');
  });
  it('does not invent a cleared payment date for a debt entered with a zero balance', () => {
    resetToEmpty();
    addDebt({ ...record, balance: 0 });
    expect(presentation()).toMatchObject({ status: 'cleared', lastPaymentAt: undefined });
    expect(presentation().cleared[0]?.lastPaymentAt).toBeUndefined();
    expect(getState().transactions).toEqual([]);
  });
  it('restores visible active state, cash, debt, and the canonical forecast together when a clearing payment is undone', () => {
    const before = getState();
    const safeBefore = buildFinancialPlanFromState(before, { now }).safeToSpendMinor;
    const payment = logDebtPayment(record.id, 400);
    expect(payment.applied).toBe(true);
    if (!payment.applied) throw new Error(payment.reason);
    expect(getState().currentBalance.amount).toBe(1400);
    expect(presentation().status).toBe('cleared');
    const seen: { status: string; cash: number; balance: number; safe: number }[] = [];
    const unsubscribe = subscribeStore(() =>
      seen.push({
        status: presentation().status,
        cash: getState().currentBalance.amount,
        balance: getState().debts![0]!.balance,
        safe: buildFinancialPlanFromState(getState(), { now }).safeToSpendMinor,
      }),
    );
    expect(payment.undo).toBeTypeOf('function');
    payment.undo?.();
    unsubscribe();
    expect(seen).toEqual([{ status: 'active', cash: 1800, balance: 320, safe: safeBefore }]);
    expect(getState().transactions).toEqual(before.transactions);
    hydrateFromBlob(getPersistBlob());
    expect(presentation().status).toBe('active');
  });
  it('preserves the distinction for older removed debts with only real payment history', () => {
    const state = getState();
    logDebtPayment(record.id, 40);
    const result = selectDebtTrackingPresentation({
      debts: [],
      transactions: getState().transactions,
      timelineEvents: [],
    });
    expect(result.status).toBe('removed');
    expect(result.removed).toEqual([{ id: record.id, name: record.name }]);
    expect(state.debts?.[0]?.balance).toBe(320);
  });
});
