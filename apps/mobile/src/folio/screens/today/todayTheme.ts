import { useIsDark, useTheme, type Palette } from '../../../surfaces/pressureMap/kit';

const TODAY_LIGHT_OVERRIDES: Partial<Palette> = {
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
};

const TODAY_DARK_OVERRIDES: Partial<Palette> = {
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
};

/** Apply the pinned Today roles without changing the shared kit for other screens. */
export function todayPaletteFor(base: Palette, isDark: boolean): Palette {
  return { ...base, ...(isDark ? TODAY_DARK_OVERRIDES : TODAY_LIGHT_OVERRIDES) };
}

/** The Today-scoped palette, resolved from the app's existing theme provider. */
export function useTodayTheme(): Palette {
  return todayPaletteFor(useTheme(), useIsDark());
}
