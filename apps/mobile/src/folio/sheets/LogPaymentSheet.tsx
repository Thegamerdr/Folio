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
// Every confirmed payment uses the shared canonical posting: cash, principal, linked liability
// and transaction history change together. The returned scoped undo reverses the recorded effects,
// including an overpayment's full cash amount and its smaller principal reduction.

import { useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { useAppStore, logDebtPayment, getState } from '@/folio/store';
import { useUndo } from '@/folio/ui/useUndo';
import { previewDebtPaymentChange } from '@/folio/lib/paymentPresentation';
import { paymentAmountShortcuts } from '@/folio/lib/financialActionInputs';
import { formatMoney } from '@/folio/lib/financialPresentation';

export type LogPaymentSheetProps = {
  visible: boolean;
  onClose: () => void;
  targetId?: string | undefined;
};

export function LogPaymentSheet({ visible, onClose, targetId }: LogPaymentSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const state = useAppStore((st) => st);
  const debts = useAppStore((st) => st.debts ?? []);
  const accounts = useAppStore((st) => st.accounts);
  const cashAccounts = useMemo(
    () => (accounts ?? []).filter((account) => !account.isLiability && account.closed !== true),
    [accounts],
  );
  const { showUndo, setConfirmationOpen } = useUndo();

  const initialDebt =
    debts.find((debt) => debt.id === targetId) ??
    debts.find((debt) => debt.balance > 0) ??
    debts[0];
  const [selectedId, setSelectedId] = useState<string>(initialDebt?.id ?? '');
  const [amount, setAmount] = useState<string>(initialDebt ? String(initialDebt.minPayment) : '');
  const submitting = useRef(false);
  const confirming = useRef(false);
  const [cashAccountId, setCashAccountId] = useState(
    cashAccounts.length === 1 ? cashAccounts[0]!.id : '',
  );
  const effectiveCashAccountId = cashAccounts.length === 1 ? cashAccounts[0]!.id : cashAccountId;

  const selected = debts.find((d) => d.id === selectedId);
  const shortcuts = paymentAmountShortcuts(selected);
  const amt = Number(amount) || 0;
  const canLog =
    Boolean(selected) &&
    Number.isFinite(amt) &&
    /^\d+(?:\.\d{0,2})?$/.test(amount) &&
    amt > 0 &&
    cashAccounts.some((account) => account.id === effectiveCashAccountId);

  const preview = useMemo(() => {
    if (!canLog || !selected) return null;
    const at = new Date().toISOString();
    try {
      return previewDebtPaymentChange(
        state,
        undefined,
        {
          id: 'payment-preview',
          workspaceId: state.activeWorkspaceId,
          when: at,
          merchant: `Debt payment: ${selected.name}`,
          amount: -amt,
          category: 'bills',
          source: 'manual',
          accountId: effectiveCashAccountId,
          financialAction: { kind: 'debt-payment', debtId: selected.id, principalAppliedMinor: 0 },
        },
        at,
      );
    } catch {
      return null;
    }
  }, [state, selected, amt, canLog, effectiveCashAccountId]);

  function handleLog() {
    if (!canLog || !selected || submitting.current) return;
    submitting.current = true;
    // A bank sync or another edit while the native confirmation is open must not change the
    // consequences the user approved. Re-read the canonical preview before posting.
    try {
      const current = getState();
      const at = new Date().toISOString();
      const latest = previewDebtPaymentChange(
        current,
        undefined,
        {
          id: 'payment-preview',
          workspaceId: state.activeWorkspaceId,
          when: at,
          merchant: `Debt payment: ${selected.name}`,
          amount: -amt,
          category: 'bills',
          source: 'manual',
          accountId: effectiveCashAccountId,
          financialAction: { kind: 'debt-payment', debtId: selected.id, principalAppliedMinor: 0 },
        },
        at,
      );
      if (
        current.activeWorkspaceId !== state.activeWorkspaceId ||
        JSON.stringify(latest.rows) !== JSON.stringify(preview?.rows)
      ) {
        submitting.current = false;
        Alert.alert(
          'Figures changed',
          'Review this payment again using the latest balances. Nothing was recorded.',
        );
        return;
      }
    } catch {
      submitting.current = false;
      Alert.alert(
        'Payment not recorded',
        'Review the selected debt and account before trying again.',
      );
      return;
    }
    // Mirrors the store's own clamp (balance never goes negative) so the confirmation figures agree
    // with what actually landed, even on an overpay.
    const name = selected.name;
    const result = logDebtPayment(selected.id, amt, effectiveCashAccountId);
    if (!result.applied) {
      submitting.current = false;
      Alert.alert('Payment not recorded', result.reason);
      return;
    }
    const cleared = getState().debts?.find((debt) => debt.id === selected.id)?.balance === 0;
    onClose();
    showUndo(cleared ? `Payment recorded · ${name} now £0` : `Payment recorded · ${name}`, () => {
      if (result.undo() === false)
        Alert.alert(
          'Payment kept',
          'The payment changed. Review its latest transaction before undoing it.',
        );
    });
  }

  function reviewAndLog() {
    Keyboard.dismiss();
    if (!canLog || !selected || !preview || confirming.current || submitting.current) return;
    confirming.current = true;
    const dismissConfirmation = () => {
      confirming.current = false;
      setConfirmationOpen(false);
    };
    setConfirmationOpen(true);
    Alert.alert(
      amt > selected.balance ? 'Record this overpayment?' : 'Record this payment?',
      `${preview.text}\n\nThis records a payment you already made. Melo does not send money.${amt > selected.balance ? ` Only ${formatMoney(selected.balance, true)} reduces the debt; the full ${formatMoney(amt, true)} reduces tracked cash.` : ''}`,
      [
        { text: 'Back', style: 'cancel', onPress: dismissConfirmation },
        {
          text: 'Record payment',
          onPress: () => {
            dismissConfirmation();
            handleLog();
          },
        },
      ],
      { cancelable: true, onDismiss: dismissConfirmation },
    );
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
            <Text style={[s.primaryLabel, { color: t.inverse }]}>Close</Text>
          </Pressable>
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      footer={
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canLog || !preview }}
          disabled={!canLog || !preview}
          onPress={reviewAndLog}
          style={[
            s.primary,
            { marginTop: 0, backgroundColor: canLog && preview ? t.calm : `${t.muted}66` },
          ]}
        >
          <Text style={[s.primaryLabel, { color: t.inverse }]}>Review payment</Text>
        </Pressable>
      }
    >
      <View style={s.body}>
        <Text style={s.eyebrow}>Log a payment</Text>
        <Text style={s.headline}>
          Chip <Text style={s.accentWord}>away.</Text>
        </Text>
        <Text style={s.subline}>
          Record a payment you already made. Review its effect before saving.
        </Text>

        {cashAccounts.length !== 1 ? (
          <View style={s.field}>
            <Text style={s.label}>Paid from</Text>
            <View style={[s.debtList, s.debtListContent]}>
              {cashAccounts.map((account) => (
                <Pressable
                  key={account.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Pay from ${account.name}`}
                  accessibilityState={{ selected: cashAccountId === account.id }}
                  onPress={() => setCashAccountId(account.id)}
                  style={[
                    s.debtRow,
                    {
                      backgroundColor: cashAccountId === account.id ? t.calmSoft : t.inset,
                      borderColor: cashAccountId === account.id ? t.calm : t.hairline,
                    },
                  ]}
                >
                  <Text style={s.debtName}>{account.name}</Text>
                </Pressable>
              ))}
            </View>
            {cashAccounts.length === 0 ? (
              <Text style={s.warnLine}>Add an active cash account before recording a payment.</Text>
            ) : null}
          </View>
        ) : null}
        <View style={s.field}>
          <Text style={s.label}>Which one</Text>
          <View style={[s.debtList, s.debtListContent]}>
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
                      {formatMoney(d.balance)}
                      {d.balance === 0 ? ' · Cleared' : ''} ·{' '}
                      {d.aprKnown === false ? 'APR unknown' : `${d.apr}% APR`} · minimum{' '}
                      {formatMoney(d.minPayment)}
                    </Text>
                  </View>
                  <Text style={s.debtKind}>{d.kind}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Amount</Text>
          <View style={[s.moneyRow, { backgroundColor: t.inset, borderColor: t.hairline }]}>
            <Text style={[s.currency, { color: t.muted }]}>£</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={t.muted}
              style={[s.moneyInput, { color: t.ink }]}
              accessibilityLabel="Amount"
            />
          </View>
          <View style={s.shortcuts}>
            {[
              { label: 'Minimum', value: shortcuts.minimum },
              { label: 'Full remaining balance', value: shortcuts.full },
            ].map((shortcut) => (
              <Pressable
                key={shortcut.label}
                accessibilityRole="button"
                accessibilityState={{ disabled: shortcut.value === null }}
                disabled={shortcut.value === null}
                onPress={() => {
                  if (shortcut.value !== null) setAmount(shortcut.value);
                }}
                style={[s.shortcut, shortcut.value === null ? { opacity: 0.45 } : undefined]}
              >
                <Text style={s.shortcutLabel}>
                  {shortcut.label}
                  {shortcut.value !== null ? ` · ${formatMoney(Number(shortcut.value))}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
          {selected && amt > selected.balance ? (
            <Text style={s.warnLine}>
              The full £{amt.toLocaleString('en-GB')} leaves cash. Only the £
              {selected.balance.toLocaleString('en-GB')} outstanding reduces this debt.
            </Text>
          ) : null}
        </View>

        {amount.length > 0 && !/^\d+(?:\.\d{0,2})?$/.test(amount) ? (
          <Text style={s.warnLine}>Enter an amount with no more than two decimal places.</Text>
        ) : null}
        {preview ? (
          <Text style={[s.subline, { fontStyle: 'normal', lineHeight: 22, marginTop: 16 }]}>
            {preview.text}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    shortcuts: { gap: 8, marginTop: 12 },
    shortcut: {
      minHeight: 48,
      padding: 12,
      borderRadius: radius.md,
      backgroundColor: t.inset,
      justifyContent: 'center',
    },
    shortcutLabel: { fontSize: 13, color: t.ink },
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
    debtList: { marginTop: gap.xs },
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
      height: 48,
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
