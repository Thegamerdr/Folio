/**
 * Widget snapshot persistence — the thin native-adapter layer that lets the headless
 * widget task handler (which runs in its own JS context, with no live app store) read
 * the LAST computed `SafeZoneWidgetSnapshot` off disk. Mirrors the shape of
 * `lib/persist.ts` (expo-file-system, document directory, swallow-and-keep-going on any
 * failure) but deliberately UNENCRYPTED: the snapshot carries only what the widget
 * already shows in plaintext on the home screen (a rounded Safe Zone figure, a payday
 * date, a weather word) — nothing that isn't already visible without unlocking the
 * phone, so the at-rest encryption bar that applies to the full money store
 * (lib/cryptoBlob.ts) does not apply here.
 *
 * Two callers:
 *   - App side (`widgetSnapshotWriter.ts`): writes a fresh snapshot on every store
 *     change, debounced.
 *   - Widget side (`widgetTaskHandler.ts`): reads the last-written snapshot when the OS
 *     asks the headless task to redraw (add / periodic update / resize) — no store
 *     access is required there, only the persisted snapshot.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { createWorkspaceId, type WorkspaceId } from '@folio/domain';

import type { SafeZoneWidgetSnapshot } from '@/folio/lib/widgetSnapshot';

const SNAPSHOT_FILENAME = 'folio.widget-snapshot.v1.json';

function snapshotFileUri(): string | null {
  const dir = FileSystem.documentDirectory;
  if (dir === null) return null;
  return `${dir}${SNAPSHOT_FILENAME}`;
}

/** Write the snapshot to disk. Fire-and-forget from the caller's perspective — any
 *  disk/quota failure is swallowed (matches `persist.ts`'s tolerance): a widget that
 *  briefly shows stale data is fine, a crashed app is not. */
export async function writeWidgetSnapshot(
  workspaceId: WorkspaceId,
  snapshot: SafeZoneWidgetSnapshot,
): Promise<void> {
  const checked = createWorkspaceId(String(workspaceId));
  if (String(snapshot.workspaceId) !== String(checked)) {
    throw new Error('Widget snapshot ownership does not match the active workspace.');
  }
  const uri = snapshotFileUri();
  if (uri === null) return;
  try {
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(snapshot), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    /* disk / quota failure — swallow, retry on next store change. */
  }
}

/** Read the last-persisted snapshot. Returns `null` when nothing has been written yet
 *  (fresh install, widget added before the app ever computed one) or on any read/parse
 *  failure — the widget's own renderer treats `null` as the honest empty state. */
export async function readWidgetSnapshot(): Promise<SafeZoneWidgetSnapshot | null> {
  const uri = snapshotFileUri();
  if (uri === null) return null;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const parsed = JSON.parse(raw) as Partial<SafeZoneWidgetSnapshot>;
    if (parsed === null || typeof parsed !== 'object') return null;
    try {
      const workspaceId = createWorkspaceId(String(parsed.workspaceId ?? ''));
      return { ...parsed, workspaceId } as SafeZoneWidgetSnapshot;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
