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

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import DateTimePicker from '@react-native-community/datetimepicker';

import {
  gap,
  money,
  radius,
  serif,
  Sheet,
  useTheme,
  weightFamily,
  type Palette,
} from '@/folio/theme';
import { debtDraftIssue, parseDayOfMonth } from '@/folio/lib/formDrafts';
import { parseManualMoney } from '@/folio/lib/manualMoney';
import { toFinancialPlanInput } from '@/folio/lib/financialPlan';
import { formatFinancialDate, formatMoney } from '@/folio/lib/financialPresentation';
import { setDebtMinimumOccurrenceResolution } from '@/folio/lib/obligationState';
import {
  addDebt,
  getFinancialResetGeneration,
  getState,
  removeDebt,
  restoreDebtTracking,
  updateDebt,
  useAppStore,
  type Debt,
} from '@/folio/store';
import { useUndo } from '@/folio/ui/useUndo';

export type AddDebtSheetProps = {
  visible: boolean;
  onClose: () => void;
  targetId?: string | undefined;
};

const KINDS: readonly { id: Debt['kind']; label: string; hint: string }[] = [
  { id: 'loan', label: 'Loan', hint: 'personal, student, car' },
  { id: 'card', label: 'Card', hint: 'credit card balance' },
  { id: 'bnpl', label: 'BNPL', hint: 'Klarna, Clearpay, PayPal in 3' },
  { id: 'other', label: 'Other', hint: 'family, overdraft, tab' },
];

function parseNonNegative(raw: string): number {
  if (raw.trim() === '') return 0;
  return parseManualMoney(raw, { allowZero: true }) ?? NaN;
}

function validISODate(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === raw;
}

