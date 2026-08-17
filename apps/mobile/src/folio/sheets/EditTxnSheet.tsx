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
//               §6 D4 (meaningful money-field edits, NOT note-only) this port makes Merchant, Amount,
//               Date, Category and Note EDITABLE — each change routes through editTransaction as one
//               immutable correction per changed field, replacing the row in place. Repeat is not a
//               Transaction field, so it stays a display row. Date uses the native platform picker.
//               Every actual change gets an explicit before/after review before commit.
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
  Alert,
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
  addEvidenceDocument,
  attachEvidenceDocumentToTransaction,
  detachEvidenceDocumentFromTransaction,
  editTransaction,
  linkOwnAccountTransfer,
  recordTransactionRefund,
  recordTransactionReversal,
  rememberMerchantCategory,
  removeTransaction,
  removeEvidenceDocument,
  setTransactionLifecycle,
  setTransactionSplits,
  unlinkOwnAccountTransfer,
  useAppStore,
  type Transaction,
} from '@/folio/store';
import {
  previewTxnEdit,
  type EditableField,
  type EditableTransaction,
  type TxnEditPatch,
  type TxnEditPreview,
} from '@/folio/lib/editTxn';
import { useUndo } from '@/folio/ui/useUndo';
import {
  deleteEvidenceDocumentFile,
  evidenceRetentionFailureCopy,
  openEvidenceDocument,
  retainEvidenceDocument,
} from '@/folio/lib/documentVault';
import {
  captureEvidencePhoto,
  pickEvidenceDocument,
  pickEvidenceImage,
  type EvidencePickResult,
} from '@/folio/lib/evidencePicker';
import { triggerFeedback } from '@/folio/lib/feedback';
import { deleteOwnedPickerStage } from '@/folio/lib/pickerCache';
import {
  outstandingRefundAmount,
  ownTransferCandidates,
  relatedTransactions,
} from '@/folio/lib/transactionDetail';
import {
  isCashEffectiveTransaction,
  transactionLifecycleStatusOf,
} from '@/folio/lib/transactionPolicy';

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

function correctedAmount(value: string, currentAmount: number): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (cleaned.length === 0) return currentAmount;
  const magnitude = Number(cleaned);
  if (!Number.isFinite(magnitude) || magnitude <= 0) return currentAmount;
  return (currentAmount < 0 ? -1 : 1) * magnitude;
}

function previewFieldLabel(field: EditableField): string {
  switch (field) {
    case 'merchant':
      return 'Merchant';
    case 'amount':
      return 'Amount';
    case 'when':
      return 'Date';
    case 'category':
      return 'Category';
    case 'note':
      return 'Note';
  }
}

