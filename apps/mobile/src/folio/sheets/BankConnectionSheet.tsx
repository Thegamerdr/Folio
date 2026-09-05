import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';

import {
  stageBankCandidatesForReview,
  type OpenBankingConnectionsResponse,
  type OpenBankingRuntimeConnection,
  type OpenBankingSyncResponse,
} from '@folio/open-banking';
import {
  stageBankImportBatch,
  setBankImportBatchMappings,
  discardBankImportBatch,
  getState,
  useAppStore,
} from '@/folio/store';
import { unsettledBankImportBatches, type BankImportBatch } from '@/folio/lib/bankImportInbox';
import { isClerkConfigured } from '@/folio/lib/clerkAuth';
import { isOpenBankingEnabled } from '@/folio/lib/openBankingConfig';

import { gap, radius, serif, Sheet, Surface, useTheme } from '@/folio/theme';
import { DEFAULT_ACCOUNT_ID, deleteBankImportedHistory, enqueueReviewItems } from '@/folio/store';
import { persistCurrentStateNow } from '@/folio/lib/persist';
import {
  disconnectOpenBankingConnection,
  acknowledgeOpenBankingBatch,
  fetchOpenBankingConnections,
  openBankAuthorization,
  startOpenBankingConnection,
  syncOpenBankingConnection,
} from '@/folio/lib/openBankingNative';

const TRUELAYER_LEGAL_URL = 'https://truelayer.com/legal/';
const EMPTY_BANK_INBOX: readonly BankImportBatch[] = [];

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

const NO_TOKEN = async () => null;
type BankSheetAuth = Readonly<{
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  fullName: string;
  email: string | undefined;
}>;

/** Local receipts remain usable even in a build without a ClerkProvider. */
export function BankConnectionSheet(props: BankConnectionSheetProps) {
  return isClerkConfigured() ? (
    <AuthenticatedBankConnectionSheet {...props} />
  ) : (
    <BankConnectionContents
      {...props}
      isSignedIn={false}
      getToken={NO_TOKEN}
      fullName=""
      email={undefined}
    />
  );
}

function AuthenticatedBankConnectionSheet(props: BankConnectionSheetProps) {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  return (
    <BankConnectionContents
      {...props}
      isSignedIn={isSignedIn === true}
      getToken={getToken}
      fullName={user?.fullName ?? ''}
      email={user?.primaryEmailAddress?.emailAddress}
    />
  );
}

