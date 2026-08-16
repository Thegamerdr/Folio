import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';

import {
  stageBankCandidatesForReview,
  type OpenBankingConnectionsResponse,
  type OpenBankingRuntimeConnection,
  type OpenBankingSyncResponse,
} from '@folio/open-banking';

import { gap, radius, serif, Sheet, Surface, useTheme } from '@/folio/theme';
import { copy } from '@/folio/copy/copy';
import {
  DEFAULT_ACCOUNT_ID,
  deleteBankImportedHistory,
  enqueueReviewItems,
  useAppStore,
} from '@/folio/store';
import {
  disconnectOpenBankingConnection,
  fetchOpenBankingConnections,
  openBankAuthorization,
  startOpenBankingConnection,
  syncOpenBankingConnection,
} from '@/folio/lib/openBankingNative';

const TRUELAYER_LEGAL_URL = 'https://truelayer.com/legal/';

export type BankSourceSummary = Readonly<{
  providerConfigured: boolean | null;
  active: boolean;
  checking: boolean;
}>;

export type BankConnectionSheetProps = Readonly<{
  visible: boolean;
  onClose: () => void;
  onReview: () => void;
  onRequestSignIn: () => void;
  onStatusChange?: (summary: BankSourceSummary) => void;
}>;

export function BankConnectionSheet({
  visible,
  onClose,
  onReview,
  onRequestSignIn,
  onStatusChange,
}: BankConnectionSheetProps) {
  const t = useTheme();
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const localAccounts = useAppStore((state) => state.accounts ?? []);
  const availableLocalAccounts = useMemo(
    () => localAccounts.filter((account) => !account.closed),
    [localAccounts],
  );
  const [remote, setRemote] = useState<OpenBankingConnectionsResponse | null>(null);
  const [displayName, setDisplayName] = useState(user?.fullName ?? '');
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [stagedSync, setStagedSync] = useState<OpenBankingSyncResponse | null>(null);
  const [accountMappings, setAccountMappings] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'loading' | 'connect' | 'sync' | 'queue' | 'disconnect' | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const liveConnections = useMemo(
    () => remote?.connections.filter((connection) => connection.status !== 'disconnected') ?? [],
    [remote],
  );
  const currentConnection =
    liveConnections.find((connection) => connection.status === 'active') ??
    liveConnections[0] ??
    null;

  useEffect(() => {
    if (!visible) return;
    setDisplayName((current) => current || user?.fullName || '');
    setError(null);
    setNotice(null);
    setStagedSync(null);
    if (!isSignedIn) {
      setRemote(null);
      onStatusChange?.({ providerConfigured: null, active: false, checking: false });
      return;
    }
    let current = true;
    setBusy('loading');
    onStatusChange?.({ providerConfigured: null, active: false, checking: true });
    void tokenOrThrow(getToken)
      .then((token) => fetchOpenBankingConnections(token, activeWorkspaceId))
      .then((result) => {
        if (!current) return;
        setRemote(result);
        setShowConnectForm(
          result.connections.every((connection) => connection.status === 'disconnected'),
        );
        onStatusChange?.({
          providerConfigured: result.providerConfigured,
          active: result.connections.some((connection) => connection.status === 'active'),
          checking: false,
        });
      })
      .catch((reason: unknown) => {
        if (current) setError(messageFor(reason));
        onStatusChange?.({ providerConfigured: null, active: false, checking: false });
      })
      .finally(() => {
        if (current) setBusy(null);
      });
    return () => {
      current = false;
    };
  }, [activeWorkspaceId, getToken, isSignedIn, onStatusChange, user?.fullName, visible]);

  const refreshConnections = async () => {
    const result = await fetchOpenBankingConnections(
      await tokenOrThrow(getToken),
      activeWorkspaceId,
    );
    setRemote(result);
    onStatusChange?.({
      providerConfigured: result.providerConfigured,
      active: result.connections.some((connection) => connection.status === 'active'),
      checking: false,
    });
    return result;
  };

  const connect = async () => {
    if (busy !== null) return;
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email) {
      setError('Your signed-in account needs a verified email before a bank can be connected.');
      return;
    }
    setBusy('connect');
    setError(null);
    setNotice(null);
    try {
      const started = await startOpenBankingConnection(
        await tokenOrThrow(getToken),
        activeWorkspaceId,
        {
          displayName: displayName.trim(),
          email,
        },
      );
      const result = await openBankAuthorization(started.authorizationUrl, started.returnUri);
      if (result === 'cancelled') {
        setNotice('Bank connection was cancelled. Nothing was added to Melo.');
      } else {
        setNotice('Bank returned to Melo. Checking the connection now.');
      }
      await refreshConnections();
      setShowConnectForm(false);
    } catch (reason: unknown) {
      setError(messageFor(reason));
    } finally {
      setBusy(null);
    }
  };

  const sync = async (connection: OpenBankingRuntimeConnection) => {
    if (busy !== null) return;
    setBusy('sync');
    setError(null);
    setNotice(null);
    setStagedSync(null);
    try {
      const result = await syncOpenBankingConnection(
        await tokenOrThrow(getToken),
        activeWorkspaceId,
        connection.id,
      );
      setStagedSync(result);
      setRemote((current) =>
        current === null
          ? current
          : {
              ...current,
              connections: current.connections.map((item) =>
                item.id === result.connection.id ? result.connection : item,
              ),
            },
      );
      setAccountMappings((current) => {
        const next = { ...current };
        result.connection.accounts.forEach((account, index) => {
          if (next[account.accountRef] !== undefined) return;
          next[account.accountRef] =
            availableLocalAccounts[index]?.id ??
            availableLocalAccounts[0]?.id ??
            DEFAULT_ACCOUNT_ID;
        });
        return next;
      });
      if (result.candidates.length === 0 && result.pending) {
        setNotice('The bank is still preparing this refresh. Try again in a moment.');
      } else if (result.candidates.length === 0) {
        setNotice(copy.bank.empty);
      }
    } catch (reason: unknown) {
      setError(messageFor(reason));
    } finally {
      setBusy(null);
    }
  };

  const staged = useMemo(
    () =>
      stagedSync === null
        ? null
        : stageBankCandidatesForReview({ sync: stagedSync, accountMappings }),
    [accountMappings, stagedSync],
  );

  const sendToReview = () => {
    if (busy !== null || staged === null || staged.reviewItems.length === 0) return;
    setBusy('queue');
    const result = enqueueReviewItems([...staged.reviewItems]);
    setBusy(null);
    if (result.fresh.length === 0) {
      setNotice(copy.bank.review.duplicate);
      return;
    }
    setStagedSync(null);
    onClose();
    onReview();
  };

  const cycleMapping = (accountRef: string) => {
    if (availableLocalAccounts.length < 2) return;
    setAccountMappings((current) => {
      const currentId = current[accountRef];
      const index = availableLocalAccounts.findIndex((account) => account.id === currentId);
      const next = availableLocalAccounts[(index + 1) % availableLocalAccounts.length];
      return next === undefined ? current : { ...current, [accountRef]: next.id };
    });
  };

  const disconnect = (connection: OpenBankingRuntimeConnection) => {
    if (busy !== null) return;
    Alert.alert('Disconnect this bank?', copy.bank.disconnect.body, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect Melo',
        style: 'destructive',
        onPress: () => {
          setBusy('disconnect');
          setError(null);
          void tokenOrThrow(getToken)
            .then((token) =>
              disconnectOpenBankingConnection(token, activeWorkspaceId, connection.id),
            )
            .then(async () => {
              await refreshConnections();
              Alert.alert('Keep imported history?', copy.bank.disconnect.keep, [
                { text: 'Keep history', style: 'cancel' },
                {
                  text: 'Remove bank history',
                  style: 'destructive',
                  onPress: () => {
                    const deleted = deleteBankImportedHistory(connection.id);
                    setNotice(
                      `Removed ${deleted.deletedTransactions} accepted and ${deleted.deletedReviewItems} waiting bank ${deleted.deletedTransactions + deleted.deletedReviewItems === 1 ? 'row' : 'rows'} from this device.`,
                    );
                  },
                },
              ]);
            })
            .catch((reason: unknown) => setError(messageFor(reason)))
            .finally(() => setBusy(null));
        },
      },
    ]);
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <Text style={[styles.eyebrow, { color: t.muted }]}>Bank connection</Text>
        <Text style={[styles.headline, { color: t.ink }]}>
          Less re-keying. Still your decision.
        </Text>
        <Text style={[styles.subline, { color: t.muted }]}>
          Optional and read-only. TrueLayer handles bank selection, consent and bank sign-in. Melo
          asks for account details and transactions, then keeps every returned row out of your money
          until you send it to Review.
        </Text>

        {!isSignedIn ? (
          <Surface
            style={[styles.statusCard, { backgroundColor: t.inset, borderColor: t.hairline }]}
          >
            <Text style={[styles.statusTitle, { color: t.ink }]}>Sign in first</Text>
            <Text style={[styles.statusBody, { color: t.muted }]}>
              A Melo account is needed only so the server can keep one bank connection isolated from
              another. Your local manual and statement flows still work without it.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onClose();
                onRequestSignIn();
              }}
              style={[styles.primaryButton, { backgroundColor: t.calm }]}
            >
              <Text style={[styles.primaryLabel, { color: t.accentInk }]}>Sign in to continue</Text>
            </Pressable>
          </Surface>
        ) : remote !== null && !remote.providerConfigured ? (
          <Surface
            style={[styles.statusCard, { backgroundColor: t.inset, borderColor: t.hairline }]}
          >
            <Text style={[styles.statusTitle, { color: t.ink }]}>
              Provider setup is still pending
            </Text>
            <Text style={[styles.statusBody, { color: t.muted }]}>
              The protected Melo adapter is online, but no approved TrueLayer client credentials
              have been connected to it. Statements, photos, CSV and manual entries remain
              available.
            </Text>
          </Surface>
        ) : null}

        {remote?.providerConfigured
          ? liveConnections.map((connection) => (
              <ConnectionCard
                connection={connection}
                key={connection.id}
                busy={busy}
                onDisconnect={() => disconnect(connection)}
                onSync={() => void sync(connection)}
              />
            ))
          : null}

        {remote?.providerConfigured && (showConnectForm || currentConnection === null) ? (
          <View style={styles.connectSection}>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>Connect a UK bank</Text>
            <Text style={[styles.sectionBody, { color: t.muted }]}>
              TrueLayer requires your full first and last name for its hosted connection journey.
              Melo sends it for this journey and does not store it in the connection record.
            </Text>
            <TextInput
              accessibilityLabel="Full name for bank connection"
              autoCapitalize="words"
              autoComplete="name"
              onChangeText={setDisplayName}
              placeholder="Full first and last name"
              placeholderTextColor={t.muted}
              style={[
                styles.nameInput,
                { color: t.ink, backgroundColor: t.inset, borderColor: t.hairline },
              ]}
              value={displayName}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy !== null || displayName.trim().length < 3 }}
              disabled={busy !== null || displayName.trim().length < 3}
              onPress={() => void connect()}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: t.calm,
                  opacity: busy !== null || displayName.trim().length < 3 ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[styles.primaryLabel, { color: t.accentInk }]}>
                {busy === 'connect' ? 'Opening TrueLayer…' : 'Continue to bank selection'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {remote?.providerConfigured && currentConnection !== null && !showConnectForm ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowConnectForm(true)}
            style={styles.textButton}
          >
            <Text style={[styles.textButtonLabel, { color: t.muted }]}>Connect another bank</Text>
          </Pressable>
        ) : null}

        {stagedSync !== null && staged !== null && stagedSync.candidates.length > 0 ? (
          <View style={styles.reviewSection}>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>
              Choose where each account lands
            </Text>
            <Text style={[styles.sectionBody, { color: t.muted }]}>{copy.bank.review.body}</Text>
            {stagedSync.connection.accounts.map((bankAccount) => {
              const localId = accountMappings[bankAccount.accountRef];
              const local =
                availableLocalAccounts.find((account) => account.id === localId) ??
                availableLocalAccounts[0];
              return (
                <Pressable
                  accessibilityHint={
                    availableLocalAccounts.length > 1
                      ? 'Changes the destination Melo account.'
                      : undefined
                  }
                  accessibilityRole="button"
                  key={bankAccount.accountRef}
                  onPress={() => cycleMapping(bankAccount.accountRef)}
                  style={[styles.mappingRow, { borderColor: t.hairline }]}
                >
                  <View style={styles.mappingText}>
                    <Text style={[styles.mappingBank, { color: t.ink }]}>{bankAccount.label}</Text>
                    <Text style={[styles.mappingLocal, { color: t.muted }]}>
                      Add to {local?.name ?? 'Main'} · {bankAccount.currency}
                    </Text>
                  </View>
                  {availableLocalAccounts.length > 1 ? (
                    <Text style={[styles.mappingChange, { color: t.calmStrong }]}>Change</Text>
                  ) : null}
                </Pressable>
              );
            })}
            <Text style={[styles.stageCount, { color: t.muted }]}>
              {staged.reviewItems.length} ready for Review
              {staged.unsupportedCurrencyCount > 0
                ? ` · ${copy.bank.review.non_gbp(
                    String(staged.unsupportedCurrencyCount),
                    staged.unsupportedCurrencyCount === 1 ? 'item' : 'items',
                  )}`
                : ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: staged.reviewItems.length === 0 || busy !== null }}
              disabled={staged.reviewItems.length === 0 || busy !== null}
              onPress={sendToReview}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: t.calm,
                  opacity: staged.reviewItems.length === 0 || busy !== null ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[styles.primaryLabel, { color: t.accentInk }]}>Send to Review</Text>
            </Pressable>
          </View>
        ) : null}

        {notice !== null ? (
          <Text style={[styles.notice, { color: t.positiveInk }]}>{notice}</Text>
        ) : null}
        {error !== null ? (
          <Text style={[styles.error, { color: t.repairInk }]}>{error}</Text>
        ) : null}

        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(TRUELAYER_LEGAL_URL)}
          style={styles.legalButton}
        >
          <Text style={[styles.legal, { color: t.muted }]}>
            TrueLayer terms, privacy and legal details
          </Text>
        </Pressable>
        <Text style={[styles.legal, { color: t.muted }]}>
          Manual entry and statement reading stay available whether you connect a bank or not.
        </Text>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
          <Text style={[styles.closeLabel, { color: t.muted }]}>Close</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

