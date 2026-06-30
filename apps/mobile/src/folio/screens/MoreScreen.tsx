// MoreScreen — the faithful 1:1 React Native port of the web hub
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenMore.tsx).
//
// @rn-screen    MoreScreen
// @rn-stack     MainTabs > More
// @purpose      The quiet hub — grouped links to every secondary surface (the picture, tending,
//               trying a move, your data), plus two dev/demo actions and an appearance toggle.
// @reads        appearance (light|dark) — RN reads the resolved theme via useIsDark(); used only to
//               drive the Appearance row hint. The web @reads is empty; the group data is static.
// @writes       fastForwardMonth(), resetToEmpty() (Start fresh → clears to empty) · setMode (appearance toggle)
// @opens-sheet  share (from "Share a cycle") · onboarding (from "Payday & income")
// @copy         FROZEN
// @tokens       calm (accent) · surface · hairline · muted · repairInk (negative) · canvas (paper) ·
//               ink · caution — all from the kit, no new token defined here.
// @motion       slide-in-r on mount (translateX 28→0 + fade, 360ms ease-out-expo) · press 0.97/120ms
//               on every row · Melo breathe + blink (the only continuous motion on this quiet screen).
// @notes        Fast-forward and Start fresh are dev/demo actions — kept LAST and visually quiet
//               (same row styling; only "Start fresh" carries the negative label tone). No buttons,
//               no badges, no elevation on them.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/store source):
//   • Theme mechanism: the web useTheme() is web-coupled (document.documentElement.classList,
//     localStorage('folio-theme'), meta[name=theme-color]). NONE exist in RN. Per the spec's
//     fidelityRisks, this is re-implemented as the kit's theme store: useIsDark() reads the live
//     resolved appearance; useThemeMode().setMode flips it. The web toggle is binary light↔dark, so
//     the RN tap resolves the live value and calls setMode('light'|'dark') — never 'system' — to
//     mirror the binary flip. The Appearance hint stays driven by the live theme.
//   • Appearance is an onPress row that toggles IN PLACE — it must NOT push a screen. The "→" chevron
//     still renders on it (faithful to the web, where every row carries the glyph); tapping only
//     toggles the theme.
//   • Press-handler precedence is onPress > sheet > to (exactly the web's onClick > sheet > to). This
//     keeps "Payday & income" opening the onboarding SHEET (not a screen) and "Share a cycle" opening
//     the share sheet.
//   • Melo mood: the web header uses <Melo size={30} mood="soft">. RN's MeloMood union has no 'soft'
//     ('calm' | 'curious' | 'cheer' | 'concern' | 'celebrate'); 'soft' was a web-only accent-soft
//     expression. The established RN precedent (AddEntryScreen) maps the web 'soft' to the closest
//     existing quiet mood, 'calm'. Kept calm, sized 30, as the rare quiet header companion.
//   • Group card: the web is `divide-y divide-[hairline]` inside a `hairline rounded-2xl` surface. RN
//     has no divide-y, so rows render with a 1px Hairline rule between them (not after the last) and
//     the Surface carries a 1px hairline border + rounded-2xl (radius.xl) with overflow hidden so the
//     press highlight clips to the rounded card.
//   • Accent "calmly": the web is <em not-italic text-[accent]> inside an upright font-display
//     heading — rendered UPRIGHT (Fraunces display, normal style) + terracotta (t.calm), NOT italic.
//   • Chevron is a literal "→" text glyph in muted ink on the web. Kept as a muted "→" Text glyph
//     (the kit's ChevronRight is an option, but the web glyph is the literal "→"; staying faithful).
//   • slide-in-r: translateX 28→0 + fade over 360ms, ease-out-expo (the web styles.css value, not the
//     doc block's 240ms) — gated to FINAL STATE under reduce-motion (resolved layout, never slower).
//   • Header carries the "Folio" wordmark (font-display italic 14px) + a 20px empty balance spacer on
//     the right — the spacer is kept so the wordmark stays left-aligned; it is NOT a button.
//   • Scroll container hides scrollbars and clears the tab bar with a bottom safe-area inset + bottom
//     margin so the closing MeloLine never tucks under the nav.
//   • STATES: More is populated-only (offline ≡ populated; empty/error n/a). All five branches are
//     rendered for completeness: populated/offline = the hub; loading = Melo curious + a line, never
//     a spinner; empty/error = the calm EmptyState doorway (n/a in practice — the hub has no data
//     dependency — but rendered so every branch is exercised).
//
// HONEST CLAIMS: no privacy/security assertion is made anywhere here. The "Data & privacy" row hint
// is the verbatim web copy "what's saved, what to export" — it never claims data "stays on device",
// is "encrypted", "bank-grade", or "100% private". The closing line is the verbatim web reassurance.
// Banned vocabulary is absent from every visible string.
//
// Tokens only — no new colour, font, spacing, or radius. Every row is a >=44px tap target (px-5 py-4
// rows clear it). Copy is VERBATIM from the web source (the row labels/hints + group titles are
// @copy FROZEN inline literals exactly as the web keeps them; only app.name is keyed in COPY_DECK).

