PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA secure_delete = ON;
PRAGMA trusted_schema = OFF;

-- Folio V2 canonical logical schema. Runtime migrations own incremental changes.

CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE vault_metadata (
  id TEXT PRIMARY KEY,
  vault_format_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  local_device_id TEXT NOT NULL,
  encryption_state TEXT NOT NULL CHECK (encryption_state IN ('ready','locked','migration_required','recovery_required')),
  last_integrity_check_at TEXT,
  last_snapshot_at TEXT
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios','android','other')),
  public_key TEXT,
  registered_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT,
  sync_cursor INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('personal','business')),
  name TEXT NOT NULL,
  base_currency TEXT NOT NULL CHECK (length(base_currency) = 3),
  jurisdiction TEXT NOT NULL DEFAULT 'GB',
  time_zone TEXT NOT NULL,
  encryption_key_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  deleted_at TEXT,
  UNIQUE(id, kind)
);

CREATE TABLE workspace_preferences (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  melo_tone TEXT NOT NULL DEFAULT 'balanced' CHECK (melo_tone IN ('gentle','balanced','accountability')),
  melo_proactivity INTEGER NOT NULL DEFAULT 7 CHECK (melo_proactivity BETWEEN 0 AND 10),
  memory_depth TEXT NOT NULL DEFAULT 'normal' CHECK (memory_depth IN ('minimal','normal','deep')),
  celebration_level INTEGER NOT NULL DEFAULT 2 CHECK (celebration_level BETWEEN 0 AND 3),
  humour_level INTEGER NOT NULL DEFAULT 1 CHECK (humour_level BETWEEN 0 AND 3),
  quiet_hours_json TEXT,
  lock_screen_detail TEXT NOT NULL DEFAULT 'hidden' CHECK (lock_screen_detail IN ('hidden','generic','detailed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cash','current','savings','credit_card','loan','mortgage','investment','wallet','business_current','business_savings','tax_pot','other')),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  institution_name TEXT,
  external_account_ref_hash TEXT,
  credit_limit_minor INTEGER,
  opening_balance_minor INTEGER,
  opening_balance_at TEXT,
  is_included_in_available_cash INTEGER NOT NULL DEFAULT 1 CHECK (is_included_in_available_cash IN (0,1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  UNIQUE(id, workspace_id)
);
CREATE INDEX idx_accounts_workspace_active ON accounts(workspace_id, is_active);

CREATE TABLE balance_observations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  balance_minor INTEGER NOT NULL,
  available_balance_minor INTEGER,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('manual','statement','open_banking','calculated','migration')),
  source_id TEXT,
  certainty TEXT NOT NULL CHECK (certainty IN ('confirmed','reported','estimated')),
  created_at TEXT NOT NULL,
  FOREIGN KEY(account_id, workspace_id) REFERENCES accounts(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX idx_balance_account_time ON balance_observations(account_id, observed_at DESC);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id TEXT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income','expense','transfer','debt','savings','tax','uncategorised')),
  system_key TEXT,
  icon_key TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(id, workspace_id),
  FOREIGN KEY(parent_id, workspace_id) REFERENCES categories(id, workspace_id)
);
CREATE INDEX idx_categories_workspace_kind ON categories(workspace_id, kind);

CREATE TABLE counterparties (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  kind TEXT CHECK (kind IN ('merchant','employer','creditor','landlord','client','supplier','government','person','unknown')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(id, workspace_id)
);
CREATE INDEX idx_counterparties_workspace_name ON counterparties(workspace_id, normalized_name);

CREATE TABLE transaction_rules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 100,
  match_json TEXT NOT NULL,
  action_json TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('user','bundled','learned')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_transaction_rules_workspace_priority ON transaction_rules(workspace_id, enabled, priority);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','posted','reversed','void')),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  booked_at TEXT,
  value_at TEXT,
  local_date TEXT NOT NULL,
  source_date_text TEXT,
  description TEXT,
  reference TEXT,
  counterparty_id TEXT,
  category_id TEXT,
  provider_transaction_id TEXT,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('manual','csv','ofx','qif','pdf','ocr','open_banking','migration','sync')),
  source_id TEXT,
  source_row_ref TEXT,
  certainty TEXT NOT NULL CHECK (certainty IN ('confirmed','reported','inferred')),
  review_status TEXT NOT NULL DEFAULT 'accepted' CHECK (review_status IN ('proposed','needs_review','accepted','rejected')),
  pending_replacement_id TEXT,
  reversal_of_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(id, workspace_id),
  FOREIGN KEY(account_id, workspace_id) REFERENCES accounts(id, workspace_id) ON DELETE CASCADE,
  FOREIGN KEY(counterparty_id, workspace_id) REFERENCES counterparties(id, workspace_id),
  FOREIGN KEY(category_id, workspace_id) REFERENCES categories(id, workspace_id),
  FOREIGN KEY(pending_replacement_id, workspace_id) REFERENCES transactions(id, workspace_id),
  FOREIGN KEY(reversal_of_id, workspace_id) REFERENCES transactions(id, workspace_id)
);
CREATE UNIQUE INDEX idx_transactions_provider_id ON transactions(workspace_id, source_kind, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_transactions_account_date ON transactions(account_id, local_date DESC);
CREATE INDEX idx_transactions_workspace_date ON transactions(workspace_id, local_date DESC);
CREATE INDEX idx_transactions_review ON transactions(workspace_id, review_status, local_date DESC);

CREATE TABLE transaction_splits (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  category_id TEXT,
  amount_minor INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(transaction_id, workspace_id) REFERENCES transactions(id, workspace_id) ON DELETE CASCADE,
  FOREIGN KEY(category_id, workspace_id) REFERENCES categories(id, workspace_id)
);
CREATE INDEX idx_splits_transaction ON transaction_splits(transaction_id);

CREATE TABLE transaction_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  left_transaction_id TEXT NOT NULL,
  right_transaction_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('transfer','duplicate','refund','chargeback','instalment','related')),
  evidence_state TEXT NOT NULL DEFAULT 'needs_review' CHECK (evidence_state IN ('confirmed','provider_reported','imported_claim','inferred','estimated','hypothetical')),
  review_state TEXT NOT NULL DEFAULT 'needs_review' CHECK (review_state IN ('not_required','needs_review','ready_for_user_confirmation','user_confirmed','dismissed','superseded')),
  accepted INTEGER NOT NULL DEFAULT 0 CHECK (accepted IN (0,1)),
  created_at TEXT NOT NULL,
  CHECK(left_transaction_id <> right_transaction_id),
  FOREIGN KEY(left_transaction_id, workspace_id) REFERENCES transactions(id, workspace_id) ON DELETE CASCADE,
  FOREIGN KEY(right_transaction_id, workspace_id) REFERENCES transactions(id, workspace_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_transaction_links_pair ON transaction_links(workspace_id, kind, left_transaction_id, right_transaction_id);

CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('selected','copied','detected','parsing','normalised','review','committing','completed','failed','cancelled')),
  format TEXT CHECK (format IN ('csv','ofx','qfx','qif','pdf','image','open_banking','v1_export','unknown')),
  parser_version TEXT,
  source_file_name TEXT,
  source_file_hash TEXT,
  retain_source_policy TEXT NOT NULL DEFAULT 'until_verified' CHECK (retain_source_policy IN ('delete_after_extract','until_verified','retain')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  progress_json TEXT,
  error_code TEXT,
  error_detail_safe TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_import_jobs_workspace_status ON import_jobs(workspace_id, status, created_at DESC);

CREATE TABLE import_sources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  import_job_id TEXT NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  encrypted_file_path TEXT,
  mime_type TEXT,
  page_count INTEGER,
  size_bytes INTEGER,
  hash_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(import_job_id, workspace_id) REFERENCES import_jobs(id, workspace_id)
);

