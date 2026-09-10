import { beforeEach, describe, expect, it } from 'vitest';

import { getState, resetToEmpty } from '../store';
import { commitOnboarding } from './onboardingMutations';
import { parseManualMoney } from './manualMoney';
import {
  createOnboardingAmountDraft,
  selectOnboardingAmount,
  updateOnboardingAmount,
} from './onboardingAmountDraft';

beforeEach(() => resetToEmpty({ onboardingDone: false }));

describe('one onboarding protected-buffer answer', () => {
  it.each(['survival', 'stability'] as const)(
    '%s retains step3 £200 at Essentials and commits the same protected amount',
    (mode) => {
      const draft = updateOnboardingAmount(createOnboardingAmountDraft(0), mode, '200.00');
      expect(selectOnboardingAmount(draft, 'buffer')).toEqual({ amount: 200, input: '200.00' });
      commitOnboarding({
        name: 'Evidence',
        payday: 10,
        monthlyIncome: 1800,
        balance: 1800,
        pickedPots: [],
        cadence: 'monthly',
        anchorISO: '2026-09-10',
        legacyPayday: 10,
        intentMode: mode,
        modeExtra: selectOnboardingAmount(draft, mode).amount,
        desiredBuffer: draft.buffer.amount,
        weeklyEssentials: 75,
      });
      expect(getState().bufferAmount).toBe(200);
      expect(getState().modeExtras?.[mode]).toBe(200);
      expect(getState().modeExtras?.reset).toBe(75);
      expect(getState().currentBalance.amount).toBe(1800);
    },
  );

  it('shows later edits when going back and shares subsequent edits between both buffer modes', () => {
    let draft = updateOnboardingAmount(createOnboardingAmountDraft(0), 'survival', '200.00');
    draft = updateOnboardingAmount(draft, 'buffer', '250.75');
    expect(selectOnboardingAmount(draft, 'survival')).toEqual({ amount: 250.75, input: '250.75' });
    expect(selectOnboardingAmount(draft, 'stability')).toEqual({ amount: 250.75, input: '250.75' });
    draft = updateOnboardingAmount(draft, 'stability', '325');
    expect(draft.buffer).toEqual({ amount: 325, input: '325' });
  });

  it('keeps other mode answers separate through mode changes and buffer edits', () => {
    let draft = createOnboardingAmountDraft(100, { growth: 500, debt: 9000 });
    draft = updateOnboardingAmount(draft, 'survival', '200.00');
    expect(selectOnboardingAmount(draft, 'growth')).toEqual({ amount: 500, input: '500' });
    draft = updateOnboardingAmount(draft, 'growth', '625.50');
    draft = updateOnboardingAmount(draft, 'buffer', '250');
    expect(selectOnboardingAmount(draft, 'growth')).toEqual({ amount: 625.5, input: '625.50' });
    expect(selectOnboardingAmount(draft, 'debt')).toEqual({ amount: 9000, input: '9000' });
    expect(selectOnboardingAmount(draft, 'survival')).toEqual({ amount: 250, input: '250' });
    expect(selectOnboardingAmount(draft, 'household')).toEqual({ amount: 0, input: '0' });
  });

  it('restores the saved canonical buffer instead of stale mode-extra copies', () => {
    const draft = createOnboardingAmountDraft(140.25, { survival: 100, stability: 500 });
    expect(selectOnboardingAmount(draft, 'survival')).toEqual(draft.buffer);
    expect(selectOnboardingAmount(draft, 'stability')).toEqual(draft.buffer);
    expect(draft.buffer).toEqual({ amount: 140.25, input: '140.25' });
  });

  it('shares incomplete entry validation and retains an intentional zero', () => {
    let draft = updateOnboardingAmount(createOnboardingAmountDraft(200), 'buffer', '');
    const early = selectOnboardingAmount(draft, 'survival');
    expect(early).toEqual({ amount: 200, input: '' });
    expect(parseManualMoney(early.input, { allowZero: true })).toBeUndefined();
    draft = updateOnboardingAmount(draft, 'survival', '0.00');
    expect(draft.buffer).toEqual({ amount: 0, input: '0.00' });
  });
});
