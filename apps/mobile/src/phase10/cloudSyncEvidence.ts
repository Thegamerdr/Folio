import {
  applyEncryptedInboxBatch,
  buildCloudDataInventory,
  buildConflictPolicyState,
  buildEncryptedOutboxState,
  buildPhase10CoverageRows,
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
  syncBoundary,
  type CloudDataInventoryItem,
  type CloudEnvelopeMetadata,
  type CloudReadinessState,
  type CloudVisibleEnvelopeCandidate,
  type ConflictCase,
  type DeviceRecoveryManagerState,
  type EvidenceRow,
  type Phase10CoverageRow,
  type RegisteredDevice,
  type SnapshotGeneration,
} from '@folio/sync';

export type Phase10Source = Readonly<{
  kind: 'synthetic';
  label: 'Synthetic sample';
  description: string;
}>;

export type Phase10EvidenceArea =
  | 'optional_account'
  | 'key_hierarchy'
  | 'recovery'
  | 'device_registry'
  | 'encrypted_outbox'
  | 'inbox_apply'
  | 'conflict_policy'
  | 'snapshots'
  | 'compaction'
  | 'device_recovery_manager'
  | 'account_deletion'
  | 'cloud_inventory'
  | 'multi_device_suite'
  | 'security_review'
  | 'beta_gate';

export type Phase10GateMetadata = Readonly<{
  phase: 'phase10';
  slice: 'cloud-account-encrypted-backup-sync';
  sourceLabel: 'Synthetic sample';
  modelRequired: false;
  networkRequiredForShell: false;
  cloudRequiredForLocalCore: false;
  accountRequiredForLocalCore: false;
  realCloudConnected: false;
  realAccountSession: false;
  realData: false;
  serverBlindRestoreProven: false;
  passkeyProviderConnected: false;
  appleProviderConnected: false;
  googleProviderConnected: false;
  externalDeletionRouteLive: false;
  independentPenTestPassed: false;
  encryptedBackupSyncBetaReady: false;
  evidenceAreas: readonly Phase10EvidenceArea[];
}>;

export type Phase10ProofRow = Readonly<{
  label: string;
  value: string;
  state: CloudReadinessState;
}>;

export type Phase10BlockerRow = Readonly<{
  label: string;
  value: string;
  source: Phase10Source;
}>;

export type Phase10HuashuReview = Readonly<{
  score: number;
  rows: readonly EvidenceRow[];
  criticalIssuesFixed: readonly string[];
  remainingNotes: readonly string[];
}>;

export type Phase10CloudSyncEvidence = Readonly<{
  metadata: Phase10GateMetadata;
  source: Phase10Source;
  devices: readonly RegisteredDevice[];
  envelopes: readonly CloudVisibleEnvelopeCandidate[];
  snapshots: readonly SnapshotGeneration[];
  inventoryItems: readonly CloudDataInventoryItem[];
  account: ReturnType<typeof evaluateOptionalAccount>;
  keyHierarchy: ReturnType<typeof evaluateKeyHierarchy>;
  recovery: ReturnType<typeof evaluateRecoverySetup>;
  deviceRegistry: ReturnType<typeof evaluateDeviceRegistry>;
  outbox: ReturnType<typeof buildEncryptedOutboxState>;
  inbox: ReturnType<typeof applyEncryptedInboxBatch>;
  conflicts: ReturnType<typeof buildConflictPolicyState>;
  backups: ReturnType<typeof evaluateEncryptedSnapshots>;
  compaction: ReturnType<typeof evaluateCompactionCursors>;
  managerUi: DeviceRecoveryManagerState;
  deletionPortal: ReturnType<typeof evaluateAccountDeletionPortal>;
  inventory: ReturnType<typeof buildCloudDataInventory>;
  conflictSuite: ReturnType<typeof evaluateMultiDeviceConflictSuite>;
  securityReview: ReturnType<typeof evaluateCloudSecurityReview>;
  beta: ReturnType<typeof evaluateEncryptedBackupSyncBeta>;
  coverageRows: readonly Phase10CoverageRow[];
  proofRows: readonly Phase10ProofRow[];
  blockerRows: readonly Phase10BlockerRow[];
  huashuReview: Phase10HuashuReview;
}>;

const syntheticSource: Phase10Source = {
  kind: 'synthetic',
  label: 'Synthetic sample',
  description:
    'Phase 10 mobile shell evidence uses fictional status rows only; it performs no account sign-in, cloud request, network write, vault decrypt, secret rendering or model operation.',
};

const serviceMetadata: CloudEnvelopeMetadata = {
  accountId: 'acct_demo_cloud_beta',
  deviceId: 'device_android_demo',
  encryptedBlobId: 'blob_env_001',
  sequence: 1,
  sizeBytes: 128,
  createdAtIso: '2026-06-21T10:00:00.000Z',
  consentState: 'sync_enabled',
  entitlement: 'cloud_beta',
};

