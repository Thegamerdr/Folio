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

const role = folioTokens.color.role;

export const paper = {
  canvas: folioTokens.color.canvas, // #F7F6F1 warm paper
  surface: role.surface.base, // #FFFEFB
  surfaceRaised: role.surface.raised, // #FBFAF7
  sunken: role.background.sunken, // #E9ECE8
  ink: role.text.primary, // #18231D
  secondary: role.text.secondary, // #4A544D
  muted: role.text.muted, // #69736C
  calm: role.accent.primary, // #2E7D67 green
  calmStrong: role.accent.primaryStrong, // #1F5F4E
  calmSoft: role.accent.primarySoft, // #DDEFE7
  warm: role.accent.warm, // #D99A28 amber
  warmSoft: role.accent.warmSoft, // #F6E7C2
  warmInk: role.text.warning, // #8B6011
  repair: role.accent.repair, // #D96D59 coral
  repairSoft: role.accent.repairSoft, // #F6DDD7
  repairInk: role.text.danger, // #89483C
  hairline: role.border.subtle, // #D9DDD8
  hairlineStrong: role.border.strong, // #8C968F
  payday: folioTokens.color.route.payday, // #F0C65B
  routeShadow: folioTokens.color.route.shadow, // #C4CAC6
  inverse: role.text.inverse, // #FFFFFF
} as const;

export const gap = folioTokens.spacing.scale;

export const pressed = {
  opacity: folioTokens.interaction.state.pressed.opacity,
  transform: [{ scale: folioTokens.interaction.state.pressed.scale }],
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
  tone?: 'calm' | 'warm' | undefined;
}) {
  return (
    <Text style={[styles.eyebrow, tone === 'warm' ? styles.eyebrowWarm : undefined]}>
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

export type VerdictTone = 'calm' | 'warm' | 'repair';

function verdictColor(tone: VerdictTone | undefined): TextStyle {
  if (tone === 'repair') return { color: paper.repairInk };
  if (tone === 'warm') return { color: paper.warmInk };
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
      <Text style={[styles.primaryLabel, tone === 'ink' ? styles.primaryLabelInk : undefined]}>
        {label}
      </Text>
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
// Bottom nav — premium icons (Start / Review / Today / More). No "?" glyphs.
// ---------------------------------------------------------------------------

type NavTab = { id: ProductScreen; label: string };

// One small breathing gap above the system bar — keeps the nav clear of the gesture
// strip / 3-button bar without leaving a fat empty band on either kind of phone.
const NAV_SAFE_GAP = 6;

const NAV_TABS: readonly NavTab[] = [
  { id: 'start', label: 'Start' },
  { id: 'import', label: 'Review' },
  { id: 'today', label: 'Today' },
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairline,
    padding: gap.xl,
  },
  surfaceSunken: {
    backgroundColor: paper.sunken,
    borderColor: 'transparent',
  },

  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.hairline,
    width: '100%',
  },

  eyebrow: {
    color: paper.calm,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  eyebrowWarm: { color: paper.warmInk },

  display: {
    color: paper.ink,
    fontSize: 33,
    lineHeight: 39,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  verdict: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
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
    backgroundColor: paper.calm,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: gap.xl,
    alignItems: 'center',
    gap: 2,
    shadowColor: '#10241C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 4,
  },
  primaryInk: { backgroundColor: paper.ink, shadowOpacity: 0.2 },
  primaryDisabled: {
    backgroundColor: paper.sunken,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryLabel: {
    color: paper.inverse,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  primaryLabelInk: { color: paper.inverse },
  primaryCaption: {
    color: '#E4F0EA',
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