function ConnectionCard({
  connection,
  busy,
  onSync,
  onDisconnect,
}: {
  connection: OpenBankingRuntimeConnection;
  busy: string | null;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const t = useTheme();
  const status = connectionStatus(connection);
  return (
    <Surface style={[styles.connectionCard, { borderColor: t.hairline, backgroundColor: t.inset }]}>
      <View style={styles.connectionHeader}>
        <View style={styles.mappingText}>
          <Text style={[styles.statusTitle, { color: t.ink }]}>{connection.providerLabel}</Text>
          <Text style={[styles.statusBody, { color: t.muted }]}>{status}</Text>
        </View>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: connection.status === 'active' ? t.positive : t.warm },
          ]}
        />
      </View>
      {connection.accounts.length > 0 ? (
        <Text style={[styles.accountSummary, { color: t.muted }]}>
          {connection.accounts
            .map((account) => `${account.label} · ${account.currency}`)
            .join('\n')}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy !== null || connection.status === 'pending_redirect' }}
        disabled={busy !== null || connection.status === 'pending_redirect'}
        onPress={onSync}
        style={[styles.secondaryButton, { borderColor: t.hairlineStrong }]}
      >
        <Text style={[styles.secondaryLabel, { color: t.ink }]}>
          {busy === 'sync' ? 'Checking bank…' : copy.bank.check}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onDisconnect} style={styles.textButton}>
        <Text style={[styles.textButtonLabel, { color: t.repairInk }]}>Disconnect Melo</Text>
      </Pressable>
    </Surface>
  );
}

