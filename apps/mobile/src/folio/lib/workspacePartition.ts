import { bytesToHex, utf8ToBytes } from '@noble/ciphers/utils.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { createWorkspaceId, type WorkspaceId } from '@folio/domain';

import type { PersistedWorkspace, WorkspaceRoot } from './workspaceRoot';

export const WORKSPACE_MANIFEST_VERSION = 1 as const;
export const WORKSPACE_PARTITION_KEY_BYTES = 32;

const MANIFEST_FORMAT = 'melo.workspace-manifest';
const HKDF_SALT = utf8ToBytes('melo.workspace-partition.hkdf.v1');
const WORKSPACE_REF_PATTERN = /^[a-f0-9]{64}$/u;
const EVIDENCE_ID_PATTERN = /^evidence_[a-f0-9]{32}$/u;

export type WorkspaceManifest = Readonly<{
  format: typeof MANIFEST_FORMAT;
  version: typeof WORKSPACE_MANIFEST_VERSION;
  updatedAt: string;
  activeWorkspaceId: WorkspaceId;
  workspaces: readonly PersistedWorkspace[];
}>;

/**
 * Derive an independent data-encryption key from the device master key. The raw master key is never
 * written into a workspace record, and changing either the workspace ID, subkey ID or purpose
 * produces a different key.
 */
export function deriveWorkspacePartitionKey(
  masterKey: Uint8Array,
  workspace: Pick<PersistedWorkspace, 'id' | 'encryptedSubkeyId'>,
  purpose: 'state' | 'sqlite' | 'documents',
): Uint8Array {
  if (masterKey.byteLength !== WORKSPACE_PARTITION_KEY_BYTES) {
    throw new Error('Workspace key derivation requires a 256-bit master key.');
  }
  const workspaceId = createWorkspaceId(String(workspace.id));
  if (!isSafeSubkeyId(workspace.encryptedSubkeyId)) {
    throw new Error('Workspace encryption subkey ID is invalid.');
  }
  return hkdf(
    sha256,
    masterKey,
    HKDF_SALT,
    utf8ToBytes(
      `melo.workspace-partition.v1:${purpose}:${String(workspaceId)}:${workspace.encryptedSubkeyId}`,
    ),
    WORKSPACE_PARTITION_KEY_BYTES,
  );
}

/** Opaque stable filename/reference component; raw workspace IDs do not appear in app files. */
export function workspacePartitionRef(workspaceId: string | WorkspaceId): string {
  const checked = createWorkspaceId(String(workspaceId));
  return bytesToHex(sha256(utf8ToBytes(String(checked))));
}

export function workspacePartitionAssociatedData(
  workspace: Pick<PersistedWorkspace, 'id' | 'encryptedSubkeyId'>,
  purpose: 'state' | 'sqlite' | 'documents',
): Uint8Array {
  const workspaceRef = workspacePartitionRef(workspace.id);
  if (!isSafeSubkeyId(workspace.encryptedSubkeyId)) {
    throw new Error('Workspace encryption subkey ID is invalid.');
  }
  return utf8ToBytes(
    `melo.workspace-partition.v1:${purpose}:${workspaceRef}:${workspace.encryptedSubkeyId}`,
  );
}

export function workspacePartitionFilenames(workspaceId: string | WorkspaceId): Readonly<{
  main: string;
  temporary: string;
  backup: string;
  parked: string;
}> {
  const ref = workspacePartitionRef(workspaceId);
  const prefix = `melo.workspace.${ref}.state.v1`;
  return {
    main: `${prefix}.json`,
    temporary: `${prefix}.tmp.json`,
    backup: `${prefix}.bak.json`,
    parked: `${prefix}.unreadable.json`,
  };
}

/** Opaque SQLCipher filename for the authoritative lossless state and normalized ledger rows. */
export function workspaceLedgerDatabaseName(workspaceId: string | WorkspaceId): string {
  return `melo.workspace.${workspacePartitionRef(workspaceId)}.ledger.v1.sqlite`;
}

/** Opaque encrypted-original filename. Neither the workspace ID nor original filename is exposed. */
export function workspaceEvidenceFilename(
  workspaceId: string | WorkspaceId,
  evidenceId: string,
): string {
  if (!EVIDENCE_ID_PATTERN.test(evidenceId)) {
    throw new Error('Evidence document ID is invalid.');
  }
  const evidenceRef = bytesToHex(sha256(utf8ToBytes(evidenceId)));
  return `melo.evidence.${workspacePartitionRef(workspaceId)}.${evidenceRef}.v1.fve`;
}

/** Per-document authenticated metadata. This prevents a valid ciphertext from being swapped onto
 *  another evidence row, even inside the same workspace. */
