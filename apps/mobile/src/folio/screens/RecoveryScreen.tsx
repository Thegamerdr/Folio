// @rn-engine money-path — the overspent verdict + each move's real £ lift + the re-drawn route now
//   come from the REAL pure route engine via the shared store→money-path bridge
//   (@/folio/lib/storeRoute → routeFromStore → computeRoute, ENGINES §6). This screen is the CONSUMER
//   of an overspent verdict:
//     • VERDICT: the base route's tight point IS the verdict — its depth below zero
//       (max(0, −tightPoint.amount)) is the live shortfall. No sample number.
//     • PER-MOVE LIFT: each corrective move is applied to a HYPOTHETICAL copy of the store state
//       (never the live store) and re-routed; the move's real £ lift is the route DELTA at the tight
//       point (candidate.tightPoint − base.tightPoint, clamped ≥ 0). Pause-a-sub drops a renewal
//       outflow; Move-a-bill slides a renewal later (subOverride); Set-a-hold frees the user's real
//       average daily discretionary across the hold's days (room the engine adds back). A move with
//       no honest lift in the live data simply shows +£0 — nothing is fabricated.
//     • RE-DRAWN ROUTE: the after-move figure is the base shortfall lifted by the picked move's real
//       delta, so the card shows the re-drawn tight point, not a guess.
//   Preview-then-commit is unchanged: selecting a move mutates NOTHING (it only re-routes a copy);
//   "Rebuild the plan" writes the bundle — the picked move's real store mutation — exactly once.
//
// RecoveryScreen — the faithful 1:1 React Native port of the web Recovery surface
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenRecovery.tsx).
//
// @rn-screen    RecoveryScreen
// @rn-stack     More > Recovery
// @purpose      "Something has to move." Guided, non-blaming triage when the projection is
//               overspent. Renders the current shortfall, lets the user pick exactly ONE corrective
//               move (move a bill / pause a sub / hold spending), live-previews the after-move
//               balance, offers a Melo talk-through escape hatch, then "Rebuild the plan" commits
//               the chosen move and routes to today-after. "Not now" backs out.
// @reads        subs, subPaused, tightPointGoal (via useAppStore — the doc-block @reads, now honoured)
// @writes       togglePaused (Pause a sub) · nudgeSub (Move a bill) · setTightPointGoal (Set a hold)
//               — fired ONCE, only on the "Rebuild the plan" commit (preview-then-commit, no silent
//               path mutation while the user is just selecting).
// @opens-sheet  melo-chat (via nav.openMelo with a prefill)
// @copy         FROZEN — empathetic, never blaming. Every visible string is inline-frozen VERBATIM
//               from the web source. COPY_DECK's `short.*` block is conceptually related but is NOT a
//               verbatim match for any Recovery string (e.g. deck `short.refuse` = "Leave it for now"
//               vs the web's "Not now"; deck `short.head` = "Short by {amount}." vs the card label
//               "Shortfall"), so keying them would CHANGE the copy. Faithful-1:1 wins: the strings
//               stay exactly as the source shipped them, none concatenated.
// @tokens       surface · hairline · inset · calm (accent) · calmStrong · calmSoft (accent-soft) ·
//               muted · secondary · ink · positiveInk · repairInk · inverse — all from the kit via
//               '@/folio/theme'. No new token.
// @motion       press 0.97 (every tappable) · fade-in (expanded move-card body, 220ms) · count-up on
//               the after/shortfall figure (MOTION.md: money values count up, never slide). Reduced
//               motion = final state. The page root stays static for reliable native repainting.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/source):
//   • SINGLE-SELECT: tapping the active card deselects (picked → null), which disables the CTA —
//     the exact web toggle. The move group exposes accessibilityRole="radio" + selected state.
//   • MOOD (canonical, per MELO_MOODS): the web passed kit-internal aliases ('soft'/'alert'); the
//     canonical Recovery mood is 'concern'. Preserved softening logic: after >= 0 (the move closes
//     the gap) → 'calm'; still short → 'concern' (careful, never alarmed — no red/shake). The aside
//     Melo stays 'calm'.
//   • PREVIEW-THEN-COMMIT: selecting a move mutates NOTHING; it only previews the after figure. The
//     real store write happens once, on "Rebuild the plan", for the picked move only.
//   • COUNT-UP: the after/shortfall figure settles between values via the kit useCountUp (snaps under
//     reduce-motion), so the number never hard-swaps on selection.
//   • '−' is U+2212 MINUS SIGN (not a hyphen) and '→' is U+2192 — kept exact for tabular alignment.
//   • The nested fade-in collapses to its final state under reduce-motion. The page root stays static
//     because Android can retain full-screen transformed layers after navigation.
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Banned visible words (import / rows /
// parser / extraction / OCR / sync / dashboard / analytics / users / 100% / bank-grade / AI-powered /
// smart / provenance / source record / indexed) are absent from every visible string.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { gap, radius, serif, useCountUp, useTheme, type Palette } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import {
  nudgeSub,
  setTightPointGoal,
  togglePaused,
  useAppStore,
  type AppState,
  type Sub,
} from '@/folio/store';
import { routeFromStore } from '@/folio/lib/storeRoute';
import { selectMonthlyIncome } from '@/folio/lib/income';
import { EmptyState } from '@/folio/ui/EmptyState';
import type { Nav } from '@/folio/types';
import type { MoneyMode } from '@/folio/lib/modes/types';

