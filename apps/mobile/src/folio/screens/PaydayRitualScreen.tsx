// PaydayRitualScreen — the faithful 1:1 React Native port of the web close-the-cycle ritual
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPaydayRitual.tsx).
//
// @rn-screen    PaydayRitualScreen
// @rn-stack     MainTabs > Today > Ritual
// @purpose      Multi-step (4-step) close-the-cycle ceremony. Computes retrospective actuals for the
//               trailing 30 days (spent, left-over/spare, lowest tight point, set-aside), walks the
//               user through them one slow step at a time with a Melo line per step, captures one
//               optional 140-char "line for next-you", and on the final step calls addCycle() to
//               record the closed cycle. Copy is FROZEN — ceremonial, slow, never rushed. nav.back /
//               "Save and finish later" both exit WITHOUT recording a cycle.
// @reads        subs, subPaused, onboarding, transactions, pots, currentBalance, potLedger, nextYouNote
// @writes       setNextYouNote (every keystroke) · addCycle (once, on the final-step CTA)
// @opens-sheet  share (~350ms after finish) — Melo chat (~1500ms after finish) is opened via
//               nav.openMelo, not a SheetId.
// @copy         FROZEN — ceremonial, slow, never rushed.
// @tokens       canvas (paper) · calm (accent) · positive · hairline · muted · ink · surface · inset
//               · inverse — all from the kit via '@/folio/theme'. No new token.
// @motion       progress-dot width/colour tween (500ms) · count-up on the stat money (money never
//               slides) · verdict-stamp (the seal on completion) · press 0.97 (kit `pressed`) · Melo
//               breathe/blink + mood-swap per step. Reduced motion = final state.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/store/copy sources):
//   • FOUR STEPS, populated happy-path is the only branch this component renders; the screen-level
//     empty branch ("Nothing to close yet") is gated upstream but rendered here for completeness via
//     EmptyState, so the surface never dead-ends if mounted with no cycle to close (STATES.md).
//   • The accent word in each headline (month / a little / squeeze / line) is rendered UPRIGHT
//     terracotta inside the Fraunces line — the web <em class="not-italic text-[accent]"> — built as
//     three Text runs so the accent run is the single coloured, non-italic span (NOT italic).
//   • RETROSPECTIVE ACTUALS are REAL store data, end to end:
//       spent     = Σ|negative txn amount| in the trailing 30 days (transactions)
//       setAside  = round(Σ potLedger DEPOSIT entries in the trailing 30 days) (potLedger)
//       spare     = route.spare      — balance on the resolved next payday (the curve's read-out)
//       tightPoint = route.tightPoint.{amount,date} — lowest projected balance + the day it lands on
//     `spare` and the tight point now come from the SAME pure money-path engine every other surface
//     uses, via the shared store→route bridge (`@/folio/lib/storeRoute`: `useRoute(now)` reactive /
//     `routeFromStore(state, now)` pure). The clock is mount-gated like TodayScreen (module-level EPOCH
//     + a `now` state) so `new Date()` never runs during the first render. See `// @rn-engine money-path`.
//   • Step 3 body now names the REAL tightest day from `route.tightPoint.date` (formatted with the same
//     `formatDayProse` Today uses), replacing the web's hardcoded "12 Jul looks tightest…" placeholder.
//     The unverifiable "two bills land that week" claim is dropped — only honest copy ships.
//   • setNextYouNote fires on EVERY keystroke (web parity) so the draft survives leave/return; note is
//     seeded from the persisted draft.
//   • addCycle is local + synchronous → finish never shows a spinner. The finish choreography (Today →
//     Share sheet at ~350ms → Melo chat at ~1500ms) is preserved, with both timers cleared on unmount
//     so neither fires after the screen is gone.
//   • verdict-stamp: a "Sealed" seal scale-overshoots in on finish (the ceremonial seal moment), once,
//     never looping; gated to its final state under reduce-motion.
//   • Progress dots tween width (20↔28) + colour over 500ms (web transition-all duration-500); a 4px
//     element's width tween is acceptable and mirrors the web cadence.
//   • Money counts up, never slides (MOTION rule) — the stat figure settles to target via useCountUp.
//   • The page root stays static. Android can retain full-screen transformed layers after navigation,
//     so motion is reserved for the progress, values, seal, and Melo rather than the entire surface.
//   • The step-4 textarea is a multiline TextInput (autoFocus, maxLength 140, 3 lines) on an inset
//     well; KeyboardAvoidingView keeps the bottom CTAs reachable when the keyboard pops.
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Tap targets are >=44px (CTAs h-58 /
// h-44; back glyph carries hitSlop). Banned visible words (import / rows / parser / extraction / OCR /
// sync / dashboard / analytics / users / 100% / bank-grade / AI-powered / smart / provenance / source
// record / indexed) are absent. Copy is VERBATIM — the ritual strings are @copy FROZEN inline literals
// (the web keeps them inline; they are not keyed in COPY_DECK, whose ritual.* keys describe a different
// older ritual). The keyed copy module exposes no matching entries, so the frozen literals are inline.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  elevation,
  gap,
  pressed,
  radius,
  serif,
  useCountUp,
  useTheme,
  type Palette,
} from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { ModeFramingBanner } from '@/folio/ui/ModeFramingBanner';
import { type MeloMood } from '@/folio/melo/Melo';
import {
  addCycle,
  completePaydayRitualMelo,
  currentFinancialDate,
  endLensTrial,
  repayToPot,
  setNextYouNote,
  togglePaused,
  useAppStore,
  type AppState,
} from '@/folio/store';
import { computeGreenStreak } from '@/folio/lib/streaks';
import { poseForContext } from '@/folio/lib/melo/poseForContext';
import { useRoute } from '@/folio/lib/storeRoute';
import { buildTrustedSafeRangeFromAppState } from '@/folio/lib/trustedSafeRange';
import { safeRangeSnapshotFromResult } from '@/folio/lib/decisionLedger';
import { evaluatePaydayForecastAccountability } from '@/folio/lib/criticalJourneys';
import { formatDayProse } from '@/folio/screens/today/format';
import { ForecastAccountabilitySummary } from '@/folio/ui/TrustedCoreSurfaces';
import type { Nav } from '@/folio/types';
import { MODE_LABEL, type MoneyMode } from '@/folio/lib/modes/types';
import { triggerFeedback } from '@/folio/lib/feedback';

// ---------------------------------------------------------------------------
// Mode-aware step framing (BREAKS-PARITY fix) — web `step1ByMode` / `step2ByMode` / `step3ByMode`
// (folio-melo ScreenPaydayRitual.tsx), ported verbatim. Each of the 10 Money Modes gets its own
// eyebrow, headline, body, stat label/tone, Melo line, and CTA for every ritual step. Step bodies
// interpolate the real `Actuals` figures (spent/spare/tightPoint/setAside) — the RN engine already
// computes these honestly (route + ledger reads); only the copy tables were missing.
// ---------------------------------------------------------------------------

