import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  businessDeadlines,
  calculateBusinessRunway,
  calculateVatBoxes,
  totalOutstandingInvoicesMinor,
} from '@folio/business-workspace';

import { gap, radius, serif, useTheme, weightFamily } from '@/folio/theme';
import { useAppStore } from '@/folio/store';
import type { Nav, ScreenId } from '@/folio/types';
import { useBusinessOperations } from './business/useBusinessOperations';

type MoneyRow = Readonly<{
  to: ScreenId;
  label: string;
  hint: string;
  value?: string;
}>;

export function BusinessMoneyScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const business = useBusinessOperations();
  const accounts = useAppStore((state) => state.accounts ?? []);
  const cashAccounts = useMemo(
    () =>
      accounts
        .filter((account) => account.closed !== true)
        .map((account) => ({
          ...account,
          // The inherited account field is major-unit data; Business engines use integer minor units.
          balanceMinor: Math.round(account.balanceMinor * 100),
        })),
    [accounts],
  );
  const runway = useMemo(
    () => calculateBusinessRunway(business, cashAccounts),
    [business, cashAccounts],
  );
  const outstandingMinor = totalOutstandingInvoicesMinor(business);
  const nextDue = useMemo(
    () =>
      businessDeadlines(business, { withinDays: 365 })
        .filter((deadline) => deadline.direction === 'out')
        .sort((left, right) => left.date.localeCompare(right.date))[0] ?? null,
    [business],
  );
  const openVatReturn = useMemo(
    () =>
      business.vatReturns
        .filter((item) => item.filedExternallyOn === undefined)
        .sort((left, right) => left.dueOn.localeCompare(right.dueOn))[0] ?? null,
    [business.vatReturns],
  );
  const vatLiabilityMinor = openVatReturn ? calculateVatBoxes(openVatReturn).box5Minor : 0;
  const hasCash = cashAccounts.length > 0;
  const vatRegistered = business.entity?.vat.registered === true;

  const rows: readonly MoneyRow[] = [
    {
      to: 'business-runway',
      label: 'Cash runway',
      hint: 'days of runway on current burn',
      value: hasCash
        ? runway.daysLeft === null
          ? 'covered'
          : runway.daysLeft === 1
            ? '1 day'
            : `${runway.daysLeft} days`
        : 'add cash',
    },
    {
      to: 'business-invoices',
      label: 'Invoices',
      hint: 'who owes you, and how late',
      value: formatCompactMinor(outstandingMinor),
    },
    {
      to: 'business-vat',
      label: 'VAT return',
      hint: 'pot, boxes 1–9, next due',
      value: vatRegistered ? formatCompactMinor(vatLiabilityMinor) : 'not VAT-registered',
    },
    {
      to: 'business-obligations',
      label: 'Recurring money out',
      hint: nextDue ? `next: ${nextDue.label}` : 'rent, payroll, software, loans',
    },
    {
      to: 'business-clients',
      label: 'Clients',
      hint: 'who you work with, and how they pay',
    },
    {
      to: 'intake',
      label: 'Spend and evidence',
      hint: 'add a receipt, statement or paste',
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.xxl, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.answer}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>Business money</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {hasCash ? (
              runway.daysLeft === null ? (
                <>
                  The business is <Text style={{ color: t.calm }}>covered</Text> on what&apos;s due.
                </>
              ) : (
                <>
                  The business can pay what&apos;s due for{' '}
                  <Text style={{ color: t.calm }}>
                    {runway.daysLeft === 1 ? '1 day' : `${runway.daysLeft} days`}
                  </Text>
                  .
                </>
              )
            ) : (
              <>
                Add cash to see if the business can <Text style={{ color: t.calm }}>cover</Text>{' '}
                what&apos;s due.
              </>
            )}
          </Text>
          <Text style={[styles.why, { color: t.muted }]}>
            {hasCash
              ? `${formatCompactMinor(runway.cashMinor)} in the accounts, ${formatCompactMinor(runway.incoming30Minor)} due in and ${formatCompactMinor(runway.outgoing30Minor)} due out over the next 30 days.`
              : "Nothing added yet, so there's no cash picture to work from."}
          </Text>
          {hasCash ? (
            <Text style={[styles.estimate, { color: t.muted }]}>
              This is worked out from what you&apos;ve added, so treat it as a close guess.
            </Text>
          ) : null}
          {nextDue ? (
            <Text style={[styles.nextDue, { borderTopColor: t.hairline, color: t.ink }]}>
              Next out: <Text style={styles.nextDueStrong}>{nextDue.label}</Text>{' '}
              {formatDate(nextDue.date)}
              {nextDue.amountMinor === undefined
                ? ''
                : ` · ${formatCompactMinor(nextDue.amountMinor)}`}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              nav.go(
                hasCash && outstandingMinor > 0
                  ? 'business-invoices'
                  : hasCash
                    ? 'business-runway'
                    : 'intake',
              )
            }
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: t.calm, opacity: pressed ? 0.62 : 1 },
            ]}
          >
            <Text style={[styles.primaryLabel, { color: t.inverse }]}>
              {hasCash && outstandingMinor > 0
                ? "Chase what's owed"
                : hasCash
                  ? 'Open cash runway'
                  : 'Add what the business has'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.rows}>
          {rows.map((row) => (
            <MoneyRouteRow key={row.to} nav={nav} row={row} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function MoneyRouteRow({ nav, row }: { nav: Nav; row: MoneyRow }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityHint={row.hint}
      accessibilityRole="button"
      onPress={() => nav.go(row.to)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: t.surface, borderColor: t.hairline, opacity: pressed ? 0.62 : 1 },
      ]}
    >
      <View style={styles.rowCopy}>
        <Text style={[styles.rowLabel, { color: t.ink }]}>{row.label}</Text>
        <Text style={[styles.rowHint, { color: t.muted }]}>{row.hint}</Text>
      </View>
      {row.value ? (
        <Text style={[styles.rowValue, { color: t.ink }]}>{row.value}</Text>
      ) : (
        <Text accessibilityElementsHidden style={[styles.rowArrow, { color: t.muted }]}>
          →
        </Text>
      )}
    </Pressable>
  );
}

