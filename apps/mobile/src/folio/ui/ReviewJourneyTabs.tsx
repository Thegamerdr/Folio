import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, radius, useTheme } from '@/folio/theme';
import { useAppStore } from '@/folio/store';
import type { Nav, ScreenId } from '@/folio/types';

export type ReviewJourneySection = 'check' | 'activity' | 'decisions' | 'imports';

/** One navigation vocabulary for every focused tool under Review. */
export function ReviewJourneyTabs({
  active,
  nav,
}: Readonly<{ active: ReviewJourneySection; nav: Nav }>) {
  const t = useTheme();
  const workspaceKind = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId)?.kind ??
      'personal',
  );
  const waiting = useAppStore(
    (state) =>
      state.readerCandidates.length +
      (state.reviewQueue?.length ?? 0) +
      (state.reviewQueueSpillover?.length ?? 0),
  );
  const tabs: readonly Readonly<{
    id: ReviewJourneySection;
    label: string;
    route: ScreenId;
  }>[] = [
    { id: 'check', label: waiting > 0 ? `Check ${waiting}` : 'Check', route: 'review' },
    { id: 'activity', label: 'Activity', route: 'timeline' },
    ...(workspaceKind === 'personal'
      ? ([{ id: 'decisions', label: 'Decisions', route: 'decision-history' }] as const)
      : []),
    { id: 'imports', label: 'Sources', route: 'intake-history' },
  ];

  return (
    <View accessibilityRole="tablist" style={[styles.rail, { backgroundColor: t.inset }]}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            accessibilityLabel={`${tab.label}, Review section`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.id}
            onPress={() => {
              if (!selected) nav.go(tab.route);
            }}
            style={({ pressed }) => [
              styles.tab,
              selected ? { backgroundColor: t.surface } : undefined,
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Text numberOfLines={1} style={[styles.label, { color: selected ? t.ink : t.muted }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: 2,
    marginTop: gap.lg,
    padding: 3,
  },
  tab: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: 3,
  },
  label: { fontSize: 10.5, fontWeight: '700' },
  pressed: { opacity: 0.62 },
});
