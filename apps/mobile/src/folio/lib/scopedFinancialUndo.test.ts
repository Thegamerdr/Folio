import { beforeEach, describe, expect, it } from 'vitest';
import {
  getState,
  resetToEmpty,
  setBufferAmount,
  setCurrentBalance,
  setPartial,
  setSubs,
} from '../store';
import { createScopedFinancialUndo } from './scopedFinancialUndo';
import { buildSubscriptionEditPatch, subscriptionEditBoundary } from './subscriptionEditing';

beforeEach(() => resetToEmpty());

describe('scoped financial setting Undo', () => {
  it('restores the buffer once while preserving an unrelated cash correction', () => {
    const before = getState();
    setBufferAmount(110);
    const undo = createScopedFinancialUndo(before, ['bufferAmount']);
    setCurrentBalance({ amount: 1700, source: 'user-entered', confidence: 'corrected' });
    expect(undo()).toBe(true);
    expect(getState().bufferAmount).toBe(before.bufferAmount);
    expect(getState().currentBalance.amount).toBe(1700);
    expect(undo()).toBe(false);
  });
  it('refuses to overwrite a newer buffer, another workspace, or a reset profile', () => {
    const before = getState();
    setBufferAmount(110);
    const newerUndo = createScopedFinancialUndo(before, ['bufferAmount']);
    setBufferAmount(120);
    expect(newerUndo()).toBe(false);
    const workspaceUndo = createScopedFinancialUndo(
      { ...before, activeWorkspaceId: 'other-workspace' as typeof before.activeWorkspaceId },
      ['bufferAmount'],
    );
    expect(workspaceUndo()).toBe(false);
    const resetUndo = createScopedFinancialUndo(getState(), ['bufferAmount']);
    resetToEmpty();
    expect(resetUndo()).toBe(false);
    expect(getState().bufferAmount).toBe(0);
  });
  it('restores a renamed bill and its settings, but cannot erase subsequently added bills', () => {
    setSubs([
      {
        name: 'Rent',
        cost: 500,
        nextRenewalDaysAway: 18,
        nextRenewalISO: '2026-09-28',
        lastUsedDaysAgo: 0,
        usesPerMonth: 1,
      },
    ]);
    setPartial({ subPaused: { Rent: true }, subOverrides: { Rent: 2 } });
    const before = getState();
    const now = new Date('2026-09-10T12:00:00Z');
    const patch = buildSubscriptionEditPatch(
      before,
      'Rent',
      {
        name: 'Rent and bills',
        cost: 500,
        periodDays: null,
        futureDate: subscriptionEditBoundary(before, 'Rent', now).defaultDate,
      },
      now,
    );
    setPartial(patch);
    const undo = createScopedFinancialUndo(before, Object.keys(patch) as (keyof typeof before)[]);
    expect(undo()).toBe(true);
    expect(getState().subs).toEqual(before.subs);
    expect(getState().subPaused).toEqual({ Rent: true });
    expect(getState().subOverrides).toEqual({ Rent: 2 });
    setPartial(patch);
    const staleUndo = createScopedFinancialUndo(
      before,
      Object.keys(patch) as (keyof typeof before)[],
    );
    setSubs([
      ...getState().subs,
      { name: 'Extra bill', cost: 12, nextRenewalDaysAway: 5, lastUsedDaysAgo: 0, usesPerMonth: 0 },
    ]);
    expect(staleUndo()).toBe(false);
    expect(getState().subs.map((sub) => sub.name)).toEqual(['Rent and bills', 'Extra bill']);
  });
});
