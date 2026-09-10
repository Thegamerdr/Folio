/**
 * @rn-screen    TodayStabilityScreen
 * @rn-stack     MainTabs > Today (mode=stability)
 * @purpose      Calm, month-shaped answer to "am I still safe?" for users whose bills are covered
 *               and who want visibility, not urgency. Anchors on Safe Zone (bills covered + buffer
 *               intact) and a weekly bill-rhythm strip — the opposite of Survival's tightest-point
 *               countdown. Faithful 1:1 RN port of the web design source (folio-melo/.claude/
 *               worktrees/design-main/src/components/folio/screens/ScreenTodayStability.tsx).
 * @reads        bufferAmount, currentBalance, pots, subs, onboarding, cycles (via the store + the
 *               real modes engine)
 * @writes       — (nav + sheet opens only)
 * @opens-sheet  log-spend, melo-chat, onboarding, lens-picker, safe-zone + afford-check (the
 *               flagship-check doors in the CTA row — NOT the hero: see the hero comment for why
 *               its number must not claim the generic decomposition)
 * @copy         mode-specific — verdict/spare-label come from `deriveModeState('stability', ...)`
 * @tokens       paper · surface · inset · ink · calm(accent) · positive · hairline · muted ·
 *               Fraunces headlines · tabular money
 * @motion       count-up 700ms · press .97/120ms · respects reduce-motion
 * @melo-mood    from modeState (Stability rarely reaches concern)
 * @notes        Sibling to TodayScreen (Survival). Shared header/sample-chip/nudges/recent are
 *               reused verbatim so the shell reads as one product.
 */

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { shouldStackTextRows } from '@/folio/lib/readableLayout';

import { gap, radius, serif, useTheme, type Palette } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { useAppStore } from '@/folio/store';
import { useRoute } from '@/folio/lib/storeRoute';
import { useDayClock } from '@/folio/lib/useDayClock';
import { hasAnyUserData, selectMonthlyIncome } from '@/folio/lib/income';
import { buildFinancialPlanFromState } from '@/folio/lib/financialPlan';
import {
  selectFinancialPresentation,
  formatMoney,
  financialAmountLabel,
} from '@/folio/lib/financialPresentation';
import { FinancialSetupNotice } from '@/folio/ui/FinancialSetupNotice';
import { presentStabilityCanonicalPlan } from '@/folio/lib/stabilityPresentation';
import { useMeloOpener } from '@/folio/lib/useMeloOpener';
import { useChartStyle } from '@/folio/lib/chartStyle';
import { LensRhythm } from '@/folio/ui/LensRhythm';
import { MoneyModeChip } from '@/folio/ui/MoneyModeChip';
import { MeloWeatherGlyph } from '@/folio/ui/MeloWeatherGlyph';
import { TrialCountdownChip } from '@/folio/ui/TrialCountdownChip';
import { TrialEndedRow } from '@/folio/ui/TrialEndedRow';
import { WhatChangedRow } from '@/folio/ui/WhatChangedRow';
import { deriveModeState, type MoneyMode } from '@/folio/lib/modes';
import { useLens } from '@/folio/lib/lens';
import type { Nav } from '@/folio/types';

import { formatGBP } from './today/format';
import { derivePressure } from './today/pressure';
import { TodayNudges } from './today/TodayNudges';
import { TodayRecentTxns } from './today/TodayRecentTxns';

const EPOCH = new Date(0);
const WEEKS = 4;

const BALANCE_SOURCE_LABEL: Record<string, string> = {
  'user-entered': 'you set this',
  statement: 'from your last statement',
  'pdf-derived': 'from a statement you added',
  'ocr-derived': 'from a photo you added',
  corrected: 'you corrected this',
  sample: 'sample data',
};

