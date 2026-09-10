import { describe, expect, it } from 'vitest';

import { formatEditableAmount, formatGBPExact, formatReviewDate } from './reviewFormat';

describe('pinned Review money formatting', () => {
  it('renders parsed ISO dates with the shared readable full date without altering their value', () => {
    const date = '2026-09-10';
    expect(formatReviewDate(date)).toBe('10 Sept 2026');
    expect(date).toBe('2026-09-10');
  });
  it('keeps existing human dates and missing dates honest', () => {
    expect(formatReviewDate('10 Sep')).toBe('10 Sep');
    expect(formatReviewDate('')).toBe('Date not provided');
  });
  it('does not turn an invalid imported ISO date into a different calendar day', () => {
    expect(formatReviewDate('2026-02-30')).toBe('Date needs review');
    expect(formatReviewDate('2026-14-10')).toBe('Date needs review');
  });
  it('keeps exact pence in caught-subscription copy', () => {
    expect(formatGBPExact(6.99)).toBe('£6.99');
    expect(formatGBPExact(-30)).toBe('−£30.00');
  });

  it('omits redundant zero pence from the editable hero amount', () => {
    expect(formatEditableAmount(30)).toBe('30');
    expect(formatEditableAmount(6.99)).toBe('6.99');
    expect(formatEditableAmount(1234)).toBe('1,234');
  });
});
