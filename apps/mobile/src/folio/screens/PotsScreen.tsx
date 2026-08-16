// @rn-engine pot-engine — allocations, weekly transfers, goal tracking (pure local logic, BUILD_PLAN §; ENGINES §6)
//
// PotsScreen — the faithful 1:1 React Native port of the web set-aside pots screen
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPots.tsx).
//
// @rn-screen    PotsScreen
// @rn-stack     MainTabs > Pots
// @purpose      Set-aside pots — a calm "Across pots" aggregate, a list of pot cards (progress bar,
//               pace/ETA line, +£5/+£10/+£20 quick-add), an "Open a pot" doorway, and a closing Melo
//               line. Moving money between pots opens a screen-owned Reallocate sheet (amount + a live
//               tight-point preview + "Move £n").
// @reads        pots · onboarding · currentBalance · potLedger (via useAppStore) · the full app state
//               (via useAppStore) so the Reallocate sheet can re-route a hypothetical copy through the
//               shared money-path bridge (@/folio/lib/storeRoute) for its real lowest-balance preview
// @writes       addToPot (each +£n quick-add → a potLedger deposit) · setPots (the committed move)
// @opens-sheet  — (the Reallocate sheet is a screen-owned <Sheet>, NOT a shell SheetId)
// @copy         FROZEN — pots.* keys come VERBATIM from '@/folio/copy/copy'; the frame strings the
//               deck does not yet carry are frozen inline literals (no banned words).
// @tokens       surface · inset · hairline · calm (accent) · calmSoft (accent-soft) · positive ·
//               repair (negative) · ink · muted · canvas (paper) — all from the kit via '@/folio/theme'.
// @motion       count-up on the aggregate figure (700ms) · per-pot + aggregate progress-bar width tween
//               (700/500ms) · press 0.97 · slide-in-r (whole screen) · sheet-rise (the Reallocate sheet).
//               Every motion collapses to its FINAL STATE under reduce-motion (count-up snaps, bars
//               resolve, slide/sheet appear at rest).
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit / store / sibling screens):
//   • DRAG → TAP. The web initiated a transfer by HTML5-dragging pot A onto pot B. RN has no HTML5
//     drag-and-drop, and the project's hard rule is tap-only ≥44px targets. So each pot card carries
//     an explicit "Move money" affordance (the ⋮⋮ grip is kept as the visual cue); tapping it reveals
//     a small inline destination picker (the OTHER pots), and choosing one opens the same Reallocate
//     sheet with the exact same transfer flow, copy, and states. This mirrors the in-repo precedent in
//     surfaces/pressureMap/pots.tsx (drag replaced by an explicit affordance + the same sheet). The web
//     never persisted a reorder (onDrop only opened the sheet), so no reorder is invented here.
//   • SLIDER → STEPPER. The web amount control was <input type=range step=5>. The app ships no slider
//     dependency (checked), so the amount is a calm −£5 / +£5 stepper clamped to [0, from-pot balance]
//     in £5 steps — exactly the web slider's bounds + step — matching the established reallocation sheet.
//   • TIGHT-POINT PREVIEW is now the REAL money-path engine, not the web's "Rough preview only"
//     heuristic. The Reallocate sheet's "Lowest balance" base is the live route's tight point
//     (routeFromStore(...).tightPoint.amount via @/folio/lib/storeRoute), and the delta is a true
//     route diff: re-route a HYPOTHETICAL COPY of the state with the move applied (source pot down,
//     destination up) and subtract the base tight point. Because every pot's saved is earmarked cash
//     that lowers the whole path by the same flat offset (ENGINES §6 "Pots ↔ spendable money"),
//     moving money between two pots keeps Σ saved constant, so a balanced transfer's honest delta is
//     £0 — reallocating earmarked money doesn't change the lowest point — and it reads as the steady
//     figure rather than the old fabricated buffer-only swing. The clock is mount-gated like
//     TodayScreen (EPOCH sentinel + a `now` state); the single pre-mount frame keeps the honest
//     per-pressure sample (pressureLow) so a normal open never flashes a different figure.
//   • COPY: the empty state's head + cta come VERBATIM from '@/folio/copy/copy' (pots.empty.head /
//     .cta); the .body is the design SoT's longer set-aside line, restored VERBATIM from the Lovable
//     ScreenPots empty state as a frozen inline literal (the deck's shorter paraphrase was a fidelity
//     gap). Frame strings the deck doesn't carry yet ("Set aside", "Small, calmly, on purpose.", the
//     drag→move subhead, "Across pots", "+ Open a pot", the Melo line, and the Reallocate-sheet
//     strings) are frozen inline literals too.
//   • MELO MOOD reconciled to the mood map (MELO_MOODS): empty = calm (the web passed 'curious', a
//     documented deviation; the map says calm and EmptyState defaults to calm). The closing MeloLine's
//     web mood 'soft' normalises to 'calm' on the canonical Melo vocabulary. Loading = curious + a line
//     (hard rule: never a spinner). The Reallocate sheet shows no Melo (faithful to the web).
//   • name.split(' · ')[0] shortens "Holiday · September" → "Holiday" in the sheet title + impact row —
//     preserved exactly. Money is always full money, tabular (never "12.3K"). Widths are clamped 0..100
//     so a £0 goal can't produce a NaN/Infinity bar. Negative tight points ("£-86" / red "−£X") render.
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Banned visible words (import / rows /
// parser / extraction / OCR / sync / dashboard / analytics / users / 100% / bank-grade / AI-powered /
// smart / provenance / source record / indexed) are absent.

import { useEffect, useMemo, useRef, useState } from 'react';
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
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { elevation, gap, radius, serif, useCountUp, useTheme, type Palette } from '@/folio/theme';
import { Sheet } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { MeloReaction } from '@/folio/ui/MeloReaction';
import { ScreenHeader } from '@/folio/ui/ScreenHeader';
import { copy } from '@/folio/copy/copy';
import {
  addToPot,
  repayToPot,
  setPotAllowNegative,
  setPots,
  useAppStore,
  type AppState,
  type Pot,
} from '@/folio/store';
import { routeFromStore } from '@/folio/lib/storeRoute';
import { pressureLow } from '@/folio/screens/today/pressure';
import type { Nav, Pressure } from '@/folio/types';
import { triggerFeedback } from '@/folio/lib/feedback';

// The render states this screen can occupy (spec stateBranches). Pots are local + synchronous, so
// loading/error are defensive: loading shows Melo curious + a line (never a spinner), error shows an
// inline retry, offline ≡ populated (local-first, no network language).
export type PotsState = 'populated' | 'empty' | 'loading' | 'error' | 'offline';

export type PotsScreenProps = {
  nav: Nav;
  /** The route pressure band. The web read this off `nav.pressure`; the RN Nav contract carries no
   *  pressure, so the shell threads it explicitly (mirrors TodayScreen). Now only the honest pre-mount
   *  FALLBACK for the Reallocate sheet's "Lowest balance" (indexes pressureLow[]) — once the mount-gate
   *  opens the real route engine supplies that figure. Defaults to the shell's calm band. */
  pressure?: Pressure;
  /** Force a render state (defaults to deriving from the live pots). Exposed for the shell + tests. */
  state?: PotsState;
};

// The +£n quick-add increments, verbatim from the web ([5, 10, 20]).
const QUICK_ADD = [5, 10, 20] as const;

// The reallocation step, in whole £ — the web slider stepped in £5.
const MOVE_STEP = 5;

// The aggregate / per-pot progress-bar tween durations (web: 700ms aggregate, 500ms per pot).
const AGG_TWEEN_MS = 700;
const POT_TWEEN_MS = 500;

// The aggregate count-up duration (web useCountUp(total, 700)).
const COUNT_MS = 700;

// slide-in-r geometry (web .slide-in-r): the whole screen enters from +28px on X with a fade, 360ms,
// on the editorial ease-out-expo. Mirrors ReviewScreen / Melo.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// A stable sentinel "now" for the one render before the mount-gate opens. `routeFromStore` needs an
// honest "today"; until `now` is set we route against this and discard the figure that frame.
// Module-level so its identity never churns the memo. (Same pattern as TodayScreen / RecoveryScreen.)
const EPOCH = new Date(0);

// The REAL reallocate impact — replaces the web's "Rough preview only" heuristic (which faked a
// buffer-only ±round(clamped·0.6) nudge). The lowest balance comes from the shared money-path engine
// via `routeFromStore`; the delta comes from re-routing a HYPOTHETICAL COPY of the live state with the
// move applied (the source pot down `clamped`, the destination up `clamped`) and diffing its tight
// point against the base route's. Pure given its inputs — never mutates the live store.
//
// Because the engine treats every pot's `saved` as earmarked cash that lowers the whole path by the
// same flat offset (ENGINES §6 "Pots ↔ spendable money"), moving money BETWEEN two pots keeps Σ saved
// unchanged, so the honest tight-point delta of a balanced transfer is £0. That's the truthful answer
// — reallocating earmarked money doesn't change the lowest point — and it shows as the steady figure
// rather than a fabricated swing.
function routeImpact(
  state: AppState,
  fromId: string,
  toId: string,
  clamped: number,
  now: Date,
): { base: number; delta: number } {
  const base = Math.round(routeFromStore(state, now).tightPoint.amount);
  const candidateState: AppState = {
    ...state,
    pots: state.pots.map((p) =>
      p.id === fromId
        ? { ...p, saved: p.saved - clamped }
        : p.id === toId
          ? { ...p, saved: p.saved + clamped }
          : p,
    ),
  };
  const candidate = Math.round(routeFromStore(candidateState, now).tightPoint.amount);
  return { base, delta: candidate - base };
}

// Shorten "Holiday · September" → "Holiday" for the sheet title + impact row (web name.split(' · ')[0]).
function shortName(name: string): string {
  return name.split(' · ')[0] ?? name;
}

// Clamp a progress percentage to 0..100 so a 0 / missing goal can't yield NaN/Infinity bar widths.
function pctOf(value: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

// Local reduce-motion read, mirroring ReviewScreen / Melo / StartScreen: read once, then subscribe.
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

export function PotsScreen({ nav, pressure = 'calm', state }: PotsScreenProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // Real store reads (spec: data is REAL). onboarding / currentBalance / potLedger are read so the
  // screen is honestly bound to the same state the rest of the app mutates, even where this surface
  // only surfaces `pots` directly today.
  const pots = useAppStore((st) => st.pots);
  const onboarding = useAppStore((st) => st.onboarding);
  const currentBalance = useAppStore((st) => st.currentBalance);
  const potLedger = useAppStore((st) => st.potLedger);

  // Per-pot outstanding borrow = sum(borrow) − sum(repay) (ENGINES §4; web ScreenPots `owedByPot`).
  // Drives the "Repay £n" affordance + caption on any pot with a positive residual.
  const owedByPot = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of potLedger) {
      if (e.kind === 'borrow') map[e.potId] = (map[e.potId] ?? 0) + e.amount;
      else if (e.kind === 'repay') map[e.potId] = (map[e.potId] ?? 0) - e.amount;
    }
    return map;
  }, [potLedger]);

  // The full app state — the same stable `useSyncExternalStore` snapshot the shared route bridge
  // selects, so the Reallocate sheet can re-route a HYPOTHETICAL copy for its real tight-point delta
  // without touching the live store. (Mirrors RecoveryScreen.)
  const appState = useAppStore((st) => st);

  // Mount-gate the clock (same as TodayScreen / RecoveryScreen): defer `new Date()` so nothing reads
  // the clock during render and the route has an honest "today" before it computes. Until the gate
  // opens we route against EPOCH and discard that frame's figure (`route` null), keeping the honest
  // pre-engine fallback (pressureLow[pressure]) for that single frame.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  // Transfer flow state: which pot we're moving FROM (its move-picker is open), and the chosen
  // {from,to} pair (drives the Reallocate sheet). amount is the chosen move in whole £.
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<{ from: string; to: string } | null>(null);
  const [amount, setAmount] = useState(20);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [potName, setPotName] = useState('');
  const [potGoal, setPotGoal] = useState('');
  const [potWeekly, setPotWeekly] = useState('');

  const total = pots.reduce((sum, p) => sum + p.saved, 0);
  const totalGoal = pots.reduce((sum, p) => sum + p.goal, 0);

  const resolvedState: PotsState = state ?? (pots.length === 0 ? 'empty' : 'populated');

  // The aggregate count-up — settles to the live total; snaps under reduce-motion.
  const totalDisplay = useCountUp(
    resolvedState === 'populated' ? total : total,
    COUNT_MS,
    reduceMotion,
  );

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

  const fromPot = transfer ? (pots.find((p) => p.id === transfer.from) ?? null) : null;
  const toPot = transfer ? (pots.find((p) => p.id === transfer.to) ?? null) : null;
  const maxMove = fromPot ? fromPot.saved : 0;
  const clamped = Math.max(0, Math.min(amount, maxMove));

  // The REAL lowest-balance preview — the money-path engine, not the old "Rough preview only" stub.
  // `routeImpact` reads the base tight point from the live route and re-routes a HYPOTHETICAL copy of
  // the state with this exact move applied, diffing the tight points. The hook can't be called
  // conditionally, so it always computes against `now ?? EPOCH`; before the mount-gate opens
  // (`now === null`) the engine has no honest "today", so we discard that transient and fall back to
  // the honest per-pressure sample (pressureLow) with no delta — exactly the pre-engine state, so the
  // sheet never flashes a different figure on a normal open. The diff is recomputed only when the
  // route inputs, the chosen pair, or the amount actually change.
  const impact = useMemo(() => {
    if (!now || !transfer || !fromPot || !toPot) return null;
    return routeImpact(appState, transfer.from, transfer.to, clamped, now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, transfer, fromPot, toPot, clamped, appState]);

  const tightPointBase = impact ? impact.base : pressureLow[pressure];
  const tightDelta = impact ? impact.delta : 0;

  function openMove(fromId: string) {
    setMoveFrom((current) => (current === fromId ? null : fromId));
  }

  function chooseDestination(fromId: string, toId: string) {
    setMoveFrom(null);
    const source = pots.find((p) => p.id === fromId);
    setAmount(Math.min(20, source?.saved ?? 20));
    setTransfer({ from: fromId, to: toId });
  }

  function closeTransfer() {
    setTransfer(null);
    setAmount(20);
  }

  // The committed move — the web's commit(): pull `clamped` £ from the source pot and add it to the
  // destination, immutably (setPots map). Cleared after.
  function commit() {
    if (!transfer || clamped <= 0) return;
    setPots((ps) =>
      ps.map((p) =>
        p.id === transfer.from
          ? { ...p, saved: p.saved - clamped }
          : p.id === transfer.to
            ? { ...p, saved: p.saved + clamped }
            : p,
      ),
    );
    void triggerFeedback('pot-commit');
    closeTransfer();
  }

  function closeCreator() {
    setCreatorOpen(false);
    setPotName('');
    setPotGoal('');
    setPotWeekly('');
  }

  function createPot() {
    const name = potName.trim();
    const goal = Number(potGoal.replace(/[^0-9.]/g, ''));
    const perWeek = Number(potWeekly.replace(/[^0-9.]/g, ''));
    if (!name || !Number.isFinite(goal) || goal <= 0) return;

    setPots((current) => [
      ...current,
      {
        id: `pot-${Date.now()}`,
        name,
        saved: 0,
        goal,
        perWeek: Number.isFinite(perWeek) ? Math.max(0, perWeek) : 0,
        accent: current.length === 0,
        cadence: { kind: 'after-payday' },
      },
    ]);
    closeCreator();
  }

  // ── EMPTY ──────────────────────────────────────────────────────────────────────────────────────
  // pots.length === 0: the header + "Set aside / Small, calmly, on purpose." frame + EmptyState (deck
  // copy, mood calm) inviting the first pot → opens the real screen-owned creator.
  if (resolvedState === 'empty') {
    return (
      <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
        <View style={[styles.frame, { paddingTop: insets.top + gap.sm }]}>
          <ScreenHeader
            onBack={nav.back}
            eyebrow={copy.pots.title.toUpperCase()}
            eyebrowWeight="600"
            backHitWidth={24}
          />
          <View style={styles.intro}>
            <Text style={[styles.kicker, { color: t.muted }]}>Set aside</Text>
            <Text accessibilityRole="header" style={[styles.heading, { color: t.ink }]}>
              {'Small, '}
              <Text style={[styles.headingAccent, { color: t.calm }]}>calmly</Text>
              {', on purpose.'}
            </Text>
          </View>
          <View style={styles.emptyWrap}>
            <EmptyState
              mood="calm"
              headline={copy.pots.empty.head.replace(/\*\*/g, '')}
              body="A pot is a small set-aside for one thing — a holiday, a buffer, Christmas. Add the first one, then choose the pace."
              cta={{ label: copy.pots.empty.cta, onPress: () => setCreatorOpen(true) }}
            />
          </View>
          <OpenPotSheet
            visible={creatorOpen}
            name={potName}
            goal={potGoal}
            weekly={potWeekly}
            reduceMotion={reduceMotion}
            t={t}
            onNameChange={setPotName}
            onGoalChange={setPotGoal}
            onWeeklyChange={setPotWeekly}
            onCancel={closeCreator}
            onCreate={createPot}
          />
        </View>
      </Animated.View>
    );
  }

  // ── LOADING ────────────────────────────────────────────────────────────────────────────────────
  // Pots are synchronous, so this is defensive only. Melo curious + a line, NEVER a spinner.
  if (resolvedState === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxxl }]}
      >
        <MeloLine mood="curious" text="One second — lining your pots up." />
      </View>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────────────────────────────────────────
  // Pots read from local state, so a load failure is rare; STATES.md asks for an inline retry rather
  // than a dead end. Calm Melo line + a single "Try again" that re-routes through the shell.
  if (resolvedState === 'error') {
    return (
      <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
        <View style={[styles.frame, { paddingTop: insets.top + gap.sm }]}>
          <ScreenHeader
            onBack={nav.back}
            eyebrow={copy.pots.title.toUpperCase()}
            eyebrowWeight="600"
            backHitWidth={24}
          />
          <View style={styles.errorWrap}>
            <MeloLine mood="concern" text="Couldn't bring your pots up just now." />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try again"
              onPress={() => nav.go('pots')}
              style={({ pressed: isPressed }) => [
                styles.retry,
                { backgroundColor: t.calm },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.retryLabel, { color: t.accentInk }]}>Try again</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  }

  // ── POPULATED / OFFLINE ─────────────────────────────────────────────────────────────────────────
  // offline ≡ populated (local-first; renders identically, no network language).
  void onboarding;
  void currentBalance;

  return (
    <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.sm, paddingBottom: insets.bottom + gap.huge },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          onBack={nav.back}
          eyebrow={copy.pots.title.toUpperCase()}
          eyebrowWeight="600"
          backHitWidth={24}
        />

        {/* Frame — italic "Set aside" kicker + the calm display line + the move subhead. */}
        <View style={styles.intro}>
          <Text style={[styles.kicker, { color: t.muted }]}>Set aside</Text>
          <Text accessibilityRole="header" style={[styles.heading, { color: t.ink }]}>
            {'Small, '}
            <Text style={[styles.headingAccent, { color: t.calm }]}>calmly</Text>
            {', on purpose.'}
          </Text>
          <Text style={[styles.subhead, { color: t.muted }]}>
            Move money between pots whenever you like.
          </Text>
        </View>

        {/* Across pots — the aggregate card: count-up figure / of-goal + an ink progress bar. */}
        <View style={[styles.aggCard, { backgroundColor: t.surface }, elevation.card]}>
          <Text style={[styles.label, { color: t.muted }]}>Across pots</Text>
          <View style={styles.aggFigureRow}>
            <Text
              style={[styles.aggFigure, { color: t.ink }]}
            >{`£${Math.round(totalDisplay)}`}</Text>
            <Text style={[styles.aggOf, { color: t.muted }]}>{`of £${totalGoal}`}</Text>
          </View>
          <ProgressBar
            pct={pctOf(total, totalGoal)}
            trackColor={t.inset}
            fillColor={t.ink}
            height={6}
            durationMs={AGG_TWEEN_MS}
            reduceMotion={reduceMotion}
          />
        </View>

        {/* The pot list — each card: name + saved/goal, a bar, a pace/ETA line, the quick-add row, and
            the tap-only Move affordance (the web drag, made explicit). */}
        <View style={styles.potList}>
          {pots.map((p) => (
            <PotCard
              key={p.id}
              pot={p}
              others={pots.filter((o) => o.id !== p.id)}
              moveOpen={moveFrom === p.id}
              owed={owedByPot[p.id] ?? 0}
              t={t}
              s={s}
              reduceMotion={reduceMotion}
              onQuickAdd={(inc) => {
                addToPot(p.id, inc);
                void triggerFeedback('pot-commit');
              }}
              onRepay={(amt) => {
                repayToPot(p.id, amt);
                void triggerFeedback('pot-commit');
              }}
              onToggleAllowNegative={() => setPotAllowNegative(p.id, !p.allowNegative)}
              onToggleMove={() => openMove(p.id)}
              onChooseDestination={(toId) => chooseDestination(p.id, toId)}
            />
          ))}
        </View>

        {/* Open a pot — the doorway to the screen-owned creator. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open a pot"
          accessibilityHint="Starts a new pot."
          onPress={() => setCreatorOpen(true)}
          style={({ pressed: isPressed }) => [
            styles.openCta,
            { backgroundColor: t.calm },
            elevation.cta,
            isPressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.openCtaLabel, { color: t.accentInk }]}>+ Open a pot</Text>
        </Pressable>

        {/* The closing Melo line — web mood 'soft' → calm on the canonical vocabulary. */}
        <View style={styles.meloBlock}>
          <MeloLine mood="calm" text="Pots quietly chip away at what's left — that's the idea." />
        </View>
      </ScrollView>

      {/* The Reallocate sheet — a screen-owned bottom sheet (NOT a shell SheetId). */}
      <ReallocateSheet
        visible={transfer !== null}
        fromPot={fromPot}
        toPot={toPot}
        maxMove={maxMove}
        clamped={clamped}
        amount={amount}
        tightPointBase={tightPointBase}
        tightDelta={tightDelta}
        reduceMotion={reduceMotion}
        t={t}
        s={s}
        onStep={(next) => setAmount(next)}
        onCancel={closeTransfer}
        onMove={commit}
      />
      <OpenPotSheet
        visible={creatorOpen}
        name={potName}
        goal={potGoal}
        weekly={potWeekly}
        reduceMotion={reduceMotion}
        t={t}
        onNameChange={setPotName}
        onGoalChange={setPotGoal}
        onWeeklyChange={setPotWeekly}
        onCancel={closeCreator}
        onCreate={createPot}
      />
    </Animated.View>
  );
}

