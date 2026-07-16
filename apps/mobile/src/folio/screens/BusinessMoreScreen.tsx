import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { useAppStore } from '@/folio/store';
import type { Nav, ScreenId } from '@/folio/types';

type BusinessRow = Readonly<{ label: string; hint: string; to: ScreenId }>;

export function BusinessMoreScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const workspace = useAppStore(
    (state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId)!,
  );
  const groups: readonly Readonly<{ title: string; rows: readonly BusinessRow[] }>[] = [
    {
      title: 'Business records',
      rows: [
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
          Accounts, activity, documents, dates and exports for this workspace.
        </Text>

        <View style={styles.groups}>
          {groups.map((group) => (
            <View key={group.title}>
              <Text style={[styles.groupTitle, { color: t.muted }]}>{group.title}</Text>
              <View style={[styles.group, { backgroundColor: t.surface }]}>
                {group.rows.map((row, index) => (
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
                    <Text
                      accessibilityElementsHidden
                      style={[styles.arrow, { color: t.calmStrong }]}
                    >
                      →
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
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
  group: { borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  rowCopy: { flex: 1, paddingRight: gap.lg },
  rowLabel: { fontSize: 14.5, fontWeight: '600', lineHeight: 19 },
  rowHint: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  arrow: { fontSize: 18 },
});
