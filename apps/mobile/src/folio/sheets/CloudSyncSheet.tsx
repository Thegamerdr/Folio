import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Share, Text, TextInput, View } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import type { CloudSyncDevice } from '@folio/sync';
import { Sheet, Surface, gap, useTheme } from '@/folio/theme';
import { getState, useAppStore } from '@/folio/store';
import { isClerkConfigured } from '@/folio/lib/clerkAuth';
import {
  approveCloudSyncDevice,
  authenticatedCloudSyncApi,
  ensureCloudSyncEnrollment,
  getCloudSyncDeviceId,
  getCloudSyncProjection,
  resolveCloudSyncConflict,
  revokeCloudSyncDevice,
  setCloudSyncEnabled,
  syncCloudWorkspace,
  withCloudSyncWorkspaceLock,
} from '@/folio/lib/cloudSyncNative';
import {
  getOrCreateCloudSyncIdentity,
  type CloudSyncDeviceIdentity,
} from '@/folio/lib/cloudSyncSigning';
import { loadCloudSyncLocalState } from '@/folio/lib/cloudSyncLocalNative';
import type { CloudSyncLocalState } from '@/folio/lib/cloudSyncLocal';
import { loadActiveEntitlement } from '@/folio/lib/billing/entitlements';
import { parseShareableCloudSyncProjection } from '@/folio/lib/cloudSyncProjection';

type Props = { visible: boolean; onClose: () => void };
export function CloudSyncSheet(props: Props) {
  const t = useTheme();
  if (!props.visible) return null;
  if (!isClerkConfigured())
    return (
      <Sheet {...props}>
        <Text style={{ color: t.muted }}>
          Cloud sync is not configured in this build. Your local workspace remains available.
        </Text>
      </Sheet>
    );
  return <ConnectedCloudSyncSheet {...props} />;
}

