import { beforeEach, describe, expect, it } from 'vitest';
import {
  getPersistBlob,
  getState,
  hydrateFromBlob,
  resetToEmpty,
  setCurrentBalance,
} from '../store';
import { selectBalanceSourceLabel } from './balanceProvenance';

beforeEach(() => resetToEmpty());

describe('balance provenance after a clean reset', () => {
  it('keeps reset zero unknown even when the returning onboarding doorway is retained', () => {
    setCurrentBalance({ amount: 1800, source: 'user-entered', confidence: 'rough' });
    resetToEmpty();
    expect(getState().onboarding.done).toBe(true);
    expect(getState().currentBalance).toMatchObject({ amount: 0, provided: false });
    expect(selectBalanceSourceLabel(getState())).toBe('not set yet');
    hydrateFromBlob(getPersistBlob());
    expect(selectBalanceSourceLabel(getState())).toBe('not set yet');
  });

  it('also labels a true first-storage balance as not set', () => {
    resetToEmpty({ onboardingDone: false });
    expect(selectBalanceSourceLabel(getState())).toBe('not set yet');
  });

  it.each([0, 1800])(
    'preserves a deliberately entered £%s without requiring full setup',
    (amount) => {
      setCurrentBalance({ amount, source: 'user-entered', confidence: 'rough' });
      expect(getState().currentBalance.provided).toBe(true);
      expect(selectBalanceSourceLabel(getState())).toBe('you set this');
      hydrateFromBlob(getPersistBlob());
      expect(selectBalanceSourceLabel(getState())).toBe('you set this');
    },
  );

  it.each([
    ['statement', 'statement-derived', 'from your last statement'],
    ['corrected', 'corrected', 'you corrected this'],
  ] as const)('preserves genuine zero provenance from %s', (source, confidence, expected) => {
    setCurrentBalance({ amount: 0, source, confidence });
    expect(selectBalanceSourceLabel(getState())).toBe(expected);
  });
});
