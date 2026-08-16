/**
 * @rn-screen    TodayScreen
 * @rn-stack     MainTabs > Today
 * @purpose      One-screen answer to "will my money last to payday?" — tight-point number,
 *               money-path SVG with scrub preview, proactive nudges, weekly tiles, recent spend.
 *               Faithful 1:1 RN port of the web design source
 *               (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenToday.tsx).
 * @reads        pressure (mood band), pots/subs/transactions/onboarding/cycles/currentBalance/
 *               routeFocusDate (via the store + child components)
 * @writes       setRouteFocusDate(null) (consume-once) · sweepSubOverrides() (mount) · removeTransaction (child)
 * @opens-sheet  onboarding, log-spend, melo-chat (via nav.openSheet / nav.openMelo), afford-check +
 *               safe-zone (the flagship-check doors under the hero)
 * @copy         FROZEN — every visible string ships verbatim (pressureLine / copy deck).
 * @tokens       paper(canvas) · surface · inset · ink · muted · hairline · calm(accent) ·
 *               calmSoft(accent-soft) · positive · caution · repair(negative) · Fraunces headlines ·
 *               tabular money
 * @motion       route-draw 2.2s · count-up 400ms · pulse-ring 1.8s · callout-in 600ms ·
 *               press .98 · slide-in-r 360ms · respects reduce-motion (all collapse to final state)
 * @melo-mood    derived from pressure via pressureMood (reconciled to the canonical Melo vocabulary)
 * @notes        Path SVG is the hero — the scrub thumb maps a Pan gesture x → "if you spend £X today"
 *               preview and re-targets the count-up. The path nodes / '27 Jun' / '7 Jul' / '£2,180' /
 *               '£1,095' / '£1,240' figures are HARDCODED placeholders in the prototype (only
 *               tightestSpare/tightestDate + balance source + the child sums are live), kept honest
 *               by the sample-data chip + balance-source caption. Sub-components live in ./today/.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  elevation,
  gap,
  PressureScreen,
  pressed,
  radius,
  serif,
  useCountUp,
  useTheme,
  type Palette,
} from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import {
  hasConfiguredMoneyPicture,
  currentFinancialDate,
  recordOneMoveDismissed,
  recordOneMoveShown,
  recordOneMoveTapped,
  logSubCheckIn,
  resolveOneMoveOutcomes,
  setMeloPrimerBeat,
  setMeloPrimerSeen,
  useAppStore,
  setRouteFocusDate,
  sweepAutoResumeNow,
  sweepSubOverrides,
  touchOpened,
} from '@/folio/store';
import { useRoute } from '@/folio/lib/storeRoute';
import {
  buildTrustedSafeRangeFromAppState,
  formatTrustedSafeRangePounds,
  trustedSafeRangeHeadline,
  trustedSafeRangeSummaryLine,
} from '@/folio/lib/trustedSafeRange';
import { resolveNextTopUp } from '@/folio/lib/potCadence';
import { deriveModeState, type MoneyMode } from '@/folio/lib/modes';
import { deriveOneMove } from '@/folio/lib/melo/oneMove';
import { poseForContext } from '@/folio/lib/melo/poseForContext';
import { DISMISS_CHOICES, type DismissReason } from '@/folio/lib/melo/dismissReasons';
import { subDueForCheckIn } from '@/folio/lib/melo/checkIn';
import { deriveWhisper } from '@/folio/lib/melo/whisper';
import { computeGreenStreak } from '@/folio/lib/streaks';
import { triggerFeedback } from '@/folio/lib/feedback';
import { useLens } from '@/folio/lib/lens';
import {
  MeloCompanionExclusion,
  MeloCompanionPerch,
  useMeloCompanionScrollHandlers,
} from '@/folio/companion/MeloCompanionHost';
import { MoneyModeChip } from '@/folio/ui/MoneyModeChip';
import { MeloWeatherGlyph } from '@/folio/ui/MeloWeatherGlyph';
import { TrialCountdownChip } from '@/folio/ui/TrialCountdownChip';
import { TrialEndedRow } from '@/folio/ui/TrialEndedRow';
import { WhatChangedRow } from '@/folio/ui/WhatChangedRow';
import type { Nav, Pressure, ScreenId } from '@/folio/types';
import { addDaysToLocalDate, type TrustedSafeRangeResult } from '@folio/domain';

import { pressureLine, pressureLow } from './today/pressure';
import { formatDayProse, formatGBP, groupedPounds } from './today/format';
import { TodayNudges } from './today/TodayNudges';
import { TodaySpendStrip } from './today/TodaySpendStrip';
import { TodayRecentTxns } from './today/TodayRecentTxns';
import { TodayWeekTiles } from './today/TodayWeekTiles';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

// The SVG is authored in the web's 400×240 user space; react-native-svg scales it to the card width
// via the viewBox, so every coordinate below is the web coordinate, unchanged.
const VB_W = 400;
const VB_H = 240;
const SVG_RENDER_H = 200; // the web rendered the 400×240 viewBox into a 200px-tall box
const ROUTE_DASH = 1200; // >= the actual path length so route-draw never clips
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// A stable sentinel "now" for the one render before the mount-gate opens. `useRoute` can't be
// called conditionally, so it runs against this until `now` is set; the result is discarded
// (`route = null`) that frame. Module-level so its identity never churns the hook's memo.
const EPOCH = new Date(0);

type ScreenState = 'populated' | 'loading' | 'error' | 'offline';

export function TodayScreen({
  nav,
  pressure,
  state = 'populated',
}: {
  nav: Nav;
  /** The route pressure mood. The web read this off `nav.pressure`; the RN Nav contract has no
   *  pressure, so the shell threads it explicitly. */
  pressure: Pressure;
  /** STATES.md branch. 'populated' (happy) · 'loading' (no spinner — mount gate handles the only
   *  transient) · 'error' (a dismissible non-blocking banner OVER populated content) · 'offline'
   *  (same as populated — Folio is local-first). Defaults to 'populated'. */
  state?: ScreenState;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const companionScroll = useMeloCompanionScrollHandlers();

  const line = pressureLine[pressure];

  // Live store reads. Today's tightest mirrors the Route/Calendar exactly — but the route inputs
  // (subs/subPaused/subOverrides/transactions/income/balance/pots) are now read inside `useRoute`,
  // the shared store→money-path bridge, so every screen computes the same curve. Only the slices
  // this screen reads OUTSIDE the route stay here.
  const appState = useAppStore((st) => st);
  const onboarding = useAppStore((st) => st.onboarding);
  const pots = useAppStore((st) => st.pots);
  const routeFocusDate = useAppStore((st) => st.routeFocusDate);
  const currentBalance = useAppStore((st) => st.currentBalance);
  // Lens (Money Mode) + weather chip + trial/paywall-lock pill — mirrors TodayModeScreen /
  // TodayStabilityScreen (PARITY_GAPS.md Group 1: the primary Survival Today was missing all of
  // these, unlike its two siblings).
  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);
  const subCheckIns = useAppStore((st) => st.subCheckIns ?? {});
  const bufferAmount = useAppStore((st) => st.bufferAmount ?? 100);
  const moneyMode = useAppStore((st) => st.moneyMode ?? 'survival');
  const hasMoneyPicture = useAppStore(hasConfiguredMoneyPicture);
  // A fresh or deliberately-cleared ledger is a real product state, not permission to render the
  // sample route as if it were the user's money. Keep the doorway useful, but keep every number off
  // screen until the user has supplied a picture of their own.
  const isFirstRun = !hasMoneyPicture;
  // Real count of unreviewed intake items (was a hardcoded "2 things" — a fake
  // count that showed even on a clean/empty ledger). Hidden entirely at zero.
  const pendingReview = useAppStore((st) => st.reviewQueue?.length ?? 0);
  const pendingReviewSpillover = useAppStore((st) => st.reviewQueueSpillover?.length ?? 0);
  const transactions = useAppStore((st) => st.transactions);
  const cycles = useAppStore((st) => st.cycles);
  const potLedger = useAppStore((st) => st.potLedger);
  const quietMode = useAppStore((st) => st.melo?.quietMode ?? false);
  const spendHold = useAppStore((st) => st.spendHold ?? null);
  const whatIfHolds = useAppStore((st) => st.whatIfHolds ?? []);
  const meloPrimerSeen = useAppStore((st) => st.meloPrimerSeen ?? false);
  const meloPrimerBeat = useAppStore((st) => st.meloPrimerBeat ?? 0);
  const oneMoveHistory = useAppStore((st) => st.oneMoveHistory ?? []);
  const meloDismissLog = useAppStore((st) => st.meloDismissLog ?? []);
  const totalPendingReview = pendingReview + pendingReviewSpillover;
  const lens = useLens();

  // Mount-gate (kept from the web to avoid a flash of the fallback before the engine computes; on
  // RN it also defers `new Date()` so the date-derived bits don't render on the first frame). When
  // `state === 'loading'` we hold the gate closed so the loading branch (Melo curious + line, never
  // a spinner) shows.
  const [now, setNow] = useState<Date | null>(null);
  const [prevOpenIso, setPrevOpenIso] = useState<string | null>(null);
  const [returningRecapDismissed, setReturningRecapDismissed] = useState(false);
  useEffect(() => {
    setNow(new Date());
    sweepSubOverrides();
    sweepAutoResumeNow();
    setPrevOpenIso(touchOpened());
  }, []);

  const isLoading = state === 'loading' || now === null;

  // @rn-engine money-path — the lowest-point figure + its date come from the real pure route engine
  // via the shared `useRoute` bridge (@/folio/lib/storeRoute), which maps the live store onto
  // `computeRoute` (with payday resolved by `resolvePayday`) exactly as this screen used to inline.
  // The path runs from today's balance through the next payday, sampled once per day; the tight
  // point is the lowest projected balance and the day it lands on.
  //
  // The hook can't be called conditionally, so it always runs against `now ?? EPOCH`; before the
  // mount-gate opens (`now === null`) the engine has no honest "today", so we discard that transient
  // result (`route = null`) and the screen keeps the per-pressure sample (pressureLow) for that
  // single frame — exactly the pre-engine populated layout, so a normal open never flashes a
  // different figure.
  const routeResult = useRoute(now ?? EPOCH);
  const route = now ? routeResult : null;
  const safeRange = useMemo(
    () => (now ? buildTrustedSafeRangeFromAppState(appState, { now }) : null),
    [appState, now],
  );

  const returningRecap = useMemo(() => {
    if (!now || !prevOpenIso || quietMode || returningRecapDismissed) return null;
    const previous = Date.parse(prevOpenIso);
    if (!Number.isFinite(previous)) return null;
    const gapDays = Math.floor((now.getTime() - previous) / 86_400_000);
    if (gapDays < 21) return null;
    const cyclesInGap = cycles.filter((cycle) => {
      const closedAt = Date.parse(cycle.closedAt);
      return Number.isFinite(closedAt) && closedAt > previous && closedAt <= now.getTime();
    });
    if (cyclesInGap.length === 0) return null;
    const greenCycles = cyclesInGap.filter(
      (cycle) => cycle.tightPoint >= 0 && cycle.spare >= 0,
    ).length;
    const sortedByTight = [...cyclesInGap].sort(
      (left, right) => left.tightPoint - right.tightPoint,
    );
    const tightest = sortedByTight[0] ?? null;
    const softest = sortedByTight.at(-1) ?? null;
    const potMoves = potLedger.filter((entry) => {
      const at = Date.parse(entry.at);
      return Number.isFinite(at) && at > previous && at <= now.getTime();
    }).length;
    const restingSubs = subs.filter((sub) => subPaused[sub.name] === true).length;
    return {
      weeks: Math.max(3, Math.floor(gapDays / 7)),
      cycleCount: cyclesInGap.length,
      greenCycles,
      tightest,
      softest,
      potMoves,
      restingSubs,
      reviewCount: totalPendingReview,
    };
  }, [
    cycles,
    now,
    potLedger,
    prevOpenIso,
    quietMode,
    returningRecapDismissed,
    subPaused,
    subs,
    totalPendingReview,
  ]);

  // The lowest-point figure (hero number + summary "Lowest") and its date. Until the mount-gate
  // opens, fall back to the honest per-pressure sample with no live date — the pre-engine state.
  const tight = useMemo(() => {
    const trustedAmount = safeRange?.tightestPoint.amount?.minorUnits;
    const trustedDate = safeRange?.tightestPoint.dateISO ?? null;
    if (typeof trustedAmount === 'number') {
      return { tightestSpare: trustedAmount / 100, tightestDate: trustedDate };
    }
    return route
      ? { tightestSpare: route.tightPoint.amount, tightestDate: route.tightPoint.date }
      : { tightestSpare: pressureLow[pressure], tightestDate: null as string | null };
  }, [route, pressure, safeRange]);
  const checkInPrompt = useMemo(
    () => (now ? subDueForCheckIn(subs, subPaused, subCheckIns, currentFinancialDate(now)) : null),
    [now, subCheckIns, subPaused, subs],
  );
  const whisper = useMemo(
    () =>
      now
        ? deriveWhisper({
            now,
            quietMode,
            subs,
            subPaused,
            tightestSpare: tight.tightestSpare,
            cycles,
          })
        : null,
    [cycles, now, quietMode, subPaused, subs, tight.tightestSpare],
  );

  // Days to payday — the live count from the route engine (whole calendar days, today → payday),
  // falling back to the sample literal until the mount-gate opens.
  const daysToPayday = route ? route.daysToPayday : 11;

  const sinceLastOpen = useMemo(() => {
    if (!prevOpenIso || !now) return null;
    const previous = Date.parse(prevOpenIso);
    if (!Number.isFinite(previous)) return null;
    const gapDays = Math.floor((now.getTime() - previous) / 86_400_000);
    if (gapDays < 1) return null;
    let spend = 0;
    let income = 0;
    let count = 0;
    for (const transaction of transactions) {
      const occurredAt = Date.parse(transaction.when);
      if (!Number.isFinite(occurredAt) || occurredAt <= previous || occurredAt > now.getTime()) {
        continue;
      }
      count += 1;
      if (transaction.amount < 0) spend += -transaction.amount;
      else income += transaction.amount;
    }
    return count > 0 ? { gapDays, spend: Math.round(spend), income: Math.round(income) } : null;
  }, [now, prevOpenIso, transactions]);

  const greenStreak = useMemo(() => computeGreenStreak(cycles), [cycles]);
  const todayPose = useMemo(
    () =>
      poseForContext('today', {
        quietMode,
        pathBendPct:
          tight.tightestSpare < 0
            ? Math.abs(tight.tightestSpare) / Math.max(1, onboarding.monthlyIncome)
            : 0,
        cleanStreakDays: greenStreak,
      }),
    [greenStreak, onboarding.monthlyIncome, quietMode, tight.tightestSpare],
  );
  const ritualCompletedRecently = useMemo(() => {
    const lastClosed = cycles[0]?.closedAt;
    if (!lastClosed || !now) return false;
    const closedAt = Date.parse(`${lastClosed}T00:00:00`);
    return Number.isFinite(closedAt) && now.getTime() - closedAt < 86_400_000;
  }, [cycles, now]);
  const cycleOverdueDays = useMemo(() => {
    if (!now || !onboarding.done || ritualCompletedRecently) return 0;
    return now.getDate() > onboarding.payday ? now.getDate() - onboarding.payday : 0;
  }, [now, onboarding.done, onboarding.payday, ritualCompletedRecently]);
  const oneMove = useMemo(
    () =>
      deriveOneMove({
        reviewCount: totalPendingReview,
        tightPoint: tight.tightestSpare,
        cycleOverdueDays,
        caughtSubName: null,
        nav,
        history: oneMoveHistory,
        dismissLog: meloDismissLog,
      }),
    [
      cycleOverdueDays,
      meloDismissLog,
      nav,
      oneMoveHistory,
      tight.tightestSpare,
      totalPendingReview,
    ],
  );
  useEffect(() => {
    if (meloPrimerSeen && oneMove && route) {
      recordOneMoveShown(oneMove, route.spare, tight.tightestSpare);
    }
  }, [meloPrimerSeen, oneMove, route, tight.tightestSpare]);
  useEffect(() => {
    if (route && now) resolveOneMoveOutcomes(route.spare, tight.tightestSpare, now);
  }, [now, route, tight.tightestSpare]);

  // Weather for the lens+weather chip — the survival strategy's own derivation, mirroring
  // TodayModeScreen / TodayStabilityScreen (both already call deriveModeState for their pill).
  const modeState = useMemo(
    () =>
      deriveModeState('survival', {
        currentBalance,
        onboarding,
        pots,
        subs,
        subPaused,
        tightestSpare: tight.tightestSpare,
        tightestDate: tight.tightestDate,
        bufferAmount,
      }),
    [currentBalance, onboarding, pots, subs, subPaused, tight, bufferAmount],
  );
  const lensLocked = !lens.canAccess(moneyMode);
  const lockedAfterTrial = Boolean(lens.trialEndedCycleId) && !lens.paidUnlocked;

  // Honest balance-source caption (ENGINES.md §6) — every balance shows where it came from.
  const balanceSourceLabel = useMemo(() => {
    switch (currentBalance.source) {
      case 'user-entered':
        return 'you set this';
      case 'statement':
        return 'from your last statement';
      case 'pdf-derived':
        return 'from a statement you added';
      case 'ocr-derived':
        return 'from a photo you added';
      case 'corrected':
        return 'you corrected this';
      case 'sample':
      default:
        return 'sample data';
    }
  }, [currentBalance.source]);

  const tightestSpare = Math.max(0, Math.round(tight.tightestSpare));

  // ---- The money-path curve, from the REAL route (no hardcoded geometry) ------------------------
  // The chart plots the route engine's projected day-by-day balance (`route.points`) into the SVG's
  // 400×240 user space. An empty/cleared store yields a flat, honest line (no fabricated dips); a real
  // one yields the user's actual curve. Only the meaningful nodes are labelled (today / lowest /
  // payday) — the prototype's fake "salary rise / bill drop / debt drop" annotations are gone.
  const PLOT = { x0: 30, x1: 370, yTop: 72, yBottom: 196, baseline: 240 } as const;
  const PLOT_MID = (PLOT.yTop + PLOT.yBottom) / 2;
  const { points, lowIndex } = useMemo(() => {
    const rp = route?.points ?? [];
    if (rp.length < 2) {
      // No real series yet (pre-mount, or a single-day window) — a calm flat line, never a fake dip.
      return {
        points: [
          { x: PLOT.x0, y: PLOT_MID, label: 'today' },
          { x: PLOT.x1, y: PLOT_MID, label: 'payday' },
        ],
        lowIndex: 0,
      };
    }
    const bals = rp.map((p) => p.y);
    const maxB = Math.max(...bals);
    const minB = Math.min(...bals);
    const span = maxB - minB;
    const n = rp.length;
    const xAt = (i: number) => PLOT.x0 + (i / (n - 1)) * (PLOT.x1 - PLOT.x0);
    // Higher balance sits nearer the top; a flat series rests at mid-height (no fabricated shape).
    const yAt = (b: number) =>
      span < 1 ? PLOT_MID : PLOT.yBottom - ((b - minB) / span) * (PLOT.yBottom - PLOT.yTop);
    let lowIdx = 0;
    for (let i = 1; i < bals.length; i += 1) {
      if ((bals[i] ?? 0) < (bals[lowIdx] ?? 0)) lowIdx = i;
    }
    const paydayIdx = Math.max(0, Math.min(n - 1, daysToPayday));
    const pts = rp.map((p, i) => {
      const label = i === 0 ? 'today' : i === lowIdx ? 'lowest' : i === paydayIdx ? 'payday' : '';
      return { x: xAt(i), y: yAt(p.y), label };
    });
    return { points: pts, lowIndex: lowIdx };
  }, [route, daysToPayday, PLOT_MID]);
  // The lowest node's coordinates — used by the callout + scrub thumb. Derived from the real curve.
  const lowY = points[lowIndex]?.y ?? PLOT_MID;
  const lowX = points[lowIndex]?.x ?? 305;
  const d = `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
  const areaD = `${d} L ${PLOT.x1} ${PLOT.baseline} L ${PLOT.x0} ${PLOT.baseline} Z`;

  // Scrub — a 0..1 fraction across the plotted range, dragged with a PanResponder (the web used a
  // pointer drag against the SVG bounding box). A live ref lets the responder read width without
  // re-creating itself.
  const [scrub, setScrub] = useState(0);
  const svgWidthRef = useRef(0);
  const onCardLayout = (e: LayoutChangeEvent) => {
    svgWidthRef.current = e.nativeEvent.layout.width;
  };
  const applyScrubFromX = (localX: number) => {
    const w = svgWidthRef.current || 1;
    const x = Math.max(0, Math.min(1, localX / w));
    setScrub(x);
  };
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Stop the parent ScrollView from stealing the vertical pan while scrubbing (the web used
        // touch-none on the svg).
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => applyScrubFromX(e.nativeEvent.locationX),
        onPanResponderMove: (e) => applyScrubFromX(e.nativeEvent.locationX),
      }),
    [],
  );

  // The hero number counts up to the tightest spare minus the previewed scrub spend (£0..£120).
  const lowDisplay = useCountUp(tightestSpare - Math.round(scrub * 120), 400, reduceMotion);

  type Band = 'week' | 'next' | 'payday';
  const [band, setBand] = useState<Band>('payday');
  // Band date ranges, computed live from `now` (the mount-gated clock) — never hardcoded dates. The
  // "to payday" span runs to the route-resolved payday.
  const bandRange = (fromDays: number, toDays: number): string => {
    const base = now ?? EPOCH;
    const fmt = (d: number) =>
      new Date(base.getTime() + d * 86_400_000).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
    return `${fmt(fromDays)} → ${fmt(toDays)}`;
  };
  const bands: { id: Band; label: string; range: string }[] = [
    { id: 'week', label: 'This week', range: bandRange(0, 6) },
    { id: 'next', label: 'Next week', range: bandRange(7, 13) },
    { id: 'payday', label: 'To payday', range: bandRange(0, route ? route.daysToPayday : 28) },
  ];
  const activeBand = bands.find((b) => b.id === band)!;

  // Calendar → Route bridge. Map the focused ISO date to an x on the path (30..370), pulse it, and
  // clear the focus so it never re-fires. One-shot with a 6s timeout cleaned up on unmount.
  const [focusX, setFocusX] = useState<number | null>(null);
  const [focusLabel, setFocusLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!now || !routeFocusDate) return;
    const target = new Date(routeFocusDate + 'T00:00:00').getTime();
    const days = Math.round((target - now.getTime()) / 86_400_000);
    const clamped = Math.max(0, Math.min(28, days));
    setFocusX(30 + (clamped / 28) * 340);
    setFocusLabel(formatDayProse(routeFocusDate));
    setRouteFocusDate(null);
    const id = setTimeout(() => {
      setFocusX(null);
      setFocusLabel(null);
    }, 6000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, routeFocusDate]);

  // Pot top-ups become a labelled, cadence-derived dip (ENGINES §6 D5 — NO hardcoded Friday). Each
  // active pot's own cadence (default "after income arrives") resolves to a real top-up date via the
  // pot-cadence engine, anchored to the route-resolved payday; the dip is labelled with the soonest
  // such day. If no date can be honestly resolved (e.g. an after-payday pot with no known payday), the
  // dip reads "Pot top-up" with NO fabricated weekday.
  const activePots = pots.filter((p) => p.perWeek > 0);
  const weeklyPotTotal = activePots.reduce((sum, p) => sum + p.perWeek, 0);
  const potDipDay = useMemo<string | null>(() => {
    if (!now || activePots.length === 0) return null;
    const nowIso = currentFinancialDate(now);
    const nextPayday = route ? addDaysToLocalDate(nowIso, route.daysToPayday) : undefined;
    let soonest: string | null = null;
    for (const p of activePots) {
      const res = resolveNextTopUp(p.cadence ?? { kind: 'after-payday' }, {
        now: nowIso,
        nextPayday,
      });
      if (res.kind === 'date' && (soonest === null || res.date < soonest)) soonest = res.date;
    }
    if (soonest === null) return null;
    return new Date(`${soonest}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
  }, [now, route, activePots]);

  // --- Motion: route-draw (animated strokeDashoffset, keyed on `d`) -------------------------------
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    cancelAnimation(draw);
    if (reduceMotion) {
      draw.value = 1;
      return;
    }
    draw.value = 0;
    draw.value = withTiming(1, { duration: 2200, easing: EASE_OUT_EXPO });
    return () => cancelAnimation(draw);
  }, [draw, reduceMotion, d]);
  const routeStrokeProps = useAnimatedProps(() => ({
    strokeDashoffset: ROUTE_DASH * (1 - draw.value),
  }));

  // --- Motion: pulse-ring (lowest-point halo + focus halo) ----------------------------------------
  const pulse = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    cancelAnimation(pulse);
    if (reduceMotion) {
      pulse.value = 1; // final state: ring at rest, fully shown
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);
  const pulseRingProps = useAnimatedProps(() => {
    // 1.8s ease-in-out loop: ring scales 1→~1.25 and fades 0.5→0 (the web @keyframes pulse-ring).
    const r = 11 + pulse.value * 3;
    const opacity = 0.5 * (1 - pulse.value);
    return { r, opacity };
  });
  const focusRingProps = useAnimatedProps(() => {
    const r = 9 + pulse.value * 3;
    const opacity = 0.8 * (1 - pulse.value * 0.7);
    return { r, opacity };
  });

  // --- Motion: callout-in (idle lowest-point + focus chip), 600ms ease-out, 1.4s delay ------------
  const callout = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    cancelAnimation(callout);
    if (reduceMotion) {
      callout.value = 1;
      return;
    }
    callout.value = 0;
    callout.value = withDelay(1400, withTiming(1, { duration: 600, easing: EASE_OUT_EXPO }));
    return () => cancelAnimation(callout);
  }, [callout, reduceMotion]);
  const calloutStyle = useAnimatedProps(() => ({ opacity: callout.value }));

  // --- Motion: slide-in-r screen entrance, 360ms (translateX 28→0) --------------------------------
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withTiming(1, { duration: 360, easing: EASE_OUT_EXPO });
  }, [enter, reduceMotion]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: 28 * (1 - enter.value) }],
  }));

  const thumbX = 30 + scrub * 340;
  const strokeEndColor = pressure === 'overspent' ? t.repair : t.positive;

  // Loading branch (STATES.md / spec): never a spinner. When the shell explicitly hands a loading
  // state, Folio holds the screen on Melo (curious) + one quoted line — the same calm "working it
  // out" affordance the rest of the app uses — instead of flashing the fallback figures. The
  // mount-gate transient (now === null) stays on the populated layout with the pressureLow fallback,
  // exactly as the web did, so a normal open never shows this branch.
  if (state === 'loading') {
    return (
      <Animated.View style={[styles.root, enterStyle]}>
        <PressureScreen centered>
          <MeloLine mood="curious" text={line} />
        </PressureScreen>
      </Animated.View>
    );
  }

  if (isFirstRun) {
    return <TodayFirstRun nav={nav} safeTop={insets.top} />;
  }

  if (returningRecap && route) {
    return (
      <ReturningUserRecap
        balance={currentBalance.amount}
        onNotNow={() => setReturningRecapDismissed(true)}
        onTakeMeIn={() => {
          setReturningRecapDismissed(true);
          if (returningRecap.reviewCount > 0) nav.go('review');
          else nav.go('insights');
        }}
        paydayDate={route.points[route.daysToPayday]?.date ?? null}
        pathState={
          route.tightPoint.amount < 0 ? 'tight' : route.tightPoint.amount < 100 ? 'thin' : 'calm'
        }
        recap={returningRecap}
        safeTop={insets.top}
      />
    );
  }

  return (
    <Animated.View style={[styles.root, enterStyle]}>
      <ScrollView
        {...companionScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            {/* DELIBERATE PARITY BREAK: the web design hardcodes "Saturday, 27 June" (a demo
                string, ScreenToday.tsx:230). A live app showing a frozen date is dishonest —
                caught on-device 2026-07-05 with real user data next to a wrong date. */}
            <Text style={[styles.headerDate, { color: t.muted }]}>
              {new Date().toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => nav.go('ritual')}
              hitSlop={8}
              style={({ pressed: p }) => (p ? pressed : undefined)}
            >
              <Text style={[styles.headerDays, { color: t.muted }]}>
                {daysToPayday} days to payday →
              </Text>
            </Pressable>
          </View>
          <View style={styles.headerRight}>
            <TrialCountdownChip
              lens={{
                trialCycleId: lens.trialCycleId,
                paidUnlocked: lens.paidUnlocked,
                trialDaysLeft: lens.trialDaysLeft,
              }}
              onPress={() => nav.go('paywall')}
            />
            {/* Combined lens+weather pill — mirrors TodayModeScreen / TodayStabilityScreen (both
                already render this). PARITY_GAPS.md Group 1: Survival Today was the one Today
                surface missing it. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Lens ${moneyMode} — tap to switch lens`}
              onPress={() => nav.openSheet('lens-picker')}
              style={({ pressed: p }) => [
                styles.lensPill,
                { backgroundColor: t.surface, borderColor: t.hairline },
                p ? pressed : undefined,
              ]}
            >
              <MoneyModeChip mode={moneyMode} />
              <MeloWeatherGlyph weather={modeState.weather} size={12} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Melo"
              onPress={() => nav.openMelo()}
              style={({ pressed: p }) => [
                styles.meloButton,
                { backgroundColor: t.surface, borderColor: t.hairline },
                p ? pressed : undefined,
              ]}
            >
              <Melo
                size={22}
                mood={isLoading ? 'curious' : todayPose.mood}
                asleep={!isLoading && todayPose.asleep}
              />
            </Pressable>
          </View>
        </View>

        {/* Error branch — a dismissible, non-blocking banner OVER otherwise-populated content. */}
        {state === 'error' ? <ErrorBanner palette={t} /> : null}

        {/* Status strip — the only populated-state interruption is a locked lens. A clean ledger
            exits through TodayFirstRun above, so sample figures never render in the real app. */}
        {lensLocked ? (
          <LensLockChip
            moneyMode={moneyMode}
            lockedAfterTrial={lockedAfterTrial}
            onPress={() => nav.go('paywall')}
            palette={t}
          />
        ) : null}

        {/* Standing What-Changed row — renders only when something changed since the last look
            (lib/whatChanged.ts); tap opens the Timeline and stamps the baseline. */}
        <WhatChangedRow nav={nav} />
        <TrialEndedRow nav={nav} />

        {!meloPrimerSeen ? (
          <MeloPrimerCard
            initialBeat={meloPrimerBeat}
            onBeat={setMeloPrimerBeat}
            onDone={() => setMeloPrimerSeen(true)}
          />
        ) : null}
        {meloPrimerSeen && oneMove ? <OneMoveCard oneMove={oneMove} /> : null}
        {meloPrimerSeen && whisper ? <WeeklyWhisperCard line={whisper.line} /> : null}
        {meloPrimerSeen && checkInPrompt ? (
          <SubscriptionCheckInCard
            prompt={checkInPrompt}
            onKeep={() => logSubCheckIn(checkInPrompt.name, 'keep')}
            onPause={() => logSubCheckIn(checkInPrompt.name, 'pause')}
          />
        ) : null}

        {/* Hero */}
        <MeloCompanionExclusion id="today/hero" attentionSalience={0.9}>
          <View style={styles.hero}>
            {greenStreak >= 2 ? (
              <Text style={[styles.heroStreakEyebrow, { color: t.muted }]}>
                {greenStreak} calm cycles in a row
              </Text>
            ) : null}
            <Text
              style={[
                styles.verdict,
                {
                  color:
                    pressure === 'overspent'
                      ? t.repair
                      : pressure === 'pressured'
                        ? t.calm
                        : t.positive,
                },
              ]}
            >
              {line}
            </Text>
            <View style={styles.heroRow}>
              <Text style={[styles.heroNumber, { color: t.ink }]}>
                £{groupedPounds(lowDisplay)}
              </Text>
              <Text style={[styles.heroSpare, { color: t.muted }]}>spare</Text>
            </View>
            <Text style={[styles.heroCaption, { color: t.muted }]}>
              {tight.tightestDate
                ? `at its lowest point · ${formatDayProse(tight.tightestDate)}`
                : 'at its lowest point'}
            </Text>
            <Text style={[styles.heroSource, { color: t.muted }]}>
              starting from £{groupedPounds(currentBalance.amount)} · {balanceSourceLabel}
            </Text>
            {sinceLastOpen ? (
              <View
                style={[styles.sinceStrip, { backgroundColor: t.inset, borderColor: t.hairline }]}
              >
                <Text style={[styles.sinceLabel, { color: t.muted }]}>
                  since last open · {sinceLastOpen.gapDays}d
                </Text>
                <View style={[styles.sinceRule, { backgroundColor: t.hairline }]} />
                <Text style={[styles.sinceValue, { color: t.ink }]}>
                  {sinceLastOpen.spend > 0 ? `−£${groupedPounds(sinceLastOpen.spend)}` : ''}
                  {sinceLastOpen.spend > 0 && sinceLastOpen.income > 0 ? ' · ' : ''}
                  {sinceLastOpen.income > 0 ? `+£${groupedPounds(sinceLastOpen.income)}` : ''}
                </Text>
              </View>
            ) : null}
            {greenStreak >= 2 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Safe zone streak: ${greenStreak} cycles. Open Insights.`}
                onPress={() => nav.go('insights')}
                style={({ pressed: isPressed }) => [
                  styles.streakChip,
                  { backgroundColor: t.calmSoft, borderColor: t.hairline },
                  isPressed ? pressed : undefined,
                ]}
              >
                <View style={[styles.streakDot, { backgroundColor: t.positive }]} />
                <Text style={[styles.streakText, { color: t.ink }]}>
                  <Text style={{ color: t.calmStrong }}>{greenStreak}</Text> cycles in the safe zone
                </Text>
              </Pressable>
            ) : null}
            {spendHold || whatIfHolds.length > 0 ? (
              <View style={styles.activeHolds}>
                {spendHold ? (
                  <Text
                    style={[
                      styles.holdChip,
                      { color: t.muted, backgroundColor: t.inset, borderColor: t.hairline },
                    ]}
                  >
                    on hold · £{spendHold.dailyCap}/day until {formatDayProse(spendHold.end)}
                  </Text>
                ) : null}
                {whatIfHolds.length > 0 ? (
                  <Text
                    style={[
                      styles.holdChip,
                      { color: t.muted, backgroundColor: t.inset, borderColor: t.hairline },
                    ]}
                  >
                    {whatIfHolds.length} what-if hold{whatIfHolds.length === 1 ? '' : 's'} active
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </MeloCompanionExclusion>

        {safeRange ? <TrustedSafeRangeCard result={safeRange} nav={nav} palette={t} /> : null}

        {/* Path card — the hero object */}
        <MeloCompanionExclusion id="today/money-path" attentionSalience={1}>
          <View
            style={[
              styles.pathCard,
              { backgroundColor: t.surface, borderColor: t.hairline },
              elevation.card,
            ]}
          >
            <View style={styles.pathHead}>
              <Text style={[styles.pathEyebrow, { color: t.muted }]}>Your money path</Text>
              <Text style={[styles.pathRange, { color: t.muted }]}>{activeBand.range}</Text>
            </View>

            <View
              style={styles.svgWrap}
              onLayout={onCardLayout}
              accessibilityRole="image"
              accessibilityLabel="Money path from today to payday — drag to preview a spend"
              {...panResponder.panHandlers}
            >
              <Svg width="100%" height={SVG_RENDER_H} viewBox={`0 0 ${VB_W} ${VB_H}`}>
                <Defs>
                  <LinearGradient id="todayRouteFill" x1="0" x2="0" y1="0" y2="1">
                    <Stop offset="0%" stopColor={t.calm} stopOpacity={0.18} />
                    <Stop offset="100%" stopColor={t.calm} stopOpacity={0} />
                  </LinearGradient>
                  <LinearGradient id="todayRouteStroke" x1="0" x2="1" y1="0" y2="0">
                    <Stop offset="0%" stopColor={t.ink} />
                    <Stop offset={`${60 - scrub * 30}%`} stopColor={t.calm} />
                    <Stop offset="100%" stopColor={strokeEndColor} />
                  </LinearGradient>
                </Defs>

                {/* gridlines */}
                {[60, 120, 180].map((y) => (
                  <Line
                    key={y}
                    x1={20}
                    x2={380}
                    y1={y}
                    y2={y}
                    stroke={t.hairline}
                    strokeDasharray="2 4"
                  />
                ))}

                {/* breathing-room band — a generic "keep a buffer" zone near the bottom of the plot. The
                  old "· £100" label was a fixed claim that no longer maps to any real level on the
                  data-driven curve, so it's dropped; the band stays as a calm visual cue. */}
                <Rect x={20} y={200} width={360} height={20} fill={t.inset} />
                <SvgText x={24} y={216} fontSize={9} fill={t.muted}>
                  breathing room
                </SvgText>

                {/* area under the path */}
                <Path d={areaD} fill="url(#todayRouteFill)" />

                {/* the route line — drawn on with an animated dashoffset, keyed on `d` */}
                <AnimatedPath
                  animatedProps={routeStrokeProps}
                  d={d}
                  fill="none"
                  stroke="url(#todayRouteStroke)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={ROUTE_DASH}
                />

                {/* nodes — only the meaningful, labelled points (today / lowest / payday); the lowest
                  carries the live pulse halo. */}
                {points
                  .filter((p) => p.label !== '')
                  .map((p) => {
                    const isLow = p.label === 'lowest';
                    return (
                      <G key={p.label}>
                        <Circle
                          cx={p.x}
                          cy={p.y}
                          r={5}
                          fill={t.surface}
                          stroke={t.ink}
                          strokeWidth={1.4}
                        />
                        {isLow ? (
                          <>
                            <AnimatedCircle
                              animatedProps={pulseRingProps}
                              cx={p.x}
                              cy={p.y}
                              fill="none"
                              stroke={t.calm}
                              strokeWidth={1}
                            />
                            <Circle cx={p.x} cy={p.y} r={5} fill={t.calm} />
                          </>
                        ) : null}
                        <SvgText
                          x={p.x}
                          y={p.y - 12}
                          textAnchor="middle"
                          fontSize={9}
                          fontWeight="500"
                          fill={t.muted}
                        >
                          {p.label}
                        </SvgText>
                      </G>
                    );
                  })}

                {/* idle lowest-point callout — only at rest (no active scrub), and only once the route has
                  resolved a real tight-point date. Anchored to the real lowest node; the date is the
                  route's tight-point day and the figure the live spare — no hardcoded "7 Jul". */}
                {scrub < 0.04 && tight.tightestDate ? (
                  <AnimatedG animatedProps={calloutStyle}>
                    <Line
                      x1={lowX}
                      y1={lowY - 14}
                      x2={lowX}
                      y2={lowY - 28}
                      stroke={t.calm}
                      strokeWidth={0.8}
                    />
                    <Rect
                      x={Math.max(20, Math.min(280, lowX - 50))}
                      y={lowY - 52}
                      width={100}
                      height={22}
                      rx={6}
                      fill={t.canvas}
                      stroke={t.calm}
                      strokeWidth={0.8}
                    />
                    <SvgText
                      x={Math.max(70, Math.min(330, lowX))}
                      y={lowY - 37}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontWeight="600"
                      fill={t.ink}
                    >
                      {`${formatDayProse(tight.tightestDate)} · £${tightestSpare} spare`}
                    </SvgText>
                  </AnimatedG>
                ) : null}

                {/* scrub thumb */}
                <G transform={`translate(${thumbX}, 30)`}>
                  <Line
                    x1={0}
                    x2={0}
                    y1={0}
                    y2={200}
                    stroke={t.calm}
                    strokeWidth={1}
                    strokeDasharray="2 3"
                    opacity={0.7}
                  />
                  <Circle cx={0} cy={0} r={6} fill={t.calm} />
                  <Circle cx={0} cy={0} r={3} fill={t.inverse} />
                </G>

                {/* Calendar → Route focus marker */}
                {focusX !== null ? (
                  <AnimatedG animatedProps={calloutStyle}>
                    <Line
                      x1={focusX}
                      x2={focusX}
                      y1={30}
                      y2={220}
                      stroke={t.calm}
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      opacity={0.7}
                    />
                    <AnimatedCircle
                      animatedProps={focusRingProps}
                      cx={focusX}
                      cy={30}
                      fill="none"
                      stroke={t.calm}
                      strokeWidth={1}
                    />
                    <Rect
                      x={focusX - 48}
                      y={10}
                      width={96}
                      height={18}
                      rx={6}
                      fill={t.canvas}
                      stroke={t.calm}
                      strokeWidth={0.8}
                    />
                    <SvgText
                      x={focusX}
                      y={22}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontWeight="600"
                      fill={t.ink}
                    >
                      from Calendar · {focusLabel}
                    </SvgText>
                  </AnimatedG>
                ) : null}
              </Svg>
            </View>

            {/* One time-range control, rather than three unrelated floating pills. */}
            <View style={[styles.bandRow, { backgroundColor: t.inset }]}>
              {bands.map((b) => {
                const on = b.id === band;
                return (
                  <Pressable
                    key={b.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setBand(b.id)}
                    style={({ pressed: p }) => [
                      styles.bandPill,
                      { backgroundColor: on ? t.ink : 'transparent' },
                      p ? pressed : undefined,
                    ]}
                  >
                    <Text style={[styles.bandLabel, { color: on ? t.canvas : t.muted }]}>
                      {b.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* scrub hint */}
            <Text style={[styles.scrubHint, { color: t.muted }]}>
              {scrub > 0.02
                ? `if you spend £${Math.round(scrub * 120)} today`
                : 'drag the line to preview a spend'}
            </Text>
            {scrub > 0.04 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Log a spend of £${Math.round(scrub * 120)}`}
                onPress={() =>
                  nav.openSheet('log-spend', { amount: Math.max(1, Math.round(scrub * 120)) })
                }
                style={({ pressed: isPressed }) => [
                  styles.scrubCommit,
                  { backgroundColor: t.calmSoft },
                  isPressed ? pressed : undefined,
                ]}
              >
                <Text style={[styles.scrubCommitLabel, { color: t.calmStrong }]}>
                  Log £{Math.round(scrub * 120)} →
                </Text>
              </Pressable>
            ) : null}

            {/* Pot dip — the labelled pot top-up. Hidden when no active pots. The day is DERIVED from
              each pot's cadence (ENGINES §6 D5), never a hardcoded Friday; with no resolvable date it
              reads "Pot top-up" with no fabricated weekday. */}
            {activePots.length > 0 ? (
              <View style={[styles.potDip, { backgroundColor: t.inset }]}>
                <Text style={[styles.potDipGlyph, { color: t.calmStrong }]}>↘</Text>
                <Text style={[styles.potDipText, { color: t.muted }]}>
                  {potDipDay ? `${potDipDay} dip` : 'Pot top-up'} ·{' '}
                  {activePots.map((p) => `${p.name.split(' ')[0]} £${p.perWeek}`).join(' + ')}
                  {activePots.length > 1
                    ? ` · £${weeklyPotTotal}/wk to your pots`
                    : '/wk to your pot'}
                </Text>
              </View>
            ) : null}

            {/* summary trio */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryLabel, { color: t.muted }]}>Coming in</Text>
                <Text style={[styles.summaryValue, { color: t.positiveInk }]}>
                  {formatGBP(Math.round(route?.incomingTotal ?? 0))}
                </Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryLabel, { color: t.muted }]}>Going out</Text>
                <Text style={[styles.summaryValue, { color: t.repairInk }]}>
                  {formatGBP(Math.round(route?.outgoingTotal ?? 0))}
                </Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryLabel, { color: t.muted }]}>Lowest</Text>
                <Text style={[styles.summaryValue, { color: t.ink }]}>
                  {formatGBP(tightestSpare)}
                </Text>
              </View>
            </View>
          </View>
        </MeloCompanionExclusion>

        {/* The route is the proof for the headline. Actions and recent activity follow it instead
            of interrupting the answer before the user has seen why the number is true. */}
        <View style={styles.checksRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Before you spend — check a spend against your Safe Zone"
            onPress={() => nav.openSheet('afford-check')}
            style={({ pressed: p }) => [
              styles.checkPill,
              { backgroundColor: t.inset },
              p ? pressed : undefined,
            ]}
          >
            <Text style={[styles.checkPillLabel, { color: t.calmStrong }]}>Before you spend →</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Your Safe Zone — how the truly-spendable number is made"
            onPress={() => nav.openSheet('safe-zone')}
            style={({ pressed: p }) => [
              styles.checkPill,
              { backgroundColor: t.inset },
              p ? pressed : undefined,
            ]}
          >
            <Text style={[styles.checkPillLabel, { color: t.calmStrong }]}>Your Safe Zone →</Text>
          </Pressable>
        </View>
        <TodayNudges nav={nav} tightestSpare={isLoading ? null : tightestSpare} />
        <TodayRecentTxns nav={nav} />
        <TodaySpendStrip nav={nav} />

        {/* Melo prompt card */}
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            nav.openMelo({
              prefill: tight.tightestDate
                ? `Why is my low point £${tightestSpare} on ${formatDayProse(tight.tightestDate)}?`
                : `Why is my low point £${tightestSpare}?`,
            })
          }
          style={({ pressed: p }) => [
            styles.meloPrompt,
            { backgroundColor: t.inset },
            p ? pressed : undefined,
          ]}
        >
          <MeloCompanionPerch companionSize={28} id="today/summary" priority={30}>
            <Melo
              size={28}
              mood={isLoading ? 'curious' : todayPose.mood}
              asleep={!isLoading && todayPose.asleep}
            />
          </MeloCompanionPerch>
          <View style={styles.meloPromptBody}>
            <Text style={[styles.meloPromptLine, { color: t.ink }]}>&ldquo;{line}&rdquo;</Text>
            <View style={styles.meloPromptMeta}>
              {totalPendingReview > 0 ? (
                <Text style={[styles.meloPromptMetaText, { color: t.muted }]}>
                  {totalPendingReview} {totalPendingReview === 1 ? 'thing' : 'things'} still waiting
                  to be checked.
                </Text>
              ) : null}
              <Text style={[styles.meloPromptCta, { color: t.calmStrong }]}>Ask Melo →</Text>
            </View>
          </View>
        </Pressable>

        <TodayWeekTiles nav={nav} tightSpare={tightestSpare} tightDate={tight.tightestDate} />
      </ScrollView>
    </Animated.View>
  );
}

