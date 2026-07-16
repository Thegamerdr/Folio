import { createWorkspace, createWorkspaceId } from '@folio/domain';
import { describe, expect, it } from 'vitest';

import {
  createPersonalWorkspaceRoot,
  type PersistedWorkspace,
} from '../folio/lib/workspaceRoot.js';

import { deriveLocalLedgerWorkspaceEncryptionKey } from './localLedgerWorkspaceCrypto.js';

function businessWorkspace(): PersistedWorkspace {
  return {
    ...createWorkspace({
      id: createWorkspaceId('workspace_business_sqlcipher_test'),
      kind: 'business',
      name: 'Studio Ltd',
      baseCurrency: 'GBP',
      jurisdiction: 'GB',
      timeZone: 'Europe/London',
      version: { revision: 1, dataVersion: 'workspace:business:v1' },
    }),
    encryptedSubkeyId: 'workspace-subkey-business-sqlcipher-v1',
    archivedAt: null,
  };
}

describe('native SQLCipher workspace key boundary', () => {
  it('derives stable, distinct 256-bit keys without exposing the device master', () => {
    const master = Array.from({ length: 32 }, (_, index) =>
      index.toString(16).padStart(2, '0'),
    ).join('');
    const personal = createPersonalWorkspaceRoot().workspaces[0]!;
    const business = businessWorkspace();
    const personalKey = deriveLocalLedgerWorkspaceEncryptionKey(master, personal);
    const businessKey = deriveLocalLedgerWorkspaceEncryptionKey(master, business);

    expect(personalKey).toMatch(/^[a-f0-9]{64}$/u);
    expect(businessKey).toMatch(/^[a-f0-9]{64}$/u);
    expect(personalKey).not.toBe(businessKey);
    expect(personalKey).not.toBe(master);
    expect(deriveLocalLedgerWorkspaceEncryptionKey(master, business)).toBe(businessKey);
  });

  it('fails closed for malformed or undersized master material', () => {
    expect(() => deriveLocalLedgerWorkspaceEncryptionKey('not-hex', businessWorkspace())).toThrow(
      /valid hexadecimal/i,
    );
    expect(() =>
      deriveLocalLedgerWorkspaceEncryptionKey('00'.repeat(16), businessWorkspace()),
    ).toThrow(/256-bit/i);
  });
});
