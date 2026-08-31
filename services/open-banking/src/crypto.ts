import type { CipherEnvelope } from './types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function storageUserId(userId: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(userId)));
}

export async function storageWorkspaceId(workspaceId: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(workspaceId)));
}

export async function stablePublicId(input: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(input))).slice(0, 24);
}

export function isValidEncryptionKey(value: string | undefined): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  try {
    return fromBase64Url(value.trim()).byteLength === 32;
  } catch {
    return false;
  }
}

export async function sealJson(
  value: unknown,
  base64Key: string,
  associatedData?: string,
): Promise<CipherEnvelope> {
  const key = await importEncryptionKey(base64Key);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: asArrayBuffer(nonce),
      ...(associatedData === undefined
        ? {}
        : { additionalData: asArrayBuffer(encoder.encode(associatedData)) }),
    },
    key,
    asArrayBuffer(plaintext),
  );
  return {
    ...(associatedData === undefined
      ? { v: 1 as const }
      : { v: 2 as const, binding: 'melo-open-banking-connection' as const }),
    alg: 'A256GCM',
    nonce: toBase64Url(nonce),
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
  };
}

export async function openJson<T>(
  envelope: CipherEnvelope,
  base64Key: string,
  associatedData?: string,
): Promise<T> {
  if (
    (envelope.v !== 1 &&
      (envelope.v !== 2 || envelope.binding !== 'melo-open-banking-connection')) ||
    envelope.alg !== 'A256GCM'
  ) {
    throw new Error('Unsupported encrypted provider record.');
  }
  if (envelope.v === 2 && associatedData === undefined) {
    throw new Error('Encrypted provider record is missing its workspace binding.');
  }
  const key = await importEncryptionKey(base64Key);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: asArrayBuffer(fromBase64Url(envelope.nonce)),
      ...(envelope.v === 2
        ? { additionalData: asArrayBuffer(encoder.encode(associatedData as string)) }
        : {}),
    },
    key,
    asArrayBuffer(fromBase64Url(envelope.ciphertext)),
  );
  return JSON.parse(decoder.decode(plaintext)) as T;
}

async function importEncryptionKey(base64Key: string): Promise<CryptoKey> {
  if (!isValidEncryptionKey(base64Key)) {
    throw new Error('CONNECTION_ENCRYPTION_KEY must decode to 32 bytes.');
  }
  const raw = fromBase64Url(base64Key.trim());
  return crypto.subtle.importKey('raw', asArrayBuffer(raw), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