const devices: readonly RegisteredDevice[] = [
  {
    id: 'device_android_demo',
    label: 'Android development phone',
    active: true,
    registered: true,
    publicKeyFingerprint: 'sha256:android-demo-public-key',
    acknowledgedSequence: 8,
  },
  {
    id: 'device_lost_demo',
    label: 'Lost phone simulation',
    active: false,
    registered: true,
    publicKeyFingerprint: 'sha256:lost-demo-public-key',
    acknowledgedSequence: 4,
    revokedAtIso: '2026-06-21T11:00:00.000Z',
  },
];

const envelopes: readonly CloudVisibleEnvelopeCandidate[] = [
  {
    id: 'env_demo_001',
    workspaceId: 'workspace_personal_demo',
    deviceId: 'device_android_demo',
    sequence: 1,
    schemaVersion: 1,
    idempotencyKey: 'env_demo_001_once',
    ciphertext: new Uint8Array([17, 42, 71, 101]),
    createdAtIso: '2026-06-21T10:00:00.000Z',
    serviceMetadata,
  },
  {
    id: 'env_demo_002',
    workspaceId: 'workspace_personal_demo',
    deviceId: 'device_android_demo',
    sequence: 2,
    schemaVersion: 1,
    idempotencyKey: 'env_demo_002_once',
    ciphertext: new Uint8Array([18, 43, 72, 102]),
    createdAtIso: '2026-06-21T10:01:00.000Z',
    serviceMetadata: { ...serviceMetadata, encryptedBlobId: 'blob_env_002', sequence: 2 },
  },
];

const inboxCandidates: readonly CloudVisibleEnvelopeCandidate[] = [
  envelopes[0]!,
  {
    ...envelopes[1]!,
    id: 'env_demo_duplicate',
    idempotencyKey: 'env_demo_001_once',
  },
  {
    ...envelopes[1]!,
    id: 'env_demo_malformed',
    schemaVersion: 2,
    idempotencyKey: 'env_demo_malformed_once',
  },
];

const conflictCases: readonly ConflictCase[] = [
  { id: 'posted_transaction_conflict', kind: 'posted_transaction', overlappingFields: ['amount'] },
  { id: 'plan_date_conflict', kind: 'plan', overlappingFields: ['targetDate'] },
  { id: 'rule_amount_conflict', kind: 'rule', overlappingFields: ['amount'] },
  { id: 'task_completion_conflict', kind: 'task', overlappingFields: ['completedAt'] },
  {
    id: 'workspace_move_conflict',
    kind: 'workspace_assignment',
    overlappingFields: ['workspaceId'],
  },
  { id: 'delete_conflict', kind: 'delete', overlappingFields: ['deletedAt'] },
];

const snapshots: readonly SnapshotGeneration[] = [
  {
    id: 'snapshot_generation_1',
    sequence: 4,
    encrypted: true,
    hashValidated: true,
    decryptabilityChecked: true,
    generationIndex: 1,
  },
  {
    id: 'snapshot_generation_2',
    sequence: 8,
    encrypted: true,
    hashValidated: true,
    decryptabilityChecked: true,
    generationIndex: 2,
  },
];

