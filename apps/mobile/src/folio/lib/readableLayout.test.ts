import { describe, expect, it } from 'vitest';

import { shouldStackTextRows } from './readableLayout';

describe('readable financial rows', () => {
  it('keeps the baseline 360dp layout at the normal text size', () => {
    expect(shouldStackTextRows(360, 1)).toBe(false);
  });

  it('gives each label and money value the full row at enlarged text sizes', () => {
    expect(shouldStackTextRows(360, 1.3)).toBe(true);
    expect(shouldStackTextRows(360, 2)).toBe(true);
    expect(shouldStackTextRows(412, 2)).toBe(true);
  });

  it('also stacks when display scaling narrows the viewport without changing text size', () => {
    expect(shouldStackTextRows(270, 1)).toBe(true);
    expect(shouldStackTextRows(320, 1)).toBe(true);
  });

  it('uses usable width after the actual container padding', () => {
    expect(shouldStackTextRows(360, 1, 72)).toBe(false);
    expect(shouldStackTextRows(360, 1, 88)).toBe(true);
    expect(shouldStackTextRows(768, 2)).toBe(false);
  });
});
