// Dark-mode theme infrastructure for the pressure-map surface (kitTheme).
//
// This module owns the DARK palette + the runtime theme resolution. kit.tsx re-exports everything
// here, so consumers keep importing from './kit' as before — the theme API is simply discoverable in
// this file. (It lives next to kit.tsx as `kitTheme.tsx` rather than `kit/theme.tsx` to avoid the
// file-vs-directory ambiguity that a `kit/` folder beside `kit.tsx` would create for `./kit`.)
//
// THE CONTRACT (read before adding a colour):
//   • `paper`     — the canonical LIGHT palette. Lives in kit.tsx as a literal. Tests grep its exact
//                   hexes (e.g. `calm: '#DC5E33'`), so it MUST stay there, byte-stable. kit.tsx
//                   passes it into <ThemeProvider light={paper} /> — this module never imports it,
//                   which keeps the two files free of an import cycle.
//   • `paperDark` — the matching DARK palette, defined here. EVERY key of `paper` has a dark value.
//                   Web-specified keys use the Lovable `:root.dark` hexes; the rest are derived to
//                   keep WCAG AA contrast on the dark surfaces (see the per-key notes below).
//   • `Palette`   — the shared shape. Light and dark are structurally identical, so a component reads
//                   the active one and never branches on mode.
//
// HOW SCREENS GO THEME-AWARE (the sweep pattern — also pinned at the top of kit.tsx):
//   const t = useTheme();                                   // active palette (light or dark)
//   const s = useMemo(() => makeStyles(t), [t]);            // rebuild colour styles when it changes
//   function makeStyles(t: Palette) {                       // module-level factory
//     return StyleSheet.create({ card: { backgroundColor: t.surface, color: t.ink } });
//   }
// Layout-only styles (spacing, flex, fontWeight, radius) stay module-level static — only COLOUR
// moves into the factory. Static SVG glyph colours that must follow the theme take the palette as a
// prop (see the kit glyphs).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// ---------------------------------------------------------------------------
// Palette type
// ---------------------------------------------------------------------------

/** Every colour key in the pressure-map palette. Light and dark are structurally identical, so a
 *  component reads `useTheme()` and never has to know which mode is active. */
export type Palette = {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  sunken: string;
  inset: string;
  ink: string;
  secondary: string;
  muted: string;
  calm: string;
  /** Fixed dark ink for labels/icons sitting on the terracotta accent in either theme. */
  accentInk: string;
  calmStrong: string;
  calmSoft: string;
  positive: string;
  positiveSoft: string;
  positiveInk: string;
  warm: string;
  caution: string;
  warmSoft: string;
  warmInk: string;
  repair: string;
  repairSoft: string;
  repairInk: string;
  hairline: string;
  hairlineStrong: string;
  payday: string;
  routeShadow: string;
  inverse: string;
};

// ---------------------------------------------------------------------------
// Dark palette
// ---------------------------------------------------------------------------

// The matching DARK ground. Web-specified keys carry the Lovable `:root.dark` values verbatim; the
// remaining keys are derived to preserve the LIGHT palette's contrast relationships on a dark canvas:
//   • text inks (*Ink, ink, secondary, muted) become LIGHTER tints that read on the dark surfaces.
//   • soft wells (*Soft) become DARK-tinted fills (a deep wash of their hue), so a chip/well reads
//     as a tinted recess on the dark ground rather than a bright card.
//   • `sunken` is a slightly darker well than `surface` (insets sit IN the paper).
//   • `inverse` is reserved for knockout content on dark/ink surfaces; accent fills use `accentInk`.
// Contrast notes below each derived key reference the surface it is read against (surface #1E1B17 or
// canvas #15130F) and the approximate ratio.
export const paperDark: Palette = {
  canvas: '#1B1613',
  surface: '#211B17',
  surfaceRaised: '#211B17',
  // A well DEEPER than the surface — insets sit IN the paper. Darker than canvas so a sunken field
  // (keypad rest, skeleton) reads as a recess, not a raised card.
  sunken: '#2A231D',
  inset: '#2A231D',
  ink: '#F4EDDF',
  // Warm secondary ink — one step down from `ink`, still AA for body text on surface (~9:1).
  secondary: '#A69B8A',
  muted: '#A69B8A',
  // The single terracotta accent (action / brand accent word / tight point).
  calm: '#EE754C',
  accentInk: '#1B1815',
  // Deeper-on-light becomes lighter-on-dark so accent text remains legible on the dark ground.
  calmStrong: '#F79A78',
  calmSoft: '#3E2418',
  // "You make it to payday" — the calm green verdict + money-in.
  positive: '#7ABB93',
  positiveSoft: '#2A231D',
  positiveInk: '#7ABB93',
  // Caution gold. Web specifies `caution` (#E6BB6A) for DATA marks; `warm` is the TEXT-grade variant.
  warm: '#E6C078',
  caution: '#E6C078',
  warmSoft: '#2A231D',
  warmInk: '#E6C078',
  // Shortfall / material change (coral).
  repair: '#E9806C',
  repairSoft: '#2A231D',
  repairInk: '#E9806C',
  // The warm hairline — the primary depth mechanism. On dark it is a faint LIGHTENING of the ground.
  hairline: '#3A3128',
  hairlineStrong: '#3A3128',
  payday: '#7ABB93',
  // The route's soft drop on light was a warm cream; on dark a soft lift reads as a faint warm glow
  // just above the canvas.
  routeShadow: '#2A231D',
  // Knockout foreground for ink/dark surfaces. Accent fills use `accentInk`, never `inverse`.
  inverse: '#FFFFFF',
};

