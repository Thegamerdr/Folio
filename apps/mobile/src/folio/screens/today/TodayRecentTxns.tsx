// TodayRecentTxns — faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/today/TodayRecentTxns.tsx).
//
// @rn-component TodayRecentTxns
// @parent       TodayScreen
// @purpose      Single "Recent spend" card. Header = last-7-day category bar (tap → ask Melo where
//               the money went). Body = last 5 spend transactions with edit + remove buttons.
// @reads        transactions (amount < 0, newest 5; weekly bar = last 7 days grouped by category)
// @writes       removeTransaction(id) — guarded by a confirm (web window.confirm → RN Alert.alert).
// @opens-sheet  log-spend · edit-txn (via nav.openSheet('edit-txn', { id })) · melo-chat (via
//               nav.openMelo)
// @copy         FROZEN — verbatim from the deck.
// @tokens       surface · hairline · muted · calm (accent) · ink · inset · caution · negative ·
//               positive (category palette dots/bar segments)
// @notes        Empty branch: 'Nothing logged yet. Tap + above to add one.' The web confirm() is
//               web-only; RN uses Alert.alert with a destructive Remove. Divider rules use
//               StyleSheet.hairlineWidth. Weekly bar is hidden when there's no spend in the last 7
//               days (web parity).

import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, pressed, radius, serif, type Palette } from '@/folio/theme';
import { addTransaction, removeTransaction, useAppStore, type Transaction } from '@/folio/store';
import { useUndo } from '@/folio/ui/useUndo';
import { triggerFeedback } from '@/folio/lib/feedback';
import type { Nav } from '@/folio/types';
import { formatGBP } from './format';
import { useTodayTheme } from './todayTheme';

const MIN_TAP = 44;

function palette(t: Palette, category: Transaction['category']): string {
  switch (category) {
    case 'food':
      return t.calm;
    case 'transport':
      return t.ink;
    case 'fun':
      return t.caution;
    case 'bills':
      return t.repair; // RN Palette name for the web --negative token
    case 'shopping':
      return t.positive;
    default:
      return t.muted;
  }
}