export function AddDebtSheet({ visible, onClose, targetId }: AddDebtSheetProps) {
  const t = useTheme();
  const s = makeStyles(t);
  const { showUndo } = useUndo();
  const appState = useAppStore((state) => state);
  const target = useAppStore((state) =>
    targetId === undefined
      ? null
      : ((state.debts ?? []).find((debt) => debt.id === targetId) ?? null),
  );
  const unpaidMinimum =
    target === null
      ? undefined
      : toFinancialPlanInput(appState, { horizonDays: 0 }).debts?.find(
          (debt) => debt.id === target.id,
        )?.minimumOccurrences?.[0];

  function confirmMinimumPaid() {
    if (target === null || unpaidMinimum === undefined) return;
    const previous = target.minimumOccurrences?.[unpaidMinimum.date] ?? {
      status: 'unpaid' as const,
    };
    Alert.alert(
      'Confirm this minimum is already paid',
      `${target.name} · due ${formatFinancialDate(unpaidMinimum.date)} · ${formatMoney(unpaidMinimum.amountMinor / 100)}. Only confirm when your current cash and debt balances already include this payment. Extra repayments do not automatically settle the monthly minimum.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Already paid',
          onPress: () => {
            setDebtMinimumOccurrenceResolution(target.id, unpaidMinimum.date, { status: 'paid' });
            showUndo(`${target.name} minimum · ${unpaidMinimum.date} marked paid`, () =>
              setDebtMinimumOccurrenceResolution(target.id, unpaidMinimum.date, previous),
            );
          },
        },
      ],
    );
  }

  const [name, setName] = useState('');
  const [kind, setKind] = useState<Debt['kind']>('card');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [dueDayInput, setDueDayInput] = useState('1');
  const [arrears, setArrears] = useState(false);
  const [promoUntil, setPromoUntil] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [showPromoPicker, setShowPromoPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function confirmRemove() {
    if (target === null || target.linkedAccountId !== undefined) return;
    const before = getState();
    const position = (before.debts ?? []).findIndex((debt) => debt.id === target.id);
    const generation = getFinancialResetGeneration();
    Alert.alert(
      `Stop tracking ${target.name}?`,
      `This removes the ${money(Math.round(target.balance * 100))} debt record and its future minimums from your plan. It does not pay or cancel the real debt, reverse cash, or delete recorded payments. Payment history stays available. Undo restores this debt record.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop tracking debt',
          style: 'destructive',
          onPress: () => {
            removeDebt(target.id);
            onClose();
            showUndo(`${target.name} removed from tracking`, () => {
              restoreDebtTracking(target, position, before.activeWorkspaceId, generation);
            });
          },
        },
      ],
    );
  }

  useEffect(() => {
    if (target === null) {
      if (targetId === undefined) reset();
      return;
    }
    setName(target.name);
    setKind(target.kind);
    setBalance(String(target.balance));
    setApr(target.aprKnown === false ? '' : String(target.apr));
    setMinPayment(String(target.minPayment));
    setDueDayInput(String(target.dueDom));
    setArrears(target.arrears === true);
    setPromoUntil(target.promoUntil ?? '');
  }, [target, targetId]);

  const bal = parseNonNegative(balance);
  const rate = parseNonNegative(apr);
  const min = parseNonNegative(minPayment);
  const draftIssue = debtDraftIssue({
    name,
    balance,
    apr,
    minimum: minPayment,
    dueDay: dueDayInput,
    editing: target !== null,
  });
  const dueDom = parseDayOfMonth(dueDayInput) ?? 1;
  const canAdd = draftIssue === null && !saving;
  const activeKind = KINDS.find((k) => k.id === kind);

  function reset() {
    setName('');
    setKind('card');
    setBalance('');
    setApr('');
    setMinPayment('');
    setDueDayInput('1');
    setArrears(false);
    setPromoUntil('');
    setAdvanced(false);
    setSaving(false);
    savingRef.current = false;
    setSaveError(null);
  }

  function handleAdd() {
    if (!canAdd || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    Keyboard.dismiss();
    requestAnimationFrame(() => {
      try {
        if (target !== null) {
          updateDebt(target.id, {
            name,
            kind,
            balance: bal,
            apr: rate,
            aprKnown: apr.trim().length > 0,
            minPayment: min,
            dueDom,
            arrears,
            ...(validISODate(promoUntil.trim()) ? { promoUntil: promoUntil.trim() } : {}),
          });
          const saved = getState().debts?.find((debt) => debt.id === target.id);
          if (
            !saved ||
            saved.name !== name.trim() ||
            saved.balance !== bal ||
            saved.apr !== rate ||
            saved.aprKnown !== apr.trim().length > 0 ||
            saved.minPayment !== min ||
            saved.dueDom !== dueDom
          ) {
            throw new Error('Debt changes were not applied');
          }
          onClose();
          return;
        }
        const d = addDebt({
          name,
          kind,
          balance: bal,
          apr: rate,
          aprKnown: apr.trim().length > 0,
          minPayment: min,
          dueDom,
          arrears,
          ...(validISODate(promoUntil.trim()) ? { promoUntil: promoUntil.trim() } : {}),
        });
        onClose();
        reset();
        showUndo(`Debt added · ${d.name} · ${money(Math.round(d.balance * 100))}`, () => {
          removeDebt(d.id);
        });
      } catch {
        setSaveError(
          'This debt could not be saved. Your entries are still here; please try again.',
        );
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    });
  }

  const footer = (
    <View>
      {saveError || draftIssue ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>
          {saveError ?? draftIssue}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={target === null ? 'Add debt' : 'Save changes'}
        accessibilityState={{ disabled: !canAdd, busy: saving }}
        disabled={!canAdd}
        onPress={handleAdd}
        style={[s.primary, { backgroundColor: t.calm, opacity: canAdd || saving ? 1 : 0.45 }]}
      >
        <Text style={[s.primaryLabel, { color: t.inverse }]}>
          {saving
            ? target === null
              ? 'Adding debt…'
              : 'Saving changes…'
            : target === null
              ? 'Add debt'
              : 'Save changes'}
        </Text>
      </Pressable>
    </View>
  );
  return (
    <Sheet visible={visible} onClose={onClose} footer={footer}>
      <Text style={s.eyebrow}>{target === null ? 'Add a debt' : 'Edit a debt'}</Text>
      <Text accessibilityRole="header" style={s.headline}>
        {target === null ? 'One debt at a time.' : 'Edit this debt'}
      </Text>
      <Text style={[s.subline, { color: t.muted }]}>
        Required fields are marked *. Nothing moves money at your bank.
      </Text>
      <View style={s.field}>
        <Text style={[s.label, { color: t.muted }]}>Debt name *</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Barclaycard"
          placeholderTextColor={t.muted}
          style={[s.input, { backgroundColor: t.inset, borderColor: t.hairline, color: t.ink }]}
          accessibilityLabel="Debt name, required"
        />
      </View>
      <View style={s.field}>
        <Text style={[s.label, { color: t.muted }]}>Outstanding balance *</Text>
        <View style={[s.moneyRow, { backgroundColor: t.inset, borderColor: t.hairline }]}>
          <Text style={[s.currency, { color: t.muted }]}>£</Text>
          <TextInput
            value={balance}
            onChangeText={setBalance}
            selectTextOnFocus
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={t.muted}
            style={[s.moneyInput, { color: t.ink }]}
            accessibilityLabel="Balance, required"
          />
        </View>
      </View>
      <View style={s.field}>
        <Text style={[s.label, { color: t.muted }]}>Monthly minimum payment *</Text>
        <View style={[s.moneyRow, { backgroundColor: t.inset, borderColor: t.hairline }]}>
          <Text style={[s.currency, { color: t.muted }]}>£</Text>
          <TextInput
            value={minPayment}
            onChangeText={setMinPayment}
            selectTextOnFocus
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={t.muted}
            style={[s.moneyInput, { color: t.ink }]}
            accessibilityLabel="Minimum per month, required"
          />
        </View>
        <Text style={s.helper}>
          {target === null
            ? 'Enter the minimum required by the lender, above £0.'
            : 'A £0 minimum is allowed when editing an existing debt.'}
        </Text>
      </View>
      <View style={s.field}>
        <Text style={[s.label, { color: t.muted }]}>Due day each month *</Text>
        <TextInput
          value={dueDayInput}
          onChangeText={setDueDayInput}
          selectTextOnFocus
          keyboardType="number-pad"
          style={[s.input, { backgroundColor: t.inset, borderColor: t.hairline, color: t.ink }]}
          accessibilityLabel="Due day of month, required"
        />
        <Text
          style={parseDayOfMonth(dueDayInput) === undefined ? s.error : s.helper}
          accessibilityLiveRegion="polite"
        >
          {parseDayOfMonth(dueDayInput) === undefined
            ? 'Enter a day from 1 to 31.'
            : 'Choose 1–31. In a shorter month, the payment falls on its last day.'}
        </Text>
      </View>
      <View style={s.field}>
        <Text style={[s.label, { color: t.muted }]}>Annual interest rate (APR)</Text>
        <View style={[s.moneyRow, { backgroundColor: t.inset, borderColor: t.hairline }]}>
          <TextInput
            value={apr}
            onChangeText={setApr}
            selectTextOnFocus
            keyboardType="decimal-pad"
            placeholder="Unknown"
            placeholderTextColor={t.muted}
            style={[s.moneyInput, { color: t.ink }]}
            accessibilityLabel="APR, optional"
          />
          <Text style={[s.currency, { color: t.muted }]}>%</Text>
        </View>
        <Text style={s.helper}>
          The yearly interest rate from your lender. Enter 0 for interest-free; leave blank if
          unknown.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: advanced }}
        onPress={() => setAdvanced((value) => !value)}
        style={s.cancel}
      >
        <Text style={[s.cancelLabel, { color: t.calmStrong }]}>
          {advanced ? 'Hide debt details' : 'More debt details'} · {activeKind?.label}
          {arrears ? ' · Behind on a payment' : ''}
          {promoUntil ? ' · Promotional rate' : ''}
        </Text>
      </Pressable>
      {advanced ? (
        <View>
          <Text style={[s.label, { color: t.muted }]}>Kind of debt</Text>
          <View style={s.kindGrid}>
            {KINDS.map((entry) => (
              <Pressable
                key={entry.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: kind === entry.id }}
                onPress={() => setKind(entry.id)}
                style={[s.kindChip, { backgroundColor: kind === entry.id ? t.calmSoft : t.inset }]}
              >
                <Text style={[s.kindChipLabel, { color: t.ink }]}>{entry.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.helper}>{activeKind?.hint}</Text>
          <View style={[s.priorityRow, { borderColor: t.hairline, backgroundColor: t.inset }]}>
            <Text style={[s.priorityLabel, { color: t.ink, flex: 1 }]}>Behind on a payment?</Text>
            <Text style={[s.priorityValue, { color: t.ink }]}>{arrears ? 'Yes' : 'No'}</Text>
            <Switch
              accessibilityLabel="Behind on a payment"
              value={arrears}
              onValueChange={setArrears}
              trackColor={{ true: t.calm }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              Keyboard.dismiss();
              setShowPromoPicker(true);
            }}
            style={s.cancel}
          >
            <Text style={[s.cancelLabel, { color: t.calmStrong }]}>
              Promotional rate end date ·{' '}
              {validISODate(promoUntil)
                ? new Date(`${promoUntil}T12:00:00`).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Not set'}
            </Text>
          </Pressable>
          <Text style={s.helper}>Optional, for a temporary rate such as a 0% offer.</Text>
          {showPromoPicker ? (
            <DateTimePicker
              value={validISODate(promoUntil) ? new Date(`${promoUntil}T12:00:00`) : new Date()}
              mode="date"
              onChange={(_event, selected) => {
                setShowPromoPicker(false);
                if (selected)
                  setPromoUntil(
                    `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`,
                  );
              }}
            />
          ) : null}
        </View>
      ) : null}
      {target !== null ? (
        target.linkedAccountId === undefined ? (
          <Pressable accessibilityRole="button" onPress={confirmRemove} style={s.cancel}>
            <Text style={[s.cancelLabel, { color: t.repair }]}>Stop tracking this debt</Text>
          </Pressable>
        ) : (
          <Text style={s.helper}>
            This debt is linked to an account. Manage the account from Account; recorded payments
            stay in history.
          </Text>
        )
      ) : null}
      {unpaidMinimum ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark minimum already paid"
          onPress={confirmMinimumPaid}
          style={s.cancel}
        >
          <Text style={[s.cancelLabel, { color: t.calmStrong }]}>
            {money(unpaidMinimum.amountMinor)} minimum due{' '}
            {new Date(`${unpaidMinimum.date}T12:00:00`).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })}{' '}
            · mark already paid
          </Text>
        </Pressable>
      ) : null}
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
      fontSize: 13,
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
      minHeight: 48,
      justifyContent: 'center',
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
      minHeight: 48,
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
      minHeight: 48,
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
      minHeight: 52,
      justifyContent: 'center',
      marginTop: gap.xs,
    },
    primaryLabel: {
      fontSize: 15,
      fontWeight: '500',
    },
    cancel: {
      alignItems: 'center',
      minHeight: 48,
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
    priorityRow: {
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: gap.md,
      minHeight: 44,
      paddingHorizontal: gap.md,
    },
    helper: { color: t.muted, fontSize: 12, lineHeight: 17, marginTop: gap.xs },
    error: { color: t.repair, fontSize: 13, lineHeight: 18, marginVertical: gap.xs },
    priorityLabel: { fontSize: 13 },
    priorityValue: { fontFamily: weightFamily(500), fontSize: 13 },
  });
}
