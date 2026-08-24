// @rn-engine money-path — the gap (£) + days-to-payday verdict and the tight-point recompute are the
// real money-path engine (ENGINES §6), read through the shared `useRoute` bridge
// (@/folio/lib/storeRoute → computeRoute) exactly as Today and the Calendar read it, so every surface
// computes the same curve. The gap is the depth of the route's tight point below zero
// (max(0, −route.tightPoint.amount)); daysLeft is route.daysToPayday; the spendable anchor the daily
// cap divides over is route.spare (the balance on payday). The borrow card's `lendingPot.saved >= gap`
// gate, the dailyCap formula, and the borrow preview→commit math all read these engine numbers — never
// a hard-coded literal. Borrow LIFTS the route (a "shortfall-borrow" draw lowers pot.saved → less
// earmarked cash → the recomputed tight point rises); Shortfall AUTO-CLOSES the borrow move the moment
// that recomputed tight point reaches 0.
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
// @reads        pots · subs · subPaused (via useAppStore) · the route (gap · daysLeft · spendable) via
//               the shared useRoute bridge, which reads balance/subs/income/pots/onboarding itself.
// @writes       borrowFromPot (source "shortfall-borrow") — only on an explicit preview→commit, never
//               silently. The Pause move opens edit-item (the sheet writes). The borrow draw lifts the
//               route, which narrows the gap on the next render.
// @opens-sheet  edit-item (the web's "Pause one sub" → nav.openSheet("edit-item"))
// @copy         FROZEN — never alarmist, never blaming. short.* keys come VERBATIM from
//               '@/folio/copy/copy'; the eyebrows / kicker / captions / Melo line the deck does not
//               yet carry are frozen inline literals (byte-faithful to the prototype, no banned words).
// @tokens       canvas (paper) · inset · hairline · ink · muted · repair (coral / warm-negative) ·
//               calm (accent) — all from the kit via '@/folio/theme'. The web referenced a `--coral`
//               token that is NOT in the web :root; per the spec fidelity note the warm-negative reads
//               as `repair` (#C0503E, the web --negative) — the emotionally-correct coral for the gap.
// @motion       slide-in-r on mount (360ms ease-out-expo) · gap-pulse on the gap em (1.6s ease-in-out,
//               opacity 1→0.62, OFF under reduce-motion) · press 0.97 on back / all cards / refusal.
//               Melo carries the only other continuous motion (concern breathe-slow, 6s, internal).
//               Every motion resolves to its FINAL STATE under reduce-motion.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit / store / sibling screens):
//   • REAL DATA, REAL ENGINE STATE. The web prototype hard-coded gap=86 / daysLeft=9 / a 280 budget
//     constant with a "// Synthetic prototype values" comment. RN binds to the live store and reads
//     the gap/daysLeft/spendable straight off the real route engine (useRoute → computeRoute): the gap
//     is how far the route's tight point sits below zero, daysLeft is route.daysToPayday, and the 280
//     anchor becomes route.spare (the balance on payday). The screen is gated upstream so it is "only
//     shown when short"; the empty branch is the calm doorway for the no-gap case.
//   • CARDS ARE STATE BRANCHES. Card 1 (Pause one sub) renders only when a pausable sub exists; card 2
//     (Borrow from a pot) only when the highest-saved pot can cover the gap; card 3 (Spend a little
//     less) ALWAYS renders. The stack spaces with `gap`, so one / two / three cards each read
//     intentionally (never a hole).
//   • PREVIEW → COMMIT, NEVER SILENT. The web "Pause one sub" opened edit-item (the sheet does the
//     write) and "Borrow" did nav.go('pots'). Per the port brief, borrow is a screen-owned PREVIEW +
//     a single "Rebuild the plan"-style commit: tapping the card reveals the move's effect, and only
//     "Move £n in" commits (borrowFromPot of gapNow from the pot, source "shortfall-borrow" — the
//     dedicated borrow write; NOT addToPot with a negative amount, which addToPot's `amount > 0` guard
//     silently no-ops). That draw lowers the pot's earmarked cash, which LIFTS the route — so on the
//     next render the recomputed tight point has risen and the live gap (max(0, −tightPoint)) has
//     narrowed. The borrow card AUTO-CLOSES the moment that recomputed gap reaches 0. Pause still opens
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { ScreenHeader } from '@/folio/ui/ScreenHeader';
import { copy } from '@/folio/copy/copy';
import { borrowFromPot, useAppStore } from '@/folio/store';
import { useRoute } from '@/folio/lib/storeRoute';
import { deriveCalendarEvents, type DerivedEvent } from '@/folio/lib/calendarEvents';
import { getShortfallCopy } from '@/folio/lib/modes/action';
import { triggerFeedback } from '@/folio/lib/feedback';
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

