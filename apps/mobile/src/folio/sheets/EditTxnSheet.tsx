// @rn-engine edit-txn — REAL. The web source's "Save changes" is a pure visual demo: it calls
//   `onClose` and mutates nothing (SheetEditTxn.tsx), and its fields are a FROZEN, hardcoded subject
//   ("Tesco · 26 June" · £42.00 · Groceries · …) bound to no real transaction. We intentionally make
//   the save real per the handoff + ENGINES.md §6: when the shell threads a `target` (the posted
//   transaction the opener chose), this sheet prefills from THAT row and Save routes a non-destructive
//   correction through the store's `editTransaction` (replace-in-place + append one immutable
//   correction record per changed field; a no-op patch records nothing), then closes.
//
//   The earlier no-op version documented the bug: every opener called nav.openSheet('edit-txn') with
//   NO payload, so the sheet could not know WHICH row the user meant — a hardcoded resolution from the
//   merchant name "Tesco" edited the wrong row. That is fixed at the source: nav.openSheet now carries
//   an optional `{ id }` payload (types.ts), the shell parks it in `editTxnTarget` and threads it here
//   as `target`, and ReviewScreen passes the candidate's real subject id. With NO target (cold open)
//   the sheet renders an honest empty state (InertFallback: "Nothing to edit here" + how to reach a
//   real row) — no sample/fabricated transaction is ever shown, and nothing can be edited from it.
//
// EditTxnSheet — the faithful 1:1 React Native port of the web edit-transaction sheet
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetEditTxn.tsx).
//
// @rn-sheet     EditTxnSheet
// @purpose      Correct an existing transaction. The web source rendered amount / category / repeat /
//               note as read-only rows with a "Save changes" that closed without writing. Per ENGINES
//               §6 D4 (meaningful money-field edits, NOT note-only) this port makes Amount, Category
//               and Note EDITABLE — each change routes through the store's editTransaction as one
//               immutable correction per changed field, replacing the row in place. Repeat is not a
//               Transaction field, so it stays a display row; date editing (needs a platform picker)
//               is a follow-up. Save applies the change(s) via the store, then closes.
// @writes       editTransaction (store; replace-in-place + one TxnEdit per changed field, §6). With no
//               target, or an unchanged note, NOTHING is written (the web close-only contract holds).
//               A successful save also raises a Tier-1 undo window (useUndo/showUndo — ENGINES §6
//               "Undo windows"), matching the web source's `undoToast(...)` after `updateTransaction`;
//               tapping Undo restores every field to its pre-edit snapshot in one call.
// @copy         FROZEN (verbatim frame; the field VALUES are bound from the real transaction)
// @tokens       --surface (field rows) · --hairline (row borders) · --accent (t.calm, primary fill) ·
//               --muted-ink (field labels) · --ink (field values) · --inverse (primary label)
// @motion       sheet-rise + scrim-in (inherited from Sheet) · press 0.97 on the close glyph + the
//               CTA; collapses to final state under reduce-motion (MOTION.md)
//
// Faithful 1:1 RN port. The web source renders ONE branch — the field summary with four rows. There is
// no empty/loading/error/offline branch (STATES.md has no row for an edit sheet). Per MELO_MOODS.md
// this sheet renders NO Melo ("No mood = no Melo").
//
// Design-system discipline: every colour/font/spacing/radius token comes from '@/folio/theme' (which
// re-exports the pressure-map kit). Nothing new is defined — no colour, font, spacing, or dependency.
// The web '×' close glyph is drawn as a small inline react-native-svg cross (the codebase ships no
// icon font).
//
// This sheet OWNS its Sheet host (visible / onClose), mounted as a sibling in the shell — mirroring
// the LogSpendSheet + OnboardingSheet pattern — so it never nests inside the generic sheet host.

import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Svg, { Path } from 'react-native-svg';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import {
  accountIdOf,
  editTransaction,
  rememberMerchantCategory,
  useAppStore,
  type Transaction,
} from '@/folio/store';
import type { EditableTransaction } from '@/folio/lib/editTxn';
import { useUndo } from '@/folio/ui/useUndo';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type EditTxnSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The posted transaction id the opener chose to correct. Threaded by the shell from
   *  nav.openSheet('edit-txn', { id }). Omitted / unresolved → the safe inert fallback. */
  target?: string | undefined;
};