type ReturningRecapCycle = Readonly<{
  label: string;
  closedAt: string;
  spare: number;
  tightPoint: number;
}>;

type ReturningRecapData = Readonly<{
  weeks: number;
  cycleCount: number;
  greenCycles: number;
  tightest: ReturningRecapCycle | null;
  softest: ReturningRecapCycle | null;
  potMoves: number;
  restingSubs: number;
  reviewCount: number;
}>;

function ReturningUserRecap({
  balance,
  onNotNow,
  onTakeMeIn,
  pathState,
  paydayDate,
  recap,
  safeTop,
}: {
  balance: number;
  onNotNow: () => void;
  onTakeMeIn: () => void;
  pathState: 'calm' | 'thin' | 'tight';
  paydayDate: string | null;
  recap: ReturningRecapData;
  safeTop: number;
}) {
  const t = useTheme();
  const awayLines = [
    `${recap.cycleCount} ${recap.cycleCount === 1 ? 'cycle closed' : 'cycles closed'}. ${recap.greenCycles} landed in the safe zone.`,
    recap.tightest && recap.softest
      ? `Tightest point: ${formatGBP(recap.tightest.tightPoint)}. Softest: ${formatGBP(
          recap.softest.tightPoint,
        )}.`
      : null,
    recap.potMoves > 0
      ? `${recap.potMoves} ${recap.potMoves === 1 ? 'pot move' : 'pot moves'}.`
      : null,
    recap.restingSubs > 0
      ? `${recap.restingSubs} ${recap.restingSubs === 1 ? 'subscription is' : 'subscriptions are'} still resting.`
      : null,
    recap.reviewCount > 0
      ? `${recap.reviewCount} ${recap.reviewCount === 1 ? 'thing is' : 'things are'} waiting to be checked.`
      : null,
  ].filter((line): line is string => line !== null);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: t.canvas }}
      contentContainerStyle={[styles.recapContent, { paddingTop: safeTop + gap.xl }]}
    >
      <View style={styles.recapMelo}>
        <Melo size={88} mood="celebrate" pose="safe" grounded={false} />
      </View>
      <Text style={[styles.recapKicker, { color: t.muted }]}>Melo, here</Text>
      <Text accessibilityRole="header" style={[styles.recapHeadline, { color: t.ink }]}>
        {'It’s been '}
        <Text style={[styles.recapHeadlineAccent, { color: t.calm }]}>{recap.weeks} weeks</Text>
        {'.'}
      </Text>

      <View style={styles.recapSection}>
        <Text style={[styles.recapSectionTitle, { color: t.muted }]}>While you were away</Text>
        {awayLines.map((line) => (
          <Text key={line} style={[styles.recapLine, { color: t.ink }]}>
            · {line}
          </Text>
        ))}
      </View>

      <View style={styles.recapSection}>
        <Text style={[styles.recapSectionTitle, { color: t.muted }]}>Right now</Text>
        <Text style={[styles.recapLine, { color: t.ink }]}>
          · Balance {formatGBP(balance)}
          {paydayDate ? ` · payday ${formatDayProse(paydayDate)}` : ''}
        </Text>
        <Text style={[styles.recapLine, { color: t.ink }]}>
          · The path reads {pathState} to payday.
        </Text>
      </View>

      <View style={styles.recapSection}>
        <Text style={[styles.recapSectionTitle, { color: t.muted }]}>Where to look first</Text>
        <Text style={[styles.recapPriority, { color: t.ink }]}>
          {recap.reviewCount > 0
            ? `${recap.reviewCount} ${recap.reviewCount === 1 ? 'thing' : 'things'} to check`
            : 'The shape of your recent cycles'}
        </Text>
      </View>

      <View style={styles.recapMeloLine}>
        <MeloLine text="I only speak when something shifts. Plenty shifted." />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onTakeMeIn}
        style={({ pressed: isPressed }) => [
          styles.recapPrimary,
          { backgroundColor: t.ink },
          isPressed ? pressed : undefined,
        ]}
      >
        <Text style={[styles.recapPrimaryText, { color: t.canvas }]}>Take me in</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onNotNow}
        style={({ pressed: isPressed }) => [styles.recapSecondary, isPressed ? pressed : undefined]}
      >
        <Text style={[styles.recapSecondaryText, { color: t.muted }]}>Not now</Text>
      </Pressable>
    </ScrollView>
  );
}

