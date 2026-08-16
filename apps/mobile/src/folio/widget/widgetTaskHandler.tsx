/**
 * Headless widget task handler — runs in its own JS context whenever Android asks
 * the app to draw/redraw a `SafeZoneWidget` (added, periodic update, resized,
 * deleted, or clicked). This context has NO live app store: registration happens at
 * JS-bundle-load time (see the registration call in `app/_layout.tsx`), independent of
 * whether the main app UI has ever mounted, so this handler reads the last snapshot
 * the app persisted (`widgetSnapshotStore.ts`) rather than importing `@/folio/store`.
 *
 * Per `react-native-android-widget`'s contract (`WidgetTaskHandler`): call
 * `props.renderWidget(...)` with the JSX to draw; `WIDGET_DELETED` needs no render
 * (the library itself no-ops any render call for that action, but we still skip the
 * disk read to avoid needless work).
 */
import type { WidgetTaskHandler } from 'react-native-android-widget';

import { SafeZoneWidget } from './SafeZoneWidget';
import { readWidgetSnapshot } from './widgetSnapshotStore';

export const safeZoneWidgetTaskHandler: WidgetTaskHandler = async (props) => {
  if (props.widgetAction === 'WIDGET_DELETED') return;

  try {
    const snapshot = await readWidgetSnapshot();
    props.renderWidget(<SafeZoneWidget snapshot={snapshot} />);
  } catch {
    // best-effort — never blocks/crashes the lane. Mirror readWidgetSnapshot's own null path
    // (its honest empty state) so the widget still renders something instead of nothing.
    props.renderWidget(<SafeZoneWidget snapshot={null} />);
  }
};