function ConnectedCloudSyncSheet({ visible, onClose }: Props) {
  const t = useTheme();
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const workspaceId = useAppStore((state) => state.activeWorkspaceId);
  const [local, setLocal] = useState<CloudSyncLocalState | null>(null);
  const [identity, setIdentity] = useState<CloudSyncDeviceIdentity | null>(null);
  const [devices, setDevices] = useState<readonly CloudSyncDevice[]>([]);
  const [approvalText, setApprovalText] = useState('');
  const [trusted, setTrusted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Sync is optional. Local money stays available offline.');
  const [detailId, setDetailId] = useState<string | null>(null);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const scopeRef = useRef('');
  const scope = String(workspaceId) + ':' + (user?.id ?? '') + ':' + visible;
  scopeRef.current = scope;
  useEffect(() => {
    const requested = ++generation.current;
    let mounted = true;
    setLocal(null);
    setDevices([]);
    setIdentity(null);
    setTrusted(false);
    setDetailId(null);
    void loadCloudSyncLocalState(workspaceId)
      .then((saved) => {
        if (mounted && requested === generation.current) setLocal(saved);
      })
      .catch((reason: unknown) => {
        if (mounted) setMessage(errorMessage(reason));
      });
    return () => {
      mounted = false;
      generation.current += 1;
    };
  }, [workspaceId, user?.id, visible]);

  const action = async (work: (current: () => boolean) => Promise<string>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const requested = generation.current;
    const current = () =>
      requested === generation.current &&
      scopeRef.current === scope &&
      getState().activeWorkspaceId === workspaceId;
    try {
      const notice = await work(current);
      const saved = await loadCloudSyncLocalState(workspaceId);
      if (current()) {
        setLocal(saved);
        setMessage(notice);
      }
    } catch (reason) {
      if (current()) setMessage(errorMessage(reason));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const tokenFor = async (current: () => boolean) => {
    if (!isSignedIn) throw new Error('Sign in before connecting this workspace to sync.');
    const token = await getToken();
    if (!token || !current()) throw new Error('Sign in or workspace changed. Try again.');
    return token;
  };
  const inspect = async (token: string, current: () => boolean) => {
    await withCloudSyncWorkspaceLock(workspaceId, async () => {
      if (!current()) return;
      const enrollment = await ensureCloudSyncEnrollment(workspaceId, token);
      const publicIdentity = await getOrCreateCloudSyncIdentity(enrollment.deviceId);
      if (!current()) return;
      setIdentity(publicIdentity);
      setTrusted(enrollment.status === 'active');
      if (enrollment.status === 'active') {
        const api = await authenticatedCloudSyncApi(workspaceId, token);
        const registry = await api.listDevices();
        if (current()) setDevices(registry.devices);
      }
    });
  };
  const toggle = () =>
    void action(async (current) => {
      if (local?.enabled) {
        await setCloudSyncEnabled(workspaceId, null, false);
        return 'Sync is paused on this phone. Local data and queued changes are kept.';
      }
      const token = await tokenFor(current);
      if ((await loadActiveEntitlement('live')) === null)
        throw new Error('Cloud sync needs an active Melo Live subscription.');
      if (!current()) throw new Error('The selected account changed.');
      await setCloudSyncEnabled(workspaceId, token, true);
      await inspect(token, current);
      return 'This workspace is linked to your account. Tap Sync now to review existing cloud history or send its first encrypted copy.';
    });
  const syncNow = () =>
    void action(async (current) => {
      const token = await tokenFor(current);
      if ((await loadActiveEntitlement('live')) === null)
        throw new Error('Cloud sync needs an active Melo Live subscription.');
      const result = await syncCloudWorkspace(workspaceId, token, current);
      await inspect(token, current);
      return result.pendingApproval
        ? 'This phone needs approval from an existing trusted phone. Share its public identity below.'
        : result.conflicts
          ? 'Both versions are saved. Review the differences below before choosing.'
          : result.hasMore
            ? 'Progress saved. More changes will continue in the background.'
            : 'Sync is up to date for this workspace.';
    });
  const approve = () =>
    void action(async (current) => {
      const token = await tokenFor(current);
      let input: CloudSyncDeviceIdentity;
      try {
        input = JSON.parse(approvalText) as CloudSyncDeviceIdentity;
      } catch {
        throw new Error('Paste the complete public identity shared by the new phone.');
      }
      if (
        !input ||
        typeof input.deviceId !== 'string' ||
        typeof input.publicKey !== 'string' ||
        typeof input.publicKeyFingerprint !== 'string'
      )
        throw new Error('The shared identity is incomplete.');
      await withCloudSyncWorkspaceLock(workspaceId, async () => {
        if (!current()) throw new Error('The selected account changed.');
        await approveCloudSyncDevice({
          workspaceId,
          bearerToken: token,
          deviceId: input.deviceId,
          publicKey: input.publicKey,
          publicKeyFingerprint: input.publicKeyFingerprint,
          label: 'Trusted phone',
        });
      });
      if (current()) setApprovalText('');
      await inspect(token, current);
      return 'The phone is approved. It can now recover this workspace’s sync key.';
    });
  const revoke = (device: CloudSyncDevice) =>
    Alert.alert(
      'Remove this trusted phone?',
      'It will not receive future sync keys. Copies already on that phone cannot be remotely erased.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove phone',
          style: 'destructive',
          onPress: () =>
            void action(async (current) => {
              const token = await tokenFor(current);
              await withCloudSyncWorkspaceLock(workspaceId, async () => {
                if (!current()) throw new Error('The selected account changed.');
                await revokeCloudSyncDevice({
                  workspaceId,
                  bearerToken: token,
                  deviceId: device.deviceId,
                });
              });
              await inspect(token, current);
              return 'Phone removed and future sync keys rotated.';
            }),
        },
      ],
    );
  const choose = (conflictId: string, choice: 'local' | 'remote') =>
    Alert.alert(
      'Use this workspace version?',
      'This resolves the saved conflicts and replaces any unsent changes with the selected version. Other local workspaces stay unchanged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: choice === 'local' ? 'Use this phone' : 'Use received version',
          onPress: () =>
            void action(async (current) => {
              await resolveCloudSyncConflict(workspaceId, conflictId, choice, current);
              return 'Your choice is saved. Tap Sync now to send any resulting change.';
            }),
        },
      ],
    );
  const shareVersions = (remoteState: string) =>
    void Share.share({
      title: 'Melo sync versions',
      message: JSON.stringify(
        {
          thisPhone: parseShareableCloudSyncProjection(getCloudSyncProjection(workspaceId)).state,
          received: JSON.parse(remoteState),
        },
        null,
        2,
      ),
    }).catch(() => setMessage('The versions could not be shared.'));
  const button = (label: string, onPress: () => void, disabled = busy) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
    >
      <Text style={{ color: t.calm, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
  const card = { padding: gap.md, gap: gap.sm, borderColor: t.hairline };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ gap: gap.md }}>
        <Text style={{ color: t.ink, fontSize: 24, fontWeight: '600' }}>Sync this workspace</Text>
        <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>
          Encrypted money records sync between trusted phones. Sign-in, purchases, bank consent and
          original attachments stay separate on each device.
        </Text>
        <Surface style={card}>
          <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600' }}>
            {local?.enabled ? 'Sync is on' : 'Sync is paused'}
          </Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {(local?.outbox.length ?? 0) + (local?.pendingDeltas.length ?? 0)} queued changes ·{' '}
            {local?.conflictRecords.length ?? 0} decisions
          </Text>
          {button(local?.enabled ? 'Pause sync' : 'Enable sync', toggle)}
          {local?.enabled && isSignedIn ? button('Sync now', syncNow) : null}
        </Surface>
        {identity ? (
          <Surface style={card}>
            <Text style={{ color: t.ink, fontWeight: '600' }}>
              {trusted ? 'This phone is trusted' : 'Approve this phone from a trusted phone'}
            </Text>
            <Text style={{ color: t.muted, fontSize: 13 }}>
              Compare this fingerprint directly with the other phone before approving. Only the
              public identity is shared.
            </Text>
            <Text selectable style={{ color: t.ink, fontSize: 12 }}>
              {identity.publicKeyFingerprint}
            </Text>
            {button(
              'Share this phone’s public identity',
              () =>
                void Share.share({
                  message: JSON.stringify(identity),
                  title: 'Melo public phone identity',
                }).catch(() => setMessage('The public identity could not be shared.')),
            )}
          </Surface>
        ) : null}
        {trusted ? (
          <Surface style={card}>
            <Text style={{ color: t.ink, fontWeight: '600' }}>Trusted phones</Text>
            {devices
              .filter(
                (device) =>
                  device.revokedAt === undefined && device.deviceId !== identity?.deviceId,
              )
              .map((device) => (
                <View key={device.deviceId}>
                  <Text selectable style={{ color: t.muted, fontSize: 12 }}>
                    {device.label} · {device.publicKeyFingerprint}
                  </Text>
                  {button('Remove this phone', () => revoke(device))}
                </View>
              ))}
            <Text style={{ color: t.muted, fontSize: 13 }}>
              Paste the new phone’s public identity. Check its fingerprint before approving.
            </Text>
            <TextInput
              accessibilityLabel="Public identity of the new phone"
              value={approvalText}
              onChangeText={setApprovalText}
              multiline
              autoCorrect={false}
              autoCapitalize="none"
              placeholder="Public identity JSON"
              placeholderTextColor={t.muted}
              style={{
                minHeight: 60,
                color: t.ink,
                fontSize: 13,
                borderWidth: 1,
                borderColor: t.hairline,
                padding: gap.sm,
              }}
            />
            {button('I compared the fingerprint — approve', approve, busy || !approvalText.trim())}
          </Surface>
        ) : null}
        {local?.conflictRecords.map((conflict) => {
          const current = parseShareableCloudSyncProjection(
            getCloudSyncProjection(workspaceId),
          ).state;
          const received = JSON.parse(conflict.remoteState) as Record<string, unknown>;
          const keys = [...new Set([...Object.keys(current), ...Object.keys(received)])].filter(
            (key) => JSON.stringify(current[key]) !== JSON.stringify(received[key]),
          );
          return (
            <Surface key={conflict.id} style={card}>
              <Text style={{ color: t.ink, fontSize: 16, fontWeight: '600' }}>
                Choose a workspace version
              </Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>
                {keys.length} fields differ. Neither version has been silently discarded.
              </Text>
              {keys.slice(0, detailId === conflict.id ? 12 : 3).map((key) => (
                <View key={key} style={{ gap: 4 }}>
                  <Text style={{ color: t.ink, fontSize: 13, fontWeight: '600' }}>
                    {key.replace(/([A-Z])/g, ' $1')}
                  </Text>
                  <Text selectable style={{ color: t.muted, fontSize: 12 }}>
                    This phone: {previewValue(current[key])}
                  </Text>
                  <Text selectable style={{ color: t.muted, fontSize: 12 }}>
                    Received: {previewValue(received[key])}
                  </Text>
                </View>
              ))}
              {button(
                detailId === conflict.id ? 'Show fewer differences' : 'Show more differences',
                () => setDetailId(detailId === conflict.id ? null : conflict.id),
              )}
              <Text style={{ color: t.muted, fontSize: 12 }}>
                Large fields are shortened here. Export both complete versions to inspect every
                record.
              </Text>
              {button('Export both versions for review', () => shareVersions(conflict.remoteState))}
              {button('Use this phone’s version', () => choose(conflict.id, 'local'))}
              {button('Use received version', () => choose(conflict.id, 'remote'))}
            </Surface>
          );
        })}
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: t.muted, fontSize: 13, lineHeight: 19 }}
        >
          {busy ? 'Saving and checking…' : message}
        </Text>
      </View>
    </Sheet>
  );
}
function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Sync is unavailable. Your local data is kept.';
}
function previewValue(value: unknown): string {
  if (value === undefined) return 'not present';
  const text = JSON.stringify(value);
  return text.length <= 240 ? text : text.slice(0, 240) + '… (shortened)';
}
