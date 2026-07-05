// @rn-sheet     AddDebtSheet
// @purpose      Declare one outstanding debt line (loan / card / BNPL / other). Feeds `debts[]` in the
//               store; the Debt lens strategy + amortisation engine (lib/modes/debtEngine.ts) read it
//               live.
// @reads        —
// @writes       addDebt (via the store)
// @copy         FROZEN — calm, plain. Kind of debt, name, balance, APR, min payment, day of month. No
//               jargon, no "amortised".
// @tokens       --paper --surface --hairline --accent --inset --muted-ink (mapped via '@/folio/theme')
//
// Faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetAddDebt.tsx).
//
// PARITY_GAPS Group 2 — this file did not previously exist in RN at all: `nav.go('add-debt')` (the
// ScreenId) routed to the unrelated AddEntryScreen (a recurring bill/debt-PAYMENT quick-add: name +
// amount + frequency), which has no `apr`/`dueDom`/`minPayment` fields and cannot feed a real Debt
// record. This sheet is that missing feature, mounted as a new SheetId ('declare-debt') rather than
// overloading the existing ScreenId, so AddEntryScreen's unrelated flow is left untouched.
//
// The web shows a toast on save ("Debt added · {name} · £{balance} at {apr}% — min £{minPayment} on
// the {dueDom}."). RN has no generic toast primitive, but per the parity-fix brief this reuses the
// existing undo/toast lib (useUndo/showUndo) as the confirmation surface — Undo here simply removes
// the just-added debt, which is a faithful (if stronger) analogue of a plain acknowledgment toast.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { addDebt, removeDebt, type Debt } from '@/folio/store';
import { useUndo } from '@/folio/ui/useUndo';

export type AddDebtSheetProps = {
  visible: boolean;
  onClose: () => void;
};

const KINDS: readonly { id: Debt['kind']; label: string; hint: string }[] = [
  { id: 'loan', label: 'Loan', hint: 'personal, student, car' },
  { id: 'card', label: 'Card', hint: 'credit card balance' },
  { id: 'bnpl', label: 'BNPL', hint: 'Klarna, Clearpay, PayPal in 3' },
  { id: 'other', label: 'Other', hint: 'family, overdraft, tab' },
];

