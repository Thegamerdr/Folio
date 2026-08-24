import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../surfaces/pressureMap/kit', () => ({
  useIsDark: () => false,
  useTheme: () => ({}) as never,
}));

import { todayPaletteFor } from './todayTheme';

const base = {
  canvas: '#base-canvas',
  surface: '#base-surface',
  surfaceRaised: '#base-raised',
  sunken: '#base-sunken',
  inset: '#base-inset',
  ink: '#base-ink',
  secondary: '#base-secondary',
  muted: '#base-muted',
  calm: '#base-calm',
  calmStrong: '#base-calm-strong',
  calmSoft: '#base-calm-soft',
  positive: '#base-positive',
  positiveSoft: '#base-positive-soft',
  positiveInk: '#base-positive-ink',
  warm: '#base-warm',
  caution: '#base-caution',
  warmSoft: '#base-warm-soft',
  warmInk: '#base-warm-ink',
  repair: '#base-repair',
  repairSoft: '#base-repair-soft',
  repairInk: '#base-repair-ink',
  hairline: '#base-hairline',
  hairlineStrong: '#base-hairline-strong',
  payday: '#base-payday',
  routeShadow: '#base-route-shadow',
  inverse: '#base-inverse',
};

describe('todayPaletteFor', () => {
  it('applies the pinned Lovable light roles', () => {
    expect(todayPaletteFor(base, false)).toEqual({
      ...base,
      canvas: '#EFEBE1',
      surface: '#FBF9F2',
      surfaceRaised: '#FBF9F2',
      inset: '#E7E2D5',
      ink: '#1A1714',
      muted: '#5F5A50',
      hairline: '#E1DBCB',
      calm: '#9E3C18',
      calmStrong: '#9E3C18',
      calmSoft: '#F1DECF',
      positive: '#2C7345',
      positiveInk: '#2C7345',
      repair: '#A83C2C',
      repairInk: '#A83C2C',
    });
  });

  it('applies the pinned Lovable dark roles', () => {
    expect(todayPaletteFor(base, true)).toEqual({
      ...base,
      canvas: '#14100D',
      surface: '#211B17',
      surfaceRaised: '#211B17',
      inset: '#2A231D',
      ink: '#F4EDDF',
      muted: '#A69B8A',
      hairline: '#3A3128',
      calm: '#EE754C',
      calmStrong: '#EE754C',
      positive: '#7ABB93',
      positiveInk: '#7ABB93',
      repair: '#E9806C',
      repairInk: '#E9806C',
    });
  });

  it('preserves unspecified palette keys and does not mutate the base', () => {
    const customBase = { ...base, secondary: '#preserve-me' };
    const result = todayPaletteFor(customBase, false);

    expect(result.secondary).toBe('#preserve-me');
    expect(result.sunken).toBe(customBase.sunken);
    expect(result.positiveSoft).toBe(customBase.positiveSoft);
    expect(customBase.canvas).toBe(base.canvas);
    expect(customBase.secondary).toBe('#preserve-me');
  });
});
