import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';

import { gap, radius, serif, Sheet, Surface, useTheme } from '@/folio/theme';
import { useAppStore } from '@/folio/store';
import { showStatusDialog } from '@/folio/ui/statusDialogs';
import {
  applyCloudRestore,
  createCloudBackup,
  deleteCloudBackup,
  fetchCloudBackupCatalog,
  fetchCloudBackupStatus,
  hasCloudRecoveryCode,
  stageCloudRestore,
  stageDiscoveredCloudRestore,
  type CloudBackupCatalogEntry,
  type CloudBackupStatus,
  type StagedCloudRestore,
} from '@/folio/lib/cloudBackupNative';

export type CloudBackupSheetProps = Readonly<{
  visible: boolean;
  onClose: () => void;
}>;

export function CloudBackupSheet({ visible, onClose }: CloudBackupSheetProps) {
  const t = useTheme();
  const { getToken } = useAuth();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const [status, setStatus] = useState<CloudBackupStatus | null>(null);
  const [hasLocalCode, setHasLocalCode] = useState(false);
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<'loading' | 'backup' | 'restore' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<readonly CloudBackupCatalogEntry[]>([]);

  useEffect(() => {
    if (!visible) return;
    let current = true;
    setBusy('loading');
    setError(null);
    setNotice(null);
    setNewRecoveryCode(null);
    setCatalog([]);
    void Promise.all([tokenOrThrow(getToken), hasCloudRecoveryCode(activeWorkspaceId)])
      .then(async ([token, localCode]) => {
        const remote = await fetchCloudBackupStatus(activeWorkspaceId, token);
        if (!current) return;
        setStatus(remote);
        setHasLocalCode(localCode);
        setShowCodeEntry(!localCode && remote.exists);
      })
      .catch((reason: unknown) => {
        if (current) setError(messageFor(reason));
      })
      .finally(() => {
        if (current) setBusy(null);
      });
    return () => {
      current = false;
    };
  }, [activeWorkspaceId, getToken, visible]);

  const backUp = async (rotateRecoveryCode = false) => {
    if (busy !== null) return;
    setBusy('backup');
    setError(null);
    setNotice(null);
    try {
      const result = await createCloudBackup(activeWorkspaceId, await tokenOrThrow(getToken), {
        rotateRecoveryCode,
      });
      setStatus(result.status);
      setHasLocalCode(true);
      setShowCodeEntry(false);
      setEnteredCode('');
      setNewRecoveryCode(result.newRecoveryCode);
      setNotice(
        result.newRecoveryCode === null
          ? 'Backup updated. Your data was encrypted before leaving this device.'
          : null,
      );
    } catch (reason: unknown) {
      setError(messageFor(reason));
    } finally {
      setBusy(null);
    }
  };

  const prepareRestore = async (generation: 'current' | 'previous' | 'anchor' = 'current') => {
    if (busy !== null) return;
    setBusy('restore');
    setError(null);
    setNotice(null);
    try {
      const supplied = enteredCode.trim().length > 0 ? enteredCode : undefined;
      const staged = await stageCloudRestore(
        activeWorkspaceId,
        await tokenOrThrow(getToken),
        supplied,
        { generation },
      );
      setBusy(null);
      confirmRestore(staged, async () => {
        setBusy('restore');
        try {
          const applied = await applyCloudRestore(activeWorkspaceId, staged);
          if (applied.degraded) {
            setError(
              'The backup opened, but its data could not be loaded safely. Nothing was claimed as restored.',
            );
            return;
          }
          showStatusDialog('dialog.cloud-backup-restore-succeeded', { onDone: onClose });
        } catch (reason: unknown) {
          setError(messageFor(reason));
        } finally {
          setBusy(null);
        }
      });
    } catch (reason: unknown) {
      setError(messageFor(reason));
      setBusy(null);
    }
  };

  const findBackups = async () => {
    if (busy !== null) return;
    setBusy('loading');
    setError(null);
    try {
      setCatalog(await fetchCloudBackupCatalog(await tokenOrThrow(getToken)));
      setNotice('Only encrypted references are listed. Workspace names stay inside each backup.');
    } catch (reason: unknown) {
      setError(messageFor(reason));
    } finally {
      setBusy(null);
    }
  };

  const prepareDiscoveredRestore = async (
    entry: CloudBackupCatalogEntry,
    generation: 'current' | 'previous' | 'anchor' = 'current',
  ) => {
    if (busy !== null) return;
    setBusy('restore');
    setError(null);
    try {
      const code = enteredCode.trim();
      if (code.length === 0) throw new Error('Enter the recovery code for this backup first.');
      const staged = await stageDiscoveredCloudRestore(
        entry.workspaceRef,
        await tokenOrThrow(getToken),
        code,
        { generation },
      );
      setBusy(null);
      confirmRestore(staged, async () => {
        setBusy('restore');
        try {
          const applied = await applyCloudRestore(staged.workspaceId, staged);
          if (applied.degraded) {
            setError('The backup opened, but its data could not be loaded safely.');
            return;
          }
          showStatusDialog('dialog.cloud-backup-restore-succeeded', { onDone: onClose });
        } catch (reason: unknown) {
          setError(messageFor(reason));
        } finally {
          setBusy(null);
        }
      });
    } catch (reason: unknown) {
      setError(messageFor(reason));
      setBusy(null);
    }
  };

  const confirmDelete = () => {
    if (busy !== null) return;
    Alert.alert(
      'Delete cloud backup?',
      'The encrypted cloud copy will be deleted. Everything on this device stays here.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete backup',
          style: 'destructive',
          onPress: () => {
            setBusy('delete');
            setError(null);
            void tokenOrThrow(getToken)
              .then((token) => deleteCloudBackup(activeWorkspaceId, token))
              .then(() => {
                setStatus({ exists: false });
                setNotice('Cloud backup deleted. Your local Melo data is unchanged.');
              })
              .catch((reason: unknown) => setError(messageFor(reason)))
              .finally(() => setBusy(null));
          },
        },
      ],
    );
  };

  const statusLine =
    status === null
      ? 'Checking this account…'
      : status.exists
        ? `Last backup ${formatBackupDate(status.createdAt)} · ${status.generations} ${status.generations === 1 ? 'generation' : 'generations'}`
        : 'No encrypted cloud backup yet.';

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <Text style={[styles.eyebrow, { color: t.muted }]}>Encrypted backup</Text>
        <Text style={[styles.headline, { color: t.ink }]}>A copy Melo cannot read.</Text>
        <Text style={[styles.subline, { color: t.muted }]}>
          Your sign-in finds the backup. Your separate recovery code opens it. Keep that code
          somewhere outside this phone.
        </Text>

        <Surface style={[styles.statusCard, { borderColor: t.hairline, backgroundColor: t.inset }]}>
          <View
            style={[styles.statusDot, { backgroundColor: status?.exists ? t.positive : t.muted }]}
          />
          <Text style={[styles.statusText, { color: t.ink }]}>{statusLine}</Text>
        </Surface>

        {newRecoveryCode !== null ? (
          <View style={[styles.recoveryCard, { backgroundColor: t.warmSoft, borderColor: t.warm }]}>
            <Text style={[styles.recoveryTitle, { color: t.ink }]}>
              Store this recovery code now
            </Text>
            <Text style={[styles.recoveryBody, { color: t.secondary }]}>
              Melo will not show this code again. Without it, signing in on a new phone cannot
              decrypt this backup.
            </Text>
            <Text
              // Never expose the recovery secret to TalkBack/VoiceOver speech or diagnostic
              // snapshots. The code remains selectable for a deliberate long-press copy, while
              // the surrounding instructions tell a screen-reader user to keep it private.
              accessibilityLabel="Recovery code. Keep this code private. Long-press to select and copy."
              accessibilityRole="text"
              selectable
              style={[styles.recoveryCode, { color: t.ink, backgroundColor: t.surface }]}
            >
              {newRecoveryCode}
            </Text>
            <Text style={[styles.selectHint, { color: t.muted }]}>
              Long-press the code to select and copy it.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setNewRecoveryCode(null)}
              style={[styles.secondaryButton, { borderColor: t.hairlineStrong }]}
            >
              <Text style={[styles.secondaryLabel, { color: t.ink }]}>I stored it safely</Text>
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
          accessibilityRole="button"
          accessibilityState={{ disabled: busy !== null }}
          disabled={busy !== null}
          onPress={() => void backUp(false)}
          style={[
            styles.primaryButton,
            { backgroundColor: t.calm, opacity: busy !== null ? 0.55 : 1 },
          ]}
        >
          <Text style={[styles.primaryLabel, { color: t.inverse }]}>
            {busy === 'backup'
              ? 'Encrypting & checking…'
              : status?.exists
                ? 'Back up now'
                : 'Create encrypted backup'}
          </Text>
        </Pressable>

        {status?.exists ? (
          <View style={styles.restoreSection}>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>Restore on this device</Text>
            <Text style={[styles.sectionBody, { color: t.muted }]}>
              Melo downloads and decrypts the copy locally, then shows what it found before
              replacing anything.
            </Text>

            {showCodeEntry ? (
              <TextInput
                accessibilityLabel="Cloud backup recovery code"
                autoCapitalize="characters"
                autoCorrect={false}
                multiline
                onChangeText={setEnteredCode}
                placeholder="XXXXXXXX-XXXXXXXX-…"
                placeholderTextColor={t.muted}
                style={[
                  styles.codeInput,
                  { color: t.ink, backgroundColor: t.inset, borderColor: t.hairline },
                ]}
                value={enteredCode}
              />
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy !== null }}
              disabled={busy !== null}
              onPress={() => void prepareRestore()}
              style={[styles.secondaryButton, { borderColor: t.hairlineStrong }]}
            >
              <Text style={[styles.secondaryLabel, { color: t.ink }]}>
                {busy === 'restore' ? 'Opening backup…' : 'Review backup to restore'}
              </Text>
            </Pressable>

            {status.previousGeneration !== null && status.previousGeneration !== undefined ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy !== null }}
                disabled={busy !== null}
                onPress={() => void prepareRestore('previous')}
                style={styles.textButton}
              >
                <Text style={[styles.textButtonLabel, { color: t.muted }]}>
                  Review previous backup generation
                </Text>
              </Pressable>
            ) : null}
            {status.anchorGeneration !== null && status.anchorGeneration !== undefined ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy !== null }}
                disabled={busy !== null}
                onPress={() => void prepareRestore('anchor')}
                style={styles.textButton}
              >
                <Text style={[styles.textButtonLabel, { color: t.muted }]}>
                  Review old-key backup anchor
                </Text>
              </Pressable>
            ) : null}

            {hasLocalCode && !showCodeEntry ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowCodeEntry(true)}
                style={styles.textButton}
              >
                <Text style={[styles.textButtonLabel, { color: t.muted }]}>
                  Use a recovery code from another device
                </Text>
              </Pressable>
            ) : null}
            {showCodeEntry && hasLocalCode ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setShowCodeEntry(false);
                  setEnteredCode('');
                }}
                style={styles.textButton}
              >
                <Text style={[styles.textButtonLabel, { color: t.muted }]}>
                  Use this device’s stored code
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                Alert.alert(
                  'Replace recovery code?',
                  'Melo will create a new code and immediately re-encrypt the latest backup. Store the new code when it appears.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Replace code', onPress: () => void backUp(true) },
                  ],
                )
              }
              style={styles.textButton}
            >
              <Text style={[styles.textButtonLabel, { color: t.muted }]}>
                Replace recovery code
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.textButton}>
              <Text style={[styles.textButtonLabel, { color: t.repairInk }]}>
                Delete cloud backup
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.discoverySection}>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>Recover another workspace</Text>
          <Text style={[styles.sectionBody, { color: t.muted }]}>
            On a clean phone, find encrypted backups linked to this account, then open one with its
            recovery code.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy !== null }}
            disabled={busy !== null}
            onPress={() => void findBackups()}
            style={[styles.secondaryButton, { borderColor: t.hairlineStrong }]}
          >
            <Text style={[styles.secondaryLabel, { color: t.ink }]}>
              {busy === 'loading' ? 'Finding encrypted backups…' : 'Find encrypted backups'}
            </Text>
          </Pressable>
          {catalog.length > 0 ? (
            <>
              <TextInput
                accessibilityLabel="Recovery code for discovered cloud backup"
                autoCapitalize="characters"
                autoCorrect={false}
                multiline
                onChangeText={setEnteredCode}
                placeholder="Recovery code"
                placeholderTextColor={t.muted}
                style={[
                  styles.codeInput,
                  { color: t.ink, backgroundColor: t.inset, borderColor: t.hairline },
                ]}
                value={enteredCode}
              />
              {catalog.map((entry) => (
                <View key={`${entry.workspaceRef}:${entry.generation}`} style={styles.catalogRow}>
                  <Text style={[styles.catalogLabel, { color: t.ink }]}>
                    Encrypted workspace · {formatBackupDate(entry.createdAt)} · generation{' '}
                    {entry.generation}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: busy !== null }}
                    disabled={busy !== null}
                    onPress={() => void prepareDiscoveredRestore(entry)}
                    style={[styles.textButton, styles.catalogAction]}
                  >
                    <Text style={[styles.textButtonLabel, { color: t.calm }]}>
                      Review this backup
                    </Text>
                  </Pressable>
                  {entry.previousGeneration !== null ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: busy !== null }}
                      disabled={busy !== null}
                      onPress={() => void prepareDiscoveredRestore(entry, 'previous')}
                      style={[styles.textButton, styles.catalogAction]}
                    >
                      <Text style={[styles.textButtonLabel, { color: t.muted }]}>
                        Review previous generation
                      </Text>
                    </Pressable>
                  ) : null}
                  {entry.anchorGeneration !== null ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: busy !== null }}
                      disabled={busy !== null}
                      onPress={() => void prepareDiscoveredRestore(entry, 'anchor')}
                      style={[styles.textButton, styles.catalogAction]}
                    >
                      <Text style={[styles.textButtonLabel, { color: t.muted }]}>
                        Review old-key anchor
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </>
          ) : null}
        </View>

        <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
          <Text style={[styles.closeLabel, { color: t.muted }]}>Close</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

