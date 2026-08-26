import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { ANDROID_DATABASE_PATH, IOS_LIBRARY_PATH, open } from '@op-engineering/op-sqlite';
import {
  createAuditLogEntry,
  createAuditLogProof,
  migrateCanonicalSnapshotToSqliteRepository,
  openSqliteCanonicalRepository,
  runAtomicCommand,
  stableStringify,
  type CanonicalRepositorySnapshot,
  type DatabaseDriver,
  type JsonValue,
  type StoredAuditLogRow,
  verifyStoredAuditLogProof,
} from '@folio/storage';
import { Platform } from 'react-native';

import {
  clearQuarantinedPrivateDatabaseFamily,
  quarantinePrivateDatabaseFamily,
} from '../../modules/folio-local-vault';
import type { PersistedWorkspace } from '../folio/lib/workspaceRoot.js';
import type { PendingAppStateCommand } from '../folio/lib/typedCommandBridge.js';
import { PERSONAL_WORKSPACE_ID } from '../folio/lib/workspaceRoot.js';
import {
  parseWorkspaceManifest,
  workspaceLedgerDatabaseName,
  type WorkspaceManifest,
} from '../folio/lib/workspacePartition.js';

import {
  getLastLocalDatabaseKeyState,
  resolveLocalLedgerWorkspaceEncryptionKey,
} from './nativeLocalSecurity.js';
import { OpSqliteDatabaseDriver } from './nativeSqliteDriver.js';

const TABLE_NAME = 'folio_workspace_vault_generations';
const CANONICAL_BINDING_TABLE_NAME = 'folio_workspace_vault_canonical_bindings';
const STATE_RECORD_KIND = 'workspace-state';
const MANIFEST_RECORD_KIND = 'workspace-manifest';
const MANIFEST_RECORD_ID = 'workspace-root';
const RETAINED_GENERATIONS = 3;

type NativeVaultRecordKind = typeof STATE_RECORD_KIND | typeof MANIFEST_RECORD_KIND;

export type NativeWorkspaceVaultGeneration = Readonly<{
  generation: number;
  workspaceId: string;
  schemaVersion: number;
  payload: string;
  payloadSha256: string;
  committedAt: string;
}>;

export type NativeWorkspaceVaultLoad =
  | Readonly<{ status: 'unavailable' | 'absent'; generations: readonly [] }>
  | Readonly<{
      status: 'unreadable';
      generations: readonly [];
      invalidGenerationCount: number;
    }>
  | Readonly<{
      status: 'ok' | 'recovered';
      generations: readonly NativeWorkspaceVaultGeneration[];
      invalidGenerationCount: number;
    }>;

type NativeVaultRow = Readonly<{
  generation?: unknown;
  workspace_id?: unknown;
  schema_version?: unknown;
  payload?: unknown;
  payload_sha256?: unknown;
  committed_at?: unknown;
}>;

type MaxGenerationRow = Readonly<{ max_generation?: unknown }>;
type CanonicalBindingRow = Readonly<{ canonical_snapshot_sha256?: unknown }>;

export type NativeCanonicalSnapshotLoad =
  | Readonly<{
      status: 'ok';
      generation: number;
      canonicalSnapshotSha256: string;
      snapshot: CanonicalRepositorySnapshot;
    }>
  | Readonly<{ status: 'unavailable' | 'unbound' | 'mismatch' | 'unreadable' }>;

/**
 * Load the lossless Folio workspace partition stored inside the workspace's SQLCipher database.
 * The returned generations are newest-first and have already passed their stored SHA-256 check.
 * App-shape/workspace validation remains the caller's job because hydrateFromBlob is the canonical
 * schema migration boundary.
 */
export function loadNativeWorkspaceStateGenerations(
  workspace: PersistedWorkspace,
): Promise<NativeWorkspaceVaultLoad> {
  return loadRecord(workspace, STATE_RECORD_KIND, String(workspace.id));
}

/**
 * Load canonical rows only when they are cryptographically bound to the selected exact AppState
 * generation. Canonical tables represent the newest successful projection, while the exact vault
 * intentionally retains rollback generations; the binding prevents a recovered older payload from
 * ever being combined with newer normalized rows.
 */