function MeloPrimerCard({
  initialBeat,
  onBeat,
  onDone,
}: {
  initialBeat: number;
  onBeat: (beat: number) => void;
  onDone: () => void;
}) {
  const t = useTheme();
  const [beat, setBeat] = useState(Math.max(0, Math.min(3, initialBeat)));
  const beats = [
    {
      lead: 'Melo, ',
      accent: 'here',
      tail: '.',
      body: '',
    },
    {
      lead: 'I only speak when something ',
      accent: 'shifts',
      tail: '.',
      body: '',
    },
    {
      lead: 'A small ',
      accent: 'companion',
      tail: '.',
      body: 'Not a bank, not a coach.',
    },
    {
      lead: "I'll be over ",
      accent: 'here',
      tail: '.',
      body: 'Tap when you want me.',
    },
  ] as const;
  const current = beats[beat]!;
  const last = beat === beats.length - 1;
  const primerPose = poseForContext(
    beat === 0
      ? 'meet-melo-1'
      : beat === 1
        ? 'meet-melo-2'
        : beat === 2
          ? 'meet-melo-3'
          : 'melo-tab',
  );
  const next = () => {
    void triggerFeedback('melo-intro-step');
    if (last) {
      onDone();
      return;
    }
    const nextBeat = beat + 1;
    setBeat(nextBeat);
    onBeat(nextBeat);
  };
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Meet Melo, step ${beat + 1} of ${beats.length}`}
      style={[styles.companionCard, { backgroundColor: t.surface, borderColor: t.hairline }]}
    >
      <Melo size={last ? 28 : 36} mood={primerPose.mood} asleep={primerPose.asleep} />
      <View style={styles.companionCardBody}>
        <Text style={[styles.companionCardTitle, { color: t.ink }]}>
          {current.lead}
          <Text style={{ color: t.calmStrong }}>{current.accent}</Text>
          {current.tail}
        </Text>
        {current.body ? (
          <Text style={[styles.companionCardCopy, { color: t.muted }]}>{current.body}</Text>
        ) : null}
        <View style={styles.companionCardActions}>
          <View style={styles.primerDots}>
            {beats.map((item, index) => (
              <View
                key={item.accent}
                style={[
                  styles.primerDot,
                  {
                    backgroundColor: index === beat ? t.calm : t.hairline,
                    width: index === beat ? 16 : 6,
                  },
                ]}
              />
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={onDone} hitSlop={10}>
            <Text style={[styles.companionQuietAction, { color: t.muted }]}>Skip →</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={next} hitSlop={10}>
            <Text style={[styles.companionPrimaryAction, { color: t.calmStrong }]}>
              {last ? 'Begin →' : 'Continue →'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function OneMoveCard({ oneMove }: { oneMove: NonNullable<ReturnType<typeof deriveOneMove>> }) {
  const t = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const dismiss = (reason: DismissReason | null) => {
    recordOneMoveDismissed(oneMove.key, reason);
    setPickerOpen(false);
  };
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Melo suggests: ${oneMove.line}`}
      style={[styles.companionCard, { backgroundColor: t.surface, borderColor: t.hairline }]}
    >
      <Melo size={36} mood="curious" />
      <View style={styles.companionCardBody}>
        <Text style={[styles.companionCardCopy, { color: t.ink }]}>{oneMove.line}</Text>
        <View style={styles.companionCardActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              recordOneMoveTapped(oneMove.key);
              oneMove.onTap();
            }}
            hitSlop={10}
          >
            <Text style={[styles.companionPrimaryAction, { color: t.calmStrong }]}>
              {oneMove.cta} →
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not the right move, tell Melo why"
            accessibilityState={{ expanded: pickerOpen }}
            onPress={() => setPickerOpen((value) => !value)}
            hitSlop={10}
          >
            <Text style={[styles.companionMoreAction, { color: t.muted }]}>⋯</Text>
          </Pressable>
        </View>
        {pickerOpen ? (
          <View style={[styles.dismissChoices, { borderTopColor: t.hairline }]}>
            {DISMISS_CHOICES.map((choice) => (
              <Pressable
                key={choice.id}
                accessibilityRole="button"
                onPress={() => dismiss(choice.id)}
                style={({ pressed: isPressed }) => [
                  styles.dismissChoice,
                  { backgroundColor: t.canvas, borderColor: t.hairline },
                  isPressed ? pressed : undefined,
                ]}
              >
                <Text style={[styles.dismissChoiceLabel, { color: t.muted }]}>{choice.label}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => dismiss(null)} hitSlop={8}>
              <Text style={[styles.dismissChoiceLabel, { color: t.muted }]}>Skip</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function WeeklyWhisperCard({ line }: { line: string }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Weekly whisper: ${line}`}
      style={[
        styles.signalCard,
        styles.whisperCard,
        { backgroundColor: t.surface, borderColor: t.hairline },
      ]}
    >
      <Melo size={30} mood="calm" />
      <Text style={[styles.whisperLine, { color: t.ink }]}>{line}</Text>
    </View>
  );
}

function SubscriptionCheckInCard({
  prompt,
  onKeep,
  onPause,
}: {
  prompt: NonNullable<ReturnType<typeof subDueForCheckIn>>;
  onKeep: () => void;
  onPause: () => void;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Check-in on ${prompt.name}`}
      style={[styles.signalCard, { backgroundColor: t.surface, borderColor: t.hairline }]}
    >
      <Melo size={36} mood="curious" />
      <View style={styles.checkInBody}>
        <Text style={[styles.checkInLine, { color: t.ink }]}>
          <Text style={styles.checkInName}>{prompt.name}</Text>
          {" — how's it working out? You've paid about £"}
          {prompt.paidSoFar.toLocaleString('en-GB')} so far.
        </Text>
        <View style={styles.checkInActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onKeep}
            style={({ pressed: isPressed }) => [
              styles.checkInAction,
              isPressed ? pressed : undefined,
            ]}
          >
            <Text style={[styles.checkInActionText, { color: t.calmStrong }]}>Keeping it →</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onPause}
            style={({ pressed: isPressed }) => [
              styles.checkInAction,
              isPressed ? pressed : undefined,
            ]}
          >
            <Text style={[styles.checkInActionText, { color: t.muted }]}>Pause a cycle →</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function TodayFirstRun({ nav, safeTop }: { nav: Nav; safeTop: number }) {
  const t = useTheme();
  return (
    <Animated.View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[styles.firstRunScroll, { paddingTop: safeTop + gap.md }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.firstRunHeader}>
          <Text style={[styles.headerDate, { color: t.muted }]}>
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Melo"
            onPress={() => nav.openMelo()}
            style={({ pressed: p }) => [
              styles.firstRunMeloButton,
              { backgroundColor: t.surface, borderColor: t.hairline },
              p ? pressed : undefined,
            ]}
          >
            <Melo size={21} mood="calm" />
          </Pressable>
        </View>
        <View style={[styles.firstRunMelo, { backgroundColor: t.inset }]}>
          <Melo size={52} mood="curious" />
        </View>
        <Text style={[styles.firstRunPrimer, { color: t.ink }]}>
          Melo, here. I only speak when something shifts.
        </Text>
        <Text style={[styles.firstRunKicker, { color: t.muted }]}>Your first picture</Text>
        <Text accessibilityRole="header" style={[styles.firstRunTitle, { color: t.ink }]}>
          {'See where your money gets '}
          <Text style={{ color: t.calmStrong }}>tight</Text>
          {', before it does.'}
        </Text>
        <Text style={[styles.firstRunBody, { color: t.muted }]}>
          Add a balance, payday and regular costs. Melo will turn them into one route to payday —
          without pretending sample numbers are yours.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get first answer"
          onPress={() => {
            setMeloPrimerSeen(true);
            nav.go('first-answer');
          }}
          style={({ pressed: p }) => [
            styles.firstRunPrimary,
            { backgroundColor: t.calm },
            p ? pressed : undefined,
          ]}
        >
          <Text style={[styles.firstRunPrimaryLabel, { color: t.accentInk }]}>
            Get first answer
          </Text>
          <Text style={[styles.firstRunPrimaryArrow, { color: t.accentInk }]}>→</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a statement instead"
          onPress={() => nav.go('intake')}
          style={({ pressed: p }) => [styles.firstRunSecondary, p ? pressed : undefined]}
        >
          <Text style={[styles.firstRunSecondaryLabel, { color: t.calmStrong }]}>
            Read a statement instead →
          </Text>
        </Pressable>
        <Text style={[styles.firstRunFootnote, { color: t.muted }]}>
          Nothing counts until you review it.
        </Text>
      </ScrollView>
    </Animated.View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// A dismissible, non-blocking "couldn't refresh" banner. STATES.md: error is a banner OVER
// populated content, never a blank screen. Local dismiss state — tapping × hides it for the session.
function ErrorBanner({ palette }: { palette: Palette }) {
  const [shown, setShown] = useState(true);
  if (!shown) return null;
  return (
    <View
      style={[
        styles.errorBanner,
        { backgroundColor: palette.repairSoft, borderColor: palette.hairline },
      ]}
    >
      <Text style={[styles.errorText, { color: palette.repairInk }]}>{copy.err.generic}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={10}
        onPress={() => setShown(false)}
        style={({ pressed: p }) => (p ? pressed : undefined)}
      >
        <Text style={[styles.errorDismiss, { color: palette.repairInk }]}>×</Text>
      </Pressable>
    </View>
  );
}

// Locked-lens status pill — shown instead of the sample-numbers chip when the active Money Mode
// isn't unlocked (paid tier without Plus/Pro, and no active trial). Mirrors the web ScreenToday's
// status-strip branch: swaps to a soft "trial ended" explainer when the lock was caused by a trial
// that just closed, so users are never confused why a lens re-locked (PARITY_GAPS.md Group 1).
function LensLockChip({
  moneyMode,
  lockedAfterTrial,
  onPress,
  palette,
}: {
  moneyMode: MoneyMode;
  lockedAfterTrial: boolean;
  onPress: () => void;
  palette: Palette;
}) {
  // Locked lenses route through the shared Plus/Pro entitlement guard.
  const lockedTier = 'Full';
  const label = lockedAfterTrial
    ? `Trial ended · ${moneyMode} back to Survival`
    : `${moneyMode} is a ${lockedTier} lens · Survival for now`;
  const cta = lockedAfterTrial ? 'See plans →' : 'Unlock →';
  const aria = lockedAfterTrial
    ? `Your trial ended — ${moneyMode} is a ${lockedTier} lens. Tap to see plans.`
    : `${moneyMode} is a ${lockedTier} lens — tap to unlock`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={aria}
      onPress={onPress}
      style={({ pressed: p }) => [
        styles.chip,
        { backgroundColor: palette.inset, borderColor: palette.hairline },
        p ? pressed : undefined,
      ]}
    >
      <View style={[styles.chipDot, { backgroundColor: palette.calm }]} />
      <Text style={[styles.chipText, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.chipText, { color: palette.calm }]}>{cta}</Text>
    </Pressable>
  );
}

function screenForSafeRangeRoute(route: string): ScreenId | null {
  switch (route) {
    case 'account':
    case 'recovery':
    case 'review':
    case 'shortfall':
    case 'start':
      return route;
    default:
      return null;
  }
}

function TrustedSafeRangeCard({
  result,
  nav,
  palette,
}: {
  result: TrustedSafeRangeResult;
  nav: Nav;
  palette: Palette;
}) {
  const tone =
    result.status === 'shortfall' ||
    result.status === 'contradicted' ||
    result.status === 'insufficient_data' ||
    result.status === 'workspace_blocked'
      ? palette.repairInk
      : result.status === 'ready'
        ? palette.positiveInk
        : palette.calmStrong;
  const rangeText =
    result.expectedRange.min?.minorUnits === result.expectedRange.max?.minorUnits
      ? formatTrustedSafeRangePounds(result.expectedRange.min)
      : `${formatTrustedSafeRangePounds(result.expectedRange.min)} – ${formatTrustedSafeRangePounds(
          result.expectedRange.max,
        )}`;
  const tightText = result.tightestPoint.dateISO
    ? formatDayProse(result.tightestPoint.dateISO)
    : 'date unknown';
  const missingOrContradicted = [...result.contradictions, ...result.missingInputs].slice(0, 3);
  const why = result.whyChanged.slice(0, 3);
  const sources = result.sourceBreakdown.slice(0, 3);
  const next = result.nextAction;
  const onNext = () => {
    if (!next) return;
    const screen = screenForSafeRangeRoute(next.route);
    if (screen) {
      nav.go(screen);
      return;
    }
    nav.openMelo({ prefill: next.reason });
  };

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Trusted Safe Range. ${trustedSafeRangeHeadline(
        result,
      )}. ${trustedSafeRangeSummaryLine(result)}`}
      style={[
        styles.safeRangeCard,
        { backgroundColor: palette.surface, borderColor: palette.hairline },
        elevation.card,
      ]}
    >
      <View style={styles.safeRangeHead}>
        <Text style={[styles.safeRangeEyebrow, { color: palette.muted }]}>Trusted Safe Range</Text>
        <Text style={[styles.safeRangeStatus, { color: tone }]}>
          {result.reliance.replaceAll('_', ' ')} · {result.freshness}
        </Text>
      </View>
      <Text style={[styles.safeRangeTitle, { color: palette.ink }]}>
        {trustedSafeRangeHeadline(result)}
      </Text>
      <Text style={[styles.safeRangeBody, { color: palette.muted }]}>
        {trustedSafeRangeSummaryLine(result)}
      </Text>

      <View style={styles.safeRangeMetrics}>
        <View style={[styles.safeRangeMetric, { backgroundColor: palette.inset }]}>
          <Text style={[styles.safeRangeMetricLabel, { color: palette.muted }]}>Expected</Text>
          <Text style={[styles.safeRangeMetricValue, { color: palette.ink }]}>{rangeText}</Text>
        </View>
        <View style={[styles.safeRangeMetric, { backgroundColor: palette.inset }]}>
          <Text style={[styles.safeRangeMetricLabel, { color: palette.muted }]}>Floor</Text>
          <Text style={[styles.safeRangeMetricValue, { color: palette.ink }]}>
            {formatTrustedSafeRangePounds(result.knownCommittedFloor)}
          </Text>
        </View>
        <View style={[styles.safeRangeMetric, { backgroundColor: palette.inset }]}>
          <Text style={[styles.safeRangeMetricLabel, { color: palette.muted }]}>
            {result.shortfall ? 'Shortfall' : 'Tightest'}
          </Text>
          <Text
            style={[
              styles.safeRangeMetricValue,
              { color: result.shortfall ? palette.repairInk : palette.ink },
            ]}
          >
            {result.shortfall
              ? formatTrustedSafeRangePounds(result.shortfall)
              : formatTrustedSafeRangePounds(result.tightestPoint.amount)}
          </Text>
        </View>
      </View>

      <Text style={[styles.safeRangeFine, { color: palette.muted }]}>
        Tightest point: {tightText}. Source reliance: {result.relianceDetail.label}
      </Text>

      {why.length > 0 ? (
        <View style={styles.safeRangeSection}>
          <Text style={[styles.safeRangeSectionLabel, { color: palette.muted }]}>
            Why it changed
          </Text>
          {why.map((item) => (
            <Text key={item.id} style={[styles.safeRangeBullet, { color: palette.ink }]}>
              · {item.label}
            </Text>
          ))}
        </View>
      ) : null}

      {missingOrContradicted.length > 0 ? (
        <View style={styles.safeRangeSection}>
          <Text style={[styles.safeRangeSectionLabel, { color: palette.muted }]}>
            Missing or conflicted
          </Text>
          {missingOrContradicted.map((item) => (
            <Text key={item.id} style={[styles.safeRangeBullet, { color: palette.repairInk }]}>
              · {item.label}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.safeRangeSection}>
        <Text style={[styles.safeRangeSectionLabel, { color: palette.muted }]}>Sources</Text>
        {sources.map((source) => (
          <Text key={source.factId} style={[styles.safeRangeSource, { color: palette.muted }]}>
            {source.label} · {source.truthClass.replaceAll('_', ' ')} · {source.freshness}
          </Text>
        ))}
      </View>

      {next ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${next.label}. ${next.reason}`}
          onPress={onNext}
          style={({ pressed: isPressed }) => [
            styles.safeRangeAction,
            { backgroundColor: palette.ink },
            isPressed ? pressed : undefined,
          ]}
        >
          <Text style={[styles.safeRangeActionText, { color: palette.canvas }]}>
            {next.label} →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Reduced-motion (final state) — read once, then subscribe. Mirrors the kit's hook so route-draw,
// pulse-ring, callout-in, the count-up, and the screen entrance all collapse to their final state.
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  recapContent: {
    flexGrow: 1,
    paddingBottom: gap.xxl,
    paddingHorizontal: gap.xl,
  },
  recapMelo: {
    alignItems: 'flex-start',
    minHeight: 96,
  },
  recapKicker: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: gap.lg,
  },
  recapHeadline: {
    fontFamily: serif.displayItalic,
    fontSize: 31,
    fontStyle: 'italic',
    letterSpacing: -0.4,
    lineHeight: 34,
    marginTop: gap.xs,
  },
  recapHeadlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  recapSection: {
    marginTop: gap.xl,
  },
  recapSectionTitle: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2,
    marginBottom: gap.sm,
    textTransform: 'uppercase',
  },
  recapLine: {
    fontFamily: serif.display,
    fontSize: 14,
    lineHeight: 21,
    marginTop: gap.xs,
  },
  recapPriority: {
    fontFamily: serif.displayItalic,
    fontSize: 19,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  recapMeloLine: {
    marginTop: gap.xl,
  },
  recapPrimary: {
    alignItems: 'center',
    borderRadius: radius.sm,
    justifyContent: 'center',
    marginTop: gap.xl,
    minHeight: 50,
  },
  recapPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  recapSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  recapSecondaryText: {
    fontFamily: serif.displayItalic,
    fontSize: 12,
    fontStyle: 'italic',
  },
  firstRunScroll: {
    flexGrow: 1,
    paddingBottom: gap.xxl,
    paddingHorizontal: 28,
    paddingTop: gap.md,
  },
  firstRunHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  firstRunMeloButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  firstRunMelo: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.xxl,
    height: 76,
    justifyContent: 'center',
    marginTop: gap.xxl,
    width: 76,
  },
  firstRunKicker: {
    fontFamily: serif.displayItalic,
    fontSize: 14,
    marginTop: gap.lg,
  },
  firstRunPrimer: {
    fontFamily: serif.displayItalic,
    fontSize: 14,
    lineHeight: 20,
    marginTop: gap.md,
  },
  firstRunTitle: {
    fontFamily: serif.display,
    fontSize: 32,
    letterSpacing: -0.5,
    lineHeight: 36,
    marginTop: gap.xs,
  },
  firstRunBody: {
    fontSize: 14.5,
    lineHeight: 21,
    marginTop: gap.md,
    maxWidth: 360,
  },
  firstRunPrimary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    flexDirection: 'row',
    height: 54,
    justifyContent: 'center',
    marginTop: gap.xl,
    paddingHorizontal: gap.xl,
  },
  firstRunPrimaryLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  firstRunPrimaryArrow: {
    fontSize: 21,
    position: 'absolute',
    right: gap.xl,
  },
  firstRunSecondary: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: gap.sm,
  },
  firstRunSecondaryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  firstRunFootnote: {
    fontSize: 12.5,
    marginTop: gap.lg,
    textAlign: 'center',
  },
  scrollContent: { paddingBottom: gap.xxxl },

  header: {
    paddingHorizontal: 28,
    paddingTop: gap.md,
    paddingBottom: gap.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerDate: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  headerDays: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.xs,
  },
  lensPill: {
    height: 32,
    paddingLeft: gap.sm,
    paddingRight: gap.sm + 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meloButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chip: {
    marginHorizontal: 28,
    marginTop: gap.xs,
    marginBottom: gap.xs,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.sm,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: gap.md,
    paddingVertical: 6,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 11 },

  companionCard: {
    marginHorizontal: 28,
    marginTop: gap.sm,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: gap.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: gap.md,
  },
  companionCardBody: { flex: 1, minWidth: 0 },
  companionCardTitle: {
    fontFamily: serif.display,
    fontSize: 15,
    lineHeight: 19,
  },
  companionCardCopy: { fontSize: 12.5, lineHeight: 18 },
  companionCardActions: {
    marginTop: gap.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: gap.md,
  },
  companionPrimaryAction: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  companionQuietAction: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  companionMoreAction: { fontSize: 20, lineHeight: 20 },
  primerDots: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  primerDot: { height: 4, borderRadius: 2 },
  dismissChoices: {
    marginTop: gap.md,
    paddingTop: gap.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dismissChoice: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: gap.sm,
    justifyContent: 'center',
  },
  dismissChoiceLabel: { fontSize: 11 },
  signalCard: {
    alignItems: 'flex-start',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: gap.md,
    marginHorizontal: 28,
    marginTop: gap.sm,
    padding: gap.md,
  },
  whisperCard: {
    paddingVertical: gap.sm + 2,
  },
  whisperLine: {
    flex: 1,
    fontFamily: serif.displayItalic,
    fontSize: 12.5,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  checkInBody: {
    flex: 1,
    minWidth: 0,
  },
  checkInLine: {
    fontSize: 13,
    lineHeight: 19,
  },
  checkInName: {
    fontFamily: serif.display,
  },
  checkInActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: gap.lg,
    marginTop: 2,
  },
  checkInAction: {
    justifyContent: 'center',
    minHeight: 44,
  },
  checkInActionText: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  hero: {
    paddingHorizontal: 28,
    paddingTop: gap.md,
  },
  heroStreakEyebrow: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  verdict: {
    fontFamily: serif.displayItalic,
    fontSize: 15,
  },
  heroRow: {
    marginTop: gap.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: gap.sm,
  },
  heroNumber: {
    fontFamily: serif.display,
    fontSize: 64,
    lineHeight: 64,
    fontVariant: ['tabular-nums'],
  },
  heroSpare: {
    fontFamily: serif.displayItalic,
    fontSize: 18,
  },
  heroCaption: {
    fontSize: 12.5,
    marginTop: 4,
  },
  checksRow: {
    paddingHorizontal: 28,
    marginTop: gap.md,
    flexDirection: 'row',
    gap: gap.sm,
  },
  checkPill: {
    height: 28,
    paddingHorizontal: gap.md,
    borderRadius: 999,
    justifyContent: 'center',
  },
  checkPillLabel: { fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase' },

  heroSource: {
    fontSize: 10.5,
    marginTop: 4,
    opacity: 0.7,
  },
  sinceStrip: {
    marginTop: gap.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.sm,
  },
  sinceLabel: {
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sinceRule: { flex: 1, height: StyleSheet.hairlineWidth },
  sinceValue: { fontSize: 12.5, fontVariant: ['tabular-nums'] },
  streakChip: {
    alignSelf: 'flex-start',
    marginTop: gap.sm,
    minHeight: 30,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: gap.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.sm,
  },
  streakDot: { width: 6, height: 6, borderRadius: 3 },
  streakText: { fontSize: 11.5, fontVariant: ['tabular-nums'] },
  activeHolds: {
    marginTop: gap.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  holdChip: {
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: gap.sm,
    paddingVertical: 5,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },

  safeRangeCard: {
    marginTop: gap.lg,
    marginHorizontal: gap.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    padding: gap.lg,
  },
  safeRangeHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: gap.md,
  },
  safeRangeEyebrow: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  safeRangeStatus: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  safeRangeTitle: {
    fontFamily: serif.display,
    fontSize: 18,
    lineHeight: 23,
    marginTop: gap.sm,
  },
  safeRangeBody: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
  },
  safeRangeMetrics: {
    flexDirection: 'row',
    gap: gap.sm,
    marginTop: gap.md,
  },
  safeRangeMetric: {
    borderRadius: radius.md,
    flex: 1,
    minHeight: 56,
    paddingHorizontal: gap.sm,
    paddingVertical: gap.sm,
  },
  safeRangeMetricLabel: {
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  safeRangeMetricValue: {
    fontFamily: serif.display,
    fontSize: 13.5,
    fontVariant: ['tabular-nums'],
    marginTop: 3,
  },
  safeRangeFine: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: gap.sm,
  },
  safeRangeSection: {
    marginTop: gap.md,
    gap: 3,
  },
  safeRangeSectionLabel: {
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  safeRangeBullet: {
    fontSize: 12,
    lineHeight: 17,
  },
  safeRangeSource: {
    fontSize: 11,
    lineHeight: 16,
  },
  safeRangeAction: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: gap.md,
    minHeight: 44,
    paddingHorizontal: gap.lg,
  },
  safeRangeActionText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  pathCard: {
    marginTop: gap.xl - 4,
    marginHorizontal: gap.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    padding: gap.xl - 4,
  },
  pathHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: gap.sm,
  },
  pathEyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  pathRange: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  svgWrap: {
    width: '100%',
    height: SVG_RENDER_H,
  },

  bandRow: {
    marginTop: gap.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    gap: 2,
    padding: 3,
  },
  bandPill: {
    flex: 1,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandLabel: {
    fontSize: 10.5,
    letterSpacing: 0.4,
  },

  scrubHint: {
    marginTop: gap.sm,
    fontSize: 10.5,
    textAlign: 'center',
  },
  scrubCommit: {
    alignSelf: 'center',
    marginTop: gap.sm,
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: gap.md,
    justifyContent: 'center',
  },
  scrubCommitLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  potDip: {
    marginTop: gap.sm,
    paddingHorizontal: gap.xs,
    paddingVertical: 6,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  potDipGlyph: { fontSize: 11 },
  potDipText: { flex: 1, fontSize: 10.5, lineHeight: 15 },

  summaryRow: {
    marginTop: gap.md,
    flexDirection: 'row',
    gap: gap.md,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontFamily: serif.display,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },

  meloPrompt: {
    marginHorizontal: gap.lg,
    marginTop: gap.md,
    borderRadius: radius.md,
    padding: gap.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: gap.md,
  },
  meloPromptBody: { flex: 1 },
  meloPromptLine: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  meloPromptMeta: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meloPromptMetaText: { fontSize: 11.5, flex: 1 },
  meloPromptCta: { fontSize: 11.5, marginLeft: gap.sm },

  errorBanner: {
    marginHorizontal: 28,
    marginTop: gap.xs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: { fontSize: 12.5, flex: 1 },
  errorDismiss: { fontSize: 16, marginLeft: gap.sm },
});
