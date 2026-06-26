import { describe, expect, it } from 'vitest';

import {
  applyEncryptedInboxBatch,
  buildCloudDataInventory,
  buildConflictPolicyState,
  buildEncryptedOutboxState,
  buildPhase10CoverageRows,
  createEncryptedSyncEnvelope,
  evaluateAccountDeletionPortal,
  evaluateCloudSecurityReview,
  evaluateCompactionCursors,
  evaluateDeviceRecoveryManagerUi,
  evaluateDeviceRegistry,
  evaluateEncryptedBackupSyncBeta,
  evaluateEncryptedSnapshots,
  evaluateKeyHierarchy,
  evaluateMultiDeviceConflictSuite,
  evaluateOptionalAccount,
  evaluateRecoverySetup,
  resolveConflict,
  syncBoundary,
  validateEnvelopeForUpload,
  type CloudEnvelopeMetadata,
  type CloudVisibleEnvelopeCandidate,
  type ConflictCase,
  type RegisteredDevice,
  type SnapshotGeneration,
} from '../src/index.js';

const metadata: CloudEnvelopeMetadata = {
  accountId: 'acct_demo',
  deviceId: 'device_a',
  encryptedBlobId: 'blob_001',
  sequence: 1,
  sizeBytes: 24,
  createdAtIso: '2026-06-21T10:00:00.000Z',
  consentState: 'sync_enabled',
  entitlement: 'cloud_beta',
};

const goodEnvelope: CloudVisibleEnvelopeCandidate = {
  id: 'env_001',
  workspaceId: 'workspace_personal_demo',
  deviceId: 'device_a',
  sequence: 1,
  schemaVersion: 1,
  idempotencyKey: 'idempotency_env_001',
  ciphertext: new Uint8Array([1, 2, 3, 4]),
  createdAtIso: '2026-06-21T10:00:00.000Z',
  serviceMetadata: metadata,
};

const secondEnvelope: CloudVisibleEnvelopeCandidate = {
  ...goodEnvelope,
  id: 'env_002',
  sequence: 2,
  idempotencyKey: 'idempotency_env_002',
  serviceMetadata: { ...metadata, encryptedBlobId: 'blob_002', sequence: 2 },
};

const activeDevices: readonly RegisteredDevice[] = [
  {
    id: 'device_a',
    label: 'Android development phone',
    active: true,
    registered: true,
    publicKeyFingerprint: 'sha256:device-a',
    acknowledgedSequence: 8,
  },
  {
    id: 'device_b',
    label: 'Lost phone',
    active: false,
    registered: true,
    publicKeyFingerprint: 'sha256:device-b',
    acknowledgedSequence: 4,
    revokedAtIso: '2026-06-21T11:00:00.000Z',
  },
];

describe('sync boundary', () => {
  it('stays pure and detached from cloud/native runtimes', () => {
    expect(syncBoundary).toMatchObject({
      packageName: '@folio/sync',
      modelRequired: false,
      networkRequired: false,
      writesDirectlyToStorage: false,
      importsCloudSdk: false,
      importsNativeModules: false,
    });
  });
});