// ---------------------------------------------------------------------------
// Mode-tinted copy (BREAKS-PARITY fix) — web `getRecoveryCopy(mode)`
// (folio-melo lib/modes/action.ts, table `R`), ported verbatim. Every mode
// gets its own eyebrow, intro, headline lead/accent, shortfall/after labels,
// Melo default line and CTA — same layout, different voice per Money Mode.
// ---------------------------------------------------------------------------

type RecoveryCopy = {
  eyebrow: string;
  intro: string;
  headlineLead: string;
  headlineAccent: string;
  shortfallLabel: string;
  afterLabel: string;
  meloDefault: string;
  cta: string;
};

const RECOVERY_COPY: Record<MoneyMode, RecoveryCopy> = {
  survival: {
    eyebrow: 'Recovery',
    intro: "It happens. Let's repair calmly.",
    headlineLead: 'Something has to',
    headlineAccent: 'move.',
    shortfallLabel: 'Shortfall',
    afterLabel: 'After this move',
    meloDefault: 'No shame here. One small move can rebuild the week.',
    cta: 'Rebuild the plan',
  },
  stability: {
    eyebrow: 'Rebalance',
    intro: "The rhythm wobbled. Let's re-set it.",
    headlineLead: 'Rhythm needs a',
    headlineAccent: 'nudge.',
    shortfallLabel: 'Off-rhythm',
    afterLabel: 'After the nudge',
    meloDefault: 'A small nudge is enough. The shape returns on its own.',
    cta: 'Rebalance',
  },
  growth: {
    eyebrow: 'Reset the pace',
    intro: "The pace pinched. That's fine.",
    headlineLead: 'The pace needs a',
    headlineAccent: 'breath.',
    shortfallLabel: 'Behind pace',
    afterLabel: 'After the breath',
    meloDefault: "One skipped feed doesn't unmake the pace.",
    cta: 'Reset the pace',
  },
  debt: {
    eyebrow: 'Protect the chip',
    intro: 'The chip stands. This just clears space.',
    headlineLead: 'One thing has to',
    headlineAccent: 'give.',
    shortfallLabel: 'Blocking chip',
    afterLabel: 'After the give',
    meloDefault: "The chip goes through. That's what matters this cycle.",
    cta: 'Protect the chip',
  },
  irregular: {
    eyebrow: 'Extend runway',
    intro: "Runway dipped. Let's stretch it back.",
    headlineLead: 'The runway needs a',
    headlineAccent: 'stretch.',
    shortfallLabel: 'Runway gap',
    afterLabel: 'After the stretch',
    meloDefault: 'One held cost buys real days.',
    cta: 'Stretch it back',
  },
  household: {
    eyebrow: 'Your side',
    intro: 'Only your half. The other stays neutral.',
    headlineLead: 'Your side needs a',
    headlineAccent: 'move.',
    shortfallLabel: 'Your gap',
    afterLabel: 'After your move',
    meloDefault: 'This is yours to handle. One small move is enough.',
    cta: 'Move your side',
  },
  planning: {
    eyebrow: 'Protect the date',
    intro: "The date drifted. Let's pull it back.",
    headlineLead: 'One thing has to',
    headlineAccent: 'shift.',
    shortfallLabel: 'Off-date',
    afterLabel: 'After the shift',
    meloDefault: 'A held goal is worth a small trade.',
    cta: 'Pull the date back',
  },
  optimizer: {
    eyebrow: 'Close a leak',
    intro: 'Something crept back in. Close it.',
    headlineLead: 'Close one',
    headlineAccent: 'leak.',
    shortfallLabel: 'Leaking',
    afterLabel: 'After the cut',
    meloDefault: 'One clean cut usually does it.',
    cta: 'Close it',
  },
  reset: {
    eyebrow: 'One thing',
    intro: "Just one thing. That's enough today.",
    headlineLead: 'Move one',
    headlineAccent: 'thing.',
    shortfallLabel: 'Short',
    afterLabel: 'After the one',
    meloDefault: 'One move. That’s the whole task.',
    cta: 'Do the one thing',
  },
  lowVis: {
    eyebrow: 'Rough recovery',
    intro: 'Rough picture. Try one gentle move.',
    headlineLead: 'Maybe move',
    headlineAccent: 'one.',
    shortfallLabel: 'Maybe short',
    afterLabel: 'Rough after',
    meloDefault: 'This is a guess. A statement would sharpen it.',
    cta: 'Try one gentle move',
  },
};

function getRecoveryCopy(mode: MoneyMode): RecoveryCopy {
  return RECOVERY_COPY[mode] ?? RECOVERY_COPY.survival;
}

