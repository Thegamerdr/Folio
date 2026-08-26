import { describe, expect, it } from 'vitest';

import { resolveSheetBottomOffset } from './sheetGeometry';

describe('resolveSheetBottomOffset', () => {
  it('anchors Android portal sheets above the external navigation area', () => {
    expect(
      resolveSheetBottomOffset({
        platform: 'android',
        usesAndroidPortal: true,
        bottomInset: 48,
      }),
    ).toBe(48);
  });

  it('does not shift Android modal or iOS sheets', () => {
    expect(
      resolveSheetBottomOffset({
        platform: 'android',
        usesAndroidPortal: false,
        bottomInset: 48,
      }),
    ).toBe(0);
    expect(
      resolveSheetBottomOffset({ platform: 'ios', usesAndroidPortal: false, bottomInset: 34 }),
    ).toBe(0);
  });

  it('never returns a negative offset', () => {
    expect(
      resolveSheetBottomOffset({
        platform: 'android',
        usesAndroidPortal: true,
        bottomInset: -1,
      }),
    ).toBe(0);
  });
});
