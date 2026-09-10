import { describe, expect, it } from 'vitest';
import { guidedBalanceDraft } from './guidedBalance';

describe('guided check-in production balance', () => {
  it('never substitutes demo cash for a fresh zero balance', () => {
    expect(guidedBalanceDraft({ amount: 0, source: 'user-entered' })).toBe('0');
  });
  it('does not present legacy sample cash for confirmation as real money', () => {
    expect(guidedBalanceDraft({ amount: 1240, source: 'sample' })).toBe('0');
  });
  it('preserves an existing user-entered balance in the rough-number check-in', () => {
    expect(guidedBalanceDraft({ amount: 500, source: 'user-entered' })).toBe('500');
    expect(guidedBalanceDraft({ amount: 501.2, source: 'corrected' })).toBe('501.2');
  });
  it('does not invent cash from an invalid stored amount', () => {
    expect(guidedBalanceDraft({ amount: Number.NaN, source: 'user-entered' })).toBe('0');
  });
});
