// TodayRecentTxns — the last few spends, with a quiet "+ log a spend" entry point.
//
// Faithful RN port of the web TodayRecentTxns (src/components/folio/screens/TodayRecentTxns.tsx):
// a "Recent" header with an accent "+ log a spend" link, then up to five spend rows on a single
// surface (merchant, "category · when", amount), or a calm empty line when nothing is logged yet.
//
// Presentation-only: the rows come pre-filtered/mapped from the `transactions` prop. "+ log a spend"
// calls onLogSpend (the screen opens the LogSpend sheet); each row may expose a remove affordance
// only when the container passes onRemove.

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TodayTransaction } from './todayTypes';
import { Hairline, gap, paper, pressed, radius, serif } from './kit';

const MAX_ROWS = 5;
const MS_PER_DAY = 86_400_000;

function relativeDay(date: string, asOfDate: string): string {
  const then = Date.parse(`${date}T00:00:00.000Z`);
  const now = Date.parse(`${asOfDate}T00:00:00.000Z`);
  const days = Math.round((now - then) / MS_PER_DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function amountLabel(minor: number): string {
  return `£${(Math.abs(minor) / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function TodayRecentTxns({
  transactions,
  asOfDate,
  onLogSpend,
  onRemove,
}: {
  /** Recent rows for Today (the container filters to spends and orders newest-first). */
  transactions: readonly TodayTransaction[];
  /** Today's ISO date, so each row reads a relative "today / yesterday / Nd ago". */
  asOfDate: string;
  onLogSpend: () => void;
  /** Optional — when present, each row shows a remove affordance. */
  onRemove?: ((id: string) => void) | undefined;
}) {
  const rows = useMemo(
    () => transactions.filter((t) => t.amountMinor < 0).slice(0, MAX_ROWS),
    [transactions],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Recent</Text>
        <Pressable
          accessibilityHint="Opens the log-a-spend sheet."
          accessibilityRole="button"
          hitSlop={8}
          onPress={onLogSpend}
          style={({ pressed: isPressed }) => (isPressed ? pressed : undefined)}
        >
          <Text style={styles.logLink}>+ log a spend</Text>
        </Pressable>
      </View>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nothing logged yet. Tap +log to add one.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map((row, index) => (
            <View key={row.id}>
              {index > 0 ? <Hairline /> : null}
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text numberOfLines={1} style={styles.merchant}>
                    {row.merchant}
                  </Text>
                  <Text style={styles.meta}>
                    {row.category} · {relativeDay(row.date, asOfDate)}
                  </Text>
                </View>
                <Text style={styles.amount}>{amountLabel(row.amountMinor)}</Text>
                {onRemove ? (
                  <Pressable
                    accessibilityLabel={`Remove ${row.merchant}`}
                    accessibilityRole="button"
                    hitSlop={10}
                    onPress={() => onRemove(row.id)}
                    style={({ pressed: isPressed }) => [
                      styles.remove,
                      isPressed ? pressed : undefined,
                    ]}
                  >
                    <Text style={styles.removeGlyph}>×</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: gap.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  headerLabel: {
    color: paper.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  logLink: { color: paper.calmStrong, fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },

  empty: {
    backgroundColor: paper.surface,
    borderRadius: radius.xl,
    paddingVertical: 14,
    paddingHorizontal: gap.lg,
  },
  emptyText: { color: paper.muted, fontSize: 13, fontFamily: serif.displayItalic },

  list: {
    backgroundColor: paper.surface,
    borderRadius: radius.xl,
    paddingHorizontal: gap.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: gap.md, paddingVertical: 12 },
  rowText: { flex: 1, minWidth: 0 },
  merchant: { color: paper.ink, fontSize: 14 },
  meta: { color: paper.muted, fontSize: 11, fontVariant: ['tabular-nums'], marginTop: 1 },
  amount: { color: paper.ink, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  remove: { paddingHorizontal: 4 },
  removeGlyph: { color: paper.muted, fontSize: 18, lineHeight: 18 },
});
