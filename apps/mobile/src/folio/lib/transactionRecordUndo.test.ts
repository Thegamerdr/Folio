import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDebt,
  addEvidenceDocument,
  addTransaction,
  attachEvidenceDocumentToTransaction,
  editTransaction,
  getFinancialResetGeneration,
  getPersistBlob,
  getState,
  hydrateFromBlob,
  logDebtPayment,
  removeTransactionWithUndo,
  resetToEmpty,
  setCurrentBalance,
  undoTransactionCorrection,
} from '../store';
import { buildFinancialPlanFromState } from './financialPlan';

const now = new Date('2026-09-09T12:00:00Z');
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  resetToEmpty();
  setCurrentBalance({ amount: 1800, source: 'user-entered', confidence: 'corrected' });
});
afterEach(() => vi.useRealTimers());

describe('exact transaction removal and correction Undo', () => {
  it('restores debt payment, note, receipt links, position and financial effects through persisted removal', () => {
    const debt = addDebt({
      name: 'Card',
      kind: 'card',
      balance: 320,
      apr: 0,
      minPayment: 80,
      dueDom: 18,
    });
    expect(logDebtPayment(debt.id, 100).applied).toBe(true);
    const id = getState().transactions[0]!.id;
    editTransaction(id, { note: 'Bank receipt reference 123', merchant: 'Card payment' }, 'user');
    const receiptId = 'evidence_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    addEvidenceDocument({
      id: receiptId,
      filename: 'receipt.jpg',
      mediaType: 'image/jpeg',
      byteSize: 2048,
      addedAtISO: now.toISOString(),
      sourceType: 'image',
      extractionStatus: 'not-requested',
      storageState: 'encrypted-device-vault',
    });
    attachEvidenceDocumentToTransaction(receiptId, id);
    addTransaction({
      merchant: 'Unrelated earlier row',
      amount: -2,
      source: 'manual',
      category: 'other',
    });
    const row = getState().transactions.find((item) => item.id === id)!;
    const prior = buildFinancialPlanFromState(getState(), { now });
    const undo = removeTransactionWithUndo(id)!;
    expect(getState().transactions.some((item) => item.id === id)).toBe(false);
    expect(getState().evidenceDocuments![0]!.linkedTransactionIds).toBeUndefined();
    hydrateFromBlob(getPersistBlob());
    expect(undo()).toBe(true);
    expect(getState().transactions[1]).toEqual(row);
    expect(getState().evidenceDocuments![0]!.linkedTransactionIds).toEqual([id]);
    expect(buildFinancialPlanFromState(getState(), { now })).toEqual(prior);
    expect(undo()).toBe(false);
  });
  it('refuses removal Undo after a new balance correction or reset', () => {
    const row = addTransaction(
      { merchant: 'Spend', amount: -10, category: 'food', source: 'manual' },
      { updateCurrentBalance: true },
    );
    const undo = removeTransactionWithUndo(row.id)!;
    setCurrentBalance({ amount: 1950, source: 'user-entered', confidence: 'corrected' });
    expect(undo()).toBe(false);
    expect(getState().currentBalance.amount).toBe(1950);
    const history = addTransaction({
      merchant: 'History',
      amount: -2,
      category: 'other',
      source: 'manual',
    });
    const undoHistory = removeTransactionWithUndo(history.id)!;
    resetToEmpty();
    expect(undoHistory()).toBe(false);
    expect(getState().transactions).toEqual([]);
  });
  it('undos a correction only while its exact after-state remains current', () => {
    const row = addTransaction(
      { merchant: 'Spend', amount: -10, category: 'food', source: 'manual' },
      { updateCurrentBalance: true },
    );
    const workspace = getState().activeWorkspaceId;
    const generation = getFinancialResetGeneration();
    editTransaction(row.id, { amount: -12.25, note: 'Correction one' }, 'user');
    const after = getState().transactions.find((item) => item.id === row.id)!;
    expect(
      undoTransactionCorrection(after, { amount: -10, note: undefined }, workspace, generation),
    ).toBe(true);
    expect(getState().currentBalance.amount).toBe(1790);
    editTransaction(row.id, { amount: -12.25, note: 'Correction one' }, 'user');
    const again = getState().transactions.find((item) => item.id === row.id)!;
    editTransaction(row.id, { note: 'Newer correction' }, 'user');
    expect(undoTransactionCorrection(again, { amount: -10 }, workspace, generation)).toBe(false);
    expect(getState().transactions[0]).toMatchObject({ note: 'Newer correction' });
    expect(getState().currentBalance.amount).toBe(1787.75);
  });
});