// One corrective move the user can pick. `deltaValue` is the £ lift this move gives the route's tight
// point — the REAL money-path delta (candidate route − base route at the tight point, see the
// @rn-engine note at the top), computed against a hypothetical copy of the store, never the live one.
// `commit` applies the move's real, available store mutation once, on Rebuild. `subName` (when
// present) ties a "Pause a sub" move to a live sub so the commit pauses the right one.
type Move = {
  id: string;
  /** The card's small uppercase kind label (e.g. "Pause a sub"). */
  kind: string;
  /** The headline of the move (e.g. "Pause <the user's real sub> for a month"). */
  title: string;
  /** The signed-figure delta line (e.g. "+£12 this month"). */
  delta: string;
  /** The real £ this move lifts the tight point by (preview only until commit). */
  deltaValue: number;
  /** The expanded explanation shown when the card is active. */
  body: string;
  /** A small caption under the body (cost / evidence). */
  cost?: string;
  /** The frozen Melo aside shown when this move is picked. */
  melo: string;
  /** Pause a sub binds to a real sub name so the commit pauses the right one. */
  subName?: string;
  /** The real, available store write this move commits on Rebuild. */
  commit: () => void;
};

// The render states this screen can occupy (STATES.md: Recovery is ✅ populated; offline ≡ populated;
// loading shows Melo, never a spinner; empty/error fall back rather than dead-ending on a blank).
export type RecoveryState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type RecoveryScreenProps = {
  nav: Nav;
  state?: RecoveryState;
};

// A stable sentinel "now" for the one render before the mount-gate opens. `routeFromStore` needs an
// honest "today"; until `now` is set we route against this and discard the figure that frame.
// Module-level so its identity never churns. (Same pattern as TodayScreen's EPOCH.)
const EPOCH = new Date(0);

// When the real route shows no overspend (tight point ≥ 0) the shortfall is £0 — shown as-is.
// The web source faked £94 here ("so the screen renders coherently"), but this screen is reachable
// from the More hub at any time, not only from an overspent verdict, and a fabricated shortfall
// broke the no-demo-data rule on the owner's own device (2026-07-11). Honest £0 replaces it.
const FALLBACK_SHORTFALL = 0;

// The "Move a bill" slides the user's REAL flexible bill later in the cycle — +5 days, the same
// nudge the commit applies, so the previewed lift and the committed move are the SAME route change.
const BILL_NUDGE_DAYS = 5;

// The "Set a hold" length in days — a 3-day soft pause on discretionary spend (matches the card copy).
const HOLD_DAYS = 3;

// How far back logged spend is averaged to estimate the daily discretionary a hold protects. A
// month of real activity → a stable per-day figure; if there's no logged spend, the hold lift is £0.
const HOLD_LOOKBACK_DAYS = 30;

// A calm tight-point floor the "Set a hold" move commits when the user has none set — a soft pause
// on discretionary spend reads as "protect this much at the low point". @rn-engine money-path.
const HOLD_FLOOR = 60;

const DAY_MS = 86_400_000;

// Discretionary spend categories — the spend a 3-day hold can actually pause (bills/recurring still
// pay, per the card body). Income is excluded; "bills" stays out because a hold doesn't stop them.
const DISCRETIONARY: ReadonlySet<string> = new Set([
  'food',
  'fun',
  'shopping',
  'transport',
  'other',
]);

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1) — for the nested reveal.
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// fade-in for the expanded move body (web .fade-in ~220ms).
const FADE_MS = 220;

// The after/shortfall count-up duration — a calm settle on each selection change.
const COUNT_MS = 420;

// The prefill the talk-through link seeds Melo with — frozen, verbatim from the web source.
const MELO_PREFILL = "I'm short to payday. Help me think this through.";

// Local reduce-motion read, mirroring Melo.tsx / ReviewScreen.tsx exactly: read once, then subscribe.
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

// Pick a live sub to offer as the "Pause a sub" move, by PAYMENT TIMING — the active (not-paused) sub
// whose renewal lands soonest, so pausing it drops the nearest upcoming charge before the low point.
// This is a money-timing choice, NOT a usage / "quiet" / "unused" verdict: banking or seed data proves
// a charge recurs, it cannot prove a product was used (SUBSCRIPTION_SIGNAL_RESEARCH §5). Returns
// undefined when nothing is live — the caller DROPS the card (no fabricated fallback).
// @rn-engine money-path will rank later.
function pausableSub(subs: Sub[], subPaused: Record<string, boolean>): Sub | undefined {
  const candidates = subs.filter((s) => !subPaused[s.name]);
  if (candidates.length === 0) return undefined;
  return [...candidates].sort((a, b) => a.nextRenewalDaysAway - b.nextRenewalDaysAway)[0];
}

// The first flexible bill the "Move a bill" move can slide: prefer the sub whose renewal lands at or
// before the tight point's day (so sliding it later actually lifts the tight point), else the nearest
// upcoming renewal. Falls back to the costliest sub. @rn-engine money-path: bill flexibility lives in
// a fuller engine; here we slide the most-relevant real renewal.
function flexibleBill(subs: Sub[], subPaused: Record<string, boolean>): Sub | undefined {
  const active = subs.filter((s) => !subPaused[s.name]);
  if (active.length === 0) return undefined;
  return [...active].sort((a, b) => a.nextRenewalDaysAway - b.nextRenewalDaysAway)[0];
}

