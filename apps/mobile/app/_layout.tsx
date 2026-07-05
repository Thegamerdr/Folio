import {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
  Fraunces_600SemiBold_Italic,
} from '@expo-google-fonts/fraunces';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider, useIsDark, useTheme } from '../src/surfaces/pressureMap/kit';

// Editorial Ledger lives or dies on a real serif. Keep the splash up until Fraunces is loaded so
// the first paint is already editorial — never a system-font flash that then swaps.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// The themed shell. It lives UNDER ThemeProvider so the root background + status bar follow the
// resolved palette (and so a forced Light/Dark choice — not just 'system' — is honoured here too).
function ThemedRoot() {
  const t = useTheme();
  // Light status-bar glyphs on the dark ground, dark glyphs on the cream. `useIsDark` reflects the
  // resolved palette, so a forced Light/Dark choice is honoured, not just the OS scheme.
  const isDark = useIsDark();

  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: t.canvas },
          headerShown: false,
        }}
      />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
    // Body/UI sans, matching the web's --font-sans. Vendored locally as a single variable TTF
    // (Inter Tight ships variable-only upstream — see assets/fonts/InterTight-Variable.ttf).
    InterTight: require('../assets/fonts/InterTight-Variable.ttf'),
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  );
}