type ModeStepTone = 'positive' | 'ink' | 'accent';

type ModeStep = {
  eyebrow: string;
  headlineLead: string;
  headlineAccent: string;
  headlineTrail: string;
  body: string;
  statLabel: string;
  statValue: number;
  statTone: ModeStepTone;
  melo: string;
  meloMood: MeloMood;
  cta: string;
};

type ModeActuals = { spent: number; spare: number; tightPoint: number; setAside: number };

function step1ByMode(mode: MoneyMode, a: ModeActuals): ModeStep {
  const base = {
    eyebrow: `Closing · ${MODE_LABEL[mode]}`,
    statLabel: 'Left over',
    statValue: a.spare,
    statTone: 'positive' as ModeStepTone,
    meloMood: 'cheer' as MeloMood,
    cta: 'Pay yourself first',
  };
  switch (mode) {
    case 'survival':
      return {
        ...base,
        headlineLead: 'Look at the ',
        headlineAccent: 'month',
        headlineTrail: ' just gone.',
        body: `You spent ${poundsGrouped(a.spent)}. Bills cleared. Lowest balance was ${poundsGrouped(a.tightPoint)}.`,
        melo: 'You made it through. Quietly well done.',
      };
    case 'stability':
      return {
        ...base,
        headlineLead: 'The month ',
        headlineAccent: 'held',
        headlineTrail: '.',
        body: `${poundsGrouped(a.spent)} out, bills clear, buffer intact. Shape looked steady.`,
        melo: "Steady. That's the whole game in Stability.",
      };
    case 'growth':
      return {
        ...base,
        statLabel: 'Set aside',
        statValue: a.setAside,
        headlineLead: 'You ',
        headlineAccent: 'added',
        headlineTrail: ' to your pots.',
        body: `${poundsGrouped(a.setAside)} moved to savings this cycle. ${poundsGrouped(a.spare)} left over on top.`,
        melo: 'Pace shows up in months, not weeks.',
      };
    case 'debt':
      return {
        ...base,
        meloMood: 'calm',
        cta: 'Look at repayments',
        statLabel: 'After minimums',
        statTone: 'ink',
        headlineLead: 'Minimums ',
        headlineAccent: 'held',
        headlineTrail: '.',
        body: `Repayments came out clean. ${poundsGrouped(a.spare)} left after. Nothing exposed.`,
        melo: 'Steady progress. No shame, no rush.',
      };
    case 'optimizer':
      return {
        ...base,
        cta: "See what's still leaking",
        statLabel: 'Recovered',
        statValue: a.setAside,
        statTone: 'accent',
        headlineLead: 'Leaks ',
        headlineAccent: 'named',
        headlineTrail: ' and cut.',
        body: `Trimmed subs earned you back roughly ${poundsGrouped(a.setAside)} of headroom. ${poundsGrouped(a.spare)} left over on top.`,
        melo: 'Two down. Still a couple worth naming.',
      };
    case 'reset':
      return {
        ...base,
        meloMood: 'calm',
        cta: 'Start next cycle',
        headlineLead: 'Small steps, ',
        headlineAccent: 'one cycle',
        headlineTrail: '.',
        body: `You got here. Essentials covered. ${poundsGrouped(a.spare)} left over. That's the win.`,
        melo: 'One cycle done. That counts.',
      };
    case 'irregular':
      return {
        ...base,
        headlineLead: 'Uneven month, ',
        headlineAccent: 'covered',
        headlineTrail: '.',
        body: `Income was uneven but the cycle closed at ${poundsGrouped(a.spare)}. Lowest point was ${poundsGrouped(a.tightPoint)}.`,
        melo: 'The runway held. That’s the metric that matters.',
      };
    case 'planning':
      return {
        ...base,
        statLabel: 'Toward goal',
        statValue: a.setAside,
        statTone: 'accent',
        headlineLead: 'Closer to ',
        headlineAccent: 'the goal',
        headlineTrail: '.',
        body: `${poundsGrouped(a.setAside)} moved toward what you're planning for. ${poundsGrouped(a.spare)} sitting free.`,
        melo: 'Every cycle nudges the date closer.',
      };
    case 'household':
      return {
        ...base,
        headlineLead: 'Your ',
        headlineAccent: 'half',
        headlineTrail: ' held.',
        body: `Your share cleared. ${poundsGrouped(a.spare)} left over on your side.`,
        melo: 'Household stayed square. Nice.',
      };
    case 'lowVis':
      return {
        ...base,
        meloMood: 'curious',
        headlineLead: 'A little ',
        headlineAccent: 'clearer',
        headlineTrail: ' now.',
        body: `${a.spent > 0 ? `Spent about ${poundsGrouped(a.spent)}.` : 'Not enough data yet to name a total.'} Closing balance around ${poundsGrouped(a.spare)}.`,
        melo: 'Each cycle sharpens the picture.',
      };
  }
}

