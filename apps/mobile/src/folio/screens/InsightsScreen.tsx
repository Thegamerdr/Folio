// Native recorded-review Insights surface. The screen is read-only: all figures and branches come
// from the existing recorded-review read and store; navigation and sharing remain existing owners.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { gap, radius, serif, useTheme, type Palette } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { ScreenHeader } from '@/folio/ui/ScreenHeader';
import { useAppStore, type CycleRecord } from '@/folio/store';
import { formatMoney, formatFinancialDate } from '@/folio/lib/financialPresentation';
import { selectRecordedReviews } from '@/folio/lib/recordedReviews';
import { buildInsightsRead, type InsightsRead } from './insightsRead';
import { MODE_LABEL } from '@/folio/lib/modes/types';
import { tinyWinMessage } from '@/folio/lib/wins';
import { useCaughtAnnual, expectedMonthLabel } from '@/folio/lib/caughtAnnual';
import { copy } from '@/folio/copy/copy';
import type { Nav } from '@/folio/types';
import { PERSONAL_WORKSPACE_ID } from '@/folio/lib/workspaceRoot';
import { chartLabelPositions } from './insightsChartLayout';

const BOTTOM_NAV_HEIGHT = 60;
const CONTENT_BOTTOM_BUFFER = 32;
const CHART_PAD_X = 20;
const CHART_PAD_Y = 20;
const DEFAULT_CHART_WIDTH = 312;
const CHART_HEIGHT = 232;
const CHART_HEIGHT_LARGE = 288;
const ROUTE_DASH = 1200;
const ROUTE_DRAW_MS = 2200;
const COUNT_MS = 700;
const AnimatedPath = Animated.createAnimatedComponent(Path);

type ReadableReview = Pick<
  CycleRecord,
  'closedAt' | 'label' | 'spare' | 'tightPoint' | 'setAside' | 'note'
>;

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

function isFiniteMoney(value: number): boolean {
  return Number.isFinite(value);
}

function displayMoney(value: number): string | undefined {
  return isFiniteMoney(value) ? formatMoney(value) : undefined;
}

function recordedForPersonal(
  cycles: readonly CycleRecord[],
  activeWorkspaceId: string,
): CycleRecord[] {
  if (activeWorkspaceId !== PERSONAL_WORKSPACE_ID) return [];
  const workspaceCycles = cycles.filter(
    (cycle) => cycle.workspaceId === undefined || cycle.workspaceId === activeWorkspaceId,
  );
  return selectRecordedReviews(workspaceCycles);
}

export type InsightsScreenProps = { nav: Nav };

