import type { WorkspaceId } from '@folio/domain';

import { createCompactAuditDelta, type EntityRef } from './audit.js';
import { createJsonChecksum, type Checksum } from './checksum.js';
import type { CommandBus, CommandHandler } from './command-bus.js';
import { assertJsonRecord, type JsonRecord, type JsonValue } from './json.js';
import { LocalJobRepository } from './jobs.js';
import { DriverSearchIndexWriter } from './search-index.js';

export const importCommitCommandType = 'import.commit_reviewed_rows';

export type ImportCommitRowInput = Readonly<{
  transactionId: string;
  title: string;
  searchText?: string;
  sourceRowId?: string;
  provenanceHash?: string;
  tags?: readonly string[];
}>;

export type ImportCommitCommandInput = Readonly<{
  importJobId: string;
  sourceFileId?: string;
  acceptedRows: readonly ImportCommitRowInput[];
  rebuildKinds?: readonly string[];
}>;

export type ImportCommitResult = Readonly<{
  importJobId: string;
  committedRowCount: number;
  indexedRowCount: number;
  queuedRebuildJobs: readonly string[];
  commitProofChecksum: Checksum;
  caveat: 'domain-row-writes-await-vault-repository';
}>;

export type ImportCommitHandlerOptions = Readonly<{
  now?: () => Date;
  failAfterSearchUpserts?: number;
}>;

type NormalizedImportCommitInput = Readonly<{
  importJobId: string;
  sourceFileId?: string;
  acceptedRows: readonly ImportCommitRowInput[];
  rebuildKinds: readonly string[];
}>;

export function registerImportCommitCommand(
  bus: Pick<CommandBus, 'register'>,
  options: ImportCommitHandlerOptions = {},
): void {
  bus.register(importCommitCommandType, createImportCommitHandler(options));
}

export function createImportCommitHandler(
  options: ImportCommitHandlerOptions = {},
): CommandHandler<JsonRecord, ImportCommitResult> {
  return async ({ driver, command }) => {
    if (command.workspaceId === undefined) {
      throw new Error('Import commits require a workspaceId.');
    }

    const input = parseImportCommitInput(command.input);
    const workspaceId = command.workspaceId;
    const searchWriter = new DriverSearchIndexWriter(driver);
    const jobRepository = new LocalJobRepository(driver);
    const indexedIds: string[] = [];

    for (const row of input.acceptedRows) {
      await searchWriter.upsert({
        workspaceId,
        entityType: 'transaction',
        entityId: row.transactionId,
        title: row.title,
        body: row.searchText ?? '',
        tags: buildSearchTags(input, row),
      });
      indexedIds.push(row.transactionId);

      if (
        options.failAfterSearchUpserts !== undefined &&
        indexedIds.length >= options.failAfterSearchUpserts
      ) {
        throw new Error('Injected import commit failure after search upsert.');
      }
    }

    const queuedRebuildJobs: string[] = [];
    for (const kind of input.rebuildKinds) {
      const jobId = `job_${sanitizeId(input.importJobId)}_${sanitizeId(kind)}_rebuild`;
      const now = options.now?.();
      await jobRepository.enqueue({
        id: jobId,
        kind: `rebuild.${kind}`,
        workspaceId,
        checkpoint: {
          importJobId: input.importJobId,
          sourceFileId: input.sourceFileId ?? null,
          acceptedRowCount: input.acceptedRows.length,
        },
        ...(now === undefined ? {} : { now }),
      });
      queuedRebuildJobs.push(jobId);
    }

    const entityRefs: EntityRef[] = [
      { type: 'import_job', id: input.importJobId },
      ...input.acceptedRows.map((row) => ({ type: 'transaction', id: row.transactionId })),
    ];

    return {
      result: {
        importJobId: input.importJobId,
        committedRowCount: input.acceptedRows.length,
        indexedRowCount: indexedIds.length,
        queuedRebuildJobs,
        commitProofChecksum: createJsonChecksum({
          importJobId: input.importJobId,
          sourceFileId: input.sourceFileId ?? null,
          acceptedRows: input.acceptedRows.map((row) => ({
            transactionId: row.transactionId,
            sourceRowId: row.sourceRowId ?? null,
            provenanceHash: row.provenanceHash ?? null,
          })),
          rebuildKinds: input.rebuildKinds,
        }),
        caveat: 'domain-row-writes-await-vault-repository',
      },
      changedEntityIds: input.acceptedRows.map((row) => row.transactionId),
      invalidatedProjectionKinds: input.rebuildKinds,
      audit: {
        entityRefs,
        delta: createCompactAuditDelta({
          after: {
            importJobId: input.importJobId,
            acceptedRowCount: input.acceptedRows.length,
            indexedRowCount: indexedIds.length,
            rebuildKinds: input.rebuildKinds,
          },
        }),
        provenance: {
          sourceFileId: input.sourceFileId ?? null,
          storageSlice: 'phase5-import-commit-command',
        },
      },
    };
  };
}

