import { createWorkspace, createWorkspaceId } from '@folio/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { workspaceLedgerDatabaseName } from '../folio/lib/workspacePartition.js';
import {
  createPersonalWorkspaceRoot,
  type PersistedWorkspace,
} from '../folio/lib/workspaceRoot.js';
import { createEmptyLocalLedgerState } from './localLedger.js';

type FakeResult = Readonly<{
  rows: readonly Record<string, unknown>[];
  rowsAffected: number;
}>;

const execute = vi.fn(
  async (_sql: string, _params?: readonly unknown[]): Promise<FakeResult> => ({
    rows: [],
    rowsAffected: 0,
  }),
);
const close = vi.fn();
const open = vi.fn((_options: { name: string; encryptionKey: string }) => ({ execute, close }));
const migrateCanonicalSnapshotToSqliteRepository = vi.fn(async () => undefined);

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@op-engineering/op-sqlite', () => ({ open }));
vi.mock('@folio/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@folio/storage')>()),
  migrateCanonicalSnapshotToSqliteRepository,
}));
vi.mock('./nativeLocalSecurity', () => ({
  getLastLocalDatabaseKeyState: () => 'secure_store_reused',
  resolveLocalLedgerEncryptionKey: vi.fn(async () => 'legacy-personal-master-key'),
  resolveLocalLedgerWorkspaceEncryptionKey: vi.fn(
    async (workspace: PersistedWorkspace) => `derived-key:${String(workspace.id)}`,
  ),
}));

function businessWorkspace(): PersistedWorkspace {
  return {
    ...createWorkspace({
      id: createWorkspaceId('workspace_business_native_store_test'),
      kind: 'business',
      name: 'Studio Ltd',
      baseCurrency: 'GBP',
      jurisdiction: 'GB',
      timeZone: 'Europe/London',
      version: { revision: 1, dataVersion: 'workspace:business:v1' },
    }),
    encryptedSubkeyId: 'workspace-subkey-business-native-store-v1',
    archivedAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  execute.mockResolvedValue({ rows: [], rowsAffected: 0 });
});

describe('native SQLCipher physical workspace isolation', () => {
  it('writes Business only to its opaque database and binds every normalized row to Business', async () => {
    const workspace = businessWorkspace();
    const { saveLocalLedgerState } = await import('./nativeLedgerStore.js');
    await saveLocalLedgerState(workspace, createEmptyLocalLedgerState());

    expect(open).toHaveBeenCalledWith({
      name: workspaceLedgerDatabaseName(workspace.id),
      encryptionKey: `derived-key:${String(workspace.id)}`,
    });
    expect(open).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'folio_local_ledger.sqlite' }),
    );

    const normalizedWrites = execute.mock.calls.filter(([sql]) =>
      /(?:INSERT(?: OR REPLACE)? INTO|DELETE FROM) local_ledger_(?:metadata|transactions|import_drafts|rejected_imports|history|document_stages|search_index)/u.test(
        String(sql).replace(/\s+/gu, ' '),
      ),
    );
    expect(normalizedWrites.length).toBeGreaterThan(0);
    for (const [, params] of normalizedWrites) {
      expect(params ?? []).toContain(workspace.id);
      expect(params ?? []).not.toContain('workspace_personal_local');
    }
  });

  it('does not inspect or clear the Personal compatibility database for Business', async () => {
    const workspace = businessWorkspace();
    const { clearLocalLedgerStorage, loadLocalLedgerState } =
      await import('./nativeLedgerStore.js');

    await expect(loadLocalLedgerState(workspace)).resolves.toBeNull();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: workspaceLedgerDatabaseName(workspace.id) }),
    );

    vi.clearAllMocks();
    execute.mockResolvedValue({ rows: [], rowsAffected: 0 });
    await clearLocalLedgerStorage(workspace);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ name: workspaceLedgerDatabaseName(workspace.id) }),
    );
    expect(open).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'folio_local_ledger.sqlite' }),
    );
    expect(execute).toHaveBeenCalledWith(
      expect.stringMatching(/DELETE FROM folio_workspace_vault_generations/u),
    );
  });

  it('rejects archived metadata before opening a native database', async () => {
    const { saveLocalLedgerState } = await import('./nativeLedgerStore.js');
    await expect(
      saveLocalLedgerState(
        { ...businessWorkspace(), archivedAt: '2026-07-15T20:00:00.000Z' },
        createEmptyLocalLedgerState(),
      ),
    ).rejects.toThrow(/archived/i);
    expect(open).not.toHaveBeenCalled();
  });

  it('migrates the old database only for Personal and clears it after scoped verification', async () => {
    const personal = createPersonalWorkspaceRoot().workspaces[0]!;
    const empty = createEmptyLocalLedgerState();
    const scopedName = workspaceLedgerDatabaseName(personal.id);
    const openCounts = new Map<string, number>();

    open.mockImplementation(({ name }) => {
      const count = (openCounts.get(name) ?? 0) + 1;
      openCounts.set(name, count);
      const hasReadableState =
        (name === 'folio_local_ledger.sqlite' && count === 1) ||
        (name === scopedName && count === 3);
      return {
        close,
        execute: vi.fn(async (sql: string, _params?: readonly unknown[]): Promise<FakeResult> => {
          const normalized = sql.replace(/\s+/gu, ' ');
          if (normalized.includes('FROM local_ledger_metadata')) {
            return {
              rows: hasReadableState
                ? [
                    {
                      as_of_date: empty.asOfDate,
                      cash_on_hand_minor: empty.cashOnHandMinor,
                      currency: empty.currency,
                      import_issue_count: empty.importIssueCount,
                      last_import_summary_json: null,
                      tight_point_goal_minor: empty.tightPointGoalMinor,
                    },
                  ]
                : [],
              rowsAffected: 0,
            };
          }
          if (normalized.includes('SELECT json FROM local_ledger_snapshot')) {
            return {
              rows: hasReadableState ? [{ json: JSON.stringify(empty) }] : [],
              rowsAffected: 0,
            };
          }
          return { rows: [], rowsAffected: 0 };
        }),
      };
    });

    const { loadLocalLedgerState } = await import('./nativeLedgerStore.js');
    await expect(loadLocalLedgerState(personal)).resolves.toEqual(empty);
    expect(openCounts.get(scopedName)).toBe(3);
    expect(openCounts.get('folio_local_ledger.sqlite')).toBe(2);
    expect(open).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: scopedName }));
    expect(open).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: 'folio_local_ledger.sqlite',
        encryptionKey: 'legacy-personal-master-key',
      }),
    );
  });
});
