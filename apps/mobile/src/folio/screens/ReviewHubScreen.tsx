// ReviewHubScreen — pinned-source owner:
// private-money-pilot/src/components/folio/screens/ScreenReviewHub.tsx @ ad90b4f.
//
// The Review tab is deliberately a small composition: one canonical segmented control and the
// existing one-decision Review surface mounted in place. It is not a second queue dashboard.

import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useCaughtSubs } from '@/folio/lib/caughtSubs';
import {
  buildDecisionHistoryRows,
  type DecisionHistoryKind,
  type DecisionHistoryRow,
} from '@/folio/lib/reviewHistory';
import { ReviewScreen } from '@/folio/screens/ReviewScreen';
import { formatGBPExact } from '@/folio/screens/reviewFormat';
import { formatGBP } from '@/folio/screens/today/format';
import { useAppStore } from '@/folio/store';
import { gap, radius, serif, useTheme } from '@/folio/theme';
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

function Chevron({ color }: { color: string }) {
  return (
    <Svg accessibilityElementsHidden width={16} height={16} viewBox="0 0 16 16">
      <Path
        d="M6 3.5 10.5 8 6 12.5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.4}
      />
    </Svg>
  );
}

function DestinationLine({
  label,
  meta,
  onPress,
}: {
  label: string;
  meta: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={onPress === undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.destination, pressed ? styles.pressed : undefined]}
    >
      <View style={styles.destinationCopy}>
        <Text style={[styles.destinationLabel, { color: t.ink }]}>{label}</Text>
        <Text numberOfLines={1} style={[styles.destinationMeta, { color: t.muted }]}>
          {meta}
        </Text>
      </View>
      <Chevron color={t.muted} />
    </Pressable>
  );
}

const HistoryRow = memo(function HistoryRow({
  row,
  onPress,
}: {
  row: DecisionHistoryRow;
  onPress: (() => void) | undefined;
}) {
  const t = useTheme();
  const detail =
    row.kind === 'edited' && row.field !== undefined
      ? `${row.field} · ${formatValue(row.before)} → ${formatValue(row.after)}`
      : row.note;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.historyRow, pressed ? styles.pressed : undefined]}
    >
      <View style={styles.historyMain}>
        <Text numberOfLines={1} style={[styles.historyTitle, { color: t.ink }]}>
          {row.title}
        </Text>
        {detail ? (
          <Text numberOfLines={1} style={[styles.historyDetail, { color: t.muted }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.historyWhen, { color: t.muted }]}>
        {kindLabel(row.kind)} · {formatWhen(row.at)}
      </Text>
    </Pressable>
  );
});

