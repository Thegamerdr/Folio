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
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  gap,
  PressureScreen,
  pressed,
  radius,
  serif,
  useCountUp,
  weightFamily,
  type Palette,
} from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import {
  hasConfiguredMoneyPicture,
  recordOneMoveDismissed,
  recordOneMoveShown,
  recordOneMoveTapped,
  setMeloPrimerSeen,
  useAppStore,
  setRouteFocusDate,
  sweepAutoResumeNow,
  sweepSubOverrides,
  touchOpened,
} from '@/folio/store';
import { useRoute } from '@/folio/lib/storeRoute';
import { useDayClock } from '@/folio/lib/useDayClock';
import { utcMidnightForLocalDay } from '@/folio/lib/dayClock';
import { deriveCalendarEvents } from '@/folio/lib/calendarEvents';
import { useChartStyle } from '@/folio/lib/chartStyle';
import { deriveModeState, type MoneyMode } from '@/folio/lib/modes';
import { deriveOneMove } from '@/folio/lib/melo/oneMove';
import { DISMISS_CHOICES, type DismissReason } from '@/folio/lib/melo/dismissReasons';
import { computeGreenStreak } from '@/folio/lib/streaks';
import { useLens } from '@/folio/lib/lens';
import { MeloWeatherGlyph } from '@/folio/ui/MeloWeatherGlyph';
import { MoneyPathChart } from '@/folio/ui/MoneyPathChart';
import { TrialCountdownChip } from '@/folio/ui/TrialCountdownChip';
import { TrialEndedRow } from '@/folio/ui/TrialEndedRow';
import { WhatChangedRow } from '@/folio/ui/WhatChangedRow';
import type { Nav, Pressure } from '@/folio/types';

import { derivePressure, pressureLine, pressureLow } from './today/pressure';
import { selectPaydayTightPoint, tightPointDayLabel } from '@/folio/lib/moneyPath';
import { formatDayProse, formatGBP, groupedPounds } from './today/format';
import { TodayNudges } from './today/TodayNudges';
import { TodayRecentTxns } from './today/TodayRecentTxns';
import { useTodayTheme } from './today/todayTheme';
import {
  buildTodayJourneyEvents,
  buildTodayJourneyGeometry,
  summarizeTodayCycleFlows,
} from './today/todayPathGeometry';

const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// A stable sentinel "now" for the one render before the mount-gate opens. `useRoute` can't be
// called conditionally, so it runs against this until `now` is set; the result is discarded
// (`route = null`) that frame. Module-level so its identity never churns the hook's memo.
const EPOCH = new Date(0);

const STATE_WORD: Record<MoneyMode, string> = {
  survival: 'getting through',
  stability: 'steady',
  growth: 'building',
  debt: 'clearing debt',
  irregular: 'uneven income',
  household: 'shared money',
  planning: 'planning ahead',
  reset: 'starting again',
  lowVis: 'still learning',
  optimizer: 'fine tuning',
};

type ScreenState = 'populated' | 'loading' | 'error' | 'offline';

