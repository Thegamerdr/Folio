import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  AccessibilityInfo,
  FlatList,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gap, radius, serif, Sheet, useTheme } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { formatReviewDate } from '@/folio/screens/reviewFormat';
import {
  buildStatementReviewModel,
  filterStatementReviewRows,
  statementReviewSourceKey,
  statementReviewNaturalKey,
  type StatementReviewFilter,
  type StatementReviewRow,
} from '@/folio/lib/statementReviewModel';
import {
  acknowledgeStatementReviewSession,
  nextBulkLandingOffer,
  statementReviewSessionWithReceipt,
  type BulkLandingOffer,
} from '@/folio/lib/bulkLanding';
import { detectAccountName } from '@/folio/lib/detectAccountName';
import { persistCurrentStateNow, quiescePersistenceWrites } from '@/folio/lib/persist';
import { getPersistenceFailureStage } from '@/folio/lib/persistenceRuntime';
import type { CandidateKind, CandidateMoneyItem, ColumnIssue } from '@/folio/lib/importSheet';
import {
  addAccount,
  addStatementAsHistory,
  DEFAULT_ACCOUNT_ID,
  getState,
  getPersistBlob,
  hydrateFromBlob,
  importedTransactionId,
  removeStatementReviewSession,
  upsertStatementReviewSession,
  setAccountBalance,
  useAppStore,
  useStatementReviewSessions,
  type Account,
  type AccountKind,
  type AddStatementAsHistoryResult,
  type ReaderClosingBalance,
  type StatementReviewSession,
} from '@/folio/store';
import type { Nav } from '@/folio/types';

type FolioTheme = ReturnType<typeof useTheme>;