import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  Surface,
  Hairline,
  gap,
  radius,
  serif,
  useTheme,
  useIsDark,
  useThemeMode,
} from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { EmptyState } from '@/folio/ui/EmptyState';
import { fastForwardMonth, resetToEmpty } from '@/folio/store';
import type { Nav, ScreenId, SheetId } from '@/folio/types';

// Routing: the web "Data & privacy" row navigates to the Privacy screen (web `to: "privacy"`), where
// the export action lives (the Privacy "Export my data" CTA). This RN row is faithful to that — it
// carries `to: 'privacy'` and navigates via nav.go('privacy'), so export is reached FROM Privacy, not
// fired from this hub. The label, hint, layout, and tone are the web literals.

// The render states this screen can occupy. Per the spec, More is populated-only and offline is
// identical to populated (the hub is pure routing chrome with no data dependency); loading/empty/
// error are n/a but are rendered for completeness so every branch is exercised.
export type MoreState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type MoreScreenProps = {
  nav: Nav;
  state?: MoreState;
};

// A single link/action row. Faithful to the web row shape: a label, a hint, and exactly one of
// { to | sheet | onPress }, resolved in that precedence. `tone: 'negative'` colours the label coral
// (the web --negative) for the one destructive action.
type MoreRow = {
  label: string;
  hint: string;
  to?: ScreenId;
  sheet?: SheetId;
  onPress?: () => void;
  tone?: 'negative';
};

type MoreGroup = {
  title: string;
  rows: MoreRow[];
};

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (from the spec @motion): the whole screen enters from +28px on X with a fade.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// The web's w-5 (20px) balance spacer that keeps the wordmark left-aligned. Not a button.
const BALANCE_SPACER = 20;

// Local reduce-motion read, mirroring Melo.tsx / StartScreen exactly: read once, then subscribe to
// changes. Kept self-contained so this screen pulls no heavy module graph.
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

