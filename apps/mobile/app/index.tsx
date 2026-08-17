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
import {
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from 'react-native';
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
  const [startupFailure, setStartupFailure] = useState<string | null>(null);
  const [startupAttempt, setStartupAttempt] = useState(0);
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
    try {
      const result = await authenticateAppLock();
      if (result.success) {
        updateLocked(false);
        return;
      }
      updateLocked(true);
      setLockMessage(
        result.reason === 'cancelled'
          ? 'Melo stayed locked.'
          : result.reason === 'device-lock-not-set'
            ? 'Your device screen lock is no longer available. Restart Melo to recover safely.'
            : 'Your device could not finish authentication. Try again.',
      );
    } catch {
      updateLocked(true);
      setLockMessage('Your device could not finish authentication. Try again.');
    } finally {
      authenticatingRef.current = false;
      setLockBusy(false);
    }
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
      try {
        setStartupFailure(null);
        await sweepOwnedPickerStaging().catch(() => undefined);
        if (cancelled) return;
        const activeWorkspaceId = await loadPersistedActiveWorkspace();
        if (cancelled) return;
        if (getHydrationOutcome() === 'incompatible-future-schema') {
          // A rollback must remain completely read-only. Do not run imports, entitlement repair,
          // companion persistence, notifications, widgets, or the background writer over data from
          // a newer Melo schema. FolioShell renders the non-dismissible update gate instead.
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
        await reconcileEntitlements();
        if (cancelled) return;

        // Companion memory is useful but must never prevent access to the financial app.
        await hydrateMeloCompanionBehavior().catch(() => undefined);
        if (cancelled) return;

        // App-lock preparation is security-critical. If it cannot establish whether a saved lock
        // is enforceable, fail closed into the retry surface instead of silently opening the app.
        const preparedLock = await prepareAppLock();
        if (cancelled) return;
        lockEnabledRef.current = preparedLock.settings.enabled;
        setLockEnabled(preparedLock.settings.enabled);
        updateLocked(preparedLock.settings.enabled);
        setRecoveredRemovedDeviceLock(preparedLock.recoveredAfterDeviceLockRemoval);
        stop = startPersisting(activeWorkspaceId);

        // Notifications and widgets are optional projections. A platform/service failure here must
        // not strand the user behind the native splash after their encrypted money state loaded.
        await ensureAndroidChannel().catch(() => undefined);
        if (cancelled) return;
        try {
          stopNotifications = startNotificationScheduler();
        } catch {
          stopNotifications = undefined;
        }
        try {
          stopWidgetSync = startWidgetSync();
        } catch {
          stopWidgetSync = undefined;
        }
        setReady(true);
      } catch (reason: unknown) {
        if (cancelled) return;
        setStartupFailure(
          reason instanceof Error && reason.message.includes('read-only')
            ? reason.message
            : 'Melo could not safely open the encrypted workspace on this attempt.',
        );
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
      stopNotifications?.();
      stopWidgetSync?.();
    };
  }, [startupAttempt, updateLocked]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) {
    // The native splash covers the first attempt. On an explicit retry it has already been hidden,
    // so keep an accessible in-app holding surface rather than flashing a blank window.
    if (startupAttempt === 0) return null;
    return (
      <View style={[styles.recovery, { backgroundColor: t.canvas }]}>
        <Text accessibilityRole="header" style={[styles.recoveryTitle, { color: t.ink }]}>
          Opening your encrypted workspace…
        </Text>
      </View>
    );
  }

  if (startupFailure !== null) {
    return (
      <View
        accessibilityLiveRegion="assertive"
        accessibilityRole="alert"
        style={[styles.recovery, { backgroundColor: t.canvas }]}
      >
        <Text accessibilityRole="header" style={[styles.recoveryTitle, { color: t.ink }]}>
          Melo couldn’t open safely.
        </Text>
        <Text style={[styles.recoveryBody, { color: t.muted }]}>{startupFailure}</Text>
        <Text style={[styles.recoveryBody, { color: t.muted }]}>
          Nothing was cleared. Keep the app installed and try again.
        </Text>
        <Pressable
          accessibilityHint="Retries opening the encrypted workspace"
          accessibilityRole="button"
          onPress={() => {
            setReady(false);
            setStartupFailure(null);
            setStartupAttempt((value) => value + 1);
          }}
          style={[styles.retry, { backgroundColor: t.calmStrong }]}
        >
          <Text style={[styles.retryLabel, { color: t.canvas }]}>Try again</Text>
        </Pressable>
      </View>
    );
  }

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
  recovery: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  recoveryTitle: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
  },
  recoveryBody: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  retry: {
    alignItems: 'center',
    borderRadius: 18,
    marginTop: 24,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  retryLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
});