async function tokenOrThrow(getToken: () => Promise<string | null>): Promise<string> {
  const token = await getToken();
  if (token === null || token.length === 0)
    throw new Error('Sign in again to use bank connection.');
  return token;
}

function connectionStatus(connection: OpenBankingRuntimeConnection): string {
  switch (connection.status) {
    case 'active':
      return connection.lastSuccessfulRefreshAt === null
        ? 'Connected · ready for first check'
        : `Last checked ${formatDate(connection.lastSuccessfulRefreshAt)}`;
    case 'pending_redirect':
      return 'Waiting for bank authorisation';
    case 'pending_sync':
      return 'Bank returned · first check needed';
    case 'error':
      return 'Needs attention · try checking again';
    case 'disconnected':
      return 'Disconnected';
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'at an unknown time';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function messageFor(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : 'Bank connection could not complete. Your local Melo data is unchanged.';
}

const styles = StyleSheet.create({
  body: { paddingBottom: gap.md },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  headline: { fontFamily: serif.display, fontSize: 23, lineHeight: 28, marginTop: gap.xs },
  subline: { fontFamily: serif.displayItalic, fontSize: 13, lineHeight: 19, marginTop: gap.sm },
  statusCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.lg,
    padding: gap.md,
  },
  statusTitle: { fontFamily: serif.display, fontSize: 17, lineHeight: 22 },
  statusBody: { fontSize: 12, lineHeight: 17, marginTop: gap.xs },
  connectSection: { marginTop: gap.xl },
  sectionTitle: { fontFamily: serif.display, fontSize: 18, lineHeight: 23 },
  sectionBody: { fontSize: 12, lineHeight: 17, marginTop: gap.xs },
  nameInput: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
    marginTop: gap.md,
    minHeight: 50,
    paddingHorizontal: gap.md,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: radius.lg,
    justifyContent: 'center',
    marginTop: gap.md,
    minHeight: 50,
    paddingHorizontal: gap.md,
  },
  primaryLabel: { fontSize: 14, fontWeight: '600' },
  connectionCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.lg,
    padding: gap.md,
  },
  connectionHeader: { alignItems: 'center', flexDirection: 'row', gap: gap.md },
  statusDot: { borderRadius: 5, height: 9, width: 9 },
  accountSummary: { fontSize: 11.5, lineHeight: 17, marginTop: gap.md },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    marginTop: gap.md,
    minHeight: 48,
    paddingHorizontal: gap.md,
  },
  secondaryLabel: { fontSize: 13.5, fontWeight: '600' },
  textButton: {
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: gap.sm,
    paddingTop: gap.md,
  },
  textButtonLabel: { fontSize: 12.5, textAlign: 'center' },
  reviewSection: { marginTop: gap.xl },
  mappingRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: gap.md,
    minHeight: 62,
    paddingVertical: gap.sm,
  },
  mappingText: { flex: 1 },
  mappingBank: { fontSize: 13.5, fontWeight: '600' },
  mappingLocal: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  mappingChange: { fontSize: 11.5, fontWeight: '600' },
  stageCount: { fontSize: 11.5, lineHeight: 17, marginTop: gap.md },
  notice: { fontSize: 12, lineHeight: 17, marginTop: gap.md },
  error: { fontSize: 12, lineHeight: 17, marginTop: gap.md },
  legalButton: { minHeight: 36, justifyContent: 'flex-end', marginTop: gap.lg },
  legal: { fontSize: 10.5, lineHeight: 15, textAlign: 'center' },
  closeButton: { alignItems: 'center', marginTop: gap.md, paddingVertical: gap.sm },
  closeLabel: { fontSize: 13 },
});
