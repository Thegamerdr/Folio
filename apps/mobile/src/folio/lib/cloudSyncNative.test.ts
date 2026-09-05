import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@folio/domain';
import type { CloudSyncOperation, EncryptedOperationUpload } from '@folio/sync';
import {
  createCloudSyncLocalState,
  queueCloudSyncDelta,
  type CloudSyncLocalState,
} from './cloudSyncLocal';
import { createCloudSyncPatches, projectionHash } from './cloudSyncPatch';
import { createShareableCloudSyncProjection, stableCloudSyncJson } from './cloudSyncProjection';
import { sealCloudSyncOperation } from './cloudSync';

const workspaceId = 'workspace_personal_local' as WorkspaceId;
const scope = { workspaceRef: 'a'.repeat(64), accountRef: 'b'.repeat(64) };
const key = new Uint8Array(32).fill(7);
const phoneA = 'c'.repeat(32);
const phoneB = 'd'.repeat(32);
let deviceId: string;
let state: Record<string, any>;
let savedProjection: string;
let local: CloudSyncLocalState | null;
let remote: CloudSyncOperation[];
let nonce: number;
let afterUpload: (() => void) | null;
let pageCap: number;
let visibleHead: number;
let afterDownload: (() => void) | null;
const calls: string[] = [];
const clone = <T>(value: T): T => structuredClone(value);
const journal = (): CloudSyncLocalState | null => local;
const projection = () => createShareableCloudSyncProjection(JSON.stringify(state), workspaceId);
const empty = () => stableCloudSyncJson({ version: 1, workspaceId, state: {} });
const payload = (amount = 0) => ({
  schemaVersion: 11,
  activeWorkspaceId: workspaceId,
  dataWorkspaceId: workspaceId,
  accounts: [{ id: 'bank', balanceMinor: amount }],
  transactions: [],
  currentBalance: { amount },
});
function capture(): void {
  const current = projection();
  if (local?.enabled && current !== savedProjection) {
    for (const patch of createCloudSyncPatches(scope.workspaceRef, savedProjection, current)) {
      local = queueCloudSyncDelta(local, {
        id: 'intent-' + local.nextSequence,
        entityGroup: patch.chunkSetId ?? 'workspace',
        plaintext: JSON.stringify({ version: 1, workspaceRef: scope.workspaceRef, patch }),
      });
    }
    local = {
      ...local,
      revision: local.revision + 1,
      lastCapturedProjection: current,
      lastLocalProjection: current,
    };
  }
  savedProjection = current;
}
const api = {
  uploadOperation: vi.fn(async (operation: EncryptedOperationUpload) => {
    calls.push('upload:' + operation.id);
    const existing = remote.find((entry) => entry.id === operation.id);
    if (!existing) remote.push({ ...clone(operation), cursor: remote.length + 1 });
    const hook = afterUpload;
    afterUpload = null;
    hook?.();
    return {
      duplicate: !!existing,
      cursor: existing?.cursor ?? remote.length,
      headCursor: remote.length,
    };
  }),
  downloadOperations: vi.fn(async (after: number) => {
    calls.push('download:' + after);
    const operations = remote
      .filter((entry) => entry.cursor > after && entry.cursor <= visibleHead)
      .slice(0, pageCap);
    const nextCursor = operations.at(-1)?.cursor ?? after;
    const hook = afterDownload;
    afterDownload = null;
    hook?.();
    return {
      operations: clone(operations),
      nextCursor,
      headCursor: remote.length,
      hasMore: nextCursor < Math.min(remote.length, visibleHead),
    };
  }),
  acknowledge: vi.fn(async (cursor: number) => {
    calls.push('ack:' + cursor);
    return { acknowledgedCursor: cursor, headCursor: remote.length };
  }),
};
vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (n: number) => new Uint8Array(n).fill(++nonce),
}));
vi.mock('@/folio/store', () => ({
  getPersistBlob: () => JSON.stringify(state),
  getState: () => state,
}));
vi.mock('./cloudBackup', () => ({ workspaceBackupRef: () => scope.workspaceRef }));
vi.mock('./cloudBackupNative', () => ({ getOrCreateCloudDeviceId: async () => deviceId }));
vi.mock('./billing/entitlements', () => ({
  loadActiveEntitlement: async () => ({ tier: 'live' }),
}));
vi.mock('./cloudSyncEnrollmentNative', () => ({
  ensureCloudSyncEnrollment: async () => ({
    deviceId,
    enrolled: true,
    status: 'active',
    currentKeyEpoch: 1,
    headCursor: remote.length,
    compactedThrough: 0,
    lastDeviceSequence: Math.max(
      0,
      ...remote.filter((entry) => entry.deviceId === deviceId).map((entry) => entry.deviceSequence),
    ),
    syncKey: key,
  }),
  loadEpochKey: async () => key,
  reconcileCloudSyncKeyHistory: async () => undefined,
}));
vi.mock('./cloudSyncTransportNative', () => ({
  deriveCloudSyncScope: (_workspace: unknown, token: string) =>
    token === 'other' ? { ...scope, accountRef: 'e'.repeat(64) } : scope,
  authenticatedCloudSyncApi: async () => api,
  getCloudSyncDeviceId: async () => deviceId,
}));
vi.mock('./cloudSyncLocalNative', () => ({
  loadCloudSyncLocalState: async () => clone(local),
  persistCloudSyncLocalState: async (_workspace: unknown, next: CloudSyncLocalState) => {
    if ((local && next.revision !== local.revision) || next.lastCapturedProjection !== projection())
      throw new Error('stale metadata');
    local = clone({ ...next, revision: next.revision + 1 });
    savedProjection = projection();
    return clone(local);
  },
}));
vi.mock('./persist', () => ({
  persistCurrentStateNow: async () => {
    capture();
  },
  commitCloudSyncProjection: async (
    _workspace: unknown,
    nextProjection: string,
    next: CloudSyncLocalState,
    isCurrent: () => boolean,
  ) => {
    if (
      !isCurrent() ||
      next.revision !== local?.revision ||
      next.lastCapturedProjection !== projection()
    )
      throw new Error('stale replay');
    Object.assign(state, JSON.parse(nextProjection).state);
    savedProjection = projection();
    local = clone({
      ...next,
      revision: next.revision + 1,
      lastCapturedProjection: nextProjection,
      lastLocalProjection: nextProjection,
    });
    return clone(local);
  },
}));
import {
  enableCloudSyncWorkspace,
  syncCloudWorkspace,
  resolveCloudSyncConflict,
} from './cloudSyncNative';

