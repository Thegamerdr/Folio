import { createJsonChecksum, type Checksum } from './checksum.js';
import type { AppliedMigration } from './migrations.js';
import { assertJsonRecord, isJsonValue, type JsonRecord } from './json.js';

export const PORTABLE_VAULT_FORMAT = 'folio.portable_vault';
export const PORTABLE_VAULT_FORMAT_VERSION = 1;

export type PortableVaultTable = Readonly<{
  name: string;
  rows: readonly JsonRecord[];
  rowCount: number;
  checksum: Checksum;
}>;

export type PortableVaultBlob = Readonly<{
  id: string;
  mediaType: string;
  sizeBytes: number;
  checksum: Checksum;
}>;

export type PortableVault = Readonly<{
  format: typeof PORTABLE_VAULT_FORMAT;
  formatVersion: typeof PORTABLE_VAULT_FORMAT_VERSION;
  exportedAt: string;
  schema: Readonly<{
    checksum: Checksum;
    sourcePath?: string;
  }>;
  migrations: readonly AppliedMigration[];
  tables: readonly PortableVaultTable[];
  blobs: readonly PortableVaultBlob[];
}>;

export type CreatePortableVaultInput = Readonly<{
  exportedAt?: Date;
  schemaChecksum: Checksum;
  schemaSourcePath?: string;
  migrations?: readonly AppliedMigration[];
  tables: readonly Readonly<{
    name: string;
    rows: readonly JsonRecord[];
  }>[];
  blobs?: readonly PortableVaultBlob[];
}>;

export type PortableVaultValidation = Readonly<{
  valid: boolean;
  issues: readonly string[];
}>;

export function createPortableVault(input: CreatePortableVaultInput): PortableVault {
  const tables = input.tables.map((table) => createPortableVaultTable(table.name, table.rows));
  const schema = {
    checksum: input.schemaChecksum,
    ...(input.schemaSourcePath === undefined ? {} : { sourcePath: input.schemaSourcePath }),
  };

  return {
    format: PORTABLE_VAULT_FORMAT,
    formatVersion: PORTABLE_VAULT_FORMAT_VERSION,
    exportedAt: (input.exportedAt ?? new Date()).toISOString(),
    schema,
    migrations: input.migrations ?? [],
    tables,
    blobs: input.blobs ?? [],
  };
}

export function validatePortableVault(input: unknown): PortableVaultValidation {
  const issues: string[] = [];
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, issues: ['Portable vault must be a JSON object.'] };
  }

  const vault = input as Partial<PortableVault>;
  if (vault.format !== PORTABLE_VAULT_FORMAT)
    issues.push('Portable vault format is not supported.');
  if (vault.formatVersion !== PORTABLE_VAULT_FORMAT_VERSION) {
    issues.push(`Portable vault format version must be ${PORTABLE_VAULT_FORMAT_VERSION}.`);
  }
  if (typeof vault.exportedAt !== 'string' || Number.isNaN(Date.parse(vault.exportedAt))) {
    issues.push('Portable vault exportedAt must be an ISO date string.');
  }
  if (
    vault.schema === undefined ||
    typeof vault.schema.checksum !== 'string' ||
    !vault.schema.checksum.startsWith('sha256:')
  ) {
    issues.push('Portable vault schema checksum is required.');
  }
  if (!Array.isArray(vault.tables)) {
    issues.push('Portable vault tables must be an array.');
  } else {
    for (const table of vault.tables) validatePortableVaultTable(table, issues);
  }
  if (vault.blobs !== undefined && !Array.isArray(vault.blobs)) {
    issues.push('Portable vault blobs must be an array.');
  }
  if (vault.migrations !== undefined && !Array.isArray(vault.migrations)) {
    issues.push('Portable vault migrations must be an array.');
  }

  return { valid: issues.length === 0, issues };
}

export function assertPortableVault(input: unknown): asserts input is PortableVault {
  const validation = validatePortableVault(input);
  if (!validation.valid) {
    throw new Error(`Portable vault is invalid: ${validation.issues.join(' ')}`);
  }
}

function createPortableVaultTable(name: string, rows: readonly JsonRecord[]): PortableVaultTable {
  validateTableName(name);
  for (const [index, row] of rows.entries()) {
    assertJsonRecord(row, `${name}[${index}]`);
  }

  return {
    name,
    rows,
    rowCount: rows.length,
    checksum: createJsonChecksum({ name, rows }),
  };
}

function validatePortableVaultTable(table: unknown, issues: string[]): void {
  if (table === null || typeof table !== 'object' || Array.isArray(table)) {
    issues.push('Portable vault table entries must be objects.');
    return;
  }
  const candidate = table as Partial<PortableVaultTable>;
  if (typeof candidate.name !== 'string' || !isTableName(candidate.name)) {
    issues.push('Portable vault table names must be safe SQL identifiers.');
  }
  if (!Array.isArray(candidate.rows)) {
    issues.push(`Portable vault table ${candidate.name ?? '<unknown>'} rows must be an array.`);
    return;
  }
  if (candidate.rowCount !== candidate.rows.length) {
    issues.push(`Portable vault table ${candidate.name ?? '<unknown>'} rowCount is inconsistent.`);
  }
  if (typeof candidate.checksum !== 'string' || !candidate.checksum.startsWith('sha256:')) {
    issues.push(`Portable vault table ${candidate.name ?? '<unknown>'} checksum is required.`);
  }
  for (const row of candidate.rows) {
    if (!isJsonValue(row) || row === null || typeof row !== 'object' || Array.isArray(row)) {
      issues.push(
        `Portable vault table ${candidate.name ?? '<unknown>'} contains a non-object row.`,
      );
      break;
    }
  }
}

function validateTableName(name: string): void {
  if (!isTableName(name)) {
    throw new Error(`Portable vault table name must be a safe SQL identifier: ${name}.`);
  }
}

function isTableName(name: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(name);
}
