import type { AppliedMigration } from './migrations.js';
import type { DatabaseDriver, QueryResult, SqlValue } from './driver.js';

export type ExecutedSqlStatement = Readonly<{
  sql: string;
  params: readonly SqlValue[];
}>;

type MigrationRow = {
  version: number;
  name: string;
  checksum: string;
  applied_at: string;
};

type AuditRow = {
  id: string;
  workspace_id: string | null;
  command_type: string;
  actor_kind: string;
  actor_ref: string | null;
  entity_refs_json: string;
  delta_json: string;
  provenance_json: string | null;
  device_id: string | null;
  reversal_of_id: string | null;
  created_at: string;
};

type SearchIndexRow = {
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  body: string;
  tags: string;
};

type BackgroundJobRow = {
  id: string;
  workspace_id: string | null;
  kind: string;
  state: string;
  checkpoint_json: string | null;
  attempts: number;
  run_after: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
};

type InMemoryDriverState = {
  schemaMigrations: MigrationRow[];
  canonicalRepositoryMigrations: MigrationRow[];
  auditLog: Map<string, AuditRow>;
  canonicalTables: Map<string, Map<string, CanonicalJsonRow>>;
  searchIndex: Map<string, SearchIndexRow>;
  backgroundJobs: Map<string, BackgroundJobRow>;
};

type CanonicalJsonRow = {
  id: string;
  workspace_id: string | null;
  record_json: string;
  updated_at: string;
};

export class InMemoryDatabaseDriver implements DatabaseDriver {
  readonly engineName = 'in-memory-test';

  private state: InMemoryDriverState;

  constructor(
    state: InMemoryDriverState = createEmptyState(),
    private readonly statementLog: ExecutedSqlStatement[] = [],
  ) {
    this.state = state;
  }

  get executedStatements(): readonly ExecutedSqlStatement[] {
    return this.statementLog;
  }

  get appliedMigrations(): readonly AppliedMigration[] {
    return this.state.schemaMigrations
      .map((row) => ({
        version: row.version,
        name: row.name,
        checksum: row.checksum as AppliedMigration['checksum'],
        appliedAt: row.applied_at,
      }))
      .sort((left, right) => left.version - right.version);
  }

  get auditEntries(): readonly AuditRow[] {
    return [...this.state.auditLog.values()];
  }

  get canonicalRepositoryAppliedMigrations(): readonly AppliedMigration[] {
    return this.state.canonicalRepositoryMigrations
      .map((row) => ({
        version: row.version,
        name: row.name,
        checksum: row.checksum as AppliedMigration['checksum'],
        appliedAt: row.applied_at,
      }))
      .sort((left, right) => left.version - right.version);
  }

  canonicalTableEntries(table: string): readonly CanonicalJsonRow[] {
    return [...(this.state.canonicalTables.get(table)?.values() ?? [])];
  }

  get searchEntries(): readonly SearchIndexRow[] {
    return [...this.state.searchIndex.values()];
  }

  get backgroundJobEntries(): readonly BackgroundJobRow[] {
    return [...this.state.backgroundJobs.values()];
  }

  seedAppliedMigration(row: AppliedMigration): void {
    this.state.schemaMigrations.push({
      version: row.version,
      name: row.name,
      checksum: row.checksum,
      applied_at: row.appliedAt ?? new Date(0).toISOString(),
    });
  }

  async execute<TRow extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<QueryResult<TRow>> {
    this.statementLog.push({ sql, params });
    return this.executeInternal(sql, params) as Promise<QueryResult<TRow>>;
  }

  async transaction<T>(work: (driver: DatabaseDriver) => Promise<T>): Promise<T> {
    const transactionState = cloneState(this.state);
    const transactionDriver = new InMemoryDatabaseDriver(transactionState, this.statementLog);
    const result = await work(transactionDriver);
    this.state = transactionState;
    return result;
  }

