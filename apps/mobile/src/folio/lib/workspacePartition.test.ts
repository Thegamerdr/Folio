import { describe, expect, it } from 'vitest';
import { createWorkspace, createWorkspaceId } from '@folio/domain';

import {
  assertValidWorkspaceRoot,
  createWorkspaceManifest,
  deriveWorkspacePartitionKey,
  parseWorkspaceManifest,
  workspacePartitionAssociatedData,
  workspacePartitionFilenames,
  workspacePartitionRef,
  workspaceLedgerDatabaseName,
  workspaceEvidenceAssociatedData,
  workspaceEvidenceFilename,
} from './workspacePartition';
import { decryptBytes, encryptBytes, GCM_NONCE_BYTES } from './cryptoBlob';
import {
  createPersonalWorkspaceRoot,
  PERSONAL_WORKSPACE_ID,
  type PersistedWorkspace,
} from './workspaceRoot';

const BUSINESS_ID = createWorkspaceId('workspace_business_studio_test');

function businessWorkspace(): PersistedWorkspace {
  return {
    ...createWorkspace({
      id: BUSINESS_ID,
      kind: 'business',
      name: 'Studio Ltd',
      baseCurrency: 'GBP',
      jurisdiction: 'GB',
      timeZone: 'Europe/London',
      version: { revision: 1, dataVersion: 'workspace:business:v1' },
    }),
    encryptedSubkeyId: 'workspace-subkey-business-studio-v1',
    archivedAt: null,
  };
}

describe('workspace partition cryptographic boundary', () => {
  it('derives independent keys for workspace and storage purpose', () => {
    const master = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
    const personal = createPersonalWorkspaceRoot().workspaces[0]!;
    const business = businessWorkspace();
    const personalState = deriveWorkspacePartitionKey(master, personal, 'state');
    const businessState = deriveWorkspacePartitionKey(master, business, 'state');
    const businessSqlite = deriveWorkspacePartitionKey(master, business, 'sqlite');

    expect(personalState).toHaveLength(32);
    expect(businessState).toHaveLength(32);
    expect(businessSqlite).toHaveLength(32);
    expect([...personalState]).not.toEqual([...businessState]);
    expect([...businessState]).not.toEqual([...businessSqlite]);
    expect(deriveWorkspacePartitionKey(master, business, 'state')).toEqual(businessState);
    expect(() => deriveWorkspacePartitionKey(master.slice(0, 16), business, 'state')).toThrow(
      /256-bit/,
    );
  });

  it('uses opaque filenames and workspace-bound associated data', () => {
    const personalRef = workspacePartitionRef(PERSONAL_WORKSPACE_ID);
    const businessRef = workspacePartitionRef(BUSINESS_ID);
    expect(personalRef).toMatch(/^[a-f0-9]{64}$/u);
    expect(businessRef).not.toBe(personalRef);
    const filenames = workspacePartitionFilenames(BUSINESS_ID);
    expect(JSON.stringify(filenames)).not.toContain(String(BUSINESS_ID));
    expect(filenames.main).toContain(businessRef);
    const personalLedger = workspaceLedgerDatabaseName(PERSONAL_WORKSPACE_ID);
    const businessLedger = workspaceLedgerDatabaseName(BUSINESS_ID);
    expect(personalLedger).not.toBe(businessLedger);
    expect(businessLedger).toContain(businessRef);
    expect(businessLedger).not.toContain(String(BUSINESS_ID));
    expect(
      new TextDecoder().decode(workspacePartitionAssociatedData(businessWorkspace(), 'state')),
    ).toContain(businessRef);
  });

  it('binds encrypted originals to both workspace and evidence row', () => {
    const master = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
    const business = businessWorkspace();
    const personal = createPersonalWorkspaceRoot().workspaces[0]!;
    const evidenceA = 'evidence_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const evidenceB = 'evidence_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const key = deriveWorkspacePartitionKey(master, business, 'documents');
    const bytes = Uint8Array.from([37, 80, 68, 70, 1, 2, 3]);
    const encoded = encryptBytes(
      bytes,
      key,
      new Uint8Array(GCM_NONCE_BYTES).fill(4),
      workspaceEvidenceAssociatedData(business, evidenceA),
    );

    expect(
      decryptBytes(encoded, key, workspaceEvidenceAssociatedData(business, evidenceA)),
    ).toEqual(bytes);
    expect(
      decryptBytes(encoded, key, workspaceEvidenceAssociatedData(business, evidenceB)),
    ).toBeNull();
    expect(
      decryptBytes(
        encoded,
        deriveWorkspacePartitionKey(master, personal, 'documents'),
        workspaceEvidenceAssociatedData(personal, evidenceA),
      ),
    ).toBeNull();
    const filename = workspaceEvidenceFilename(business.id, evidenceA);
    expect(filename).not.toContain(String(business.id));
    expect(filename).not.toContain(evidenceA);
    expect(() => workspaceEvidenceFilename(business.id, '../escape')).toThrow(/invalid/);
  });
});