export async function loadNativeCanonicalSnapshotForGeneration(
  workspace: PersistedWorkspace,
  generation: NativeWorkspaceVaultGeneration,
): Promise<NativeCanonicalSnapshotLoad> {
  requireLedgerWorkspaceIdentity(workspace);
  if (generation.workspaceId !== String(workspace.id)) return { status: 'mismatch' };
  if (Platform.OS === 'web') return { status: 'unavailable' };

  let encryptionKey: string;
  try {
    encryptionKey = await resolveLocalLedgerWorkspaceEncryptionKey(workspace);
  } catch {
    return { status: 'unreadable' };
  }
  if (getLastLocalDatabaseKeyState() === 'secure_store_unavailable_fallback') {
    return { status: 'unavailable' };
  }

  const db = open({ name: workspaceLedgerDatabaseName(workspace.id), encryptionKey });
  try {
    await ensureVaultTables(db);
    const driver = new OpSqliteDatabaseDriver(db);
    return await driver.transaction(async (transaction) => {
      const exact = await transaction.execute<NativeVaultRow>(
        `
          SELECT generation, workspace_id, schema_version, payload, payload_sha256, committed_at
          FROM ${TABLE_NAME}
          WHERE record_kind = ? AND record_id = ? AND generation = ?
        `,
        [STATE_RECORD_KIND, String(workspace.id), generation.generation],
      );
      const verified = await parseVerifiedRow(exact.rows[0], workspace);
      if (verified === null || !sameGeneration(verified, generation)) {
        return { status: 'mismatch' };
      }

      const binding = await transaction.execute<CanonicalBindingRow>(
        `
          SELECT canonical_snapshot_sha256
          FROM ${CANONICAL_BINDING_TABLE_NAME}
          WHERE record_kind = ? AND record_id = ? AND generation = ?
        `,
        [STATE_RECORD_KIND, String(workspace.id), generation.generation],
      );
      const expectedSha256 = binding.rows[0]?.canonical_snapshot_sha256;
      if (expectedSha256 === undefined) return { status: 'unbound' };
      if (typeof expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(expectedSha256)) {
        return { status: 'mismatch' };
      }

      const repository = await openSqliteCanonicalRepository(transaction, workspace.id);
      const snapshot = await repository.snapshot();
      requireCanonicalSnapshotWorkspace(snapshot, workspace);
      const actualSha256 = await sha256(canonicalSnapshotFingerprint(snapshot));
      if (actualSha256 !== expectedSha256) return { status: 'mismatch' };
      return {
        status: 'ok',
        generation: generation.generation,
        canonicalSnapshotSha256: actualSha256,
        snapshot,
      };
    });
  } catch {
    return { status: 'unreadable' };
  } finally {
    db.close();
  }
}

/** Write and read-verify one exact Folio workspace partition in an atomic SQL transaction. */
export async function saveNativeWorkspaceStateGeneration(
  workspace: PersistedWorkspace,
  payload: string,
  canonicalSnapshot: CanonicalRepositorySnapshot,
  pendingCommands: readonly PendingAppStateCommand[] = [],
): Promise<NativeWorkspaceVaultGeneration> {
  const schemaVersion = stateSchemaVersion(payload, workspace);
  requireCanonicalSnapshotWorkspace(canonicalSnapshot, workspace);
  requirePendingCommandWorkspaces(pendingCommands, workspace);
  return saveRecord(
    requireUsableWorkspace(workspace),
    STATE_RECORD_KIND,
    String(workspace.id),
    schemaVersion,
    payload,
    canonicalSnapshot,
    pendingCommands,
  );
}

/** The workspace registry is rooted in Personal's SQLCipher database so boot can locate Business. */
export function loadNativeWorkspaceManifestGenerations(
  personalWorkspace: PersistedWorkspace,
): Promise<NativeWorkspaceVaultLoad> {
  requirePersonalWorkspace(personalWorkspace);
  return loadRecord(personalWorkspace, MANIFEST_RECORD_KIND, MANIFEST_RECORD_ID);
}

