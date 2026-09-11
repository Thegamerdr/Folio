// Guided balance entry: same native numeric keyboard as the remaining setup forms.
// The entered balance remains a rough user-entered figure until setup is confirmed.

import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { EmptyState } from '@/folio/ui/EmptyState';
import { setCurrentBalance, useAppStore } from '@/folio/store';
import { parseManualMoney } from '@/folio/lib/manualMoney';
import { guidedBalanceDraft } from '@/folio/lib/guidedBalance';
import type { Nav } from '@/folio/types';

// The render states this screen can occupy. Per the spec, Guided is populated-only and offline is
// identical to populated (local-first, no network dependency); loading/empty/error are n/a for a pure
// check-in but are rendered for completeness so every branch is exercised.
export type GuidedCheckInState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type GuidedCheckInScreenProps = {
  nav: Nav;
  state?: GuidedCheckInState;
};

// The keypad's exact key set, byte-for-byte from the web `keys` array (3-col grid, reading order).

// The three account-source chips, byte-for-byte from the web (decorative labels under the figure).
const SOURCE_CHIPS = ['current', 'savings', 'cash'] as const;

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (from the spec @motion): the whole screen enters from +28px on X with a fade.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// The caret's blink half-cycle. A gentle opacity breath, not an attention-grab.

// Local reduce-motion read, mirroring Melo.tsx / StartScreen / IntakeScreen exactly: read once, then
// subscribe to changes. Kept self-contained so this screen pulls no heavy module graph.
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

// Apply the web `press(k)` edit rule to the current raw value. Pure — same three branches, same
// fallbacks, byte-for-byte with the web source so every edge case (single dot, leading-zero replace,
// backspace-to-"0") matches exactly.