  private async executeInternal(sql: string, params: readonly SqlValue[]): Promise<QueryResult> {
    const normalized = normalizeSql(sql);

    if (/^select 1(?: as value)?$/i.test(normalized)) {
      return { rows: [{ value: 1 }], rowsAffected: 0 };
    }

    if (normalized.startsWith('pragma quick_check')) {
      return { rows: [{ quick_check: 'ok' }], rowsAffected: 0 };
    }

    if (normalized.startsWith('pragma foreign_key_check')) {
      return { rows: [], rowsAffected: 0 };
    }

    if (normalized.startsWith('create table') || normalized.startsWith('create virtual table')) {
      return { rows: [], rowsAffected: 0 };
    }

    if (normalized.startsWith('create index') || normalized.startsWith('create unique index')) {
      return { rows: [], rowsAffected: 0 };
    }

    if (normalized.startsWith('create trigger') || normalized.startsWith('create view')) {
      return { rows: [], rowsAffected: 0 };
    }

    if (
      normalized.startsWith('select version, name, checksum, applied_at from schema_migrations')
    ) {
      return {
        rows: [...this.state.schemaMigrations].sort((left, right) => left.version - right.version),
        rowsAffected: 0,
      };
    }

    if (normalized.startsWith('insert into schema_migrations')) {
      const version = requiredNumber(params[0], 'version');
      if (this.state.schemaMigrations.some((row) => row.version === version)) {
        throw new Error(`schema_migrations duplicate version ${version}.`);
      }
      this.state.schemaMigrations.push({
        version,
        name: requiredString(params[1], 'name'),
        checksum: requiredString(params[2], 'checksum'),
        applied_at: requiredString(params[3], 'applied_at'),
      });
      return { rows: [], rowsAffected: 1 };
    }

    if (
      normalized.startsWith(
        'select version, name, checksum, applied_at from canonical_repository_migrations',
      )
    ) {
      return {
        rows: [...this.state.canonicalRepositoryMigrations].sort(
          (left, right) => left.version - right.version,
        ),
        rowsAffected: 0,
      };
    }

    if (normalized.startsWith('insert into canonical_repository_migrations')) {
      const version = requiredNumber(params[0], 'version');
      if (this.state.canonicalRepositoryMigrations.some((row) => row.version === version)) {
        throw new Error(`canonical_repository_migrations duplicate version ${version}.`);
      }
      this.state.canonicalRepositoryMigrations.push({
        version,
        name: requiredString(params[1], 'name'),
        checksum: requiredString(params[2], 'checksum'),
        applied_at: requiredString(params[3], 'applied_at'),
      });
      return { rows: [], rowsAffected: 1 };
    }

    if (
      normalized.startsWith('insert into audit_log') ||
      normalized.startsWith('insert or replace into audit_log')
    ) {
      const row: AuditRow = {
        id: requiredString(params[0], 'id'),
        workspace_id: nullableString(params[1], 'workspace_id'),
        command_type: requiredString(params[2], 'command_type'),
        actor_kind: requiredString(params[3], 'actor_kind'),
        actor_ref: nullableString(params[4], 'actor_ref'),
        entity_refs_json: requiredString(params[5], 'entity_refs_json'),
        delta_json: requiredString(params[6], 'delta_json'),
        provenance_json: nullableString(params[7], 'provenance_json'),
        device_id: nullableString(params[8], 'device_id'),
        reversal_of_id: nullableString(params[9], 'reversal_of_id'),
        created_at: requiredString(params[10], 'created_at'),
      };
      this.state.auditLog.set(row.id, row);
      return { rows: [], rowsAffected: 1 };
    }

    if (
      normalized.startsWith(
        'select delta_json from audit_log where workspace_id = ? and command_type = ?',
      )
    ) {
      const workspaceId = requiredString(params[0], 'workspace_id');
      const commandType = requiredString(params[1], 'command_type');
      return {
        rows: [...this.state.auditLog.values()]
          .filter((row) => row.workspace_id === workspaceId && row.command_type === commandType)
          .sort((left, right) =>
            `${left.created_at}\u0000${left.id}`.localeCompare(
              `${right.created_at}\u0000${right.id}`,
            ),
          )
          .map((row) => ({ delta_json: row.delta_json })),
        rowsAffected: 0,
      };
    }

    if (
      normalized.startsWith(
        'select delta_json from audit_log where id = ? and workspace_id = ? and command_type = ?',
      )
    ) {
      const id = requiredString(params[0], 'id');
      const workspaceId = requiredString(params[1], 'workspace_id');
      const commandType = requiredString(params[2], 'command_type');
      const row = this.state.auditLog.get(id);
      return {
        rows:
          row?.workspace_id === workspaceId && row.command_type === commandType
            ? [{ delta_json: row.delta_json }]
            : [],
        rowsAffected: 0,
      };
    }

    if (
      normalized.startsWith(
        'select count(*) as count from audit_log where workspace_id = ? and command_type = ?',
      )
    ) {
      const workspaceId = requiredString(params[0], 'workspace_id');
      const commandType = requiredString(params[1], 'command_type');
      return {
        rows: [
          {
            count: [...this.state.auditLog.values()].filter(
              (row) => row.workspace_id === workspaceId && row.command_type === commandType,
            ).length,
          },
        ],
        rowsAffected: 0,
      };
    }

    if (
      normalized.startsWith(
        'delete from audit_log where id = ? and workspace_id = ? and command_type = ?',
      )
    ) {
      const id = requiredString(params[0], 'id');
      const workspaceId = requiredString(params[1], 'workspace_id');
      const commandType = requiredString(params[2], 'command_type');
      const row = this.state.auditLog.get(id);
      const existed = row?.workspace_id === workspaceId && row.command_type === commandType;
      if (existed) this.state.auditLog.delete(id);
      return { rows: [], rowsAffected: existed ? 1 : 0 };
    }

    if (
      normalized.startsWith('delete from audit_log where workspace_id = ? and command_type = ?')
    ) {
      const workspaceId = requiredString(params[0], 'workspace_id');
      const commandType = requiredString(params[1], 'command_type');
      let rowsAffected = 0;
      for (const [key, row] of this.state.auditLog.entries()) {
        if (row.workspace_id === workspaceId && row.command_type === commandType) {
          this.state.auditLog.delete(key);
          rowsAffected += 1;
        }
      }
      return { rows: [], rowsAffected };
    }

    const canonicalResult = this.executeCanonicalJsonTableStatement(normalized, params);
    if (canonicalResult !== undefined) return canonicalResult;

    if (
      normalized.startsWith('delete from search_index where workspace_id = ? and entity_type = ?')
    ) {
      const key = searchKey(
        requiredString(params[0], 'workspace_id'),
        requiredString(params[1], 'entity_type'),
        requiredString(params[2], 'entity_id'),
      );
      const existed = this.state.searchIndex.delete(key);
      return { rows: [], rowsAffected: existed ? 1 : 0 };
    }

    if (normalized.startsWith('delete from search_index where workspace_id = ?')) {
      const workspaceId = requiredString(params[0], 'workspace_id');
      let rowsAffected = 0;
      for (const [key, row] of this.state.searchIndex.entries()) {
        if (row.workspace_id === workspaceId) {
          this.state.searchIndex.delete(key);
          rowsAffected += 1;
        }
      }
      return { rows: [], rowsAffected };
    }

    if (normalized.startsWith('insert into search_index')) {
      const row: SearchIndexRow = {
        workspace_id: requiredString(params[0], 'workspace_id'),
        entity_type: requiredString(params[1], 'entity_type'),
        entity_id: requiredString(params[2], 'entity_id'),
        title: requiredString(params[3], 'title'),
        body: requiredString(params[4], 'body'),
        tags: requiredString(params[5], 'tags'),
      };
      this.state.searchIndex.set(searchKey(row.workspace_id, row.entity_type, row.entity_id), row);
      return { rows: [], rowsAffected: 1 };
    }

    if (normalized.startsWith('insert into background_jobs')) {
      const row: BackgroundJobRow = {
        id: requiredString(params[0], 'id'),
        workspace_id: nullableString(params[1], 'workspace_id'),
        kind: requiredString(params[2], 'kind'),
        state: requiredString(params[3], 'state'),
        checkpoint_json: nullableString(params[4], 'checkpoint_json'),
        attempts: requiredNumber(params[5], 'attempts'),
        run_after: nullableString(params[6], 'run_after'),
        last_error_code: nullableString(params[7], 'last_error_code'),
        created_at: requiredString(params[8], 'created_at'),
        updated_at: requiredString(params[9], 'updated_at'),
      };
      this.state.backgroundJobs.set(row.id, row);
      return { rows: [], rowsAffected: 1 };
    }

    if (normalized.startsWith('select id, workspace_id, kind, state, checkpoint_json')) {
      const id = requiredString(params[0], 'id');
      const row = this.state.backgroundJobs.get(id);
      return { rows: row === undefined ? [] : [row], rowsAffected: 0 };
    }

    if (normalized.startsWith("update background_jobs set state = 'running'")) {
      const updatedAt = requiredString(params[0], 'updated_at');
      const id = requiredString(params[1], 'id');
      const row = this.state.backgroundJobs.get(id);
      if (row === undefined || !['queued', 'paused', 'failed'].includes(row.state)) {
        return { rows: [], rowsAffected: 0 };
      }
      row.state = 'running';
      row.attempts += 1;
      row.updated_at = updatedAt;
      return { rows: [], rowsAffected: 1 };
    }

    if (normalized.startsWith('update background_jobs set checkpoint_json = ?')) {
      const checkpointJson = nullableString(params[0], 'checkpoint_json');
      const updatedAt = requiredString(params[1], 'updated_at');
      const id = requiredString(params[2], 'id');
      const row = this.state.backgroundJobs.get(id);
      if (row === undefined || !['queued', 'running', 'paused', 'failed'].includes(row.state)) {
        return { rows: [], rowsAffected: 0 };
      }
      row.checkpoint_json = checkpointJson;
      row.updated_at = updatedAt;
      return { rows: [], rowsAffected: 1 };
    }

    if (normalized.startsWith("update background_jobs set state = 'completed'")) {
      const updatedAt = requiredString(params[0], 'updated_at');
      const id = requiredString(params[1], 'id');
      const row = this.state.backgroundJobs.get(id);
      if (row === undefined) return { rows: [], rowsAffected: 0 };
      row.state = 'completed';
      row.updated_at = updatedAt;
      return { rows: [], rowsAffected: 1 };
    }

    if (normalized.startsWith("update background_jobs set state = 'failed'")) {
      const errorCode = requiredString(params[0], 'last_error_code');
      const runAfter = nullableString(params[1], 'run_after');
      const updatedAt = requiredString(params[2], 'updated_at');
      const id = requiredString(params[3], 'id');
      const row = this.state.backgroundJobs.get(id);
      if (row === undefined) return { rows: [], rowsAffected: 0 };
      row.state = 'failed';
      row.last_error_code = errorCode;
      row.run_after = runAfter;
      row.updated_at = updatedAt;
      return { rows: [], rowsAffected: 1 };
    }

    return { rows: [], rowsAffected: 0 };
  }

