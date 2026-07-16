import { createWorkspace, createWorkspaceId } from '@folio/domain';
import {
  createInMemoryCanonicalRepository,
  type CanonicalRepositorySnapshot,
} from '@folio/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createPersonalWorkspaceRoot,
  type PersistedWorkspace,
} from '../folio/lib/workspaceRoot.js';
import {
  createWorkspaceManifest,
  workspaceLedgerDatabaseName,
} from '../folio/lib/workspacePartition.js';

type StoredRow = {
  record_kind: string;
  record_id: string;
  generation: number;
  workspace_id: string;
  schema_version: number;
  payload: string;
  payload_sha256: string;
  committed_at: string;
};

type AuditRow = {
  id: string;
  workspace_id: string | null;
  command_type: string;
  actor_kind: string;
  actor_ref: string | null;
  entity_refs_json: string;
  delta_json: string;
  provenance_json: string | null;
  device_id: string | null;
  reversal_of_id: string | null;
  created_at: string;
};

type CanonicalBindingRow = {
  record_kind: string;
  record_id: string;
  generation: number;
  canonical_snapshot_sha256: string;
};

const {
  databases,
  canonicalBindingsByDatabase,
  auditRowsByDatabase,
  open,
  keyState,
  tamperExactReadback,
  tamperCanonicalReadback,
  failCanonicalMigration,
  tamperAuditReadback,
  migrateCanonicalSnapshot,
  openCanonicalRepository,
  canonicalSnapshotState,
  fsFiles,
  nativeQuarantine,
  nativeClear,
} = vi.hoisted(() => {
  const databases = new Map<string, StoredRow[]>();
  const canonicalBindingsByDatabase = new Map<string, CanonicalBindingRow[]>();
  const auditRowsByDatabase = new Map<string, AuditRow[]>();
  const fsFiles = new Map<string, string>();
  const keyState = { value: 'secure_store_reused' };
  const tamperExactReadback = { next: false };
  const tamperCanonicalReadback = { next: false };
  const failCanonicalMigration = { next: false };
  const tamperAuditReadback = { next: false };
  const canonicalSnapshotState = { value: null as CanonicalRepositorySnapshot | null };
  const migrateCanonicalSnapshot = vi.fn(async (_driver: unknown, snapshot: unknown) => {
    if (failCanonicalMigration.next) {
      failCanonicalMigration.next = false;
      throw new Error('canonical migration failed');
    }
    canonicalSnapshotState.value = snapshot as CanonicalRepositorySnapshot;
    return {
      snapshot: vi.fn(async () => {
        if (!tamperCanonicalReadback.next) return snapshot;
        tamperCanonicalReadback.next = false;
        const checked = snapshot as CanonicalRepositorySnapshot;
        return {
          ...checked,
          collections: { ...checked.collections, workspaces: [] },
        };
      }),
    };
  });
  const openCanonicalRepository = vi.fn(async () => ({
    snapshot: vi.fn(async () => {
      if (canonicalSnapshotState.value === null) throw new Error('canonical snapshot is absent');
      return canonicalSnapshotState.value;
    }),
  }));
  const nativeQuarantine = vi.fn(async (databaseName: string) => {
    const liveMain = `file:///data/user/0/com.folio.v2.greenfield/databases/${databaseName}`;
    const parkedMain = `file:///data/user/0/com.folio.v2.greenfield/files/${databaseName}.unreadable`;
    const moved: string[] = [];
    for (const suffix of ['', '-wal', '-shm']) {
      const value = fsFiles.get(`${liveMain}${suffix}`);
      if (value === undefined) continue;
      fsFiles.set(`${parkedMain}${suffix}`, value);
      fsFiles.delete(`${liveMain}${suffix}`);
      moved.push(`${parkedMain}${suffix}`);
    }
    return { moved, parkedMainUri: parkedMain };
  });
  const nativeClear = vi.fn(async (databaseName: string) => {
    const parkedMain = `file:///data/user/0/com.folio.v2.greenfield/files/${databaseName}.unreadable`;
    for (const suffix of ['', '-wal', '-shm']) fsFiles.delete(`${parkedMain}${suffix}`);
  });
  const open = vi.fn(({ name }: { name: string; encryptionKey: string }) => {
    const rows = databases.get(name) ?? [];
    const canonicalBindings = canonicalBindingsByDatabase.get(name) ?? [];
    const auditRows = auditRowsByDatabase.get(name) ?? [];
    let transactionBackup: StoredRow[] | null = null;
    let canonicalBindingTransactionBackup: CanonicalBindingRow[] | null = null;
    let auditTransactionBackup: AuditRow[] | null = null;
    databases.set(name, rows);
    canonicalBindingsByDatabase.set(name, canonicalBindings);
    auditRowsByDatabase.set(name, auditRows);
    return {
      close: vi.fn(),
      getDbPath: () => `/data/user/0/com.folio.v2.greenfield/databases/${name}`,
      execute: vi.fn(async (sql: string, params: readonly unknown[] = []) => {
        const normalized = sql.replace(/\s+/gu, ' ').trim();
        if (normalized.startsWith('CREATE TABLE')) {
          return { rows: [], rowsAffected: 0 };
        }
        if (normalized === 'BEGIN IMMEDIATE TRANSACTION') {
          transactionBackup = rows.map((row) => ({ ...row }));
          canonicalBindingTransactionBackup = canonicalBindings.map((row) => ({ ...row }));
          auditTransactionBackup = auditRows.map((row) => ({ ...row }));
          return { rows: [], rowsAffected: 0 };
        }
        if (normalized === 'COMMIT') {
          transactionBackup = null;
          canonicalBindingTransactionBackup = null;
          auditTransactionBackup = null;
          return { rows: [], rowsAffected: 0 };
        }
        if (normalized === 'ROLLBACK') {
          if (transactionBackup !== null) {
            rows.splice(0, rows.length, ...transactionBackup.map((row) => ({ ...row })));
          }
          if (canonicalBindingTransactionBackup !== null) {
            canonicalBindings.splice(
              0,
              canonicalBindings.length,
              ...canonicalBindingTransactionBackup.map((row) => ({ ...row })),
            );
          }
          if (auditTransactionBackup !== null) {
            auditRows.splice(
              0,
              auditRows.length,
              ...auditTransactionBackup.map((row) => ({ ...row })),
            );
          }
          transactionBackup = null;
          canonicalBindingTransactionBackup = null;
          auditTransactionBackup = null;
          return { rows: [], rowsAffected: 0 };
        }
        if (normalized.startsWith('SELECT MAX(generation)')) {
          const [recordKind, recordId] = params as [string, string];
          const matching = rows.filter(
            (row) => row.record_kind === recordKind && row.record_id === recordId,
          );
          return {
            rows: [
              {
                max_generation:
                  matching.length === 0 ? null : Math.max(...matching.map((row) => row.generation)),
              },
            ],
            rowsAffected: 0,
          };
        }
        if (normalized.startsWith('INSERT INTO folio_workspace_vault_generations')) {
          const [
            recordKind,
            recordId,
            generation,
            workspaceId,
            schemaVersion,
            payload,
            payloadSha256,
            committedAt,
          ] = params as [string, string, number, string, number, string, string, string];
          rows.push({
            record_kind: recordKind,
            record_id: recordId,
            generation,
            workspace_id: workspaceId,
            schema_version: schemaVersion,
            payload,
            payload_sha256: payloadSha256,
            committed_at: committedAt,
          });
          return { rows: [], rowsAffected: 1 };
        }
        if (normalized.startsWith('INSERT INTO audit_log')) {
          const [
            id,
            workspaceId,
            commandType,
            actorKind,
            actorRef,
            entityRefsJson,
            deltaJson,
            provenanceJson,
            deviceId,
            reversalOfId,
            createdAt,
          ] = params as [
            string,
            string | null,
            string,
            string,
            string | null,
            string,
            string,
            string | null,
            string | null,
            string | null,
            string,
          ];
          if (auditRows.some((row) => row.id === id)) throw new Error('duplicate audit id');
          auditRows.push({
            id,
            workspace_id: workspaceId,
            command_type: commandType,
            actor_kind: actorKind,
            actor_ref: actorRef,
            entity_refs_json: entityRefsJson,
            delta_json: deltaJson,
            provenance_json: provenanceJson,
            device_id: deviceId,
            reversal_of_id: reversalOfId,
            created_at: createdAt,
          });
          return { rows: [], rowsAffected: 1 };
        }
        if (normalized.startsWith('INSERT INTO folio_workspace_vault_canonical_bindings')) {
          const [recordKind, recordId, generation, canonicalSnapshotSha256] = params as [
            string,
            string,
            number,
            string,
          ];
          canonicalBindings.push({
            record_kind: recordKind,
            record_id: recordId,
            generation,
            canonical_snapshot_sha256: canonicalSnapshotSha256,
          });
          return { rows: [], rowsAffected: 1 };
        }
        if (
          normalized.includes('FROM folio_workspace_vault_generations') &&
          normalized.includes('AND generation = ?')
        ) {
          const [recordKind, recordId, generation] = params as [string, string, number];
          const row = rows.find(
            (candidate) =>
              candidate.record_kind === recordKind &&
              candidate.record_id === recordId &&
              candidate.generation === generation,
          );
          if (row === undefined) return { rows: [], rowsAffected: 0 };
          if (tamperExactReadback.next) {
            tamperExactReadback.next = false;
            return { rows: [{ ...row, payload: `${row.payload}tampered` }], rowsAffected: 0 };
          }
          return { rows: [{ ...row }], rowsAffected: 0 };
        }
        if (normalized.includes('FROM audit_log')) {
          const [id, workspaceId, commandType] = params as [string, string, string];
          const row = auditRows.find(
            (candidate) =>
              candidate.id === id &&
              candidate.workspace_id === workspaceId &&
              candidate.command_type === commandType,
          );
          if (row === undefined) return { rows: [], rowsAffected: 0 };
          if (tamperAuditReadback.next) {
            tamperAuditReadback.next = false;
            return { rows: [{ ...row, delta_json: '{"tampered":true}' }], rowsAffected: 0 };
          }
          return { rows: [{ ...row }], rowsAffected: 0 };
        }
        if (normalized.includes('FROM folio_workspace_vault_canonical_bindings')) {
          const [recordKind, recordId, generation] = params as [string, string, number];
          const row = canonicalBindings.find(
            (candidate) =>
              candidate.record_kind === recordKind &&
              candidate.record_id === recordId &&
              candidate.generation === generation,
          );
          return {
            rows: row === undefined ? [] : [{ ...row }],
            rowsAffected: 0,
          };
        }
        if (
          normalized.includes('FROM folio_workspace_vault_generations') &&
          normalized.includes('ORDER BY generation DESC')
        ) {
          const [recordKind, recordId, limit] = params as [string, string, number];
          return {
            rows: rows
              .filter((row) => row.record_kind === recordKind && row.record_id === recordId)
              .sort((left, right) => right.generation - left.generation)
              .slice(0, limit)
              .map((row) => ({ ...row })),
            rowsAffected: 0,
          };
        }
        if (normalized.startsWith('DELETE FROM folio_workspace_vault_generations')) {
          const [recordKind, recordId, threshold] = params as [string, string, number];
          let removed = 0;
          for (let index = rows.length - 1; index >= 0; index -= 1) {
            const row = rows[index]!;
            if (
              row.record_kind === recordKind &&
              row.record_id === recordId &&
              row.generation < threshold
            ) {
              rows.splice(index, 1);
              removed += 1;
            }
          }
          return { rows: [], rowsAffected: removed };
        }
        if (normalized.startsWith('DELETE FROM folio_workspace_vault_canonical_bindings')) {
          const [recordKind, recordId, threshold] = params as [string, string, number];
          let removed = 0;
          for (let index = canonicalBindings.length - 1; index >= 0; index -= 1) {
            const row = canonicalBindings[index]!;
            if (
              row.record_kind === recordKind &&
              row.record_id === recordId &&
              row.generation < threshold
            ) {
              canonicalBindings.splice(index, 1);
              removed += 1;
            }
          }
          return { rows: [], rowsAffected: removed };
        }
        throw new Error(`Unhandled fake SQL: ${normalized}`);
      }),
    };
  });
  return {
    databases,
    canonicalBindingsByDatabase,
    auditRowsByDatabase,
    open,
    keyState,
    tamperExactReadback,
    tamperCanonicalReadback,
    failCanonicalMigration,
    tamperAuditReadback,
    migrateCanonicalSnapshot,
    openCanonicalRepository,
    canonicalSnapshotState,
    fsFiles,
    nativeQuarantine,
    nativeClear,
  };
});

