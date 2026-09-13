import { describe, expect, it } from 'vitest';

import { createRestoreResult, normalizeRestoreResult } from './restoreResult';

describe('restore result truth model', () => {
  it('marks missing original files and their affected records as partial', () => {
    const result = createRestoreResult({
      workspaceId: 'workspace_personal_local',
      degraded: false,
      attemptedTransactions: [
        { id: 'txn-1', sourceEvidenceId: 'doc-1' },
        { id: 'txn-2', sourceEvidenceId: 'doc-2' },
      ],
      restoredTransactions: [
        { id: 'txn-1', sourceEvidenceId: 'doc-1' },
        { id: 'txn-2', sourceEvidenceId: 'doc-2' },
      ],
      attemptedStatementRecords: [{ id: 'statement-1', sourceEvidenceId: 'doc-2' }],
      restoredStatementRecords: [{ id: 'statement-1' }],
      restoredAccountCount: 1,
      attemptedOriginalFileIds: ['doc-1', 'doc-2'],
      restoredOriginalFileIds: ['doc-1'],
    });

    expect(result.status).toBe('partial');
    expect(result.restoredOriginalFileCount).toBe(1);
    expect(result.missingOriginalFileCount).toBe(1);
    expect(result.unlinkedRecordCount).toBe(1);
    expect(result.unlinkedStatementRecordCount).toBe(1);
    expect(result.missingOriginalTransactionIds).toEqual(['txn-2']);
  });

  it('keeps a degraded store load distinct from a clean partial result', () => {
    const result = createRestoreResult({
      workspaceId: 'workspace_personal_local',
      degraded: true,
      attemptedTransactions: [{ id: 'txn-1' }],
      restoredTransactions: [],
      attemptedStatementRecords: [],
      restoredStatementRecords: [],
      restoredAccountCount: 0,
      attemptedOriginalFileIds: [],
      restoredOriginalFileIds: [],
    });

    expect(result.status).toBe('degraded');
    expect(result.degraded).toBe(true);
    expect(result.attemptedTransactionCount).toBe(1);
    expect(result.restoredTransactionCount).toBe(0);
  });

  it('marks dropped, malformed, duplicate and materially changed money rows as partial', () => {
    const result = createRestoreResult({
      workspaceId: 'workspace_personal_local',
      degraded: false,
      attemptedTransactions: [
        { id: 'txn-1', when: '2026-06-20', amount: -3.2, merchant: 'Coffee' },
        { id: 'txn-1', when: '2026-06-20', amount: -3.2, merchant: 'Coffee' },
        { id: 'txn-2', when: '2026-06-21', amount: -10, merchant: 'Rent' },
        { id: 'txn-3', amount: 'not-a-number' },
        { when: '2026-06-22', amount: -1 },
      ],
      restoredTransactions: [
        { id: 'txn-1', when: '2026-06-20', amount: -3.2, merchant: 'Coffee' },
        { id: 'txn-2', when: '2026-06-21', amount: -11, merchant: 'Rent' },
      ],
      attemptedStatementRecords: [],
      restoredStatementRecords: [],
      restoredAccountCount: 1,
      attemptedOriginalFileIds: ['doc-1', 'doc-1', 'doc-2'],
      restoredOriginalFileIds: ['doc-1'],
    });

    expect(result.status).toBe('partial');
    expect(result.missingTransactionIds).toEqual(['txn-3']);
    expect(result.droppedTransactionCount).toBe(3);
    expect(result.duplicateTransactionIdCount).toBe(1);
    expect(result.intactTransactionCount).toBe(1);
    expect(result.notRestoredTransactionCount).toBe(3);
    expect(result.changedTransactionIds).toEqual(['txn-2']);
    expect(result.missingOriginalFileCount).toBe(1);
  });

  it('counts one duplicate identity once across attempted and restored rows', () => {
    const result = createRestoreResult({
      workspaceId: 'workspace_personal_local',
      degraded: false,
      attemptedTransactions: [
        { id: 'txn-1', amount: -10 },
        { id: 'txn-1', amount: -10 },
      ],
      restoredTransactions: [
        { id: 'txn-1', amount: -10 },
        { id: 'txn-1', amount: -10 },
      ],
      attemptedStatementRecords: [],
      restoredStatementRecords: [],
      restoredAccountCount: 1,
      attemptedOriginalFileIds: [],
      restoredOriginalFileIds: [],
    });

    expect(result.duplicateTransactionIdCount).toBe(1);
    expect(result.status).toBe('partial');
  });

  it('reports a synthesized Personal account as changed', () => {
    const result = createRestoreResult({
      workspaceId: 'workspace_personal_local',
      degraded: false,
      attemptedTransactions: [],
      restoredTransactions: [],
      attemptedStatementRecords: [],
      restoredStatementRecords: [],
      restoredAccountCount: 1,
      attemptedAccounts: [],
      restoredAccounts: [{ id: 'acct-main', name: 'Main' }],
      attemptedOriginalFileIds: [],
      restoredOriginalFileIds: [],
    });

    expect(result.changedAccountCount).toBe(1);
    expect(result.status).toBe('partial');
  });

  it('does not mistake an ID-only legacy row for a changed row', () => {
    const result = createRestoreResult({
      workspaceId: 'workspace_personal_local',
      degraded: false,
      attemptedTransactions: [{ id: 'legacy-1' }],
      restoredTransactions: [
        { id: 'legacy-1', when: '2026-06-20', amount: -1, merchant: 'Coffee' },
      ],
      attemptedStatementRecords: [],
      restoredStatementRecords: [],
      restoredAccountCount: 1,
      attemptedOriginalFileIds: [],
      restoredOriginalFileIds: [],
    });

    expect(result.status).toBe('success');
    expect(result.changedTransactionIds).toEqual([]);
    expect(result.intactTransactionCount).toBe(1);
    expect(result.notRestoredTransactionCount).toBe(0);
  });

  it('counts a valid row absent after restore and a lost statement link independently', () => {
    const result = createRestoreResult({
      workspaceId: 'workspace_personal_local',
      degraded: false,
      attemptedTransactions: [{ id: 'txn-1', amount: -2 }],
      restoredTransactions: [],
      attemptedStatementRecords: [{ id: 'statement-1', sourceEvidenceId: 'doc-1' }],
      restoredStatementRecords: [{ id: 'statement-1' }],
      restoredAccountCount: 1,
      attemptedOriginalFileIds: ['doc-1'],
      restoredOriginalFileIds: [],
    });

    expect(result.status).toBe('partial');
    expect(result.missingTransactionIds).toEqual(['txn-1']);
    expect(result.droppedTransactionCount).toBe(1);
    expect(result.intactTransactionCount).toBe(0);
    expect(result.notRestoredTransactionCount).toBe(1);
    expect(result.unlinkedStatementRecordCount).toBe(1);
  });

  it('upgrades an older receipt conservatively and rejects a foreign or malformed receipt', () => {
    const old = normalizeRestoreResult(
      {
        workspaceId: 'workspace_personal_local',
        status: 'partial',
        degraded: false,
        attemptedTransactionCount: 2,
        restoredTransactionCount: 1,
        restoredAccountCount: 1,
        restoredOriginalFileCount: 0,
        missingOriginalFileCount: 1,
        unlinkedRecordCount: 1,
        unlinkedStatementRecordCount: 0,
        restoredTransactionIds: ['txn-1'],
        missingOriginalTransactionIds: ['txn-1'],
      },
      'workspace_personal_local',
    );
    expect(old?.intactTransactionCount).toBe(1);
    expect(old?.notRestoredTransactionCount).toBe(1);
    expect(old?.changedAccountCount).toBe(0);
    expect(normalizeRestoreResult(old, 'workspace_business_local')).toBeNull();
    expect(
      normalizeRestoreResult({ workspaceId: 'workspace_personal_local', status: 'success' }),
    ).toBeNull();
  });

  it('does not trust a success status when a legacy receipt records losses', () => {
    const result = normalizeRestoreResult(
      {
        workspaceId: 'workspace_personal_local',
        status: 'success',
        degraded: false,
        attemptedTransactionCount: 2,
        restoredTransactionCount: 2,
        intactTransactionCount: 2,
        restoredAccountCount: 1,
        restoredOriginalFileCount: 0,
        missingOriginalFileCount: 1,
        unlinkedRecordCount: 2,
        unlinkedStatementRecordCount: 1,
      },
      'workspace_personal_local',
    );
    expect(result?.status).toBe('partial');
    expect(result?.degraded).toBe(false);
  });

  it('keeps declared success partial when dropped or duplicate flags record a loss', () => {
    const base = {
      workspaceId: 'workspace_personal_local',
      status: 'success',
      degraded: false,
      attemptedTransactionCount: 2,
      restoredTransactionCount: 2,
      intactTransactionCount: 2,
      restoredAccountCount: 1,
      restoredOriginalFileCount: 0,
      missingOriginalFileCount: 0,
      unlinkedRecordCount: 0,
      unlinkedStatementRecordCount: 0,
    };
    expect(normalizeRestoreResult({ ...base, droppedTransactionCount: 1 })?.status).toBe('partial');
    expect(
      normalizeRestoreResult({ ...base, duplicateTransactionIdCount: 1 })?.status,
    ).toBe('partial');
  });

  it('rejects impossible persisted transaction counts instead of clamping them into a receipt', () => {
    const base = {
      workspaceId: 'workspace_personal_local',
      status: 'partial',
      degraded: false,
      attemptedTransactionCount: 1,
      restoredTransactionCount: 1,
      intactTransactionCount: 2,
      restoredAccountCount: 1,
    };
    expect(normalizeRestoreResult(base)).toBeNull();
  });

  it('rejects present malformed count and array fields instead of coercing them to zero', () => {
    const base = {
      workspaceId: 'workspace_personal_local',
      status: 'success',
      degraded: false,
      attemptedTransactionCount: 0,
      restoredTransactionCount: 0,
    };
    expect(normalizeRestoreResult({ ...base, changedAccountCount: '1' })).toBeNull();
    expect(normalizeRestoreResult({ ...base, changedTransactionIds: ['txn-1', 2] })).toBeNull();
    expect(normalizeRestoreResult({ ...base, degraded: 'false' })).toBeNull();
  });

  it('round-trips the explicit acknowledgement-failure marker without trusting malformed values', () => {
    const base = {
      workspaceId: 'workspace_personal_local',
      status: 'success',
      degraded: false,
      attemptedTransactionCount: 0,
      restoredTransactionCount: 0,
    };
    expect(
      normalizeRestoreResult({ ...base, acknowledgementFailed: true })?.acknowledgementFailed,
    ).toBe(true);
    expect(
      normalizeRestoreResult({
        ...base,
        acknowledgementFailed: true,
        acknowledgementNoticeAnnounced: true,
      })?.acknowledgementNoticeAnnounced,
    ).toBe(true);
    expect(normalizeRestoreResult({ ...base, acknowledgementFailed: 'true' })).not.toHaveProperty(
      'acknowledgementFailed',
    );
  });
});