function step2ByMode(mode: MoneyMode, a: ModeActuals, potNames: string): ModeStep {
  const base = {
    eyebrow: 'Step two',
    statLabel: 'Set aside',
    statValue: a.setAside,
    statTone: 'ink' as ModeStepTone,
    meloMood: 'calm' as MeloMood,
    cta: "See what's ahead",
  };
  switch (mode) {
    case 'growth':
      return {
        ...base,
        cta: 'Check the pace',
        statTone: 'positive',
        headlineLead: 'Feed the ',
        headlineAccent: 'cadence',
        headlineTrail: '.',
        body:
          a.setAside > 0
            ? `${potNames || 'Your pots'} — ${poundsGrouped(a.setAside)} moved this cycle. Nudge the pace before it drifts.`
            : 'No top-ups yet. Add one now — cadence beats size.',
        melo: 'Rhythm compounds. Miss one, catch it next cycle.',
      };
    case 'debt':
      return {
        ...base,
        cta: 'Check repayments',
        statLabel: 'Freed up',
        statTone: 'accent',
        headlineLead: 'Any ',
        headlineAccent: 'extra',
        headlineTrail: ' onto the balance?',
        body:
          a.spare > 0
            ? `${poundsGrouped(a.spare)} sitting free. Even £10 extra shortens the tail.`
            : 'Repayments held. No extra to push this cycle — that’s ok.',
        melo: 'Every extra pound bought is real progress.',
      };
    case 'optimizer':
      return {
        ...base,
        cta: 'See what still leaks',
        statLabel: 'Recovered',
        statTone: 'accent',
        headlineLead: 'Which ',
        headlineAccent: 'leak',
        headlineTrail: ' next?',
        body: "Pick one more subscription that isn't earning its cost. Cutting now saves 12× next year.",
        melo: 'One a cycle. That’s the whole method.',
      };
    case 'reset':
      return {
        ...base,
        cta: 'Hold the line',
        headlineLead: 'Hold the ',
        headlineAccent: 'essentials',
        headlineTrail: ' line.',
        body: 'No pot moves this cycle. Rest the plan — essentials covered is the win.',
        melo: "Recovery isn't performance. Small is fine.",
      };
    case 'planning':
      return {
        ...base,
        cta: 'See the date shift',
        statLabel: 'Toward goal',
        statTone: 'accent',
        headlineLead: 'Closer to ',
        headlineAccent: 'the goal',
        headlineTrail: '.',
        body:
          a.setAside > 0
            ? `${poundsGrouped(a.setAside)} moved toward what you're planning for.`
            : 'No move this cycle. The date holds — nudge it next payday.',
        melo: 'Every cycle nudges the date.',
      };
    case 'irregular':
      return {
        ...base,
        headlineLead: 'Level the ',
        headlineAccent: 'runway',
        headlineTrail: '.',
        body: `Uneven months smooth out when you top the runway on the good ones. ${poundsGrouped(a.setAside)} added this cycle.`,
        melo: 'The runway is the whole point.',
      };
    case 'household':
      return {
        ...base,
        headlineLead: 'Move ',
        headlineAccent: 'your share',
        headlineTrail: ' to pots.',
        body: `${poundsGrouped(a.setAside)} moved this cycle — your side of things.`,
        melo: 'Your half is holding.',
      };
    case 'lowVis':
      return {
        ...base,
        cta: 'See the shape',
        headlineLead: 'Anything you ',
        headlineAccent: 'quietly',
        headlineTrail: ' set aside?',
        body:
          a.setAside > 0
            ? `${poundsGrouped(a.setAside)} moved into pots this cycle.`
            : 'No pot moves logged. Add one now if it happened.',
        melo: 'The picture sharpens with each move.',
      };
    case 'survival':
    case 'stability':
      return {
        ...base,
        headlineLead: 'Move ',
        headlineAccent: 'a little',
        headlineTrail: ' into pots.',
        body:
          a.setAside > 0
            ? `${potNames} — ${poundsGrouped(a.setAside)} moved in this cycle so far. You can change any of these.`
            : 'No pot top-ups this cycle yet. Add one now if it feels right.',
        melo: 'Small, steady. Your future self will thank you.',
      };
  }
}

function step3ByMode(mode: MoneyMode, a: ModeActuals, tightestDayProse: string | null): ModeStep {
  const base = {
    eyebrow: 'Step three',
    statLabel: 'Next low point',
    statValue: a.tightPoint,
    statTone: 'accent' as ModeStepTone,
    meloMood: 'curious' as MeloMood,
    cta: 'Leave a note for next-you',
  };
  const dayFallback = tightestDayProse
    ? `${tightestDayProse} looks tightest. Worth knowing in advance.`
    : 'One day next month looks tightest. Worth knowing in advance.';
  switch (mode) {
    case 'stability':
      return {
        ...base,
        statLabel: 'Buffer next',
        statTone: 'ink',
        headlineLead: 'Any ',
        headlineAccent: 'collisions',
        headlineTrail: ' next month?',
        body: 'Nothing stacked in a bad week. Shape looks steady from here.',
        melo: 'Steady is the whole game.',
      };
    case 'growth':
      return {
        ...base,
        statLabel: 'Pace ahead',
        statValue: a.setAside > 0 ? 1 : 0,
        statTone: 'ink',
        headlineLead: 'Is the ',
        headlineAccent: 'pace',
        headlineTrail: ' holding?',
        body: "Look at whether next month has room for the same top-ups. If not, shrink one — don't skip.",
        melo: 'Cadence over amount.',
      };
    case 'debt':
      return {
        ...base,
        statLabel: 'Next repayment',
        headlineLead: "When's the ",
        headlineAccent: 'next',
        headlineTrail: ' repayment?',
        body: 'A big one lands mid-cycle. Cover it early so it can’t get squeezed.',
        melo: 'Front-load the important ones.',
      };
    case 'optimizer':
      return {
        ...base,
        statLabel: 'Still leaking',
        statValue: Math.max(0, a.tightPoint),
        headlineLead: "What's ",
        headlineAccent: 'still',
        headlineTrail: ' leaking?',
        body: 'Two or three subs are quiet. Naming them here makes them easier to cut next payday.',
        melo: 'Name it now, cut it later.',
      };
    case 'reset':
      return {
        ...base,
        statLabel: 'Days ahead',
        statValue: Math.max(0, Math.round(a.spare / 30)),
        statTone: 'ink',
        headlineLead: 'How many ',
        headlineAccent: 'days',
        headlineTrail: ' ahead?',
        body: "Enough runway to breathe. Don't plan further than next week.",
        melo: 'One week at a time.',
      };
    case 'planning':
      return {
        ...base,
        statLabel: 'Target shift',
        statValue: a.setAside,
        headlineLead: 'Did the ',
        headlineAccent: 'date',
        headlineTrail: ' shift?',
        body: 'This cycle nudged the goal date closer. Note where.',
        melo: 'Numbers become a date. That’s the point.',
      };
    case 'irregular':
      return {
        ...base,
        statLabel: 'Runway low',
        headlineLead: 'How ',
        headlineAccent: 'thin',
        headlineTrail: ' did the runway get?',
        body: `Lowest point was ${poundsGrouped(a.tightPoint)}. Rebuild it on the next strong month.`,
        melo: 'The runway is everything.',
      };
    case 'household':
      return {
        ...base,
        statLabel: 'Your share',
        statTone: 'ink',
        headlineLead: 'Any ',
        headlineAccent: 'imbalance',
        headlineTrail: ' to name?',
        body: 'Your side held. If theirs didn’t, name it now — not later.',
        melo: 'Small nudges beat big talks.',
      };
    case 'lowVis':
      return {
        ...base,
        statLabel: 'Next low',
        statTone: 'ink',
        headlineLead: 'Rough ',
        headlineAccent: 'shape',
        headlineTrail: ' ahead.',
        body: 'Not enough data for a sharp forecast. The rough shape is here to eyeball.',
        melo: 'Rough beats nothing.',
      };
    case 'survival':
      return {
        ...base,
        headlineLead: "Where's the ",
        headlineAccent: 'squeeze',
        headlineTrail: ' next month?',
        body: dayFallback,
        melo: 'Knowing in advance is half the work.',
      };
  }
}

// Note: the mode tables above call `poundsGrouped`, defined further down in this file (function
// declarations hoist, so call-before-definition in module order is fine).

// ---------------------------------------------------------------------------
// Constants — motion cadence + ceremony numbers, mirrored from the web original
// ---------------------------------------------------------------------------

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// The seal's signature curve — a soft overshoot (matches Review's stamp curve).
const STAMP_EASE = Easing.bezier(0.34, 1.56, 0.64, 1);

