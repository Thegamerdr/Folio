// Default route (`/`) — the self-contained nav shell for the faithful RN Folio port. This is now
// what the app shows on launch. The legacy pressure-map app moved to app/home.tsx (reachable at
// /home); everything under src/surfaces/pressureMap is untouched. ThemeProvider is mounted once at
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
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { useTheme } from '@/surfaces/pressureMap/kit';
import { FolioShell } from '@/folio/shell/FolioShell';
import { loadPersisted, startPersisting } from '@/folio/lib/persist';

export default function FolioRoute() {
  const t = useTheme();
  // Gate first render until persisted state is hydrated, so the shell never
  // paints seeded defaults for a frame before the user's real data loads —
  // the splash stays up (it is hidden only once `ready` flips).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      await loadPersisted(); // read blob off disk → hydrate store (no-op on first run).
      if (cancelled) return;
      stop = startPersisting(); // begin debounced write-on-change.
      setReady(true);
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null; // keep the native splash up until hydration finishes.

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: t.canvas }]}>
          <View style={styles.frame}>
            <FolioShell />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  frame: { flex: 1, paddingHorizontal: 24 },
});
