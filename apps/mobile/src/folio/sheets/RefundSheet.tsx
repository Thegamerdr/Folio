import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import {
  accountIdOf,
  pairRefund,
  useAppStore,
  type Account,
  type Transaction,
} from '@/folio/store';
import { useUndo } from '@/folio/ui/useUndo';

const EMPTY_TRANSACTIONS: Transaction[] = [];
const EMPTY_ACCOUNTS: Account[] = [];

export type RefundSheetProps = { visible: boolean; onClose: () => void };

export function RefundSheet({ visible, onClose }: RefundSheetProps) {
  const palette = useTheme();
  const { showUndo } = useUndo();
  const commitStarted = useRef(false);
  const transactions = useAppStore((state) => state.transactions) ?? EMPTY_TRANSACTIONS;
  const accounts = useAppStore((state) => state.accounts) ?? EMPTY_ACCOUNTS;
  const workspaceId = useAppStore((state) => state.activeWorkspaceId);
  const accountName = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts],
  );
  const [creditQuery, setCreditQuery] = useState('');
  const [outflowQuery, setOutflowQuery] = useState('');
  const pairedTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of transactions) {
      if (!owned(row, workspaceId) || row.financialAction?.kind !== 'refund') continue;
      const id = row.financialAction.originalTransactionId;
      totals.set(id, (totals.get(id) ?? 0) + row.amount);
    }
    return totals;
  }, [transactions, workspaceId]);
  const incoming = useMemo(
    () =>
      transactions.filter(
        (row) =>
          Number.isFinite(row.amount) &&
          row.amount > 0 &&
          row.financialAction?.kind !== 'refund' &&
          row.financialAction?.kind !== 'transfer' &&
          owned(row, workspaceId),
      ),
    [transactions, workspaceId],
  );
  const outflows = useMemo(
    () =>
      transactions.filter(
        (row) =>
          Number.isFinite(row.amount) &&
          row.amount < 0 &&
          row.financialAction?.kind !== 'transfer' &&
          owned(row, workspaceId) &&
          refundRemaining(row, pairedTotals) > 0,
      ),
    [transactions, workspaceId, pairedTotals],
  );
  const matchingCredits = useMemo(
    () => incoming.filter((row) => matches(row, creditQuery)),
    [incoming, creditQuery],
  );
  const matchingOutflows = useMemo(
    () => outflows.filter((row) => matches(row, outflowQuery)),
    [outflows, outflowQuery],
  );
  const [incomingId, setIncomingId] = useState<string>();
  const [originalId, setOriginalId] = useState<string>();
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setIncomingId(undefined);
    setOriginalId(undefined);
    setReviewing(false);
    setError(undefined);
    setConfirming(false);
    commitStarted.current = false;
    setCreditQuery('');
    setOutflowQuery('');
  }, [visible, workspaceId]);
  const selectedIncoming = incoming.find((row) => row.id === incomingId);
  const selectedOriginal = outflows.find((row) => row.id === originalId);
  const canReview = selectedIncoming !== undefined && selectedOriginal !== undefined;

  function confirm() {
    if (
      commitStarted.current ||
      !canReview ||
      selectedIncoming === undefined ||
      selectedOriginal === undefined
    )
      return;
    commitStarted.current = true;
    setConfirming(true);
    setError(undefined);
    try {
      const result = pairRefund({
        incomingTransactionId: selectedIncoming.id,
        originalTransactionId: selectedOriginal.id,
      });
      onClose();
      showUndo('Refund paired', () => {
        if (!result.undo())
          Alert.alert('Refund link kept', 'The linked records changed. Nothing was undone.');
      });
    } catch (cause) {
      commitStarted.current = false;
      setError(cause instanceof Error ? cause.message : 'Refund pairing failed.');
      setConfirming(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <Text style={[styles.eyebrow, { color: palette.muted }]}>Match a refund</Text>
        <Text style={[styles.title, { color: palette.ink }]}>Pair the money in</Text>
        {incoming.length === 0 ? (
          <Text style={[styles.prerequisite, { color: palette.muted }]}>
            There is no incoming credit to pair yet. Record or import the refund first, then return
            here.
          </Text>
        ) : reviewing && selectedIncoming !== undefined && selectedOriginal !== undefined ? (
          <View>
            <Text style={[styles.copy, { color: palette.ink }]}>Review this link:</Text>
            <Text style={[styles.review, { color: palette.ink }]}>
              £{selectedIncoming.amount.toFixed(2)} from {selectedIncoming.merchant}
            </Text>
            <Text style={[styles.copy, { color: palette.muted }]}>
              Original outflow: £{Math.abs(selectedOriginal.amount).toFixed(2)} at{' '}
              {selectedOriginal.merchant}. No new transaction or money is created.
            </Text>
            {error ? <Text style={[styles.error, { color: palette.calm }]}>{error}</Text> : null}
            <Action
              label={confirming ? 'Saving…' : 'Confirm pairing'}
              onPress={confirm}
              palette={palette}
              primary
              disabled={confirming}
            />
            <Action label="Back" onPress={() => setReviewing(false)} palette={palette} />
          </View>
        ) : (
          <>
            <Text style={[styles.label, { color: palette.muted }]}>Incoming credit</Text>
            <TextInput
              accessibilityLabel="Find incoming credit"
              placeholder="Find by name, date or amount"
              placeholderTextColor={palette.muted}
              value={creditQuery}
              onChangeText={setCreditQuery}
              style={[styles.search, { color: palette.ink, borderColor: palette.hairline }]}
            />
            {matchingCredits.slice(0, 40).map((row) => (
              <TransactionChoice
                key={row.id}
                row={row}
                selected={row.id === incomingId}
                accountName={accountName}
                onPress={() => setIncomingId(row.id)}
                palette={palette}
              />
            ))}
            {matchingCredits.length === 0 ? (
              <Text style={[styles.copy, { color: palette.muted }]}>No matching credit.</Text>
            ) : null}
            {matchingCredits.length > 40 ? (
              <Text style={[styles.copy, { color: palette.muted }]}>
                Showing 40 of {matchingCredits.length}. Narrow your search to find another credit.
              </Text>
            ) : null}
            <Text style={[styles.label, { color: palette.muted }]}>Original outflow</Text>
            <TextInput
              accessibilityLabel="Find original outflow"
              placeholder="Find by name, date or amount"
              placeholderTextColor={palette.muted}
              value={outflowQuery}
              onChangeText={setOutflowQuery}
              style={[styles.search, { color: palette.ink, borderColor: palette.hairline }]}
            />
            {matchingOutflows.length === 0 ? (
              <Text style={[styles.copy, { color: palette.muted }]}>
                No matching eligible outflow in this workspace.
              </Text>
            ) : (
              matchingOutflows
                .slice(0, 40)
                .map((row) => (
                  <TransactionChoice
                    key={row.id}
                    row={row}
                    selected={row.id === originalId}
                    accountName={accountName}
                    detail={`£${refundRemaining(row, pairedTotals).toFixed(2)} remaining`}
                    onPress={() => setOriginalId(row.id)}
                    palette={palette}
                  />
                ))
            )}
            {matchingOutflows.length > 40 ? (
              <Text style={[styles.copy, { color: palette.muted }]}>
                Showing 40 of {matchingOutflows.length}. Narrow your search to find another outflow.
              </Text>
            ) : null}
            {error ? <Text style={[styles.error, { color: palette.calm }]}>{error}</Text> : null}
            <Action
              label="Review pairing"
              onPress={() => {
                if (canReview) {
                  setError(undefined);
                  setReviewing(true);
                }
              }}
              palette={palette}
              primary
              disabled={!canReview}
            />
            <Action label="Not yet" onPress={onClose} palette={palette} />
          </>
        )}
      </View>
    </Sheet>
  );
}

function owned(row: Transaction, workspaceId: string): boolean {
  return row.workspaceId === undefined || row.workspaceId === workspaceId;
}

function refundRemaining(row: Transaction, pairedTotals: ReadonlyMap<string, number>): number {
  const paired = pairedTotals.get(row.id) ?? 0;
  return Math.max(0, Math.round((Math.abs(row.amount) - paired) * 100) / 100);
}

function matches(row: Transaction, query: string): boolean {
  return `${row.merchant} ${row.when.slice(0, 10)} ${Math.abs(row.amount).toFixed(2)}`
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}

function TransactionChoice({
  row,
  selected,
  accountName,
  detail,
  onPress,
  palette,
}: {
  row: Transaction;
  selected: boolean;
  accountName: ReadonlyMap<string, string>;
  detail?: string;
  onPress: () => void;
  palette: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, { backgroundColor: selected ? palette.ink : palette.inset }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.choiceCopy}>
        <Text style={{ color: selected ? palette.inverse : palette.ink }}>{row.merchant}</Text>
        <Text style={{ color: selected ? palette.inverse : palette.muted }}>
          {row.when.slice(0, 10)} · {accountName.get(accountIdOf(row)) ?? accountIdOf(row)}
          {detail ? ` · ${detail}` : ''}
        </Text>
      </View>
      <Text style={{ color: selected ? palette.inverse : palette.ink }}>
        £{Math.abs(row.amount).toFixed(2)}
      </Text>
    </Pressable>
  );
}

function Action({
  label,
  onPress,
  palette,
  primary,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  palette: Palette;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.action,
        { backgroundColor: primary ? palette.calm : palette.inset, opacity: disabled ? 0.45 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={{ color: primary ? palette.inverse : palette.ink, fontFamily: serif.display }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { padding: gap.xl, gap: gap.md },
  eyebrow: { fontFamily: serif.display, fontSize: 14 },
  title: { fontFamily: serif.display, fontSize: 26, lineHeight: 32 },
  copy: { fontSize: 15, lineHeight: 22 },
  prerequisite: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 13, marginTop: gap.sm },
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: gap.md,
    fontSize: 16,
  },
  choice: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: gap.sm,
  },
  choiceCopy: { flex: 1, gap: 2 },
  review: { fontFamily: serif.display, fontSize: 20, lineHeight: 28, marginVertical: gap.md },
  error: { fontSize: 14, lineHeight: 20 },
  action: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: gap.lg,
    marginTop: gap.sm,
  },
});
