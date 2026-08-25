import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { useAppStore, type Transaction } from '@/folio/store';
import type { Nav } from '@/folio/types';

type ReviewSegment = 'needs' | 'activity' | 'documents';

const REVIEW_SEGMENTS: readonly Readonly<{ id: ReviewSegment; label: string }>[] = [
  { id: 'needs', label: 'Needs you' },
  { id: 'activity', label: 'Activity' },
  { id: 'documents', label: 'Documents' },
];

export function BusinessReviewScreen({
  nav,
  initialSegment = 'needs',
}: {
  nav: Nav;
  initialSegment?: ReviewSegment;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<ReviewSegment>(initialSegment);
  const queueCount = useAppStore(
    (state) =>
      state.readerCandidates.length +
      (state.reviewQueue?.length ?? 0) +
      (state.reviewQueueSpillover?.length ?? 0),
  );
  const transactions = useAppStore((state) => state.transactions);
  const recent = useMemo(() => transactions.slice(0, 12), [transactions]);

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: t.inset }]}>
          {REVIEW_SEGMENTS.map((option) => {
            const selected = segment === option.id;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={option.id}
                onPress={() => setSegment(option.id)}
                style={({ pressed }) => [
                  styles.segment,
                  selected ? { backgroundColor: t.surface } : undefined,
                  { opacity: pressed ? 0.64 : 1 },
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: selected ? t.ink : t.muted, fontWeight: selected ? '600' : '500' },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {segment === 'needs' ? (
          <NeedsReview nav={nav} queueCount={queueCount} />
        ) : segment === 'activity' ? (
          <BusinessActivity recent={recent} transactionCount={transactions.length} />
        ) : (
          <BusinessDocuments nav={nav} />
        )}
      </ScrollView>
    </View>
  );
}

function NeedsReview({ nav, queueCount }: { nav: Nav; queueCount: number }) {
  const t = useTheme();
  const nothingWaiting = queueCount === 0;

  return (
    <View>
      <BusinessWordmark />
      <View style={styles.hero}>
        <Text style={[styles.eyebrow, { color: t.muted }]}>Business review</Text>
        <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
          {nothingWaiting ? (
            <>
              Nothing is waiting to be <Text style={{ color: t.calmStrong }}>checked</Text>.
            </>
          ) : (
            <>
              {queueCount} {queueCount === 1 ? 'amount is' : 'amounts are'} waiting to be{' '}
              <Text style={{ color: t.calmStrong }}>checked</Text>.
            </>
          )}
        </Text>
        <Text style={[styles.why, { color: t.muted }]}>
          Anything Melo finds on the business side waits here until you confirm it. Nothing counts
          before that.
        </Text>
        <Text style={[styles.noAction, { color: t.muted }]}>
          {nothingWaiting ? 'Nothing to do here today.' : 'One calm pass keeps the picture honest.'}
        </Text>
      </View>

      {nothingWaiting ? (
        <ActionRow
          hint="anything found queues here for one calm pass"
          label="Add a statement or receipt"
          nav={nav}
          to="intake"
          underlined
        />
      ) : (
        <ActionRow
          hint="start with the next amount; nothing counts until you confirm it"
          label={`Check ${queueCount} ${queueCount === 1 ? 'amount' : 'amounts'}`}
          nav={nav}
          to="review-item"
          underlined
        />
      )}

      <View style={styles.history}>
        <Text style={[styles.sectionTitle, { color: t.muted }]}>History</Text>
        <ActionRow
          hint="everything you've confirmed or corrected"
          label="Business activity"
          nav={nav}
          to="timeline"
          surfaced
        />
        <ActionRow
          hint="revenue, top clients, tax year story"
          label="Insights"
          nav={nav}
          to="business-insights"
          surfaced
        />
      </View>
    </View>
  );
}

function BusinessActivity({
  recent,
  transactionCount,
}: {
  recent: readonly Transaction[];
  transactionCount: number;
}) {
  const t = useTheme();
  return (
    <View>
      <BusinessWordmark />
      <View style={styles.hero}>
        <Text style={[styles.eyebrow, { color: t.muted }]}>Business activity</Text>
        <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
          What the business has <Text style={{ color: t.calmStrong }}>confirmed</Text>.
        </Text>
        <Text style={[styles.why, { color: t.muted }]}>
          Every checked or corrected amount stays in order here.
        </Text>
      </View>
      <View style={styles.activitySection}>
        <View style={styles.activityHeader}>
          <Text style={[styles.sectionTitle, { color: t.muted }]}>Activity</Text>
          <Text style={[styles.count, { color: t.muted }]}>{transactionCount}</Text>
        </View>
        {recent.length === 0 ? (
          <View style={[styles.activityEmpty, { borderTopColor: t.hairline }]}>
            <Text style={[styles.activityEmptyTitle, { color: t.ink }]}>
              Nothing confirmed yet.
            </Text>
            <Text style={[styles.activityEmptyBody, { color: t.muted }]}>
              Business activity starts empty.
            </Text>
          </View>
        ) : (
          <View
            style={[styles.activityRows, { backgroundColor: t.surface, borderColor: t.hairline }]}
          >
            {recent.map((transaction, index) => (
              <View
                key={transaction.id}
                style={[
                  styles.activityRow,
                  index > 0
                    ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                    : undefined,
                ]}
              >
                <View style={styles.activityCopy}>
                  <Text numberOfLines={1} style={[styles.activityTitle, { color: t.ink }]}>
                    {transaction.merchant}
                  </Text>
                  <Text style={[styles.activityMeta, { color: t.muted }]}>
                    {formatDate(transaction.when)} · {formatCategory(transaction.category)}
                  </Text>
                </View>
                <Text
                  style={[styles.amount, { color: transaction.amount >= 0 ? t.calmStrong : t.ink }]}
                >
                  {formatAmount(transaction.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function BusinessDocuments({ nav }: { nav: Nav }) {
  const t = useTheme();
  return (
    <View>
      <BusinessWordmark />
      <View style={styles.hero}>
        <Text style={[styles.eyebrow, { color: t.muted }]}>Business documents</Text>
        <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
          Records stay tied to the <Text style={{ color: t.calmStrong }}>business</Text>.
        </Text>
        <Text style={[styles.why, { color: t.muted }]}>
          Read statements and receipts first. Export only the workspace you chose.
        </Text>
      </View>
      <View style={styles.documentActions}>
        <ActionRow
          hint="review every amount before it counts"
          label="Read a document"
          nav={nav}
          to="intake"
          surfaced
        />
        <ActionRow
          hint="export and recovery controls"
          label="Data, export & recovery"
          nav={nav}
          to="privacy"
          surfaced
        />
      </View>
    </View>
  );
}

function BusinessWordmark() {
  const t = useTheme();
  return (
    <View style={styles.wordmarkRow}>
      <Text style={[styles.wordmark, { color: t.ink }]}>Melo</Text>
      <Text style={[styles.workspaceKind, { color: t.muted }]}>Business</Text>
    </View>
  );
}

function ActionRow({
  label,
  hint,
  nav,
  to,
  surfaced = false,
  underlined = false,
}: {
  label: string;
  hint: string;
  nav: Nav;
  to: Parameters<Nav['go']>[0];
  surfaced?: boolean;
  underlined?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityRole="button"
      onPress={() => nav.go(to)}
      style={({ pressed }) => [
        styles.action,
        surfaced
          ? {
              backgroundColor: t.surface,
              borderColor: t.hairline,
              borderRadius: radius.lg,
              borderWidth: StyleSheet.hairlineWidth,
            }
          : undefined,
        underlined
          ? { borderBottomColor: t.hairline, borderBottomWidth: StyleSheet.hairlineWidth }
          : undefined,
        { opacity: pressed ? 0.62 : 1 },
      ]}
    >
      <View style={styles.actionCopy}>
        <Text style={[styles.actionLabel, { color: t.ink }]}>{label}</Text>
        <Text style={[styles.actionHint, { color: t.muted }]}>{hint}</Text>
      </View>
      <Text accessibilityElementsHidden style={[styles.actionArrow, { color: t.calmStrong }]}>
        →
      </Text>
    </Pressable>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : iso;
}

function formatAmount(amount: number): string {
  const value = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${amount >= 0 ? '+' : '−'}${value}`;
}

function formatCategory(category: string): string {
  return category.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gap.xl },
  segmented: { borderRadius: 20, flexDirection: 'row', padding: 4 },
  segment: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  segmentLabel: { fontSize: 13.5, lineHeight: 18 },
  wordmarkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  wordmark: { fontFamily: serif.displayItalic, fontSize: 14 },
  workspaceKind: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.7 },
  hero: { marginTop: 28 },
  eyebrow: { fontSize: 11, fontWeight: '500', letterSpacing: 1.5, textTransform: 'uppercase' },
  headline: {
    fontFamily: serif.display,
    fontSize: 29,
    letterSpacing: -0.3,
    lineHeight: 35,
    marginTop: 12,
  },
  why: { fontSize: 14, lineHeight: 20, marginTop: gap.lg },
  noAction: { fontSize: 14, lineHeight: 20, marginTop: gap.lg },
  action: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: gap.lg,
    minHeight: 56,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  actionCopy: { flex: 1, paddingRight: gap.md },
  actionLabel: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  actionHint: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  actionArrow: { fontSize: 18 },
  history: { marginTop: 28 },
  sectionTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase' },
  activitySection: { marginTop: 28 },
  activityHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  count: { fontSize: 11, fontVariant: ['tabular-nums'] },
  activityEmpty: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: gap.sm,
    paddingVertical: gap.xl,
  },
  activityEmptyTitle: { fontFamily: serif.medium, fontSize: 18 },
  activityEmptyBody: { fontSize: 12.5, lineHeight: 18, marginTop: gap.xs },
  activityRows: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.sm,
    overflow: 'hidden',
  },
  activityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 62,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  activityCopy: { flex: 1, paddingRight: gap.md },
  activityTitle: { fontSize: 13.5, fontWeight: '600' },
  activityMeta: { fontSize: 11.5, marginTop: 2 },
  amount: { fontSize: 13.5, fontVariant: ['tabular-nums'], fontWeight: '600' },
  documentActions: { marginTop: gap.xl },
});