export function ReviewHubScreen({ nav }: ReviewHubScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<ReviewHubTab>('needs');
  const queueCount = useAppStore(
    (state) => (state.reviewQueue?.length ?? 0) + (state.reviewQueueSpillover?.length ?? 0),
  );
  const hiddenCount = useAppStore((state) => state.ignoredReviewSigs?.length ?? 0);
  const transactions = useAppStore((state) => state.transactions);
  const edits = useAppStore((state) => state.edits ?? []);
  const events = useAppStore((state) => state.timelineEvents ?? []);
  const caught = useCaughtSubs()[0];
  const history = useMemo(
    () => buildDecisionHistoryRows({ transactions, edits, events }),
    [transactions, edits, events],
  );
  const visibleHistory = useMemo(
    () =>
      tab === 'activity'
        ? history.filter((row) => row.kind === 'added' || row.kind === 'edited')
        : history.filter((row) => row.kind !== 'added'),
    [history, tab],
  );
  const renderHistoryRow = useCallback(
    ({ item }: { item: DecisionHistoryRow }) => (
      <HistoryRow
        row={item}
        onPress={
          item.transactionId
            ? () => nav.openSheet('edit-txn', { id: item.transactionId! })
            : undefined
        }
      />
    ),
    [nav],
  );

  return (
    <View style={[styles.root, { backgroundColor: t.canvas, paddingTop: insets.top + gap.lg }]}>
      <View style={styles.segmentInset}>
        <View
          accessibilityLabel="Review destinations"
          accessibilityRole="tablist"
          style={[styles.segmented, { backgroundColor: t.inset }]}
        >
          {TAB_LABELS.map(({ key, label }) => {
            const selected = tab === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setTab(key)}
                style={({ pressed }) => [
                  styles.segment,
                  selected
                    ? {
                        backgroundColor: t.surface,
                        borderColor: t.hairline,
                        borderWidth: StyleSheet.hairlineWidth,
                      }
                    : undefined,
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.segmentLabel, { color: selected ? t.ink : t.muted }]}
                >
                  {label}
                  {key === 'needs' && queueCount > 0 ? (
                    <Text style={[styles.segmentCount, { color: t.muted }]}> {queueCount}</Text>
                  ) : null}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {tab === 'needs' ? (
        <View style={styles.screenHost}>
          {caught ? (
            <View style={styles.caughtBlock}>
              <View style={[styles.pressureNote, { borderLeftColor: t.caution }]}>
                <Text style={[styles.eyebrow, { color: t.muted }]}>
                  Looks like a repeating charge
                </Text>
                <Text style={[styles.pressureBody, { color: t.ink }]}>
                  {caught.name} — {formatGBPExact(caught.amount)}, seen {caught.seen} months
                  running.
                </Text>
              </View>
              <View style={styles.destinationList}>
                <DestinationLine
                  label="Check this charge"
                  meta="add it to the plan, or wait until you see it again"
                  onPress={() => nav.openSheet('sub-caught')}
                />
              </View>
            </View>
          ) : null}
          <View style={styles.screenHost}>
            {caught && queueCount === 0 ? (
              <Text style={{ color: t.muted, fontSize: 13, lineHeight: 20, padding: gap.xl }}>
                Nothing else waiting.
              </Text>
            ) : (
              <ReviewScreen embedded nav={nav} />
            )}
          </View>
        </View>
      ) : (
        <FlatList
          data={visibleHistory}
          keyExtractor={(row) => row.id}
          renderItem={renderHistoryRow}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={32}
          windowSize={7}
          showsVerticalScrollIndicator={false}
          style={styles.screenHost}
          contentContainerStyle={[
            styles.historyContent,
            { paddingBottom: insets.bottom + gap.xxxl },
          ]}
          ItemSeparatorComponent={() => (
            <View style={[styles.rule, { backgroundColor: t.hairline }]} />
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyHistory, { color: t.muted }]}>Nothing decided yet.</Text>
          }
          ListHeaderComponent={
            <>
              <View style={styles.destinationBlock}>
                {tab === 'activity' ? (
                  <>
                    <Text style={[styles.listEyebrow, { color: t.muted }]}>
                      Everything Melo said
                    </Text>
                    <View style={styles.destinationList}>
                      <DestinationLine label="Inbox" meta="every whisper in one place" />
                      <View style={[styles.rule, { backgroundColor: t.hairline }]} />
                      <DestinationLine
                        label="Insights"
                        meta="the shape of your finished months"
                        onPress={() => nav.go('insights')}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[styles.listEyebrow, { color: t.muted }]}>
                      Undo and corrections
                    </Text>
                    <View style={styles.destinationList}>
                      <DestinationLine
                        label="Hidden items"
                        meta={hiddenCount ? `${hiddenCount} put aside` : 'nothing hidden'}
                        onPress={() => nav.openSheet('hidden-review')}
                      />
                    </View>
                  </>
                )}
              </View>
              <View style={styles.timelineInset}>
                <Text style={[styles.timelineKicker, { color: t.muted }]}>Your log</Text>
                <Text style={[styles.timelineHeadline, { color: t.ink }]}>
                  Everything you've added or logged.
                </Text>
                <Text style={[styles.timelineSubhead, { color: t.muted }]}>
                  Newest first. Nothing is hidden.
                </Text>
              </View>
            </>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  segmentInset: { paddingHorizontal: gap.xl },
  segmented: {
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: gap.xs,
    padding: gap.xs,
  },
  segment: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: gap.xs,
  },
  segmentLabel: { fontSize: 12.5, fontWeight: '500', lineHeight: 19 },
  segmentCount: { fontVariant: ['tabular-nums'] },
  screenHost: { flex: 1, minHeight: 0 },
  caughtBlock: { paddingHorizontal: gap.xl, paddingTop: gap.md },
  pressureNote: { borderLeftWidth: 2, paddingLeft: gap.md },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase' },
  pressureBody: { fontSize: 14, lineHeight: 22, marginTop: gap.xs },
  destinationBlock: { paddingHorizontal: gap.xl, paddingTop: gap.xs },
  listEyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase' },
  destinationList: { marginTop: gap.md },
  destination: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: gap.md,
    minHeight: 44,
    paddingVertical: 10,
  },
  destinationCopy: { flex: 1, minWidth: 0 },
  destinationLabel: { fontSize: 14, lineHeight: 22 },
  destinationMeta: { fontSize: 12.5, lineHeight: 19, marginTop: 2 },
  rule: { height: StyleSheet.hairlineWidth },
  timelineInset: { paddingHorizontal: gap.xl, paddingTop: gap.lg },
  timelineKicker: { fontFamily: serif.displayItalic, fontSize: 14 },
  timelineHeadline: { fontFamily: serif.display, fontSize: 28, lineHeight: 32, marginTop: gap.xs },
  timelineSubhead: { fontSize: 12.5, marginTop: 6 },
  historyContent: { paddingHorizontal: gap.xl },
  historyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: gap.md,
    minHeight: 58,
    paddingVertical: gap.md,
  },
  historyMain: { flex: 1, minWidth: 0 },
  historyTitle: { fontSize: 14, fontWeight: '500' },
  historyDetail: { fontSize: 11.5, marginTop: 3 },
  historyWhen: { fontSize: 11.5 },
  emptyHistory: { fontSize: 14, fontStyle: 'italic', marginTop: gap.lg },
  pressed: { opacity: 0.62, transform: [{ scale: 0.98 }] },
});
