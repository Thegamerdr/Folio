import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { useAppStore } from '@/folio/store';
import type { Nav, ScreenId } from '@/folio/types';
import { useBusinessOperations } from './business/useBusinessOperations';

type BusinessRow = Readonly<{ label: string; hint: string; to: ScreenId }>;
type BusinessGroup = Readonly<{ title: string; rows: readonly BusinessRow[] }>;

function BusinessMoreGroup({ group, nav }: { group: BusinessGroup; nav: Nav }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const canCollapse = group.rows.length > 3;
  const rows = expanded || !canCollapse ? group.rows : group.rows.slice(0, 3);

  return (
    <View>
      <Text style={[styles.groupTitle, { color: t.muted }]}>{group.title}</Text>
      <View style={[styles.group, { backgroundColor: t.surface, borderColor: t.hairline }]}>
        {rows.map((row, index) => (
          <Pressable
            accessibilityHint={row.hint}
            accessibilityRole="button"
            key={row.label}
            onPress={() => nav.go(row.to)}
            style={({ pressed }) => [
              styles.row,
              index > 0
                ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                : undefined,
              { opacity: pressed ? 0.62 : 1 },
            ]}
          >
            <View style={styles.rowCopy}>
              <Text style={[styles.rowLabel, { color: t.ink }]}>{row.label}</Text>
              <Text style={[styles.rowHint, { color: t.muted }]}>{row.hint}</Text>
            </View>
            <Text accessibilityElementsHidden style={[styles.arrow, { color: t.calmStrong }]}>
              ›
            </Text>
          </Pressable>
        ))}
        {canCollapse ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((value) => !value)}
            style={({ pressed }) => [
              styles.collapse,
              {
                borderTopColor: t.hairline,
                opacity: pressed ? 0.62 : 1,
              },
            ]}
          >
            <Text style={[styles.collapseText, { color: t.calmStrong }]}>
              {expanded ? 'Show fewer' : `See all (${group.rows.length})`} {expanded ? '↑' : '↓'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function BusinessMoreScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const workspace = useAppStore(
    (state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId)!,
  );
  const business = useBusinessOperations();
  const groups: readonly BusinessGroup[] = [
    {
      title: 'Filings',
      rows: [
        {
          label: 'Filings',
          hint: 'VAT, Self-Assessment, Corporation Tax, Companies House',
          to: 'business-filings',
        },
        { label: 'VAT return', hint: 'pot, boxes 1–9, next due', to: 'business-vat' },
        {
          label: 'VAT scheme chooser',
          hint: 'standard vs flat rate side-by-side',
          to: 'business-vat',
        },
        ...(business.entity?.kind === 'ltd'
          ? [
              {
                label: 'Companies House',
                hint: 'Confirmation Statement, accounts due',
                to: 'business-companies-house' as ScreenId,
              },
            ]
          : []),
      ],
    },
    {
      title: 'Payroll & tax',
      rows: [
        ...(business.entity?.kind === 'ltd'
          ? [
              {
                label: 'Corporation Tax',
                hint: 'pot balance and next payment',
                to: 'business-corp-tax' as ScreenId,
              },
              {
                label: 'Payroll',
                hint: "monthly pay runs and what's owed after",
                to: 'business-payroll' as ScreenId,
              },
              {
                label: 'Dividends',
                hint: 'distributable reserves and vouchers',
                to: 'business-dividends' as ScreenId,
              },
              {
                label: "Director's loan",
                hint: 'running balance and warnings',
                to: 'business-dla' as ScreenId,
              },
            ]
          : []),
        {
          label: 'Salary vs dividend',
          hint: "director's take-home optimiser",
          to: 'business-deductions',
        },
        {
          label: 'Pension planner',
          hint: 'employer contributions + CT relief',
          to: 'business-deductions',
        },
        {
          label: 'IR35 indicator',
          hint: 'gut check across the five factors',
          to: 'business-deductions',
        },
      ],
    },
    {
      title: 'Workspace',
      rows: [
        { label: 'Cash runway', hint: 'days of runway on current burn', to: 'business-runway' },
        { label: 'Invoices', hint: 'who owes you, and how late', to: 'business-invoices' },
        {
          label: 'Recurring money out',
          hint: 'rent, payroll, software, loans',
          to: 'business-obligations',
        },
        { label: 'Accounts', hint: 'business balances and account details', to: 'account' },
        { label: 'Activity', hint: 'everything confirmed or corrected', to: 'timeline' },
        {
          label: 'Read a document',
          hint: 'statements and receipts, reviewed first',
          to: 'intake',
        },
        { label: 'Calendar', hint: 'business dates and reminders', to: 'calendar' },
        { label: 'Melo', hint: 'the companion on this business side', to: 'melo' },
        {
          label: 'Clients',
          hint: 'outstanding, past due, avg days to pay',
          to: 'business-clients',
        },
        {
          label: 'Mileage',
          hint: '55p / 25p tally at HMRC simplified rates',
          to: 'business-deductions',
        },
        {
          label: 'Home office',
          hint: 'simplified, actual or director £6/wk',
          to: 'business-deductions',
        },
        {
          label: 'Late payment ladder',
          hint: 'polite → firm → statutory interest',
          to: 'business-invoices',
        },
        {
          label: 'Quote → invoice',
          hint: 'accept a quote, raise the invoice',
          to: 'business-invoices',
        },
        {
          label: 'Data, export & recovery',
          hint: 'export this workspace; device-wide controls are labelled',
          to: 'privacy',
        },
      ],
    },
    {
      title: 'Business type',
      rows: [
        {
          label: business.entity ? entityLabel(business.entity) : 'Set up business type',
          hint: business.entity ? 'Change entity or details' : 'Sole Trader or Limited Company',
          to: 'business-entity-setup',
        },
      ],
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.wordmarkRow}>
          <Text style={[styles.wordmark, { color: t.ink }]}>Melo</Text>
          <Text style={[styles.workspaceKind, { color: t.muted }]}>Business</Text>
        </View>
        <View style={styles.hero}>
          <Melo mood="calm" size={30} />
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: t.muted }]}>{workspace.name}</Text>
            <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
              The useful business tools.
            </Text>
          </View>
        </View>
        <Text style={[styles.intro, { color: t.muted }]}>
          Everything here opens a tool, not a decision. Nothing on this page is due.
        </Text>

        <View style={styles.groups}>
          {groups.map((group) => (
            <BusinessMoreGroup group={group} key={group.title} nav={nav} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function entityLabel(entity: NonNullable<ReturnType<typeof useBusinessOperations>['entity']>) {
  if (entity.kind === 'ltd') return `Limited Company — ${entity.companyName}`;
  return entity.tradingName ? `Sole Trader — ${entity.tradingName}` : 'Sole Trader';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gap.xl },
  wordmarkRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  wordmark: { fontFamily: serif.displayItalic, fontSize: 14 },
  workspaceKind: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.7 },
  hero: { alignItems: 'flex-start', flexDirection: 'row', gap: gap.md, marginTop: gap.xl },
  heroCopy: { flex: 1 },
  eyebrow: { fontFamily: serif.displayItalic, fontSize: 13 },
  headline: {
    fontFamily: serif.display,
    fontSize: 29,
    letterSpacing: -0.3,
    lineHeight: 35,
    marginTop: gap.xs,
  },
  intro: { fontSize: 13.5, lineHeight: 20, marginTop: gap.md, maxWidth: 520 },
  groups: { gap: gap.xl, marginTop: gap.xl },
  groupTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.1,
    marginBottom: gap.sm,
    textTransform: 'uppercase',
  },
  group: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 62,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  rowCopy: { flex: 1, paddingRight: gap.lg },
  rowLabel: { fontSize: 14.5, fontWeight: '600', lineHeight: 19 },
  rowHint: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  arrow: { fontSize: 22, lineHeight: 24 },
  collapse: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: gap.lg,
  },
  collapseText: { fontSize: 12.5, fontWeight: '600' },
});