/** Write and read-verify the active workspace registry after its selected partition is durable. */
export async function saveNativeWorkspaceManifestGeneration(
  personalWorkspace: PersistedWorkspace,
  manifest: WorkspaceManifest,
): Promise<NativeWorkspaceVaultGeneration> {
  requirePersonalWorkspace(personalWorkspace);
  const payload = JSON.stringify(manifest);
  const parsed = parseWorkspaceManifest(payload);
  if (
    parsed === null ||
    String(parsed.workspaces[0]?.id) !== String(personalWorkspace.id) ||
    parsed.workspaces[0]?.encryptedSubkeyId !== personalWorkspace.encryptedSubkeyId
  ) {
    throw new Error('Workspace manifest is not bound to the Personal vault root.');
  }
  return saveRecord(
    personalWorkspace,
    MANIFEST_RECORD_KIND,
    MANIFEST_RECORD_ID,
    manifest.version,
    payload,
  );
}

export type NativeWorkspaceVaultQuarantine = Readonly<{
  moved: readonly string[];
  parkedMainUri: string;
}>;

/**
 * Park an unreadable SQLCipher database family byte-for-byte before rebuilding from a verified
 * authenticated rollback copy. The fixed per-workspace destination keeps deletion deterministic;
 * it is never opened as live authority.
 */
export async function quarantineNativeWorkspaceVault(
  workspace: PersistedWorkspace,
): Promise<NativeWorkspaceVaultQuarantine> {
  requireUsableWorkspace(workspace);
  if (Platform.OS === 'web') {
    throw new Error('The SQLCipher workspace vault is unavailable on web.');
  }
  await resolveLocalLedgerWorkspaceEncryptionKey(workspace);
  if (getLastLocalDatabaseKeyState() === 'secure_store_unavailable_fallback') {
    throw new Error('Device key storage is unavailable. The SQLCipher vault was not moved.');
  }
  const databaseName = workspaceLedgerDatabaseName(workspace.id);
  if (Platform.OS === 'android') {
    return quarantinePrivateDatabaseFamily(databaseName);
  }
  // Do not open an already-unreadable database just to discover its path. A corrupt SQLCipher
  // handle can fail again while opening or closing and prevent the bytes from ever being parked.
  // OP-SQLite exports the same platform-owned directory used by `open({ name })`; the validated,
  // opaque workspace filename cannot escape it.
  const databasePath = defaultDatabasePath(databaseName);
  const liveMainUri = fileUri(databasePath);
  const parkedMainUri = `${liveMainUri}.unreadable`;
  const families = [
    { live: liveMainUri, parked: parkedMainUri },
    { live: `${liveMainUri}-wal`, parked: `${parkedMainUri}-wal` },
    { live: `${liveMainUri}-shm`, parked: `${parkedMainUri}-shm` },
  ] as const;
  const moved: string[] = [];
  for (const member of families) {
    await FileSystem.deleteAsync(member.parked, { idempotent: true });
    if (!(await FileSystem.getInfoAsync(member.live)).exists) continue;
    await FileSystem.moveAsync({ from: member.live, to: member.parked });
    moved.push(member.parked);
  }
  return { moved, parkedMainUri };
}

/** Remove every parked SQLCipher family member during the user's account-wide local clear. */
export async function clearQuarantinedNativeWorkspaceVaults(
  workspace: PersistedWorkspace,
): Promise<void> {
  requireLedgerWorkspaceIdentity(workspace);
  const databaseName = workspaceLedgerDatabaseName(workspace.id);
  if (Platform.OS === 'android') {
    await clearQuarantinedPrivateDatabaseFamily(databaseName);
    return;
  }
  const parkedMainUri = `${fileUri(defaultDatabasePath(databaseName))}.unreadable`;
  await Promise.all(
    [parkedMainUri, `${parkedMainUri}-wal`, `${parkedMainUri}-shm`].map((uri) =>
      FileSystem.deleteAsync(uri, { idempotent: true }),
    ),
  );
}

