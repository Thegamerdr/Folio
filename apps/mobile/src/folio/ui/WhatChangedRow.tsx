// WhatChangedRow — the standing "what changed since I last looked?" row on every Today.
//
// @rn-component WhatChangedRow
// @purpose      Quiet re-entry point: one calm row naming the newest change since the user's last
//               look (plus a "· N more" tail), tap → Timeline. Hidden entirely when nothing
//               changed — never a permanent chrome fixture, never a nag. Free for everyone
//               (clarity/safety layer; MONEY_MODEL.md §2b never degrades Free quality) — the
//               paywall's Full "'What changed' briefing" bullet stays 'soon' and means the richer
//               future digest, not this row.
// @reads        transactions, edits, timelineEvents, statementImports, whatChangedSeenISO — via
//               useAppStore; summary maths in lib/whatChanged.ts (pure, tested).
// @writes       markWhatChangedSeen — a silent first-mount baseline (so the row only ever reports
//               changes AFTER the user first had it, instead of shouting a whole history on day
//               one), and on every tap-through.
// @tokens       inset · hairline · calm · muted · ink — all from the kit, no new token.

import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { markWhatChangedSeen, useAppStore, getState } from '@/folio/store';
import { buildTimelineRows } from '@/folio/lib/timelineEvents';
import { summarizeWhatChanged } from '@/folio/lib/whatChanged';
import { gap, pressed, radius, useTheme, type Palette } from '@/folio/theme';
import type { Nav } from '@/folio/types';

export function WhatChangedRow({ nav }: { nav: Nav }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const transactions = useAppStore((st) => st.transactions);
  const debts = useAppStore((st) => st.debts ?? []);
  const edits = useAppStore((st) => st.edits ?? []);
  const events = useAppStore((st) => st.timelineEvents ?? []);
  const imports = useAppStore((st) => st.statementImports ?? []);
  const seenISO = useAppStore((st) => st.whatChangedSeenISO ?? null);

  // First-mount baseline: with no baseline yet, everything ever recorded would read as "changed" —
  // a full-history shout on day one. Stamp "now" silently instead; the row starts reporting from
  // the first change AFTER the user first had it.
  useEffect(() => {
    if (seenISO === null) markWhatChangedSeen(new Date().toISOString());
  }, [seenISO]);

  const summary = useMemo(
    () =>
      summarizeWhatChanged({
        rows: buildTimelineRows({ transactions, edits, events }),
        imports,
        seenISO,
        transactions,
        edits,
        debts,
      }),
    [transactions, edits, events, imports, seenISO, debts],
  );

  if (summary === null) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`What changed — ${summary.headline}. ${summary.transactionId ? 'Opens payment details.' : 'Opens the timeline.'}`}
      onPress={() => {
        markWhatChangedSeen(new Date().toISOString());
        if (
          summary.transactionId &&
          getState().transactions.some((transaction) => transaction.id === summary.transactionId)
        )
          nav.openSheet('edit-txn', { id: summary.transactionId });
        else nav.go('timeline');
      }}
      style={({ pressed: isPressed }) => [s.row, isPressed ? pressed : undefined]}
    >
      <View style={s.dot} />
      <View style={s.copy}>
        <Text style={s.label}>What changed</Text>
        <Text style={s.headline}>{summary.headline}</Text>
      </View>
      <Text style={s.chevron}>→</Text>
    </Pressable>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    row: {
      alignItems: 'center',
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      columnGap: gap.sm,
      flexDirection: 'row',
      marginTop: gap.md,
      minHeight: 48,
      paddingHorizontal: gap.md,
      paddingVertical: gap.sm,
    },
    dot: {
      backgroundColor: t.calm,
      borderRadius: 999,
      height: 6,
      width: 6,
    },
    label: {
      color: t.ink,
      fontSize: 12,
      fontWeight: '500',
    },
    copy: { flex: 1, gap: 4 },
    headline: {
      color: t.muted,
      fontSize: 12,
      lineHeight: 18,
    },
    chevron: {
      color: t.calm,
      fontSize: 13,
    },
  });
}
