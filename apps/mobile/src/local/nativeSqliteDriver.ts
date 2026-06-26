import type { DatabaseDriver, QueryResult, SqlValue } from '@folio/storage';
import { open } from '@op-engineering/op-sqlite';

type NativeSqliteDatabase = ReturnType<typeof open>;

type NativeSqliteResult = Readonly<{
  rows?: unknown;
  rowsAffected?: unknown;
}>;

type TransactionState = {
  depth: number;
};

export class OpSqliteDatabaseDriver implements DatabaseDriver {
  readonly engineName = 'op-sqlite-sqlcipher';

  constructor(
    private readonly db: NativeSqliteDatabase,
    private readonly transactionState: TransactionState = { depth: 0 },
  ) {}

  async execute<TRow extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<QueryResult<TRow>> {
    const result = (await this.db.execute(
      sql,
      params.map(toNativeSqliteValue),
    )) as NativeSqliteResult;
    return {
      rows: Array.isArray(result.rows)
        ? result.rows.filter(isRecord).map((row) => row as TRow)
        : [],
      rowsAffected: typeof result.rowsAffected === 'number' ? result.rowsAffected : 0,
    };
  }

  async transaction<T>(work: (driver: DatabaseDriver) => Promise<T>): Promise<T> {
    if (this.transactionState.depth > 0) {
      this.transactionState.depth += 1;
      try {
        return await work(new OpSqliteDatabaseDriver(this.db, this.transactionState));
      } finally {
        this.transactionState.depth -= 1;
      }
    }

    await this.db.execute('BEGIN IMMEDIATE TRANSACTION');
    this.transactionState.depth = 1;
    try {
      const result = await work(new OpSqliteDatabaseDriver(this.db, this.transactionState));
      await this.db.execute('COMMIT');
      return result;
    } catch (error) {
      await this.db.execute('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      this.transactionState.depth = 0;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNativeSqliteValue(value: SqlValue): string | number | Uint8Array | null {
  return typeof value === 'bigint' ? value.toString() : value;
}