async function tokenOrThrow(getToken: () => Promise<string | null>): Promise<string> {
  const token = await getToken();
  if (token === null || token.length === 0)
    throw new Error('Sign in again before using cloud backup.');
  return token;
}

function confirmRestore(staged: StagedCloudRestore, apply: () => void) {
  const owner = staged.summary.name === null ? '' : ` for ${staged.summary.name}`;
  const parsed = JSON.parse(staged.rawState) as { workspaces?: { id?: unknown; name?: unknown }[] };
  const recovered = Array.isArray(parsed.workspaces)
    ? parsed.workspaces.find((item) => item?.id === staged.workspaceId)
    : undefined;
  const label = typeof recovered?.name === 'string' ? recovered.name : 'this workspace';
  Alert.alert(
    `Restore ${label}?`,
    `Backup${owner} from ${formatBackupDate(staged.createdAt)}. ${staged.summary.transactions} transactions, ${staged.summary.subs} subscriptions and ${staged.summary.pots} pots. Existing data for this workspace will be replaced. Your other workspace stays unchanged.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restore backup', style: 'destructive', onPress: apply },
    ],
  );
}

function formatBackupDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'at an unknown time';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function messageFor(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : 'Cloud backup could not complete. Your local data is unchanged.';
}

const styles = StyleSheet.create({
  body: { paddingBottom: gap.md },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  headline: { fontFamily: serif.display, fontSize: 23, lineHeight: 28, marginTop: gap.xs },
  subline: { fontFamily: serif.displayItalic, fontSize: 13, lineHeight: 19, marginTop: gap.sm },
  statusCard: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: gap.sm,
    marginTop: gap.lg,
    padding: gap.md,
  },
  statusDot: { borderRadius: 5, height: 8, width: 8 },
  statusText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  recoveryCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.md,
    padding: gap.md,
  },
  recoveryTitle: { fontFamily: serif.display, fontSize: 17 },
  recoveryBody: { fontSize: 12, lineHeight: 17, marginTop: gap.xs },
  recoveryCode: {
    borderRadius: radius.md,
    fontSize: 13,
    letterSpacing: 0.8,
    lineHeight: 21,
    marginTop: gap.md,
    padding: gap.md,
  },
  selectHint: { fontSize: 10.5, marginTop: gap.xs },
  notice: { fontSize: 12, lineHeight: 17, marginTop: gap.md },
  error: { fontSize: 12, lineHeight: 17, marginTop: gap.md },
  primaryButton: {
    alignItems: 'center',
    borderRadius: radius.lg,
    justifyContent: 'center',
    marginTop: gap.lg,
    minHeight: 50,
    paddingHorizontal: gap.md,
  },
  primaryLabel: { fontSize: 14, fontWeight: '600' },
  restoreSection: { marginTop: gap.xl },
  discoverySection: { marginTop: gap.xl },
  sectionTitle: { fontFamily: serif.display, fontSize: 18 },
  sectionBody: { fontSize: 12, lineHeight: 17, marginTop: gap.xs },
  codeInput: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 13,
    lineHeight: 20,
    marginTop: gap.md,
    minHeight: 72,
    padding: gap.md,
    textAlignVertical: 'top',
  },
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
  closeButton: { alignItems: 'center', marginTop: gap.md, paddingVertical: gap.sm },
  closeLabel: { fontSize: 13 },
  catalogRow: {
    borderTopColor: '#00000014',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: gap.md,
    paddingTop: gap.md,
  },
  catalogLabel: { fontSize: 12, lineHeight: 17 },
  catalogAction: { paddingTop: gap.sm },
});
