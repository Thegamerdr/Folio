// GuidedCheckInScreen — the faithful 1:1 React Native port of the web "rough number" check-in
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenGuided.tsx).
//
// @rn-screen    GuidedCheckInScreen
// @rn-stack     Onboarding > Guided
// @purpose      Rough-number check-in — gather payday + income + headline spend without an account.
// @reads        onboarding (currentBalance.amount seeds the figure — see FIDELITY below)
// @writes       setCurrentBalance (the real honest write path for "what's roughly in your account
//               today"; the web file declared @writes setOnboarding but never called it — see below)
// @opens-sheet  —
// @copy         FROZEN
// @tokens       canvas (paper) · ink · calm (accent) · muted · surface · inset · hairline — all kit
// @motion       slide-in-r (whole screen) · press 0.97/120ms (back · Skip · every key · Continue)
//               · count-up (balance figure per keystroke; money NEVER slides) · caret blink
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/store sources):
//   • CONTRACT vs IMPLEMENTATION GAP (spec fidelityRisks): the web doc-block declares @reads
//     onboarding / @writes setOnboarding, but the web code does NEITHER — it uses local
//     useState("1240") and Continue just calls nav.go("intake"). The spec is explicit: do NOT copy
//     the dead behaviour — persist the entered balance, and ideally seed the figure from the store.
//     The store's `Onboarding` type has NO visible-cash field (done/name/payday/monthlyIncome only),
//     so the spec's "e.g. visibleCash" slot does not exist. The CORRECT, REAL, honest write path is
//     `setCurrentBalance` — whose own docstring says it is "the single write path for the user's
//     current account position … what's roughly in your account today". So: seed `value` from
//     `currentBalance.amount` (via useAppStore), and on Continue persist via setCurrentBalance with
//     source 'user-entered', confidence 'rough'. Both are confirmed store exports; no symbol invented.
//   • CUSTOM KEYPAD, not the OS keyboard (spec): a 3-col grid of Pressables with the web's exact key
//     set (1-9 · . · 0 · ←) and its exact edit rules. The kit's MoneyPad was NOT substituted — it has
//     a different key set (clear/back, no decimal) and different leading-zero/length semantics, so it
//     would break the 1:1 layout and the per-keystroke count-up. Faithful to the web means the web
//     keypad, built from tokens (the same way IntakeScreen builds its own option list inline).
//   • EDIT RULES mirrored byte-for-byte from the web `press(k)`:
//       "←" → value.slice(0,-1) || "0"   (backspace to empty falls back to "0")
//       "." → value.includes(".") ? value : value + "."   (single dot only)
//       else → value === "0" ? k : value + k   (leading "0" replaced by first digit)
//     `shown` = Number(value).toLocaleString("en-GB"). Number("12.")→12 so "12." shows "12"; no pence
//     shown (integer grouping only). These exact edge cases are preserved.
//   • COUNT-UP per keystroke (spec + MOTION.md "money never slides"): the figure re-ticks on every
//     change via the kit's useCountUp (easeOutCubic settle, reduce-motion → snap). A short 220ms tween
//     keeps the per-keystroke re-tick calm, never busy — tuned per the spec's jank warning. It is a
//     fade/tick, never a slide.
//   • CARET BLINK: the web's animate-pulse terracotta caret is NOT a Folio named motion (spec). It is
//     a subtle infinite opacity blink on a 2px accent bar; under reduce-motion it renders STATIC so it
//     never competes with Melo's breathe (room-tone rule).
//   • HEADLINE ACCENT: "see" is the single terracotta word, rendered UPRIGHT (web em.not-italic) in the
//     Fraunces display face — three Text runs, the accent run coloured t.calm, fontStyle normal.
//   • TABULAR FIGURES are load-bearing for money: the £, the amount, and every keypad key set
//     fontVariant ['tabular-nums'] so digits don't jitter width as they change.
//   • PROGRESS TICKS are hardcoded 2-of-4 filled (step two), faithful to the web's static four bars.
//   • COPY: the deck has no keys for these guided/keypad strings (they are inline in the web
//     prototype). Per the established StartScreen / IntakeScreen precedent they are ported as @copy
//     FROZEN inline literals, byte-for-byte from the web source; the currency symbol is read from
//     copy.global.currency.symbol. No banned word appears in any visible string.
//   • STATES: the spec marks Guided populated-only (offline ≡ populated; empty/loading/error n/a). All
//     five branches are rendered for completeness: populated/offline = the check-in; loading = Melo
//     curious + a line (NEVER a spinner); empty/error = the calm EmptyState doorway that still routes
//     into the check-in so it never dead-ends.
//   • slide-in-r: translateX 28→0 + fade over 360ms, ease-out-expo — gated to the FINAL STATE under
//     reduce-motion (resolved layout, never a slower animation), mirroring StartScreen / Intake / Melo.
//
// Tokens only — no new colour, font, spacing, or radius. Tap targets clear 44px (keys are 48px tall;
// back + Skip carry hitSlop). Honest claims only — this screen asserts no privacy/security property.

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { gap, radius, serif, useCountUp, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { EmptyState } from '@/folio/ui/EmptyState';
import { setCurrentBalance, useAppStore } from '@/folio/store';
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
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '←'] as const;

// The three account-source chips, byte-for-byte from the web (decorative labels under the figure).
const SOURCE_CHIPS = ['current', 'savings', 'cash'] as const;

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (from the spec @motion): the whole screen enters from +28px on X with a fade.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// A short, calm per-keystroke count-up — long enough to read as a settle, short enough that rapid
// typing never feels busy (the spec's jank warning). Money never slides; this is a tick/fade.
const COUNT_UP_MS = 220;

