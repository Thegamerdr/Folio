import type { WorkspaceId } from '@folio/domain';

import { createJsonChecksum, type Checksum } from './checksum.js';
import type { DatabaseDriver } from './driver.js';
import { assertJsonRecord, stableStringify, type JsonRecord, type JsonValue } from './json.js';

export type AuditActorKind = 'user' | 'melo' | 'import' | 'sync' | 'system' | 'migration';

export type EntityRef = Readonly<{
  type: string;
  id: string;
}>;

export type AuditFieldDelta = Readonly<{
  field: string;
  state: 'added' | 'changed' | 'removed';
  beforeChecksum?: Checksum;
  afterChecksum?: Checksum;
}>;

export type CompactAuditDelta = Readonly<{
  fields: readonly AuditFieldDelta[];
}>;

export type AuditLogEntryInput = Readonly<{
  id?: string;
  workspaceId?: WorkspaceId;
  commandType: string;
  actorKind: AuditActorKind;
  actorRef?: string;
  entityRefs: readonly EntityRef[];
  delta: CompactAuditDelta | JsonRecord;
  provenance?: JsonRecord;
  deviceId?: string;
  reversalOfId?: string;
  createdAt?: Date;
}>;

export type AuditLogEntry = Readonly<{
  id: string;
  workspaceId?: WorkspaceId;
  commandType: string;
  actorKind: AuditActorKind;
  actorRef?: string;
  entityRefs: readonly EntityRef[];
  delta: CompactAuditDelta | JsonRecord;
  provenance?: JsonRecord;
  deviceId?: string;
  reversalOfId?: string;
  createdAt: string;
}>;

export type StoredAuditLogRow = Readonly<{
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
}>;

export type AuditLogProof = Readonly<{
  auditEntryId: string;
  workspaceId?: string;
  commandType: string;
  actorKind: AuditActorKind;
  entityRefCount: number;
  entityRefsChecksum: Checksum;
  deltaChecksum: Checksum;
  provenanceChecksum?: Checksum;
  deviceId?: string;
  reversalOfId?: string;
  createdAt: string;
  proofChecksum: Checksum;
}>;

export type AuditLogOptions = Readonly<{
  idFactory?: () => string;
  now?: () => Date;
}>;

let auditIdCounter = 0;

export function createCompactAuditDelta(input: {
  before?: JsonRecord;
  after?: JsonRecord;
}): CompactAuditDelta {
  const before = input.before ?? {};
  const after = input.after ?? {};
  const fields: AuditFieldDelta[] = [];
  const fieldNames = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const field of [...fieldNames].sort((left, right) => left.localeCompare(right))) {
    const beforeHasField = Object.hasOwn(before, field);
    const afterHasField = Object.hasOwn(after, field);
    const beforeValue = before[field] as JsonValue | undefined;
    const afterValue = after[field] as JsonValue | undefined;

    if (
      beforeHasField &&
      afterHasField &&
      beforeValue !== undefined &&
      afterValue !== undefined &&
      stableStringify(beforeValue) === stableStringify(afterValue)
    ) {
      continue;
    }

    const delta: {
      field: string;
      state: 'added' | 'changed' | 'removed';
      beforeChecksum?: Checksum;
      afterChecksum?: Checksum;
    } = {
      field,
      state: beforeHasField && afterHasField ? 'changed' : beforeHasField ? 'removed' : 'added',
    };

    if (beforeHasField && beforeValue !== undefined) {
      delta.beforeChecksum = createJsonChecksum(beforeValue);
    }
    if (afterHasField && afterValue !== undefined) {
      delta.afterChecksum = createJsonChecksum(afterValue);
    }
    fields.push(delta);
  }

  return { fields };
}

export function createAuditLogEntry(
  input: AuditLogEntryInput,
  options: AuditLogOptions = {},
): AuditLogEntry {
  if (input.commandType.trim().length === 0) {
    throw new Error('Audit log entries require a command type.');
  }
  if (input.entityRefs.length === 0) {
    throw new Error('Audit log entries require at least one entity reference.');
  }

  const id = input.id ?? options.idFactory?.() ?? createDefaultAuditId();
  const createdAt = (input.createdAt ?? options.now?.() ?? new Date()).toISOString();
  const entryBase = {
    id,
    commandType: input.commandType,
    actorKind: input.actorKind,
    entityRefs: input.entityRefs,
    delta: input.delta,
    createdAt,
  };

  return {
    ...entryBase,
    ...(input.workspaceId === undefined ? {} : { workspaceId: input.workspaceId }),
    ...(input.actorRef === undefined ? {} : { actorRef: input.actorRef }),
    ...(input.provenance === undefined ? {} : { provenance: input.provenance }),
    ...(input.deviceId === undefined ? {} : { deviceId: input.deviceId }),
    ...(input.reversalOfId === undefined ? {} : { reversalOfId: input.reversalOfId }),
  };
}

export function createAuditLogProof(entry: AuditLogEntry): AuditLogProof {
  const entityRefs = { refs: entry.entityRefs.map((ref) => ({ type: ref.type, id: ref.id })) };
  const entityRefsChecksum = createJsonChecksum(entityRefs);
  const deltaChecksum = createJsonChecksum(normalizeAuditJson(entry.delta, 'audit delta'));
  const provenanceChecksum =
    entry.provenance === undefined
      ? undefined
      : createJsonChecksum(normalizeAuditJson(entry.provenance, 'provenance'));
  return buildAuditProof({
    auditEntryId: entry.id,
    workspaceId: entry.workspaceId,
    commandType: entry.commandType,
    actorKind: entry.actorKind,
    actorRef: entry.actorRef,
    entityRefCount: entry.entityRefs.length,
    entityRefsChecksum,
    deltaChecksum,
    provenanceChecksum,
    deviceId: entry.deviceId,
    reversalOfId: entry.reversalOfId,
    createdAt: entry.createdAt,
  });
}

