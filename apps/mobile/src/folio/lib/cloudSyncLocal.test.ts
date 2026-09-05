import { describe, expect, it } from 'vitest';
import { appendCloudSyncDelta, createCloudSyncLocalState, parseCloudSyncLocalState, queueCloudSyncDelta, serializeCloudSyncLocalState } from './cloudSyncLocal';

const REF = 'a'.repeat(64);

describe('cloud sync local outbox', () => {
  it('assigns monotonic sequences and preserves idempotent operation identity', () => {
    const initial = createCloudSyncLocalState(REF, 'projection-1');
    const first = appendCloudSyncDelta(initial, { id: 'op-1', sealedDelta: 'cipher-1', entityGroup: 'transactions' });
    const duplicate = appendCloudSyncDelta(first, { id: 'op-1', sealedDelta: 'cipher-other', entityGroup: 'transactions' });
    const second = appendCloudSyncDelta(duplicate, { id: 'op-2', sealedDelta: 'cipher-2', entityGroup: 'accounts' });
    expect(second.outbox.map((item) => [item.id, item.deviceSequence, item.baseCursor])).toEqual([
      ['op-1', 1, 0],
      ['op-2', 2, 0],
    ]);
  });

  it('round-trips durable state and fails closed on workspace mismatch', () => {
    const state = appendCloudSyncDelta(createCloudSyncLocalState(REF, 'projection-1'), { id: 'op-1', sealedDelta: 'cipher-1', entityGroup: 'plan' });
    expect(parseCloudSyncLocalState(serializeCloudSyncLocalState(state), REF)).toEqual(state);
    expect(() => parseCloudSyncLocalState(serializeCloudSyncLocalState(state), 'b'.repeat(64))).toThrow();
  });

  it('rejects oversized or empty sealed deltas before local persistence', () => {
    const state = createCloudSyncLocalState(REF, 'projection-1');
    expect(() => appendCloudSyncDelta(state, { id: 'op-empty', sealedDelta: '', entityGroup: 'plan' })).toThrow();
    expect(() => appendCloudSyncDelta(state, { id: 'op-large', sealedDelta: 'x'.repeat(512 * 1024 + 1), entityGroup: 'plan' })).toThrow();
  });

  it('commits plaintext intent before sealing and preserves it through restart', () => {
    const state = createCloudSyncLocalState(REF, '{"v":1}');
    const queued = queueCloudSyncDelta(state, { id: 'projection-a', plaintext: '{"version":1}', entityGroup: 'workspace' });
    const restored = parseCloudSyncLocalState(serializeCloudSyncLocalState(queued), REF);
    expect(restored.pendingDeltas).toEqual([{ id: 'projection-a', deviceSequence: 1, baseCursor: 0, plaintext: '{"version":1}', entityGroup: 'workspace' }]);
    expect(restored.outbox).toHaveLength(0);
  });

  it('fails closed on malformed journal lists and conflict alternatives', () => {
    const state = createCloudSyncLocalState(REF, '{}');
    const malformedLists = { ...JSON.parse(serializeCloudSyncLocalState(state)), partialGroups: [42] };
    expect(() => parseCloudSyncLocalState(JSON.stringify(malformedLists), REF)).toThrow(/journal lists/);
    const malformedConflict = {
      ...JSON.parse(serializeCloudSyncLocalState(state)),
      conflictRecords: [{ id: 'conflict-1', remoteState: '[]', remoteProjectionHash: 'a'.repeat(64) }],
    };
    expect(() => parseCloudSyncLocalState(JSON.stringify(malformedConflict), REF)).toThrow(/conflicts/);
  });
});
