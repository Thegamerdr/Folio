// Small persisted scheduler ledger. It contains only coarse state bands and counters, never money
// values, merchants, titles, notification bodies, or calendar contents. Persisting this seam stops
// a cold restart from re-announcing the same transition or resetting the daily fatigue budget.

import * as FileSystem from 'expo-file-system/legacy';
import { createWorkspaceId, type WorkspaceId } from '@folio/domain';

import type { NotifySnapshot } from './notifyState';
import { PERSONAL_WORKSPACE_ID } from './workspaceRoot';

const RUNTIME_FILENAME = 'reminders.runtime.v1.json';

export interface NotifyRuntimeState {
  readonly version: 1;
  readonly localDay: string;
  readonly sentToday: number;
  readonly dangerSentToday: number;
  readonly lastSnapshot: NotifySnapshot | null;
}

export const EMPTY_NOTIFY_RUNTIME_STATE: NotifyRuntimeState = {
  version: 1,
  localDay: '',
  sentToday: 0,
  dangerSentToday: 0,
  lastSnapshot: null,
};

function runtimeFileUri(workspaceId: WorkspaceId): string | null {
  const checked = createWorkspaceId(String(workspaceId));
  return FileSystem.documentDirectory === null
    ? null
    : `${FileSystem.documentDirectory}${RUNTIME_FILENAME}.${checked}.json`;
}

function legacyRuntimeFileUri(): string | null {
  return FileSystem.documentDirectory === null
    ? null
    : `${FileSystem.documentDirectory}${RUNTIME_FILENAME}`;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 10_000;
}

function parseSnapshot(value: unknown): NotifySnapshot | null {
  if (value === null) return null;
  if (value === null || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  if (!['calm', 'warning', 'danger', 'overspent'].includes(String(source.ladder))) return null;
  if (
    source.dangerDaysAway !== null &&
    (typeof source.dangerDaysAway !== 'number' ||
      !Number.isInteger(source.dangerDaysAway) ||
      source.dangerDaysAway < 0)
  ) {
    return null;
  }
  return {
    ladder: source.ladder as NotifySnapshot['ladder'],
    dangerDaysAway: source.dangerDaysAway as number | null,
  };
}

export function parseNotifyRuntimeState(raw: string): NotifyRuntimeState {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return EMPTY_NOTIFY_RUNTIME_STATE;
    const source = parsed as Record<string, unknown>;
    return {
      version: 1,
      localDay: typeof source.localDay === 'string' ? source.localDay : '',
      sentToday: isCount(source.sentToday) ? source.sentToday : 0,
      dangerSentToday: isCount(source.dangerSentToday) ? source.dangerSentToday : 0,
      lastSnapshot: parseSnapshot(source.lastSnapshot),
    };
  } catch {
    return EMPTY_NOTIFY_RUNTIME_STATE;
  }
}

export async function loadNotifyRuntimeState(
  workspaceId: WorkspaceId,
): Promise<NotifyRuntimeState> {
  const uri = runtimeFileUri(workspaceId);
  if (uri === null) return EMPTY_NOTIFY_RUNTIME_STATE;
  const scoped = await readRuntimeState(uri);
  if (scoped !== null) return scoped;
  if (String(workspaceId) === String(PERSONAL_WORKSPACE_ID)) {
    const legacyUri = legacyRuntimeFileUri();
    if (legacyUri !== null) {
      const legacy = await readRuntimeState(legacyUri);
      if (legacy !== null) {
        await saveNotifyRuntimeState(workspaceId, legacy);
        return legacy;
      }
    }
  }
  return EMPTY_NOTIFY_RUNTIME_STATE;
}

export async function saveNotifyRuntimeState(
  workspaceId: WorkspaceId,
  state: NotifyRuntimeState,
): Promise<void> {
  const uri = runtimeFileUri(workspaceId);
  if (uri === null) return;
  const targets = [uri];
  if (String(workspaceId) === String(PERSONAL_WORKSPACE_ID)) {
    const legacy = legacyRuntimeFileUri();
    if (legacy !== null) targets.push(legacy);
  }
  for (const target of targets) {
    try {
      await FileSystem.writeAsStringAsync(target, JSON.stringify(state), {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch {
      // Best-effort fatigue state; never block the product on a preference-ledger write.
    }
  }
}

async function readRuntimeState(uri: string): Promise<NotifyRuntimeState | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    return parseNotifyRuntimeState(
      await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 }),
    );
  } catch {
    return null;
  }
}
