import type { WorkspaceId } from '@folio/domain';

import type { DatabaseDriver } from './driver.js';

export type SearchIndexEntry = Readonly<{
  workspaceId: WorkspaceId;
  entityType: string;
  entityId: string;
  title: string;
  body?: string;
  tags?: readonly string[];
}>;

export type SearchIndexRef = Readonly<{
  workspaceId: WorkspaceId;
  entityType: string;
  entityId: string;
}>;

export interface SearchIndexWriter {
  upsert(entry: SearchIndexEntry): Promise<void>;
  remove(ref: SearchIndexRef): Promise<void>;
  clearWorkspace(workspaceId: WorkspaceId): Promise<void>;
}

export class DriverSearchIndexWriter implements SearchIndexWriter {
  constructor(private readonly driver: DatabaseDriver) {}

  async upsert(entry: SearchIndexEntry): Promise<void> {
    assertSearchIndexEntry(entry);
    await this.remove(entry);
    await this.driver.execute(
      `INSERT INTO search_index (
        workspace_id,
        entity_type,
        entity_id,
        title,
        body,
        tags
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        entry.workspaceId,
        entry.entityType,
        entry.entityId,
        entry.title,
        entry.body ?? '',
        entry.tags?.join(' ') ?? '',
      ],
    );
  }

  async remove(ref: SearchIndexRef): Promise<void> {
    await this.driver.execute(
      'DELETE FROM search_index WHERE workspace_id = ? AND entity_type = ? AND entity_id = ?',
      [ref.workspaceId, ref.entityType, ref.entityId],
    );
  }

  async clearWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.driver.execute('DELETE FROM search_index WHERE workspace_id = ?', [workspaceId]);
  }
}

function assertSearchIndexEntry(entry: SearchIndexEntry): void {
  if (entry.entityType.trim().length === 0) {
    throw new Error('Search index entries require an entityType.');
  }
  if (entry.entityId.trim().length === 0) {
    throw new Error('Search index entries require an entityId.');
  }
  if (entry.title.trim().length === 0) {
    throw new Error('Search index entries require a title.');
  }
}
