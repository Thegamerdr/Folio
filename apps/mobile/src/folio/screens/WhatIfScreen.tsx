/**
 * @rn-screen    WhatIfScreen
 * @rn-stack     More > What if
 * @purpose      Spend-preview slider — dial a hypothetical "spend £X today" amount with −/+ steppers
 *               (default £40, step £5, clamp 0..500) and watch, in real time with a count-up, what the
 *               new lowest point to payday becomes, how many days that figure covers, and whether it
 *               breaches the Melo-set floor or would eat into pots. A mini money-path SVG redraws its
 *               dip as the amount changes. Preview stays read-only unless the user explicitly saves
 *               the scenario as a hold. Faithful RN port of the approved web design source
 *               (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenWhatIf.tsx).
 * @reads        pressure (mood band → baseLow via pressureLow) · tightPointGoal · pots (potsTotal)
 * @writes       addWhatIfHold / removeWhatIfHold only after an explicit action. Scrubbing and stepping
 *               remain local previews and never mutate the money path.
 * @opens-sheet  — (the web @opens-sheet declared melo-chat as intent, but the body never opens it; the
 *               inline Melo here is non-interactive, so no sheet is opened — faithful to the source).
 * @copy         FROZEN — the WhatIf strings are inline @copy FROZEN in the web source and are NOT keyed
 *               in COPY_DECK; kept VERBATIM here, including the apostrophe in "today's spend" and the
 *               em-dash in "Close — nothing was added". The £{amount} accent word renders terracotta.
 * @tokens       canvas(paper) · surface · inset · ink · muted · secondary · calm(accent) · positive ·
 *               caution · repair(negative) · hairline · payday · inverse(on-accent white) · Fraunces ·
 *               tabular money — all from '@/folio/theme' (no new tokens).
 * @motion       count-up 380ms (NOT the canonical 700ms — it replays on every stepper tap; honour the
 *               in-code value) on the two stat-tile figures · route-draw 900ms (NOT 2200ms; replays on
 *               every amount change) on the accent money path · slide-in-r 360ms (whole-screen
 *               entrance) · press 0.97 (steppers, both CTAs, back chevron). Reduced motion → final state.
 * @melo-mood    dynamic severity (the web kit took calm|soft|alert computed from newLow); reconciled to
 *               the canonical Melo vocabulary the SAME way the Today wave did — soft → curious,
 *               alert → concern, calm → calm — so copy still carries meaning and no unmapped 'alert'
 *               ships. WhatIf's documented exploring baseline is curious; the dynamic verdict overrides
 *               it because the line's meaning forks with newLow.
 *
 * @rn-engine money-path — WIRED. baseLow is the real lowest-to-payday figure: the route engine's
 *            tight point (route.tightPoint.amount), read through the shared `useRoute` bridge
 *            (@/folio/lib/storeRoute → computeRoute) exactly as Today reads it, so this preview sits on
 *            the same curve as the rest of the app. newLow = baseLow − amount; the days-cover burn-rate
 *            is the trailing-28-day average daily spend from transactions (ENGINES §6 "days this would
 *            last") rather than a fixed days/cycle constant. The hook can't be called conditionally, so
 *            it runs against `now ?? EPOCH` and the result is discarded for the single pre-mount frame,
 *            where baseLow falls back to the per-pressure sample (pressureLow[pressure]) — the same
 *            mount-gate convention TodayScreen uses, so a normal open never flashes a different figure.
 *            The mini path keeps its design dip shape (it is illustrative, bound to `amount`). Still
 *            preview-only — nothing is committed and no path is mutated.
 *
 * Banned visible words (import / rows / parser / extraction / OCR / sync / dashboard / analytics /
 * users / 100% / bank-grade / AI-powered / smart / provenance / source record / indexed) are absent.
 */

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { gap, radius, serif, useCountUp, useTheme, type Palette } from '@/folio/theme';
import { Melo, type MeloMood } from '@/folio/melo/Melo';
import { StatePanel } from '@/folio/ui/StatePanel';
import { AdjustPathTabs } from '@/folio/ui/AdjustPathTabs';
import {
  addWhatIfHold,
  bankAnalyticsTransactions,
  removeWhatIfHold,
  useAppStore,
  type Transaction,
  type WhatIfHold,
} from '@/folio/store';
import { ROUTE_MOUNT_SENTINEL, useRoute } from '@/folio/lib/storeRoute';
import { buildTrustedSafeRangeFromAppState } from '@/folio/lib/trustedSafeRange';
import { safeRangeSnapshotFromResult } from '@/folio/lib/decisionLedger';
import { buildDecisionScenarioComparison } from '@/folio/lib/criticalJourneys';
import { DecisionComparison } from '@/folio/ui/TrustedCoreSurfaces';
import type { Nav, Pressure } from '@/folio/types';
import type { MoneyMode } from '@/folio/lib/modes/types';