vi.mock('@folio/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@folio/storage')>();
  return {
    ...actual,
    migrateCanonicalSnapshotToSqliteRepository: migrateCanonicalSnapshot,
    openSqliteCanonicalRepository: openCanonicalRepository,
  };
});

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@op-engineering/op-sqlite', () => ({
  open,
  ANDROID_DATABASE_PATH: '/data/user/0/com.folio.v2.greenfield/databases/',
  IOS_LIBRARY_PATH: '',
}));
vi.mock('expo-file-system/legacy', () => ({
  getInfoAsync: vi.fn(async (uri: string) => ({ exists: fsFiles.has(uri) })),
  deleteAsync: vi.fn(async (uri: string) => {
    fsFiles.delete(uri);
  }),
  moveAsync: vi.fn(async ({ from, to }: { from: string; to: string }) => {
    const value = fsFiles.get(from);
    if (value === undefined) throw new Error(`Missing fake file ${from}`);
    fsFiles.set(to, value);
    fsFiles.delete(from);
  }),
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: vi.fn(async (_algorithm: string, value: string) =>
    value.length.toString(16).padStart(64, '0'),
  ),
}));
vi.mock('../../modules/folio-local-vault', () => ({
  quarantinePrivateDatabaseFamily: nativeQuarantine,
  clearQuarantinedPrivateDatabaseFamily: nativeClear,
}));
vi.mock('./nativeLocalSecurity', () => ({
  getLastLocalDatabaseKeyState: () => keyState.value,
  resolveLocalLedgerWorkspaceEncryptionKey: vi.fn(
    async (workspace: PersistedWorkspace) => `derived-key:${String(workspace.id)}`,
  ),
}));

