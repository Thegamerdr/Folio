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
        <Text style={s.eyebrow}>Your Safe Zone</Text>
        <View style={s.numberRow}>
          <Text style={[s.number, { color: zone.total <= 0 ? t.repair : t.ink }]}>
            £{Math.round(zone.total).toLocaleString('en-GB')}
          </Text>
          <Text style={s.numberCaption}>· about £{zone.perDay}/day</Text>
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
                {line.hint ? <Text style={s.rowHint}>{line.hint}</Text> : null}
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
            Includes bills between now and payday, so this stays honest.
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onClose();
            nav.openMelo({ prefill: "Something's off with my Safe Zone." });
          }}
          style={[s.talkCta, { backgroundColor: t.surface, borderColor: t.hairline }]}
        >
          <Text style={s.talkCtaLabel}>Something's off — talk it through with Melo</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    body: { paddingHorizontal: gap.xs, paddingBottom: gap.xs },
    eyebrow: { fontFamily: serif.displayItalic, fontSize: 13, color: t.muted },
    numberRow: { marginTop: 2, flexDirection: 'row', alignItems: 'baseline', gap: gap.xs },
    number: { fontFamily: serif.display, fontSize: 44, fontVariant: ['tabular-nums'] },
    numberCaption: { fontFamily: serif.displayItalic, fontSize: 14, color: t.muted },
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
    rowLabel: { fontSize: 13.5, color: t.ink },
    rowHint: { marginTop: 2, fontSize: 11, color: t.muted },
    rowValue: { fontSize: 13.5, fontVariant: ['tabular-nums'], color: t.ink },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: gap.xs },
    stepperBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperGlyph: { fontSize: 13, color: t.ink },
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
      height: 44,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    talkCtaLabel: { fontSize: 13, color: t.ink },
  });
}
