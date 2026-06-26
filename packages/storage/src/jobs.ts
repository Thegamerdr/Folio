import type { WorkspaceId } from '@folio/domain';

import type { DatabaseDriver } from './driver.js';
import { parseJsonRecord, stableStringify, type JsonRecord } from './json.js';

export type LocalJobState = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type LocalJob = Readonly<{
  id: string;
  workspaceId?: WorkspaceId;
  kind: string;
  state: LocalJobState;
  checkpoint: JsonRecord | null;
  attempts: number;
  runAfter?: string;
  lastErrorCode?: string;
  createdAt: string;
  updatedAt: string;
}>;

export type EnqueueLocalJobInput = Readonly<{
  id: string;
  kind: string;
  workspaceId?: WorkspaceId;
  checkpoint?: JsonRecord;
  runAfter?: Date;
  now?: Date;
}>;

type LocalJobRow = Readonly<{
  id: string;
  workspace_id: string | null;
  kind: string;
  state: LocalJobState;
  checkpoint_json: string | null;
  attempts: number;
  run_after: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
}>;

export class LocalJobRepository {
  constructor(private readonly driver: DatabaseDriver) {}

  async enqueue(input: EnqueueLocalJobInput): Promise<LocalJob> {
    const now = (input.now ?? new Date()).toISOString();
    const checkpointJson =
      input.checkpoint === undefined ? null : stableStringify(input.checkpoint);
    const runAfter = input.runAfter?.toISOString() ?? null;

    await this.driver.execute(
      `INSERT INTO background_jobs (
        id,
        workspace_id,
        kind,
        state,
        checkpoint_json,
        attempts,
        run_after,
        last_error_code,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspaceId ?? null,
        input.kind,
        'queued',
        checkpointJson,
        0,
        runAfter,
        null,
        now,
        now,
      ],
    );

    return {
      id: input.id,
      kind: input.kind,
      state: 'queued',
      checkpoint: input.checkpoint ?? null,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      ...(input.workspaceId === undefined ? {} : { workspaceId: input.workspaceId }),
      ...(runAfter === null ? {} : { runAfter }),
    };
  }

  async load(id: string): Promise<LocalJob | undefined> {
    const result = await this.driver.execute<LocalJobRow>(
      `SELECT
        id,
        workspace_id,
        kind,
        state,
        checkpoint_json,
        attempts,
        run_after,
        last_error_code,
        created_at,
        updated_at
      FROM background_jobs
      WHERE id = ?`,
      [id],
    );
    const row = result.rows[0];
    return row === undefined ? undefined : mapLocalJobRow(row);
  }

  async markRunning(id: string, now = new Date()): Promise<void> {
    await this.driver.execute(
      `UPDATE background_jobs
      SET state = 'running', attempts = attempts + 1, updated_at = ?
      WHERE id = ? AND state IN ('queued', 'paused', 'failed')`,
      [now.toISOString(), id],
    );
  }

  async saveCheckpoint(id: string, checkpoint: JsonRecord, now = new Date()): Promise<void> {
    await this.driver.execute(
      `UPDATE background_jobs
      SET checkpoint_json = ?, updated_at = ?
      WHERE id = ? AND state IN ('queued', 'running', 'paused', 'failed')`,
      [stableStringify(checkpoint), now.toISOString(), id],
    );
  }

  async complete(id: string, now = new Date()): Promise<void> {
    await this.driver.execute(
      `UPDATE background_jobs
      SET state = 'completed', updated_at = ?
      WHERE id = ?`,
      [now.toISOString(), id],
    );
  }

  async fail(id: string, input: { errorCode: string; runAfter?: Date; now?: Date }): Promise<void> {
    const now = input.now ?? new Date();
    await this.driver.execute(
      `UPDATE background_jobs
      SET state = 'failed', last_error_code = ?, run_after = ?, updated_at = ?
      WHERE id = ?`,
      [input.errorCode, input.runAfter?.toISOString() ?? null, now.toISOString(), id],
    );
  }
}

export function shouldResumeLocalJob(job: LocalJob, at = new Date()): boolean {
  if (job.state !== 'queued' && job.state !== 'paused' && job.state !== 'failed') return false;
  if (job.runAfter === undefined) return true;
  return Date.parse(job.runAfter) <= at.getTime();
}

function mapLocalJobRow(row: LocalJobRow): LocalJob {
  const checkpoint =
    row.checkpoint_json === null ? null : parseJsonRecord(row.checkpoint_json, 'checkpoint');
  return {
    id: row.id,
    kind: row.kind,
    state: row.state,
    checkpoint,
    attempts: row.attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.workspace_id === null ? {} : { workspaceId: row.workspace_id as WorkspaceId }),
    ...(row.run_after === null ? {} : { runAfter: row.run_after }),
    ...(row.last_error_code === null ? {} : { lastErrorCode: row.last_error_code }),
  };
}
