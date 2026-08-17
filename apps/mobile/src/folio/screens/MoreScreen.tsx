import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Hairline,
  gap,
  radius,
  serif,
  typeScale,
  useIsDark,
  useTheme,
  useThemeMode,
} from '@/folio/theme';
import {
  MeloCompanionPerch,
  useMeloCompanionScrollHandlers,
} from '@/folio/companion/MeloCompanionHost';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { StatePanel } from '@/folio/ui/StatePanel';
import { ProductIcon } from '@/folio/ui/ProductIcon';
import { fastForwardMonth, useAppStore } from '@/folio/store';
import { CHART_STYLE_HINT, CHART_STYLE_LABEL, useChartStyle } from '@/folio/lib/chartStyle';
import type { Nav, ScreenId, SheetId } from '@/folio/types';

export type MoreState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type MoreScreenProps = {
  nav: Nav;
  state?: MoreState;
};

type MoreRow = {
  label: string;
  hint: string;
  to?: ScreenId;
  sheet?: SheetId;
  onPress?: () => void;
  tone?: 'negative';
};

type MoreGroup = {
  title: string;
  rows: MoreRow[];
  demo?: boolean;
};

/** Personal More hub, ported from the refrozen Lovable ScreenMore.
 *  Review and Workspace are deliberate first-class rows here; they are not primary chrome. */
