import { describe, expect, it } from 'vitest';

import {
  createShareableCloudSyncProjection,
  mergeShareableCloudSyncProjection,
  parseShareableCloudSyncProjection,
} from './cloudSyncProjection';

describe('cloud sync authority projection', () => {
  it('keeps local evidence attachments out of the portable projection', () => {
    const raw = createShareableCloudSyncProjection(
      JSON.stringify({
        transactions: [{ id: 'txn-1', amount: -4 }],
        evidenceDocuments: [{ id: 'receipt-1', filename: 'receipt.pdf' }],
        readerCandidates: [{ id: 'candidate-1' }],
        deviceIdentity: { id: 'device-only' },
      }),
      'workspace-1',
    );
    const projection = parseShareableCloudSyncProjection(raw);
    expect(projection.state).toEqual({ transactions: [{ id: 'txn-1', amount: -4 }] });
  });

  it('rejects an inbound field outside the explicit authority manifest', () => {
    expect(() =>
      parseShareableCloudSyncProjection(
        JSON.stringify({
          version: 1,
          workspaceId: 'workspace-1',
          state: { transactions: [], privateDevicePath: '/data/private' },
        }),
      ),
    ).toThrow(/authority manifest/);
  });

  it('treats omitted allowlisted fields as remote deletions', () => {
    const current = JSON.stringify({
      transactions: [],
      pots: [{ id: 'pot-1' }],
      currentBalance: { amount: 4 },
    });
    const remote = createShareableCloudSyncProjection(
      JSON.stringify({ transactions: [] }),
      'workspace-1',
    );
    const merged = JSON.parse(
      mergeShareableCloudSyncProjection(current, remote, 'workspace-1'),
    ) as Record<string, unknown>;
    expect(merged.pots).toBeUndefined();
    expect(merged.currentBalance).toBeUndefined();
  });
});
