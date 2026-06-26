import type { WorkspaceId } from '@folio/domain';
import { describe, expect, it } from 'vitest';

import {
  CommandBus,
  importCommitCommandType,
  InMemoryDatabaseDriver,
  registerImportCommitCommand,
} from '../src/index.js';

const workspaceId = 'workspace_personal_demo' as WorkspaceId;

describe('Phase 5 import commit command', () => {
  it('indexes accepted rows, queues rebuild work, and audits in one command transaction', async () => {
    const driver = new InMemoryDatabaseDriver();
    const bus = new CommandBus(driver, {
      idFactory: () => 'audit_import_1',
      now: () => new Date('2026-06-21T10:00:00.000Z'),
    });
    registerImportCommitCommand(bus, {
      now: () => new Date('2026-06-21T10:00:00.000Z'),
    });

    const outcome = await bus.execute({
      type: importCommitCommandType,
      workspaceId,
      actor: { kind: 'import', ref: 'import_job_phase5' },
      input: {
        importJobId: 'import_job_phase5',
        sourceFileId: 'source_file_statement',
        acceptedRows: [
          {
            transactionId: 'txn_import_1',
            title: 'Coffee',
            searchText: '2026-01-02 Coffee GBP -350',
            sourceRowId: 'csv:2',
            provenanceHash: 'hash_1',
            tags: ['csv'],
          },
          {
            transactionId: 'txn_import_2',
            title: 'Payroll',
            searchText: '2026-01-03 Payroll GBP 250000',
            sourceRowId: 'csv:3',
            provenanceHash: 'hash_2',
            tags: ['csv'],
          },
        ],
        rebuildKinds: ['search', 'forecast'],
      },
    });

    expect(outcome.result).toMatchObject({
      importJobId: 'import_job_phase5',
      committedRowCount: 2,
      indexedRowCount: 2,
      commitProofChecksum: expect.stringMatching(/^sha256:/),
      caveat: 'domain-row-writes-await-vault-repository',
    });
    expect(outcome.invalidatedProjectionKinds).toEqual(['search', 'forecast']);
    expect(driver.searchEntries).toHaveLength(2);
    expect(driver.backgroundJobEntries.map((job) => job.kind)).toEqual([
      'rebuild.search',
      'rebuild.forecast',
    ]);
    expect(driver.auditEntries).toHaveLength(1);
    expect(driver.auditEntries[0]?.id).toBe('audit_import_1');
  });

  it('rolls back search, job, and audit writes if import commit work fails', async () => {
    const driver = new InMemoryDatabaseDriver();
    const bus = new CommandBus(driver);
    registerImportCommitCommand(bus, { failAfterSearchUpserts: 1 });

    await expect(
      bus.execute({
        type: importCommitCommandType,
        workspaceId,
        actor: { kind: 'import', ref: 'import_job_phase5' },
        input: {
          importJobId: 'import_job_phase5',
          acceptedRows: [{ transactionId: 'txn_import_1', title: 'Coffee' }],
        },
      }),
    ).rejects.toThrow(/Injected import commit failure/);

    expect(driver.searchEntries).toEqual([]);
    expect(driver.backgroundJobEntries).toEqual([]);
    expect(driver.auditEntries).toEqual([]);
  });
});