// The real average daily discretionary spend, from logged transactions over the last
// HOLD_LOOKBACK_DAYS. Outflows only (amount < 0), discretionary categories only, spread across the
// lookback window. £0 when there's no honest logged spend — the hold then shows no fabricated lift.
function avgDailyDiscretionary(state: AppState, nowMs: number): number {
  const since = nowMs - HOLD_LOOKBACK_DAYS * DAY_MS;
  let total = 0;
  for (const tx of state.transactions) {
    if (tx.amount >= 0) continue;
    if (!DISCRETIONARY.has(tx.category)) continue;
    const when = new Date(tx.when).getTime();
    if (!Number.isFinite(when) || when < since || when > nowMs) continue;
    total += -tx.amount;
  }
  return total / HOLD_LOOKBACK_DAYS;
}

// The real £ lift a move gives the tight point: route the HYPOTHETICAL state and diff its tight point
// against the base route's. Clamped ≥ 0 (a move never reads as making things worse) and rounded to
// whole pounds (money reads as money). Pure given its inputs — never touches the live store.
function liftFromRoute(base: number, candidateState: AppState, now: Date): number {
  const candidate = routeFromStore(candidateState, now).tightPoint.amount;
  return Math.max(0, Math.round(candidate - base));
}

export function RecoveryScreen({ nav, state = 'populated' }: RecoveryScreenProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // The full app state — the same stable `useSyncExternalStore` snapshot the shared route bridge
  // selects, so we can re-route HYPOTHETICAL copies for the per-move deltas without touching the live
  // store. The doc-block @reads (subs, subPaused, tightPointGoal) are all carried within it.
  const appState = useAppStore((st) => st);

  // Mode-tinted copy (BREAKS-PARITY fix) — each of the 10 Money Modes gets its own eyebrow, intro,
  // headline, shortfall/after labels, Melo default line and CTA (web `getRecoveryCopy(mode)`).
  const moneyMode = useAppStore((st) => st.moneyMode ?? 'survival');
  const modeCopy = getRecoveryCopy(moneyMode);

  // Structural-fit signpost (BREAKS-PARITY fix) — see docs/SIGNATURE_MOMENTS.md. When bills alone
  // outrun income, or the user has closed 2+ hard cycles in a row, this isn't a spending problem to
  // solve inside the app. Real help is signposted honestly (UK charities, no affiliate links).
  // The RN store has no persisted `hardCyclesInARow` counter (the web bumps it at cycle-close time);
  // derived here instead, honestly, from the real `cycles` ledger — a streak of closed cycles whose
  // `tightPoint < 0` ("closed in the red"), counted from the most recent cycle backwards. Same
  // definition the web uses to decide "wasRed" (store.ts `recordCycleHardness`), just computed from
  // history rather than carried as separate state.
  const monthlyIncome = useAppStore((st) => selectMonthlyIncome(st));
  const cycles = useAppStore((st) => st.cycles);
  const hardCyclesInARow = useMemo(() => {
    let streak = 0;
    for (const cycle of cycles) {
      if (cycle.tightPoint < 0) streak += 1;
      else break;
    }
    return streak;
  }, [cycles]);
  const monthlyBills = useMemo(
    () =>
      appState.subs
        .filter((sub) => !appState.subPaused[sub.name])
        .reduce((sum, sub) => sum + sub.cost, 0),
    [appState.subs, appState.subPaused],
  );
  const doesntFit = monthlyIncome > 0 && monthlyBills > monthlyIncome;
  const signpostReal = doesntFit || hardCyclesInARow >= 2;

  // Mount-gate (same as TodayScreen): defer `new Date()` so nothing reads the clock during render and
  // the route has an honest "today" before it draws. Until the gate opens we route against EPOCH and
  // discard that frame's figure (`routeReady` false), keeping the pre-engine layout for one frame.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);
  const routeNow = now ?? EPOCH;
  const routeReady = now !== null;

  const [picked, setPicked] = useState<string | null>(null);

  // The base route — the live verdict. Its tight point's depth below zero IS the shortfall. Recovery
  // is an overspent-only surface: a direct mount with no real money picture or no negative tight point
  // takes the honest empty branch below, never a web/sample fallback.
  const baseTight = useMemo(
    () => routeFromStore(appState, routeNow).tightPoint.amount,
    [appState, routeNow],
  );
  const hasMoneyPicture =
    appState.onboarding.done ||
    appState.transactions.length > 0 ||
    appState.currentBalance.amount !== 0 ||
    monthlyIncome > 0;
  const hasShortfall = routeReady && hasMoneyPicture && baseTight < 0;
  const shortfall = hasShortfall ? Math.round(-baseTight) : FALLBACK_SHORTFALL;

  // The three corrective moves, each carrying its REAL lift. Pause-a-sub and Move-a-bill re-route a
  // hypothetical store copy and diff the tight point against the base; Set-a-hold frees the user's
  // real daily discretionary across the hold (no dated outflow to drop, so the lift is that freed
  // room). All three are honest derivations from live data — £0 where there's nothing real (@rn-engine).
  const moves: Move[] = useMemo(() => {
    const subs = appState.subs;
    const subPaused = appState.subPaused;

    const pausable = pausableSub(subs, subPaused);
    const bill = flexibleBill(subs, subPaused);

    // Move a bill: slide the flexible bill BILL_NUDGE_DAYS later, on a hypothetical copy, and diff.
    const billLift = bill
      ? liftFromRoute(
          baseTight,
          {
            ...appState,
            subOverrides: {
              ...appState.subOverrides,
              [bill.name]: (appState.subOverrides[bill.name] ?? 0) + BILL_NUDGE_DAYS,
            },
          },
          routeNow,
        )
      : 0;

    // Pause a sub: drop the chosen sub's renewal outflow on a hypothetical copy, and diff.
    const subLift = pausable
      ? liftFromRoute(
          baseTight,
          { ...appState, subPaused: { ...appState.subPaused, [pausable.name]: true } },
          routeNow,
        )
      : 0;

    // Set a hold: a 3-day soft pause frees the user's REAL average daily discretionary across those
    // days — room that lifts the tight point by exactly that amount (it's the spend that doesn't
    // happen). Derived from logged spend, so it's £0 when there's nothing real to pause — never faked.
    // (Unlike pause/move, a future spend-hold has no dated outflow in the base route to drop, so the
    // lift is the freed room itself, not a re-route diff.)
    const holdLift = Math.max(
      0,
      Math.round(avgDailyDiscretionary(appState, routeNow.getTime()) * HOLD_DAYS),
    );

    // Cards exist ONLY when their real target exists. The web demo's fabricated fallback cards
    // (a named energy bill to move, a named streaming sub to pause, an invented monthly figure)
    // rendered to real users with zero subs — seen live on the owner's cleared device
    // (2026-07-11). A user with no subs now gets only the hold card (whose figure derives from
    // their real logged spend, £0 included). Guarded by noFabricatedContent.test.ts.
    const built: (Move | null)[] = [
      bill
        ? {
            id: 'move-bill',
            kind: 'Move a bill',
            title: `Move ${bill.name} ${BILL_NUDGE_DAYS} days later`,
            delta: `+£${billLift} this week`,
            deltaValue: billLift,
            body: `Pushes ${bill.name}'s next charge ${BILL_NUDGE_DAYS} days later in the cycle — past the tight point instead of before it.`,
            cost: 'no fee — check the supplier is flexible',
            melo: 'Quietest move. Same money, kinder timing.',
            // Slide the flexible bill later in the cycle — the real "what if I move this?" write.
            commit: () => {
              nudgeSub(bill.name, BILL_NUDGE_DAYS);
            },
          }
        : null,
      pausable
        ? {
            id: 'pause-sub',
            kind: 'Pause a sub',
            title: `Pause ${pausable.name} for a month`,
            delta: `+£${subLift} this month`,
            deltaValue: subLift,
            body: 'Nothing comes out of your account for one month. Resumes automatically unless you cancel.',
            cost: `£${pausable.cost.toFixed(2)}/mo back · resumes automatically`,
            melo: 'Small experiment. You can resume any time.',
            subName: pausable.name,
            // Pause the chosen sub (nearest renewal) — the real store write.
            commit: () => {
              togglePaused(pausable.name, true);
            },
          }
        : null,
      {
        id: 'hold-spend',
        kind: 'Set a hold',
        title: 'Hold spending for 3 days',
        delta: `+£${holdLift} estimated`,
        deltaValue: holdLift,
        body: "Bills and recurring still pay. Discretionary spend goes on a soft pause — you'll see a gentle nudge if you try.",
        cost: 'based on your average daily discretionary',
        melo: 'Three calm days. Not punishment, just space.',
        // Set a tight-point floor — the soft-pause is held as a floor to protect at the low point.
        commit: () => setTightPointGoal(HOLD_FLOOR),
      },
    ];
    return built.filter((m): m is Move => m !== null);
  }, [appState, baseTight, routeNow]);

  const pickedMove = moves.find((m) => m.id === picked);

  // The after-move figure: the real shortfall (negative) lifted by the picked move's real route delta,
  // clamped so a move never reads as overshooting the gap downward. Negative = still short, >= 0 =
  // reaches room. The re-drawn tight point, straight off the engine — not a guess.
  const after = pickedMove ? Math.max(-shortfall + pickedMove.deltaValue, -shortfall) : -shortfall;
  const reachesRoom = after >= 0;

  // Count up the magnitude between selections (MOTION.md: money values count up, never slide).
  const afterMagnitude = useCountUp(Math.abs(after), COUNT_MS, reduceMotion);

  // Guard a stray commit after unmount (defensive — no timers here, but keep the contract explicit).
  const committedRef = useRef(false);

  // "Rebuild the plan" — the ONLY commit. Applies the picked move's real store write once, then
  // routes to today-after. @rn-engine money-path: the web also set pressure='soft' so today-after
  // re-draws the route to the softened plan; the RN Nav carries no pressure setter yet, so that
  // soft-pressure route re-draw is the money-path engine's job. The ordered intent is preserved:
  // commit the move first, then navigate.
  function onRebuild() {
    if (!pickedMove || committedRef.current) return;
    committedRef.current = true;
    pickedMove.commit();
    nav.go('today-after');
  }

  // empty — no overspent verdict to recover from. Per the spec, Recovery is only reached from an
  // overspent verdict; with no shortfall it should not render a blank Recovery, so it offers a calm
  // doorway back to Today rather than dead-ending.
  if (state === 'empty' || (routeReady && !hasShortfall)) {
    const needsSetup = !hasMoneyPicture;
    return (
      <EmptyState
        mood="calm"
        headline={needsSetup ? 'Add your first money picture' : 'Nothing to repair'}
        body={
          needsSetup
            ? 'Set your balance and payday first. Recovery will appear only when a real route needs room.'
            : "You're on track to payday. Recovery shows up only when something needs a move."
        }
        cta={
          needsSetup
            ? { label: 'Add my numbers', onPress: () => nav.openSheet('onboarding') }
            : { label: 'Back to today', onPress: () => nav.go('today') }
        }
      />
    );
  }

  // loading — Melo curious + a line, NEVER a spinner (hard rule + STATES.md).
  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}
      >
        <MeloLine mood="curious" text="One second — working out what would move." />
      </View>
    );
  }

  // populated / offline / error — the real triage surface. offline ≡ populated (local-first); a
  // direct error mount still shows the surface so the user can act on the moves in hand. Eyebrow /
  // caption labels are mode-tinted (BREAKS-PARITY fix).
  const eyebrow = modeCopy.eyebrow;
  const caption = pickedMove
    ? reachesRoom
      ? 'you reach payday with room'
      : `still £${Math.round(afterMagnitude)} short — try another move`
    : 'to reach payday with room';
  const sign = reachesRoom ? '+' : '−'; // U+2212 MINUS SIGN
  const afterValue = `${sign}£${Math.round(afterMagnitude)}`;

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.md, paddingBottom: insets.bottom + gap.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — back glyph · "Recovery" eyebrow · spacer (keeps the eyebrow optically centred). */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            onPress={nav.back}
            style={({ pressed: isPressed }) => [
              styles.pressIcon,
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <BackArrow color={t.muted} />
          </Pressable>
          <Text style={[styles.eyebrow, { color: t.muted }]}>{eyebrow}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Structural-fit signpost (BREAKS-PARITY fix) — bills alone outrun income, or 2+ hard
            cycles in a row: an empathetic, safety-relevant referral to free UK debt charities. */}
        {signpostReal ? (
          <View
            style={[styles.signpostCard, { backgroundColor: t.surface, borderColor: t.hairline }]}
          >
            <Text style={[styles.signpostLabel, { color: t.muted }]}>
              {doesntFit ? "This cycle doesn't fit" : 'A few hard cycles in a row'}
            </Text>
            <Text style={[styles.signpostBody, { color: t.ink }]}>
              {doesntFit
                ? "Bills alone come to more than income. That's a shape problem, not a spending one. Free UK services can help you look at it together."
                : 'Two tough cycles back-to-back can mean the shape needs help, not just tighter moves. These UK services are free.'}
            </Text>
            <View style={styles.signpostLinks}>
              <SignpostLink label="StepChange" url="https://www.stepchange.org" t={t} />
              <SignpostLink
                label="Citizens Advice"
                url="https://www.citizensadvice.org.uk/debt-and-money/"
                t={t}
              />
              <SignpostLink
                label="National Debtline"
                url="https://www.nationaldebtline.org"
                t={t}
              />
            </View>
          </View>
        ) : null}

        {/* Title block — italic reassurance + the headline with the mode-tinted accent word
            (BREAKS-PARITY fix — was fixed to survival's "Something has to move."). */}
        <View style={styles.titleBlock}>
          <Text style={[styles.kicker, { color: t.muted }]}>{modeCopy.intro}</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {`${modeCopy.headlineLead} `}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>
              {modeCopy.headlineAccent}
            </Text>
          </Text>
        </View>

        {/* Shortfall card — Melo (mood softens when the move closes the gap) + the live after figure.
            Label is mode-tinted (BREAKS-PARITY fix). */}
        <View
          style={[styles.shortfallCard, { backgroundColor: t.surface, borderColor: t.hairline }]}
        >
          <Melo size={56} mood={reachesRoom ? 'calm' : 'concern'} grounded={false} />
          <View style={styles.shortfallBody} accessibilityLiveRegion="polite">
            <Text style={[styles.cardLabel, { color: t.muted }]}>
              {pickedMove ? modeCopy.afterLabel : modeCopy.shortfallLabel}
            </Text>
            <Text
              accessibilityLabel={`${afterValue} ${caption}`}
              style={[styles.afterValue, { color: reachesRoom ? t.positiveInk : t.repairInk }]}
            >
              {afterValue}
            </Text>
            <Text style={[styles.cardCaption, { color: t.muted }]}>{caption}</Text>
          </View>
        </View>

        {/* "Pick one thing" — the single-select move group. */}
        <Text style={[styles.sectionLabel, { color: t.muted }]}>Pick one thing</Text>
        <View accessibilityRole="radiogroup" style={styles.moveList}>
          {moves.map((m) => (
            <MoveCard
              key={m.id}
              move={m}
              active={picked === m.id}
              reduceMotion={reduceMotion}
              t={t}
              s={s}
              // Single-select: tapping the active card deselects (→ null), disabling the CTA.
              onPress={() => setPicked((prev) => (prev === m.id ? null : m.id))}
            />
          ))}
        </View>

        {/* Talk-through escape hatch — opens Melo seeded with the frozen prefill. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Talk it through with Melo"
          hitSlop={8}
          onPress={() => nav.openMelo({ prefill: MELO_PREFILL })}
          style={({ pressed: isPressed }) => [
            styles.talkLink,
            isPressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.talkLinkText, { color: t.muted }]}>
            {'Not sure? Talk it through with Melo →'}
          </Text>
        </Pressable>

        {/* Melo aside — the picked move's frozen line, or the mode-tinted default (BREAKS-PARITY fix).
            MeloLine adds the quotes. */}
        <View style={styles.meloAside}>
          <MeloLine mood="calm" size={28} text={pickedMove?.melo ?? modeCopy.meloDefault} />
        </View>

        {/* Primary CTA — disabled until a move is picked; commits the move, routes to today-after.
            Label is mode-tinted (BREAKS-PARITY fix). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={modeCopy.cta}
          accessibilityState={{ disabled: !pickedMove }}
          disabled={!pickedMove}
          onPress={onRebuild}
          style={({ pressed: isPressed }) => [
            styles.primary,
            { backgroundColor: pickedMove ? t.calmStrong : t.sunken },
            isPressed && pickedMove ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.primaryLabel, { color: pickedMove ? t.inverse : t.muted }]}>
            {modeCopy.cta}
          </Text>
        </Pressable>

        {/* Secondary — back out, no move made. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Not now"
          onPress={nav.back}
          style={({ pressed: isPressed }) => [
            styles.secondary,
            isPressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.secondaryLabel, { color: t.muted }]}>Not now</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Move card — one corrective move. Active = accent-soft fill + a terracotta ring (border, not a drop
// shadow, so the flat paper look holds), revealing the body + cost with a fade-in.
// ---------------------------------------------------------------------------

function MoveCard({
  move,
  active,
  reduceMotion,
  t,
  s,
  onPress,
}: {
  move: Move;
  active: boolean;
  reduceMotion: boolean;
  t: Palette;
  s: ReturnType<typeof makeStyles>;
  onPress: () => void;
}) {
  // fade-in for the expanded body — opacity 0 → 1 over 220ms, final-state under reduce-motion.
  const reveal = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    if (!active) {
      reveal.value = 0;
      return;
    }
    if (reduceMotion) {
      reveal.value = 1;
      return;
    }
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: FADE_MS, easing: EASE_OUT_EXPO });
  }, [active, reduceMotion, reveal]);
  const revealStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${move.kind}: ${move.title}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.moveCard,
        active
          ? { backgroundColor: t.calmSoft, borderColor: t.calm }
          : { backgroundColor: t.surface, borderColor: t.hairline },
        isPressed ? styles.pressed : undefined,
      ]}
    >
      <View style={styles.moveTopRow}>
        <Text style={[styles.moveKind, { color: t.muted }]}>{move.kind}</Text>
        <Text style={[styles.moveDelta, { color: active ? t.calmStrong : t.positiveInk }]}>
          {move.delta}
        </Text>
      </View>
      <Text style={[styles.moveTitle, { color: t.ink }]}>{move.title}</Text>
      {active ? (
        <Animated.View style={[styles.moveExpanded, revealStyle]}>
          <Text style={[styles.moveBody, { color: t.secondary }]}>{move.body}</Text>
          {move.cost ? (
            <Text style={[styles.moveCost, { color: t.muted }]}>{move.cost}</Text>
          ) : null}
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

// The structural-fit signpost's outbound pill — a free UK debt-help service, opened in the system
// browser. No affiliate links, no in-app webview (a plain external hand-off, matching the web's
// `target="_blank" rel="noreferrer noopener"` anchor).
function SignpostLink({ label, url, t }: { label: string; url: string; t: Palette }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => {
        void Linking.openURL(url);
      }}
      style={({ pressed: isPressed }) => [
        signpostLinkStyles.pill,
        { backgroundColor: t.inset, borderColor: t.hairline },
        isPressed ? { opacity: 0.6 } : undefined,
      ]}
    >
      <Text style={[signpostLinkStyles.label, { color: t.ink }]}>{label}</Text>
    </Pressable>
  );
}

const signpostLinkStyles = StyleSheet.create({
  label: {
    fontSize: 12,
  },
  pill: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: gap.md,
    paddingVertical: 6,
  },
});

// Back arrow — the web '←' glyph, drawn inline (matches ReviewScreen). 20×20 user space.
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

// Layout-only styles (spacing, type, flex, radii) — theme-independent, kept module-level static per
// the kit's DARK-MODE PATTERN. Only colour-bearing values are applied inline from the active palette.
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // px-7 ≈ screen inset → gap.xl (24).
  content: {
    flexGrow: 1,
    paddingHorizontal: gap.xl,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pressIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 24,
  },
  // The right-edge spacer balancing the back glyph (web `w-5`).
  headerSpacer: {
    width: 20,
  },
  // Eyebrow — 12px uppercase tracked muted (web tracking-[0.14em] ≈ 1.7px letterSpacing).
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  // Structural-fit signpost card (BREAKS-PARITY fix) — surface, hairline, 2xl radius, p-4, mt-4.
  signpostCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.lg,
    padding: gap.lg,
  },
  // 11px uppercase tracked muted (web tracking-[0.12em]).
  signpostLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  // 13px body, relaxed, mt-1.5.
  signpostBody: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: gap.xs + gap.xxs,
  },
  // The charity-link pill row — mt-2, wraps, gap-2.
  signpostLinks: {
    columnGap: gap.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: gap.sm,
    rowGap: gap.sm,
  },
  // Title block — mt-5.
  titleBlock: {
    marginTop: gap.lg + gap.xs,
  },
  // Fraunces italic kicker, 13px muted.
  kicker: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
    lineHeight: 18,
  },
  // Fraunces headline, 30px, tight line-height (web leading-[1.05]), mt-1.
  headline: {
    fontFamily: serif.display,
    fontSize: 30,
    letterSpacing: -0.3,
    lineHeight: 32,
    marginTop: gap.xs,
  },
  // The accent word stays UPRIGHT (web em.not-italic) — same display face, normal style.
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // Shortfall card — surface, hairline, 2xl radius, p-5, row, mt-5.
  shortfallCard: {
    alignItems: 'center',
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    columnGap: gap.lg,
    flexDirection: 'row',
    marginTop: gap.lg + gap.xs,
    padding: gap.lg + gap.xs,
  },
  shortfallBody: {
    flex: 1,
  },
  // 11px uppercase tracked muted (web tracking-[0.12em] ≈ 1.4px).
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  // The big after/shortfall figure — money size 'lg', tabular, mt small.
  afterValue: {
    fontSize: 34,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 2,
  },
  // Fraunces italic caption, 11.5px muted, mt-1.
  cardCaption: {
    fontFamily: serif.displayItalic,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: gap.xs,
  },
  // "Pick one thing" — 11px uppercase tracked muted, mt-5, px-1.
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.7,
    marginTop: gap.lg + gap.xs,
    paddingHorizontal: gap.xs,
    textTransform: 'uppercase',
  },
  // The move list — mt-2, gap-2.5 between cards.
  moveList: {
    marginTop: gap.sm,
    rowGap: gap.sm + gap.xxs,
  },
  // A move card — 2xl radius, px-5 py-4, hairline (the active ring/fill are applied inline).
  moveCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    paddingHorizontal: gap.lg + gap.xs,
    paddingVertical: gap.md + gap.xs,
  },
  moveTopRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // 10.5px uppercase tracked muted (web tracking-[0.12em]).
  moveKind: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  // 12px tabular delta — terracotta when active, calm green otherwise.
  moveDelta: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  // 14.5px medium move title, mt-0.5.
  moveTitle: {
    fontSize: 14.5,
    fontWeight: '500',
    marginTop: gap.xxs,
  },
  // Expanded body — mt-2, gap-1.5, fade-in.
  moveExpanded: {
    marginTop: gap.sm,
    rowGap: gap.xs + gap.xxs,
  },
  // 12.5px body, relaxed line-height (web leading-relaxed).
  moveBody: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  // 11px cost/evidence caption.
  moveCost: {
    fontSize: 11,
    lineHeight: 15,
  },
  // The talk-through link — mt-3, self-start, underlined offset (web underline-offset-2).
  talkLink: {
    alignSelf: 'flex-start',
    marginTop: gap.md,
    paddingVertical: 4,
  },
  talkLinkText: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  // The Melo aside — mt-4.
  meloAside: {
    marginTop: gap.lg,
  },
  // Primary CTA — full width, h-[54px], 2xl radius (the fill is applied inline by picked state).
  primary: {
    alignItems: 'center',
    borderRadius: radius.xxl,
    height: 54,
    justifyContent: 'center',
    marginBottom: gap.md,
    marginTop: gap.lg + gap.xs,
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  // Secondary — h-[44px], a quiet muted label.
  secondary: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    marginBottom: gap.xl,
  },
  secondaryLabel: {
    fontSize: 13,
  },
  // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});

// Colour-bearing factory — kept for the DARK-MODE PATTERN parity with sibling screens. The card's
// per-state colours are applied inline from the active palette (they switch on `active`/`picked`,
// not on the theme), so this currently holds no static colour styles; it exists so a later colour
// extraction follows the same `useMemo(() => makeStyles(t), [t])` shape the kit prescribes.
function makeStyles(_t: Palette) {
  return StyleSheet.create({});
}
