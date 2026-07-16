// cryptoBlob tests — AES-256-GCM at-rest encryption for the store blob. Pure + Node-safe (no RN), so
// the apps/**/*.test.ts runner collects it. Proves round-trip, wrong-key/tamper rejection (GCM auth),
// legacy-plaintext detection, and nonce uniqueness.

import { describe, expect, it } from 'vitest';

import {
  GCM_NONCE_BYTES,
  VAULT_KEY_BYTES,
  decryptBlob,
  decryptBytes,
  encryptBlob,
  encryptBytes,
  isEncryptedBlob,
  isEncryptedByteBlob,
} from './cryptoBlob';

const key = new Uint8Array(VAULT_KEY_BYTES).fill(7);
const iv = new Uint8Array(GCM_NONCE_BYTES).fill(3);

describe('cryptoBlob — AES-256-GCM', () => {
  it('round-trips a blob (decrypt(encrypt(x)) === x) and the ciphertext is not the plaintext', () => {
    const plaintext = JSON.stringify({ hello: 'world', amount: -42.1, secret: 'Tesco' });
    const encoded = encryptBlob(plaintext, key, iv);

    expect(isEncryptedBlob(encoded)).toBe(true);
    expect(encoded).not.toContain('Tesco'); // it's ciphertext, not the plaintext
    expect(encoded).not.toContain('world');
    expect(decryptBlob(encoded, key)).toBe(plaintext);
  });

  it('returns null for the WRONG key (never garbage)', () => {
    const encoded = encryptBlob('secret money data', key, iv);
    const wrongKey = new Uint8Array(VAULT_KEY_BYTES).fill(9);
    expect(decryptBlob(encoded, wrongKey)).toBeNull();
  });

  it('returns null for a TAMPERED ciphertext (GCM authentication)', () => {
    const encoded = encryptBlob('secret money data', key, iv);
    const last = encoded.slice(-1);
    const tampered = encoded.slice(0, -1) + (last === '0' ? '1' : '0');
    expect(tampered).not.toBe(encoded);
    expect(decryptBlob(tampered, key)).toBeNull();
  });

  it('authenticates associated metadata without writing it into the ciphertext payload', () => {
    const workspace = new TextEncoder().encode('workspace-ref:a');
    const encoded = encryptBlob('private state', key, iv, workspace);

    expect(decryptBlob(encoded, key, workspace)).toBe('private state');
    expect(decryptBlob(encoded, key, new TextEncoder().encode('workspace-ref:b'))).toBeNull();
    expect(decryptBlob(encoded, key)).toBeNull();
  });

  it('treats a legacy plaintext blob (no magic) as not-encrypted and undecryptable', () => {
    const legacy = '{"legacy":true,"transactions":[]}';
    expect(isEncryptedBlob(legacy)).toBe(false);
    expect(decryptBlob(legacy, key)).toBeNull();
  });

  it('returns null for a malformed encoded string', () => {
    expect(decryptBlob('FVE1:onlytwo', key)).toBeNull();
    expect(decryptBlob('FVE1::', key)).toBeNull();
    expect(decryptBlob('', key)).toBeNull();
  });

  it('produces different ciphertext for a different IV (nonce uniqueness)', () => {
    const a = encryptBlob('same', key, new Uint8Array(GCM_NONCE_BYTES).fill(1));
    const b = encryptBlob('same', key, new Uint8Array(GCM_NONCE_BYTES).fill(2));
    expect(a).not.toBe(b);
    expect(decryptBlob(a, key)).toBe('same');
    expect(decryptBlob(b, key)).toBe('same');
  });

  it('round-trips arbitrary PDF/image bytes without exposing them in the envelope', () => {
    const bytes = Uint8Array.from([0, 37, 80, 68, 70, 255, 1, 2, 3]);
    const aad = new TextEncoder().encode('workspace:a:evidence:1');
    const encoded = encryptBytes(bytes, key, iv, aad);

    expect(isEncryptedByteBlob(encoded)).toBe(true);
    expect(decryptBytes(encoded, key, aad)).toEqual(bytes);
    expect(
      decryptBytes(encoded, key, new TextEncoder().encode('workspace:a:evidence:2')),
    ).toBeNull();
    expect(decryptBytes(encoded, new Uint8Array(VAULT_KEY_BYTES).fill(8), aad)).toBeNull();
  });
});
