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
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { getState, useAppStore, setBufferAmount } from '@/folio/store';
import { createScopedFinancialUndo } from '@/folio/lib/scopedFinancialUndo';
import { buildFinancialPlanFromState } from '@/folio/lib/financialPlan';
import { formatGBP } from '@/folio/screens/today/format';
import {
  selectFinancialPresentation,
  formatFinancialDate,
} from '@/folio/lib/financialPresentation';
import { FinancialSetupNotice } from '@/folio/ui/FinancialSetupNotice';
import { useUndo } from '@/folio/ui/useUndo';
import type { Nav } from '@/folio/types';

export type SafeZoneSheetProps = {
  visible: boolean;
  onClose: () => void;
  nav: Nav;
};

export function SafeZoneSheet({ visible, onClose, nav }: SafeZoneSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const appState = useAppStore((st) => st);
  const bufferAmount = appState.bufferAmount ?? 100;
  const { showUndo } = useUndo();
  function changeBuffer(amount: number) {
    const before = getState();
    setBufferAmount(amount);
    const undo = createScopedFinancialUndo(before, ['bufferAmount']);
    showUndo(`Buffer saved · ${formatGBP(amount)}`, () => {
      if (!undo())
        Alert.alert(
          'Buffer kept',
          'Your details have changed since this save. Review the current buffer before changing it.',
        );
    });
  }

  // The sheet mounts fresh per open (FolioShell renders it only while active), so this is the
  // open moment — no module-scope clock that goes stale across midnight.
  const [now] = useState(() => new Date());
  const plan = useMemo(() => buildFinancialPlanFromState(appState, { now }), [appState, now]);
  const presentation = selectFinancialPresentation(appState, plan);
  const daysLeft = plan.nextIncomeDate
    ? Math.max(
        1,
        Math.round(
          (new Date(`${plan.nextIncomeDate}T00:00:00Z`).getTime() -
            new Date(`${plan.asOf}T00:00:00Z`).getTime()) /
            86_400_000,
        ),
      )
    : 0;
  const zone = {
    total: plan.safeToSpendMinor / 100,
    perDay: daysLeft > 0 ? Math.max(0, Math.floor(plan.safeToSpendMinor / 100 / daysLeft)) : 0,
    until: plan.nextIncomeDate,
    estimating: plan.timeline.length > 0,
    lines: [
      {
        key: 'balance',
        label: 'In your account',
        amount: plan.currentBalanceMinor / 100,
        editable: false,
      },
      {
        key: 'bills',
        label: 'Bills and commitments',
        amount:
          -(plan.protectedBeforeIncomeMinor - plan.livingCostMinor - plan.debtMinimumMinor) / 100,
        editable: false,
        hint: 'Includes unpaid and overdue commitments',
      },
      {
        key: 'essentials',
        label: 'Everyday essentials',
        amount: -plan.livingCostMinor / 100,
        editable: false,
        hint: 'Your weekly allowance through this period',
      },
      {
        key: 'minimums',
        label: 'Debt minimums',
        amount: -plan.debtMinimumMinor / 100,
        editable: false,
      },
      {
        key: 'reserve',
        label: 'Reserved costs subtotal',
        amount: -plan.protectedBeforeIncomeMinor / 100,
        editable: false,
      },
      {
        key: 'buffer',
        label: 'Your buffer',
        amount: -Math.max(0, bufferAmount),
        editable: true,
        hint: "The cushion you'd rather not touch",
      },
    ],
  };

  if (!presentation.complete || !plan.nextIncomeDate)
    return (
      <Sheet visible={visible} onClose={onClose}>
        <FinancialSetupNotice
          state={appState}
          plan={plan}
          onSetup={() => {
            onClose();
            nav.openSheet('onboarding');
          }}
        />
      </Sheet>
    );

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={s.body}>
        <Text style={s.eyebrow}>SEE THE WORKING</Text>
        <Text style={s.headline}>
          {presentation.canReassure ? 'Safe to spend' : presentation.label}
        </Text>
        <Text style={s.rowHint}>
          Until {formatFinancialDate(zone.until)} · before the next income arrives.
        </Text>
        {!presentation.canReassure && <Text style={s.rowHint}>{presentation.message}</Text>}
        <View style={s.numberRow}>
          {/* Sign-aware headline (plan 107 Step 4): `formatGBP` renders negatives as `−£60`
              (minus BEFORE the pound sign — same convention as SafeZoneWidget's formatter),
              where the old inline template produced the garbled `£-60`. Positive output shape
              is identical (whole pounds, en-GB grouping — zone.total is already an integer). */}
          <Text style={[s.number, { color: zone.total <= 0 ? t.repair : t.ink }]}>
            {formatGBP(zone.total)}
          </Text>
        </View>

        <Text style={s.rowHint}>
          Daily guide: about {formatGBP(zone.perDay)} per day. This is part of the total above.
        </Text>

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
                    onPress={() => changeBuffer(Math.max(0, bufferAmount - 10))}
                    style={[s.stepperBtn, { backgroundColor: t.inset, borderColor: t.hairline }]}
                  >
                    <Text style={s.stepperGlyph}>−</Text>
                  </Pressable>
                  <Text style={s.stepperValue}>{formatGBP(bufferAmount)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Raise buffer by £10"
                    onPress={() => changeBuffer(bufferAmount + 10)}
                    style={[s.stepperBtn, { backgroundColor: t.inset, borderColor: t.hairline }]}
                  >
                    <Text style={s.stepperGlyph}>+</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={[s.rowValue, line.amount < 0 ? { color: t.muted } : null]}>
                  {formatGBP(line.amount)}
                </Text>
              )}
            </View>
          ))}
        </View>

        {zone.estimating ? (
          <Text style={s.estimatingLine}>
            Recorded costs are reserved before income on the date above. Buffer changes save
            immediately; Undo restores the previous buffer.
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
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: gap.sm,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowLabel: { fontSize: 15, color: t.ink },
    rowHint: { marginTop: 2, fontSize: 12.5, color: t.muted },
    rowValue: { fontSize: 15, fontVariant: ['tabular-nums'], color: t.ink },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: gap.xs },
    stepperBtn: {
      width: 48,
      height: 48,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperGlyph: { fontSize: 17, color: t.ink },
    stepperValue: {
      minWidth: 56,
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