function previewValue(field: EditableField, value: TxnEditPreview['before']): string {
  if (field === 'amount' && typeof value === 'number') {
    const direction = value < 0 ? '−' : '+';
    return `${direction}£${Math.abs(value).toFixed(2)}`;
  }
  if (field === 'when' && typeof value === 'string') return monthDay(value);
  if (field === 'category' && typeof value === 'string') {
    return CATEGORY_LABEL[value as Transaction['category']] ?? value;
  }
  if (field === 'note' && (!value || value === '')) return 'No note';
  return String(value ?? 'Not set');
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
        <EditTxnForm key={txn.id} styles={s} palette={t} onClose={onClose} txn={txn} />
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
  // correction fixes the figure without silently flipping a spend into income. Date uses the native
  // platform picker; Repeat is not a Transaction field, so it stays a display row.
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
  const [reviewing, setReviewing] = useState(false);
  const [attachingEvidence, setAttachingEvidence] = useState(false);
  const [splitOpen, setSplitOpen] = useState((txn.splits?.length ?? 0) > 0);
  const [splitFirstAmount, setSplitFirstAmount] = useState(
    Math.abs(txn.splits?.[0]?.amount ?? txn.amount / 2).toFixed(2),
  );
  const [splitFirstCategory, setSplitFirstCategory] = useState<Transaction['category']>(
    txn.splits?.[0]?.category ?? txn.category,
  );
  const [splitSecondCategory, setSplitSecondCategory] = useState<Transaction['category']>(
    txn.splits?.[1]?.category ?? 'other',
  );
  const transactions = useAppStore((state) => state.transactions);
  const refundable = useMemo(() => outstandingRefundAmount(txn, transactions), [transactions, txn]);
  const [refundAmount, setRefundAmount] = useState(refundable > 0 ? refundable.toFixed(2) : '');
  const transferCandidates = useMemo(
    () => ownTransferCandidates(txn, transactions),
    [transactions, txn],
  );
  const relationships = useMemo(() => relatedTransactions(txn, transactions), [transactions, txn]);
  const accountName = useAppStore((state) => {
    const id = accountIdOf(txn);
    return state.accounts?.find((account) => account.id === id)?.name ?? 'Main';
  });
  const workspace = useAppStore(
    (state) => state.workspaces.find((candidate) => candidate.id === state.activeWorkspaceId)!,
  );
  const soundEnabled = useAppStore((state) => state.melo?.soundEnabled === true);
  const quietMode = useAppStore((state) => state.melo?.quietMode === true);
  const sourceEvidence = useAppStore((state) =>
    txn.sourceEvidenceId
      ? state.evidenceDocuments?.find((document) => document.id === txn.sourceEvidenceId)
      : undefined,
  );
  const evidenceDocuments = useAppStore((state) => state.evidenceDocuments);
  const attachedEvidence = useMemo(
    () =>
      (evidenceDocuments ?? []).filter(
        (document) =>
          document.id !== txn.sourceEvidenceId &&
          (document.linkedTransactionIds ?? []).includes(txn.id),
      ),
    [evidenceDocuments, txn.id, txn.sourceEvidenceId],
  );
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
  const lifecycleStatus = transactionLifecycleStatusOf(txn);
  const splitFirstMagnitude = Number(splitFirstAmount.replace(/[^0-9.]/gu, '')) || 0;
  const splitSecondMagnitude = Math.max(
    0,
    Math.round((Math.abs(txn.amount) - splitFirstMagnitude) * 100) / 100,
  );
  const hasReversal = transactions.some((candidate) => candidate.reversalOfId === txn.id);
  const canReverse =
    isCashEffectiveTransaction(txn) &&
    txn.moneyMovementKind !== 'transfer' &&
    txn.moneyMovementKind !== 'refund' &&
    txn.reversalOfId === undefined &&
    !hasReversal;

  // The preview and the commit share one normalized patch. Empty merchant input falls back to the
  // current merchant; an invalid amount falls back to the current amount. Neither can fabricate an
  // apparent change or an undo window.
  const patch = useMemo<TxnEditPatch>(
    () => ({
      merchant: merchant.trim() || txn.merchant,
      amount: correctedAmount(amountText, txn.amount),
      when,
      category,
      note: note.trim() || undefined,
    }),
    [amountText, category, merchant, note, txn.amount, txn.merchant, when],
  );
  const pendingChanges = useMemo(() => previewTxnEdit(txn, patch), [patch, txn]);

  // Save — apply the correction to THIS transaction via the store. editTransaction runs the pure
  // applyTxnEdit engine, which records ONE immutable TxnEdit per ACTUALLY-changed field and no-ops any
  // field left at its current value (so an untouched field fabricates no history, and a Save that
  // changes nothing writes nothing). It replaces the row in place (same id, no duplicate); every
  // transaction-derived view (Timeline, Insights, Today's recent spend) updates reactively. Then close.
  //
  // A snapshot of the pre-edit fields is captured BEFORE the write so, if anything actually changed,
  // Undo can restore every editable field in one call — mirrors the web source's `undoToast(...)` after
  // `updateTransaction` (SheetEditTxn.tsx), which snapshots merchant/amount/category/when and restores
  // them together. A no-op save (nothing changed) raises no undo window, matching editTransaction's
  // own no-op contract (an unchanged patch writes nothing, so there is nothing to undo).
  function handleSave() {
    const changesAtCommit = previewTxnEdit(txn, patch);
    if (changesAtCommit.length === 0) {
      setReviewing(false);
      return;
    }
    const categoryChanged = changesAtCommit.some((change) => change.field === 'category');
    const snapshot = {
      merchant: txn.merchant,
      amount: txn.amount,
      when: txn.when,
      category: txn.category,
      note: txn.note,
    };
    editTransaction(txn.id, patch, 'user');
    void triggerFeedback('transaction-corrected');
    // LEARN (lib/merchantMemory.ts, DATA_INTELLIGENCE.md phase ③): a category correction on a real,
    // already-posted transaction is an explicit override — remember it so a future import for this
    // merchant pre-fills the corrected category instead of re-asking. Only when the category actually
    // changed (an untouched Save writes nothing here either, mirroring editTransaction's own contract).
    if (categoryChanged) rememberMerchantCategory(patch.merchant ?? txn.merchant, category);
    onClose();
    showUndo(`Updated ${txn.merchant}`, () => {
      editTransaction(txn.id, snapshot, 'user');
    });
  }

  function openEvidence(document: NonNullable<typeof evidenceDocuments>[number]) {
    void openEvidenceDocument(workspace, document).catch((reason: unknown) => {
      Alert.alert(
        'Could not open the saved source',
        reason instanceof Error ? reason.message : 'The encrypted source could not be opened.',
      );
    });
  }

  async function attachPickedEvidence(request: () => Promise<EvidencePickResult>): Promise<void> {
    if (attachingEvidence) return;
    setAttachingEvidence(true);
    let retained: Awaited<ReturnType<typeof retainEvidenceDocument>> | undefined;
    let pickedSourceUri: string | undefined;
    try {
      const result = await request();
      if (result.kind === 'cancelled') return;
      if (result.kind === 'denied') {
        Alert.alert('Permission is off', result.message);
        return;
      }
      pickedSourceUri = result.source.uri;
      retained = await retainEvidenceDocument({
        workspace,
        source: result.source,
        sourceType: result.sourceType,
        extractionStatus: 'not-requested',
      });
      addEvidenceDocument(retained);
      attachEvidenceDocumentToTransaction(retained.id, txn.id);
      void triggerFeedback('receipt-attached', {
        soundEnabled,
        quietMode,
      });
    } catch (reason: unknown) {
      if (retained !== undefined) {
        try {
          await deleteEvidenceDocumentFile(workspace, retained);
          removeEvidenceDocument(retained.id);
        } catch {
          // Keep recoverable metadata when native cleanup itself fails. The source remains encrypted
          // and visible in Statements & receipts rather than becoming an untracked vault file.
        }
      }
      const failure = evidenceRetentionFailureCopy(reason);
      void triggerFeedback('error');
      Alert.alert(failure.title, failure.body);
    } finally {
      await deleteOwnedPickerStage(pickedSourceUri).catch(() => false);
      setAttachingEvidence(false);
    }
  }

  function chooseReceiptPhoto() {
    // CLAIM: saved receipt evidence is encrypted by the shipped workspace evidence vault.
    Alert.alert(
      'Add a receipt photo',
      'The original is encrypted in this workspace on this device.',
      [
        {
          text: 'Take photo',
          onPress: () => {
            void attachPickedEvidence(captureEvidencePhoto);
          },
        },
        {
          text: 'Choose photo',
          onPress: () => {
            void attachPickedEvidence(pickEvidenceImage);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  function confirmDetach(document: NonNullable<typeof evidenceDocuments>[number]) {
    // CLAIM: saved receipt evidence is encrypted by the shipped workspace evidence vault.
    Alert.alert(
      'Unlink this receipt?',
      'The encrypted file stays in Statements & receipts. Only this transaction link is removed.',
      [
        { text: 'Keep linked', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: () => {
            detachEvidenceDocumentFromTransaction(document.id, txn.id);
          },
        },
      ],
    );
  }

  function saveSplit() {
    const firstMagnitude = Number(splitFirstAmount.replace(/[^0-9.]/gu, ''));
    const totalMagnitude = Math.abs(txn.amount);
    if (
      !Number.isFinite(firstMagnitude) ||
      firstMagnitude <= 0 ||
      firstMagnitude >= totalMagnitude
    ) {
      Alert.alert(
        'Check the split',
        'The first part must be greater than zero and below the total.',
      );
      return;
    }
    const sign = txn.amount < 0 ? -1 : 1;
    const first = Math.round(firstMagnitude * 100) / 100;
    const second = Math.round((totalMagnitude - first) * 100) / 100;
    const previous = txn.splits ?? [];
    try {
      setTransactionSplits(txn.id, [
        {
          id: previous[0]?.id ?? `${txn.id}-split-1`,
          label: CATEGORY_LABEL[splitFirstCategory],
          amount: sign * first,
          category: splitFirstCategory,
        },
        {
          id: previous[1]?.id ?? `${txn.id}-split-2`,
          label: CATEGORY_LABEL[splitSecondCategory],
          amount: sign * second,
          category: splitSecondCategory,
        },
      ]);
      void triggerFeedback('transaction-corrected');
      showUndo('Split saved', () => setTransactionSplits(txn.id, previous));
    } catch (reason: unknown) {
      Alert.alert('Could not save split', reason instanceof Error ? reason.message : 'Retry.');
    }
  }

  function removeSplit() {
    const previous = txn.splits ?? [];
    setTransactionSplits(txn.id, []);
    setSplitOpen(false);
    showUndo('Split removed', () => setTransactionSplits(txn.id, previous));
  }

  function confirmRefund() {
    const amount = Number(refundAmount.replace(/[^0-9.]/gu, ''));
    if (!Number.isFinite(amount) || amount <= 0 || amount > refundable) {
      Alert.alert('Check the refund', `Enter an amount up to £${refundable.toFixed(2)}.`);
      return;
    }
    Alert.alert('Record this refund?', `£${amount.toFixed(2)} will be linked to ${txn.merchant}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Record refund',
        onPress: () => {
          const created = recordTransactionRefund(txn.id, amount);
          void triggerFeedback('transaction-corrected');
          showUndo('Refund recorded', () => removeTransaction(created.id));
        },
      },
    ]);
  }

  function confirmTransfer(candidate: Transaction) {
    Alert.alert(
      'Link as your transfer?',
      `${txn.merchant} and ${candidate.merchant} will stop counting as spend or income.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Link transfer',
          onPress: () => {
            const [debit, credit] = txn.amount < 0 ? [txn, candidate] : [candidate, txn];
            const [linked] = linkOwnAccountTransfer(debit.id, credit.id);
            void triggerFeedback('transaction-corrected');
            showUndo('Transfer linked', () => unlinkOwnAccountTransfer(linked.transferLinkId!));
          },
        },
      ],
    );
  }

  function confirmReversal() {
    Alert.alert(
      'Record a full reversal?',
      'The original remains in the audit trail and nets to zero.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record reversal',
          onPress: () => {
            const created = recordTransactionReversal(txn.id);
            void triggerFeedback('transaction-corrected');
            showUndo('Reversal recorded', () => removeTransaction(created.id));
          },
        },
      ],
    );
  }

  function toggleVoid() {
    const status = transactionLifecycleStatusOf(txn);
    const restoring = status === 'void';
    Alert.alert(
      restoring ? 'Restore this record?' : 'Void this record?',
      restoring
        ? 'It will count in balances and insights.'
        : 'It stays visible for audit, but stops counting in balances and insights.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: restoring ? 'Restore' : 'Void record',
          style: restoring ? 'default' : 'destructive',
          onPress: () => {
            setTransactionLifecycle(txn.id, restoring ? 'posted' : 'void', {
              ...(restoring ? {} : { reason: 'user-voided' as const }),
            });
            void triggerFeedback('transaction-corrected');
            showUndo(restoring ? 'Record restored' : 'Record voided', () =>
              setTransactionLifecycle(txn.id, status, {
                ...(txn.lifecycleReason === undefined ? {} : { reason: txn.lifecycleReason }),
              }),
            );
          },
        },
      ],
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Header — eyebrow + close glyph. */}
      <View style={s.headerRow}>
        <Text style={s.eyebrow}>{reviewing ? 'Review correction' : 'Edit transaction'}</Text>
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

      {reviewing ? (
        <View style={s.reviewBlock}>
          <Text style={s.reviewIntro}>
            Check the exact fields below. Nothing changes until you confirm.
          </Text>
          {pendingChanges.map((change) => (
            <View key={change.field} style={s.previewRow}>
              <Text style={s.previewLabel}>{previewFieldLabel(change.field)}</Text>
              <View style={s.previewValues}>
                <Text
                  accessibilityLabel={`Before: ${previewValue(change.field, change.before)}`}
                  style={s.previewBefore}
                >
                  {previewValue(change.field, change.before)}
                </Text>
                <Text accessibilityElementsHidden style={s.previewArrow}>
                  →
                </Text>
                <Text
                  accessibilityLabel={`After: ${previewValue(change.field, change.after)}`}
                  style={s.previewAfter}
                >
                  {previewValue(change.field, change.after)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <>
          {/* Editable field rows — bound to the real transaction. */}
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

            {sourceEvidence !== undefined ? (
              <Pressable
                accessibilityHint="Decrypts a temporary copy and opens the device share or viewer sheet"
                accessibilityLabel={`Open saved source, ${sourceEvidence.filename}`}
                accessibilityRole="button"
                onPress={() => openEvidence(sourceEvidence)}
                style={({ pressed }) => [s.fieldRow, pressed ? s.pressed : undefined]}
              >
                <Text style={s.fieldLabel}>Saved source</Text>
                <Text numberOfLines={1} style={s.fieldValue}>
                  {sourceEvidence.filename}
                </Text>
              </Pressable>
            ) : null}

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

          <View style={s.evidenceBlock}>
            <Text style={s.categoryLabel}>Receipts & evidence</Text>
            {attachedEvidence.map((document) => (
              <View key={document.id} style={s.evidenceRow}>
                <Pressable
                  accessibilityHint="Decrypts a temporary copy and opens the device viewer"
                  accessibilityLabel={`Open attached receipt, ${document.filename}`}
                  accessibilityRole="button"
                  onPress={() => openEvidence(document)}
                  style={({ pressed }) => [s.evidenceOpen, pressed ? s.pressed : undefined]}
                >
                  <Text numberOfLines={1} style={s.evidenceName}>
                    {document.filename}
                  </Text>
                  {/* CLAIM: saved receipt evidence is encrypted by the shipped workspace evidence vault. */}
                  <Text style={s.evidenceMeta}>Encrypted on this device</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Unlink ${document.filename} from this transaction`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => confirmDetach(document)}
                  style={({ pressed }) => [s.evidenceUnlink, pressed ? s.pressed : undefined]}
                >
                  <Text accessibilityElementsHidden style={s.evidenceUnlinkLabel}>
                    Unlink
                  </Text>
                </Pressable>
              </View>
            ))}
            <View style={s.evidenceActions}>
              <Pressable
                accessibilityLabel="Add receipt photo"
                accessibilityRole="button"
                accessibilityState={{ disabled: attachingEvidence }}
                disabled={attachingEvidence}
                onPress={chooseReceiptPhoto}
                style={({ pressed }) => [
                  s.evidenceAction,
                  pressed ? s.pressed : undefined,
                  attachingEvidence ? s.disabled : undefined,
                ]}
              >
                <Text style={s.evidenceActionLabel}>Add photo</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Choose receipt file"
                accessibilityRole="button"
                accessibilityState={{ disabled: attachingEvidence }}
                disabled={attachingEvidence}
                onPress={() => {
                  void attachPickedEvidence(pickEvidenceDocument);
                }}
                style={({ pressed }) => [
                  s.evidenceAction,
                  pressed ? s.pressed : undefined,
                  attachingEvidence ? s.disabled : undefined,
                ]}
              >
                <Text style={s.evidenceActionLabel}>
                  {attachingEvidence ? 'Saving…' : 'Choose file'}
                </Text>
              </Pressable>
            </View>
            {/* CLAIM: saved receipt evidence is encrypted separately by the workspace evidence vault. */}
            <Text style={s.evidencePrivacy}>
              Attachments are encrypted separately from the transaction. Selecting one never changes
              the money record.
            </Text>
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

          <View style={s.detailBlock}>
            <Text style={s.categoryLabel}>Record truth</Text>
            <View style={s.detailCard}>
              <View style={s.detailLine}>
                <Text style={s.detailKey}>Status</Text>
                <Text style={s.detailValue}>{lifecycleStatus}</Text>
              </View>
              <View style={s.detailLine}>
                <Text style={s.detailKey}>Source</Text>
                <Text style={s.detailValue}>{txn.source}</Text>
              </View>
              <View style={s.detailLine}>
                <Text style={s.detailKey}>Kind</Text>
                <Text style={s.detailValue}>{txn.moneyMovementKind ?? 'ordinary'}</Text>
              </View>
            </View>
          </View>

          {txn.moneyMovementKind !== 'transfer' &&
          txn.moneyMovementKind !== 'refund' &&
          txn.reversalOfId === undefined &&
          isCashEffectiveTransaction(txn) ? (
            <View style={s.detailBlock}>
              <Text style={s.categoryLabel}>Split</Text>
              {splitOpen ? (
                <View style={s.detailCard}>
                  <View style={s.fieldRowFlat}>
                    <Text style={s.detailKey}>First part</Text>
                    <View style={s.amountInputWrap}>
                      <Text style={s.amountPrefix}>£</Text>
                      <TextInput
                        accessibilityLabel="First split amount"
                        keyboardType="decimal-pad"
                        onChangeText={setSplitFirstAmount}
                        style={s.amountInput}
                        value={splitFirstAmount}
                      />
                    </View>
                  </View>
                  <View style={s.splitCategories}>
                    {CATEGORY_ORDER.map((candidate) => (
                      <Pressable
                        key={`first-${candidate}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: candidate === splitFirstCategory }}
                        onPress={() => setSplitFirstCategory(candidate)}
                        style={[
                          s.catChip,
                          candidate === splitFirstCategory ? s.catChipOn : undefined,
                        ]}
                      >
                        <Text
                          style={[
                            s.catChipLabel,
                            candidate === splitFirstCategory ? s.catChipLabelOn : undefined,
                          ]}
                        >
                          {CATEGORY_LABEL[candidate]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={s.fieldRowFlat}>
                    <Text style={s.detailKey}>Remainder</Text>
                    <Text style={s.detailValue}>£{splitSecondMagnitude.toFixed(2)}</Text>
                  </View>
                  <View style={s.splitCategories}>
                    {CATEGORY_ORDER.map((candidate) => (
                      <Pressable
                        key={`second-${candidate}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: candidate === splitSecondCategory }}
                        onPress={() => setSplitSecondCategory(candidate)}
                        style={[
                          s.catChip,
                          candidate === splitSecondCategory ? s.catChipOn : undefined,
                        ]}
                      >
                        <Text
                          style={[
                            s.catChipLabel,
                            candidate === splitSecondCategory ? s.catChipLabelOn : undefined,
                          ]}
                        >
                          {CATEGORY_LABEL[candidate]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={s.inlineActions}>
                    <Pressable accessibilityRole="button" onPress={saveSplit} style={s.smallAction}>
                      <Text style={s.smallActionLabel}>Save split</Text>
                    </Pressable>
                    {txn.splits?.length ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={removeSplit}
                        style={s.smallAction}
                      >
                        <Text style={s.destructiveActionLabel}>Remove split</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSplitOpen(true)}
                  style={s.actionRow}
                >
                  <Text style={s.actionLabel}>Split this transaction</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {refundable > 0 ? (
            <View style={s.detailBlock}>
              <Text style={s.categoryLabel}>Refund</Text>
              <View style={s.detailCard}>
                <Text style={s.detailHelp}>Up to £{refundable.toFixed(2)} remains refundable.</Text>
                <View style={s.fieldRowFlat}>
                  <Text style={s.detailKey}>Amount</Text>
                  <View style={s.amountInputWrap}>
                    <Text style={s.amountPrefix}>£</Text>
                    <TextInput
                      accessibilityLabel="Refund amount"
                      keyboardType="decimal-pad"
                      onChangeText={setRefundAmount}
                      style={s.amountInput}
                      value={refundAmount}
                    />
                  </View>
                </View>
                <Pressable accessibilityRole="button" onPress={confirmRefund} style={s.actionRow}>
                  <Text style={s.actionLabel}>Record linked refund</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {transferCandidates.length > 0 ? (
            <View style={s.detailBlock}>
              <Text style={s.categoryLabel}>Possible own-account transfer</Text>
              {transferCandidates.slice(0, 3).map((candidate) => (
                <Pressable
                  key={candidate.id}
                  accessibilityLabel={`Link ${candidate.merchant} as the other transfer leg`}
                  accessibilityRole="button"
                  onPress={() => confirmTransfer(candidate)}
                  style={s.actionRow}
                >
                  <Text style={s.actionLabel}>{candidate.merchant}</Text>
                  <Text style={s.detailValue}>£{Math.abs(candidate.amount).toFixed(2)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {relationships.length > 0 ? (
            <View style={s.detailBlock}>
              <Text style={s.categoryLabel}>Linked records</Text>
              {relationships.map(({ relation, transaction }) => (
                <View key={`${relation}-${transaction.id}`} style={s.detailCardRow}>
                  <View style={s.relationshipCopy}>
                    <Text style={s.detailKey}>{relation}</Text>
                    <Text numberOfLines={1} style={s.actionLabel}>
                      {transaction.merchant}
                    </Text>
                  </View>
                  <Text style={s.detailValue}>
                    {transaction.amount < 0 ? '−' : '+'}£{Math.abs(transaction.amount).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={s.detailBlock}>
            <Text style={s.categoryLabel}>Record actions</Text>
            {canReverse ? (
              <Pressable accessibilityRole="button" onPress={confirmReversal} style={s.actionRow}>
                <Text style={s.actionLabel}>Record full reversal</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={toggleVoid} style={s.actionRow}>
              <Text style={lifecycleStatus === 'void' ? s.actionLabel : s.destructiveActionLabel}>
                {lifecycleStatus === 'void' ? 'Restore record' : 'Void record'}
              </Text>
            </Pressable>
          </View>

          {corrections.length > 0 ? (
            <View style={s.historyBlock}>
              <Text style={s.categoryLabel}>Correction history</Text>
              {corrections
                .slice()
                .reverse()
                .map((correction) => (
                  <View key={correction.id} style={s.historyEntry}>
                    <Text style={s.detailKey}>{correction.field}</Text>
                    <Text style={s.historyLine}>
                      {String(correction.before ?? 'Not set')} →{' '}
                      {String(correction.after ?? 'Not set')}
                    </Text>
                    <Text style={s.historyMeta}>
                      {correction.by === 'melo' ? 'Melo' : 'You'} ·{' '}
                      {new Date(correction.at).toLocaleString('en-GB')}
                    </Text>
                  </View>
                ))}
            </View>
          ) : null}
        </>
      )}

      {/* Footer — edit mode offers Cancel + Review; review mode offers Back + Confirm. */}
      <View style={s.footerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={reviewing ? 'Back to editing' : 'Cancel'}
          onPress={reviewing ? () => setReviewing(false) : onClose}
          style={({ pressed }) => [
            s.footerButton,
            { backgroundColor: t.inset },
            pressed ? s.pressed : undefined,
          ]}
        >
          <Text style={[s.footerButtonLabel, { color: t.ink }]}>
            {reviewing ? 'Back' : 'Cancel'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={reviewing ? 'Confirm changes' : 'Review changes'}
          accessibilityState={{ disabled: !reviewing && pendingChanges.length === 0 }}
          disabled={!reviewing && pendingChanges.length === 0}
          onPress={reviewing ? handleSave : () => setReviewing(true)}
          style={({ pressed }) => [
            s.footerButton,
            { backgroundColor: t.calm },
            !reviewing && pendingChanges.length === 0 ? s.disabled : undefined,
            pressed ? s.pressed : undefined,
          ]}
        >
          <Text style={[s.footerButtonLabel, { color: t.accentInk }]}>
            {reviewing
              ? 'Confirm changes'
              : pendingChanges.length === 0
                ? 'No changes'
                : 'Review changes'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Inert fallback — no target threaded (cold open). Shows no sample money and never edits a row.
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
        <Text style={[s.primaryLabel, { color: t.accentInk }]}>Close</Text>
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
      color: t.calmStrong,
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
    evidenceBlock: {
      marginTop: gap.lg,
    },
    evidenceRow: {
      alignItems: 'center',
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      marginBottom: gap.sm,
      minHeight: 60,
      paddingLeft: gap.md,
      paddingRight: gap.sm,
    },
    evidenceOpen: {
      flex: 1,
      justifyContent: 'center',
      minHeight: 58,
      paddingRight: gap.sm,
    },
    evidenceName: {
      color: t.ink,
      fontSize: 13,
      fontWeight: '600',
    },
    evidenceMeta: {
      color: t.muted,
      fontSize: 11,
      marginTop: 2,
    },
    evidenceUnlink: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: gap.sm,
    },
    evidenceUnlinkLabel: {
      color: t.repairInk,
      fontSize: 11.5,
      fontWeight: '600',
    },
    evidenceActions: {
      flexDirection: 'row',
      gap: gap.sm,
    },
    evidenceAction: {
      alignItems: 'center',
      backgroundColor: t.inset,
      borderRadius: radius.md,
      flex: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: gap.md,
    },
    evidenceActionLabel: {
      color: t.ink,
      fontSize: 12.5,
      fontWeight: '600',
    },
    evidencePrivacy: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 11.5,
      lineHeight: 16,
      marginTop: gap.sm,
    },
    historyBlock: {
      marginTop: gap.lg,
    },
    detailBlock: {
      marginTop: gap.lg,
    },
    detailCard: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      padding: gap.md,
      rowGap: gap.sm,
    },
    detailCardRow: {
      alignItems: 'center',
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: gap.sm,
      minHeight: 58,
      paddingHorizontal: gap.md,
      paddingVertical: gap.sm,
    },
    detailLine: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 28,
    },
    fieldRowFlat: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 42,
    },
    detailKey: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    detailValue: {
      color: t.ink,
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    detailHelp: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 12,
      lineHeight: 17,
    },
    splitCategories: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gap.xs,
    },
    inlineActions: {
      flexDirection: 'row',
      gap: gap.sm,
      marginTop: gap.xs,
    },
    smallAction: {
      alignItems: 'center',
      backgroundColor: t.inset,
      borderRadius: radius.md,
      flex: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: gap.sm,
    },
    smallActionLabel: {
      color: t.ink,
      fontSize: 12,
      fontWeight: '600',
    },
    actionRow: {
      alignItems: 'center',
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: gap.sm,
      minHeight: 48,
      paddingHorizontal: gap.md,
    },
    actionLabel: {
      color: t.ink,
      fontSize: 13,
      fontWeight: '600',
    },
    destructiveActionLabel: {
      color: t.repairInk,
      fontSize: 13,
      fontWeight: '600',
    },
    relationshipCopy: {
      flex: 1,
      marginRight: gap.sm,
      rowGap: 3,
    },
    historyEntry: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      marginBottom: gap.sm,
      padding: gap.md,
      rowGap: 4,
    },
    historyLine: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 12,
      lineHeight: 17,
    },
    historyMeta: {
      color: t.muted,
      fontSize: 10.5,
    },
    reviewBlock: {
      marginTop: gap.lg + gap.xs,
      rowGap: gap.sm,
    },
    reviewIntro: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: gap.xs,
    },
    previewRow: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
      rowGap: gap.sm,
    },
    previewLabel: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    previewValues: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: gap.sm,
    },
    previewBefore: {
      color: t.muted,
      flex: 1,
      fontSize: 14,
      textDecorationLine: 'line-through',
    },
    previewArrow: {
      color: t.muted,
      fontSize: 14,
    },
    previewAfter: {
      color: t.ink,
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'right',
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
      color: t.canvas,
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
    // Footer row — two-step review/confirm controls.
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
    disabled: {
      opacity: 0.38,
    },
    // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
  });
}