// ---------------------------------------------------------------------------
// Theme mode + persistence
// ---------------------------------------------------------------------------

/** The user's Appearance choice. 'system' follows the OS; 'light'/'dark' force a palette. */
export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_MODE_KEY = 'folio.appearance.mode.v1';
const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

function isThemeMode(value: string | null): value is ThemeMode {
  return value !== null && (THEME_MODES as readonly string[]).includes(value);
}

// Persisted with expo-secure-store — the project's existing on-device store (the local ledger key
// lives there too; see nativeLocalSecurity). Appearance is a non-secret preference, so a failed read
// or write is non-fatal: we simply fall back to the in-memory default ('system').
async function loadPersistedMode(): Promise<ThemeMode> {
  try {
    const stored = await SecureStore.getItemAsync(THEME_MODE_KEY);
    return isThemeMode(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

async function persistMode(mode: ThemeMode): Promise<void> {
  try {
    await SecureStore.setItemAsync(THEME_MODE_KEY, mode);
  } catch {
    // Non-fatal: the choice still applies for this session; it just won't survive a relaunch.
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type ThemeContextValue = Readonly<{
  palette: Palette;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
}>;

// Default context = the dark palette + 'system'. A component used outside the provider still renders
// rather than throwing. In practice ThemeProvider wraps the whole app, so this default is only a
// safety net for isolated component tests; the provider's `light` prop carries the real light values.
const ThemeContext = createContext<ThemeContextValue>({
  palette: paperDark,
  mode: 'system',
  setMode: () => undefined,
  isDark: true,
});

function resolvePalette(
  mode: ThemeMode,
  systemIsDark: boolean,
  light: Palette,
  dark: Palette,
): Palette {
  if (mode === 'dark') return dark;
  if (mode === 'light') return light;
  return systemIsDark ? dark : light;
}

/** Wraps the app and resolves the active palette from the chosen mode + the OS colour scheme.
 *  Default mode is 'system'. Persists the chosen mode across launches via expo-secure-store.
 *
 *  `light` is injected (kit.tsx passes its canonical `paper`) so the literal LIGHT palette can live
 *  in kit.tsx — where the surface tests grep its exact hex values — without an import cycle. `dark`
 *  defaults to `paperDark` but is overridable for tests. */
export function ThemeProvider({
  children,
  light,
  dark = paperDark,
}: {
  children: ReactNode;
  light: Palette;
  dark?: Palette;
}) {
  const systemScheme = useColorScheme();
  const systemIsDark = systemScheme === 'dark';
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Hydrate the persisted choice once on mount. Until it resolves we render in the default ('system'),
  // which already tracks the OS — so there is no light/dark flash for a user who never changed it.
  useEffect(() => {
    let active = true;
    void loadPersistedMode().then((stored) => {
      if (active) setModeState(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void persistMode(next);
  }, []);

  const palette = useMemo(
    () => resolvePalette(mode, systemIsDark, light, dark),
    [mode, systemIsDark, light, dark],
  );

  // The resolved palette IS the dark one — by reference, so this is exact regardless of mode.
  const isDark = palette === dark;

  const value = useMemo<ThemeContextValue>(
    () => ({ palette, mode, setMode, isDark }),
    [palette, mode, setMode, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active palette (light or dark). Use at render time; pair with a `makeStyles(t)` factory. */
export function useTheme(): Palette {
  return useContext(ThemeContext).palette;
}

/** The current Appearance mode and a setter. Drives the System / Light / Dark selector. */
export function useThemeMode(): { mode: ThemeMode; setMode: (mode: ThemeMode) => void } {
  const { mode, setMode } = useContext(ThemeContext);
  return { mode, setMode };
}

/** Whether the active palette is the dark one. Use for status-bar style, image variants, etc. —
 *  anything outside a StyleSheet that must follow the resolved theme, including a forced mode. */
export function useIsDark(): boolean {
  return useContext(ThemeContext).isDark;
}
