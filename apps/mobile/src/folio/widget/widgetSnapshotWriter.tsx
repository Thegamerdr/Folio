/**
 * App-side widget writer — subscribes to the store and keeps the persisted widget
 * snapshot (`widgetSnapshotStore.ts`) in sync, then asks the OS to redraw every
 * `SafeZoneWidget` currently on a home screen. Mirrors `lib/persist.ts`'s own
 * subscribe-and-debounce shape so store bursts (a ritual close touching several
 * slices) coalesce into one write + one redraw instead of one per field.
 *
 * Call `startWidgetSync()` once, alongside `startPersisting()`, when the app mounts.
 * Safe to call even when no widget has ever been added — `requestWidgetUpdate`'s
 * `widgetNotFound` callback is a no-op here (there's nothing to clean up: the
 * snapshot write already happened and costs nothing if unread).
 */
import { requestWidgetUpdate } from 'react-native-android-widget';

import { getState, subscribeStore } from '@/folio/store';
import { buildWidgetSnapshot } from '@/folio/lib/widgetSnapshot';

import { SafeZoneWidget } from './SafeZoneWidget';
import { writeWidgetSnapshot } from './widgetSnapshotStore';

/** Must match the `name` given to this widget in the `react-native-android-widget`
 *  config plugin's `widgets` array (see the app.json block returned alongside this
 *  lane's changes) — the string is the only link between the config plugin's
 *  generated Android provider and this JS-side renderer. */
export const SAFE_ZONE_WIDGET_NAME = 'SafeZoneWidget';

const WRITE_DEBOUNCE_MS = 400;

function makeDebounced(fn: () => void, ms: number): () => void {
  let handle: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (handle !== null) clearTimeout(handle);
    handle = setTimeout(() => {
      handle = null;
      fn();
    }, ms);
  };
}

async function syncNow(): Promise<void> {
  try {
    const state = getState();
    const snapshot = buildWidgetSnapshot(state, new Date());
    await writeWidgetSnapshot(state.activeWorkspaceId, snapshot);
    // Push straight to any widget already on the home screen. `widgetNotFound` is left
    // unset — no widget on screen is the common case (most users never add it) and needs
    // no cleanup; the snapshot write above already covers the OS-driven redraw path for
    // when one gets added later.
    await requestWidgetUpdate({
      widgetName: SAFE_ZONE_WIDGET_NAME,
      renderWidget: () => <SafeZoneWidget snapshot={snapshot} />,
    });
  } catch {
    /* best-effort — never blocks/crashes the lane. */
  }
}

/** Subscribe to the store and keep the widget in sync, debounced. Returns an
 *  unsubscribe function. Call once at app startup, after `loadPersisted()`. */
export function startWidgetSync(): () => void {
  const debouncedSync = makeDebounced(() => {
    void syncNow();
  }, WRITE_DEBOUNCE_MS);

  // Fire once immediately so a fresh app open updates a stale widget without waiting
  // for the first store write.
  void syncNow();

  return subscribeStore(debouncedSync);
}
