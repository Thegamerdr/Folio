import { describe, expect, it } from 'vitest';
import {
  applyMoneyKey,
  debtDraftIssue,
  isHorizontalSliderGesture,
  parseDayOfMonth,
} from './formDrafts';

describe('exact form drafts (A03, B04, B11)', () => {
  it.each(['', '0', '32', '-1', '3.2', '3x', '100'])(
    'rejects invalid day %j without coercing it',
    (raw) => {
      expect(parseDayOfMonth(raw)).toBeUndefined();
    },
  );
  it.each([1, 9, 28, 29, 30, 31])(
    'accepts day %i, leaving month-end resolution to the schedule',
    (value) => {
      expect(parseDayOfMonth(String(value))).toBe(value);
    },
  );
  it('does not turn a vertical or diagonal scroll into a slider edit', () => {
    expect(isHorizontalSliderGesture(0, 30)).toBe(false);
    expect(isHorizontalSliderGesture(5, 30)).toBe(false);
    expect(isHorizontalSliderGesture(15, 20)).toBe(false);
    expect(isHorizontalSliderGesture(4, 0)).toBe(false);
    expect(isHorizontalSliderGesture(30, 5)).toBe(true);
  });
  it('preserves exact pennies and a trailing decimal draft on the keypad', () => {
    let raw = '0';
    for (const key of ['1', '8', '0', '0', '.', '4', '5', '6']) raw = applyMoneyKey(raw, key);
    expect(raw).toBe('1800.45');
    expect(applyMoneyKey('12', '.')).toBe('12.');
    expect(applyMoneyKey('12.', '.')).toBe('12.');
    expect(applyMoneyKey('0', '←')).toBe('0');
  });
  const debt = {
    name: 'Evidence card',
    balance: '320',
    apr: '19.9',
    minimum: '40',
    dueDay: '19',
    editing: false,
  };
  it('explains a valid-looking new debt with a zero minimum, without banning zero APR', () => {
    expect(debtDraftIssue({ ...debt, minimum: '0' })).toContain('minimum payment, above £0');
    expect(debtDraftIssue({ ...debt, apr: '0' })).toBeNull();
    expect(debtDraftIssue({ ...debt, apr: '' })).toBeNull();
  });
  it('preserves zero balances and minimums for existing cleared debts', () => {
    expect(debtDraftIssue({ ...debt, balance: '0', minimum: '0', editing: true })).toBeNull();
  });
  it('rejects invalid debt day and money drafts rather than stripping or clamping them', () => {
    expect(debtDraftIssue({ ...debt, dueDay: '32' })).toBe('Enter a day from 1 to 31.');
    expect(debtDraftIssue({ ...debt, balance: '-320' })).not.toBeNull();
    expect(debtDraftIssue({ ...debt, minimum: '40.123' })).not.toBeNull();
  });
});