function BankConnectionContents({
  visible,
  onClose,
  onReview,
  onRequestSignIn,
  onStatusChange,
  isSignedIn,
  getToken,
  fullName,
  email,
}: BankConnectionSheetProps & BankSheetAuth) {
  const t = useTheme();
  const networkEnabled = isOpenBankingEnabled() && isSignedIn;
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const localAccounts = useAppStore((state) => state.accounts);
  const transactions = useAppStore((state) => state.transactions);
  const ignoredBankExternalIds = useAppStore((state) => state.ignoredBankExternalIds);
  const rawBankImportInbox = useAppStore((state) => state.bankImportInbox);
  const settledExternalIds = useMemo(
    () =>
      new Set([
        ...transactions.flatMap((row) => (row.externalId ? [row.externalId] : [])),
        ...(ignoredBankExternalIds ?? []),
      ]),
    [transactions, ignoredBankExternalIds],
  );
  const bankImportInbox = useMemo(
    () => unsettledBankImportBatches(rawBankImportInbox ?? EMPTY_BANK_INBOX, settledExternalIds),
    [rawBankImportInbox, settledExternalIds],
  );
  const availableLocalAccounts = useMemo(
    () => (localAccounts ?? []).filter((account) => !account.closed),
    [localAccounts],
  );
  const [remote, setRemote] = useState<OpenBankingConnectionsResponse | null>(null);
  const [displayName, setDisplayName] = useState(fullName);
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [stagedSync, setStagedSync] = useState<OpenBankingSyncResponse | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [accountMappings, setAccountMappings] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'loading' | 'connect' | 'sync' | 'queue' | 'disconnect' | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const operationRef = useRef(false);
  const beginOperation = (kind: NonNullable<typeof busy>) => {
    if (operationRef.current || busy !== null) return false;
    operationRef.current = true;
    setBusy(kind);
    setError(null);
    return true;
  };
  const endOperation = () => {
    operationRef.current = false;
    setBusy(null);
  };
  const assertWorkspace = () => {
    if (getState().activeWorkspaceId !== activeWorkspaceId)
      throw new Error('Return to the bank receipt workspace before continuing.');
  };

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
    setDisplayName((current) => current || fullName);
    setError(null);
    setNotice(null);
    setStagedSync(null);
    if (!networkEnabled) {
      setRemote(null);
      setBusy(null);
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
  }, [activeWorkspaceId, getToken, networkEnabled, onStatusChange, fullName, visible]);

  useEffect(() => {
    if (!visible) return;
    const pending =
      bankImportInbox.find((batch) => batch.id === selectedBatchId) ?? bankImportInbox[0];
    setStagedSync(pending?.sync ?? null);
    setSelectedBatchId(pending?.id ?? null);
    setAccountMappings(pending?.accountMappings ?? {});
  }, [bankImportInbox, selectedBatchId, visible]);

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
    if (!networkEnabled) return;
    if (!email) {
      setError('Your signed-in account needs a verified email before a bank can be connected.');
      return;
    }
    if (!beginOperation('connect')) return;
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
      endOperation();
    }
  };

  const sync = async (connection: OpenBankingRuntimeConnection) => {
    if (!networkEnabled || !beginOperation('sync')) return;
    setError(null);
    setNotice(null);
    setStagedSync(null);
    try {
      const result = await syncOpenBankingConnection(
        await tokenOrThrow(getToken),
        activeWorkspaceId,
        connection.id,
      );
      assertWorkspace();
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
      if (result.pending && result.candidates.length === 0) {
        setNotice(
          'The bank is still preparing this refresh. Its progress is saved; refresh again shortly.',
        );
        return;
      }
      if (result.deliveryId === undefined || result.connectionRevision === undefined) {
        throw new Error('The bank did not provide a durable receipt. Nothing was added to Melo.');
      }
      const mappings: Record<string, string> = {};
      result.connection.accounts.forEach((account, index) => {
        mappings[account.accountRef] =
          accountMappings[account.accountRef] ??
          availableLocalAccounts[index]?.id ??
          availableLocalAccounts[0]?.id ??
          DEFAULT_ACCOUNT_ID;
      });
      const saved = stageBankImportBatch({
        id: result.deliveryId,
        workspaceId: activeWorkspaceId,
        receivedAt: new Date().toISOString(),
        sync: result,
        accountMappings: mappings,
      });
      await persistCurrentStateNow(activeWorkspaceId);
      await acknowledgeOpenBankingBatch(
        await tokenOrThrow(getToken),
        activeWorkspaceId,
        connection.id,
        result.deliveryId,
        result.connectionRevision,
      );
      assertWorkspace();
      setAccountMappings(saved.accountMappings);
      setStagedSync(saved.sync);
      setSelectedBatchId(result.deliveryId);
      if (result.candidates.length === 0 && result.pending) {
        setNotice('The bank is still preparing this refresh. Try again in a moment.');
      } else if (result.candidates.length === 0) {
        setNotice('The bank returned no new rows for this period. Your local data is unchanged.');
      }
    } catch (reason: unknown) {
      setError(messageFor(reason));
    } finally {
      endOperation();
    }
  };

  const staged = useMemo(
    () =>
      stagedSync === null
        ? null
        : stageBankCandidatesForReview({
            sync: {
              ...stagedSync,
              candidates: stagedSync.candidates.filter(
                (row) => !settledExternalIds.has(row.externalId),
              ),
            },
            accountMappings,
          }),
    [accountMappings, stagedSync, settledExternalIds],
  );

  const sendToReview = async () => {
    if (staged === null || staged.reviewItems.length === 0 || !beginOperation('queue')) return;
    try {
      assertWorkspace();
      if (selectedBatchId !== null) setBankImportBatchMappings(selectedBatchId, accountMappings);
      enqueueReviewItems([...staged.reviewItems]);
      await persistCurrentStateNow(activeWorkspaceId);
      assertWorkspace();
      onClose();
      onReview();
    } catch (reason: unknown) {
      setError(messageFor(reason));
    } finally {
      endOperation();
    }
  };

  const cycleMapping = async (accountRef: string) => {
    if (availableLocalAccounts.length < 2) return;
    const currentId = accountMappings[accountRef];
    const index = availableLocalAccounts.findIndex((account) => account.id === currentId);
    const next = availableLocalAccounts[(index + 1) % availableLocalAccounts.length];
    if (next === undefined || !beginOperation('queue')) return;
    const mappings = { ...accountMappings, [accountRef]: next.id };
    try {
      assertWorkspace();
      if (selectedBatchId !== null) setBankImportBatchMappings(selectedBatchId, mappings);
      await persistCurrentStateNow(activeWorkspaceId);
      assertWorkspace();
      setAccountMappings(mappings);
    } catch (reason: unknown) {
      setError(messageFor(reason));
    } finally {
      endOperation();
    }
  };

  const disconnect = (connection: OpenBankingRuntimeConnection) => {
    if (!networkEnabled || busy !== null) return;
    Alert.alert(
      'Disconnect this bank?',
      'Melo will delete its server-side connection identifier and stop future refreshes. Already accepted rows on this phone are a separate choice. TrueLayer Data v3 does not currently give Melo an API that can claim the bank-side consent itself was revoked.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect Melo',
          style: 'destructive',
          onPress: () => {
            if (!beginOperation('disconnect')) return;
            setError(null);
            void tokenOrThrow(getToken)
              .then((token) =>
                disconnectOpenBankingConnection(token, activeWorkspaceId, connection.id),
              )
              .then(async () => {
                assertWorkspace();
                await refreshConnections();
                Alert.alert(
                  'Keep imported history?',
                  'The bank is disconnected from Melo. Rows already accepted on this phone can stay, or be removed separately now.',
                  [
                    { text: 'Keep history', style: 'cancel' },
                    {
                      text: 'Remove bank history',
                      style: 'destructive',
                      onPress: async () => {
                        if (!beginOperation('queue')) return;
                        try {
                          assertWorkspace();
                          const deleted = deleteBankImportedHistory(connection.id);
                          await persistCurrentStateNow(activeWorkspaceId);
                          assertWorkspace();
                          setNotice(
                            `Removed ${deleted.deletedTransactions} accepted and ${deleted.deletedReviewItems} waiting bank ${deleted.deletedTransactions + deleted.deletedReviewItems === 1 ? 'row' : 'rows'} from this device.`,
                          );
                        } catch (reason: unknown) {
                          setError(messageFor(reason));
                        } finally {
                          endOperation();
                        }
                      },
                    },
                  ],
                );
              })
              .catch((reason: unknown) => setError(messageFor(reason)))
              .finally(endOperation);
          },
        },
      ],
    );
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

        {!isOpenBankingEnabled() || !isClerkConfigured() ? (
          <Text style={[styles.sectionBody, { color: t.muted }]}>
            New bank connections are not available in this build. Your saved receipts below remain
            available offline, without signing in.
          </Text>
        ) : !isSignedIn ? (
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
              <Text style={[styles.primaryLabel, { color: t.inverse }]}>Sign in to continue</Text>
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

        {networkEnabled && remote?.providerConfigured
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

        {networkEnabled &&
        remote?.providerConfigured &&
        (showConnectForm || currentConnection === null) ? (
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
              <Text style={[styles.primaryLabel, { color: t.inverse }]}>
                {busy === 'connect' ? 'Opening TrueLayer…' : 'Continue to bank selection'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {networkEnabled &&
        remote?.providerConfigured &&
        currentConnection !== null &&
        !showConnectForm ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowConnectForm(true)}
            style={styles.textButton}
          >
            <Text style={[styles.textButtonLabel, { color: t.muted }]}>Connect another bank</Text>
          </Pressable>
        ) : null}

        {bankImportInbox.filter((batch) => batch.sync.candidates.length > 0).length > 0 ? (
          <View style={styles.reviewSection}>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>
              Bank receipts waiting for your decision
            </Text>
            <Text style={[styles.sectionBody, { color: t.muted }]}>
              These encrypted receipts stay on this phone until you send their rows to Review or
              explicitly discard them.
            </Text>
            {bankImportInbox
              .filter((batch) => batch.sync.candidates.length > 0)
              .map((batch) => (
                <Pressable
                  accessibilityRole="button"
                  key={batch.id}
                  onPress={() => {
                    if (operationRef.current) return;
                    setSelectedBatchId(batch.id);
                    setStagedSync(batch.sync);
                    setAccountMappings(batch.accountMappings);
                  }}
                  style={[
                    styles.mappingRow,
                    { borderColor: batch.id === selectedBatchId ? t.calm : t.hairline },
                  ]}
                >
                  <View style={styles.mappingText}>
                    <Text style={[styles.mappingBank, { color: t.ink }]}>
                      {
                        batch.sync.candidates.filter(
                          (row) => !settledExternalIds.has(row.externalId),
                        ).length
                      }{' '}
                      undecided rows
                    </Text>
                    <Text style={[styles.mappingLocal, { color: t.muted }]}>
                      {new Date(batch.receivedAt).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={[styles.mappingChange, { color: t.calm }]}>
                    {batch.id === selectedBatchId ? 'Selected' : 'Open'}
                  </Text>
                </Pressable>
              ))}
          </View>
        ) : null}

        {stagedSync !== null && staged !== null && stagedSync.candidates.length > 0 ? (
          <View style={styles.reviewSection}>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>
              Choose where each account lands
            </Text>
            <Text style={[styles.sectionBody, { color: t.muted }]}>
              Nothing below counts yet. Choose a Melo account, then send the bank rows into the
              normal Review queue.
            </Text>
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
                  onPress={() => void cycleMapping(bankAccount.accountRef)}
                  style={[styles.mappingRow, { borderColor: t.hairline }]}
                >
                  <View style={styles.mappingText}>
                    <Text style={[styles.mappingBank, { color: t.ink }]}>{bankAccount.label}</Text>
                    <Text style={[styles.mappingLocal, { color: t.muted }]}>
                      Add to {local?.name ?? 'Main'} · {bankAccount.currency}
                    </Text>
                  </View>
                  {availableLocalAccounts.length > 1 ? (
                    <Text style={[styles.mappingChange, { color: t.calm }]}>Change</Text>
                  ) : null}
                </Pressable>
              );
            })}
            <Text style={[styles.stageCount, { color: t.muted }]}>
              {staged.reviewItems.length} ready for Review
              {staged.unsupportedCurrencyCount > 0
                ? ` · ${staged.unsupportedCurrencyCount} non-GBP ${staged.unsupportedCurrencyCount === 1 ? 'row' : 'rows'} left out`
                : ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: staged.reviewItems.length === 0 || busy !== null }}
              disabled={staged.reviewItems.length === 0 || busy !== null}
              onPress={() => void sendToReview()}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: t.calm,
                  opacity: staged.reviewItems.length === 0 || busy !== null ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[styles.primaryLabel, { color: t.inverse }]}>Send to Review</Text>
            </Pressable>
            {selectedBatchId !== null ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy !== null}
                onPress={() => {
                  Alert.alert(
                    'Discard this bank receipt?',
                    'These rows will not be added to Melo and the receipt will no longer be available for Review.',
                    [
                      { text: 'Keep receipt', style: 'cancel' },
                      {
                        text: 'Discard rows',
                        style: 'destructive',
                        onPress: async () => {
                          if (!beginOperation('queue')) return;
                          try {
                            assertWorkspace();
                            discardBankImportBatch(selectedBatchId);
                            await persistCurrentStateNow(activeWorkspaceId);
                            setStagedSync(null);
                            setSelectedBatchId(null);
                          } catch (reason: unknown) {
                            setError(messageFor(reason));
                          } finally {
                            endOperation();
                          }
                        },
                      },
                    ],
                  );
                }}
                style={styles.textButton}
              >
                <Text style={[styles.textButtonLabel, { color: t.repairInk }]}>
                  Discard receipt
                </Text>
              </Pressable>
            ) : null}
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
          {busy === 'sync' ? 'Checking bank…' : 'Check for bank rows'}
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
