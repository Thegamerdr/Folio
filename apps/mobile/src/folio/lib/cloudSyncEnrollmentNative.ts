import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { base64 } from '@scure/base';
import type { WorkspaceId } from '@folio/domain';
import type { CloudSyncDevice, RegisterCloudSyncDeviceInput } from '@folio/sync';
import { getOrCreateCloudDeviceId } from './cloudBackupNative';
import { readCloudSyncPrivateKey, getOrCreateCloudSyncIdentity } from './cloudSyncSigning';
import { decryptBlob, encryptBlob, GCM_NONCE_BYTES } from './cryptoBlob';
import {
  wrapCloudSyncKey,
  unwrapCloudSyncKey,
  decodeCloudSyncBase64,
  cloudSyncTransitionAad,
  type CloudSyncKeyScope,
} from './cloudSyncKeys';
import {
  authenticatedCloudSyncApi,
  deriveCloudSyncScope,
  type CloudSyncKeyApi,
} from './cloudSyncTransportNative';

const PREFIX = 'melo.cloudSync.v2.';
const secureOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const enrollmentTails = new Map<string, Promise<void>>();
export type CloudSyncEnrollment = Readonly<{
  deviceId: string;
  enrolled: boolean;
  currentKeyEpoch: number;
  headCursor: number;
  compactedThrough: number;
  lastDeviceSequence: number;
  syncKey: Uint8Array | null;
  status: 'new' | 'pending' | 'active' | 'revoked';
}>;
type PendingRotation = {
  version: 2;
  targetId: string;
  newKeyEpoch: number;
  wrappedKeys: Record<string, string>;
  keyTransition: { fromKeyEpoch: number; toKeyEpoch: number; sealedKey: string };
};

export async function ensureCloudSyncEnrollment(
  workspaceId: WorkspaceId,
  bearerToken: string,
): Promise<CloudSyncEnrollment> {
  const scope = deriveCloudSyncScope(workspaceId, bearerToken);
  return withEnrollmentLock(scope, () => ensureUnlocked(workspaceId, bearerToken, scope));
}

async function ensureUnlocked(
  workspaceId: WorkspaceId,
  bearerToken: string,
  scope: CloudSyncKeyScope,
): Promise<CloudSyncEnrollment> {
  const api = await authenticatedCloudSyncApi(workspaceId, bearerToken);
  const deviceId = await getOrCreateCloudDeviceId();
  const identity = await getOrCreateCloudSyncIdentity(deviceId);
  const registry = await api.enrollmentStatus(identity.publicKey);
  if (
    !registry ||
    !['new', 'pending', 'active', 'revoked'].includes(registry.status) ||
    !cursor(registry.headCursor) ||
    !cursor(registry.compactedThrough) ||
    !cursor(registry.currentKeyEpoch) ||
    registry.currentKeyEpoch < 1
  )
    throw new Error('Invalid enrollment response.');
  const result = {
    deviceId,
    status: registry.status,
    currentKeyEpoch: registry.currentKeyEpoch,
    headCursor: registry.headCursor,
    compactedThrough: registry.compactedThrough,
    lastDeviceSequence: registry.device?.lastDeviceSequence ?? 0,
  };
  if (registry.status === 'revoked')
    throw new Error('This phone was removed from sync. Local money stays on this phone.');
  if (registry.status === 'pending') return { ...result, enrolled: false, syncKey: null };
  const pendingSlot = slot(scope, 'enrollment');
  if (registry.status === 'active') {
    const key = await acceptRegisteredKey(scope, registry.device, deviceId);
    await SecureStore.deleteItemAsync(pendingSlot);
    return { ...result, enrolled: true, syncKey: key };
  }
  // First enrollment is retryable. Persist the exact wrapped registration before POST;
  // a lost response is recovered from the server's own-device status, never a regenerated key.
  const existing = await SecureStore.getItemAsync(pendingSlot);
  let registration: RegisterCloudSyncDeviceInput;
  if (existing !== null) {
    const parsed: unknown = JSON.parse(existing);
    if (
      !record(parsed) ||
      parsed.deviceId !== deviceId ||
      parsed.publicKey !== identity.publicKey ||
      parsed.keyEpoch !== registry.currentKeyEpoch ||
      typeof parsed.wrappedSyncKey !== 'string'
    ) {
      throw new Error('Pending enrollment needs recovery before it can be retried.');
    }
    registration = {
      deviceId,
      publicKey: identity.publicKey,
      publicKeyFingerprint: identity.publicKeyFingerprint,
      label: 'This phone',
      keyEpoch: registry.currentKeyEpoch,
      wrappedSyncKey: parsed.wrappedSyncKey,
    };
  } else {
    const key = await random(32);
    registration = {
      deviceId,
      label: 'This phone',
      publicKey: identity.publicKey,
      publicKeyFingerprint: identity.publicKeyFingerprint,
      keyEpoch: registry.currentKeyEpoch,
      wrappedSyncKey: await wrapFor(scope, identity, registry.currentKeyEpoch, key),
    };
    await SecureStore.setItemAsync(pendingSlot, JSON.stringify(registration), secureOptions);
  }
  const registered = await api.registerDevice(registration);
  const key = await acceptRegisteredKey(scope, registered.device, deviceId);
  await SecureStore.deleteItemAsync(pendingSlot);
  return { ...result, status: 'active', enrolled: true, syncKey: key };
}

