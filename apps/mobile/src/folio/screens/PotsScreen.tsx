// Set-aside pots retain their local contributions, borrowing and reallocation behavior.
// Every spending estimate uses the canonical financial plan; pot progress describes recorded funds.

import { useEffect, useMemo, useState } from 'react';
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
  type Pot,
} from '@/folio/store';
import { buildFinancialPlanFromState } from '@/folio/lib/financialPlan';
import { formatMoney } from '@/folio/lib/financialPresentation';
import { useDayClock } from '@/folio/lib/useDayClock';
import {
  previewPotReallocation,
  selectPotProgress,
  selectPotsPresentation,
} from '@/folio/lib/potsPresentation';
import type { Nav, Pressure } from '@/folio/types';
import { triggerFeedback } from '@/folio/lib/feedback';
import { summarisePotLedger } from '@/folio/screens/commitmentHelpers';

// The render states this screen can occupy (spec stateBranches). Pots are local + synchronous, so
// loading/error are defensive: loading shows Melo curious + a line (never a spinner), error shows an
// inline retry, offline ≡ populated (local-first, no network language).
export type PotsState = 'populated' | 'empty' | 'loading' | 'error' | 'offline';

export type PotsScreenProps = {
  nav: Nav;
  /** Kept for shell compatibility; displayed money comes from the canonical financial plan. */
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

export function PotsScreen({ nav, state }: PotsScreenProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // Real store reads (spec: data is REAL). onboarding / currentBalance / potLedger are read so the
  // screen is honestly bound to the same state the rest of the app mutates, even where this surface
  // only surfaces `pots` directly today.
  const pots = useAppStore((st) => st.pots);
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

  const now = useDayClock();
  const plan = useMemo(
    () => (now ? buildFinancialPlanFromState(appState, { now }) : null),
    [appState, now],
  );
  const money = selectPotsPresentation(appState, plan);

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
  const ledgerSummary = useMemo(
    () => summarisePotLedger(potLedger, new Set(pots.map((pot) => pot.id))),
    [potLedger, pots],
  );

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

  // Reallocation preview changes only a copy of the pot allocations, using the same plan as Today.
  const impact = useMemo(() => {
    if (!now || !transfer || !fromPot || !toPot) return null;
    return previewPotReallocation(appState, transfer.from, transfer.to, clamped, now);
  }, [now, transfer, fromPot, toPot, clamped, appState]);
  const impactLabel = impact?.model.label ?? money.label;
  const impactValue = impact?.model.safe ?? null;
  const impactMessage = impact?.model.message ?? money.message;
  const tightDelta = impact?.delta ?? 0;

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
              <Text style={[styles.retryLabel, { color: t.inverse }]}>Try again</Text>
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
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
              style={[styles.aggFigure, { color: t.ink }]}
            >
              {formatMoney(totalDisplay)}
            </Text>
            <Text style={[styles.aggOf, { color: t.muted }]}>{`of ${formatMoney(totalGoal)}`}</Text>
          </View>
          <ProgressBar
            pct={pctOf(total, totalGoal)}
            trackColor={t.inset}
            fillColor={t.ink}
            height={6}
            durationMs={AGG_TWEEN_MS}
            reduceMotion={reduceMotion}
          />
          <View style={[styles.availableRow, { borderTopColor: t.hairline }]}>
            <Text style={[styles.availableLabel, { color: t.muted }]}>{money.label}</Text>
            <Text
              style={[
                styles.availableValue,
                { color: money.safe !== null && money.safe < 0 ? t.repair : t.ink },
              ]}
            >
              {money.safe === null ? '—' : formatMoney(money.safe)}
            </Text>
            <Text style={[styles.availableHint, { color: t.muted }]}>{money.message}</Text>
          </View>
          <View style={[styles.ledgerRow, { borderTopColor: t.hairline }]}>
            <View style={styles.availableCopy}>
              <Text style={[styles.availableLabel, { color: t.muted }]}>Cash outside pots</Text>
              <Text style={[styles.availableHint, { color: t.muted }]}>
                Before bills, essentials and buffer
              </Text>
            </View>
            <Text style={[styles.ledgerValue, { color: t.muted }]}>
              {money.cashOutsidePots === null ? '—' : formatMoney(money.cashOutsidePots)}
            </Text>
          </View>
          <View style={[styles.ledgerRow, { borderTopColor: t.hairline }]}>
            <View style={styles.availableCopy}>
              <Text style={[styles.availableLabel, { color: t.muted }]}>Pot history</Text>
              <Text style={[styles.availableHint, { color: t.muted }]}>
                contributions · borrowing · repayments
              </Text>
            </View>
            <Text style={[styles.ledgerValue, { color: t.ink }]}>
              {ledgerSummary.contributed > 0
                ? `+${formatMoney(ledgerSummary.contributed)}`
                : 'No deposits yet'}
            </Text>
          </View>
          {ledgerSummary.contributed > 0 ||
          ledgerSummary.borrowed > 0 ||
          ledgerSummary.repaid > 0 ? (
            <Text style={[styles.ledgerDetail, { color: t.muted }]}>
              {`Contributed ${formatMoney(ledgerSummary.contributed)} · borrowed ${formatMoney(ledgerSummary.borrowed)} · repaid ${formatMoney(ledgerSummary.repaid)} · cash outside pots effect ${formatMoney(ledgerSummary.availableEffect)}`}
            </Text>
          ) : null}
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
          <Text style={[styles.openCtaLabel, { color: t.inverse }]}>+ Open a pot</Text>
        </Pressable>

        {/* The closing Melo line — web mood 'soft' → calm on the canonical vocabulary. */}
        <View style={styles.meloBlock}>
          <MeloLine
            mood={money.presentation.canReassure ? 'calm' : 'concern'}
            text={
              money.presentation.canReassure
                ? 'Pot contributions reserve money for your goals. Keep recorded costs and your buffer covered.'
                : money.message
            }
          />
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
        impactLabel={impactLabel}
        impactValue={impactValue}
        impactMessage={impactMessage}
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
  const progress = selectPotProgress(pot);
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
          {`${formatMoney(pot.saved)} `}
          <Text
            style={[styles.potFigureGoal, { color: t.muted }]}
          >{`/ ${formatMoney(pot.goal)}`}</Text>
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
        <Text style={[styles.paceText, { color: t.muted }]}>{progress.paceLabel}</Text>
        <Text style={[styles.paceEta, { color: t.muted }]}>{progress.etaLabel}</Text>
      </View>

      <Text style={[styles.owedCaption, { color: t.muted }]}>
        Record money set aside. No bank transfer is made.
      </Text>
      <View style={styles.actionRow}>
        <View style={styles.quickAddRow}>
          {QUICK_ADD.map((inc) => (
            <Pressable
              key={inc}
              accessibilityRole="button"
              accessibilityLabel={`Record ${formatMoney(inc)} set aside for ${pot.name}`}
              onPress={() => onQuickAdd(inc)}
              style={({ pressed: isPressed }) => [
                styles.chip,
                { backgroundColor: t.inset },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.chipLabel, { color: t.ink }]}>{`+${formatMoney(inc)}`}</Text>
            </Pressable>
          ))}
        </View>
        {canMove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Move money from ${pot.name}`}
            accessibilityState={{ expanded: moveOpen }}
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
          accessibilityLabel={`Record ${formatMoney(repayAmount)} repaid to ${pot.name}`}
          onPress={() => onRepay(repayAmount)}
          style={({ pressed: isPressed }) => [
            styles.repayChip,
            { backgroundColor: t.calmSoft },
            isPressed ? styles.pressed : undefined,
          ]}
        >
          <Text
            style={[styles.repayChipLabel, { color: t.calm }]}
          >{`Record ${formatMoney(repayAmount)} repaid`}</Text>
        </Pressable>
      ) : null}
      {owed > 0 ? (
        <Text style={[styles.owedCaption, { color: t.muted }]}>
          {`${formatMoney(owed)} recorded as borrowed. Recording repayment clears the amount owed; it does not move cash or add to the pot.`}
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
// terracotta figure + a −£5/+£5 stepper) · the impact row (canonical protected spending amount + destination
// gain) · Cancel / Move £n.
function ReallocateSheet({
  visible,
  fromPot,
  toPot,
  maxMove,
  clamped,
  amount,
  impactLabel,
  impactValue,
  impactMessage,
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
  impactLabel: string;
  impactValue: number | null;
  impactMessage: string;
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
              <Text
                style={[styles.amountWellMax, { color: t.muted }]}
              >{`max ${formatMoney(maxMove)}`}</Text>
            </View>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
              style={[styles.amountValue, { color: t.calm }]}
            >
              {formatMoney(clamped)}
            </Text>
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

          {/* Current protected amount after this move, followed by the destination allocation. */}
          <View style={[styles.impact, { backgroundColor: t.surface, borderColor: t.hairline }]}>
            <View>
              <Text style={[styles.impactLabel, { color: t.muted }]}>{impactLabel}</Text>
              <Text style={[styles.impactValue, { color: t.ink }]}>
                {impactValue === null ? '—' : formatMoney(impactValue)}
                {tightDelta !== 0 ? (
                  <Text
                    style={[styles.impactDelta, { color: tightDelta > 0 ? t.positive : t.repair }]}
                  >
                    {` (${deltaSign}${formatMoney(tightDelta)} change)`}
                  </Text>
                ) : null}
              </Text>
            </View>
            <View style={styles.impactRight}>
              <Text style={[styles.impactLabel, { color: t.muted }]}>{shortName(toPot.name)}</Text>
              <Text style={[styles.impactValue, { color: t.ink }]}>
                {`${formatMoney(toPot.saved)} `}
                <Text
                  style={[styles.impactDelta, { color: t.positive }]}
                >{`+${formatMoney(clamped)}`}</Text>
              </Text>
            </View>
          </View>

          <Text style={[styles.creatorBody, { color: t.muted }]}>{impactMessage}</Text>
          <Text style={[styles.creatorBody, { color: t.muted }]}>
            This moves set-aside amounts between your pots in Melo. Tracked cash stays the same; no
            bank transfer is made.
          </Text>

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
              accessibilityLabel={`Move ${formatMoney(clamped)}`}
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
                {`Move ${formatMoney(clamped)}`}
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
    minHeight: 52,
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
    flexWrap: 'wrap',
    gap: gap.sm,
    marginTop: gap.xs,
  },
  aggFigure: {
    maxWidth: '100%',
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
  availableRow: {
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: gap.sm,
    marginTop: gap.md,
    paddingTop: gap.sm,
  },
  availableCopy: {
    flexGrow: 1,
    flexBasis: 150,
    gap: 2,
  },
  availableLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
  },
  availableHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  availableValue: {
    fontFamily: serif.display,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
  ledgerRow: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: gap.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: gap.sm,
    paddingTop: gap.sm,
  },
  ledgerValue: {
    flexShrink: 1,
    maxWidth: '100%',
    fontFamily: serif.display,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  ledgerDetail: {
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: gap.xs,
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
    alignItems: 'flex-start',
    gap: gap.xs,
  },
  potNameRow: {
    alignItems: 'center',
    columnGap: gap.sm,
    flexDirection: 'row',
    flexShrink: 1,
  },
  potName: {
    flexShrink: 1,
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
    alignItems: 'flex-start',
    gap: gap.xs,
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
    flexWrap: 'wrap',
    gap: gap.sm,
    justifyContent: 'space-between',
    marginTop: gap.sm + gap.xxs,
  },
  quickAddRow: {
    alignItems: 'center',
    gap: gap.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // Contribution chips have real 48dp touch bounds and wrap without overlapping their neighbours.
  chip: {
    alignItems: 'center',
    borderRadius: radius.pill,
    minHeight: 48,
    justifyContent: 'center',
    minWidth: 64,
    paddingHorizontal: 10,
  },
  chipLabel: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  // Move chip — a quiet hairline pill that fills accent-soft when its picker is open.
  moveChip: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
    justifyContent: 'center',
    minWidth: 64,
    paddingHorizontal: 12,
  },
  moveChipLabel: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Recorded-repayment affordance, with the same 48dp minimum as contributions.
  repayChip: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    marginTop: gap.sm,
    minHeight: 48,
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
    minHeight: 48,
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
    minHeight: 48,
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
    minHeight: 52,
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
    flexWrap: 'wrap',
    gap: gap.md,
  },
  creatorNumberField: {
    flexGrow: 1,
    flexBasis: 140,
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
    flexWrap: 'wrap',
    gap: gap.sm,
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
    maxWidth: '100%',
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
    minHeight: 48,
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },

  // Impact row — surface, hairline, rounded-xl, px-4 py-3, mt-4.
  impact: {
    alignItems: 'flex-start',
    gap: gap.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'column',
    marginTop: gap.lg,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  impactRight: {
    alignItems: 'flex-start',
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
    gap: gap.md - gap.xxs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: gap.lg,
  },
  sheetCancel: {
    alignItems: 'center',
    borderRadius: radius.xl,
    flexGrow: 1,
    flexBasis: 110,
    minHeight: 50,
    justifyContent: 'center',
  },
  sheetCancelLabel: {
    fontSize: 14,
  },
  sheetMove: {
    alignItems: 'center',
    borderRadius: radius.xl,
    flexGrow: 1,
    flexBasis: 110,
    minHeight: 50,
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
