import type { DatabaseDriver } from './driver.js';
import { planMigrations, readAppliedMigrations, type MigrationDefinition } from './migrations.js';
import { validateCanonicalSchemaString } from './schema.js';

export type VaultHealthStatus = 'pass' | 'warn' | 'fail';

export type VaultHealthCheck = Readonly<{
  name: string;
  status: VaultHealthStatus;
  message: string;
}>;

export type VaultHealthReport = Readonly<{
  status: VaultHealthStatus;
  checks: readonly VaultHealthCheck[];
}>;

export type VaultHealthOptions = Readonly<{
  canonicalSchemaSql?: string;
  expectedMigrations?: readonly MigrationDefinition[];
}>;

type PragmaRow = Record<string, unknown>;

export async function runVaultHealthChecks(
  driver: DatabaseDriver,
  options: VaultHealthOptions = {},
): Promise<VaultHealthReport> {
  const checks: VaultHealthCheck[] = [];
  checks.push(await runQuickCheck(driver));
  checks.push(await runForeignKeyCheck(driver));

  if (options.expectedMigrations !== undefined) {
    checks.push(await runMigrationCheck(driver, options.expectedMigrations));
  }

  if (options.canonicalSchemaSql !== undefined) {
    const validation = validateCanonicalSchemaString(options.canonicalSchemaSql);
    checks.push({
      name: 'canonical_schema',
      status: validation.valid ? 'pass' : 'fail',
      message: validation.valid
        ? `Canonical schema validates (${validation.snapshot.checksum}).`
        : validation.issues.map((issue) => issue.message).join(' '),
    });
  }

  return {
    status: summarizeHealthStatus(checks),
    checks,
  };
}

function summarizeHealthStatus(checks: readonly VaultHealthCheck[]): VaultHealthStatus {
  if (checks.some((check) => check.status === 'fail')) return 'fail';
  if (checks.some((check) => check.status === 'warn')) return 'warn';
  return 'pass';
}

async function runQuickCheck(driver: DatabaseDriver): Promise<VaultHealthCheck> {
  try {
    const result = await driver.execute<PragmaRow>('PRAGMA quick_check');
    const values = result.rows.flatMap((row) => Object.values(row));
    const ok = values.length === 0 || values.some((value) => String(value).toLowerCase() === 'ok');
    return {
      name: 'quick_check',
      status: ok ? 'pass' : 'fail',
      message: ok
        ? 'SQLite quick_check passed.'
        : `SQLite quick_check reported ${values.join(', ')}.`,
    };
  } catch (error) {
    return {
      name: 'quick_check',
      status: 'fail',
      message: `SQLite quick_check failed: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }
}

async function runForeignKeyCheck(driver: DatabaseDriver): Promise<VaultHealthCheck> {
  try {
    const result = await driver.execute<PragmaRow>('PRAGMA foreign_key_check');
    return {
      name: 'foreign_key_check',
      status: result.rows.length === 0 ? 'pass' : 'fail',
      message:
        result.rows.length === 0
          ? 'SQLite foreign_key_check passed.'
          : `SQLite foreign_key_check found ${result.rows.length} violation(s).`,
    };
  } catch (error) {
    return {
      name: 'foreign_key_check',
      status: 'fail',
      message: `SQLite foreign_key_check failed: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }
}

async function runMigrationCheck(
  driver: DatabaseDriver,
  expectedMigrations: readonly MigrationDefinition[],
): Promise<VaultHealthCheck> {
  try {
    const applied = await readAppliedMigrations(driver);
    const plan = planMigrations(applied, expectedMigrations);
    return {
      name: 'migrations',
      status: plan.pending.length === 0 ? 'pass' : 'warn',
      message:
        plan.pending.length === 0
          ? 'All expected migrations are applied.'
          : `${plan.pending.length} expected migration(s) are pending.`,
    };
  } catch (error) {
    return {
      name: 'migrations',
      status: 'fail',
      message: `Migration health check failed: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }
}