function formatCompactMinor(valueMinor: number): string {
  const value = valueMinor / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: valueMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: valueMinor % 100 === 0 ? 0 : 2,
  }).format(value);
}

function formatDate(isoDay: string): string {
  return new Date(`${isoDay}T12:00:00.000Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gap.xl },
  answer: {},
  eyebrow: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: serif.display,
    fontSize: 28,
    lineHeight: 32,
    marginTop: gap.sm,
  },
  why: { fontFamily: weightFamily(400), fontSize: 14, lineHeight: 20, marginTop: gap.md },
  estimate: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    lineHeight: 20,
    marginTop: 6,
  },
  nextDue: {
    borderTopWidth: StyleSheet.hairlineWidth,
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 20,
    marginTop: gap.md,
    paddingTop: gap.md,
  },
  nextDueStrong: { fontFamily: weightFamily(600) },
  primary: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    marginTop: gap.lg,
    minHeight: 44,
    paddingHorizontal: gap.lg,
  },
  primaryLabel: { fontFamily: weightFamily(600), fontSize: 14 },
  rows: { gap: gap.sm, marginTop: 20 },
  row: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 62,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  rowCopy: { flex: 1, minWidth: 0, paddingRight: gap.md },
  rowLabel: { fontFamily: weightFamily(600), fontSize: 14, lineHeight: 19 },
  rowHint: { fontFamily: weightFamily(400), fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  rowValue: {
    fontFamily: serif.display,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    maxWidth: 148,
  },
  rowArrow: { fontFamily: weightFamily(400), fontSize: 14 },
});
