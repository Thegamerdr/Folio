import type { WorkspaceId } from '@folio/domain';
import { describe, expect, it } from 'vitest';

import {
  assertDatabaseDriverContract,
  createDataVersion,
  createPortableVault,
  DriverSearchIndexWriter,
  estimateScaleBenchmark,
  inspectDiagnosticBundle,
  InMemoryDatabaseDriver,
  invalidateProjectionsByDataVersion,
  LocalJobRepository,
  runVaultHealthChecks,
  sanitiseDiagnosticBundle,
  shouldResumeLocalJob,
  validatePortableVault,
} from '../src/index.js';

const workspaceId = 'workspace_personal_demo' as WorkspaceId;
const otherWorkspaceId = 'workspace_business_demo' as WorkspaceId;

describe('storage application foundation utilities', () => {
  it('provides an in-memory driver that satisfies the driver contract', async () => {
    await expect(
      assertDatabaseDriverContract(() => new InMemoryDatabaseDriver()),
    ).resolves.toBeUndefined();
  });

  it('upserts and removes workspace-scoped FTS index entries', async () => {
    const driver = new InMemoryDatabaseDriver();
    const writer = new DriverSearchIndexWriter(driver);

    await writer.upsert({
      workspaceId,
      entityType: 'transaction',
      entityId: 'txn_1',
      title: 'Coffee',
      body: 'Card payment',
      tags: ['food', 'daily'],
    });
    await writer.upsert({
      workspaceId,
      entityType: 'transaction',
      entityId: 'txn_1',
      title: 'Coffee corrected',
    });
    await writer.upsert({
      workspaceId: otherWorkspaceId,
      entityType: 'transaction',
      entityId: 'txn_2',
      title: 'Invoice',
    });
    await writer.clearWorkspace(workspaceId);

    expect(driver.searchEntries).toEqual([
      expect.objectContaining({
        workspace_id: otherWorkspaceId,
        entity_type: 'transaction',
        entity_id: 'txn_2',
      }),
    ]);
  });

  it('persists resumable local job checkpoints', async () => {
    const driver = new InMemoryDatabaseDriver();
    const jobs = new LocalJobRepository(driver);
    const now = new Date('2026-06-20T10:00:00.000Z');
    const retryAt = new Date('2026-06-20T10:05:00.000Z');

    await jobs.enqueue({
      id: 'job_import_1',
      workspaceId,
      kind: 'import',
      checkpoint: { offset: 0 },
      now,
    });
    await jobs.markRunning('job_import_1', now);
    await jobs.saveCheckpoint('job_import_1', { offset: 42 }, now);
    await jobs.fail('job_import_1', {
      errorCode: 'transient_io',
      runAfter: retryAt,
      now,
    });

    const job = await jobs.load('job_import_1');

    expect(job).toMatchObject({
      id: 'job_import_1',
      workspaceId,
      kind: 'import',
      state: 'failed',
      checkpoint: { offset: 42 },
      attempts: 1,
      lastErrorCode: 'transient_io',
      runAfter: retryAt.toISOString(),
    });
    expect(job === undefined ? false : shouldResumeLocalJob(job, now)).toBe(false);
    expect(job === undefined ? false : shouldResumeLocalJob(job, retryAt)).toBe(true);
  });

  it('invalidates only stale projections for the changed workspace data version', () => {
    const previousVersion = createDataVersion({ transactions: 1 });
    const nextVersion = createDataVersion({ transactions: 2 });

    expect(
      invalidateProjectionsByDataVersion({
        workspaceId,
        nextDataVersion: nextVersion,
        projections: [
          {
            workspaceId,
            kind: 'forecast',
            dataVersion: previousVersion,
            rebuiltAt: '2026-06-20T09:00:00.000Z',
          },
          {
            workspaceId,
            kind: 'search',
            dataVersion: nextVersion,
            rebuiltAt: '2026-06-20T09:00:00.000Z',
          },
          {
            workspaceId: otherWorkspaceId,
            kind: 'forecast',
            dataVersion: previousVersion,
            rebuiltAt: '2026-06-20T09:00:00.000Z',
          },
        ],
      }),
    ).toEqual([
      {
        workspaceId,
        kind: 'forecast',
        previousDataVersion: previousVersion,
        nextDataVersion: nextVersion,
        reason: 'data_version_changed',
      },
    ]);
  });

  it('creates and validates a portable vault export shape', () => {
    const vault = createPortableVault({
      exportedAt: new Date('2026-06-20T10:00:00.000Z'),
      schemaChecksum: 'sha256:abc123',
      tables: [
        {
          name: 'workspaces',
          rows: [{ id: workspaceId, name: 'Personal' }],
        },
      ],
    });

    expect(validatePortableVault(vault)).toEqual({ valid: true, issues: [] });
    expect(vault.tables[0]).toMatchObject({
      name: 'workspaces',
      rowCount: 1,
      checksum: expect.stringMatching(/^sha256:/),
    });

    expect(
      validatePortableVault({
        ...vault,
        tables: [{ ...vault.tables[0], rowCount: 3 }],
      }).issues,
    ).toContain('Portable vault table workspaces rowCount is inconsistent.');
  });

  it('runs health checks and estimates archive-scale risk', async () => {
    const driver = new InMemoryDatabaseDriver();
    const report = await runVaultHealthChecks(driver);
    const estimate = estimateScaleBenchmark({
      workspaceCount: 2,
      accountCount: 12,
      transactionCount: 250_000,
      eventCount: 3_000,
      documentCount: 1_000,
      searchIndexEntryCount: 120_000,
      backgroundJobCount: 5,
      forecastDayCount: 730,
    });

    expect(report.status).toBe('pass');
    expect(estimate.risk).toBe('watch');
    expect(estimate.notes.join(' ')).toMatch(/250k-row/);
  });

  it('allows only operational diagnostic summaries through the local export gate', () => {
    const inspection = inspectDiagnosticBundle({
      generatedAt: '2026-06-21T12:00:00.000Z',
      quickCheck: 'pass',
      searchIndexEntryCount: 120_000,
      pendingJobCount: 2,
      lastBackupAgeHours: 12,
    });

    expect(inspection).toEqual({
      safeForExport: true,
      findingCount: 0,
      findings: [],
    });
  });

  it('redacts secret and private financial diagnostic values without echoing the raw content', () => {
    const bundle = sanitiseDiagnosticBundle({
      quickCheck: 'pass',
      refreshToken: 'Bearer super-secret-provider-token',
      lastImport: {
        merchant: 'Roadside Repairs',
        amount: 'GBP 84.00',
      },
      supportEmail: 'person@example.test',
    });
    const serialised = JSON.stringify(bundle);

    expect(bundle.safeForExport).toBe(false);
    expect(bundle.redactedPaths).toEqual([
      '$.refreshToken',
      '$.lastImport.merchant',
      '$.lastImport.amount',
      '$.supportEmail',
    ]);
    expect(serialised).not.toContain('super-secret-provider-token');
    expect(serialised).not.toContain('Roadside Repairs');
    expect(serialised).not.toContain('GBP 84.00');
    expect(serialised).not.toContain('person@example.test');
    expect(bundle.findings.map((finding) => finding.kind)).toEqual([
      'secret',
      'financial_content',
      'financial_content',
      'private_identifier',
    ]);
  });
});
