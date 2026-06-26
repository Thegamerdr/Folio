import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  applyMigrations,
  createCanonicalSchemaMigration,
  createChecksum,
  defineMigration,
  InMemoryDatabaseDriver,
  splitSqlStatements,
  validateCanonicalSchemaString,
} from '../src/index.js';

describe('storage migrations and canonical schema helpers', () => {
  it('creates stable SHA-256 checksums without Node runtime crypto', () => {
    expect(createChecksum('abc')).toBe(
      'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(createChecksum('abc\r\n')).toBe(createChecksum('abc'));
  });

  it('splits migration SQL without breaking quoted semicolons', () => {
    expect(
      splitSqlStatements(`
        CREATE TABLE notes (body TEXT);
        INSERT INTO notes (body) VALUES ('keep; together');
      `),
    ).toEqual([
      'CREATE TABLE notes (body TEXT)',
      "INSERT INTO notes (body) VALUES ('keep; together')",
    ]);
  });

  it('applies ordered migrations and records checksums atomically', async () => {
    const driver = new InMemoryDatabaseDriver();
    const migrations = [
      { version: 1, name: 'create_notes', sql: 'CREATE TABLE notes (id TEXT PRIMARY KEY)' },
      { version: 2, name: 'add_note_index', sql: 'CREATE INDEX idx_notes_id ON notes(id)' },
    ];

    const plan = await applyMigrations(driver, migrations, {
      now: () => new Date('2026-06-20T10:00:00.000Z'),
    });

    expect(plan.pending.map((migration) => migration.version)).toEqual([1, 2]);
    expect(driver.appliedMigrations).toMatchObject([
      { version: 1, name: 'create_notes', appliedAt: '2026-06-20T10:00:00.000Z' },
      { version: 2, name: 'add_note_index', appliedAt: '2026-06-20T10:00:00.000Z' },
    ]);
    expect(driver.appliedMigrations[0]?.checksum).toMatch(/^sha256:/);
  });

  it('rejects applied migration checksum drift', async () => {
    const driver = new InMemoryDatabaseDriver();
    const original = defineMigration({
      version: 1,
      name: 'create_notes',
      sql: 'CREATE TABLE notes (id TEXT PRIMARY KEY)',
    });
    driver.seedAppliedMigration(original);

    await expect(
      applyMigrations(driver, [
        {
          version: 1,
          name: 'create_notes',
          sql: 'CREATE TABLE notes (id TEXT PRIMARY KEY, body TEXT)',
        },
      ]),
    ).rejects.toThrow(/checksum/);
  });

  it('validates the source-package canonical database schema string', async () => {
    const schemaPath = join(repoRoot(), 'docs/source-package/schemas/database.sql');
    const schemaSql = await readFile(schemaPath, 'utf8');

    const validation = validateCanonicalSchemaString(schemaSql);
    const migration = createCanonicalSchemaMigration(schemaSql);

    expect(validation.valid).toBe(true);
    expect(validation.snapshot.tables).toContain('source_records');
    expect(validation.snapshot.tables).toContain('provenance');
    expect(validation.snapshot.tables).toContain('import_drafts');
    expect(validation.snapshot.tables).toContain('commitments');
    expect(validation.snapshot.tables).toContain('expectations');
    expect(validation.snapshot.tables).toContain('planner_items');
    expect(validation.snapshot.tables).toContain('decision_records');
    expect(validation.snapshot.tables).toContain('timeline_entries');
    expect(validation.snapshot.tables).toContain('audit_log');
    expect(validation.snapshot.tables).toContain('search_index');
    expect(migration).toMatchObject({ version: 1, name: 'canonical_schema' });
    expect(migration.checksum).toMatch(/^sha256:/);
  });
});

function repoRoot(): string {
  return process.cwd().endsWith(join('packages', 'storage'))
    ? join(process.cwd(), '..', '..')
    : process.cwd();
}
