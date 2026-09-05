import {
  ed25519,
  edwardsToMontgomeryPriv,
  edwardsToMontgomeryPub,
  x25519,
} from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/ciphers/utils.js';
import { base64 } from '@scure/base';
import { decryptBlob, encryptBlob, VAULT_KEY_BYTES, GCM_NONCE_BYTES } from './cryptoBlob';

export type CloudSyncKeyScope = Readonly<{ accountRef: string; workspaceRef: string }>;
type RecipientBinding = CloudSyncKeyScope &
  Readonly<{
    recipientDeviceId: string;
    recipientFingerprint: string;
    keyEpoch: number;
  }>;

/** Scope binds the opaque box to account, workspace, device and epoch. Version 1 was an
 * unreleased draft without these bindings; never silently accept it as a version 2 key. */
export function wrapCloudSyncKey(
  input: RecipientBinding & {
    syncKey: Uint8Array;
    recipientPublicKey: string;
    ephemeralPrivateKey: Uint8Array;
    iv: Uint8Array;
  },
): string {
  assertKey(input.syncKey);
  if (input.ephemeralPrivateKey.byteLength !== 32 || input.iv.byteLength !== GCM_NONCE_BYTES) {
    throw new Error('Sync key wrapping randomness is invalid.');
  }
  const publicKey = decodeCloudSyncBase64(input.recipientPublicKey);
  if (publicKey?.byteLength !== 32 || fingerprint(publicKey) !== input.recipientFingerprint) {
    throw new Error('The recipient fingerprint does not match its public key.');
  }
  const aad = wrappingAad(input);
  const shared = x25519.getSharedSecret(
    input.ephemeralPrivateKey,
    edwardsToMontgomeryPub(publicKey),
  );
  const wrappingKey = hkdf(
    sha256,
    shared,
    utf8ToBytes('melo.cloud-sync.hkdf.v2'),
    utf8ToBytes(aad),
    VAULT_KEY_BYTES,
  );
  const box = encryptBlob(base64.encode(input.syncKey), wrappingKey, input.iv, utf8ToBytes(aad));
  return JSON.stringify({
    version: 2,
    ephemeralPublicKey: base64.encode(x25519.getPublicKey(input.ephemeralPrivateKey)),
    box,
  });
}

export function unwrapCloudSyncKey(
  input: RecipientBinding & {
    wrapped: string;
    recipientPrivateKey: Uint8Array;
  },
): Uint8Array | null {
  if (input.wrapped.length > 2048 || input.recipientPrivateKey.byteLength !== 32) return null;
  try {
    if (fingerprint(ed25519.getPublicKey(input.recipientPrivateKey)) !== input.recipientFingerprint)
      return null;
    const value: unknown = JSON.parse(input.wrapped);
    if (
      !record(value) ||
      value.version !== 2 ||
      typeof value.ephemeralPublicKey !== 'string' ||
      typeof value.box !== 'string'
    )
      return null;
    const ephemeralKey = decodeCloudSyncBase64(value.ephemeralPublicKey);
    if (ephemeralKey?.byteLength !== 32) return null;
    const aad = wrappingAad(input);
    const shared = x25519.getSharedSecret(
      edwardsToMontgomeryPriv(input.recipientPrivateKey),
      ephemeralKey,
    );
    const wrappingKey = hkdf(
      sha256,
      shared,
      utf8ToBytes('melo.cloud-sync.hkdf.v2'),
      utf8ToBytes(aad),
      VAULT_KEY_BYTES,
    );
    const plaintext = decryptBlob(value.box, wrappingKey, utf8ToBytes(aad));
    const key = plaintext === null ? null : decodeCloudSyncBase64(plaintext);
    return key?.byteLength === VAULT_KEY_BYTES ? key : null;
  } catch {
    return null;
  }
}

export function cloudSyncTransitionAad(
  scope: CloudSyncKeyScope,
  fromEpoch: number,
  toEpoch: number,
): Uint8Array {
  assertScope(scope);
  if (!Number.isSafeInteger(fromEpoch) || fromEpoch < 1 || toEpoch !== fromEpoch + 1)
    throw new Error('Invalid key transition epoch.');
  return utf8ToBytes(
    JSON.stringify([
      'melo.cloud-sync.transition.v2',
      scope.accountRef,
      scope.workspaceRef,
      fromEpoch,
      toEpoch,
    ]),
  );
}
function wrappingAad(input: RecipientBinding): string {
  assertScope(input);
  if (
    !/^[a-f0-9]{32}$/.test(input.recipientDeviceId) ||
    !/^sha256:[a-f0-9]{64}$/.test(input.recipientFingerprint) ||
    !Number.isSafeInteger(input.keyEpoch) ||
    input.keyEpoch < 1
  )
    throw new Error('Invalid sync key binding.');
  return JSON.stringify([
    'melo.cloud-sync.key-wrap.v2',
    input.accountRef,
    input.workspaceRef,
    input.recipientDeviceId,
    input.recipientFingerprint,
    input.keyEpoch,
  ]);
}
function assertScope(input: CloudSyncKeyScope): void {
  if (!/^[a-f0-9]{64}$/.test(input.accountRef) || !/^[a-f0-9]{64}$/.test(input.workspaceRef))
    throw new Error('Invalid sync key scope.');
}
function assertKey(value: Uint8Array): void {
  if (value.byteLength !== VAULT_KEY_BYTES) throw new Error('Sync epoch key is invalid.');
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function fingerprint(value: Uint8Array): string {
  return (
    'sha256:' + Array.from(sha256(value), (byte) => byte.toString(16).padStart(2, '0')).join('')
  );
}
export function decodeCloudSyncBase64(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) return null;
  const unpadded = value.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  try {
    return base64.decode(unpadded + '='.repeat((4 - (unpadded.length % 4)) % 4));
  } catch {
    return null;
  }
}
