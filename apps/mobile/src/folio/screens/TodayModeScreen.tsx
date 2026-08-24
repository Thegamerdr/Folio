/**
 * @rn-screen    TodayModeScreen
 * @rn-stack     MainTabs > Today (mode ∈ growth|debt|irregular|household|planning|optimizer|reset|lowVis)
 * @purpose      One shared Today shell that renders a mode-specific hero panel for every parked
 *               lens. Each hero picks a distinct visual metaphor so switching lenses genuinely
 *               changes the framing, not just a copy swap. Faithful 1:1 RN port of the web design
 *               source (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/
 *               ScreenTodayMode.tsx).
 * @reads        moneyMode, bufferAmount, currentBalance, pots, subs, onboarding, cycles, debts,
 *               household, plans (via the store + the real modes/lens/debt/plan/household engines)
 * @writes       — (nav + sheet opens only)
 * @opens-sheet  log-invoice, onboarding, add-event, declare-debt, log-payment, household-setup,
 *               add-plan, lens-picker, melo-chat
 * @copy         mode-specific — verdict/spare-label come from `deriveModeState(mode, ...)`
 * @tokens       paper · surface · inset · ink · calm(accent) · positive · caution · repair(negative)
 *               · hairline · muted · Fraunces headlines · tabular money
 * @motion       count-up 700ms · press .97/120ms · respects reduce-motion
 * @notes        Sibling to TodayScreen (Survival) and TodayStabilityScreen (Stability).
 *               StubDisclaimer shows the honest "starting from £X" caption; MODE_SHIP_STATUS in
 *               `@/folio/lib/modes` reports every lens shipped in this RN port (no survival-maths
 *               caveat needed).
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { gap, radius, serif, useCountUp, useTheme, type Palette } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { useAppStore } from '@/folio/store';
import { useRoute } from '@/folio/lib/storeRoute';
import { hasAnyUserData, selectMonthlyIncome } from '@/folio/lib/income';
import { useMeloOpener } from '@/folio/lib/useMeloOpener';
import { useChartStyle, type ChartStyle } from '@/folio/lib/chartStyle';
import { LensProgress } from '@/folio/ui/LensProgress';
import { MoneyModeChip } from '@/folio/ui/MoneyModeChip';
import { MeloWeatherGlyph } from '@/folio/ui/MeloWeatherGlyph';
import { TrialCountdownChip } from '@/folio/ui/TrialCountdownChip';
import { TrialEndedRow } from '@/folio/ui/TrialEndedRow';
import { WhatChangedRow } from '@/folio/ui/WhatChangedRow';
import { StubDisclaimer } from '@/folio/ui/StubDisclaimer';
import { useLens } from '@/folio/lib/lens';
import { deriveModeState, MODE_LABEL, type MoneyMode } from '@/folio/lib/modes';
import { headerLineFor } from '@/folio/lib/modes/headerFraming';
import { computeLeaks, type OptimizerLeak } from '@/folio/lib/modes/strategies/optimizer';
import { resetEssentialsPerDay } from '@/folio/lib/modes/strategies/reset';
import * as debtEngine from '@/folio/lib/modes/debtEngine';
import {
  computeBillSplits,
  summariseHousehold,
  type BillSplit,
} from '@/folio/lib/modes/strategies/household';
import * as planEngine from '@/folio/lib/modes/planEngine';
import type { Nav } from '@/folio/types';

import { formatGBP } from './today/format';
import { derivePressure } from './today/pressure';
import { TodayNudges } from './today/TodayNudges';
import { TodayRecentTxns } from './today/TodayRecentTxns';

type LensMode = Exclude<MoneyMode, 'survival' | 'stability'>;

type HeroCtx = {
  mode: LensMode;
  amount: number;
  animated: number;
  spareLabel: string;
  verdict: string;
  formula: string;
  bufferAmount: number;
  currentBalance: number;
  monthlyIn: number;
  monthlyOut: number;
  /** Raw `onboarding.monthlyIncome` — the exact input `resetStrategy.derive` feeds into
   *  `resetEssentialsPerDay` to produce the Reset day count. Deliberately distinct from
   *  `monthlyIn` (which is `selectMonthlyIncome`, a different derived figure) so the Reset
   *  hero's "~£X/day" caption divides by the SAME number the day count above it divides by. */
  onboardingMonthlyIncome: number;
  subsCount: number;
  potsSaved: number;
  potsTarget: number;
  tightestSpare: number;
  daysToPayday: number;
  optimizerLeaks?: OptimizerLeak[] | undefined;
  chartStyle: ChartStyle;
  confidence: 'low' | 'estimating' | 'high';
  openLogInvoice: () => void;
  openOnboarding: () => void;
  openAddEvent: () => void;
  openAddBill: () => void;
  openAddDebt: () => void;
  openLogPayment: () => void;
  openHouseholdSetup: () => void;
  debtSummary?: debtEngine.DebtSummary | undefined;
  householdSplits?: BillSplit[] | undefined;
  householdPartner?: string | undefined;
  growthPots?:
    | Array<{
        id: string;
        name: string;
        saved: number;
        goal: number;
        perWeek: number;
        weeksToGoal: number | null;
      }>
    | undefined;
  openPots: () => void;
  planProgresses?: planEngine.PlanProgress[] | undefined;
  openAddPlan: () => void;
  openSubs: () => void;
  openRecovery: () => void;
};

// ---------------------------------------------------------------------------
// Mode-specific hero visuals — the block between the mode chip and the
// StubDisclaimer caption. Every entry mirrors the web's HERO record 1:1.
// ---------------------------------------------------------------------------

const HERO: Record<
  LensMode,
  {
    label: string;
    toneKey: keyof Palette;
    headline: string;
    render: (c: HeroCtx, t: Palette) => ReactNode;
  }
