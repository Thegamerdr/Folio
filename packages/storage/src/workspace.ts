import type { WorkspaceId } from '@folio/domain';

import type { DatabaseDriver, QueryResult, SqlValue, WorkspaceScopedRepository } from './driver.js';

export class WorkspaceScope {
  readonly workspaceId: WorkspaceId;

  constructor(workspaceId: WorkspaceId) {
    if (String(workspaceId).trim().length === 0) {
      throw new Error('Workspace scope requires a non-empty workspaceId.');
    }
    this.workspaceId = workspaceId;
  }

  assertMatches(candidate: WorkspaceId, label = 'workspaceId'): void {
    if (candidate !== this.workspaceId) {
      throw new Error(
        `${label} ${candidate} does not match repository workspace ${this.workspaceId}.`,
      );
    }
  }

  assertSqlScoped(sql: string): void {
    assertWorkspaceScopedSql(sql);
  }
}

export abstract class WorkspaceScopedRepositoryBase implements WorkspaceScopedRepository {
  readonly workspaceId: WorkspaceId;
  protected readonly driver: DatabaseDriver;
  protected readonly scope: WorkspaceScope;

  protected constructor(driver: DatabaseDriver, workspaceId: WorkspaceId) {
    this.driver = driver;
    this.workspaceId = workspaceId;
    this.scope = new WorkspaceScope(workspaceId);
  }

  protected executeWorkspaceSql<TRow extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: readonly SqlValue[],
  ): Promise<QueryResult<TRow>> {
    this.scope.assertSqlScoped(sql);
    return this.driver.execute<TRow>(sql, params);
  }

  protected assertWorkspaceId(workspaceId: WorkspaceId): void {
    this.scope.assertMatches(workspaceId);
  }
}

export function assertWorkspaceScopedSql(sql: string): void {
  if (!/\bworkspace_id\b/i.test(sql)) {
    throw new Error(
      'Workspace-scoped repositories must include an explicit workspace_id predicate.',
    );
  }
}

export function assertSameWorkspace(
  expected: WorkspaceId,
  actual: WorkspaceId,
  label = 'workspaceId',
): void {
  if (actual !== expected) {
    throw new Error(`${label} ${actual} does not match expected workspace ${expected}.`);
  }
}
