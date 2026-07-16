// At-rest encryption for the local store blob — AES-256-GCM (authenticated) via @noble/ciphers, a
// pure-JS, audited implementation that runs in Hermes (RN) and Node. This closes the "plaintext JSON
// on disk" gap (persist.ts): the store blob is encrypted with a 32-byte data key held in the OS
// keystore (vaultKey.ts → expo-secure-store) before it touches the document directory, so the file on
// disk is ciphertext, and a wrong key or a tampered file FAILS to decrypt (GCM authentication) rather
// than returning garbage.
//
// PURE + deterministic given its inputs: no I/O, no react-native, no key management (that is
// vaultKey.ts). Node-testable. The IV is an INPUT — a fresh random nonce per encryption is the
// caller's responsibility (GCM requires a unique nonce per key).

import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import { base64 } from '@scure/base';

/** Marks a Folio-vault-encrypted blob (v1) so a legacy PLAINTEXT blob stays distinguishable + migratable. */
const MAGIC = 'FVE1';
const BINARY_MAGIC = 'FVB1';

/** AES-256 key length (bytes) and the GCM nonce length (bytes). */
export const VAULT_KEY_BYTES = 32;
export const GCM_NONCE_BYTES = 12;

/**
 * Encrypt a UTF-8 string with AES-256-GCM. Output format: `FVE1:<hex iv>:<hex ciphertext+tag>`.
 * `key` must be 32 bytes; `iv` must be a fresh 12-byte random nonce (unique per key, per call).
 */
export function encryptBlob(
  plaintext: string,
  key: Uint8Array,
  iv: Uint8Array,
  associatedData?: Uint8Array,
): string {
  const ciphertext = gcm(key, iv, associatedData).encrypt(utf8ToBytes(plaintext));
  return `${MAGIC}:${bytesToHex(iv)}:${bytesToHex(ciphertext)}`;
}

/**
 * Decrypt a blob produced by `encryptBlob`. Returns null on ANY failure — a wrong key, a tampered
 * ciphertext (GCM auth), or a malformed / legacy-plaintext input — so a caller never mistakes garbage
 * for real data. A non-encrypted legacy blob has no MAGIC and returns null; use `isEncryptedBlob` to
 * detect + migrate it.
 */
export function decryptBlob(
  encoded: string,
  key: Uint8Array,
  associatedData?: Uint8Array,
): string | null {
  const parts = encoded.split(':');
  if (parts.length !== 3 || parts[0] !== MAGIC) return null;
  const ivHex = parts[1];
  const ctHex = parts[2];
  if (ivHex === undefined || ctHex === undefined) return null;
  try {
    const plaintext = gcm(key, hexToBytes(ivHex), associatedData).decrypt(hexToBytes(ctHex));
    return bytesToUtf8(plaintext);
  } catch {
    return null;
  }
}

/** True when `encoded` is a Folio-vault-encrypted blob (vs a legacy plaintext JSON blob). */
export function isEncryptedBlob(encoded: string): boolean {
  return encoded.startsWith(`${MAGIC}:`);
}

/** Encrypt arbitrary bytes without first converting them to UTF-8. The binary envelope uses base64
 *  rather than hex so retained PDFs/images add only ~33% encoding overhead. */
export function encryptBytes(
  plaintext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  associatedData?: Uint8Array,
): string {
  const ciphertext = gcm(key, iv, associatedData).encrypt(plaintext);
  return `${BINARY_MAGIC}:${base64.encode(iv)}:${base64.encode(ciphertext)}`;
}

/** Decrypt a binary envelope. Wrong workspace keys, swapped document AAD, tampering and malformed
 *  input all fail closed with `null`. */
export function decryptBytes(
  encoded: string,
  key: Uint8Array,
  associatedData?: Uint8Array,
): Uint8Array | null {
  const parts = encoded.split(':');
  if (parts.length !== 3 || parts[0] !== BINARY_MAGIC) return null;
  const iv = parts[1];
  const ciphertext = parts[2];
  if (iv === undefined || ciphertext === undefined) return null;
  try {
    return gcm(key, base64.decode(iv), associatedData).decrypt(base64.decode(ciphertext));
  } catch {
    return null;
  }
}

export function isEncryptedByteBlob(encoded: string): boolean {
  return encoded.startsWith(`${BINARY_MAGIC}:`);
}
