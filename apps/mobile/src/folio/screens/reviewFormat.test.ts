import { describe, expect, it } from 'vitest';

import { formatEditableAmount, formatGBPExact } from './reviewFormat';

describe('pinned Review money formatting', () => {
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