export function GuidedCheckInScreen({ nav, state = 'populated' }: GuidedCheckInScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // Prefill only an existing real balance. Continue confirms the displayed amount; a fresh
  // profile must never silently turn a design example into user-entered money.
  const currentBalance = useAppStore((s) => s.currentBalance);
  const setupConfirmed = useAppStore((s) => s.onboarding.financialSetupConfirmed === true);
  const [value, setValue] = useState(() => guidedBalanceDraft(currentBalance, setupConfirmed));

  const parsedBalance = parseManualMoney(value, { allowZero: true });
  const balanceValid = parsedBalance !== undefined;

  // slide-in-r — drives the whole screen. 0 = resting (translateX 0, opacity 1); under reduce-motion
  // we resolve straight to the final state instead of animating.
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withTiming(1, { duration: SLIDE_MS, easing: EASE_OUT_EXPO });
  }, [enter, reduceMotion]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * SLIDE_FROM_X }],
  }));

  // Persist the rough figure honestly before advancing. The web omitted this; the spec requires it.
  // 'user-entered' source + 'rough' confidence is exactly what this screen captures.
  function commitAndGo() {
    if (parsedBalance === undefined) return;
    setCurrentBalance({
      amount: parsedBalance,
      source: 'user-entered',
      confidence: 'rough',
    });
    nav.go('intake');
  }

  // empty / error — the calm EmptyState doorway (n/a in practice, rendered for completeness). The
  // single CTA still routes onward so the doorway never dead-ends.
  if (state === 'empty' || state === 'error') {
    const headline = state === 'error' ? copy.err.generic : 'What money can you see today?';
    const body = state === 'error' ? undefined : 'A rough number is fine.';
    return (
      <EmptyState
        mood="calm"
        headline={headline}
        body={body}
        cta={{ label: 'Continue', onPress: () => nav.go('intake') }}
      />
    );
  }

  // loading — Melo curious + a line, never a spinner (per the hard rule + STATES.md). A calm, centred
  // holding moment while the check-in settles.
  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}
      >
        <MeloLine mood="curious" text="One second — getting your check-in ready." />
      </View>
    );
  }

  // populated / offline — the real check-in. offline ≡ populated (local-first; nothing on this screen
  // needs the network).
  return (
    <Animated.View
      style={[
        styles.screen,
        enterStyle,
        {
          backgroundColor: t.canvas,
          paddingTop: insets.top + gap.lg,
          paddingBottom: insets.bottom + gap.lg,
        },
      ]}
    >
      {/* The check-in scrolls — on a short viewport the keypad + Continue sit below the fold. flexGrow:1
          keeps the spacer pinning them to the bottom when there's room and scrolls when there isn't.
          keyboardShouldPersistTaps lets the custom keypad keys register even mid-interaction. */}
      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top bar — back glyph · four progress ticks (2 filled = step two) · Skip. */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={16}
            onPress={nav.back}
            style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
          >
            <Text style={[styles.back, { color: t.muted }]}>←</Text>
          </Pressable>

          <View accessibilityLabel="Step 2 of 4" style={styles.ticks}>
            <View style={[styles.tick, { backgroundColor: t.calm }]} />
            <View style={[styles.tick, { backgroundColor: t.calm }]} />
            <View style={[styles.tick, { backgroundColor: t.hairline }]} />
            <View style={[styles.tick, { backgroundColor: t.hairline }]} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip"
            hitSlop={16}
            onPress={() => nav.go('today')}
            style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
          >
            <Text style={[styles.skip, { color: t.muted }]}>Skip</Text>
          </Pressable>
        </View>

        {/* Heading — "Step two" eyebrow (Fraunces italic), the one question with "see" upright +
          terracotta, and the rough-number reassurance. All @copy FROZEN inline literals. */}
        <View style={styles.heading}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>Step two</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {'What money can you '}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>see</Text>
            {' today?'}
          </Text>
          <Text style={[styles.subhead, { color: t.muted }]}>
            Your current available balance, including payments and income already reflected.
          </Text>
        </View>
        {/* Balance card — the In-your-account label, the big £ + figure with the blinking caret, and the
          three source chips. The figure count-ups per keystroke; money never slides. */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text style={[styles.cardLabel, { color: t.muted }]}>In your account</Text>
          <View style={styles.amountRow}>
            <Text style={[styles.symbol, { color: t.ink }]}>{copy.global.currency.symbol}</Text>
            <TextInput
              accessibilityLabel="Current available balance"
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              selectTextOnFocus
              maxFontSizeMultiplier={1.35}
              style={[styles.amount, { color: t.ink, flex: 1, minHeight: 56, paddingVertical: 8 }]}
            />
          </View>
          <View style={styles.chipsRow}>
            {SOURCE_CHIPS.map((label) => (
              <View key={label} style={[styles.chip, { backgroundColor: t.inset }]}>
                <Text style={[styles.chipLabel, { color: t.muted }]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.controls}>
        {/* Continue — the kit accent CTA shape rebuilt as a single terracotta button (the web's
          bg-accent text-white). Persists the rough figure honestly, then advances to intake. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={balanceValid ? 'Continue' : 'Enter a valid balance'}
          accessibilityState={{ disabled: !balanceValid }}
          disabled={!balanceValid}
          accessibilityHint="Saves this rough figure and opens the next step"
          onPress={commitAndGo}
          style={({ pressed: isPressed }) => [
            styles.continue,
            { backgroundColor: balanceValid ? t.calm : t.inset },
            isPressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.continueLabel, { color: balanceValid ? t.inverse : t.muted }]}>
            {balanceValid ? 'Continue' : 'Enter a valid balance'}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // px-7 ≈ screen inset (gap.xl = 24). The screen colour is the warm canvas.
  screen: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // Scroll container fills the screen; content grows to a full viewport so the flex:1 spacer keeps
  // pinning the keypad + Continue when there's room, then scrolls when there isn't.
  scrollFlex: {
    flex: 1,
  },
  scrollBody: {
    paddingBottom: gap.sm,
  },
  controls: { flexShrink: 0 },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // Top bar — back glyph · ticks · Skip, space-between, centred.
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // The back glyph — 20px muted (web text-[20px] text-muted-ink press).
  back: {
    fontSize: 20,
  },
  // Skip — 13px muted (web text-[13px] text-muted-ink press).
  skip: {
    fontSize: 13,
  },
  // Four 24x4 rounded-full progress bars, gap-1.5 (6px) between (web w-6 h-1 gap-1.5).
  ticks: {
    columnGap: 6,
    flexDirection: 'row',
  },
  tick: {
    borderRadius: radius.pill,
    height: 4,
    width: 24,
  },
  // mt-8 (32px) = gap.xxl.
  heading: {
    marginTop: gap.md,
  },
  // "Step two" — Fraunces italic, 14px, muted (web font-display italic text-[14px]).
  eyebrow: {
    fontFamily: serif.displayItalic,
    fontSize: 14,
  },
  // Fraunces display headline, 30px, tight line-height, mt-1 (web font-display text-[30px]
  // leading-tight mt-1).
  headline: {
    fontFamily: serif.display,
    fontSize: 30,
    lineHeight: 34,
    marginTop: gap.xxs,
  },
  // The accent word "see" stays UPRIGHT (web em.not-italic) — same display face, normal style.
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // mt-3 (12px) = gap.md; 13.5px muted, max-width ~280 (web text-[13.5px] mt-3 max-w-[280px]).
  subhead: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: gap.md,
    maxWidth: 280,
  },
  // mt-6 (24px) = gap.xl; bg-surface · hairline · rounded-2xl (radius.xl = 24) · p-6 (gap.xl = 24).
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.sm,
    marginBottom: gap.sm,
    padding: gap.md,
  },
  // "In your account" — 11px, uppercase, tracked, muted (web text-[11px] uppercase tracking-[0.14em];
  // RN letterSpacing is absolute px, so 11 * 0.14 ≈ 1.54).
  cardLabel: {
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
  // mt-2 (8px) = gap.sm; baseline row, gap-1 (4px) between £ and figure (web flex items-baseline
  // gap-1).
  amountRow: {
    alignItems: 'flex-end',
    columnGap: gap.xs,
    flexDirection: 'row',
    marginTop: gap.sm,
  },
  // The £ — Fraunces display, 52px, tabular, leading-none (web font-display tabular text-[52px]).
  symbol: {
    fontFamily: serif.display,
    fontSize: 52,
    fontVariant: ['tabular-nums'],
    lineHeight: 52,
  },
  // The figure — Fraunces display, 52px, tabular, leading-none. Tabular so digits never jitter width.
  amount: {
    fontFamily: serif.display,
    fontSize: 52,
    fontVariant: ['tabular-nums'],
    lineHeight: 52,
  },
  // The terracotta caret — a 2px-wide, 36px-tall accent bar to the right of the figure (web w-[2px]
  // h-9 bg-accent animate-pulse). ml-1 (4px).
  caret: {
    borderRadius: 1,
    height: 36,
    marginLeft: gap.xs,
    marginBottom: 4,
    width: 2,
  },
  // mt-4 (16px) = gap.lg; row of chips, gap-2 (8px) between (web mt-4 flex gap-2).
  chipsRow: {
    columnGap: gap.sm,
    flexDirection: 'row',
    marginTop: gap.xs,
  },
  // Each chip — --inset fill, rounded-full, px-2 py-1 (web text-[11px] px-2 py-1 rounded-full).
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: gap.sm,
    paddingVertical: gap.xs,
  },
  chipLabel: {
    fontSize: 11,
  },
  // mt-4 (16px) = gap.lg.
  meloRow: {
    marginTop: gap.lg,
  },
  spacer: {
    flex: 1,
  },
  // 3-col grid, gap-2 (8px), mb-3 (12px) below (web grid grid-cols-3 gap-2 mb-3). Wrap + a fixed
  // 3-up width reproduces the CSS grid; rowGap matches the column gap.
  keypad: {
    columnGap: gap.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: gap.md,
    rowGap: gap.sm,
  },
  // Each key — one of three columns (the two 8px gaps are removed from the full width, then split in
  // thirds), h-12 (48px), rounded-xl (radius.md = 12), bg-surface, hairline, centred.
  keyButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    justifyContent: 'center',
    // (full width minus two 8px gaps) / 3 columns. flexBasis as a percentage keeps the grid responsive to the
    // px-7 inset without measuring; the small negative slack from the gaps is absorbed by flexWrap.
    flexBasis: '31%',
    flexGrow: 1,
  },
  // Fraunces display, 20px, tabular (web font-display tabular text-[20px]).
  keyLabel: {
    fontFamily: serif.display,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  // The accent CTA — full width, h-[54px], rounded-2xl (radius.xl = 24), terracotta fill (web press
  // w-full h-[54px] rounded-2xl bg-accent).
  continue: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 54,
    justifyContent: 'center',
  },
  // The on-accent label — 15.5px medium, inverse (web text-white font-medium text-[15.5px]).
  continueLabel: {
    fontSize: 15.5,
    fontWeight: '500',
  },
  // The kit press feel applied to tappables (web `press` util — scale 0.97 / lowered opacity).
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