export function AddDebtSheet({ visible, onClose }: AddDebtSheetProps) {
  const t = useTheme();
  const s = makeStyles(t);
  const { showUndo } = useUndo();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<Debt['kind']>('card');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [dueDom, setDueDom] = useState(1);

  const bal = Number(balance) || 0;
  const rate = Number(apr) || 0;
  const min = Number(minPayment) || 0;
  const canAdd = name.trim().length > 0 && bal > 0 && min > 0;
  const activeKind = KINDS.find((k) => k.id === kind);

  function reset() {
    setName('');
    setKind('card');
    setBalance('');
    setApr('');
    setMinPayment('');
    setDueDom(1);
  }

  function handleAdd() {
    if (!canAdd) return;
    const d = addDebt({ name, kind, balance: bal, apr: rate, minPayment: min, dueDom });
    onClose();
    reset();
    showUndo(`Debt added · ${d.name}`, () => {
      removeDebt(d.id);
    });
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={s.headerRow}>
        <Text style={s.eyebrow}>Add a debt</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          onPress={onClose}
          style={({ pressed }) => [pressed ? s.pressed : undefined]}
        >
          <Text style={[s.closeGlyph, { color: t.muted }]}>×</Text>
        </Pressable>
      </View>
      <Text accessibilityRole="header" style={s.headline}>
        {'One line at a '}
        <Text style={[s.headlineAccent, { color: t.calm }]}>time.</Text>
      </Text>
      <Text style={[s.subline, { color: t.muted }]}>Rough is fine — you can adjust it later.</Text>

      <View style={s.field}>
        <Text style={[s.label, { color: t.muted }]}>Kind</Text>
        <View style={s.kindGrid}>
          {KINDS.map((k) => {
            const selected = k.id === kind;
            return (
              <Pressable
                key={k.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={k.label}
                onPress={() => setKind(k.id)}
                style={({ pressed }) => [
                  s.kindChip,
                  { backgroundColor: selected ? t.calmSoft : t.inset },
                  pressed ? s.pressed : undefined,
                ]}
              >
                <Text style={[s.kindChipLabel, { color: t.ink }]}>{k.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {activeKind ? (
          <Text style={[s.kindHint, { color: t.muted }]}>{activeKind.hint}</Text>
        ) : null}
      </View>

      <View style={s.field}>
        <Text style={[s.label, { color: t.muted }]}>What is it</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Barclaycard"
          placeholderTextColor={t.muted}
          style={[s.input, { backgroundColor: t.inset, borderColor: t.hairline, color: t.ink }]}
          accessibilityLabel="What is it"
        />
      </View>

      <View style={s.row}>
        <View style={s.rowField}>
          <Text style={[s.label, { color: t.muted }]}>Balance</Text>
          <View style={[s.moneyRow, { backgroundColor: t.inset, borderColor: t.hairline }]}>
            <Text style={[s.currency, { color: t.muted }]}>£</Text>
            <TextInput
              value={balance}
              onChangeText={(v) => setBalance(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={t.muted}
              style={[s.moneyInput, { color: t.ink }]}
              accessibilityLabel="Balance"
            />
          </View>
        </View>
        <View style={s.rowField}>
          <Text style={[s.label, { color: t.muted }]}>APR</Text>
          <View style={[s.moneyRow, { backgroundColor: t.inset, borderColor: t.hairline }]}>
            <TextInput
              value={apr}
              onChangeText={(v) => setApr(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={t.muted}
              style={[s.moneyInput, { color: t.ink }]}
              accessibilityLabel="APR"
            />
            <Text style={[s.currency, { color: t.muted }]}>%</Text>
          </View>
        </View>
      </View>

      <View style={s.row}>
        <View style={s.rowField}>
          <Text style={[s.label, { color: t.muted }]}>Minimum / mo</Text>
          <View style={[s.moneyRow, { backgroundColor: t.inset, borderColor: t.hairline }]}>
            <Text style={[s.currency, { color: t.muted }]}>£</Text>
            <TextInput
              value={minPayment}
              onChangeText={(v) => setMinPayment(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={t.muted}
              style={[s.moneyInput, { color: t.ink }]}
              accessibilityLabel="Minimum per month"
            />
          </View>
        </View>
        <View style={s.rowField}>
          <Text style={[s.label, { color: t.muted }]}>Due day</Text>
          <View style={[s.moneyRow, { backgroundColor: t.inset, borderColor: t.hairline }]}>
            <TextInput
              value={String(dueDom)}
              onChangeText={(v) => {
                const n = Number(v.replace(/[^0-9]/g, '')) || 1;
                setDueDom(Math.max(1, Math.min(31, n)));
              }}
              keyboardType="number-pad"
              placeholderTextColor={t.muted}
              style={[s.moneyInput, { color: t.ink }]}
              accessibilityLabel="Due day of month"
            />
            <Text style={[s.currencySmall, { color: t.muted }]}>of month</Text>
          </View>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add debt"
        accessibilityState={{ disabled: !canAdd }}
        disabled={!canAdd}
        onPress={handleAdd}
        style={({ pressed }) => [
          s.primary,
          { backgroundColor: t.calm, opacity: canAdd ? 1 : 0.4 },
          pressed && canAdd ? s.pressed : undefined,
        ]}
      >
        <Text style={[s.primaryLabel, { color: t.inverse }]}>Add debt</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        onPress={onClose}
        style={({ pressed }) => [s.cancel, pressed ? s.pressed : undefined]}
      >
        <Text style={[s.cancelLabel, { color: t.muted }]}>Cancel</Text>
      </Pressable>
    </Sheet>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    eyebrow: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.54,
      textTransform: 'uppercase',
    },
    closeGlyph: {
      fontSize: 18,
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 26,
      lineHeight: 30,
      marginTop: gap.xs,
    },
    headlineAccent: {
      fontFamily: serif.display,
      fontStyle: 'normal',
    },
    subline: {
      fontSize: 12.5,
      fontStyle: 'italic',
      marginTop: gap.xs,
    },
    field: {
      marginTop: gap.lg,
    },
    label: {
      fontSize: 10.5,
      letterSpacing: 1.47,
      textTransform: 'uppercase',
    },
    kindGrid: {
      flexDirection: 'row',
      gap: 6,
      marginTop: gap.sm,
    },
    kindChip: {
      alignItems: 'center',
      borderRadius: radius.md,
      flex: 1,
      paddingVertical: gap.sm,
    },
    kindChipLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
    kindHint: {
      fontSize: 10.5,
      fontStyle: 'italic',
      marginTop: gap.xs,
    },
    input: {
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      fontSize: 13.5,
      height: 44,
      marginTop: gap.sm,
      paddingHorizontal: gap.md,
    },
    row: {
      flexDirection: 'row',
      gap: gap.sm,
      marginTop: gap.md,
    },
    rowField: {
      flex: 1,
    },
    moneyRow: {
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 4,
      height: 44,
      marginTop: gap.sm,
      paddingHorizontal: gap.md,
    },
    currency: {
      fontSize: 14,
      fontVariant: ['tabular-nums'],
    },
    currencySmall: {
      fontSize: 11,
      fontVariant: ['tabular-nums'],
    },
    moneyInput: {
      flex: 1,
      fontSize: 13.5,
      fontVariant: ['tabular-nums'],
      padding: 0,
    },
    primary: {
      alignItems: 'center',
      borderRadius: radius.xl,
      height: 54,
      justifyContent: 'center',
      marginTop: gap.xl,
    },
    primaryLabel: {
      fontSize: 15,
      fontWeight: '500',
    },
    cancel: {
      alignItems: 'center',
      height: 44,
      justifyContent: 'center',
      marginTop: gap.sm,
    },
    cancelLabel: {
      fontSize: 13.5,
    },
    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
  });
}