// ── Pot card ───────────────────────────────────────────────────────────────────────────────────
function PotCard({
  pot,
  others,
  moveOpen,
  owed,
  t,
  s,
  reduceMotion,
  onQuickAdd,
  onRepay,
  onToggleAllowNegative,
  onToggleMove,
  onChooseDestination,
}: {
  pot: Pot;
  others: readonly Pot[];
  moveOpen: boolean;
  /** Outstanding borrow against this pot (ENGINES §4 `owedByPot`). 0 = nothing owed. */
  owed: number;
  t: Palette;
  s: ReturnType<typeof makeStyles>;
  reduceMotion: boolean;
  onQuickAdd: (inc: number) => void;
  onRepay: (amount: number) => void;
  onToggleAllowNegative: () => void;
  onToggleMove: () => void;
  onChooseDestination: (toId: string) => void;
}) {
  const weeksLeft =
    pot.perWeek > 0 ? Math.ceil(Math.max(0, pot.goal - pot.saved) / pot.perWeek) : 0;
  const etaLabel = weeksLeft > 0 ? `about ${weeksLeft} weeks` : 'goal met';
  const canMove = pot.saved > 0 && others.length > 0;
  const repayAmount = Math.min(owed, 20);

  return (
    <View style={[styles.potCard, { backgroundColor: t.surface }, elevation.card]}>
      <View style={styles.potHead}>
        <View style={styles.potNameRow}>
          <GripGlyph color={t.muted} />
          <Text style={[styles.potName, { color: t.ink }]}>{pot.name}</Text>
        </View>
        <Text style={[styles.potFigure, { color: t.ink }]}>
          {`£${pot.saved} `}
          <Text style={[styles.potFigureGoal, { color: t.muted }]}>{`/ £${pot.goal}`}</Text>
        </Text>
      </View>

      <ProgressBar
        pct={pctOf(pot.saved, pot.goal)}
        trackColor={t.inset}
        fillColor={pot.accent ? t.calm : t.ink}
        fillOpacity={pot.accent ? 1 : 0.7}
        height={5}
        durationMs={POT_TWEEN_MS}
        reduceMotion={reduceMotion}
      />

      <View style={styles.paceRow}>
        <Text
          style={[styles.paceText, { color: t.muted }]}
        >{`£${pot.perWeek}/wk at this pace`}</Text>
        <Text style={[styles.paceEta, { color: t.muted }]}>{etaLabel}</Text>
      </View>

      <View style={styles.actionRow}>
        <View style={styles.quickAddRow}>
          {QUICK_ADD.map((inc) => (
            <Pressable
              key={inc}
              accessibilityRole="button"
              accessibilityLabel={`Add £${inc} to ${pot.name}`}
              hitSlop={8}
              onPress={() => onQuickAdd(inc)}
              style={({ pressed: isPressed }) => [
                styles.chip,
                { backgroundColor: t.inset },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.chipLabel, { color: t.ink }]}>{`+£${inc}`}</Text>
            </Pressable>
          ))}
        </View>
        {canMove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Move money from ${pot.name}`}
            accessibilityState={{ expanded: moveOpen }}
            hitSlop={8}
            onPress={onToggleMove}
            style={({ pressed: isPressed }) => [
              styles.moveChip,
              {
                borderColor: moveOpen ? t.calm : t.hairline,
                backgroundColor: moveOpen ? t.calmSoft : t.surface,
              },
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.moveChipLabel, { color: moveOpen ? t.calm : t.muted }]}>Move</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Repay a prior borrow — ENGINES §4 "Pot rules — borrow/repay ledger". Only when this pot has
          a positive residual (owedByPot > 0). Records a repay entry; does not touch `saved` (the money
          already sits in the pot — repaying just clears the owed marker). */}
      {owed > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Repay £${repayAmount} to ${pot.name}`}
          hitSlop={8}
          onPress={() => onRepay(repayAmount)}
          style={({ pressed: isPressed }) => [
            styles.repayChip,
            { backgroundColor: t.calmSoft },
            isPressed ? styles.pressed : undefined,
          ]}
        >
          <Text
            style={[styles.repayChipLabel, { color: t.calmStrong }]}
          >{`Repay £${repayAmount}`}</Text>
        </Pressable>
      ) : null}
      {owed > 0 ? (
        <Text style={[styles.owedCaption, { color: t.muted }]}>
          {`£${owed} borrowed from this pot — repay when the month allows.`}
        </Text>
      ) : null}

      {/* "Can go briefly negative" — the per-pot opt-in that lets a buffer pot dip below £0 when
          borrowed from, instead of the default hard cap (ENGINES §4). */}
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Can go briefly negative"
        accessibilityState={{ checked: !!pot.allowNegative }}
        hitSlop={4}
        onPress={onToggleAllowNegative}
        style={({ pressed: isPressed }) => [
          styles.allowNegRow,
          { backgroundColor: t.inset },
          isPressed ? styles.pressed : undefined,
        ]}
      >
        <Text style={[styles.allowNegLabel, { color: t.muted }]}>Can go briefly negative</Text>
        <View
          style={[
            styles.toggleTrack,
            { backgroundColor: pot.allowNegative ? t.calm : t.inset, borderColor: t.hairline },
          ]}
        >
          <View
            style={[
              styles.toggleThumb,
              { backgroundColor: t.canvas },
              pot.allowNegative ? styles.toggleThumbOn : undefined,
            ]}
          />
        </View>
      </Pressable>

      {/* The destination picker — the tap analogue of "drop pot A onto pot B". Choosing one opens the
          Reallocate sheet for that pair. */}
      {moveOpen && canMove ? (
        <View style={[styles.destWrap, { borderTopColor: t.hairline }]}>
          <Text style={[styles.destLabel, { color: t.muted }]}>Move into</Text>
          <View style={styles.destRow}>
            {others.map((o) => (
              <Pressable
                key={o.id}
                accessibilityRole="button"
                accessibilityLabel={`Move money from ${pot.name} into ${shortName(o.name)}`}
                hitSlop={8}
                onPress={() => onChooseDestination(o.id)}
                style={({ pressed: isPressed }) => [
                  styles.destChip,
                  { borderColor: t.hairline, backgroundColor: t.inset },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.destChipLabel, { color: t.ink }]}>{shortName(o.name)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* MELO_EMOTIONAL_ENGINE.md § 3 — inline reaction (RN port of the web ScreenPots). */}
      <MeloReaction
        channel="pots-inline"
        anchor="under-row"
        matchKey={pot.id}
        style={styles.reaction}
      />
    </View>
  );
}

// ── Progress bar ───────────────────────────────────────────────────────────────────────────────
// A token-painted track + an animated fill (width tween). Snaps to final width under reduce-motion.
function ProgressBar({
  pct,
  trackColor,
  fillColor,
  fillOpacity = 1,
  height,
  durationMs,
  reduceMotion,
}: {
  pct: number;
  trackColor: string;
  fillColor: string;
  fillOpacity?: number;
  height: number;
  durationMs: number;
  reduceMotion: boolean;
}) {
  const progress = useSharedValue(reduceMotion ? pct : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = pct;
      return;
    }
    progress.value = withTiming(pct, { duration: durationMs, easing: EASE_OUT_EXPO });
  }, [pct, durationMs, reduceMotion, progress]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));
  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }]}>
      <Animated.View
        style={[styles.fill, { backgroundColor: fillColor, opacity: fillOpacity }, fillStyle]}
      />
    </View>
  );
}