export async function approveCloudSyncDevice(input: {
  workspaceId: WorkspaceId;
  bearerToken: string;
  deviceId: string;
  label: string;
  publicKey: string;
  publicKeyFingerprint: string;
}): Promise<void> {
  const scope = deriveCloudSyncScope(input.workspaceId, input.bearerToken);
  return withEnrollmentLock(scope, async () => {
    if (
      !/^[a-f0-9]{32}$/.test(input.deviceId) ||
      input.label.trim().length === 0 ||
      input.label.trim().length > 80
    )
      throw new Error('The device approval details are invalid.');
    const enrollment = await ensureUnlocked(input.workspaceId, input.bearerToken, scope);
    if (!enrollment.enrolled || enrollment.syncKey === null)
      throw new Error('Approve this phone from a trusted device first.');
    const api = await authenticatedCloudSyncApi(input.workspaceId, input.bearerToken);
    // wrapFor checks the fingerprint against the supplied key; the owner must compare that
    // fingerprint with the new phone before pressing Approve.
    const wrappedSyncKey = await wrapFor(
      scope,
      input,
      enrollment.currentKeyEpoch,
      enrollment.syncKey,
    );
    await api.registerDevice({
      deviceId: input.deviceId,
      label: input.label.trim(),
      publicKey: input.publicKey,
      publicKeyFingerprint: input.publicKeyFingerprint,
      keyEpoch: enrollment.currentKeyEpoch,
      wrappedSyncKey,
    });
  });
}

export async function revokeCloudSyncDevice(input: {
  workspaceId: WorkspaceId;
  bearerToken: string;
  deviceId: string;
}): Promise<void> {
  const scope = deriveCloudSyncScope(input.workspaceId, input.bearerToken);
  return withEnrollmentLock(scope, async () => {
    const enrollment = await ensureUnlocked(input.workspaceId, input.bearerToken, scope);
    if (!enrollment.enrolled || enrollment.syncKey === null)
      throw new Error('Approve this phone from a trusted device first.');
    if (input.deviceId === enrollment.deviceId)
      throw new Error('A trusted phone cannot remove itself.');
    const api = await authenticatedCloudSyncApi(input.workspaceId, input.bearerToken);
    const registry = await api.listDevices();
    const target = registry.devices.find((device) => device.deviceId === input.deviceId);
    if (target === undefined) throw new Error('That phone is not registered in this workspace.');
    const pendingSlot = slot(scope, 'rotation');
    const raw = await SecureStore.getItemAsync(pendingSlot);
    let pending = raw === null ? null : parsePendingRotation(raw);
    if (pending !== null && pending.targetId !== input.deviceId)
      throw new Error('Finish the previous device removal before removing another phone.');
    if (target.revokedAt !== undefined) {
      // A previous attempt may have committed but lost its response. Current own-device key
      // plus authenticated backward history recovers every epoch before removing local intent.
      await reconcileCloudSyncKeyHistory(
        scope,
        enrollment.currentKeyEpoch,
        enrollment.syncKey,
        api,
      );
      if (pending !== null) await SecureStore.deleteItemAsync(pendingSlot);
      return;
    }
    if (registry.currentKeyEpoch !== enrollment.currentKeyEpoch)
      throw new Error('Sync keys changed. Try removing the phone again.');
    if (pending !== null && pending.newKeyEpoch !== registry.currentKeyEpoch + 1) {
      // Another trusted phone won a rotation. Recover its history before re-creating our
      // still-uncommitted request under the actual current epoch.
      await reconcileCloudSyncKeyHistory(
        scope,
        enrollment.currentKeyEpoch,
        enrollment.syncKey,
        api,
      );
      await SecureStore.deleteItemAsync(pendingSlot);
      pending = null;
    }
    if (pending === null) {
      const newKeyEpoch = registry.currentKeyEpoch + 1;
      const nextKey = await random(32);
      const wrappedKeys: Record<string, string> = {};
      for (const device of registry.devices) {
        if (device.revokedAt !== undefined || device.deviceId === input.deviceId) continue;
        wrappedKeys[device.deviceId] = await wrapFor(scope, device, newKeyEpoch, nextKey);
      }
      const keyTransition = {
        fromKeyEpoch: registry.currentKeyEpoch,
        toKeyEpoch: newKeyEpoch,
        sealedKey: encryptBlob(
          base64.encode(enrollment.syncKey),
          nextKey,
          await random(GCM_NONCE_BYTES),
          cloudSyncTransitionAad(scope, registry.currentKeyEpoch, newKeyEpoch),
        ),
      };
      pending = { version: 2, targetId: input.deviceId, newKeyEpoch, wrappedKeys, keyTransition };
      // Exact request survives retries. No next-epoch cache write until the server confirms
      // which key won; no old transition can accidentally be paired with fresh randomness.
      await SecureStore.setItemAsync(pendingSlot, JSON.stringify(pending), secureOptions);
    }
    await api.revokeDevice(input.deviceId, {
      newKeyEpoch: pending.newKeyEpoch,
      wrappedKeys: pending.wrappedKeys,
      keyTransition: pending.keyTransition,
    });
    const confirmed = await ensureUnlocked(input.workspaceId, input.bearerToken, scope);
    if (confirmed.syncKey === null || confirmed.currentKeyEpoch < pending.newKeyEpoch)
      throw new Error('Device removal needs reconciliation.');
    await reconcileCloudSyncKeyHistory(scope, confirmed.currentKeyEpoch, confirmed.syncKey, api);
    await SecureStore.deleteItemAsync(pendingSlot);
  });
}

