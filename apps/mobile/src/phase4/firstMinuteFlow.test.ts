import { describe, expect, it } from 'vitest';

import {
  defaultQuickStartInput,
  evaluateQuickStart,
  formatGbAmount,
  parseMoneyInput,
} from './firstMinuteFlow';

describe('first-minute flow', () => {
  it('parses decimal money as integer minor units', () => {
    expect(parseMoneyInput('720')).toBe(72000);
    expect(parseMoneyInput('1,850.25')).toBe(185025);
    expect(parseMoneyInput('-42.05')).toBe(-4205);
    expect(parseMoneyInput('12.345')).toBeNull();
  });

  it('evaluates a temporary three-fact position without advice language', () => {
    const result = evaluateQuickStart(defaultQuickStartInput);

    expect(result.warnings).toEqual([]);
    expect(result.beforeIncomeMinor).toBe(-10000);
    expect(result.afterIncomeMinor).toBe(175000);
    expect(result.isOutgoingBeforeIncome).toBe(true);
  });

  it('returns validation warnings while preserving a bounded fallback result', () => {
    const result = evaluateQuickStart({
      ...defaultQuickStartInput,
      availableNow: 'not money',
      nextIncomeDate: 'Friday',
      outgoingLabel: '',
    });

    expect(result.warnings).toEqual([
      'Available now must be a pounds-and-pence amount.',
      'Next income date must use YYYY-MM-DD.',
      'Outgoing needs a short label.',
    ]);
    expect(result.availableNowMinor).toBe(0);
  });

  it('formats GBP with currency code to avoid ambiguous money text', () => {
    expect(formatGbAmount(175000)).toBe('GBP 1,750.00');
    expect(formatGbAmount(-10000)).toBe('-GBP 100.00');
  });
});
