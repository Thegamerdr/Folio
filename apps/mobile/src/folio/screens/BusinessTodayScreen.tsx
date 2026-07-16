import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gap, pressed, radius, serif, useTheme } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { useAppStore } from '@/folio/store';
import { buildBusinessCashPosition } from '@/folio/lib/businessCashPosition';
import { deriveCalendarEvents } from '@/folio/lib/calendarEvents';
import type { Nav } from '@/folio/types';

export function BusinessTodayScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const workspace = useAppStore(
    (state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId)!,
  );
  // Zustand selectors must return referentially stable snapshots. Keep raw store arrays in hooks and
  // derive projections in memo blocks; returning a freshly filtered array here caused a physical
  // Android maximum-update-depth crash during the first workspace pass.
  const accounts = useAppStore((state) => state.accounts ?? []);
  const transactions = useAppStore((state) => state.transactions);
  const reviewCount = useAppStore(
    (state) =>
      state.readerCandidates.length +
      (state.reviewQueue?.length ?? 0) +
      (state.reviewQueueSpillover?.length ?? 0),
  );
  const statementCount = useAppStore((state) => state.statementImports?.length ?? 0);
  const subs = useAppStore((state) => state.subs);
  const subPaused = useAppStore((state) => state.subPaused);
  const subOverrides = useAppStore((state) => state.subOverrides);
  const onboarding = useAppStore((state) => state.onboarding);
  const calendarEvents = useAppStore((state) => state.calendarEvents);
  const pots = useAppStore((state) => state.pots);
  const incomeSources = useAppStore((state) => state.incomeSources ?? []);
  const now = useMemo(() => new Date(), []);
  const upcomingEvents = useMemo(
    () =>
      deriveCalendarEvents({
        subs,
        subPaused,
        subOverrides,
        onboarding,
        manualEvents: calendarEvents,
        pots,
        incomeSources,
        includeSampleBills: false,
        windowDays: 35,
        now,
      }),
    [subs, subPaused, subOverrides, onboarding, calendarEvents, pots, incomeSources, now],
  );
  const position = useMemo(
    () => buildBusinessCashPosition({ accounts, transactions, upcomingEvents, now }),
    [accounts, transactions, upcomingEvents, now],
  );
  const accountCount = useMemo(
    () => accounts.filter((account) => account.closed !== true).length,
    [accounts],
  );
  const hasRecords =
    accountCount > 0 ||
    transactions.length > 0 ||
    statementCount > 0 ||
    reviewCount > 0 ||
    upcomingEvents.length > 0;

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.sm, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.headerDate, { color: t.muted }]}>
            {now.toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
          <View style={styles.headerRight}>
            <Text style={[styles.workspaceKind, { color: t.muted }]}>Business</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open Melo for ${workspace.name}`}
              onPress={() =>
                nav.openMelo({
                  seed: `I'm looking only at ${workspace.name}. What would you like to check?`,
                })
              }
              style={({ pressed: isPressed }) => [
                styles.meloButton,
                { backgroundColor: t.surface, borderColor: t.hairline },
                isPressed ? pressed : undefined,
              ]}
            >
              <Melo mood={hasRecords ? 'curious' : 'calm'} size={22} />
            </Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>{workspace.name}</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {hasRecords ? 'This is your working cash.' : 'Build your working cash picture.'}
          </Text>
          <Text style={[styles.intro, { color: t.muted }]}>
            {hasRecords
              ? 'What is confirmed now, followed by the dated commitments already on the books.'
              : 'Add the accounts and regular costs you rely on. Melo will map what is available now and what the next 35 days need.'}
          </Text>
        </View>

        {hasRecords ? (
          <View style={styles.position}>
            <Text style={[styles.positionLabel, { color: t.muted }]}>Current business cash</Text>
            <Text
              accessibilityLabel={`${formatGbp(position.cashBalance)} current business cash balance`}
              style={[styles.money, { color: t.ink }]}
            >
              {formatGbp(position.cashBalance)}
            </Text>
            <Text style={[styles.positionHint, { color: t.muted }]}>across non-card accounts</Text>
            <View style={[styles.metrics, { backgroundColor: t.inset }]}>
              <Metric label="Accounts" value={accountCount} />
              <Metric label="Activity" value={transactions.length} />
              <Metric label="To review" value={reviewCount} />
            </View>
          </View>
        ) : (
          <View style={[styles.emptyWell, { backgroundColor: t.inset }]}>
            <Text style={[styles.emptyEyebrow, { color: t.muted }]}>Your first business view</Text>
            <Text style={[styles.emptyTitle, { color: t.ink }]}>
              See the next 35 days together.
            </Text>
            <Text style={[styles.emptyBody, { color: t.muted }]}>
              Current cash, dated money in and committed money out—built only from amounts you have
              reviewed.
            </Text>
          </View>
        )}

        {hasRecords ? (
          <View style={[styles.forecast, { backgroundColor: t.inset }]}>
            <View style={styles.forecastHeader}>
              <View style={styles.forecastHeaderCopy}>
                <Text style={[styles.forecastEyebrow, { color: t.muted }]}>Next 35 days</Text>
                <Text style={[styles.forecastTitle, { color: t.ink }]}>Dated cash position</Text>
              </View>
              <Text style={[styles.forecastValue, { color: t.ink }]}>
                {formatGbp(position.projectedCash)}
              </Text>
            </View>
            {upcomingEvents.length > 0 ? (
              <>
                <View style={[styles.forecastRows, { borderTopColor: t.hairline }]}>
                  <ForecastRow label="Confirmed money in" value={position.upcomingIncome} />
                  <ForecastRow label="Committed money out" value={-position.upcomingCommitments} />
                </View>
                <Text style={[styles.forecastNote, { color: t.muted }]}>
                  {position.nextCommitmentDate
                    ? `Next dated commitment ${formatBusinessDate(position.nextCommitmentDate)}.`
                    : 'No dated outgoing commitment is recorded in this window.'}
                </Text>
              </>
            ) : (
              <Text style={[styles.forecastNote, { color: t.muted }]}>
                No dated income or commitment is recorded yet. Add one in Calendar; Melo will not
                guess it.
              </Text>
            )}
            <View style={[styles.runway, { borderTopColor: t.hairline }]}>
              <Text style={[styles.runwayLabel, { color: t.ink }]}>Operating runway</Text>
              <Text style={[styles.runwayValue, { color: t.muted }]}>
                {position.runwayDays === null
                  ? 'Needs 3 confirmed expenses across at least 14 days'
                  : `${position.runwayDays} days at the confirmed expense pace`}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Action
            label={accountCount === 0 ? 'Add an account' : 'Review business accounts'}
            hint="Build this workspace from a real balance"
            onPress={() => nav.go('account')}
            emphasis={accountCount === 0}
          />
          <Action
            label="Read a statement or receipt"
            hint="Review every imported amount before it counts"
            onPress={() => nav.go('intake')}
          />
          <Action
            label="Ask Melo"
            hint="Talk through this business picture only"
            onPress={() =>
              nav.openMelo({
                seed: `I'm looking only at ${workspace.name}. What would you like to check?`,
              })
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

function ForecastRow({ label, value }: { label: string; value: number }) {
  const t = useTheme();
  return (
    <View style={styles.forecastRow}>
      <Text style={[styles.forecastRowLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.forecastRowValue, { color: t.ink }]}>{formatSignedGbp(value)}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const t = useTheme();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: t.ink }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

function Action({
  label,
  hint,
  onPress,
  emphasis = false,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  emphasis?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        emphasis ? styles.actionPrimary : undefined,
        {
          backgroundColor: emphasis ? t.calm : 'transparent',
          borderBottomColor: emphasis ? 'transparent' : t.hairline,
          opacity: pressed ? 0.62 : 1,
        },
      ]}
    >
      <View style={styles.actionCopy}>
        <Text style={[styles.actionLabel, { color: emphasis ? t.inverse : t.ink }]}>{label}</Text>
        <Text style={[styles.actionHint, { color: emphasis ? t.inverse : t.muted }]}>{hint}</Text>
      </View>
      <Text
        accessibilityElementsHidden
        style={[styles.arrow, { color: emphasis ? t.inverse : t.calmStrong }]}
      >
        →
      </Text>
    </Pressable>
  );
}

function formatGbp(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: Math.abs(value % 1) < 0.005 ? 0 : 2,
  }).format(value);
}

