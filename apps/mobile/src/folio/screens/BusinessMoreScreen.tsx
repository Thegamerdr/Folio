import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gap, serif, typeScale, useTheme } from '@/folio/theme';
import { ListGroup, Row } from '@/folio/ui/ProductPrimitives';
import {
  MeloCompanionPerch,
  useMeloCompanionScrollHandlers,
} from '@/folio/companion/MeloCompanionHost';
import { Melo } from '@/folio/melo/Melo';
import { useAppStore } from '@/folio/store';
import type { Nav, ScreenId } from '@/folio/types';
import { useBusinessOperations } from './business/useBusinessOperations';

type BusinessRow = Readonly<{ label: string; hint: string; to: ScreenId }>;

export function BusinessMoreScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const companionScroll = useMeloCompanionScrollHandlers();
  const workspace = useAppStore(
    (state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId)!,
  );
  const business = useBusinessOperations();
  const groups: readonly Readonly<{ title: string; rows: readonly BusinessRow[] }>[] = [
    {
      title: 'Business tools',
      rows: [
        {
          label: 'Tax Pack',
          hint: 'estimates, preparation checks and PDF handoff',
          to: 'business-filings',
        },
        { label: 'Accounts', hint: 'business balances and account details', to: 'account' },
        { label: 'Activity', hint: 'everything confirmed or corrected', to: 'timeline' },
        { label: 'Read a document', hint: 'statements and receipts, reviewed first', to: 'intake' },
        { label: 'Calendar', hint: 'business dates and reminders', to: 'calendar' },
      ],
    },
    {
      title: 'Melo & decisions',
      rows: [
        { label: 'Melo', hint: 'the companion on this business side', to: 'melo' },
        { label: 'Plans', hint: 'dated business commitments', to: 'plans' },
      ],
    },
    {
      title: 'Workspace data',
      rows: [
        {
          label: 'Data, export & recovery',
          hint: 'export this workspace; device-wide controls are labelled',
          to: 'privacy',
        },
      ],
    },
    ...(business.entity?.kind === 'ltd'
      ? [
          {
            title: 'Limited Company tools',
            rows: [
              {
                label: 'Corporation Tax',
                hint: 'pot balance and next payment',
                to: 'business-corp-tax' as ScreenId,
              },
              {
                label: 'Payroll',
                hint: 'PAYE runs and HMRC liability',
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
              {
                label: 'Companies House',
                hint: 'Confirmation Statement, accounts due',
                to: 'business-companies-house' as ScreenId,
              },
            ],
          },
        ]
      : []),
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
        {...companionScroll}
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
          <MeloCompanionPerch companionSize={48} id="business-more/header" priority={30}>
            <Melo mood="calm" size={44} />
          </MeloCompanionPerch>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: t.muted }]}>{workspace.name}</Text>
            <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
              The useful business tools.
            </Text>
          </View>
        </View>
        <Text style={[styles.intro, { color: t.muted }]}>
          Accounts, activity, documents, dates and exports for this workspace.
        </Text>

        <View style={styles.groups}>
          {groups.map((group) => (
            <View key={group.title}>
              <Text style={[styles.groupTitle, { color: t.muted }]}>{group.title}</Text>
              <ListGroup label={group.title}>
                {group.rows.map((row) => (
                  <Row
                    description={row.hint}
                    key={row.label}
                    onPress={() => nav.go(row.to)}
                    title={row.label}
                  />
                ))}
              </ListGroup>
            </View>
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
  wordmark: { fontFamily: serif.displayItalic, fontSize: typeScale.bodySmall },
  workspaceKind: { fontSize: typeScale.micro, fontWeight: '600', letterSpacing: 0.7 },
  hero: { alignItems: 'flex-start', flexDirection: 'row', gap: gap.md, marginTop: gap.xl },
  heroCopy: { flex: 1 },
  eyebrow: { fontFamily: serif.displayItalic, fontSize: typeScale.caption },
  headline: {
    fontFamily: serif.display,
    fontSize: typeScale.figure,
    letterSpacing: -0.3,
    lineHeight: 35,
    marginTop: gap.xs,
  },
  intro: { fontSize: typeScale.bodySmall, lineHeight: 20, marginTop: gap.md, maxWidth: 520 },
  groups: { gap: gap.xl, marginTop: gap.xl },
  groupTitle: {
    fontSize: typeScale.micro,
    fontWeight: '600',
    letterSpacing: 1.1,
    marginBottom: gap.sm,
    textTransform: 'uppercase',
  },
});
