// The Glance Stack (MELO_BLUEPRINT.md §6.1) — Melo's home, in two modes:
//   LIVE — the user's own setup: deriveLive() → resolveState() with the PERSISTED state record
//   (hysteresis and the recovery journey survive restarts), balance updates feed the loop.
//   DEMO — the six ⚙-chip scenarios, for dogfooding every state without faking your finances.
// Either way the engine drives everything on screen: sky, mascot, copy, action, verdicts.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  COPY,
  buildWeekReview,
  checkAfford,
  daysBetween,
  detectWins,
  formatPounds,
  pickSmartMove,
  resolveState,
  type AffordResult,
  type CopyContext,
  type CopyKey,
  type StateView,
  type WinSnapshot,
} from '@folio/melo-engine';
import {
  Body,
  Eyebrow,
  GhostButton,
  HeroMoney,
  Muted,
  PrimaryAction,
  Surface,
  Verdict,
  useTheme,
  type VerdictTone,
} from '@/surfaces/pressureMap/kit';

import { MeloMascot } from '../mascot/MeloMascot';
import { RunwayStrip, type RunwayBill } from '../components/RunwayStrip';
import { WeatherSky } from '../components/WeatherSky';
import { breatheFor, glowFor, WEATHER_VISUALS } from '../theme/weather';
import { deriveLive } from '../state/derive';
import { useMeloStore } from '../state/meloStore';
import { DEMOS, DEMO_ORDER, DEMO_TODAY, demoBreakdown, type DemoKey } from '../state/demoStates';
import { RecoveryWalkthrough } from './RecoveryWalkthrough';
import { MeloRitual, type RitualBillRow } from './MeloRitual';
import { MeloSettings } from './MeloSettings';
import { BillsShield } from './BillsShield';
import { MeloReview } from './MeloReview';
import { MeloImport } from './MeloImport';
import { MeloChat } from './MeloChat';

const SKY_HEIGHT = 200;

type Mode = 'live' | DemoKey;

type Ask = { amountPence: number; result: AffordResult | null; fog: boolean; shelved: boolean };

type GlanceAction = {
  title: string;
  body: string;
  cta: string;
  kind: 'recovery' | 'balance' | 'info' | 'ritual' | 'review';
};

interface GlanceModel {
  view: StateView;
  ctx: CopyContext;
  szPence: number;
  sub: string;
  l2: string;
  chipWord: string;
  daysToPayday: number;
  bills: readonly RunwayBill[];
  dangerDay: number | null;
  action: GlanceAction | null;
  mathRows: readonly { label: string; valuePence: number }[];
}

const LIVE_L2: Partial<Record<CopyKey, string>> = {
  calm: 'I’ll speak up if that changes.',
  protected: 'The important things are safe.',
  tight: 'Doable, needs a little steering.',
  warning: 'The way out is small and daily.',
  danger: 'Bills are safe — this is about getting to payday.',
  overspent: 'No lecture in any of it.',
  recovery: 'Bills stay protected while we rebuild.',
  rebuilding: 'The storm’s over. Small steps now.',
  fog: '30 seconds fixes it.',
  billWeek: 'All shielded before anything else gets spent.',
};

