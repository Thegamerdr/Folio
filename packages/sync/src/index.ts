export { canonicalSyncRequestMessage } from './signedRequest.js';
export type { CloudSyncRequestSigner, SyncRequestSignature } from './signedRequest.js';
import type { CloudSyncRequestSigner } from './signedRequest.js';

export const syncBoundary = {
  packageName: '@folio/sync',
  modelRequired: false,
  networkRequired: false,
  writesDirectlyToStorage: false,
  importsCloudSdk: false,
  importsNativeModules: false,
} as const;

export type CloudReadinessState = 'implemented' | 'passed' | 'needs_review' | 'blocked';

export type EvidenceRow = Readonly<{
  label: string;
  value: string;
  state: CloudReadinessState;
}>;

export type Phase10TaskId =
  | 'T134'
  | 'T135'
  | 'T136'
  | 'T137'
  | 'T138'
  | 'T139'
  | 'T140'
  | 'T141'
  | 'T142'
  | 'T143'
  | 'T144'
  | 'T145'
  | 'T146'
  | 'T147'
  | 'T148';

export type Phase10CoverageRow = Readonly<{
  taskId: Phase10TaskId;
  label: string;
  state: CloudReadinessState;
  evidence: string;
  blocker?: string;
}>;

export type CloudConsentState = 'cloud_disabled' | 'backup_enabled' | 'sync_enabled';
export type CloudEntitlement = 'local' | 'cloud_beta' | 'cloud_pro';

export type CloudEnvelopeMetadata = Readonly<{
  accountId: string;
  deviceId: string;
  encryptedBlobId: string;
  sequence: number;
  sizeBytes: number;
  createdAtIso: string;
  consentState: CloudConsentState;
  entitlement: CloudEntitlement;
  expiresAtIso?: string;
}>;

export interface EncryptedSyncEnvelope {
  readonly id: string;
  readonly workspaceId: string;
  readonly deviceId: string;
  readonly sequence: number;
  readonly schemaVersion: 1;
  readonly idempotencyKey: string;
  readonly ciphertext: Uint8Array;
  readonly createdAtIso: string;
  readonly serviceMetadata: CloudEnvelopeMetadata;
  readonly previousEnvelopeId?: string;
}

export type CloudVisibleEnvelopeCandidate = Readonly<{
  id: string;
  workspaceId: string;
  deviceId: string;
  sequence: number;
  schemaVersion: number;
  idempotencyKey: string;
  ciphertext: Uint8Array;
  createdAtIso: string;
  serviceMetadata: Readonly<Record<string, unknown>>;
}>;

export type EnvelopeValidationResult = Readonly<{
  accepted: boolean;
  reasons: readonly string[];
  ciphertextOnly: boolean;
}>;

export type CreateEnvelopeInput = Readonly<{
  id: string;
  workspaceId: string;
  deviceId: string;
  sequence: number;
  idempotencyKey: string;
  ciphertext: Uint8Array | readonly number[];
  createdAtIso: string;
  serviceMetadata: CloudEnvelopeMetadata;
  previousEnvelopeId?: string;
}>;

export type AuthProvider = 'passkey' | 'apple' | 'google';

export type OptionalAccountInput = Readonly<{
  localCoreAvailableSignedOut: boolean;
  cloudFeatureSelected: boolean;
  accountRequiredForLocalUse: boolean;
  accountRequiredForCloudUse: boolean;
  configuredProviders: readonly AuthProvider[];
  webAccountDeletionRouteAvailable: boolean;
}>;