-- Composite key required by the import_sources FK.
CREATE UNIQUE INDEX idx_import_jobs_id_workspace ON import_jobs(id, workspace_id);

CREATE TABLE import_rows (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  import_job_id TEXT NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  source_ref TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  normalized_json TEXT,
  authority_state TEXT NOT NULL DEFAULT 'imported_claim' CHECK (authority_state IN ('confirmed','user_confirmed','provider_reported','imported_claim','inferred','estimated','hypothetical','superseded','reversed')),
  review_state TEXT NOT NULL DEFAULT 'needs_review' CHECK (review_state IN ('not_required','needs_review','ready_for_user_confirmation','user_confirmed','dismissed','superseded')),
  user_confirmation_state TEXT NOT NULL DEFAULT 'requested' CHECK (user_confirmation_state IN ('not_requested','requested','confirmed','corrected','rejected')),
  parser_issues_json TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL CHECK (state IN ('parsed','needs_review','accepted','rejected','committed','duplicate')),
  committed_transaction_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(committed_transaction_id, workspace_id) REFERENCES transactions(id, workspace_id)
);
CREATE UNIQUE INDEX idx_import_rows_job_source ON import_rows(import_job_id, source_hash);

CREATE TABLE import_questions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  import_job_id TEXT NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  prompt_key TEXT NOT NULL,
  context_json TEXT NOT NULL,
  materiality INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','answered','deferred','dismissed')),
  answer_json TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE reconciliation_results (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  import_job_id TEXT NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  account_id TEXT,
  opening_balance_minor INTEGER,
  closing_balance_minor INTEGER,
  movement_total_minor INTEGER,
  difference_minor INTEGER,
  currency TEXT CHECK (currency IS NULL OR length(currency) = 3),
  status TEXT NOT NULL CHECK (status IN ('matched','explained','mismatch','not_available')),
  explanation_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(account_id, workspace_id) REFERENCES accounts(id, workspace_id)
);

