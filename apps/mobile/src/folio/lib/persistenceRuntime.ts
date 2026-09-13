import type { WorkspaceId } from '@folio/domain';

export type PersistenceFailureKind = 'storage' | 'key-storage' | 'unknown';
export type PersistenceStatus = 'idle' | 'saving' | 'saved' | 'failed';
/** Internal save boundary used by review flows to distinguish an atomic pre-commit failure from
 * a post-SQL metadata/rollback failure. It carries no payload or user data. */
export type PersistenceFailureStage =
  | 'none'
  | 'preparation'
  | 'workspace-state'
  | 'workspace-manifest'
  | 'rollback-files';

export type PersistenceStageTaggedError = Error & {
  readonly persistenceStage?: PersistenceFailureStage;
};

export type PersistenceRuntimeState = Readonly<{
  status: PersistenceStatus;
  workspaceId: WorkspaceId | null;
  lastAttemptAtISO: string | null;
  lastSavedAtISO: string | null;
  failureKind: PersistenceFailureKind | null;
  consecutiveFailures: number;
}>;

const INITIAL_STATE: PersistenceRuntimeState = {
  status: 'idle',
  workspaceId: null,
  lastAttemptAtISO: null,
  lastSavedAtISO: null,
  failureKind: null,
  consecutiveFailures: 0,
};

let state = INITIAL_STATE;
let failureStage: PersistenceFailureStage = 'none';
const listeners = new Set<() => void>();

export function getPersistenceRuntimeState(): PersistenceRuntimeState {
  return state;
}

export function subscribePersistenceRuntime(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markPersistenceSaving(workspaceId: WorkspaceId, atISO: string): void {
  failureStage = 'none';
  publish({
    ...state,
    status: 'saving',
    workspaceId,
    lastAttemptAtISO: atISO,
  });
}

export function markPersistenceSaved(workspaceId: WorkspaceId, atISO: string): void {
  failureStage = 'none';
  publish({
    status: 'saved',
    workspaceId,
    lastAttemptAtISO: atISO,
    lastSavedAtISO: atISO,
    failureKind: null,
    consecutiveFailures: 0,
  });
}

export function markPersistenceFailed(
  workspaceId: WorkspaceId,
  reason: unknown,
  atISO: string,
): void {
  publish({
    ...state,
    status: 'failed',
    workspaceId,
    lastAttemptAtISO: atISO,
    failureKind: classifyPersistenceFailure(reason),
    consecutiveFailures: state.consecutiveFailures + 1,
  });
}

export function setPersistenceFailureStage(stage: PersistenceFailureStage): void {
  failureStage = stage;
}

export function getPersistenceFailureStage(): PersistenceFailureStage {
  return failureStage;
}

/** Read the stage attached to one save attempt. Callers making rollback/retry decisions must use
 * this attempt-local value rather than the process-global diagnostic snapshot. */
export function persistenceFailureStageOf(reason: unknown): PersistenceFailureStage {
  if (reason !== null && typeof reason === 'object' && 'persistenceStage' in reason) {
    const stage = (reason as { persistenceStage?: unknown }).persistenceStage;
    if (
      stage === 'preparation' ||
      stage === 'workspace-state' ||
      stage === 'workspace-manifest' ||
      stage === 'rollback-files'
    ) {
      return stage;
    }
  }
  return 'none';
}

export function classifyPersistenceFailure(reason: unknown): PersistenceFailureKind {
  const record = typeof reason === 'object' && reason !== null ? reason : undefined;
  const code =
    record !== undefined && 'code' in record && typeof record.code === 'string'
      ? record.code.toLowerCase()
      : '';
  const message =
    reason instanceof Error ? reason.message.toLowerCase() : String(reason).toLowerCase();
  const detail = `${code} ${message}`;

  if (/enospc|no space|disk full|storage full|quota/u.test(detail)) return 'storage';
  if (/keystore|keychain|secure.?store|protected key|key storage/u.test(detail)) {
    return 'key-storage';
  }
  return 'unknown';
}

/** Stable, value-free diagnostic for device logs. Never return the exception message: native
 * database errors can include SQL parameters, and those may contain financial state. */
export function classifyPersistenceDiagnostic(reason: unknown): string {
  const record = typeof reason === 'object' && reason !== null ? reason : undefined;
  const code =
    record !== undefined && 'code' in record && typeof record.code === 'string'
      ? record.code.toLowerCase()
      : '';
  const message =
    reason instanceof Error ? reason.message.toLowerCase() : String(reason).toLowerCase();
  const detail = `${code} ${message}`;

  if (/database is locked|sqlite_busy/u.test(detail)) return 'database-locked';
  if (/no such table|no such column|has no column|schema/u.test(detail)) return 'database-schema';
  if (/constraint|unique|sqlite_constraint/u.test(detail)) return 'database-constraint';
  if (/malformed|file is not a database|notadb|sqlite_corrupt/u.test(detail)) {
    return 'database-unreadable';
  }
  if (/canonical projection/u.test(detail)) return 'canonical-projection';
  if (/typed-command|typed command|audit/u.test(detail)) return 'typed-command-audit';
  if (/readback verification/u.test(detail)) return 'readback-verification';
  if (/workspace manifest/u.test(detail)) return 'manifest-binding';
  if (/workspace state payload|payload does not/u.test(detail)) return 'state-payload';
  if (/keystore|keychain|secure.?store|protected key|key storage/u.test(detail)) {
    return 'key-storage';
  }
  if (/enospc|no space|disk full|storage full|quota/u.test(detail)) return 'storage-full';
  return 'unknown';
}

/** Test-only reset. Runtime callers should let the latest save attempt own this state. */
export function resetPersistenceRuntimeState(): void {
  state = INITIAL_STATE;
  failureStage = 'none';
  notify();
}

function publish(next: PersistenceRuntimeState): void {
  state = next;
  notify();
}

function notify(): void {
  for (const listener of listeners) listener();
}