export function TodayStabilityScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { width, fontScale } = useWindowDimensions();

  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);
  const onboarding = useAppStore((st) => st.onboarding);
  const pots = useAppStore((st) => st.pots);
  const currentBalance = useAppStore((st) => st.currentBalance);
  const bufferAmount = useAppStore((st) => st.bufferAmount ?? 100);
  const monthlyIncome = useAppStore((st) => selectMonthlyIncome(st));
  const hasRealData = useAppStore((st) => hasAnyUserData(st));
  const { style: chartStyle } = useChartStyle();
  const lens = useLens();
  const stackHeader =
    shouldStackTextRows(width, fontScale) ||
    Boolean(lens.trialCycleId && !lens.fullUnlocked && lens.trialDaysLeft !== null);

  const now = useDayClock();
  const appState = useAppStore((st) => st);
  const financialPlan = useMemo(
    () => (now ? buildFinancialPlanFromState(appState, { now }) : null),
    [appState, now],
  );
  const financePresentation = selectFinancialPresentation(appState, financialPlan);

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

  const modeState = useMemo(
    () =>
      deriveModeState('stability', {
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
      }),
    [
      currentBalance,
      onboarding,
      pots,
      subs,
      subPaused,
      tight,
      ritualCompletedRecently,
      now,
      bufferAmount,
    ],
  );

  // Stability's headline must share the same protected, dated plan as Debts/Safe Zone. The
  // strategy's month proxy omits essentials and debt minimums, so it can overstate a user's room.
  // Keep the strategy's framing/weather when the route is unavailable during the mount gate, then
  // replace the amount and claims with the canonical protected result as soon as it is available.
  const canonicalSafeToSpend = route?.safeToSpend;
  const canonicalPresentation = presentStabilityCanonicalPlan(canonicalSafeToSpend, bufferAmount);
  const presentedModeState =
    canonicalPresentation === null
      ? modeState
      : {
          ...modeState,
          safeZone: {
            ...modeState.safeZone,
            amount: canonicalPresentation.amount,
            formula: canonicalPresentation.formula,
          },
          verdict: canonicalPresentation.verdict,
          weather: canonicalPresentation.negative ? 'storm' : modeState.weather,
        };
  const weeks = useMemo(() => {
    const buckets = Array.from({ length: WEEKS }, () => ({ total: 0, count: 0 }));
    subs
      .filter((sub) => !subPaused[sub.name])
      .filter((sub) => sub.nextRenewalDaysAway >= 0 && sub.nextRenewalDaysAway < WEEKS * 7)
      .forEach((sub) => {
        const w = Math.min(WEEKS - 1, Math.floor(sub.nextRenewalDaysAway / 7));
        buckets[w]!.total += sub.cost;
        buckets[w]!.count += 1;
      });
    return buckets;
  }, [subs, subPaused]);
  const upcomingCount = weeks.reduce((n, w) => n + w.count, 0);
  const heaviest = weeks.reduce((iMax, w, i, arr) => (w.total > arr[iMax]!.total ? i : iMax), 0);

  const [accentWord, ...restVerdict] = (
    financePresentation.canReassure ? presentedModeState.verdict : financePresentation.label
  ).split(' ');
  const verdictTail = restVerdict.join(' ');

  const balanceSourceLabel = BALANCE_SOURCE_LABEL[currentBalance.source] ?? 'sample data';

  const monthlyIn = monthlyIncome;
  const monthlyOut = subs
    .filter((sub) => !subPaused[sub.name])
    .reduce((sum, sub) => sum + sub.cost, 0);
  const daysToPayday = route ? route.daysToPayday : 0;

  const meloOpener = useMeloOpener('stability');

  if (!financePresentation.complete || !financialPlan?.nextIncomeDate) {
    return (
      <ScrollView style={s.root} contentContainerStyle={s.scrollContent}>
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.openSheet('lens-picker')}
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Text style={{ color: t.ink }}>Today · change Stability lens</Text>
        </Pressable>
        <FinancialSetupNotice
          state={appState}
          plan={financialPlan}
          onSetup={() => nav.openSheet('onboarding')}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={s.root}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.scrollContent}
    >
      <View style={[s.header, stackHeader && s.headerStacked]}>
        <View style={[s.headerText, stackHeader && s.headerTextStacked]}>
          <Text style={[s.headerDate, { color: t.muted }]}>Today</Text>
          <Pressable accessibilityRole="button" onPress={() => nav.go('ritual')}>
            <Text style={[s.headerDays, { color: t.muted }]}>{daysToPayday} days to payday →</Text>
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
            accessibilityLabel="Lens stability — tap to switch lens"
          >
            <MoneyModeChip mode="stability" />
            <MeloWeatherGlyph weather={presentedModeState.weather} size={12} />
          </Pressable>
        </View>
      </View>

      {/* Status strip — Stability is a free lens so it can never be locked, but the strip keeps the
          same priority shape as Survival/parked-lens Today for consistency (PARITY_GAPS.md Group 1). */}
      {!lens.canAccess('stability') ? (
        <LensLockChip
          moneyMode="stability"
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
          <Text style={[s.sampleText, { color: t.muted }]}>Add your money</Text>
          <Text style={[s.sampleText, { color: t.calm }]}>finish setup →</Text>
        </Pressable>
      ) : null}

      {/* Standing What-Changed row — renders only when something changed since the last look
          (lib/whatChanged.ts); tap opens the Timeline and stamps the baseline. */}
      <WhatChangedRow nav={nav} />
      <TrialEndedRow nav={nav} />

      <View style={s.card}>
        <View style={[s.cardInner, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <View style={s.modeRow}>
            <View style={[s.modeDot, { backgroundColor: t.positive }]} />
            <Text style={[s.modeLabel, { color: t.muted }]}>Stability Mode</Text>
          </View>

          {/* The hero stays non-interactive and reads the canonical protected plan when available.
              The Safe Zone door below remains the place to inspect the dated commitments. */}
          <Text style={[s.headline, { color: t.muted }]}>
            {financialAmountLabel(financialPlan, financePresentation)}
          </Text>
          <View style={s.numberRow}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              numberOfLines={1}
              style={[s.number, { color: t.ink }]}
            >
              {formatMoney(financialPlan.safeToSpendMinor / 100)}
            </Text>
          </View>
          <Text style={[s.verdict, { color: t.ink }]}>
            <Text
              style={{
                color: !financePresentation.canReassure ? t.caution : t.positive,
                fontWeight: '600',
              }}
            >
              {accentWord}
            </Text>{' '}
            {verdictTail}
          </Text>
          {/* The strategy owns the whole caption (incl. the buffer claim) so it can never
              contradict its own accounting — see stability.ts `formula`. */}
          <Text style={[s.formula, { color: t.muted }]}>{financePresentation.message}</Text>

          <View style={s.rhythmBlock}>
            <View style={s.rhythmHeaderRow}>
              <Text style={[s.rhythmEyebrow, { color: t.muted }]}>Next 4 weeks</Text>
              <Text style={[s.rhythmCount, { color: t.muted }]}>
                {upcomingCount} bills scheduled
              </Text>
            </View>
            <View style={s.rhythmChart}>
              <LensRhythm
                segments={weeks.map((w, i) => ({
                  label: i === 0 ? 'this' : `wk ${i + 1}`,
                  value: w.total,
                }))}
                style={chartStyle}
                tone={t.muted}
                peakAccent
              />
            </View>
            <View style={s.rhythmValuesRow}>
              {weeks.map((w, i) => (
                <Text key={i} style={[s.rhythmValue, { color: t.ink }]}>
                  {w.total > 0 ? formatGBP(w.total) : '—'}
                </Text>
              ))}
            </View>
            {weeks[heaviest]!.total > 0 ? (
              <Text style={[s.rhythmFoot, { color: t.muted }]}>
                Heaviest week: {heaviest === 0 ? 'this one' : `week ${heaviest + 1}`} ·{' '}
                {formatGBP(weeks[heaviest]!.total)}
              </Text>
            ) : null}
          </View>

          <View style={s.monthShapeRow}>
            {(
              [
                { label: 'Coming in', value: monthlyIn, tone: t.positive },
                { label: 'Bills', value: monthlyOut, tone: t.muted },
                { label: 'Buffer', value: bufferAmount, tone: t.ink },
              ] as const
            ).map((cell) => (
              <View key={cell.label} style={[s.monthShapeCell, { backgroundColor: t.inset }]}>
                <Text style={[s.monthShapeLabel, { color: t.muted }]}>{cell.label}</Text>
                <Text style={[s.monthShapeValue, { color: cell.tone }]}>
                  {formatGBP(cell.value)}
                </Text>
              </View>
            ))}
          </View>

          <Text style={[s.balanceCaption, { color: t.muted }]}>
            starting from £{currentBalance.amount.toLocaleString('en-GB')} · {balanceSourceLabel}
          </Text>

          <View style={s.calendarCtaRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Before you spend — check a spend against your Safe Zone"
              onPress={() => nav.openSheet('afford-check')}
              style={[s.calendarCta, { backgroundColor: t.inset }]}
            >
              <Text style={[s.calendarCtaLabel, { color: t.calm }]}>Before you spend →</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Your Safe Zone — the decomposition, with an editable buffer"
              onPress={() => nav.openSheet('safe-zone')}
              style={[s.calendarCta, { backgroundColor: t.inset }]}
            >
              <Text style={[s.calendarCtaLabel, { color: t.calm }]}>Your Safe Zone →</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => nav.go('calendar')}
              style={[s.calendarCta, { backgroundColor: t.inset }]}
            >
              <Text style={[s.calendarCtaLabel, { color: t.calm }]}>Calendar →</Text>
            </Pressable>
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
        onPress={() => nav.openMelo({ prefill: "What's changing in the next month?" })}
        style={[s.meloPrompt, { backgroundColor: t.inset }]}
      >
        <Melo size={28} mood="calm" />
        <View style={s.meloPromptBody}>
          <Text style={[s.meloPromptLine, { color: t.ink }]}>
            &ldquo;{capFirst(meloOpener)}&rdquo;
          </Text>
          <View style={s.meloPromptMeta}>
            <Text style={[s.meloPromptMetaText, { color: t.muted }]}>Stability · Melo</Text>
            <Text style={[s.meloPromptCta, { color: t.calm }]}>Ask Melo →</Text>
          </View>
        </View>
      </Pressable>
    </ScrollView>
  );
}

