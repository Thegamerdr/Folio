// @rn-sheet     LogPaymentSheet
// @purpose      Log one payment against a declared debt. Reduces the debt balance so the Debt
//               lens's payoff recalculates. Mirrors the LogInvoiceSheet pattern used by the
//               Irregular lens.
// @reads        debts (from store)
// @writes       logDebtPayment (via store)
// @copy         FROZEN — calm, plain. "Which one" · "How much" · one confirm.
// @tokens       --paper --surface --hairline --accent --inset --muted-ink (mapped via
//               '@/folio/theme')
//
// Faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetLogPayment.tsx).
//
// FIDELITY DECISION: the web's `logDebtPayment` returns `{ remaining, paid }` which feeds a toast.
// RN's `logDebtPayment` (apps/mobile/src/folio/store.ts) is `void` — it only writes the new
// balance. This sheet computes the "cleared" / remaining figures itself (from the debt's balance
// before the call) so the confirmation copy stays honest without needing a store-return-value
// change outside this batch's file list.
//
// PARITY_GAPS Group 2 fix: the web shows a confirmation toast after logging a payment ("{name}
// cleared" / "Payment logged · {name}", with the paid/remaining figures). RN previously showed no
// acknowledgment at all. This reuses the existing undo/toast lib (useUndo/showUndo) — Undo re-applies
// the payment amount back onto the balance, a faithful (if stronger) analogue of a plain toast.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { useAppStore, logDebtPayment, undoDebtPayment } from '@/folio/store';
import { useUndo } from '@/folio/ui/useUndo';

export type LogPaymentSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function LogPaymentSheet({ visible, onClose }: LogPaymentSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const debts = useAppStore((st) => st.debts ?? []);
  const { showUndo } = useUndo();

  const [selectedId, setSelectedId] = useState<string>(debts[0]?.id ?? '');
  const [amount, setAmount] = useState<string>(debts[0] ? String(debts[0].minPayment) : '');

  const selected = debts.find((d) => d.id === selectedId);
  const amt = Number(amount) || 0;
  const canLog = Boolean(selected) && amt > 0;

  function handleLog() {
    if (!canLog || !selected) return;
    // Mirrors the store's own clamp (balance never goes negative) so the confirmation figures agree
    // with what actually landed, even on an overpay.
    const paid = Math.min(amt, selected.balance);
    const remaining = Math.max(0, selected.balance - amt);
    const cleared = remaining <= 0;
    const name = selected.name;
    logDebtPayment(selected.id, amt);
    onClose();
    showUndo(cleared ? `${name} cleared` : `Payment logged · ${name}`, () => {
      undoDebtPayment(selected.id, paid);
    });
  }

  if (debts.length === 0) {
    return (
      <Sheet visible={visible} onClose={onClose}>
        <View style={s.body}>
          <Text style={s.eyebrow}>Log a payment</Text>
          <Text style={s.headline}>
            No debts to <Text style={s.accentWord}>pay yet.</Text>
          </Text>
          <Text style={s.subline}>
            Add a debt first — then payments land here and the payoff recalculates.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[s.primary, { backgroundColor: t.calm, marginTop: gap.xl }]}
          >
            <Text style={[s.primaryLabel, { color: t.accentInk }]}>Close</Text>
          </Pressable>
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={s.body}>
        <Text style={s.eyebrow}>Log a payment</Text>
        <Text style={s.headline}>
          Chip <Text style={s.accentWord}>away.</Text>
        </Text>
        <Text style={s.subline}>Balance drops. Transaction posts. Payoff recalculates.</Text>

        <View style={s.field}>
          <Text style={s.label}>Which one</Text>
          <ScrollView style={s.debtList} contentContainerStyle={s.debtListContent}>
            {debts.map((d) => {
              const isSelected = selectedId === d.id;
              return (
                <Pressable
                  key={d.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    setSelectedId(d.id);
                    setAmount(String(d.minPayment));
                  }}
                  style={[
                    s.debtRow,
                    {
                      backgroundColor: isSelected ? t.calmSoft : t.inset,
                      borderColor: isSelected ? t.calm : t.hairline,
                    },
                  ]}
                >
                  <View style={s.debtRowBody}>
                    <Text style={s.debtName}>{d.name}</Text>
                    <Text style={s.debtMeta}>
                      £{d.balance.toLocaleString('en-GB')} · {d.apr}% · min £{d.minPayment}
                    </Text>
                  </View>
                  <Text style={s.debtKind}>{d.kind}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Amount</Text>
          <View style={[s.moneyRow, { backgroundColor: t.inset, borderColor: t.hairline }]}>
            <Text style={[s.currency, { color: t.muted }]}>£</Text>
            <TextInput
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={t.muted}
              style={[s.moneyInput, { color: t.ink }]}
              accessibilityLabel="Amount"
            />
          </View>
          {selected && amt > selected.balance ? (
            <Text style={s.warnLine}>
              That's more than the balance — Melo will only pay off the £
              {selected.balance.toLocaleString('en-GB')} left.
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canLog }}
          disabled={!canLog}
          onPress={handleLog}
          style={[s.primary, { backgroundColor: canLog ? t.calm : `${t.muted}66` }]}
        >
          <Text style={[s.primaryLabel, { color: t.accentInk }]}>Log payment</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onClose} style={s.cancel}>
          <Text style={s.cancelLabel}>Cancel</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    body: { paddingHorizontal: gap.xs, paddingBottom: gap.xs },
    eyebrow: { fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: t.muted },
    headline: {
      marginTop: gap.xs,
      fontFamily: serif.display,
      fontSize: 26,
      lineHeight: 30,
      color: t.ink,
    },
    accentWord: { color: t.calm },
    subline: { marginTop: gap.xs, fontSize: 12.5, fontStyle: 'italic', color: t.muted },
    field: { marginTop: gap.lg },
    label: { fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', color: t.muted },
    debtList: { marginTop: gap.xs, maxHeight: 220 },
    debtListContent: { gap: 6 },
    debtRow: {
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: gap.md,
      paddingVertical: gap.sm + 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    debtRowBody: { flex: 1, minWidth: 0 },
    debtName: { fontSize: 13, fontWeight: '500', color: t.ink },
    debtMeta: { marginTop: 2, fontSize: 11, fontVariant: ['tabular-nums'], color: t.muted },
    debtKind: {
      marginLeft: gap.sm,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: t.muted,
    },
    moneyRow: {
      marginTop: gap.xs,
      height: 44,
      paddingHorizontal: gap.md,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    currency: { fontSize: 14, fontVariant: ['tabular-nums'] },
    moneyInput: { flex: 1, fontSize: 13.5, fontVariant: ['tabular-nums'], padding: 0 },
    warnLine: { marginTop: 6, fontSize: 11, fontStyle: 'italic', color: t.caution },
    primary: {
      marginTop: gap.xl,
      height: 54,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryLabel: { fontSize: 15, fontWeight: '500' },
    cancel: { marginTop: gap.sm, height: 44, alignItems: 'center', justifyContent: 'center' },
    cancelLabel: { fontSize: 13.5, color: t.muted },
  });
}
