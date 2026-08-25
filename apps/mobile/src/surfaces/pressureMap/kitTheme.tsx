// Dark-mode theme infrastructure for the pressure-map surface (kitTheme).
//
// This module owns the DARK palette + the runtime theme resolution. kit.tsx re-exports everything
// here, so consumers keep importing from './kit' as before — the theme API is simply discoverable in
// this file. (It lives next to kit.tsx as `kitTheme.tsx` rather than `kit/theme.tsx` to avoid the
// file-vs-directory ambiguity that a `kit/` folder beside `kit.tsx` would create for `./kit`.)
//
// THE CONTRACT (read before adding a colour):
//   • `paper`     — the canonical LIGHT palette. Lives in kit.tsx as a literal. Tests grep its exact
//                   hexes (e.g. `calm: '#9E3C18'`), so it MUST stay there, byte-stable. kit.tsx
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
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import {
  getParityHarnessConfig,
  getParityRuntimeControl,
  startParityRuntimeControl,
  subscribeParityRuntimeControl,
} from '@/folio/parity/parityHarness';

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
//   • `inverse` becomes the dark canvas, since it is used as the on-accent label/glyph colour AND in
//     a couple of places as a "knockout" fill — on dark, the knockout is the canvas itself.
// Contrast notes below each derived key reference the active warm-dark surface and canvas.
export const paperDark: Palette = {
  canvas: '#14100D', // web --background.dark — the warm-black paper ground
  surface: '#211B17', // web --surface.dark — raised surface (cards, sheets)
  surfaceRaised: '#211B17', // same as surface (kept for the one place the light kit raised it)
  // A well DEEPER than the surface — insets sit IN the paper. Darker than canvas so a sunken field
  // (keypad rest, skeleton) reads as a recess, not a raised card.
  sunken: '#18130F',
  inset: '#2A231D', // web --inset.dark — near-canvas well (chips, icon tiles, day cells, Melo panels)
  ink: '#F4EDDF', // web --foreground.dark — warm near-white ink (~13.5:1 on surface)
  // Warm secondary ink — one step down from `ink`, still AA for body text on surface (~9:1).
  secondary: '#D0C5B5',
  muted: '#A69B8A', // web --muted-foreground.dark — clears AA (~4.8:1 on surface, ~5.4:1 on canvas)
  // The single terracotta accent (action / brand accent word / tight point).
  calm: '#EE754C', // web --accent.dark — brighter terracotta, reads as accent on dark (~5.6:1 on surface)
  // Deeper-on-light became LIGHTER-on-dark: the primary-button fill + eyebrow text need a terracotta
  // that carries a near-white label AND reads as 13px eyebrow text on the dark ground. A bright warm
  // terracotta does both (white label on calmStrong ~4.7:1; calmStrong text on surface ~6.2:1).
  calmStrong: '#EE754C',
  calmSoft: '#3E2418', // web --accent-soft.dark — a deep terracotta wash for chips / success wells
  // "You make it to payday" — the calm green verdict + money-in.
  positive: '#7ABB93', // web --positive.dark — calm green that reads on dark (~6.4:1 on surface)
  positiveSoft: '#1E2C22', // deep green wash well (paired with positiveInk text)
  positiveInk: '#7ABB93', // AA-strength green for TEXT on the dark surfaces (~7.6:1 on surface)
  // Caution gold. Web specifies `caution` (#E6BB6A) for DATA marks; `warm` is the TEXT-grade variant.
  warm: '#E6C27A', // gold TEXT that clears AA on dark (~9:1 on surface) — pairs with warmInk wells
  caution: '#E6BB6A', // web --caution.dark — DATA fills/marks only (rings, dots, bars), not text
  warmSoft: '#2E2515', // deep gold wash well
  warmInk: '#E6C27A', // gold text on the dark warm well — light tint so it reads (≈ warm)
  // Shortfall / material change (coral).
  repair: '#E9806C', // web --negative.dark — coral that reads on dark (~5.5:1 on surface)
  repairSoft: '#321C18', // deep coral wash well
  repairInk: '#E9806C', // AA-strength coral for TEXT on the dark surfaces (~6.8:1 on surface)
  // The warm hairline — the primary depth mechanism. On dark it is a faint LIGHTENING of the ground.
  hairline: '#3A3128', // web --border.dark
  hairlineStrong: '#514438', // a stronger divider (ghost-button border, list rules)
  payday: '#7ABB93', // route end-cap — calm green (matches positive on dark)
  // The route's soft drop on light was a warm cream; on dark a soft lift reads as a faint warm glow
  // just above the canvas.
  routeShadow: '#332920',
  // On light, `inverse` is white — used as the on-accent label/glyph colour and as a knockout fill.
  // On dark, the on-accent label still needs to be light (terracotta buttons stay dark-text-unsafe),
  // so inverse stays a near-white for legible labels on the accent fill (~4.7:1 on calmStrong).
  inverse: '#14100D',
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
  const captureMode = getParityHarnessConfig()?.theme;
  const runtimeControl = useSyncExternalStore(
    subscribeParityRuntimeControl,
    getParityRuntimeControl,
    getParityRuntimeControl,
  );
  const [mode, setModeState] = useState<ThemeMode>(captureMode ?? 'system');

  useEffect(() => startParityRuntimeControl(), []);

  useEffect(() => {
    if (captureMode === undefined || runtimeControl === null) return;
    setModeState(runtimeControl.theme);
  }, [captureMode, runtimeControl]);

  // Hydrate the persisted choice once on mount. Until it resolves we render in the default ('system'),
  // which already tracks the OS — so there is no light/dark flash for a user who never changed it.
  useEffect(() => {
    if (captureMode !== undefined) return undefined;
    let active = true;
    void loadPersistedMode().then((stored) => {
      if (active) setModeState(stored);
    });
    return () => {
      active = false;
    };
  }, [captureMode]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      if (captureMode !== undefined) return;
      setModeState(next);
      void persistMode(next);
    },
    [captureMode],
  );

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
