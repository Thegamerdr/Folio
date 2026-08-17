import { describe, expect, it } from 'vitest';

import {
  BANK_HOLIDAY_POLICY,
  englandWalesBankHolidays,
  isEnglandWalesBankHoliday,
} from './bankHolidays';

describe('versioned England and Wales bank-holiday policy', () => {
  it('contains the complete standard 2026 calendar including substitute Christmas day', () => {
    expect([...englandWalesBankHolidays(2026)].sort()).toEqual([
      '2026-01-01',
      '2026-04-03',
      '2026-04-06',
      '2026-05-04',
      '2026-05-25',
      '2026-08-31',
      '2026-12-25',
      '2026-12-28',
    ]);
  });

  it('assigns distinct substitutes when Christmas and Boxing Day fall at a weekend', () => {
    expect([...englandWalesBankHolidays(2027)]).toEqual(
      expect.arrayContaining(['2027-12-27', '2027-12-28']),
    );
  });

  it('fails closed outside its reviewed period', () => {
    expect(BANK_HOLIDAY_POLICY.expiresAfter).toBe('2035-12-31');
    expect(() => englandWalesBankHolidays(2035)).not.toThrow();
    expect(() => isEnglandWalesBankHoliday('2036-01-01')).toThrow('does not cover');
  });
});
