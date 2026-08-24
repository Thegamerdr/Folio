// ReviewHubScreen — the stable Review destination for the native tab.
//
// ReviewScreen remains the one-candidate, review-before-truth detail. This hub keeps its three
// jobs together without turning them into an admin table: Needs you (proposals still waiting for a
// decision), Activity (what has actually landed), and Decisions (ignored items and immutable
// corrections). Pending proposals never appear in the confirmed history projections.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { ScreenHeader } from '@/folio/ui/ScreenHeader';
import { useAppStore } from '@/folio/store';
import {
  buildDecisionHistoryRows,
  buildPendingReviewRows,
  type DecisionHistoryKind,
  type DecisionHistoryRow,
} from '@/folio/lib/reviewHistory';
import { formatGBP } from '@/folio/screens/today/format';
import type { Nav } from '@/folio/types';

type ReviewHubTab = 'needs' | 'activity' | 'decisions';

export type ReviewHubScreenProps = { nav: Nav };

const TAB_LABELS: readonly { key: ReviewHubTab; label: string }[] = [
  { key: 'needs', label: 'Needs you' },
  { key: 'activity', label: 'Activity' },
  { key: 'decisions', label: 'Decisions' },
];

function kindLabel(kind: DecisionHistoryKind): string {
  switch (kind) {
    case 'added':
      return 'Added';
    case 'edited':
      return 'Changed';
    case 'ignored':
      return 'Put aside';
    case 'paused':
      return 'Paused';
    case 'resumed':
      return 'Resumed';
  }
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatValue(value: string | number | undefined): string {
  if (value === undefined || value === '') return 'blank';
  if (typeof value === 'number') return formatGBP(value);
  return value;
}

function DecisionRow({
  row,
  styles: s,
  onPress,
}: {
  row: DecisionHistoryRow;
  styles: ReturnType<typeof makeStyles>;
  onPress: (() => void) | undefined;
}) {
  const t = useTheme();
  const body =
    row.kind === 'edited' && row.field !== undefined
      ? `${row.field} · ${formatValue(row.before)} → ${formatValue(row.after)}`
      : row.note;
  const content = (
    <>
      <View style={s.rowMain}>
        <Text numberOfLines={1} style={[s.rowTitle, { color: t.ink }]}>
          {row.title}
        </Text>
        <Text style={[s.rowMeta, { color: t.muted }]}>
          {kindLabel(row.kind)} · {formatWhen(row.at)}
        </Text>
      </View>
      {body !== undefined ? <Text style={[s.rowDetail, { color: t.muted }]}>{body}</Text> : null}
    </>
  );
  if (onPress === undefined) return <View style={s.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${kindLabel(row.kind)} ${row.title}`}
      accessibilityHint="Opens this entry so you can inspect or correct it"
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed ? s.pressed : undefined]}
    >
      {content}
    </Pressable>
  );
}

export function ReviewHubScreen({ nav }: ReviewHubScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(t), [t]);
  const [tab, setTab] = useState<ReviewHubTab>('needs');
  const queue = useAppStore((state) => state.reviewQueue ?? []);
  const hiddenCount = useAppStore((state) => (state.ignoredReviewSigs ?? []).length);
  const transactions = useAppStore((state) => state.transactions);
  const edits = useAppStore((state) => state.edits ?? []);
  const events = useAppStore((state) => state.timelineEvents ?? []);
  const pending = useMemo(() => buildPendingReviewRows(queue), [queue]);
  const history = useMemo(
    () => buildDecisionHistoryRows({ transactions, edits, events }),
    [transactions, edits, events],
  );
  const activity = useMemo(
    () => history.filter((row) => row.kind === 'added' || row.kind === 'edited'),
    [history],
  );
  const decisions = useMemo(() => history.filter((row) => row.kind !== 'added'), [history]);

  return (
    <View style={[s.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingTop: insets.top + gap.md, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          onBack={nav.back}
          eyebrow="Review"
          arrow="text"
          spacerWidth={20}
          backHitWidth={20}
          backHitHeight={0}
          eyebrowTracking={1.68}
        />

        <View style={s.intro}>
          <Text accessibilityRole="header" style={[s.headline, { color: t.ink }]}>
            A calm place to check, change, and choose.
          </Text>
          <Text style={[s.subhead, { color: t.muted }]}>
            Proposals wait here. Confirmed activity and your decisions stay in their own history.
          </Text>
        </View>

        <View accessibilityRole="tablist" style={[s.tabs, { borderColor: t.hairline }]}>
          {TAB_LABELS.map(({ key, label }) => {
            const selected = tab === key;
            const count =
              key === 'needs' ? pending.length : key === 'decisions' ? decisions.length : undefined;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
                onPress={() => setTab(key)}
                style={({ pressed }) => [
                  s.tab,
                  selected ? { backgroundColor: t.ink } : undefined,
                  pressed ? s.pressed : undefined,
                ]}
              >
                <Text style={[s.tabLabel, { color: selected ? t.canvas : t.muted }]}>{label}</Text>
                {count !== undefined ? (
                  <Text style={[s.tabCount, { color: selected ? t.canvas : t.muted }]}>
                    {count}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {tab === 'needs' ? (
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: t.muted }]}>Waiting for your decision</Text>
            {pending.length === 0 ? (
              <View style={[s.empty, { borderTopColor: t.hairline }]}>
                <Text style={[s.emptyTitle, { color: t.ink }]}>Nothing waiting to be checked.</Text>
                <Text style={[s.emptyBody, { color: t.muted }]}>
                  When Melo finds something new, it will show up here first.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => nav.go('intake')}
                  style={s.linkButton}
                >
                  <Text style={[s.linkLabel, { color: t.calm }]}>Add a statement</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[s.list, { backgroundColor: t.surface, borderColor: t.hairline }]}>
                {pending.map((row, index) => (
                  <Pressable
                    key={row.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Check ${row.title}`}
                    accessibilityHint="Opens one proposal for your decision"
                    onPress={() => nav.go('review-item')}
                    style={({ pressed }) => [
                      s.row,
                      index > 0
                        ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                        : undefined,
                      pressed ? s.pressed : undefined,
                    ]}
                  >
                    <View style={s.rowMain}>
                      <Text numberOfLines={1} style={[s.rowTitle, { color: t.ink }]}>
                        {row.title}
                      </Text>
                      <Text style={[s.rowMeta, { color: t.muted }]}>
                        {row.source} · {row.date ?? formatWhen(row.at)}
                      </Text>
                    </View>
                    <Text style={[s.amount, { color: row.amount >= 0 ? t.positive : t.ink }]}>
                      {formatGBP(row.amount)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {hiddenCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.openSheet('hidden-review')}
                style={s.quietButton}
              >
                <Text style={[s.quietLabel, { color: t.muted }]}>
                  {hiddenCount} put aside · view hidden
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {tab === 'activity' ? (
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: t.muted }]}>Confirmed activity</Text>
            {activity.length === 0 ? (
              <View style={[s.empty, { borderTopColor: t.hairline }]}>
                <Text style={[s.emptyTitle, { color: t.ink }]}>Your activity starts here.</Text>
                <Text style={[s.emptyBody, { color: t.muted }]}>
                  Confirmed money will appear newest first.
                </Text>
              </View>
            ) : (
              <View style={[s.list, { backgroundColor: t.surface, borderColor: t.hairline }]}>
                {activity.map((row, index) => (
                  <View
                    key={row.id}
                    style={
                      index > 0
                        ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                        : undefined
                    }
                  >
                    <DecisionRow
                      row={row}
                      styles={s}
                      onPress={
                        row.transactionId === undefined
                          ? undefined
                          : () => nav.openSheet('edit-txn', { id: row.transactionId! })
                      }
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {tab === 'decisions' ? (
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: t.muted }]}>What you chose</Text>
            {decisions.length === 0 ? (
              <View style={[s.empty, { borderTopColor: t.hairline }]}>
                <Text style={[s.emptyTitle, { color: t.ink }]}>No decisions recorded yet.</Text>
                <Text style={[s.emptyBody, { color: t.muted }]}>
                  Changes and items you put aside will stay here, with the original detail intact.
                </Text>
              </View>
            ) : (
              <View style={[s.list, { backgroundColor: t.surface, borderColor: t.hairline }]}>
                {decisions.map((row, index) => (
                  <View
                    key={row.id}
                    style={
                      index > 0
                        ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                        : undefined
                    }
                  >
                    <DecisionRow
                      row={row}
                      styles={s}
                      onPress={
                        row.transactionId === undefined
                          ? undefined
                          : () => nav.openSheet('edit-txn', { id: row.transactionId! })
                      }
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        <View style={s.melo}>
          <MeloLine mood="calm" text="Nothing is counted until you choose it." />
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(_t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1 },
    content: { paddingHorizontal: gap.xl },
    intro: { marginTop: gap.xl },
    headline: { fontFamily: serif.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.56 },
    subhead: { fontSize: 13, lineHeight: 19, marginTop: gap.sm },
    tabs: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radius.pill,
      flexDirection: 'row',
      gap: gap.xs,
      marginTop: gap.xl,
      padding: gap.xs,
    },
    tab: {
      alignItems: 'center',
      borderRadius: radius.pill,
      flex: 1,
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: gap.xs,
    },
    tabLabel: { fontSize: 11.5, fontWeight: '600' },
    tabCount: { fontSize: 10.5, marginTop: 1 },
    section: { marginTop: gap.xl },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    list: {
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.sm,
      overflow: 'hidden',
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: gap.md,
      minHeight: 64,
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
    },
    rowMain: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 14, fontWeight: '600' },
    rowMeta: { fontSize: 11.5, marginTop: 3 },
    rowDetail: { fontSize: 11.5, marginTop: 3, textAlign: 'right' },
    amount: { fontSize: 13.5, fontVariant: ['tabular-nums'], fontWeight: '600' },
    empty: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: gap.sm, paddingVertical: gap.xl },
    emptyTitle: { fontFamily: serif.medium, fontSize: 18 },
    emptyBody: { fontSize: 12.5, lineHeight: 18, marginTop: gap.xs },
    linkButton: {
      alignSelf: 'flex-start',
      minHeight: 44,
      justifyContent: 'center',
      marginTop: gap.xs,
    },
    linkLabel: { fontSize: 13, fontWeight: '600' },
    quietButton: {
      alignSelf: 'flex-start',
      minHeight: 44,
      justifyContent: 'center',
      marginTop: gap.xs,
    },
    quietLabel: { fontSize: 12.5 },
    melo: { marginTop: gap.xxl },
    pressed: { opacity: 0.62, transform: [{ scale: 0.98 }] },
  });
}
