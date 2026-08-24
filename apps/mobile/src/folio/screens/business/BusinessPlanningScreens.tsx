import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { businessDeadlines, type BusinessDeadline } from '@folio/business-workspace';

import { gap, useTheme } from '@/folio/theme';
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
  const business = useBusinessOperations();
  const deadlines = useMemo(() => businessDeadlines(business, { withinDays: 60 }), [business]);
  const groups = useMemo(() => groupDeadlines(deadlines), [deadlines]);
  const incomingMinor = deadlines
    .filter((item) => item.direction === 'in')
    .reduce((sum, item) => sum + (item.amountMinor ?? 0), 0);
  const outgoingMinor = deadlines
    .filter((item) => item.direction === 'out')
    .reduce((sum, item) => sum + (item.amountMinor ?? 0), 0);

  return (
    <BusinessScreenFrame
      eyebrow={business.entity ? entityName(business.entity) : 'Business calendar'}
      headline="What’s coming in the next 60 days."
      intro="Invoices, recurring costs, VAT and filings for this workspace."
      onBack={nav.back}
    >
      {deadlines.length === 0 ? (
        <>
          <BusinessCard tone="inset">
            <Text style={[styles.emptyTitle, { color: t.ink }]}>Nothing dated yet.</Text>
            <Text style={[styles.emptyBody, { color: t.muted }]}>
              Set up the entity and add an invoice or recurring cost. Deadlines land here on their
              own.
            </Text>
          </BusinessCard>
          <BusinessPrimaryAction
            label={business.entity ? 'Add an invoice' : 'Set up the business'}
            onPress={() => nav.go(business.entity ? 'business-invoices' : 'business-entity-setup')}
          />
        </>
      ) : (
        <>
          <BusinessCard tone="inset">
            <View style={styles.metrics}>
              <BusinessMetric accent label="Money in" value={`+${formatMinor(incomingMinor)}`} />
              <BusinessMetric label="Money out" value={formatMinor(outgoingMinor)} />
            </View>
          </BusinessCard>

          {groups.map((group) => (
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
          ))}

          <BusinessSecondaryAction
            label="Add to your calendar app"
            onPress={() => nav.openSheet('calendar-export')}
          />
        </>
      )}
    </BusinessScreenFrame>
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
  metrics: { flexDirection: 'row', gap: gap.lg },
  section: { marginTop: gap.xl },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 12.5, lineHeight: 19, marginTop: gap.xs },
});
