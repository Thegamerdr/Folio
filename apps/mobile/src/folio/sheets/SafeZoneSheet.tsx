// @rn-sheet     SafeZoneSheet
// @purpose      Decomposition of the Safe Zone number — what makes it up, what's editable, and a
//               "something's off" jump to Melo.
// @reads        currentBalance, onboarding, pots, subs, subPaused, bufferAmount + the route bridge
//               (tightest point figure/date — via safeZoneMath, same inputs AffordCheckSheet builds)
// @writes       setBufferAmount (via the inline ± stepper)
// @copy         FROZEN — plain, honest, never predictive. Ported verbatim from the web deck.
// @tokens       --surface --hairline --accent --positive --negative (mapped to t.surface /
//               t.hairline / t.calm / t.positive / t.repair via '@/folio/theme')
//
// Faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetSafeZone.tsx).

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { useAppStore, setBufferAmount } from '@/folio/store';
import { useRoute } from '@/folio/lib/storeRoute';
import { safeZoneMath } from '@/folio/lib/modes/safeZone';
import { formatGBP } from '@/folio/screens/today/format';
import type { Nav } from '@/folio/types';

export type SafeZoneSheetProps = {
  visible: boolean;
  onClose: () => void;
  nav: Nav;
};

export function SafeZoneSheet({ visible, onClose, nav }: SafeZoneSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const currentBalance = useAppStore((st) => st.currentBalance);
  const onboarding = useAppStore((st) => st.onboarding);
  const pots = useAppStore((st) => st.pots);
  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);
  const bufferAmount = useAppStore((st) => st.bufferAmount ?? 100);

  // The sheet mounts fresh per open (FolioShell renders it only while active), so this is the
  // open moment — no module-scope clock that goes stale across midnight.
  const [now] = useState(() => new Date());
  const route = useRoute(now);

  const zone = useMemo(
    () =>
      // Route-fed tightest point, the SAME inputs AffordCheckSheet builds. With `tightestDate:
      // null` (the old hardcoded value) `shieldedBills` returns 0, so the sheet showed a total
      // WITHOUT the Bills Shield — a decomposition that contradicted the Today/Stability numbers
      // it now opens from.
      safeZoneMath({
        currentBalance,
        onboarding,
        pots,
        subs,
        subPaused,
        tightestSpare: route.tightPoint.amount,
        tightestDate: route.tightPoint.date,
        ritualCompletedRecently: false,
        bufferAmount,
      }),
    [
      currentBalance,
      onboarding,
      pots,
      subs,
      subPaused,
      route.tightPoint.amount,
      route.tightPoint.date,
      bufferAmount,
    ],
  );

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={s.body}>
        <Text style={s.eyebrow}>YOUR SAFE ZONE</Text>
        <Text style={s.headline}>About £{zone.perDay}/day</Text>
        <Text style={s.rowHint}>
          A separate spending budget after your Bills Shield and buffer.
          {zone.until
            ? ` Through ${new Date(`${zone.until}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}.`
            : ''}
        </Text>
        <View style={s.numberRow}>
          {/* Sign-aware headline (plan 107 Step 4): `formatGBP` renders negatives as `−£60`
              (minus BEFORE the pound sign — same convention as SafeZoneWidget's formatter),
              where the old inline template produced the garbled `£-60`. Positive output shape
              is identical (whole pounds, en-GB grouping — zone.total is already an integer). */}
          <Text style={[s.number, { color: zone.total <= 0 ? t.repair : t.ink }]}>
            {formatGBP(zone.total)}
          </Text>
        </View>

        <View style={[s.list, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          {zone.lines.map((line, idx) => (
            <View
              key={line.key}
              style={[
                s.row,
                idx !== 0
                  ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline }
                  : null,
              ]}
            >
              <View style={s.rowBody}>
                <Text style={s.rowLabel}>{line.label}</Text>
                {line.hint ? (
                  <Text style={s.rowHint}>
                    {line.key === 'shield'
                      ? 'Reserved for bills through the date above'
                      : line.hint}
                  </Text>
                ) : null}
              </View>
              {line.editable && line.key === 'buffer' ? (
                <View style={s.stepperRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Lower buffer by £10"
                    onPress={() => setBufferAmount(Math.max(0, bufferAmount - 10))}
                    style={[s.stepperBtn, { backgroundColor: t.inset, borderColor: t.hairline }]}
                  >
                    <Text style={s.stepperGlyph}>−</Text>
                  </Pressable>
                  <Text style={s.stepperValue}>£{bufferAmount}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Raise buffer by £10"
                    onPress={() => setBufferAmount(bufferAmount + 10)}
                    style={[s.stepperBtn, { backgroundColor: t.inset, borderColor: t.hairline }]}
                  >
                    <Text style={s.stepperGlyph}>+</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={[s.rowValue, line.amount < 0 ? { color: t.muted } : null]}>
                  {line.amount < 0 ? `−£${Math.abs(line.amount)}` : `£${line.amount}`}
                </Text>
              )}
            </View>
          ))}
        </View>

        {zone.estimating ? (
          <Text style={s.estimatingLine}>
            Includes known bills through the budget date shown above.
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onClose();
            nav.openMelo({ prefill: "Something's off with my Safe Zone." });
          }}
          style={[s.talkCta, { backgroundColor: t.calm, borderColor: t.calm }]}
        >
          <Text style={[s.talkCtaLabel, { color: t.inverse }]}>
            Something's off — talk it through with Melo
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    body: { paddingBottom: gap.xs },
    eyebrow: {
      fontSize: 12,
      letterSpacing: 1.8,
      color: t.muted,
    },
    headline: {
      marginTop: gap.sm,
      fontFamily: serif.display,
      fontSize: 28,
      lineHeight: 34,
      color: t.ink,
    },
    numberRow: { marginTop: gap.sm, flexDirection: 'row', alignItems: 'baseline' },
    number: { fontFamily: serif.display, fontSize: 44, fontVariant: ['tabular-nums'] },
    list: {
      marginTop: gap.lg,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    row: {
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: gap.sm,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowLabel: { fontSize: 15, color: t.ink },
    rowHint: { marginTop: 2, fontSize: 12.5, color: t.muted },
    rowValue: { fontSize: 15, fontVariant: ['tabular-nums'], color: t.ink },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: gap.xs },
    stepperBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperGlyph: { fontSize: 17, color: t.ink },
    stepperValue: {
      width: 56,
      textAlign: 'right',
      fontSize: 13.5,
      fontVariant: ['tabular-nums'],
      color: t.ink,
    },
    estimatingLine: { marginTop: gap.md, fontSize: 11.5, fontStyle: 'italic', color: t.muted },
    talkCta: {
      marginTop: gap.xl,
      minHeight: 48,
      paddingVertical: 8,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    talkCtaLabel: { fontSize: 13, color: t.inverse },
  });
}