function parseImportCommitInput(input: JsonRecord): NormalizedImportCommitInput {
  const importJobId = readRequiredString(input.importJobId, 'importJobId');
  const sourceFileId = readOptionalString(input.sourceFileId, 'sourceFileId');
  const acceptedRows = readJsonRecordArray(input.acceptedRows, 'acceptedRows').map((row, index) =>
    parseImportCommitRow(row, `acceptedRows[${index}]`),
  );
  if (acceptedRows.length === 0) {
    throw new Error('Import commits require at least one accepted row.');
  }
  const rebuildKinds = readOptionalStringArray(input.rebuildKinds, 'rebuildKinds') ?? [
    'search',
    'forecast',
    'events',
  ];

  return {
    importJobId,
    acceptedRows,
    rebuildKinds,
    ...(sourceFileId === undefined ? {} : { sourceFileId }),
  };
}

function parseImportCommitRow(row: JsonRecord, label: string): ImportCommitRowInput {
  const transactionId = readRequiredString(row.transactionId, `${label}.transactionId`);
  const title = readRequiredString(row.title, `${label}.title`);
  const searchText = readOptionalString(row.searchText, `${label}.searchText`);
  const sourceRowId = readOptionalString(row.sourceRowId, `${label}.sourceRowId`);
  const provenanceHash = readOptionalString(row.provenanceHash, `${label}.provenanceHash`);
  const tags = readOptionalStringArray(row.tags, `${label}.tags`);

  return {
    transactionId,
    title,
    ...(searchText === undefined ? {} : { searchText }),
    ...(sourceRowId === undefined ? {} : { sourceRowId }),
    ...(provenanceHash === undefined ? {} : { provenanceHash }),
    ...(tags === undefined ? {} : { tags }),
  };
}

function buildSearchTags(
  input: NormalizedImportCommitInput,
  row: ImportCommitRowInput,
): readonly string[] {
  return [
    'imported',
    input.importJobId,
    ...(input.sourceFileId === undefined ? [] : [input.sourceFileId]),
    ...(row.sourceRowId === undefined ? [] : [row.sourceRowId]),
    ...(row.provenanceHash === undefined ? [] : [row.provenanceHash]),
    ...(row.tags ?? []),
  ];
}

function readJsonRecordArray(value: JsonValue | undefined, label: string): readonly JsonRecord[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  value.forEach((item, index) => assertJsonRecord(item, `${label}[${index}]`));
  return value as readonly JsonRecord[];
}

function readRequiredString(value: JsonValue | undefined, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function readOptionalString(value: JsonValue | undefined, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string when supplied.`);
  }
  return value;
}

function readOptionalStringArray(
  value: JsonValue | undefined,
  label: string,
): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${label} must be an array of strings.`);
  }
  return value;
}

function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