// ---------------------------------------------------------------------------
// Mode-tinted copy (BREAKS-PARITY fix) — web `getWhatIfCopy(mode)`
// (folio-melo lib/modes/action.ts, table `W`), ported verbatim. Every mode
// gets its own eyebrow, intro, headline template, low/cover labels, and
// CTA/cancel strings — same layout, different framing per Money Mode.
// ---------------------------------------------------------------------------

type WhatIfHeadline = { lead: string; accent: string; tail: string };

type WhatIfCopy = {
  eyebrow: string;
  intro: string;
  headlineTemplate: (amount: number) => WhatIfHeadline;
  lowLabel: string;
  coverLabel: string;
  cta: string;
  cancel: string;
};

const WHAT_IF_COPY: Record<MoneyMode, WhatIfCopy> = {
  survival: {
    eyebrow: 'Preview',
    intro: 'A quiet experiment',
    headlineTemplate: (a) => ({ lead: 'What if I spend', accent: `£${a}`, tail: 'today?' }),
    lowLabel: 'New lowest',
    coverLabel: 'Days this would last',
    cta: 'See it on your money path',
    cancel: 'Close — nothing was added',
  },
  stability: {
    eyebrow: 'Rhythm check',
    intro: 'A quiet experiment',
    headlineTemplate: (a) => ({ lead: 'What if I break rhythm by', accent: `£${a}`, tail: '?' }),
    lowLabel: 'Buffer after',
    coverLabel: 'Days this would last',
    cta: 'See it on the rhythm',
    cancel: 'Close — nothing was added',
  },
  growth: {
    eyebrow: 'Pace check',
    intro: 'A quiet trade-off',
    headlineTemplate: (a) => ({ lead: 'What if', accent: `£${a}`, tail: 'skips a feed?' }),
    lowLabel: 'Pace after',
    coverLabel: 'Days lost from pace',
    cta: 'See it on the pace',
    cancel: 'Close — pace unchanged',
  },
  debt: {
    eyebrow: 'Chip check',
    intro: 'A quiet trade-off',
    headlineTemplate: (a) => ({ lead: 'What if', accent: `£${a}`, tail: 'misses a chip?' }),
    lowLabel: 'Balance after',
    coverLabel: 'Days added to debt',
    cta: 'See it on the chip-down',
    cancel: 'Close — chip unchanged',
  },
  irregular: {
    eyebrow: 'Runway check',
    intro: 'A quiet experiment',
    headlineTemplate: (a) => ({ lead: 'What if', accent: `£${a}`, tail: 'leaves the runway?' }),
    lowLabel: 'Runway after',
    coverLabel: 'Days of runway left',
    cta: 'See it on the runway',
    cancel: 'Close — runway unchanged',
  },
  household: {
    eyebrow: 'Side check',
    intro: 'A quiet experiment',
    headlineTemplate: (a) => ({ lead: 'What if your side spends', accent: `£${a}`, tail: '?' }),
    lowLabel: 'Your side after',
    coverLabel: 'Days your side lasts',
    cta: 'See it on your side',
    cancel: 'Close — nothing was added',
  },
  planning: {
    eyebrow: 'Date check',
    intro: 'A quiet trade-off',
    headlineTemplate: (a) => ({ lead: 'What if', accent: `£${a}`, tail: 'moves the date?' }),
    lowLabel: 'Date after',
    coverLabel: 'Days pushed back',
    cta: 'See it on the date',
    cancel: 'Close — date unchanged',
  },
  optimizer: {
    eyebrow: 'Leak check',
    intro: 'A quiet experiment',
    headlineTemplate: (a) => ({ lead: 'What if', accent: `£${a}`, tail: 'leaks again?' }),
    lowLabel: 'Recovered after',
    coverLabel: 'Days of leak allowed',
    cta: 'See it on the leaks',
    cancel: 'Close — nothing was cut',
  },
  reset: {
    eyebrow: 'Just this',
    intro: 'A quiet experiment',
    headlineTemplate: (a) => ({ lead: 'What if I use', accent: `£${a}`, tail: 'today?' }),
    lowLabel: 'Left after',
    coverLabel: 'Days this would last',
    cta: 'Hold this one',
    cancel: 'Close — nothing changed',
  },
  lowVis: {
    eyebrow: 'Rough preview',
    intro: 'A quiet guess',
    headlineTemplate: (a) => ({ lead: 'Roughly, if', accent: `£${a}`, tail: 'goes today?' }),
    lowLabel: 'Rough low',
    coverLabel: 'Rough days left',
    cta: 'Keep as a rough guide',
    cancel: 'Close — just looking',
  },
};