function ReceiptViewport({ children, theme: t }: { children: ReactNode; theme: FolioTheme }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={[styles.root, { backgroundColor: t.canvas }]}
      contentContainerStyle={[
        styles.receiptViewport,
        { paddingTop: insets.top + gap.xl, paddingBottom: insets.bottom + gap.xl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export type BulkStatementLandingProps = {
  nav: Nav;
  candidates: readonly CandidateMoneyItem[];
  /** Existing source identity used when opening a persisted review after a cold relaunch. */
  sessionKey?: string;
  /** Parser issues for non-candidate source lines; they remain visible without inventing rows. */
  sourceIssues?: readonly ColumnIssue[];
  closingBalance?: ReaderClosingBalance;
  onAdded: () => void;
  onReviewOneByOne?: (accountId: string) => void;
  onReceiptReady?: (receipt: {
    accountId: string;
    result: AddStatementAsHistoryResult;
    selectedCandidateIds: readonly string[];
    keptAsideIds: readonly string[];
  }) => void;
  onSourceReturn?: () => void;
};
const NEW_ACCOUNT_OPTION = '__new__';
const KINDS: readonly CandidateKind[] = [
  'income',
  'spend',
  'bill',
  'subscription',
  'debt-payment',
  'transfer',
  'unknown',
];
const FILTERS: readonly { key: StatementReviewFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'issues', label: 'Needs checking' },
  { key: 'duplicates', label: 'Possible repeats' },
  { key: 'already-added', label: 'Already added' },
  { key: 'transfers', label: 'Transfers' },
];
const KIND_LABEL: Record<CandidateKind, string> = {
  income: 'Income',
  spend: 'Spending',
  bill: 'Bill',
  subscription: 'Subscription',
  'debt-payment': 'Debt payment',
  transfer: 'Transfer',
  unknown: 'Needs review',
};

function money(amount: number): string {
  return `${amount >= 0 ? '+' : '−'}£${Math.abs(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pounds(amount: number): string {
  return `£${Math.abs(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function shortDateRange(from?: string, to?: string): string {
  if (from === undefined) return 'Dates not supplied';
  return from === to || to === undefined
    ? formatReviewDate(from)
    : `${formatReviewDate(from)}–${formatReviewDate(to)}`;
}
function issueReason(row: StatementReviewRow): string {
  if (row.status === 'possible-repeat')
    return 'Possible repeat in this statement. Same name, date and amount.';
  if (row.status === 'already-added') return 'Already added. Same name, date and amount.';
  if (row.issue === 'missing-name') return 'Needs checking: add a name.';
  if (row.issue === 'missing-amount') return 'Needs checking: add an amount.';
  if (row.issue === 'invalid-amount') return 'Needs checking: enter a valid amount.';
  if (row.issue === 'missing-date') return 'Needs checking: add a date.';
  if (row.issue === 'invalid-date') return 'Needs checking: enter a valid date.';
  if (row.issue === 'unknown') return 'Needs checking: choose a type.';
  if (row.issue === 'low-confidence')
    return "Melo isn't certain about this one. Check it before selecting it.";
  return 'Ready to add';
}
function defaultFilter(
  candidates: readonly CandidateMoneyItem[],
  alreadyAddedIds: ReadonlySet<string>,
): StatementReviewFilter {
  const model = buildStatementReviewModel(candidates, { alreadyAddedIds });
  if (model.counts.total > 0 && model.counts.alreadyAdded === model.counts.total)
    return 'already-added';
  if (model.counts.ready === model.counts.total) return 'ready';
  if (model.counts.issues === model.counts.total) return 'issues';
  return 'all';
}

type ReviewRowProps = {
  row: StatementReviewRow;
  selected: boolean;
  aside: boolean;
  onToggle: (id: string) => void;
  onEdit: (candidate: CandidateMoneyItem) => void;
  onRepeat: (candidate: CandidateMoneyItem) => void;
  onSaved: () => void;
  theme: FolioTheme;
  largeText: boolean;
  restoreFocus: boolean;
};
const ReviewRow = memo(function ReviewRow({
  row,
  selected,
  aside,
  onToggle,
  onEdit,
  onRepeat,
  onSaved,
  theme: t,
  largeText,
  restoreFocus,
}: ReviewRowProps) {
  const actionRef = useRef<View>(null);
  useEffect(() => {
    if (!restoreFocus) return;
    const timer = setTimeout(() => {
      const tag = findNodeHandle(actionRef.current);
      if (tag !== null) AccessibilityInfo.setAccessibilityFocus(tag);
    }, 0);
    return () => clearTimeout(timer);
  }, [restoreFocus]);
  const candidate = row.candidate;
  const selectable = row.status === 'ready' && !aside;
  const state = aside ? 'Kept aside' : issueReason(row);
  const summary = `${candidate.merchant}, ${money(candidate.amount)}, ${formatReviewDate(candidate.date)}, ${KIND_LABEL[candidate.kind]}, ${state}.`;
  const actionLabel =
    row.status === 'already-added'
      ? 'View saved'
      : row.status === 'possible-repeat'
        ? 'Review repeat'
        : 'Edit';
  const actionAccessibilityLabel =
    row.status === 'already-added'
      ? 'View saved'
      : row.status === 'possible-repeat'
        ? 'Review repeat'
        : `Edit ${candidate.merchant}`;
  const onAction =
    row.status === 'already-added'
      ? onSaved
      : row.status === 'possible-repeat'
        ? () => onRepeat(candidate)
        : () => onEdit(candidate);
  return (
    <View style={[styles.row, { borderBottomColor: t.hairline }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={summary}
        accessibilityState={{ checked: selected, disabled: !selectable }}
        disabled={!selectable}
        onPress={() => onToggle(candidate.id)}
        style={styles.checkTarget}
      >
        <View
          style={[
            styles.check,
            {
              borderColor: selected ? t.calm : t.hairline,
              backgroundColor: selected ? t.calm : t.inset,
              opacity: selectable ? 1 : 0.55,
            },
          ]}
        >
          <Text style={[styles.checkGlyph, { color: t.inverse }]}>{selected ? '✓' : ''}</Text>
        </View>
      </Pressable>
      <View style={styles.rowCopy}>
        <View style={largeText ? styles.largeTop : undefined}>
          <Text style={[styles.merchant, { color: t.ink }]}>{candidate.merchant || 'Unnamed'}</Text>
          {largeText ? (
            <Text
              style={[
                styles.amount,
                styles.largeAmount,
                { color: candidate.amount >= 0 ? t.positiveInk : t.ink },
              ]}
            >
              {money(candidate.amount)}
            </Text>
          ) : null}
        </View>
        <Text
          style={[styles.meta, { color: t.muted }]}
        >{`${formatReviewDate(candidate.date)} · ${KIND_LABEL[candidate.kind]}`}</Text>
        <Text
          style={[styles.state, { color: row.status === 'ready' ? t.positiveInk : t.repairInk }]}
        >
          {state}
        </Text>
        <Pressable
          ref={actionRef}
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel}
          onPress={onAction}
          style={styles.editButton}
        >
          <Text style={[styles.actionLabel, { color: t.calm }]}>{actionLabel}</Text>
        </Pressable>
      </View>
      {!largeText ? (
        <Text style={[styles.amount, { color: candidate.amount >= 0 ? t.positiveInk : t.ink }]}>
          {money(candidate.amount)}
        </Text>
      ) : null}
    </View>
  );
});

function AccountOption({
  account,
  selected,
  position,
  count,
  onPress,
  theme: t,
}: {
  account: Pick<Account, 'id' | 'name'>;
  selected: boolean;
  position: number;
  count: number;
  onPress: () => void;
  theme: FolioTheme;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${account.name}, radio button, ${selected ? 'selected' : 'not selected'}, ${position} of ${count}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.accountOption, { borderBottomColor: t.hairline }]}
    >
      <View style={[styles.radio, { borderColor: selected ? t.calm : t.hairline }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: t.calm }]} /> : null}
      </View>
      <Text style={[styles.accountOptionLabel, { color: t.ink }]}>{account.name}</Text>
    </Pressable>
  );
}

export function BulkStatementLanding({
  nav,
  candidates: initialCandidates,
  sessionKey,
  sourceIssues: initialSourceIssues = [],
  closingBalance,
  onAdded,
  onReceiptReady,
  onSourceReturn,
}: BulkStatementLandingProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.3;
  const transactions = useAppStore((s) => s.transactions);
  const existingAccounts = useAppStore((s) => s.accounts ?? []);
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const persistedSessions = useStatementReviewSessions();
  const incomingSourceKey =
    sessionKey ?? (initialCandidates.length > 0 ? statementReviewSourceKey(initialCandidates) : undefined);
  const resumeSession =
    persistedSessions.find(
      (session) =>
        (incomingSourceKey === undefined ||
          session.sourceKey === incomingSourceKey ||
          (session.sourceKey === undefined && statementReviewSourceKey(session.candidates) === incomingSourceKey)) &&
        (session.workspaceId === undefined || String(session.workspaceId) === String(activeWorkspaceId)),
    ) ??
    (initialCandidates.length === 0 && sessionKey === undefined
      ? persistedSessions[persistedSessions.length - 1] ?? null
      : null);
  const seedCandidates = resumeSession?.candidates ?? initialCandidates;
  const sourceIssues = resumeSession?.sourceIssues ?? initialSourceIssues;
  const existingImportIds = useMemo(
    () => new Set(transactions.map((transaction) => transaction.id)),
    [transactions],
  );
  const alreadyAddedIds = useMemo(
    () =>
      new Set(
        seedCandidates
          .filter((candidate) => existingImportIds.has(importedTransactionId(candidate)))
          .map((candidate) => candidate.id),
      ),
    [existingImportIds, seedCandidates],
  );
  const [candidates, setCandidates] = useState<readonly CandidateMoneyItem[]>(seedCandidates);
  const [resolvedRepeatIds, setResolvedRepeatIds] = useState<ReadonlySet<string>>(
    () => new Set(resumeSession?.resolvedRepeatIds ?? []),
  );
  const model = useMemo(
    () =>
      buildStatementReviewModel(candidates, {
        alreadyAddedIds,
        resolvedDuplicateIds: resolvedRepeatIds,
      }),
    [alreadyAddedIds, candidates, resolvedRepeatIds],
  );
  const [filter, setFilter] = useState<StatementReviewFilter>(() =>
    defaultFilter(seedCandidates, alreadyAddedIds),
  );
  const [query, setQuery] = useState('');
  const [asideIds, setAsideIds] = useState<ReadonlySet<string>>(
    () => new Set(resumeSession?.asideIds ?? []),
  );
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        resumeSession?.selectedIds ??
          buildStatementReviewModel(seedCandidates, { alreadyAddedIds })
            .rows.filter((row) => row.status === 'ready')
            .map((row) => row.candidate.id),
      ),
  );
  const rows = useMemo(
    () => filterStatementReviewRows(model.rows, filter, query, asideIds),
    [asideIds, filter, model.rows, query],
  );
  const [accountConfirmed, setAccountConfirmed] = useState(
    () => resumeSession?.accountId !== undefined,
  );
  const detection = useMemo(() => detectAccountName(candidates), [candidates]);
  const [selectedOption, setSelectedOption] = useState<string>(
    resumeSession?.accountId ??
      (resumeSession?.accountDraft !== undefined ? NEW_ACCOUNT_OPTION : existingAccounts[0]?.id ?? NEW_ACCOUNT_OPTION),
  );
  const [newAccountName, setNewAccountName] = useState(
    resumeSession?.accountDraft?.name ?? detection.name ?? '',
  );
  const [newAccountKind, setNewAccountKind] = useState<AccountKind>(
    resumeSession?.accountDraft?.kind ?? (detection.kind === 'credit-card' ? 'credit-card' : 'bank'),
  );
  const [accountError, setAccountError] = useState<string | null>(null);
  const [resolvedAccountId, setResolvedAccountId] = useState<string | null>(
    resumeSession?.accountId ?? null,
  );
  const [editing, setEditing] = useState<CandidateMoneyItem | null>(null);
  const [editMerchant, setEditMerchant] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editKind, setEditKind] = useState<CandidateKind>('unknown');
  const [editTransferFlow, setEditTransferFlow] = useState<'in' | 'out'>('out');
  const [editErrors, setEditErrors] = useState<
    Partial<Record<'merchant' | 'amount' | 'date' | 'direction', string>>
  >({});
  const editMerchantRef = useRef<TextInput>(null);
  const editAmountRef = useRef<TextInput>(null);
  const editDateRef = useRef<TextInput>(null);
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  const [repeatCandidate, setRepeatCandidate] = useState<CandidateMoneyItem | null>(null);
  const [repeatSelectedIds, setRepeatSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const repeatRows = useMemo(
    () =>
      repeatCandidate === null
        ? []
        : model.rows.filter(
            (row) =>
              statementReviewNaturalKey(row.candidate) ===
              statementReviewNaturalKey(repeatCandidate),
          ),
    [model.rows, repeatCandidate],
  );
  const [summary, setSummary] = useState<AddStatementAsHistoryResult | null>(
    () => resumeSession?.receipt ?? null,
  );
  const [receiptAcknowledged, setReceiptAcknowledged] = useState(false);
  const [receiptPending, setReceiptPending] = useState(false);
  const [receiptPersistenceError, setReceiptPersistenceError] = useState(false);
  const [receiptRecoveryAction, setReceiptRecoveryAction] = useState<'add' | 'ack' | 'aside'>('add');
  const [receiptWorkspaceId, setReceiptWorkspaceId] = useState<typeof activeWorkspaceId | null>(null);
  const [commitError, setCommitError] = useState(false);
  const [receiptDelivery, setReceiptDelivery] = useState<{
    accountId: string;
    selectedCandidateIds: readonly string[];
    keptAsideIds: readonly string[];
  } | null>(() =>
    resumeSession?.receipt === undefined
      ? null
      : {
          accountId: resumeSession?.accountId ?? DEFAULT_ACCOUNT_ID,
          selectedCandidateIds: resumeSession?.selectedIds ?? [],
          keptAsideIds: resumeSession?.asideIds ?? [],
        },
  );
  const [adding, setAdding] = useState(false);
  const [shownOffers, setShownOffers] = useState<ReadonlySet<BulkLandingOffer>>(new Set());
  const currentOffer = summary !== null ? nextBulkLandingOffer(summary, shownOffers) : null;

  function makeReviewSession(accountIdOverride?: string): StatementReviewSession {
    const accountId = accountIdOverride ?? resolvedAccountId;
    return {
      candidates: [...candidates],
      sourceKey: statementReviewSourceKey(candidates),
      workspaceId: activeWorkspaceId,
      ...(sourceIssues.length === 0 ? {} : { sourceIssues: [...sourceIssues] }),
      ...(selectedOption === NEW_ACCOUNT_OPTION
        ? { accountDraft: { name: newAccountName, kind: newAccountKind } }
        : {}),
      ...(accountId === null || accountId === undefined ? {} : { accountId }),
      selectedIds: [...selectedIds],
      asideIds: [...asideIds],
      resolvedRepeatIds: [...resolvedRepeatIds],
    };
  }

  // Keep the provisional review recoverable through the existing workspace persistence path. This
  // state is intentionally separate from readerCandidates, which remains a read-once bridge.
  useEffect(() => {
    if (summary !== null) return;
    upsertStatementReviewSession(makeReviewSession());
  }, [
    asideIds,
    activeWorkspaceId,
    candidates,
    newAccountKind,
    newAccountName,
    resolvedAccountId,
    resolvedRepeatIds,
    selectedIds,
    selectedOption,
    sourceIssues,
    summary,
  ]);

  async function persistReceiptDurably(workspaceId: typeof activeWorkspaceId) {
    const resumePersistence = await quiescePersistenceWrites();
    try {
      await persistCurrentStateNow(workspaceId);
      if (getState().activeWorkspaceId !== workspaceId) {
        throw new Error('Statement review workspace changed before receipt durability completed.');
      }
    } finally {
      resumePersistence();
    }
  }

  const toggle = useCallback(
    (id: string) =>
      setSelectedIds((current) => {
        const next = new Set(current);
        const row = model.rows.find((item) => item.candidate.id === id);
        if (row?.status !== 'ready' || asideIds.has(id)) return next;
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [asideIds, model.rows],
  );
  const openEditor = useCallback((candidate: CandidateMoneyItem) => {
    setFocusRowId(null);
    setEditing(candidate);
    setEditMerchant(candidate.merchant);
    setEditAmount(Math.abs(candidate.amount).toFixed(2));
    setEditDate(candidate.date ?? '');
    setEditKind(candidate.kind);
    setEditTransferFlow(candidate.amount >= 0 ? 'in' : 'out');
    setEditErrors({});
  }, []);
  const closeEditor = useCallback(() => {
    if (editing === null) return;
    const dirty =
      editMerchant !== editing.merchant ||
      editAmount !== Math.abs(editing.amount).toFixed(2) ||
      editDate !== (editing.date ?? '') ||
      editKind !== editing.kind ||
      (editKind === 'transfer' && editTransferFlow !== (editing.amount >= 0 ? 'in' : 'out'));
    if (!dirty) {
      setEditing(null);
      return;
    }
    Alert.alert('Discard these changes?', 'Your original transaction will stay as it was.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard changes', style: 'destructive', onPress: () => setEditing(null) },
    ]);
  }, [editAmount, editDate, editKind, editMerchant, editTransferFlow, editing]);
  function saveEdit() {
    if (editing === null) return;
    const errors: Partial<Record<'merchant' | 'amount' | 'date' | 'direction', string>> = {};
    if (editMerchant.trim().length === 0) errors.merchant = 'Enter a merchant or description.';
    const amountText = editAmount.trim().replace(',', '.');
    if (amountText.length === 0) errors.amount = 'Enter an amount.';
    else if (!/^\d+(?:\.\d{1,2})?$/.test(amountText))
      errors.amount = 'Enter a number with up to 2 decimal places.';
    else if (Number(amountText) <= 0) errors.amount = 'Amount must be more than £0.';
    if (editDate.trim().length === 0) errors.date = 'Enter a date.';
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(editDate.trim()))
      errors.date = 'Enter a date as YYYY-MM-DD.';
    else {
      const date = new Date(`${editDate.trim()}T00:00:00Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== editDate.trim())
        errors.date = 'Enter a real date.';
    }
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstInvalid =
        errors.merchant !== undefined
          ? editMerchantRef
          : errors.amount !== undefined
            ? editAmountRef
            : errors.date !== undefined
              ? editDateRef
              : null;
      if (firstInvalid !== null) setTimeout(() => firstInvalid.current?.focus(), 0);
      return;
    }
    const absolute = Number(amountText);
    const signed =
      editKind === 'income' || (editKind === 'transfer' && editTransferFlow === 'in')
        ? absolute
        : -absolute;
    const nextCandidate: CandidateMoneyItem = {
      ...editing,
      merchant: editMerchant.trim(),
      amount: signed,
      date: editDate.trim(),
      kind: editKind,
      reviewed: true,
    };
    setCandidates((current) =>
      current.map((candidate) => (candidate.id === editing.id ? nextCandidate : candidate)),
    );
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(editing.id);
      return next;
    });
    setFocusRowId(editing.id);
    AccessibilityInfo.announceForAccessibility('Saved. Ready to add.');
    setEditing(null);
  }
  function resolveAccount() {
    if (selectedOption !== NEW_ACCOUNT_OPTION) {
      setResolvedAccountId(selectedOption);
      setAccountConfirmed(true);
      return;
    }
    const name = newAccountName.trim();
    if (name.length === 0) {
      setAccountError('Enter an account name.');
      return;
    }
    try {
      const account = addAccount({ name, kind: newAccountKind });
      setResolvedAccountId(account.id);
      setAccountConfirmed(true);
    } catch {
      setAccountError('We couldn’t set up that account. Your statement is still here.');
    }
  }
  async function addSelected() {
    if (adding) return;
    setCommitError(false);
    const selected = candidates.filter(
      (candidate) =>
        selectedIds.has(candidate.id) &&
        !asideIds.has(candidate.id) &&
        model.rows.find((row) => row.candidate.id === candidate.id)?.status === 'ready',
    );
    if (selected.length === 0) return;
    setAdding(true);
    setReceiptPending(true);
    setReceiptPersistenceError(false);
    setReceiptWorkspaceId(activeWorkspaceId);
    const beforeCommitBlob = getPersistBlob(activeWorkspaceId);
    try {
      const accountId = resolvedAccountId ?? DEFAULT_ACCOUNT_ID;
      const result = addStatementAsHistory(
        selected,
        selected.length === candidates.length ? closingBalance : undefined,
        accountId,
      );
      setSummary(result);
      setReceiptAcknowledged(false);
      setReceiptRecoveryAction('add');
      // Persist the receipt before callers clear the reader bridge. The existing persistence writer
      // observes this synchronous store update; native callers may additionally await their durable
      // write in onReceiptReady before releasing any source resources.
      upsertStatementReviewSession(
        statementReviewSessionWithReceipt(
          makeReviewSession(accountId),
          result,
        ),
      );
      setReceiptDelivery({
        accountId,
        selectedCandidateIds: selected.map((candidate) => candidate.id),
        keptAsideIds: [...asideIds],
      });
      try {
        await persistReceiptDurably(activeWorkspaceId);
        if (getState().activeWorkspaceId !== activeWorkspaceId) {
          throw new Error(
            'Statement review workspace changed before receipt durability completed.',
          );
        }
        setReceiptPending(false);
        onReceiptReady?.({
          accountId,
          result,
          selectedCandidateIds: selected.map((candidate) => candidate.id),
          keptAsideIds: [...asideIds],
        });
      } catch {
        // `persistCurrentStateNow` has two materially different failure boundaries. Before the
        // native workspace-state commit, addStatementAsHistory's synchronous memory update must be
        // rolled back so Try again performs one fresh add with the same candidate IDs. Once SQL has
        // committed, a manifest/metadata failure must retain the receipt and show a retry without
        // re-running the ledger write. The runtime stage is value-free and never includes user data.
        if (getPersistenceFailureStage() === 'preparation' || getPersistenceFailureStage() === 'workspace-state') {
          hydrateFromBlob(beforeCommitBlob, activeWorkspaceId);
          setSummary(null);
          setReceiptDelivery(null);
          setReceiptPersistenceError(false);
          setReceiptPending(false);
          setCommitError(true);
        } else {
          setReceiptPersistenceError(true);
          setReceiptPending(false);
        }
      }
    } catch {
      // addStatementAsHistory may have published part of its synchronous mutation before a later
      // detector/command boundary rejects. Restore the exact pre-attempt partition so the visible
      // "Nothing changed" branch is truthful and a retry cannot duplicate a landed row.
      hydrateFromBlob(beforeCommitBlob, activeWorkspaceId);
      setSummary(null);
      setReceiptDelivery(null);
      setReceiptPending(false);
      setReceiptPersistenceError(false);
      setCommitError(true);
    } finally {
      setAdding(false);
    }
  }
  async function retryReceiptPersistence() {
    if (summary === null || receiptDelivery === null) return;
    const workspaceId = receiptWorkspaceId ?? activeWorkspaceId;
    setReceiptPending(true);
    setReceiptPersistenceError(false);
    try {
      await persistReceiptDurably(workspaceId);
      if (getState().activeWorkspaceId !== workspaceId) {
        throw new Error('Statement review workspace changed before receipt durability completed.');
      }
      setReceiptPending(false);
      setReceiptPersistenceError(false);
      if (receiptRecoveryAction === 'ack') {
        setReceiptAcknowledged(true);
        onAdded();
        nav.go('today');
      } else if (receiptRecoveryAction === 'aside') {
        setReceiptAcknowledged(true);
        setReceiptDelivery(null);
        setSummary(null);
        setFilter('aside');
      } else {
        onReceiptReady?.({
          accountId: receiptDelivery.accountId,
          result: summary,
          selectedCandidateIds: receiptDelivery.selectedCandidateIds,
          keptAsideIds: receiptDelivery.keptAsideIds,
        });
      }
    } catch {
      setReceiptPending(false);
      setReceiptPersistenceError(true);
    }
  }
  async function acknowledgeReceipt() {
    if (summary === null) return;
    const workspaceId = activeWorkspaceId;
    const accountId = resolvedAccountId ?? DEFAULT_ACCOUNT_ID;
    const receiptSession = statementReviewSessionWithReceipt(makeReviewSession(accountId), summary);
    const acknowledgedSession = acknowledgeStatementReviewSession(receiptSession);
    setReceiptAcknowledged(true);
    setReceiptPending(true);
    setReceiptPersistenceError(false);
    setReceiptRecoveryAction('ack');
    setReceiptWorkspaceId(workspaceId);
    if (acknowledgedSession === null) {
      removeStatementReviewSession(statementReviewSourceKey(candidates), workspaceId);
    } else {
      upsertStatementReviewSession(acknowledgedSession);
    }
    try {
      await persistReceiptDurably(workspaceId);
      setReceiptPending(false);
      onAdded();
      nav.go('today');
    } catch {
      const precommit = getPersistenceFailureStage() === 'preparation' || getPersistenceFailureStage() === 'workspace-state';
      if (precommit) upsertStatementReviewSession(receiptSession);
      setReceiptPending(false);
      setReceiptAcknowledged(precommit ? false : false);
      setReceiptPersistenceError(!precommit);
    }
  }
  async function reviewAside() {
    if (summary === null || asideIds.size === 0) return;
    const workspaceId = activeWorkspaceId;
    const accountId = resolvedAccountId ?? DEFAULT_ACCOUNT_ID;
    const receiptSession = statementReviewSessionWithReceipt(makeReviewSession(accountId), summary);
    const retainedSession = acknowledgeStatementReviewSession(receiptSession);
    if (retainedSession === null) return;
    setReceiptAcknowledged(true);
    setReceiptPending(true);
    setReceiptPersistenceError(false);
    setReceiptRecoveryAction('aside');
    setReceiptWorkspaceId(workspaceId);
    upsertStatementReviewSession(retainedSession);
    try {
      await persistReceiptDurably(workspaceId);
      setReceiptPending(false);
      setReceiptDelivery(null);
      setSummary(null);
      setFilter('aside');
    } catch {
      const precommit = getPersistenceFailureStage() === 'preparation' || getPersistenceFailureStage() === 'workspace-state';
      if (precommit) upsertStatementReviewSession(receiptSession);
      setReceiptPending(false);
      setReceiptAcknowledged(false);
      setReceiptPersistenceError(!precommit);
    }
  }
  function keepSelectedAside() {
    const kept = new Set(
      [...selectedIds].filter((id) => model.rows.some((row) => row.candidate.id === id)),
    );
    if (kept.size === 0) return;
    setAsideIds((current) => new Set([...current, ...kept]));
    setSelectedIds((current) => new Set([...current].filter((id) => !kept.has(id))));
    setFilter('aside');
  }
  function selectReady() {
    const target = query.trim().length > 0 ? rows : model.rows;
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const row of target)
        if (row.status === 'ready' && !asideIds.has(row.candidate.id)) next.add(row.candidate.id);
      return next;
    });
  }
  function resolveRepeat(keepAllAside: boolean) {
    const group = repeatRows.map((row) => row.candidate.id);
    const kept = keepAllAside ? [] : [...repeatSelectedIds];
    setResolvedRepeatIds((current) => new Set([...current, ...kept]));
    setAsideIds((current) => new Set([...current, ...group.filter((id) => !kept.includes(id))]));
    setSelectedIds((current) => new Set([...current, ...kept]));
    setRepeatCandidate(null);
    setRepeatSelectedIds(new Set());
  }
  function leaveToIntake() {
    onSourceReturn?.();
    if (onSourceReturn === undefined) nav.go('intake');
  }
  const renderItem = useCallback(
    ({ item }: { item: StatementReviewRow }) => (
      <ReviewRow
        row={item}
        selected={selectedIds.has(item.candidate.id)}
        aside={asideIds.has(item.candidate.id)}
        onToggle={toggle}
        onEdit={openEditor}
        onRepeat={(candidate) => {
          setRepeatCandidate(candidate);
          setRepeatSelectedIds(new Set());
        }}
        onSaved={() => nav.go('timeline')}
        theme={t}
        largeText={largeText}
        restoreFocus={focusRowId === item.candidate.id}
      />
    ),
    [asideIds, focusRowId, nav, openEditor, selectedIds, t, toggle],
  );

  if (!accountConfirmed) {
    const choices = [
      ...existingAccounts.map((account) => ({ id: account.id, name: account.name })),
      { id: NEW_ACCOUNT_OPTION, name: 'New account' },
    ];
    return (
      <View
        style={[
          styles.root,
          { backgroundColor: t.canvas, paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.accountHeader}>
          <Pressable
            onPress={leaveToIntake}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.backTarget}
          >
            <Text style={[styles.back, { color: t.ink }]}>←</Text>
          </Pressable>
          <Text style={[styles.kicker, { color: t.muted }]}>STATEMENT REVIEW</Text>
          <View style={styles.headerBalance} />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.accountScroll}
        >
          <Text accessibilityRole="header" style={[styles.accountTitle, { color: t.ink }]}>
            Which account is this?
          </Text>
          <Text style={[styles.accountHint, { color: t.muted }]}>
            Choose once. Everything you add keeps this account as its source.
          </Text>
          <View
            style={styles.accountOptions}
            accessibilityRole="radiogroup"
            accessibilityLabel="Account"
          >
            {choices.map((account, index) => (
              <AccountOption
                key={account.id}
                account={account}
                selected={selectedOption === account.id}
                position={index + 1}
                count={choices.length}
                onPress={() => {
                  setSelectedOption(account.id);
                  setAccountError(null);
                }}
                theme={t}
              />
            ))}
          </View>
          {selectedOption === NEW_ACCOUNT_OPTION ? (
            <>
              <Text style={[styles.fieldLabel, { color: t.ink }]}>Account name</Text>
              <TextInput
                accessibilityLabel="Account name"
                value={newAccountName}
                onChangeText={(value) => {
                  setNewAccountName(value);
                  setAccountError(null);
                }}
                placeholder="Account name"
                placeholderTextColor={t.muted}
                style={[
                  styles.input,
                  {
                    color: t.ink,
                    borderColor: accountError ? t.repair : t.hairline,
                    backgroundColor: t.inset,
                  },
                ]}
              />
              <Text style={[styles.fieldLabel, { color: t.ink }]}>Account type</Text>
              <View
                style={styles.typeChoices}
                accessibilityRole="radiogroup"
                accessibilityLabel="Account type"
              >
                {(['bank', 'credit-card'] as const).map((kind) => (
                  <Pressable
                    key={kind}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: newAccountKind === kind }}
                    onPress={() => setNewAccountKind(kind)}
                    style={[
                      styles.typeChoice,
                      {
                        borderColor: newAccountKind === kind ? t.calm : t.hairline,
                        backgroundColor: newAccountKind === kind ? t.calmSoft : t.inset,
                      },
                    ]}
                  >
                    <Text style={{ color: t.ink }}>
                      {kind === 'bank' ? 'Bank account' : 'Credit card'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          {accountError ? (
            <Text accessibilityLiveRegion="assertive" style={[styles.error, { color: t.repair }]}>
              {accountError}
            </Text>
          ) : null}
        </ScrollView>
        <View
          style={[styles.accountFooter, { backgroundColor: t.surface, borderTopColor: t.hairline }]}
        >
          <Pressable onPress={resolveAccount} style={[styles.primary, { backgroundColor: t.calm }]}>
            <Text
              style={[styles.primaryLabel, { color: t.inverse }]}
            >{`Continue to check ${candidates.length}`}</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  if (receiptPending) {
    return (
      <ReceiptViewport theme={t}>
        <View style={[styles.receipt, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text accessibilityRole="header" style={[styles.receiptTitle, { color: t.ink }]}>
            Adding…
          </Text>
          <Text accessibilityLiveRegion="polite" style={[styles.receiptBody, { color: t.muted }]}>
            Saving the statement and its receipt.
          </Text>
        </View>
      </ReceiptViewport>
    );
  }
  if (commitError) {
    return (
      <ReceiptViewport theme={t}>
        <View style={[styles.receipt, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text accessibilityRole="header" style={[styles.receiptTitle, { color: t.ink }]}>
            Statement not added
          </Text>
          <Text
            accessibilityLiveRegion="assertive"
            style={[styles.receiptBody, { color: t.muted }]}
          >
            Nothing changed. Your corrections and choices are still here.
          </Text>
          <Pressable onPress={addSelected} style={[styles.primary, { backgroundColor: t.calm }]}>
            <Text style={[styles.primaryLabel, { color: t.inverse }]}>Try again</Text>
          </Pressable>
          <Pressable onPress={() => setCommitError(false)} style={styles.secondary}>
            <Text style={[styles.secondaryLabel, { color: t.muted }]}>Back to review</Text>
          </Pressable>
        </View>
      </ReceiptViewport>
    );
  }
  if (receiptPersistenceError && summary !== null && !receiptAcknowledged) {
    return (
      <ReceiptViewport theme={t}>
        <View style={[styles.receipt, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text accessibilityRole="header" style={[styles.receiptTitle, { color: t.ink }]}>
            {receiptRecoveryAction === 'ack' || receiptRecoveryAction === 'aside'
              ? 'Statement saved'
              : 'Receipt not saved'}
          </Text>
          <Text
            accessibilityLiveRegion="assertive"
            style={[styles.receiptBody, { color: t.muted }]}
          >
            {receiptRecoveryAction === 'ack'
              ? 'The statement is saved, but Melo could not finish the acknowledgement handoff. Try again to continue.'
              : receiptRecoveryAction === 'aside'
                ? 'The statement is saved, but Melo could not finish keeping these rows aside. Try again to continue.'
                : 'The statement write completed, but Melo could not durably save its receipt. Keep this screen open and try again later.'}
          </Text>
          <Pressable
            onPress={() => void retryReceiptPersistence()}
            style={[styles.primary, { backgroundColor: t.calm }]}
          >
            <Text style={[styles.primaryLabel, { color: t.inverse }]}>Try again</Text>
          </Pressable>
        </View>
      </ReceiptViewport>
    );
  }
  if (summary !== null && !receiptAcknowledged) {
    const skipped = summary.duplicatesSkipped ?? 0;
    const added = summary.added;
    const aside = asideIds.size;
    const zero = added === 0;
    const partial = added > 0 && skipped > 0;
    const name =
      existingAccounts.find((account) => account.id === resolvedAccountId)?.name ?? 'your account';
    return (
      <ReceiptViewport theme={t}>
        <View style={[styles.receipt, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <View style={styles.receiptHeading}>
            <Melo mood={zero || partial ? 'calm' : 'cheer'} size={44} frozen />
            <Text accessibilityRole="header" style={[styles.receiptTitle, { color: t.ink }]}>
              {zero ? 'Nothing new to add' : partial ? 'Statement partly added' : 'Statement added'}
            </Text>
          </View>
          <Text accessibilityLiveRegion="polite" style={[styles.receiptBody, { color: t.muted }]}>
            {zero
              ? `All ${skipped} selected transactions were already in ${name}. Nothing was added again.`
              : partial
                ? `${added} were added to ${name}. ${skipped} were already there.`
                : `${added} ${added === 1 ? 'transaction was' : 'transactions were'} added to ${name}.`}
          </Text>
          <View style={styles.receiptCounts}>
            <Text style={{ color: t.positiveInk }}>{`${added} added`}</Text>
            {skipped > 0 ? (
              <Text style={{ color: t.muted }}>{`${skipped} already there`}</Text>
            ) : null}
            {aside > 0 ? <Text style={{ color: t.muted }}>{`${aside} kept aside`}</Text> : null}
          </View>
          <Pressable
            onPress={() => void acknowledgeReceipt()}
            style={[styles.primary, { backgroundColor: t.calm }]}
          >
            <Text style={[styles.primaryLabel, { color: t.inverse }]}>Done</Text>
          </Pressable>
          {zero ? (
            <Pressable onPress={() => nav.go('timeline')} style={styles.secondary}>
              <Text style={[styles.secondaryLabel, { color: t.calm }]}>
                View saved transactions
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => nav.go('timeline')} style={styles.secondary}>
              <Text style={[styles.secondaryLabel, { color: t.calm }]}>
                View added transactions
              </Text>
            </Pressable>
          )}
          {aside > 0 ? (
            <Pressable onPress={() => void reviewAside()} style={styles.secondary}>
              <Text
                style={[styles.secondaryLabel, { color: t.calm }]}
              >{`Review ${aside} kept aside`}</Text>
            </Pressable>
          ) : null}
          {zero ? (
            <Pressable onPress={() => setSummary(null)} style={styles.secondary}>
              <Text style={[styles.secondaryLabel, { color: t.muted }]}>Back to review</Text>
            </Pressable>
          ) : null}
        </View>
      </ReceiptViewport>
    );
  }
  if (currentOffer !== null && summary !== null) {
    const offer = currentOffer === 'closing-balance' ? summary.closingBalanceOffer : undefined;
    const name =
      existingAccounts.find((account) => account.id === (offer?.accountId ?? resolvedAccountId))
        ?.name ?? 'your account';
    return (
      <ReceiptViewport theme={t}>
        <View style={[styles.receipt, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text accessibilityRole="header" style={[styles.receiptTitle, { color: t.ink }]}>
            {offer !== undefined ? 'Closing balance found' : 'One thing to check'}
          </Text>
          <Text style={[styles.receiptBody, { color: t.muted }]}>
            {offer !== undefined
              ? `This statement ends at ${pounds(offer.amountPence / 100)} for ${name}. Use that as the account balance?`
              : `Melo found income from ${summary.incomeSignal?.merchant ?? 'this statement'}. Check it as your pay?`}
          </Text>
          <Pressable
            onPress={() => {
              if (offer !== undefined)
                setAccountBalance(
                  offer.accountId ?? DEFAULT_ACCOUNT_ID,
                  offer.amountPence / 100,
                  offer.asOfISO,
                  { source: 'statement', confidence: 'statement-derived' },
                );
              setShownOffers((current) => new Set([...current, currentOffer]));
            }}
            style={[styles.primary, { backgroundColor: t.calm }]}
          >
            <Text style={[styles.primaryLabel, { color: t.inverse }]}>
              {offer !== undefined ? `Use ${pounds(offer.amountPence / 100)}` : 'Check it'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShownOffers((current) => new Set([...current, currentOffer]))}
            style={styles.secondary}
          >
            <Text style={[styles.secondaryLabel, { color: t.muted }]}>Not now</Text>
          </Pressable>
        </View>
      </ReceiptViewport>
    );
  }
  const selectedCount = [...selectedIds].filter(
    (id) =>
      model.rows.some((row) => row.candidate.id === id && row.status === 'ready') &&
      !asideIds.has(id),
  ).length;
  const hiddenCount = [...selectedIds].filter(
    (id) => !rows.some((row) => row.candidate.id === id),
  ).length;
  const filterCount = (key: StatementReviewFilter) =>
    key === 'all'
      ? model.counts.total - asideIds.size
      : key === 'ready'
        ? model.counts.ready
        : key === 'issues'
          ? model.counts.issues
          : key === 'duplicates'
            ? model.counts.duplicates
            : key === 'already-added'
              ? model.counts.alreadyAdded
              : key === 'aside'
                ? asideIds.size
                : model.counts.transfers;
  const emptyTitle =
    query.trim().length > 0
      ? `No transactions match “${query.trim()}”.`
      : filter === 'issues' && model.counts.ready > 0
        ? 'Nothing needs checking.'
        : filter === 'ready' && model.counts.issues > 0
          ? 'Nothing is ready yet.'
          : filter === 'duplicates'
            ? 'No possible repeats in this statement.'
            : filter === 'already-added'
              ? 'Nothing here has been added before.'
              : filter === 'aside'
                ? 'Nothing kept aside.'
                : filter === 'transfers'
                  ? 'No transfers found.'
                  : 'Nothing here.';
  const emptyBody =
    query.trim().length > 0
      ? undefined
      : filter === 'issues' && model.counts.ready > 0
        ? `${model.counts.ready} are ready to add.`
        : filter === 'ready' && model.counts.issues > 0
          ? `Check ${model.counts.issues} transactions before adding them.`
          : undefined;
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: t.canvas, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.reviewHeader}>
        <View style={styles.titleRow}>
          <Pressable
            onPress={leaveToIntake}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.backTarget}
          >
            <Text style={[styles.back, { color: t.ink }]}>←</Text>
          </Pressable>
          <View style={styles.titleCopy}>
            <Text accessibilityRole="header" style={[styles.workspaceTitle, { color: t.ink }]}>
              Check this statement
            </Text>
            <Text
              style={[styles.sourceLine, { color: t.muted }]}
            >{`${(candidates[0]?.source ?? 'file').toUpperCase()} · ${shortDateRange(model.dateFrom, model.dateTo)}`}</Text>
            <Text
              style={[styles.foundCount, { color: t.muted }]}
            >{`${model.counts.total} ${model.counts.total === 1 ? 'transaction' : 'transactions'} found`}</Text>
          </View>
        </View>
        <View style={[styles.summaryBand, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text
            style={[styles.summaryStat, { color: t.positiveInk }]}
          >{`${model.counts.ready} ready`}</Text>
          <Text
            style={[styles.summaryStat, { color: t.repairInk }]}
          >{`${model.counts.issues} need checking`}</Text>
          <Text
            style={[styles.summaryStat, { color: t.muted }]}
          >{`${model.counts.duplicates} possible repeats`}</Text>
          <Text
            style={[styles.summaryStat, { color: t.muted }]}
          >{`${model.counts.alreadyAdded} already added`}</Text>
          <Text
            style={[styles.summaryMoney, { color: t.ink }]}
          >{`From readable amounts: ${pounds(model.moneyIn)} in · ${pounds(model.moneyOut)} out`}</Text>
          {model.counts.uncertain > 0 ? (
            <Text
              style={[styles.exclusion, { color: t.muted }]}
            >{`Totals exclude ${model.counts.uncertain} amounts that need checking.`}</Text>
          ) : null}
          {sourceIssues.length > 0 ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.exclusion, { color: t.repairInk }]}
            >{`${sourceIssues.length} source ${sourceIssues.length === 1 ? 'line needs' : 'lines need'} checking and was left out rather than guessed.`}
            </Text>
          ) : null}
        </View>
        <TextInput
          accessibilityRole="search"
          accessibilityLabel="Search name, date, amount or type"
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, date, amount or type"
          placeholderTextColor={t.muted}
          style={[
            styles.search,
            { color: t.ink, backgroundColor: t.inset, borderColor: t.hairline },
          ]}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: filter === item.key }}
              onPress={() => setFilter(item.key)}
              style={[styles.filter, { backgroundColor: filter === item.key ? t.calm : t.inset }]}
            >
              <Text
                style={{ color: filter === item.key ? t.inverse : t.ink }}
              >{`${item.label} ${filterCount(item.key)}`}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.selectionActions}>
          <Pressable onPress={selectReady} style={styles.batchButton}>
            <Text style={[styles.batchLabel, { color: t.calm }]}>
              {query.trim().length > 0 ? 'Select all shown' : 'Select all ready'}
            </Text>
          </Pressable>
          <Pressable onPress={() => setSelectedIds(new Set())} style={styles.batchButton}>
            <Text style={[styles.batchLabel, { color: t.calm }]}>Clear selection</Text>
          </Pressable>
          <Pressable onPress={keepSelectedAside} style={styles.batchButton}>
            <Text style={[styles.batchLabel, { color: t.muted }]}>Keep selected aside</Text>
          </Pressable>
          {asideIds.size > 0 ? (
            <Pressable onPress={() => setFilter('aside')} style={styles.quietAction}>
              <Text style={[styles.batchLabel, { color: t.muted }]}>
                {`Show ${asideIds.size} kept aside`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.candidate.id}
        renderItem={renderItem}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={rows.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: t.ink }]}>{emptyTitle}</Text>
            {emptyBody ? (
              <Text style={[styles.emptyBody, { color: t.muted }]}>{emptyBody}</Text>
            ) : null}
            <Pressable
              onPress={() =>
                query.trim().length > 0
                  ? setQuery('')
                  : setFilter(filter === 'issues' ? 'ready' : filter === 'ready' ? 'issues' : 'all')
              }
              style={styles.emptyAction}
            >
              <Text style={{ color: t.calm }}>
                {query.trim().length > 0
                  ? 'Clear search'
                  : filter === 'issues'
                    ? `Show ready ${model.counts.ready}`
                    : filter === 'ready'
                      ? `Show needs checking ${model.counts.issues}`
                      : filter === 'already-added'
                        ? 'Show all'
                        : 'Show all'}
              </Text>
            </Pressable>
          </View>
        }
      />
      <View style={[styles.footer, { backgroundColor: t.surface, borderTopColor: t.hairline }]}>
        <Text style={[styles.selectionSummary, { color: t.muted }]}>
          {selectedCount === 0
            ? 'Nothing selected'
            : `${selectedCount} selected${hiddenCount > 0 ? ` · ${hiddenCount} hidden by this view` : ''}`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: selectedCount === 0 || adding }}
          disabled={selectedCount === 0 || adding}
          onPress={addSelected}
          style={[
            styles.primary,
            styles.footerPrimary,
            { backgroundColor: selectedCount > 0 ? t.calm : t.inset },
          ]}
        >
          <Text style={[styles.primaryLabel, { color: selectedCount > 0 ? t.inverse : t.muted }]}>
            {adding
              ? 'Adding…'
              : selectedCount === 0
                ? 'Add selected'
                : selectedCount === 1
                  ? 'Add 1 transaction'
                  : `Add ${selectedCount} transactions`}
          </Text>
        </Pressable>
      </View>
      <Sheet
        visible={editing !== null}
        onClose={closeEditor}
        scrollKey={editing?.id ?? ''}
        footer={
          <View style={styles.editorFooter}>
            <Pressable onPress={saveEdit} style={[styles.primary, { backgroundColor: t.calm }]}>
              <Text style={[styles.primaryLabel, { color: t.inverse }]}>Save</Text>
            </Pressable>
            <Pressable onPress={closeEditor} style={styles.secondary}>
              <Text style={[styles.secondaryLabel, { color: t.muted }]}>Cancel</Text>
            </Pressable>
          </View>
        }
        closeAccessibilityLabel="Close editor"
        maxHeightFraction={largeText ? 1 : 0.88}
        header={
          <Text accessibilityRole="header" style={[styles.editorTitle, { color: t.ink }]}>
            Edit transaction
          </Text>
        }
      >
        <View style={styles.editor}>
          <Text style={[styles.fieldLabel, { color: t.ink }]}>Merchant or description</Text>
          <TextInput
            ref={editMerchantRef}
            accessibilityLabel="Merchant or description"
            value={editMerchant}
            onChangeText={setEditMerchant}
            style={[
              styles.input,
              {
                color: t.ink,
                borderColor: editErrors.merchant ? t.repair : t.hairline,
                backgroundColor: t.inset,
              },
            ]}
          />
          {editErrors.merchant ? (
            <Text accessibilityLiveRegion="assertive" style={[styles.error, { color: t.repair }]}>
              {editErrors.merchant}
            </Text>
          ) : null}
          <Text style={[styles.fieldLabel, { color: t.ink }]}>Amount</Text>
          <View
            style={[
              styles.amountInput,
              {
                borderColor: editErrors.amount ? t.repair : t.hairline,
                backgroundColor: t.inset,
              },
            ]}
          >
            <Text style={[styles.currencyPrefix, { color: t.muted }]}>£</Text>
            <TextInput
              ref={editAmountRef}
              accessibilityLabel="Amount"
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              style={[styles.input, styles.amountInputField, { color: t.ink }]}
            />
          </View>
          {editErrors.amount ? (
            <Text accessibilityLiveRegion="assertive" style={[styles.error, { color: t.repair }]}>
              {editErrors.amount}
            </Text>
          ) : null}
          <Text style={[styles.helper, { color: t.muted }]}>
            Type controls whether money is in or out.
          </Text>
          <Text style={[styles.fieldLabel, { color: t.ink }]}>Date</Text>
          <TextInput
            ref={editDateRef}
            accessibilityLabel="Date"
            value={editDate}
            onChangeText={setEditDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={t.muted}
            style={[
              styles.input,
              {
                color: t.ink,
                borderColor: editErrors.date ? t.repair : t.hairline,
                backgroundColor: t.inset,
              },
            ]}
          />
          <Text style={[styles.helper, { color: t.muted }]}>YYYY-MM-DD</Text>
          {editErrors.date ? (
            <Text accessibilityLiveRegion="assertive" style={[styles.error, { color: t.repair }]}>
              {editErrors.date}
            </Text>
          ) : null}
          <Text style={[styles.fieldLabel, { color: t.ink }]}>Type</Text>
          <View style={styles.typeChoices} accessibilityRole="radiogroup" accessibilityLabel="Type">
            {KINDS.map((kind) => (
              <Pressable
                key={kind}
                accessibilityRole="radio"
                accessibilityState={{ selected: editKind === kind }}
                onPress={() => setEditKind(kind)}
                style={[
                  styles.typeChoice,
                  {
                    borderColor: editKind === kind ? t.calm : t.hairline,
                    backgroundColor: editKind === kind ? t.calmSoft : t.inset,
                  },
                ]}
              >
                <Text style={{ color: t.ink }}>{KIND_LABEL[kind]}</Text>
              </Pressable>
            ))}
          </View>
          {editKind === 'transfer' ? (
            <>
              <Text style={[styles.fieldLabel, { color: t.ink }]}>Direction</Text>
              <View
                style={styles.typeChoices}
                accessibilityRole="radiogroup"
                accessibilityLabel="Direction"
              >
                {(['in', 'out'] as const).map((flow) => (
                  <Pressable
                    key={flow}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: editTransferFlow === flow }}
                    onPress={() => setEditTransferFlow(flow)}
                    style={[
                      styles.typeChoice,
                      {
                        borderColor: editTransferFlow === flow ? t.calm : t.hairline,
                        backgroundColor: editTransferFlow === flow ? t.calmSoft : t.inset,
                      },
                    ]}
                  >
                    <Text style={{ color: t.ink }}>{flow === 'in' ? 'Money in' : 'Money out'}</Text>
                  </Pressable>
                ))}
              </View>
              {editErrors.direction ? (
                <Text
                  accessibilityLiveRegion="assertive"
                  style={[styles.error, { color: t.repair }]}
                >
                  {editErrors.direction}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
      </Sheet>
      <Sheet
        visible={repeatCandidate !== null}
        onClose={() => setRepeatCandidate(null)}
        footer={
          <View style={styles.editorFooter}>
            <Pressable
              disabled={repeatSelectedIds.size === 0}
              onPress={() => resolveRepeat(false)}
              style={[
                styles.primary,
                { backgroundColor: repeatSelectedIds.size > 0 ? t.calm : t.inset },
              ]}
            >
              <Text
                style={[
                  styles.primaryLabel,
                  { color: repeatSelectedIds.size > 0 ? t.inverse : t.muted },
                ]}
              >
                {repeatSelectedIds.size === 0
                  ? 'Choose transactions'
                  : repeatSelectedIds.size === 1
                    ? 'Keep 1 transaction'
                    : `Keep ${repeatSelectedIds.size} transactions`}
              </Text>
            </Pressable>
            <Pressable onPress={() => resolveRepeat(true)} style={styles.secondary}>
              <Text style={[styles.secondaryLabel, { color: t.muted }]}>Keep all aside</Text>
            </Pressable>
            <Pressable onPress={() => setRepeatCandidate(null)} style={styles.secondary}>
              <Text style={[styles.secondaryLabel, { color: t.muted }]}>Cancel</Text>
            </Pressable>
          </View>
        }
      >
        <View style={styles.editor}>
          <Text accessibilityRole="header" style={[styles.editorTitle, { color: t.ink }]}>
            Check this possible repeat
          </Text>
          <Text style={[styles.accountHint, { color: t.muted }]}>
            These have the same name, date and amount. Choose what belongs.
          </Text>
          {repeatRows.map((row) => (
            <Pressable
              key={row.candidate.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: repeatSelectedIds.has(row.candidate.id) }}
              onPress={() =>
                setRepeatSelectedIds((current) => {
                  const next = new Set(current);
                  if (next.has(row.candidate.id)) next.delete(row.candidate.id);
                  else next.add(row.candidate.id);
                  return next;
                })
              }
              style={styles.repeatRow}
            >
              <Text
                style={{ color: t.ink }}
              >{`${row.candidate.merchant} · ${money(row.candidate.amount)} · ${formatReviewDate(row.candidate.date)}`}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  accountHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: gap.xl,
    paddingVertical: gap.lg,
  },
  backTarget: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  back: { fontSize: 24, lineHeight: 32 },
  headerBalance: { width: 44 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  accountScroll: { paddingHorizontal: gap.xl, paddingBottom: gap.xl },
  accountTitle: { fontFamily: serif.display, fontSize: 28, lineHeight: 34, marginTop: gap.sm },
  accountHint: { fontSize: 14, lineHeight: 22, marginTop: gap.sm },
  accountOptions: { marginTop: gap.xl },
  accountOption: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  accountOptionLabel: { flex: 1, fontSize: 16, marginLeft: gap.md },
  radio: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  radioDot: { borderRadius: radius.pill, height: 12, width: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginTop: gap.lg },
  input: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    minHeight: 48,
    marginTop: gap.sm,
    paddingHorizontal: gap.lg,
  },
  amountInput: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: gap.sm,
    minHeight: 48,
    paddingLeft: gap.lg,
  },
  currencyPrefix: { fontSize: 16, fontWeight: '600' },
  amountInputField: {
    borderWidth: 0,
    flex: 1,
    marginTop: 0,
    minHeight: 46,
    paddingLeft: gap.sm,
  },
  typeChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm, marginTop: gap.sm },
  typeChoice: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: gap.lg,
    paddingVertical: gap.sm,
  },
  error: { fontSize: 12.5, lineHeight: 19, marginTop: gap.sm },
  accountFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: gap.xl,
    paddingVertical: gap.md,
  },
  primary: {
    alignItems: 'center',
    borderRadius: radius.lg,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: gap.xl,
  },
  primaryLabel: { fontSize: 15, fontWeight: '700' },
  receiptRoot: { justifyContent: 'center', paddingHorizontal: gap.xl },
  receiptViewport: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: gap.xl },
  receipt: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: gap.xl },
  receiptHeading: { alignItems: 'center', flexDirection: 'row', gap: gap.md },
  receiptTitle: { fontFamily: serif.display, fontSize: 28, lineHeight: 34 },
  receiptBody: { fontSize: 16, lineHeight: 25, marginTop: gap.md },
  receiptCounts: { gap: gap.sm, marginTop: gap.xl },
  secondary: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: gap.sm,
    paddingHorizontal: gap.lg,
  },
  secondaryLabel: { fontSize: 14, fontWeight: '600' },
  reviewHeader: { paddingHorizontal: gap.xl },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: gap.sm },
  titleCopy: { flex: 1 },
  workspaceTitle: { fontFamily: serif.display, fontSize: 24, lineHeight: 30 },
  sourceLine: { fontSize: 12, marginTop: gap.xs },
  foundCount: { fontSize: 14, marginTop: gap.xs },
  summaryBand: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: gap.md,
    marginTop: gap.md,
    padding: gap.lg,
  },
  summaryStat: { fontSize: 13, fontWeight: '700' },
  summaryMoney: { fontSize: 13, lineHeight: 20, width: '100%' },
  exclusion: { fontSize: 12.5, lineHeight: 19, width: '100%' },
  search: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    marginTop: gap.md,
    paddingHorizontal: gap.lg,
  },
  filters: { gap: gap.sm, paddingVertical: gap.sm },
  filter: {
    borderRadius: radius.lg,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: gap.md,
  },
  selectionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.xs, paddingBottom: gap.sm },
  batchButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: gap.sm,
  },
  quietAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: gap.sm,
  },
  batchLabel: { fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  row: {
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: gap.xl,
    paddingVertical: gap.lg,
  },
  checkTarget: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
  },
  check: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkGlyph: { fontSize: 14, fontWeight: '800' },
  rowCopy: { flex: 1, minWidth: 0, paddingHorizontal: gap.sm },
  merchant: { fontSize: 16, fontWeight: '600', lineHeight: 24 },
  largeTop: { width: '100%' },
  largeAmount: { marginLeft: 0, paddingTop: 0 },
  meta: { fontSize: 12.5, lineHeight: 19, marginTop: gap.xs },
  state: { fontSize: 12.5, lineHeight: 19, marginTop: gap.xs },
  editButton: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    marginTop: gap.xs,
  },
  actionLabel: { fontSize: 13, fontWeight: '700' },
  amount: {
    fontFamily: serif.display,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    marginLeft: gap.sm,
    paddingTop: gap.xs,
  },
  emptyList: { flexGrow: 1 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: gap.xl },
  emptyTitle: { fontFamily: serif.display, fontSize: 20, textAlign: 'center' },
  emptyBody: { fontSize: 14, marginTop: gap.sm, textAlign: 'center' },
  emptyAction: {
    justifyContent: 'center',
    minHeight: 44,
    marginTop: gap.md,
    paddingHorizontal: gap.lg,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: gap.xl,
    paddingTop: gap.sm,
  },
  selectionSummary: { fontSize: 13, marginBottom: gap.sm, textAlign: 'center' },
  footerPrimary: { marginTop: 0 },
  editor: { width: '100%' },
  editorTitle: { fontFamily: serif.display, fontSize: 20, lineHeight: 26 },
  helper: { fontSize: 12.5, lineHeight: 19, marginTop: gap.sm },
  editorFooter: { gap: gap.sm },
  repeatRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 56,
    paddingVertical: gap.md,
  },
});