export async function reconcileCloudSyncKeyHistory(
  scope: CloudSyncKeyScope,
  currentEpoch: number,
  currentKey: Uint8Array,
  api: CloudSyncKeyApi,
): Promise<void> {
  if (currentEpoch <= 1) return;
  const transitions = new Map<
    number,
    { fromKeyEpoch: number; toKeyEpoch: number; sealedKey: string }
  >();
  let after = 0;
  // Each page has at most 64 bounded boxes. Stop explicitly rather than claim success if an
  // unexpectedly enormous registry cannot be reconciled in this foreground operation.
  for (let pageIndex = 0; pageIndex < 64; pageIndex++) {
    const page = await api.getKeyTransitions(after);
    if (!Array.isArray(page.transitions) || page.transitions.length > 64)
      throw new Error('Invalid sync key history.');
    for (const transition of page.transitions) {
      if (
        !cursor(transition.fromKeyEpoch) ||
        transition.fromKeyEpoch < 1 ||
        transition.toKeyEpoch !== transition.fromKeyEpoch + 1 ||
        transition.toKeyEpoch <= after ||
        typeof transition.sealedKey !== 'string' ||
        transition.sealedKey.length > 4096 ||
        transitions.has(transition.toKeyEpoch)
      )
        throw new Error('Invalid sync key history.');
      transitions.set(transition.toKeyEpoch, transition);
    }
    if (!page.hasMore) break;
    if (!cursor(page.nextAfterEpoch) || page.nextAfterEpoch <= after || pageIndex === 63)
      throw new Error('Sync key history needs further recovery.');
    after = page.nextAfterEpoch;
  }
  let key = currentKey;
  for (let epoch = currentEpoch; epoch > 1; epoch--) {
    const transition = transitions.get(epoch);
    if (transition === undefined)
      throw new Error('A sync key history link is missing. Restore/recovery is required.');
    const oldEncoded = decryptBlob(
      transition.sealedKey,
      key,
      cloudSyncTransitionAad(scope, epoch - 1, epoch),
    );
    const oldKey = oldEncoded === null ? null : decodeCloudSyncBase64(oldEncoded);
    if (oldKey?.byteLength !== 32) throw new Error('Cloud sync key history could not be verified.');
    await saveEpochKey(scope, epoch - 1, oldKey);
    key = oldKey;
  }
}

