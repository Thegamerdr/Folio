// TodayRecentTxns — faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/today/TodayRecentTxns.tsx).
//
// @rn-component TodayRecentTxns
// @parent       TodayScreen
// @purpose      Last 5 spend transactions with merchant, category, relative date, and a remove button.
// @reads        transactions (amount < 0, newest 5)
// @writes       removeTransaction(id) — guarded by a confirm (web window.confirm → RN Alert.alert).
// @opens-sheet  log-spend (via nav.openSheet)
// @copy         FROZEN — verbatim from the deck.
// @tokens       surface · hairline · muted · calm (accent) · ink
// @notes        Empty branch: 'Nothing logged yet. Tap + above to add one.' The web confirm() is
//               web-only; RN uses Alert.alert with a destructive Remove. Divider rules use
//               StyleSheet.hairlineWidth.

import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, pressed, radius, serif, useTheme } from '@/folio/theme';
import { removeTransaction, useAppStore } from '@/folio/store';
import type { Nav } from '@/folio/types';

const MIN_TAP = 44;

export function TodayRecentTxns({ nav }: { nav: Nav }) {
  const t = useTheme();
  const transactions = useAppStore((st) => st.transactions);
  const recent = useMemo(
    () => transactions.filter((tx) => tx.amount < 0).slice(0, 5),
    [transactions],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={[styles.eyebrow, { color: t.muted }]}>Recent</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.openSheet('log-spend')}
          hitSlop={8}
          style={({ pressed: isPressed }) => [styles.logBtn, isPressed ? pressed : undefined]}
        >
          <Text style={[styles.logBtnText, { color: t.calm }]}>+ log a spend</Text>
        </Pressable>
      </View>

      {recent.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text style={[styles.emptyText, { color: t.muted }]}>
            Nothing logged yet. Tap + above to add one.
          </Text>
        </View>
      ) : (
        <View style={[styles.list, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          {recent.map((tx, i) => {
            const d = new Date(tx.when);
            const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
            const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`;
            const abs = Math.abs(tx.amount).toFixed(2);
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
                <Text style={[styles.amount, { color: t.ink }]}>£{abs}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${tx.merchant}`}
                  hitSlop={12}
                  onPress={() =>
                    Alert.alert(`Remove ${tx.merchant} £${abs}?`, undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => removeTransaction(tx.id),
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
          })}
        </View>
      )}
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
  emptyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  emptyText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
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
  remove: {
    paddingHorizontal: 4,
  },
  removeGlyph: {
    fontSize: 14,
  },
});
