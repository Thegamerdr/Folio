import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Melo } from '@/folio/melo/Melo';
import { gap, radius, serif, useTheme } from '@/folio/theme';
import { useAppStore } from '@/folio/store';
import type { Nav } from '@/folio/types';

/**
 * Permanent Business Review-tab destination.
 *
 * The transient single-candidate ReviewScreen still owns a pending decision.
 * This root owns the calm queue-empty state and confirmed history, so the
 * primary tab never looks like a pushed detail screen with a back arrow.
 */
export function BusinessReviewScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const queueCount = useAppStore(
    (state) =>
      state.readerCandidates.length +
      (state.reviewQueue?.length ?? 0) +
      (state.reviewQueueSpillover?.length ?? 0),
  );
  const transactions = useAppStore((state) => state.transactions);
  const workspace = useAppStore(
    (state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId)!,
  );
  const recent = useMemo(() => transactions.slice(0, 8), [transactions]);

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
          <Text style={[styles.eyebrow, { color: t.muted }]}>Review</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {queueCount > 0 ? 'Waiting for your check.' : 'Everything checked.'}
          </Text>
          <Text style={[styles.intro, { color: t.muted }]}>
            Found amounts wait here first. Nothing changes {workspace.name} until you confirm it.
          </Text>
        </View>

        {queueCount === 0 ? (
          <View style={[styles.empty, { backgroundColor: t.inset }]}>
            <Melo mood="calm" size={34} />
            <View style={styles.emptyCopy}>
              <Text style={[styles.emptyTitle, { color: t.ink }]}>Nothing waiting.</Text>
              <Text style={[styles.emptyBody, { color: t.muted }]}>
                Read a statement or receipt and anything Melo finds will wait here for one calm
                pass.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.go('intake')}
                style={({ pressed }) => [styles.linkAction, { opacity: pressed ? 0.62 : 1 }]}
              >
                <Text style={[styles.linkLabel, { color: t.calmStrong }]}>
                  Add to the business side →
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.go('review')}
            style={({ pressed }) => [
              styles.queueAction,
              { backgroundColor: t.calmStrong, opacity: pressed ? 0.68 : 1 },
            ]}
          >
            <View style={styles.queueCopy}>
              <Text style={[styles.queueLabel, { color: t.inverse }]}>
                Check {queueCount} {queueCount === 1 ? 'amount' : 'amounts'}
              </Text>
              <Text style={[styles.queueHint, { color: t.inverse }]}>
                One decision at a time
              </Text>
            </View>
            <Text accessibilityElementsHidden style={[styles.queueArrow, { color: t.inverse }]}>
              →
            </Text>
          </Pressable>
        )}

        <View style={styles.history}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: t.muted }]}>Confirmed history</Text>
            <Text style={[styles.sectionCount, { color: t.muted }]}>{transactions.length}</Text>
          </View>
          {recent.length === 0 ? (
            <View style={[styles.historyEmpty, { borderTopColor: t.hairline }]}>
              <Text style={[styles.historyEmptyTitle, { color: t.ink }]}>
                Business activity starts empty.
              </Text>
              <Text style={[styles.historyEmptyBody, { color: t.muted }]}>
                Confirmed and corrected amounts will stay in order here.
              </Text>
            </View>
          ) : (
            <View style={[styles.rows, { backgroundColor: t.surface }]}>
              {recent.map((transaction, index) => (
                <View
                  key={transaction.id}
                  style={[
                    styles.row,
                    index > 0
                      ? {
                          borderTopColor: t.hairline,
                          borderTopWidth: StyleSheet.hairlineWidth,
                        }
                      : undefined,
                  ]}
                >
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={[styles.rowTitle, { color: t.ink }]}>
                      {transaction.merchant}
                    </Text>
                    <Text style={[styles.rowMeta, { color: t.muted }]}>
                      {formatDate(transaction.when)} · {formatCategory(transaction.category)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.rowAmount,
                      { color: transaction.amount >= 0 ? t.calmStrong : t.ink },
                    ]}
                  >
                    {formatAmount(transaction.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
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
  wordmarkRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  wordmark: { fontFamily: serif.displayItalic, fontSize: 14 },
  workspaceKind: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.7 },
  hero: { marginTop: gap.xl },
  eyebrow: { fontFamily: serif.displayItalic, fontSize: 13 },
  headline: {
    fontFamily: serif.display,
    fontSize: 30,
    letterSpacing: -0.35,
    lineHeight: 36,
    marginTop: gap.xs,
  },
  intro: { fontSize: 13.5, lineHeight: 20, marginTop: gap.md, maxWidth: 520 },
  empty: {
    alignItems: 'flex-start',
    borderRadius: radius.xl,
    flexDirection: 'row',
    gap: gap.md,
    marginTop: gap.xl,
    padding: gap.xl,
  },
  emptyCopy: { flex: 1 },
  emptyTitle: { fontFamily: serif.medium, fontSize: 20, lineHeight: 25 },
  emptyBody: { fontSize: 13, lineHeight: 19, marginTop: gap.sm },
  linkAction: { justifyContent: 'center', marginTop: gap.sm, minHeight: 44 },
  linkLabel: { fontSize: 13, fontWeight: '600' },
  queueAction: {
    alignItems: 'center',
    borderRadius: radius.lg,
    flexDirection: 'row',
    marginTop: gap.xl,
    minHeight: 64,
    paddingHorizontal: gap.lg,
  },
  queueCopy: { flex: 1 },
  queueLabel: { fontSize: 15, fontWeight: '700' },
  queueHint: { fontSize: 12, marginTop: 2, opacity: 0.82 },
  queueArrow: { fontSize: 19 },
  history: { marginTop: gap.xxl },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: gap.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sectionCount: { fontSize: 11, fontVariant: ['tabular-nums'] },
  historyEmpty: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: gap.xl,
  },
  historyEmptyTitle: { fontFamily: serif.medium, fontSize: 18 },
  historyEmptyBody: { fontSize: 12.5, lineHeight: 18, marginTop: gap.xs },
  rows: { borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 62,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  rowCopy: { flex: 1, paddingRight: gap.md },
  rowTitle: { fontSize: 13.5, fontWeight: '600' },
  rowMeta: { fontSize: 11.5, marginTop: 2 },
  rowAmount: { fontSize: 13.5, fontVariant: ['tabular-nums'], fontWeight: '600' },
});