export function createStoredAuditLogProof(row: StoredAuditLogRow): AuditLogProof {
  const entityRefs = JSON.parse(row.entity_refs_json) as JsonValue;
  const delta = JSON.parse(row.delta_json) as JsonValue;
  const provenance =
    row.provenance_json === null ? undefined : (JSON.parse(row.provenance_json) as JsonValue);
  const entityRefCount =
    entityRefs !== null &&
    typeof entityRefs === 'object' &&
    !Array.isArray(entityRefs) &&
    Array.isArray((entityRefs as { refs?: unknown }).refs)
      ? (entityRefs as { refs: unknown[] }).refs.length
      : 0;

  return buildAuditProof({
    auditEntryId: row.id,
    workspaceId: row.workspace_id ?? undefined,
    commandType: row.command_type,
    actorKind: row.actor_kind as AuditActorKind,
    actorRef: row.actor_ref ?? undefined,
    entityRefCount,
    entityRefsChecksum: createJsonChecksum(entityRefs),
    deltaChecksum: createJsonChecksum(delta),
    provenanceChecksum: provenance === undefined ? undefined : createJsonChecksum(provenance),
    deviceId: row.device_id ?? undefined,
    reversalOfId: row.reversal_of_id ?? undefined,
    createdAt: row.created_at,
  });
}

export function verifyStoredAuditLogProof(row: StoredAuditLogRow, proof: AuditLogProof): boolean {
  return createStoredAuditLogProof(row).proofChecksum === proof.proofChecksum;
}

export async function writeAuditLogEntry(
  driver: DatabaseDriver,
  input: AuditLogEntryInput,
  options: AuditLogOptions = {},
): Promise<AuditLogEntry> {
  const entry = createAuditLogEntry(input, options);
  const delta = normalizeAuditJson(entry.delta, 'audit delta');
  const provenance =
    entry.provenance === undefined
      ? null
      : stableStringify(normalizeAuditJson(entry.provenance, 'provenance'));

  await driver.execute(
    `INSERT INTO audit_log (
      id,
      workspace_id,
      command_type,
      actor_kind,
      actor_ref,
      entity_refs_json,
      delta_json,
      provenance_json,
      device_id,
      reversal_of_id,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.workspaceId ?? null,
      entry.commandType,
      entry.actorKind,
      entry.actorRef ?? null,
      stableStringify({ refs: entry.entityRefs.map((ref) => ({ type: ref.type, id: ref.id })) }),
      stableStringify(delta),
      provenance,
      entry.deviceId ?? null,
      entry.reversalOfId ?? null,
      entry.createdAt,
    ],
  );

  return entry;
}

function normalizeAuditJson(value: CompactAuditDelta | JsonRecord, label: string): JsonRecord {
  assertJsonRecord(value, label);
  return value;
}

function buildAuditProof(input: {
  auditEntryId: string;
  workspaceId?: string | undefined;
  commandType: string;
  actorKind: AuditActorKind;
  actorRef?: string | undefined;
  entityRefCount: number;
  entityRefsChecksum: Checksum;
  deltaChecksum: Checksum;
  provenanceChecksum?: Checksum | undefined;
  deviceId?: string | undefined;
  reversalOfId?: string | undefined;
  createdAt: string;
}): AuditLogProof {
  const proofSource = {
    auditEntryId: input.auditEntryId,
    workspaceId: input.workspaceId ?? null,
    commandType: input.commandType,
    actorKind: input.actorKind,
    actorRef: input.actorRef ?? null,
    entityRefCount: input.entityRefCount,
    entityRefsChecksum: input.entityRefsChecksum,
    deltaChecksum: input.deltaChecksum,
    provenanceChecksum: input.provenanceChecksum ?? null,
    deviceId: input.deviceId ?? null,
    reversalOfId: input.reversalOfId ?? null,
    createdAt: input.createdAt,
  };
  const proof: {
    auditEntryId: string;
    workspaceId?: string;
    commandType: string;
    actorKind: AuditActorKind;
    entityRefCount: number;
    entityRefsChecksum: Checksum;
    deltaChecksum: Checksum;
    provenanceChecksum?: Checksum;
    deviceId?: string;
    reversalOfId?: string;
    createdAt: string;
    proofChecksum: Checksum;
  } = {
    auditEntryId: input.auditEntryId,
    commandType: input.commandType,
    actorKind: input.actorKind,
    entityRefCount: input.entityRefCount,
    entityRefsChecksum: input.entityRefsChecksum,
    deltaChecksum: input.deltaChecksum,
    createdAt: input.createdAt,
    proofChecksum: createJsonChecksum(proofSource),
  };
  if (input.workspaceId !== undefined) proof.workspaceId = input.workspaceId;
  if (input.provenanceChecksum !== undefined) proof.provenanceChecksum = input.provenanceChecksum;
  if (input.deviceId !== undefined) proof.deviceId = input.deviceId;
  if (input.reversalOfId !== undefined) proof.reversalOfId = input.reversalOfId;
  return proof;
}

function createDefaultAuditId(): string {
  auditIdCounter += 1;
  return `audit_${Date.now().toString(36)}_${auditIdCounter.toString(36)}`;
}