> = {
  growth: {
    label: 'Growth Mode',
    toneKey: 'positive',
    headline: 'Free to save',
    render: (c, t) => {
      const pots = c.growthPots ?? [];
      const goal = c.potsTarget || Math.max(500, c.monthlyIn);
      const monthsToGoal =
        c.amount > 0 ? Math.ceil((goal - c.potsSaved) / Math.max(1, c.amount)) : null;
      const pct = goal > 0 ? Math.round((c.potsSaved / goal) * 100) : 0;
      return (
        <View style={heroStyles.block}>
          <RowLabel
            left="Pace to goal"
            right={`${formatGBP(c.potsSaved)} of ${formatGBP(goal)}`}
            t={t}
          />
          <View style={heroStyles.progressGap}>
            <LensProgress
              value={c.potsSaved}
              target={goal}
              style={c.chartStyle}
              tone={t.positive}
            />
          </View>
          <Text style={[heroStyles.hint, { color: t.muted }]}>
            {monthsToGoal
              ? `At this pace you're there in ${monthsToGoal} ${monthsToGoal === 1 ? 'month' : 'months'}. (${pct}%)`
              : c.potsTarget > 0
                ? 'Feed a pot this cycle to start the pace.'
                : 'Pick a pot to start the pace.'}
          </Text>
          {pots.length > 0 ? (
            <View style={heroStyles.tileRow}>
              {pots.slice(0, 3).map((p) => {
                const potPct = p.goal > 0 ? Math.max(0, Math.min(1, p.saved / p.goal)) : 0;
                return (
                  <View key={p.id} style={[heroStyles.tile, { backgroundColor: t.inset }]}>
                    <Text style={[heroStyles.tileLabel, { color: t.muted }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={[heroStyles.tileValue, { color: t.ink }]}>
                      {p.perWeek > 0 ? `£${p.perWeek}` : '—'}
                      <Text style={[heroStyles.tileValueUnit, { color: t.muted }]}> /wk</Text>
                    </Text>
                    <View style={[heroStyles.tileBarTrack, { backgroundColor: t.surface }]}>
                      <View
                        style={[
                          heroStyles.tileBarFill,
                          { width: `${potPct * 100}%`, backgroundColor: t.positive },
                        ]}
                      />
                    </View>
                    <Text style={[heroStyles.tileFoot, { color: t.muted }]}>
                      {p.weeksToGoal !== null
                        ? `${p.weeksToGoal}w to go`
                        : `${Math.round(potPct * 100)}%`}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          <View style={heroStyles.ctaRow}>
            <HeroCta
              label="+ Feed a pot"
              tone={t.positive}
              onTone={t.inverse}
              onPress={c.openPots}
            />
            <HeroCta
              label="Pots →"
              tone={t.surface}
              textColor={t.ink}
              bordered
              onPress={c.openPots}
            />
          </View>
        </View>
      );
    },
  },

  debt: {
    label: 'Debt Mode',
    toneKey: 'calm',
    headline: 'Payoff',
    render: (c, t) => {
      const s = c.debtSummary;
      if (!s || s.total <= 0) {
        return (
          <View style={heroStyles.block}>
            <View style={[heroStyles.noticeBox, { backgroundColor: t.inset }]}>
              <Text style={[heroStyles.noticeText, { color: t.muted }]}>
                No debts declared yet. Add one and Melo holds the payoff, the minimums, and the next
                due date.
              </Text>
              <View style={heroStyles.noticeCta}>
                <HeroCta
                  label="+ Add a debt"
                  tone={t.surface}
                  textColor={t.ink}
                  bordered
                  onPress={c.openAddDebt}
                />
              </View>
            </View>
          </View>
        );
      }
      const monthsAtMin = isFinite(s.monthsAtMin) ? `${s.monthsAtMin} mo` : '—';
      const nextDueLabel =
        s.daysToNextDue === null
          ? '—'
          : s.daysToNextDue === 0
            ? 'today'
            : s.daysToNextDue === 1
              ? 'in 1 d'
              : `in ${s.daysToNextDue} d`;
      return (
        <View style={heroStyles.block}>
          <RowLabel
            left="Outstanding"
            right={`${formatGBP(s.total)} · ${s.weightedApr.toFixed(1)}% wtd APR`}
            t={t}
          />
          <View style={heroStyles.tripleRow}>
            <StatTile label="Min / mo" value={formatGBP(s.minSum)} t={t} />
            <StatTile label="Payoff" value={monthsAtMin} t={t} />
            <StatTile label="Next due" value={nextDueLabel} t={t} />
          </View>
          {s.nextDue ? (
            <Text style={[heroStyles.italicLine, { color: t.muted }]}>
              {s.nextDue.name} · {formatGBP(s.nextDue.minPayment)} on the {s.nextDue.dueDom}
              {s.nextDue.dueDom === 1
                ? 'st'
                : s.nextDue.dueDom === 2
                  ? 'nd'
                  : s.nextDue.dueDom === 3
                    ? 'rd'
                    : 'th'}
            </Text>
          ) : null}
          <View style={heroStyles.ctaRow}>
            <HeroCta
              label="+ Log a payment"
              tone={t.calm}
              onTone={t.inverse}
              onPress={c.openLogPayment}
            />
            <HeroCta
              label="+ Add a debt"
              tone={t.surface}
              textColor={t.ink}
              bordered
              onPress={c.openAddDebt}
            />
          </View>
        </View>
      );
    },
  },

  irregular: {
    label: 'Irregular Income',
    toneKey: 'caution',
    headline: 'Runway',
    render: (c, t) => {
      const runway = Math.max(0, c.amount);
      const active = c.monthlyOut;
      const weeklyBills = Math.max(20, active / 4.33);
      const typicalInvoice = Math.max(0, c.monthlyIn * 0.5);
      const extendsBy = weeklyBills > 0 ? Math.floor(typicalInvoice / weeklyBills) : 0;

      if (c.confidence === 'low') {
        return (
          <View style={heroStyles.block}>
            <View style={[heroStyles.noticeBox, { backgroundColor: t.inset }]}>
              <Text style={[heroStyles.noticeText, { color: t.muted }]}>
                Not enough to say yet. Log an invoice or add a statement and the runway sharpens.
              </Text>
              <View style={heroStyles.noticeCta}>
                <HeroCta
                  label="+ Log invoice"
                  tone={t.surface}
                  textColor={t.ink}
                  bordered
                  onPress={c.openLogInvoice}
                />
              </View>
            </View>
          </View>
        );
      }

      const bands: Array<{ label: string; min: number; max: number; tone: string }> = [
        { label: 'this week', min: 0, max: 2, tone: t.repair },
        { label: 'next month', min: 2, max: 4, tone: t.caution },
        { label: 'buffer', min: 4, max: 8, tone: t.muted },
        { label: 'calm', min: 8, max: 12, tone: t.positive },
      ];

      return (
        <View style={heroStyles.block}>
          <RowLabel left="Weeks of bills covered" right={`${runway} wk`} t={t} />
          <View style={heroStyles.bandRow}>
            {bands.map((b) => {
              const filled = Math.max(0, Math.min(1, (runway - b.min) / (b.max - b.min)));
              return (
                <View key={b.label} style={heroStyles.bandCol}>
                  <View style={[heroStyles.bandTrack, { backgroundColor: t.inset }]}>
                    <View
                      style={[
                        heroStyles.bandFill,
                        { width: `${filled * 100}%`, backgroundColor: b.tone },
                      ]}
                    />
                  </View>
                  <Text style={[heroStyles.bandLabel, { color: t.muted }]}>{b.label}</Text>
                </View>
              );
            })}
          </View>
          <Text style={[heroStyles.hint, { color: t.muted }]}>
            {extendsBy > 0
              ? `Next typical invoice extends runway by ~${extendsBy} ${extendsBy === 1 ? 'wk' : 'wks'}.`
              : 'Next invoice extends the runway.'}
          </Text>
          <View style={[heroStyles.ctaRow, heroStyles.ctaRowCenter]}>
            <HeroCta
              label="+ Log invoice"
              tone={t.inset}
              textColor={t.ink}
              bordered
              onPress={c.openLogInvoice}
            />
          </View>
        </View>
      );
    },
  },

  household: {
    label: 'Household Mode',
    toneKey: 'ink',
    headline: 'Shared bills · next 30 days',
    render: (c, t) => {
      const splits = c.householdSplits ?? [];
      const partner = (c.householdPartner ?? '').trim() || 'Them';
      const { totalShared, totalYours, totalPartner } = summariseHousehold(splits);
      const yourPct = totalShared > 0 ? Math.round((totalYours / totalShared) * 100) : 50;

      if (splits.length === 0) {
        return (
          <View style={heroStyles.block}>
            <View style={[heroStyles.noticeBox, { backgroundColor: t.inset }]}>
              <Text style={[heroStyles.noticeText, { color: t.muted }]}>
                No shared bills in the next 30 days. Add bills as regular subs — Melo will show the
                split here.
              </Text>
            </View>
            <View style={heroStyles.noticeCtaEnd}>
              <HeroCta
                label="Set up household →"
                tone={t.surface}
                textColor={t.calm}
                bordered
                small
                onPress={c.openHouseholdSetup}
              />
            </View>
          </View>
        );
      }

      return (
        <View style={heroStyles.block}>
          <RowLabel left="Shared this cycle" right={formatGBP(totalShared)} t={t} />
          <View style={[heroStyles.splitTrack, { borderColor: t.hairline }]}>
            <View
              style={[heroStyles.splitFillYou, { width: `${yourPct}%`, backgroundColor: t.ink }]}
            />
            <View
              style={[
                heroStyles.splitFillThem,
                { width: `${100 - yourPct}%`, backgroundColor: t.muted },
              ]}
            />
          </View>
          <View style={heroStyles.splitLegend}>
            <Text style={[heroStyles.splitLegendText, { color: t.ink }]}>
              You <Text style={{ color: t.muted }}>{formatGBP(Math.round(totalYours))}</Text>
            </Text>
            <Text style={[heroStyles.splitLegendText, { color: t.muted }]}>
              {partner} <Text style={{ color: t.ink }}>{formatGBP(Math.round(totalPartner))}</Text>
            </Text>
          </View>
          <View style={[heroStyles.divider, { borderColor: t.hairline }]}>
            {splits.slice(0, 4).map((b) => (
              <View key={b.name} style={heroStyles.splitRow}>
                <View style={heroStyles.splitRowLeft}>
                  <Text style={[heroStyles.splitRowName, { color: t.ink }]} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Text style={[heroStyles.splitRowMeta, { color: t.muted }]}>
                    in {b.daysAway}d · {Math.round(b.sharePct * 100)}% you
                    {b.overridden ? <Text style={{ color: t.calm }}> · custom</Text> : null}
                  </Text>
                </View>
                <Text style={[heroStyles.splitRowValue, { color: t.muted }]}>
                  {formatGBP(b.yourShare)}
                </Text>
              </View>
            ))}
          </View>
          <View style={heroStyles.footRow}>
            <Text style={[heroStyles.italicLine, { color: t.muted }]}>
              Neutral ledger — no blame, just numbers.
            </Text>
            <HeroCta
              label="Adjust splits →"
              tone={t.surface}
              textColor={t.calm}
              bordered
              small
              onPress={c.openHouseholdSetup}
            />
          </View>
        </View>
      );
    },
  },

  planning: {
    label: 'Planning Mode',
    toneKey: 'calm',
    headline: 'On pace',
    render: (c, t) => {
      const plans = c.planProgresses ?? [];
      if (plans.length === 0) {
        return (
          <View style={heroStyles.block}>
            <View style={[heroStyles.noticeBox, { backgroundColor: t.inset }]}>
              <Text style={[heroStyles.noticeText, { color: t.muted }]}>
                No plans yet. Add one and Melo holds the target, the by-date, and the weekly pace.
              </Text>
              <View style={heroStyles.noticeCta}>
                <HeroCta
                  label="+ Add a plan"
                  tone={t.surface}
                  textColor={t.ink}
                  bordered
                  onPress={c.openAddPlan}
                />
              </View>
            </View>
          </View>
        );
      }
      const focus = plans[0]!;
      const req = Number.isFinite(focus.requiredPerWeek) ? Math.ceil(focus.requiredPerWeek) : null;
      const focusTone = focus.onTrack ? t.positive : focus.daysUntil < 14 ? t.repair : t.caution;
      return (
        <View style={heroStyles.block}>
          <RowLabel
            left="Next up"
            right={`${formatGBP(focus.plan.saved)} / ${formatGBP(focus.plan.target)}`}
            t={t}
          />
          <View style={heroStyles.progressGap}>
            <LensProgress
              value={focus.plan.saved}
              target={focus.plan.target}
              style={c.chartStyle}
              tone={focusTone}
            />
          </View>
          <View style={heroStyles.tripleRow}>
            <StatTile label="Due" value={planEngine.daysUntilLabel(focus.daysUntil)} t={t} />
            <StatTile
              label="At pace"
              value={focus.weeksAtPace === null ? '—' : `${focus.weeksAtPace}w`}
              t={t}
            />
            <StatTile
              label="Need / wk"
              value={req === null ? '—' : `£${req}`}
              valueColor={focus.onTrack ? t.ink : focusTone}
              t={t}
            />
          </View>
          {plans.length > 1 ? (
            <View style={[heroStyles.divider, { borderColor: t.hairline }]}>
              {plans.slice(1, 4).map((p) => (
                <View key={p.plan.id} style={heroStyles.splitRow}>
                  <View style={heroStyles.splitRowLeft}>
                    <Text style={[heroStyles.splitRowName, { color: t.ink }]} numberOfLines={1}>
                      {p.plan.name}
                    </Text>
                    <Text style={[heroStyles.splitRowMeta, { color: t.muted }]}>
                      {planEngine.daysUntilLabel(p.daysUntil)} · {Math.round(p.progress * 100)}%
                      {!p.onTrack ? <Text style={{ color: t.caution }}> · short</Text> : null}
                    </Text>
                  </View>
                  <Text style={[heroStyles.splitRowValue, { color: t.muted }]}>
                    {formatGBP(p.remaining)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={heroStyles.ctaRow}>
            <HeroCta
              label="+ Add a plan"
              tone={t.calm}
              onTone={t.inverse}
              onPress={c.openAddPlan}
            />
            <HeroCta
              label="Pots →"
              tone={t.surface}
              textColor={t.ink}
              bordered
              onPress={c.openPots}
            />
          </View>
        </View>
      );
    },
  },

  optimizer: {
    label: 'Optimizer Mode',
    toneKey: 'calm',
    headline: 'Recovered this month',
    render: (c, t) => {
      const leaks = c.optimizerLeaks ?? [];
      const total = Math.round(leaks.reduce((s, l) => s + l.cost, 0));
      if (leaks.length === 0) {
        return (
          <View style={heroStyles.block}>
            <Text style={[heroStyles.leanText, { color: t.muted }]}>
              Nothing obvious leaking right now. Melo watches for subs you stop using and bills that
              outgrow their value.
            </Text>
          </View>
        );
      }
      return (
        <View style={heroStyles.block}>
          <RowLabel left="Leaks worth naming" right={`${formatGBP(total)}/mo`} t={t} />
          <View style={[heroStyles.divider, { borderColor: t.hairline }]}>
            {leaks.slice(0, 4).map((l) => (
              <View key={l.name} style={heroStyles.splitRow}>
                <View style={heroStyles.splitRowLeft}>
                  <Text style={[heroStyles.splitRowName, { color: t.ink }]} numberOfLines={1}>
                    {l.name}
                  </Text>
                  <Text style={[heroStyles.splitRowMeta, { color: t.muted }]}>{l.detail}</Text>
                </View>
                <Text style={[heroStyles.splitRowValue, { color: t.muted }]}>
                  {formatGBP(l.cost)}
                </Text>
              </View>
            ))}
          </View>
          <View style={heroStyles.ctaRow}>
            <HeroCta
              label="Prune subs"
              tone={t.calm}
              onTone={t.inverse}
              flex
              onPress={c.openSubs}
            />
            <HeroCta
              label="Log a save"
              tone={t.surface}
              textColor={t.ink}
              bordered
              flex
              onPress={c.openAddEvent}
            />
          </View>
          <Text style={[heroStyles.hint, { color: t.muted }]}>
            One per surface. Cut, keep, or defer — never moralised.
          </Text>
        </View>
      );
    },
  },

  reset: {
    label: 'Reset Mode',
    toneKey: 'repair',
    headline: 'Essentials covered',
    render: (c, t) => {
      const days = Math.max(0, Math.round(c.amount));
      const target = 14;
      // Same denominator resetStrategy.derive() divided by to produce `days` above — was
      // previously a different local formula (Math.max(15, c.monthlyOut / 30)) that could
      // make "N days" and "~£X/day" not multiply back to anything real (plan 107 Step 2).
      const dailyEssentials = resetEssentialsPerDay(c.onboardingMonthlyIncome);
      const tone = days < 3 ? t.repair : days < 7 ? t.caution : t.positive;
      const move =
        days < 3
          ? 'Move the smallest possible thing today — a £5 sub, a paused order.'
          : days < 7
            ? "Cancel one sub you don't use. Nothing bigger this week."
            : 'Hold. Nothing new to add — rest the plan.';
      return (
        <View style={heroStyles.block}>
          <View style={heroStyles.baselineRow}>
            <Text style={[heroStyles.bigNumber, { color: t.ink }]}>{days}</Text>
            <Text style={[heroStyles.bigNumberLabel, { color: t.muted }]}>
              days of essentials held
            </Text>
          </View>
          <Text style={[heroStyles.tabularCaption, { color: t.muted }]}>
            ~{formatGBP(dailyEssentials)}/day · goal {target} days
          </Text>
          <View style={heroStyles.progressGap}>
            <LensProgress value={days} target={target} style={c.chartStyle} tone={tone} />
          </View>
          <View style={[heroStyles.noticeBox, { backgroundColor: t.inset }]}>
            <Text style={[heroStyles.noticeEyebrow, { color: t.muted }]}>One tiny move</Text>
            <Text style={[heroStyles.moveLine, { color: t.ink }]}>{move}</Text>
          </View>
          <View style={heroStyles.ctaRow}>
            <HeroCta
              label="Start recovery"
              tone={t.ink}
              onTone={t.canvas}
              flex
              onPress={c.openRecovery}
            />
            <HeroCta
              label="Log a move"
              tone={t.surface}
              textColor={t.ink}
              bordered
              flex
              onPress={c.openAddEvent}
            />
          </View>
          <Text style={[heroStyles.hint, { color: t.muted }]}>
            One step at a time. Never a plan longer than this week.
          </Text>
        </View>
      );
    },
  },

  lowVis: {
    label: 'Just looking',
    toneKey: 'muted',
    headline: 'Signal coverage',
    render: (c, t) => {
      const coverage = Math.max(0, Math.min(100, c.amount));
      const signals: Array<{
        key: string;
        label: string;
        ok: boolean;
        cta: string;
        why: string;
        onTap: () => void;
      }> = [
        {
          key: 'balance',
          label: 'Balance',
          ok: c.currentBalance > 0,
          cta: '+ Add your balance',
          why: 'Anchors every number on Today — biggest single lift.',
          onTap: c.openOnboarding,
        },
        {
          key: 'bills',
          label: 'Bills',
          ok: c.subsCount > 0,
          cta: '+ Add a bill',
          why: 'Known outgoings shape the path to payday.',
          onTap: c.openAddBill,
        },
        {
          key: 'pots',
          label: 'Pots',
          ok: c.potsTarget > 0,
          cta: '+ Pick a pot',
          why: 'Separates saved money from spare so the low point is honest.',
          onTap: c.openOnboarding,
        },
        {
          key: 'income',
          label: 'Income',
          ok: c.monthlyIn > 0,
          cta: '+ Set your income',
          why: 'Rough monthly figure is enough to calibrate the rhythm.',
          onTap: c.openOnboarding,
        },
      ];
      const nextMissing = signals.find((s) => !s.ok);
      return (
        <View style={heroStyles.block}>
          <RowLabel left="Coverage" right={`${coverage}/100`} t={t} />
          <View style={[heroStyles.bandTrack, { backgroundColor: t.inset, marginTop: gap.xs }]}>
            <View
              style={[
                heroStyles.bandFill,
                {
                  width: `${coverage}%`,
                  backgroundColor:
                    coverage >= 80
                      ? t.positive
                      : coverage >= 60
                        ? t.muted
                        : coverage >= 30
                          ? t.caution
                          : t.repair,
                },
              ]}
            />
          </View>
          <View style={heroStyles.signalGrid}>
            {signals.map((s) => (
              <Pressable
                key={s.key}
                accessibilityRole="button"
                accessibilityLabel={s.ok ? `${s.label} — seen` : `${s.label} missing — ${s.cta}`}
                onPress={s.onTap}
                style={[
                  heroStyles.signalCell,
                  { backgroundColor: t.inset },
                  s === nextMissing
                    ? { borderWidth: StyleSheetHairline, borderColor: t.calm }
                    : null,
                ]}
              >
                <Text style={[heroStyles.signalLabel, { color: t.muted }]}>{s.label}</Text>
                <Text
                  style={[
                    heroStyles.signalStatus,
                    { color: s.ok ? t.positive : s === nextMissing ? t.calm : t.muted },
                  ]}
                >
                  {s.ok ? 'seen' : 'add'}
                </Text>
              </Pressable>
            ))}
          </View>
          {nextMissing ? (
            <View style={heroStyles.signalFooter}>
              <Text style={[heroStyles.italicLineCenter, { color: t.muted }]}>
                {nextMissing.why}
              </Text>
              <View style={heroStyles.noticeCtaCenter}>
                <HeroCta
                  label={nextMissing.cta}
                  tone={t.calm}
                  onTone={t.inverse}
                  onPress={nextMissing.onTap}
                />
              </View>
            </View>
          ) : (
            <Text style={[heroStyles.italicLineCenter, { color: t.muted, marginTop: gap.md }]}>
              Enough signal now. Switch to a firmer lens when ready.
            </Text>
          )}
        </View>
      );
    },
  },
};

const StyleSheetHairline = StyleSheet.hairlineWidth;

export function TodayModeScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const subs = useAppStore((st) => st.subs);
  const onboarding = useAppStore((st) => st.onboarding);
  const pots = useAppStore((st) => st.pots);
  const currentBalance = useAppStore((st) => st.currentBalance);
  const bufferAmount = useAppStore((st) => st.bufferAmount ?? 100);
  const moneyMode = useAppStore((st) => (st.moneyMode ?? 'survival') as LensMode);
  const debts = useAppStore((st) => st.debts ?? []);
  const household = useAppStore((st) => st.household);
  const plans = useAppStore((st) => st.plans ?? []);
  const subPaused = useAppStore((st) => st.subPaused);
  const monthlyIncome = useAppStore((st) => selectMonthlyIncome(st));
  const { style: chartStyle } = useChartStyle();
  const lens = useLens();
  const hasRealData = useAppStore((st) => hasAnyUserData(st));

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const routeResult = useRoute(now ?? EPOCH);
  const route = now ? routeResult : null;
  const tight = useMemo(
    () => ({
      tightestSpare: route ? route.tightPoint.amount : 0,
      tightestDate: route ? route.tightPoint.date : null,
    }),
    [route],
  );

  const ritualCompletedRecently = useAppStore((st) => {
    const last = st.cycles[0]?.closedAt;
    if (!last || !now) return false;
    const closedAt = new Date(`${last}T00:00:00`).getTime();
    return now.getTime() - closedAt < 24 * 3600 * 1000;
  });

  const debtSummary = useMemo(
    () => debtEngine.summarise(debts, 0, now ?? new Date()),
    [debts, now],
  );
  const householdSafe = household ?? { partnerName: '', defaultShare: 0.5, subShareOverrides: {} };
  const householdSplits = useMemo(
    () =>
      moneyMode === 'household' ? computeBillSplits(subs, subPaused, householdSafe) : undefined,
    [moneyMode, subs, subPaused, householdSafe],
  );
  const plansSummary = useMemo(
    () => (moneyMode === 'planning' ? planEngine.summarisePlans(plans, now ?? new Date()) : null),
    [moneyMode, plans, now],
  );

  const modeState = useMemo(
    () =>
      deriveModeState(moneyMode, {
        currentBalance,
        onboarding,
        pots,
        subs,
        subPaused,
        tightestSpare: tight.tightestSpare,
        tightestDate: tight.tightestDate,
        ritualCompletedRecently,
        ...(now ? { hour: now.getHours() } : {}),
        bufferAmount,
        debts,
        household: householdSafe,
        plans,
      }),
    [
      moneyMode,
      currentBalance,
      onboarding,
      pots,
      subs,
      subPaused,
      tight,
      ritualCompletedRecently,
      now,
      bufferAmount,
      debts,
      householdSafe,
      plans,
    ],
  );

  const amount = modeState.safeZone.amount;
  const animated = useCountUp(amount, 700);
  const [accentWord, ...restVerdict] = modeState.verdict.split(' ');
  const verdictTail = restVerdict.join(' ');

  const monthlyIn = monthlyIncome;
  const monthlyOut = subs
    .filter((sub) => !subPaused[sub.name])
    .reduce((sum, sub) => sum + sub.cost, 0);
  const potsSaved = pots.reduce((sum, p) => sum + Math.max(0, p.saved), 0);
  const potsTarget = pots.reduce((sum, p) => sum + (p.goal ?? 0), 0);
  const daysToPayday = route ? route.daysToPayday : 11;

  const optimizerLeaks = useMemo(
    () =>
      moneyMode === 'optimizer'
        ? computeLeaks({
            currentBalance,
            onboarding,
            pots,
            subs,
            subPaused,
            tightestSpare: tight.tightestSpare,
            tightestDate: tight.tightestDate,
            bufferAmount,
          })
        : undefined,
    [moneyMode, currentBalance, onboarding, pots, subs, subPaused, tight, bufferAmount],
  );

  const cfg = HERO[moneyMode];
  const meloOpener = useMeloOpener(moneyMode);

  const growthPots = useMemo(() => {
    if (moneyMode !== 'growth') return undefined;
    return [...pots]
      .sort((a, b) => (b.goal ?? 0) - (a.goal ?? 0))
      .slice(0, 3)
      .map((p) => {
        const remaining = Math.max(0, (p.goal ?? 0) - Math.max(0, p.saved));
        const weeksToGoal =
          p.perWeek > 0 && remaining > 0
            ? Math.ceil(remaining / p.perWeek)
            : p.perWeek > 0
              ? 0
              : null;
        return {
          id: p.id,
          name: p.name,
          saved: p.saved,
          goal: p.goal ?? 0,
          perWeek: p.perWeek,
          weeksToGoal,
        };
      });
  }, [moneyMode, pots]);

  const ctx: HeroCtx = {
    mode: moneyMode,
    amount,
    animated,
    spareLabel: modeState.spareLabel,
    verdict: modeState.verdict,
    formula: modeState.safeZone.formula,
    bufferAmount,
    currentBalance: currentBalance.amount,
    monthlyIn,
    monthlyOut,
    onboardingMonthlyIncome: onboarding.monthlyIncome,
    subsCount: subs.length,
    potsSaved,
    potsTarget,
    tightestSpare: tight.tightestSpare,
    daysToPayday,
    optimizerLeaks,
    chartStyle,
    confidence: modeState.safeZone.confidence,
    openLogInvoice: () => nav.openSheet('log-invoice'),
    openOnboarding: () => nav.openSheet('onboarding'),
    openAddEvent: () => nav.openSheet('add-event'),
    openAddBill: () => nav.openSheet('add-event', { addEventKind: 'out', addEventTitle: '' }),
    openAddDebt: () => nav.openSheet('declare-debt'),
    openLogPayment: () => nav.openSheet('log-payment'),
    openHouseholdSetup: () => nav.openSheet('household-setup'),
    openPots: () => nav.go('pots'),
    openAddPlan: () => nav.openSheet('add-plan'),
    openSubs: () => nav.go('subs'),
    openRecovery: () => nav.go('recovery'),
    growthPots,
    planProgresses: moneyMode === 'planning' ? plansSummary?.progresses : undefined,
    debtSummary: moneyMode === 'debt' ? debtSummary : undefined,
    householdSplits: moneyMode === 'household' ? householdSplits : undefined,
    householdPartner: moneyMode === 'household' ? householdSafe.partnerName : undefined,
  };

  const heroTone = t[cfg.toneKey] as string;

  return (
    <ScrollView
      style={s.root}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.scrollContent}
    >
      <View style={s.header}>
        <View>
          <Text style={[s.headerDate, { color: t.muted }]}>Today</Text>
          <Pressable accessibilityRole="button" onPress={() => nav.go('ritual')}>
            <Text style={[s.headerDays, { color: t.muted }]}>
              {headerLineFor(moneyMode, daysToPayday)}
            </Text>
          </Pressable>
        </View>
        <View style={s.headerRight}>
          <TrialCountdownChip
            lens={{
              trialCycleId: lens.trialCycleId,
              fullUnlocked: lens.fullUnlocked,
              trialDaysLeft: lens.trialDaysLeft,
            }}
            onPress={() => nav.go('paywall')}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.openSheet('lens-picker')}
            style={[s.lensPill, { backgroundColor: t.surface, borderColor: t.hairline }]}
            accessibilityLabel={`Lens ${moneyMode} — tap to switch lens`}
          >
            <MoneyModeChip mode={moneyMode} />
            <MeloWeatherGlyph weather={modeState.weather} size={12} />
          </Pressable>
        </View>
      </View>

      {/* Status strip — one slot, one pill. Locked lens wins over the sample-numbers chip so the
          paywall message reads first when both apply — mirrors the web's ScreenTodayMode priority
          (PARITY_GAPS.md Group 1). */}
      {!lens.canAccess(moneyMode) ? (
        <LensLockChip
          moneyMode={moneyMode}
          lockedAfterTrial={Boolean(lens.trialEndedCycleId) && !lens.fullUnlocked}
          onPress={() => nav.go('paywall')}
          palette={t}
        />
      ) : !onboarding.done && !hasRealData ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.openSheet('onboarding')}
          style={[s.sampleChip, { backgroundColor: t.inset, borderColor: t.hairline }]}
        >
          <View style={[s.sampleDot, { backgroundColor: t.caution }]} />
          <Text style={[s.sampleText, { color: t.muted }]}>Sample numbers</Text>
          <Text style={[s.sampleText, { color: t.calm }]}>make them yours →</Text>
        </Pressable>
      ) : null}

      {/* Standing What-Changed row — renders only when something changed since the last look
          (lib/whatChanged.ts); tap opens the Timeline and stamps the baseline. */}
      <WhatChangedRow nav={nav} />
      <TrialEndedRow nav={nav} />

      <View style={s.card}>
        <View style={[s.cardInner, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <View style={s.modeRow}>
            <View style={[s.modeDot, { backgroundColor: heroTone }]} />
            <Text style={[s.modeLabel, { color: t.muted }]}>{cfg.label}</Text>
          </View>
          <Text style={[s.headline, { color: t.muted }]}>{cfg.headline}</Text>
          <View style={s.numberRow}>
            <Text style={[s.number, { color: t.ink }]}>
              {moneyMode === 'irregular' || moneyMode === 'lowVis'
                ? Math.round(animated).toLocaleString('en-GB')
                : `£${Math.round(animated).toLocaleString('en-GB')}`}
            </Text>
            <Text style={[s.spareLabel, { color: t.muted }]}>{modeState.spareLabel}</Text>
          </View>
          <Text style={[s.verdict, { color: t.ink }]}>
            <Text style={{ color: heroTone, fontWeight: '600' }}>{accentWord}</Text> {verdictTail}
          </Text>
          <Text style={[s.formula, { color: t.muted }]}>{modeState.safeZone.formula}</Text>

          {cfg.render(ctx, t)}

          <StubDisclaimer mode={moneyMode} balance={currentBalance} />

          <View style={s.calendarCtaRow}>
            {/* Before-you-spend door — the afford-check sheet had no opener anywhere in the app
                (2026-07-10 audit P0-4). Mode-agnostic: the check reads the generic Safe Zone math,
                which holds under every lens. */}
            <HeroCta
              label="Before you spend →"
              tone={t.inset}
              textColor={t.calm}
              bordered
              small
              onPress={() => nav.openSheet('afford-check')}
            />
            <HeroCta
              label="Calendar →"
              tone={t.inset}
              textColor={t.calm}
              bordered
              small
              onPress={() => nav.go('calendar')}
            />
          </View>
        </View>
      </View>

      <TodayNudges
        nav={nav}
        pressure={route ? derivePressure(Math.round(tight.tightestSpare)) : 'calm'}
        tightestSpare={route ? tight.tightestSpare : null}
      />
      <TodayRecentTxns nav={nav} />

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          nav.openMelo({ prefill: `I'm in ${cfg.label.toLowerCase()} — what should I do first?` })
        }
        style={[s.meloPrompt, { backgroundColor: t.inset }]}
      >
        <Melo size={28} mood="curious" />
        <View style={s.meloPromptBody}>
          <Text style={[s.meloPromptLine, { color: t.ink }]}>
            &ldquo;{capFirst(meloOpener)}&rdquo;
          </Text>
          <View style={s.meloPromptMeta}>
            <Text style={[s.meloPromptMetaText, { color: t.muted }]}>{cfg.label} · Melo</Text>
            <Text style={[s.meloPromptCta, { color: t.calm }]}>Ask Melo →</Text>
          </View>
        </View>
      </Pressable>
      {lens.trialCycleId ? null : null}
    </ScrollView>
  );
}

function capFirst(str: string): string {
  const trimmed = str.trimStart();
  if (!trimmed) return str;
  return trimmed[0]!.toUpperCase() + trimmed.slice(1);
}

// Locked-lens status pill — shown instead of the sample-numbers chip when the active Money Mode
// isn't unlocked. Mirrors ScreenTodayMode's status-strip branch: swaps to a soft "trial ended"
// explainer when the lock was caused by a trial that just closed (PARITY_GAPS.md Group 1).
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
      style={[
        lockChipStyles.chip,
        { backgroundColor: palette.inset, borderColor: palette.hairline },
      ]}
    >
      <View style={[lockChipStyles.dot, { backgroundColor: palette.calm }]} />
      <Text style={[lockChipStyles.text, { color: palette.muted }]}>{label}</Text>
      <Text style={[lockChipStyles.text, { color: palette.calm }]}>{cta}</Text>
    </Pressable>
  );
}

const lockChipStyles = StyleSheet.create({
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
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11 },
});

const EPOCH = new Date(0);

// ---------------------------------------------------------------------------
// Small shared hero pieces
// ---------------------------------------------------------------------------

function RowLabel({ left, right, t }: { left: string; right: string; t: Palette }) {
  return (
    <View style={heroStyles.rowLabel}>
      <Text style={[heroStyles.rowLabelLeft, { color: t.muted }]}>{left}</Text>
      <Text style={[heroStyles.rowLabelRight, { color: t.muted }]}>{right}</Text>
    </View>
  );
}

function StatTile({
  label,
  value,
  valueColor,
  t,
}: {
  label: string;
  value: string;
  valueColor?: string | undefined;
  t: Palette;
}) {
  return (
    <View style={[heroStyles.statTile, { backgroundColor: t.inset }]}>
      <Text style={[heroStyles.statLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[heroStyles.statValue, { color: valueColor ?? t.ink }]}>{value}</Text>
    </View>
  );
}

function HeroCta({
  label,
  tone,
  onTone,
  textColor,
  bordered,
  small,
  flex,
  onPress,
}: {
  label: string;
  tone: string;
  onTone?: string | undefined;
  textColor?: string | undefined;
  bordered?: boolean | undefined;
  small?: boolean | undefined;
  flex?: boolean | undefined;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        heroStyles.cta,
        small ? heroStyles.ctaSmall : null,
        flex ? heroStyles.ctaFlex : null,
        { backgroundColor: tone },
        bordered ? heroStyles.ctaBordered : null,
      ]}
    >
      <Text
        style={[
          heroStyles.ctaLabel,
          small ? heroStyles.ctaLabelSmall : null,
          { color: textColor ?? onTone },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const heroStyles = StyleSheet.create({
  block: { marginTop: gap.lg },
  rowLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabelLeft: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  rowLabelRight: { fontSize: 10, fontVariant: ['tabular-nums'] },
  progressGap: { marginTop: gap.sm },
  hint: { marginTop: gap.sm, fontSize: 11 },
  tileRow: { marginTop: gap.md, flexDirection: 'row', gap: gap.sm },
  tile: { flex: 1, borderRadius: radius.md, padding: gap.sm },
  tileLabel: { fontSize: 9.5, letterSpacing: 1.1, textTransform: 'uppercase' },
  tileValue: {
    fontFamily: serif.display,
    fontSize: 15,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  tileValueUnit: { fontSize: 10.5, fontFamily: undefined },
  tileBarTrack: { marginTop: 6, height: 4, borderRadius: 2, overflow: 'hidden' },
  tileBarFill: { height: 4, borderRadius: 2 },
  tileFoot: { marginTop: 4, fontSize: 9.5, fontVariant: ['tabular-nums'] },
  ctaRow: { marginTop: gap.md, flexDirection: 'row', justifyContent: 'center', gap: gap.sm },
  ctaRowCenter: { justifyContent: 'center' },
  cta: {
    height: 36,
    paddingHorizontal: gap.md,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSmall: { height: 30, paddingHorizontal: gap.sm },
  ctaFlex: { flex: 1 },
  ctaBordered: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  ctaLabel: { fontSize: 12, fontWeight: '500' },
  ctaLabelSmall: { fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase' },
  noticeBox: { borderRadius: radius.md, padding: gap.md },
  noticeText: { fontSize: 11.5, lineHeight: 16 },
  noticeCta: { marginTop: gap.md },
  noticeCtaEnd: { marginTop: gap.sm, alignItems: 'flex-end' },
  noticeCtaCenter: { marginTop: gap.sm, alignItems: 'center' },
  noticeEyebrow: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  moveLine: { marginTop: 4, fontFamily: serif.displayItalic, fontSize: 13 },
  tripleRow: { marginTop: gap.md, flexDirection: 'row', gap: gap.sm },
  statTile: { flex: 1, borderRadius: radius.md, padding: gap.sm },
  statLabel: { fontSize: 9.5, letterSpacing: 1.1, textTransform: 'uppercase' },
  statValue: {
    fontFamily: serif.display,
    fontSize: 15,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  italicLine: { marginTop: gap.sm, fontSize: 11, fontStyle: 'italic' },
  italicLineCenter: { fontSize: 11, fontStyle: 'italic', textAlign: 'center' },
  bandRow: { marginTop: gap.sm, flexDirection: 'row', gap: 4 },
  bandCol: { flex: 1 },
  bandTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bandFill: { height: 8, borderRadius: 4 },
  bandLabel: {
    marginTop: 4,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  splitTrack: {
    marginTop: gap.sm,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
  },
  splitFillYou: { height: 12 },
  splitFillThem: { height: 12, opacity: 0.6 },
  splitLegend: {
    marginTop: gap.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitLegendText: { fontSize: 11, fontVariant: ['tabular-nums'] },
  divider: { marginTop: gap.md, borderTopWidth: StyleSheet.hairlineWidth },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: gap.xs + 2,
  },
  splitRowLeft: { flex: 1, paddingRight: gap.sm },
  splitRowName: { fontSize: 13 },
  splitRowMeta: { fontSize: 10.5, fontVariant: ['tabular-nums'], marginTop: 2 },
  splitRowValue: { fontSize: 12, fontVariant: ['tabular-nums'] },
  footRow: {
    marginTop: gap.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leanText: { fontSize: 12, lineHeight: 17 },
  baselineRow: { flexDirection: 'row', alignItems: 'baseline', gap: gap.sm },
  bigNumber: {
    fontFamily: serif.display,
    fontSize: 36,
    lineHeight: 36,
    fontVariant: ['tabular-nums'],
  },
  bigNumberLabel: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  tabularCaption: { marginTop: 4, fontSize: 11, fontVariant: ['tabular-nums'] },
  signalGrid: { marginTop: gap.md, flexDirection: 'row', gap: gap.sm },
  signalCell: { flex: 1, borderRadius: radius.sm, paddingVertical: gap.sm, alignItems: 'center' },
  signalLabel: { fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase' },
  signalStatus: { marginTop: 4, fontSize: 12 },
  signalFooter: { marginTop: gap.md },
});

function makeStyles(t: Palette) {
  return StyleSheet.create({
    root: { flex: 1 },
    scrollContent: { paddingBottom: gap.xxxl },
    header: {
      paddingHorizontal: 28,
      paddingTop: gap.md,
      paddingBottom: gap.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerDate: { fontFamily: serif.displayItalic, fontSize: 13 },
    headerDays: { fontSize: 12, marginTop: 2 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: gap.xs },
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
    sampleChip: {
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
    sampleDot: { width: 6, height: 6, borderRadius: 3 },
    sampleText: { fontSize: 11 },
    card: { marginHorizontal: gap.lg, marginTop: gap.md },
    cardInner: {
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      padding: gap.xl - 4,
    },
    modeRow: { flexDirection: 'row', alignItems: 'center', gap: gap.xs },
    modeDot: { width: 6, height: 6, borderRadius: 3 },
    modeLabel: { fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase' },
    headline: { marginTop: gap.md, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' },
    numberRow: { marginTop: 4, flexDirection: 'row', alignItems: 'baseline', gap: gap.sm },
    number: {
      fontFamily: serif.display,
      fontSize: 56,
      lineHeight: 56,
      fontVariant: ['tabular-nums'],
    },
    spareLabel: { fontFamily: serif.displayItalic, fontSize: 15 },
    verdict: { marginTop: gap.sm, fontFamily: serif.displayItalic, fontSize: 15 },
    formula: { marginTop: 4, fontSize: 10.5, opacity: 0.7 },
    calendarCtaRow: {
      marginTop: gap.md,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: gap.sm,
    },
    meloPrompt: {
      marginHorizontal: gap.lg,
      marginTop: gap.md,
      marginBottom: gap.xxl,
      borderRadius: radius.md,
      padding: gap.lg,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: gap.md,
    },
    meloPromptBody: { flex: 1 },
    meloPromptLine: { fontFamily: serif.displayItalic, fontSize: 13 },
    meloPromptMeta: {
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    meloPromptMetaText: { fontSize: 11.5, flex: 1 },
    meloPromptCta: { fontSize: 11.5, marginLeft: gap.sm },
  });
}