CREATE TABLE recurring_rules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('income','obligation','transfer','saving','debt_payment','subscription','business_invoice','other')),
  name TEXT NOT NULL,
  rrule TEXT NOT NULL,
  start_local_date TEXT NOT NULL,
  end_local_date TEXT,
  time_zone TEXT NOT NULL,
  expected_amount_minor INTEGER,
  currency TEXT CHECK (currency IS NULL OR length(currency) = 3),
  amount_tolerance_minor INTEGER NOT NULL DEFAULT 0,
  account_id TEXT,
  counterparty_id TEXT,
  category_id TEXT,
  certainty TEXT NOT NULL CHECK (certainty IN ('confirmed','expected','inferred')),
  source TEXT NOT NULL CHECK (source IN ('user','import','open_banking','inference','migration')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(account_id, workspace_id) REFERENCES accounts(id, workspace_id),
  FOREIGN KEY(counterparty_id, workspace_id) REFERENCES counterparties(id, workspace_id),
  FOREIGN KEY(category_id, workspace_id) REFERENCES categories(id, workspace_id)
);
CREATE INDEX idx_recurring_workspace_enabled ON recurring_rules(workspace_id, enabled);

CREATE TABLE income_streams (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  recurring_rule_id TEXT,
  name TEXT NOT NULL,
  reliability TEXT NOT NULL CHECK (reliability IN ('confirmed','stable','variable','uncertain')),
  conservative_amount_minor INTEGER,
  expected_amount_minor INTEGER,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(recurring_rule_id) REFERENCES recurring_rules(id)
);

CREATE TABLE obligations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  recurring_rule_id TEXT,
  name TEXT NOT NULL,
  priority_class TEXT NOT NULL CHECK (priority_class IN ('essential','priority_debt','contractual','important','discretionary','custom')),
  protect_in_forecast INTEGER NOT NULL DEFAULT 1 CHECK (protect_in_forecast IN (0,1)),
  grace_days INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(recurring_rule_id) REFERENCES recurring_rules(id)
);

CREATE TABLE debts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('credit_card','loan','bnpl','overdraft','mortgage','tax','informal','other')),
  original_balance_minor INTEGER,
  current_balance_minor INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  minimum_payment_kind TEXT NOT NULL CHECK (minimum_payment_kind IN ('fixed','percentage','greater_of','provider_schedule','manual')),
  minimum_payment_value TEXT NOT NULL,
  due_rule_id TEXT,
  user_priority INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cleared','written_off','disputed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  cleared_at TEXT,
  UNIQUE(id, workspace_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(account_id, workspace_id) REFERENCES accounts(id, workspace_id),
  FOREIGN KEY(due_rule_id) REFERENCES recurring_rules(id)
);

CREATE TABLE debt_rate_periods (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  debt_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  annual_rate_basis_points INTEGER NOT NULL,
  compounding TEXT NOT NULL CHECK (compounding IN ('daily','monthly','simple','provider_schedule')),
  fees_json TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(debt_id, workspace_id) REFERENCES debts(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX idx_debt_rates_debt_date ON debt_rate_periods(debt_id, start_date);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('expected','confirmed','completed','missed','cancelled','superseded')),
  title TEXT NOT NULL,
  summary TEXT,
  occurs_at TEXT,
  local_date TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  amount_minor INTEGER,
  currency TEXT CHECK (currency IS NULL OR length(currency) = 3),
  certainty TEXT NOT NULL CHECK (certainty IN ('confirmed','expected','inferred','hypothetical')),
  severity TEXT NOT NULL DEFAULT 'normal' CHECK (severity IN ('low','normal','important','critical')),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('transaction','recurring_rule','plan','calendar','user','melo','import','system','business')),
  source_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(id, workspace_id)
);
CREATE INDEX idx_events_workspace_date ON events(workspace_id, local_date, state);

