// ReviewHubScreen — pinned-source owner:
// private-money-pilot/src/components/folio/screens/ScreenReviewHub.tsx @ ad90b4f.
//
// The Review tab is deliberately a small composition: one canonical segmented control and the
// existing one-decision Review surface mounted in place. It is not a second queue dashboard.

import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useCaughtSubs } from '@/folio/lib/caughtSubs';
import {
  buildDecisionHistoryRows,
  HISTORY_SCOPE,
  historyDestination,
  type DecisionHistoryKind,
  type DecisionHistoryRow,
} from '@/folio/lib/reviewHistory';
import { ReviewScreen } from '@/folio/screens/ReviewScreen';
import { formatGBPExact } from '@/folio/screens/reviewFormat';
import { formatGBP } from '@/folio/screens/today/format';
import { useAppStore, useStatementReviewSessions } from '@/folio/store';
import { gap, radius, serif, useTheme } from '@/folio/theme';
import type { Nav } from '@/folio/types';
import { ReviewTimelineTabRail } from '@/folio/ui/ReviewTimelineTabRail';
import { useBottomChromeContentPadding } from '@/folio/shell/bottomChromeContext';
import { useSheetOverlayActive } from '@/surfaces/pressureMap/Sheet';

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
      return 'Corrected';
    case 'ignored':
      return 'Put aside';
    case 'paused':
      return 'Paused';
    case 'resumed':
      return 'Resumed';
    case 'debt-removed':
      return 'Removed from tracking';
    case 'debt-restored':
      return 'Tracking restored';
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
  innerRef,
}: {
  label: string;
  meta: string;
  onPress?: () => void;
  innerRef?: RefObject<View | null> | undefined;
}) {
  const t = useTheme();
  const content = (
    <>
      <View style={styles.destinationCopy}>
        <Text style={[styles.destinationLabel, { color: t.ink }]}>{label}</Text>
        <Text style={[styles.destinationMeta, { color: t.muted }]}>{meta}</Text>
      </View>
      {onPress ? (
        <View style={styles.chevronSlot} pointerEvents="none">
          <Chevron color={t.muted} />
        </View>
      ) : null}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${meta}`}
      onPress={onPress}
      ref={innerRef}
      style={({ pressed }) => [styles.destination, pressed ? styles.pressed : undefined]}
    >
      {content}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={`${label}. ${meta}`} style={styles.destination}>
      {content}
    </View>
  );
}

const HistoryRow = memo(function HistoryRow({
  row,
  onPress,
  actionLabel,
  onBeforePress,
}: {
  row: DecisionHistoryRow;
  onPress: (() => void) | undefined;
  actionLabel?: string | undefined;
  onBeforePress?: (node: View | null) => void;
}) {
  const t = useTheme();
  const rowRef = useRef<View>(null);
  const detail =
    row.kind === 'edited' && row.field !== undefined
      ? `${row.field} · ${formatValue(row.before)} → ${formatValue(row.after)}${row.amount !== undefined ? ` · ${formatGBP(row.amount)}` : ''}`
      : row.kind === 'added' && row.amount !== undefined
        ? formatGBP(row.amount)
        : row.note;
  const content = (
    <>
      <View style={styles.historyMain}>
        <Text style={[styles.historyTitle, { color: t.ink }]}>{row.title}</Text>
        {detail ? <Text style={[styles.historyDetail, { color: t.muted }]}>{detail}</Text> : null}
      </View>
      <Text style={[styles.historyWhen, { color: t.muted }]}>
        {kindLabel(row.kind)} · {formatWhen(row.at)}
      </Text>
    </>
  );
  return onPress ? (
    <View ref={rowRef} style={styles.historyRow}>
      {content}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        accessibilityHint={`${kindLabel(row.kind)} ${row.title}${row.amount !== undefined ? `, ${formatGBP(row.amount)}` : ''}, ${formatWhen(row.at)}`}
        onPress={() => {
          onBeforePress?.(rowRef.current);
          onPress();
        }}
        style={({ pressed }) => [styles.historyAction, pressed ? styles.pressed : undefined]}
      >
        <Text style={[styles.historyActionText, { color: t.calm }]}>{actionLabel} ›</Text>
      </Pressable>
    </View>
  ) : (
    <View
      ref={rowRef}
      accessible
      accessibilityLabel={`${row.title}. ${row.amount !== undefined ? `${formatGBP(row.amount)}. ` : ''}${kindLabel(row.kind)} · ${formatWhen(row.at)}`}
      style={styles.historyRow}
    >
      {content}
    </View>
  );
});

export function ReviewHubScreen({ nav }: ReviewHubScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const contentBottomPadding = useBottomChromeContentPadding();
  const sheetOverlayActive = useSheetOverlayActive();
  const previousSheetOverlay = useRef(false);
  const originRef = useRef<View | null>(null);
  const firstWaitingRef = useRef<View>(null);
  const waitingAnnouncedRef = useRef(false);
  const [needsViewportHeight, setNeedsViewportHeight] = useState<number | undefined>();
  const [tab, setTab] = useState<ReviewHubTab>('needs');
  const tabOffsets = useRef<Record<ReviewHubTab, number>>({ needs: 0, activity: 0, decisions: 0 });
  const needsScroll = useRef<ScrollView>(null);
  const needsScrollY = useRef(0);
  const historyList = useRef<FlatList<DecisionHistoryRow>>(null);
  useEffect(() => {
    const offset = tabOffsets.current[tab];
    requestAnimationFrame(() => {
      if (tab === 'needs') needsScroll.current?.scrollTo({ y: offset, animated: false });
      else historyList.current?.scrollToOffset({ offset, animated: false });
    });
  }, [tab]);
  const queueCount = useAppStore(
    (state) => (state.reviewQueue?.length ?? 0) + (state.reviewQueueSpillover?.length ?? 0),
  );
  const statementReviewSessions = useStatementReviewSessions();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const resumableStatements = statementReviewSessions.filter(
    (session) =>
      (session.workspaceId === undefined ||
        String(session.workspaceId) === String(activeWorkspaceId)) &&
      (session.candidates.length > 0 || session.receipt !== undefined),
  );
  const firstWaiting = resumableStatements[0];
  useEffect(() => {
    if (!waitingAnnouncedRef.current && resumableStatements.length > 0) {
      waitingAnnouncedRef.current = true;
      AccessibilityInfo.announceForAccessibility(
        "An earlier statement is still waiting for you. Open what's waiting, button.",
      );
    }
  }, [resumableStatements.length]);
  useEffect(() => {
    if (previousSheetOverlay.current && !sheetOverlayActive && originRef.current) {
      const node = findNodeHandle(originRef.current);
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    }
    previousSheetOverlay.current = sheetOverlayActive;
  }, [sheetOverlayActive]);
  const pendingCount =
    queueCount +
    resumableStatements.reduce((total, session) => total + session.candidates.length, 0);
  const hiddenCount = useAppStore((state) => state.ignoredReviewSigs?.length ?? 0);
  const transactions = useAppStore((state) => state.transactions);
  const subscriptions = useAppStore((state) => state.subs);
  const edits = useAppStore((state) => state.edits ?? []);
  const events = useAppStore((state) => state.timelineEvents ?? []);
  const caught = useCaughtSubs()[0];
  const history = useMemo(
    () => buildDecisionHistoryRows({ transactions, edits, events, subscriptions }),
    [transactions, edits, events, subscriptions],
  );
  const visibleHistory = useMemo(
    () =>
      tab === 'activity'
        ? history.filter((row) => row.kind === 'added' || row.kind === 'edited')
        : history.filter((row) => row.kind !== 'added'),
    [history, tab],
  );
  const renderHistoryRow = useCallback(
    ({ item }: { item: DecisionHistoryRow }) => {
      const destination = historyDestination(item, transactions);
      return (
        <HistoryRow
          row={item}
          actionLabel={destination?.label}
          onPress={
            destination
              ? () => {
                  if (destination.kind === 'transaction')
                    nav.openSheet('edit-txn', { id: destination.id });
                  else if (destination.kind === 'hidden') nav.openSheet('hidden-review');
                  else if (destination.kind === 'debts') nav.go('debts');
                  else nav.go('subs');
                }
              : undefined
          }
          onBeforePress={(node) => {
            originRef.current = node;
          }}
        />
      );
    },
    [nav, transactions],
  );

  return (
    <View style={[styles.root, { backgroundColor: t.canvas, paddingTop: insets.top + gap.lg }]}>
      <ReviewTimelineTabRail
        accessibilityLabel="Review destinations"
        value={tab}
        options={TAB_LABELS.map(({ key, label }) => ({
          key,
          label,
          ...(key === 'needs' && pendingCount > 0 ? { count: pendingCount } : {}),
        }))}
        onChange={setTab}
      />

      {tab === 'needs' ? (
        <ScrollView
          ref={needsScroll}
          style={styles.screenHost}
          onLayout={(event) => setNeedsViewportHeight(event.nativeEvent.layout.height)}
          onScroll={(event) => {
            const offset = event.nativeEvent.contentOffset.y;
            tabOffsets.current.needs = offset;
            needsScrollY.current = offset;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.needsContent, { paddingBottom: contentBottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.scopeBlock}>
            <Text style={[styles.scopeLine, { color: t.muted }]}>
              Statements you started. Nothing is added until you say so.
            </Text>
          </View>
          {resumableStatements.length > 0 ? (
            <View
              accessibilityLiveRegion="polite"
              style={[styles.waitingNotice, { borderColor: t.hairline }]}
            >
              <Text style={[styles.waitingNoticeText, { color: t.ink }]}>
                An earlier statement is still waiting for you.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open what's waiting"
                onPress={() => {
                  const node = findNodeHandle(firstWaitingRef.current);
                  if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
                  const first = resumableStatements[0];
                  if (first !== undefined) {
                    const source = String(
                      first.candidates[0]?.source ?? first.sourceKey?.split(':')[0] ?? 'pdf',
                    );
                    const label =
                      first.sourceLabel ?? (source === 'photo' ? 'Photo statement' : 'Statement');
                    AccessibilityInfo.announceForAccessibility(
                      `${label}. ${first.candidates.length} suggested. ${first.receipt === undefined ? 'Not added yet.' : 'Result not seen yet.'}`,
                    );
                  }
                }}
                style={({ pressed }) => [
                  styles.waitingNoticeActionButton,
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.waitingNoticeAction, { color: t.calm }]}>
                  Open what's waiting
                </Text>
              </Pressable>
            </View>
          ) : null}
          {resumableStatements.length > 0 ? (
            <View style={styles.destinationList}>
              {resumableStatements.map((session) => {
                const source =
                  session.candidates[0]?.source ?? session.sourceKey?.split(':')[0] ?? 'pdf';
                const sourceKind = String(source);
                const destination =
                  sourceKind === 'paste' || sourceKind === 'csv' || sourceKind === 'txt'
                    ? 'paste-success'
                    : sourceKind === 'photo'
                      ? 'image-success'
                      : 'pdf-success';
                const sourceLabel =
                  session.sourceLabel ?? (source === 'photo' ? 'Photo statement' : 'Statement');
                const sourceMeta = `${session.candidates.length} suggested · ${session.receipt === undefined ? 'not added yet' : 'result not seen yet'}`;
                return (
                  <DestinationLine
                    key={`${session.workspaceId ?? ''}:${session.sourceKey ?? ''}`}
                    label={sourceLabel}
                    meta={sourceMeta}
                    onPress={() =>
                      nav.go(destination, {
                        ...(session.sourceKey === undefined
                          ? {}
                          : { reviewSourceKey: session.sourceKey }),
                      })
                    }
                    innerRef={session === firstWaiting ? firstWaitingRef : undefined}
                  />
                );
              })}
              <DestinationLine
                label="Add a statement"
                meta="choose another source to review"
                onPress={() => nav.go('intake')}
              />
            </View>
          ) : null}
          {resumableStatements.length === 0 && caught ? (
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
          {queueCount > 0 ? (
            <View style={styles.reviewBody}>
              <ReviewScreen
                embedded
                embeddedScrollOwner
                embeddedScrollRef={needsScroll}
                embeddedScrollYRef={needsScrollY}
                {...(needsViewportHeight === undefined
                  ? {}
                  : { availableViewportHeight: needsViewportHeight })}
                nav={nav}
              />
            </View>
          ) : pendingCount === 0 && resumableStatements.length === 0 && !caught ? (
            <View style={styles.reviewBody}>
              <ReviewScreen
                embedded
                embeddedScrollOwner
                embeddedScrollRef={needsScroll}
                embeddedScrollYRef={needsScrollY}
                {...(needsViewportHeight === undefined
                  ? {}
                  : { availableViewportHeight: needsViewportHeight })}
                nav={nav}
              />
            </View>
          ) : caught ? (
            <Text style={{ color: t.muted, fontSize: 13, lineHeight: 20, padding: gap.xl }}>
              Nothing else waiting.
            </Text>
          ) : null}
        </ScrollView>
      ) : (
        <FlatList
          ref={historyList}
          data={visibleHistory}
          keyExtractor={(row) => row.id}
          renderItem={renderHistoryRow}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={32}
          windowSize={7}
          showsVerticalScrollIndicator={false}
          style={styles.screenHost}
          onScroll={(event) => {
            tabOffsets.current[tab] = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.historyContent, { paddingBottom: contentBottomPadding }]}
          ItemSeparatorComponent={() => (
            <View style={[styles.rule, { backgroundColor: t.hairline }]} />
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyHistory, { color: t.muted }]}>
              {HISTORY_SCOPE[tab].empty}
            </Text>
          }
          ListHeaderComponent={
            <>
              <View style={styles.scopeBlock}>
                {tab === 'activity' ? (
                  <>
                    <Text style={[styles.listEyebrow, { color: t.muted }]}>
                      EXPLORE YOUR RECORDS
                    </Text>
                    <View style={styles.destinationList}>
                      <DestinationLine
                        label="Inbox"
                        meta="open this conversation with Melo"
                        onPress={() => nav.openMelo({})}
                      />
                      <View style={[styles.rule, { backgroundColor: t.hairline }]} />
                      <DestinationLine
                        label="Timeline"
                        meta="confirmed transactions and recorded choices"
                        onPress={() => nav.go('timeline')}
                      />
                      <View style={[styles.rule, { backgroundColor: t.hairline }]} />
                      <DestinationLine
                        label="Insights"
                        meta="your recorded forecast reviews"
                        onPress={() => nav.go('insights')}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[styles.listEyebrow, { color: t.muted }]}>
                      REVIEW YOUR CHOICES
                    </Text>
                    <View style={styles.destinationList}>
                      <DestinationLine
                        label="Hidden items"
                        meta={hiddenCount ? `${hiddenCount} hidden` : 'nothing hidden'}
                        onPress={() => nav.openSheet('hidden-review')}
                      />
                    </View>
                  </>
                )}
              </View>
              <View style={styles.timelineInset}>
                <Text style={[styles.timelineKicker, { color: t.muted }]}>Your log</Text>
                <Text style={[styles.timelineHeadline, { color: t.ink }]}>
                  {HISTORY_SCOPE[tab].title}
                </Text>
                <Text style={[styles.timelineSubhead, { color: t.muted }]}>
                  {HISTORY_SCOPE[tab].description}
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
  screenHost: { flex: 1, minHeight: 0 },
  reviewBody: { minHeight: 0, flexGrow: 0, flexShrink: 0 },
  needsContent: { paddingHorizontal: gap.lg },
  scopeBlock: { paddingTop: gap.lg },
  scopeLine: { fontSize: 13, lineHeight: 20 },
  waitingNotice: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: gap.sm,
    marginBottom: gap.xl,
    marginTop: gap.xl,
    padding: gap.lg,
  },
  waitingNoticeText: { fontSize: 13, lineHeight: 20 },
  waitingNoticeAction: { fontSize: 13, lineHeight: 20 },
  waitingNoticeActionButton: { justifyContent: 'center', minHeight: 44 },
  caughtBlock: { paddingHorizontal: gap.xl, paddingTop: gap.md },
  pressureNote: { borderLeftWidth: 2, paddingLeft: gap.md },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase' },
  pressureBody: { fontSize: 14, lineHeight: 22, marginTop: gap.xs },
  listEyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase' },
  destinationList: { marginTop: gap.md },
  destination: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: gap.md,
    minHeight: 64,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  destinationCopy: { flex: 1, minWidth: 0 },
  destinationLabel: { fontSize: 14, lineHeight: 22 },
  destinationMeta: { fontSize: 12.5, lineHeight: 19, marginTop: 2 },
  chevronSlot: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  rule: { height: StyleSheet.hairlineWidth },
  timelineInset: { paddingHorizontal: gap.xl, paddingTop: gap.lg },
  timelineKicker: { fontFamily: serif.displayItalic, fontSize: 14 },
  timelineHeadline: { fontFamily: serif.display, fontSize: 28, lineHeight: 32, marginTop: gap.xs },
  timelineSubhead: { fontSize: 12.5, marginTop: 6 },
  historyContent: { paddingHorizontal: gap.xl },
  historyRow: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: gap.md,
    minHeight: 58,
    paddingVertical: gap.md,
  },
  historyMain: { flex: 1, minWidth: 0 },
  historyTitle: { fontSize: 14, fontWeight: '500' },
  historyDetail: { fontSize: 11.5, marginTop: 3 },
  historyWhen: { fontSize: 11.5 },
  historyAction: { alignSelf: 'stretch', justifyContent: 'center', minHeight: 44 },
  historyActionText: { fontSize: 13, lineHeight: 20 },
  emptyHistory: { fontSize: 14, fontStyle: 'italic', marginTop: gap.lg },
  pressed: { opacity: 0.62, transform: [{ scale: 0.98 }] },
});
