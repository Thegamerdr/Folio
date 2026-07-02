// The Melo surface route (`/melo`) — MELO_PHASE2_PLAN.md §3: a parallel surface for dogfooding,
// additive beside `/` (faithful Folio port) and `/home` (legacy pressure map). Nothing in the
// existing boot path links here yet; whether Melo becomes the front door is a later product call.

import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/surfaces/pressureMap/kit';
import { MeloGlance } from '@/melo/screens/MeloGlance';

function MeloRoute() {
  const t = useTheme();

  // If this route is the first paint (deep link straight to /melo), release the splash here too —
  // the same courtesy app/index.tsx and app/home.tsx extend.
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: t.canvas }]}>
      <MeloGlance />
    </SafeAreaView>
  );
}

export default function Melo() {
  return (
    <SafeAreaProvider>
      <MeloRoute />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