CREATE TABLE event_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(event_id, workspace_id) REFERENCES events(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX idx_event_links_entity ON event_links(workspace_id, entity_type, entity_id);

CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period_kind TEXT NOT NULL CHECK (period_kind IN ('pay_cycle','weekly','monthly','custom')),
  rollover_policy TEXT NOT NULL CHECK (rollover_policy IN ('none','positive','negative','both','user_review')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','paused','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(id, workspace_id)
);

CREATE TABLE budget_periods (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  budget_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  income_basis_minor INTEGER,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  state TEXT NOT NULL CHECK (state IN ('open','closed','recalculated')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(budget_id, workspace_id) REFERENCES budgets(id, workspace_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_budget_period_unique ON budget_periods(budget_id, start_date, end_date);

CREATE TABLE budget_allocations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  budget_period_id TEXT NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  category_id TEXT,
  label TEXT NOT NULL,
  allocated_minor INTEGER NOT NULL,
  spent_minor INTEGER NOT NULL DEFAULT 0,
  rollover_minor INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(category_id, workspace_id) REFERENCES categories(id, workspace_id)
);

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_plan_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('debt','savings','buffer','purchase','event','business','custom')),
  name TEXT NOT NULL,
  target_amount_minor INTEGER,
  currency TEXT CHECK (currency IS NULL OR length(currency) = 3),
  target_date TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  accountability_style TEXT NOT NULL DEFAULT 'inherit' CHECK (accountability_style IN ('inherit','gentle','balanced','accountability')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','paused','completed','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(id, workspace_id),
  FOREIGN KEY(parent_plan_id, workspace_id) REFERENCES plans(id, workspace_id)
);

CREATE TABLE plan_rules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  rule_json TEXT NOT NULL,
  hard_or_soft TEXT NOT NULL CHECK (hard_or_soft IN ('hard','soft')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(plan_id, workspace_id) REFERENCES plans(id, workspace_id) ON DELETE CASCADE
);

CREATE TABLE plan_versions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  reason TEXT NOT NULL,
  assumptions_json TEXT NOT NULL,
  projected_completion_date TEXT,
  projected_total_minor INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY(plan_id, workspace_id) REFERENCES plans(id, workspace_id) ON DELETE CASCADE,
  UNIQUE(plan_id, version)
);

CREATE TABLE plan_milestones (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  name TEXT NOT NULL,
  target_amount_minor INTEGER,
  target_date TEXT,
  reached_at TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','reached','skipped','adjusted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(plan_id, workspace_id) REFERENCES plans(id, workspace_id) ON DELETE CASCADE
);

CREATE TABLE plan_contributions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  transaction_id TEXT,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  contribution_date TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('transaction','manual','adjustment')),
  created_at TEXT NOT NULL,
  FOREIGN KEY(plan_id, workspace_id) REFERENCES plans(id, workspace_id) ON DELETE CASCADE,
  FOREIGN KEY(transaction_id, workspace_id) REFERENCES transactions(id, workspace_id)
);