export function workspaceEvidenceAssociatedData(
  workspace: Pick<PersistedWorkspace, 'id' | 'encryptedSubkeyId'>,
  evidenceId: string,
): Uint8Array {
  if (!EVIDENCE_ID_PATTERN.test(evidenceId)) {
    throw new Error('Evidence document ID is invalid.');
  }
  const workspaceRef = workspacePartitionRef(workspace.id);
  if (!isSafeSubkeyId(workspace.encryptedSubkeyId)) {
    throw new Error('Workspace encryption subkey ID is invalid.');
  }
  return utf8ToBytes(
    `melo.workspace-partition.v1:documents:${workspaceRef}:${workspace.encryptedSubkeyId}:${evidenceId}`,
  );
}

export function createWorkspaceManifest(root: WorkspaceRoot, updatedAt: string): WorkspaceManifest {
  if (!isIsoDate(updatedAt)) throw new Error('Workspace manifest updatedAt must be an ISO date.');
  assertValidWorkspaceRoot(root);
  return {
    format: MANIFEST_FORMAT,
    version: WORKSPACE_MANIFEST_VERSION,
    updatedAt,
    activeWorkspaceId: root.activeWorkspaceId,
    workspaces: root.workspaces,
  };
}

export function parseWorkspaceManifest(raw: string): WorkspaceManifest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (
    parsed['format'] !== MANIFEST_FORMAT ||
    parsed['version'] !== WORKSPACE_MANIFEST_VERSION ||
    typeof parsed['updatedAt'] !== 'string' ||
    !isIsoDate(parsed['updatedAt']) ||
    typeof parsed['activeWorkspaceId'] !== 'string' ||
    !Array.isArray(parsed['workspaces'])
  ) {
    return null;
  }
  try {
    const activeWorkspaceId = createWorkspaceId(parsed['activeWorkspaceId']);
    const workspaces = parsed['workspaces'] as readonly PersistedWorkspace[];
    assertValidWorkspaceRoot({
      workspaces,
      activeWorkspaceId,
      dataWorkspaceId: activeWorkspaceId,
    });
    return {
      format: MANIFEST_FORMAT,
      version: WORKSPACE_MANIFEST_VERSION,
      updatedAt: parsed['updatedAt'],
      activeWorkspaceId,
      workspaces,
    };
  } catch {
    return null;
  }
}

export function assertValidWorkspaceRoot(root: WorkspaceRoot): WorkspaceRoot {
  if (root.workspaces.length < 1 || root.workspaces.length > 2) {
    throw new Error('Melo supports exactly one Personal workspace and at most one Business.');
  }
  const ids = new Set<string>();
  const subkeys = new Set<string>();
  let personalCount = 0;
  let businessCount = 0;
  for (const workspace of root.workspaces) {
    const id = String(createWorkspaceId(String(workspace.id)));
    if (ids.has(id)) throw new Error('Workspace IDs must be unique.');
    ids.add(id);
    if (!isSafeSubkeyId(workspace.encryptedSubkeyId)) {
      throw new Error('Workspace encryption subkey ID is invalid.');
    }
    if (subkeys.has(workspace.encryptedSubkeyId)) {
      throw new Error('Workspace encryption subkey IDs must be unique.');
    }
    subkeys.add(workspace.encryptedSubkeyId);
    if (
      workspace.baseCurrency !== 'GBP' ||
      workspace.jurisdiction !== 'GB' ||
      workspace.timeZone !== 'Europe/London' ||
      workspace.name.trim().length === 0 ||
      workspace.name.trim().length > 120 ||
      !Number.isSafeInteger(workspace.version.revision) ||
      workspace.version.revision < 1 ||
      typeof workspace.version.dataVersion !== 'string' ||
      workspace.version.dataVersion.length === 0 ||
      (workspace.archivedAt !== null && !isIsoDate(workspace.archivedAt))
    ) {
      throw new Error(`Workspace ${id} metadata is invalid.`);
    }
    if (workspace.kind === 'personal') personalCount += 1;
    else if (workspace.kind === 'business') businessCount += 1;
    else throw new Error(`Workspace ${id} kind is invalid.`);
  }
  if (personalCount !== 1 || businessCount > 1) {
    throw new Error('Melo requires one Personal workspace and at most one Business.');
  }
  if (
    root.workspaces[0]?.kind !== 'personal' ||
    (root.workspaces[1] !== undefined && root.workspaces[1].kind !== 'business')
  ) {
    throw new Error('Workspace registry order must be Personal followed by Business.');
  }
  const active = root.workspaces.find(
    (workspace) => String(workspace.id) === String(root.activeWorkspaceId),
  );
  if (active === undefined || active.archivedAt !== null) {
    throw new Error('The active workspace must exist and must not be archived.');
  }
  if (String(root.dataWorkspaceId) !== String(root.activeWorkspaceId)) {
    throw new Error('The loaded data partition must belong to the active workspace.');
  }
  return root;
}

function isSafeSubkeyId(value: string): boolean {
  return /^workspace-subkey-[a-z0-9_-]{4,96}-v[1-9][0-9]*$/u.test(value);
}

function isIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