export function MoreScreen({ nav, state = 'populated' }: MoreScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // Appearance — the RN replacement for the web document.documentElement.classList mechanism. The
  // hint reads the live resolved appearance; the tap flips it binary light↔dark (never 'system'),
  // mirroring the web toggle. Hooks are unconditional (called before any early return).
  const isDark = useIsDark();
  const { setMode } = useThemeMode();
  const toggleAppearance = () => setMode(isDark ? 'light' : 'dark');

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

  // The grouped link lists — byte-faithful to the web `groups` array (order, labels, hints, targets).
  const groups: MoreGroup[] = [
    {
      title: 'The picture',
      rows: [
        { label: 'Timeline', hint: 'what you added, what you left', to: 'timeline' },
        { label: 'Calendar', hint: 'the dates that matter', to: 'calendar' },
        { label: 'Plans', hint: "what's coming before payday", to: 'plans' },
        { label: 'Insights', hint: 'the shape of your months', to: 'insights' },
      ],
    },
    {
      title: 'Tend the picture',
      rows: [
        { label: 'Subscriptions', hint: 'what still earns its place', to: 'subs' },
        { label: 'Pots', hint: 'set aside, calmly', to: 'pots' },
        { label: 'Payday & income', hint: 'change when money lands', sheet: 'onboarding' },
        { label: 'Payday review', hint: 'wrap up the month in four steps', to: 'ritual' },
      ],
    },
    {
      title: 'Try a move',
      rows: [
        { label: 'What if I spend', hint: 'preview before you decide', to: 'whatif' },
        { label: 'Recovery', hint: 'something has to move', to: 'recovery' },
        { label: 'Share a cycle', hint: 'a quiet win card', sheet: 'share' },
      ],
    },
    {
      title: 'Your data',
      rows: [
        { label: 'Data & privacy', hint: "what's saved, what to export", to: 'privacy' },
        {
          label: 'Appearance',
          hint: isDark ? 'dark · tap for light' : 'light · tap for dark',
          onPress: toggleAppearance,
        },
        { label: 'App lock', hint: 'Face ID · off', to: 'more' },
        {
          label: 'Fast-forward 1 month',
          hint: 'demo: age dates, close a cycle',
          onPress: () => {
            fastForwardMonth();
            nav.go('insights');
          },
        },
        {
          label: 'Start fresh',
          hint: 'clears everything to empty',
          onPress: () => {
            // Genuinely CLEAR to empty (resetToEmpty) — the old wiring called resetAll(), which RESEEDS
            // the demo, so "Start fresh" appeared to "bring it all back". One confirm guards an
            // accidental wipe; the demo can still be restored via Data & privacy → "Reset to the demo".
            Alert.alert(
              'Clear everything?',
              "This wipes everything you've added and leaves the app empty. This can't be undone.",
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear everything',
                  style: 'destructive',
                  onPress: () => {
                    resetToEmpty();
                    nav.go('start');
                  },
                },
              ],
              { cancelable: true },
            );
          },
          tone: 'negative',
        },
      ],
    },
  ];

  // empty / error — the calm EmptyState doorway (n/a in practice; the hub has no data dependency).
  // The single CTA routes back to Today so the doorway never dead-ends.
  if (state === 'empty' || state === 'error') {
    const headline = state === 'error' ? copy.err.generic : 'Everything else, calmly.';
    const body = state === 'error' ? undefined : 'The quiet hub — back in a moment.';
    return (
      <EmptyState
        mood="calm"
        headline={headline}
        body={body}
        cta={{ label: 'Back to today', onPress: () => nav.go('today') }}
      />
    );
  }

  // loading — Melo curious + a line, never a spinner (per the hard rule + STATES.md). A calm,
  // centred holding moment while the hub settles.
  if (state === 'loading') {
    return (
      <View
        style={[
          styles.loading,
          { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl },
        ]}
      >
        <MeloLine mood="curious" text="One second — gathering everything else." />
      </View>
    );
  }

  // populated / offline — the real hub. offline ≡ populated (local-first; nothing here needs the
  // network). The slide-in-r entrance wraps the scroll content.
  return (
    <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + gap.lg,
            paddingBottom: insets.bottom + gap.xxl,
          },
        ]}
      >
        {/* Header — wordmark (font-display italic 14px) + a 20px balance spacer (not a button). */}
        <View style={styles.header}>
          <Text style={[styles.wordmark, { color: t.ink }]}>{copy.global.app.name}</Text>
          <View style={styles.balanceSpacer} />
        </View>

        {/* Hero / intro — Melo (calm, size 30) + the eyebrow + the upright accented heading. */}
        <View style={styles.hero}>
          <Melo size={30} mood="calm" />
          <View style={styles.heroText}>
            <Text style={[styles.eyebrow, { color: t.muted }]}>The quiet hub</Text>
            <Text accessibilityRole="header" style={[styles.heading, { color: t.ink }]}>
              {'Everything else, '}
              <Text style={[styles.headingAccent, { color: t.calm }]}>calmly</Text>
              {'.'}
            </Text>
          </View>
        </View>

        {/* Grouped link lists — space-y-6 between groups. */}
        <View style={styles.groups}>
          {groups.map((group) => (
            <View key={group.title}>
              <Text style={[styles.groupTitle, { color: t.muted }]}>{group.title}</Text>
              <Surface style={[styles.card, { borderColor: t.hairline }]}>
                {group.rows.map((row, index) => (
                  <View key={row.label}>
                    {index > 0 ? <Hairline /> : null}
                    <MoreRowView nav={nav} row={row} />
                  </View>
                ))}
              </Surface>
            </View>
          ))}
        </View>

        {/* Closing reassurance — the verbatim web line. MeloLine adds the straight quotes; we pass
            the raw text. No mood prop → MeloLine's default (calm), faithful to the web. */}
        <View style={styles.closing}>
          <MeloLine text="Tap export any time. Tap start fresh and it's gone." />
        </View>
      </ScrollView>
    </Animated.View>
  );
}

