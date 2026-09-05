import { describe, expect, it } from 'vitest';
import { applyCloudSyncPatch, combineCloudSyncChunks, createCloudSyncPatch, createCloudSyncPatches, MAX_SYNC_PATCH_PLAINTEXT_BYTES } from './cloudSyncPatch';

const projection = (state: Record<string, unknown>) => JSON.stringify({ version: 1, state: JSON.stringify(state), canonical: '{}' });

describe('cloud sync field/collection CAS groups', () => {
  it('groups changed collections together and rejects a stale baseline', () => {
    const base = projection({ accounts: [{ id: 'a', balance: 10 }], transactions: [] });
    const next = projection({ accounts: [{ id: 'a', balance: 8 }, { id: 'b', balance: 2 }], transactions: [{ id: 'out' }, { id: 'in' }] });
    const patch = createCloudSyncPatch('a'.repeat(64), base, next);
    expect(patch.groups.map((group) => group.key)).toEqual(['accounts', 'transactions']);
    expect(applyCloudSyncPatch(base, patch)).toBe(JSON.parse(next).state);
    expect(() => applyCloudSyncPatch(projection({ accounts: [] }), patch)).toThrow(/baseline/);
  });

  it('splits an oversized bootstrap collection and reassembles it atomically', () => {
    const base = projection({ transactions: [] });
    const transactions = Array.from({ length: 650 }, (_, index) => ({
      id: `transaction-${index}`,
      merchant: `A merchant with enough detail to exercise bounded bootstrap chunking ${index}`,
      amount: index + 1,
    }));
    const next = projection({ transactions });
    const patches = createCloudSyncPatches('a'.repeat(64), base, next);
    expect(patches.length).toBeGreaterThan(1);
    expect(patches.every((patch) => JSON.stringify({ version: 1, workspaceRef: patch.workspaceRef, entityGroup: 'workspace', patch }).length <= MAX_SYNC_PATCH_PLAINTEXT_BYTES)).toBe(true);
    const merged = combineCloudSyncChunks(patches);
    expect(applyCloudSyncPatch(base, merged)).toBe(JSON.parse(next).state);
  });

  it('keeps related money fields in one CAS group and rejects a changed field', () => {
    const base = JSON.stringify({ version: 1, workspaceId: 'w', state: { accounts: [{ id: 'a', balance: 10 }], transactions: [] } });
    const next = JSON.stringify({ version: 1, workspaceId: 'w', state: { accounts: [{ id: 'a', balance: 8 }], transactions: [{ id: 'out', amount: -2 }] } });
    const patch = createCloudSyncPatch('a'.repeat(64), base, next);
    expect(patch.groups.map((group) => group.key)).toEqual(['money']);
    expect(() => applyCloudSyncPatch(JSON.stringify({ version: 1, workspaceId: 'w', state: { accounts: [{ id: 'a', balance: 11 }], transactions: [] } }), patch)).toThrow(/baseline/);
    const applied = JSON.parse(applyCloudSyncPatch(base, patch)) as Record<string, unknown>;
    expect(applied.accounts).toEqual([{ id: 'a', balance: 8 }]);
    expect(applied.transactions).toEqual([{ id: 'out', amount: -2 }]);
  });

  it('does not accept a partial or tampered full-patch chunk set', () => {
    const base = JSON.stringify({ version: 1, workspaceId: 'w', state: { transactions: [] } });
    const next = JSON.stringify({ version: 1, workspaceId: 'w', state: { transactions: Array.from({ length: 650 }, (_, i) => ({ id: `txn-${i}`, note: 'x'.repeat(80) })) } });
    const chunks = createCloudSyncPatches('a'.repeat(64), base, next);
    expect(chunks.length).toBeGreaterThan(1);
    expect(() => combineCloudSyncChunks(chunks.slice(0, -1))).toThrow(/incomplete/);
    const tampered = chunks.map((chunk, index) => index === 0 ? { ...chunk, chunkData: `${chunk.chunkData}x` } : chunk);
    expect(() => combineCloudSyncChunks(tampered)).toThrow(/checksum|unreadable|invalid/);
    expect(() => combineCloudSyncChunks(chunks.map((chunk, index) => index === 1 ? { ...chunk, resultProjectionHash: 'f'.repeat(64) } : chunk))).toThrow(/incomplete/);
  });

  it('rejects duplicate groups and non-money fields hidden inside the money group', () => {
    const base = JSON.stringify({ version: 1, workspaceId: 'w', state: { transactions: [] } });
    const hash = createCloudSyncPatch('a'.repeat(64), base, base).baseProjectionHash;
    expect(() => applyCloudSyncPatch(base, { version: 1, workspaceRef: 'a'.repeat(64), baseProjectionHash: hash, resultProjectionHash: hash, groups: [{ key: 'transactions', value: [] }, { key: 'transactions', value: [] }] })).toThrow(/repeats/);
    expect(() => applyCloudSyncPatch(base, { version: 1, workspaceRef: 'a'.repeat(64), baseProjectionHash: hash, resultProjectionHash: hash, groups: [{ key: 'money', value: { transactions: [], onboarding: {} } }] })).toThrow(/non-money/);
  });
});