// The caret's blink half-cycle. A gentle opacity breath, not an attention-grab.
const CARET_BLINK_MS = 720;

// The default rough figure when the store has no user-entered balance yet. The web seeded the literal
// "1240"; we keep that as the fallback display seed only, never as a persisted number.
const SEED_FALLBACK = '1240';

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
function applyKey(value: string, key: (typeof KEYS)[number]): string {
  if (key === '←') return value.slice(0, -1) || '0';
  if (key === '.') return value.includes('.') ? value : value + '.';
  return value === '0' ? key : value + key;
}

export function GuidedCheckInScreen({ nav, state = 'populated' }: GuidedCheckInScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // Seed the rough figure from the store's current account position (honest: the same number the rest
  // of the app reads). A 'sample'/zero balance falls back to the web's rough seed so the field is
  // never blank on first run. Read once for the initial value; edits live in local state from there.
  const seededAmount = useAppStore((s) => s.currentBalance.amount);
  const [value, setValue] = useState(() =>
    seededAmount > 0 ? String(Math.round(seededAmount)) : SEED_FALLBACK,
  );

  // The grouped display string — Number(value).toLocaleString('en-GB'), exactly as the web computes
  // it. Number("12.")→12, leading "0" already replaced on input, backspace-to-empty → "0".
  const shownNumber = Number(value);
  const grouped = useMemo(() => shownNumber.toLocaleString('en-GB'), [shownNumber]);

  // Per-keystroke count-up: the figure re-ticks to the new number on every change (money never slides
  // — this is a calm settle, gated to a snap under reduce-motion by the hook itself).
  const counted = useCountUp(shownNumber, COUNT_UP_MS, reduceMotion);
  const countedLabel = useMemo(() => Math.round(counted).toLocaleString('en-GB'), [counted]);

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

  // The terracotta caret's gentle blink (web animate-pulse). Static under reduce-motion so it never
  // becomes a second infinite animation competing with Melo's breathe.
  const caret = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      caret.value = 1;
      return;
    }
    caret.value = withRepeat(
      withTiming(1, { duration: CARET_BLINK_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [caret, reduceMotion]);

  const caretStyle = useAnimatedStyle(() => ({
    // Breathe between 0.35 and 1.0 opacity — present but quiet.
    opacity: 0.35 + caret.value * 0.65,
  }));

  function handleKey(key: (typeof KEYS)[number]) {
    setValue((v) => applyKey(v, key));
  }

  // Persist the rough figure honestly before advancing. The web omitted this; the spec requires it.
  // 'user-entered' source + 'rough' confidence is exactly what this screen captures.
  function commitAndGo() {
    setCurrentBalance({
      amount: Math.max(0, Math.round(shownNumber)),
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
        <Text style={[styles.subhead, { color: t.muted }]}>A rough number is fine.</Text>
      </View>

      {/* Balance card — the In-your-account label, the big £ + figure with the blinking caret, and the
          three source chips. The figure count-ups per keystroke; money never slides. */}
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
        <Text style={[styles.cardLabel, { color: t.muted }]}>In your account</Text>
        <View style={styles.amountRow}>
          <Text style={[styles.symbol, { color: t.ink }]}>{copy.global.currency.symbol}</Text>
          <Text
            accessibilityLabel={`${copy.global.currency.symbol}${grouped}`}
            style={[styles.amount, { color: t.ink }]}
          >
            {countedLabel}
          </Text>
          <Animated.View style={[styles.caret, caretStyle, { backgroundColor: t.calm }]} />
        </View>
        <View style={styles.chipsRow}>
          {SOURCE_CHIPS.map((label) => (
            <View key={label} style={[styles.chip, { backgroundColor: t.inset }]}>
              <Text style={[styles.chipLabel, { color: t.muted }]}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Melo reassurance — calm mood (step 1-3 of onboarding map to calm per MELO_MOODS.md). The
          quote is a @copy FROZEN inline literal; MeloLine adds the straight quotes. */}
      <View style={styles.meloRow}>
        <MeloLine mood="calm" text="An estimate is fine — we'll get clearer together." />
      </View>

      {/* Spacer pins the keypad + Continue to the bottom, mirroring the web flex-1 spacer. */}
      <View style={styles.spacer} />

      {/* Keypad — the 3-col grid of Pressables (1-9 · . · 0 · ←). Custom, not the OS keyboard. */}
      <View style={styles.keypad}>
        {KEYS.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={key === '←' ? 'Delete last digit' : `Key ${key}`}
            onPress={() => handleKey(key)}
            style={({ pressed: isPressed }) => [
              styles.keyButton,
              { backgroundColor: t.surface, borderColor: t.hairline },
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.keyLabel, { color: t.ink }]}>{key}</Text>
          </Pressable>
        ))}
      </View>

      {/* Continue — the kit accent CTA shape rebuilt as a single terracotta button (the web's
          bg-accent text-white). Persists the rough figure honestly, then advances to intake. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue"
        accessibilityHint="Saves this rough figure and opens the next step"
        onPress={commitAndGo}
        style={({ pressed: isPressed }) => [
          styles.continue,
          { backgroundColor: t.calm },
          isPressed ? styles.pressed : undefined,
        ]}
      >
        <Text style={[styles.continueLabel, { color: t.inverse }]}>Continue</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // px-7 ≈ screen inset (gap.xl = 24). The screen colour is the warm canvas.
  screen: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
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
    marginTop: gap.xxl,
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
    marginTop: gap.xl,
    padding: gap.xl,
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
    marginTop: gap.lg,
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