async function loadRecord(
  workspace: PersistedWorkspace,
  recordKind: NativeVaultRecordKind,
  recordId: string,
): Promise<NativeWorkspaceVaultLoad> {
  requireLedgerWorkspaceIdentity(workspace);
  if (Platform.OS === 'web') return { status: 'unavailable', generations: [] };

  let encryptionKey: string;
  try {
    encryptionKey = await resolveLocalLedgerWorkspaceEncryptionKey(workspace);
  } catch {
    return { status: 'unreadable', generations: [], invalidGenerationCount: 1 };
  }
  if (getLastLocalDatabaseKeyState() === 'secure_store_unavailable_fallback') {
    return { status: 'unavailable', generations: [] };
  }

  let db: ReturnType<typeof open> | null = null;
  try {
    db = open({ name: workspaceLedgerDatabaseName(workspace.id), encryptionKey });
    await ensureVaultTables(db);
    const result = await db.execute(
      `
        SELECT generation, workspace_id, schema_version, payload, payload_sha256, committed_at
        FROM ${TABLE_NAME}
        WHERE record_kind = ? AND record_id = ?
        ORDER BY generation DESC
        LIMIT ?
      `,
      [recordKind, recordId, RETAINED_GENERATIONS],
    );
    const rows = Array.isArray(result.rows) ? result.rows : [];
    if (rows.length === 0) return { status: 'absent', generations: [] };

    const generations: NativeWorkspaceVaultGeneration[] = [];
    let invalidGenerationCount = 0;
    let firstValidRowIndex = -1;
    for (const [index, raw] of rows.entries()) {
      const row = await parseVerifiedRow(raw, workspace);
      if (row === null) {
        invalidGenerationCount += 1;
        continue;
      }
      if (firstValidRowIndex < 0) firstValidRowIndex = index;
      generations.push(row);
    }
    if (generations.length === 0) {
      return { status: 'unreadable', generations: [], invalidGenerationCount };
    }
    return {
      status: firstValidRowIndex === 0 ? 'ok' : 'recovered',
      generations,
      invalidGenerationCount,
    };
  } catch {
    return { status: 'unreadable', generations: [], invalidGenerationCount: 1 };
  } finally {
    db?.close();
  }
}