import {
  clearQuarantinedNativeWorkspaceVaults,
  loadNativeCanonicalSnapshotForGeneration,
  loadNativeWorkspaceManifestGenerations,
  loadNativeWorkspaceStateGenerations,
  quarantineNativeWorkspaceVault,
  saveNativeWorkspaceManifestGeneration,
  saveNativeWorkspaceStateGeneration,
} from './nativeWorkspaceStateStore.js';
import { createPendingAppStateCommand } from '../folio/lib/typedCommandBridge.js';

function businessWorkspace(): PersistedWorkspace {
  return {
    ...createWorkspace({
      id: createWorkspaceId('workspace_business_native_vault_test'),
      kind: 'business',
      name: 'Studio Ltd',
      baseCurrency: 'GBP',
      jurisdiction: 'GB',
      timeZone: 'Europe/London',
      version: { revision: 1, dataVersion: 'workspace:business:v1' },
    }),
    encryptedSubkeyId: 'workspace-subkey-business-native-vault-v1',
    archivedAt: null,
  };
}

function statePayload(workspace: PersistedWorkspace, marker: string): string {
  return JSON.stringify({
    schemaVersion: 11,
    workspaces: [workspace],
    activeWorkspaceId: workspace.id,
    dataWorkspaceId: workspace.id,
    marker,
  });
}

