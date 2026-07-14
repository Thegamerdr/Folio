// Default route (`/`) — the self-contained nav shell for the faithful RN Folio port. This is the
// only route; the legacy Gen-1/Gen-2 surfaces were excised (plan 112, 2026-07-11) and only the
// live kit primitives remain under src/surfaces/pressureMap. ThemeProvider is mounted once at
// the app root (app/_layout.tsx); this route reads the active palette for the canvas ground.
//
// Splash: app/_layout.tsx calls preventAutoHideAsync(); this route hides it once mounted so the
// shell is visible on first paint (app/home.tsx hides it too, for when the legacy app is opened).
//
// GestureHandlerRootView + SafeAreaProvider are mounted here so the shell is self-contained: the
// shared kit primitives + ported screens rely on the gesture system and safe-area insets.

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { useTheme } from '@/surfaces/pressureMap/kit';
import { FolioShell } from '@/folio/shell/FolioShell';
import { importMeloBlobIfPresent, loadPersisted, startPersisting } from '@/folio/lib/persist';
import { startNotificationScheduler } from '@/folio/lib/notifyScheduler';
import { ensureAndroidChannel } from '@/folio/lib/notifications';
import { startWidgetSync } from '@/folio/widget/widgetSnapshotWriter';
import { reconcileEntitlements } from '@/folio/lib/billing/entitlements';

export default function FolioRoute() {
  const t = useTheme();
  // Gate first render until persisted state is hydrated, so the shell never
  // paints seeded defaults for a frame before the user's real data loads —
  // the splash stays up (it is hidden only once `ready` flips).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let stopNotifications: (() => void) | undefined;
    let stopWidgetSync: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      await loadPersisted(); // read blob off disk → hydrate store (no-op on first run).
      if (cancelled) return;
      // One-time data-continuity import from the archived Melo surface's own
      // blob, if the folio store is still empty. Runs AFTER loadPersisted so
      // the emptiness check reads real hydrated state. Silent no-op on any
      // failure — see lib/persist.ts `importMeloBlobIfPresent`.
      await importMeloBlobIfPresent();
      if (cancelled) return;
      // Reconcile the persisted store-purchase entitlement record against the lens store's own
      // unlock flags (see lib/billing/entitlements.ts `reconcileEntitlements` for the exact
      // repair rule + why an expired entitlement is never revoked here). Runs after the melo
      // import so it reconciles against the final hydrated lens state, before persistence starts.
      await reconcileEntitlements();
      if (cancelled) return;
      stop = startPersisting(); // begin debounced write-on-change.
      // Reminders: create the Android channel once, then start the reschedule loop (reads real
      // hydrated state — see notifyScheduler.ts). A denied/undetermined permission makes every
      // schedule call a graceful no-op, so this is safe to start unconditionally.
      await ensureAndroidChannel();
      if (cancelled) return;
      stopNotifications = startNotificationScheduler();
      // Keep the SafeZoneWidget snapshot (widget/widgetSnapshotStore.ts) and any widget already on
      // a home screen in sync with the store, debounced. Android-only under the hood
      // (react-native-android-widget no-ops on iOS), so this is safe to start unconditionally.
      stopWidgetSync = startWidgetSync();
      setReady(true);
    })();
    return () => {
      cancelled = true;
      stop?.();
      stopNotifications?.();
      stopWidgetSync?.();
    };
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null; // keep the native splash up until hydration finishes.

  return (
    <GestureHandlerRootView style={[styles.flex, { backgroundColor: t.canvas }]}>
      <SafeAreaProvider>
        {/* Every screen and the bottom nav already consume the real safe-area insets. Keeping a
            second safe-area + 24dp frame here doubled their intended phone gutters and exposed the
            window background when Android invalidated an animated child. This native root owns the
            full canvas; screens remain responsible for their designed content insets. */}
        <View collapsable={false} style={[styles.frame, { backgroundColor: t.canvas }]}>
          <FolioShell />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  frame: { flex: 1 },
});
