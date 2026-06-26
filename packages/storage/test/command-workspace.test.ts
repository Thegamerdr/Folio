import type { WorkspaceId } from '@folio/domain';
import { describe, expect, it } from 'vitest';

import {
  CommandBus,
  createAuditLogProof,
  createCompactAuditDelta,
  createStoredAuditLogProof,
  InMemoryDatabaseDriver,
  type DatabaseDriver,
  type QueryResult,
  type SqlValue,
  verifyStoredAuditLogProof,
  WorkspaceScopedRepositoryBase,
  writeAuditLogEntry,
} from '../src/index.js';

const workspaceId = 'workspace_personal_demo' as WorkspaceId;
const otherWorkspaceId = 'workspace_business_demo' as WorkspaceId;

class ExampleWorkspaceRepository extends WorkspaceScopedRepositoryBase {
  constructor(driver: DatabaseDriver, workspaceId: WorkspaceId) {
    super(driver, workspaceId);
  }

  async read(sql: string, params: readonly SqlValue[] = [this.workspaceId]): Promise<QueryResult> {
    return this.executeWorkspaceSql(sql, params);
  }

  assertInputWorkspace(inputWorkspaceId: WorkspaceId): void {
    this.assertWorkspaceId(inputWorkspaceId);
  }
}

describe('workspace-scoped repositories and atomic command bus', () => {
  it('fails closed when scoped repository SQL omits workspace_id', async () => {
    const repository = new ExampleWorkspaceRepository(new InMemoryDatabaseDriver(), workspaceId);

    await expect(repository.read('SELECT * FROM transactions WHERE id = ?')).rejects.toThrow(
      /workspace_id/,
    );
    await expect(
      repository.read('SELECT * FROM transactions WHERE workspace_id = ?'),
    ).resolves.toMatchObject({ rows: [] });
    expect(() => repository.assertInputWorkspace(otherWorkspaceId)).toThrow(/does not match/);
  });

  it('writes compact command audit entries in the same transaction', async () => {
    const driver = new InMemoryDatabaseDriver();
    const bus = new CommandBus(driver, {
      idFactory: () => 'audit_1',
      now: () => new Date('2026-06-20T12:00:00.000Z'),
    });

    bus.register('record_transaction', async () => ({
      result: { transactionId: 'txn_1' },
      changedEntityIds: ['txn_1'],
      invalidatedProjectionKinds: ['forecast', 'search'],
      audit: {
        entityRefs: [{ type: 'transaction', id: 'txn_1' }],
        delta: createCompactAuditDelta({
          before: {},
          after: { amountMinor: -1299, description: 'Lunch' },
        }),
      },
    }));

    const outcome = await bus.execute({
      type: 'record_transaction',
      workspaceId,
      actor: { kind: 'user', ref: 'local_user' },
      input: {},
    });

    expect(outcome).toMatchObject({
      result: { transactionId: 'txn_1' },
      changedEntityIds: ['txn_1'],
      invalidatedProjectionKinds: ['forecast', 'search'],
      auditEntryId: 'audit_1',
    });
    expect(driver.auditEntries).toHaveLength(1);
    expect(driver.auditEntries[0]).toMatchObject({
      id: 'audit_1',
      workspace_id: workspaceId,
      command_type: 'record_transaction',
      created_at: '2026-06-20T12:00:00.000Z',
    });
    expect(driver.auditEntries[0]?.delta_json).not.toContain('Lunch');
  });

  it('creates deterministic local audit proofs without exposing sensitive deltas', async () => {
    const driver = new InMemoryDatabaseDriver();
    const entry = await writeAuditLogEntry(
      driver,
      {
        id: 'audit_proof_1',
        workspaceId,
        commandType: 'record_transaction',
        actorKind: 'user',
        actorRef: 'local_user',
        entityRefs: [{ type: 'transaction', id: 'txn_proof_1' }],
        delta: createCompactAuditDelta({
          after: { amountMinor: -5000, description: 'Synthetic sensitive merchant' },
        }),
        provenance: { source: 'synthetic_fixture' },
        deviceId: 'device_local_1',
      },
      { now: () => new Date('2026-06-21T10:00:00.000Z') },
    );
    const fromEntry = createAuditLogProof(entry);
    const stored = driver.auditEntries[0];

    expect(stored).toBeDefined();
    if (stored === undefined) throw new Error('Expected stored audit entry.');

    const fromStored = createStoredAuditLogProof(stored);

    expect(fromStored).toEqual(fromEntry);
    expect(fromStored).toMatchObject({
      auditEntryId: 'audit_proof_1',
      workspaceId,
      commandType: 'record_transaction',
      entityRefCount: 1,
      deviceId: 'device_local_1',
    });
    expect(fromStored.deltaChecksum).toMatch(/^sha256:/);
    expect(JSON.stringify(fromStored)).not.toContain('Synthetic sensitive merchant');
    expect(verifyStoredAuditLogProof(stored, fromEntry)).toBe(true);
    expect(
      verifyStoredAuditLogProof(
        {
          ...stored,
          delta_json: stored.delta_json.replace('sha256:', 'sha256:tampered'),
        },
        fromEntry,
      ),
    ).toBe(false);
  });

  it('rolls back command writes when a handler throws', async () => {
    const driver = new InMemoryDatabaseDriver();
    const bus = new CommandBus(driver);

    bus.register('fail_after_audit', async ({ driver: transactionDriver }) => {
      await writeAuditLogEntry(transactionDriver, {
        id: 'audit_should_rollback',
        workspaceId,
        commandType: 'fail_after_audit',
        actorKind: 'system',
        entityRefs: [{ type: 'transaction', id: 'txn_rollback' }],
        delta: createCompactAuditDelta({ after: { state: 'created' } }),
      });
      throw new Error('boom');
    });

    await expect(
      bus.execute({
        type: 'fail_after_audit',
        workspaceId,
        actor: { kind: 'system' },
        input: {},
      }),
    ).rejects.toThrow(/boom/);

    expect(driver.auditEntries).toEqual([]);
  });
});