// Progress dot tween (web transition-all duration-500). Width 20↔28px.
const DOT_MS = 500;
const DOT_W_ACTIVE = 28; // web w-7
const DOT_W_REST = 20; // web w-5

// The seal scale-overshoot on finish (the ceremonial verdict-stamp).
const STAMP_MS = 600;

// Finish choreography — Today, then the Share sheet, then the Melo chat (web setTimeout 350 / 1500).
const SHARE_DELAY_MS = 350;
const MELO_DELAY_MS = 1500;

// The stat count-up duration (money never slides — it ticks to target).
const COUNT_MS = 700;

// The trailing-30-day window the retrospective actuals look back over.
const CYCLE_WINDOW_MS = 30 * 86_400_000;

// The note's hard cap (web maxLength 140).
const NOTE_MAX = 140;

// The Melo seed handed to the chat after a finish (web verbatim).
const MELO_SEED =
  'Cycle closed — pots topped up, note saved for next-you. Want to look at next month together?';

// The fallback line written into the closed cycle when the textarea is empty (web verbatim).
const NO_NOTE = 'No note this cycle.';

// A stable sentinel "now" for the one render before the mount-gate opens (mirrors TodayScreen). The
// route hook can't be called conditionally, so it runs against this until `now` is set; that frame's
// route result is discarded (`route = null`). Module-level so its identity never churns the memo.
const EPOCH = new Date(0);

// ---------------------------------------------------------------------------
// Money — whole-pound grouping, matching the web's `£${n.toLocaleString("en-GB")}`
// ---------------------------------------------------------------------------

