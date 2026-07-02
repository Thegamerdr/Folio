// The Melo surface route (`/melo`) — MELO_PHASE2_PLAN.md §3: a parallel surface for dogfooding,
// additive beside `/` (faithful Folio port) and `/home` (legacy pressure map). Nothing in the
// existing boot path links here yet; whether Melo becomes the front door is a later product call.
//
// Gate: onboarding until the user completes it (or peeks via "look around first"), then the
// Glance. Store state is encrypted at rest and survives restarts (state/meloStore.tsx).

import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/surfaces/pressureMap/kit';
import { MeloGlance } from '@/melo/screens/MeloGlance';
import { MeloOnboarding } from '@/melo/screens/MeloOnboarding';
import { MeloStoreProvider, useMeloStore } from '@/melo/state/meloStore';

function MeloRoute() {
  const t = useTheme();
  const store = useMeloStore();
  const [peeking, setPeeking] = useState(false);

  // If this route is the first paint (deep link straight to /melo), release the splash here too —
  // the same courtesy app/index.tsx and app/home.tsx extend.
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  if (!store.ready) return null;

  const showOnboarding = !store.state.setup.onboarded && !peeking;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: t.canvas }]}>
      {showOnboarding ? (
        <MeloOnboarding
          onComplete={store.completeOnboarding}
          onSkipToDemo={() => setPeeking(true)}
        />
      ) : (
        <MeloGlance />
      )}
    </SafeAreaView>
  );
}

export default function Melo() {
  return (
    <SafeAreaProvider>
      <MeloStoreProvider>
        <MeloRoute />
      </MeloStoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
