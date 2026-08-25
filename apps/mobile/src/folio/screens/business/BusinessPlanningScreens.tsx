import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { businessDeadlines, type BusinessDeadline } from '@folio/business-workspace';

import { MeloCompanionHost } from '@/folio/ui/MeloCompanionHost';
import { useAppStore } from '@/folio/store';
import { gap, radius, serif, useTheme, weightFamily } from '@/folio/theme';
import type { Nav, ScreenId } from '@/folio/types';
import {
  BusinessCard,
  BusinessMetric,
  BusinessPrimaryAction,
  BusinessRouteRow,
  BusinessScreenFrame,
  BusinessSecondaryAction,
  BusinessSectionTitle,
  formatMinor,
} from './BusinessUi';
import { useBusinessOperations } from './useBusinessOperations';

export function BusinessCalendarScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const business = useBusinessOperations();
  const melo = useAppStore((state) => state.melo ?? { quietMode: false, wardrobe: [] });
  const deadlines = useMemo(() => businessDeadlines(business, { withinDays: 60 }), [business]);
  const groups = useMemo(() => groupDeadlines(deadlines), [deadlines]);
  const nextDue = useMemo(
    () =>
      deadlines
        .filter((item) => item.direction === 'out')
        .sort((left, right) => left.date.localeCompare(right.date))[0] ?? null,
    [deadlines],
  );
  const incomingMinor = deadlines
    .filter((item) => item.direction === 'in')
    .reduce((sum, item) => sum + (item.amountMinor ?? 0), 0);
  const outgoingMinor = deadlines
    .filter((item) => item.direction === 'out')
    .reduce((sum, item) => sum + (item.amountMinor ?? 0), 0);
  const isEmpty = business.entity === null && deadlines.length === 0;

  return (
    <View style={[styles.calendarRoot, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.calendarContent,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.calendarHeader}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={nav.back}
            style={({ pressed }) => [styles.calendarBack, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.calendarBackLabel, { color: t.muted }]}>←</Text>
          </Pressable>
          <Text style={[styles.calendarHeaderTitle, { color: t.muted }]}>Business calendar</Text>
          <View style={styles.calendarHeaderSpacer} />
        </View>

        <View style={styles.calendarHero}>
          <Text style={[styles.calendarEyebrow, { color: t.muted }]}>
            {business.entity ? entityName(business.entity) : 'Business'}
          </Text>
          <Text accessibilityRole="header" style={[styles.calendarHeadline, { color: t.ink }]}>
            {isEmpty ? (
              <>
                Nothing is <Text style={{ color: t.calm }}>dated</Text> yet.
              </>
            ) : deadlines.length === 0 ? (
              <>
                The next 60 days are <Text style={{ color: t.calm }}>clear</Text>.
              </>
            ) : (
              <>
                <Text style={{ color: t.calm }}>{deadlines.length}</Text>{' '}
                {deadlines.length === 1 ? 'date' : 'dates'} in the next 60 days.
              </>
            )}
          </Text>
          <Text style={[styles.calendarWhy, { color: t.muted }]}>
            {isEmpty
              ? 'Dates arrive on their own once the business type is chosen and there is a bill or invoice to work from.'
              : `${formatMinor(outgoingMinor)} going out, ${formatMinor(incomingMinor)} expected in over the window.`}
          </Text>
          {nextDue ? (
            <Text style={[styles.calendarNextDue, { borderTopColor: t.hairline, color: t.ink }]}>
              Next out: <Text style={styles.calendarNextDueStrong}>{nextDue.label}</Text>{' '}
              {formatDate(nextDue.date)}
              {nextDue.amountMinor === undefined ? '' : ` · ${formatMinor(nextDue.amountMinor)}`}
            </Text>
          ) : !isEmpty && deadlines.length === 0 ? (
            <Text style={[styles.calendarNoAction, { color: t.muted }]}>
              Nothing to pay or file in the window.
            </Text>
          ) : null}
        </View>

        {isEmpty ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.go('business-entity-setup')}
            style={({ pressed }) => [
              styles.calendarPrimary,
              { backgroundColor: t.calm, opacity: pressed ? 0.68 : 1 },
            ]}
          >
            <Text style={[styles.calendarPrimaryLabel, { color: t.inverse }]}>
              Choose the business type
            </Text>
          </Pressable>
        ) : (
          <>
            <View style={styles.calendarMetrics}>
              <View style={[styles.calendarMetricCard, { backgroundColor: t.inset }]}>
                <BusinessMetric accent label="Money in" value={`+${formatMinor(incomingMinor)}`} />
              </View>
              <View style={[styles.calendarMetricCard, { backgroundColor: t.inset }]}>
                <BusinessMetric label="Money out" value={formatMinor(outgoingMinor)} />
              </View>
            </View>

            {groups.length === 0 ? (
              <Text style={[styles.calendarNothingLeft, { color: t.muted }]}>
                Nothing left to file or pay in the window.
              </Text>
            ) : (
              groups.map((group) => (
                <View key={group.key} style={styles.section}>
                  <BusinessSectionTitle title={group.label} value={String(group.items.length)} />
                  <BusinessCard>
                    {group.items.map((deadline) => (
                      <BusinessRouteRow
                        hint={deadlineHint(deadline)}
                        key={deadline.id}
                        label={deadline.label}
                        onPress={() => nav.go(deadlineRoute(deadline))}
                        {...(deadline.amountMinor === undefined
                          ? {}
                          : {
                              value: `${deadline.direction === 'in' ? '+' : ''}${formatMinor(deadline.amountMinor)}`,
                            })}
                      />
                    ))}
                  </BusinessCard>
                </View>
              ))
            )}

            <BusinessSecondaryAction
              label="Add to your calendar app"
              onPress={() => nav.openSheet('calendar-export')}
            />
          </>
        )}
      </ScrollView>
      {!melo.quietMode ? (
        <MeloCompanionHost
          accessibilityLabel="Melo, perched at the business calendar answer"
          mood="calm"
          onPress={() =>
            nav.openMelo({ seed: 'Explain the important business dates in the next 60 days.' })
          }
          position="right"
          presence="offering-help"
          size={74}
          style={styles.calendarPerch}
        />
      ) : null}
    </View>
  );
}

