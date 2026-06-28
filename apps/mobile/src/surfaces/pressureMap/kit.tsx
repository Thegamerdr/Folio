// Pressure-map design kit.
//
// This is the foundation of Folio's new core-slice direction: a premium, calm,
// "soft paper precision" money-pressure map — NOT a finance dashboard. Everything
// here mirrors the canonical folioTokens (same hex values, same spacing) but is
// composed for a doorway / map experience instead of a card wall.
//
// Nothing in this file talks to the engine. These are pure presentation primitives
// the new screens compose. Money values are formatted through the canonical
// formatMinorAmount so there is no formatting drift with the rest of the app.

import { useCallback, type ReactNode } from 'react';
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

import { formatMinorAmount } from '../../local/localLedger';
import type { ProductScreen } from '../mobileShell';

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
  canvas: '#F7F6F1', // warm paper ground
  surface: '#FFFFFF', // raised surface (cards, sheets)
  surfaceRaised: '#FFFFFF',
  sunken: '#EFEAE1', // deeper inset well (inputs, skeletons, keypad rest)
  inset: '#FCFBF7', // near-white well (web --inset) — chips, icon tiles, Melo panels, day cells
  ink: '#1A1815', // near-black warm ink
  secondary: '#4A453E', // warm secondary
  muted: '#6B6760', // warm muted ink — clears WCAG AA (>=4.5:1) on paper + surface
  // The single terracotta accent (action / brand accent word / tight-point on the path).
  calm: '#E0633A', // accent
  calmStrong: '#B5471F', // deeper terracotta — clears WCAG AA both as 13px eyebrow text on paper
  //                        and as the primary-button fill under a white label (~5:1 each way)
  calmSoft: '#F5E4DB', // accent-soft (chips, melo-soft, success wells)
  // "You make it to payday" — the calm green verdict + money-in.
  positive: '#3E8E5A',
  positiveSoft: '#DDEBE0',
  positiveInk: '#2F7048', // AA-strength green for text on paper
  warm: '#C98A2E', // caution gold for TEXT (clears AA); pairs with warmInk
  caution: '#D9A441', // web --caution gold — DATA fills/marks only (rings, dots, bars), not text
  warmSoft: '#F3E6CC',
  warmInk: '#7A5A18',
  repair: '#C5503E', // shortfall / material change (coral, data only)
  repairSoft: '#F4DDD7',
  repairInk: '#8A4632',
  hairline: '#ECE9E0', // warm hairline — the primary depth mechanism
  hairlineStrong: '#D8D2C6',
  payday: '#2F7048', // route end-cap (calm green — you reach payday)
  routeShadow: '#E7E2D8',
  inverse: '#FFFFFF',
} as const;