function getWhatIfCopy(mode: MoneyMode): WhatIfCopy {
  return WHAT_IF_COPY[mode] ?? WHAT_IF_COPY.survival;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ---------------------------------------------------------------------------
// Constants — ported verbatim from the web source.
// ---------------------------------------------------------------------------

// The pre-mount-gate fallback lowest-to-payday spare for each route pressure band. The web WhatIf
// imported this from types.ts (`pressureLow`); the RN `@/folio/types` defines the `Pressure` union but
// not the derived maps (the Today wave keeps its own copy in screens/today/pressure.ts for the same
// reason). WhatIf is strictly read-only and can only edit its own file, so it keeps the WhatIf-local
// copy here. The real baseLow now comes from the route engine's tight point (route.tightPoint.amount);
// this map is only the honest per-pressure sample shown for the single frame before the mount-gate
// opens — the same fallback TodayScreen uses, so a normal open never flashes a different figure.
const pressureLow: Readonly<Record<Pressure, number>> = {
  safe: 612,
  calm: 325,
  soft: 184,
  pressured: 42,
  overspent: -86,
};

// Stepper bounds (web Math.max(0, v - 5) / Math.min(500, v + 5)).
const AMOUNT_MIN = 0;
const AMOUNT_MAX = 500;
const AMOUNT_STEP = 5;
const AMOUNT_DEFAULT = 40;

// Burn-rate window: the trailing days of transactions whose average daily spend gives the real daily
// burn (ENGINES §6 "days this would last"). The web used a fixed 28 as the divisor itself; here 28 is
// the LOOK-BACK WINDOW — Σ spend magnitude over the last 28 days ÷ 28 = £/day. daysCover =
// max(0, round((newLow / burn) * 10) / 10). When there is no recent spend the burn is 0 (a divide-by-
// zero / Infinity), so we fall back to the web's literal 28-£/day stand-in to keep the figure honest
// and the render identical to the pre-engine state.
const TRAILING_DAYS = 28;
const BURN_FALLBACK = 28;

// Verdict thresholds — load-bearing (preserve exactly). New lowest reads negative when
// breachesGoal || newLow < TIGHT; Days reads negative when daysCover < DAYS_NEGATIVE.
const TIGHT = 50;
const EASY = 150;
const DAYS_NEGATIVE = 5;

// count-up 380ms here (NOT the canonical 700ms — it replays on every stepper tap; the table default
// would feel laggy). route-draw 900ms (NOT 2200ms; replays on every amount change).
const COUNT_UP_MS = 380;
const ROUTE_DRAW_MS = 900;

// slide-in-r geometry (web .slide-in-r): the whole screen enters from +28px on X with a fade, 360ms.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// The kit press feel (web `press` util — scale 0.97 / lowered opacity).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// em → absolute conversions. The captions/eyebrow track 0.14em; the eyebrow is 12px, the small
// captions are 10.5px (web text-[10.5px] tracking-[0.14em]).
const EYEBROW_TRACKING = 12 * 0.14;
const CAPTION_TRACKING = 10.5 * 0.14;

// SVG user space — the web authored the mini path in a 390×200 viewBox, rendered ~140px tall. Every
// coordinate below is the web coordinate, unchanged; react-native-svg scales it via the viewBox.
const VB_W = 390;
const VB_H = 200;
const ROUTE_DASH = 900; // >= the actual path length so the dash-offset draw never clips.

// Minus glyph — the web rendered "−" (U+2212 minus sign), not a hyphen. Kept exact.
const MINUS = '−';

// A stable sentinel "now" for the one render before the mount-gate opens. `useRoute` can't be called
// conditionally, so it runs against this until `now` is set; that frame's result is discarded (baseLow
// falls back to pressureLow[pressure]). Module-level so its identity never churns the hook's memo.
// Mirrors TodayScreen's EPOCH exactly.
const EPOCH = ROUTE_MOUNT_SENTINEL;

// DAY_MS for the trailing-window cut-off (local-clock millisecond subtraction; consistent with the
// transaction `when` ISO timestamps the burn-rate averages over).
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Reduced-motion read — mirrors Melo.tsx / VisualizerScreen.tsx exactly: read once, then subscribe.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// trailingDailyBurn — the real daily spend rate (£/day) behind "Days this would last" (ENGINES §6).
// Pure: sums the SPEND magnitude (stored amount < 0 → −amount) of transactions in the trailing window
// [now − TRAILING_DAYS, now] and divides by the window. Inflows (amount > 0, e.g. income/refunds) are
// excluded — only money going out counts toward how long a balance lasts. Returns 0 when there is no
// recent spend so the caller can apply the honest fallback rather than dividing by zero.
// ---------------------------------------------------------------------------

function trailingDailyBurn(transactions: readonly Transaction[], now: Date): number {
  const cutoffMs = now.getTime() - TRAILING_DAYS * DAY_MS;
  let spend = 0;
  for (const tx of transactions) {
    if (tx.amount >= 0) continue; // inflow — not spend
    const whenMs = new Date(tx.when).getTime();
    if (!Number.isFinite(whenMs) || whenMs < cutoffMs || whenMs > now.getTime()) continue;
    spend += -tx.amount; // stored "negative = spend" → outflow magnitude
  }
  return spend / TRAILING_DAYS;
}

// ---------------------------------------------------------------------------
// The render states this screen can occupy (STATES.md). offline ≡ populated (local-first).
// ---------------------------------------------------------------------------

export type WhatIfState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type WhatIfScreenProps = {
  nav: Nav;
  /** The route pressure mood. The web read this off `nav.pressure`; the RN Nav contract has no
   *  pressure, so the shell threads it explicitly (same convention as Today / Pots). Defaults to the
   *  shell's calm landing band. */
  pressure?: Pressure;
  /** STATES.md branch. 'populated' (the only branch the web body implements) · 'loading' (Melo curious
   *  + one line, never a spinner — the ~380ms count-up is the recompute affordance) · 'empty' (no money
   *  to preview → the calm doorway) · 'error' (n/a here — no async — falls through to populated) ·
   *  'offline' (≡ populated; no network at all). Defaults to 'populated'. */
  state?: WhatIfState;
};

// ---------------------------------------------------------------------------
// WhatIfScreen
// ---------------------------------------------------------------------------

export function WhatIfScreen({ nav, pressure = 'calm', state = 'populated' }: WhatIfScreenProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // Live store reads (read-only — WhatIf writes nothing).
  const tightPointGoal = useAppStore((s) => s.tightPointGoal);
  const potsTotal = useAppStore((s) => s.pots.reduce((sum, p) => sum + p.saved, 0));
  const whatIfHolds = useAppStore((s) => s.whatIfHolds ?? []);
  const appState = useAppStore((s) => s);
  const transactions = useMemo(() => bankAnalyticsTransactions(appState), [appState]);

  // Mode-tinted copy (BREAKS-PARITY fix) — eyebrow, intro, headline template, low/cover labels, and
  // CTA/cancel strings all vary by Money Mode (web `getWhatIfCopy(mode)`).
  const moneyMode = useAppStore((s) => s.moneyMode ?? 'survival');
  const modeCopy = getWhatIfCopy(moneyMode);

  // The single piece of local state — the hypothetical spend. Clamp 0..500, step 5.
  const [amount, setAmount] = useState(AMOUNT_DEFAULT);
  const [recurrence, setRecurrence] = useState<WhatIfHold['recurrence']>('once');
  const [selectedScenarioId, setSelectedScenarioId] = useState('proposed');

  // Mount-gate (mirrors TodayScreen): defer `new Date()` so nothing date-derived renders on the first
  // frame and the engine has an honest "today". Until it opens, baseLow falls back to the per-pressure
  // sample so a normal open never flashes a different figure.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  // @rn-engine money-path — the real lowest-to-payday baseline. The hook can't be called conditionally,
  // so it always runs against `now ?? EPOCH`; before the mount-gate opens (`now === null`) the engine
  // has no honest "today", so that transient result is discarded (`route = null`) and baseLow keeps the
  // per-pressure sample for that single frame. Once open, baseLow = route.tightPoint.amount — the same
  // curve Today reads. newLow = baseLow − amount.
  const routeResult = useRoute(now ?? EPOCH);
  const route = now ? routeResult : null;
  const baseLow = route ? route.tightPoint.amount : pressureLow[pressure];
  const newLow = baseLow - amount;

  // Days this would last — newLow ÷ the real daily burn (trailing-28-day average spend from
  // transactions, ENGINES §6). With no recent spend the burn is 0; fall back to the web's literal
  // 28-£/day stand-in so the figure stays honest and the divide never blows up. Same rounding shape as
  // the web (one decimal place, floored at 0).
  const liveBurn = now ? trailingDailyBurn(transactions, now) : 0;
  const burn = liveBurn > 0 ? liveBurn : BURN_FALLBACK;
  const daysCover = Math.max(0, Math.round((newLow / burn) * 10) / 10);

  // count-up (380ms) drives the two stat-tile figures; reduce-motion snaps to the target. The centre
  // £{amount} uses the raw value (it is the input — instant, never animated).
  const lowDisplay = useCountUp(newLow, COUNT_UP_MS, reduceMotion);
  const coverDisplay = useCountUp(daysCover, COUNT_UP_MS, reduceMotion);

  // Honest signal: would this drop you below your Melo-set floor?
  const breachesGoal = tightPointGoal !== null && newLow < tightPointGoal;
  // Honest signal: do you have enough across pots to absorb it? (Keep the >= direction.)
  const wouldEatPots = newLow < 0 && potsTotal >= Math.abs(newLow);
  const modifiedAmount = Math.max(AMOUNT_MIN, amount - AMOUNT_STEP);
  const safeRangeSnapshot = useMemo(() => {
    if (now === null) return null;
    return safeRangeSnapshotFromResult(buildTrustedSafeRangeFromAppState(appState, { now }));
  }, [appState, now]);
  const comparisonRows = useMemo(
    () =>
      safeRangeSnapshot === null
        ? []
        : buildDecisionScenarioComparison({
            baseline: safeRangeSnapshot,
            proposed: {
              id: 'proposed',
              label: `Hold £${amount} ${recurrence}`,
              decisionType: 'scenario-choice',
              immediateCashEffectMinor: -Math.round(amount * 100),
              expectedBufferEffectMinor: -Math.round(amount * 100),
              reversible: true,
              risk: newLow < 0 || breachesGoal ? 'high' : newLow < TIGHT ? 'medium' : 'low',
              assumptionFactIds: ['fact_what_if_hold_preview'],
            },
            modified: {
              id: 'modified',
              label: `Hold £${modifiedAmount} instead`,
              immediateCashEffectMinor: -Math.round(modifiedAmount * 100),
              expectedBufferEffectMinor: -Math.round(modifiedAmount * 100),
              reversible: true,
              risk:
                baseLow - modifiedAmount < 0 || breachesGoal
                  ? 'high'
                  : baseLow - modifiedAmount < TIGHT
                    ? 'medium'
                    : 'low',
              assumptionFactIds: ['fact_what_if_hold_preview'],
            },
          }),
    [amount, baseLow, breachesGoal, modifiedAmount, newLow, recurrence, safeRangeSnapshot],
  );

  // The mode-tinted headline for the current amount (BREAKS-PARITY fix).
  const headline = modeCopy.headlineTemplate(amount);

  // Mini money path — the illustrative envelope of the engine's route. `route.points` is the real
  // today→payday curve (the same series Today plots); its minimum IS `route.tightPoint`, which this
  // screen already consumes as `baseLow` above — so the mini path's lowest-point band sits on the real
  // engine low. The pixel geometry is the FROZEN web shape (dipY = min(190, 130 + amount*0.55)): a fixed
  // editorial stand-in whose dip depth tracks the hypothetical spend. Coordinates and copy unchanged.
  const dipY = Math.min(190, 130 + amount * 0.55);
  const d = `M 18 80 C 70 90, 110 70, 160 110 S 240 ${dipY}, 300 150 S 350 60, 372 50`;

  // The dynamic verdict band (web kit calm|soft|alert), reconciled to the canonical Melo vocabulary the
  // same way the Today wave did: alert → concern, soft → curious, calm → calm.
  const mood: MeloMood =
    breachesGoal || newLow < TIGHT ? 'concern' : newLow < EASY ? 'curious' : 'calm';

  const meloLine = breachesGoal
    ? `That drops you below your £${tightPointGoal} floor.`
    : newLow < 0
      ? wouldEatPots
        ? `You'd have to dip into pots — about £${Math.abs(newLow)} from somewhere.`
        : "This one wouldn't fit. Try a smaller hold."
      : newLow < TIGHT
        ? 'This one would press you. Try a smaller hold.'
        : newLow < EASY
          ? "You'd feel it, but you'd make it."
          : 'Plenty of room. Spend if it serves you.';

  // The negative tones (web): New lowest negative when breachesGoal || newLow < 50; Days negative when
  // daysCover < 5; the floor caption is negative ONLY on breach.
  const lowIsNegative = breachesGoal || newLow < TIGHT;
  const daysIsNegative = daysCover < DAYS_NEGATIVE;

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

  // route-draw — the accent stroke draws in via an animated dash-offset, replayed on EVERY amount
  // change (the web re-keyed the <svg> on `amount`). draw 0 = undrawn (offset = full dash), 1 = drawn
  // (offset 0). Reduce-motion = fully drawn final state.
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      draw.value = 1;
      return;
    }
    draw.value = 0;
    draw.value = withTiming(1, { duration: ROUTE_DRAW_MS, easing: EASE_OUT_EXPO });
  }, [draw, reduceMotion, amount]);
  const routeProps = useAnimatedProps(() => ({
    strokeDashoffset: ROUTE_DASH * (1 - draw.value),
  }));

  const decrement = () => setAmount((v) => Math.max(AMOUNT_MIN, v - AMOUNT_STEP));
  const increment = () => setAmount((v) => Math.min(AMOUNT_MAX, v + AMOUNT_STEP));

  // empty — no money to preview yet (STATES.md WhatIf empty = "Add some moves first"). The web body has
  // no empty guard; the port adds the calm doorway (Melo + Fraunces line + one CTA → intake) so the
  // experiment never opens onto an empty path. The CTA routes to intake (add what you have).
  if (state === 'empty') {
    return (
      <View style={[styles.flex, { backgroundColor: t.canvas, paddingTop: insets.top + gap.lg }]}>
        <View style={styles.emptyJourneyNav}>
          <AdjustPathTabs active="preview" nav={nav} />
        </View>
        <StatePanel
          body="Once there’s something on your money path, you can try a spend here and see how the lowest point shifts — before any of it counts."
          kind="first-time-empty"
          primaryAction={{ label: 'Add what you have', onPress: () => nav.go('intake') }}
          title="Add some moves first."
        />
      </View>
    );
  }

  // loading — Melo curious + ONE line, NEVER a spinner (the hard rule + STATES.md "recompute 400ms").
  // There is no async on this surface; the ~380ms stat count-up is the real recompute affordance. This
  // branch only renders if the shell ever threads state="loading".
  if (state === 'loading') {
    return (
      <StatePanel
        body="Recomputing the path without changing your saved money."
        fullScreen
        kind="loading"
        title="Working out where this lands"
      />
    );
  }

  // populated / offline / error — the slider. offline ≡ populated (no network); error is n/a (no async
  // to fail), so it falls through to the same experiment.
  return (
    <Animated.View style={[styles.flex, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={enterStyle}>
          {/* Header — back · "Preview" eyebrow · balancing 20px spacer (the 3-column balance that
              centres the eyebrow; without it the eyebrow drifts). */}
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={16}
              onPress={nav.back}
              style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
            >
              <Text style={styles.backArrow}>←</Text>
            </Pressable>
            <Text style={styles.eyebrow}>{modeCopy.eyebrow}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <AdjustPathTabs active="preview" nav={nav} />

          {/* Title — italic kicker · headline with the terracotta £{amount} accent word. Both are
              mode-tinted (BREAKS-PARITY fix — was fixed to survival's "What if I spend £X today?"). */}
          <View style={styles.title}>
            <Text style={styles.kicker}>{modeCopy.intro}</Text>
            <Text accessibilityRole="header" style={styles.headline}>
              {`${headline.lead} `}
              <Text style={styles.headlineAccent}>{headline.accent}</Text>
              {` ${headline.tail}`}
            </Text>
          </View>

          {/* Spend card — the −/+ steppers around the centred amount, then the mini money path. */}
          <View style={styles.spendCard}>
            <View style={styles.stepperRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Spend five pounds less"
                onPress={decrement}
                style={({ pressed: isPressed }) => [
                  styles.stepper,
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={styles.stepperGlyph}>{MINUS}</Text>
              </Pressable>

              <View style={styles.stepperCenter}>
                <Text style={styles.amountValue}>£{amount}</Text>
                <Text style={styles.amountCaption}>today's spend</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Spend five pounds more"
                onPress={increment}
                style={({ pressed: isPressed }) => [
                  styles.stepper,
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={styles.stepperGlyph}>+</Text>
              </Pressable>
            </View>

            {/* Mini money path (@rn-engine money-path) — a dashed hairline guide under an accent stroke
                that draws in (route-draw 900ms, replayed on every amount change), with the payday cap
                and the shifting lowest-point dot + label. */}
            <View style={styles.svgWrap}>
              <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} fill="none">
                {/* Dashed guide path. */}
                <Path d={d} stroke={t.hairline} strokeWidth={1} strokeDasharray="2 4" fill="none" />
                {/* Accent route — animated dash-offset draw. */}
                <AnimatedPath
                  d={d}
                  stroke={t.calm}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeDasharray={ROUTE_DASH}
                  animatedProps={routeProps}
                  fill="none"
                />
                {/* Payday end-cap + label. */}
                <Circle cx={372} cy={50} r={5} fill={t.calm} />
                <SvgText x={350} y={40} fontFamily={serif.displayItalic} fontSize={10} fill={t.ink}>
                  payday
                </SvgText>
                {/* Lowest-point dot + label — both bound to `amount` via dipY. */}
                <Circle cx={300} cy={dipY} r={3.5} fill={t.ink} />
                <SvgText
                  x={245}
                  y={dipY + 18}
                  fontFamily={serif.displayItalic}
                  fontSize={10}
                  fill={t.muted}
                >
                  lowest point
                </SvgText>
              </Svg>
            </View>
          </View>

          {/* Stat tiles — New lowest (count-up, negative tone on breach / tight) + floor caption (only
              when a floor is set), and Days this would last (count-up, negative under 5d) + pots total. */}
          <View style={styles.tilesRow}>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>{modeCopy.lowLabel}</Text>
              <Text
                style={[styles.tileValue, lowIsNegative ? styles.tileValueNegative : undefined]}
              >
                {formatGBP(Math.round(lowDisplay))}
              </Text>
              {tightPointGoal !== null ? (
                <Text
                  style={[
                    styles.tileCaption,
                    styles.tabular,
                    breachesGoal ? styles.tileCaptionNegative : undefined,
                  ]}
                >
                  floor £{tightPointGoal}
                </Text>
              ) : null}
            </View>

            <View style={styles.tile}>
              <Text style={styles.tileLabel}>{modeCopy.coverLabel}</Text>
              <Text
                style={[styles.tileValue, daysIsNegative ? styles.tileValueNegative : undefined]}
              >
                {coverDisplay.toFixed(1)}d
              </Text>
              <Text style={[styles.tileCaption, styles.tabular]}>£{potsTotal} in pots</Text>
            </View>
          </View>

          {/* Melo line — the quiet companion verdict, mood derived dynamically from newLow. Melo is
              grounded and non-interactive here (the web never made it tappable / never opened a sheet). */}
          <View style={styles.meloRow}>
            <Melo size={28} mood={mood} />
            <Text style={styles.meloLine}>{meloLine}</Text>
          </View>

          {comparisonRows.length > 0 ? (
            <DecisionComparison
              rows={comparisonRows}
              selectedId={selectedScenarioId}
              onSelect={setSelectedScenarioId}
            />
          ) : null}

          <View style={styles.recurrenceRow}>
            {(['once', 'weekly', 'monthly'] as const).map((option) => {
              const selected = recurrence === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setRecurrence(option)}
                  style={({ pressed: isPressed }) => [
                    styles.recurrenceButton,
                    selected ? styles.recurrenceButtonSelected : undefined,
                    isPressed ? styles.pressed : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.recurrenceLabel,
                      selected ? styles.recurrenceLabelSelected : undefined,
                    ]}
                  >
                    {option === 'once' ? 'one-off' : option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {whatIfHolds.length > 0 ? (
            <View style={styles.holdsCard}>
              <Text style={styles.holdsEyebrow}>Active holds</Text>
              {whatIfHolds.map((hold, index) => (
                <View
                  key={hold.id}
                  style={[
                    styles.holdRow,
                    index > 0
                      ? {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: t.hairline,
                        }
                      : undefined,
                  ]}
                >
                  <Text style={styles.holdAmount}>
                    £{hold.amount} <Text style={styles.holdRecurrence}>· {hold.recurrence}</Text>
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove £${hold.amount} ${hold.recurrence} hold`}
                    onPress={() => removeWhatIfHold(hold.id)}
                    hitSlop={10}
                  >
                    <Text style={styles.removeHold}>remove</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Save £${amount} ${recurrence} as a hold`}
            onPress={() => {
              if (selectedScenarioId === 'baseline') {
                nav.go('today');
                return;
              }
              const selectedAmount = selectedScenarioId === 'modified' ? modifiedAmount : amount;
              const selectedRow = comparisonRows.find((row) => row.id === selectedScenarioId);
              addWhatIfHold({
                amount: selectedAmount,
                recurrence,
                scenarios: comparisonRows.map((row) => row.scenario),
                ...(selectedRow === undefined
                  ? {}
                  : { selectedScenarioId: selectedRow.scenario.id }),
              });
              nav.go('today');
            }}
            style={({ pressed: isPressed }) => [
              styles.saveHold,
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={styles.saveHoldLabel}>
              Save as hold · £{amount} {recurrence}
            </Text>
          </Pressable>

          {/* CTAs — the dominant "See it on your money path" (→ today) and the quiet, honest close
              ("Close — nothing was added", → back). Neither commits by itself. */}
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Opens your money path on Today."
            onPress={() => nav.go('today')}
            style={({ pressed: isPressed }) => [
              styles.primary,
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={styles.primaryLabel}>{modeCopy.cta}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Closes this experiment. Nothing here is saved."
            hitSlop={12}
            onPress={nav.back}
            style={({ pressed: isPressed }) => [
              styles.close,
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={styles.closeLabel}>{modeCopy.cancel}</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// formatGBP — the New-lowest figure formatter. The web's <Money>/formatGBP rendered a signed,
// grouped, no-pence pound figure (e.g. "£325" / "−£86"). Pure; ported as the local equivalent so the
// negative-low band ("£-86" → "−£86") reads as money with the same minus glyph as the steppers.
// ---------------------------------------------------------------------------

function formatGBP(value: number): string {
  const sign = value < 0 ? MINUS : '';
  const grouped = Math.abs(value).toLocaleString('en-GB');
  return `${sign}£${grouped}`;
}

// ---------------------------------------------------------------------------
// Styles — two layers per the kit DARK-MODE PATTERN. Colour + the few layout-with-colour styles ride
// in makeStyles(t) (rebuilt per render via useMemo) so the surface follows light/dark; pure-layout
// values use the gap/radius scales (no hard-coded spacing).
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    flex: { flex: 1 },
    emptyJourneyNav: { paddingHorizontal: gap.xl },

    // Loading column (Melo curious + one line). px-7 ≈ gap.xl.
    loading: {
      flex: 1,
      paddingHorizontal: gap.xl,
    },

    // The scroll content column — web px-7 pt-4.
    content: {
      paddingHorizontal: gap.xl,
    },

    // Header — back · "Preview" eyebrow · 20px balancing spacer (web flex justify-between, w-5 spacer).
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    backArrow: {
      color: t.muted,
      fontSize: 20,
    },
    eyebrow: {
      color: t.muted,
      fontSize: 12,
      letterSpacing: EYEBROW_TRACKING,
      textTransform: 'uppercase',
    },
    headerSpacer: {
      width: 20,
    },

    // Title — web mt-5. Italic Fraunces kicker (13px muted), then the 30px headline with the accent £.
    title: {
      marginTop: gap.xl,
    },
    kicker: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      lineHeight: 18,
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 30,
      letterSpacing: -0.3,
      lineHeight: 32, // web leading-[1.05] on 30px ≈ 31.5
      marginTop: gap.xs,
    },
    // The accent word £{amount} — same upright Fraunces face, recoloured terracotta (web
    // <em class="not-italic text-[var(--accent)]">). Inherits the headline face; only colour overridden.
    headlineAccent: {
      color: t.calmStrong,
      fontFamily: serif.display,
      fontStyle: 'normal',
    },

    // Spend card — web mt-5 bg-surface hairline rounded-2xl p-5.
    spendCard: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.xl,
      padding: gap.xl,
    },
    stepperRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    // The 44px round stepper — inset well fill + hairline (web w-11 h-11 rounded-full hairline bg-inset).
    stepper: {
      alignItems: 'center',
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    stepperGlyph: {
      color: t.ink,
      fontSize: 20,
      lineHeight: 24,
    },
    stepperCenter: {
      alignItems: 'center',
    },
    // The centred amount — the input itself (Money xl, tone accent). Instant, never count-up.
    amountValue: {
      color: t.calmStrong,
      fontSize: 40,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
      letterSpacing: -1,
      lineHeight: 44,
    },
    amountCaption: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: CAPTION_TRACKING,
      marginTop: gap.xs,
      textTransform: 'uppercase',
    },

    // Mini money path box — web mt-4 w-full h-[140px].
    svgWrap: {
      height: 140,
      marginTop: gap.lg,
      width: '100%',
    },

    // Stat tiles — web mt-4 grid-cols-2 gap-2.5.
    tilesRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: gap.lg,
    },
    // Each tile — web bg-surface hairline rounded-2xl px-4 py-4.
    tile: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      flex: 1,
      paddingHorizontal: gap.lg,
      paddingVertical: gap.lg,
    },
    tileLabel: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: CAPTION_TRACKING,
      textTransform: 'uppercase',
    },
    // The tile figure (Money md). Ink by default; coral (repair) on the negative bands.
    tileValue: {
      color: t.ink,
      fontSize: 22,
      fontVariant: ['tabular-nums'],
      fontWeight: '700',
      letterSpacing: -0.4,
      marginTop: gap.sm,
    },
    tileValueNegative: {
      color: t.repairInk,
    },
    tileCaption: {
      color: t.muted,
      fontSize: 10.5,
      marginTop: gap.xs,
    },
    tileCaptionNegative: {
      color: t.repairInk,
    },
    tabular: {
      fontVariant: ['tabular-nums'],
    },

    // Melo line — web mt-5 flex items-start gap-3, the quote in Fraunces italic muted.
    meloRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: gap.md,
      marginTop: gap.xl,
    },
    meloLine: {
      color: t.muted,
      flex: 1,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      lineHeight: 18,
    },
    recurrenceRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: gap.lg,
    },
    recurrenceButton: {
      alignItems: 'center',
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      flex: 1,
      height: 36,
      justifyContent: 'center',
    },
    recurrenceButtonSelected: {
      backgroundColor: t.calmSoft,
      borderColor: t.calm,
    },
    recurrenceLabel: {
      color: t.muted,
      fontSize: 12,
    },
    recurrenceLabelSelected: {
      color: t.calmStrong,
      fontWeight: '600',
    },
    holdsCard: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.lg,
      overflow: 'hidden',
      paddingHorizontal: gap.lg,
    },
    holdsEyebrow: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: CAPTION_TRACKING,
      paddingTop: gap.lg,
      textTransform: 'uppercase',
    },
    holdRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 44,
    },
    holdAmount: {
      color: t.ink,
      fontSize: 13,
      fontVariant: ['tabular-nums'],
    },
    holdRecurrence: { color: t.muted, fontSize: 11.5 },
    removeHold: { color: t.muted, fontSize: 11.5 },
    saveHold: {
      alignItems: 'center',
      backgroundColor: t.calm,
      borderRadius: radius.xl,
      height: 54,
      justifyContent: 'center',
      marginTop: gap.xl,
    },
    saveHoldLabel: {
      color: t.accentInk,
      fontSize: 15,
      fontWeight: '500',
    },

    // Primary CTA — accent fill with fixed ink foreground. White/paper text on accent fails AA for
    // normal-size labels, so this intentionally corrects the older web text-white pairing.
    primary: {
      alignItems: 'center',
      backgroundColor: t.calm,
      borderRadius: radius.xl,
      height: 54,
      justifyContent: 'center',
      marginBottom: gap.md,
      marginTop: gap.sm,
    },
    primaryLabel: {
      color: t.accentInk,
      fontSize: 15,
      fontWeight: '500',
    },

    // Quiet close — web press mb-8 h-[44px] text-[13px] muted. The honest "nothing was added" line.
    close: {
      alignItems: 'center',
      height: 44,
      justifyContent: 'center',
      marginBottom: gap.xl,
    },
    closeLabel: {
      color: t.muted,
      fontSize: 13,
    },

    // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
  });
}