export function MeloGlance({
  onSetUp,
  onExitToFolio,
}: {
  onSetUp?: (() => void) | undefined;
  onExitToFolio?: (() => void) | undefined;
} = {}) {
  const t = useTheme();
  const store = useMeloStore();
  const isLive = store.state.setup.onboarded;

  const [mode, setMode] = useState<Mode>(isLive ? 'live' : 'calm');
  const [devOpen, setDevOpen] = useState(false);
  const [showMath, setShowMath] = useState(false);
  const [askText, setAskText] = useState('');
  const [ask, setAsk] = useState<Ask | null>(null);
  const [demoChecks, setDemoChecks] = useState(3);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [ritualOpen, setRitualOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shieldOpen, setShieldOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [balanceEdit, setBalanceEdit] = useState(false);
  const [balanceText, setBalanceText] = useState('');
  const [spendEdit, setSpendEdit] = useState(false);
  const [spendText, setSpendText] = useState('');
  const [lastWinLine, setLastWinLine] = useState<string | null>(null);
  const [recoveryDeclinedToday, setRecoveryDeclinedToday] = useState(false);

  // The derivation clock: re-derive on app foreground so "today" is never yesterday (audit:
  // the memo was keyed only on store state, freezing the date at the last write).
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setClockTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  // ---- live derivation (engine + persisted record) ----
  const liveDerived = useMemo(
    () => (isLive ? deriveLive(store.state, new Date()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clockTick forces re-derivation on foreground
    [isLive, store.state, clockTick],
  );
  // Welcome-back must survive the session: markOpened rewrites lastOpenedISO on the same
  // open that detected the absence, which would extinguish the overlay after one frame
  // (audit catch) — the ref pins it for the rest of the session.
  const wasAwayRef = useRef(false);
  if (liveDerived?.inputs.returnedAfterAbsence) wasAwayRef.current = true;
  const liveResolved = useMemo(
    () =>
      liveDerived
        ? resolveState(
            store.state.journey.record,
            wasAwayRef.current
              ? { ...liveDerived.inputs, returnedAfterAbsence: true }
              : liveDerived.inputs,
            liveDerived.today,
          )
        : null,
    [liveDerived, store.state.journey.record],
  );

  // Persist the engine's sticky record whenever it moves (dwell + journey survive restarts).
  const lastRecordJson = useRef<string>('');
  useEffect(() => {
    if (mode !== 'live' || !liveResolved) return;
    const json = JSON.stringify(liveResolved.record);
    if (json !== lastRecordJson.current && json !== JSON.stringify(store.state.journey.record)) {
      lastRecordJson.current = json;
      store.setStateRecord(liveResolved.record);
    }
  }, [mode, liveResolved, store]);

  // Tiny wins (§2 P10): noticed, never claimed. The persisted record is the "prev" side of the
  // diff, so ladder/journey transitions (storm passed, recovery completed) fire exactly once.
  useEffect(() => {
    if (mode !== 'live' || !liveResolved || !liveDerived) return;
    const prevRecord = store.state.journey.record;
    const nextSnap: WinSnapshot = {
      onboarded: store.state.setup.onboarded,
      checksThisWeek: store.state.checksThisWeek,
      ritualDone: store.state.lastRitualISO !== null,
      spendCount: store.state.spendLog.length,
      ladder: liveResolved.view.ladder,
      journey: liveResolved.view.journey,
      safeZonePence: liveDerived.safeZone.safeZonePence,
    };
    const prevSnap: WinSnapshot | null = prevRecord
      ? { ...nextSnap, ladder: prevRecord.ladder, journey: prevRecord.journey }
      : null;
    const events = detectWins(prevSnap, nextSnap, store.state.wins);
    if (events.length > 0) {
      store.recordWins(
        events.map((e) => e.id),
        liveDerived.today,
      );
      setLastWinLine(events[events.length - 1]?.line ?? null);
    }
  }, [mode, liveResolved, liveDerived, store]);

  // ---- lifecycle bookkeeping: the data that feeds the resurrected states ----
  // Absence tracking + the once-a-day end-of-day snapshot (tomorrow's honest "yesterday").
  useEffect(() => {
    if (mode !== 'live' || !liveDerived) return;
    store.markOpened(liveDerived.today, liveDerived.safeZone.safeZonePence);
  }, [mode, liveDerived, store]);

  // Cycle rollover: first open of a new cycle closes the previous one, using the LAST
  // pre-rollover snapshot (post-payday balances would bias every closed cycle positive).
  useEffect(() => {
    if (mode !== 'live' || !liveDerived) return;
    const { cycleStart } = liveDerived;
    const seen = store.state.lastSeen;
    if (store.state.lastCycleClosedISO === cycleStart) return;
    if (!seen || seen.atISO >= cycleStart) return; // nothing honest to close with yet
    store.closeCycle({
      endedISO: cycleStart,
      endedPositive: seen.szPence >= 0,
      closingSafeZonePence: seen.szPence,
    });
  }, [mode, liveDerived, store]);

  // Recovery graduation timestamp — feeds daysSinceRecoveryEnd / rebuilding copy.
  const prevJourneyRef = useRef<string | null>(null);
  useEffect(() => {
    if (mode !== 'live' || !liveResolved || !liveDerived) return;
    const j = liveResolved.view.journey;
    if (prevJourneyRef.current === 'recovery' && j !== 'recovery') {
      store.setRecoveryEnded(liveDerived.today);
    }
    prevJourneyRef.current = j;
  }, [mode, liveResolved, liveDerived, store]);

  // Milestones: celebrate once, record forever (the ladder never re-fires).
  useEffect(() => {
    if (mode !== 'live' || !liveDerived) return;
    if (liveDerived.newMilestoneIds.length === 0) return;
    store.recordMilestones(liveDerived.newMilestoneIds);
    const line = liveDerived.milestoneLines[liveDerived.milestoneLines.length - 1];
    if (line) setLastWinLine(line);
  }, [mode, liveDerived, store]);

  // ---- model ----
  const model: GlanceModel = useMemo(() => {
    if (mode === 'live' && liveDerived && liveResolved) {
      const view = liveResolved.view;
      const billsCovered = liveDerived.billsCovered;
      const visual = WEATHER_VISUALS[view.weather];
      const chipSuffix =
        view.data === 'fog'
          ? ' — numbers stale'
          : (view.ladder === 'danger' || view.ladder === 'overspent') && billsCovered
            ? ' — bills are safe'
            : '';
      const ritualDue =
        view.overlays.includes('payday') && store.state.lastRitualISO !== liveDerived.today;
      // The weekly-review nudge earns its slot once a week, and only when there is actually a
      // week to show (a check or a logged spend) — never a card pointing at an empty room.
      const reviewDue =
        (store.state.lastReviewISO === null ||
          daysBetween(store.state.lastReviewISO, liveDerived.today) >= 7) &&
        (store.state.checksThisWeek > 0 || store.state.spendLog.length > 0);
      const inRecovery = view.journey === 'recovery';
      const moveDoneToday = store.state.journey.moveDoneISO === liveDerived.today;
      const action: GlanceAction | null = ritualDue
        ? {
            title: 'Payday',
            body: 'Two minutes with Melo makes the month safe.',
            cta: 'Start the ritual',
            kind: 'ritual',
          }
        : view.data === 'fog'
          ? {
              title: 'Refresh my picture',
              body: 'Tell me today’s balance and everything sharpens back up.',
              cta: 'Update balance (30s)',
              kind: 'balance',
            }
          : inRecovery && moveDoneToday
            ? {
                title: 'Done for today',
                body: 'That was the whole ask. See you tomorrow — I’ll bring the numbers.',
                cta: '',
                kind: 'info',
              }
            : view.ladder === 'overspent' || view.ladder === 'danger'
              ? inRecovery
                ? {
                    title: 'Today’s move',
                    body: `Shift ${formatPounds(liveDerived.recoveryMove)} to bills. Then we’re done for today — no second ask.`,
                    cta: 'Do today’s move',
                    kind: 'recovery',
                  }
                : recoveryDeclinedToday
                  ? null
                  : liveDerived.unsafe.structural
                    ? {
                        // Structural shortfall is NOT overspending (audit): the cycle
                        // doesn't fit — say that, and lead with a real option.
                        title: 'This cycle doesn’t fit',
                        body:
                          liveDerived.unsafe.options[0]?.body ??
                          `The maths is short ${formatPounds(liveDerived.unsafe.gapPence)} — that’s the numbers, not your choices.`,
                        cta: 'See the way through',
                        kind: 'recovery',
                      }
                    : {
                        title: 'The way back',
                        body: 'Three steps. The first one takes a minute. No lecture in any of them.',
                        cta: 'Start the way back',
                        kind: 'recovery',
                      }
              : view.ladder === 'warning'
                ? {
                    title: 'Keep it dry',
                    body: `${liveDerived.ctx.keepDryPerDay}/day until ${liveDerived.ctx.paydayLabel} keeps the storm off.`,
                    cta: 'Show the math',
                    kind: 'info',
                  }
                : reviewDue
                  ? {
                      title: 'The week, in 30 seconds',
                      body: 'What moved, what stayed quiet, what lands next week — one honest look.',
                      cta: 'See the week',
                      kind: 'review',
                    }
                  : null;

      // Quiet Mode (§14 item 16): optional nudges go quiet; the functional cards — payday
      // ritual, fog's balance ask, danger/recovery — keep speaking. Quiet is calm, not blind.
      const quietAction =
        store.state.setup.quietMode &&
        (action?.kind === 'info' || action?.kind === 'review') &&
        !inRecovery
          ? null
          : action;

      // Fog never asserts a confident forecast on stale data (audit): the sub says what we
      // actually know. And "bills are safe" is only spoken when it is checked-true.
      const sub =
        view.data === 'fog'
          ? `last good numbers from ${liveDerived.ctx.staleLabel}`
          : view.ladder === 'tight'
            ? `${liveDerived.ctx.perDay}/day to ${liveDerived.ctx.paydayLabel}`
            : `safe until ${liveDerived.ctx.paydayLabel}`;

      const l2Base = LIVE_L2[view.copyKey] ?? '';
      const l2 =
        (view.copyKey === 'danger' || view.copyKey === 'overspent') && !billsCovered
          ? 'Small and daily — the plan is ready.'
          : l2Base;

      return {
        view,
        ctx: liveDerived.ctx,
        szPence: liveDerived.safeZone.safeZonePence,
        sub,
        l2,
        chipWord: visual.word + chipSuffix,
        daysToPayday: liveDerived.safeZone.daysToPayday,
        bills: liveDerived.runwayBills,
        dangerDay: liveDerived.dangerDayOffset,
        action: quietAction,
        mathRows: liveDerived.safeZone.breakdown.map((row) => ({
          label:
            row.key === 'balance'
              ? 'Balance'
              : row.key === 'bills'
                ? 'Shielded bills'
                : row.key === 'essentials'
                  ? 'Essentials · estimated'
                  : row.key === 'savings'
                    ? 'Savings · edit in settings'
                    : 'Buffer — early warning',
          valuePence: row.amountPence,
        })),
      };
    }

    const demo = DEMOS[mode === 'live' ? 'calm' : mode];
    const { view } = resolveState(demo.prev, demo.inputs, DEMO_TODAY);
    const b = demoBreakdown(demo.szPence);
    return {
      view,
      ctx: demo.ctx,
      szPence: demo.szPence,
      sub: demo.sub,
      l2: demo.l2,
      chipWord: demo.chipWord,
      daysToPayday: demo.daysToPayday,
      bills: demo.bills,
      dangerDay: demo.dangerDay,
      action: {
        title: demo.action.title,
        body: demo.action.body,
        cta: demo.action.cta,
        kind:
          demo.key === 'storm'
            ? 'recovery'
            : demo.key === 'fog'
              ? 'balance'
              : demo.key === 'payday'
                ? 'ritual'
                : 'info',
      },
      mathRows: [
        { label: 'Balance', valuePence: b.balance },
        { label: 'Shielded bills', valuePence: -b.bills },
        { label: 'Essentials to payday', valuePence: -b.essentials },
        { label: 'Savings, as planned', valuePence: -b.savings },
        { label: 'Buffer — early warning', valuePence: -b.buffer },
      ],
    };
  }, [
    mode,
    liveDerived,
    liveResolved,
    store.state.lastRitualISO,
    store.state.lastReviewISO,
    store.state.checksThisWeek,
    store.state.journey.moveDoneISO,
    recoveryDeclinedToday,
  ]);

  const visual = WEATHER_VISUALS[model.view.weather];
  const breathe = breatheFor(model.view);
  // "Bills are safe" is engine copy — but only spoken when the balance actually covers the
  // shielded bills; otherwise the uncovered variant carries the same honesty without the claim.
  const line1 =
    mode === 'live' && liveDerived && model.view.copyKey === 'danger' && !liveDerived.billsCovered
      ? COPY.dangerUncovered(model.ctx)
      : COPY[model.view.copyKey](model.ctx);
  const isFog = model.view.data === 'fog';
  const checks = mode === 'live' ? store.state.checksThisWeek : demoChecks;

  const switchMode = (next: Mode) => {
    setMode(next);
    setDevOpen(false);
    setShowMath(false);
    setAsk(null);
    setAskText('');
    setBalanceEdit(false);
    setSpendEdit(false);
    setSettingsOpen(false);
    setRitualOpen(false);
    setShieldOpen(false);
    setReviewOpen(false);
    setImportOpen(false);
  };

  const saveSpend = () => {
    if (!liveDerived) return;
    const pounds = Number.parseInt(spendText.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(pounds) || pounds <= 0) return;
    store.addSpend(pounds * 100, liveDerived.today);
    store.bump('spendLogged');
    setSpendEdit(false);
    setSpendText('');
  };

  const runAsk = () => {
    const pounds = Number.parseInt(askText.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(pounds) || pounds <= 0) return;
    const amountPence = pounds * 100;
    if (isFog) {
      setAsk({ amountPence, result: null, fog: true, shelved: false });
      return;
    }
    setAsk({
      amountPence,
      result: checkAfford(model.szPence, amountPence),
      fog: false,
      shelved: false,
    });
    if (mode === 'live' && liveDerived) {
      store.incrementChecks(liveDerived.today);
      store.bump('check');
    } else setDemoChecks((n) => n + 1);
  };

  const saveBalance = () => {
    const pounds = Number.parseInt(balanceText.replace(/[^0-9-]/g, ''), 10);
    if (!Number.isFinite(pounds)) return;
    store.updateBalance(pounds * 100);
    store.bump('balanceUpdated');
    setBalanceEdit(false);
    setBalanceText('');
  };

  const openReview = () => {
    if (mode === 'live' && liveDerived) {
      store.markReviewSeen(liveDerived.today);
      store.bump('reviewOpened');
    }
    setReviewOpen(true);
  };

  const handleAction = () => {
    if (!model.action) return;
    if (model.action.kind === 'ritual') {
      setRitualOpen(true);
      return;
    }
    if (model.action.kind === 'review') {
      openReview();
      return;
    }
    if (model.action.kind === 'recovery') {
      if (mode === 'live') setRecoveryOpen(true);
      else switchMode('recovery');
      return;
    }
    if (model.action.kind === 'info' && !model.action.cta) return;
    if (model.action.kind === 'balance') {
      setBalanceEdit(true);
      return;
    }
    setShowMath(true);
  };

  const ritualBills: readonly RitualBillRow[] =
    mode === 'live'
      ? store.state.setup.bills.map((b) => ({ name: b.name, amountPence: b.amountPence }))
      : [
          { name: 'Rent', amountPence: 85_000 },
          { name: 'Energy', amountPence: 9_500 },
          { name: 'Phone', amountPence: 2_400 },
        ];

  const finishRitual = () => {
    if (mode === 'live' && liveDerived) {
      store.markRitualDone(liveDerived.today);
      store.bump('ritualDone');
      // Payday's money should be IN the numbers: completing the ritual flows straight into
      // confirming today's balance, so income lands the moment it's celebrated.
      setBalanceEdit(true);
    }
    setRitualOpen(false);
  };

  const skipRitual = () => {
    // A decline is respected: skipping suppresses the ask for the rest of today (re-offered
    // next payday), it is never re-presented immediately.
    if (mode === 'live' && liveDerived) store.markRitualDone(liveDerived.today);
    setRitualOpen(false);
  };

  const acceptRecoveryAndClose = () => {
    if (mode === 'live' && liveDerived) {
      const res = resolveState(store.state.journey.record, liveDerived.inputs, liveDerived.today, {
        acceptRecovery: true,
      });
      store.setJourney({
        record: res.record,
        recoveryStartISO: store.state.journey.recoveryStartISO ?? liveDerived.today,
        moveDoneISO: liveDerived.today,
      });
      store.bump('recoveryCommitted');
    }
    setRecoveryOpen(false);
  };

  if (settingsOpen && mode === 'live') {
    return (
      <MeloSettings
        setup={store.state.setup}
        onSave={store.updateSetup}
        onClose={() => setSettingsOpen(false)}
        onPaidToday={
          liveDerived
            ? () => {
                store.markPaidToday(liveDerived.today);
                store.bump('manualPayday');
              }
            : undefined
        }
        onResetAll={() => {
          // Reset drops onboarded=false → the route lands back on onboarding.
          store.resetAll();
          setSettingsOpen(false);
        }}
      />
    );
  }

  if (chatOpen && mode === 'live' && liveDerived && liveResolved) {
    return (
      <MeloChat
        derived={liveDerived}
        view={liveResolved.view}
        colorway={store.state.setup.colorway}
        wardrobe={store.state.setup.wardrobe}
        checksThisWeek={store.state.checksThisWeek}
        form={store.state.setup.form}
        onClose={() => setChatOpen(false)}
      />
    );
  }

  if (shieldOpen && mode === 'live' && liveDerived) {
    return (
      <BillsShield
        shield={liveDerived.shield}
        paydayLabel={liveDerived.paydayLabel}
        onClose={() => setShieldOpen(false)}
      />
    );
  }

  if (reviewOpen && mode === 'live' && liveDerived) {
    const review = buildWeekReview({
      todayISO: liveDerived.today,
      spendLog: store.state.spendLog,
      perDayPence: Math.max(0, liveDerived.safeZone.perDayPence),
      checksThisWeek: store.state.checksThisWeek,
      wins: store.state.winLog,
      billsAhead: liveDerived.shield.bills.map((b) => ({
        name: b.name,
        amountPence: b.amountPence,
        dueDate: b.dueDate,
      })),
      safeZonePence: liveDerived.safeZone.safeZonePence,
      daysToPayday: liveDerived.safeZone.daysToPayday,
    });
    return <MeloReview review={review} onClose={() => setReviewOpen(false)} />;
  }

  if (importOpen && mode === 'live' && liveDerived) {
    return (
      <MeloImport
        existingBillNames={store.state.setup.bills.map((b) => b.name)}
        onApply={(apply) => {
          store.applyImport(apply, liveDerived.today);
          store.bump('importApplied');
        }}
        onClose={() => setImportOpen(false)}
      />
    );
  }

  if (ritualOpen) {
    // The "one smart move" (§14: curated rule table, never ML, never fabricated) — every
    // suggestion is arithmetic on the user's own numbers; null is a common, honest answer.
    const liveSmartMove =
      mode === 'live' && liveDerived
        ? pickSmartMove({
            todayISO: liveDerived.today,
            safeZonePence: liveDerived.safeZone.safeZonePence,
            perDayPence: Math.max(0, liveDerived.safeZone.perDayPence),
            daysToPayday: liveDerived.safeZone.daysToPayday,
            bufferPence: store.state.setup.bufferPence,
            savingsPence: store.state.setup.savingsPence,
            bills: liveDerived.shield.bills.map((b) => ({
              name: b.name,
              amountPence: b.amountPence,
              dueDate: b.dueDate,
            })),
            dangerDaysAway: liveDerived.dangerDayOffset,
            runRatePence: liveDerived.observedRunRatePence,
            essentialsPerDayPence: store.state.setup.essentialsPerDayPence,
          })
        : null;
    return (
      <MeloRitual
        colorway={mode === 'live' ? store.state.setup.colorway : 'ember'}
        wardrobe={mode === 'live' ? store.state.setup.wardrobe : null}
        bills={ritualBills}
        savingsPence={mode === 'live' ? store.state.setup.savingsPence : 4_000}
        safeZonePence={model.szPence}
        perDayPence={
          model.daysToPayday > 0 && model.szPence > 0
            ? Math.floor(model.szPence / model.daysToPayday)
            : 0
        }
        daysToPayday={model.daysToPayday}
        paydayLabel={model.ctx.paydayLabel}
        onSavingsChoice={
          mode === 'live' && liveDerived
            ? (skipped) => store.setSavingsSkipped(skipped ? liveDerived.payday : null)
            : undefined
        }
        smartMove={
          mode === 'live'
            ? liveSmartMove // rule-table arithmetic on real numbers — or honestly nothing
            : {
                title: 'Energy rose £14',
                body: 'Came in above usual this cycle. Worth a look — it’s a 3-minute fix.',
              }
        }
        onDone={finishRitual}
        onSkip={skipRitual}
      />
    );
  }

  if (recoveryOpen && mode === 'live' && liveDerived) {
    const alreadyOnPath = liveResolved?.view.journey === 'recovery';
    return (
      <RecoveryWalkthrough
        colorway={store.state.setup.colorway}
        wardrobe={store.state.setup.wardrobe}
        szPence={model.szPence}
        entered={model.szPence < 0 ? 'overspent' : 'danger'}
        billNames={store.state.setup.bills.map((b) => b.name)}
        perDayPence={Math.max(
          model.szPence > 0 ? Math.floor(model.szPence / Math.max(model.daysToPayday, 1)) : 400,
          100,
        )}
        daysToPayday={model.daysToPayday}
        paydayLabel={model.ctx.paydayLabel}
        dayOnPath={model.ctx.dayOnPath}
        movePence={liveDerived.recoveryMove}
        startAtMove={alreadyOnPath}
        onCommit={acceptRecoveryAndClose}
        onExit={() => {
          // "not today" is a decline, and declines are respected: the card stays away today.
          if (!alreadyOnPath) setRecoveryDeclinedToday(true);
          setRecoveryOpen(false);
        }}
      />
    );
  }

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ambient sky + weather chip */}
        <View style={{ height: SKY_HEIGHT }}>
          <WeatherSky weather={model.view.weather} height={SKY_HEIGHT} />
          <View style={[s.chip, { backgroundColor: t.inset, borderColor: t.hairline }]}>
            <View style={[s.chipDot, { backgroundColor: visual.dot }]} />
            <Text style={[s.chipWord, { color: t.secondary }]}>{model.chipWord}</Text>
          </View>
          {mode !== 'live' && isLive ? (
            <View style={[s.demoBanner, { backgroundColor: t.calmSoft, borderColor: t.hairline }]}>
              <Text style={[s.demoBannerText, { color: t.calmStrong }]}>demo preview</Text>
            </View>
          ) : null}
        </View>

        {/* mascot + its one line — true Quiet Mode (§14 item 16) de-mascots the app: the
            character and its voice step back entirely; numbers, weather and actions stay. */}
        {mode === 'live' && store.state.setup.quietMode ? null : (
          <View style={s.mascotRow}>
            {/* The one-entity moment: tap Melo, talk to Melo — same body, same mood. */}
            <Pressable
              accessibilityRole={mode === 'live' ? 'button' : undefined}
              accessibilityHint={mode === 'live' ? 'Talk to Melo' : undefined}
              onPress={
                mode === 'live'
                  ? () => {
                      store.bump('chatOpened');
                      setChatOpen(true);
                    }
                  : undefined
              }
            >
              <MeloMascot
                emotion={model.view.mascot.family}
                colorway={mode === 'live' ? store.state.setup.colorway : 'ember'}
                size={104}
                glow={glowFor(model.view)}
                breathe={breathe.enabled}
                breatheDurationMs={breathe.durationMs}
                wardrobe={mode === 'live' ? store.state.setup.wardrobe : null}
                form={mode === 'live' ? store.state.setup.form : null}
              />
            </Pressable>
            <View style={s.say}>
              <Body style={s.sayLine}>{line1}</Body>
              {model.l2 ? <Muted style={s.saySub}>{model.l2}</Muted> : null}
            </View>
          </View>
        )}

        {/* the number */}
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Shows how the Safe Zone was calculated"
          onPress={() => setShowMath((v) => !v)}
          style={s.numberBlock}
        >
          <HeroMoney accessibilityLabel={`Safe Zone ${formatPounds(model.szPence)}`}>
            {formatPounds(model.szPence)}
          </HeroMoney>
          <View style={s.subRow}>
            <Muted>{model.sub}</Muted>
            {isFog ? (
              <View style={[s.staleBadge, { backgroundColor: t.inset }]}>
                <Text style={[s.staleText, { color: t.muted }]}>stale</Text>
              </View>
            ) : null}
          </View>
          <Muted style={s.hint}>tap for the math</Muted>
        </Pressable>

        {/* show the math */}
        {showMath ? (
          <Surface style={s.card} tone="sunken">
            <Muted style={s.mathIntro}>
              Every pound accounted for. Tap anything that looks wrong — I’d rather be corrected
              than confidently wrong.
            </Muted>
            {model.mathRows.map((row) => (
              <MathRow
                key={row.label}
                label={row.label}
                value={
                  row.valuePence < 0
                    ? `−${formatPounds(Math.abs(row.valuePence))}`
                    : formatPounds(row.valuePence)
                }
              />
            ))}
            <MathRow label="Safe Zone" value={formatPounds(model.szPence)} total />
            <View style={s.mathButtons}>
              <GhostButton
                flex
                label="Looks right"
                onPress={() => {
                  if (mode === 'live') store.bump('mathLooksRight');
                  setShowMath(false);
                }}
              />
              <GhostButton
                flex
                label="Something’s off"
                onPress={() => {
                  // The correction path the copy promises: straight into the editor.
                  if (mode === 'live') store.bump('mathSomethingOff');
                  setShowMath(false);
                  if (mode === 'live') setSettingsOpen(true);
                }}
              />
            </View>
          </Surface>
        ) : null}

        {/* runway — tapping it opens the Bills Shield (the strip IS the bills, made touchable) */}
        <Pressable
          style={s.runway}
          accessibilityRole={mode === 'live' ? 'button' : undefined}
          accessibilityHint={mode === 'live' ? 'Opens the Bills Shield' : undefined}
          onPress={
            mode === 'live'
              ? () => {
                  store.bump('shieldOpened');
                  setShieldOpen(true);
                }
              : undefined
          }
        >
          <RunwayStrip
            daysToPayday={model.daysToPayday}
            bills={model.bills}
            // Fog suspends the forecast everywhere, not just in copy (drift audit): a
            // danger cell computed from stale data is a forecast the app said not to trust.
            dangerDay={isFog ? null : model.dangerDay}
            paydayLabel={model.ctx.paydayLabel}
          />
        </Pressable>

        {/* the ONE action card */}
        {model.action ? (
          <Surface style={s.card}>
            <Eyebrow tone="muted">{model.action.title}</Eyebrow>
            <Body style={s.actionBody}>{model.action.body}</Body>
            <View style={s.actionCta}>
              {model.action.cta ? (
                <PrimaryAction label={model.action.cta} tone="ink" onPress={handleAction} />
              ) : null}
            </View>
          </Surface>
        ) : null}

        {/* Free debt-help signposting (§13 risk 12: the ethical floor) — appears only when
            the shortfall has been structural for 2+ cycles. Never monetized, never gated. */}
        {mode === 'live' && liveDerived?.unsafe.signpost
          ? liveDerived.unsafe.signpostLines.map((line) => (
              <Muted key={line} style={s.signpostLine}>
                {line}
              </Muted>
            ))
          : null}

        {/* balance update (live) */}
        {balanceEdit ? (
          <Surface style={s.card} tone="sunken">
            <Eyebrow tone="muted">Today’s balance</Eyebrow>
            <View style={s.balanceRow}>
              <Text style={[s.balancePound, { color: t.muted }]}>£</Text>
              <TextInput
                value={balanceText}
                onChangeText={setBalanceText}
                keyboardType="number-pad"
                autoFocus
                placeholder={String(Math.round(store.state.setup.balancePence / 100))}
                placeholderTextColor={t.muted}
                style={[s.balanceField, { color: t.ink }]}
                onSubmitEditing={saveBalance}
              />
              <GhostButton label="Save" onPress={saveBalance} />
            </View>
            {mode === 'live' ? (
              <Pressable
                onPress={() => {
                  setBalanceEdit(false);
                  setImportOpen(true);
                }}
              >
                <Muted style={s.importLink}>or paste a bank statement — it reads the balance</Muted>
              </Pressable>
            ) : null}
          </Surface>
        ) : null}

        {/* can I afford…? */}
        <View style={s.askRow}>
          <TextInput
            value={askText}
            onChangeText={setAskText}
            onSubmitEditing={runAsk}
            keyboardType="number-pad"
            returnKeyType="done"
            placeholder="Can I afford… £"
            placeholderTextColor={t.muted}
            style={[
              s.askInput,
              { backgroundColor: t.inset, borderColor: t.hairlineStrong, color: t.ink },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            onPress={runAsk}
            style={[s.askButton, { backgroundColor: t.calmStrong }]}
          >
            <Text style={[s.askButtonLabel, { color: t.inverse }]}>Ask</Text>
          </Pressable>
        </View>

        {/* the shelf, kept: yesterday's parked want gets its promised re-verdict */}
        {mode === 'live' &&
        liveDerived &&
        store.state.shelf &&
        store.state.shelf.atISO !== liveDerived.today ? (
          <ShelfReverdict
            amountPence={store.state.shelf.amountPence}
            szPence={model.szPence}
            onClear={() => store.setShelf(null)}
          />
        ) : null}

        {ask ? (
          <AskVerdict
            ask={ask}
            ctx={model.ctx}
            onShelf={() => {
              if (mode === 'live' && liveDerived) {
                store.setShelf({ amountPence: ask.amountPence, atISO: liveDerived.today });
              }
              setAsk({ ...ask, shelved: true });
            }}
          />
        ) : null}

        {/* log a spend (live) — the entry that makes the forecast move */}
        {spendEdit ? (
          <Surface style={s.card} tone="sunken">
            <Eyebrow tone="muted">Log a spend</Eyebrow>
            <View style={s.balanceRow}>
              <Text style={[s.balancePound, { color: t.muted }]}>£</Text>
              <TextInput
                value={spendText}
                onChangeText={setSpendText}
                keyboardType="number-pad"
                autoFocus
                placeholder="12"
                placeholderTextColor={t.muted}
                style={[s.balanceField, { color: t.ink }]}
                onSubmitEditing={saveSpend}
              />
              <GhostButton label="Log it" onPress={saveSpend} />
            </View>
          </Surface>
        ) : null}

        {/* ticker + quiet links */}
        <Muted style={s.ticker}>
          {ask?.shelved
            ? `✦ ${COPY.shelf()}`
            : lastWinLine
              ? `✦ ${lastWinLine}`
              : `✦ ${checks} checks-before-buying this week`}
        </Muted>
        {!isLive && onSetUp ? (
          <View style={s.linkRow}>
            <Pressable onPress={onSetUp}>
              <Muted style={s.updateLinkText}>set up my own numbers</Muted>
            </Pressable>
            {onExitToFolio ? (
              <Pressable onPress={onExitToFolio}>
                <Muted style={s.updateLinkText}>back to Folio</Muted>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {mode === 'live' ? (
          <View style={s.linkRow}>
            {!balanceEdit ? (
              <Pressable onPress={() => setBalanceEdit(true)}>
                <Muted style={s.updateLinkText}>update balance</Muted>
              </Pressable>
            ) : null}
            {!spendEdit ? (
              <Pressable onPress={() => setSpendEdit(true)}>
                <Muted style={s.updateLinkText}>log a spend</Muted>
              </Pressable>
            ) : null}
            <Pressable onPress={openReview}>
              <Muted style={s.updateLinkText}>this week</Muted>
            </Pressable>
            {store.state.setup.quietMode ? (
              // Quiet Mode hides the mascot (the usual chat door) — the link keeps the
              // companion reachable when the USER initiates (audit catch).
              <Pressable
                onPress={() => {
                  store.bump('chatOpened');
                  setChatOpen(true);
                }}
              >
                <Muted style={s.updateLinkText}>talk to Melo</Muted>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setSettingsOpen(true)}>
              <Muted style={s.updateLinkText}>settings</Muted>
            </Pressable>
            {onExitToFolio ? (
              <Pressable onPress={onExitToFolio}>
                <Muted style={s.updateLinkText}>back to Folio</Muted>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* dev state chip — development builds only; internal vocabulary never ships (audit) */}
      {__DEV__ ? (
        <View style={s.devWrap}>
          {devOpen ? (
            <View style={[s.devMenu, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              {isLive ? (
                <Pressable
                  onPress={() => switchMode('live')}
                  style={[s.devItem, mode === 'live' ? { backgroundColor: t.calmSoft } : null]}
                >
                  <Text style={[s.devItemLabel, { color: mode === 'live' ? t.ink : t.secondary }]}>
                    Live
                  </Text>
                </Pressable>
              ) : null}
              {DEMO_ORDER.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => switchMode(key)}
                  style={[s.devItem, key === mode ? { backgroundColor: t.calmSoft } : null]}
                >
                  <Text style={[s.devItemLabel, { color: key === mode ? t.ink : t.secondary }]}>
                    {DEMOS[key].label}
                  </Text>
                </Pressable>
              ))}
              <View style={[s.devDivider, { backgroundColor: t.hairline }]} />
              <Text style={[s.devDebug, { color: t.muted }]}>
                {model.view.ladder} · {model.view.weather} · {model.view.copyKey} · sell{' '}
                {model.view.monetizationAllowed ? 'on' : 'off'}
              </Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Prototype states"
            onPress={() => setDevOpen((v) => !v)}
            style={[s.devToggle, { backgroundColor: t.inset, borderColor: t.hairline }]}
          >
            <Text style={[s.devToggleLabel, { color: t.muted }]}>
              {mode === 'live' ? '⚙ state' : '⚙ demo'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ShelfReverdict({
  amountPence,
  szPence,
  onClear,
}: {
  amountPence: number;
  szPence: number;
  onClear: () => void;
}) {
  const result = checkAfford(szPence, amountPence);
  const stillSafe = result.verdict !== 'notNow';
  return (
    <Surface style={s.card} tone="sunken">
      <Eyebrow tone="muted">From the shelf</Eyebrow>
      <Body style={s.verdictLine}>
        {stillSafe
          ? `The shelf says: still safe. ${formatPounds(amountPence)} survives a day of thinking (${formatPounds(result.leftAfterPence)} after).`
          : `The shelf says: not now. ${formatPounds(amountPence)} would go past the line today.`}
      </Body>
      <View style={s.shelfRow}>
        <GhostButton label={stillSafe ? 'Still want it — done' : 'Let it go'} onPress={onClear} />
      </View>
    </Surface>
  );
}

function AskVerdict({ ask, ctx, onShelf }: { ask: Ask; ctx: CopyContext; onShelf: () => void }) {
  if (ask.fog) {
    return (
      <Surface style={s.card} tone="sunken">
        <Verdict>Can’t call it</Verdict>
        <Body style={s.verdictLine}>{COPY.affordFog(ctx)}</Body>
      </Surface>
    );
  }
  if (!ask.result) return null;

  const left = formatPounds(ask.result.leftAfterPence);
  const word =
    ask.result.verdict === 'safe' ? 'Safe' : ask.result.verdict === 'tight' ? 'Tight' : 'Not now';
  const tone: VerdictTone | undefined =
    ask.result.verdict === 'safe'
      ? 'positive'
      : ask.result.verdict === 'tight'
        ? 'warm'
        : undefined;
  const line =
    ask.result.verdict === 'safe'
      ? COPY.affordSafe({ ...ctx, safeZone: left })
      : ask.result.verdict === 'tight'
        ? COPY.affordTight({ ...ctx, safeZone: left })
        : COPY.affordNotNow(ctx);

  return (
    <Surface style={s.card} tone="sunken">
      <Verdict tone={tone}>{word}</Verdict>
      <Body style={s.verdictLine}>{ask.shelved ? COPY.shelf() : line}</Body>
      {ask.result.shelfEligible && !ask.shelved ? (
        <View style={s.shelfRow}>
          <GhostButton label="Put it on the Shelf (24h)" onPress={onShelf} />
        </View>
      ) : null}
    </Surface>
  );
}

function MathRow({ label, value, total }: { label: string; value: string; total?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        s.mathRow,
        total
          ? null
          : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.hairline },
      ]}
    >
      <Text
        style={[s.mathLabel, { color: total ? t.ink : t.secondary }, total ? s.mathTotal : null]}
      >
        {label}
      </Text>
      <Text
        style={[s.mathValue, { color: total ? t.calmStrong : t.ink }, total ? s.mathTotal : null]}
      >
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 110 },
  chip: {
    position: 'absolute',
    top: 16,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipWord: { fontSize: 12.5, fontWeight: '600' },
  demoBanner: {
    position: 'absolute',
    top: 16,
    right: 20,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  demoBannerText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  mascotRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    paddingHorizontal: 24,
    marginTop: -64,
  },
  say: { flex: 1, paddingBottom: 12 },
  sayLine: { fontWeight: '600' },
  saySub: { marginTop: 3 },
  numberBlock: { paddingHorizontal: 26, paddingTop: 12 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  staleBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  staleText: { fontSize: 10.5, fontWeight: '600', color: '#7A7286', letterSpacing: 0.2 },
  hint: { fontSize: 11, marginTop: 4 },
  card: { marginHorizontal: 26, marginTop: 16 },
  mathIntro: { marginBottom: 10, lineHeight: 18 },
  mathRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  mathLabel: { fontSize: 14 },
  mathValue: { fontSize: 14, fontVariant: ['tabular-nums'], fontWeight: '600' },
  mathTotal: { fontSize: 16, fontWeight: '700' },
  mathButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  runway: { paddingHorizontal: 26, paddingTop: 18 },
  actionBody: { marginTop: 4, lineHeight: 20 },
  actionCta: { marginTop: 12 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  balancePound: { fontSize: 22 },
  balanceField: {
    flex: 1,
    fontSize: 26,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    paddingVertical: 4,
  },
  askRow: { flexDirection: 'row', gap: 8, marginHorizontal: 26, marginTop: 16 },
  askInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  askButton: { borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  askButtonLabel: { fontSize: 14.5, fontWeight: '600' },
  verdictLine: { marginTop: 5, lineHeight: 20 },
  shelfRow: { marginTop: 10, alignSelf: 'flex-start' },
  ticker: { marginHorizontal: 26, marginTop: 16, fontSize: 12.5 },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginHorizontal: 26, marginTop: 8 },
  updateLinkText: { fontSize: 12, textDecorationLine: 'underline' },
  importLink: { fontSize: 12, textDecorationLine: 'underline', marginTop: 10 },
  signpostLine: { marginHorizontal: 26, marginTop: 8, fontSize: 12.5, lineHeight: 18 },
  devWrap: { position: 'absolute', right: 14, bottom: 14, alignItems: 'flex-end', gap: 8 },
  devMenu: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    minWidth: 132,
  },
  devItem: { borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10 },
  devItemLabel: { fontSize: 13, textAlign: 'right', fontWeight: '500' },
  devDivider: { height: StyleSheet.hairlineWidth, marginVertical: 5, marginHorizontal: 4 },
  devDebug: { fontSize: 10, textAlign: 'right', paddingHorizontal: 10, paddingBottom: 4 },
  devToggle: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  devToggleLabel: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.3 },
});