  private executeCanonicalJsonTableStatement(
    normalized: string,
    params: readonly SqlValue[],
  ): QueryResult | undefined {
    const insertMatch = normalized.match(/^insert or replace into ([a-z_]+) \(/);
    if (insertMatch !== null) {
      const table = insertMatch[1] ?? '';
      if (!canonicalJsonTables.has(table)) return undefined;
      if (table === 'workspaces') {
        const row: CanonicalJsonRow = {
          id: requiredString(params[0], 'id'),
          workspace_id: null,
          record_json: requiredString(params[2], 'record_json'),
          updated_at: requiredString(params[3], 'updated_at'),
        };
        this.canonicalTable(table).set(row.id, row);
        return { rows: [], rowsAffected: 1 };
      }

      const row: CanonicalJsonRow = {
        id: requiredString(params[0], 'id'),
        workspace_id: requiredString(params[1], 'workspace_id'),
        record_json: requiredString(params[2], 'record_json'),
        updated_at: requiredString(params[3], 'updated_at'),
      };
      this.canonicalTable(table).set(canonicalEntityKey(row.workspace_id, row.id), row);
      return { rows: [], rowsAffected: 1 };
    }

    if (normalized === 'select record_json from workspaces order by id') {
      return {
        rows: [...this.canonicalTable('workspaces').values()]
          .sort((left, right) => left.id.localeCompare(right.id))
          .map((row) => ({ record_json: row.record_json })),
        rowsAffected: 0,
      };
    }

    if (normalized.startsWith('select record_json from workspaces where id = ?')) {
      const id = requiredString(params[0], 'id');
      const row = this.canonicalTable('workspaces').get(id);
      return {
        rows: row === undefined ? [] : [{ record_json: row.record_json }],
        rowsAffected: 0,
      };
    }

    const listMatch = normalized.match(
      /^select record_json from ([a-z_]+) where workspace_id = \? order by id$/,
    );
    if (listMatch !== null) {
      const table = listMatch[1] ?? '';
      if (!canonicalJsonTables.has(table) || table === 'workspaces') return undefined;
      const workspaceId = requiredString(params[0], 'workspace_id');
      return {
        rows: [...this.canonicalTable(table).values()]
          .filter((row) => row.workspace_id === workspaceId)
          .sort((left, right) => left.id.localeCompare(right.id))
          .map((row) => ({ record_json: row.record_json })),
        rowsAffected: 0,
      };
    }

    const getMatch = normalized.match(
      /^select record_json from ([a-z_]+) where id = \? and workspace_id = \?$/,
    );
    if (getMatch !== null) {
      const table = getMatch[1] ?? '';
      if (!canonicalJsonTables.has(table) || table === 'workspaces') return undefined;
      const id = requiredString(params[0], 'id');
      const workspaceId = requiredString(params[1], 'workspace_id');
      const row = this.canonicalTable(table).get(canonicalEntityKey(workspaceId, id));
      return {
        rows: row === undefined ? [] : [{ record_json: row.record_json }],
        rowsAffected: 0,
      };
    }

    const countMatch = normalized.match(
      /^select count\(\*\) as count from ([a-z_]+) where workspace_id = \?$/,
    );
    if (countMatch !== null) {
      const table = countMatch[1] ?? '';
      if (!canonicalJsonTables.has(table) || table === 'workspaces') return undefined;
      const workspaceId = requiredString(params[0], 'workspace_id');
      return {
        rows: [
          {
            count: [...this.canonicalTable(table).values()].filter(
              (row) => row.workspace_id === workspaceId,
            ).length,
          },
        ],
        rowsAffected: 0,
      };
    }

    const deleteByWorkspaceMatch = normalized.match(
      /^delete from ([a-z_]+) where workspace_id = \?$/,
    );
    if (deleteByWorkspaceMatch !== null) {
      const table = deleteByWorkspaceMatch[1] ?? '';
      if (!canonicalJsonTables.has(table) || table === 'workspaces') return undefined;
      const workspaceId = requiredString(params[0], 'workspace_id');
      let rowsAffected = 0;
      for (const [key, row] of this.canonicalTable(table).entries()) {
        if (row.workspace_id === workspaceId) {
          this.canonicalTable(table).delete(key);
          rowsAffected += 1;
        }
      }
      return { rows: [], rowsAffected };
    }

    const deleteByIdMatch = normalized.match(
      /^delete from ([a-z_]+) where id = \? and workspace_id = \?$/,
    );
    if (deleteByIdMatch !== null) {
      const table = deleteByIdMatch[1] ?? '';
      if (!canonicalJsonTables.has(table) || table === 'workspaces') return undefined;
      const id = requiredString(params[0], 'id');
      const workspaceId = requiredString(params[1], 'workspace_id');
      const existed = this.canonicalTable(table).delete(canonicalEntityKey(workspaceId, id));
      return { rows: [], rowsAffected: existed ? 1 : 0 };
    }

    return undefined;
  }

  private canonicalTable(table: string): Map<string, CanonicalJsonRow> {
    const existing = this.state.canonicalTables.get(table);
    if (existing !== undefined) return existing;
    const next = new Map<string, CanonicalJsonRow>();
    this.state.canonicalTables.set(table, next);
    return next;
  }
}

export async function assertDatabaseDriverContract(
  createDriver: () => DatabaseDriver,
): Promise<void> {
  const driver = createDriver();
  const result = await driver.execute('SELECT 1 AS value');
  if (!Array.isArray(result.rows) || typeof result.rowsAffected !== 'number') {
    throw new Error('DatabaseDriver.execute must resolve a QueryResult.');
  }

  const committed = await driver.transaction(async (transactionDriver) => {
    await transactionDriver.execute('SELECT 1 AS value');
    return 'committed';
  });
  if (committed !== 'committed') {
    throw new Error('DatabaseDriver.transaction must return the work result.');
  }

  let rejected = false;
  try {
    await driver.transaction(async () => {
      throw new Error('rollback probe');
    });
  } catch {
    rejected = true;
  }
  if (!rejected) {
    throw new Error('DatabaseDriver.transaction must reject when work throws.');
  }
}

function createEmptyState(): InMemoryDriverState {
  return {
    schemaMigrations: [],
    canonicalRepositoryMigrations: [],
    auditLog: new Map(),
    canonicalTables: new Map(),
    searchIndex: new Map(),
    backgroundJobs: new Map(),
  };
}

function cloneState(state: InMemoryDriverState): InMemoryDriverState {
  return {
    schemaMigrations: state.schemaMigrations.map((row) => ({ ...row })),
    canonicalRepositoryMigrations: state.canonicalRepositoryMigrations.map((row) => ({ ...row })),
    auditLog: new Map([...state.auditLog].map(([key, row]) => [key, { ...row }])),
    canonicalTables: new Map(
      [...state.canonicalTables].map(([table, rows]) => [
        table,
        new Map([...rows].map(([key, row]) => [key, { ...row }])),
      ]),
    ),
    searchIndex: new Map([...state.searchIndex].map(([key, row]) => [key, { ...row }])),
    backgroundJobs: new Map([...state.backgroundJobs].map(([key, row]) => [key, { ...row }])),
  };
}

function normalizeSql(sql: string): string {
  return sql.trim().replace(/\s+/g, ' ').toLowerCase();
}

function searchKey(workspaceId: string, entityType: string, entityId: string): string {
  return `${workspaceId}\u0000${entityType}\u0000${entityId}`;
}

function canonicalEntityKey(workspaceId: string | null, id: string): string {
  return `${workspaceId ?? ''}\u0000${id}`;
}

const canonicalJsonTables = new Set([
  'workspaces',
  'accounts',
  'balance_observations',
  'current_balances',
  'balance_adjustments',
  'available_position_snapshots',
  'source_records',
  'provenance_records',
  'parsed_rows',
  'imported_claims',
  'import_drafts',
  'user_corrections',
  'transactions',
  'events',
  'commitments',
  'expectations',
  'planner_items',
  'plans',
  'plan_rules',
  'scenarios',
  'plan_impacts',
  'forecast_snapshots',
  'decision_records',
  'documents',
  'document_attachments',
  'calendar_items',
  'timeline_entries',
  'melo_memory',
  'melo_proposals',
]);

function requiredString(value: SqlValue | undefined, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`);
  }
  return value;
}

function nullableString(value: SqlValue | undefined, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string or null.`);
  }
  return value;
}

function requiredNumber(value: SqlValue | undefined, label: string): number {
  if (typeof value !== 'number') {
    throw new Error(`${label} must be a number.`);
  }
  return value;
}