export function InsightsScreen({ nav }: InsightsScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [readAttempt, setReadAttempt] = useState(0);

  const cycles = useAppStore((state) => state.cycles);
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const pots = useAppStore((state) => state.pots);
  const moneyMode = useAppStore((state) => state.moneyMode ?? 'survival');
  const subPaused = useAppStore((state) => state.subPaused);
  const tinyWins = useAppStore((state) => state.tinyWins ?? []);
  const cancelledSubs = useAppStore((state) => state.cancelledSubs ?? []);
  const transactions = useAppStore((state) => state.transactions);
  const annualCandidates = useCaughtAnnual();
  const annualCandidate = annualCandidates[0];

  const reviews = useMemo(
    () => recordedForPersonal(cycles, activeWorkspaceId),
    [activeWorkspaceId, cycles],
  );
  const reconstructedReviews = useMemo(
    () =>
      activeWorkspaceId === PERSONAL_WORKSPACE_ID
        ? cycles.filter(
            (cycle) =>
              cycle.reconstructed === true &&
              (cycle.workspaceId === undefined || cycle.workspaceId === activeWorkspaceId),
          )
        : [],
    [activeWorkspaceId, cycles],
  );
  const validReviews = useMemo(
    () => reviews.filter((review) => isFiniteMoney(review.tightPoint)),
    [reviews],
  );
  const latest = reviews[0];
  const prior = reviews[1];
  const potsTotal = useMemo(() => {
    if (activeWorkspaceId !== PERSONAL_WORKSPACE_ID) return undefined;
    const scopedPots = pots.filter(
      (pot) => pot.workspaceId === undefined || pot.workspaceId === activeWorkspaceId,
    );
    if (scopedPots.some((pot) => !isFiniteMoney(pot.saved))) return undefined;
    return scopedPots.reduce((sum, pot) => sum + pot.saved, 0);
  }, [activeWorkspaceId, pots]);
  const averageLow =
    reviews.length > 0 && validReviews.length === reviews.length
      ? reviews.reduce((sum, review) => sum + review.tightPoint, 0) / reviews.length
      : undefined;
  const latestContribution = latest && isFiniteMoney(latest.setAside) ? latest.setAside : undefined;
  const pausedCount = Object.values(subPaused).filter(Boolean).length;
  const scopedTransactions = useMemo(
    () =>
      activeWorkspaceId === PERSONAL_WORKSPACE_ID
        ? transactions.filter(
            (transaction) =>
              transaction.workspaceId === undefined ||
              transaction.workspaceId === activeWorkspaceId,
          )
        : [],
    [activeWorkspaceId, transactions],
  );
  const weeklySpent = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;
    return scopedTransactions
      .filter((transaction) => {
        const when = new Date(transaction.when).getTime();
        return (
          when >= weekAgo &&
          when <= now &&
          transaction.amount < 0 &&
          transaction.financialAction?.kind !== 'transfer'
        );
      })
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  }, [scopedTransactions]);
  const modeLabel = MODE_LABEL[moneyMode];
  const retroMelo = useMemo(() => {
    // This note is authored from review count only. Do not coerce an unknown pot total into a
    // user-visible financial value merely to satisfy the retrospect helper's legacy parameter.
    if (reviews.length < 2) {
      return reviews.length === 1
        ? 'Your first review is recorded. One snapshot is not a trend.'
        : 'Imported estimates remain reference history. Record a review to save your current forecast.';
    }
    return 'Each review saves the forecast as it looked then. It does not record a bank payment or prove a month has passed.';
  }, [reviews]);
  const readState = useMemo(() => {
    try {
      return {
        read: buildInsightsRead({ latest, prior, weeklySpent, quietDays: 0 }),
        failed: false,
      };
    } catch {
      return { read: undefined, failed: true };
    }
  }, [latest, prior, readAttempt, weeklySpent]);

  const branchKey = readState.failed ? 'failure' : reviews.length === 0 ? 'empty' : 'populated';
  const announcedBranch = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (announcedBranch.current === undefined) {
      announcedBranch.current = branchKey;
      return;
    }
    if (announcedBranch.current === branchKey) return;
    announcedBranch.current = branchKey;
    const message =
      branchKey === 'empty'
        ? 'No reviews recorded yet.'
        : branchKey === 'failure'
          ? "Insights aren't available just now."
          : `${reviews.length} recorded ${reviews.length === 1 ? 'review' : 'reviews'}.`;
    AccessibilityInfo.announceForAccessibility(message);
  }, [branchKey, reviews.length]);

  const enter = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
    } else {
      enter.value = withTiming(1, {
        duration: 360,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
    }
  }, [enter, reduceMotion]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * 28 }],
  }));

  const chartReviews = useMemo(() => validReviews.slice(0, 6).reverse(), [validReviews]);
  const chartAverage = chartReviews.length
    ? chartReviews.reduce((sum, review) => sum + review.tightPoint, 0) / chartReviews.length
    : undefined;
  const contentPadding = {
    paddingTop: gap.xl,
    paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + CONTENT_BOTTOM_BUFFER,
  };

  return (
    <Animated.View style={[styles.root, enterStyle]}>
      <View style={[styles.header, { paddingTop: insets.top + gap.sm }]}>
        <ScreenHeader
          onBack={nav.back}
          eyebrow="Insights"
          spacerWidth={44}
          backHitWidth={44}
          backHitHeight={44}
          eyebrowTracking={1.68}
        />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentPadding]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {readState.failed ? (
          <ReadFailure
            onRetry={() => setReadAttempt((value) => value + 1)}
            onBack={nav.back}
            styles={styles}
          />
        ) : reviews.length === 0 ? (
          <EmptyBranch nav={nav} styles={styles} />
        ) : (
          <PopulatedBranch
            nav={nav}
            styles={styles}
            reviews={reviews}
            reconstructedReviews={reconstructedReviews}
            chartReviews={chartReviews}
            chartAverage={chartAverage}
            totalEligibleReviews={validReviews.length}
            latest={latest}
            averageLow={averageLow}
            latestContribution={latestContribution}
            potsTotal={potsTotal}
            read={readState.read!}
            modeLabel={modeLabel}
            retroMelo={retroMelo}
            reduceMotion={reduceMotion}
            pausedCount={pausedCount}
            tinyWins={tinyWins}
            annualCandidate={annualCandidate}
            cancelledSubs={cancelledSubs}
            t={t}
          />
        )}
      </ScrollView>
    </Animated.View>
  );
}

