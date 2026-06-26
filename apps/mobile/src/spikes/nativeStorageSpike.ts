import { isSQLCipher, open } from '@op-engineering/op-sqlite';
import type { DB, Scalar } from '@op-engineering/op-sqlite';
import { Platform } from 'react-native';

export type NativeStorageSpikeResult = Readonly<{
  platform: string;
  sqlCipherCompiled: boolean;
  cipherVersion: string;
  wrongKeyRejected: boolean;
  fts5MatchedRows: number;
  insertedRows: number;
  walMode: string;
  queryMs: number;
  totalMs: number;
}>;

export type NativeStorageSpikeProgress = Readonly<{
  phase: 'opening' | 'inserting' | 'indexing' | 'querying' | 'verifying-key';
  completedRows: number;
  totalRows: number;
}>;

export type NativeStorageSpikeOptions = Readonly<{
  onProgress?: (progress: NativeStorageSpikeProgress) => void;
}>;

const spikeDatabaseName = 'folio_phase1_native_spike.sqlite';
const encryptionKey = 'phase1-spike-runtime-key-not-for-production';
const wrongEncryptionKey = 'phase1-spike-wrong-key';
const insertedRows = 100_000;
const batchSize = 1_000;

export async function runNativeStorageSpike(
  options: NativeStorageSpikeOptions = {},
): Promise<NativeStorageSpikeResult> {
  if (Platform.OS === 'web') {
    throw new Error('Native storage spike requires a development build, not web or Expo Go.');
  }

  const startedAt = Date.now();
  resetSpikeDatabase();
  options.onProgress?.({ phase: 'opening', completedRows: 0, totalRows: insertedRows });

  const db = open({
    name: spikeDatabaseName,
    encryptionKey,
  });

  try {
    const cipherVersion = await readCipherVersion(db);
    const walMode = await setWalMode(db);

    await db.execute(
      'CREATE TABLE ledger (id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL)',
    );
    await db.execute('CREATE VIRTUAL TABLE ledger_fts USING fts5(title, body)');
    await insertSyntheticRows(db, options);
    await indexSyntheticRows(db, options);

    options.onProgress?.({
      phase: 'querying',
      completedRows: insertedRows,
      totalRows: insertedRows,
    });
    const queryStartedAt = Date.now();
    const ftsResult = await db.execute(
      "SELECT count(*) AS count FROM ledger_fts WHERE ledger_fts MATCH 'rent'",
    );
    const queryMs = Date.now() - queryStartedAt;

    db.close();

    return {
      platform: Platform.OS,
      sqlCipherCompiled: isSQLCipher(),
      cipherVersion,
      wrongKeyRejected: await verifyWrongKeyRejected(options),
      fts5MatchedRows: Number(ftsResult.rows[0]?.count ?? 0),
      insertedRows,
      walMode,
      queryMs,
      totalMs: Date.now() - startedAt,
    };
  } catch (error) {
    db.close();
    throw error;
  }
}

export function formatStorageSpikeProgress(progress: NativeStorageSpikeProgress | null): string {
  if (progress === null) return 'pending';
  if (progress.phase === 'opening') return 'opening encrypted DB';
  if (progress.phase === 'querying') return 'querying FTS5';
  if (progress.phase === 'verifying-key') return 'checking wrong key';

  const percent = Math.round((progress.completedRows / progress.totalRows) * 100);
  return `${progress.phase} ${percent}%`;
}

function resetSpikeDatabase(): void {
  try {
    const existing = open({
      name: spikeDatabaseName,
      encryptionKey,
    });
    existing.delete();
    existing.close();
  } catch {
    // A wrong-key or partially created database is acceptable here; open/delete is best effort.
  }
}

async function readCipherVersion(db: DB): Promise<string> {
  const result = await db.execute('PRAGMA cipher_version');
  const value = result.rows[0]?.cipher_version;
  return typeof value === 'string' && value.length > 0 ? value : 'unavailable';
}

async function setWalMode(db: DB): Promise<string> {
  const result = await db.execute('PRAGMA journal_mode = WAL');
  const value = result.rows[0]?.journal_mode;
  return typeof value === 'string' ? value : 'unknown';
}

async function insertSyntheticRows(db: DB, options: NativeStorageSpikeOptions): Promise<void> {
  for (let offset = 0; offset < insertedRows; offset += batchSize) {
    const rows: Scalar[][] = [];
    for (let index = offset; index < offset + batchSize; index += 1) {
      rows.push([
        index + 1,
        index % 2 === 0 ? 'rent ledger proof' : 'salary ledger proof',
        `synthetic row ${index + 1}`,
      ]);
    }
    await db.executeBatch([['INSERT INTO ledger (id, title, body) VALUES (?, ?, ?)', rows]]);
    options.onProgress?.({
      phase: 'inserting',
      completedRows: Math.min(offset + batchSize, insertedRows),
      totalRows: insertedRows,
    });
    await yieldToRenderer();
  }
}

async function indexSyntheticRows(db: DB, options: NativeStorageSpikeOptions): Promise<void> {
  for (let offset = 0; offset < insertedRows; offset += batchSize) {
    await db.execute(
      `
        INSERT INTO ledger_fts(rowid, title, body)
        SELECT id, title, body FROM ledger
        WHERE id > ? AND id <= ?
      `,
      [offset, offset + batchSize],
    );
    options.onProgress?.({
      phase: 'indexing',
      completedRows: Math.min(offset + batchSize, insertedRows),
      totalRows: insertedRows,
    });
    await yieldToRenderer();
  }
}

async function verifyWrongKeyRejected(options: NativeStorageSpikeOptions): Promise<boolean> {
  options.onProgress?.({
    phase: 'verifying-key',
    completedRows: insertedRows,
    totalRows: insertedRows,
  });
  await yieldToRenderer();

  let wrong: DB | undefined;
  try {
    wrong = open({
      name: spikeDatabaseName,
      encryptionKey: wrongEncryptionKey,
    });
    await wrong.execute('SELECT count(*) AS count FROM ledger');
    return false;
  } catch {
    return true;
  } finally {
    wrong?.close();
  }
}

async function yieldToRenderer(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}
