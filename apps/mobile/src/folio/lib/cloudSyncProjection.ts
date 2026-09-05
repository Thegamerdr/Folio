import type { WorkspaceId } from '@folio/domain';

/**
 * The sync payload is deliberately a projection, not the persistence blob.  The latter is a
 * device-local restart format and will grow fields for auth, billing, render state and inboxes.
 * Keeping the exclusion list here makes that boundary reviewable and lets replay merge only
 * user-owned workspace data into the currently selected local partition.
 */
/** Explicit authority manifest. Unknown future fields must stay local until deliberately added. */
const SHAREABLE_KEYS = new Set([
  'pots',
  'subs',
  'subPaused',
  'subOverrides',
  'cycles',
  'onboarding',
  'currentBalance',
  'potLedger',
  'nextYouNote',
  'tightPointGoal',
  'transactions',
  'droppedTransactionCount',
  'edits',
  'calendarEvents',
  'ignoredReviewSigs',
  'moneyMode',
  'bufferAmount',
  'modeExtras',
  'debts',
  'household',
  'plans',
  'cancelledSubs',
  'spendHold',
  'whatIfHolds',
  'business',
  'timelineEvents',
  'reviewQueue',
  'reviewQueueSpillover',
  'reviewQueueOverflowCount',
  'reviewQueueDiscardedCount',
  'ignoredBankExternalIds',
  'incomeSources',
  'dismissedIncomeSignals',
  'dismissedBillSignals',
  'dismissedDriftSignals',
  'dismissedAnnualSignals',
  'merchantCategories',
  // Statement import summaries are workspace history, but evidenceDocuments deliberately stays
  // device-local: its encrypted originals/reader queues cannot be reconstructed on another phone.
  'statementImports',
  'accounts',
]);

/** Shared by patch replay so an authenticated operation cannot smuggle a new top-level field
 * into the exact workspace envelope merely because its JSON shape is otherwise valid. */
export function isShareableCloudSyncField(key: string): boolean {
  return SHAREABLE_KEYS.has(key);
}

export type ShareableCloudSyncProjection = Readonly<{
  version: 1;
  workspaceId: string;
  state: Readonly<Record<string, unknown>>;
}>;

export function createShareableCloudSyncProjection(
  payload: string,
  workspaceId: WorkspaceId | string,
): string {
  const parsed = parseRecord(payload, 'Cloud sync state');
  const state: Record<string, unknown> = {};
  for (const key of Object.keys(parsed).sort(compareCodePoints)) {
    if (!SHAREABLE_KEYS.has(key)) continue;
    state[key] = parsed[key];
  }
  return stableJson({ version: 1, workspaceId: String(workspaceId), state });
}

export function parseShareableCloudSyncProjection(raw: string): ShareableCloudSyncProjection {
  const parsed = parseRecord(raw, 'Cloud sync projection');
  if (parsed.version !== 1 || typeof parsed.workspaceId !== 'string' || !isRecord(parsed.state)) {
    throw new Error('Cloud sync projection metadata is invalid.');
  }
  if (Object.keys(parsed.state).some((key) => !SHAREABLE_KEYS.has(key))) {
    throw new Error(
      'Cloud sync projection contains a field outside the workspace authority manifest.',
    );
  }
  return {
    version: 1,
    workspaceId: parsed.workspaceId,
    state: parsed.state,
  };
}

/** Merge a verified projection into the selected local persistence envelope. */
export function mergeShareableCloudSyncProjection(
  currentPayload: string,
  projectionRaw: string,
  workspaceId: WorkspaceId | string,
): string {
  const current = parseRecord(currentPayload, 'Current cloud sync state');
  const projection = parseShareableCloudSyncProjection(projectionRaw);
  if (projection.workspaceId !== String(workspaceId)) {
    throw new Error('Cloud sync projection belongs to another workspace.');
  }
  const next: Record<string, unknown> = { ...current };
  // The projection is a complete authority snapshot for its allowlisted fields. A missing field
  // therefore means the remote side deliberately has no value, rather than "leave local as-is".
  for (const key of SHAREABLE_KEYS) if (!(key in projection.state)) delete next[key];
  for (const [key, value] of Object.entries(projection.state)) next[key] = value;
  next.activeWorkspaceId = String(workspaceId);
  next.dataWorkspaceId = String(workspaceId);
  return JSON.stringify(next);
}

export function stableCloudSyncJson(value: unknown): string {
  return stableJson(value);
}

function parseRecord(raw: string, label: string): Record<string, any> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
  if (!isRecord(parsed)) throw new Error(`${label} is not an object.`);
  return parsed;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort(compareCodePoints)
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
