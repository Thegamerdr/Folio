// LogSpendSheet save → rememberMerchantCategory store contract test — DATA_INTELLIGENCE.md phase ③.
//
// A manual spend log is the user explicitly setting a merchant's category from scratch (no candidate,
// no incoming guess to differ from), so every successful save learns it. Exercises the exact store
// seam LogSpendSheet's `save()` calls, mirroring editTxnSave.test.ts's pattern. Node-safe.

import { beforeEach, describe, expect, it } from 'vitest';

import { addTransaction, getState, rememberMerchantCategory, resetAll, setPartial } from '../store';

beforeEach(() => {
  resetAll();
  setPartial({ transactions: [], merchantCategories: {} });
});

describe('LogSpendSheet save → rememberMerchantCategory', () => {
  it('learns the picked category for a brand-new manual spend', () => {
    const m = 'Greggs';
    const category = 'food' as const;
    addTransaction({ merchant: m, amount: -3.5, category, source: 'manual' });
    rememberMerchantCategory(m, category);

    const entry = getState().merchantCategories?.['greggs'];
    expect(entry?.category).toBe('food');
    expect(entry?.hits).toBe(1);
  });

  it('a second manual log with a different category stages pending rather than flipping immediately', () => {
    addTransaction({ merchant: 'Greggs', amount: -3.5, category: 'food', source: 'manual' });
    rememberMerchantCategory('Greggs', 'food');
    addTransaction({ merchant: 'Greggs', amount: -6, category: 'shopping', source: 'manual' });
    rememberMerchantCategory('Greggs', 'shopping');

    const entry = getState().merchantCategories?.['greggs'];
    expect(entry?.category).toBe('food');
    expect(entry?.pendingCategory).toBe('shopping');
    expect(entry?.hits).toBe(2);
  });

  it('a third manual log agreeing with the pending category flips it (flip threshold)', () => {
    addTransaction({ merchant: 'Greggs', amount: -3.5, category: 'food', source: 'manual' });
    rememberMerchantCategory('Greggs', 'food');
    addTransaction({ merchant: 'Greggs', amount: -6, category: 'shopping', source: 'manual' });
    rememberMerchantCategory('Greggs', 'shopping');
    addTransaction({ merchant: 'Greggs', amount: -4, category: 'shopping', source: 'manual' });
    rememberMerchantCategory('Greggs', 'shopping');

    const entry = getState().merchantCategories?.['greggs'];
    expect(entry?.category).toBe('shopping');
    expect(entry?.hits).toBe(3);
  });
});