// The store category enum → the human label shown on the read-only Category row. Matches the Timeline
// chip mapping so the same row reads identically wherever the user sees it.
const CATEGORY_LABEL: Readonly<Record<Transaction['category'], string>> = {
  food: 'Groceries',
  transport: 'Transport',
  bills: 'Bills',
  fun: 'Eating out',
  shopping: 'Shopping',
  income: 'Income',
  other: 'Other',
};

// The category chips, in a stable display order, for the editable category selector.
const CATEGORY_ORDER: readonly Transaction['category'][] = [
  'food',
  'transport',
  'fun',
  'bills',
  'shopping',
  'income',
  'other',
];

// "26 June" — the web title's date prose, computed from the real ISO `when`. Parsed at local midnight
// so the day agrees with the stored timestamp (no UTC drift), matching the Today/Timeline formatters.
function monthDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

function dateValue(iso: string): Date {
  const parsed = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Reduced-motion hook (AccessibilityInfo-backed, mirrors the LogSpendSheet hook)
// ---------------------------------------------------------------------------

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

// ---------------------------------------------------------------------------
// EditTxnSheet
// ---------------------------------------------------------------------------

export function EditTxnSheet({ visible, onClose, target }: EditTxnSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  // Read the live transaction the opener chose. Reactive (useAppStore) so the row reflects the latest
  // values; `undefined` when no target is threaded or the id no longer resolves → inert fallback.
  const txn = useAppStore((st) =>
    target ? st.transactions.find((row) => row.id === target) : undefined,
  ) as EditableTransaction | undefined;

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      {txn ? (
        <EditTxnForm styles={s} palette={t} onClose={onClose} txn={txn} />
      ) : (
        <InertFallback styles={s} palette={t} onClose={onClose} />
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Real branch — prefilled from the threaded transaction. Save routes a non-destructive correction
// through the store's editTransaction (ENGINES §6), then closes.
// ---------------------------------------------------------------------------

function EditTxnForm({
  styles: s,
  palette: t,
  onClose,
  txn,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  onClose: () => void;
  txn: EditableTransaction;
}) {
  // Real correction fields (ENGINES §6 D4 — "meaningful money-field edits", not note-only). Amount,
  // Category and Note are editable; each change routes through the store's editTransaction, which
  // records one immutable correction per changed field and replaces the row in place. Amount is held
  // as an unsigned magnitude — the original DIRECTION (spend vs income) is preserved on save, so a
  // correction fixes the figure without silently flipping a spend into income. (Date editing needs a
  // platform date-picker and is a follow-up; Repeat is not a Transaction field, so it stays a display
  // row.)
  // PARITY_GAPS Group 2 fix: the web's Merchant field is a separate editable text input (not folded
  // into the read-only title) — restored here so a user can correct the merchant name, matching
  // SheetEditTxn.tsx exactly. The header title stays live-bound to the field's current value (web
  // behaviour: the title itself is a separate, static "{merchant} · {date}" line that does NOT
  // re-render from the input — kept as the original merchant so the header reads as "which
  // transaction", while the editable Merchant field is the correction surface below it).
  const [merchant, setMerchant] = useState(txn.merchant);
  const [amountText, setAmountText] = useState(Math.abs(txn.amount).toFixed(2));
  const [category, setCategory] = useState<Transaction['category']>(txn.category);
  const [note, setNote] = useState(txn.note ?? '');
  const [when, setWhen] = useState(txn.when);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const accountName = useAppStore((state) => {
    const id = accountIdOf(txn);
    return state.accounts?.find((account) => account.id === id)?.name ?? 'Main';
  });
  // `useAppStore` is backed by `useSyncExternalStore`; returning a freshly-filtered array from the
  // selector makes every snapshot look new and React 19 loops until its maximum update depth. Read
  // the stable store slice first, then derive this transaction's history with `useMemo`.
  const edits = useAppStore((state) => state.edits);
  const corrections = useMemo(
    () => (edits ?? []).filter((edit) => edit.txnId === txn.id),
    [edits, txn.id],
  );
  const { showUndo } = useUndo();

  const title = `${txn.merchant} · ${monthDay(txn.when)}`.replace(/ · $/, '');

  // The signed amount the magnitude input resolves to: keep the original sign (direction), apply the
  // new magnitude. Unparseable input falls back to the current amount, so a bad keystroke never wipes
  // the figure — it simply records no amount change.
  function resolvedAmount(): number {
    const mag = Number(amountText.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(mag)) return txn.amount;
    const sign = txn.amount < 0 ? -1 : 1;
    return sign * mag;
  }

  // Save — apply the correction to THIS transaction via the store. editTransaction runs the pure
  // applyTxnEdit engine, which records ONE immutable TxnEdit per ACTUALLY-changed field and no-ops any
  // field left at its current value (so an untouched field fabricates no history, and a Save that
  // changes nothing writes nothing). It replaces the row in place (same id, no duplicate); every
  // transaction-derived view (Timeline, Insights, Today's recent spend) updates reactively. Then close.
  //
  // A snapshot of the pre-edit fields is captured BEFORE the write so, if anything actually changed,
  // Undo can restore all three fields in one call — mirrors the web source's `undoToast(...)` after
  // `updateTransaction` (SheetEditTxn.tsx), which snapshots merchant/amount/category/when and restores
  // them together. A no-op save (nothing changed) raises no undo window, matching editTransaction's
  // own no-op contract (an unchanged patch writes nothing, so there is nothing to undo).
  function handleSave() {
    const nextMerchant = merchant.trim();
    const nextAmount = resolvedAmount();
    const nextNote = note.trim();
    const categoryChanged = category !== txn.category;
    const changed =
      nextMerchant !== txn.merchant ||
      nextAmount !== txn.amount ||
      when !== txn.when ||
      categoryChanged ||
      nextNote !== (txn.note ?? '');
    const snapshot = {
      merchant: txn.merchant,
      amount: txn.amount,
      when: txn.when,
      category: txn.category,
      note: txn.note ?? '',
    };
    const finalMerchant = nextMerchant || txn.merchant;
    editTransaction(
      txn.id,
      { merchant: finalMerchant, amount: nextAmount, when, category, note: nextNote },
      'user',
    );
    // LEARN (lib/merchantMemory.ts, DATA_INTELLIGENCE.md phase ③): a category correction on a real,
    // already-posted transaction is an explicit override — remember it so a future import for this
    // merchant pre-fills the corrected category instead of re-asking. Only when the category actually
    // changed (an untouched Save writes nothing here either, mirroring editTransaction's own contract).
    if (categoryChanged) rememberMerchantCategory(finalMerchant, category);
    onClose();
    if (changed) {
      showUndo(`Updated ${txn.merchant}`, () => {
        editTransaction(txn.id, snapshot, 'user');
      });
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Header — eyebrow + close glyph. */}
      <View style={s.headerRow}>
        <Text style={s.eyebrow}>Edit transaction</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          onPress={onClose}
          style={({ pressed }) => [pressed ? s.pressed : undefined]}
        >
          <CloseGlyph color={t.muted} />
        </Pressable>
      </View>
      <Text accessibilityRole="header" style={s.headline}>
        {title}
      </Text>

      {/* Editable field rows — bound to the real transaction; Save routes a correction per change. */}
      <View style={s.fields}>
        {/* Merchant — free-text correction (web SheetEditTxn.tsx's separate editable Merchant field,
            restored here; previously this name only appeared in the read-only header title). */}
        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Merchant</Text>
          <TextInput
            accessibilityLabel="Merchant"
            onChangeText={setMerchant}
            placeholder={txn.merchant}
            placeholderTextColor={t.muted}
            style={s.fieldValueInput}
            value={merchant}
          />
        </View>

        {/* Amount — unsigned magnitude input; the original direction is preserved on save. */}
        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Amount</Text>
          <View style={s.amountInputWrap}>
            <Text style={s.amountPrefix}>£</Text>
            <TextInput
              accessibilityLabel="Amount"
              keyboardType="decimal-pad"
              onChangeText={setAmountText}
              placeholder="0.00"
              placeholderTextColor={t.muted}
              style={s.amountInput}
              value={amountText}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Date, ${monthDay(when)}. Tap to change.`}
          onPress={() => setDatePickerOpen(true)}
          style={({ pressed }) => [s.fieldRow, pressed ? s.pressed : undefined]}
        >
          <Text style={s.fieldLabel}>Date</Text>
          <Text style={s.fieldValue}>{monthDay(when)}</Text>
        </Pressable>

        {datePickerOpen ? (
          <View style={s.datePickerWrap}>
            <DateTimePicker
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              maximumDate={new Date()}
              mode="date"
              onChange={(_event: DateTimePickerEvent, selected?: Date) => {
                if (Platform.OS === 'android') setDatePickerOpen(false);
                if (selected) setWhen(localIsoDate(selected));
              }}
              value={dateValue(when)}
            />
            {Platform.OS === 'ios' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setDatePickerOpen(false)}
                style={({ pressed }) => [s.dateDone, pressed ? s.pressed : undefined]}
              >
                <Text style={s.dateDoneLabel}>Done</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Account</Text>
          <Text style={s.fieldValue}>{accountName}</Text>
        </View>

        {/* Repeat — not a Transaction field; stays a display row. */}
        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Repeat</Text>
          <Text style={s.fieldValue}>Once</Text>
        </View>

        {/* Note — free-text correction. */}
        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Note</Text>
          <TextInput
            accessibilityLabel="Note"
            onChangeText={setNote}
            placeholder="Add a note"
            placeholderTextColor={t.muted}
            style={s.fieldValueInput}
            value={note}
          />
        </View>
      </View>

      {/* Category — a tappable chip per category; the selected one is filled. */}
      <View style={s.categoryBlock}>
        <Text style={s.categoryLabel}>Category</Text>
        <View style={s.categoryChips}>
          {CATEGORY_ORDER.map((c) => {
            const selected = c === category;
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setCategory(c)}
                style={({ pressed }) => [
                  s.catChip,
                  selected ? s.catChipOn : undefined,
                  pressed ? s.pressed : undefined,
                ]}
              >
                <Text style={[s.catChipLabel, selected ? s.catChipLabelOn : undefined]}>
                  {CATEGORY_LABEL[c]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {corrections.length > 0 ? (
        <View style={s.historyBlock}>
          <Text style={s.categoryLabel}>Correction history</Text>
          <Text style={s.historyLine}>
            {corrections.length} {corrections.length === 1 ? 'change' : 'changes'} kept with this
            transaction.
          </Text>
        </View>
      ) : null}

      {/* Footer — Cancel (inset fill) + Save changes (accent fill), side by side (web `flex gap-2`).
          Cancel just closes without applying any of the pending edits. */}
      <View style={s.footerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onClose}
          style={({ pressed }) => [
            s.footerButton,
            { backgroundColor: t.inset },
            pressed ? s.pressed : undefined,
          ]}
        >
          <Text style={[s.footerButtonLabel, { color: t.ink }]}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save changes"
          onPress={handleSave}
          style={({ pressed }) => [
            s.footerButton,
            { backgroundColor: t.calm },
            pressed ? s.pressed : undefined,
          ]}
        >
          <Text style={[s.footerButtonLabel, { color: t.inverse }]}>Save changes</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Inert fallback — no target threaded (cold open). Shows the web's frozen sample and Save just closes
// (the web close-only contract). Never edits a row, so a payload-less open is always safe.
// ---------------------------------------------------------------------------

function InertFallback({
  styles: s,
  palette: t,
  onClose,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  onClose: () => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={s.headerRow}>
        <Text style={s.eyebrow}>Edit transaction</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          onPress={onClose}
          style={({ pressed }) => [pressed ? s.pressed : undefined]}
        >
          <CloseGlyph color={t.muted} />
        </Pressable>
      </View>
      <Text accessibilityRole="header" style={s.headline}>
        Nothing to edit here
      </Text>

      <View style={s.fields}>
        <Text style={[s.fieldValue, { color: t.muted }]}>
          Open this from a transaction — tap one in your timeline or a found item — and you can
          correct it here. Nothing&apos;s selected right now.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        style={({ pressed }) => [
          s.primary,
          { backgroundColor: t.calm },
          pressed ? s.pressed : undefined,
        ]}
      >
        <Text style={[s.primaryLabel, { color: t.inverse }]}>Close</Text>
      </Pressable>
    </ScrollView>
  );
}

// Close glyph — the web '×', drawn inline. 18×18 user space.
function CloseGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path d="M4 4 L14 14 M14 4 L4 14" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Styles — colour-bearing, resolved against the active palette.
// ---------------------------------------------------------------------------

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
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 24,
      letterSpacing: -0.3,
      lineHeight: 28,
      marginTop: gap.sm,
    },
    // Fields block — space-y-3, mt-5.
    fields: {
      marginTop: gap.lg + gap.xs,
      rowGap: gap.md,
    },
    // Field row — surface, hairline, rounded-xl, px-4 py-3, key left / value right.
    fieldRow: {
      alignItems: 'center',
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
    },
    // 12px uppercase tracked label.
    fieldLabel: {
      color: t.muted,
      fontSize: 12,
      letterSpacing: 1.3,
      textTransform: 'uppercase',
    },
    // 14px medium value.
    fieldValue: {
      color: t.ink,
      fontSize: 14,
      fontWeight: '500',
    },
    // The editable Note value — same 14px medium look as a value cell, right-aligned, flexed so the
    // input fills the row's right side without shifting the label.
    fieldValueInput: {
      color: t.ink,
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      marginLeft: gap.md,
      paddingVertical: 0,
      textAlign: 'right',
    },
    datePickerWrap: {
      backgroundColor: t.inset,
      borderRadius: radius.md,
      overflow: 'hidden',
      padding: gap.sm,
    },
    dateDone: {
      alignItems: 'center',
      alignSelf: 'flex-end',
      justifyContent: 'center',
      minHeight: 40,
      paddingHorizontal: gap.md,
    },
    dateDoneLabel: {
      color: t.calm,
      fontSize: 13,
      fontWeight: '600',
    },
    // Amount — a right-aligned magnitude input with a £ prefix, reading like the value cell it replaced.
    amountInputWrap: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginLeft: gap.md,
    },
    amountPrefix: {
      color: t.ink,
      fontSize: 14,
      fontWeight: '500',
      marginRight: 2,
    },
    amountInput: {
      color: t.ink,
      fontSize: 14,
      fontWeight: '500',
      minWidth: 72,
      paddingVertical: 0,
      textAlign: 'right',
    },
    // Category — a labelled block of tappable chips below the field rows.
    categoryBlock: {
      marginTop: gap.md,
    },
    historyBlock: {
      marginTop: gap.lg,
    },
    historyLine: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 12,
      lineHeight: 17,
    },
    categoryLabel: {
      color: t.muted,
      fontSize: 12,
      letterSpacing: 1.3,
      marginBottom: gap.sm,
      marginLeft: 2,
      textTransform: 'uppercase',
    },
    categoryChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gap.sm,
    },
    catChip: {
      backgroundColor: t.inset,
      borderRadius: radius.pill,
      paddingHorizontal: gap.md,
      paddingVertical: 6,
    },
    catChipOn: {
      backgroundColor: t.ink,
    },
    catChipLabel: {
      color: t.ink,
      fontSize: 12,
    },
    catChipLabelOn: {
      color: t.inverse,
    },
    // Primary — full width, h-[54px], 2xl radius, terracotta, mt-6.
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
    // Footer row — Cancel + Save changes, side by side (web `flex gap-2`, mt-6).
    footerRow: {
      flexDirection: 'row',
      gap: gap.sm,
      marginTop: gap.xl,
    },
    footerButton: {
      alignItems: 'center',
      borderRadius: radius.xl,
      flex: 1,
      height: 54,
      justifyContent: 'center',
    },
    footerButtonLabel: {
      fontSize: 15,
      fontWeight: '500',
    },
    // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
  });
}