export function MoreScreen({ nav, state = 'populated' }: MoreScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = useIsDark();
  const { setMode } = useThemeMode();
  const { style: chartStyle } = useChartStyle();
  const companionScroll = useMeloCompanionScrollHandlers();
  const workspaces = useAppStore((s) => s.workspaces);
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const reviewCount = useAppStore(
    (s) => (s.reviewQueue?.length ?? 0) + (s.reviewQueueSpillover?.length ?? 0),
  );
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];
  const workspaceLabel = activeWorkspace?.name || 'Personal';
  const alternateWorkspace = activeWorkspace?.kind === 'business' ? 'Personal' : 'Business';

  const groups: MoreGroup[] = [
    {
      title: 'Money path',
      rows: [
        { label: 'First answer', hint: 'rough answer before full setup', to: 'first-answer' },
        { label: 'Timeline', hint: 'what you added, what you left', to: 'timeline' },
        { label: 'Calendar', hint: 'the dates that matter', to: 'calendar' },
        { label: 'Plans', hint: "what's coming before payday", to: 'plans' },
        { label: 'Insights', hint: 'the shape of your months', to: 'insights' },
        {
          label: 'Adjust path',
          hint: 'preview a choice or make room',
          to: 'whatif',
        },
      ],
    },
    {
      title: 'Set aside & keep',
      rows: [
        { label: 'Subscriptions', hint: 'what still earns its place', to: 'subs' },
        { label: 'Pots', hint: 'set aside, calmly', to: 'pots' },
        { label: 'Payday & income', hint: 'change when money lands', sheet: 'onboarding' },
        { label: 'Payday review', hint: 'wrap up the month in four steps', to: 'ritual' },
        { label: 'Share a cycle', hint: 'a quiet win card', sheet: 'share' },
      ],
    },
    {
      title: 'You',
      rows: [
        { label: 'Account & plan', hint: 'tier, sources, export, wipe', to: 'account' },
        { label: 'Melo', hint: 'companion, plumage, quiet mode', to: 'melo' },
        {
          label: 'Decision history',
          hint: 'receipts for material money choices',
          to: 'decision-history',
        },
        { label: 'Data & Security', hint: 'privacy, access, backup and export', to: 'privacy' },
        {
          label: 'Appearance',
          hint: isDark ? 'dark · tap for light' : 'light · tap for dark',
          onPress: () => setMode(isDark ? 'light' : 'dark'),
        },
        {
          label: 'Chart style',
          hint: `${CHART_STYLE_LABEL[chartStyle]} · ${CHART_STYLE_HINT[chartStyle]}`,
          sheet: 'chart-style',
        },
      ],
    },
    ...(__DEV__
      ? [
          {
            title: 'Demo',
            demo: true,
            rows: [
              {
                label: 'Fast-forward 1 month',
                hint: 'demo: age dates, close a cycle',
                onPress: () => {
                  fastForwardMonth();
                  nav.go('insights');
                },
              },
              {
                label: 'Start fresh',
                hint: 'clears everything',
                // Native keeps the existing gated reset flow. The visible surface matches the
                // frozen design; destructive data deletion still requires the Privacy confirmation.
                to: 'privacy',
                tone: 'negative',
              },
            ],
          } satisfies MoreGroup,
        ]
      : []),
  ];

  if (state === 'empty' || state === 'error') {
    return (
      <StatePanel
        body={
          state === 'error'
            ? 'Settings and account tools could not be shown right now.'
            : 'There are no additional settings to show yet.'
        }
        fullScreen
        kind={state === 'error' ? 'error' : 'genuine-empty'}
        primaryAction={{ label: 'Back to today', onPress: () => nav.go('today') }}
        title={state === 'error' ? copy.err.generic : 'Everything else, calmly.'}
      />
    );
  }

  if (state === 'loading') {
    return (
      <StatePanel
        body="Gathering account, preferences and support settings."
        fullScreen
        kind="loading"
        title="Loading More"
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        {...companionScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + gap.lg,
            paddingBottom: insets.bottom + gap.xxl,
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.wordmark, { color: t.ink }]}>{copy.global.app.name}</Text>
          <View style={styles.balanceSpacer} />
        </View>

        <View style={styles.hero}>
          <MeloCompanionPerch companionSize={30} id="more/header" priority={30}>
            <Melo size={30} mood="calm" />
          </MeloCompanionPerch>
          <View style={styles.heroText}>
            <Text style={[styles.eyebrow, { color: t.muted }]}>The quiet hub</Text>
            <Text accessibilityRole="header" style={[styles.heading, { color: t.ink }]}>
              {'Everything else, '}
              <Text style={[styles.headingAccent, { color: t.calm }]}>calmly</Text>
              {'.'}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityLabel="Switch workspace"
          accessibilityRole="button"
          onPress={() => nav.openWorkspace?.()}
          style={({ pressed }) => [
            styles.specialRow,
            {
              backgroundColor: t.surface,
              borderColor: t.hairline,
            },
            pressed ? styles.rowPressed : undefined,
          ]}
        >
          <View style={styles.specialText}>
            <Text style={[styles.specialEyebrow, { color: t.muted }]}>Workspace</Text>
            <View style={styles.specialValueRow}>
              <View style={[styles.workspaceDot, { backgroundColor: t.calm }]} />
              <Text style={[styles.specialValue, { color: t.ink }]}>{workspaceLabel}</Text>
              <Text style={[styles.specialHint, { color: t.muted }]}>
                · switch to {alternateWorkspace}
              </Text>
            </View>
          </View>
          <ProductIcon color={t.muted} name="forward" size={16} />
        </Pressable>

        <Pressable
          accessibilityLabel={reviewCount > 0 ? `Review — ${reviewCount} to check` : 'Review'}
          accessibilityRole="button"
          onPress={() => nav.go('review')}
          style={({ pressed }) => [
            styles.reviewRow,
            {
              backgroundColor: t.surface,
              borderColor: t.hairline,
            },
            pressed ? styles.rowPressed : undefined,
          ]}
        >
          <View style={styles.specialText}>
            <Text style={[styles.specialEyebrow, { color: t.muted }]}>Review</Text>
            <View style={styles.specialValueRow}>
              <Text style={[styles.specialValue, { color: t.ink }]}>
                {reviewCount > 0 ? 'Waiting to be checked' : 'Nothing waiting'}
              </Text>
              {reviewCount > 0 ? (
                <View style={[styles.reviewBadge, { backgroundColor: t.calmSoft }]}>
                  <Text style={[styles.reviewBadgeLabel, { color: t.calmStrong }]}>
                    {reviewCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <ProductIcon color={t.muted} name="forward" size={16} />
        </Pressable>

        <View style={styles.groups}>
          {groups.map((group) => (
            <View key={group.title}>
              <View style={styles.groupHeading}>
                <View
                  style={[styles.groupDot, { backgroundColor: group.demo ? t.hairline : t.calm }]}
                />
                <Text style={[styles.groupTitle, { color: t.muted }]}>{group.title}</Text>
              </View>
              <View
                style={
                  group.demo
                    ? styles.demoRows
                    : [
                        styles.card,
                        {
                          backgroundColor: t.surface,
                          borderColor: t.hairline,
                        },
                      ]
                }
              >
                {group.rows.map((row, index) => (
                  <View key={row.label}>
                    {index > 0 ? <Hairline /> : null}
                    <MoreRowView demo={group.demo === true} nav={nav} row={row} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.closing}>
          <MeloLine text="Tap export any time. Tap start fresh and it's gone." />
        </View>
      </ScrollView>
    </View>
  );
}

function MoreRowView({ demo, nav, row }: { demo: boolean; nav: Nav; row: MoreRow }) {
  const t = useTheme();
  const handlePress = () => {
    if (row.onPress) row.onPress();
    else if (row.sheet) nav.openSheet(row.sheet);
    else if (row.to) nav.go(row.to);
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed }) => [
        demo ? styles.demoRow : styles.row,
        pressed ? styles.rowPressed : undefined,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: row.tone === 'negative' ? t.repairInk : t.ink }]}>
          {row.label}
        </Text>
        <Text style={[styles.rowHint, { color: t.muted }]}>{row.hint}</Text>
      </View>
      <ProductIcon color={t.muted} name="forward" size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, paddingHorizontal: gap.xl },
  content: { paddingHorizontal: gap.xl },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontFamily: serif.displayItalic,
    fontSize: typeScale.bodySmall,
  },
  balanceSpacer: { width: 20 },
  hero: {
    alignItems: 'flex-start',
    columnGap: gap.md,
    flexDirection: 'row',
    marginTop: gap.xl,
  },
  heroText: { flex: 1 },
  eyebrow: {
    fontFamily: serif.displayItalic,
    fontSize: typeScale.caption,
  },
  heading: {
    fontFamily: serif.display,
    fontSize: typeScale.figure,
    lineHeight: 30,
    marginTop: gap.xs,
  },
  headingAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  specialRow: {
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: gap.xl,
    paddingHorizontal: gap.xl,
    paddingVertical: gap.lg,
  },
  reviewRow: {
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: gap.md,
    paddingHorizontal: gap.xl,
    paddingVertical: gap.lg,
  },
  specialText: { flex: 1 },
  specialEyebrow: {
    fontSize: typeScale.micro,
    letterSpacing: 1.45,
    textTransform: 'uppercase',
  },
  specialValueRow: {
    alignItems: 'center',
    columnGap: gap.sm,
    flexDirection: 'row',
    marginTop: gap.xs,
  },
  workspaceDot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  specialValue: {
    fontSize: typeScale.bodySmall,
    fontWeight: '500',
  },
  specialHint: {
    flexShrink: 1,
    fontSize: typeScale.micro,
  },
  reviewBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: gap.sm,
    paddingVertical: 2,
  },
  reviewBadgeLabel: {
    fontSize: typeScale.micro,
    fontVariant: ['tabular-nums'],
  },
  groups: {
    marginTop: gap.xl,
    rowGap: gap.xl,
  },
  groupHeading: {
    alignItems: 'center',
    columnGap: gap.sm,
    flexDirection: 'row',
    marginBottom: gap.sm,
    paddingHorizontal: gap.xs,
  },
  groupDot: {
    borderRadius: radius.pill,
    height: 4,
    width: 4,
  },
  groupTitle: {
    fontSize: typeScale.micro,
    letterSpacing: 1.45,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  demoRows: {
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: gap.xl,
    paddingVertical: gap.lg,
  },
  demoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: gap.xs,
    paddingVertical: gap.md,
  },
  rowPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontSize: typeScale.bodySmall,
    fontWeight: '500',
  },
  rowHint: {
    fontSize: typeScale.micro,
    marginTop: 2,
  },
  closing: {
    marginBottom: gap.xl,
    marginTop: gap.xl,
  },
});