function EmptyBranch({ nav, styles }: { nav: Nav; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.emptyContent}>
      <View style={styles.titleBlock}>
        <Text style={styles.eyebrowItalic}>No reviews recorded yet</Text>
        <Text
          accessibilityRole="header"
          android_hyphenationFrequency="none"
          textBreakStrategy="simple"
          style={styles.headline}
        >
          Your <Text style={styles.headlineAccent}>recorded</Text> reviews{`\u2060`}.
        </Text>
      </View>
      <View style={styles.emptyBlock}>
        <EmptyState
          mood="calm"
          headline="No reviews yet"
          body="After you record a payday review, its saved figures and any note will appear here."
          cta={{ label: 'Back to Today', onPress: () => nav.go('today') }}
        />
      </View>
    </View>
  );
}

function ReadFailure({
  onRetry,
  onBack,
  styles,
}: {
  onRetry: () => void;
  onBack: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.failureContent}>
      <Text accessibilityRole="header" style={styles.failureHeadline}>
        Insights aren't available just now.
      </Text>
      <Text style={styles.failureBody}>Your recorded reviews have not been changed.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again"
        onPress={onRetry}
        style={styles.failureAction}
      >
        <Text style={styles.failureActionText}>Try again</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={styles.failureAction}
      >
        <Text style={styles.failureActionText}>Back</Text>
      </Pressable>
    </View>
  );
}

