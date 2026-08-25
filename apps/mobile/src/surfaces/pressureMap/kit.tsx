// Pressure-map design kit.
//
// This is the foundation of Folio's new core-slice direction: a premium, calm,
// "soft paper precision" money-pressure map — NOT a finance dashboard. Everything
// here mirrors the canonical folioTokens (same hex values, same spacing) but is
// composed for a doorway / map experience instead of a card wall.
//
// Nothing in this file talks to the engine. These are pure presentation primitives
// the new screens compose. Money values are formatted through this kit's own
// formatMinorAmount (./money.ts) so there is no dependency on the legacy local/ ledger stack.
//
// ===========================================================================
// DARK-MODE PATTERN (the reference every surface sweep follows)
// ===========================================================================
// Colours come from the ACTIVE palette at render time, never from `paper` directly. `paper` (light)
// and `paperDark` are the same shape (`Palette`); `useTheme()` returns whichever is active.
//
//   // inside a component:
//   const t = useTheme();
//   const s = useMemo(() => makeStyles(t), [t]);
//   return <View style={s.card} />;
//
//   // module-level factory — ONLY colours live here:
//   function makeStyles(t: Palette) {
//     return StyleSheet.create({
//       card: { backgroundColor: t.surface, borderColor: t.hairline, ...elevation.card },
//     });
//   }
//
// Rules:
//   • Layout-only styles (gap, padding, flex, fontWeight, fontSize, radius) stay module-level static
//     — they don't change with the theme, so memoising them per-render is pure waste.
//   • Only COLOUR-bearing styles move into makeStyles(t).
//   • SVG glyph colours that must follow the theme take the palette (or a colour) as a prop — an SVG
//     fill/stroke can't read a StyleSheet, so the caller passes `t.muted` etc.
//   • Static shadow OBJECTS (elevation.*) stay as-is; they read fine on both grounds (warm near-black
//     shadow on cream, faint lift on warm-black). Only swap a shadowColor into makeStyles if a
//     surface visibly needs it.
//
// The 32 consumer surfaces are converted in a later per-surface sweep; this file is the worked
// example + the API (useTheme / useThemeMode / ThemeProvider / Palette / paperDark) they build on.
// ===========================================================================