export function TodayRecentTxns({ nav }: { nav: Nav }) {
  const t = useTodayTheme();
  const { showUndo } = useUndo();
  const transactions = useAppStore((st) => st.transactions);
  const recent = useMemo(
    () => transactions.filter((tx) => tx.amount < 0).slice(0, 5),
    [transactions],
  );

  const weekly = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    const acc: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.amount >= 0) continue;
      if (new Date(tx.when).getTime() < cutoff) continue;
      acc[tx.category] = (acc[tx.category] ?? 0) + Math.abs(tx.amount);
    }
    const entries = Object.entries(acc).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    return { entries, total };
  }, [transactions]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={[styles.eyebrow, { color: t.muted }]}>Recent spend</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.openSheet('log-spend')}
          hitSlop={8}
          style={({ pressed: isPressed }) => [styles.logBtn, isPressed ? pressed : undefined]}
        >
          <Text style={[styles.logBtnText, { color: t.calm }]}>+ log a spend</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
        {weekly.total > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="This week's spending by category — tap to ask Melo"
            onPress={() => nav.openMelo({ prefill: 'Where did my money go this week?' })}
            style={({ pressed: isPressed }) => [
              styles.weeklyCard,
              { borderBottomColor: t.hairline },
              isPressed ? pressed : undefined,
            ]}
          >
            <View style={styles.weeklyHeadRow}>
              <Text style={[styles.weeklyTotal, { color: t.muted }]}>
                This week · {formatGBP(weekly.total)}
              </Text>
              <Text style={[styles.weeklyLink, { color: t.muted }]}>ask Melo →</Text>
            </View>
            <View style={[styles.weeklyBar, { backgroundColor: t.inset }]}>
              {weekly.entries.map(([cat, v]) => (
                <View
                  key={cat}
                  style={{
                    width: `${(v / weekly.total) * 100}%`,
                    backgroundColor: palette(t, cat as Transaction['category']),
                  }}
                />
              ))}
            </View>
            <View style={styles.weeklyLegend}>
              {weekly.entries.slice(0, 4).map(([cat, v]) => (
                <View key={cat} style={styles.weeklyLegendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: palette(t, cat as Transaction['category']) },
                    ]}
                  />
                  <Text style={[styles.weeklyLegendText, { color: t.muted }]}>
                    {cat} {formatGBP(v)}
                  </Text>
                </View>
              ))}
            </View>
          </Pressable>
        )}

        {recent.length === 0 ? (
          <View style={styles.emptyBody}>
            <Text style={[styles.emptyText, { color: t.muted }]}>
              Nothing logged yet. Tap + above to add one.
            </Text>
          </View>
        ) : (
          recent.map((tx, i) => {
            const d = new Date(tx.when);
            const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
            const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`;
            const abs = Math.abs(tx.amount);
            return (
              <View
                key={tx.id}
                style={[
                  styles.row,
                  i > 0
                    ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline }
                    : undefined,
                ]}
              >
                <View style={styles.rowMain}>
                  <Text numberOfLines={1} style={[styles.merchant, { color: t.ink }]}>
                    {tx.merchant}
                  </Text>
                  <Text style={[styles.meta, { color: t.muted }]}>
                    {tx.category} · {when}
                  </Text>
                </View>
                <Text style={[styles.amount, { color: t.ink }]}>{formatGBP(abs)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${tx.merchant}`}
                  hitSlop={12}
                  onPress={() => nav.openSheet('edit-txn', { id: tx.id })}
                  style={({ pressed: isPressed }) => [styles.edit, isPressed ? pressed : undefined]}
                >
                  <Text style={[styles.editGlyph, { color: t.muted }]}>✎</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${tx.merchant}`}
                  hitSlop={12}
                  onPress={() =>
                    Alert.alert(`Remove ${tx.merchant} ${formatGBP(abs)}?`, undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => {
                          // Snapshot the exact row BEFORE removing so the Tier-1 undo (30s) can
                          // restore it identically — same id/when/merchant/amount/category/source.
                          const snapshot = tx;
                          removeTransaction(tx.id);
                          void triggerFeedback('delete-confirm');
                          showUndo(`Removed ${tx.merchant}`, () => {
                            addTransaction(snapshot);
                          });
                        },
                      },
                    ])
                  }
                  style={({ pressed: isPressed }) => [
                    styles.remove,
                    isPressed ? pressed : undefined,
                  ]}
                >
                  <Text style={[styles.removeGlyph, { color: t.muted }]}>×</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: gap.lg,
    marginHorizontal: gap.lg,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gap.xxs,
    marginBottom: gap.xs + 2,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  logBtn: {
    minHeight: 0,
  },
  logBtnText: {
    fontSize: 11,
    letterSpacing: 0.4,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  weeklyCard: {
    paddingHorizontal: gap.lg,
    paddingTop: gap.md - 2,
    paddingBottom: gap.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weeklyHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: gap.xs + 2,
  },
  weeklyTotal: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  weeklyLink: {
    fontSize: 10.5,
  },
  weeklyBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  weeklyLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: gap.md,
    rowGap: 2,
    marginTop: gap.xs + 2,
  },
  weeklyLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  weeklyLegendText: {
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  emptyBody: {
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  emptyText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  row: {
    minHeight: MIN_TAP,
    paddingHorizontal: gap.lg,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: gap.md,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  merchant: {
    fontSize: 13,
  },
  meta: {
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  amount: {
    fontFamily: serif.display,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  edit: {
    paddingHorizontal: 4,
  },
  editGlyph: {
    fontSize: 13,
  },
  remove: {
    paddingHorizontal: 4,
  },
  removeGlyph: {
    fontSize: 14,
  },
});