// Editorial Ledger display type — Fraunces (bundled via @expo-google-fonts/fraunces, loaded in
// app/_layout). Headlines/verdicts are serif; ONE italic accent word per headline. Numerals and
// UI labels stay in the system grotesque with tabular figures (money always reads as money).
export const serif = {
  display: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_500Medium_Italic',
  medium: 'Fraunces_500Medium',
  regular: 'Fraunces_400Regular',
} as const;

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
  return (
    <Text
      style={[
        styles.eyebrow,
        tone === 'warm' ? styles.eyebrowWarm : undefined,
        tone === 'muted' ? styles.eyebrowMuted : undefined,
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
  return (
    <Text accessibilityRole="header" style={[styles.display, style]}>
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
  // Undefined tone = the brand accent word (terracotta) — Start, Privacy, etc. A verdict tone
  // colours the accent to its meaning: green when you make it, gold when tight, coral when short.
  const accentColor =
    accentTone === 'repair'
      ? paper.repairInk
      : accentTone === 'warm'
        ? paper.warmInk
        : accentTone === 'positive'
          ? paper.positiveInk
          : paper.calm;
  return (
    <Text accessibilityRole="header" style={[styles.headline, style]}>
      {lead}
      <Text style={[styles.headlineAccent, { color: accentColor }]}>{accent}</Text>
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
  return (
    <Text accessibilityRole="header" style={[styles.verdict, verdictColor(tone)]}>
      {children}
    </Text>
  );
}

// 'positive' = you make it (calm green) · 'warm' = holds but tight (gold) · 'repair' = runs short
// (coral). An undefined tone is neutral ink (e.g. the "here's where you stand" empty state).
export type VerdictTone = 'positive' | 'warm' | 'repair';

function verdictColor(tone: VerdictTone | undefined): TextStyle {
  if (tone === 'repair') return { color: paper.repairInk };
  if (tone === 'warm') return { color: paper.warmInk };
  if (tone === 'positive') return { color: paper.positiveInk };
  return { color: paper.ink };
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
  return (
    <Text accessibilityLabel={accessibilityLabel} style={[styles.heroMoney, verdictColor(tone)]}>
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
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Muted({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle> | undefined;
}) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
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
  const centeredMinHeight = centered ? { minHeight: Math.round(height * 0.7) } : undefined;
  return (
    <View
      style={[
        styles.screen,
        centered ? styles.screenCentered : undefined,
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
  return (
    <View style={[styles.surface, tone === 'sunken' ? styles.surfaceSunken : undefined, style]}>
      {children}
    </View>
  );
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> | undefined }) {
  return <View style={[styles.hairline, style]} />;
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
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.primary,
        tone === 'ink' ? styles.primaryInk : undefined,
        disabled ? styles.primaryDisabled : undefined,
        isPressed && !disabled ? pressed : undefined,
      ]}
    >
      {/* Label is centered in the button; the arrow is pinned to the right edge so the
          CTA reads directional ("go") without shoving the label off-center. */}
      <View style={styles.primaryRow}>
        <Text style={[styles.primaryLabel, tone === 'ink' ? styles.primaryLabelInk : undefined]}>
          {label}
        </Text>
        <View style={styles.primaryArrow} pointerEvents="none">
          <ChevronRight color={disabled ? paper.muted : paper.inverse} />
        </View>
      </View>
      {caption ? <Text style={styles.primaryCaption}>{caption}</Text> : null}
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
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.ghost,
        flex ? styles.flex : undefined,
        isPressed ? pressed : undefined,
      ]}
    >
      <Text style={[styles.ghostLabel, tone === 'repair' ? styles.ghostLabelRepair : undefined]}>
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
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
      style={({ pressed: isPressed }) => [styles.quietLink, isPressed ? pressed : undefined]}
    >
      <Text style={styles.quietLinkLabel}>{label}</Text>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.chip,
        selected ? styles.chipSelected : undefined,
        isPressed ? pressed : undefined,
      ]}
    >
      <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : undefined]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Money keypad — a calm, app-grade numeric pad (no system keyboard). Premium for a
// money app, and fully tappable so the rough-first-answer flow is deterministic.
// ---------------------------------------------------------------------------

const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

export function MoneyPad({ value, onChange }: { value: string; onChange: (next: string) => void }) {
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
    <View accessibilityLabel="Number pad" style={styles.pad}>
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
          style={({ pressed: isPressed }) => [styles.padKey, isPressed ? pressed : undefined]}
        >
          {key === 'back' ? (
            <BackspaceGlyph />
          ) : (
            <Text style={[styles.padKeyText, key === 'clear' ? styles.padKeyClear : undefined]}>
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

export function ChevronRight({ color = paper.muted }: { color?: string | undefined }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M9 6l6 6-6 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function BackspaceGlyph() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Path
        d="M9 5h11a1 1 0 011 1v12a1 1 0 01-1 1H9l-6-7 6-7z"
        stroke={paper.secondary}
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M12 10l4 4M16 10l-4 4"
        stroke={paper.secondary}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function CheckGlyph({
  color = paper.calm,
  size = 22,
}: {
  color?: string | undefined;
  size?: number | undefined;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 13l4 4 10-11"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Bottom nav — premium icons (Today / Review / Melo / More). No "?" glyphs.
//
// Faithful to the web nav model: Today is home, Review is the checklist, Melo is the
// companion, More is the quiet hub. Start is NOT a tab — it is the fresh-ledger doorway
// reached before onboarding, so the container shows it without the nav.
// ---------------------------------------------------------------------------

type NavTab = { id: ProductScreen; label: string };

// One small breathing gap above the system bar — keeps the nav clear of the gesture
// strip / 3-button bar without leaving a fat empty band on either kind of phone.
const NAV_SAFE_GAP = 6;

const NAV_TABS: readonly NavTab[] = [
  { id: 'today', label: 'Today' },
  { id: 'import', label: 'Review' },
  { id: 'melo', label: 'Melo' },
  { id: 'more', label: 'More' },
];

function NavIcon({ id, active }: { id: ProductScreen; active: boolean }) {
  const stroke = active ? paper.calmStrong : paper.muted;
  const fill = active ? paper.calmSoft : 'none';
  if (id === 'start') {
    // A doorway — the product "begin" object.
    return (
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Path
          d="M6 21V5a2 2 0 012-2h8a2 2 0 012 2v16"
          stroke={stroke}
          strokeWidth={1.8}
          fill={fill}
          strokeLinejoin="round"
        />
        <Line
          x1="4"
          y1="21"
          x2="20"
          y2="21"
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <Circle cx="14.5" cy="12.5" r="1.1" fill={stroke} />
      </Svg>
    );
  }
  if (id === 'import') {
    // A checklist — rows to check. Never a question mark.
    return (
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Rect
          x="4"
          y="3.5"
          width="16"
          height="17"
          rx="2.4"
          stroke={stroke}
          strokeWidth={1.8}
          fill={fill}
        />
        <Path
          d="M7.5 9l1.6 1.6L12 7.8"
          stroke={stroke}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Line
          x1="13.5"
          y1="9"
          x2="16.5"
          y2="9"
          stroke={stroke}
          strokeWidth={1.7}
          strokeLinecap="round"
        />
        <Path
          d="M7.5 14.5l1.6 1.6L12 13.3"
          stroke={stroke}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Line
          x1="13.5"
          y1="14.5"
          x2="16.5"
          y2="14.5"
          stroke={stroke}
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  if (id === 'today') {
    // The money path — Folio's brand object, in miniature.
    return (
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Path
          d="M3 8c3 0 3 5 6 5s4-7 7-7 5 8 5 8"
          stroke={stroke}
          strokeWidth={1.9}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle
          cx="13"
          cy="16.7"
          r="2"
          fill={active ? paper.calmStrong : paper.surface}
          stroke={stroke}
          strokeWidth={1.8}
        />
      </Svg>
    );
  }
  if (id === 'melo') {
    // Melo's pebble — the companion mark, a soft rounded figure with a quiet eye, matching
    // the calm MeloFigure silhouette in miniature. Never a speech bubble or a "?".
    return (
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Path
          d="M12 3.5c4.4 0 7.5 3 7.5 7.4 0 5-3.8 9.6-7.5 9.6S4.5 15.9 4.5 10.9C4.5 6.5 7.6 3.5 12 3.5z"
          stroke={stroke}
          strokeWidth={1.8}
          fill={fill}
          strokeLinejoin="round"
        />
        <Circle cx="12" cy="10.5" r="1.5" fill={active ? paper.calmStrong : stroke} />
      </Svg>
    );
  }
  // More — calm sliders (settings/options), not three random dots.
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Line
        x1="4"
        y1="7.5"
        x2="20"
        y2="7.5"
        stroke={stroke}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Line
        x1="4"
        y1="12"
        x2="20"
        y2="12"
        stroke={stroke}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Line
        x1="4"
        y1="16.5"
        x2="20"
        y2="16.5"
        stroke={stroke}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Circle cx="9" cy="7.5" r="2.2" fill={paper.surface} stroke={stroke} strokeWidth={1.8} />
      <Circle cx="15" cy="12" r="2.2" fill={paper.surface} stroke={stroke} strokeWidth={1.8} />
      <Circle cx="8" cy="16.5" r="2.2" fill={paper.surface} stroke={stroke} strokeWidth={1.8} />
    </Svg>
  );
}

export function BottomNav({
  active,
  onChange,
}: {
  active: ProductScreen;
  onChange: (screen: ProductScreen) => void;
}) {
  // Sit the whole nav above the system gesture inset so the home-gesture strip never
  // eats taps on the tabs (and the nav never crowds the gesture pill). Use the real
  // inset where there is one (gesture-nav phones) and a calm fallback where there
  // isn't (3-button-nav phones) — plus one small breathing constant, so the band
  // clears the system bar without a fat dead zone on either kind of phone.
  const insets = useSafeAreaInsets();
  const navPaddingBottom = (insets.bottom > 0 ? insets.bottom : 12) + NAV_SAFE_GAP;
  return (
    <View style={[styles.nav, { paddingBottom: navPaddingBottom }]}>
      {NAV_TABS.map((tab) => {
        const selected = active === tab.id;
        return (
          <Pressable
            accessibilityHint={`Switches to ${tab.label}.`}
            accessibilityLabel={`${tab.label} tab`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={({ pressed: isPressed }) => [styles.navItem, isPressed ? pressed : undefined]}
          >
            <NavIcon id={tab.id} active={selected} />
            <Text style={[styles.navLabel, selected ? styles.navLabelActive : undefined]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
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
  screenCentered: {
    justifyContent: 'center',
  },

  surface: {
    backgroundColor: paper.surface,
    borderRadius: 20,
    padding: gap.xl,
    // The soft lift replaces the hairline: a plain surface now floats on the cream
    // rather than being outlined on it. (Sunken wells stay flat below — they're insets,
    // not raised paper.)
    ...elevation.card,
  },
  surfaceSunken: {
    backgroundColor: paper.sunken,
    // Insets sit IN the paper, so no shadow and no border — flat by design.
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.hairline,
    width: '100%',
  },

  eyebrow: {
    color: paper.calmStrong, // deeper terracotta so the 13px eyebrow clears WCAG AA on paper
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  eyebrowWarm: { color: paper.warmInk },
  eyebrowMuted: { color: paper.muted },

  display: {
    color: paper.ink,
    fontFamily: serif.display,
    fontSize: 31,
    lineHeight: 37,
    letterSpacing: -0.3,
  },
  headline: {
    color: paper.ink,
    fontFamily: serif.display,
    fontSize: 29,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  headlineAccent: {
    // Match the Lovable source: the accent word is the SAME upright serif as the headline, only
    // recoloured terracotta (Lovable uses `<em className="not-italic text-accent">`). It inherits
    // the parent headline's Fraunces face, so only the colour is overridden — never italic.
    color: paper.calm,
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
    color: paper.secondary,
    fontSize: 16,
    lineHeight: 23,
  },
  muted: {
    color: paper.muted,
    fontSize: 14,
    lineHeight: 20,
  },

  primary: {
    backgroundColor: paper.calmStrong, // deeper teal: white label + caption both clear AA (>=5:1)
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: gap.xl,
    alignItems: 'center',
    gap: 2,
    // The single lifted, directional CTA — soft teal-tinted shadow ties the lift to the
    // accent so it reads as the dominant next step (not a flat fill on the cream).
    ...elevation.cta,
  },
  // Ink-toned CTA keeps the lift but warms the shadow back to the ink family so a black
  // button doesn't carry a teal halo.
  primaryInk: { backgroundColor: paper.ink, shadowColor: '#2A2018', shadowOpacity: 0.2 },
  primaryDisabled: {
    backgroundColor: paper.sunken,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  // The arrow is absolutely pinned to the right edge of the row so the label stays
  // optically centered in the button.
  primaryRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryArrow: {
    position: 'absolute',
    right: 0,
  },
  primaryLabel: {
    color: paper.inverse,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  primaryLabelInk: { color: paper.inverse },
  primaryCaption: {
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
    borderColor: paper.hairlineStrong,
    backgroundColor: paper.surface,
  },
  ghostLabel: { color: paper.ink, fontSize: 16, fontWeight: '600' },
  ghostLabelRepair: { color: paper.repairInk },

  quietLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  quietLinkLabel: { color: paper.secondary, fontSize: 15, fontWeight: '600' },

  chip: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: gap.lg,
    borderWidth: 1.5,
    borderColor: paper.hairline,
    backgroundColor: paper.surface,
  },
  chipSelected: {
    borderColor: paper.calm,
    backgroundColor: paper.calmSoft,
  },
  chipLabel: { color: paper.secondary, fontSize: 15, fontWeight: '600' },
  chipLabelSelected: { color: paper.calmStrong },

  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  padKey: {
    width: '33.333%',
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padKeyText: {
    color: paper.ink,
    fontSize: 27,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  padKeyClear: { fontSize: 16, fontWeight: '600', color: paper.muted },

  nav: {
    flexDirection: 'row',
    backgroundColor: paper.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.hairline,
    paddingTop: 12,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  navLabel: {
    color: paper.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  navLabelActive: { color: paper.calmStrong },
});

export { styles as kitStyles };