describe('encrypted envelope contract', () => {
  it('creates versioned ciphertext envelopes with minimal service metadata', () => {
    const envelope = createEncryptedSyncEnvelope({
      id: 'env_001',
      workspaceId: 'workspace_personal_demo',
      deviceId: 'device_a',
      sequence: 1,
      idempotencyKey: 'idempotency_env_001',
      ciphertext: [1, 2, 3, 4],
      createdAtIso: '2026-06-21T10:00:00.000Z',
      serviceMetadata: metadata,
    });

    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.ciphertext).toBeInstanceOf(Uint8Array);
    expect(Object.keys(envelope.serviceMetadata)).not.toContain('amountMinor');
  });

  it('rejects malformed or plaintext-leaking upload payloads', () => {
    expect(validateEnvelopeForUpload(goodEnvelope)).toEqual({
      accepted: true,
      reasons: [],
      ciphertextOnly: true,
    });

    const leakingEnvelope = {
      ...goodEnvelope,
      id: 'env_plaintext',
      idempotencyKey: 'idempotency_plaintext',
      serviceMetadata: { ...metadata, merchantName: 'Plaintext Cafe', amountMinor: 1299 },
    };

    expect(validateEnvelopeForUpload(leakingEnvelope)).toMatchObject({
      accepted: false,
      ciphertextOnly: false,
    });
  });

  it('enforces append-only idempotent outbox and safe inbox rejection', () => {
    const outbox = buildEncryptedOutboxState([goodEnvelope, secondEnvelope]);
    expect(outbox).toMatchObject({
      appendOnly: true,
      idempotencyKeysUnique: true,
      backendPayloadCiphertextOnly: true,
      uploadContractAccepted: true,
    });

    const inbox = applyEncryptedInboxBatch({
      candidates: [
        goodEnvelope,
        { ...secondEnvelope, id: 'env_duplicate', idempotencyKey: 'idempotency_env_001' },
        { ...secondEnvelope, id: 'env_malformed', schemaVersion: 2 },
      ],
      seenIdempotencyKeys: [],
    });

    expect(inbox).toMatchObject({
      acceptedCount: 1,
      rejectedCount: 2,
      duplicateCount: 1,
      malformedCount: 1,
    });
  });
});

describe('account, recovery and key separation', () => {
  it('keeps optional account auth separate from local vault and vault recovery', () => {
    const account = evaluateOptionalAccount({
      localCoreAvailableSignedOut: true,
      cloudFeatureSelected: true,
      accountRequiredForLocalUse: false,
      accountRequiredForCloudUse: true,
      configuredProviders: ['passkey'],
      webAccountDeletionRouteAvailable: false,
    });

    expect(account.localVaultUsableSignedOut).toBe(true);
    expect(account.accountOnlyWhenCloudSelected).toBe(true);
    expect(account.releaseBlocked).toBe(true);
    expect(account.blockers).toContain('passkey, Apple and Google providers are not all wired');
  });

  it('blocks release until key wrapping and qualified crypto review exist', () => {
    const hierarchy = evaluateKeyHierarchy({
      randomMasterKey: true,
      workspaceSubkeys: true,
      documentSubkeys: true,
      syncEnvelopeSubkey: true,
      platformWrappingProven: false,
      recoveryWrappingDesigned: true,
      cryptoReviewSigned: false,
    });

    expect(hierarchy.serverReceivesUnwrappedKey).toBe(false);
    expect(hierarchy.releaseBlocked).toBe(true);
    expect(hierarchy.blockers).toContain('Keychain/Keystore wrapping proof is missing');
    expect(hierarchy.blockers).toContain('qualified cryptographic review is not signed');
  });

  it('requires recovery methods, zero-knowledge copy and clean-device restore proof', () => {
    const recovery = evaluateRecoverySetup({
      selectedMethods: ['recovery_code', 'trusted_recovery_device'],
      zeroKnowledgeTradeoffAccepted: true,
      verifyRecoveryAvailable: true,
      cleanDeviceRestoreTested: false,
      secretMaterialRendered: false,
    });

    expect(recovery.methodCount).toBe(2);
    expect(recovery.releaseBlocked).toBe(true);
    expect(recovery.blockers).toEqual(['clean-device restore test has not passed']);
  });
});