export function BusinessPlansScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const business = useBusinessOperations();
  const deadlines = useMemo(() => businessDeadlines(business, { withinDays: 45 }), [business]);
  const moneyOut = deadlines.filter((item) => item.direction === 'out');
  const moneyIn = deadlines.filter((item) => item.direction === 'in');
  const outTotal = moneyOut.reduce((sum, item) => sum + (item.amountMinor ?? 0), 0);
  const inTotal = moneyIn.reduce((sum, item) => sum + (item.amountMinor ?? 0), 0);

  return (
    <BusinessScreenFrame
      eyebrow="Before the next money-in"
      headline="What’s already spoken for."
      intro="Dated obligations for this workspace—recurring costs, filings and invoices due."
      onBack={nav.back}
    >
      <View style={styles.section}>
        <BusinessSectionTitle title="Money out · next 45 days" value={formatMinor(outTotal)} />
        {moneyOut.length === 0 ? (
          <BusinessCard tone="inset">
            <Text style={[styles.emptyTitle, { color: t.ink }]}>Nothing dated yet.</Text>
            <Text style={[styles.emptyBody, { color: t.muted }]}>
              Add a recurring cost or filing and it will sit here with the date it is due.
            </Text>
            <BusinessSecondaryAction
              label="+ Add recurring money out"
              onPress={() => nav.go('business-obligations')}
            />
          </BusinessCard>
        ) : (
          <BusinessCard>
            {moneyOut.map((deadline) => (
              <BusinessRouteRow
                hint={deadlineHint(deadline)}
                key={deadline.id}
                label={deadline.label}
                onPress={() => nav.go(deadlineRoute(deadline))}
                {...(deadline.amountMinor === undefined
                  ? {}
                  : { value: formatMinor(deadline.amountMinor) })}
              />
            ))}
          </BusinessCard>
        )}
      </View>

      <View style={styles.section}>
        <BusinessSectionTitle title="Money in · expected" value={`+${formatMinor(inTotal)}`} />
        {moneyIn.length === 0 ? (
          <BusinessCard tone="inset">
            <Text style={[styles.emptyBody, { color: t.muted }]}>
              No expected payments set. Add an invoice so Melo can plan against it.
            </Text>
            <BusinessSecondaryAction
              label="+ Add an invoice"
              onPress={() => nav.go('business-invoices')}
            />
          </BusinessCard>
        ) : (
          <BusinessCard>
            {moneyIn.map((deadline) => (
              <BusinessRouteRow
                hint={deadlineHint(deadline)}
                key={deadline.id}
                label={deadline.label}
                onPress={() => nav.go(deadlineRoute(deadline))}
                value={`+${formatMinor(deadline.amountMinor ?? 0)}`}
              />
            ))}
          </BusinessCard>
        )}
      </View>
    </BusinessScreenFrame>
  );
}