CREATE TABLE scenarios (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_data_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','saved','accepted','discarded')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE scenario_changes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,
  change_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE forecast_snapshots (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scenario_id TEXT,
  engine_version TEXT NOT NULL,
  data_version TEXT NOT NULL,
  assumptions_json TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  status TEXT NOT NULL CHECK (status IN ('valid','stale','failed')),
  created_at TEXT NOT NULL,
  FOREIGN KEY(scenario_id) REFERENCES scenarios(id)
);
CREATE INDEX idx_forecast_workspace_created ON forecast_snapshots(workspace_id, created_at DESC);

CREATE TABLE forecast_points (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  forecast_snapshot_id TEXT NOT NULL REFERENCES forecast_snapshots(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  opening_minor INTEGER NOT NULL,
  inflow_minor INTEGER NOT NULL,
  outflow_minor INTEGER NOT NULL,
  closing_minor INTEGER NOT NULL,
  protected_floor_minor INTEGER NOT NULL DEFAULT 0,
  certainty_band TEXT NOT NULL CHECK (certainty_band IN ('known','expected','uncertain','hypothetical')),
  event_ids_json TEXT NOT NULL
);
CREATE INDEX idx_forecast_points_snapshot_date ON forecast_points(forecast_snapshot_id, local_date);

CREATE TABLE calendar_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('financial','life','business','task_block','milestone')),
  title TEXT NOT NULL,
  description TEXT,
  starts_at TEXT,
  ends_at TEXT,
  local_date TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0,1)),
  time_zone TEXT NOT NULL,
  rrule TEXT,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('user','event','plan','recurring_rule','import','system_calendar')),
  source_id TEXT,
  financial_impact_json TEXT,
  system_calendar_link_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(id, workspace_id)
);
CREATE INDEX idx_calendar_workspace_date ON calendar_items(workspace_id, local_date);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  calendar_item_id TEXT,
  title TEXT NOT NULL,
  due_at TEXT,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','completed','dismissed','cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','important','critical')),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('user','melo','event','plan','business')),
  source_id TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(calendar_item_id, workspace_id) REFERENCES calendar_items(id, workspace_id)
);

CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  fire_at TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','local_notification','email')),
  privacy_level TEXT NOT NULL DEFAULT 'generic' CHECK (privacy_level IN ('hidden','generic','detailed')),
  state TEXT NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled','delivered','dismissed','cancelled','failed')),
  platform_notification_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_reminders_fire_state ON reminders(state, fire_at);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('statement','receipt','invoice','payslip','bill','contract','tax','letter','photo','other')),
  title TEXT NOT NULL,
  encrypted_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  encryption_key_version INTEGER NOT NULL,
  retention_policy TEXT NOT NULL CHECK (retention_policy IN ('retain','until_verified','delete_original_after_extract')),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('capture','file_picker','import','generated','migration')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(id, workspace_id)
);
CREATE UNIQUE INDEX idx_documents_hash_workspace ON documents(workspace_id, content_hash) WHERE deleted_at IS NULL;

CREATE TABLE document_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(document_id, workspace_id) REFERENCES documents(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX idx_document_links_entity ON document_links(workspace_id, entity_type, entity_id);

CREATE TABLE document_extractions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  engine TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('queued','running','review','accepted','rejected','failed')),
  extracted_text_encrypted TEXT,
  candidates_json TEXT,
  extraction_evidence_state TEXT NOT NULL DEFAULT 'needs_review' CHECK (extraction_evidence_state IN ('needs_review','ready_for_user_confirmation','user_confirmed','rejected')),
  parser_issues_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(document_id, workspace_id) REFERENCES documents(id, workspace_id) ON DELETE CASCADE
);

CREATE TABLE melo_threads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  intent TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','completed','abandoned','manual_review')),
  question_count INTEGER NOT NULL DEFAULT 0,
  max_questions INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE melo_messages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES melo_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','melo','system_template')),
  text_encrypted TEXT NOT NULL,
  structured_json TEXT,
  ai_route TEXT NOT NULL DEFAULT 'none' CHECK (ai_route IN ('none','on_device','cloud_small','cloud_strong')),
  created_at TEXT NOT NULL
);

CREATE TABLE melo_proposals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  thread_id TEXT,
  proposal_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  rationale_json TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','edited','accepted','rejected','expired','committed')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  committed_audit_id TEXT,
  FOREIGN KEY(thread_id) REFERENCES melo_threads(id)
);

