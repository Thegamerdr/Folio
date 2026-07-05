// ReviewScreen onAdd → rememberMerchantCategory store contract tests — DATA_INTELLIGENCE.md phase ③
// "Merchant→category memory".
//
// What this proves: every Accept on the Review card confirms the merchant's category — whether the
// user changed the chip away from the incoming candidate's category, or left it as-is (a passive
// accept of a correct guess is still a confirmation). These tests exercise the exact store seam
// ReviewScreen's `onAdd` calls (addTransaction + rememberMerchantCategory, in that order), the same
// way editTxnSave.test.ts proves EditTxnSheet's handleSave contract, without rendering the RN
// component. Node-safe — no react-native, no DOM — so the apps/**/*.test.ts runner collects it.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  addTransaction,
  getState,
  rememberMerchantCategory,
  resetAll,
  setPartial,
  type Transaction,
} from '../store';

beforeEach(() => {
  resetAll();
  setPartial({ transactions: [], merchantCategories: {} });
});

// The exact two-call sequence ReviewScreen.onAdd performs on Accept.
function accept(merchant: string, amount: number, category: Transaction['category']): void {
  addTransaction({ merchant, amount, category, source: 'manual' });
  rememberMerchantCategory(merchant, category);
}

describe('ReviewScreen onAdd → rememberMerchantCategory (learn-on-accept)', () => {
  it('learns the category on a first-time accept, even when the user changed nothing (passive accept)', () => {
    // The candidate arrived with category 'food' pre-filled (a model guess or a recall); the user
    // never touched the chip and just tapped Add. This still counts as a confirmation.
    accept('Tesco', -42.1, 'food');

    const entry = getState().merchantCategories?.['tesco'];
    expect(entry?.category).toBe('food');
    expect(entry?.hits).toBe(1);
  });

  it('learns the CORRECTED category when the user picked a different chip than the incoming guess', () => {
    // The candidate arrived guessing 'other'; the user picked 'bills' before tapping Add.
    accept('Octopus Energy', -118, 'bills');

    const entry = getState().merchantCategories?.['octopus energy'];
    expect(entry?.category).toBe('bills');
  });

  it('a repeat accept for the same merchant upserts (hits++), never a duplicate entry', () => {
    accept('Tesco', -42.1, 'food');
    accept('Tesco', -12, 'food');

    const map = getState().merchantCategories ?? {};
    expect(Object.keys(map).length).toBe(1);
    expect(map['tesco']?.hits).toBe(2);
  });

  it('a single later accept with a different category does NOT flip — it only stages pending (flip threshold)', () => {
    accept('Tesco', -42.1, 'food');
    accept('Tesco', -12, 'shopping');

    const entry = getState().merchantCategories?.['tesco'];
    expect(entry?.category).toBe('food');
    expect(entry?.pendingCategory).toBe('shopping');
    expect(entry?.hits).toBe(2);
  });

  it('two consecutive accepts with the same different category DOES flip the committed category', () => {
    accept('Tesco', -42.1, 'food');
    accept('Tesco', -12, 'shopping');
    accept('Tesco', -8, 'shopping');

    const entry = getState().merchantCategories?.['tesco'];
    expect(entry?.category).toBe('shopping');
    expect(entry?.pendingCategory).toBeUndefined();
    expect(entry?.hits).toBe(3);
  });

  it('never touches the posted transaction count beyond the one Accept adds', () => {
    const before = getState().transactions.length;
    accept('Tesco', -42.1, 'food');
    expect(getState().transactions.length).toBe(before + 1);
  });
});

// RECALL round-trip (lib/merchantMemory.ts applyMemoryToCandidates, exercised via the store's public
// surface): once a category has been learned, the recall a future intake would see resolves to it.
describe('learn → recall round trip', () => {
  it('a category learned via Accept is recallable for the next candidate from the same merchant', () => {
    accept('Tesco', -42.1, 'food');

    const remembered = getState().merchantCategories?.['tesco'];
    expect(remembered).toBeDefined();
    expect(remembered?.category).toBe('food');
    // This is the exact shape setReaderCandidates/applyMemoryToCandidates reads (recallCategory keys
    // off normaliseMerchant('Tesco') === 'tesco') — proven directly in merchantMemory.test.ts and
    // store.test.ts's "readerCandidates staging slot" recall tests; asserted here as the closing link
    // of the learn → recall chain from the UI-facing write side.
  });
});