describe('device registry, snapshots and compaction', () => {
  it('models device registration while keeping lost-device drills as release blockers', () => {
    const registry = evaluateDeviceRegistry({
      devices: activeDevices,
      cloudRegistryBackendConfigured: false,
      lostDeviceRevocationTested: false,
      keyRotationAfterRevokeTested: false,
    });

    expect(registry.activeDeviceCount).toBe(1);
    expect(registry.revokedDeviceCount).toBe(1);
    expect(registry.releaseBlocked).toBe(true);
  });

  it('requires two validated encrypted snapshot generations and exact replay restore', () => {
    const snapshots: readonly SnapshotGeneration[] = [
      {
        id: 'snapshot_1',
        sequence: 5,
        encrypted: true,
        hashValidated: true,
        decryptabilityChecked: true,
        generationIndex: 1,
      },
      {
        id: 'snapshot_2',
        sequence: 9,
        encrypted: true,
        hashValidated: true,
        decryptabilityChecked: true,
        generationIndex: 2,
      },
    ];

    const state = evaluateEncryptedSnapshots({
      snapshots,
      atomicBeforeMigration: true,
      restoreReplayExact: false,
      portableExportAvailable: true,
      platformBackupSoleDependency: false,
    });

    expect(state.generationCount).toBe(2);
    expect(state.releaseBlocked).toBe(true);
    expect(state.blockers).toEqual(['snapshot plus operation replay restore has not passed']);
  });

  it('does not compact operations needed by an active device', () => {
    const state = evaluateCompactionCursors({
      activeDevices,
      requestedSafeSequence: 10,
    });

    expect(state.canCompact).toBe(false);
    expect(state.blockedDeviceIds).toEqual(['device_a']);
  });
});

describe('conflict policy and cloud inventory', () => {
  it('uses deterministic reviewable policies instead of universal last-write-wins', () => {
    const cases: readonly ConflictCase[] = [
      { id: 'txn_conflict', kind: 'posted_transaction', overlappingFields: ['amountMinor'] },
      { id: 'plan_conflict', kind: 'plan', overlappingFields: ['targetDate'] },
      { id: 'task_conflict', kind: 'task', overlappingFields: ['completedAt'] },
      {
        id: 'workspace_conflict',
        kind: 'workspace_assignment',
        overlappingFields: ['workspaceId'],
      },
    ];
    const state = buildConflictPolicyState(cases);

    expect(resolveConflict(cases[0]!)).toMatchObject({
      strategy: 'preserve both and route duplicate/reversal review',
      reviewRequired: true,
      noSilentLastWriteFinancialLoss: true,
    });
    expect(state.noUniversalLastWriteWins).toBe(true);
    expect(state.noSilentFinancialLoss).toBe(true);
    expect(state.rows).toHaveLength(cases.length);
  });

  it('reports cloud inventory without financial plaintext and preserves local vault on disable', () => {
    const inventory = buildCloudDataInventory({
      lastBackupIso: null,
      disableCloudKeepsLocalVault: true,
      items: [
        {
          payloadType: 'operation envelope',
          location: 'cloud_ciphertext',
          encrypted: true,
          deletionAvailable: true,
          processorRole: 'processor',
          containsFinancialPlaintext: false,
        },
        {
          payloadType: 'device public key',
          location: 'provider_metadata',
          encrypted: false,
          deletionAvailable: true,
          processorRole: 'processor',
          containsFinancialPlaintext: false,
        },
      ],
    });

    expect(inventory.cloudCiphertextOnly).toBe(true);
    expect(inventory.disableCloudKeepsLocalVault).toBe(true);
  });
});

