import {
  createCompactAuditDelta,
  type AuditActorKind,
  type CommandAuditInput,
  type EntityRef,
  type JsonRecord,
  type StorageCommand,
} from '@folio/storage';
import type { WorkspaceId } from '@folio/domain';

export type PendingAppStateCommand = Readonly<{
  id: string;
  occurredAt: string;
  command: StorageCommand<{ commandId: string; occurredAt: string }>;
  audit: CommandAuditInput;
  changedEntityIds: readonly string[];
  invalidatedProjectionKinds: readonly string[];
}>;

export type PendingAppStateCommandInput = Readonly<{
  commandType: string;
  workspaceId: WorkspaceId;
  actorKind: AuditActorKind;
  entityRefs: readonly EntityRef[];
  before?: Readonly<Record<string, unknown>>;
  after?: Readonly<Record<string, unknown>>;
  changedEntityIds?: readonly string[];
  invalidatedProjectionKinds?: readonly string[];
  occurredAt?: string;
}>;

const pendingByWorkspace = new Map<string, PendingAppStateCommand[]>();
let commandIdCounter = 0;

/**
 * Build the privacy-minimal receipt that bridges the synchronous AppState API into the durable
 * storage command bus. Raw before/after values exist only for this call: the pending receipt keeps
 * field names and checksums, never merchant names, monetary values, or other field contents.
 */
export function createPendingAppStateCommand(
  input: PendingAppStateCommandInput,
): PendingAppStateCommand {
  const commandType = input.commandType.trim();
  if (commandType.length === 0) throw new Error('Pending commands require a command type.');
  if (input.entityRefs.length === 0) {
    throw new Error('Pending commands require at least one affected entity.');
  }
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(occurredAt))) {
    throw new Error('Pending commands require a valid occurrence timestamp.');
  }
  const id = nextCommandId();
  return {
    id,
    occurredAt,
    command: {
      type: commandType,
      input: { commandId: id, occurredAt },
      actor: { kind: input.actorKind },
      workspaceId: input.workspaceId,
    },
    audit: {
      entityRefs: input.entityRefs.map((ref) => ({ type: ref.type, id: ref.id })),
      delta: createCompactAuditDelta({
        ...(input.before === undefined ? {} : { before: toJsonRecord(input.before) }),
        ...(input.after === undefined ? {} : { after: toJsonRecord(input.after) }),
      }),
    },
    changedEntityIds: [...(input.changedEntityIds ?? input.entityRefs.map((ref) => ref.id))],
    invalidatedProjectionKinds: [...(input.invalidatedProjectionKinds ?? [])],
  };
}

function toJsonRecord(source: Readonly<Record<string, unknown>>): JsonRecord {
  const parsed = JSON.parse(JSON.stringify(source)) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Pending command audit source must be a JSON object.');
  }
  return parsed as JsonRecord;
}

/** Enqueue before publishing the matching in-memory state mutation. */
export function enqueuePendingAppStateCommand(receipt: PendingAppStateCommand): void {
  const workspaceId = receipt.command.workspaceId;
  if (workspaceId === undefined) throw new Error('AppState commands must be workspace-scoped.');
  const key = String(workspaceId);
  const pending = pendingByWorkspace.get(key) ?? [];
  if (pending.some((candidate) => candidate.id === receipt.id)) {
    throw new Error(`Pending command ${receipt.id} is already queued.`);
  }
  pendingByWorkspace.set(key, [...pending, receipt]);
}

/** Stable save-start snapshot. Commands queued during an async write are deliberately excluded. */
export function snapshotPendingAppStateCommands(
  workspaceId: WorkspaceId,
): readonly PendingAppStateCommand[] {
  return [...(pendingByWorkspace.get(String(workspaceId)) ?? [])];
}

/** Remove only receipts proven durable by a successful native transaction. */
export function acknowledgePendingAppStateCommands(
  workspaceId: WorkspaceId,
  commandIds: readonly string[],
): void {
  if (commandIds.length === 0) return;
  const key = String(workspaceId);
  const acknowledged = new Set(commandIds);
  const remaining = (pendingByWorkspace.get(key) ?? []).filter(
    (receipt) => !acknowledged.has(receipt.id),
  );
  if (remaining.length === 0) pendingByWorkspace.delete(key);
  else pendingByWorkspace.set(key, remaining);
}

/** Local deletion/reset must not allow an old in-memory receipt to repopulate a rebuilt vault. */
export function clearPendingAppStateCommands(workspaceId?: WorkspaceId): void {
  if (workspaceId === undefined) pendingByWorkspace.clear();
  else pendingByWorkspace.delete(String(workspaceId));
}

function nextCommandId(): string {
  commandIdCounter += 1;
  return `folio-command-${Date.now().toString(36)}-${commandIdCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