CREATE TABLE melo_memories (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('preference','pattern','correction','commitment','event_summary','context')),
  content_encrypted TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_id TEXT,
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('normal','sensitive','high')),
  expires_at TEXT,
  last_reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE user_corrections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  original_json TEXT NOT NULL,
  corrected_json TEXT NOT NULL,
  should_learn INTEGER NOT NULL DEFAULT 1 CHECK (should_learn IN (0,1)),
  created_at TEXT NOT NULL
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  class TEXT NOT NULL CHECK (class IN ('critical_deadline','meaningful_change','ritual','progress','marketing')),
  title_key TEXT NOT NULL,
  body_key TEXT NOT NULL,
  payload_json TEXT,
  state TEXT NOT NULL CHECK (state IN ('candidate','scheduled','delivered','opened','dismissed','cancelled','failed')),
  scheduled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE business_profiles (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  business_type TEXT NOT NULL CHECK (business_type IN ('sole_trader','limited_company','partnership','landlord','other')),
  legal_name TEXT,
  trading_name TEXT,
  tax_identifier_encrypted TEXT,
  vat_registered INTEGER NOT NULL DEFAULT 0 CHECK (vat_registered IN (0,1)),
  accounting_basis TEXT CHECK (accounting_basis IN ('cash','accrual','unknown')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TRIGGER business_profile_workspace_guard
BEFORE INSERT ON business_profiles
BEGIN
  SELECT CASE WHEN (SELECT kind FROM workspaces WHERE id = NEW.workspace_id) <> 'business'
    THEN RAISE(ABORT, 'business profile requires business workspace') END;
END;

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email_encrypted TEXT,
  address_encrypted TEXT,
  tax_number_encrypted TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(id, workspace_id)
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  client_id TEXT,
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','issued','part_paid','paid','overdue','void','credited')),
  issue_date TEXT NOT NULL,
  due_date TEXT,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  subtotal_minor INTEGER NOT NULL,
  tax_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL,
  paid_minor INTEGER NOT NULL DEFAULT 0,
  linked_document_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, invoice_number),
  UNIQUE(id, workspace_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(client_id, workspace_id) REFERENCES clients(id, workspace_id),
  FOREIGN KEY(linked_document_id, workspace_id) REFERENCES documents(id, workspace_id)
);

CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL DEFAULT 1000,
  unit_price_minor INTEGER NOT NULL,
  tax_rate_basis_points INTEGER NOT NULL DEFAULT 0,
  line_total_minor INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(invoice_id, workspace_id) REFERENCES invoices(id, workspace_id) ON DELETE CASCADE
);

CREATE TABLE tax_periods (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  jurisdiction TEXT NOT NULL,
  tax_kind TEXT NOT NULL CHECK (tax_kind IN ('self_assessment','income_tax_mtd','vat','corporation_tax','custom')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','review','exported','submitted_external','closed')),
  policy_pack_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(id, workspace_id)
);

CREATE TABLE tax_categories (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  jurisdiction TEXT NOT NULL,
  policy_pack_version TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  treatment_json TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  UNIQUE(workspace_id, policy_pack_version, code),
  UNIQUE(id, workspace_id)
);

CREATE TABLE tax_record_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tax_period_id TEXT NOT NULL,
  tax_category_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('proposed','accepted','excluded','adjusted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(tax_period_id, workspace_id) REFERENCES tax_periods(id, workspace_id) ON DELETE CASCADE,
  FOREIGN KEY(tax_category_id, workspace_id) REFERENCES tax_categories(id, workspace_id)
);

CREATE TABLE mileage_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  trip_date TEXT NOT NULL,
  purpose TEXT NOT NULL,
  distance_milli INTEGER NOT NULL,
  distance_unit TEXT NOT NULL CHECK (distance_unit IN ('mile','kilometre')),
  start_location_encrypted TEXT,
  end_location_encrypted TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE provider_consents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('open_banking','cloud_ai','calendar','diagnostics')),
  external_consent_ref_encrypted TEXT,
  scopes_json TEXT NOT NULL,
  account_refs_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','active','expired','revoked','error')),
  granted_at TEXT,
  expires_at TEXT,
  last_refreshed_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ai_usage (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  route TEXT NOT NULL CHECK (route IN ('on_device','cloud_small','cloud_strong')),
  provider TEXT,
  model_id TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  weighted_units INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('success','rejected','failed','cancelled')),
  cost_microunits INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE entitlements (
  capability TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('free','apple','google','promo','admin')),
  state TEXT NOT NULL CHECK (state IN ('active','grace','expired','revoked')),
  expires_at TEXT,
  signed_receipt TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE background_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('queued','running','paused','completed','failed','cancelled')),
  checkpoint_json TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  run_after TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE currency_rates (
  id TEXT PRIMARY KEY,
  base_currency TEXT NOT NULL CHECK (length(base_currency) = 3),
  quote_currency TEXT NOT NULL CHECK (length(quote_currency) = 3),
  rate_decimal TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  source TEXT NOT NULL,
  certainty TEXT NOT NULL CHECK (certainty IN ('confirmed','reported','estimated')),
  created_at TEXT NOT NULL,
  UNIQUE(base_currency, quote_currency, observed_at, source)
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  command_type TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('user','melo','import','sync','system','migration')),
  actor_ref TEXT,
  entity_refs_json TEXT NOT NULL,
  delta_json TEXT NOT NULL,
  provenance_json TEXT,
  device_id TEXT,
  reversal_of_id TEXT REFERENCES audit_log(id),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_workspace_time ON audit_log(workspace_id, created_at DESC);