import { useCallback, useMemo, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { folioTokens } from '@folio/ui';

import type { ProductScreen } from './productScreen';
import {
  ThemeProvider as ThemeProviderBase,
  paperDark,
  useIsDark,
  useTheme,
  useThemeMode,
  type Palette,
  type ThemeMode,
} from './kitTheme';
import { formatMinorAmount } from './money';

// ---------------------------------------------------------------------------
// Palette + rhythm (mirrors folioTokens; named for the map direction)
// ---------------------------------------------------------------------------

// Quiet Paper Luxury — warm paper ground, editorial type, ONE terracotta accent for action.
// The accepted Lovable visual target. The accent (terracotta) carries every primary action and
// the tight-point on the path; a separate calm green carries the "you make it to payday" verdict;
// gold is caution, coral is shortfall. Near-flat: the paper IS the depth (hairlines + a soft lift,
// not heavy cards). Numerals stay grotesque tabular; the editorial character comes from the
// Fraunces serif display + a single accent word.
export const paper = {
  canvas: '#EFEBE1', // warm paper ground (web --paper)
  surface: '#FBF9F2', // raised surface (cards, sheets) (web --surface)
  surfaceRaised: '#FBF9F2',
  sunken: '#E7E2D5', // deeper inset well (inputs, skeletons, keypad rest) (web --inset)
  inset: '#E7E2D5', // near-white well (web --inset) — chips, icon tiles, Melo panels, day cells
  ink: '#1A1714', // near-black warm ink
  secondary: '#3D3933', // warm secondary
  muted: '#5F5A50', // warm muted ink — clears WCAG AA (>=4.5:1) on paper + surface
  // The single terracotta accent (action / brand accent word / tight-point on the path).
  calm: '#9E3C18', // accent (web --accent)
  calmStrong: '#85320F', // deeper terracotta — clears WCAG AA both as 13px eyebrow text on paper
  //                        and as the primary-button fill under a white label (~5:1 each way) (web --accent-deep)
  calmSoft: '#F1DECF', // accent-soft (chips, melo-soft, success wells) (web --accent-soft)
  // "You make it to payday" — the calm green verdict + money-in.
  positive: '#2C7345',
  positiveSoft: '#DDEBE0',
  positiveInk: '#2C7345', // AA-strength green for text on paper
  warm: '#C98A2E', // caution gold for TEXT (clears AA); pairs with warmInk
  caution: '#C99334', // web --caution gold — DATA fills/marks only (rings, dots, bars), not text
  warmSoft: '#F3E6CC',
  warmInk: '#7A5A18',
  repair: '#A83C2C', // shortfall / material change (coral, data only) (web --negative)
  repairSoft: '#F4DDD7',
  repairInk: '#A83C2C',
  hairline: '#E1DBCB', // warm hairline — the primary depth mechanism (web --hairline)
  hairlineStrong: '#D0C7B4',
  payday: '#2C7345', // route end-cap (calm green — you reach payday)
  routeShadow: '#D8D0BE',
  inverse: '#FFFFFF',
} as const;

// Theme API (defined in kitTheme.tsx) is re-exported from the kit so surfaces keep a single import
// source: `import { useTheme, paper, paperDark, ... } from './kit'`.
export { paperDark, useIsDark, useTheme, useThemeMode };
export type { Palette, ThemeMode };

// `paper` is the canonical LIGHT palette. It is injected into the provider here (rather than imported
// by kitTheme.tsx) so its literal hexes stay in this file — where the surface tests grep them — with
// no kit↔kitTheme import cycle. The app mounts <ThemeProvider> once at the root (app/_layout.tsx).
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeProviderBase light={paper}>{children}</ThemeProviderBase>;
}

// Editorial Ledger display type — Fraunces (bundled via @expo-google-fonts/fraunces, loaded in
// app/_layout). Headlines/verdicts are serif; ONE italic accent word per headline. Numerals and
// UI labels stay in the system grotesque with tabular figures (money always reads as money).
export const serif = {
  display: 'Fraunces_400Regular',
  displayItalic: 'Fraunces_400Regular_Italic',
  medium: 'Fraunces_500Medium',
  regular: 'Fraunces_400Regular',
} as const;

// Body/UI sans — Inter Tight, matching the web's `--font-sans` ("Inter Tight", "Inter", ui-sans-serif,
// system-ui). The upstream family ships variable-only; it's vendored as both the original variable
// TTF (kept for back-compat under the bare 'InterTight' family — see app/_layout's useFonts) AND as
// four static per-weight instances (fontTools varLib.instancer, wght 400/500/600/700). Android does
// NOT resolve the `wght` variation axis from RN's `fontWeight` style prop on a variable font — every
// weight silently renders at the font's default instance (regular). Static families are the only
// reliable cross-platform fix, so `weightFamily()` below is the canonical way to pair InterTight with
// a weight: pass it the intended numeric weight and drop `fontWeight` from the style — the static
// family already bakes the weight in. Call sites that still need `fontWeight` for non-InterTight text
// (default system font, which resolves `wght` fine on both platforms) are unaffected.
export const sans = {
  family: 'InterTight',
} as const;

/** Maps a nominal font weight to the matching static InterTight family registered in app/_layout.
 *  Use in place of `fontFamily: sans.family` + `fontWeight` — the returned family already bakes the
 *  weight in, so drop any `fontWeight` on the same style once you switch to this. Any weight below
 *  500 falls back to the regular static instance (no separate light/thin instance is vendored). */
