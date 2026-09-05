import { describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base64 } from '@scure/base';
import { unwrapCloudSyncKey, wrapCloudSyncKey } from './cloudSyncKeys';

const privateKey = new Uint8Array(32).fill(7);
const recipientPublicKey = base64.encode(ed25519.getPublicKey(privateKey));
const recipientFingerprint = `sha256:${hex(sha256(ed25519.getPublicKey(privateKey)))}`;
const scope = {
  accountRef: 'a'.repeat(64),
  workspaceRef: 'b'.repeat(64),
  recipientDeviceId: 'c'.repeat(32),
};

describe('cloud sync epoch key wrapping', () => {
  it('round-trips an epoch key without exposing plaintext to the wrapper', () => {
    const key = new Uint8Array(32).fill(9);
    const wrapped = wrapCloudSyncKey({
      ...scope,
      syncKey: key,
      recipientPublicKey: recipientPublicKey
        .replace(/=+$/, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_'),
      recipientFingerprint,
      keyEpoch: 3,
      ephemeralPrivateKey: new Uint8Array(32).fill(11),
      iv: new Uint8Array(12).fill(13),
    });
    expect(wrapped).not.toContain(base64.encode(key));
    expect(
      unwrapCloudSyncKey({
        ...scope,
        wrapped,
        recipientPrivateKey: privateKey,
        recipientFingerprint,
        keyEpoch: 3,
      }),
    ).toEqual(key);
  });

  it('fails closed for a different recipient, epoch or fingerprint', () => {
    const wrapped = wrapCloudSyncKey({
      ...scope,
      syncKey: new Uint8Array(32).fill(1),
      recipientPublicKey,
      recipientFingerprint,
      keyEpoch: 1,
      ephemeralPrivateKey: new Uint8Array(32).fill(2),
      iv: new Uint8Array(12).fill(3),
    });
    const opening = {
      ...scope,
      wrapped,
      recipientPrivateKey: privateKey,
      recipientFingerprint,
      keyEpoch: 1,
    };
    expect(
      unwrapCloudSyncKey({ ...opening, recipientPrivateKey: new Uint8Array(32).fill(4) }),
    ).toBeNull();
    expect(unwrapCloudSyncKey({ ...opening, keyEpoch: 2 })).toBeNull();
    expect(unwrapCloudSyncKey({ ...opening, recipientFingerprint: 'sha256:wrong' })).toBeNull();
    expect(unwrapCloudSyncKey({ ...opening, accountRef: 'd'.repeat(64) })).toBeNull();
    expect(unwrapCloudSyncKey({ ...opening, workspaceRef: 'd'.repeat(64) })).toBeNull();
    expect(unwrapCloudSyncKey({ ...opening, recipientDeviceId: 'd'.repeat(32) })).toBeNull();
  });
});

function hex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