describe('Phase 10 coverage and beta gate', () => {
  it('keeps real cloud, deletion, conflict suite and pen-test blockers visible', () => {
    const account = evaluateOptionalAccount({
      localCoreAvailableSignedOut: true,
      cloudFeatureSelected: true,
      accountRequiredForLocalUse: false,
      accountRequiredForCloudUse: true,
      configuredProviders: ['passkey', 'apple', 'google'],
      webAccountDeletionRouteAvailable: false,
    });
    const keyHierarchy = evaluateKeyHierarchy({
      randomMasterKey: true,
      workspaceSubkeys: true,
      documentSubkeys: true,
      syncEnvelopeSubkey: true,
      platformWrappingProven: false,
      recoveryWrappingDesigned: true,
      cryptoReviewSigned: false,
    });
    const recovery = evaluateRecoverySetup({
      selectedMethods: ['recovery_code'],
      zeroKnowledgeTradeoffAccepted: true,
      verifyRecoveryAvailable: true,
      cleanDeviceRestoreTested: false,
      secretMaterialRendered: false,
    });
    const deviceRegistry = evaluateDeviceRegistry({
      devices: activeDevices,
      cloudRegistryBackendConfigured: false,
      lostDeviceRevocationTested: false,
      keyRotationAfterRevokeTested: false,
    });
    const outbox = buildEncryptedOutboxState([goodEnvelope, secondEnvelope]);
    const inbox = applyEncryptedInboxBatch({
      candidates: [
        goodEnvelope,
        { ...secondEnvelope, id: 'env_duplicate', idempotencyKey: 'idempotency_env_001' },
      ],
      seenIdempotencyKeys: [],
    });
    const conflicts = buildConflictPolicyState([
      { id: 'txn_conflict', kind: 'posted_transaction', overlappingFields: ['amountMinor'] },
      { id: 'delete_conflict', kind: 'delete', overlappingFields: ['deletedAt'] },
    ]);
    const backups = evaluateEncryptedSnapshots({
      snapshots: [],
      atomicBeforeMigration: true,
      restoreReplayExact: false,
      portableExportAvailable: true,
      platformBackupSoleDependency: false,
    });
    const compaction = evaluateCompactionCursors({
      activeDevices,
      requestedSafeSequence: 10,
    });
    const managerUi = evaluateDeviceRecoveryManagerUi({
      devices: activeDevices,
      secretsRendered: false,
      revokeControlAccessible: true,
      renameControlAccessible: true,
      verifyRecoveryAvailable: true,
      minimumHitTargetDp: 48,
      reducedMotionCopyAvailable: true,
    });
    const deletionPortal = evaluateAccountDeletionPortal({
      webRouteConfigured: false,
      inAppEntrypointConfigured: true,
      tokenRevocationTested: false,
      reversibleGracePeriodDocumented: true,
      localVaultPreservedOnCloudDelete: true,
      purgeSchedulePublished: false,
    });
    const inventory = buildCloudDataInventory({
      items: [],
      lastBackupIso: null,
      disableCloudKeepsLocalVault: true,
    });
    const conflictSuite = evaluateMultiDeviceConflictSuite([
      { id: 'offline_plan_merge', status: 'passed', silentLastWriteFinancialLoss: false },
      { id: 'lost_device_revoke', status: 'blocked', silentLastWriteFinancialLoss: false },
    ]);
    const securityReview = evaluateCloudSecurityReview(false, [
      { id: 'finding_1', severity: 'high', status: 'open' },
    ]);
    const beta = evaluateEncryptedBackupSyncBeta({
      account,
      keyHierarchy,
      recovery,
      deviceRegistry,
      backups,
      deletionPortal,
      conflictSuite,
      securityReview,
      supportRunbookReady: false,
      restoreTelemetryReady: false,
      stagedRolloutPlanReady: false,
    });

    const coverageRows = buildPhase10CoverageRows({
      account,
      keyHierarchy,
      recovery,
      deviceRegistry,
      outbox,
      inbox,
      conflicts,
      backups,
      compaction,
      managerUi,
      deletionPortal,
      inventory,
      conflictSuite,
      securityReview,
      beta,
    });

    expect(coverageRows).toHaveLength(15);
    expect(coverageRows.find((row) => row.taskId === 'T138')).toMatchObject({
      state: 'implemented',
    });
    expect(coverageRows.find((row) => row.taskId === 'T147')).toMatchObject({
      state: 'blocked',
      blocker: 'independent auth/sync/cloud pen-test is missing',
    });
    expect(beta.ready).toBe(false);
    expect(beta.blockers).toContain('support runbook is not ready');
  });
});