export function weightFamily(
  weight: 400 | 500 | 600 | 700 | '400' | '500' | '600' | '700',
): string {
  switch (Number(weight)) {
    case 700:
      return 'InterTightBold';
    case 600:
      return 'InterTightSemiBold';
    case 500:
      return 'InterTightMedium';
    default:
      return 'InterTightRegular';
  }
}

export const gap = folioTokens.spacing.scale;

// Corner radii — mirrors the web scale. Web rounds cards/sheets to 2xl (24–32) and CTAs to 2xl (24);
// pills stay fully round. Apply these instead of hard-coded radii as screens are ported to parity.
export const radius = { sm: 8, md: 12, lg: 18, xl: 24, xxl: 32, pill: 999 } as const;

export const pressed = {
  opacity: folioTokens.interaction.state.pressed.opacity,
  transform: [{ scale: folioTokens.interaction.state.pressed.scale }],
} as const;

// ---------------------------------------------------------------------------
// Elevation — soft, large-radius, low-opacity light-ground depth
// ---------------------------------------------------------------------------

// Premium light-ground fintech doesn't stack heavy borders; it floats surfaces on a
// warm shadow. Two intentional levels only:
//  • card — a barely-there lift so a surface reads as paper resting on the cream, never
//    as a hard Material card. Warm near-black so the shadow stays in the same family as
//    the ink (a cool/gray drop shadow would fight the cream).
//  • cta — the one lifted, directional primary action. A soft TERRACOTTA-tinted shadow (not
//    gray) ties the lift to the accent so the button reads as the dominant next step.
// These are RN shadow objects: shadowColor/Offset/Opacity/Radius drive iOS, `elevation`
// drives Android (a small, restrained value — Android elevation reads heavier than iOS
// shadow, so it's deliberately low).
export const elevation = {
  card: {
    shadowColor: '#2A2018', // warm near-black, same family as the ink
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  cta: {
    shadowColor: '#8A3A1E', // deep terracotta — the lift belongs to the accent, not gray
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  // The bottom-sheet family — a soft UPWARD shadow (web --shadow-sheet: 0 -8px 40px -12px ink/18),
  // so a sheet reads as lifting off the paper from below. Used by the shared Sheet primitive.
  sheet: {
    shadowColor: '#2A2018',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 12,
  },
} as const;

// ---------------------------------------------------------------------------
// Money formatting (canonical — no drift)
// ---------------------------------------------------------------------------

/** Signed amount, e.g. "-£42" / "£1,200". */
export function money(minor: number): string {
  return formatMinorAmount(minor);
}

/** Unsigned magnitude, e.g. "£42". */
export function magnitude(minor: number): string {
  return formatMinorAmount(Math.abs(minor));
}

/** Whole-pound display for the keypad, e.g. "£0" / "£1,200". */
export function poundsLabel(wholePounds: string): string {
  const digits = wholePounds.replace(/[^0-9]/g, '');
  const value = digits.length === 0 ? 0 : Number(digits);
  return formatMinorAmount(value * 100);
}

// ---------------------------------------------------------------------------
// Type primitives
// ---------------------------------------------------------------------------

export function Eyebrow({
  children,
  tone,
}: {
  children: ReactNode;
  // 'muted' = a quiet ink eyebrow for screens where the accent belongs elsewhere (e.g. Today, where
  // the path's low point is the only saturated terracotta moment).
  tone?: 'calm' | 'warm' | 'muted' | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Text
      style={[
        s.eyebrow,
        tone === 'warm' ? s.eyebrowWarm : undefined,
        tone === 'muted' ? s.eyebrowMuted : undefined,
      ]}
    >
      {children}
    </Text>
  );
}

export function Display({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle> | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Text accessibilityRole="header" style={[s.display, style]}>
      {children}
    </Text>
  );
}

/** An editorial serif headline carrying exactly ONE italic accent word — the Editorial Ledger
 *  signature. e.g. <Headline lead="You'll " accent="make it" tail=" to payday." /> */
export function Headline({
  lead,
  accent,
  tail,
  accentTone,
  style,
}: {
  lead?: string | undefined;
  accent: string;
  tail?: string | undefined;
  accentTone?: VerdictTone | undefined;
  style?: StyleProp<TextStyle> | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  // Undefined tone = the brand accent word (terracotta) — Start, Privacy, etc. A verdict tone
  // colours the accent to its meaning: green when you make it, gold when tight, coral when short.
  const accentColor =
    accentTone === 'repair'
      ? t.repairInk
      : accentTone === 'warm'
        ? t.warmInk
        : accentTone === 'positive'
          ? t.positiveInk
          : t.calm;
  return (
    <Text accessibilityRole="header" style={[s.headline, style]}>
      {lead}
      <Text style={[s.headlineAccent, { color: accentColor }]}>{accent}</Text>
      {tail}
    </Text>
  );
}

export function Verdict({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: VerdictTone | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Text accessibilityRole="header" style={[s.verdict, verdictColor(t, tone)]}>
      {children}
    </Text>
  );
}

// 'positive' = you make it (calm green) · 'warm' = holds but tight (gold) · 'repair' = runs short
// (coral). An undefined tone is neutral ink (e.g. the "here's where you stand" empty state).
export type VerdictTone = 'positive' | 'warm' | 'repair';

function verdictColor(t: Palette, tone: VerdictTone | undefined): TextStyle {
  if (tone === 'repair') return { color: t.repairInk };
  if (tone === 'warm') return { color: t.warmInk };
  if (tone === 'positive') return { color: t.positiveInk };
  return { color: t.ink };
}

export function HeroMoney({
  children,
  tone,
  accessibilityLabel,
}: {
  children: ReactNode;
  tone?: VerdictTone | undefined;
  accessibilityLabel?: string | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Text accessibilityLabel={accessibilityLabel} style={[s.heroMoney, verdictColor(t, tone)]}>
      {children}
    </Text>
  );
}

export function Body({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle> | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return <Text style={[s.body, style]}>{children}</Text>;
}

export function Muted({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle> | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return <Text style={[s.muted, style]}>{children}</Text>;
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

/** A calm full-height column on warm paper. Leaves room for the bottom nav. */
export function PressureScreen({
  children,
  centered,
  style,
}: {
  children: ReactNode;
  centered?: boolean | undefined;
  style?: StyleProp<ViewStyle> | undefined;
}) {
  // Screens size to content and scroll inside the container ScrollView — no magic
  // min-height tuned to one device. Only a `centered` screen needs a height to
  // center within; derive that from the real viewport (a generous fraction of the
  // window) so it adapts to any phone and never clips OS-scaled text.
  const { height } = useWindowDimensions();
  // Layout-only: the screen column carries no colour (the canvas is painted by the router root), so
  // it stays on the static `layout` styles — no useTheme needed.
  const centeredMinHeight = centered ? { minHeight: Math.round(height * 0.7) } : undefined;
  return (
    <View
      style={[
        layout.screen,
        centered ? layout.screenCentered : undefined,
        centeredMinHeight,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Surface({
  children,
  style,
  tone,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle> | undefined;
  tone?: 'plain' | 'sunken' | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={[s.surface, tone === 'sunken' ? s.surfaceSunken : undefined, style]}>
      {children}
    </View>
  );
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> | undefined }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return <View style={[s.hairline, style]} />;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function PrimaryAction({
  label,
  caption,
  onPress,
  tone,
  accessibilityHint,
  disabled,
}: {
  label: string;
  caption?: string | undefined;
  onPress: () => void;
  tone?: 'calm' | 'ink' | undefined;
  accessibilityHint?: string | undefined;
  disabled?: boolean | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        s.primary,
        tone === 'ink' ? s.primaryInk : undefined,
        disabled ? s.primaryDisabled : undefined,
        isPressed && !disabled ? pressed : undefined,
      ]}
    >
      {/* Label is centered in the button; the arrow is pinned to the right edge so the
          CTA reads directional ("go") without shoving the label off-center. */}
      <View style={layout.primaryRow}>
        <Text style={[s.primaryLabel, tone === 'ink' ? s.primaryLabelInk : undefined]}>
          {label}
        </Text>
        <View style={layout.primaryArrow} pointerEvents="none">
          <ChevronRight color={disabled ? t.muted : t.inverse} />
        </View>
      </View>
      {caption ? <Text style={s.primaryCaption}>{caption}</Text> : null}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  accessibilityHint,
  tone,
  flex,
}: {
  label: string;
  onPress: () => void;
  accessibilityHint?: string | undefined;
  tone?: 'plain' | 'repair' | undefined;
  flex?: boolean | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        s.ghost,
        flex ? layout.flex : undefined,
        isPressed ? pressed : undefined,
      ]}
    >
      <Text style={[s.ghostLabel, tone === 'repair' ? s.ghostLabelRepair : undefined]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A quiet, low-contrast secondary path — never competes with the dominant action. */
export function QuietLink({
  label,
  onPress,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  accessibilityHint?: string | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
      style={({ pressed: isPressed }) => [layout.quietLink, isPressed ? pressed : undefined]}
    >
      <Text style={s.quietLinkLabel}>{label}</Text>
      <ChevronRight />
    </Pressable>
  );
}

export function ChipToggle({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        s.chip,
        selected ? s.chipSelected : undefined,
        isPressed ? pressed : undefined,
      ]}
    >
      <Text style={[s.chipLabel, selected ? s.chipLabelSelected : undefined]}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Money keypad — a calm, app-grade numeric pad (no system keyboard). Premium for a
// money app, and fully tappable so the rough-first-answer flow is deterministic.
// ---------------------------------------------------------------------------

const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

export function MoneyPad({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const handleKey = useCallback(
    (key: (typeof PAD_KEYS)[number]) => {
      if (key === 'back') {
        onChange(value.slice(0, -1));
        return;
      }
      if (key === 'clear') {
        onChange('');
        return;
      }
      const next = `${value}${key}`.replace(/^0+(?=\d)/, '');
      if (next.replace(/[^0-9]/g, '').length > 7) return; // cap at £9,999,999 rough
      onChange(next);
    },
    [onChange, value],
  );

  return (
    <View accessibilityLabel="Number pad" style={layout.pad}>
      {PAD_KEYS.map((key) => (
        <Pressable
          accessibilityHint={
            key === 'back'
              ? 'Removes the last digit.'
              : key === 'clear'
                ? 'Clears the amount.'
                : undefined
          }
          accessibilityLabel={
            key === 'back' ? 'Delete' : key === 'clear' ? 'Clear' : `Digit ${key}`
          }
          accessibilityRole="button"
          key={key}
          onPress={() => handleKey(key)}
          style={({ pressed: isPressed }) => [layout.padKey, isPressed ? pressed : undefined]}
        >
          {key === 'back' ? (
            <BackspaceGlyph color={t.secondary} />
          ) : (
            <Text style={[s.padKeyText, key === 'clear' ? s.padKeyClear : undefined]}>
              {key === 'clear' ? 'Clear' : key}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Small glyphs
// ---------------------------------------------------------------------------

// SVG glyphs can't read a StyleSheet, so theme-following colours arrive as props. Each glyph reads the
// active palette for its DEFAULT colour; an explicit `color` prop still wins (e.g. the on-accent
// chevron PrimaryAction passes, or a green check on another surface passes).
export function ChevronRight({ color }: { color?: string | undefined }) {
  const t = useTheme();
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M9 6l6 6-6 6"
        stroke={color ?? t.muted}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function BackspaceGlyph({ color }: { color?: string | undefined }) {
  const t = useTheme();
  const stroke = color ?? t.secondary;
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Path
        d="M9 5h11a1 1 0 011 1v12a1 1 0 01-1 1H9l-6-7 6-7z"
        stroke={stroke}
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M12 10l4 4M16 10l-4 4" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

export function CheckGlyph({
  color,
  size = 22,
}: {
  color?: string | undefined;
  size?: number | undefined;
}) {
  const t = useTheme();
  const stroke = color ?? t.calm;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 13l4 4 10-11"
        stroke={stroke}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Bottom nav — canonical personal tabs (Today / Plan / Review / More).
//
// Faithful to the pinned web nav model: Today is home, Plan holds the forward route,
// Review is the inbox, and Melo lives under More. Start is NOT a tab — it is the fresh-ledger doorway
// reached before onboarding, so the container shows it without the nav.
// ---------------------------------------------------------------------------

type NavTab = { id: ProductScreen; label: string };

const NAV_HEIGHT = 68;

const NAV_TABS: readonly NavTab[] = [
  { id: 'today', label: 'Today' },
  { id: 'plans', label: 'Plan' },
  { id: 'import', label: 'Review' },
  { id: 'more', label: 'More' },
];

function NavIcon({ id, active, t }: { id: ProductScreen; active: boolean; t: Palette }) {
  const stroke = active ? t.calmStrong : t.muted;
  if (id === 'today') {
    // Lucide CircleDot — exact pinned-source geometry.
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="10" stroke={stroke} strokeWidth={1.6} fill="none" />
        <Circle cx="12" cy="12" r="1" stroke={stroke} strokeWidth={1.6} fill="none" />
      </Svg>
    );
  }
  if (id === 'plans') {
    // Lucide CalendarRange — exact pinned-source geometry.
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Rect
          x="3"
          y="4"
          width="18"
          height="18"
          rx="2"
          stroke={stroke}
          strokeWidth={1.6}
          fill="none"
        />
        <Path
          d="M16 2v4M3 10h18M8 2v4M17 14h-6M13 18H7M7 14h.01M17 18h.01"
          stroke={stroke}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    );
  }
  if (id === 'import') {
    // Lucide Inbox — exact pinned-source geometry.
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path
          d="M22 12h-6l-2 3h-4l-2-3H2"
          stroke={stroke}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
          stroke={stroke}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    );
  }
  // Lucide MoreHorizontal — exact pinned-source geometry.
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="1" stroke={stroke} strokeWidth={1.6} fill="none" />
      <Circle cx="19" cy="12" r="1" stroke={stroke} strokeWidth={1.6} fill="none" />
      <Circle cx="5" cy="12" r="1" stroke={stroke} strokeWidth={1.6} fill="none" />
    </Svg>
  );
}

export function BottomNav({
  active,
  onChange,
  reviewCount = 0,
}: {
  active: ProductScreen;
  onChange: (screen: ProductScreen) => void;
  reviewCount?: number;
}) {
  // Expo's edge-to-edge Android window includes the system navigation area. Preserve the pinned
  // 68dp product tab band above that area, then extend only its background through the reported
  // bottom inset. Without the added height, three-button navigation covers the tab labels on S9.
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const systemBottomInset = Math.max(0, insets.bottom);
  const navPaddingBottom = systemBottomInset > 0 ? systemBottomInset : 6;

  return (
    // Fabric can retain only the two tab children whose `selected` prop changed when the screen
    // beneath this persistent sibling is replaced. On-device that left the previous + current tab
    // visible and made the other two look removed even though their hit targets still existed.
    // Remount the four-item strip when the active tab changes so every icon and label is painted.
    // Keeping these views non-collapsible also stops Fabric's layout-only optimisation from dropping
    // unchanged siblings when a screen or a native sheet beneath this strip is replaced.
    <View
      collapsable={false}
      key={`bottom-nav-${active}`}
      style={[
        s.nav,
        { height: NAV_HEIGHT + systemBottomInset, paddingBottom: navPaddingBottom },
      ]}
    >
      {NAV_TABS.map((tab) => {
        const selected = active === tab.id;
        return (
          <Pressable
            accessibilityHint={`Switches to ${tab.label}.`}
            accessibilityLabel={`${tab.label} tab`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            collapsable={false}
            key={`${tab.id}-${active}`}
            onPress={() => onChange(tab.id)}
            style={({ pressed: isPressed }) => [layout.navItem, isPressed ? pressed : undefined]}
          >
            <View collapsable={false} style={layout.navIconWrap}>
              <NavIcon id={tab.id} active={selected} t={t} />
              {tab.id === 'import' && reviewCount > 0 ? (
                <View
                  accessibilityLabel={`${reviewCount} ${reviewCount === 1 ? 'item' : 'items'} waiting for review`}
                  style={s.navBadge}
                >
                  <Text style={s.navBadgeLabel}>{reviewCount > 9 ? '9+' : reviewCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[s.navLabel, selected ? s.navLabelActive : undefined]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
//
// Two layers, per the DARK-MODE PATTERN at the top of the file:
//   • `layout`       — module-level static. NO colour. Spacing, flex, font metrics, radii. These
//                      never change with the theme, so they are created once.
//   • `makeStyles(t)`— a factory of the COLOUR-bearing styles, rebuilt per component via
//                      useMemo(() => makeStyles(t), [t]) so a theme change repaints them.
// A few styles carry both layout AND colour; those live in makeStyles (the layout half just rides
// along — cheap, and keeps a single source for that element's full style).

// Colour-free styles — safe to share across light and dark.
const layout = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    // No flex:1 here. These screens live inside the container ScrollView (unbounded
    // height); a flex:1 child can collapse its measured bounds, and RN clips touches
    // to a parent's bounds — which silently kills tap targets. Sizing to content keeps
    // every control hittable and lets tall screens scroll naturally.
    gap: gap.xl,
    paddingTop: gap.sm,
    paddingBottom: gap.xxxl,
  },
  screenCentered: { justifyContent: 'center' },
  // The arrow is absolutely pinned to the right edge of the row so the label stays
  // optically centered in the button.
  primaryRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryArrow: { position: 'absolute', right: 0 },
  quietLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  pad: { flexDirection: 'row', flexWrap: 'wrap' },
  padKey: { width: '33.333%', height: 62, alignItems: 'center', justifyContent: 'center' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navIconWrap: { position: 'relative' },
});

// Colour-bearing styles, resolved against the active palette `t`. Rebuilt per-render via the
// useMemo(makeStyles, [t]) pattern.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    surface: {
      backgroundColor: t.surface,
      borderRadius: 20,
      padding: gap.xl,
      // The soft lift replaces the hairline: a plain surface now floats on the cream
      // rather than being outlined on it. (Sunken wells stay flat below — they're insets,
      // not raised paper.)
      ...elevation.card,
    },
    surfaceSunken: {
      backgroundColor: t.sunken,
      // Insets sit IN the paper, so no shadow and no border — flat by design.
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },

    hairline: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.hairline,
      width: '100%',
    },

    eyebrow: {
      color: t.calmStrong, // deeper terracotta so the 13px eyebrow clears WCAG AA on paper
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    eyebrowWarm: { color: t.warmInk },
    eyebrowMuted: { color: t.muted },

    display: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 31,
      lineHeight: 37,
      letterSpacing: -0.3,
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 29,
      lineHeight: 36,
      letterSpacing: -0.3,
    },
    headlineAccent: {
      // Match the Lovable source: the accent word is the SAME upright serif as the headline, only
      // recoloured terracotta (Lovable uses `<em className="not-italic text-accent">`). It inherits
      // the parent headline's Fraunces face, so only the colour is overridden — never italic. The
      // component overrides this colour inline per accentTone; this is the default brand accent.
      color: t.calm,
    },
    verdict: {
      fontFamily: serif.display,
      fontSize: 27,
      lineHeight: 33,
      letterSpacing: -0.2,
    },
    heroMoney: {
      fontSize: 52,
      lineHeight: 56,
      fontWeight: '800',
      letterSpacing: -1.6,
      fontVariant: ['tabular-nums'],
    },
    body: {
      color: t.secondary,
      // Static per-weight family (not sans.family + fontWeight) — see weightFamily() above.
      fontFamily: weightFamily(400),
      fontSize: 16,
      lineHeight: 23,
    },
    muted: {
      color: t.muted,
      // Static per-weight family (not sans.family + fontWeight) — see weightFamily() above.
      fontFamily: weightFamily(400),
      fontSize: 14,
      lineHeight: 20,
    },

    primary: {
      backgroundColor: t.calmStrong, // deeper terracotta: white label + caption both clear AA (>=5:1)
      borderRadius: 18,
      paddingVertical: 18,
      paddingHorizontal: gap.xl,
      alignItems: 'center',
      gap: 2,
      // The single lifted, directional CTA — soft terracotta-tinted shadow ties the lift to the
      // accent so it reads as the dominant next step (not a flat fill on the cream).
      ...elevation.cta,
    },
    // Ink-toned CTA keeps the lift but warms the shadow back to the ink family so a black
    // button doesn't carry a terracotta halo.
    primaryInk: { backgroundColor: t.ink, shadowColor: '#2A2018', shadowOpacity: 0.2 },
    primaryDisabled: {
      backgroundColor: t.sunken,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    primaryLabel: {
      color: t.inverse,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    primaryLabelInk: { color: t.inverse },
    primaryCaption: {
      // A soft warm-cream caption that reads on the terracotta fill in BOTH modes (the button fill
      // is terracotta on light and dark alike), so this stays a literal rather than a palette key.
      color: '#F8E7DE',
      fontSize: 13,
      fontWeight: '500',
    },

    ghost: {
      borderRadius: 16,
      paddingVertical: 15,
      paddingHorizontal: gap.lg,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: t.hairlineStrong,
      backgroundColor: t.surface,
    },
    ghostLabel: { color: t.ink, fontSize: 16, fontWeight: '600' },
    ghostLabelRepair: { color: t.repairInk },

    quietLinkLabel: { color: t.secondary, fontSize: 15, fontWeight: '600' },

    chip: {
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: gap.lg,
      borderWidth: 1.5,
      borderColor: t.hairline,
      backgroundColor: t.surface,
    },
    chipSelected: {
      borderColor: t.calm,
      backgroundColor: t.calmSoft,
    },
    chipLabel: { color: t.secondary, fontSize: 15, fontWeight: '600' },
    chipLabelSelected: { color: t.calmStrong },

    padKeyText: {
      color: t.ink,
      fontSize: 27,
      fontWeight: '500',
      fontVariant: ['tabular-nums'],
    },
    padKeyClear: { fontSize: 16, fontWeight: '600', color: t.muted },

    nav: {
      height: NAV_HEIGHT,
      flexDirection: 'row',
      backgroundColor: t.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.hairline,
      paddingTop: 8,
    },
    navLabel: {
      color: t.muted,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    navLabelActive: { color: t.calmStrong },
    navBadge: {
      alignItems: 'center',
      backgroundColor: t.calmStrong,
      borderColor: t.surface,
      borderRadius: radius.pill,
      borderWidth: 2,
      height: 17,
      justifyContent: 'center',
      minWidth: 17,
      paddingHorizontal: 3,
      position: 'absolute',
      right: -8,
      top: -5,
    },
    navBadgeLabel: {
      color: t.inverse,
      fontSize: 9,
      fontWeight: '700',
      lineHeight: 11,
    },
  });
}

// Backward-compat export of the light style set (built from the canonical `paper` palette). No
// in-repo consumer uses this today; kept so any external import of `kitStyles` keeps resolving.
const kitStyles = makeStyles(paper);
export { kitStyles, makeStyles };
