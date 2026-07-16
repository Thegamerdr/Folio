import { describe, expect, it } from 'vitest';

import {
  buildCloudBackupEnvelope,
  formatRecoveryCode,
  normalizeRecoveryCode,
  openCloudBackupEnvelope,
  PERSONAL_CLOUD_BACKUP_WORKSPACE_ID,
  recoveryCodeFromBytes,
  serializeCloudBackupEnvelope,
  workspaceBackupRef,
} from './cloudBackup';
import { encryptBlob, GCM_NONCE_BYTES } from './cryptoBlob';

const recoveryBytes = new Uint8Array(32).fill(0xab);
const recoveryCode = recoveryCodeFromBytes(recoveryBytes);
const personalRef = workspaceBackupRef(PERSONAL_CLOUD_BACKUP_WORKSPACE_ID);
const businessRef = workspaceBackupRef('workspace_business_test');

function envelope(plaintext = '{"transactions":[],"subs":[]}') {
  return buildCloudBackupEnvelope({
    plaintext,
    recoveryKey: recoveryBytes,
    iv: new Uint8Array(GCM_NONCE_BYTES).fill(7),
    createdAt: '2026-07-14T18:00:00.000Z',
    deviceId: 'a'.repeat(32),
    workspaceRef: personalRef,
  });
}

describe('cloud backup envelope', () => {
  it('formats and normalizes a 256-bit recovery code', () => {
    const formatted = formatRecoveryCode(recoveryCode);
    expect(formatted.split('-')).toHaveLength(8);
    expect(normalizeRecoveryCode(`  ${formatted.toLowerCase()}  `)).toBe(recoveryCode);
    expect(normalizeRecoveryCode('too-short')).toBeNull();
  });

  it('round-trips opaque ciphertext without exposing financial plaintext', () => {
    const plaintext = '{"merchant":"Private Cafe","transactions":[],"subs":[]}';
    const raw = serializeCloudBackupEnvelope(envelope(plaintext));
    expect(raw).not.toContain('Private Cafe');
    expect(openCloudBackupEnvelope(raw, recoveryCode, personalRef)).toMatchObject({
      ok: true,
      plaintext,
      legacyPersonal: false,
    });
  });

  it('rejects a wrong recovery code and tampered ciphertext', () => {
    const raw = serializeCloudBackupEnvelope(envelope());
    expect(openCloudBackupEnvelope(raw, '11'.repeat(32), personalRef)).toEqual({
      ok: false,
      reason: 'wrong-recovery-code',
    });
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsed.ciphertext = `${String(parsed.ciphertext).slice(0, -1)}0`;
    expect(openCloudBackupEnvelope(JSON.stringify(parsed), recoveryCode, personalRef)).toEqual({
      ok: false,
      reason: 'wrong-recovery-code',
    });
  });

  it('binds ciphertext to one opaque workspace and rejects cross-workspace restore', () => {
    const raw = serializeCloudBackupEnvelope(envelope());
    expect(openCloudBackupEnvelope(raw, recoveryCode, businessRef)).toEqual({
      ok: false,
      reason: 'wrong-workspace',
    });

    const tampered = JSON.parse(raw) as Record<string, unknown>;
    tampered.workspaceRef = businessRef;
    expect(openCloudBackupEnvelope(JSON.stringify(tampered), recoveryCode, businessRef)).toEqual({
      ok: false,
      reason: 'wrong-recovery-code',
    });
  });

  it('opens a legacy v1 backup only for the Personal workspace', () => {
    const legacy = JSON.stringify({
      version: 1,
      encryption: 'AES-256-GCM',
      createdAt: '2026-07-14T18:00:00.000Z',
      deviceId: 'a'.repeat(32),
      ciphertext: encryptBlob(
        '{"transactions":[],"subs":[]}',
        recoveryBytes,
        new Uint8Array(GCM_NONCE_BYTES).fill(7),
      ),
    });
    expect(openCloudBackupEnvelope(legacy, recoveryCode, personalRef)).toMatchObject({
      ok: true,
      legacyPersonal: true,
    });
    expect(openCloudBackupEnvelope(legacy, recoveryCode, businessRef)).toEqual({
      ok: false,
      reason: 'wrong-workspace',
    });
  });

  it('rejects malformed or unrecognised envelopes', () => {
    expect(openCloudBackupEnvelope('not json', recoveryCode, personalRef)).toEqual({
      ok: false,
      reason: 'invalid-envelope',
    });
    expect(openCloudBackupEnvelope('{"version":2}', recoveryCode, personalRef)).toEqual({
      ok: false,
      reason: 'invalid-envelope',
    });
  });

  it('hashes validated workspace IDs into stable opaque references', () => {
    expect(personalRef).toMatch(/^[a-f0-9]{64}$/);
    expect(personalRef).not.toContain('personal');
    expect(workspaceBackupRef(PERSONAL_CLOUD_BACKUP_WORKSPACE_ID)).toBe(personalRef);
    expect(() => workspaceBackupRef('business')).toThrow();
  });
});