beforeEach(() => {
  deviceId = phoneA;
  state = payload(800);
  savedProjection = projection();
  local = null;
  remote = [];
  nonce = 0;
  afterUpload = null;
  afterDownload = null;
  pageCap = 100;
  visibleHead = Infinity;
  calls.length = 0;
  api.uploadOperation.mockClear();
  api.downloadOperations.mockClear();
  api.acknowledge.mockClear();
});
function addRemote(base: string, target: string, sender = phoneB): void {
  for (const patch of createCloudSyncPatches(scope.workspaceRef, base, target)) {
    const sequence = remote.filter((entry) => entry.deviceId === sender).length + 1;
    const operation = sealCloudSyncOperation({
      workspaceRef: scope.workspaceRef,
      deviceId: sender,
      id: sender + '-' + sequence,
      deviceSequence: sequence,
      keyEpoch: 1,
      idempotencyKey: sender + '-' + sequence,
      createdAt: new Date(0).toISOString(),
      syncKey: key,
      iv: new Uint8Array(12).fill(++nonce),
      plaintext: JSON.stringify({ version: 1, workspaceRef: scope.workspaceRef, patch }),
    });
    remote.push({ ...operation, cursor: remote.length + 1 });
  }
}

describe('shipping sync runner boundaries (real patches and authenticated ciphertext)', () => {
  it('recovers a lost upload response, then a second phone can review and adopt the full workspace', async () => {
    await enableCloudSyncWorkspace(workspaceId, 'account');
    afterUpload = () => {
      throw new Error('response lost after remote commit');
    };
    await expect(syncCloudWorkspace(workspaceId, 'account')).rejects.toThrow('response lost');
    expect(local?.outbox).toHaveLength(1);
    const sealed = local!.outbox[0]!.sealedDelta;
    local = clone(local); // durable journal survives a runner/process restart
    await syncCloudWorkspace(workspaceId, 'account');
    expect(remote).toHaveLength(1);
    expect(JSON.parse(sealed).ciphertext).toBe(remote[0]!.ciphertext);
    expect(local?.cursor).toBe(1);
    expect(local?.baselineProjection).toBe(projection());
    expect(local?.outbox).toEqual([]);

    deviceId = phoneB;
    state = payload(0);
    savedProjection = projection();
    local = null;
    await enableCloudSyncWorkspace(workspaceId, 'account');
    await syncCloudWorkspace(workspaceId, 'account');
    expect(state.currentBalance.amount).toBe(0);
    expect(journal()?.conflictRecords).toHaveLength(1);
    await resolveCloudSyncConflict(workspaceId, local!.conflictRecords[0]!.id, 'remote');
    expect(state.currentBalance.amount).toBe(800);
    expect(journal()?.conflictRecords).toEqual([]);
  });

  it('preserves a local edit during upload and replays earlier remote history before sending it', async () => {
    await enableCloudSyncWorkspace(workspaceId, 'account');
    await syncCloudWorkspace(workspaceId, 'account');
    const baseline = local!.baselineProjection;
    const incoming = stableCloudSyncJson({
      ...JSON.parse(baseline),
      state: { ...JSON.parse(baseline).state, nextYouNote: 'Remote note' },
    });
    addRemote(baseline, incoming);
    state.currentBalance.amount = 700;
    state.accounts[0].balanceMinor = 700;
    capture();
    afterUpload = () => {
      state.currentBalance.amount = 650;
      state.accounts[0].balanceMinor = 650;
      capture();
    };
    calls.length = 0;
    await expect(syncCloudWorkspace(workspaceId, 'account')).rejects.toThrow(/stale/);
    expect(calls[0]).toMatch(/^download/);
    expect(local!.pendingDeltas.length + local!.outbox.length).toBeGreaterThan(0);
    local = clone(local);
    await syncCloudWorkspace(workspaceId, 'account');
    expect(state.currentBalance.amount).toBe(650);
    expect(state.nextYouNote).toBe('Remote note');
    expect(local?.baselineProjection).toBe(projection());
    expect(local?.pendingDeltas).toEqual([]);
    expect(local?.outbox).toEqual([]);
  });

  it('stages a split atomic money change across restart without acknowledging or applying a half', async () => {
    state = payload(0);
    savedProjection = projection();
    local = {
      ...createCloudSyncLocalState(scope.workspaceRef, savedProjection, 1, scope.accountRef),
      enabled: true,
    };
    const target = stableCloudSyncJson({
      version: 1,
      workspaceId,
      state: {
        ...JSON.parse(savedProjection).state,
        accounts: [{ id: 'bank', balanceMinor: 400 }],
        currentBalance: { amount: 400 },
        transactions: Array.from({ length: 1500 }, (_, index) => ({
          id: 't' + index,
          merchant: 'Synthetic fixture transaction ' + index,
          amount: 1,
        })),
      },
    });
    addRemote(savedProjection, target);
    expect(remote.length).toBeGreaterThan(1);
    visibleHead = 1;
    await syncCloudWorkspace(workspaceId, 'account');
    expect(local?.downloadCursor).toBe(1);
    expect(local?.cursor).toBe(0);
    expect(state.currentBalance.amount).toBe(0);
    expect(state.transactions).toEqual([]);
    expect(api.acknowledge).not.toHaveBeenCalled();
    local = clone(local);
    visibleHead = Infinity;
    await syncCloudWorkspace(workspaceId, 'account');
    expect(local?.cursor).toBe(remote.length);
    expect(state.currentBalance.amount).toBe(400);
    expect(state.transactions).toHaveLength(1500);
    expect(local?.partialGroups).toEqual([]);
  });

  it('rejects another account before network I/O and cancels replay when the selected workspace changes', async () => {
    await enableCloudSyncWorkspace(workspaceId, 'account');
    await expect(syncCloudWorkspace(workspaceId, 'other')).rejects.toThrow('another Melo account');
    expect(calls).toEqual([]);
    addRemote(empty(), projection());
    afterDownload = () => {
      state.activeWorkspaceId = 'business-other';
    };
    await expect(syncCloudWorkspace(workspaceId, 'account')).rejects.toThrow(/workspace changed/);
    expect(state.activeWorkspaceId).toBe('business-other');
    expect(local?.cursor).toBe(0);
    expect(api.acknowledge).not.toHaveBeenCalled();
  });
});
