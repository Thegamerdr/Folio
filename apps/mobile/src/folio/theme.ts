// Folio theme re-export module — the single design-system entry point for the faithful folio screens.
//
// This module RE-EXPORTS (never reimplements) the pressure-map kit so every folio screen imports its
// design system from one place. The real implementations live in
// `@/surfaces/pressureMap` (kit.tsx, kitTheme.tsx, secondaryKit.tsx, Sheet.tsx, useCountUp.ts,
// MoneyPath.tsx). Nothing new is defined here — no colour, font, spacing, radius, or shadow token, no
// component, no dependency. If a symbol is needed that does not exist in the kit, add it to the kit,
// not here.
//
// Every name below was confirmed against the source files before re-export.

// ---------------------------------------------------------------------------
// Theme: palettes, provider, hooks, and the Palette / mode types
// ---------------------------------------------------------------------------
export {
  paper,
  paperDark,
  ThemeProvider,
  useTheme,
  useThemeMode,
  useIsDark,
} from '@/surfaces/pressureMap/kit';
export type { Palette, ThemeMode } from '@/surfaces/pressureMap/kit';

// ---------------------------------------------------------------------------
// Serif font constants (the Editorial Ledger display faces)
// ---------------------------------------------------------------------------
export { serif } from '@/surfaces/pressureMap/kit';

// ---------------------------------------------------------------------------
// Rhythm + surface tokens: spacing scale, corner radii, pressed-state, elevation
// ---------------------------------------------------------------------------
export { gap, radius, pressed, elevation } from '@/surfaces/pressureMap/kit';

// ---------------------------------------------------------------------------
// Money formatters (canonical — no formatting drift)
// ---------------------------------------------------------------------------
export { money, magnitude, poundsLabel } from '@/surfaces/pressureMap/kit';

// ---------------------------------------------------------------------------
// Type primitives
// ---------------------------------------------------------------------------
export {
  Eyebrow,
  Display,
  Headline,
  Verdict,
  HeroMoney,
  Body,
  Muted,
} from '@/surfaces/pressureMap/kit';
export type { VerdictTone } from '@/surfaces/pressureMap/kit';

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------
export { PressureScreen, Surface, Hairline } from '@/surfaces/pressureMap/kit';

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
export {
  PrimaryAction,
  GhostButton,
  QuietLink,
  ChipToggle,
  MoneyPad,
} from '@/surfaces/pressureMap/kit';

// ---------------------------------------------------------------------------
// Glyphs
// ---------------------------------------------------------------------------
export { ChevronRight, CheckGlyph } from '@/surfaces/pressureMap/kit';

// ---------------------------------------------------------------------------
// Bottom navigation
// ---------------------------------------------------------------------------
export { BottomNav } from '@/surfaces/pressureMap/kit';

// ---------------------------------------------------------------------------
// Bottom-sheet primitive (./Sheet)
// ---------------------------------------------------------------------------
export { Sheet } from '@/surfaces/pressureMap/Sheet';

// ---------------------------------------------------------------------------
// Count-up tween hook
// ---------------------------------------------------------------------------
export { useCountUp } from '@/surfaces/pressureMap/useCountUp';

// ---------------------------------------------------------------------------
// The signature money path (the brand object)
// ---------------------------------------------------------------------------
export { MoneyPath } from '@/surfaces/pressureMap/MoneyPath';

// ---------------------------------------------------------------------------
// Melo line primitive (the quiet companion line, from secondaryKit)
// ---------------------------------------------------------------------------
export { MeloLine } from '@/surfaces/pressureMap/secondaryKit';
