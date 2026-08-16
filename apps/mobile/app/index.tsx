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

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, View, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { useTheme } from '@/surfaces/pressureMap/kit';
import { FolioShell } from '@/folio/shell/FolioShell';
import {
  importMeloBlobIfPresent,
  getHydrationOutcome,
  loadPersistedActiveWorkspace,
  startPersisting,
} from '@/folio/lib/persist';
import { startNotificationScheduler } from '@/folio/lib/notifyScheduler';
import { ensureAndroidChannel } from '@/folio/lib/notifications';
import { startWidgetSync } from '@/folio/widget/widgetSnapshotWriter';
import { reconcileEntitlements } from '@/folio/lib/billing/entitlements';
import { authenticateAppLock, prepareAppLock, subscribeAppLockSettings } from '@/folio/lib/appLock';
import { AppLockGate } from '@/folio/ui/AppLockGate';
import { PERSONAL_WORKSPACE_ID } from '@/folio/lib/workspaceRoot';
import { hydrateMeloCompanionBehavior } from '@/folio/companion/persistence';
import { sweepOwnedPickerStaging } from '@/folio/lib/pickerCache';

export default function FolioRoute() {
  const t = useTheme();
  // Gate first render until persisted state is hydrated, so the shell never
  // paints seeded defaults for a frame before the user's real data loads —
  // the splash stays up (it is hidden only once `ready` flips).
  const [ready, setReady] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [recoveredRemovedDeviceLock, setRecoveredRemovedDeviceLock] = useState(false);
  const lockEnabledRef = useRef(false);
  const lockedRef = useRef(false);
  const authenticatingRef = useRef(false);

  const updateLocked = useCallback((next: boolean) => {
    lockedRef.current = next;
    setLocked(next);
  }, []);

  const attemptUnlock = useCallback(async () => {
    if (!lockEnabledRef.current) {
      updateLocked(false);
      return;
    }
    if (authenticatingRef.current) return;
    authenticatingRef.current = true;
    setLockBusy(true);
    setLockMessage(null);
    const result = await authenticateAppLock();
    if (result.success) {
      updateLocked(false);
    } else {
      updateLocked(true);
      setLockMessage(
        result.reason === 'cancelled'
          ? 'Melo stayed locked.'
          : result.reason === 'device-lock-not-set'
            ? 'Your device screen lock is no longer available. Restart Melo to recover safely.'
            : 'Your device could not finish authentication. Try again.',
      );
    }
    authenticatingRef.current = false;
    setLockBusy(false);
  }, [updateLocked]);

  useEffect(
    () =>
      subscribeAppLockSettings((settings) => {
        lockEnabledRef.current = settings.enabled;
        setLockEnabled(settings.enabled);
        if (!settings.enabled) updateLocked(false);
      }),
    [updateLocked],
  );

  useEffect(() => {
    const handleStateChange = (nextState: AppStateStatus) => {
      if (!lockEnabledRef.current) return;
      if (nextState !== 'active') {
        if (!authenticatingRef.current) updateLocked(true);
        return;
      }
      if (lockedRef.current && !authenticatingRef.current) void attemptUnlock();
    };
    const subscription = AppState.addEventListener('change', handleStateChange);
    return () => subscription.remove();
  }, [attemptUnlock, updateLocked]);

  useEffect(() => {
    if (ready && locked && AppState.currentState === 'active') void attemptUnlock();
  }, [attemptUnlock, locked, ready]);

  useEffect(() => {
    if (!ready || !recoveredRemovedDeviceLock) return;
    Alert.alert(
      'App lock was turned off',
      'This device no longer has the screen lock Melo previously used. Your encrypted vault is unchanged; add a device lock before enabling Melo app lock again.',
      [{ text: 'OK', style: 'cancel' }],
    );
    setRecoveredRemovedDeviceLock(false);
  }, [ready, recoveredRemovedDeviceLock]);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let stopNotifications: (() => void) | undefined;
    let stopWidgetSync: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      await sweepOwnedPickerStaging().catch(() => undefined);
      if (cancelled) return;
      const activeWorkspaceId = await loadPersistedActiveWorkspace();
      if (cancelled) return;
      if (getHydrationOutcome() === 'incompatible-future-schema') {
        // A rollback must remain completely read-only. Do not run imports, entitlement repair,
        // companion persistence, notifications, widgets, or the background writer over data from a
        // newer Melo schema. FolioShell renders the non-dismissible update gate instead.
        setReady(true);
        return;
      }
      // One-time data-continuity import from the archived Melo surface's own
      // blob, if the folio store is still empty. Runs AFTER loadPersisted so
      // the emptiness check reads real hydrated state. Silent no-op on any
      // failure — see lib/persist.ts `importMeloBlobIfPresent`.
      if (activeWorkspaceId === PERSONAL_WORKSPACE_ID) {
        await importMeloBlobIfPresent(PERSONAL_WORKSPACE_ID);
      }
      if (cancelled) return;
      // Reconcile the persisted store-purchase entitlement record against the lens store's own
      // unlock flags (see lib/billing/entitlements.ts `reconcileEntitlements` for the exact
      // repair rule + why an expired entitlement is never revoked here). Runs after the melo
      // import so it reconciles against the final hydrated lens state, before persistence starts.
      await reconcileEntitlements();
      if (cancelled) return;
      // Companion cadence, dismissals and preferred perches are non-financial but must survive an
      // app restart. Hydrate that small encrypted record before mounting the one persistent host.
      await hydrateMeloCompanionBehavior();
      if (cancelled) return;
      // Resolve the optional app-lock preference before first paint. A removed device credential
      // disables only this foreground gate so the user is never permanently locked out; the
      // encrypted vault and device-only key remain unchanged.
      const preparedLock = await prepareAppLock();
      if (cancelled) return;
      lockEnabledRef.current = preparedLock.settings.enabled;
      setLockEnabled(preparedLock.settings.enabled);
      updateLocked(preparedLock.settings.enabled);
      setRecoveredRemovedDeviceLock(preparedLock.recoveredAfterDeviceLockRemoval);
      stop = startPersisting(activeWorkspaceId); // persist whichever isolated partition is active.
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
  }, [updateLocked]);

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
          {lockEnabled && locked ? (
            <AppLockGate busy={lockBusy} message={lockMessage} onUnlock={attemptUnlock} />
          ) : (
            <FolioShell />
          )}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  frame: { flex: 1 },
});