// A stable sentinel "now" for the one render before the mount-gate opens. `useRoute` can't be called
// conditionally, so it runs against this until `now` is set; that transient frame is discarded
// (`route = null`). Module-level so its identity never churns the hook's memo. Mirrors TodayScreen.
const EPOCH = new Date(0);

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

function formatShortfallDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
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

export function ShortfallScreen({ nav, state }: ShortfallScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // Real store reads (spec: data is REAL). balance/onboarding/income/pots/subs feed the route INSIDE
  // `useRoute`; the slices this screen uses outside the route (the Pause + Borrow card subjects) stay.
  const pots = useAppStore((s) => s.pots);
  const subs = useAppStore((s) => s.subs);
  const subPaused = useAppStore((s) => s.subPaused);
  const appState = useAppStore((s) => s);
  const soundEnabled = useAppStore((s) => s.melo?.soundEnabled === true);
  const quietMode = useAppStore((s) => s.melo?.quietMode === true);
  // Mode-aware copy (web getShortfallCopy(mode)) — every string on this screen tints by the user's
  // moneyMode, mirroring ScreenShortfall.tsx exactly. Falls back to 'survival' copy when unset.
  const moneyMode = useAppStore((s) => s.moneyMode ?? 'survival');
  const modeCopy = getShortfallCopy(moneyMode);

  // Mount-gate (mirrors TodayScreen): defer `new Date()` so the route's "today" is honest and nothing
  // reads the clock on the first frame. `useRoute` can't be called conditionally, so it always runs
  // against `now ?? EPOCH`; the pre-gate transient is discarded (`route = null`) for that one frame.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  // @rn-engine money-path — the REAL route, via the shared `useRoute` bridge (@/folio/lib/storeRoute →
  // computeRoute), the same curve Today and the Calendar read. Recomputes as pots/subs change, so a
  // pause or a borrow that lifts the route narrows the gap live toward 0 on the next render.
  const routeResult = useRoute(now ?? EPOCH);
  const route = now ? routeResult : null;

  // The gap is the depth of the route's tight point below zero (whole pounds — money reads as money);
  // daysLeft is route.daysToPayday; the spendable anchor the daily cap divides over is route.spare
  // (the balance on payday). Before the mount-gate opens (`route === null`) the screen has no honest
  // "today" yet, so the figures rest at 0 for that single frame (the screen is gated upstream so it is
  // "only shown when short", and the populated branch never flashes a different number on a real open).
  const gapNow = route ? Math.max(0, Math.round(-route.tightPoint.amount)) : 0;
  const daysLeft = route ? route.daysToPayday : 0;
  const spendable = route ? Math.max(0, Math.round(route.spare)) : 0;

  // The borrow preview→commit is a single store write; the route recompute (not a screen-local
  // counter) is what narrows the gap. Borrow AUTO-CLOSES when the recomputed tight point reaches 0
  // (the `gapNow > 0` gate on the card), so the move disappears the moment it is no longer needed.
  const [borrowPreviewOpen, setBorrowPreviewOpen] = useState(false);

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

  // The route gives us the low date; the shared Calendar derivation gives us the honest event that
  // created that dip. Keeping this read on the same event authority prevents Shortfall from inventing
  // a cause or silently disagreeing with Calendar/Today.
  const tightEvent = useMemo<DerivedEvent | null>(() => {
    if (!route || !now) return null;
    // routeFromStore normalises its local day to UTC midnight before asking Calendar for events. Use
    // that same anchor here so the cause lookup cannot drift around a local/UTC midnight boundary.
    const calendarNow = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const events = deriveCalendarEvents({
      subs: appState.subs,
      subPaused: appState.subPaused,
      subOverrides: appState.subOverrides,
      onboarding: appState.onboarding,
      manualEvents: appState.calendarEvents,
      pots: appState.pots,
      incomeSources: appState.incomeSources ?? [],
      spendHold: appState.spendHold ?? null,
      whatIfHolds: appState.whatIfHolds ?? [],
      windowDays: 35,
      now: calendarNow,
      includeSampleBills: appState.currentBalance.source === 'sample',
    });
    return (
      events
        .filter(
          (event) =>
            event.date === route.tightPoint.date &&
            typeof event.amount === 'number' &&
            event.amount < 0,
        )
        .sort((left, right) => Math.abs(right.amount ?? 0) - Math.abs(left.amount ?? 0))[0] ?? null
    );
  }, [appState, now, route]);

  const tightDateLabel = route
    ? formatShortfallDate(route.tightPoint.date)
    : 'the next payday horizon';
  const causeLine = tightEvent
    ? tightEvent.source === 'sub' && tightEvent.subName
      ? `A recurring payment from ${tightEvent.subName} lands in that stretch.`
      : `${tightEvent.title} is one of the outgoings in that stretch.`
    : 'Your current balance runs out before the next payday.';
  const recoverabilityLine =
    lendingPot && lendingPot.saved >= gapNow && gapNow > 0
      ? `${lendingPot.name} could cover the whole gap.`
      : pausableSub
        ? `Pausing ${pausableSub.name} is the first named move in hand.`
        : `A daily cap is the clearest move in hand for ${daysLeft} days.`;

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
  // "shortfall-borrow"). The draw lowers the pot's earmarked cash, which LIFTS the route; on the next
  // render the recomputed tight point has risen and `gapNow` has narrowed by that amount (no
  // screen-local counter — the engine is the source of truth). When the recomputed tight point reaches
  // 0 the borrow card auto-closes (its `gapNow > 0` gate).
  function commitBorrow() {
    if (!lendingPot || gapNow <= 0) return;
    const draw = Math.min(gapNow, lendingPot.saved);
    if (draw <= 0) return;
    // A borrow is money leaving the pot to cover today — `borrowFromPot` lowers the pot's saved
    // figure and writes an honest "shortfall-borrow" ledger row (unlike addToPot, whose `amount > 0`
    // guard would silently no-op on a negative draw).
    borrowFromPot(lendingPot.id, draw, 'shortfall-borrow');
    setBorrowPreviewOpen(false);
  }

  // Relief/cheer auto-close (web ScreenShortfall.tsx `relief` effect) — the moment the recomputed gap
  // reaches £0 (from a prior >0), Melo briefly switches to "cheer", the closing line reads "Gap
  // closed...", and the screen auto-navigates back after 1400ms. Guarded so it only fires on the
  // 0-crossing (prevGap > 0 → gap === 0), never on a fresh mount that starts at 0.
  const [relief, setRelief] = useState(false);
  const prevGapRef = useRef(gapNow);
  useEffect(() => {
    if (prevGapRef.current > 0 && gapNow === 0) {
      setRelief(true);
      void triggerFeedback('shortfall-closed', {
        soundEnabled,
        quietMode,
      });
      const id = setTimeout(() => {
        setRelief(false);
        nav.back();
      }, 1400);
      return () => clearTimeout(id);
    }
    prevGapRef.current = gapNow;
    return undefined;
  }, [gapNow, nav, quietMode, soundEnabled]);
  const meloMood = relief ? 'cheer' : 'concern';

  // ── EMPTY ──────────────────────────────────────────────────────────────────────────────────────
  // STATES: n/a ("only shown when short"); the screen is gated upstream by the money-path verdict and
  // is never reached with no data. Kept defensive only — a calm doorway, never an error.
  if (resolvedState === 'empty') {
    return (
      <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
        <View style={[styles.frame, { paddingTop: insets.top + gap.md }]}>
          <ScreenHeader
            onBack={nav.back}
            eyebrow="A quiet moment"
            spacerWidth={16}
            backHitWidth={24}
            eyebrowSize={11}
            eyebrowTracking={1.54}
          />
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
          <ScreenHeader
            onBack={nav.back}
            eyebrow="A quiet moment"
            spacerWidth={16}
            backHitWidth={24}
            eyebrowSize={11}
            eyebrowTracking={1.54}
          />
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
        {/* Header — back · mode-tinted eyebrow (centred) · a balancing spacer. */}
        <ScreenHeader
          onBack={nav.back}
          eyebrow={modeCopy.eyebrow}
          spacerWidth={16}
          backHitWidth={24}
          eyebrowSize={11}
          eyebrowTracking={1.54}
        />

        {/* Melo — mode-honest to the gap; briefly "cheer" on the relief close (web meloMood). */}
        <View style={styles.meloHead}>
          <Melo size={36} mood={meloMood} />
        </View>

        {/* Fraunces italic kicker — mode-tinted (web copy.intro). */}
        <Text style={[styles.kicker, { color: t.muted }]}>{modeCopy.intro}</Text>

        {/* The gap headline — "{headlineLead} £{gap}." with the gap em in warm-negative + the
            gap-pulse. The accent is the gap figure (the ONE coloured term); headlineLead tints by
            moneyMode (web copy.headlineLead). */}
        <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
          {`${modeCopy.headlineLead} `}
          <Animated.Text style={[styles.gap, { color: t.repair }, pulseStyle]}>
            {`${formatGBP(gapNow)}.`}
          </Animated.Text>
        </Text>

        {/* Body — "{daysLeft} days until payday. Here's what would close the gap — pick one, or none." */}
        <Text style={[styles.body, { color: t.muted, maxWidth: BODY_MAX_WIDTH }]}>
          <Text style={styles.tabular}>{`${daysLeft}`}</Text>
          {" days until payday. Here's what would close the gap — pick one, or none."}
        </Text>

        {/* A calm severity read: when the low lands, the native event that contributes to it, and the
            strongest recoverability already present in the user's data. This is deliberately an
            editorial hairline group, not a red warning card. */}
        <View style={[styles.shortfallRead, { borderColor: t.hairline }]}>
          <ShortfallReadRow label="When" value={tightDateLabel} t={t} />
          <ShortfallReadRow label="In the path" value={causeLine} t={t} />
          <ShortfallReadRow label="Room to move" value={recoverabilityLine} t={t} last />
        </View>

        {/* The moves stack — space-y-3 (gap.md). Card visibility is the real state branch. */}
        <View style={styles.moves}>
          {/* Pause one sub — only when a pausable sub exists. Opens edit-item (the sheet writes). */}
          {pausableSub ? (
            <MoveCard
              t={t}
              accessibilityLabel={copy.short.move.pause(pausableSub.name)}
              onPress={() => nav.openSheet('edit-item')}
              eyebrow={modeCopy.pauseLabel}
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
                  <Text style={[styles.cardEyebrow, { color: t.muted }]}>{modeCopy.potLabel}</Text>
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
            eyebrow={modeCopy.holdLabel}
            value={`${formatGBP(dailyCap)}/day`}
          >
            <Text style={[styles.cardBody, { color: t.ink }]}>
              {`Keep daily spend at ${formatGBP(dailyCap)} for ${daysLeft} days`}
            </Text>
          </MoveCard>
        </View>

        {/* The closing Melo line — mode-tinted; reads the relief line the instant the gap closes,
            mirroring web's `relief ? "Gap closed..." : copy.meloDefault`. */}
        <View style={styles.meloLine}>
          <MeloLine
            mood={meloMood}
            text={relief ? "Gap closed. I'll keep watching the path." : modeCopy.meloDefault}
          />
        </View>

        {/* The refusal — pushed to the bottom via a flexGrow spacer (web mt-auto). Always an option;
            label tints by mode (web copy.leaveIt). */}
        <View style={styles.spacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={modeCopy.leaveIt}
          onPress={nav.back}
          style={({ pressed: isPressed }) => [
            styles.refusal,
            { borderColor: t.hairline },
            isPressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.refusalLabel, { color: t.muted }]}>{modeCopy.leaveIt}</Text>
        </Pressable>
      </ScrollView>
    </Animated.View>
  );
}

function ShortfallReadRow({
  label,
  value,
  t,
  last = false,
}: {
  label: string;
  value: string;
  t: Palette;
  last?: boolean;
}) {
  return (
    <View style={[styles.shortfallReadRow, last ? undefined : { borderBottomColor: t.hairline }]}>
      <Text style={[styles.shortfallReadLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.shortfallReadValue, { color: t.ink }]}>{value}</Text>
    </View>
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

  // A calm, editorial read between the gap and the possible moves. It deliberately uses rules and
  // whitespace rather than another rounded warning card, while keeping each fact legible on small
  // widths and at larger text scales.
  shortfallRead: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: gap.lg,
    paddingVertical: gap.xs,
  },
  shortfallReadRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: gap.xs,
    paddingVertical: gap.sm,
  },
  shortfallReadLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  shortfallReadValue: {
    fontSize: 13,
    lineHeight: 18,
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