function formatSignedGbp(value: number): string {
  const formatted = formatGbp(Math.abs(value));
  return `${value >= 0 ? '+' : '−'}${formatted}`;
}

function formatBusinessDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 28 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerDate: { fontFamily: serif.displayItalic, fontSize: 13 },
  headerRight: { alignItems: 'center', flexDirection: 'row', gap: gap.sm },
  workspaceKind: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.7 },
  meloButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  hero: { marginTop: gap.lg },
  eyebrow: { fontFamily: serif.displayItalic, fontSize: 13 },
  headline: {
    fontFamily: serif.display,
    fontSize: 32,
    letterSpacing: -0.35,
    lineHeight: 37,
    marginTop: gap.xs,
  },
  intro: { fontSize: 13.5, lineHeight: 20, marginTop: gap.sm, maxWidth: 520 },
  position: { marginTop: gap.xl },
  positionLabel: { fontSize: 12, letterSpacing: 0.9, textTransform: 'uppercase' },
  money: {
    fontFamily: serif.display,
    fontSize: 52,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.6,
    lineHeight: 58,
    marginTop: gap.sm,
  },
  positionHint: { fontSize: 11.5, marginTop: gap.xs },
  metrics: {
    borderRadius: radius.lg,
    flexDirection: 'row',
    marginTop: gap.lg,
    padding: gap.md,
  },
  metric: { flex: 1 },
  metricValue: { fontSize: 18, fontVariant: ['tabular-nums'], fontWeight: '600' },
  metricLabel: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  emptyWell: { borderRadius: radius.xl, marginTop: gap.xl, padding: gap.xl },
  emptyEyebrow: { fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase' },
  emptyTitle: {
    fontFamily: serif.medium,
    fontSize: 20,
    lineHeight: 25,
    marginTop: gap.xs,
  },
  emptyBody: { fontSize: 13.5, lineHeight: 20, marginTop: gap.sm },
  forecast: { borderRadius: radius.xl, marginTop: gap.md, padding: gap.xl },
  forecastHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  forecastHeaderCopy: { flex: 1, paddingRight: gap.md },
  forecastEyebrow: { fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase' },
  forecastTitle: { fontFamily: serif.medium, fontSize: 19, lineHeight: 24, marginTop: gap.xs },
  forecastValue: { fontSize: 19, fontVariant: ['tabular-nums'], fontWeight: '600' },
  forecastRows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: gap.sm,
    marginTop: gap.lg,
    paddingTop: gap.md,
  },
  forecastRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  forecastRowLabel: { flex: 1, fontSize: 12.5, lineHeight: 17, paddingRight: gap.md },
  forecastRowValue: { fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '600' },
  forecastNote: { fontSize: 11.5, lineHeight: 17, marginTop: gap.md },
  runway: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: gap.lg,
    paddingTop: gap.md,
  },
  runwayLabel: { fontSize: 12.5, fontWeight: '600' },
  runwayValue: { fontSize: 11.5, lineHeight: 17, marginTop: gap.xs },
  actions: { marginTop: gap.xl },
  action: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 68,
    paddingVertical: gap.md,
  },
  actionPrimary: {
    borderBottomWidth: 0,
    borderRadius: radius.xl,
    marginBottom: gap.sm,
    minHeight: 58,
    paddingHorizontal: gap.lg,
  },
  actionCopy: { flex: 1, paddingRight: gap.lg },
  actionLabel: { fontSize: 14.5, fontWeight: '600', lineHeight: 19 },
  actionHint: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  arrow: { fontSize: 18 },
});
