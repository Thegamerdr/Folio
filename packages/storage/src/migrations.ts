import { createChecksum, normalizeLineEndings, type Checksum } from './checksum.js';
import type { DatabaseDriver } from './driver.js';

export type MigrationDefinition = Readonly<{
  version: number;
  name: string;
  sql: string;
  checksum?: Checksum;
}>;

export type ChecksummedMigration = Readonly<{
  version: number;
  name: string;
  sql: string;
  checksum: Checksum;
}>;

export type AppliedMigration = Readonly<{
  version: number;
  name: string;
  checksum: Checksum;
  appliedAt?: string;
}>;

export type MigrationPlan = Readonly<{
  applied: readonly AppliedMigration[];
  pending: readonly ChecksummedMigration[];
}>;

export type ApplyMigrationsOptions = Readonly<{
  now?: () => Date;
}>;

type MigrationRow = Readonly<{
  version: number;
  name: string;
  checksum: string;
  applied_at?: string;
}>;

export function checksumMigration(
  input: Pick<MigrationDefinition, 'version' | 'name' | 'sql'>,
): Checksum {
  return createChecksum(
    `${input.version}\n${input.name.trim()}\n${normalizeLineEndings(input.sql)}`,
  );
}

export function defineMigration(input: MigrationDefinition): ChecksummedMigration {
  assertMigrationVersion(input.version);
  const name = normalizeMigrationName(input.name);
  const sql = normalizeLineEndings(input.sql);
  if (sql.length === 0) {
    throw new Error(`Migration ${input.version} (${name}) must include SQL.`);
  }

  const checksum = checksumMigration({ version: input.version, name, sql });
  if (input.checksum !== undefined && input.checksum !== checksum) {
    throw new Error(
      `Migration ${input.version} (${name}) checksum mismatch: expected ${input.checksum}, received ${checksum}.`,
    );
  }

  return {
    version: input.version,
    name,
    sql,
    checksum,
  };
}

export function validateMigrationOrder(
  migrations: readonly ChecksummedMigration[],
): readonly ChecksummedMigration[] {
  let previousVersion = 0;
  const seen = new Set<number>();

  for (const migration of migrations) {
    assertMigrationVersion(migration.version);
    if (seen.has(migration.version)) {
      throw new Error(`Duplicate migration version ${migration.version}.`);
    }
    if (migration.version <= previousVersion) {
      throw new Error('Migrations must be provided in strictly increasing version order.');
    }
    seen.add(migration.version);
    previousVersion = migration.version;
  }

  return migrations;
}

export function planMigrations(
  applied: readonly AppliedMigration[],
  migrations: readonly MigrationDefinition[],
): MigrationPlan {
  const checksummed = validateMigrationOrder(migrations.map(defineMigration));
  const appliedByVersion = new Map<number, AppliedMigration>();
  let highestApplied = 0;

  for (const row of applied) {
    assertMigrationVersion(row.version);
    if (appliedByVersion.has(row.version)) {
      throw new Error(`Duplicate applied migration version ${row.version}.`);
    }
    appliedByVersion.set(row.version, row);
    highestApplied = Math.max(highestApplied, row.version);
  }

  const knownVersions = new Set(checksummed.map((migration) => migration.version));
  for (const row of applied) {
    if (!knownVersions.has(row.version)) {
      throw new Error(`Database has unknown applied migration version ${row.version}.`);
    }
  }

  const pending: ChecksummedMigration[] = [];
  for (const migration of checksummed) {
    const appliedMigration = appliedByVersion.get(migration.version);
    if (appliedMigration === undefined) {
      if (migration.version < highestApplied) {
        throw new Error(`Database migration history has a gap before version ${highestApplied}.`);
      }
      pending.push(migration);
      continue;
    }

    if (appliedMigration.name !== migration.name) {
      throw new Error(
        `Applied migration ${migration.version} name mismatch: ${appliedMigration.name} != ${migration.name}.`,
      );
    }
    if (appliedMigration.checksum !== migration.checksum) {
      throw new Error(`Applied migration ${migration.version} checksum no longer matches.`);
    }
  }

  return {
    applied,
    pending,
  };
}

export async function ensureMigrationTable(driver: DatabaseDriver): Promise<void> {
  await driver.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

export async function readAppliedMigrations(
  driver: DatabaseDriver,
): Promise<readonly AppliedMigration[]> {
  const result = await driver.execute<MigrationRow>(
    'SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version',
  );

  return result.rows.map((row) => ({
    version: row.version,
    name: row.name,
    checksum: row.checksum as Checksum,
    ...(row.applied_at === undefined ? {} : { appliedAt: row.applied_at }),
  }));
}

export async function applyMigrations(
  driver: DatabaseDriver,
  migrations: readonly MigrationDefinition[],
  options: ApplyMigrationsOptions = {},
): Promise<MigrationPlan> {
  return driver.transaction(async (transactionDriver) => {
    await ensureMigrationTable(transactionDriver);
    const applied = await readAppliedMigrations(transactionDriver);
    const plan = planMigrations(applied, migrations);

    for (const migration of plan.pending) {
      await executeSqlBatch(transactionDriver, migration.sql);
      await transactionDriver.execute(
        'INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)',
        [
          migration.version,
          migration.name,
          migration.checksum,
          (options.now?.() ?? new Date()).toISOString(),
        ],
      );
    }

    return plan;
  });
}

export async function executeSqlBatch(driver: DatabaseDriver, sql: string): Promise<number> {
  const statements = splitSqlStatements(sql);
  for (const statement of statements) {
    await driver.execute(statement);
  }
  return statements.length;
}

export function splitSqlStatements(sql: string): readonly string[] {
  const statements: string[] = [];
  let current = '';
  let quote: "'" | '"' | undefined;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index] ?? '';
    const next = sql[index + 1] ?? '';

    if (inLineComment) {
      current += char;
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (quote !== undefined) {
      current += char;
      if (char === quote) {
        const previous = sql[index - 1] ?? '';
        if (previous !== '\\') quote = undefined;
      }
      continue;
    }

    if (char === '-' && next === '-') {
      current += char + next;
      index += 1;
      inLineComment = true;
      continue;
    }

    if (char === '/' && next === '*') {
      current += char + next;
      index += 1;
      inBlockComment = true;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }

    if (char === ';') {
      const statement = current.trim();
      if (statement.length > 0) statements.push(statement);
      current = '';
      continue;
    }

    current += char;
  }

  const finalStatement = current.trim();
  if (finalStatement.length > 0) statements.push(finalStatement);
  return statements;
}

function assertMigrationVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version <= 0) {
    throw new Error(`Migration version must be a positive safe integer: ${version}.`);
  }
}

function normalizeMigrationName(name: string): string {
  const normalized = name.trim();
  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
    throw new Error(`Migration name must be snake_case and start with a letter: ${name}.`);
  }
  return normalized;
}
