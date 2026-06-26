import { createChecksum, normalizeLineEndings, type Checksum } from './checksum.js';
import { defineMigration, type ChecksummedMigration } from './migrations.js';

export const CANONICAL_SCHEMA_SOURCE_PATH = 'docs/source-package/schemas/database.sql';

export const CANONICAL_SCHEMA_REQUIRED_TABLES = [
  'schema_migrations',
  'vault_metadata',
  'workspaces',
  'accounts',
  'source_records',
  'provenance',
  'import_drafts',
  'transactions',
  'events',
  'commitments',
  'expectations',
  'planner_items',
  'plans',
  'scenarios',
  'forecast_snapshots',
  'decision_records',
  'documents',
  'calendar_items',
  'timeline_entries',
  'melo_memories',
  'melo_proposals',
  'background_jobs',
  'audit_log',
  'sync_outbox',
  'sync_inbox',
  'tombstones',
  'search_index',
] as const;

export const CANONICAL_SCHEMA_REQUIRED_VIEWS = [
  'v_posted_transactions',
  'v_active_events',
] as const;

export const CANONICAL_SCHEMA_REQUIRED_TRIGGERS = [
  'business_profile_workspace_guard',
  'clients_workspace_guard',
  'invoices_workspace_guard',
] as const;

export type SchemaObjectKind = 'table' | 'view' | 'trigger';

export type SchemaValidationIssue = Readonly<{
  code: string;
  severity: 'error' | 'warning';
  message: string;
}>;

export type CanonicalSchemaSnapshot = Readonly<{
  sourcePath: string;
  checksum: Checksum;
  tables: readonly string[];
  views: readonly string[];
  triggers: readonly string[];
}>;

export type CanonicalSchemaValidation = Readonly<{
  valid: boolean;
  snapshot: CanonicalSchemaSnapshot;
  issues: readonly SchemaValidationIssue[];
}>;

export function normalizeSchemaSql(sql: string): string {
  return normalizeLineEndings(sql)
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

export function createCanonicalSchemaSnapshot(
  sql: string,
  sourcePath = CANONICAL_SCHEMA_SOURCE_PATH,
): CanonicalSchemaSnapshot {
  const normalized = normalizeSchemaSql(sql);
  return {
    sourcePath,
    checksum: createChecksum(normalized),
    tables: extractSchemaObjectNames(normalized, 'table'),
    views: extractSchemaObjectNames(normalized, 'view'),
    triggers: extractSchemaObjectNames(normalized, 'trigger'),
  };
}

export function validateCanonicalSchemaString(
  sql: string,
  sourcePath = CANONICAL_SCHEMA_SOURCE_PATH,
): CanonicalSchemaValidation {
  const normalized = normalizeSchemaSql(sql);
  const snapshot = createCanonicalSchemaSnapshot(normalized, sourcePath);
  const issues: SchemaValidationIssue[] = [];

  if (normalized.length === 0) {
    issues.push({
      code: 'schema.empty',
      severity: 'error',
      message: 'Canonical schema SQL is empty.',
    });
  }

  for (const table of CANONICAL_SCHEMA_REQUIRED_TABLES) {
    if (!snapshot.tables.includes(table)) {
      issues.push({
        code: 'schema.missing_table',
        severity: 'error',
        message: `Canonical schema is missing required table ${table}.`,
      });
    }
  }

  for (const view of CANONICAL_SCHEMA_REQUIRED_VIEWS) {
    if (!snapshot.views.includes(view)) {
      issues.push({
        code: 'schema.missing_view',
        severity: 'warning',
        message: `Canonical schema is missing expected view ${view}.`,
      });
    }
  }

  for (const trigger of CANONICAL_SCHEMA_REQUIRED_TRIGGERS) {
    if (!snapshot.triggers.includes(trigger)) {
      issues.push({
        code: 'schema.missing_trigger',
        severity: 'warning',
        message: `Canonical schema is missing expected trigger ${trigger}.`,
      });
    }
  }

  if (!/\bPRAGMA\s+foreign_keys\s*=\s*ON\b/i.test(normalized)) {
    issues.push({
      code: 'schema.foreign_keys_off',
      severity: 'error',
      message: 'Canonical schema must enable SQLite foreign keys.',
    });
  }

  if (!/\bCREATE\s+VIRTUAL\s+TABLE\s+search_index\s+USING\s+fts5\b/i.test(normalized)) {
    issues.push({
      code: 'schema.fts_missing',
      severity: 'error',
      message: 'Canonical schema must define the FTS5 search_index table.',
    });
  }

  return {
    valid: issues.every((issue) => issue.severity !== 'error'),
    snapshot,
    issues,
  };
}

export function createCanonicalSchemaMigration(sql: string): ChecksummedMigration {
  const validation = validateCanonicalSchemaString(sql);
  if (!validation.valid) {
    const errors = validation.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => issue.message)
      .join(' ');
    throw new Error(`Canonical schema is not valid. ${errors}`);
  }

  return defineMigration({
    version: 1,
    name: 'canonical_schema',
    sql: normalizeSchemaSql(sql),
  });
}

export function extractSchemaObjectNames(sql: string, kind: SchemaObjectKind): readonly string[] {
  const names = new Set<string>();
  const objectPattern =
    kind === 'table'
      ? /\bCREATE\s+(?:VIRTUAL\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi
      : new RegExp(
          `\\bCREATE\\s+${kind.toUpperCase()}\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?([a-zA-Z_][a-zA-Z0-9_]*)`,
          'gi',
        );

  for (const match of sql.matchAll(objectPattern)) {
    const name = match[1];
    if (name !== undefined) names.add(name);
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}
