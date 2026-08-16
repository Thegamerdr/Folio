import { defineMigration, type AppliedMigration, type MigrationPlan } from './migrations.js';

export const canonicalSqliteRepositoryMigrationTable = 'canonical_repository_migrations';

export const canonicalSqliteRepositorySchemaVersion = 9;

export const decisionLedgerSqliteTables = {
  entries: 'decision_ledger_entries',
  scenarios: 'decision_ledger_scenarios',
  outcomes: 'decision_ledger_outcomes',
  corrections: 'decision_ledger_corrections',
  auditEvents: 'decision_ledger_audit_events',
  forecastEvaluations: 'forecast_evaluations',
} as const;

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
  pots: 'pots',
  potLedgerEntries: 'pot_ledger_entries',
  subscriptions: 'subscriptions',
  subscriptionPreferences: 'subscription_preferences',
  cycleRecords: 'cycle_records',
  debts: 'debts',
  financialContexts: 'financial_contexts',
  incomeSchedules: 'income_schedules',
  transactionIntelligenceStates: 'transaction_intelligence_states',
  companionRuntimeStates: 'companion_runtime_states',
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
    version: 4,
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
  defineMigration({
    version: 5,
    name: 'canonical_durable_money_containers_v5',
    sql: `
      CREATE TABLE IF NOT EXISTS pots (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_pots_workspace_id ON pots(workspace_id, id);

      CREATE TABLE IF NOT EXISTS pot_ledger_entries (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_pot_ledger_entries_workspace_id ON pot_ledger_entries(workspace_id, id);

      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_id ON subscriptions(workspace_id, id);

      CREATE TABLE IF NOT EXISTS subscription_preferences (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_subscription_preferences_workspace_id ON subscription_preferences(workspace_id, id);

      CREATE TABLE IF NOT EXISTS cycle_records (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_cycle_records_workspace_id ON cycle_records(workspace_id, id);

      CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_debts_workspace_id ON debts(workspace_id, id);
    `,
  }),
  defineMigration({
    version: 6,
    name: 'canonical_financial_context_v6',
    sql: `
      CREATE TABLE IF NOT EXISTS financial_contexts (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_financial_contexts_workspace_id
        ON financial_contexts(workspace_id, id);
    `,
  }),
  defineMigration({
    version: 7,
    name: 'canonical_route_planning_v7',
    sql: `
      CREATE TABLE IF NOT EXISTS income_schedules (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_income_schedules_workspace_id
        ON income_schedules(workspace_id, id);
    `,
  }),
  defineMigration({
    version: 8,
    name: 'canonical_private_runtime_state_v8',
    sql: `
      CREATE TABLE IF NOT EXISTS transaction_intelligence_states (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_transaction_intelligence_states_workspace_id
        ON transaction_intelligence_states(workspace_id, id);

      CREATE TABLE IF NOT EXISTS companion_runtime_states (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_companion_runtime_states_workspace_id
        ON companion_runtime_states(workspace_id, id);
    `,
  }),
  defineMigration({
    version: canonicalSqliteRepositorySchemaVersion,
    name: 'canonical_decision_ledger_v9',
    sql: `
      CREATE TABLE IF NOT EXISTS decision_ledger_entries (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        decision_type TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        record_json TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_decision_ledger_entries_workspace_status
        ON decision_ledger_entries(workspace_id, status, created_at, id);

      CREATE TABLE IF NOT EXISTS decision_ledger_scenarios (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        decision_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_decision_ledger_scenarios_decision
        ON decision_ledger_scenarios(workspace_id, decision_id, id);

      CREATE TABLE IF NOT EXISTS decision_ledger_outcomes (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        decision_id TEXT NOT NULL,
        outcome_state TEXT NOT NULL,
        checked_at TEXT,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_decision_ledger_outcomes_decision
        ON decision_ledger_outcomes(workspace_id, decision_id, checked_at, id);

      CREATE TABLE IF NOT EXISTS decision_ledger_corrections (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        decision_id TEXT NOT NULL,
        corrected_at TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_decision_ledger_corrections_decision
        ON decision_ledger_corrections(workspace_id, decision_id, corrected_at, id);

      CREATE TABLE IF NOT EXISTS decision_ledger_audit_events (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        decision_id TEXT NOT NULL,
        action TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_decision_ledger_audit_events_decision
        ON decision_ledger_audit_events(workspace_id, decision_id, occurred_at, id);

      CREATE TABLE IF NOT EXISTS forecast_evaluations (
        id TEXT PRIMARY KEY NOT NULL,
        workspace_id TEXT NOT NULL,
        decision_id TEXT NOT NULL,
        forecast_version_id TEXT NOT NULL,
        classification TEXT NOT NULL,
        evaluated_at TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(id, workspace_id)
      );
      CREATE INDEX IF NOT EXISTS idx_forecast_evaluations_decision
        ON forecast_evaluations(workspace_id, decision_id, evaluated_at, id);
    `,
  }),
] as const;

export type CanonicalSqliteRepositoryMigrationPlan = MigrationPlan;

export type CanonicalSqliteRepositoryAppliedMigration = AppliedMigration;