describe('workspace manifest boundary', () => {
  it('round-trips one Personal and one Business workspace without financial rows', () => {
    const personalRoot = createPersonalWorkspaceRoot();
    const business = businessWorkspace();
    const root = assertValidWorkspaceRoot({
      workspaces: [...personalRoot.workspaces, business],
      activeWorkspaceId: BUSINESS_ID,
      dataWorkspaceId: BUSINESS_ID,
    });
    const manifest = createWorkspaceManifest(root, '2026-07-15T20:00:00.000Z');
    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toContain('transactions');
    expect(parseWorkspaceManifest(serialized)).toEqual(manifest);
  });

  it('rejects duplicate subkeys, an archived active workspace and extra businesses', () => {
    const personal = createPersonalWorkspaceRoot().workspaces[0]!;
    const business = businessWorkspace();
    expect(() =>
      assertValidWorkspaceRoot({
        workspaces: [personal, { ...business, encryptedSubkeyId: personal.encryptedSubkeyId }],
        activeWorkspaceId: PERSONAL_WORKSPACE_ID,
        dataWorkspaceId: PERSONAL_WORKSPACE_ID,
      }),
    ).toThrow(/subkey IDs must be unique/);
    expect(() =>
      assertValidWorkspaceRoot({
        workspaces: [personal, { ...business, archivedAt: '2026-07-15T20:00:00.000Z' }],
        activeWorkspaceId: BUSINESS_ID,
        dataWorkspaceId: BUSINESS_ID,
      }),
    ).toThrow(/must not be archived/);
    expect(() =>
      assertValidWorkspaceRoot({
        workspaces: [
          personal,
          business,
          {
            ...business,
            id: createWorkspaceId('workspace_business_second_test'),
            encryptedSubkeyId: 'workspace-subkey-business-second-v1',
          },
        ],
        activeWorkspaceId: PERSONAL_WORKSPACE_ID,
        dataWorkspaceId: PERSONAL_WORKSPACE_ID,
      }),
    ).toThrow(/at most one Business/);
  });

  it('fails closed on raw or malformed manifest metadata', () => {
    const personalRoot = createPersonalWorkspaceRoot();
    const valid = createWorkspaceManifest(personalRoot, '2026-07-15T20:00:00.000Z');
    expect(parseWorkspaceManifest('{')).toBeNull();
    expect(
      parseWorkspaceManifest(
        JSON.stringify({ ...valid, activeWorkspaceId: 'workspace_business_missing' }),
      ),
    ).toBeNull();
    expect(
      parseWorkspaceManifest(
        JSON.stringify({
          ...valid,
          workspaces: [{ ...valid.workspaces[0], encryptedSubkeyId: '../escape' }],
        }),
      ),
    ).toBeNull();
  });
});
