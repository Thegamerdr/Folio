import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/ciphers/utils.js';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {
  canonicalSyncRequestMessage,
  type CloudSyncRequestSigner,
  type SyncRequestSignature,
} from '@folio/sync';

const PRIVATE_KEY_PREFIX = 'melo.cloudSyncSigningKey.v1.';
const REQUEST_SEQUENCE_PREFIX = 'melo.cloudSyncRequestSequence.v1.';
const PRIVATE_KEY_BYTES = 32;
const sequenceTails = new Map<string, Promise<void>>();
const identityPromises = new Map<string, Promise<CloudSyncDeviceIdentity>>();
const requestTails = new Map<string, Promise<void>>();

export type CloudSyncDeviceIdentity = Readonly<{
  deviceId: string;
  publicKey: string;
  publicKeyFingerprint: string;
}>;

export async function getOrCreateCloudSyncIdentity(
  deviceId: string,
): Promise<CloudSyncDeviceIdentity> {
  const existing = identityPromises.get(deviceId);
  if (existing !== undefined) return existing;
  const pending = loadOrCreateIdentity(deviceId);
  identityPromises.set(deviceId, pending);
  void pending.then(
    () => {
      if (identityPromises.get(deviceId) === pending) identityPromises.delete(deviceId);
    },
    () => {
      if (identityPromises.get(deviceId) === pending) identityPromises.delete(deviceId);
    },
  );
  return pending;
}

async function loadOrCreateIdentity(deviceId: string): Promise<CloudSyncDeviceIdentity> {
  const keyId = `${PRIVATE_KEY_PREFIX}${deviceId}`;
  const raw = await SecureStore.getItemAsync(keyId);
  const privateKey = raw === null ? await createPrivateKey(keyId) : decodeBase64Url(raw);
  if (privateKey.byteLength !== PRIVATE_KEY_BYTES)
    throw new Error('Cloud sync signing key is invalid.');
  const publicKey = ed25519.getPublicKey(privateKey);
  return {
    deviceId,
    publicKey: encodeBase64Url(publicKey),
    publicKeyFingerprint: `sha256:${hex(sha256(publicKey))}`,
  };
}

export function cloudSyncRequestSigner(
  workspaceRef: string,
  identity: CloudSyncDeviceIdentity,
): CloudSyncRequestSigner {
  return {
    sign: async ({ method, path, body }): Promise<SyncRequestSignature> => {
      const privateKey = await readPrivateKey(identity.deviceId);
      const bodySha256 = hex(sha256(utf8ToBytes(body ?? '')));
      const url = new URL(path, 'https://melo.sync.internal');
      const query = [...url.searchParams.entries()]
        .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
          leftKey === rightKey
            ? compareCanonicalText(leftValue, rightValue)
            : compareCanonicalText(leftKey, rightKey),
        )
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
      const signedAt = new Date().toISOString();
      const nonce = encodeBase64Url(Uint8Array.from(await Crypto.getRandomBytesAsync(16)));
      const requestSequence = await nextSequence(identity.deviceId);
      const message = canonicalSyncRequestMessage({
        method,
        path: url.pathname,
        query,
        workspaceRef,
        deviceId: identity.deviceId,
        bodySha256,
        signedAt,
        nonce,
        requestSequence,
      });
      return {
        version: 1,
        signedAt,
        nonce,
        requestSequence,
        bodySha256,
        signature: encodeBase64Url(ed25519.sign(utf8ToBytes(message), privateKey)),
      };
    },
  };
}

/** Serialize transport per durable device so monotonic request proofs arrive in sequence. */
export function serializeCloudSyncRequest<T>(
  deviceId: string,
  request: () => Promise<T>,
): Promise<T> {
  const prior = requestTails.get(deviceId) ?? Promise.resolve();
  const run = prior.then(request, request);
  requestTails.set(
    deviceId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

async function createPrivateKey(keyId: string): Promise<Uint8Array> {
  const privateKey = Uint8Array.from(await Crypto.getRandomBytesAsync(PRIVATE_KEY_BYTES));
  await SecureStore.setItemAsync(keyId, encodeBase64Url(privateKey), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return privateKey;
}

async function readPrivateKey(deviceId: string): Promise<Uint8Array> {
  const raw = await SecureStore.getItemAsync(`${PRIVATE_KEY_PREFIX}${deviceId}`);
  if (raw === null) throw new Error('Cloud sync signing key is unavailable.');
  const privateKey = decodeBase64Url(raw);
  if (privateKey.byteLength !== PRIVATE_KEY_BYTES)
    throw new Error('Cloud sync signing key is invalid.');
  return privateKey;
}

async function nextSequence(deviceId: string): Promise<number> {
  const prior = sequenceTails.get(deviceId) ?? Promise.resolve();
  let sequence = 0;
  const next = prior.then(async () => {
    const key = `${REQUEST_SEQUENCE_PREFIX}${deviceId}`;
    const current = Number.parseInt((await SecureStore.getItemAsync(key)) ?? '0', 10);
    sequence = Number.isSafeInteger(current) && current >= 0 ? current + 1 : 1;
    await SecureStore.setItemAsync(key, String(sequence), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  });
  sequenceTails.set(
    deviceId,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  await next;
  return sequence;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = `${value.replace(/-/g, '+').replace(/_/g, '/')}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function compareCanonicalText(left: string, right: string): number {
  if (left === right) return 0;
  const leftPoints = Array.from(left, (character) => character.codePointAt(0)!);
  const rightPoints = Array.from(right, (character) => character.codePointAt(0)!);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    if (leftPoints[index]! !== rightPoints[index]!) return leftPoints[index]! - rightPoints[index]!;
  }
  return leftPoints.length - rightPoints.length;
}
