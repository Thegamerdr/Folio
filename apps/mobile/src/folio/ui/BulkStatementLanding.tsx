import { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import {
  filterStatementReviewRows,
  buildStatementReviewModel,
  type StatementReviewFilter,
  type StatementReviewRow,
} from '@/folio/lib/statementReviewModel';
import {
  closingBalanceOfferLine,
  nextBulkLandingOffer,
  type BulkLandingOffer,
} from '@/folio/lib/bulkLanding';
import { detectAccountName } from '@/folio/lib/detectAccountName';
import type { CandidateKind, CandidateMoneyItem } from '@/folio/lib/importSheet';
import {
  addAccount,
  addStatementAsHistory,
  DEFAULT_ACCOUNT_ID,
  setAccountBalance,
  useAppStore,
  type Account,
  type AccountKind,
  type AddStatementAsHistoryResult,
  type ReaderClosingBalance,
} from '@/folio/store';
import type { Nav } from '@/folio/types';

type FolioTheme = ReturnType<typeof useTheme>;

export type BulkStatementLandingProps = {
  nav: Nav;
  candidates: readonly CandidateMoneyItem[];
  closingBalance?: ReaderClosingBalance;
  onAdded: () => void;
  /** Kept for source compatibility. Review now happens in this uncapped virtualized workspace. */
  onReviewOneByOne?: (accountId: string) => void;
};

const FILTERS: readonly { key: StatementReviewFilter; label: string }[] = [
  { key: 'issues', label: 'Issues' },
  { key: 'ready', label: 'Ready' },
  { key: 'duplicates', label: 'Duplicates' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'income', label: 'Income' },
  { key: 'bills', label: 'Bills' },
  { key: 'debt', label: 'Debt' },
  { key: 'aside', label: 'Aside' },
  { key: 'all', label: 'All' },
];

const KINDS: readonly CandidateKind[] = [
  'income',
  'spend',
  'bill',
  'subscription',
  'debt-payment',
  'transfer',
  'unknown',
];

function money(amount: number): string {
  return `${amount >= 0 ? '+' : '−'}£${Math.abs(amount).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortDateRange(from?: string, to?: string): string {
  if (from === undefined) return 'Dates not supplied';
  return from === to ? from : `${from} – ${to}`;
}

function issueLabel(row: StatementReviewRow): string {
  if (row.issue === 'possible-duplicate') return 'Possible duplicate';
  if (row.issue === 'transfer') return 'Transfer — check both sides';
  if (row.issue === 'unknown') return 'Type needs checking';
  if (row.issue === 'low-confidence') return 'Uncertain read';
  return 'Ready';
}

type ReviewRowProps = {
  row: StatementReviewRow;
  selected: boolean;
  aside: boolean;
  onToggle: (id: string) => void;
  onEdit: (candidate: CandidateMoneyItem) => void;
  theme: FolioTheme;
};

const ReviewRow = memo(function ReviewRow({
  row,
  selected,
  aside,
  onToggle,
  onEdit,
  theme: t,
}: ReviewRowProps) {
  const candidate = row.candidate;
  return (
    <View style={[styles.row, { borderBottomColor: t.hairline }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${selected ? 'Selected' : 'Not selected'}, ${candidate.merchant}`}
        onPress={() => onToggle(candidate.id)}
        style={[
          styles.check,
          {
            borderColor: selected ? t.calm : t.hairline,
            backgroundColor: selected ? t.calm : t.inset,
          },
        ]}
      >
        <Text style={[styles.checkGlyph, { color: t.inverse }]}>{selected ? '✓' : ''}</Text>
      </Pressable>
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={[styles.merchant, { color: t.ink }]}>
          {candidate.merchant}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.meta, { color: row.status === 'issue' ? t.repairInk : t.muted }]}
        >
          {`${candidate.date ?? 'No date'} · ${candidate.kind} · ${aside ? 'Kept aside' : issueLabel(row)}`}
        </Text>
      </View>
      <Text style={[styles.amount, { color: candidate.amount >= 0 ? t.positiveInk : t.ink }]}>
        {money(candidate.amount)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${candidate.merchant}`}
        hitSlop={8}
        onPress={() => onEdit(candidate)}
        style={styles.editButton}
      >
        <Text style={[styles.editLabel, { color: t.calm }]}>Edit</Text>
      </Pressable>
    </View>
  );
});

const NEW_ACCOUNT_OPTION = '__new__';

export function BulkStatementLanding({
  nav,
  candidates: initialCandidates,
  closingBalance,
  onAdded,
}: BulkStatementLandingProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [candidates, setCandidates] = useState<readonly CandidateMoneyItem[]>(initialCandidates);
  const [filter, setFilter] = useState<StatementReviewFilter>('issues');
  const [query, setQuery] = useState('');
  const [asideIds, setAsideIds] = useState<ReadonlySet<string>>(new Set());
  const model = useMemo(() => buildStatementReviewModel(candidates), [candidates]);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        buildStatementReviewModel(initialCandidates)
          .rows.filter((row) => row.status === 'ready')
          .map((row) => row.candidate.id),
      ),
  );
  const rows = useMemo(
    () => filterStatementReviewRows(model.rows, filter, query, asideIds),
    [asideIds, filter, model.rows, query],
  );
  const [editing, setEditing] = useState<CandidateMoneyItem | null>(null);
  const [editMerchant, setEditMerchant] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editKind, setEditKind] = useState<CandidateKind>('unknown');

  const [summary, setSummary] = useState<AddStatementAsHistoryResult | null>(null);
  const [shownOffers, setShownOffers] = useState<ReadonlySet<BulkLandingOffer>>(new Set());
  const currentOffer = summary !== null ? nextBulkLandingOffer(summary, shownOffers) : null;

  const existingAccounts = useAppStore((s) => s.accounts ?? []);
  const detection = useMemo(() => detectAccountName(candidates), [candidates]);
  const [accountConfirmed, setAccountConfirmed] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string>(NEW_ACCOUNT_OPTION);
  const [newAccountName, setNewAccountName] = useState(detection.name ?? '');
  const [newAccountKind, setNewAccountKind] = useState<AccountKind>(detection.kind);
  const [resolvedAccountId, setResolvedAccountId] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openEditor = useCallback((candidate: CandidateMoneyItem) => {
    setEditing(candidate);
    setEditMerchant(candidate.merchant);
    setEditAmount(String(candidate.amount));
    setEditDate(candidate.date ?? '');
    setEditKind(candidate.kind);
  }, []);

  function saveEdit() {
    if (editing === null) return;
    const parsed = Number(editAmount.replace(',', '.'));
    if (!Number.isFinite(parsed) || editMerchant.trim().length === 0) return;
    const nextCandidate: CandidateMoneyItem = {
      ...editing,
      merchant: editMerchant.trim(),
      amount: parsed,
      kind: editKind,
      ...(editDate.trim().length > 0 ? { date: editDate.trim() } : {}),
    };
    if (editDate.trim().length === 0) delete (nextCandidate as { date?: string }).date;
    setCandidates((current) =>
      current.map((candidate) => (candidate.id === editing.id ? nextCandidate : candidate)),
    );
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
      setResolvedAccountId(DEFAULT_ACCOUNT_ID);
    } else {
      const account: Account = addAccount({ name, kind: newAccountKind });
      setResolvedAccountId(account.id);
    }
    setAccountConfirmed(true);
  }

  function resolveOffer(offer: BulkLandingOffer) {
    if (summary === null) return;
    const next = new Set(shownOffers);
    next.add(offer);
    setShownOffers(next);
    if (nextBulkLandingOffer(summary, next) === null) nav.go('today');
  }

  function addSelected() {
    const selected = candidates.filter(
      (candidate) => selectedIds.has(candidate.id) && !asideIds.has(candidate.id),
    );
    if (selected.length === 0) return;
    const isWholeStatement = selected.length === candidates.length;
    const result = addStatementAsHistory(
      selected,
      isWholeStatement ? closingBalance : undefined,
      resolvedAccountId ?? DEFAULT_ACCOUNT_ID,
    );
    setSummary(result);
    if (isWholeStatement) onAdded();
    if (nextBulkLandingOffer(result, new Set()) === null) nav.go('today');
  }

  function selectReady() {
    setSelectedIds(
      new Set(
        model.rows
          .filter((row) => row.status === 'ready' && !asideIds.has(row.candidate.id))
          .map((row) => row.candidate.id),
      ),
    );
    setFilter('ready');
  }

  function keepCurrentIssuesAside() {
    const issueIds = model.rows
      .filter((row) => row.status === 'issue')
      .map((row) => row.candidate.id);
    setAsideIds((current) => new Set([...current, ...issueIds]));
    setSelectedIds((current) => new Set([...current].filter((id) => !issueIds.includes(id))));
    setFilter('aside');
  }

  const renderItem = useCallback(
    ({ item }: { item: StatementReviewRow }) => (
      <ReviewRow
        row={item}
        selected={selectedIds.has(item.candidate.id)}
        aside={asideIds.has(item.candidate.id)}
        onToggle={toggle}
        onEdit={openEditor}
        theme={t}
      />
    ),
    [asideIds, openEditor, selectedIds, t, toggle],
  );

  if (!accountConfirmed) {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: t.canvas,
            paddingTop: insets.top + gap.lg,
            paddingBottom: insets.bottom + gap.lg,
          },
        ]}
      >
        <View style={styles.accountHeader}>
          <Pressable onPress={() => nav.go('intake')} hitSlop={12} accessibilityLabel="Back">
            <Text style={[styles.back, { color: t.ink }]}>←</Text>
          </Pressable>
          <Text style={[styles.kicker, { color: t.muted }]}>STATEMENT REVIEW</Text>
          <View style={styles.headerBalance} />
        </View>
        <View style={[styles.accountCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text style={[styles.accountTitle, { color: t.ink }]}>Which account is this?</Text>
          <Text style={[styles.accountHint, { color: t.muted }]}>
            Choose once; every accepted row keeps that source.
          </Text>
          <View style={styles.accountOptions}>
            {existingAccounts.map((account) => (
              <AccountOption
                key={account.id}
                account={account}
                selected={selectedOption === account.id}
                onPress={() => setSelectedOption(account.id)}
                theme={t}
              />
            ))}
            <AccountOption
              account={{ id: NEW_ACCOUNT_OPTION, name: '+ New account' }}
              selected={selectedOption === NEW_ACCOUNT_OPTION}
              onPress={() => setSelectedOption(NEW_ACCOUNT_OPTION)}
              theme={t}
            />
          </View>
          {selectedOption === NEW_ACCOUNT_OPTION ? (
            <>
              <TextInput
                value={newAccountName}
                onChangeText={setNewAccountName}
                placeholder="Account name"
                placeholderTextColor={t.muted}
                style={[
                  styles.input,
                  { color: t.ink, borderColor: t.hairline, backgroundColor: t.inset },
                ]}
              />
              <View style={styles.kindRow}>
                {(['bank', 'credit-card'] as const).map((kind) => (
                  <Pressable
                    key={kind}
                    onPress={() => setNewAccountKind(kind)}
                    style={[
                      styles.kindButton,
                      { backgroundColor: newAccountKind === kind ? t.calmSoft : t.inset },
                    ]}
                  >
                    <Text style={{ color: t.ink }}>{kind === 'bank' ? 'Bank' : 'Credit card'}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          <Pressable onPress={resolveAccount} style={[styles.primary, { backgroundColor: t.calm }]}>
            <Text style={[styles.primaryLabel, { color: t.inverse }]}>
              Continue to {candidates.length.toLocaleString('en-GB')} rows
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const closingOffer =
    currentOffer === 'closing-balance' ? summary?.closingBalanceOffer : undefined;
  const incomeOffer = currentOffer === 'income' ? summary?.incomeSignal : undefined;
  if (closingOffer !== undefined || incomeOffer !== undefined) {
    return (
      <View
        style={[
          styles.root,
          styles.offerRoot,
          {
            backgroundColor: t.canvas,
            paddingTop: insets.top + gap.xl,
            paddingBottom: insets.bottom + gap.xl,
          },
        ]}
      >
        <View style={[styles.accountCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text style={[styles.accountTitle, { color: t.ink }]}>
            {closingOffer !== undefined
              ? closingBalanceOfferLine(closingOffer)
              : `Looks like ${incomeOffer?.merchant} pays you — set as your pay?`}
          </Text>
          <View style={styles.offerActions}>
            <Pressable
              onPress={() => {
                if (closingOffer !== undefined) {
                  setAccountBalance(
                    closingOffer.accountId ?? DEFAULT_ACCOUNT_ID,
                    closingOffer.amountPence / 100,
                    closingOffer.asOfISO,
                    { source: 'statement', confidence: 'statement-derived' },
                  );
                  resolveOffer('closing-balance');
                } else {
                  resolveOffer('income');
                  nav.openSheet('income-caught');
                }
              }}
              style={[styles.primary, styles.offerButton, { backgroundColor: t.calm }]}
            >
              <Text style={[styles.primaryLabel, { color: t.inverse }]}>
                {closingOffer !== undefined ? 'Use it' : 'Check it'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                resolveOffer(closingOffer !== undefined ? 'closing-balance' : 'income')
              }
              style={styles.secondaryButton}
            >
              <Text style={{ color: t.muted }}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: t.canvas,
          paddingTop: insets.top + gap.sm,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={styles.workspaceHeader}>
        <View style={styles.titleRow}>
          <Pressable onPress={() => nav.go('intake')} hitSlop={12} accessibilityLabel="Back">
            <Text style={[styles.back, { color: t.ink }]}>←</Text>
          </Pressable>
          <View style={styles.titleCopy}>
            <Text style={[styles.workspaceTitle, { color: t.ink }]}>Check this statement</Text>
            <Text
              style={[styles.sourceLine, { color: t.muted }]}
            >{`${candidates[0]?.source.toUpperCase() ?? 'FILE'} · ${shortDateRange(model.dateFrom, model.dateTo)}`}</Text>
          </View>
          <Text style={[styles.totalCount, { color: t.ink }]}>
            {model.counts.total.toLocaleString('en-GB')}
          </Text>
        </View>
        <View style={[styles.summaryBand, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text
            style={[styles.summaryStat, { color: t.positiveInk }]}
          >{`${model.counts.ready} ready`}</Text>
          <Text
            style={[styles.summaryStat, { color: t.repairInk }]}
          >{`${model.counts.issues} issues`}</Text>
          <Text
            style={[styles.summaryStat, { color: t.muted }]}
          >{`${model.counts.duplicates} duplicates`}</Text>
          <Text
            style={[styles.summaryMoney, { color: t.ink }]}
          >{`£${model.moneyIn.toFixed(2)} in · £${model.moneyOut.toFixed(2)} out`}</Text>
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search merchant, date, amount or type"
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
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.filter, { backgroundColor: active ? t.calm : t.inset }]}
              >
                <Text style={{ color: active ? t.inverse : t.ink }}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.candidate.id}
        renderItem={renderItem}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        updateCellsBatchingPeriod={32}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={rows.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: t.muted }]}>Nothing in this view.</Text>
        }
      />

      <View style={[styles.footer, { backgroundColor: t.surface, borderTopColor: t.hairline }]}>
        <View style={styles.batchActions}>
          <Pressable onPress={selectReady}>
            <Text style={[styles.batchLabel, { color: t.calm }]}>Accept ready</Text>
          </Pressable>
          <Pressable onPress={() => setFilter('issues')}>
            <Text style={[styles.batchLabel, { color: t.calm }]}>Review issues</Text>
          </Pressable>
          <Pressable onPress={keepCurrentIssuesAside}>
            <Text style={[styles.batchLabel, { color: t.muted }]}>Keep aside</Text>
          </Pressable>
        </View>
        <Pressable
          disabled={selectedIds.size === 0}
          onPress={addSelected}
          style={[styles.primary, { backgroundColor: selectedIds.size > 0 ? t.calm : t.inset }]}
        >
          <Text
            style={[styles.primaryLabel, { color: selectedIds.size > 0 ? t.inverse : t.muted }]}
          >{`Add ${selectedIds.size.toLocaleString('en-GB')} selected`}</Text>
        </Pressable>
      </View>

      <Modal
        visible={editing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.editor, { backgroundColor: t.surface }]}>
            <Text style={[styles.accountTitle, { color: t.ink }]}>Edit transaction</Text>
            <TextInput
              value={editMerchant}
              onChangeText={setEditMerchant}
              placeholder="Merchant"
              placeholderTextColor={t.muted}
              style={[
                styles.input,
                { color: t.ink, borderColor: t.hairline, backgroundColor: t.inset },
              ]}
            />
            <TextInput
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              placeholder="Amount"
              placeholderTextColor={t.muted}
              style={[
                styles.input,
                { color: t.ink, borderColor: t.hairline, backgroundColor: t.inset },
              ]}
            />
            <TextInput
              value={editDate}
              onChangeText={setEditDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={t.muted}
              style={[
                styles.input,
                { color: t.ink, borderColor: t.hairline, backgroundColor: t.inset },
              ]}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {KINDS.map((kind) => (
                <Pressable
                  key={kind}
                  onPress={() => setEditKind(kind)}
                  style={[styles.filter, { backgroundColor: editKind === kind ? t.calm : t.inset }]}
                >
                  <Text style={{ color: editKind === kind ? t.inverse : t.ink }}>{kind}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.offerActions}>
              <Pressable
                onPress={saveEdit}
                style={[styles.primary, styles.offerButton, { backgroundColor: t.calm }]}
              >
                <Text style={[styles.primaryLabel, { color: t.inverse }]}>Save</Text>
              </Pressable>
              <Pressable onPress={() => setEditing(null)} style={styles.secondaryButton}>
                <Text style={{ color: t.muted }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function AccountOption({
  account,
  selected,
  onPress,
  theme: t,
}: {
  account: Pick<Account, 'id' | 'name'>;
  selected: boolean;
  onPress: () => void;
  theme: FolioTheme;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.accountOption, { backgroundColor: selected ? t.calmSoft : t.inset }]}
    >
      <Text style={{ color: t.ink }}>{account.name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  offerRoot: { justifyContent: 'center', paddingHorizontal: gap.xl },
  accountHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: gap.xl,
  },
  headerBalance: { width: 32 },
  back: { fontSize: 24, lineHeight: 32 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  accountCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    margin: gap.xl,
    padding: gap.xl,
  },
  accountTitle: { fontFamily: serif.display, fontSize: 22, lineHeight: 28 },
  accountHint: { fontSize: 14, lineHeight: 20, marginTop: gap.sm },
  accountOptions: { gap: gap.sm, marginTop: gap.lg },
  accountOption: {
    borderRadius: radius.lg,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: gap.lg,
  },
  input: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    minHeight: 48,
    marginTop: gap.md,
    paddingHorizontal: gap.lg,
  },
  kindRow: { flexDirection: 'row', gap: gap.sm, marginTop: gap.sm },
  kindButton: { borderRadius: radius.pill, paddingHorizontal: gap.lg, paddingVertical: gap.sm },
  primary: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 50,
    marginTop: gap.lg,
    paddingHorizontal: gap.xl,
  },
  primaryLabel: { fontSize: 15, fontWeight: '700' },
  workspaceHeader: { paddingHorizontal: gap.lg },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: gap.md },
  titleCopy: { flex: 1 },
  workspaceTitle: { fontFamily: serif.display, fontSize: 22, lineHeight: 27 },
  sourceLine: { fontSize: 12, marginTop: 2 },
  totalCount: { fontFamily: serif.display, fontSize: 20, fontVariant: ['tabular-nums'] },
  summaryBand: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: gap.md,
    marginTop: gap.sm,
    padding: gap.md,
  },
  summaryStat: { fontSize: 12, fontWeight: '700' },
  summaryMoney: { fontSize: 12, marginLeft: 'auto' },
  search: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 42,
    marginTop: gap.sm,
    paddingHorizontal: gap.lg,
  },
  filters: { gap: gap.sm, paddingVertical: gap.sm },
  filter: { borderRadius: radius.pill, paddingHorizontal: gap.md, paddingVertical: gap.sm },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 68,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.sm,
  },
  check: {
    alignItems: 'center',
    borderRadius: 7,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    marginRight: gap.md,
    width: 24,
  },
  checkGlyph: { fontSize: 14, fontWeight: '800' },
  rowCopy: { flex: 1, minWidth: 0 },
  merchant: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 11.5, marginTop: 3 },
  amount: {
    fontFamily: serif.display,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    marginLeft: gap.sm,
  },
  editButton: { justifyContent: 'center', minHeight: 44, paddingLeft: gap.md },
  editLabel: { fontSize: 12, fontWeight: '700' },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  emptyText: { alignSelf: 'center', fontSize: 14 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: gap.lg,
    paddingTop: gap.sm,
  },
  batchActions: { flexDirection: 'row', justifyContent: 'space-between' },
  batchLabel: { fontSize: 12.5, fontWeight: '700', paddingVertical: gap.sm },
  offerActions: { alignItems: 'center', flexDirection: 'row', gap: gap.lg },
  offerButton: { flex: 1 },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: gap.lg,
    paddingHorizontal: gap.lg,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: gap.xl,
  },
  editor: { borderRadius: radius.xl, maxWidth: 520, padding: gap.xl, width: '100%' },
});
