const REF = /^[a-f0-9]{64}$/u;
const ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const MAX_RECEIPT = 512 * 1024;

type Row = Readonly<{ workspace_ref: string; id: string; revision: number; record: string }>;
type Receipt = Readonly<{
  connection_id: string;
  revision: number;
  delivery_id: string;
  payload: string;
}>;

/**
 * Account-scoped authoritative connection/catalog state. Provider I/O never runs in this object;
 * callers claim a short lease, perform I/O, then commit under the lease and observed revision.
 */
export class BankingWorkspaceDurableObject implements DurableObject {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
    state.blockConcurrencyWhile(async () => {
      state.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS bank_guard (
          id INTEGER PRIMARY KEY CHECK (id = 1), deleted INTEGER NOT NULL, revision INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS bank_connections (
          workspace_ref TEXT NOT NULL, id TEXT PRIMARY KEY, revision INTEGER NOT NULL,
          record TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS bank_connections_workspace ON bank_connections(workspace_ref);
        CREATE TABLE IF NOT EXISTS bank_receipts (
          connection_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, delivery_id TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS bank_leases (
          connection_id TEXT PRIMARY KEY, token TEXT NOT NULL, expires_at INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO bank_guard (id, deleted, revision) VALUES (1, 0, 0);
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/internal/connections') {
        return this.list(url.searchParams.get('workspaceRef'));
      }
      if (request.method === 'GET' && url.pathname.startsWith('/internal/connection/')) {
        return this.get(
          url.searchParams.get('workspaceRef'),
          url.pathname.slice('/internal/connection/'.length),
        );
      }
      if (request.method === 'POST' && url.pathname === '/internal/connection') {
        return this.create(await body(request));
      }
      if (request.method === 'POST' && url.pathname === '/internal/connection/claim') {
        return this.claim(await body(request));
      }
      if (request.method === 'POST' && url.pathname === '/internal/connection/commit') {
        return this.commit(await body(request));
      }
      if (request.method === 'POST' && url.pathname === '/internal/connection/release') {
        return this.release(await body(request));
      }
      if (request.method === 'POST' && url.pathname === '/internal/connection/ack') {
        return this.ack(await body(request));
      }
      if (request.method === 'POST' && url.pathname === '/internal/connection/callback') {
        return this.callback(await body(request));
      }
      if (request.method === 'DELETE' && url.pathname === '/internal/connection') {
        return this.disconnect(await body(request));
      }
      if (request.method === 'DELETE' && url.pathname === '/internal/account') {
        return this.deleteAccount();
      }
      return json({ error: 'not_found' }, 404);
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : '';
      if (message === 'invalid_request') return json({ error: message }, 400);
      if (message === 'receipt_too_large') return json({ error: message }, 413);
      return json({ error: 'authority_unavailable' }, 500);
    }
  }

  private list(workspaceRef: string | null): Response {
    if (!validRef(workspaceRef)) return json({ error: 'invalid_workspace' }, 400);
    const guard = this.guard();
    if (guard.deleted)
      return json({ connections: [], deleted: true, revision: guard.revision }, 410);
    const rows = this.state.storage.sql
      .exec<Row>(
        'SELECT workspace_ref,id,revision,record FROM bank_connections WHERE workspace_ref = ? AND deleted = 0',
        workspaceRef,
      )
      .toArray();
    return json(
      { connections: rows.map((row) => ({ record: parse(row.record), revision: row.revision })) },
      200,
    );
  }

  private get(workspaceRef: string | null, id: string): Response {
    if (!validRef(workspaceRef) || !ID.test(id)) return json({ error: 'invalid_request' }, 400);
    const guard = this.guard();
    if (guard.deleted) return json({ error: 'account_deleted', revision: guard.revision }, 410);
    const row = this.state.storage.sql
      .exec<Row>(
        'SELECT workspace_ref,id,revision,record FROM bank_connections WHERE workspace_ref = ? AND id = ? AND deleted = 0',
        workspaceRef,
        id,
      )
      .toArray()[0];
    return row === undefined
      ? json({ error: 'not_found' }, 404)
      : json({ record: parse(row.record), revision: row.revision }, 200);
  }

  private create(input: unknown): Response {
    const value = object(input);
    const workspaceRef = string(value.workspaceRef);
    const id = string(value.id);
    const recordJson = value.record;
    if (
      !validRef(workspaceRef) ||
      id === null ||
      !ID.test(id) ||
      !ownsRecord(recordJson, workspaceRef, id)
    )
      throw new Error('invalid_request');
    const serialized = JSON.stringify(recordJson);
    const result = this.state.storage.transactionSync(() => {
      const guard = this.guard();
      if (guard.deleted) return json({ error: 'account_deleted', revision: guard.revision }, 410);
      const old = this.state.storage.sql
        .exec<Row>('SELECT id,revision,record,workspace_ref FROM bank_connections WHERE id = ?', id)
        .toArray()[0];
      if (old !== undefined) return json({ error: 'already_exists', revision: old.revision }, 409);
      this.state.storage.sql.exec(
        'INSERT INTO bank_connections(workspace_ref,id,revision,record,deleted) VALUES(?,?,?,?,0)',
        workspaceRef,
        id,
        1,
        serialized,
      );
      return json({ revision: 1, record: recordJson }, 201);
    });
    return result;
  }

  private claim(input: unknown): Response {
    const value = object(input);
    const workspaceRef = string(value.workspaceRef);
    const id = string(value.id);
    if (!validRef(workspaceRef) || id === null || !ID.test(id)) throw new Error('invalid_request');
    const now = Date.now();
    const result = this.state.storage.transactionSync(() => {
      const guard = this.guard();
      if (guard.deleted) return json({ error: 'account_deleted', revision: guard.revision }, 410);
      const row = this.state.storage.sql
        .exec<Row>(
          'SELECT workspace_ref,id,revision,record FROM bank_connections WHERE workspace_ref = ? AND id = ? AND deleted = 0',
          workspaceRef,
          id,
        )
        .toArray()[0];
      if (row === undefined) return json({ error: 'not_found' }, 404);
      if (
        record(parse(row.record)) &&
        (parse(row.record) as Record<string, unknown>).status === 'disconnected'
      )
        return json({ error: 'disconnected' }, 409);
      const existing = this.state.storage.sql
        .exec<Receipt>(
          'SELECT connection_id,revision,delivery_id,payload FROM bank_receipts WHERE connection_id = ?',
          id,
        )
        .toArray()[0];
      if (existing !== undefined) {
        return json(
          {
            revision: row.revision,
            record: parse(row.record),
            receipt: {
              revision: existing.revision,
              deliveryId: existing.delivery_id,
              payload: existing.payload,
            },
          },
          200,
        );
      }
      const lease = this.state.storage.sql
        .exec<{
          token: string;
          expires_at: number;
        }>('SELECT token,expires_at FROM bank_leases WHERE connection_id = ?', id)
        .toArray()[0];
      if (lease !== undefined && lease.expires_at > now)
        return json({ error: 'sync_in_progress' }, 409);
      const token = crypto.randomUUID();
      this.state.storage.sql.exec(
        'INSERT OR REPLACE INTO bank_leases(connection_id,token,expires_at) VALUES(?,?,?)',
        id,
        token,
        now + 30_000,
      );
      return json({ revision: row.revision, record: parse(row.record), leaseToken: token }, 200);
    });
    return result;
  }

  private commit(input: unknown): Response {
    const value = object(input);
    const workspaceRef = string(value.workspaceRef);
    const id = string(value.id);
    const leaseToken = string(value.leaseToken);
    const deliveryId = string(value.deliveryId);
    const expectedRevision = value.expectedRevision;
    const recordJson = value.record;
    const sealedPayload = value.sealedPayload;
    if (
      !validRef(workspaceRef) ||
      id === null ||
      leaseToken === null ||
      deliveryId === null ||
      !ownsRecord(recordJson, workspaceRef, id) ||
      typeof sealedPayload !== 'string' ||
      !Number.isSafeInteger(expectedRevision)
    )
      throw new Error('invalid_request');
    if (sealedPayload.length > MAX_RECEIPT) throw new Error('receipt_too_large');
    return this.state.storage.transactionSync(() => {
      const guard = this.guard();
      if (guard.deleted) return json({ error: 'account_deleted', revision: guard.revision }, 410);
      const row = this.state.storage.sql
        .exec<Row>(
          'SELECT workspace_ref,id,revision,record FROM bank_connections WHERE workspace_ref = ? AND id = ? AND deleted = 0',
          workspaceRef,
          id,
        )
        .toArray()[0];
      if (row === undefined) return json({ error: 'not_found' }, 404);
      if (
        record(parse(row.record)) &&
        (parse(row.record) as Record<string, unknown>).status === 'disconnected'
      )
        return json({ error: 'disconnected' }, 409);
      const existing = this.state.storage.sql
        .exec<Receipt>(
          'SELECT connection_id,revision,delivery_id,payload FROM bank_receipts WHERE connection_id = ?',
          id,
        )
        .toArray()[0];
      if (existing !== undefined)
        return json(
          {
            revision: row.revision,
            record: parse(row.record),
            receipt: {
              revision: existing.revision,
              deliveryId: existing.delivery_id,
              payload: existing.payload,
            },
          },
          200,
        );
      const lease = this.state.storage.sql
        .exec<{
          token: string;
          expires_at: number;
        }>('SELECT token,expires_at FROM bank_leases WHERE connection_id = ?', id)
        .toArray()[0];
      if (lease?.token !== leaseToken || lease.expires_at <= Date.now())
        return json({ error: 'lease_expired' }, 409);
      if (row.revision !== expectedRevision)
        return json({ error: 'revision_conflict', revision: row.revision }, 409);
      const nextRevision = row.revision + 1;
      this.state.storage.sql.exec(
        'UPDATE bank_connections SET revision = ?, record = ? WHERE id = ?',
        nextRevision,
        JSON.stringify(recordJson),
        id,
      );
      if (sealedPayload !== '')
        this.state.storage.sql.exec(
          'INSERT INTO bank_receipts(connection_id,revision,delivery_id,payload) VALUES(?,?,?,?)',
          id,
          nextRevision,
          deliveryId,
          sealedPayload,
        );
      this.state.storage.sql.exec('DELETE FROM bank_leases WHERE connection_id = ?', id);
      return json(
        {
          revision: nextRevision,
          record: recordJson,
          ...(sealedPayload === ''
            ? {}
            : { receipt: { revision: nextRevision, deliveryId, payload: sealedPayload } }),
        },
        200,
      );
    });
  }

  private ack(input: unknown): Response {
    const value = object(input);
    const workspaceRef = string(value.workspaceRef);
    const id = string(value.id);
    const deliveryId = string(value.deliveryId);
    const revision = value.revision;
    if (
      !validRef(workspaceRef) ||
      id === null ||
      deliveryId === null ||
      !Number.isSafeInteger(revision)
    )
      throw new Error('invalid_request');
    return this.state.storage.transactionSync(() => {
      const guard = this.guard();
      if (guard.deleted) return json({ error: 'account_deleted' }, 410);
      const row = this.state.storage.sql
        .exec<Row>(
          'SELECT workspace_ref,id,revision,record FROM bank_connections WHERE workspace_ref = ? AND id = ? AND deleted = 0',
          workspaceRef,
          id,
        )
        .toArray()[0];
      const receipt = this.state.storage.sql
        .exec<Receipt>(
          'SELECT connection_id,revision,delivery_id,payload FROM bank_receipts WHERE connection_id = ?',
          id,
        )
        .toArray()[0];
      if (row === undefined || receipt === undefined)
        return json({ ok: true, alreadySettled: true }, 200);
      if (
        receipt.revision !== revision ||
        receipt.delivery_id !== deliveryId ||
        row.revision !== revision
      )
        return json({ error: 'receipt_mismatch' }, 409);
      this.state.storage.sql.exec('DELETE FROM bank_receipts WHERE connection_id = ?', id);
      return json({ ok: true }, 200);
    });
  }

  private release(input: unknown): Response {
    const value = object(input);
    const workspaceRef = string(value.workspaceRef);
    const id = string(value.id);
    const leaseToken = string(value.leaseToken);
    const recordJson = value.record;
    const expectedRevision = value.expectedRevision;
    if (
      !validRef(workspaceRef) ||
      id === null ||
      leaseToken === null ||
      !ownsRecord(recordJson, workspaceRef, id) ||
      !Number.isSafeInteger(expectedRevision)
    )
      throw new Error('invalid_request');
    return this.state.storage.transactionSync(() => {
      const guard = this.guard();
      if (guard.deleted) return json({ error: 'account_deleted' }, 410);
      const row = this.state.storage.sql
        .exec<Row>(
          'SELECT workspace_ref,id,revision,record FROM bank_connections WHERE workspace_ref = ? AND id = ? AND deleted = 0',
          workspaceRef,
          id,
        )
        .toArray()[0];
      const lease = this.state.storage.sql
        .exec<{
          token: string;
          expires_at: number;
        }>('SELECT token,expires_at FROM bank_leases WHERE connection_id = ?', id)
        .toArray()[0];
      if (
        row === undefined ||
        lease?.token !== leaseToken ||
        lease.expires_at <= Date.now() ||
        row.revision !== expectedRevision
      )
        return json({ error: 'lease_expired' }, 409);
      const revision = row.revision + 1;
      this.state.storage.sql.exec(
        'UPDATE bank_connections SET revision = ?, record = ? WHERE id = ?',
        revision,
        JSON.stringify(recordJson),
        id,
      );
      this.state.storage.sql.exec('DELETE FROM bank_leases WHERE connection_id = ?', id);
      return json({ revision, record: recordJson }, 200);
    });
  }

  private callback(input: unknown): Response {
    const value = object(input);
    const workspaceRef = string(value.workspaceRef);
    const id = string(value.id);
    const recordJson = value.record;
    const expectedRevision = value.expectedRevision;
    if (
      !validRef(workspaceRef) ||
      id === null ||
      !ownsRecord(recordJson, workspaceRef, id) ||
      !Number.isSafeInteger(expectedRevision)
    )
      throw new Error('invalid_request');
    return this.state.storage.transactionSync(() => {
      const guard = this.guard();
      if (guard.deleted) return json({ error: 'account_deleted' }, 410);
      const row = this.state.storage.sql
        .exec<Row>(
          'SELECT workspace_ref,id,revision,record FROM bank_connections WHERE workspace_ref = ? AND id = ? AND deleted = 0',
          workspaceRef,
          id,
        )
        .toArray()[0];
      if (row === undefined) return json({ error: 'not_found' }, 404);
      const current = parse(row.record);
      if (record(current) && current.status === 'disconnected')
        return json({ error: 'disconnected' }, 409);
      if (
        row.revision !== expectedRevision ||
        !record(current) ||
        current.status !== 'pending_redirect'
      )
        return json({ error: 'revision_conflict', revision: row.revision }, 409);
      const nextRevision = row.revision + 1;
      this.state.storage.sql.exec(
        'UPDATE bank_connections SET revision = ?, record = ? WHERE id = ?',
        nextRevision,
        JSON.stringify(recordJson),
        id,
      );
      return json({ revision: nextRevision, record: recordJson }, 200);
    });
  }

  private disconnect(input: unknown): Response {
    const value = object(input);
    const workspaceRef = string(value.workspaceRef);
    const id = string(value.id);
    const recordJson = value.record;
    const expectedRevision = value.expectedRevision;
    if (
      !validRef(workspaceRef) ||
      id === null ||
      !ownsRecord(recordJson, workspaceRef, id) ||
      !Number.isSafeInteger(expectedRevision)
    )
      throw new Error('invalid_request');
    return this.state.storage.transactionSync(() => {
      const guard = this.guard();
      if (guard.deleted) return json({ error: 'account_deleted' }, 410);
      const row = this.state.storage.sql
        .exec<Row>(
          'SELECT revision FROM bank_connections WHERE workspace_ref = ? AND id = ? AND deleted = 0',
          workspaceRef,
          id,
        )
        .toArray()[0];
      if (row === undefined) return json({ error: 'not_found' }, 404);
      if (row.revision !== expectedRevision)
        return json({ error: 'revision_conflict', revision: row.revision }, 409);
      const revision = row.revision + 1;
      this.state.storage.sql.exec(
        'UPDATE bank_connections SET revision = ?, record = ? WHERE id = ?',
        revision,
        JSON.stringify(recordJson),
        id,
      );
      this.state.storage.sql.exec('DELETE FROM bank_receipts WHERE connection_id = ?', id);
      this.state.storage.sql.exec('DELETE FROM bank_leases WHERE connection_id = ?', id);
      return json({ revision, record: recordJson }, 200);
    });
  }

  private deleteAccount(): Response {
    return this.state.storage.transactionSync(() => {
      const guard = this.guard();
      const revision = guard.revision + 1;
      const deletedConnections = this.state.storage.sql
        .exec<{ id: string }>('SELECT id FROM bank_connections WHERE deleted = 0')
        .toArray().length;
      this.state.storage.sql.exec(
        'UPDATE bank_guard SET deleted = 1, revision = ? WHERE id = 1',
        revision,
      );
      this.state.storage.sql.exec('DELETE FROM bank_receipts');
      this.state.storage.sql.exec('DELETE FROM bank_leases');
      this.state.storage.sql.exec('DELETE FROM bank_connections');
      return json({ deletedConnections, revision }, 200);
    });
  }

  private guard(): { deleted: boolean; revision: number } {
    const row = this.state.storage.sql
      .exec<{
        deleted: number;
        revision: number;
      }>('SELECT deleted,revision FROM bank_guard WHERE id = 1')
      .toArray()[0];
    return { deleted: row?.deleted === 1, revision: row?.revision ?? 0 };
  }
}

function validRef(value: string | null): value is string {
  return value !== null && REF.test(value);
}
function string(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function object(value: unknown): Record<string, unknown> {
  if (!record(value)) throw new Error('invalid_request');
  return value;
}
function ownsRecord(
  value: unknown,
  workspaceRef: string,
  id: string,
): value is Record<string, unknown> {
  return record(value) && value.workspaceRef === workspaceRef && value.id === id;
}
function parse(value: string): unknown {
  return JSON.parse(value) as unknown;
}
async function body(request: Request): Promise<unknown> {
  if (request.body === null) throw new Error('invalid_request');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      // Allow bounded record/lease metadata in addition to the sealed receipt.
      if (total > MAX_RECEIPT + 64 * 1024) {
        await reader.cancel();
        throw new Error('receipt_too_large');
      }
      chunks.push(part.value);
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
  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes),
    ) as unknown;
  } catch {
    throw new Error('invalid_request');
  }
}
function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
