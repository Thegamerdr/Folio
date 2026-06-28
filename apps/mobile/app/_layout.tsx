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
import { useColorScheme } from 'react-native';

// Editorial Ledger lives or dies on a real serif. Keep the splash up until Fraunces is loaded so
// the first paint is already editorial — never a system-font flash that then swaps.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
  });
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!fontsLoaded) return null;

  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: isDark ? '#101412' : '#F7F6F1',
          },
          headerShown: false,
        }}
      />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}