async function saveRecord(
  workspace: PersistedWorkspace,
  recordKind: NativeVaultRecordKind,
  recordId: string,
  schemaVersion: number,
  payload: string,
  canonicalSnapshot?: CanonicalRepositorySnapshot,
  pendingCommands: readonly PendingAppStateCommand[] = [],
): Promise<NativeWorkspaceVaultGeneration> {
  requireUsableWorkspace(workspace);
  if (Platform.OS === 'web') {
    throw new Error('The SQLCipher workspace vault is unavailable on web.');
  }
  const encryptionKey = await resolveLocalLedgerWorkspaceEncryptionKey(workspace);
  if (getLastLocalDatabaseKeyState() === 'secure_store_unavailable_fallback') {
    throw new Error('Device key storage is unavailable. Local records are memory-only.');
  }

  const payloadSha256 = await sha256(payload);
  const committedAt = new Date().toISOString();
  const db = open({ name: workspaceLedgerDatabaseName(workspace.id), encryptionKey });
  let writeStage = 'vault-schema';
  try {
    await ensureVaultTables(db);
    const driver = new OpSqliteDatabaseDriver(db);
    return await driver.transaction(async (transaction) => {
      writeStage = 'generation-read';
      const maximum = await transaction.execute<MaxGenerationRow>(
        `
          SELECT MAX(generation) AS max_generation
          FROM ${TABLE_NAME}
          WHERE record_kind = ? AND record_id = ?
        `,
        [recordKind, recordId],
      );
      const generation = safeGeneration(maximum.rows[0]?.max_generation) + 1;
      writeStage = 'generation-insert';
      await transaction.execute(
        `
          INSERT INTO ${TABLE_NAME} (
            record_kind, record_id, generation, workspace_id, schema_version,
            payload, payload_sha256, committed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          recordKind,
          recordId,
          generation,
          String(workspace.id),
          schemaVersion,
          payload,
          payloadSha256,
          committedAt,
        ],
      );
      writeStage = 'generation-readback';
      const readback = await transaction.execute<NativeVaultRow>(
        `
          SELECT generation, workspace_id, schema_version, payload, payload_sha256, committed_at
          FROM ${TABLE_NAME}
          WHERE record_kind = ? AND record_id = ? AND generation = ?
        `,
        [recordKind, recordId, generation],
      );
      const verified = await parseVerifiedRow(readback.rows[0], workspace);
      if (
        verified === null ||
        verified.payload !== payload ||
        verified.payloadSha256 !== payloadSha256 ||
        verified.schemaVersion !== schemaVersion
      ) {
        throw new Error('SQLCipher workspace generation failed exact readback verification.');
      }
      if (canonicalSnapshot !== undefined) {
        writeStage = 'canonical-migration';
        const canonicalRepository = await migrateCanonicalSnapshotToSqliteRepository(
          transaction,
          canonicalSnapshot,
        );
        writeStage = 'canonical-readback';
        const canonicalReadback = await canonicalRepository.snapshot();
        if (
          canonicalSnapshotFingerprint(canonicalReadback) !==
          canonicalSnapshotFingerprint(canonicalSnapshot)
        ) {
          throw new Error('SQLCipher canonical projection failed exact readback verification.');
        }
        writeStage = 'canonical-binding';
        await transaction.execute(
          `
            INSERT INTO ${CANONICAL_BINDING_TABLE_NAME} (
              record_kind, record_id, generation, canonical_snapshot_sha256
            ) VALUES (?, ?, ?, ?)
          `,
          [
            recordKind,
            recordId,
            generation,
            await sha256(canonicalSnapshotFingerprint(canonicalReadback)),
          ],
        );
      }
      writeStage = 'typed-command-audit';
      await commitPendingAppStateCommands(transaction, pendingCommands);
      const oldestRetainedGeneration = Math.max(1, generation - RETAINED_GENERATIONS + 1);
      writeStage = 'generation-prune';
      await transaction.execute(
        `
          DELETE FROM ${TABLE_NAME}
          WHERE record_kind = ? AND record_id = ? AND generation < ?
        `,
        [recordKind, recordId, oldestRetainedGeneration],
      );
      await transaction.execute(
        `
          DELETE FROM ${CANONICAL_BINDING_TABLE_NAME}
          WHERE record_kind = ? AND record_id = ? AND generation < ?
        `,
        [recordKind, recordId, oldestRetainedGeneration],
      );
      return verified;
    });
  } catch (reason: unknown) {
    // Stable stage only: never log the SQL, exception message, parameters, record id or payload.
    console.error(`[melo:workspace-vault] record=${recordKind} stage=${writeStage}`);
    throw reason;
  } finally {
    db.close();
  }
}

async function commitPendingAppStateCommands(
  driver: DatabaseDriver,
  pendingCommands: readonly PendingAppStateCommand[],
): Promise<void> {
  for (const receipt of pendingCommands) {
    const workspaceId = receipt.command.workspaceId;
    if (workspaceId === undefined) {
      throw new Error('Pending typed command is not workspace-scoped.');
    }
    const outcome = await runAtomicCommand(
      driver,
      receipt.command,
      async () => ({
        result: null,
        changedEntityIds: receipt.changedEntityIds,
        invalidatedProjectionKinds: receipt.invalidatedProjectionKinds,
        audit: receipt.audit,
      }),
      {
        idFactory: () => receipt.id,
        now: () => new Date(receipt.occurredAt),
      },
    );
    if (outcome.auditEntryId !== receipt.id) {
      throw new Error('SQLCipher typed command did not return its expected audit identity.');
    }

    const stored = await driver.execute<StoredAuditLogRow>(
      `
        SELECT id, workspace_id, command_type, actor_kind, actor_ref,
          entity_refs_json, delta_json, provenance_json, device_id, reversal_of_id, created_at
        FROM audit_log
        WHERE id = ? AND workspace_id = ? AND command_type = ?
      `,
      [receipt.id, String(workspaceId), receipt.command.type],
    );
    const row = stored.rows[0];
    const expectedEntry = createAuditLogEntry({
      id: receipt.id,
      workspaceId,
      commandType: receipt.command.type,
      actorKind: receipt.command.actor.kind,
      entityRefs: receipt.audit.entityRefs,
      delta: receipt.audit.delta,
      ...(receipt.command.actor.ref === undefined ? {} : { actorRef: receipt.command.actor.ref }),
      ...(receipt.audit.provenance === undefined ? {} : { provenance: receipt.audit.provenance }),
      ...(receipt.command.deviceId === undefined ? {} : { deviceId: receipt.command.deviceId }),
      createdAt: new Date(receipt.occurredAt),
    });
    if (row === undefined || !verifyStoredAuditLogProof(row, createAuditLogProof(expectedEntry))) {
      throw new Error('SQLCipher typed-command audit failed exact readback verification.');
    }
  }
}

function requireCanonicalSnapshotWorkspace(
  snapshot: CanonicalRepositorySnapshot,
  workspace: PersistedWorkspace,
): void {
  if (String(snapshot.workspaceId) !== String(workspace.id)) {
    throw new Error('Canonical projection does not belong to this SQLCipher partition.');
  }
  if (
    snapshot.collections.workspaces.length !== 1 ||
    String(snapshot.collections.workspaces[0]?.id) !== String(workspace.id)
  ) {
    throw new Error('Canonical projection does not contain exactly its workspace root.');
  }
}

function requirePendingCommandWorkspaces(
  pendingCommands: readonly PendingAppStateCommand[],
  workspace: PersistedWorkspace,
): void {
  const ids = new Set<string>();
  for (const receipt of pendingCommands) {
    if (String(receipt.command.workspaceId) !== String(workspace.id)) {
      throw new Error('Pending typed command does not belong to this SQLCipher partition.');
    }
    if (ids.has(receipt.id)) throw new Error(`Duplicate pending typed command ${receipt.id}.`);
    ids.add(receipt.id);
    if (receipt.command.input.commandId !== receipt.id) {
      throw new Error('Pending typed command input is not bound to its audit identity.');
    }
    if (!Number.isFinite(Date.parse(receipt.occurredAt))) {
      throw new Error('Pending typed command has an invalid occurrence timestamp.');
    }
  }
}

function canonicalSnapshotFingerprint(snapshot: CanonicalRepositorySnapshot): string {
  const collections = Object.fromEntries(
    Object.entries(snapshot.collections).map(([name, records]) => [
      name,
      [...records].sort((left, right) => String(left.id).localeCompare(String(right.id), 'en')),
    ]),
  );
  // Repository entities are JSON records by contract. Round-tripping removes optional `undefined`
  // properties before stable key ordering, matching SQLite's record_json representation exactly.
  const json = JSON.parse(
    JSON.stringify({
      schema: snapshot.schema,
      workspaceId: snapshot.workspaceId,
      collections,
    }),
  ) as JsonValue;
  return stableStringify(json);
}

function sameGeneration(
  left: NativeWorkspaceVaultGeneration,
  right: NativeWorkspaceVaultGeneration,
): boolean {
  return (
    left.generation === right.generation &&
    left.workspaceId === right.workspaceId &&
    left.schemaVersion === right.schemaVersion &&
    left.payload === right.payload &&
    left.payloadSha256 === right.payloadSha256 &&
    left.committedAt === right.committedAt
  );
}

async function ensureVaultTables(db: ReturnType<typeof open>): Promise<void> {
  await db.execute(
    `
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        record_kind TEXT NOT NULL,
        record_id TEXT NOT NULL,
        generation INTEGER NOT NULL,
        workspace_id TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        payload TEXT NOT NULL,
        payload_sha256 TEXT NOT NULL,
        committed_at TEXT NOT NULL,
        PRIMARY KEY (record_kind, record_id, generation)
      )
    `,
  );
  await db.execute(
    `
      CREATE TABLE IF NOT EXISTS ${CANONICAL_BINDING_TABLE_NAME} (
        record_kind TEXT NOT NULL,
        record_id TEXT NOT NULL,
        generation INTEGER NOT NULL,
        canonical_snapshot_sha256 TEXT NOT NULL,
        PRIMARY KEY (record_kind, record_id, generation)
      )
    `,
  );
}

async function parseVerifiedRow(
  raw: unknown,
  workspace: PersistedWorkspace,
): Promise<NativeWorkspaceVaultGeneration | null> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as NativeVaultRow;
  const generation = safePositiveInteger(row.generation);
  const schemaVersion = safePositiveInteger(row.schema_version);
  if (
    generation === null ||
    schemaVersion === null ||
    row.workspace_id !== String(workspace.id) ||
    typeof row.payload !== 'string' ||
    typeof row.payload_sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(row.payload_sha256) ||
    typeof row.committed_at !== 'string' ||
    !isIsoDate(row.committed_at)
  ) {
    return null;
  }
  if ((await sha256(row.payload)) !== row.payload_sha256) return null;
  return {
    generation,
    workspaceId: row.workspace_id,
    schemaVersion,
    payload: row.payload,
    payloadSha256: row.payload_sha256,
    committedAt: row.committed_at,
  };
}

function stateSchemaVersion(payload: string, workspace: PersistedWorkspace): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    throw new Error('Workspace state payload is not valid JSON.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Workspace state payload is not an object.');
  }
  const record = parsed as Record<string, unknown>;
  const schemaVersion = safePositiveInteger(record['schemaVersion']);
  if (
    schemaVersion === null ||
    record['activeWorkspaceId'] !== String(workspace.id) ||
    record['dataWorkspaceId'] !== String(workspace.id)
  ) {
    throw new Error('Workspace state payload does not belong to this SQLCipher partition.');
  }
  const workspaces = record['workspaces'];
  if (
    !Array.isArray(workspaces) ||
    !workspaces.some(
      (candidate) =>
        candidate !== null &&
        typeof candidate === 'object' &&
        !Array.isArray(candidate) &&
        (candidate as Record<string, unknown>)['id'] === String(workspace.id) &&
        (candidate as Record<string, unknown>)['encryptedSubkeyId'] === workspace.encryptedSubkeyId,
    )
  ) {
    throw new Error('Workspace state payload is not bound to this workspace key identity.');
  }
  return schemaVersion;
}

function requireLedgerWorkspaceIdentity(workspace: PersistedWorkspace): PersistedWorkspace {
  workspaceLedgerDatabaseName(workspace.id);
  if (workspace.encryptedSubkeyId.trim().length === 0) {
    throw new Error('Workspace encryption subkey ID is required.');
  }
  return workspace;
}

function defaultDatabasePath(databaseName: string): string {
  const root = Platform.OS === 'android' ? ANDROID_DATABASE_PATH : IOS_LIBRARY_PATH;
  if (typeof root !== 'string' || root.length === 0) {
    throw new Error('The native SQLCipher database path is unavailable.');
  }
  return `${root.replace(/[\\/]+$/u, '')}/${databaseName}`;
}

function fileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function requireUsableWorkspace(workspace: PersistedWorkspace): PersistedWorkspace {
  requireLedgerWorkspaceIdentity(workspace);
  if (workspace.archivedAt !== null) {
    throw new Error(`SQLCipher workspace ${String(workspace.id)} is archived.`);
  }
  return workspace;
}

function requirePersonalWorkspace(workspace: PersistedWorkspace): PersistedWorkspace {
  requireUsableWorkspace(workspace);
  if (String(workspace.id) !== String(PERSONAL_WORKSPACE_ID) || workspace.kind !== 'personal') {
    throw new Error('The workspace manifest must be stored in the Personal SQLCipher vault.');
  }
  return workspace;
}

function safeGeneration(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/u.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
  }
  throw new Error('SQLCipher workspace generation counter is invalid.');
}

function safePositiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9]\d*$/u.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

async function sha256(value: string): Promise<string> {
  return (
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, {
      encoding: Crypto.CryptoEncoding.HEX,
    })
  ).toLowerCase();
}

function isIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