// A single hub row. Press precedence is onPress > sheet > to (the web's onClick > sheet > to). The
// "→" chevron is a muted Text glyph on every row (including Appearance, which only toggles). Carries
// the kit `pressed` feel (scale 0.97 / lowered opacity — the web `press` util) and selection haptics
// via the kit primitives' convention; the row itself is a >=44px tap target (px-5 py-4).
function MoreRowView({ nav, row }: { nav: Nav; row: MoreRow }) {
  const t = useTheme();

  const handlePress = () => {
    if (row.onPress) {
      row.onPress();
      return;
    }
    if (row.sheet) {
      nav.openSheet(row.sheet);
      return;
    }
    if (row.to) {
      nav.go(row.to);
    }
  };

  const labelColor = row.tone === 'negative' ? t.repairInk : t.ink;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed: isPressed }) => [styles.row, isPressed ? styles.rowPressed : undefined]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: labelColor }]}>{row.label}</Text>
        <Text style={[styles.rowHint, { color: t.muted }]}>{row.hint}</Text>
      </View>
      <Text style={[styles.chevron, { color: t.muted }]}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    // px-7 ≈ gap.xl (the StartScreen precedent for the web's 28px screen inset).
    paddingHorizontal: gap.xl,
  },
  // The scroll content column. px-7 ≈ gap.xl screen inset.
  content: {
    paddingHorizontal: gap.xl,
  },
  // Header row — wordmark left, balance spacer right (web flex items-center justify-between).
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Fraunces italic wordmark, 14px (web font-display italic text-[14px]).
  wordmark: {
    fontFamily: serif.displayItalic,
    fontSize: 14,
  },
  // The web w-5 (20px) balance spacer — keeps the wordmark left-aligned. Not interactive.
  balanceSpacer: {
    width: BALANCE_SPACER,
  },
  // mt-6 (24px) = gap.xl; gap-3 (12px) = gap.md between Melo and the text; items-start.
  hero: {
    alignItems: 'flex-start',
    columnGap: gap.md,
    flexDirection: 'row',
    marginTop: gap.xl,
  },
  heroText: {
    flex: 1,
  },
  // Fraunces italic eyebrow, 13px, muted (web font-display italic text-[13px] text-muted-ink).
  eyebrow: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  // Fraunces hero, 30px, tight line-height (web font-display text-[30px] leading-[1.05]); mt-1 (4px).
  heading: {
    fontFamily: serif.display,
    fontSize: 30,
    lineHeight: 32,
    marginTop: gap.xs,
  },
  // The accent word "calmly" stays UPRIGHT (web em.not-italic) — same display face, normal style.
  headingAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // mt-7 (28px) ≈ gap.xl; space-y-6 (24px) = gap.xl between groups.
  groups: {
    marginTop: gap.xl,
    rowGap: gap.xl,
  },
  // Group title — 11px, uppercase, tracked (web text-[11px] uppercase tracking-[0.16em]); mb-2 (8px)
  // = gap.sm; px-1 (4px) = gap.xs.
  groupTitle: {
    fontSize: 11,
    letterSpacing: 1.6,
    marginBottom: gap.sm,
    paddingHorizontal: gap.xs,
    textTransform: 'uppercase',
  },
  // The group card — rounded-2xl (radius.xl) hairline surface; overflow hidden clips the row press
  // highlight to the rounded corners. The 1px hairline border is the web `hairline` outer rule.
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  // A row — px-5 (20px) py-4 (16px = gap.lg) flex items-center. ~52px tall: clears the 44px target.
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: gap.lg,
  },
  // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
  rowPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
  rowText: {
    flex: 1,
  },
  // 15px medium label (web text-[15px] font-medium).
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  // 12px muted hint; mt-0.5 (2px) = gap.xxs.
  rowHint: {
    fontSize: 12,
    marginTop: gap.xxs,
  },
  // The literal "→" glyph in muted ink (web span text-muted-ink "→").
  chevron: {
    fontSize: 15,
  },
  // mt-6 (24px) = gap.xl; the bottom inset on the scroll content clears the tab bar (web mb-8).
  closing: {
    marginTop: gap.xl,
  },
});