const inventoryItems: readonly CloudDataInventoryItem[] = [
  {
    payloadType: 'operation envelope',
    location: 'cloud_ciphertext',
    encrypted: true,
    deletionAvailable: true,
    processorRole: 'processor',
    containsFinancialPlaintext: false,
  },
  {
    payloadType: 'encrypted snapshot',
    location: 'cloud_ciphertext',
    encrypted: true,
    deletionAvailable: true,
    processorRole: 'processor',
    containsFinancialPlaintext: false,
  },
  {
    payloadType: 'wrapped recovery metadata',
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
];

export const defaultPhase10CloudSyncEvidence = buildPhase10CloudSyncEvidence();

export const phase10ProofRows: readonly Phase10ProofRow[] =
  defaultPhase10CloudSyncEvidence.proofRows;

export function buildPhase10CloudSyncEvidence(): Phase10CloudSyncEvidence {
  const account = evaluateOptionalAccount({
    localCoreAvailableSignedOut: true,
    cloudFeatureSelected: true,
    accountRequiredForLocalUse: false,
    accountRequiredForCloudUse: true,
    configuredProviders: ['passkey'],
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
    selectedMethods: ['recovery_code', 'trusted_recovery_device'],
    zeroKnowledgeTradeoffAccepted: true,
    verifyRecoveryAvailable: true,
    cleanDeviceRestoreTested: false,
    secretMaterialRendered: false,
  });
  const deviceRegistry = evaluateDeviceRegistry({
    devices,
    cloudRegistryBackendConfigured: false,
    lostDeviceRevocationTested: false,
    keyRotationAfterRevokeTested: false,
  });
  const outbox = buildEncryptedOutboxState(envelopes);
  const inbox = applyEncryptedInboxBatch({
    candidates: inboxCandidates,
    seenIdempotencyKeys: [],
  });
  const conflicts = buildConflictPolicyState(conflictCases);
  const backups = evaluateEncryptedSnapshots({
    snapshots,
    atomicBeforeMigration: true,
    restoreReplayExact: false,
    portableExportAvailable: true,
    platformBackupSoleDependency: false,
  });
  const compaction = evaluateCompactionCursors({
    activeDevices: devices,
    requestedSafeSequence: 8,
  });
  const managerUi = evaluateDeviceRecoveryManagerUi({
    devices,
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
    items: inventoryItems,
    lastBackupIso: null,
    disableCloudKeepsLocalVault: true,
  });
  const conflictSuite = evaluateMultiDeviceConflictSuite([
    { id: 'offline_edit_merge', status: 'passed', silentLastWriteFinancialLoss: false },
    {
      id: 'encrypted_restore_clean_device',
      status: 'blocked',
      silentLastWriteFinancialLoss: false,
    },
    { id: 'lost_device_revoke_rotate', status: 'blocked', silentLastWriteFinancialLoss: false },
  ]);
  const securityReview = evaluateCloudSecurityReview(false, [
    { id: 'cloud-sync-architecture-review', severity: 'high', status: 'open' },
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

  return {
    metadata: {
      phase: 'phase10',
      slice: 'cloud-account-encrypted-backup-sync',
      sourceLabel: syntheticSource.label,
      modelRequired: syncBoundary.modelRequired,
      networkRequiredForShell: syncBoundary.networkRequired,
      cloudRequiredForLocalCore: false,
      accountRequiredForLocalCore: false,
      realCloudConnected: false,
      realAccountSession: false,
      realData: false,
      serverBlindRestoreProven: false,
      passkeyProviderConnected: false,
      appleProviderConnected: false,
      googleProviderConnected: false,
      externalDeletionRouteLive: false,
      independentPenTestPassed: false,
      encryptedBackupSyncBetaReady: false,
      evidenceAreas: [
        'optional_account',
        'key_hierarchy',
        'recovery',
        'device_registry',
        'encrypted_outbox',
        'inbox_apply',
        'conflict_policy',
        'snapshots',
        'compaction',
        'device_recovery_manager',
        'account_deletion',
        'cloud_inventory',
        'multi_device_suite',
        'security_review',
        'beta_gate',
      ],
    },
    source: syntheticSource,
    devices,
    envelopes,
    snapshots,
    inventoryItems,
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
    coverageRows,
    proofRows: coverageRows.map((row) => ({
      label: `${row.taskId} ${row.label}`,
      value: formatCoverageValue(row),
      state: row.state,
    })),
    blockerRows: beta.blockers.slice(0, 12).map((blocker) => ({
      label: 'Cloud beta blocker',
      value: blocker,
      source: syntheticSource,
    })),
    huashuReview: {
      score: 8.2,
      rows: [
        {
          label: 'Function',
          value: 'cloud opt-in and release blockers are visible before any status claim',
          state: 'implemented',
        },
        {
          label: 'Hierarchy',
          value: 'local-vault safety appears before cloud convenience',
          state: 'implemented',
        },
        {
          label: 'Craft',
          value: '48dp manager controls, plain rows and no secret material',
          state: 'implemented',
        },
        {
          label: 'Anti slop',
          value: 'no fake synced state, no decorative security theater, no invented stats',
          state: 'implemented',
        },
        {
          label: 'Remaining review',
          value: 'manual TalkBack and real provider screens still required',
          state: 'blocked',
        },
      ],
      criticalIssuesFixed: [
        'Avoided green success badge for cloud sync while no real server is connected.',
        'Kept recovery methods visible but never displayed recovery secret material.',
        'Placed account deletion and external pen-test blockers in the same flow as setup.',
      ],
      remainingNotes: [
        'Real provider screens must repeat this hierarchy after passkey, Apple and Google wiring.',
        'Manual screen-reader review is still required because this shell is synthetic.',
      ],
    },
  };
}

export function phase10RowsByState<Row extends EvidenceRow | Phase10CoverageRow>(
  rows: readonly Row[],
  state: Row['state'],
): readonly Row[] {
  return rows.filter((row) => row.state === state);
}

function formatCoverageValue(row: Phase10CoverageRow): string {
  return row.blocker ? `${row.evidence}; blocker: ${row.blocker}` : row.evidence;
}