function canonicalSnapshot(workspace: PersistedWorkspace): CanonicalRepositorySnapshot {
  return createInMemoryCanonicalRepository(workspace.id, { workspaces: [workspace] }).snapshot();
}

function saveState(
  workspace: PersistedWorkspace,
  marker: string,
  pendingCommands: readonly ReturnType<typeof createPendingAppStateCommand>[] = [],
) {
  return saveNativeWorkspaceStateGeneration(
    workspace,
    statePayload(workspace, marker),
    canonicalSnapshot(workspace),
    pendingCommands,
  );
}

beforeEach(() => {
  databases.clear();
  canonicalBindingsByDatabase.clear();
  auditRowsByDatabase.clear();
  fsFiles.clear();
  vi.clearAllMocks();
  keyState.value = 'secure_store_reused';
  tamperExactReadback.next = false;
  tamperCanonicalReadback.next = false;
  failCanonicalMigration.next = false;
  tamperAuditReadback.next = false;
  canonicalSnapshotState.value = null;
});

describe('lossless SQLCipher workspace generations', () => {
  it('writes exact state to the opaque workspace database and retains three generations', async () => {
    const workspace = businessWorkspace();
    for (const marker of ['one', 'two', 'three', 'four']) {
      await saveState(workspace, marker);
    }

    expect(open).toHaveBeenCalledWith({
      name: workspaceLedgerDatabaseName(workspace.id),
      encryptionKey: `derived-key:${String(workspace.id)}`,
    });
    const loaded = await loadNativeWorkspaceStateGenerations(workspace);
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') throw new Error('Expected readable generations.');
    expect(loaded.generations.map((generation) => generation.generation)).toEqual([4, 3, 2]);
    expect(loaded.generations.map((generation) => JSON.parse(generation.payload).marker)).toEqual([
      'four',
      'three',
      'two',
    ]);
  });

  it('loads canonical rows only through the fingerprint bound to the selected exact generation', async () => {
    const workspace = businessWorkspace();
    const generation = await saveState(workspace, 'bound-canonical');

    const loaded = await loadNativeCanonicalSnapshotForGeneration(workspace, generation);

    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') throw new Error('Expected a bound canonical snapshot.');
    expect(loaded.generation).toBe(generation.generation);
    expect(loaded.snapshot).toEqual(canonicalSnapshot(workspace));
    expect(loaded.canonicalSnapshotSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('rejects canonical latest rows when an older exact generation is selected for recovery', async () => {
    const workspace = businessWorkspace();
    const older = await saveState(workspace, 'older');
    const revisedWorkspace = { ...workspace, name: 'Revised Studio Ltd' };
    await saveNativeWorkspaceStateGeneration(
      workspace,
      statePayload(workspace, 'newer'),
      canonicalSnapshot(revisedWorkspace),
    );

    await expect(loadNativeCanonicalSnapshotForGeneration(workspace, older)).resolves.toEqual({
      status: 'mismatch',
    });
  });

  it('leaves pre-binding exact generations authoritative instead of guessing canonical ownership', async () => {
    const workspace = businessWorkspace();
    const generation = await saveState(workspace, 'legacy-unbound');
    canonicalBindingsByDatabase.set(workspaceLedgerDatabaseName(workspace.id), []);

    await expect(loadNativeCanonicalSnapshotForGeneration(workspace, generation)).resolves.toEqual({
      status: 'unbound',
    });
  });

  it('skips a hash-corrupt latest generation and exposes the previous verified copies', async () => {
    const workspace = businessWorkspace();
    await saveState(workspace, 'good-one');
    await saveState(workspace, 'good-two');
    const rows = databases.get(workspaceLedgerDatabaseName(workspace.id))!;
    rows.find((row) => row.generation === 2)!.payload = 'corrupt';

    const loaded = await loadNativeWorkspaceStateGenerations(workspace);
    expect(loaded.status).toBe('recovered');
    if (loaded.status !== 'recovered') throw new Error('Expected recovered generations.');
    expect(loaded.invalidGenerationCount).toBe(1);
    expect(loaded.generations).toHaveLength(1);
    expect(JSON.parse(loaded.generations[0]!.payload).marker).toBe('good-one');
  });

  it('rejects a cross-workspace payload before opening native storage', async () => {
    const workspace = businessWorkspace();
    const personal = createPersonalWorkspaceRoot().workspaces[0]!;
    await expect(
      saveNativeWorkspaceStateGeneration(
        workspace,
        statePayload(personal, 'wrong-owner'),
        canonicalSnapshot(workspace),
      ),
    ).rejects.toThrow(/does not belong/i);
    expect(open).not.toHaveBeenCalled();
  });

  it('rolls back the save contract when exact SQL readback is not identical', async () => {
    const workspace = businessWorkspace();
    tamperExactReadback.next = true;
    await expect(saveState(workspace, 'verify-me')).rejects.toThrow(/readback verification/i);
  });

  it('rolls the state generation back when canonical projection migration fails', async () => {
    const workspace = businessWorkspace();
    failCanonicalMigration.next = true;

    await expect(saveState(workspace, 'canonical-failure')).rejects.toThrow(
      /canonical migration failed/i,
    );
    const loaded = await loadNativeWorkspaceStateGenerations(workspace);
    expect(loaded).toEqual({ status: 'absent', generations: [] });
  });

  it('rolls the state generation back when canonical readback differs', async () => {
    const workspace = businessWorkspace();
    tamperCanonicalReadback.next = true;

    await expect(saveState(workspace, 'canonical-mismatch')).rejects.toThrow(
      /canonical projection failed exact readback verification/i,
    );
    const loaded = await loadNativeWorkspaceStateGenerations(workspace);
    expect(loaded).toEqual({ status: 'absent', generations: [] });
  });

  it('commits a privacy-minimal typed audit with the exact state and canonical snapshot', async () => {
    const workspace = businessWorkspace();
    const command = createPendingAppStateCommand({
      commandType: 'folio.transaction.record.v1',
      workspaceId: workspace.id,
      actorKind: 'user',
      entityRefs: [{ type: 'transaction', id: 'txn-native-audit-one' }],
      after: { transaction: { merchant: 'Private Coffee', amount: -31.27 } },
      occurredAt: '2026-07-16T12:30:00.000Z',
    });

    await saveState(workspace, 'typed-command', [command]);

    const auditRows = auditRowsByDatabase.get(workspaceLedgerDatabaseName(workspace.id)) ?? [];
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      id: command.id,
      workspace_id: workspace.id,
      command_type: 'folio.transaction.record.v1',
      actor_kind: 'user',
      created_at: '2026-07-16T12:30:00.000Z',
    });
    expect(JSON.stringify(auditRows[0])).not.toContain('Private Coffee');
    expect(JSON.stringify(auditRows[0])).not.toContain('-31.27');
  });

  it('rolls back both generation and audit when typed-command readback is tampered', async () => {
    const workspace = businessWorkspace();
    const command = createPendingAppStateCommand({
      commandType: 'folio.balance.set_current.v1',
      workspaceId: workspace.id,
      actorKind: 'user',
      entityRefs: [{ type: 'balance', id: `${String(workspace.id)}:current` }],
      after: { balance: { amount: 123.45 } },
      occurredAt: '2026-07-16T12:35:00.000Z',
    });
    tamperAuditReadback.next = true;

    await expect(saveState(workspace, 'tampered-audit', [command])).rejects.toThrow(
      /typed-command audit failed exact readback verification/i,
    );
    expect(await loadNativeWorkspaceStateGenerations(workspace)).toEqual({
      status: 'absent',
      generations: [],
    });
    expect(auditRowsByDatabase.get(workspaceLedgerDatabaseName(workspace.id))).toEqual([]);
  });

  it('stores the workspace root only in Personal and reads it back by generation', async () => {
    const personalRoot = createPersonalWorkspaceRoot();
    const personal = personalRoot.workspaces[0]!;
    const manifest = createWorkspaceManifest(personalRoot, '2026-07-16T04:00:00.000Z');
    await saveNativeWorkspaceManifestGeneration(personal, manifest);

    const loaded = await loadNativeWorkspaceManifestGenerations(personal);
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') throw new Error('Expected readable manifest.');
    expect(JSON.parse(loaded.generations[0]!.payload)).toEqual(manifest);
    await expect(
      saveNativeWorkspaceManifestGeneration(businessWorkspace(), manifest),
    ).rejects.toThrow(/Personal SQLCipher vault/i);
  });

  it('fails closed without opening SQLCipher when device key storage is unavailable', async () => {
    keyState.value = 'secure_store_unavailable_fallback';
    const loaded = await loadNativeWorkspaceStateGenerations(businessWorkspace());
    expect(loaded).toEqual({ status: 'unavailable', generations: [] });
    expect(open).not.toHaveBeenCalled();
  });

  it('parks an unreadable database family and clears every parked member on local deletion', async () => {
    const workspace = businessWorkspace();
    const liveMain = `file:///data/user/0/com.folio.v2.greenfield/databases/${workspaceLedgerDatabaseName(
      workspace.id,
    )}`;
    const parkedMain = `file:///data/user/0/com.folio.v2.greenfield/files/${workspaceLedgerDatabaseName(
      workspace.id,
    )}.unreadable`;
    fsFiles.set(liveMain, 'corrupt-main');
    fsFiles.set(`${liveMain}-wal`, 'corrupt-wal');

    const parked = await quarantineNativeWorkspaceVault(workspace);

    expect(open).not.toHaveBeenCalled();
    expect(nativeQuarantine).toHaveBeenCalledWith(workspaceLedgerDatabaseName(workspace.id));
    expect(parked.moved).toEqual([parkedMain, `${parkedMain}-wal`]);
    expect(fsFiles.has(liveMain)).toBe(false);
    expect(fsFiles.get(parkedMain)).toBe('corrupt-main');
    await clearQuarantinedNativeWorkspaceVaults(workspace);
    expect(nativeClear).toHaveBeenCalledWith(workspaceLedgerDatabaseName(workspace.id));
    expect([...fsFiles.keys()]).toEqual([]);
  });
});
