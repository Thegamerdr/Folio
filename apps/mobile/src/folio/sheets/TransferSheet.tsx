import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { recordInternalTransfer, useAppStore, type Account } from '@/folio/store';
import { useUndo } from '@/folio/ui/useUndo';
import { parseManualMoney } from '@/folio/lib/manualMoney';

const EMPTY_ACCOUNTS: Account[] = [];

export type TransferSheetProps = { visible: boolean; onClose: () => void };

export function TransferSheet({ visible, onClose }: TransferSheetProps) {
  const palette = useTheme();
  const { showUndo } = useUndo();
  const commitStarted = useRef(false);
  const accounts = useAppStore((state) => state.accounts) ?? EMPTY_ACCOUNTS;
  const workspaceId = useAppStore((state) => state.activeWorkspaceId);
  const activeAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          !account.closed &&
          !account.isLiability &&
          (account.workspaceId === undefined || account.workspaceId === workspaceId),
      ),
    [accounts, workspaceId],
  );
  const [fromAccountId, setFromAccountId] = useState<string>();
  const [toAccountId, setToAccountId] = useState<string>();
  const [amount, setAmount] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setFromAccountId(undefined);
    setToAccountId(undefined);
    setAmount('');
    setReviewing(false);
    setError(undefined);
    setConfirming(false);
    commitStarted.current = false;
  }, [visible, workspaceId]);
  const from = activeAccounts.find((account) => account.id === fromAccountId);
  const to = activeAccounts.find((account) => account.id === toAccountId);
  const parsedAmount = parseManualMoney(amount) ?? 0;
  const validAmount = parsedAmount > 0;
  const canReview = from !== undefined && to !== undefined && from.id !== to.id && validAmount;

  function review() {
    if (!canReview) return;
    setError(undefined);
    setReviewing(true);
  }

  function confirm() {
    if (commitStarted.current || !canReview || from === undefined || to === undefined) return;
    commitStarted.current = true;
    setConfirming(true);
    setError(undefined);
    try {
      const result = recordInternalTransfer({
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: parsedAmount,
      });
      setReviewing(false);
      onClose();
      showUndo('Transfer recorded', () => {
        if (!result.undo())
          Alert.alert(
            'Transfer kept',
            'An affected account changed after this transfer. Nothing was undone.',
          );
      });
    } catch (cause) {
      commitStarted.current = false;
      setError(cause instanceof Error ? cause.message : 'Transfer could not be recorded.');
      setConfirming(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <Text style={[styles.eyebrow, { color: palette.muted }]}>Record a transfer</Text>
        <Text style={[styles.title, { color: palette.ink }]}>Between your accounts</Text>
        <Text style={[styles.copy, { color: palette.muted }]}>
          This records a transfer you already made. Melo does not move money at your bank.
        </Text>
        {activeAccounts.length < 2 ? (
          <Text style={[styles.copy, { color: palette.muted }]}>
            Add two active cash accounts before recording a transfer.
          </Text>
        ) : reviewing && from !== undefined && to !== undefined ? (
          <View>
            <Text style={[styles.copy, { color: palette.ink }]}>
              Review this internal transfer:
            </Text>
            <Text style={[styles.review, { color: palette.ink }]}>
              £{parsedAmount.toFixed(2)} from {from.name} to {to.name}
            </Text>
            <Text style={[styles.copy, { color: palette.muted }]}>
              Recorded effect: {from.name} decreases by £{parsedAmount.toFixed(2)} and {to.name}{' '}
              increases by £{parsedAmount.toFixed(2)}. Your overall bank total stays the same.
            </Text>
            {error ? <Text style={[styles.error, { color: palette.calm }]}>{error}</Text> : null}
            <Action
              label={confirming ? 'Saving…' : 'Confirm transfer'}
              onPress={confirm}
              palette={palette}
              primary
              disabled={confirming}
            />
            <Action label="Back" onPress={() => setReviewing(false)} palette={palette} />
          </View>
        ) : (
          <>
            <Text style={[styles.label, { color: palette.muted }]}>From</Text>
            <AccountChoices
              accounts={activeAccounts}
              selected={fromAccountId}
              onSelect={setFromAccountId}
              palette={palette}
            />
            <Text style={[styles.label, { color: palette.muted }]}>To</Text>
            <AccountChoices
              accounts={activeAccounts}
              selected={toAccountId}
              onSelect={setToAccountId}
              palette={palette}
            />
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="Amount"
              placeholderTextColor={palette.muted}
              style={[styles.input, { borderColor: palette.hairline, color: palette.ink }]}
              accessibilityLabel="Transfer amount"
            />
            {amount.length > 0 && !validAmount ? (
              <Text style={[styles.error, { color: palette.repairInk }]}>
                Enter a positive amount with at most two decimal places.
              </Text>
            ) : null}
            {from !== undefined && to !== undefined && from.id === to.id ? (
              <Text style={[styles.error, { color: palette.calm }]}>
                Choose two different accounts.
              </Text>
            ) : null}
            {error ? <Text style={[styles.error, { color: palette.calm }]}>{error}</Text> : null}
            <Action
              label="Review transfer"
              onPress={review}
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

function AccountChoices({
  accounts,
  selected,
  onSelect,
  palette,
}: {
  accounts: Account[];
  selected?: string | undefined;
  onSelect: (id: string) => void;
  palette: Palette;
}) {
  return (
    <View style={styles.choices}>
      {accounts.map((account) => (
        <Pressable
          key={account.id}
          onPress={() => onSelect(account.id)}
          style={[
            styles.choice,
            { backgroundColor: selected === account.id ? palette.ink : palette.inset },
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === account.id }}
        >
          <Text style={{ color: selected === account.id ? palette.inverse : palette.ink }}>
            {account.name}
          </Text>
          <Text style={{ color: selected === account.id ? palette.inverse : palette.muted }}>
            £{account.balanceMinor.toFixed(2)}
          </Text>
        </Pressable>
      ))}
    </View>
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
  title: { fontFamily: serif.display, fontSize: 30, lineHeight: 36 },
  copy: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 13, marginTop: gap.sm },
  choices: { gap: gap.sm },
  choice: {
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: gap.md,
    fontSize: 18,
  },
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