// The web formats the ritual figures as whole pounds with thousands separators (e.g. "£1,234"). The
// kit's `money()` works in MINOR units and would drift the format, so this small helper reproduces the
// web's exact output for a whole-pound integer. Pure.
function poundsGrouped(whole: number): string {
  const sign = whole < 0 ? '-' : '';
  const digits = Math.abs(Math.round(whole)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}£${grouped}`;
}

// ---------------------------------------------------------------------------
// Reduced-motion read — mirrors Melo.tsx / StartScreen.tsx exactly
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
// Ledger actuals (ENGINES.md § 6 "cycle close numbers")
// ---------------------------------------------------------------------------

// The two close-day figures the money-path route does NOT supply — both are direct trailing-30-day
// ledger reads. `spare` and the tight point come from the route (see `// @rn-engine money-path` in the
// screen body), so they are intentionally absent here.
type LedgerActuals = {
  spent: number;
  setAside: number;
};

// Pure trailing-30-day ledger reads. `spent` = Σ|negative txn| in the window (transactions);
// `setAside` = Σ pot DEPOSIT entries in the window (potLedger). The trailing window is anchored to the
// injected `now` so nothing reads the clock during render — the mount-gated date is threaded in.
function computeLedgerActuals(s: AppState, now: Date): LedgerActuals {
  const cutoff = now.getTime() - CYCLE_WINDOW_MS;

  const spent = s.transactions
    .filter((tx) => tx.amount < 0 && new Date(tx.when).getTime() >= cutoff)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const setAside = Math.round(
    s.potLedger
      .filter((e) => e.kind === 'deposit' && new Date(e.at).getTime() >= cutoff)
      .reduce((sum, e) => sum + e.amount, 0),
  );

  return { spent: Math.round(spent), setAside };
}

// ---------------------------------------------------------------------------
// Step model
// ---------------------------------------------------------------------------

type StatTone = 'positive' | 'ink' | 'accent';

type RitualStep = {
  eyebrow: string;
  // The headline as its three runs: lead, the single accent word (upright terracotta), trail.
  headlineLead: string;
  headlineAccent: string;
  headlineTrail: string;
  // step 4 swaps the body for the textarea, so body is optional.
  body?: string;
  isNote?: boolean;
  resumePrompt?: boolean;
  stat: { label: string; value: number; tone: StatTone };
  melo: string;
  meloMood: MeloMood;
  cta: string;
  // The repay-a-pot step's real store write (BREAKS-PARITY fix) — fires once, when this step is
  // confirmed (advanced past), mirroring the web's per-step `onConfirm`.
  onConfirm?: () => void;
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export type PaydayRitualState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type PaydayRitualScreenProps = {
  nav: Nav;
  state?: PaydayRitualState;
};

export function PaydayRitualScreen({ nav, state = 'populated' }: PaydayRitualScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const [step, setStep] = useState(0);
  const [sealed, setSealed] = useState(false);

  // Mount-gate the clock (mirrors TodayScreen): defer `new Date()` to an effect so the first render
  // never reads the clock. Until `now` is set, the route runs against EPOCH and its result is
  // discarded (`route = null`); the ledger reads fall back to the same EPOCH window for that one frame.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  // Store reads (the spec's @reads). `spent`/`setAside` derive from these ledger slices; `pots`
  // backs step 2's first-name list; the route (below) reads the rest of the snapshot internally.
  const transactions = useAppStore((st) => st.transactions);
  const potLedger = useAppStore((st) => st.potLedger);
  const pots = useAppStore((st) => st.pots);
  const appState = useAppStore((st) => st);
  const persistedNote = useAppStore((st) => st.nextYouNote);
  const moneyMode = useAppStore((st) => st.moneyMode ?? 'survival');
  const onboardingDone = useAppStore((st) => st.onboarding.done);
  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);
  const cycles = useAppStore((st) => st.cycles);
  const soundEnabled = useAppStore((st) => st.melo?.soundEnabled === true);
  const quietMode = useAppStore((st) => st.melo?.quietMode === true);
  const ritualPose = poseForContext('ritual', { quietMode });
  const greenStreak = useMemo(() => computeGreenStreak(cycles), [cycles]);
  const [resumeDecisions, setResumeDecisions] = useState<Record<string, 'resume' | 'keep'>>({});
  const resumePrompts = useMemo(
    () =>
      subs.filter(
        (subscription) =>
          subPaused[subscription.name] &&
          subscription.pausedUntil &&
          (subscription.autoResume ?? 'prompt') === 'prompt',
      ),
    [subPaused, subs],
  );

  // Step-4 input — seeded from the persisted draft so the user can leave and come back without losing
  // what they typed (ENGINES §7 "Cycle close note").
  const [note, setNote] = useState(persistedNote);

  // @rn-engine money-path
  // The cycle-close `spare` and tight point read the REAL route/ledger, not projections of their own:
  // the shared store→money-path bridge (`useRoute`) maps the live store onto the same pure engine
  // every other surface uses. `route.spare` is the balance on the resolved next payday; the tight
  // point is the lowest projected balance and the day it lands on. The hook can't be called
  // conditionally, so it always runs against `now ?? EPOCH`; before the mount-gate opens we discard
  // that transient result (`route = null`).
  const routeResult = useRoute(now ?? EPOCH);
  const route = now ? routeResult : null;

  // The two figures the route does not supply — direct trailing-30-day ledger reads, anchored to the
  // mount-gated `now` (EPOCH for the pre-gate frame, discarded the same way the route result is).
  const ledger = useMemo<LedgerActuals>(
    () => computeLedgerActuals({ transactions, potLedger } as AppState, now ?? EPOCH),
    [transactions, potLedger, now],
  );

  // The cycle-close actuals the steps + addCycle read. `spent`/`setAside` are the ledger reads; `spare`
  // and `tightPoint` are the route's read-outs (0 until the mount-gate opens — the pre-engine frame).
  const actuals = useMemo(
    () => ({
      spent: ledger.spent,
      setAside: ledger.setAside,
      spare: route ? Math.max(0, Math.round(route.spare)) : 0,
      tightPoint: route ? Math.max(0, Math.round(route.tightPoint.amount)) : 0,
    }),
    [ledger, route],
  );
  const forecastAccountability = useMemo(() => {
    if (now === null) return evaluatePaydayForecastAccountability(null, null);
    const safeRange = safeRangeSnapshotFromResult(
      buildTrustedSafeRangeFromAppState(appState, { now }),
    );
    return evaluatePaydayForecastAccountability(safeRange, Math.round(actuals.spare * 100));
  }, [actuals.spare, appState, now]);

  // The real tightest day, in the same prose form Today uses ("Tuesday 8"). Null until the route
  // resolves, which gates step 3's body onto an honest fallback for that single pre-engine frame.
  const tightestDayProse = route ? formatDayProse(route.tightPoint.date) : null;

  // Pot first-names for step 2's populated body — the first word of each pot that still tops up
  // (perWeek > 0), joined by ", " (web parity).
  const potFirstNames = useMemo(
    () =>
      pots
        .filter((p) => p.perWeek > 0)
        .map((p) => p.name.split(' ')[0])
        .join(', '),
    [pots],
  );

  const noted = note.trim().length > 0;

  // Step 3's mode-aware bodies name the real tightest day where the web named a fixed placeholder
  // date; the day-agnostic fallback covers the single pre-engine frame (route not yet resolved).
  const step1 = step1ByMode(moneyMode, actuals);
  const step2 = step2ByMode(moneyMode, actuals, potFirstNames);
  const step3 = step3ByMode(moneyMode, actuals, tightestDayProse);

  // Repay-a-borrowed-pot step (BREAKS-PARITY fix) — inserted only when the user actually owes a pot
  // (ENGINES §4 borrow/repay ledger), so the ritual stays its normal length for clean months. Owed
  // amounts are derived from real `potLedger` borrow/repay entries, exactly as the web computes them.
  const owedByPot = useMemo(() => {
    const map = new Map<string, { name: string; owed: number }>();
    for (const entry of potLedger) {
      const pot = pots.find((p) => p.id === entry.potId);
      if (!pot) continue;
      const current = map.get(entry.potId) ?? {
        name: pot.name.split(' · ')[0] ?? pot.name,
        owed: 0,
      };
      if (entry.kind === 'borrow') current.owed += entry.amount;
      else if (entry.kind === 'repay') current.owed -= entry.amount;
      map.set(entry.potId, current);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .filter((r) => r.owed > 0);
  }, [potLedger, pots]);
  const totalOwed = owedByPot.reduce((sum, r) => sum + r.owed, 0);
  const repayHeadroom = Math.max(0, Math.min(totalOwed, actuals.spare));

  const steps: RitualStep[] = [
    {
      eyebrow: step1.eyebrow,
      headlineLead: step1.headlineLead,
      headlineAccent: step1.headlineAccent,
      headlineTrail: step1.headlineTrail,
      body: step1.body,
      stat: { label: step1.statLabel, value: step1.statValue, tone: step1.statTone },
      melo: step1.melo,
      meloMood: step1.meloMood,
      cta: step1.cta,
    },
    {
      eyebrow: step2.eyebrow,
      headlineLead: step2.headlineLead,
      headlineAccent: step2.headlineAccent,
      headlineTrail: step2.headlineTrail,
      body: step2.body,
      stat: { label: step2.statLabel, value: step2.statValue, tone: step2.statTone },
      melo: step2.melo,
      meloMood: step2.meloMood,
      cta: step2.cta,
    },
    // Repay step — only when the user actually owes a pot.
    ...(totalOwed > 0
      ? [
          {
            eyebrow: 'Step three · repay',
            headlineLead: 'Repay a ',
            headlineAccent: 'borrowed',
            headlineTrail: ' pot.',
            body:
              owedByPot.map((r) => `${r.name}: ${poundsGrouped(r.owed)} owed`).join('. ') +
              (repayHeadroom > 0
                ? `. You've got ${poundsGrouped(actuals.spare)} left over. Repay ${poundsGrouped(repayHeadroom)} now — the rest can wait.`
                : '. Nothing left over this cycle. It can wait another month, calmly.'),
            stat: { label: 'To repay', value: totalOwed, tone: 'accent' as ModeStepTone },
            melo:
              repayHeadroom > 0
                ? `Puts ${poundsGrouped(repayHeadroom)} back where it belongs.`
                : 'No pressure. Pots understand.',
            meloMood: 'calm' as MeloMood,
            cta: repayHeadroom > 0 ? `Repay ${poundsGrouped(repayHeadroom)}` : 'Skip for now',
            onConfirm: () => {
              if (repayHeadroom <= 0) return;
              let remaining = repayHeadroom;
              for (const r of owedByPot) {
                if (remaining <= 0) break;
                const share = Math.min(r.owed, remaining);
                repayToPot(r.id, share, 'ritual-repay');
                remaining -= share;
              }
            },
          },
        ]
      : []),
    {
      eyebrow: step3.eyebrow,
      headlineLead: step3.headlineLead,
      headlineAccent: step3.headlineAccent,
      headlineTrail: step3.headlineTrail,
      body: step3.body,
      stat: { label: step3.statLabel, value: step3.statValue, tone: step3.statTone },
      melo: step3.melo,
      meloMood: step3.meloMood,
      cta: step3.cta,
    },
    ...(resumePrompts.length > 0
      ? [
          {
            eyebrow: 'Step · paused subscriptions',
            headlineLead: 'Anything to ',
            headlineAccent: 'bring back',
            headlineTrail: '?',
            resumePrompt: true,
            stat: {
              label: 'To decide',
              value: resumePrompts.length,
              tone: 'accent' as StatTone,
            },
            melo: 'Only what you want back. Nothing sneaks through.',
            meloMood: 'curious' as MeloMood,
            cta: 'Apply choices',
            onConfirm: () => {
              for (const subscription of resumePrompts) {
                if (resumeDecisions[subscription.name] === 'resume') {
                  togglePaused(subscription.name, false);
                }
              }
            },
          },
        ]
      : []),
    {
      eyebrow: 'Step four',
      headlineLead: 'One ',
      headlineAccent: 'line',
      headlineTrail: ' for next-you.',
      isNote: true,
      stat: { label: 'Note', value: noted ? 1 : 0, tone: noted ? 'positive' : 'ink' },
      melo: noted ? 'Done. The month is wrapped up.' : 'Even a short line helps. Or skip it.',
      meloMood: noted ? 'celebrate' : 'calm',
      cta: 'Finish the review',
    },
  ];

  const current = steps[step] ?? steps[0]!;
  const isLast = step === steps.length - 1;

  // The ceremonial seal — a 600ms scale-overshoot fired once on finish, never looping.
  const sealScale = useSharedValue(0);
  const sealStyle = useAnimatedStyle(() => ({
    opacity: sealScale.value > 0 ? 1 : 0,
    transform: [{ scale: sealScale.value }, { rotate: '-8deg' }],
  }));

  // Finish choreography timers — cleared on unmount so neither fires after the screen is gone.
  const shareRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meloRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (shareRef.current) clearTimeout(shareRef.current);
      if (meloRef.current) clearTimeout(meloRef.current);
    },
    [],
  );

  function onAdvance() {
    if (!isLast) {
      // The repay step's real store write (BREAKS-PARITY fix) — fires once, on confirming past it.
      current.onConfirm?.();
      setStep((x) => x + 1);
      void triggerFeedback('ritual-step');
      return;
    }
    if (sealed) return;
    setSealed(true);

    // Record the closed cycle so Insights + Share have real data. addCycle clears nextYouNote and
    // keeps the latest 24 cycles internally. The close timestamp reads the clock at finish-time (an
    // event handler, not render), so it's the live close moment — distinct from the mount-gated `now`.
    const closedNow = new Date();
    addCycle({
      closedAt: currentFinancialDate(closedNow),
      label: closedNow.toLocaleString('en-GB', { month: 'long' }),
      spare: actuals.spare,
      tightPoint: actuals.tightPoint,
      setAside: actuals.setAside,
      note: note.trim() || NO_NOTE,
    });
    completePaydayRitualMelo(closedNow);
    void triggerFeedback('ritual-complete', {
      soundEnabled,
      quietMode,
    });

    // A lens trial is exactly one cycle and relocks only at this explicit cycle close.
    endLensTrial();

    // The seal stamps in (gated to final state under reduce-motion).
    if (!reduceMotion) {
      sealScale.value = withSequence(
        withTiming(1.12, { duration: STAMP_MS * 0.6, easing: STAMP_EASE }),
        withTiming(1, { duration: STAMP_MS * 0.4, easing: STAMP_EASE }),
      );
    } else {
      sealScale.value = 1;
    }

    // Today → Share sheet → Melo chat, on the web's cadence. Timers are cleared on unmount.
    nav.go('today');
    shareRef.current = setTimeout(() => nav.openSheet('share'), SHARE_DELAY_MS);
    meloRef.current = setTimeout(() => nav.openMelo({ seed: MELO_SEED }), MELO_DELAY_MS);
  }

  function onNoteChange(next: string) {
    setNote(next);
    // Persist on every keystroke so the draft survives leave/return (web parity).
    setNextYouNote(next);
  }

  // A skipped/unconfigured first run is not a £0 cycle. Guard the route itself (not only its callers)
  // so More, Melo, Insights, or a stale navigation trail can never turn absent data into praise for a
  // month the user did not record.
  const needsSetup = !onboardingDone;

  // empty (screen-level) — "Nothing to close yet". The setup variant opens the real onboarding
  // sheet; an already-configured user simply returns to Today until their payday review is due.
  if (state === 'empty' || needsSetup) {
    return (
      <EmptyState
        mood="calm"
        headline={needsSetup ? 'Add your first money picture' : 'Nothing to close yet'}
        body={
          needsSetup
            ? 'Set your balance and payday first. The review will use what really happened after that.'
            : "Your cycle wraps up at payday. Come back then and we'll close it together."
        }
        cta={
          needsSetup
            ? { label: 'Add my numbers', onPress: () => nav.openSheet('onboarding') }
            : { label: 'Back to today', onPress: () => nav.go('today') }
        }
      />
    );
  }

  // loading — Melo curious + a line, NEVER a spinner (hard rule + STATES.md). addCycle is local +
  // synchronous, so this is only a holding moment while the surface settles, not a finish state. The
  // pre-engine frame (`now === null`, before the mount-gate opens) shows the same branch (mirrors
  // TodayScreen's `isLoading = state === 'loading' || now === null`), so the ceremony never renders
  // with zero figures for one frame.
  if (state === 'loading' || now === null) {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}
      >
        <MeloLine mood="curious" text="One quiet minute. Getting your month ready." />
      </View>
    );
  }

  // populated / offline / error — the real four-step ceremony. offline ≡ populated (local-first); a
  // direct error mount still shows the ritual so the user can close the cycle in hand.
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.screen,
          {
            backgroundColor: t.canvas,
            paddingTop: insets.top + gap.lg,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {/* The ceremony scrolls — on a short viewport the stat card + CTAs sit below the fold, and the
            step-4 textarea needs to scroll clear of the keyboard. flexGrow:1 keeps the spacer pinning
            the CTAs when there's room; keyboardShouldPersistTaps keeps the CTAs tappable mid-edit. */}
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header — back glyph · "{n} of {total}" · animated progress dots · balancing spacer. */}
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={12}
              onPress={nav.back}
              style={({ pressed: isPressed }) => [styles.backTap, isPressed ? pressed : undefined]}
            >
              <BackArrow color={t.muted} />
            </Pressable>

            <View style={styles.progress}>
              <Text
                accessibilityLabel={`Step ${step + 1} of ${steps.length}`}
                style={[styles.progressLabel, { color: t.muted }]}
              >
                {step + 1} of {steps.length}
              </Text>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.dots}
              >
                {steps.map((_, i) => (
                  <ProgressDot
                    key={i}
                    active={i === step}
                    done={i < step}
                    palette={t}
                    reduceMotion={reduceMotion}
                  />
                ))}
              </View>
            </View>

            {/* Balances the back button so the progress block stays centred (web w-5 spacer). */}
            <View style={styles.headerSpacer} />
          </View>

          {/* Copy block — eyebrow · headline (with the single upright accent word) · body or textarea. */}
          <View style={styles.copyBlock}>
            <Text style={[styles.eyebrow, { color: t.muted }]}>
              {step === 0 && greenStreak >= 2
                ? `${greenStreak === 2 ? 'Second' : greenStreak === 3 ? 'Third' : `${greenStreak}th`} ritual in a row. Nice pace.`
                : current.eyebrow}
            </Text>
            <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
              {current.headlineLead}
              <Text style={[styles.headlineAccent, { color: t.calm }]}>
                {current.headlineAccent}
              </Text>
              {current.headlineTrail}
            </Text>

            {/* Mode framing banner (BREAKS-PARITY fix) — web renders this only on step 0, telling the
                user why this closing ritual reads differently in their current Money Mode. Returns
                null for survival (the shipped default). */}
            {step === 0 ? <ModeFramingBanner surface="cycleClose" /> : null}

            {step === 0 && greenStreak >= 1 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${greenStreak} safe cycles in a row. Open Insights.`}
                onPress={() => nav.go('insights')}
                style={[
                  styles.streakChip,
                  { backgroundColor: t.calmSoft, borderColor: t.hairline },
                ]}
              >
                <View style={[styles.streakDot, { backgroundColor: t.positive }]} />
                <Text style={[styles.streakChipText, { color: t.ink }]}>
                  {greenStreak === 1 ? (
                    <>
                      Last month closed <Text style={{ color: t.calmStrong }}>safe</Text>.
                    </>
                  ) : (
                    <>
                      <Text style={{ color: t.calmStrong }}>{greenStreak}</Text> safe cycles in a
                      row.
                    </>
                  )}
                </Text>
              </Pressable>
            ) : null}

            {current.resumePrompt ? (
              <View style={styles.resumeList}>
                {resumePrompts.map((subscription) => {
                  const decision = resumeDecisions[subscription.name];
                  const resumeLabel = subscription.pausedUntil
                    ? new Date(
                        `${subscription.pausedUntil.slice(0, 10)}T00:00:00`,
                      ).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    : 'next cycle';
                  return (
                    <View
                      key={subscription.name}
                      style={[
                        styles.resumeCard,
                        { backgroundColor: t.inset, borderColor: t.hairline },
                      ]}
                    >
                      <View style={styles.resumeHeader}>
                        <Text style={[styles.resumeName, { color: t.ink }]}>
                          {subscription.name}
                        </Text>
                        <Text style={[styles.resumeMeta, { color: t.muted }]}>
                          £{subscription.cost}/mo · resumes {resumeLabel}
                        </Text>
                      </View>
                      {subscription.pauseReason ? (
                        <Text style={[styles.resumeReason, { color: t.muted }]}>
                          paused because {subscription.pauseReason}
                        </Text>
                      ) : null}
                      <View style={styles.resumeActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: decision === 'resume' }}
                          onPress={() =>
                            setResumeDecisions((currentDecisions) => ({
                              ...currentDecisions,
                              [subscription.name]: 'resume',
                            }))
                          }
                          style={[
                            styles.resumeAction,
                            {
                              backgroundColor: decision === 'resume' ? t.calm : t.surface,
                              borderColor: t.hairline,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.resumeActionText,
                              { color: decision === 'resume' ? t.inverse : t.ink },
                            ]}
                          >
                            Resume now
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: decision === 'keep' }}
                          onPress={() =>
                            setResumeDecisions((currentDecisions) => ({
                              ...currentDecisions,
                              [subscription.name]: 'keep',
                            }))
                          }
                          style={[
                            styles.resumeAction,
                            {
                              backgroundColor: decision === 'keep' ? t.ink : t.surface,
                              borderColor: t.hairline,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.resumeActionText,
                              { color: decision === 'keep' ? t.canvas : t.ink },
                            ]}
                          >
                            Keep paused
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
                <Text style={[styles.resumeFootnote, { color: t.muted }]}>
                  No pick means it stays paused until its own resume date.
                </Text>
              </View>
            ) : current.isNote ? (
              <View style={styles.noteBlock}>
                <TextInput
                  accessibilityLabel="One line for next-you"
                  autoFocus
                  value={note}
                  onChangeText={onNoteChange}
                  placeholder="One honest line — what to hold, what to watch."
                  placeholderTextColor={t.muted}
                  maxLength={NOTE_MAX}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={[
                    styles.noteInput,
                    { backgroundColor: t.inset, borderColor: t.hairline, color: t.ink },
                  ]}
                />
                <Text
                  style={[styles.noteCount, { color: t.muted }]}
                >{`${note.length}/${NOTE_MAX}`}</Text>
              </View>
            ) : (
              <Text style={[styles.body, { color: t.muted }]}>{current.body}</Text>
            )}
          </View>

          {/* Stat card — surface, hairline, soft card lift; the label + the count-up money figure. */}
          <View style={[styles.statCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
            {/* The ceremonial seal — only after finish. */}
            {sealed ? (
              <Animated.View
                style={[styles.seal, sealStyle, { borderColor: t.calm }]}
                pointerEvents="none"
              >
                <Text style={[styles.sealLabel, { color: t.calmStrong }]}>Sealed</Text>
              </Animated.View>
            ) : null}

            <Text style={[styles.statLabel, { color: t.muted }]}>{current.stat.label}</Text>
            <StatMoney
              label={current.stat.label}
              value={current.stat.value}
              tone={current.stat.tone}
              isNote={current.isNote === true}
              noted={noted}
              palette={t}
              reduceMotion={reduceMotion}
            />
          </View>

          {/* Melo line — the quiet companion; mood changes step-to-step. MeloLine adds the quotes. */}
          <ForecastAccountabilitySummary accountability={forecastAccountability} />

          <View style={styles.meloBlock}>
            <MeloLine text={current.melo} mood={ritualPose.mood} asleep={ritualPose.asleep} />
          </View>

          {/* Spacer pins the CTAs to the bottom (web flex-1). */}
          <View style={styles.spacer} />

          {/* Primary CTA — advance, or finish on the last step. Coral lift via the cta elevation. */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: sealed }}
            accessibilityLabel={current.cta}
            disabled={sealed}
            onPress={onAdvance}
            style={({ pressed: isPressed }) => [
              styles.primary,
              { backgroundColor: t.calm },
              sealed ? styles.primaryStamped : undefined,
              isPressed && !sealed ? pressed : undefined,
            ]}
          >
            <Text style={[styles.primaryLabel, { color: t.accentInk }]}>{current.cta}</Text>
          </Pressable>

          {/* Secondary — "Save and finish later" exits WITHOUT recording a cycle. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save and finish later"
            onPress={nav.back}
            style={({ pressed: isPressed }) => [styles.secondary, isPressed ? pressed : undefined]}
          >
            <Text style={[styles.secondaryLabel, { color: t.muted }]}>Save and finish later</Text>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// StatMoney — the count-up money figure (money never slides)
// ---------------------------------------------------------------------------

// On the note step the stat is a glyph (✓ / —), not money, so it does not count up. On the other three
// steps it ticks to the target pound figure. Tone maps to the palette: positive (green) / ink / accent
// (terracotta).
function StatMoney({
  label,
  value,
  tone,
  isNote,
  noted,
  palette,
  reduceMotion,
}: {
  label: string;
  value: number;
  tone: StatTone;
  isNote: boolean;
  noted: boolean;
  palette: Palette;
  reduceMotion: boolean;
}) {
  const counted = useCountUp(value, COUNT_MS, reduceMotion);
  const color =
    tone === 'positive' ? palette.positive : tone === 'accent' ? palette.calm : palette.ink;

  if (isNote) {
    const glyph = noted ? '✓' : '—';
    return (
      <Text
        accessibilityLabel={`${label}: ${noted ? 'noted' : 'none'}`}
        style={[styles.statValue, { color }]}
      >
        {glyph}
      </Text>
    );
  }

  return (
    <Text
      accessibilityLabel={`${label}: ${poundsGrouped(value)}`}
      style={[styles.statValue, { color }]}
    >
      {poundsGrouped(counted)}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// ProgressDot — width + colour tween over 500ms (web transition-all duration-500)
// ---------------------------------------------------------------------------

function ProgressDot({
  active,
  done,
  palette,
  reduceMotion,
}: {
  active: boolean;
  done: boolean;
  palette: Palette;
  reduceMotion: boolean;
}) {
  // active: 28px accent · done: 20px ink (web ink/70) · future: 20px hairline.
  const targetWidth = active ? DOT_W_ACTIVE : DOT_W_REST;
  const targetColor = active ? palette.calm : done ? palette.ink : palette.hairline;

  const width = useSharedValue(targetWidth);
  useEffect(() => {
    if (reduceMotion) {
      width.value = targetWidth;
      return;
    }
    width.value = withTiming(targetWidth, { duration: DOT_MS, easing: EASE_OUT_EXPO });
  }, [width, targetWidth, reduceMotion]);

  const dotStyle = useAnimatedStyle(() => ({ width: width.value }));

  // Colour cross-fades by opacity on a coloured base — done dots read at the web's ~70% ink weight.
  return (
    <Animated.View
      style={[
        styles.dot,
        dotStyle,
        { backgroundColor: targetColor, opacity: done && !active ? 0.7 : 1 },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Back arrow — the web '←' glyph, drawn inline (matches Review/PdfSuccess). 20×20 user space.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Styles — layout-only static; colour comes from the palette at render time, the press feel and the
// CTA lift come from the kit `pressed` / `elevation` tokens (no hard-coded shadow / opacity)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  // Scroll container fills the screen; content grows to a full viewport so the flex:1 spacer keeps
  // pinning the CTAs when there's room, then scrolls when there isn't.
  scrollFlex: {
    flex: 1,
  },
  scrollBody: {
    flexGrow: 1,
  },
  // px-7 ≈ screen inset (gap.xl = 24). A flex:1 spacer pins the CTAs to the bottom.
  screen: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // Header row — back · progress · balancing spacer.
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backTap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 24,
  },
  // The progress block — "{n} of {total}" + the dots, gap-3.
  progress: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
  },
  // 10.5px uppercase, tracked, tabular, muted.
  progressLabel: {
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  // The dot row — gap-1.5.
  dots: {
    alignItems: 'center',
    columnGap: gap.xs + gap.xxs,
    flexDirection: 'row',
  },
  // h-1 rounded dots; width is animated per-dot.
  dot: {
    borderRadius: radius.pill,
    height: 4,
  },
  // Balances the 24px-min back tap so the progress block stays optically centred (web w-5).
  headerSpacer: {
    width: 20,
  },
  // mt-7 (28px) = gap.xl (24) + gap.xs (4).
  copyBlock: {
    marginTop: gap.xl + gap.xs,
  },
  // Fraunces italic eyebrow, 13px muted.
  eyebrow: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  // Fraunces headline, 32px, tight line-height, mt-1.
  headline: {
    fontFamily: serif.display,
    fontSize: 32,
    lineHeight: 34,
    marginTop: gap.xs,
  },
  // The accent word stays UPRIGHT (web em.not-italic) — same display face, normal style.
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // 14px muted, relaxed, mt-4, max-width ~320.
  body: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: gap.lg,
    maxWidth: 320,
  },
  streakChip: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: gap.sm,
    marginTop: gap.md,
    minHeight: 30,
    paddingHorizontal: gap.md,
  },
  streakDot: { borderRadius: 3, height: 6, width: 6 },
  streakChipText: { fontSize: 11.5, fontVariant: ['tabular-nums'] },
  resumeList: { gap: gap.sm, marginTop: gap.md },
  resumeCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: gap.md,
  },
  resumeHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: gap.sm,
    justifyContent: 'space-between',
  },
  resumeName: { flex: 1, fontSize: 13.5 },
  resumeMeta: { fontSize: 11.5, fontVariant: ['tabular-nums'] },
  resumeReason: {
    fontFamily: serif.displayItalic,
    fontSize: 11,
    marginTop: gap.xs,
  },
  resumeActions: { flexDirection: 'row', gap: gap.sm, marginTop: gap.sm },
  resumeAction: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    height: 38,
    justifyContent: 'center',
  },
  resumeActionText: { fontSize: 12, fontWeight: '500' },
  resumeFootnote: { fontSize: 12, lineHeight: 17 },
  // The step-4 note block — mt-3.
  noteBlock: {
    marginTop: gap.md,
  },
  // The textarea — inset well, hairline, rounded-xl, px-3 py-2.5, 14px. 3 lines tall.
  noteInput: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
    lineHeight: 21,
    minHeight: 84,
    paddingHorizontal: gap.md,
    paddingVertical: 10,
  },
  // 10.5px muted tabular counter, mt-1.
  noteCount: {
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
    marginTop: gap.xs,
    textAlign: 'right',
  },
  // Stat card — surface, hairline, 2xl radius, p-6, mt-6; relative for the absolute seal.
  statCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    padding: gap.xl,
    position: 'relative',
  },
  // 11px uppercase tracked muted.
  statLabel: {
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  // Money 'xl' = 44px, Fraunces, tabular; mt-1.
  statValue: {
    fontFamily: serif.display,
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginTop: gap.xs,
  },
  // The "Sealed" seal — top-right pill, 2px terracotta ring, uppercase tracked label.
  seal: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    justifyContent: 'center',
    paddingHorizontal: gap.md,
    paddingVertical: 4,
    position: 'absolute',
    right: gap.lg,
    top: gap.lg,
  },
  sealLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  // mt-6 around the Melo line.
  meloBlock: {
    marginTop: gap.xl,
  },
  spacer: {
    flex: 1,
  },
  // Primary CTA — full width, h-[58px], 2xl radius, terracotta fill, the kit's one lifted-action
  // elevation (the soft terracotta cta lift — iOS shadow + Android elevation, token-owned).
  primary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 58,
    justifyContent: 'center',
    ...elevation.cta,
  },
  primaryStamped: {
    opacity: 0.7,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  // Secondary — mt-2 mb-5, h-[42px], 13px muted.
  secondary: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    marginBottom: gap.lg + gap.xs,
    marginTop: gap.sm,
  },
  secondaryLabel: {
    fontSize: 13,
  },
});
