import { defineMigration, type AppliedMigration, type MigrationPlan } from './migrations.js';

export const canonicalSqliteRepositoryMigrationTable = 'canonical_repository_migrations';

export const canonicalSqliteRepositorySchemaVersion = 4;

export const canonicalSqliteCollectionTables = {
  workspaces: 'workspaces',
  accounts: 'accounts',
  balanceObservations: 'balance_observations',
  currentBalances: 'current_balances',
  balanceAdjustments: 'balance_adjustments',
  availablePositionSnapshots: 'available_position_snapshots',
  sourceRecords: 'source_records',
  provenance: 'provenance_records',
  parsedRows: 'parsed_rows',
  importedClaims: 'imported_claims',
  importDrafts: 'import_drafts',
  userCorrections: 'user_corrections',
  transactions: 'transactions',
  events: 'events',
  commitments: 'commitments',
  expectations: 'expectations',
  plannerItems: 'planner_items',
  plans: 'plans',
  planRules: 'plan_rules',
  scenarios: 'scenarios',
  planImpacts: 'plan_impacts',
  forecastSnapshots: 'forecast_snapshots',
  decisions: 'decision_records',
  documents: 'documents',
  documentAttachments: 'document_attachments',
  calendarItems: 'calendar_items',
  timelineEntries: 'timeline_entries',
  meloMemory: 'melo_memory',
  meloProposals: 'melo_proposals',
  auditLog: 'audit_log',
} as const;

export type CanonicalSqliteCollectionTable =
  (typeof canonicalSqliteCollectionTables)[keyof typeof canonicalSqliteCollectionTables];

export const canonicalSqliteRepositoryMigrations = [
  defineMigration({
    version: 1,
    name: 'canonical_repository_v1',
    sql: `
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_accounts_workspace_id ON accounts(workspace_id, id);

      CREATE TABLE IF NOT EXISTS source_records (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_source_records_workspace_id ON source_records(workspace_id, id);

      CREATE TABLE IF NOT EXISTS provenance_records (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_provenance_records_workspace_id ON provenance_records(workspace_id, id);

      CREATE TABLE IF NOT EXISTS import_drafts (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_import_drafts_workspace_id ON import_drafts(workspace_id, id);

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_workspace_id ON transactions(workspace_id, id);

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_events_workspace_id ON events(workspace_id, id);

      CREATE TABLE IF NOT EXISTS commitments (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_commitments_workspace_id ON commitments(workspace_id, id);

      CREATE TABLE IF NOT EXISTS expectations (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_expectations_workspace_id ON expectations(workspace_id, id);

      CREATE TABLE IF NOT EXISTS planner_items (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_planner_items_workspace_id ON planner_items(workspace_id, id);

      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_plans_workspace_id ON plans(workspace_id, id);

      CREATE TABLE IF NOT EXISTS scenarios (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_scenarios_workspace_id ON scenarios(workspace_id, id);

      CREATE TABLE IF NOT EXISTS forecast_snapshots (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_forecast_snapshots_workspace_id ON forecast_snapshots(workspace_id, id);

      CREATE TABLE IF NOT EXISTS decision_records (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_decision_records_workspace_id ON decision_records(workspace_id, id);

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_documents_workspace_id ON documents(workspace_id, id);

      CREATE TABLE IF NOT EXISTS calendar_items (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_calendar_items_workspace_id ON calendar_items(workspace_id, id);

      CREATE TABLE IF NOT EXISTS timeline_entries (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_timeline_entries_workspace_id ON timeline_entries(workspace_id, id);

      CREATE TABLE IF NOT EXISTS melo_memory (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_melo_memory_workspace_id ON melo_memory(workspace_id, id);

      CREATE TABLE IF NOT EXISTS melo_proposals (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_melo_proposals_workspace_id ON melo_proposals(workspace_id, id);

      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT,
        command_type TEXT NOT NULL,
        actor_kind TEXT NOT NULL,
        actor_ref TEXT,
        entity_refs_json TEXT NOT NULL,
        delta_json TEXT NOT NULL,
        provenance_json TEXT,
        device_id TEXT,
        reversal_of_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_command ON audit_log(workspace_id, command_type, created_at, id);
    `,
  }),
  defineMigration({
    version: 2,
    name: 'canonical_balance_authority_v2',
    sql: `
      CREATE TABLE IF NOT EXISTS balance_observations (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_balance_observations_workspace_id ON balance_observations(workspace_id, id);

      CREATE TABLE IF NOT EXISTS current_balances (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_current_balances_workspace_id ON current_balances(workspace_id, id);

      CREATE TABLE IF NOT EXISTS balance_adjustments (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_balance_adjustments_workspace_id ON balance_adjustments(workspace_id, id);

      CREATE TABLE IF NOT EXISTS available_position_snapshots (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_available_position_snapshots_workspace_id ON available_position_snapshots(workspace_id, id);
    `,
  }),
  defineMigration({
    version: 3,
    name: 'canonical_plan_recovery_v3',
    sql: `
      CREATE TABLE IF NOT EXISTS plan_rules (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_plan_rules_workspace_id ON plan_rules(workspace_id, id);

      CREATE TABLE IF NOT EXISTS plan_impacts (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_plan_impacts_workspace_id ON plan_impacts(workspace_id, id);
    `,
  }),
  defineMigration({
    version: canonicalSqliteRepositorySchemaVersion,
    name: 'canonical_import_document_review_v4',
    sql: `
      CREATE TABLE IF NOT EXISTS parsed_rows (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_parsed_rows_workspace_id ON parsed_rows(workspace_id, id);

      CREATE TABLE IF NOT EXISTS imported_claims (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_imported_claims_workspace_id ON imported_claims(workspace_id, id);

      CREATE TABLE IF NOT EXISTS user_corrections (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_user_corrections_workspace_id ON user_corrections(workspace_id, id);

      CREATE TABLE IF NOT EXISTS document_attachments (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_document_attachments_workspace_id ON document_attachments(workspace_id, id);
    `,
  }),
] as const;

export type CanonicalSqliteRepositoryMigrationPlan = MigrationPlan;

export type CanonicalSqliteRepositoryAppliedMigration = AppliedMigration;
