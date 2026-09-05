import { describe, expect, it } from 'vitest';
import { parseManualMoney } from './manualMoney';

describe('manual money entry', () => {
  it('retains pennies and correctly grouped pasted currency', () => {
    expect(parseManualMoney('0.01')).toBe(0.01);
    expect(parseManualMoney(' £1,234.56 ')).toBe(1234.56);
    expect(parseManualMoney('12')).toBe(12);
  });
  it('rejects malformed amounts without saving a different numeric prefix', () => {
    for (const value of [
      '1.2.3',
      '1,23',
      '-12',
      '12abc',
      '1e5',
      'Infinity',
      '',
      '0',
      '0.001',
      '9007199254740991',
    ]) {
      expect(parseManualMoney(value)).toBeUndefined();
    }
  });
  it('allows an explicitly configured zero or signed balance without weakening default entry', () => {
    expect(parseManualMoney('0', { allowZero: true })).toBe(0);
    expect(parseManualMoney('-12.50', { allowNegative: true })).toBe(-12.5);
    expect(parseManualMoney('-12.50')).toBeUndefined();
  });
});