-- Canonical ontology tables for the local-first model.
CREATE TABLE source_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('manual_entry','statement_row','document_text','open_banking_row','system_derived','user_correction')),
  authority_state TEXT NOT NULL CHECK (authority_state IN ('confirmed','user_confirmed','provider_reported','imported_claim','inferred','estimated','hypothetical','superseded','reversed')),
  label TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  external_id TEXT,
  document_id TEXT,
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(document_id, workspace_id) REFERENCES documents(id, workspace_id)
);
CREATE INDEX idx_source_records_workspace_kind ON source_records(workspace_id, kind, captured_at DESC);

CREATE TABLE provenance (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  authority_state TEXT NOT NULL CHECK (authority_state IN ('confirmed','user_confirmed','provider_reported','imported_claim','inferred','estimated','hypothetical','superseded','reversed')),
  source_record_ids_json TEXT NOT NULL DEFAULT '[]',
  links_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE import_drafts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_record_id TEXT NOT NULL,
  proposed_transaction_id TEXT NOT NULL,
  authority_state TEXT NOT NULL CHECK (authority_state IN ('imported_claim','inferred','estimated')),
  review_state TEXT NOT NULL CHECK (review_state IN ('needs_review','ready_for_user_confirmation','user_confirmed','dismissed')),
  user_confirmation_state TEXT NOT NULL CHECK (user_confirmation_state IN ('not_requested','requested','confirmed','corrected','rejected')),
  parser_issues_json TEXT NOT NULL DEFAULT '[]',
  provenance_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(source_record_id, workspace_id) REFERENCES source_records(id, workspace_id),
  FOREIGN KEY(provenance_id, workspace_id) REFERENCES provenance(id, workspace_id)
);
CREATE INDEX idx_import_drafts_workspace_review ON import_drafts(workspace_id, review_state, created_at DESC);

CREATE TABLE commitments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('bill','debt_payment','saving','tax','business','custom')),
  title TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  due_date TEXT NOT NULL,
  authority_state TEXT NOT NULL CHECK (authority_state IN ('confirmed','user_confirmed','provider_reported','imported_claim','inferred','estimated','hypothetical','superseded','reversed')),
  review_state TEXT NOT NULL CHECK (review_state IN ('not_required','needs_review','ready_for_user_confirmation','user_confirmed','dismissed','superseded')),
  account_id TEXT,
  source_record_id TEXT,
  provenance_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(account_id, workspace_id) REFERENCES accounts(id, workspace_id),
  FOREIGN KEY(source_record_id, workspace_id) REFERENCES source_records(id, workspace_id),
  FOREIGN KEY(provenance_id, workspace_id) REFERENCES provenance(id, workspace_id)
);
CREATE INDEX idx_commitments_workspace_due ON commitments(workspace_id, due_date);

CREATE TABLE expectations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  authority_state TEXT NOT NULL CHECK (authority_state IN ('confirmed','user_confirmed','provider_reported','imported_claim','inferred','estimated','hypothetical')),
  fulfilled INTEGER NOT NULL DEFAULT 0 CHECK (fulfilled IN (0,1)),
  account_id TEXT,
  commitment_id TEXT,
  source_record_id TEXT,
  provenance_id TEXT,
  reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(account_id, workspace_id) REFERENCES accounts(id, workspace_id),
  FOREIGN KEY(commitment_id, workspace_id) REFERENCES commitments(id, workspace_id),
  FOREIGN KEY(source_record_id, workspace_id) REFERENCES source_records(id, workspace_id),
  FOREIGN KEY(provenance_id, workspace_id) REFERENCES provenance(id, workspace_id)
);
CREATE INDEX idx_expectations_workspace_date ON expectations(workspace_id, local_date);