type DeadlineGroup = Readonly<{
  key: 'overdue' | 'next-seven' | 'next-thirty' | 'later';
  label: string;
  items: readonly BusinessDeadline[];
}>;

function groupDeadlines(deadlines: readonly BusinessDeadline[]): readonly DeadlineGroup[] {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const groups: DeadlineGroup[] = [
    { key: 'overdue', label: 'Overdue', items: [] },
    { key: 'next-seven', label: 'Next 7 days', items: [] },
    { key: 'next-thirty', label: 'Next 30 days', items: [] },
    { key: 'later', label: 'Later', items: [] },
  ];
  const mutable = groups.map((group) => ({ ...group, items: [...group.items] }));
  for (const deadline of deadlines) {
    const days = Math.floor((Date.parse(`${deadline.date}T00:00:00.000Z`) - today) / 86_400_000);
    const index = days < 0 ? 0 : days <= 7 ? 1 : days <= 30 ? 2 : 3;
    mutable[index]!.items.push(deadline);
  }
  return mutable.filter((group) => group.items.length > 0);
}

function deadlineHint(deadline: BusinessDeadline): string {
  const date = new Date(`${deadline.date}T00:00:00.000Z`);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.floor((date.getTime() - today) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue · ${formatDate(deadline.date)}`;
  if (days === 0) return `Today · ${formatDate(deadline.date)}`;
  if (days === 1) return `Tomorrow · ${formatDate(deadline.date)}`;
  return `In ${days}d · ${formatDate(deadline.date)}`;
}

function deadlineRoute(deadline: BusinessDeadline): ScreenId {
  if (deadline.target === 'invoices') return 'business-invoices';
  if (deadline.target === 'obligations') return 'business-obligations';
  if (deadline.target === 'vat') return 'business-vat';
  if (deadline.target === 'self-assessment') return 'business-filing-sa';
  if (deadline.target === 'corporation-tax') return 'business-filing-ct';
  if (deadline.target === 'confirmation-statement') return 'business-filing-cs';
  return 'business-filing-accounts';
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function entityName(entity: NonNullable<ReturnType<typeof useBusinessOperations>['entity']>) {
  return entity.kind === 'ltd' ? entity.companyName : entity.tradingName || 'Sole Trader';
}

const styles = StyleSheet.create({
  calendarRoot: { flex: 1 },
  calendarContent: { paddingHorizontal: gap.xl },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 32,
  },
  calendarBack: {
    alignItems: 'flex-start',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  calendarBackLabel: { fontFamily: weightFamily(400), fontSize: 22 },
  calendarHeaderTitle: {
    flex: 1,
    fontFamily: weightFamily(600),
    fontSize: 11,
    letterSpacing: 1.54,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  calendarHeaderSpacer: { width: 32 },
  calendarHero: { marginTop: gap.xl },
  calendarEyebrow: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
  calendarHeadline: {
    fontFamily: serif.display,
    fontSize: 28,
    lineHeight: 33,
    marginTop: gap.sm,
  },
  calendarWhy: {
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 20,
    marginTop: gap.md,
  },
  calendarNextDue: {
    borderTopWidth: StyleSheet.hairlineWidth,
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 20,
    marginTop: gap.md,
    paddingTop: gap.md,
  },
  calendarNextDueStrong: { fontFamily: weightFamily(600) },
  calendarNoAction: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    lineHeight: 20,
    marginTop: gap.md,
  },
  calendarPrimary: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    marginTop: gap.xl,
    minHeight: 52,
    paddingHorizontal: gap.lg,
  },
  calendarPrimaryLabel: { fontFamily: weightFamily(600), fontSize: 14 },
  calendarMetrics: { flexDirection: 'row', gap: gap.md, marginTop: gap.lg },
  calendarMetricCard: { borderRadius: radius.md, flex: 1, padding: gap.lg },
  calendarNothingLeft: {
    fontFamily: serif.displayItalic,
    fontSize: 14,
    marginTop: gap.xl,
  },
  calendarPerch: { position: 'absolute', right: 23, top: 89, zIndex: 55 },
  section: { marginTop: gap.xl },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 12.5, lineHeight: 19, marginTop: gap.xs },
});