function capFirst(str: string): string {
  const trimmed = str.trimStart();
  if (!trimmed) return str;
  return trimmed[0]!.toUpperCase() + trimmed.slice(1);
}

// Locked-lens status pill — see TodayModeScreen's twin for the full rationale (PARITY_GAPS.md
// Group 1). Stability is a free lens so this branch is inert today, but keeps the same
// status-strip shape as its Today siblings.
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
    headerStacked: { flexDirection: 'column', alignItems: 'stretch', gap: gap.sm },
    headerText: { flex: 1, minWidth: 0 },
    headerTextStacked: { flex: 0, width: '100%' },
    headerDate: { fontFamily: serif.displayItalic, fontSize: 13 },
    headerDays: { fontSize: 12, marginTop: 2 },
    headerRight: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: gap.xs,
      maxWidth: '100%',
    },
    lensPill: {
      minHeight: 44,
      maxWidth: '100%',
      flexShrink: 1,
      paddingVertical: gap.xs,
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
      flexShrink: 1,
      lineHeight: 56,
      fontVariant: ['tabular-nums'],
    },
    spareLabel: { fontFamily: serif.displayItalic, fontSize: 15 },
    verdict: { marginTop: gap.sm, fontFamily: serif.displayItalic, fontSize: 15 },
    formula: { marginTop: 4, fontSize: 10.5, opacity: 0.7 },
    rhythmBlock: { marginTop: gap.lg },
    rhythmHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rhythmEyebrow: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
    rhythmCount: { fontSize: 10, fontVariant: ['tabular-nums'] },
    rhythmChart: { marginTop: gap.md },
    rhythmValuesRow: { marginTop: gap.sm, flexDirection: 'row', justifyContent: 'space-between' },
    rhythmValue: {
      flex: 1,
      textAlign: 'center',
      fontFamily: serif.display,
      fontSize: 11,
      opacity: 0.8,
      fontVariant: ['tabular-nums'],
    },
    rhythmFoot: { marginTop: gap.sm, fontSize: 10.5, textAlign: 'center' },
    monthShapeRow: { marginTop: gap.lg, flexDirection: 'row', gap: gap.sm },
    monthShapeCell: { flex: 1, borderRadius: radius.md, padding: gap.sm, alignItems: 'center' },
    monthShapeLabel: { fontSize: 9.5, letterSpacing: 1.1, textTransform: 'uppercase' },
    monthShapeValue: {
      marginTop: 4,
      fontFamily: serif.display,
      fontSize: 16,
      fontVariant: ['tabular-nums'],
    },
    balanceCaption: { marginTop: gap.md, fontSize: 10.5, opacity: 0.7, textAlign: 'center' },
    calendarCtaRow: {
      marginTop: gap.md,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: gap.sm,
    },
    calendarCta: {
      height: 28,
      paddingHorizontal: gap.md,
      borderRadius: 999,
      justifyContent: 'center',
    },
    calendarCtaLabel: { fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase' },
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
