import { describe, expect, it } from 'vitest';

import { openCloudSyncOperation, sealCloudSyncOperation } from './cloudSync';

describe('cloud sync encryption', () => {
  it('binds opaque operation ciphertext to workspace, device, sequence and key epoch', () => {
    const key = new Uint8Array(32).fill(7);
    const workspaceRef = 'a'.repeat(64);
    const sealed = sealCloudSyncOperation({
      id: 'operation-1',
      workspaceRef,
      deviceId: 'b'.repeat(32),
      deviceSequence: 1,
      keyEpoch: 2,
      idempotencyKey: 'device-b-1',
      createdAt: '2026-09-01T10:00:00.000Z',
      plaintext: JSON.stringify({ command: 'private-money-operation', amountMinor: 1299 }),
      syncKey: key,
      iv: new Uint8Array(12).fill(3),
    });

    expect(JSON.stringify(sealed)).not.toContain('private-money-operation');
    const operation = { ...sealed, cursor: 8 };
    expect(openCloudSyncOperation({ operation, workspaceRef, syncKey: key })).toContain(
      'private-money-operation',
    );
    expect(
      openCloudSyncOperation({
        operation: { ...operation, keyEpoch: 3 },
        workspaceRef,
        syncKey: key,
      }),
    ).toBeNull();
    expect(
      openCloudSyncOperation({ operation, workspaceRef: 'c'.repeat(64), syncKey: key }),
    ).toBeNull();
  });
});