// ── Reallocate sheet ───────────────────────────────────────────────────────────────────────────
// The screen-owned bottom sheet: "Reallocate" kicker · "{from} → {to}" · the amount well (big
// terracotta figure + a −£5/+£5 stepper) · the impact row (rough lowest-balance preview + destination
// gain) · Cancel / Move £n.
function ReallocateSheet({
  visible,
  fromPot,
  toPot,
  maxMove,
  clamped,
  amount,
  tightPointBase,
  tightDelta,
  reduceMotion,
  t,
  s,
  onStep,
  onCancel,
  onMove,
}: {
  visible: boolean;
  fromPot: Pot | null;
  toPot: Pot | null;
  maxMove: number;
  clamped: number;
  amount: number;
  tightPointBase: number;
  tightDelta: number;
  reduceMotion: boolean;
  t: Palette;
  s: ReturnType<typeof makeStyles>;
  onStep: (next: number) => void;
  onCancel: () => void;
  onMove: () => void;
}) {
  const canStepDown = clamped >= MOVE_STEP;
  const canStepUp = clamped + MOVE_STEP <= maxMove;
  const canMove = clamped > 0;
  const deltaSign = tightDelta > 0 ? '+' : '';

  return (
    <Sheet visible={visible} onClose={onCancel} reduceMotion={reduceMotion}>
      {fromPot && toPot ? (
        <>
          <Text style={[styles.sheetKicker, { color: t.muted }]}>Reallocate</Text>
          <Text accessibilityRole="header" style={[styles.sheetTitle, { color: t.ink }]}>
            {`${shortName(fromPot.name)} → ${shortName(toPot.name)}`}
          </Text>

          {/* Amount well — the big terracotta figure + a calm −£5 / +£5 stepper (the web's slider). */}
          <View style={[styles.amountWell, { backgroundColor: t.inset }]}>
            <View style={styles.amountWellHead}>
              <Text style={[styles.amountWellLabel, { color: t.muted }]}>Amount</Text>
              <Text style={[styles.amountWellMax, { color: t.muted }]}>{`max £${maxMove}`}</Text>
            </View>
            <Text style={[styles.amountValue, { color: t.calmStrong }]}>{`£${clamped}`}</Text>
            <View style={styles.stepperRow}>
              <StepButton
                label="−£5"
                disabled={!canStepDown}
                t={t}
                onPress={() => onStep(amount - MOVE_STEP)}
              />
              <StepButton
                label="+£5"
                disabled={!canStepUp}
                t={t}
                onPress={() => onStep(amount + MOVE_STEP)}
              />
            </View>
          </View>

          {/* Impact row — the rough lowest-balance preview (left) + the destination gain (right). */}
          <View style={[styles.impact, { backgroundColor: t.surface, borderColor: t.hairline }]}>
            <View>
              <Text style={[styles.impactLabel, { color: t.muted }]}>Lowest balance</Text>
              <Text style={[styles.impactValue, { color: t.ink }]}>
                {`£${tightPointBase}`}
                {tightDelta !== 0 ? (
                  <Text
                    style={[styles.impactDelta, { color: tightDelta > 0 ? t.positive : t.repair }]}
                  >
                    {` ${deltaSign}£${tightDelta}`}
                  </Text>
                ) : null}
              </Text>
            </View>
            <View style={styles.impactRight}>
              <Text style={[styles.impactLabel, { color: t.muted }]}>{shortName(toPot.name)}</Text>
              <Text style={[styles.impactValue, { color: t.ink }]}>
                {`£${toPot.saved} `}
                <Text style={[styles.impactDelta, { color: t.positive }]}>{`+£${clamped}`}</Text>
              </Text>
            </View>
          </View>

          {/* Cancel / Move £n. */}
          <View style={styles.sheetActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onCancel}
              style={({ pressed: isPressed }) => [
                styles.sheetCancel,
                { backgroundColor: t.inset },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.sheetCancelLabel, { color: t.ink }]}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Move £${clamped}`}
              accessibilityState={{ disabled: !canMove }}
              disabled={!canMove}
              onPress={onMove}
              style={({ pressed: isPressed }) => [
                styles.sheetMove,
                { backgroundColor: canMove ? t.calm : t.sunken },
                isPressed && canMove ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.sheetMoveLabel, { color: canMove ? t.inverse : t.muted }]}>
                {`Move £${clamped}`}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

// ── Open-pot sheet ─────────────────────────────────────────────────────────────────────────────
// A direct, local-first creator. The previous CTA opened the payday-closing ritual, which had no
// pot-creation controls at all; keeping this inside Pots makes the promise and the action agree.
function OpenPotSheet({
  visible,
  name,
  goal,
  weekly,
  reduceMotion,
  t,
  onNameChange,
  onGoalChange,
  onWeeklyChange,
  onCancel,
  onCreate,
}: {
  visible: boolean;
  name: string;
  goal: string;
  weekly: string;
  reduceMotion: boolean;
  t: Palette;
  onNameChange: (value: string) => void;
  onGoalChange: (value: string) => void;
  onWeeklyChange: (value: string) => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  const parsedGoal = Number(goal.replace(/[^0-9.]/g, ''));
  const canCreate = name.trim().length > 0 && Number.isFinite(parsedGoal) && parsedGoal > 0;

  return (
    <Sheet visible={visible} onClose={onCancel} reduceMotion={reduceMotion}>
      <Text style={[styles.sheetKicker, { color: t.muted }]}>One thing to set aside for</Text>
      <Text accessibilityRole="header" style={[styles.sheetTitle, { color: t.ink }]}>
        Open a pot
      </Text>
      <Text style={[styles.creatorBody, { color: t.muted }]}>
        Start at £0. You can add money or change the pace whenever you like.
      </Text>

      <Text style={[styles.creatorLabel, { color: t.muted }]}>Name</Text>
      <TextInput
        accessibilityLabel="Pot name"
        autoCapitalize="words"
        onChangeText={onNameChange}
        placeholder="e.g. Emergency buffer"
        placeholderTextColor={t.muted}
        style={[styles.creatorInput, { backgroundColor: t.inset, color: t.ink }]}
        value={name}
      />

      <View style={styles.creatorNumbersRow}>
        <View style={styles.creatorNumberField}>
          <Text style={[styles.creatorLabel, { color: t.muted }]}>Goal</Text>
          <TextInput
            accessibilityLabel="Pot goal"
            keyboardType="decimal-pad"
            onChangeText={onGoalChange}
            placeholder="£500"
            placeholderTextColor={t.muted}
            style={[styles.creatorInput, { backgroundColor: t.inset, color: t.ink }]}
            value={goal}
          />
        </View>
        <View style={styles.creatorNumberField}>
          <Text style={[styles.creatorLabel, { color: t.muted }]}>Each week</Text>
          <TextInput
            accessibilityLabel="Weekly pot amount"
            keyboardType="decimal-pad"
            onChangeText={onWeeklyChange}
            placeholder="£20 · optional"
            placeholderTextColor={t.muted}
            style={[styles.creatorInput, { backgroundColor: t.inset, color: t.ink }]}
            value={weekly}
          />
        </View>
      </View>

      <View style={styles.sheetActions}>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed: isPressed }) => [
            styles.sheetCancel,
            { borderColor: t.hairline },
            isPressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.sheetCancelLabel, { color: t.ink }]}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canCreate }}
          disabled={!canCreate}
          onPress={onCreate}
          style={({ pressed: isPressed }) => [
            styles.sheetMove,
            { backgroundColor: canCreate ? t.calm : t.inset },
            isPressed && canCreate ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.sheetMoveLabel, { color: canCreate ? t.inverse : t.muted }]}>
            Open pot
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

function StepButton({
  label,
  disabled,
  t,
  onPress,
}: {
  label: string;
  disabled: boolean;
  t: Palette;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.step,
        { backgroundColor: t.surface, borderColor: t.hairline },
        disabled ? { opacity: 0.45 } : undefined,
        isPressed && !disabled ? styles.pressed : undefined,
      ]}
    >
      <Text style={[styles.stepLabel, { color: disabled ? t.muted : t.ink }]}>{label}</Text>
    </Pressable>
  );
}

// ── Glyphs ─────────────────────────────────────────────────────────────────────────────────────
// Grip — the web '⋮⋮' drag-handle glyph, kept as the move affordance's visual cue. 14×16, two columns
// of three dots.
function GripGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={16} viewBox="0 0 14 16">
      <Path
        d="M5 4 h0.01 M5 8 h0.01 M5 12 h0.01 M9 4 h0.01 M9 8 h0.01 M9 12 h0.01"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // The empty / error frame — px-7 (gap.xl) full-height column.
  frame: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // px-7 ≈ screen inset → gap.xl. flexGrow:1 lets short content sit and tall content scroll.
  content: {
    flexGrow: 1,
    paddingHorizontal: gap.xl,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // Intro frame — mt-5 (gap.lg).
  intro: {
    marginTop: gap.lg,
  },
  // Fraunces italic kicker, 13px muted.
  kicker: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  // Fraunces display line, 28px, tight, mt-1.
  heading: {
    fontFamily: serif.display,
    fontSize: 28,
    lineHeight: 30,
    marginTop: gap.xs,
  },
  // The accent word stays UPRIGHT terracotta (web em.not-italic).
  headingAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // The move subhead, 11.5px muted, mt-1.5.
  subhead: {
    fontSize: 11.5,
    marginTop: gap.xs + gap.xxs,
  },
  emptyWrap: {
    flex: 1,
    marginTop: gap.xl,
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: gap.xl,
  },
  retry: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 52,
    justifyContent: 'center',
  },
  retryLabel: {
    fontSize: 15,
    fontWeight: '500',
  },

  // Across-pots aggregate card — surface, 2xl radius, p-5 (gap.lg), mt-4.
  aggCard: {
    borderRadius: radius.xl,
    marginTop: gap.lg,
    padding: gap.lg,
  },
  // 11px uppercase tracked muted.
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  // The figure row — big tabular total + a smaller of-goal, baseline aligned, mt-1.
  aggFigureRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: gap.sm,
    marginTop: gap.xs,
  },
  aggFigure: {
    fontFamily: serif.display,
    fontSize: 40,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  aggOf: {
    fontFamily: serif.display,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },

  // The pot list — space-y-3 (gap.md), mt-4.
  potList: {
    gap: gap.md,
    marginTop: gap.lg,
  },
  // Pot card — surface, 2xl radius, px-5 py-4.
  potCard: {
    borderRadius: radius.xl,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  potHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  potNameRow: {
    alignItems: 'center',
    columnGap: gap.sm,
    flexDirection: 'row',
    flexShrink: 1,
  },
  potName: {
    fontSize: 14.5,
    fontWeight: '500',
  },
  potFigure: {
    fontFamily: serif.display,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  potFigureGoal: {
    fontSize: 12,
  },

  // Pace row — mt-2.
  paceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: gap.sm,
  },
  paceText: {
    fontSize: 11.5,
  },
  paceEta: {
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
  },

  // Action row — the quick-add chips + the Move affordance, mt-2.5.
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: gap.sm + gap.xxs,
  },
  quickAddRow: {
    alignItems: 'center',
    columnGap: gap.xs + gap.xxs,
    flexDirection: 'row',
  },
  // Quick-add chip — h-7, rounded-full, inset fill, ≥44px tap via hitSlop.
  chip: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 28,
    justifyContent: 'center',
    minWidth: 44,
    paddingHorizontal: 10,
  },
  chipLabel: {
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
  },
  // Move chip — a quiet hairline pill that fills accent-soft when its picker is open.
  moveChip: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 28,
    justifyContent: 'center',
    minWidth: 44,
    paddingHorizontal: 12,
  },
  moveChipLabel: {
    fontSize: 11.5,
    fontWeight: '500',
  },

  // Repay affordance — full-width accent-soft pill, mt-2 (web col-span-3 min-h-[44px]).
  repayChip: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    marginTop: gap.sm,
    minHeight: 44,
    paddingHorizontal: gap.md,
  },
  repayChipLabel: {
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
  },
  // The owed caption under the repay chip, mt-1.5.
  owedCaption: {
    fontSize: 11,
    marginTop: gap.xs + gap.xxs,
  },

  // "Can go briefly negative" row — inset well, rounded-xl, px-3 py-2, mt-3.
  allowNegRow: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: gap.md,
    paddingHorizontal: gap.sm + gap.xxs,
    paddingVertical: gap.xs + gap.xxs,
  },
  allowNegLabel: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 15,
  },
  // The switch track — w-9 h-5 rounded-full (web).
  toggleTrack: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 20,
    justifyContent: 'center',
    padding: 2,
    width: 36,
  },
  toggleThumb: {
    borderRadius: radius.pill,
    height: 16,
    width: 16,
  },
  toggleThumbOn: {
    transform: [{ translateX: 16 }],
  },

  // The destination picker — a hairline-topped well of the other pots' names, mt-3 pt-3.
  destWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: gap.md,
    paddingTop: gap.md,
  },
  destLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  destRow: {
    columnGap: gap.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: gap.sm,
    rowGap: gap.sm,
  },
  destChip: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: gap.md,
    paddingVertical: 6,
  },
  destChipLabel: {
    fontSize: 12.5,
    fontWeight: '500',
  },

  // The inline Melo reaction — web mt-2.
  reaction: {
    marginTop: gap.sm,
  },

  // Progress bars — rounded-full track + fill (width animated).
  track: {
    borderRadius: radius.pill,
    marginTop: gap.md,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: radius.pill,
    height: '100%',
  },

  // Open-a-pot CTA — full width, h-[52px], 2xl radius, terracotta fill, mt-5.
  openCta: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 52,
    justifyContent: 'center',
    marginTop: gap.lg,
  },
  openCtaLabel: {
    fontSize: 15,
    fontWeight: '500',
  },

  // The closing Melo line — mt-5 mb-8.
  meloBlock: {
    marginBottom: gap.xxl,
    marginTop: gap.lg,
  },

  // ── Reallocate sheet ──
  sheetKicker: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  sheetTitle: {
    fontFamily: serif.display,
    fontSize: 22,
    lineHeight: 26,
    marginTop: gap.xxs,
  },
  creatorBody: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: gap.sm,
  },
  creatorLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: gap.xs,
    marginTop: gap.lg,
    textTransform: 'uppercase',
  },
  creatorInput: {
    borderRadius: radius.lg,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm,
  },
  creatorNumbersRow: {
    flexDirection: 'row',
    gap: gap.md,
  },
  creatorNumberField: {
    flex: 1,
  },
  // Amount well — inset, 2xl radius, p-5, mt-5.
  amountWell: {
    borderRadius: radius.xl,
    marginTop: gap.lg,
    padding: gap.lg,
  },
  amountWellHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amountWellLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  amountWellMax: {
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  // The big terracotta figure, Fraunces 44px tabular, mt-1.
  amountValue: {
    fontFamily: serif.display,
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginTop: gap.xs,
  },
  stepperRow: {
    columnGap: gap.md,
    flexDirection: 'row',
    marginTop: gap.md,
  },
  step: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },

  // Impact row — surface, hairline, rounded-xl, px-4 py-3, mt-4.
  impact: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: gap.lg,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  impactRight: {
    alignItems: 'flex-end',
  },
  impactLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  impactValue: {
    fontFamily: serif.display,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    marginTop: gap.xxs,
  },
  impactDelta: {
    fontFamily: serif.display,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },

  // Sheet actions — grid-cols-2 gap-2.5, mt-5.
  sheetActions: {
    columnGap: gap.md - gap.xxs,
    flexDirection: 'row',
    marginTop: gap.lg,
  },
  sheetCancel: {
    alignItems: 'center',
    borderRadius: radius.xl,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  sheetCancelLabel: {
    fontSize: 14,
  },
  sheetMove: {
    alignItems: 'center',
    borderRadius: radius.xl,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  sheetMoveLabel: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },

  // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});

// makeStyles — this screen paints every colour inline from the active palette `t` (mirroring
// ReviewScreen), so the colour factory carries no styles today. Kept as the typed handle the card +
// sheet sub-components receive (so a future colour-bearing style has one home), per the kit's
// DARK-MODE PATTERN.
function makeStyles(_t: Palette) {
  return StyleSheet.create({});
}