export type OptionalAccountState = Readonly<{
  localVaultUsableSignedOut: boolean;
  accountOnlyWhenCloudSelected: boolean;
  providerRows: readonly EvidenceRow[];
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type KeyHierarchyInput = Readonly<{
  randomMasterKey: boolean;
  workspaceSubkeys: boolean;
  documentSubkeys: boolean;
  syncEnvelopeSubkey: boolean;
  platformWrappingProven: boolean;
  recoveryWrappingDesigned: boolean;
  cryptoReviewSigned: boolean;
}>;

export type KeyHierarchyState = Readonly<{
  serverReceivesUnwrappedKey: false;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type RecoveryMethod =
  | 'device_to_device'
  | 'recovery_code'
  | 'recovery_passphrase'
  | 'trusted_recovery_device';

export type RecoverySetupInput = Readonly<{
  selectedMethods: readonly RecoveryMethod[];
  zeroKnowledgeTradeoffAccepted: boolean;
  verifyRecoveryAvailable: boolean;
  cleanDeviceRestoreTested: boolean;
  secretMaterialRendered: boolean;
}>;

export type RecoverySetupState = Readonly<{
  methodCount: number;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type RegisteredDevice = Readonly<{
  id: string;
  label: string;
  active: boolean;
  registered: boolean;
  publicKeyFingerprint: string;
  acknowledgedSequence: number;
  revokedAtIso?: string;
}>;

export type DeviceRegistryInput = Readonly<{
  devices: readonly RegisteredDevice[];
  cloudRegistryBackendConfigured: boolean;
  lostDeviceRevocationTested: boolean;
  keyRotationAfterRevokeTested: boolean;
}>;

export type DeviceRegistryState = Readonly<{
  activeDeviceCount: number;
  revokedDeviceCount: number;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type EncryptedOutboxState = Readonly<{
  envelopeCount: number;
  appendOnly: boolean;
  idempotencyKeysUnique: boolean;
  backendPayloadCiphertextOnly: boolean;
  uploadContractAccepted: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type InboxApplyInput = Readonly<{
  candidates: readonly CloudVisibleEnvelopeCandidate[];
  seenIdempotencyKeys: readonly string[];
}>;

export type InboxApplyState = Readonly<{
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  malformedCount: number;
  rows: readonly EvidenceRow[];
}>;

export type ConflictEntityKind =
  | 'posted_transaction'
  | 'plan'
  | 'rule'
  | 'task'
  | 'workspace_assignment'
  | 'document'
  | 'delete';

export type ConflictCase = Readonly<{
  id: string;
  kind: ConflictEntityKind;
  overlappingFields: readonly string[];
}>;

export type ConflictResolution = Readonly<{
  caseId: string;
  kind: ConflictEntityKind;
  strategy: string;
  reviewRequired: boolean;
  noSilentLastWriteFinancialLoss: boolean;
}>;

export type ConflictPolicyState = Readonly<{
  deterministic: boolean;
  reviewable: boolean;
  noUniversalLastWriteWins: boolean;
  noSilentFinancialLoss: boolean;
  resolutions: readonly ConflictResolution[];
  rows: readonly EvidenceRow[];
}>;

export type SnapshotGeneration = Readonly<{
  id: string;
  sequence: number;
  encrypted: boolean;
  hashValidated: boolean;
  decryptabilityChecked: boolean;
  generationIndex: number;
}>;

export type SnapshotBackupInput = Readonly<{
  snapshots: readonly SnapshotGeneration[];
  atomicBeforeMigration: boolean;
  restoreReplayExact: boolean;
  portableExportAvailable: boolean;
  platformBackupSoleDependency: boolean;
}>;

export type SnapshotBackupState = Readonly<{
  generationCount: number;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type CompactionCursorInput = Readonly<{
  activeDevices: readonly RegisteredDevice[];
  requestedSafeSequence: number;
}>;

export type CompactionCursorState = Readonly<{
  canCompact: boolean;
  minimumActiveAck: number;
  requestedSafeSequence: number;
  blockedDeviceIds: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type DeviceRecoveryManagerInput = Readonly<{
  devices: readonly RegisteredDevice[];
  secretsRendered: boolean;
  revokeControlAccessible: boolean;
  renameControlAccessible: boolean;
  verifyRecoveryAvailable: boolean;
  minimumHitTargetDp: number;
  reducedMotionCopyAvailable: boolean;
}>;

export type DeviceRecoveryManagerState = Readonly<{
  noSecretExposure: boolean;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type AccountDeletionPortalInput = Readonly<{
  webRouteConfigured: boolean;
  inAppEntrypointConfigured: boolean;
  tokenRevocationTested: boolean;
  reversibleGracePeriodDocumented: boolean;
  localVaultPreservedOnCloudDelete: boolean;
  purgeSchedulePublished: boolean;
}>;

export type AccountDeletionPortalState = Readonly<{
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type CloudDataInventoryItem = Readonly<{
  payloadType: string;
  location: 'device' | 'cloud_ciphertext' | 'provider_metadata';
  encrypted: boolean;
  deletionAvailable: boolean;
  processorRole: 'controller' | 'processor' | 'not_applicable';
  containsFinancialPlaintext: boolean;
}>;

export type CloudDataInventoryInput = Readonly<{
  items: readonly CloudDataInventoryItem[];
  lastBackupIso: string | null;
  disableCloudKeepsLocalVault: boolean;
}>;

export type CloudDataInventoryState = Readonly<{
  itemCount: number;
  cloudCiphertextOnly: boolean;
  disableCloudKeepsLocalVault: boolean;
  rows: readonly EvidenceRow[];
}>;

export type MultiDeviceConflictScenario = Readonly<{
  id: string;
  status: 'passed' | 'blocked' | 'failed';
  silentLastWriteFinancialLoss: boolean;
}>;

export type MultiDeviceConflictSuiteState = Readonly<{
  scenarioCount: number;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type SecurityFinding = Readonly<{
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'closed';
}>;

export type CloudSecurityReviewState = Readonly<{
  independentlyAssessed: boolean;
  highOrCriticalOpen: number;
  releaseBlocked: boolean;
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type EncryptedBackupSyncBetaState = Readonly<{
  ready: boolean;
  releaseTrack: 'not_started' | 'internal_dogfood' | 'opt_in_beta';
  blockers: readonly string[];
  rows: readonly EvidenceRow[];
}>;

export type Phase10CoverageInput = Readonly<{
  account: OptionalAccountState;
  keyHierarchy: KeyHierarchyState;
  recovery: RecoverySetupState;
  deviceRegistry: DeviceRegistryState;
  outbox: EncryptedOutboxState;
  inbox: InboxApplyState;
  conflicts: ConflictPolicyState;
  backups: SnapshotBackupState;
  compaction: CompactionCursorState;
  managerUi: DeviceRecoveryManagerState;
  deletionPortal: AccountDeletionPortalState;
  inventory: CloudDataInventoryState;
  conflictSuite: MultiDeviceConflictSuiteState;
  securityReview: CloudSecurityReviewState;
  beta: EncryptedBackupSyncBetaState;
}>;

export type CloudSyncDevice = Readonly<{
  deviceId: string;
  label: string;
  publicKey: string;
  publicKeyFingerprint: string;
  keyEpoch: number;
  wrappedSyncKey: string;
  registeredAt: string;
  lastSeenAt: string;
  acknowledgedCursor: number;
  lastDeviceSequence: number;
  lastRequestSequence: number;
  revokedAt?: string;
}>;

export type RegisterCloudSyncDeviceInput = Readonly<{
  deviceId: string;
  label: string;
  publicKey: string;
  publicKeyFingerprint: string;
  keyEpoch: number;
  /** Opaque client-produced key wrapping. The service cannot unwrap it. */
  wrappedSyncKey: string;
}>;

export type EncryptedOperationUpload = Readonly<{
  id: string;
  deviceId: string;
  deviceSequence: number;
  keyEpoch: number;
  idempotencyKey: string;
  createdAt: string;
  /** Base64-encoded client ciphertext. */
  ciphertext: string;
  ciphertextSha256: string;
}>;

export type CloudSyncOperation = EncryptedOperationUpload & Readonly<{ cursor: number }>;

export type CloudSyncSnapshotCheckpoint = Readonly<{
  id: string;
  cursor: number;
  keyEpoch: number;
  /** Checksum of the separately uploaded encrypted backup snapshot. */
  backupChecksum: string;
  createdAt: string;
  deviceId: string;
}>;

/** Device-local replay state. The exact AppState remains the source of truth; this metadata is
 * persisted beside that state in SQLCipher and never sent as a render-only snapshot. */
export type CloudSyncLocalState = Readonly<{
  version: 1;
  enabled: boolean;
  workspaceRef: string;
  baselineProjection: string;
  lastLocalProjection: string;
  cursor: number;
  nextSequence: number;
  keyEpoch: number;
  outbox: readonly Readonly<{
    id: string;
    deviceSequence: number;
    baseCursor: number;
    sealedDelta: string;
    entityGroup: string;
  }>[];
  /** Plaintext intent committed locally before its exact encrypted upload is made. */
  pendingDeltas: readonly Readonly<{
    id: string;
    deviceSequence: number;
    baseCursor: number;
    plaintext: string;
    entityGroup: string;
  }>[];
  partialGroups: readonly string[];
  conflicts: readonly string[];
}>;

export type CloudSyncOperationPage = Readonly<{
  operations: readonly CloudSyncOperation[];
  nextCursor: number;
  headCursor: number;
  hasMore: boolean;
}>;

export type CloudSyncApi = Readonly<{
  enrollmentStatus(publicKey: string): Promise<{
    status: 'new' | 'pending' | 'active' | 'revoked';
    device: CloudSyncDevice | null;
    currentKeyEpoch: number;
    headCursor: number;
    compactedThrough: number;
  }>;
  listDevices(): Promise<{
    devices: readonly CloudSyncDevice[];
    currentKeyEpoch: number;
    headCursor: number;
    compactedThrough: number;
  }>;
  registerDevice(input: RegisterCloudSyncDeviceInput): Promise<{ device: CloudSyncDevice }>;
  revokeDevice(
    deviceId: string,
    input: { newKeyEpoch: number; wrappedKeys: Readonly<Record<string, string>>;
      keyTransition: { fromKeyEpoch: number; toKeyEpoch: number; sealedKey: string } },
  ): Promise<{ revokedDeviceId: string; revokedAt: string; currentKeyEpoch: number }>;
  uploadOperation(input: EncryptedOperationUpload): Promise<{
    duplicate: boolean;
    cursor: number;
    headCursor: number;
  }>;
  downloadOperations(after: number, limit?: number): Promise<CloudSyncOperationPage>;
  acknowledge(cursor: number): Promise<{ acknowledgedCursor: number; headCursor: number }>;
  putSnapshot(
    input: CloudSyncSnapshotCheckpoint,
  ): Promise<{ snapshot: CloudSyncSnapshotCheckpoint }>;
  getSnapshot(): Promise<{ exists: boolean; snapshot: CloudSyncSnapshotCheckpoint | null }>;
  compact(throughCursor: number): Promise<{ compactedThrough: number; deletedCount: number }>;
  putKeyTransition(input: { fromKeyEpoch: number; toKeyEpoch: number; sealedKey: string }): Promise<{ ok: true }>;
  getKeyTransitions(afterEpoch?: number): Promise<{ transitions: readonly { fromKeyEpoch: number; toKeyEpoch: number; sealedKey: string }[]; hasMore: boolean; nextAfterEpoch: number }>;
}>;

export type CloudSyncApiInput = Readonly<{
  baseUrl: string;
  bearerToken: string;
  workspaceRef: string;
  deviceId: string;
  requestSigner?: CloudSyncRequestSigner;
  /** Includes signing and response consumption so queued proofs are fresh when sent. */
  serializeRequest?: <T>(work: () => Promise<T>) => Promise<T>;
  fetch: (
    url: string,
    init: Readonly<{ method: string; headers: Readonly<Record<string, string>>; body?: string }>,
  ) => Promise<Readonly<{ ok: boolean; status: number; json(): Promise<unknown> }>>;
}>;

const forbiddenServiceMetadataKeys = new Set([
  'merchant',
  'merchantName',
  'amount',
  'amountMinor',
  'category',
  'planTitle',
  'documentText',
  'calendarDetails',
  'accountName',
]);

export function createEncryptedSyncEnvelope(input: CreateEnvelopeInput): EncryptedSyncEnvelope {
  const envelope = {
    id: input.id,
    workspaceId: input.workspaceId,
    deviceId: input.deviceId,
    sequence: input.sequence,
    schemaVersion: 1 as const,
    idempotencyKey: input.idempotencyKey,
    ciphertext: new Uint8Array(input.ciphertext),
    createdAtIso: input.createdAtIso,
    serviceMetadata: input.serviceMetadata,
  };

  if (input.previousEnvelopeId) {
    return { ...envelope, previousEnvelopeId: input.previousEnvelopeId };
  }

  return envelope;
}

export function validateEnvelopeForUpload(
  candidate: CloudVisibleEnvelopeCandidate,
): EnvelopeValidationResult {
  const reasons: string[] = [];

  if (candidate.schemaVersion !== 1) {
    reasons.push('unsupported envelope schema version');
  }

  if (candidate.ciphertext.byteLength === 0) {
    reasons.push('ciphertext is empty');
  }

  if (!candidate.idempotencyKey) {
    reasons.push('missing idempotency key');
  }

  const metadataKeys = Object.keys(candidate.serviceMetadata);
  const forbiddenKeys = metadataKeys.filter((key) => forbiddenServiceMetadataKeys.has(key));

  if (forbiddenKeys.length > 0) {
    reasons.push(`service metadata contains plaintext fields: ${forbiddenKeys.join(', ')}`);
  }

  return {
    accepted: reasons.length === 0,
    reasons,
    ciphertextOnly: forbiddenKeys.length === 0,
  };
}

/**
 * Authenticated transport for the opaque cloud-sync API. Crypto and local replay remain caller
 * responsibilities, which keeps this package platform-neutral and prevents plaintext from entering
 * request construction accidentally.
 */
export function createCloudSyncApi(input: CloudSyncApiInput): CloudSyncApi {
  const baseUrl = normalizeHttpsOrigin(input.baseUrl);
  if (baseUrl === null) throw new Error('Cloud sync requires an HTTPS origin.');
  if (!/^[a-f0-9]{64}$/.test(input.workspaceRef)) {
    throw new Error('Cloud sync workspace reference is invalid.');
  }
  if (!/^[a-f0-9]{32}$/.test(input.deviceId)) {
    throw new Error('Cloud sync device identifier is invalid.');
  }
  if (input.bearerToken.trim().length === 0) throw new Error('Cloud sync requires authentication.');

  const performRequest = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const bodyText = body === undefined ? undefined : JSON.stringify(body);
    const signed =
      input.requestSigner === undefined
        ? undefined
        : await input.requestSigner.sign({ method, path, body: bodyText });
    const response = await input.fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${input.bearerToken}`,
        'Content-Type': 'application/json',
        'X-Melo-Workspace-Ref': input.workspaceRef,
        'X-Melo-Device': input.deviceId,
        ...(signed === undefined
          ? {}
          : {
              'X-Melo-Signature-Version': String(signed.version),
              'X-Melo-Signed-At': signed.signedAt,
              'X-Melo-Nonce': signed.nonce,
              'X-Melo-Request-Sequence': String(signed.requestSequence),
              'X-Melo-Body-Sha256': signed.bodySha256,
              'X-Melo-Signature': signed.signature,
            }),
      },
      ...(bodyText === undefined ? {} : { body: bodyText }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        payload !== null &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof payload.error === 'string'
          ? payload.error
          : `Cloud sync request failed (${response.status}).`;
      throw new Error(message);
    }
    return payload as T;
  };

  const request = <T>(method: string, path: string, body?: unknown): Promise<T> =>
    input.serializeRequest
      ? input.serializeRequest(() => performRequest<T>(method, path, body))
      : performRequest<T>(method, path, body);

  return {
    enrollmentStatus: (publicKey) => request('POST', '/v1/sync/enrollment', { deviceId: input.deviceId, publicKey }),
    listDevices: () => request('GET', '/v1/sync/devices'),
    registerDevice: (device) => request('POST', '/v1/sync/devices', device),
    revokeDevice: (deviceId, rotation) => {
      if (!/^[a-f0-9]{32}$/.test(deviceId))
        throw new Error('Cloud sync device identifier is invalid.');
      return request('POST', `/v1/sync/devices/${deviceId}/revoke`, rotation);
    },
    uploadOperation: (operation) => request('POST', '/v1/sync/operations', operation),
    downloadOperations: (after, limit = 100) => {
      assertCursor(after);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 250) {
        throw new Error('Cloud sync page size is invalid.');
      }
      return request('GET', `/v1/sync/operations?after=${after}&limit=${limit}`);
    },
    acknowledge: (cursor) => {
      assertCursor(cursor);
      return request('POST', '/v1/sync/acknowledgements', {
        deviceId: input.deviceId,
        cursor,
      });
    },
    putSnapshot: (snapshot) => request('PUT', '/v1/sync/snapshot', snapshot),
    getSnapshot: () => request('GET', '/v1/sync/snapshot'),
    compact: (throughCursor) => request('POST', '/v1/sync/compaction', { throughCursor }),
    putKeyTransition: (input) => request('POST', '/v1/sync/key-transitions', input),
    getKeyTransitions: (afterEpoch = 0) => request('GET', `/v1/sync/key-transitions?afterEpoch=${afterEpoch}`),
  };
}

function assertCursor(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Cloud sync cursor is invalid.');
}

function normalizeHttpsOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.search === '' &&
      url.hash === '' &&
      (url.pathname === '' || url.pathname === '/')
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export function evaluateOptionalAccount(input: OptionalAccountInput): OptionalAccountState {
  const localVaultUsableSignedOut =
    input.localCoreAvailableSignedOut && !input.accountRequiredForLocalUse;
  const accountOnlyWhenCloudSelected =
    !input.accountRequiredForLocalUse &&
    (!input.cloudFeatureSelected || input.accountRequiredForCloudUse);
  const requiredProviders: readonly AuthProvider[] = ['passkey', 'apple', 'google'];
  const providerRows = requiredProviders.map((provider) =>
    row(
      provider,
      input.configuredProviders.includes(provider) ? 'provider configured' : 'provider not wired',
      input.configuredProviders.includes(provider) ? 'implemented' : 'blocked',
    ),
  );
  const blockers = compact([
    localVaultUsableSignedOut ? '' : 'local vault must stay usable while signed out',
    accountOnlyWhenCloudSelected ? '' : 'account must only be required after cloud selection',
    providerRows.every((providerRow) => providerRow.state === 'implemented')
      ? ''
      : 'passkey, Apple and Google providers are not all wired',
    input.webAccountDeletionRouteAvailable ? '' : 'web account-deletion route is not configured',
  ]);

  return {
    localVaultUsableSignedOut,
    accountOnlyWhenCloudSelected,
    providerRows,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Signed-out local vault',
        boolText(localVaultUsableSignedOut),
        stateFor(localVaultUsableSignedOut),
      ),
      row(
        'Account only after cloud choice',
        boolText(accountOnlyWhenCloudSelected),
        stateFor(accountOnlyWhenCloudSelected),
      ),
      ...providerRows,
      row(
        'Web deletion route',
        boolText(input.webAccountDeletionRouteAvailable),
        stateFor(input.webAccountDeletionRouteAvailable),
      ),
    ],
  };
}

export function evaluateKeyHierarchy(input: KeyHierarchyInput): KeyHierarchyState {
  const blockers = compact([
    input.randomMasterKey ? '' : 'random 256-bit vault master key is not modelled',
    input.workspaceSubkeys ? '' : 'workspace subkeys are missing',
    input.documentSubkeys ? '' : 'document subkeys are missing',
    input.syncEnvelopeSubkey ? '' : 'sync envelope subkey is missing',
    input.platformWrappingProven ? '' : 'Keychain/Keystore wrapping proof is missing',
    input.recoveryWrappingDesigned ? '' : 'recovery wrapping design is missing',
    input.cryptoReviewSigned ? '' : 'qualified cryptographic review is not signed',
  ]);

  return {
    serverReceivesUnwrappedKey: false,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Vault master key', boolText(input.randomMasterKey), stateFor(input.randomMasterKey)),
      row('Workspace subkeys', boolText(input.workspaceSubkeys), stateFor(input.workspaceSubkeys)),
      row('Document subkeys', boolText(input.documentSubkeys), stateFor(input.documentSubkeys)),
      row(
        'Sync envelope subkey',
        boolText(input.syncEnvelopeSubkey),
        stateFor(input.syncEnvelopeSubkey),
      ),
      row('Server unwrapped key', 'never received', 'implemented'),
      row(
        'Platform wrapping proof',
        boolText(input.platformWrappingProven),
        stateFor(input.platformWrappingProven),
      ),
      row('Crypto review', boolText(input.cryptoReviewSigned), stateFor(input.cryptoReviewSigned)),
    ],
  };
}

export function evaluateRecoverySetup(input: RecoverySetupInput): RecoverySetupState {
  const blockers = compact([
    input.selectedMethods.length > 0 ? '' : 'at least one recovery method is required',
    input.zeroKnowledgeTradeoffAccepted
      ? ''
      : 'zero-knowledge recovery tradeoff acknowledgement is missing',
    input.verifyRecoveryAvailable ? '' : 'verify recovery ritual is missing',
    input.cleanDeviceRestoreTested ? '' : 'clean-device restore test has not passed',
    input.secretMaterialRendered ? 'recovery secret material must not be rendered after setup' : '',
  ]);

  return {
    methodCount: input.selectedMethods.length,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Recovery methods',
        input.selectedMethods.join(', ') || 'none',
        stateFor(input.selectedMethods.length > 0),
      ),
      row(
        'Zero-knowledge copy',
        boolText(input.zeroKnowledgeTradeoffAccepted),
        stateFor(input.zeroKnowledgeTradeoffAccepted),
      ),
      row(
        'Verify recovery',
        boolText(input.verifyRecoveryAvailable),
        stateFor(input.verifyRecoveryAvailable),
      ),
      row(
        'Clean-device restore',
        boolText(input.cleanDeviceRestoreTested),
        stateFor(input.cleanDeviceRestoreTested),
      ),
      row(
        'Secret exposure',
        input.secretMaterialRendered ? 'visible' : 'not rendered',
        input.secretMaterialRendered ? 'blocked' : 'implemented',
      ),
    ],
  };
}

export function evaluateDeviceRegistry(input: DeviceRegistryInput): DeviceRegistryState {
  const activeDeviceCount = input.devices.filter((device) => device.active).length;
  const revokedDeviceCount = input.devices.filter((device) => Boolean(device.revokedAtIso)).length;
  const blockers = compact([
    input.cloudRegistryBackendConfigured ? '' : 'cloud device registry backend is not configured',
    input.devices.every((device) => device.registered && device.publicKeyFingerprint)
      ? ''
      : 'every device must have a registration and public-key fingerprint',
    input.lostDeviceRevocationTested ? '' : 'lost-device revoke drill has not passed',
    input.keyRotationAfterRevokeTested ? '' : 'sync-key rotation after revoke is not proven',
  ]);

  return {
    activeDeviceCount,
    revokedDeviceCount,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row('Registered devices', String(input.devices.length), stateFor(input.devices.length > 0)),
      row('Active devices', String(activeDeviceCount), stateFor(activeDeviceCount > 0)),
      row(
        'Revoked devices',
        String(revokedDeviceCount),
        revokedDeviceCount > 0 ? 'implemented' : 'needs_review',
      ),
      row(
        'Cloud registry backend',
        boolText(input.cloudRegistryBackendConfigured),
        stateFor(input.cloudRegistryBackendConfigured),
      ),
      row(
        'Lost-device revoke drill',
        boolText(input.lostDeviceRevocationTested),
        stateFor(input.lostDeviceRevocationTested),
      ),
    ],
  };
}

export function buildEncryptedOutboxState(
  envelopes: readonly CloudVisibleEnvelopeCandidate[],
): EncryptedOutboxState {
  const validations = envelopes.map(validateEnvelopeForUpload);
  const appendOnly = envelopes.every(
    (envelope, index) => index === 0 || envelope.sequence > envelopes[index - 1]!.sequence,
  );
  const idempotencyKeysUnique =
    new Set(envelopes.map((envelope) => envelope.idempotencyKey)).size === envelopes.length;
  const backendPayloadCiphertextOnly = validations.every((validation) => validation.ciphertextOnly);
  const uploadContractAccepted =
    appendOnly && idempotencyKeysUnique && validations.every((validation) => validation.accepted);
  const blockers = compact([
    appendOnly ? '' : 'outbox sequence is not append-only',
    idempotencyKeysUnique ? '' : 'outbox idempotency keys are duplicated',
    backendPayloadCiphertextOnly ? '' : 'service-visible payload contains plaintext metadata',
    uploadContractAccepted ? '' : 'one or more envelopes are malformed',
  ]);

  return {
    envelopeCount: envelopes.length,
    appendOnly,
    idempotencyKeysUnique,
    backendPayloadCiphertextOnly,
    uploadContractAccepted,
    blockers,
    rows: [
      row('Envelope count', String(envelopes.length), stateFor(envelopes.length > 0)),
      row('Append-only order', boolText(appendOnly), stateFor(appendOnly)),
      row(
        'Idempotency keys',
        idempotencyKeysUnique ? 'unique' : 'duplicate',
        stateFor(idempotencyKeysUnique),
      ),
      row(
        'Backend payload',
        backendPayloadCiphertextOnly ? 'ciphertext plus minimal metadata' : 'contains plaintext',
        stateFor(backendPayloadCiphertextOnly),
      ),
    ],
  };
}

export function applyEncryptedInboxBatch(input: InboxApplyInput): InboxApplyState {
  const seen = new Set(input.seenIdempotencyKeys);
  let acceptedCount = 0;
  let duplicateCount = 0;
  let malformedCount = 0;
  const rows: EvidenceRow[] = [];

  for (const candidate of input.candidates) {
    const validation = validateEnvelopeForUpload(candidate);
    const duplicate = seen.has(candidate.idempotencyKey);

    if (duplicate) {
      duplicateCount += 1;
      rows.push(row(candidate.id, 'duplicate idempotency key rejected', 'passed'));
      continue;
    }

    if (!validation.accepted) {
      malformedCount += 1;
      rows.push(row(candidate.id, validation.reasons.join('; '), 'passed'));
      continue;
    }

    seen.add(candidate.idempotencyKey);
    acceptedCount += 1;
    rows.push(row(candidate.id, 'accepted for decrypt/validate/apply pipeline', 'implemented'));
  }

  return {
    acceptedCount,
    rejectedCount: duplicateCount + malformedCount,
    duplicateCount,
    malformedCount,
    rows,
  };
}

export function resolveConflict(conflictCase: ConflictCase): ConflictResolution {
  switch (conflictCase.kind) {
    case 'posted_transaction':
      return resolution(
        conflictCase,
        'preserve both and route duplicate/reversal review',
        true,
        true,
      );
    case 'plan':
      return conflictCase.overlappingFields.length > 0
        ? resolution(conflictCase, 'user review for overlapping plan fields', true, true)
        : resolution(conflictCase, 'merge non-overlapping plan fields', false, true);
    case 'rule':
      return resolution(conflictCase, 'review conflicting recurring rule edits', true, true);
    case 'task':
      return resolution(
        conflictCase,
        'monotonic completion unless explicitly reopened',
        false,
        true,
      );
    case 'workspace_assignment':
      return resolution(conflictCase, 'reject automatic cross-workspace merge', true, true);
    case 'document':
      return resolution(
        conflictCase,
        'preserve encrypted blob history and ask on conflict',
        true,
        true,
      );
    case 'delete':
      return resolution(
        conflictCase,
        'tombstone, grace period, then compact after ack',
        false,
        true,
      );
  }
}

export function buildConflictPolicyState(cases: readonly ConflictCase[]): ConflictPolicyState {
  const resolutions = cases.map(resolveConflict);
  const reviewable = resolutions.some((resolutionItem) => resolutionItem.reviewRequired);
  const noSilentFinancialLoss = resolutions.every(
    (resolutionItem) => resolutionItem.noSilentLastWriteFinancialLoss,
  );

  return {
    deterministic: true,
    reviewable,
    noUniversalLastWriteWins: true,
    noSilentFinancialLoss,
    resolutions,
    rows: resolutions.map((resolutionItem) =>
      row(
        resolutionItem.caseId,
        resolutionItem.strategy,
        resolutionItem.reviewRequired ? 'needs_review' : 'implemented',
      ),
    ),
  };
}

export function evaluateEncryptedSnapshots(input: SnapshotBackupInput): SnapshotBackupState {
  const validGenerations = input.snapshots.filter(
    (snapshot) => snapshot.encrypted && snapshot.hashValidated && snapshot.decryptabilityChecked,
  );
  const blockers = compact([
    input.atomicBeforeMigration ? '' : 'atomic pre-migration snapshot is missing',
    validGenerations.length >= 2 ? '' : 'two validated encrypted generations are required',
    input.restoreReplayExact ? '' : 'snapshot plus operation replay restore has not passed',
    input.portableExportAvailable ? '' : 'portable encrypted export is not available',
    input.platformBackupSoleDependency
      ? 'backup cannot rely solely on iOS/Android automatic app backup'
      : '',
  ]);

  return {
    generationCount: validGenerations.length,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Atomic snapshot',
        boolText(input.atomicBeforeMigration),
        stateFor(input.atomicBeforeMigration),
      ),
      row(
        'Valid generations',
        String(validGenerations.length),
        stateFor(validGenerations.length >= 2),
      ),
      row(
        'Restore replay exact',
        boolText(input.restoreReplayExact),
        stateFor(input.restoreReplayExact),
      ),
      row(
        'Portable encrypted export',
        boolText(input.portableExportAvailable),
        stateFor(input.portableExportAvailable),
      ),
      row(
        'Platform backup reliance',
        input.platformBackupSoleDependency ? 'sole dependency' : 'not sole dependency',
        input.platformBackupSoleDependency ? 'blocked' : 'implemented',
      ),
    ],
  };
}

export function evaluateCompactionCursors(input: CompactionCursorInput): CompactionCursorState {
  const activeDevices = input.activeDevices.filter((device) => device.active);
  const acknowledgements = activeDevices.map((device) => device.acknowledgedSequence);
  const minimumActiveAck =
    acknowledgements.length > 0 ? Math.min(...acknowledgements) : input.requestedSafeSequence;
  const blockedDeviceIds = activeDevices
    .filter((device) => device.acknowledgedSequence < input.requestedSafeSequence)
    .map((device) => device.id);
  const canCompact = blockedDeviceIds.length === 0;

  return {
    canCompact,
    minimumActiveAck,
    requestedSafeSequence: input.requestedSafeSequence,
    blockedDeviceIds,
    rows: [
      row('Requested safe point', String(input.requestedSafeSequence), 'implemented'),
      row('Minimum active ack', String(minimumActiveAck), stateFor(canCompact)),
      row('Compaction allowed', boolText(canCompact), stateFor(canCompact)),
    ],
  };
}

export function evaluateDeviceRecoveryManagerUi(
  input: DeviceRecoveryManagerInput,
): DeviceRecoveryManagerState {
  const noSecretExposure = !input.secretsRendered;
  const blockers = compact([
    noSecretExposure ? '' : 'device/recovery manager renders secret material',
    input.revokeControlAccessible ? '' : 'revoke control is not accessible',
    input.renameControlAccessible ? '' : 'rename control is not accessible',
    input.verifyRecoveryAvailable ? '' : 'verify recovery control is missing',
    input.minimumHitTargetDp >= 48 ? '' : 'native hit target is below 48dp',
    input.reducedMotionCopyAvailable ? '' : 'reduced-motion copy is missing',
  ]);

  return {
    noSecretExposure,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Secret material',
        noSecretExposure ? 'not rendered' : 'visible',
        stateFor(noSecretExposure),
      ),
      row(
        'Revoke control',
        boolText(input.revokeControlAccessible),
        stateFor(input.revokeControlAccessible),
      ),
      row(
        'Rename control',
        boolText(input.renameControlAccessible),
        stateFor(input.renameControlAccessible),
      ),
      row(
        'Verify recovery',
        boolText(input.verifyRecoveryAvailable),
        stateFor(input.verifyRecoveryAvailable),
      ),
      row('Hit target', `${input.minimumHitTargetDp}dp`, stateFor(input.minimumHitTargetDp >= 48)),
    ],
  };
}

export function evaluateAccountDeletionPortal(
  input: AccountDeletionPortalInput,
): AccountDeletionPortalState {
  const blockers = compact([
    input.webRouteConfigured ? '' : 'required web account-deletion route is not configured',
    input.inAppEntrypointConfigured ? '' : 'in-app deletion entrypoint is missing',
    input.tokenRevocationTested ? '' : 'token/session revocation test has not passed',
    input.reversibleGracePeriodDocumented ? '' : 'reversible grace-period policy is not documented',
    input.localVaultPreservedOnCloudDelete
      ? ''
      : 'cloud delete must not destroy local vault silently',
    input.purgeSchedulePublished ? '' : 'cloud ciphertext purge schedule is not published',
  ]);

  return {
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Web deletion route',
        boolText(input.webRouteConfigured),
        stateFor(input.webRouteConfigured),
      ),
      row(
        'In-app entrypoint',
        boolText(input.inAppEntrypointConfigured),
        stateFor(input.inAppEntrypointConfigured),
      ),
      row(
        'Token revocation',
        boolText(input.tokenRevocationTested),
        stateFor(input.tokenRevocationTested),
      ),
      row(
        'Keep local vault option',
        boolText(input.localVaultPreservedOnCloudDelete),
        stateFor(input.localVaultPreservedOnCloudDelete),
      ),
      row(
        'Purge schedule',
        boolText(input.purgeSchedulePublished),
        stateFor(input.purgeSchedulePublished),
      ),
    ],
  };
}

export function buildCloudDataInventory(input: CloudDataInventoryInput): CloudDataInventoryState {
  const cloudCiphertextOnly = input.items
    .filter((item) => item.location === 'cloud_ciphertext')
    .every((item) => item.encrypted && !item.containsFinancialPlaintext);

  return {
    itemCount: input.items.length,
    cloudCiphertextOnly,
    disableCloudKeepsLocalVault: input.disableCloudKeepsLocalVault,
    rows: [
      row('Inventory items', String(input.items.length), stateFor(input.items.length > 0)),
      row(
        'Last backup',
        input.lastBackupIso ?? 'none yet',
        input.lastBackupIso ? 'implemented' : 'needs_review',
      ),
      row('Cloud ciphertext only', boolText(cloudCiphertextOnly), stateFor(cloudCiphertextOnly)),
      row(
        'Disable cloud keeps local vault',
        boolText(input.disableCloudKeepsLocalVault),
        stateFor(input.disableCloudKeepsLocalVault),
      ),
    ],
  };
}

export function evaluateMultiDeviceConflictSuite(
  scenarios: readonly MultiDeviceConflictScenario[],
): MultiDeviceConflictSuiteState {
  const failing = scenarios.filter(
    (scenario) => scenario.status !== 'passed' || scenario.silentLastWriteFinancialLoss,
  );
  const blockers = failing.map((scenario) =>
    scenario.silentLastWriteFinancialLoss
      ? `${scenario.id} observed silent financial loss`
      : `${scenario.id} is ${scenario.status}`,
  );

  return {
    scenarioCount: scenarios.length,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: scenarios.map((scenario) =>
      row(
        scenario.id,
        scenario.silentLastWriteFinancialLoss ? 'silent financial loss observed' : scenario.status,
        scenario.status === 'passed' && !scenario.silentLastWriteFinancialLoss
          ? 'passed'
          : 'blocked',
      ),
    ),
  };
}

export function evaluateCloudSecurityReview(
  independentlyAssessed: boolean,
  findings: readonly SecurityFinding[],
): CloudSecurityReviewState {
  const highOrCriticalOpen = findings.filter(
    (finding) =>
      finding.status === 'open' && (finding.severity === 'high' || finding.severity === 'critical'),
  ).length;
  const blockers = compact([
    independentlyAssessed ? '' : 'independent auth/sync/cloud pen-test is missing',
    highOrCriticalOpen === 0 ? '' : `${highOrCriticalOpen} high/critical findings are open`,
  ]);

  return {
    independentlyAssessed,
    highOrCriticalOpen,
    releaseBlocked: blockers.length > 0,
    blockers,
    rows: [
      row(
        'Independent assessment',
        boolText(independentlyAssessed),
        stateFor(independentlyAssessed),
      ),
      row('Open high/critical', String(highOrCriticalOpen), stateFor(highOrCriticalOpen === 0)),
    ],
  };
}

export function evaluateEncryptedBackupSyncBeta(input: {
  readonly account: OptionalAccountState;
  readonly keyHierarchy: KeyHierarchyState;
  readonly recovery: RecoverySetupState;
  readonly deviceRegistry: DeviceRegistryState;
  readonly backups: SnapshotBackupState;
  readonly deletionPortal: AccountDeletionPortalState;
  readonly conflictSuite: MultiDeviceConflictSuiteState;
  readonly securityReview: CloudSecurityReviewState;
  readonly supportRunbookReady: boolean;
  readonly restoreTelemetryReady: boolean;
  readonly stagedRolloutPlanReady: boolean;
}): EncryptedBackupSyncBetaState {
  const blockers = [
    ...input.account.blockers,
    ...input.keyHierarchy.blockers,
    ...input.recovery.blockers,
    ...input.deviceRegistry.blockers,
    ...input.backups.blockers,
    ...input.deletionPortal.blockers,
    ...input.conflictSuite.blockers,
    ...input.securityReview.blockers,
    ...compact([
      input.supportRunbookReady ? '' : 'support runbook is not ready',
      input.restoreTelemetryReady ? '' : 'restore telemetry/readiness is not proven',
      input.stagedRolloutPlanReady ? '' : 'staged opt-in rollout plan is missing',
    ]),
  ];

  return {
    ready: blockers.length === 0,
    releaseTrack: blockers.length === 0 ? 'opt_in_beta' : 'not_started',
    blockers,
    rows: [
      row('Beta ready', boolText(blockers.length === 0), stateFor(blockers.length === 0)),
      row(
        'Support runbook',
        boolText(input.supportRunbookReady),
        stateFor(input.supportRunbookReady),
      ),
      row(
        'Restore telemetry',
        boolText(input.restoreTelemetryReady),
        stateFor(input.restoreTelemetryReady),
      ),
      row(
        'Staged rollout',
        boolText(input.stagedRolloutPlanReady),
        stateFor(input.stagedRolloutPlanReady),
      ),
    ],
  };
}

export function buildPhase10CoverageRows(
  input: Phase10CoverageInput,
): readonly Phase10CoverageRow[] {
  return [
    coverageRow(
      'T134',
      'Optional account/auth',
      input.account.releaseBlocked ? 'blocked' : 'implemented',
      'local vault signed-out and cloud-only account requirement are modelled',
      firstBlocker(input.account.blockers),
    ),
    coverageRow(
      'T135',
      'Crypto key hierarchy',
      input.keyHierarchy.releaseBlocked ? 'blocked' : 'implemented',
      'master, workspace, document and sync envelope keys are separated',
      firstBlocker(input.keyHierarchy.blockers),
    ),
    coverageRow(
      'T136',
      'Recovery setup',
      input.recovery.releaseBlocked ? 'blocked' : 'implemented',
      'zero-knowledge recovery methods are represented without secret exposure',
      firstBlocker(input.recovery.blockers),
    ),
    coverageRow(
      'T137',
      'Cloud device registry',
      input.deviceRegistry.releaseBlocked ? 'blocked' : 'implemented',
      'device public-key registrations and revocation state are typed',
      firstBlocker(input.deviceRegistry.blockers),
    ),
    coverageRow(
      'T138',
      'Encrypted outbox envelopes',
      input.outbox.uploadContractAccepted ? 'implemented' : 'blocked',
      'append-only ciphertext envelopes reject service-visible financial plaintext',
      firstBlocker(input.outbox.blockers),
    ),
    coverageRow(
      'T139',
      'Inbox apply pipeline',
      input.inbox.rejectedCount > 0 && input.inbox.acceptedCount > 0
        ? 'implemented'
        : 'needs_review',
      'duplicate and malformed envelopes are rejected before apply',
    ),
    coverageRow(
      'T140',
      'Conflict policies',
      input.conflicts.noSilentFinancialLoss ? 'implemented' : 'blocked',
      'transaction, plan, rule, task and workspace conflicts resolve deterministically',
    ),
    coverageRow(
      'T141',
      'Encrypted backup snapshots',
      input.backups.releaseBlocked ? 'blocked' : 'implemented',
      'validated encrypted snapshots and operation replay are modelled',
      firstBlocker(input.backups.blockers),
    ),
    coverageRow(
      'T142',
      'Compaction ack cursors',
      input.compaction.canCompact ? 'implemented' : 'needs_review',
      'operation compaction waits for every active-device acknowledgement',
      input.compaction.canCompact
        ? undefined
        : `waiting on ${input.compaction.blockedDeviceIds.join(', ')}`,
    ),
    coverageRow(
      'T143',
      'Device/recovery manager UI',
      input.managerUi.releaseBlocked ? 'blocked' : 'implemented',
      'manager state avoids secret exposure and enforces accessible controls',
      firstBlocker(input.managerUi.blockers),
    ),
    coverageRow(
      'T144',
      'Web account-deletion portal',
      input.deletionPortal.releaseBlocked ? 'blocked' : 'implemented',
      'web/in-app delete, token revoke and local-vault preservation are tracked',
      firstBlocker(input.deletionPortal.blockers),
    ),
    coverageRow(
      'T145',
      'Cloud data inventory/status',
      input.inventory.cloudCiphertextOnly && input.inventory.disableCloudKeepsLocalVault
        ? 'implemented'
        : 'blocked',
      'payload types, processors, delete controls and local-vault retention are visible',
    ),
    coverageRow(
      'T146',
      'Multi-device offline conflict suite',
      input.conflictSuite.releaseBlocked ? 'blocked' : 'passed',
      'multi-device edit/delete/recovery/revoke scenarios block silent loss',
      firstBlocker(input.conflictSuite.blockers),
    ),
    coverageRow(
      'T147',
      'Cloud vault/auth/sync pen-test',
      input.securityReview.releaseBlocked ? 'blocked' : 'passed',
      'independent assessment must close high/critical findings',
      firstBlocker(input.securityReview.blockers),
    ),
    coverageRow(
      'T148',
      'Encrypted backup/sync beta',
      input.beta.ready ? 'passed' : 'blocked',
      'staged opt-in beta waits for restore telemetry and support readiness',
      firstBlocker(input.beta.blockers),
    ),
  ];
}

function coverageRow(
  taskId: Phase10TaskId,
  label: string,
  state: CloudReadinessState,
  evidence: string,
  blocker?: string,
): Phase10CoverageRow {
  if (blocker) {
    return { taskId, label, state, evidence, blocker };
  }

  return { taskId, label, state, evidence };
}

function resolution(
  conflictCase: ConflictCase,
  strategy: string,
  reviewRequired: boolean,
  noSilentLastWriteFinancialLoss: boolean,
): ConflictResolution {
  return {
    caseId: conflictCase.id,
    kind: conflictCase.kind,
    strategy,
    reviewRequired,
    noSilentLastWriteFinancialLoss,
  };
}

function row(label: string, value: string, state: CloudReadinessState): EvidenceRow {
  return { label, value, state };
}

function stateFor(condition: boolean): CloudReadinessState {
  return condition ? 'implemented' : 'blocked';
}

function boolText(value: boolean): string {
  return value ? 'yes' : 'no';
}

function compact(values: readonly string[]): readonly string[] {
  return values.filter((value) => value.length > 0);
}

function firstBlocker(blockers: readonly string[]): string | undefined {
  return blockers[0];
}
