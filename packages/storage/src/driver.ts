import type { WorkspaceId } from '@folio/domain';

export type SqlValue = string | number | bigint | Uint8Array | null;

export type QueryResult<TRow extends Record<string, unknown> = Record<string, unknown>> = Readonly<{
  rows: readonly TRow[];
  rowsAffected: number;
}>;

export interface DatabaseDriver {
  readonly engineName: string;
  execute<TRow extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly SqlValue[],
  ): Promise<QueryResult<TRow>>;
  transaction<T>(work: (driver: DatabaseDriver) => Promise<T>): Promise<T>;
}

export interface WorkspaceScopedRepository {
  readonly workspaceId: WorkspaceId;
}
