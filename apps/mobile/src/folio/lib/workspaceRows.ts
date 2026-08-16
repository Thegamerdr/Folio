import type { WorkspaceId } from '@folio/domain';

import { requireWorkspaceData, type WorkspacePartitionHeader } from './workspaceRoot';

/**
 * Persisted row collections in the current production AppState partition. Scalars and keyed maps
 * are owned by `dataWorkspaceId`; every independently addressable row additionally carries its own
 * non-null workspace ID so a future Business partition cannot be implemented as a UI-only filter.
 */
export const PERSISTED_WORKSPACE_ROW_COLLECTIONS = [
  'pots',
  'subs',
  'cycles',
  'potLedger',
  'transactions',
  'edits',
  'calendarEvents',
  'debts',
  'plans',
  'tinyWins',
  'timelineEvents',
  'reviewQueue',
  'reviewQueueSpillover',
  'incomeSources',
  'dismissedDriftSignals',
  'statementImports',
  'evidenceDocuments',
  'accounts',
  'cancelledSubs',
  'whatIfHolds',
  'decisionLedger',
  'provisionalAnswers',
  'materialChanges',
  'correctionImpacts',
  'criticalJourneyContinuity',
] as const;

/** Reader candidates are deliberately not persisted, but they still need ownership while staged. */
export const TRANSIENT_WORKSPACE_ROW_COLLECTIONS = ['readerCandidates'] as const;

export const WORKSPACE_ROW_COLLECTIONS = [
  ...PERSISTED_WORKSPACE_ROW_COLLECTIONS,
  ...TRANSIENT_WORKSPACE_ROW_COLLECTIONS,
] as const;

export type PersistedWorkspaceRowCollection = (typeof PERSISTED_WORKSPACE_ROW_COLLECTIONS)[number];
export type WorkspaceRowCollection = (typeof WORKSPACE_ROW_COLLECTIONS)[number];

export type WorkspaceOwnedRow = Readonly<{
  workspaceId: WorkspaceId;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function rowLabel(row: Record<string, unknown>, index: number): string {
  for (const key of ['id', 'name', 'closedAt', 'merchant', 'at'] as const) {
    if (typeof row[key] === 'string' && String(row[key]).length > 0) {
      return String(row[key]);
    }
  }
  return `index:${index}`;
}

export function ownWorkspaceRow<TRow extends Record<string, unknown>>(
  row: TRow,
  workspaceId: WorkspaceId,
  label = 'row',
): TRow & WorkspaceOwnedRow {
  const existing = row.workspaceId;
  if (existing !== undefined && String(existing) !== String(workspaceId)) {
    throw new Error(
      `${label} belongs to workspace ${String(existing)}, not ${String(workspaceId)}.`,
    );
  }
  if (String(existing) === String(workspaceId)) return row as TRow & WorkspaceOwnedRow;
  return { ...row, workspaceId };
}

function normaliseCollections<TState extends object>(
  state: TState,
  workspaceId: WorkspaceId,
  collections: readonly WorkspaceRowCollection[],
): TState {
  const source = state as Record<string, unknown>;
  let next: Record<string, unknown> | undefined;

  for (const collection of collections) {
    const value = source[collection];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      throw new Error(`Workspace row collection ${collection} must be an array.`);
    }

    let changed = false;
    const rows = value.map((candidate, index) => {
      if (!isRecord(candidate)) {
        throw new Error(`Workspace row collection ${collection} contains a non-object row.`);
      }
      const owned = ownWorkspaceRow(
        candidate,
        workspaceId,
        `${collection}/${rowLabel(candidate, index)}`,
      );
      if (owned !== candidate) changed = true;
      return owned;
    });

    if (changed) {
      next ??= { ...source };
      next[collection] = rows;
    }
  }

  return (next ?? source) as TState;
}

/** Schema/load normaliser. It never overwrites a conflicting owner; conflict is corruption. */
export function normaliseWorkspaceRows<TState extends object>(
  state: TState,
  workspaceId: WorkspaceId,
): TState {
  return normaliseCollections(state, workspaceId, WORKSPACE_ROW_COLLECTIONS);
}

/** Normalise only row collections present in a store patch before publishing it. */
export function normaliseWorkspaceRowPatch<TPatch extends object>(
  patch: TPatch,
  workspaceId: WorkspaceId,
): TPatch {
  return normaliseCollections(patch, workspaceId, WORKSPACE_ROW_COLLECTIONS);
}

/**
 * Fail-closed query assertion. This checks the complete collection before returning anything; it
 * never reads a global array and filters mismatched rows after the fact.
 */
export function requireWorkspaceRows<TState extends object>(
  state: TState,
  workspaceId: WorkspaceId,
): TState {
  const source = state as Record<string, unknown>;
  for (const collection of WORKSPACE_ROW_COLLECTIONS) {
    const value = source[collection];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      throw new Error(`Workspace row collection ${collection} must be an array.`);
    }
    value.forEach((candidate, index) => {
      if (!isRecord(candidate)) {
        throw new Error(`Workspace row collection ${collection} contains a non-object row.`);
      }
      if (String(candidate.workspaceId ?? '') !== String(workspaceId)) {
        throw new Error(
          `${collection}/${rowLabel(candidate, index)} is not owned by workspace ${String(workspaceId)}.`,
        );
      }
    });
  }
  return state;
}

export type WorkspaceScopedRowRepository = Readonly<{
  workspaceId: WorkspaceId;
  list(collection: WorkspaceRowCollection): readonly WorkspaceOwnedRow[];
  get(collection: WorkspaceRowCollection, id: string): WorkspaceOwnedRow | undefined;
}>;

/**
 * Small production adapter over the legacy AppState arrays. The repository is constructed only
 * after the partition header and every row pass their workspace checks. `list` returns the exact
 * collection, not a post-read filtered copy.
 */
export function createWorkspaceScopedRowRepository<
  TState extends WorkspacePartitionHeader & object,
>(state: TState, requestedWorkspaceId: WorkspaceId): WorkspaceScopedRowRepository {
  const partition = requireWorkspaceData(state, requestedWorkspaceId);
  const checked = requireWorkspaceRows(partition, requestedWorkspaceId) as TState &
    Record<string, unknown>;

  return {
    workspaceId: requestedWorkspaceId,
    list(collection) {
      const rows = checked[collection];
      if (!Array.isArray(rows)) return [];
      return rows as readonly WorkspaceOwnedRow[];
    },
    get(collection, id) {
      return this.list(collection).find((candidate) => {
        const row = candidate as WorkspaceOwnedRow & Record<string, unknown>;
        return String(row.id ?? '') === id;
      });
    },
  };
}