function PopulatedBranch({
  nav,
  styles,
  reviews,
  reconstructedReviews,
  chartReviews,
  chartAverage,
  totalEligibleReviews,
  latest,
  averageLow,
  latestContribution,
  potsTotal,
  read,
  modeLabel,
  retroMelo,
  reduceMotion,
  pausedCount,
  tinyWins,
  annualCandidate,
  cancelledSubs,
  t,
}: {
  nav: Nav;
  styles: ReturnType<typeof makeStyles>;
  reviews: CycleRecord[];
  reconstructedReviews: CycleRecord[];
  chartReviews: ReadableReview[];
  chartAverage: number | undefined;
  totalEligibleReviews: number;
  latest: CycleRecord | undefined;
  averageLow: number | undefined;
  latestContribution: number | undefined;
  potsTotal: number | undefined;
  read: InsightsRead;
  modeLabel: string;
  retroMelo: string;
  reduceMotion: boolean;
  pausedCount: number;
  tinyWins: any[];
  annualCandidate: any;
  cancelledSubs: any[];
  t: Palette;
}) {
  const { fontScale } = useWindowDimensions();
  const allValid = chartReviews.length > 0;
  const historyReviews = reviews.slice(0, 4);
  return (
    <>
      <View style={styles.titleBlock}>
        <Text
          style={styles.eyebrowItalic}
        >{`${reviews.length} recorded ${reviews.length === 1 ? 'review' : 'reviews'} · ${modeLabel}`}</Text>
        <Text
          accessibilityRole="header"
          android_hyphenationFrequency="none"
          textBreakStrategy="simple"
          style={styles.headline}
        >
          Your <Text style={styles.headlineAccent}>recorded</Text> reviews{`\u2060`}.
        </Text>
      </View>

      <InsightReadBlock read={read} styles={styles} onOpenToday={() => nav.go('today')} />

      <View style={[styles.metrics, fontScale >= 1.3 ? styles.metricsLarge : undefined]}>
        <StatTile
          label="LATEST PAYDAY CASH FORECAST"
          value={latest ? displayMoney(latest.spare) : undefined}
          styles={styles}
        />
        <StatTile
          label="IN POTS RIGHT NOW"
          value={potsTotal === undefined ? undefined : displayMoney(potsTotal)}
          styles={styles}
          positive
        />
        {reviews.length >= 2 ? (
          <StatTile
            label="AVERAGE SAVED FORECAST LOW"
            value={averageLow === undefined ? undefined : formatMoney(averageLow)}
            supportingText={
              totalEligibleReviews > 6
                ? `Across all ${totalEligibleReviews} recorded reviews.`
                : undefined
            }
            styles={styles}
          />
        ) : null}
        <StatTile
          label="POT CONTRIBUTIONS · 30 DAYS BEFORE LATEST REVIEW"
          value={latestContribution === undefined ? undefined : formatMoney(latestContribution)}
          styles={styles}
        />
      </View>

      <Text style={styles.caveat}>
        Payday cash and low points are saved forecasts, not current available money. Pot
        contributions cover the 30 days before the latest review; repeated reviews can cover the
        same deposits. Nothing shown here confirms a bank transfer or debt repayment.
      </Text>

      {allValid && chartReviews.length >= 2 ? (
        <TrendChart
          trend={chartReviews}
          avgTight={chartAverage!}
          totalEligible={totalEligibleReviews}
          styles={styles}
          palette={t}
          reduceMotion={reduceMotion}
          largeText={fontScale >= 1.3}
          fontScale={fontScale}
        />
      ) : null}

      <ReviewHistory reviews={historyReviews} styles={styles} />

      {reconstructedReviews.length > 0 ? (
        <View style={styles.approximateBlock}>
          <Text accessibilityRole="header" style={styles.sectionLabel}>
            Approximate record
          </Text>
          <Text style={styles.mutedText}>
            Imported estimates remain separate from your recorded reviews and headline figures.
          </Text>
        </View>
      ) : null}

      {annualCandidate ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${annualCandidate.merchant}, roughly once a year`}
          onPress={() => nav.openSheet('annual-caught')}
          style={styles.annualCard}
        >
          <Text style={styles.sectionLabel}>{copy.annual.card.eyebrow}</Text>
          <View style={styles.annualRow}>
            <Text style={styles.annualMerchant}>{annualCandidate.merchant}</Text>
            <Text style={styles.metricValue}>{formatMoney(annualCandidate.amount)}</Text>
          </View>
          <Text style={styles.bodyText}>
            {copy.annual.card.body(
              formatMoney(annualCandidate.amount),
              expectedMonthLabel(annualCandidate.lastSeen),
            )}
          </Text>
        </Pressable>
      ) : null}

      {tinyWins.length > 0 ? (
        <View style={styles.tinyWins}>
          <Text style={styles.sectionLabel}>Tiny wins</Text>
          {tinyWins.slice(0, 4).map((win, index, array) => (
            <View
              key={win.id}
              style={[styles.historyRow, index < array.length - 1 ? styles.rowRule : undefined]}
            >
              <Text style={styles.bodyText}>{tinyWinMessage(win)}</Text>
              <Text style={styles.noteDate}>
                {new Date(win.awardedAt).toLocaleDateString('en-GB', { weekday: 'long' })}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.meloBlock}>
        <MeloLine mood="curious" text={retroMelo} />
        {pausedCount > 0 ? (
          <Text
            style={styles.mutedText}
          >{`${pausedCount} ${pausedCount === 1 ? 'subscription' : 'subscriptions'} paused in your forecast. Provider payments are unchanged.`}</Text>
        ) : null}
        {cancelledSubs.length > 0 ? (
          <Text
            style={styles.mutedText}
          >{`${cancelledSubs.length} tracked payment${cancelledSubs.length === 1 ? '' : 's'} removed. Check any cancellation with the provider.`}</Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Share recorded review"
        onPress={() => nav.openSheet('share')}
        style={styles.shareAction}
      >
        <Text style={styles.shareActionText}>Share recorded review</Text>
      </Pressable>
    </>
  );
}

function InsightReadBlock({
  read,
  styles,
  onOpenToday,
}: {
  read: InsightsRead;
  styles: ReturnType<typeof makeStyles>;
  onOpenToday: () => void;
}) {
  return (
    <View style={styles.readBlock}>
      <Text accessibilityRole="header" style={styles.sectionLabel}>
        A CLOSER READ
      </Text>
      <ReadLine label="RECORDED FORECAST" value={read.fact} styles={styles} />
      <ReadLine label="COMPARISON" value={read.pattern} styles={styles} />
      <ReadLine label="INTERPRETATION" value={read.interpretation} styles={styles} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={read.action}
        onPress={onOpenToday}
        style={styles.todayLink}
      >
        <Text style={styles.todayLinkText}>{read.action} →</Text>
      </Pressable>
    </View>
  );
}

function ReadLine({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.readLine}>
      <Text accessibilityRole="header" style={styles.sectionLabel}>
        {label}
      </Text>
      <Text style={styles.narrative}>{value}</Text>
    </View>
  );
}

function StatTile({
  label,
  value,
  supportingText,
  styles,
  positive = false,
}: {
  label: string;
  value: string | undefined;
  supportingText?: string | undefined;
  styles: ReturnType<typeof makeStyles>;
  positive?: boolean;
}) {
  if (value === undefined) return null;
  return (
    <View
      style={styles.metricTile}
      accessible
      accessibilityLabel={`${label}, ${value}${supportingText ? `, ${supportingText}` : ''}`}
    >
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, positive ? styles.positiveValue : undefined]}>{value}</Text>
      {supportingText ? <Text style={styles.metricSupport}>{supportingText}</Text> : null}
    </View>
  );
}

function ReviewHistory({
  reviews,
  styles,
}: {
  reviews: CycleRecord[];
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.historyBlock}>
      <Text accessibilityRole="header" style={styles.sectionLabel}>
        REVIEW HISTORY
      </Text>
      <View style={styles.historyList}>
        {reviews.map((review, index) => (
          <View
            key={`${review.closedAt}-${index}`}
            style={[styles.historyRow, index < reviews.length - 1 ? styles.rowRule : undefined]}
          >
            <Text style={styles.historyDate}>{formatFinancialDate(review.closedAt)} review</Text>
            {displayMoney(review.spare) ? (
              <Text
                style={styles.bodyText}
              >{`Payday cash forecast ${displayMoney(review.spare)}`}</Text>
            ) : null}
            {displayMoney(review.tightPoint) ? (
              <Text
                style={styles.mutedText}
              >{`Saved forecast low ${displayMoney(review.tightPoint)}`}</Text>
            ) : null}
            <Text style={styles.narrative}>{review.note || 'No note this cycle.'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TrendChart({
  trend,
  avgTight,
  totalEligible,
  styles,
  palette,
  reduceMotion,
  largeText,
  fontScale,
}: {
  trend: ReadableReview[];
  avgTight: number;
  totalEligible: number;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  reduceMotion: boolean;
  largeText: boolean;
  fontScale: number;
}) {
  const n = trend.length;
  const [measuredWidth, setMeasuredWidth] = useState<number | undefined>(undefined);
  const plotWidth = measuredWidth ?? DEFAULT_CHART_WIDTH;
  const plotHeight = largeText ? CHART_HEIGHT_LARGE : CHART_HEIGHT;
  const minT = Math.min(...trend.map((review) => review.tightPoint), 0);
  const maxT = Math.max(...trend.map((review) => review.tightPoint), 1);
  const range = Math.max(1, maxT - minT);
  const stepX = n > 1 ? (plotWidth - CHART_PAD_X * 2) / (n - 1) : 0;
  const points = trend.map((review, index) => ({
    review,
    x: CHART_PAD_X + index * stepX,
    y: CHART_PAD_Y + (plotHeight - CHART_PAD_Y * 2) * (1 - (review.tightPoint - minT) / range),
  }));
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
  const avgY = CHART_PAD_Y + (plotHeight - CHART_PAD_Y * 2) * (1 - (avgTight - minT) / range);
  const draw = useSharedValue(reduceMotion ? 0 : ROUTE_DASH);
  useEffect(() => {
    if (reduceMotion) {
      draw.value = 0;
    } else {
      draw.value = ROUTE_DASH;
      draw.value = withTiming(0, { duration: ROUTE_DRAW_MS, easing: Easing.out(Easing.ease) });
    }
  }, [draw, path, reduceMotion]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: draw.value }));
  const chartLabelSize = Math.max(12, 12 * fontScale);
  const isWindowed = totalEligible > n;
  const summary = isWindowed
    ? `Latest 6 of ${totalEligible} reviews`
    : `${n} reviews · average ${formatMoney(avgTight)}`;
  const guideLabel = isWindowed
    ? `Average of these 6 ${formatMoney(avgTight)}`
    : `Review average ${formatMoney(avgTight)}`;
  const axis = axisLabels(trend);
  const pointLabelPositions = chartLabelPositions(
    points.map((point) => ({ x: point.x, y: point.y, text: formatMoney(point.review.tightPoint) })),
    plotWidth,
    plotHeight,
    fontScale,
    CHART_PAD_X,
  );
  const focusWidth = stepX > 0 && stepX < 44 ? stepX : 44;
  const focusHeight = focusWidth < 44 ? 56 : 44;
  return (
    <View style={styles.chartBlock}>
      <Text accessibilityRole="header" style={styles.sectionLabel}>
        SAVED FORECAST LOW POINTS
      </Text>
      <Text
        accessible
        accessibilityLabel={`Saved forecast low points, ${summary}`}
        accessibilityValue={{ text: guideLabel }}
        style={styles.chartSummary}
      >
        {summary}
      </Text>
      {isWindowed ? (
        <Text
          accessible={false}
          style={styles.chartSummary}
        >{`Average of these 6 ${formatMoney(avgTight)}`}</Text>
      ) : null}
      <View style={styles.chartGuideRow}>
        <Text
          testID="insights-chart-guide"
          accessible={false}
          style={[
            styles.chartGuideLabel,
            {
              width: Math.max(1, plotWidth - CHART_PAD_X * 2),
              lineHeight: 16 * fontScale,
            },
          ]}
        >
          {guideLabel}
        </Text>
      </View>
      <View style={[styles.chartViewport, { height: plotHeight }]}>
        <View
          testID="insights-chart-canvas"
          onLayout={(event) => setMeasuredWidth(Math.max(1, event.nativeEvent.layout.width))}
          style={[styles.chartCanvas, { height: plotHeight }]}
        >
          <Svg width={plotWidth} height={plotHeight} viewBox={`0 0 ${plotWidth} ${plotHeight}`}>
            <Defs>
              <LinearGradient id="insights-fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={palette.ink} stopOpacity={0.1} />
                <Stop offset="100%" stopColor={palette.ink} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Line
              x1={CHART_PAD_X}
              x2={plotWidth - CHART_PAD_X}
              y1={avgY}
              y2={avgY}
              stroke={palette.hairline}
              strokeDasharray="2 4"
            />
            <Path
              d={`${path} L ${plotWidth - CHART_PAD_X} ${plotHeight - CHART_PAD_Y} L ${CHART_PAD_X} ${plotHeight - CHART_PAD_Y} Z`}
              fill="url(#insights-fill)"
            />
            <AnimatedPath
              d={path}
              fill="none"
              stroke={palette.muted}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={ROUTE_DASH}
              animatedProps={lineProps}
            />
            {points.map((point, index) => (
              <Circle
                key={`${point.review.closedAt}-${index}`}
                cx={point.x}
                cy={point.y}
                r={index === points.length - 1 ? 4 : 3}
                fill={index === points.length - 1 ? palette.calm : palette.surface}
                stroke={palette.ink}
                strokeWidth={index === points.length - 1 ? 0 : 1.1}
              />
            ))}
            {pointLabelPositions.map((label) => {
              const point = points[label.index]!;
              return (
                <SvgText
                  key={`label-${point.review.closedAt}-${label.index}`}
                  x={label.x}
                  y={label.baseline}
                  fontSize={chartLabelSize}
                  fontFamily="Inter Tight"
                  fill={palette.ink}
                  textAnchor={label.textAnchor}
                >
                  {formatMoney(point.review.tightPoint)}
                </SvgText>
              );
            })}
          </Svg>
          {points.map((point, index) => (
            <View
              key={`focus-${point.review.closedAt}-${index}`}
              accessible
              accessibilityLabel={`${index + 1} of ${n} shown, recorded ${formatFinancialDate(point.review.closedAt)}, saved forecast low ${formatMoney(point.review.tightPoint)}`}
              style={[
                styles.chartPointFocus,
                {
                  width: focusWidth,
                  height: focusHeight,
                  marginLeft: -focusWidth / 2,
                  marginTop: -focusHeight / 2,
                  left: `${(point.x / plotWidth) * 100}%`,
                  top: `${(point.y / plotHeight) * 100}%`,
                },
              ]}
            />
          ))}
        </View>
      </View>
      <View style={styles.axisRow}>
        {axis.labels.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.axisLabel}>
            {label}
          </Text>
        ))}
      </View>
      {axis.sharedCaption ? (
        <Text style={styles.chartSharedCaption}>{axis.sharedCaption}</Text>
      ) : null}
    </View>
  );
}

function axisLabels(reviews: ReadableReview[]): { labels: string[]; sharedCaption?: string } {
  const dates = reviews.map((review) => review.closedAt.slice(0, 10));
  const sameDay = dates.length > 1 && dates.every((date) => date === dates[0]);
  if (sameDay) {
    if (reviews.length === 2)
      return {
        labels: [
          `Earlier · ${formatFinancialDate(reviews[0]!.closedAt).replace(/ \d{4}$/, '')}`,
          `Latest · ${formatFinancialDate(reviews[1]!.closedAt).replace(/ \d{4}$/, '')}`,
        ],
      };
    return {
      labels: reviews.map((_, index) => `Review ${index + 1}`),
      sharedCaption: `Recorded ${formatFinancialDate(reviews[0]!.closedAt)}`,
    };
  }
  return { labels: reviews.map((review) => formatFinancialDate(review.closedAt)) };
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.canvas },
    header: { paddingHorizontal: gap.xl },
    scrollContent: { paddingHorizontal: gap.xl, flexGrow: 1 },
    emptyContent: { flex: 1 },
    failureContent: { flex: 1, paddingTop: gap.xxl },
    titleBlock: { marginTop: gap.sm },
    eyebrowItalic: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 17,
      lineHeight: 24,
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 36,
      lineHeight: 42,
      marginTop: gap.sm,
    },
    headlineAccent: { color: t.calm, fontFamily: serif.display, fontStyle: 'normal' },
    emptyBlock: { flex: 1, minHeight: 360, justifyContent: 'center' },
    failureHeadline: { color: t.ink, fontFamily: serif.display, fontSize: 34, lineHeight: 40 },
    failureBody: { color: t.muted, fontSize: 16, lineHeight: 24, marginTop: gap.md },
    failureAction: {
      alignItems: 'center',
      borderColor: t.hairline,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      justifyContent: 'center',
      marginTop: gap.md,
      minHeight: 48,
      paddingHorizontal: gap.lg,
    },
    failureActionText: { color: t.ink, fontSize: 16, fontWeight: '600' },
    readBlock: { marginTop: gap.xl },
    sectionLabel: {
      color: t.muted,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 1.2,
      lineHeight: 18,
      textTransform: 'uppercase',
    },
    readLine: {
      borderBottomColor: t.hairline,
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingVertical: gap.md,
    },
    narrative: {
      color: t.ink,
      fontFamily: serif.displayItalic,
      fontSize: 18,
      lineHeight: 27,
      marginTop: gap.sm,
    },
    todayLink: { minHeight: 48, justifyContent: 'center', paddingVertical: gap.sm },
    todayLinkText: {
      color: t.calmStrong,
      fontFamily: serif.displayItalic,
      fontSize: 16,
      lineHeight: 24,
    },
    metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.md, marginTop: gap.xxl },
    metricsLarge: { flexDirection: 'column' },
    metricTile: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      flexBasis: '47%',
      flexGrow: 1,
      minWidth: 0,
      padding: gap.lg,
    },
    metricLabel: { color: t.muted, fontSize: 13, lineHeight: 18, textTransform: 'uppercase' },
    metricValue: {
      color: t.ink,
      fontSize: 34,
      fontVariant: ['tabular-nums'],
      fontWeight: '700',
      lineHeight: 38,
      marginTop: gap.sm,
    },
    metricSupport: { color: t.muted, fontSize: 13, lineHeight: 18, marginTop: gap.xs },
    positiveValue: { color: t.positive },
    caveat: { color: t.muted, fontSize: 16, lineHeight: 24, marginTop: gap.xl },
    chartBlock: { marginTop: gap.xxl },
    chartSummary: { color: t.muted, fontSize: 16, lineHeight: 24, marginTop: gap.sm },
    chartGuideRow: { alignItems: 'flex-end', marginTop: gap.xs, width: '100%' },
    chartGuideLabel: {
      color: t.muted,
      fontFamily: 'Inter Tight',
      fontSize: 12,
      textAlign: 'right',
    },
    chartViewport: { marginTop: gap.md, position: 'relative', width: '100%' },
    // The measured plot owns the full target height; SVG and focus targets use its same native
    // coordinate space, so font scaling changes plot height without distorting glyphs.
    chartCanvas: { position: 'relative', width: '100%' },
    chartPointFocus: {
      height: 44,
      marginLeft: -22,
      marginTop: -22,
      position: 'absolute',
      width: 44,
    },
    axisRow: {
      flexDirection: 'row',
      gap: gap.xs,
      justifyContent: 'space-between',
      marginTop: gap.sm,
    },
    axisLabel: { color: t.muted, flex: 1, fontSize: 12, lineHeight: 16, textAlign: 'center' },
    chartSharedCaption: {
      color: t.muted,
      fontSize: 12,
      lineHeight: 16,
      marginTop: gap.xs,
      textAlign: 'center',
    },
    historyBlock: { marginTop: gap.xxl },
    approximateBlock: { marginTop: gap.xxl },
    historyList: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.md,
      overflow: 'hidden',
    },
    historyRow: { paddingHorizontal: gap.lg, paddingVertical: gap.lg },
    rowRule: { borderBottomColor: t.hairline, borderBottomWidth: StyleSheet.hairlineWidth },
    historyDate: { color: t.ink, fontSize: 16, fontWeight: '600', lineHeight: 24 },
    bodyText: { color: t.ink, fontSize: 16, lineHeight: 24, marginTop: gap.xs },
    mutedText: { color: t.muted, fontSize: 13, lineHeight: 18, marginTop: gap.xs },
    noteDate: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      lineHeight: 18,
      marginTop: gap.xs,
    },
    annualCard: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.xxl,
      padding: gap.lg,
    },
    annualRow: {
      alignItems: 'baseline',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: gap.sm,
    },
    annualMerchant: { color: t.ink, fontSize: 16, fontWeight: '600' },
    tinyWins: { marginTop: gap.xxl },
    meloBlock: { gap: gap.sm, marginTop: gap.xxl },
    shareAction: {
      alignItems: 'center',
      backgroundColor: t.ink,
      borderRadius: radius.xxl,
      justifyContent: 'center',
      marginTop: gap.xxl,
      minHeight: 48,
    },
    shareActionText: { color: t.inverse, fontSize: 16, fontWeight: '600', lineHeight: 20 },
  });
}
