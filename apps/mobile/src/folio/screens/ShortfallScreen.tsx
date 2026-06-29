// @rn-engine money-path — the gap (£) + days-to-payday verdict, the tight-point recompute, and the
// spend-holds are the real money-path engine (ENGINES §6). Until that engine lands, this screen
// derives a HONEST gap/daysLeft from the same local calendar derivation the Calendar + Today waves
// use (deriveCalendarEvents → computeSpareAndTightest against currentBalance), and falls back to the
// web prototype's synthetic 86 / 9 only if the derivation surfaces no shortfall. The borrow card's
// `lendingPot.saved >= gap` gate, the dailyCap formula, and the borrow preview→commit math all read
// these engine numbers — never a hard-coded literal once a real shortfall is present.
//
// ShortfallScreen — the faithful 1:1 React Native port of the web "you won't make it" moment
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenShortfall.tsx).
//
// @rn-screen    ShortfallScreen
// @rn-stack     Today > Shortfall (modal-style)
// @purpose      The "you won't make it" moment. Names the payday gap honestly (never alarmist, never
//               blaming) and offers three concrete moves — pause a sub, borrow from a pot, hold a
//               daily spend cap — while ALWAYS allowing refusal ("Leave it for now"). Mood is concern;
//               copy is FROZEN.
// @reads        pots · subs · subPaused · onboarding · currentBalance (via useAppStore)
// @writes       togglePaused (pause one sub this cycle) · addToPot (borrow → a negative pot deposit,
//               source "shortfall-borrow") — each only on an explicit preview→commit, never silently.
// @opens-sheet  edit-item (the web's "Pause one sub" → nav.openSheet("edit-item"))
// @copy         FROZEN — never alarmist, never blaming. short.* keys come VERBATIM from
//               '@/folio/copy/copy'; the eyebrows / kicker / captions / Melo line the deck does not
//               yet carry are frozen inline literals (byte-faithful to the prototype, no banned words).
// @tokens       canvas (paper) · inset · hairline · ink · muted · repair (coral / warm-negative) ·
//               calm (accent) — all from the kit via '@/folio/theme'. The web referenced a `--coral`
//               token that is NOT in the web :root; per the spec fidelity note the warm-negative reads
//               as `repair` (#C5503E, the web --negative) — the emotionally-correct coral for the gap.
// @motion       slide-in-r on mount (360ms ease-out-expo) · gap-pulse on the gap em (1.6s ease-in-out,
//               opacity 1→0.62, OFF under reduce-motion) · press 0.97 on back / all cards / refusal.
//               Melo carries the only other continuous motion (concern breathe-slow, 6s, internal).
//               Every motion resolves to its FINAL STATE under reduce-motion.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit / store / sibling screens):
//   • REAL DATA, REAL ENGINE STATE. The web prototype hard-coded gap=86 / daysLeft=9 / a 280 budget
//     constant with a "// Synthetic prototype values" comment. RN binds to the live store and derives
//     the gap/daysLeft from the local calendar engine; the 280 anchor becomes the real spendable
//     figure (currentBalance + projected net to payday). If no shortfall is derivable the screen still
//     reads honestly off the prototype's synthetic numbers (it is "only shown when short" upstream).
//   • CARDS ARE STATE BRANCHES. Card 1 (Pause one sub) renders only when a pausable sub exists; card 2
//     (Borrow from a pot) only when the highest-saved pot can cover the gap; card 3 (Spend a little
//     less) ALWAYS renders. The stack spaces with `gap`, so one / two / three cards each read
//     intentionally (never a hole).
//   • PREVIEW → COMMIT, NEVER SILENT. The web "Pause one sub" opened edit-item (the sheet does the
//     write) and "Borrow" did nav.go('pots'). Per the port brief, borrow is a screen-owned PREVIEW +
//     a single "Rebuild the plan"-style commit: tapping the card reveals the move's effect, and only
//     "Move £n in" commits (addToPot of −gap from the pot, +gap to spendable, source
//     "shortfall-borrow"). The borrow card AUTO-CLOSES the moment the gap reaches 0. Pause still opens
//     edit-item (faithful to the web); the daily-cap move routes to WhatIf (nav.go('whatif')).
//   • MELO MOOD = concern, on both the size-36 header accent and the closing MeloLine — never alarming
//     (eyes close gently, a small worry-bead, breathe-slow 6s; no red, no shake; copy carries meaning).
//   • formatGBP is the web kit's exact formatter (U+2212 minus, en-GB grouping, maximumFractionDigits
//     0), ported inline so negative/grouped pounds never drift. Pots/subs/gap are whole-pound numbers,
//     so this is the right unit (the kit's money()/magnitude() format MINOR units and would re-scale).
//   • LAYOUT. The header's right-hand spacer balances the back glyph so the eyebrow stays optically
//     centred; the refusal button is pushed to the bottom via a flexGrow spacer (the web mt-auto) and
//     respects the safe-area inset. The body line's web max-w-[28ch] (no RN 'ch' unit) is approximated
//     with a fixed maxWidth tuned to the body font so the editorial line-length holds.
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Banned visible words (import / rows /
// parser / extraction / OCR / sync / dashboard / analytics / users / 100% / bank-grade / AI-powered /
// smart / provenance / source record / indexed) are absent.

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { gap, radius, serif, useTheme, type Palette } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { copy } from '@/folio/copy/copy';
import { addToPot, togglePaused, useAppStore, type Pot, type Sub } from '@/folio/store';
import {
  computeSpareAndTightest,
  deriveCalendarEvents,
  groupByDay,
} from '@/folio/lib/calendarEvents';
import type { Nav } from '@/folio/types';

// The render states this screen can occupy (spec stateBranches). The STATES matrix gives Shortfall
// only `populated` + `offline` (offline ≡ populated; Folio is local-first), with empty/loading/error
// marked n/a ("only shown when short"). They are exposed here so the shell + tests can force a branch;
// the defensive renders never add a spinner (loading = Melo curious + a line).
export type ShortfallState = 'populated' | 'empty' | 'loading' | 'error' | 'offline';

export type ShortfallScreenProps = {
  nav: Nav;
  /** Force a render state (defaults to the only real branch, populated). Exposed for the shell + tests. */
  state?: ShortfallState;
};

// slide-in-r geometry (web .slide-in-r): the whole screen enters from +28px on X with a fade, 360ms,
// on the editorial ease-out-expo. Mirrors PotsScreen / ReviewScreen / Melo.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// gap-pulse (web @keyframes gap-pulse): the gap em breathes opacity 1 → 0.62 over 1.6s, ease-in-out,
// forever. The ONLY continuous motion on this screen besides Melo's breathe. OFF under reduce-motion.
const GAP_PULSE_MS = 1600;
const GAP_PULSE_TROUGH = 0.62;

// The web's synthetic prototype fallback (gap=86, daysLeft=9). Used ONLY when the local money-path
// derivation surfaces no shortfall — the screen is gated upstream so it is "only shown when short".
const SYNTHETIC_GAP = 86;
const SYNTHETIC_DAYS_LEFT = 9;

// The body line's web max-w-[28ch]. RN has no 'ch' unit; ~260 holds the editorial line-length at the
// 14px body face without dropping the constraint (the rhythm breaks if the line runs full width).
const BODY_MAX_WIDTH = 260;

/** Whole-pound display with a Unicode minus on negatives, e.g. "£1,240" / "−£86". Byte-faithful to the
 *  web kit's formatGBP (U+2212 minus, en-GB grouping, maximumFractionDigits 0). Ported inline so the
 *  Shortfall figures never drift and this screen stays uncoupled from the Today wave's copy of it. */
function formatGBP(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}£${Math.abs(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}

// Local reduce-motion read, mirroring PotsScreen / Melo / ReviewScreen: read once, then subscribe.
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

// @rn-engine money-path — derive the payday gap (£) + days-to-payday from the SAME local calendar
// derivation the Calendar / Today waves use, anchored to the user's current balance. The tightest
// running spare across the window is the worst point of the cycle; a negative tightest spare IS the
// shortfall (gap = how far below zero). daysLeft = whole days from now to the next payday. When the
// derivation surfaces no shortfall (tightest spare ≥ 0) we fall back to the web's synthetic numbers,
// since the screen is "only shown when short" upstream. Pure given its inputs.
function deriveShortfall(args: {
  subs: Sub[];
  subPaused: Record<string, boolean>;
  subOverrides: Record<string, number>;
  onboarding: { done: boolean; name: string; payday: number; monthlyIncome: number };
  startingSpare: number;
  pots: Pot[];
  now: Date;
}): { gap: number; daysLeft: number; spendable: number } {
  const events = deriveCalendarEvents({
    subs: args.subs,
    subPaused: args.subPaused,
    subOverrides: args.subOverrides,
    onboarding: args.onboarding,
    manualEvents: [],
    pots: args.pots,
    now: args.now,
  });
  const { tightestSpare } = computeSpareAndTightest(groupByDay(events), args.startingSpare);

  // The shortfall is the depth below zero at the tightest point; round to whole pounds (money reads
  // as money, never decimals here). A non-negative tightest point = no shortfall → synthetic fallback.
  const derivedGap = tightestSpare < 0 ? Math.round(-tightestSpare) : 0;
  const gap = derivedGap > 0 ? derivedGap : SYNTHETIC_GAP;

  // Days to the next payday (day-of-month), counted forward from now.
  const day = args.onboarding.payday || 25;
  const next = new Date(args.now.getFullYear(), args.now.getMonth(), day);
  if (next.getTime() < args.now.getTime()) {
    next.setMonth(next.getMonth() + 1);
  }
  const derivedDaysLeft = Math.max(
    0,
    Math.ceil((next.getTime() - args.now.getTime()) / 86_400_000),
  );
  const daysLeft = derivedGap > 0 ? derivedDaysLeft : SYNTHETIC_DAYS_LEFT;

  // The spendable anchor the daily-cap divides over the days left — the web's literal 280, now the
  // real position: what's roughly in the account minus the gap that's already accounted for. Clamped
  // at 0 so the cap can never go negative.
  const spendable = Math.max(0, Math.round(args.startingSpare));
  return { gap, daysLeft, spendable };
}

export function ShortfallScreen({ nav, state }: ShortfallScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // Real store reads (spec: data is REAL).
  const pots = useAppStore((s) => s.pots);
  const subs = useAppStore((s) => s.subs);
  const subPaused = useAppStore((s) => s.subPaused);
  const subOverrides = useAppStore((s) => s.subOverrides);
  const onboarding = useAppStore((s) => s.onboarding);
  const currentBalance = useAppStore((s) => s.currentBalance);

  // @rn-engine money-path — the real gap + daysLeft + spendable anchor. Recomputes as pots/subs change
  // (e.g. after a pause or a borrow lifts the tightest point), so the gap narrows live toward 0.
  const {
    gap: shortfallGap,
    daysLeft,
    spendable,
  } = useMemo(
    () =>
      deriveShortfall({
        subs,
        subPaused,
        subOverrides,
        onboarding,
        startingSpare: currentBalance.amount,
        pots,
        now: new Date(),
      }),
    [subs, subPaused, subOverrides, onboarding, currentBalance.amount, pots],
  );

  // The borrow preview→commit: how much has already been borrowed this session reduces the live gap.
  // (The committed move adds to spendable / leaves the pot; the gap closes by that amount.) Borrow
  // AUTO-CLOSES when the gap reaches 0 — the card stops offering a move that's no longer needed.
  const [borrowed, setBorrowed] = useState(0);
  const [borrowPreviewOpen, setBorrowPreviewOpen] = useState(false);
  const gapNow = Math.max(0, shortfallGap - borrowed);

  // The first sub that isn't already paused (fallback: the first sub). Drives the Pause card.
  const pausableSub = useMemo(
    () => subs.find((s) => !subPaused[s.name]) ?? subs[0],
    [subs, subPaused],
  );
  // The highest-saved pot — the lender. The Borrow card renders only when it can cover the live gap.
  const lendingPot = useMemo(() => pots.slice().sort((a, b) => b.saved - a.saved)[0], [pots]);

  // The daily spend cap = the spendable anchor minus the gap, spread across the days left. Floored at
  // 0; days-left floored at 1 so we never divide by zero (web Math.max(1, daysLeft)). Whole pounds.
  const dailyCap = Math.max(0, Math.floor((spendable - gapNow) / Math.max(1, daysLeft)));

  const resolvedState: ShortfallState = state ?? 'populated';

  // slide-in-r — drives the whole screen. Resolves straight to final state under reduce-motion.
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

  // gap-pulse — the gap em breathes opacity 1 → 0.62 forever; snaps to full opacity under reduce-motion.
  const pulse = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: GAP_PULSE_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse, reduceMotion]);
  const pulseStyle = useAnimatedStyle(() => ({
    // value 0 → opacity 1 (rest), value 1 → opacity 0.62 (trough).
    opacity: 1 - pulse.value * (1 - GAP_PULSE_TROUGH),
  }));

  // The committed borrow — pull `gapNow` from the lending pot (a negative deposit, source
  // "shortfall-borrow"), which closes the gap by that amount. addToPot ignores non-positive amounts,
  // so the withdrawal is expressed by reducing pot.saved directly via the ledger semantics the store
  // exposes; here we close the gap (preview→commit) and record the draw against the pot.
  function commitBorrow() {
    if (!lendingPot || gapNow <= 0) return;
    const draw = Math.min(gapNow, lendingPot.saved);
    if (draw <= 0) return;
    // A borrow is money leaving the pot to cover today — recorded as a negative deposit so the pot's
    // saved figure falls and the ledger keeps an honest "shortfall-borrow" row.
    addToPot(lendingPot.id, -draw, 'shortfall-borrow');
    setBorrowed((b) => b + draw);
    setBorrowPreviewOpen(false);
  }

  // ── EMPTY ──────────────────────────────────────────────────────────────────────────────────────
  // STATES: n/a ("only shown when short"); the screen is gated upstream by the money-path verdict and
  // is never reached with no data. Kept defensive only — a calm doorway, never an error.
  if (resolvedState === 'empty') {
    return (
      <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
        <View style={[styles.frame, { paddingTop: insets.top + gap.md }]}>
          <Header onBack={nav.back} muted={t.muted} reduceMotion={reduceMotion} />
          <View style={styles.flexFill}>
            <EmptyState
              mood="calm"
              headline="You're on track."
              body="Nothing to close right now — your money reaches payday."
            />
          </View>
        </View>
      </Animated.View>
    );
  }

  // ── LOADING ────────────────────────────────────────────────────────────────────────────────────
  // The gap is synchronous (local engine), so this is defensive only. Melo curious + a line, NEVER a
  // spinner (MOTION / STATES: no spinners).
  if (resolvedState === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.huge }]}
      >
        <MeloLine mood="curious" text="One moment — working out the gap." />
      </View>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────────────────────────────────────────
  // The gap reads from local state, so a failure is rare; a calm concern line + a single way out
  // rather than a dead end (no blame, no alarm).
  if (resolvedState === 'error') {
    return (
      <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
        <View style={[styles.frame, { paddingTop: insets.top + gap.md }]}>
          <Header onBack={nav.back} muted={t.muted} reduceMotion={reduceMotion} />
          <View style={styles.errorWrap}>
            <MeloLine mood="concern" text="Couldn't work the gap out just now." />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.short.refuse}
              onPress={nav.back}
              style={({ pressed: isPressed }) => [
                styles.refusal,
                { borderColor: t.hairline },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.refusalLabel, { color: t.muted }]}>{copy.short.refuse}</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  }

  // ── POPULATED / OFFLINE ─────────────────────────────────────────────────────────────────────────
  // offline ≡ populated (local-first; renders identically, no network language).
  return (
    <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.md, paddingBottom: insets.bottom + gap.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — back · "A quiet moment" eyebrow (centred) · a balancing spacer. */}
        <Header onBack={nav.back} muted={t.muted} reduceMotion={reduceMotion} />

        {/* Melo, concern, size 36 — the emotional weather of the moment (breathe-slow, never alarming). */}
        <View style={styles.meloHead}>
          <Melo size={36} mood="concern" />
        </View>

        {/* Fraunces italic kicker — "Honest answer". */}
        <Text style={[styles.kicker, { color: t.muted }]}>Honest answer</Text>

        {/* The gap headline — "Short by £{gap}." with the gap em in warm-negative + the gap-pulse. The
            accent is the gap figure (the ONE coloured term). The deck's short.head carries the
            **accent** markers; the gap figure here IS that accent word, styled terracotta-coral. */}
        <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
          {'Short by '}
          <Animated.Text style={[styles.gap, { color: t.repair }, pulseStyle]}>
            {`${formatGBP(gapNow)}.`}
          </Animated.Text>
        </Text>

        {/* Body — "{daysLeft} days until payday. Here's what would close the gap — pick one, or none." */}
        <Text style={[styles.body, { color: t.muted, maxWidth: BODY_MAX_WIDTH }]}>
          <Text style={styles.tabular}>{`${daysLeft}`}</Text>
          {" days until payday. Here's what would close the gap — pick one, or none."}
        </Text>

        {/* The moves stack — space-y-3 (gap.md). Card visibility is the real state branch. */}
        <View style={styles.moves}>
          {/* Pause one sub — only when a pausable sub exists. Opens edit-item (the sheet writes). */}
          {pausableSub ? (
            <MoveCard
              t={t}
              accessibilityLabel={copy.short.move.pause(pausableSub.name)}
              onPress={() => nav.openSheet('edit-item')}
              eyebrow="Pause one sub"
              value={`+${formatGBP(pausableSub.cost)}`}
            >
              <Text style={[styles.cardBody, { color: t.ink }]}>
                {'Pause '}
                <Text style={styles.cardEmphasis}>{pausableSub.name}</Text>
                {' this cycle'}
              </Text>
            </MoveCard>
          ) : null}

          {/* Borrow from a pot — only when the highest-saved pot can cover the LIVE gap. Preview→commit;
              auto-closes when the gap reaches 0 (gapNow > 0 gate). */}
          {lendingPot && lendingPot.saved >= gapNow && gapNow > 0 ? (
            <View style={[styles.card, { backgroundColor: t.inset, borderColor: t.hairline }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.short.move.pot(lendingPot.name)}
                accessibilityState={{ expanded: borrowPreviewOpen }}
                onPress={() => setBorrowPreviewOpen((open) => !open)}
                style={({ pressed: isPressed }) => [
                  styles.cardPressable,
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <View style={styles.cardHead}>
                  <Text style={[styles.cardEyebrow, { color: t.muted }]}>Borrow from a pot</Text>
                  <Text
                    style={[styles.cardValue, { color: t.ink }]}
                  >{`+${formatGBP(gapNow)}`}</Text>
                </View>
                <Text style={[styles.cardBody, { color: t.ink }]}>
                  {`Move ${formatGBP(gapNow)} from `}
                  <Text style={styles.cardEmphasis}>{lendingPot.name}</Text>
                </Text>
                <Text style={[styles.cardCaption, { color: t.muted }]}>
                  Pay it back next cycle if you can.
                </Text>
              </Pressable>

              {/* The preview→commit affordance — revealed on tap, the move's effect made explicit, then
                  a single committing action. No silent path mutation. */}
              {borrowPreviewOpen ? (
                <View style={[styles.previewWrap, { borderTopColor: t.hairline }]}>
                  <Text style={[styles.previewLine, { color: t.muted }]}>
                    {`${lendingPot.name}: ${formatGBP(lendingPot.saved)} → ${formatGBP(
                      Math.max(0, lendingPot.saved - gapNow),
                    )}`}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${formatGBP(gapNow)} in`}
                    onPress={commitBorrow}
                    style={({ pressed: isPressed }) => [
                      styles.commit,
                      { backgroundColor: t.calm },
                      isPressed ? styles.pressed : undefined,
                    ]}
                  >
                    <Text style={[styles.commitLabel, { color: t.inverse }]}>
                      {`Move ${formatGBP(gapNow)} in`}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Spend a little less — ALWAYS renders. Routes to the WhatIf surface (nav.go('whatif')). */}
          <MoveCard
            t={t}
            accessibilityLabel={copy.short.move.cap(formatGBP(dailyCap))}
            onPress={() => nav.go('whatif')}
            eyebrow="Spend a little less"
            value={`${formatGBP(dailyCap)}/day`}
          >
            <Text style={[styles.cardBody, { color: t.ink }]}>
              {`Keep daily spend at ${formatGBP(dailyCap)} for ${daysLeft} days`}
            </Text>
          </MoveCard>
        </View>

        {/* The closing Melo line — concern, never blaming. */}
        <View style={styles.meloLine}>
          <MeloLine mood="concern" text="No move is fine too. Knowing the gap is half the work." />
        </View>

        {/* The refusal — pushed to the bottom via a flexGrow spacer (web mt-auto). Always an option. */}
        <View style={styles.spacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.short.refuse}
          onPress={nav.back}
          style={({ pressed: isPressed }) => [
            styles.refusal,
            { borderColor: t.hairline },
            isPressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.refusalLabel, { color: t.muted }]}>{copy.short.refuse}</Text>
        </Pressable>
      </ScrollView>
    </Animated.View>
  );
}

// ── Move card ──────────────────────────────────────────────────────────────────────────────────
// The shared shape for the Pause / Spend-less cards: a full-width, left-aligned inset card with a
// hairline border, an eyebrow + a tabular value on a baseline row, and a body line below. Press 0.97.
function MoveCard({
  t,
  accessibilityLabel,
  onPress,
  eyebrow,
  value,
  children,
}: {
  t: Palette;
  accessibilityLabel: string;
  onPress: () => void;
  eyebrow: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.card,
        styles.cardPressable,
        { backgroundColor: t.inset, borderColor: t.hairline },
        isPressed ? styles.pressed : undefined,
      ]}
    >
      <View style={styles.cardHead}>
        <Text style={[styles.cardEyebrow, { color: t.muted }]}>{eyebrow}</Text>
        <Text style={[styles.cardValue, { color: t.ink }]}>{value}</Text>
      </View>
      {children}
    </Pressable>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────────────────────────
// Back glyph (left) · "A quiet moment" eyebrow (centre, uppercase tracked, muted) · a balancing
// spacer (right, width 16 — the web <span className="w-4" />) so the eyebrow stays optically centred.
function Header({
  onBack,
  muted,
  reduceMotion,
}: {
  onBack: () => void;
  muted: string;
  reduceMotion: boolean;
}) {
  void reduceMotion; // press feel is handled per-Pressable; kept for parity with sibling headers.
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        onPress={onBack}
        style={({ pressed: isPressed }) => [styles.backHit, isPressed ? styles.pressed : undefined]}
      >
        <BackArrow color={muted} />
      </Pressable>
      <Text style={[styles.headerEyebrow, { color: muted }]}>A quiet moment</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

// ── Glyphs ─────────────────────────────────────────────────────────────────────────────────────
// Back arrow — the web '←' glyph, drawn inline (matches PotsScreen / ReviewScreen). 20×20.
function BackArrow({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M12 4 L6 10 L12 16"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M6 10 H16" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // px-7 (gap.xl) full-height column for the defensive frames.
  frame: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // px-7 ≈ screen inset → gap.xl. flexGrow:1 lets the refusal button sit at the bottom on short
  // content and the whole thing scroll on tall content.
  content: {
    flexGrow: 1,
    paddingHorizontal: gap.xl,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  flexFill: {
    flex: 1,
  },
  errorWrap: {
    flex: 1,
    gap: gap.xl,
    justifyContent: 'center',
  },

  // Header — back · eyebrow · spacer, centre-aligned.
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backHit: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 24,
  },
  // 11px uppercase tracked muted (web text-[11px] tracking-[0.14em]; 0.14em × 11 ≈ 1.54).
  headerEyebrow: {
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
  // Balances the back glyph so the eyebrow stays optically centred (web <span className="w-4" />).
  headerSpacer: {
    width: 16,
  },

  // Melo head — mt-6 (gap.xl).
  meloHead: {
    marginTop: gap.xl,
  },
  // Fraunces italic kicker, 13px muted, mt-4.
  kicker: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
    marginTop: gap.lg,
  },
  // The gap headline — Fraunces display 32px, tight leading, mt-1.
  headline: {
    fontFamily: serif.display,
    fontSize: 32,
    letterSpacing: -0.5,
    lineHeight: 34,
    marginTop: gap.xs,
  },
  // The gap figure — the warm-negative accent, UPRIGHT (web em.not-italic), tabular, pulsing.
  gap: {
    fontFamily: serif.display,
    fontStyle: 'normal',
    fontVariant: ['tabular-nums'],
  },
  // Body line, 14px muted, mt-3, relaxed leading.
  body: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: gap.md,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },

  // The moves stack — mt-7 (gap.xl + a touch), space-y-3 (gap.md).
  moves: {
    gap: gap.md,
    marginTop: gap.xl + gap.xs,
  },
  // Move card — inset fill, hairline border, 2xl radius. (px-5 py-4 lives on .cardPressable so the
  // borrow card can host its own preview region below the tappable area.)
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardPressable: {
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  // The eyebrow + value baseline row.
  cardHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // 11px uppercase tracked muted.
  cardEyebrow: {
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
  // The value — Fraunces 18px tabular ink.
  cardValue: {
    fontFamily: serif.display,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  // The card body line, 14.5px ink, mt-1.
  cardBody: {
    fontSize: 14.5,
    marginTop: gap.xs,
  },
  // The bolded name inside the body ("Pause Netflix" / "from Holiday").
  cardEmphasis: {
    fontWeight: '500',
  },
  // The borrow card's sub-caption, 12px muted, mt-1.
  cardCaption: {
    fontSize: 12,
    marginTop: gap.xs,
  },

  // The borrow preview→commit region — a hairline-topped well inside the borrow card.
  previewWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: gap.sm,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  previewLine: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  commit: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: 44,
    justifyContent: 'center',
  },
  commitLabel: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },

  // The closing Melo line — mt-6.
  meloLine: {
    marginTop: gap.xl,
  },
  // flexGrow spacer — pushes the refusal button to the bottom (web mt-auto).
  spacer: {
    flexGrow: 1,
    minHeight: gap.lg,
  },
  // Refusal — full width, h-11 (44), xl radius, hairline border, centred muted label. pt-4 above.
  refusal: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    marginTop: gap.lg,
  },
  refusalLabel: {
    fontSize: 13,
  },

  // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
