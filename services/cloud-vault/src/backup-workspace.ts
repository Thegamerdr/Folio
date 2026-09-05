const MAX_BACKUP_BYTES = 4 * 1024 * 1024;
const BACKUP_CHUNK_BYTES = 256 * 1024;
const WORKSPACE_REF_PATTERN = /^[a-f0-9]{64}$/;
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/;
const DEVICE_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export type BackupGenerationStatus = Readonly<{
  exists: boolean;
  revision: number;
  generations?: number;
  generation?: number;
  previousGeneration?: number | null;
  anchorGeneration?: number | null;
  createdAt?: string;
  size?: number;
  checksum?: string;
  deviceId?: string;
}>;

type GenerationRow = Readonly<{
  workspace_ref: string;
  generation: number;
  checksum: string;
  size: number;
  created_at: string;
  device_id: string;
}>;

type CatalogRow = Readonly<{
  workspace_ref: string;
  current_generation: number;
  previous_generation: number | null;
  created_at: string;
  size: number;
  checksum: string;
  anchor_generation: number | null;
}>;
type TombstoneRow = Readonly<{ workspace_ref: string; last_generation: number; revision: number }>;

/** Account-scoped authoritative backup head/catalog. Each object is named by hashed account ID. */
export class BackupWorkspaceDurableObject implements DurableObject {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
    state.blockConcurrencyWhile(async () => {
      state.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS backup_catalog (
          workspace_ref TEXT PRIMARY KEY,
          current_generation INTEGER NOT NULL,
          previous_generation INTEGER,
          created_at TEXT NOT NULL,
          size INTEGER NOT NULL,
          checksum TEXT NOT NULL,
          anchor_generation INTEGER
        );
        CREATE TABLE IF NOT EXISTS backup_generations (
          workspace_ref TEXT NOT NULL,
          generation INTEGER NOT NULL,
          checksum TEXT NOT NULL,
          size INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          device_id TEXT NOT NULL,
          PRIMARY KEY (workspace_ref, generation)
        );
        CREATE TABLE IF NOT EXISTS backup_chunks (
          workspace_ref TEXT NOT NULL,
          generation INTEGER NOT NULL,
          chunk_index INTEGER NOT NULL,
          bytes BLOB NOT NULL,
          PRIMARY KEY (workspace_ref, generation, chunk_index)
        );
        CREATE TABLE IF NOT EXISTS backup_tombstones (
          workspace_ref TEXT PRIMARY KEY,
          last_generation INTEGER NOT NULL,
          revision INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS backup_account_guard (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          deleted INTEGER NOT NULL,
          revision INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sync_workspace_inventory (
          workspace_ref TEXT PRIMARY KEY,
          revision INTEGER NOT NULL,
          deleted INTEGER NOT NULL DEFAULT 0
        );
        INSERT OR IGNORE INTO backup_account_guard (id, deleted, revision) VALUES (1, 0, 0);
      `);
      try {
        state.storage.sql.exec(
          'ALTER TABLE backup_tombstones ADD COLUMN revision INTEGER NOT NULL DEFAULT 1',
        );
      } catch {
        /* already migrated */
      }
      try {
        state.storage.sql.exec('ALTER TABLE backup_catalog ADD COLUMN anchor_generation INTEGER');
      } catch {
        // Existing v1 authority tables already have this column after the first migration.
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/internal/backup/catalog') {
        return this.catalog();
      }
      if (request.method === 'DELETE' && url.pathname === '/internal/backup/account') {
        return this.deleteAccount();
      }
      if (request.method === 'GET' && url.pathname === '/internal/sync/catalog') {
        return this.syncCatalog();
      }
      if (request.method === 'POST' && url.pathname === '/internal/sync/admit') {
        const workspaceRef = normalizeWorkspaceRef(url.searchParams.get('workspaceRef'));
        if (workspaceRef === null)
          return json({ error: 'A valid workspace reference is required.' }, 400);
        return this.admitSyncWorkspace(workspaceRef);
      }
      if (request.method === 'DELETE' && url.pathname === '/internal/sync') {
        const workspaceRef = normalizeWorkspaceRef(url.searchParams.get('workspaceRef'));
        if (workspaceRef === null)
          return json({ error: 'A valid workspace reference is required.' }, 400);
        return this.deleteSyncWorkspace(workspaceRef);
      }
      if (request.method === 'POST' && url.pathname === '/internal/backup/adopt') {
        const workspaceRef = normalizeWorkspaceRef(url.searchParams.get('workspaceRef'));
        if (workspaceRef === null)
          return json({ error: 'A valid workspace reference is required.' }, 400);
        return await this.adopt(workspaceRef, request);
      }
      const workspaceRef = normalizeWorkspaceRef(url.searchParams.get('workspaceRef'));
      if (workspaceRef === null)
        return json({ error: 'A valid workspace reference is required.' }, 400);
      if (request.method === 'GET' && url.pathname === '/internal/backup/status') {
        return json(this.status(workspaceRef));
      }
      if (request.method === 'GET' && url.pathname === '/internal/backup/content') {
        const generation = url.searchParams.get('generation');
        if (
          generation !== null &&
          generation !== 'previous' &&
          generation !== 'anchor' &&
          generation !== 'current'
        ) {
          return json({ error: 'Unknown backup generation.' }, 400);
        }
        return this.content(
          workspaceRef,
          generation === 'previous' ? 'previous' : generation === 'anchor' ? 'anchor' : 'current',
        );
      }
      if (request.method === 'DELETE' && url.pathname === '/internal/backup') {
        return this.deleteWorkspace(workspaceRef);
      }
      if (request.method === 'PUT' && url.pathname === '/internal/backup') {
        return await this.put(workspaceRef, request);
      }
      return json({ error: 'Route not found.' }, 404);
    } catch (error: unknown) {
      console.error(
        JSON.stringify({
          message: 'backup authority request failed',
          error: error instanceof Error ? error.message : 'unknown',
        }),
      );
      return json({ error: 'The encrypted backup authority is temporarily unavailable.' }, 503);
    }
  }

  private status(workspaceRef: string): BackupGenerationStatus {
    const guard = this.state.storage.sql
      .exec<{
        deleted: number;
        revision: number;
      }>('SELECT deleted, revision FROM backup_account_guard WHERE id = 1')
      .toArray()[0];
    if (guard?.deleted === 1) return { exists: false, revision: guard.revision };
    const row = this.state.storage.sql
      .exec<CatalogRow>(
        'SELECT workspace_ref, current_generation, previous_generation, anchor_generation, created_at, size, checksum FROM backup_catalog WHERE workspace_ref = ?',
        workspaceRef,
      )
      .toArray()[0];
    const tombstone = this.state.storage.sql
      .exec<TombstoneRow>(
        'SELECT workspace_ref, last_generation, revision FROM backup_tombstones WHERE workspace_ref = ?',
        workspaceRef,
      )
      .toArray()[0];
    if (row === undefined) return { exists: false, revision: tombstone?.revision ?? 0 };
    const current = this.state.storage.sql
      .exec<GenerationRow>(
        'SELECT device_id FROM backup_generations WHERE workspace_ref = ? AND generation = ?',
        workspaceRef,
        row.current_generation,
      )
      .toArray()[0];
    return {
      exists: true,
      revision: tombstone?.revision ?? 0,
      generations: this.generationCount(row),
      generation: row.current_generation,
      previousGeneration: row.previous_generation,
      anchorGeneration: row.anchor_generation,
      createdAt: row.created_at,
      size: row.size,
      checksum: row.checksum,
      deviceId: current?.device_id,
    };
  }

  private catalog(): Response {
    const rows = this.state.storage.sql
      .exec<CatalogRow>(
        'SELECT workspace_ref, current_generation, previous_generation, anchor_generation, created_at, size, checksum FROM backup_catalog ORDER BY workspace_ref',
      )
      .toArray();
    return json({
      workspaces: rows.map((row) => ({
        workspaceRef: row.workspace_ref,
        generation: row.current_generation,
        previousGeneration: row.previous_generation,
        anchorGeneration: row.anchor_generation,
        createdAt: row.created_at,
        size: row.size,
        checksum: row.checksum,
      })),
    });
  }

  /** Sync admission is serialized with account deletion in this account-scoped SQLite DO. */
  private syncCatalog(): Response {
    const guard = this.state.storage.sql
      .exec<{ deleted: number; revision: number }>(
        'SELECT deleted, revision FROM backup_account_guard WHERE id = 1',
      )
      .toArray()[0];
    const rows = this.state.storage.sql
      .exec<{ workspace_ref: string; revision: number; deleted: number }>(
        'SELECT workspace_ref, revision, deleted FROM sync_workspace_inventory ORDER BY workspace_ref',
      )
      .toArray();
    return json({
      accountDeleted: guard?.deleted === 1,
      accountRevision: guard?.revision ?? 0,
      workspaces: rows.map((row) => ({
        workspaceRef: row.workspace_ref,
        revision: row.revision,
        deleted: row.deleted === 1,
      })),
    });
  }

  private admitSyncWorkspace(workspaceRef: string): Response {
    const result = this.state.storage.transactionSync(() => {
      const guard = this.state.storage.sql
        .exec<{ deleted: number; revision: number }>(
          'SELECT deleted, revision FROM backup_account_guard WHERE id = 1',
        )
        .toArray()[0];
      if (guard?.deleted === 1)
        return { status: 410, body: { error: 'This account sync authority has been deleted.' } };
      const existing = this.state.storage.sql
        .exec<{ revision: number; deleted: number }>(
          'SELECT revision, deleted FROM sync_workspace_inventory WHERE workspace_ref = ?',
          workspaceRef,
        )
        .toArray()[0];
      if (existing?.deleted === 1)
        return { status: 410, body: { error: 'This workspace sync authority has been deleted.' } };
      if (existing === undefined) {
        this.state.storage.sql.exec(
          'INSERT INTO sync_workspace_inventory (workspace_ref, revision, deleted) VALUES (?, 1, 0)',
          workspaceRef,
        );
        return { status: 201, body: { ok: true, workspaceRef, revision: 1 } };
      }
      return { status: 200, body: { ok: true, workspaceRef, revision: existing.revision } };
    });
    return json(result.body, result.status);
  }

  private deleteSyncWorkspace(workspaceRef: string): Response {
    const result = this.state.storage.transactionSync(() => {
      const existing = this.state.storage.sql
        .exec<{ revision: number }>(
          'SELECT revision FROM sync_workspace_inventory WHERE workspace_ref = ?',
          workspaceRef,
        )
        .toArray()[0];
      const revision = (existing?.revision ?? 0) + 1;
      this.state.storage.sql.exec(
        'INSERT INTO sync_workspace_inventory (workspace_ref, revision, deleted) VALUES (?, ?, 1) ON CONFLICT(workspace_ref) DO UPDATE SET revision = excluded.revision, deleted = 1',
        workspaceRef,
        revision,
      );
      return { revision };
    });
    return json({ ok: true, deleted: true, workspaceRef, revision: result.revision });
  }

  private content(workspaceRef: string, which: 'current' | 'previous' | 'anchor'): Response {
    const catalog = this.state.storage.sql
      .exec<CatalogRow>(
        'SELECT current_generation, previous_generation, anchor_generation FROM backup_catalog WHERE workspace_ref = ?',
        workspaceRef,
      )
      .toArray()[0];
    if (catalog === undefined) return json({ error: 'No encrypted backup exists.' }, 404);
    const generation =
      which === 'previous'
        ? catalog.previous_generation
        : which === 'anchor'
          ? catalog.anchor_generation
          : catalog.current_generation;
    if (generation === null || generation === undefined)
      return json({ error: 'No previous encrypted backup exists.' }, 404);
    const rows = this.state.storage.sql
      .exec<{
        bytes: ArrayBuffer;
      }>('SELECT bytes FROM backup_chunks WHERE workspace_ref = ? AND generation = ? ORDER BY chunk_index', workspaceRef, generation)
      .toArray();
    const total = rows.reduce((sum, row) => sum + row.bytes.byteLength, 0);
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const row of rows) {
      bytes.set(new Uint8Array(row.bytes), offset);
      offset += row.bytes.byteLength;
    }
    const metadata = this.state.storage.sql
      .exec<GenerationRow>(
        'SELECT checksum, created_at, device_id FROM backup_generations WHERE workspace_ref = ? AND generation = ?',
        workspaceRef,
        generation,
      )
      .toArray()[0];
    if (metadata === undefined) return json({ error: 'Backup generation is incomplete.' }, 503);
    return new Response(bytes, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/vnd.melo.encrypted-backup+json',
        'Content-Length': String(bytes.byteLength),
        ETag: `"${metadata.checksum}"`,
        'X-Melo-Checksum': metadata.checksum,
        'X-Melo-Created-At': metadata.created_at,
        'X-Melo-Device': metadata.device_id,
      },
    });
  }

  private async put(workspaceRef: string, request: Request): Promise<Response> {
    const body = await readBoundedBody(request, MAX_BACKUP_BYTES);
    if (body === null)
      return json(
        { error: `Encrypted backup must be between 1 and ${MAX_BACKUP_BYTES} bytes.` },
        413,
      );
    const checksum = request.headers.get('X-Melo-Checksum')?.trim().toLowerCase() ?? '';
    const createdAt = request.headers.get('X-Melo-Created-At')?.trim() ?? '';
    const deviceId = request.headers.get('X-Melo-Device')?.trim() ?? '';
    if (
      body.byteLength === 0 ||
      body.byteLength > MAX_BACKUP_BYTES ||
      !CHECKSUM_PATTERN.test(checksum) ||
      !isIso(createdAt) ||
      !DEVICE_PATTERN.test(deviceId)
    ) {
      return json({ error: 'Encrypted backup metadata or size is invalid.' }, 400);
    }
    const actual = await sha256Hex(body);
    if (actual !== checksum)
      return json({ error: 'Encrypted backup checksum did not match.' }, 400);
    const ifMatch = request.headers.get('If-Match')?.trim() ?? null;
    const ifNoneMatch = request.headers.get('If-None-Match')?.trim() ?? null;
    const keyRotation = request.headers.get('X-Melo-Key-Rotation')?.trim() === '1';
    const result = this.state.storage.transactionSync(() => {
      const guard = this.state.storage.sql
        .exec<{ deleted: number }>('SELECT deleted FROM backup_account_guard WHERE id = 1')
        .toArray()[0];
      if (guard?.deleted === 1)
        return { status: 410, error: 'This account backup authority has been deleted.' };
      const current = this.state.storage.sql
        .exec<CatalogRow>(
          'SELECT current_generation, previous_generation, anchor_generation, created_at, size, checksum FROM backup_catalog WHERE workspace_ref = ?',
          workspaceRef,
        )
        .toArray()[0];
      const tombstone = this.state.storage.sql
        .exec<TombstoneRow>(
          'SELECT workspace_ref, last_generation, revision FROM backup_tombstones WHERE workspace_ref = ?',
          workspaceRef,
        )
        .toArray()[0];
      const currentGeneration = current?.current_generation;
      const currentPrevious = current?.previous_generation ?? null;
      const currentAnchor = current?.anchor_generation ?? null;
      const currentBytes =
        currentGeneration === undefined
          ? undefined
          : this.state.storage.sql
              .exec<GenerationRow>(
                'SELECT generation, checksum, size, created_at, device_id FROM backup_generations WHERE workspace_ref = ? AND generation = ? AND checksum = ? AND size = ?',
                workspaceRef,
                currentGeneration,
                checksum,
                body.byteLength,
              )
              .toArray()[0];
      if (currentBytes !== undefined) {
        if (ifMatch === null && ifNoneMatch === null)
          return { status: 428, error: 'A backup generation precondition is required.' };
        return {
          status: 200,
          generation: currentBytes.generation,
          previousGeneration: currentPrevious,
          anchorGeneration: currentAnchor,
          revision: tombstone?.revision ?? 0,
          generations: this.generationCount({
            previous_generation: currentPrevious,
            anchor_generation: currentAnchor,
          }),
          createdAt: currentBytes.created_at,
          checksum: currentBytes.checksum,
          size: currentBytes.size,
          deviceId: currentBytes.device_id,
          idempotent: true,
        };
      }
      if (current === undefined) {
        if (ifNoneMatch !== '*') {
          return tombstone === undefined
            ? { status: 428, error: 'A create-only precondition is required for the first backup.' }
            : { status: 412, error: 'The deleted backup generation cannot be resurrected.' };
        }
        const revisionHeader = request.headers.get('X-Melo-Backup-Revision');
        const requestedRevision =
          revisionHeader === null
            ? tombstone === undefined
              ? 0
              : Number.NaN
            : Number(revisionHeader);
        if (
          !Number.isSafeInteger(requestedRevision) ||
          requestedRevision !== (tombstone?.revision ?? 0)
        ) {
          return {
            status: 412,
            error: 'The backup deletion revision changed. Refresh before creating it.',
          };
        }
      } else if (ifMatch !== String(currentGeneration)) {
        return {
          status: ifMatch === null && ifNoneMatch === null ? 428 : 412,
          error:
            ifMatch === null && ifNoneMatch === null
              ? 'An If-Match generation precondition is required.'
              : 'The backup generation changed. Refresh before replacing it.',
        };
      }
      const generation =
        Math.max(current?.current_generation ?? 0, tombstone?.last_generation ?? 0) + 1;
      // A key rotation promotes the old current generation to the old-key anchor while retaining
      // the prior ordinary generation separately. Ordinary updates continue to roll current into
      // previous and never evict the explicit anchor.
      const previous = keyRotation ? currentPrevious : (currentGeneration ?? null);
      const anchor = keyRotation ? (currentGeneration ?? null) : currentAnchor;
      if (currentAnchor !== null && currentAnchor !== anchor) {
        this.deleteGeneration(workspaceRef, currentAnchor);
      }
      if (currentPrevious !== null && currentPrevious !== previous && currentPrevious !== anchor) {
        this.deleteGeneration(workspaceRef, currentPrevious);
      }
      for (
        let offset = 0, index = 0;
        offset < body.byteLength;
        offset += BACKUP_CHUNK_BYTES, index += 1
      ) {
        const chunk = body.slice(offset, Math.min(offset + BACKUP_CHUNK_BYTES, body.byteLength));
        this.state.storage.sql.exec(
          'INSERT INTO backup_chunks (workspace_ref, generation, chunk_index, bytes) VALUES (?, ?, ?, ?)',
          workspaceRef,
          generation,
          index,
          chunk.buffer,
        );
      }
      this.state.storage.sql.exec(
        'INSERT INTO backup_generations (workspace_ref, generation, checksum, size, created_at, device_id) VALUES (?, ?, ?, ?, ?, ?)',
        workspaceRef,
        generation,
        checksum,
        body.byteLength,
        createdAt,
        deviceId,
      );
      this.state.storage.sql.exec(
        'INSERT INTO backup_catalog (workspace_ref, current_generation, previous_generation, anchor_generation, created_at, size, checksum) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(workspace_ref) DO UPDATE SET current_generation = excluded.current_generation, previous_generation = excluded.previous_generation, anchor_generation = excluded.anchor_generation, created_at = excluded.created_at, size = excluded.size, checksum = excluded.checksum',
        workspaceRef,
        generation,
        previous,
        anchor,
        createdAt,
        body.byteLength,
        checksum,
      );
      return {
        status: 201,
        generation,
        previousGeneration: previous,
        anchorGeneration: anchor,
        generations: this.generationCount({
          previous_generation: previous,
          anchor_generation: anchor,
        } as CatalogRow),
        revision: tombstone?.revision ?? 0,
        createdAt,
        checksum,
        size: body.byteLength,
        deviceId,
        idempotent: false,
      };
    });
    if ('error' in result) return json({ error: result.error }, result.status);
    return json(
      {
        ok: true,
        generation: result.generation,
        previousGeneration: result.previousGeneration,
        anchorGeneration: result.anchorGeneration,
        generations: result.generations,
        revision: result.revision,
        createdAt: result.createdAt,
        checksum: result.checksum,
        size: result.size,
        deviceId: result.deviceId,
        idempotent: result.idempotent,
      },
      result.status,
    );
  }

  /** Publish both read-only KV generations together; a tombstone permanently forbids adoption. */
  private async adopt(workspaceRef: string, request: Request): Promise<Response> {
    const bytes = await readBoundedBody(request, MAX_BACKUP_BYTES * 2 + 8192);
    if (bytes === null) return json({ error: 'Legacy backup exceeds the migration limit.' }, 413);
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return json({ error: 'Invalid migration payload.' }, 400);
    }
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 2)
      return json({ error: 'Invalid migration generations.' }, 400);
    const generations: Array<{
      bytes: Uint8Array;
      checksum: string;
      createdAt: string;
      deviceId: string;
    }> = [];
    for (const value of parsed) {
      if (
        value === null ||
        typeof value !== 'object' ||
        typeof value.body !== 'string' ||
        typeof value.createdAt !== 'string' ||
        !isIso(value.createdAt) ||
        typeof value.deviceId !== 'string' ||
        !DEVICE_PATTERN.test(value.deviceId)
      )
        return json({ error: 'Invalid migration metadata.' }, 400);
      const body = new TextEncoder().encode(value.body);
      if (body.byteLength === 0 || body.byteLength > MAX_BACKUP_BYTES)
        return json({ error: 'Invalid migration size.' }, 413);
      const checksum = await sha256Hex(body);
      if (checksum !== value.checksum)
        return json({ error: 'Legacy backup checksum did not match.' }, 400);
      generations.push({
        bytes: body,
        checksum,
        createdAt: value.createdAt,
        deviceId: value.deviceId,
      });
    }
    return this.state.storage.transactionSync(() => {
      const guard = this.state.storage.sql
        .exec<{ deleted: number }>('SELECT deleted FROM backup_account_guard WHERE id = 1')
        .toArray()[0];
      if (guard?.deleted === 1) return json({ error: 'This backup account was deleted.' }, 410);
      if (
        this.state.storage.sql
          .exec('SELECT 1 FROM backup_tombstones WHERE workspace_ref = ?', workspaceRef)
          .toArray().length
      )
        return json({ error: 'Deleted backups cannot be migrated again.' }, 412);
      if (
        this.state.storage.sql
          .exec('SELECT 1 FROM backup_catalog WHERE workspace_ref = ?', workspaceRef)
          .toArray().length
      )
        return json({ ok: true, adopted: false });
      for (const [index, generation] of generations.entries()) {
        const number = index + 1;
        for (
          let offset = 0, chunkIndex = 0;
          offset < generation.bytes.byteLength;
          offset += BACKUP_CHUNK_BYTES, chunkIndex += 1
        ) {
          const chunk = generation.bytes.slice(offset, offset + BACKUP_CHUNK_BYTES);
          this.state.storage.sql.exec(
            'INSERT INTO backup_chunks (workspace_ref, generation, chunk_index, bytes) VALUES (?, ?, ?, ?)',
            workspaceRef,
            number,
            chunkIndex,
            chunk.buffer,
          );
        }
        this.state.storage.sql.exec(
          'INSERT INTO backup_generations (workspace_ref, generation, checksum, size, created_at, device_id) VALUES (?, ?, ?, ?, ?, ?)',
          workspaceRef,
          number,
          generation.checksum,
          generation.bytes.byteLength,
          generation.createdAt,
          generation.deviceId,
        );
      }
      const current = generations[generations.length - 1]!;
      this.state.storage.sql.exec(
        'INSERT INTO backup_catalog (workspace_ref, current_generation, previous_generation, anchor_generation, created_at, size, checksum) VALUES (?, ?, ?, NULL, ?, ?, ?)',
        workspaceRef,
        generations.length,
        generations.length === 2 ? 1 : null,
        current.createdAt,
        current.bytes.byteLength,
        current.checksum,
      );
      return json({ ok: true, adopted: true }, 201);
    });
  }

  private generationCount(
    row: Pick<CatalogRow, 'previous_generation' | 'anchor_generation'>,
  ): number {
    return (
      1 +
      (row.previous_generation === null || row.previous_generation === undefined ? 0 : 1) +
      (row.anchor_generation === null ||
      row.anchor_generation === undefined ||
      row.anchor_generation === row.previous_generation
        ? 0
        : 1)
    );
  }

  private deleteGeneration(workspaceRef: string, generation: number): void {
    this.state.storage.sql.exec(
      'DELETE FROM backup_chunks WHERE workspace_ref = ? AND generation = ?',
      workspaceRef,
      generation,
    );
    this.state.storage.sql.exec(
      'DELETE FROM backup_generations WHERE workspace_ref = ? AND generation = ?',
      workspaceRef,
      generation,
    );
  }

  private deleteWorkspace(workspaceRef: string): Response {
    this.state.storage.transactionSync(() => {
      const rows = this.state.storage.sql
        .exec<{
          generation: number;
        }>('SELECT generation FROM backup_generations WHERE workspace_ref = ?', workspaceRef)
        .toArray();
      const lastGeneration = rows.reduce((max, row) => Math.max(max, row.generation), 0);
      for (const row of rows) this.deleteGeneration(workspaceRef, row.generation);
      this.state.storage.sql.exec(
        'DELETE FROM backup_catalog WHERE workspace_ref = ?',
        workspaceRef,
      );
      this.state.storage.sql.exec(
        'INSERT INTO backup_tombstones (workspace_ref, last_generation, revision) VALUES (?, ?, 1) ON CONFLICT(workspace_ref) DO UPDATE SET last_generation = MAX(last_generation, excluded.last_generation), revision = backup_tombstones.revision + 1',
        workspaceRef,
        lastGeneration,
      );
    });
    return json({ ok: true, deleted: true, scope: 'backup' });
  }

  private deleteAccount(): Response {
    this.state.storage.transactionSync(() => {
      const rows = this.state.storage.sql
        .exec<{
          workspace_ref: string;
          last_generation: number;
        }>('SELECT workspace_ref, MAX(generation) AS last_generation FROM backup_generations GROUP BY workspace_ref')
        .toArray();
      this.state.storage.sql.exec('DELETE FROM backup_chunks');
      this.state.storage.sql.exec('DELETE FROM backup_generations');
      this.state.storage.sql.exec('DELETE FROM backup_catalog');
      for (const row of rows) {
        this.state.storage.sql.exec(
          'INSERT INTO backup_tombstones (workspace_ref, last_generation, revision) VALUES (?, ?, 1) ON CONFLICT(workspace_ref) DO UPDATE SET last_generation = MAX(last_generation, excluded.last_generation), revision = backup_tombstones.revision + 1',
          row.workspace_ref,
          row.last_generation,
        );
      }
      this.state.storage.sql.exec(
        'UPDATE backup_account_guard SET deleted = 1, revision = revision + 1 WHERE id = 1',
      );
      this.state.storage.sql.exec(
        'UPDATE sync_workspace_inventory SET deleted = 1, revision = revision + 1',
      );
    });
    return json({ ok: true, deleted: true, scope: 'account-backup-authority' });
  }
}

function normalizeWorkspaceRef(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  return WORKSPACE_REF_PATTERN.test(normalized) ? normalized : null;
}

function isIso(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Read encrypted upload bytes with a hard stream cap, before allocating an aggregate buffer. */
async function readBoundedBody(request: Request, limit: number): Promise<Uint8Array | null> {
  if (request.body === null) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}