export function TodayScreen({
  nav,
  pressure: suppliedPressure,
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
  const t = useTodayTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const line = pressureLine[suppliedPressure];

  // Live store reads. Today's tightest mirrors the Route/Calendar exactly — but the route inputs
  // (subs/subPaused/subOverrides/transactions/income/balance/pots) are now read inside `useRoute`,
  // the shared store→money-path bridge, so every screen computes the same curve. Only the slices
  // this screen reads OUTSIDE the route stay here.
  const onboarding = useAppStore((st) => st.onboarding);
  const pots = useAppStore((st) => st.pots);
  const routeFocusDate = useAppStore((st) => st.routeFocusDate);
  const currentBalance = useAppStore((st) => st.currentBalance);
  // Lens (Money Mode) + weather chip + trial/paywall-lock pill — mirrors TodayModeScreen /
  // TodayStabilityScreen (PARITY_GAPS.md Group 1: the primary Survival Today was missing all of
  // these, unlike its two siblings).
  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);
  const subOverrides = useAppStore((st) => st.subOverrides);
  const calendarEvents = useAppStore((st) => st.calendarEvents);
  const incomeSources = useAppStore((st) => st.incomeSources ?? []);
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
  const spendHold = useAppStore((st) => st.spendHold ?? null);
  const whatIfHolds = useAppStore((st) => st.whatIfHolds ?? []);
  const meloPrimerSeen = useAppStore((st) => st.meloPrimerSeen ?? false);
  const oneMoveHistory = useAppStore((st) => st.oneMoveHistory ?? []);
  const meloDismissLog = useAppStore((st) => st.meloDismissLog ?? []);
  const totalPendingReview = pendingReview + pendingReviewSpillover;
  const lens = useLens();
  const { style: chartStyle } = useChartStyle();

  // Mount-gate (kept from the web to avoid a flash of the fallback before the engine computes; on
  // RN it also defers `new Date()` so the date-derived bits don't render on the first frame). When
  // `state === 'loading'` we hold the gate closed so the loading branch (Melo curious + line, never
  // a spinner) shows.
  const now = useDayClock();
  const engineNow = useMemo(() => (now ? utcMidnightForLocalDay(now) : null), [now]);
  const [prevOpenIso, setPrevOpenIso] = useState<string | null>(null);
  useEffect(() => {
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
  const paydayTight = useMemo(() => (route ? selectPaydayTightPoint(route) : null), [route]);
  const pressure = paydayTight ? derivePressure(paydayTight.amount) : suppliedPressure;

  // The lowest-point figure (hero number + summary "Lowest") and its date. Until the mount-gate
  // opens, fall back to the honest per-pressure sample with no live date — the pre-engine state.
  const tight = useMemo(
    () =>
      paydayTight
        ? { tightestSpare: paydayTight.amount, tightestDate: paydayTight.date }
        : { tightestSpare: pressureLow[pressure], tightestDate: null as string | null },
    [paydayTight, pressure],
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
    if (meloPrimerSeen && oneMove?.key) recordOneMoveShown(oneMove.key);
  }, [meloPrimerSeen, oneMove?.key]);

  // Weather for the lens+weather chip — the survival strategy's own derivation, mirroring
  // TodayModeScreen / TodayStabilityScreen (both already call deriveModeState for their pill).
  const effectiveMode = lens.canAccess(moneyMode) ? moneyMode : 'survival';
  const modeState = useMemo(
    () =>
      deriveModeState(effectiveMode, {
        currentBalance,
        onboarding,
        pots,
        subs,
        subPaused,
        tightestSpare: tight.tightestSpare,
        tightestDate: tight.tightestDate,
        bufferAmount,
      }),
    [currentBalance, onboarding, pots, subs, subPaused, tight, bufferAmount, effectiveMode],
  );
  const lensLocked = !lens.canAccess(moneyMode);
  const lockedAfterTrial = Boolean(lens.trialEndedCycleId) && !lens.fullUnlocked;

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

  // Keep the route engine's signed tight point available for honest shortfall copy. The mode
  // strategy intentionally floors its spendable Safe Zone at £0, but the Today answer must still
  // say how far below zero the projected route goes.
  const routeTightestAmount = Math.round(tight.tightestSpare);
  const tightestSpare = Math.max(0, routeTightestAmount);

  // The payday journey is selected from the existing route; later lows remain separate warnings.
  // The pre-payday totals and event notches come from the same calendar derivation that feeds the
  // route, so labels, curve, and summary cannot drift into three different stories.
  const projectedEvents = useMemo(
    () =>
      now
        ? deriveCalendarEvents({
            subs,
            subPaused,
            subOverrides,
            onboarding,
            manualEvents: calendarEvents,
            pots,
            incomeSources,
            spendHold,
            whatIfHolds,
            windowDays: 35,
            now: engineNow!,
            includeSampleBills: currentBalance.source === 'sample',
          })
        : [],
    [
      now,
      engineNow,
      subs,
      subPaused,
      subOverrides,
      onboarding,
      calendarEvents,
      pots,
      incomeSources,
      spendHold,
      whatIfHolds,
      currentBalance.source,
    ],
  );
  const paydayIso = route?.points[Math.min(daysToPayday, route.points.length - 1)]?.date ?? '';
  const points = useMemo(
    () =>
      buildTodayJourneyGeometry({
        now: now ?? EPOCH,
        todayAmount: route?.points[0]?.y ?? currentBalance.amount,
        tightAmount: routeTightestAmount,
        tightDate: tight.tightestDate,
        paydayAmount: route?.spare ?? currentBalance.amount,
        paydayDate: paydayIso || (now ?? EPOCH).toISOString().slice(0, 10),
      }),
    [now, currentBalance.amount, routeTightestAmount, tight.tightestDate, route, paydayIso],
  );
  const pathEvents = useMemo(
    () =>
      now && paydayIso
        ? buildTodayJourneyEvents(
            projectedEvents,
            now,
            paydayIso,
            points.find((point) => point.label === 'tightest')?.x ?? -100,
          )
        : [],
    [now, paydayIso, points, projectedEvents],
  );
  const cycleFlows = useMemo(
    () =>
      paydayIso
        ? summarizeTodayCycleFlows(projectedEvents, paydayIso)
        : { incoming: 0, outgoing: 0 },
    [paydayIso, projectedEvents],
  );
  const pathLowAmount = routeTightestAmount;

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

  // The hero number belongs to the active mode's Safe Zone, not to a
  // survival-only hardcoded amount. Currency previews retain the source's
  // £120 scrub semantics; non-currency modes keep their declared unit.
  const heroUnit =
    effectiveMode === 'reset'
      ? 'days'
      : effectiveMode === 'irregular'
        ? 'weeks'
        : effectiveMode === 'lowVis'
          ? 'signal'
          : 'currency';
  const heroUnitLabel =
    heroUnit === 'currency' && routeTightestAmount < 0
      ? `spare · £${groupedPounds(Math.abs(routeTightestAmount) + Math.round(scrub * 120))} short`
      : heroUnit === 'days'
        ? 'days of essentials covered'
        : heroUnit === 'weeks'
          ? 'weeks of bills covered'
          : heroUnit === 'signal'
            ? modeState.safeZone.formula
            : modeState.spareLabel;
  const heroProvisional =
    modeState.safeZone.confidence !== 'high' || currentBalance.source === 'sample';
  const heroBase =
    heroUnit === 'currency'
      ? Math.max(
          0,
          (routeTightestAmount < 0 ? 0 : Math.round(modeState.safeZone.amount)) -
            Math.round(scrub * 120),
        )
      : Math.max(0, Math.round(modeState.safeZone.amount));
  const lowDisplay = useCountUp(heroBase, 400, reduceMotion);
  const heroFigure =
    heroUnit === 'currency' ? `£${groupedPounds(lowDisplay)}` : groupedPounds(lowDisplay);
  const heroFigureSize = heroFigure.length >= 8 ? 44 : heroFigure.length >= 7 ? 50 : 58;

  // Calendar → Route bridge. Map the focused ISO date to an x on the path (30..370), pulse it, and
  // clear the focus so it never re-fires. One-shot with a 6s timeout cleaned up on unmount.
  const [focusX, setFocusX] = useState<number | null>(null);
  const [focusLabel, setFocusLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!now || !routeFocusDate) return;
    const target = Date.parse(`${routeFocusDate}T00:00:00Z`);
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((target - today) / 86_400_000);
    const withinJourney = days >= 0 && days <= daysToPayday;
    setFocusX(withinJourney ? 30 + (days / Math.max(1, daysToPayday)) * 340 : null);
    setFocusLabel(formatDayProse(routeFocusDate));
    setRouteFocusDate(null);
    const id = setTimeout(() => {
      setFocusX(null);
      setFocusLabel(null);
    }, 6000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, routeFocusDate, daysToPayday]);

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

  const scrubSpend = Math.round(scrub * 120);
  const scrubLowAmount = pathLowAmount - scrubSpend;
  const scrubLowCopy =
    scrubLowAmount < 0
      ? `£${groupedPounds(Math.abs(scrubLowAmount))} short`
      : `£${groupedPounds(scrubLowAmount)} spare`;

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
    return <TodayFirstRun nav={nav} />;
  }

  return (
    <Animated.View style={[styles.root, enterStyle, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Source authority: one subordinate status row only. Date + payday horizon sit on the
            left; the plain-language state + weather disc sit on the right. Melo has no standalone
            header doorway in the accepted composition. */}
        <View style={[styles.header, { paddingTop: gap.xs }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerHorizon}>
              <Text style={[styles.headerDate, { color: t.muted }]} numberOfLines={1}>
                {(now ?? new Date()).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
              <Text style={[styles.headerSeparator, { color: t.muted }]} aria-hidden>
                {' · '}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${daysToPayday} day${daysToPayday === 1 ? '' : 's'} to payday`}
                onPress={() => nav.go('ritual')}
                hitSlop={8}
                style={({ pressed: p }) => (p ? pressed : undefined)}
              >
                <Text style={[styles.headerDays, { color: t.muted }]} numberOfLines={1}>
                  {daysToPayday}d to payday
                </Text>
              </Pressable>
            </View>
            <View style={styles.headerStateGroup}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Current state: ${STATE_WORD[effectiveMode]}. Tap to change.`}
                onPress={() => nav.openSheet('lens-picker')}
                style={({ pressed: p }) => (p ? pressed : undefined)}
              >
                <Text style={[styles.headerState, { color: t.muted }]} numberOfLines={1}>
                  {STATE_WORD[effectiveMode]}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Weather ${modeState.weather} — tap to switch lens`}
                onPress={() => nav.openSheet('lens-picker')}
                style={({ pressed: p }) => [styles.weatherButton, p ? pressed : undefined]}
              >
                <View style={[styles.weatherDisc, { backgroundColor: t.inset }]}>
                  <MeloWeatherGlyph weather={modeState.weather} size={12} />
                </View>
              </Pressable>
            </View>
          </View>
          {lens.trialCycleId && !lens.fullUnlocked && lens.trialDaysLeft !== null ? (
            <View style={styles.trialRow}>
              <TrialCountdownChip
                lens={{
                  trialCycleId: lens.trialCycleId,
                  fullUnlocked: lens.fullUnlocked,
                  trialDaysLeft: lens.trialDaysLeft,
                }}
                onPress={() => nav.go('paywall')}
              />
            </View>
          ) : null}
        </View>

        {/* Error branch — a dismissible, non-blocking banner OVER otherwise-populated content. */}
        {state === 'error' ? <ErrorBanner palette={t} /> : null}

        {/* Status strip — one slot, one pill. Locked lens wins over the sample-numbers chip so the
            paywall message reads first when both apply — mirrors the web's ScreenToday priority. */}
        {lensLocked ? (
          <LensLockChip
            moneyMode={moneyMode}
            lockedAfterTrial={lockedAfterTrial}
            onPress={() => nav.go('paywall')}
            palette={t}
          />
        ) : !onboarding.done && !hasMoneyPicture ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="The numbers on this screen are sample data — tap to make them yours"
            onPress={() => nav.openSheet('onboarding')}
            style={({ pressed: p }) => [styles.sampleTruth, p ? pressed : undefined]}
          >
            <Text style={[styles.sampleTruthText, { color: t.muted }]}>Sample numbers</Text>
            <Text style={[styles.sampleTruthText, { color: t.muted }]}> · make them yours →</Text>
          </Pressable>
        ) : null}

        {/* Hero */}
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
            {modeState.verdict === 'The middle of next week is the squeeze.' &&
            tight.tightestDate &&
            now
              ? `The squeeze is ${tightPointDayLabel(tight.tightestDate, now)}.`
              : modeState.verdict}
          </Text>
          <View style={styles.heroRow}>
            {heroProvisional ? (
              <Text style={[styles.heroQualifier, { color: t.muted }]}>about</Text>
            ) : null}
            <Text
              style={[
                styles.heroNumber,
                { color: t.ink, fontSize: heroFigureSize, lineHeight: heroFigureSize * 0.9 },
              ]}
            >
              {heroFigure}
            </Text>
            <Text
              style={[
                styles.heroSpare,
                { color: t.muted, fontSize: Math.max(12, heroFigureSize * 0.235) },
              ]}
            >
              {heroUnitLabel}
            </Text>
          </View>
          {effectiveMode !== 'survival' ? (
            <Text style={[styles.heroCaption, { color: t.muted }]}>
              {modeState.safeZone.formula}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See the tight point in the day-by-day calendar"
            onPress={() => nav.go('calendar')}
            style={({ pressed: p }) => [styles.heroMetaTarget, p ? pressed : undefined]}
          >
            <Text style={[styles.heroCaption, { color: t.muted }]}>
              {tight.tightestDate
                ? `${effectiveMode === 'survival' ? 'lowest before payday' : `Payday forecast low: ${formatGBP(routeTightestAmount)}`} · ${tightPointDayLabel(tight.tightestDate, now ?? EPOCH)}`
                : 'at its lowest point'}
            </Text>
            <Text style={[styles.balanceAttribution, { color: t.muted }]}>
              From {formatGBP(currentBalance.amount)} · {balanceSourceLabel}
            </Text>
          </Pressable>
          <Text style={[styles.heroSource, { color: t.muted }]}>
            Includes what you’ve logged today.
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
                <Text style={{ color: t.calm }}>{greenStreak}</Text> cycles in the safe zone
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
          {pressure === 'pressured' || pressure === 'overspent' ? (
            <View style={styles.heroOffer}>
              <Text style={[styles.heroOfferReason, { color: t.muted }]}>
                {routeTightestAmount < 0
                  ? 'This doesn’t reach payday on its own.'
                  : 'There is little room before payday.'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.go('recovery')}
                style={({ pressed: p }) => [styles.heroOfferActionTarget, p ? pressed : undefined]}
              >
                <Text style={[styles.heroOfferAction, { color: t.calmStrong }]}>
                  See what could move →
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => nav.go('whatif')}
              style={({ pressed: p }) => [styles.heroOfferAside, p ? pressed : undefined]}
            >
              <Text style={[styles.heroOfferReason, { color: t.muted }]}>
                Thinking of spending?{' '}
                <Text style={{ color: t.ink }}>Try it against this figure first.</Text>
              </Text>
            </Pressable>
          )}
          <View style={styles.heroActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Can I spend something?"
              onPress={() => nav.openSheet('afford-check')}
              style={({ pressed: p }) => [
                styles.primaryDecision,
                { backgroundColor: t.calmSoft, borderColor: 'rgba(158, 60, 24, 0.22)' },
                p ? pressed : undefined,
              ]}
            >
              <Text style={[styles.primaryDecisionText, { color: t.calmStrong }]}>
                Can I spend something?
              </Text>
            </Pressable>
          </View>
        </View>

        {route &&
        paydayIso &&
        route.tightPoint.date > paydayIso &&
        route.tightPoint.amount < (paydayTight?.amount ?? 0) ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.go('calendar')}
            style={[styles.laterWarning, { borderColor: t.hairline }]}
          >
            <Text style={[styles.balanceAttribution, { color: t.muted }]}>
              Later in the 35-day forecast: {formatGBP(route.tightPoint.amount)} on{' '}
              {formatDayProse(route.tightPoint.date)}. View calendar →
            </Text>
          </Pressable>
        ) : null}

        {/* Melo enters the money story after the answer, never between chrome and
            the decision. First-run primer and one-move are mutually exclusive. */}
        {!meloPrimerSeen ? <MeloPrimerCard onDone={() => setMeloPrimerSeen(true)} /> : null}
        {meloPrimerSeen && oneMove ? <OneMoveCard oneMove={oneMove} /> : null}

        {/* The path is the signature object: plain ground, one hairline chapter
            break, no card shell or decorative analytics grid. */}
        <View style={[styles.pathCard, { borderTopColor: t.hairline }]}>
          <View style={styles.pathHead}>
            <Text style={[styles.pathEyebrow, { color: t.muted }]}>
              {paydayIso
                ? `Today → payday · ${new Date(`${paydayIso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                : 'Today → payday'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open the day-by-day calendar"
              onPress={() => nav.go('calendar')}
              style={({ pressed: p }) => (p ? pressed : undefined)}
            >
              <Text style={[styles.pathRange, { color: t.calm }]}>Calendar →</Text>
            </Pressable>
          </View>

          <View
            style={[styles.svgWrap, focusX !== null ? { height: 184 } : undefined]}
            onLayout={onCardLayout}
            {...panResponder.panHandlers}
          >
            <MoneyPathChart
              points={points}
              events={pathEvents}
              style={chartStyle}
              pressure={pressure}
              scrub={scrub}
              focusX={focusX}
              focusLabel={focusLabel}
              onTightTap={() => nav.go('calendar')}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See the working in the day-by-day calendar"
            onPress={() => nav.go('calendar')}
            style={styles.workingLink}
          >
            <Text style={{ fontSize: 12, color: t.calmStrong }}>See the working →</Text>
          </Pressable>
          <Text style={[styles.pathDisclaimer, { color: t.muted }]}>
            Worked out from what you’ve added — treat it as a close guess.
          </Text>
          {/* scrub hint */}
          <Text style={[styles.scrubHint, { color: t.muted }]}>
            {scrub > 0.02
              ? `spend £${scrubSpend} today · lowest ${scrubLowCopy}`
              : 'drag the line to try a spend'}
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
              <Text style={[styles.scrubCommitLabel, { color: t.calm }]}>
                Log £{Math.round(scrub * 120)} →
              </Text>
            </Pressable>
          ) : null}
          <Text style={[styles.pathSummary, { color: t.muted }]}>
            <Text style={{ color: t.ink }}>{formatGBP(Math.round(cycleFlows.incoming))}</Text>{' '}
            coming in before payday,{' '}
            <Text style={{ color: t.ink }}>{formatGBP(Math.round(cycleFlows.outgoing))}</Text> going
            out.
          </Text>
        </View>

        {/* The route is the proof for the headline. Actions and recent activity follow it instead
            of interrupting the answer before the user has seen why the number is true. */}
        <WhatChangedRow nav={nav} />
        <TrialEndedRow nav={nav} />
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
            <Text style={[styles.checkPillLabel, { color: t.calm }]}>Before you spend →</Text>
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
            <Text style={[styles.checkPillLabel, { color: t.calm }]}>Your Safe Zone →</Text>
          </Pressable>
        </View>
        <TodayNudges
          nav={nav}
          pressure={pressure}
          tightestSpare={isLoading ? null : tightestSpare}
        />
        <TodayRecentTxns nav={nav} />
      </ScrollView>
    </Animated.View>
  );
}

function MeloPrimerCard({ onDone }: { onDone: () => void }) {
  const t = useTodayTheme();
  const [beat, setBeat] = useState(0);
  const beats = [
    {
      lead: 'Melo, ',
      accent: 'here',
      tail: '.',
      body: 'Not a bank. Not a coach. A small companion for your money.',
    },
    {
      lead: 'What I ',
      accent: 'watch',
      tail: '.',
      body: 'The path to payday. Your subscriptions. The tight point in the middle.',
    },
    {
      lead: 'How I ',
      accent: 'speak',
      tail: '.',
      body: 'Only when something shifts. Never noise. You can mute me any time.',
    },
  ] as const;
  const current = beats[beat]!;
  const last = beat === beats.length - 1;
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Meet Melo, step ${beat + 1} of ${beats.length}`}
      style={[styles.companionCard, { backgroundColor: t.surface, borderColor: t.hairline }]}
    >
      <Melo size={36} mood="calm" />
      <View style={styles.companionCardBody}>
        <Text style={[styles.companionCardTitle, { color: t.ink }]}>
          {current.lead}
          <Text style={{ color: t.calm }}>{current.accent}</Text>
          {current.tail}
        </Text>
        <Text style={[styles.companionCardCopy, { color: t.muted }]}>{current.body}</Text>
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
          {!last ? (
            <Pressable accessibilityRole="button" onPress={onDone} hitSlop={10}>
              <Text style={[styles.companionQuietAction, { color: t.muted }]}>Skip</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => (last ? onDone() : setBeat((value) => value + 1))}
            hitSlop={10}
          >
            <Text style={[styles.companionPrimaryAction, { color: t.calm }]}>
              {last ? 'Got it →' : 'Next →'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function OneMoveCard({ oneMove }: { oneMove: NonNullable<ReturnType<typeof deriveOneMove>> }) {
  const t = useTodayTheme();
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
            <Text style={[styles.companionPrimaryAction, { color: t.calm }]}>{oneMove.cta} →</Text>
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

function TodayFirstRun({ nav }: { nav: Nav }) {
  const t = useTodayTheme();
  const insets = useSafeAreaInsets();
  const screenTopInset = Math.max(gap.md, insets.top + gap.xs);
  return (
    <Animated.View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[styles.firstRunScroll, { paddingTop: screenTopInset }]}
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
          <Text style={{ color: t.calm }}>tight</Text>
          {', before it does.'}
        </Text>
        <Text style={[styles.firstRunBody, { color: t.muted }]}>
          Add a balance, payday and regular costs. Melo will turn them into one route to payday —
          without pretending sample numbers are yours.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add my numbers"
          onPress={() => {
            setMeloPrimerSeen(true);
            nav.openSheet('onboarding');
          }}
          style={({ pressed: p }) => [
            styles.firstRunPrimary,
            { backgroundColor: t.calm },
            p ? pressed : undefined,
          ]}
        >
          <Text style={[styles.firstRunPrimaryLabel, { color: t.inverse }]}>Add my numbers</Text>
          <Text style={[styles.firstRunPrimaryArrow, { color: t.inverse }]}>→</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a statement instead"
          onPress={() => nav.go('intake')}
          style={({ pressed: p }) => [styles.firstRunSecondary, p ? pressed : undefined]}
        >
          <Text style={[styles.firstRunSecondaryLabel, { color: t.calm }]}>
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
  // Every locked lens is a Full lens since the Free/Full/Live restructure — no tier lookup left.
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
    paddingHorizontal: 24,
    paddingTop: gap.lg,
    paddingBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    minHeight: 44,
  },
  headerHorizon: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerStateGroup: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  trialRow: {
    minHeight: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerState: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    flexShrink: 1,
  },
  headerDate: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
  },
  headerSeparator: { fontSize: 12.5, opacity: 0.4 },
  headerDays: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
  },
  weatherButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  weatherDisc: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
  sampleTruth: {
    marginHorizontal: 28,
    marginTop: gap.xs,
    marginBottom: gap.xs,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sampleTruthText: { fontSize: 11 },

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

  hero: {
    paddingHorizontal: 24,
    paddingTop: gap.sm,
  },
  heroStreakEyebrow: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  verdict: {
    fontFamily: serif.displayItalic,
    fontSize: 16,
    lineHeight: 22,
  },
  heroRow: {
    marginTop: gap.sm,
    minHeight: 65,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: gap.sm,
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  heroNumber: {
    fontFamily: serif.display,
    fontSize: 64,
    lineHeight: 64,
    fontVariant: ['tabular-nums'],
  },
  heroQualifier: {
    fontFamily: weightFamily(500),
    fontSize: 13,
  },
  heroSpare: {
    fontFamily: weightFamily(400),
    fontSize: 18,
    flexShrink: 1,
  },
  heroCaption: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    marginTop: 4,
    lineHeight: 18.75,
  },
  heroMetaTarget: { minHeight: 44, justifyContent: 'center' },
  balanceAttribution: { fontFamily: weightFamily(400), fontSize: 11, lineHeight: 16 },
  laterWarning: {
    marginHorizontal: 24,
    marginTop: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  heroOffer: {
    marginTop: gap.sm,
  },
  heroOfferAside: { marginTop: gap.xs, minHeight: 44, justifyContent: 'center' },
  heroOfferReason: { fontFamily: weightFamily(400), fontSize: 12.5, lineHeight: 20 },
  heroOfferActionTarget: { marginTop: 2, minHeight: 44, justifyContent: 'center' },
  heroOfferAction: { fontFamily: weightFamily(500), fontSize: 12.5 },
  heroActions: {
    marginTop: gap.md,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: gap.md,
  },
  primaryDecision: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  primaryDecisionText: { fontFamily: weightFamily(600), fontSize: 14, letterSpacing: -0.07 },
  workingLink: { minHeight: 44, marginTop: 12, justifyContent: 'center', alignSelf: 'flex-start' },
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
    fontFamily: weightFamily(400),
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

  pathCard: {
    marginTop: gap.lg,
    paddingHorizontal: gap.lg,
    paddingTop: gap.md,
    borderTopWidth: 1,
  },
  pathHead: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: gap.sm,
  },
  pathEyebrow: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  pathRange: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
  },
  svgWrap: {
    width: '100%',
    height: 164,
  },

  scrubHint: {
    marginTop: gap.sm,
    minHeight: 24,
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    lineHeight: 24,
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
  pathDisclaimer: {
    marginTop: gap.xs,
    fontFamily: weightFamily(400),
    fontSize: 11,
    lineHeight: 16.5,
    opacity: 0.7,
  },
  pathSummary: {
    marginTop: gap.md,
    paddingTop: gap.md,
    borderTopWidth: 1,
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    lineHeight: 18.75,
  },

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