export async function loadEpochKey(
  scope: CloudSyncKeyScope,
  epoch: number,
): Promise<Uint8Array | null> {
  const raw = await SecureStore.getItemAsync(slot(scope, 'key.' + epoch));
  if (raw === null) return null;
  const key = decodeCloudSyncBase64(raw);
  if (key?.byteLength !== 32) throw new Error('The saved sync epoch key needs recovery.');
  return key;
}
export async function saveEpochKey(
  scope: CloudSyncKeyScope,
  epoch: number,
  key: Uint8Array,
): Promise<void> {
  if (key.byteLength !== 32 || !cursor(epoch) || epoch < 1)
    throw new Error('Cloud sync epoch key is invalid.');
  const id = slot(scope, 'key.' + epoch);
  const encoded = base64.encode(key);
  const existing = await SecureStore.getItemAsync(id);
  if (existing !== null && existing !== encoded)
    throw new Error('Conflicting saved sync keys need recovery.');
  if (existing === null) await SecureStore.setItemAsync(id, encoded, secureOptions);
}
async function acceptRegisteredKey(
  scope: CloudSyncKeyScope,
  device: CloudSyncDevice | null,
  deviceId: string,
): Promise<Uint8Array> {
  const identity = await getOrCreateCloudSyncIdentity(deviceId);
  if (
    device === null ||
    device.deviceId !== deviceId ||
    device.publicKey !== identity.publicKey ||
    device.publicKeyFingerprint !== identity.publicKeyFingerprint ||
    device.revokedAt !== undefined ||
    typeof device.wrappedSyncKey !== 'string'
  )
    throw new Error('Cloud sync registration does not match this phone.');
  // Always verify the actual registered box. A stale local cache is never evidence that a
  // pending key rotation won on the server.
  const key = unwrapCloudSyncKey({
    ...scope,
    wrapped: device.wrappedSyncKey,
    recipientPrivateKey: await readCloudSyncPrivateKey(deviceId),
    recipientDeviceId: deviceId,
    recipientFingerprint: identity.publicKeyFingerprint,
    keyEpoch: device.keyEpoch,
  });
  if (key === null)
    throw new Error(
      'This phone cannot open its registered sync key. Trusted-device recovery is required.',
    );
  await saveEpochKey(scope, device.keyEpoch, key);
  return key;
}
async function wrapFor(
  scope: CloudSyncKeyScope,
  device: { deviceId: string; publicKey: string; publicKeyFingerprint: string },
  keyEpoch: number,
  key: Uint8Array,
): Promise<string> {
  return wrapCloudSyncKey({
    ...scope,
    syncKey: key,
    recipientDeviceId: device.deviceId,
    recipientPublicKey: device.publicKey,
    recipientFingerprint: device.publicKeyFingerprint,
    keyEpoch,
    ephemeralPrivateKey: await random(32),
    iv: await random(GCM_NONCE_BYTES),
  });
}
function slot(scope: CloudSyncKeyScope, suffix: string): string {
  if (!/^[a-f0-9]{64}$/.test(scope.accountRef) || !/^[a-f0-9]{64}$/.test(scope.workspaceRef))
    throw new Error('Invalid cloud sync scope.');
  return PREFIX + scope.accountRef + '.' + scope.workspaceRef + '.' + suffix;
}
function parsePendingRotation(raw: string): PendingRotation {
  const value: unknown = JSON.parse(raw);
  if (
    !record(value) ||
    value.version !== 2 ||
    typeof value.targetId !== 'string' ||
    !/^[a-f0-9]{32}$/.test(value.targetId) ||
    !cursor(value.newKeyEpoch) ||
    !record(value.wrappedKeys) ||
    Object.keys(value.wrappedKeys).length > 32 ||
    !Object.entries(value.wrappedKeys).every(
      ([id, wrapped]) =>
        /^[a-f0-9]{32}$/.test(id) && typeof wrapped === 'string' && wrapped.length <= 2048,
    ) ||
    !record(value.keyTransition) ||
    value.keyTransition.toKeyEpoch !== value.newKeyEpoch ||
    value.keyTransition.fromKeyEpoch !== value.newKeyEpoch - 1 ||
    typeof value.keyTransition.sealedKey !== 'string' ||
    value.keyTransition.sealedKey.length > 4096
  )
    throw new Error('Pending device removal needs recovery.');
  return value as PendingRotation;
}
function cursor(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
async function random(length: number): Promise<Uint8Array> {
  return Uint8Array.from(await Crypto.getRandomBytesAsync(length));
}
function withEnrollmentLock<T>(scope: CloudSyncKeyScope, work: () => Promise<T>): Promise<T> {
  const id = slot(scope, 'lock');
  const run = (enrollmentTails.get(id) ?? Promise.resolve()).then(work);
  const done = run.then(
    () => undefined,
    () => undefined,
  );
  enrollmentTails.set(id, done);
  void done.then(() => {
    if (enrollmentTails.get(id) === done) enrollmentTails.delete(id);
  });
  return run;
}