CREATE TABLE planner_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('task','reminder','review','decision')),
  title TEXT NOT NULL,
  due_date TEXT NOT NULL,
  due_time TEXT,
  status TEXT NOT NULL CHECK (status IN ('open','completed','dismissed','superseded')),
  authority_state TEXT NOT NULL CHECK (authority_state IN ('confirmed','user_confirmed','provider_reported','imported_claim','inferred','estimated','hypothetical','superseded','reversed')),
  linked_plan_id TEXT,
  linked_event_id TEXT,
  provenance_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(linked_plan_id, workspace_id) REFERENCES plans(id, workspace_id),
  FOREIGN KEY(linked_event_id, workspace_id) REFERENCES events(id, workspace_id),
  FOREIGN KEY(provenance_id, workspace_id) REFERENCES provenance(id, workspace_id)
);
CREATE INDEX idx_planner_items_workspace_due ON planner_items(workspace_id, due_date, status);

CREATE TABLE decision_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('confirm_import','correct_record','accept_plan','accept_scenario','dismiss_proposal','delete_data')),
  actor TEXT NOT NULL CHECK (actor = 'user'),
  summary TEXT NOT NULL,
  affected_ids_json TEXT NOT NULL DEFAULT '[]',
  provenance_id TEXT,
  decided_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(provenance_id, workspace_id) REFERENCES provenance(id, workspace_id)
);
CREATE INDEX idx_decision_records_workspace_time ON decision_records(workspace_id, decided_at DESC);

CREATE TABLE timeline_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('fact','expectation','plan','decision','system')),
  title TEXT NOT NULL,
  local_date TEXT NOT NULL,
  authority_state TEXT NOT NULL CHECK (authority_state IN ('confirmed','user_confirmed','provider_reported','imported_claim','inferred','estimated','hypothetical','superseded','reversed')),
  subject_id TEXT NOT NULL,
  provenance_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(provenance_id, workspace_id) REFERENCES provenance(id, workspace_id)
);
CREATE INDEX idx_timeline_entries_workspace_date ON timeline_entries(workspace_id, local_date DESC);

CREATE TABLE sync_outbox (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL UNIQUE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('upsert','delete','restore','key_rotation')),
  entity_version TEXT NOT NULL,
  encrypted_envelope BLOB NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','uploaded','acknowledged','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_outbox_state_sequence ON sync_outbox(state, sequence);

CREATE TABLE sync_inbox (
  operation_id TEXT PRIMARY KEY,
  source_device_id TEXT NOT NULL,
  server_sequence INTEGER NOT NULL,
  encrypted_envelope BLOB NOT NULL,
  state TEXT NOT NULL DEFAULT 'received' CHECK (state IN ('received','applied','conflict','rejected')),
  received_at TEXT NOT NULL,
  applied_at TEXT,
  conflict_json TEXT
);
CREATE UNIQUE INDEX idx_inbox_server_sequence ON sync_inbox(server_sequence);

CREATE TABLE tombstones (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_version TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  purge_after TEXT,
  UNIQUE(workspace_id, entity_type, entity_id)
);

CREATE VIRTUAL TABLE search_index USING fts5(
  workspace_id UNINDEXED,
  entity_type UNINDEXED,
  entity_id UNINDEXED,
  title,
  body,
  tags,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE VIEW v_posted_transactions AS
SELECT * FROM transactions
WHERE status = 'posted' AND deleted_at IS NULL AND review_status = 'accepted';

CREATE VIEW v_active_events AS
SELECT * FROM events
WHERE deleted_at IS NULL AND state NOT IN ('cancelled','superseded');

-- Guard business-only tables beyond the profile.
CREATE TRIGGER clients_workspace_guard
BEFORE INSERT ON clients
BEGIN
  SELECT CASE WHEN (SELECT kind FROM workspaces WHERE id = NEW.workspace_id) <> 'business'
    THEN RAISE(ABORT, 'clients require business workspace') END;
END;

CREATE TRIGGER invoices_workspace_guard
BEFORE INSERT ON invoices
BEGIN
  SELECT CASE WHEN (SELECT kind FROM workspaces WHERE id = NEW.workspace_id) <> 'business'
    THEN RAISE(ABORT, 'invoices require business workspace') END;
END;

CREATE TRIGGER tax_periods_workspace_guard
BEFORE INSERT ON tax_periods
BEGIN
  SELECT CASE WHEN (SELECT kind FROM workspaces WHERE id = NEW.workspace_id) <> 'business'
    THEN RAISE(ABORT, 'tax periods require business workspace') END;
END;

CREATE TRIGGER mileage_workspace_guard
BEFORE INSERT ON mileage_entries
BEGIN
  SELECT CASE WHEN (SELECT kind FROM workspaces WHERE id = NEW.workspace_id) <> 'business'
    THEN RAISE(ABORT, 'mileage requires business workspace') END;
END;
