import { describe, expect, it } from 'vitest';

import { resolveBottomNavInset, S9_THREE_BUTTON_BOTTOM_INSET_DP } from './bottomNavGeometry';

describe('personal bottom-nav acceptance geometry', () => {
  it('reserves the S9 three-button band for personal parity captures', () => {
    expect(
      resolveBottomNavInset({ reportedBottomInset: 24, parityCapture: true, variant: 'personal' }),
    ).toBe(S9_THREE_BUTTON_BOTTOM_INSET_DP);
  });

  it('never reduces an inset already reported by the acceptance device', () => {
    expect(
      resolveBottomNavInset({ reportedBottomInset: 52, parityCapture: true, variant: 'personal' }),
    ).toBe(52);
  });

  it('does not alter production or Business workspace geometry', () => {
    expect(
      resolveBottomNavInset({ reportedBottomInset: 24, parityCapture: false, variant: 'personal' }),
    ).toBe(24);
    expect(
      resolveBottomNavInset({ reportedBottomInset: 24, parityCapture: true, variant: 'business' }),
    ).toBe(24);
  });
});
