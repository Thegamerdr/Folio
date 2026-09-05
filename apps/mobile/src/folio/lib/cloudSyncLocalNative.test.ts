import { describe, expect, it, vi } from 'vitest';

const workspaceId = 'workspace_personal_local';
const workspaceRef = 'a'.repeat(64);
const accountRef = 'b'.repeat(64);
const state = {
  schemaVersion: 11,
  activeWorkspaceId: workspaceId,
  dataWorkspaceId: workspaceId,
  onboarding: { done: true, name: 'Test', payday: 1, monthlyIncome: 100 },
  currentBalance: { amount: 100 },
  transactions: [],
  pots: [],
};
let savedPayload = JSON.stringify(state);
let releaseRead!: () => void;
let markReadReady!: () => void;
const readReady = new Promise<void>((resolve) => {
  markReadReady = resolve;
});
const readGate = new Promise<void>((resolve) => {
  releaseRead = resolve;
});

vi.mock('@/folio/store', () => ({
  getPersistBlob: () => savedPayload,
}));
vi.mock('./cloudBackup', () => ({
  workspaceBackupRef: () => workspaceRef,
}));
vi.mock('./persist', () => ({
  workspaceMetadata: () => ({ id: workspaceId, archivedAt: null }),
  persistCurrentStateNow: vi.fn(async () => undefined),
}));
vi.mock('@/local/nativeWorkspaceStateStore', () => ({
  loadNativeWorkspaceSyncState: vi.fn(async () => {
    markReadReady();
    await readGate;
    return {
      payload: JSON.stringify({
        version: 2,
        enabled: true,
        accountRef,
        workspaceRef,
        revision: 1,
        baselineProjection: '{}',
        lastCapturedProjection: JSON.stringify({
          version: 1,
          workspaceId,
          state: JSON.parse(savedPayload),
        }),
        lastLocalProjection: JSON.stringify({
          version: 1,
          workspaceId,
          state: JSON.parse(savedPayload),
        }),
        downloadCursor: 0,
        cursor: 0,
        nextSequence: 1,
        keyEpoch: 1,
        outbox: [],
        uploadedOperationIds: [],
        pendingDeltas: [],
        conflictRecords: [],
        partialGroups: [],
        conflicts: [],
      }),
    };
  }),
}));

import { persistCloudSyncLocalState } from './cloudSyncLocalNative';
import { createShareableCloudSyncProjection } from './cloudSyncProjection';

describe('cloud sync metadata save race', () => {
  it('rejects a projection changed while the prior metadata read is awaiting', async () => {
    savedPayload = JSON.stringify(state);
    const captured = createShareableCloudSyncProjection(savedPayload, workspaceId);
    const statePayload = {
      version: 2,
      enabled: true,
      accountRef,
      workspaceRef,
      revision: 1,
      baselineProjection: '{}',
      lastCapturedProjection: captured,
      lastLocalProjection: captured,
      downloadCursor: 0,
      cursor: 0,
      nextSequence: 1,
      keyEpoch: 1,
      outbox: [],
      uploadedOperationIds: [],
      pendingDeltas: [],
      conflictRecords: [],
      partialGroups: [],
      conflicts: [],
    } as any;
    const promise = persistCloudSyncLocalState(workspaceId as never, statePayload);
    await readReady;
    savedPayload = JSON.stringify({ ...state, nextYouNote: 'arrived during metadata read' });
    releaseRead();
    await expect(promise).rejects.toThrow(/stale.*local workspace data/i);
  });
});
